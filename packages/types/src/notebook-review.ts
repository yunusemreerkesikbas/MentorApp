export interface NotebookReviewFocus {
  examId: string;
  subjectRef: string | null;
  topicRef: string | null;
  subjectName: string | null;
  topicName: string | null;
}
export interface NotebookReviewSummary {
  workedCount: number;
  revisitCount: number;
  completedCount: number;
  dueCount: number;
  since: string;
  days: 7 | 30;
  focuses: NotebookReviewFocus[];
}
export interface NotebookReviewHistoryItem extends NotebookReviewFocus {
  id: string;
  entryId: string;
  solved: boolean;
  early: boolean;
  reviewedAt: string;
  nextReviewAt: string | null;
}
