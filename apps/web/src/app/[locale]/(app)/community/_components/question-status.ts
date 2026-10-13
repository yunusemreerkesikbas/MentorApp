/**
 * The one status a question shows (list rows, feed cards, Keşfet rows): waiting, N answers, or
 * solved. An accepted answer wins over the count, which may have dropped after a deletion.
 */
export type QuestionStatus =
  | { kind: "waiting" }
  | { kind: "answered"; answers: number }
  | { kind: "solved"; answers: number };

export function questionStatus(question: {
  commentCount: number;
  acceptedPostId: string | null;
}): QuestionStatus {
  if (question.acceptedPostId) return { kind: "solved", answers: question.commentCount };
  return question.commentCount > 0
    ? { kind: "answered", answers: question.commentCount }
    : { kind: "waiting" };
}
