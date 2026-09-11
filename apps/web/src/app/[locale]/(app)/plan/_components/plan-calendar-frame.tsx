import type { ReactNode } from "react";
import { Card } from "@mentor/ui";

/**
 * Shared Takvim chrome: desktop left rail + main calendar card.
 *
 * The rail is hidden below `lg`; the main card is the only surface on mobile.
 * The `min-h-0` flex/grid chain is load-bearing: without it the hour grid sizes
 * to content and the page scrolls instead of the grid.
 */
export function PlanCalendarFrame({
  rail,
  children,
}: {
  rail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-6">
      <div className="hidden lg:flex lg:min-h-0 lg:flex-col lg:gap-4">{rail}</div>
      <Card className="flex min-w-0 flex-col gap-4 !p-3 lg:!p-6 lg:min-h-0 lg:flex-1">
        {children}
      </Card>
    </div>
  );
}
