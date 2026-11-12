import { CalendarIcon as CalendarBold } from "@solar-icons/react-native/bold/calendar";
import { Chart2Icon as ChartBold } from "@solar-icons/react-native/bold/chart-2";
import { ChatRoundDotsIcon as ChatBold } from "@solar-icons/react-native/bold/chat-round-dots";
import { Home2Icon as HomeBold } from "@solar-icons/react-native/bold/home-2";
import { NotebookIcon as NotebookBold } from "@solar-icons/react-native/bold/notebook";
import { SettingsIcon as SettingsBold } from "@solar-icons/react-native/bold/settings";
import { UserCheckRoundedIcon as StudentsBold } from "@solar-icons/react-native/bold/user-check-rounded";
import { UserIdIcon as CoachProfileBold } from "@solar-icons/react-native/bold/user-id";
import { UsersGroupRoundedIcon as CommunityBold } from "@solar-icons/react-native/bold/users-group-rounded";
import { CalendarIcon as CalendarLinear } from "@solar-icons/react-native/linear/calendar";
import { Chart2Icon as ChartLinear } from "@solar-icons/react-native/linear/chart-2";
import { ChatRoundDotsIcon as ChatLinear } from "@solar-icons/react-native/linear/chat-round-dots";
import { Home2Icon as HomeLinear } from "@solar-icons/react-native/linear/home-2";
import { NotebookIcon as NotebookLinear } from "@solar-icons/react-native/linear/notebook";
import { SettingsIcon as SettingsLinear } from "@solar-icons/react-native/linear/settings";
import { UserCheckRoundedIcon as StudentsLinear } from "@solar-icons/react-native/linear/user-check-rounded";
import { UserIdIcon as CoachProfileLinear } from "@solar-icons/react-native/linear/user-id";
import { UsersGroupRoundedIcon as CommunityLinear } from "@solar-icons/react-native/linear/users-group-rounded";
import type { AppNavIconId } from "@mentor/core";

// The same Solar pairs as the web's `AppNavIcon` (DESIGN.md §7): Linear at rest, Bold when active.
const NAV_ICONS = {
  home: { linear: HomeLinear, active: HomeBold },
  plan: { linear: CalendarLinear, active: CalendarBold },
  coach: { linear: ChatLinear, active: ChatBold },
  analysis: { linear: ChartLinear, active: ChartBold },
  coachProfile: { linear: CoachProfileLinear, active: CoachProfileBold },
  notebook: { linear: NotebookLinear, active: NotebookBold },
  community: { linear: CommunityLinear, active: CommunityBold },
  settings: { linear: SettingsLinear, active: SettingsBold },
  students: { linear: StudentsLinear, active: StudentsBold },
} as const satisfies Record<AppNavIconId, unknown>;

export function NavIcon({
  icon,
  active,
  color,
  size = 22,
}: {
  icon: AppNavIconId;
  active: boolean;
  color: string;
  size?: number;
}) {
  const Icon = active ? NAV_ICONS[icon].active : NAV_ICONS[icon].linear;
  return <Icon size={size} color={color} strokeWidth={1.75} />;
}
