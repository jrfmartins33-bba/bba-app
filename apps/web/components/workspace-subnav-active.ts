/**
 * Epic 21, Sprint 21.4B.3 — extraída de `sidebar.tsx` para ser testável
 * isoladamente (a fronteira usava igualdade exata, `pathname ===
 * item.href`, então "Orçamento" nunca acendia em `/orcamentos/demonstracao`
 * -- só na própria `/orcamentos`).
 *
 * Ativo na própria rota do item ou em qualquer rota filha real (a rota
 * é o próprio `href`, ou começa por `href + "/"`) -- nunca um
 * `startsWith` cru sobre o `href`, que ativaria "/orcamentos" também em
 * uma rota não relacionada como "/orcamento-extra".
 */
interface WorkspaceRouteConfig {
  readonly basePath: string;
  readonly items: ReadonlyArray<{ readonly href?: string }>;
}

function isRouteOrChild(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function isWorkspaceSubNavItemActive(pathname: string, href: string): boolean {
  return isRouteOrChild(pathname, href);
}

export function isWorkspaceActive(pathname: string, workspace: WorkspaceRouteConfig): boolean {
  if (isRouteOrChild(pathname, workspace.basePath)) return true;
  return workspace.items.some((item) => item.href !== undefined && isRouteOrChild(pathname, item.href));
}
