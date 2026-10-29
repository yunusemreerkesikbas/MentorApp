/** Nav items that live under another item's path; on them, only the nested item is active. */
const NESTED_ITEMS = ["/students/profile"];

const within = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Nav active state — exact match or nested path; avoids `/dashboard` matching `/plan`. A nested
 * item (the coach profile under Öğrencilerim) takes its pages from the parent.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (!within(pathname, href)) return false;
  return !NESTED_ITEMS.some((nested) => nested !== href && nested.startsWith(`${href}/`) && within(pathname, nested));
}
