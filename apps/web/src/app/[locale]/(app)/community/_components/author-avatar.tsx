import { UserAvatar } from "@/components/user-avatar";

export function AuthorAvatar({
  name,
  size = 36,
  src,
}: {
  name: string;
  size?: number;
  src?: string | null;
}) {
  return <UserAvatar name={name} size={size} src={src} />;
}
