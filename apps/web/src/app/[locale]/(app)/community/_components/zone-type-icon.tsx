import { CircleHelp, Hash, Megaphone, type LucideProps } from "lucide-react";
import type { ZoneView } from "@mentor/types";

export function ZoneTypeIcon({ type, ...props }: LucideProps & { type: ZoneView["type"] }) {
  const Icon = type === "CHAT" ? Hash : type === "ANNOUNCEMENT" ? Megaphone : CircleHelp;
  return <Icon {...props} />;
}
