const INTERACTIVE_SELECTOR =
  "a,button,input,textarea,select,[role='menuitem']";

type ClosestTarget = {
  closest: (selector: string) => unknown;
};

export function isFeedInteractiveTarget(target: unknown): boolean {
  if (
    typeof target !== "object" ||
    target === null ||
    !("closest" in target) ||
    typeof (target as ClosestTarget).closest !== "function"
  ) {
    return false;
  }

  return Boolean((target as ClosestTarget).closest(INTERACTIVE_SELECTOR));
}
