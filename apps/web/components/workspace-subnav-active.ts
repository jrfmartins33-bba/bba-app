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
export function isWorkspaceSubNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
