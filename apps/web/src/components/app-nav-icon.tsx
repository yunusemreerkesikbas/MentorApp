import { CalendarIcon as CalendarActive } from "@solar-icons/react/bold/calendar";
import { Chart2Icon as ChartActive } from "@solar-icons/react/bold/chart-2";
import { ChatRoundDotsIcon as ChatActive } from "@solar-icons/react/bold/chat-round-dots";
import { DocumentTextIcon as ArticleActive } from "@solar-icons/react/bold/document-text";
import { Home2Icon as HomeActive } from "@solar-icons/react/bold/home-2";
import { NotebookIcon as NotebookActive } from "@solar-icons/react/bold/notebook";
import { SettingsIcon as SettingsActive } from "@solar-icons/react/bold/settings";
import { UserCheckRoundedIcon as StudentsActive } from "@solar-icons/react/bold/user-check-rounded";
import { UsersGroupRoundedIcon as CommunityActive } from "@solar-icons/react/bold/users-group-rounded";
import { CalendarIcon as CalendarLinear } from "@solar-icons/react/linear/calendar";
import { Chart2Icon as ChartLinear } from "@solar-icons/react/linear/chart-2";
import { ChatRoundDotsIcon as ChatLinear } from "@solar-icons/react/linear/chat-round-dots";
import { DocumentTextIcon as ArticleLinear } from "@solar-icons/react/linear/document-text";
import { Home2Icon as HomeLinear } from "@solar-icons/react/linear/home-2";
import { NotebookIcon as NotebookLinear } from "@solar-icons/react/linear/notebook";
import { SettingsIcon as SettingsLinear } from "@solar-icons/react/linear/settings";
import { UserCheckRoundedIcon as StudentsLinear } from "@solar-icons/react/linear/user-check-rounded";
import { UsersGroupRoundedIcon as CommunityLinear } from "@solar-icons/react/linear/users-group-rounded";

// Direct style/icon imports keep the rest of Solar's catalogue out of the nav bundle.
const NAV_ICONS = {
  home: { linear: HomeLinear, active: HomeActive },
  plan: { linear: CalendarLinear, active: CalendarActive },
  coach: { linear: ChatLinear, active: ChatActive },
  analysis: { linear: ChartLinear, active: ChartActive },
  knowledge: { linear: ArticleLinear, active: ArticleActive },
  notebook: { linear: NotebookLinear, active: NotebookActive },
  community: { linear: CommunityLinear, active: CommunityActive },
  settings: { linear: SettingsLinear, active: SettingsActive },
  students: { linear: StudentsLinear, active: StudentsActive },
} as const;

export type AppNavIconName = keyof typeof NAV_ICONS;

/** Navigation-only Solar trial, DESIGN.md §7. Solid selection avoids muted duotone fills. */
export function AppNavIcon({
  icon,
  active,
  size = 22,
}: {
  icon: AppNavIconName;
  active: boolean;
  size?: number;
}) {
  const Icon = active ? NAV_ICONS[icon].active : NAV_ICONS[icon].linear;
  return (
    <Icon
      size={size}
      color={active ? "var(--play-selected-ink)" : "currentColor"}
      strokeWidth={active ? undefined : 1.75}
      className="shrink-0"
      aria-hidden
      focusable="false"
    />
  );
}
