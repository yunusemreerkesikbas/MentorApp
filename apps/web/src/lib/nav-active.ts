/**
 * Nav active state — exact match or nested path; avoids `/panel` matching `/plan`.
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
