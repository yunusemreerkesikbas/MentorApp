import { setRequestLocale } from "next-intl/server";
import { CommentShell } from "./_components/comment-shell";

export default async function CommentPage({
  params,
}: {
  params: Promise<{ locale: string; postId: string }>;
}) {
  const { locale, postId } = await params;
  setRequestLocale(locale);
  return <CommentShell postId={postId} />;
}
