/**
 * Product vocabulary boundary guard (Epic 17.2C — PRINCIPLE 007,
 * "Domain Language Containment", packages/bdos-core/docs/
 * BDS_ARCHITECTURE_PRINCIPLES.md). Mirrors the textual-scan pattern of
 * engineering-boundaries.test.ts/studio-boundaries.test.ts: no
 * TypeScript Compiler API, no test framework, no network — a
 * deterministic filesystem check.
 *
 * Different target than the other two guards: those scan *imports* (a
 * mechanical, unambiguous pattern — `from "..."`). This one scans
 * *user-visible text* — string/template literal contents and JSX text
 * children — for the "Internal only" terms listed in
 * packages/bdos-core/docs/PRODUCT_VOCABULARY.md.
 *
 * Two-phase approach, built and tuned against the real codebase (not
 * hypothetical): phase 1 tokenizes the file, discarding comments
 * (`//`, `/* *\/`) before anything else — a first cut of this guard
 * mistook markdown-style `` `code` `` formatting *inside comments* for
 * real template literals, and JSDoc prose crossing a stray `<`/`>` for
 * JSX text. Phase 2 checks string/template literal contents (minus
 * import specifiers and lines carrying an explicit
 * `vocabulary-guard-allow` comment) and, separately, JSX-like text
 * runs in the comment-stripped remainder (requiring at least one space,
 * since real prose has one and a lone identifier between TypeScript
 * generics — `Array<string>` — usually doesn't).
 *
 * Explicit and deliberate limitation (PRINCIPLE 007 names this too):
 * this guard cannot verify text the Claude API generates freely
 * (`answer`/`compare` Copilot turns, Advisor narration) — a static
 * scan of the system prompt's *instructions* would also flag legitimate
 * uses (the prompt has to describe its own JSON schema to the model,
 * which means naming fields like "decisions"/"recommendations").
 * `claude-narrator.ts`/`copilot-turn-builder.ts` are deliberately NOT
 * in scope here — that surface is covered by manual system-prompt
 * review + response sampling
 * (docs/testing/PRODUCT_VOCABULARY_OPERATIONAL_AUDIT.md),
 * not by this test. Only `copilot-deterministic-turn-builder.ts` is
 * in scope — every string it builds *is* the literal text a user
 * reads, never an instruction to a model.
 *
 * SCAN_TARGETS is explicit (not a wildcard over the whole repo), same
 * discipline as OPERATIONAL_DOMAINS/STUDIO_COMPONENT_FOLDERS — most of
 * `packages/bdos-core` is the Domain Vocabulary layer, where these
 * terms are correct and expected.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

// apps/web/app inclui `route.ts` (handlers server-only — nunca
// renderizado, `console.error` ali é log de servidor, Developer-visible
// por natureza) e `(dashboard)/admin/**` (ferramenta interna,
// Admin-visible por desenho em PRODUCT_VOCABULARY.md — vocabulário
// técnico ali é aceitável, não um achado). Nenhum dos dois entra no
// escopo deste guard.
const SCAN_DIRECTORIES = ["apps/web/components", "apps/web/app", "packages/ui/src"] as const;
const APP_TSX_ONLY_DIRECTORY = "apps/web/app";
const EXCLUDED_PATH_SEGMENTS = ["/admin/"] as const;

const SCAN_FILES: ReadonlyArray<string> = [
  "packages/bdos-core/src/advisor/copilot/copilot-deterministic-turn-builder.ts"
];

// PRODUCT_VOCABULARY.md, "Termos internos absolutos" + os achados
// confirmados em GOLDEN_JOURNEY_VOCABULARY_AUDIT.md. Case-sensitive de
// propósito: cada termo aqui é uma forma PascalCase/snake_case/frase
// distintiva que não colide por acaso com texto legítimo em
// português (ex.: "Decision"/"Recommendation" em inglês nunca são
// substring de "decisão"/"recomendação").
const BANNED_TERMS: ReadonlyArray<string> = [
  "BDOS",
  "Business Facts",
  "Diagnosis",
  "Decision",
  "Recommendation",
  "ExecutionWorkflow",
  "ExecutionTask",
  "ActionPlan",
  "Playbook",
  "Materialization",
  "Workflow Handoff",
  "Intent Router",
  "classifyCopilotIntent",
  "unsupported_action",
  "clarifying_question",
  "recommendation_approved",
  "DecisionSnapshot",
  "Decision Snapshot",
  "Context Snapshot",
  "Confidence Assessment",
  "Historical Memory",
  "Rule-based intent",
  "rule-based-v1",
  "Frozen context",
  "Causal chain",
  "approveRecommendationId",
  "sourceDecisionSnapshotId",
  "executionWorkflowId",
  "Repository",
  "Engineering Advisor"
];

const ALLOW_COMMENT_MARKER = "vocabulary-guard-allow";
const ALLOW_COMMENT_LOOKBACK_LINES = 3;

// Comentários primeiro, sempre — nunca a ordem inversa. Uma string
// entre crases dentro de um comentário (`` `assim` ``, formatação
// estilo markdown, comum neste repositório) não é um template literal
// de verdade; só tratando comentário como token descartado ANTES de
// procurar string é que isso para de gerar falso positivo.
const TOKEN_PATTERN = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

// Aplicado só ao restante do arquivo depois que comentários E strings
// já foram removidos (substituídos por espaço, preservando posição/
// linha) — nunca ao arquivo bruto. Isso é o que impede um JSDoc
// cruzando um `<`/`>` OU um generic (`ReadonlyArray<string>`) de virar
// "texto JSX" por engano; exigir pelo menos um espaço no trecho
// capturado é a segunda linha de defesa (prosa real tem espaço; um
// identificador solto entre generics normalmente não tem).
const JSX_TEXT_PATTERN = />([^<>{}\n]+)</g;

interface TextRef {
  readonly text: string;
  readonly line: number;
  readonly index: number;
}

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly term: string;
  readonly excerpt: string;
}

runTest("guard scans a non-trivial number of source files", () => {
  const total = listAllScannedFiles().length;
  assertEqual(total > 20, true, `expected to scan more than 20 files, scanned ${total}`);
});

runTest("no banned domain-vocabulary term appears in user-visible text (PRINCIPLE 007)", () => {
  const violations = findVocabularyViolations();
  assertNoViolations(violations, "product vocabulary violation(s) found");
});

function findVocabularyViolations(): ReadonlyArray<Violation> {
  const violations: Violation[] = [];

  listAllScannedFiles().forEach((file) => {
    const content = readFileSync(file, "utf8");
    extractUserVisibleText(content).forEach((ref) => {
      if (isAllowListed(content, ref.line)) {
        return;
      }

      BANNED_TERMS.forEach((term) => {
        if (ref.text.includes(term)) {
          violations.push({
            file: toRepoRelative(file),
            line: ref.line,
            term,
            excerpt: ref.text.trim().slice(0, 80)
          });
        }
      });
    });
  });

  return violations;
}

// Fase 1: separa comentários (descartados), strings/template literals
// (verificados como estão, exceto especificador de import) e "resto"
// (onde o texto de JSX vive) — numa passada só, nesta ordem de
// prioridade, para nunca reinterpretar o conteúdo de um comentário
// como string.
function extractUserVisibleText(content: string): ReadonlyArray<TextRef> {
  const refs: TextRef[] = [];
  const remainderChars = content.split("");

  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = TOKEN_PATTERN.exec(content);

  while (match !== null) {
    const raw = match[0];
    const isComment = raw.startsWith("//") || raw.startsWith("/*");

    if (isComment) {
      blankRange(remainderChars, match.index, raw.length);
    } else {
      // Interpolação (`` `texto ${variavel.campo}` ``) nunca é texto
      // exibido — é o NOME da variável/campo, não seu valor em tempo
      // de execução. Sem isto, `${focusRecommendation.summary}` reprova
      // o guard por conter "Recommendation" como substring do nome da
      // variável, um falso positivo puro.
      const text = raw.slice(1, -1).replace(/\$\{[^}]*\}/g, " ");
      if (text.trim().length > 0 && !isImportSpecifier(content, match.index)) {
        refs.push({ text, line: lineAt(content, match.index), index: match.index });
      }
      blankRange(remainderChars, match.index, raw.length);
    }

    match = TOKEN_PATTERN.exec(content);
  }

  const remainder = remainderChars.join("");
  JSX_TEXT_PATTERN.lastIndex = 0;
  let jsxMatch: RegExpExecArray | null = JSX_TEXT_PATTERN.exec(remainder);

  while (jsxMatch !== null) {
    const text = jsxMatch[1] ?? "";
    if (text.includes(" ") && text.trim().length > 0) {
      refs.push({ text, line: lineAt(content, jsxMatch.index), index: jsxMatch.index });
    }
    jsxMatch = JSX_TEXT_PATTERN.exec(remainder);
  }

  return refs;
}

function blankRange(chars: string[], start: number, length: number): void {
  for (let i = start; i < start + length; i += 1) {
    if (chars[i] !== "\n") {
      chars[i] = " ";
    }
  }
}

function isImportSpecifier(content: string, matchIndex: number): boolean {
  const before = content.slice(Math.max(0, matchIndex - 12), matchIndex);
  return /(?:from\s*|import\s*\(\s*)$/.test(before);
}

// Janela de até 3 linhas para trás (não só 1) — um comentário de
// exceção pode ter mais de uma linha de explicação antes do marcador
// aparecer numa linha anterior à do código sinalizado.
function isAllowListed(content: string, line: number): boolean {
  const lines = content.split("\n");

  for (let offset = 0; offset <= ALLOW_COMMENT_LOOKBACK_LINES; offset += 1) {
    const candidateLine = lines[line - 1 - offset] ?? "";
    if (candidateLine.includes(ALLOW_COMMENT_MARKER)) {
      return true;
    }
  }

  return false;
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function listAllScannedFiles(): ReadonlyArray<string> {
  const fromDirectories = SCAN_DIRECTORIES.flatMap((dir) => {
    const tsxOnly = dir === APP_TSX_ONLY_DIRECTORY;
    return listTsFiles(join(REPO_ROOT, dir), tsxOnly).filter(
      (file) => !EXCLUDED_PATH_SEGMENTS.some((segment) => toRepoRelative(file).includes(segment))
    );
  });
  const fromFiles = SCAN_FILES.map((file) => join(REPO_ROOT, file));
  return [...fromDirectories, ...fromFiles];
}

function listTsFiles(dir: string, tsxOnly = false): ReadonlyArray<string> {
  let entries: ReadonlyArray<string>;

  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  const files: string[] = [];

  entries.forEach((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listTsFiles(fullPath, tsxOnly));
      return;
    }

    const isTsx = entry.endsWith(".tsx") && !entry.endsWith(".test.tsx");
    const isTs = entry.endsWith(".ts") && !entry.endsWith(".test.ts");

    // tsxOnly: apps/web/app tem route.ts (handler server-only, nunca
    // renderizado — console.error ali é log de servidor) misturado com
    // page.tsx/layout.tsx (de fato renderizados). Só .tsx entra.
    if (isTsx || (isTs && !tsxOnly)) {
      files.push(fullPath);
    }
  });

  return files;
}

function toRepoRelative(absolutePath: string): string {
  return relative(REPO_ROOT, absolutePath).split("\\").join("/");
}

function assertNoViolations(violations: ReadonlyArray<Violation>, message: string): void {
  if (violations.length === 0) {
    return;
  }

  const details = violations
    .map((violation) => `  ${violation.file}:${violation.line} contains "${violation.term}" — "${violation.excerpt}"`)
    .join("\n");

  throw new Error(`${message} (${violations.length}):\n${details}`);
}

function runTest(name: string, testCase: () => void): void {
  testCase();
  console.log(`ok - ${name}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
