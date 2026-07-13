import { redirect } from "next/navigation";

/**
 * Epic 20 (Decision Experience), Sprint 20.1E.1B — `/memorias` foi
 * substituída pela entrada oficial `/medicoes`. Mesmo padrão de
 * `redirect()` (next/navigation) já usado em app/page.tsx e
 * app/(dashboard)/Page.tsx -- não é um redirect HTTP permanente (301),
 * mesmo comportamento dos dois precedentes.
 */
export default function MemoriasPage() {
  redirect("/medicoes");
}
