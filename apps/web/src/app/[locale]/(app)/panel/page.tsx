import { PanelShell } from "./_components/panel-shell";

/**
 * Panel (Anasayfa / daily ritual hub) — first W2 coaching screen.
 *
 * Server entry: interactive/data boundary lives in `PanelShell` (client) because the
 * access token is in-memory (AuthProvider). App layout already redirects anonymous users.
 *
 * Layout (DESIGN.md §8): mobile single column; ≥lg a main column + right rail.
 */
export default function PanelPage() {
  return <PanelShell />;
}
