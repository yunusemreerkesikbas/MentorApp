/**
 * Drop a query parameter that has already done its job.
 *
 * Deep links that *hand something over* — "file the mistakes from this mock exam", "link the
 * question you are about to ask to this card" — are single-use instructions, not addresses. Left in
 * the bar they fire again on the next refresh or back-navigation, which re-opens a form the student
 * already finished with or re-attributes fresh work to an old handoff.
 *
 * `history.replaceState`, not the router: these paths are next-intl's localized ones
 * (`/yanlis-defteri`, `/topluluk/akis`) and the client router does not resolve them back to their
 * routes — the call goes through and the address bar keeps the spent parameter. Nothing about the
 * page is changing here anyway, only a query string that has been used up.
 */
export function clearSpentQueryParam(name: string): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has(name)) return;
  params.delete(name);
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    query ? `${window.location.pathname}?${query}` : window.location.pathname,
  );
}
