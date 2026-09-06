/**
 * Vision provider seam (§8). Photo → subject/topic CATEGORIZE only (never solve — §4 #2).
 */
export const VISION_PORT = Symbol("VISION_PORT");
export const RAW_VISION_PORT = Symbol("RAW_VISION_PORT");

export interface SubjectHint {
  slug: string;
  name: string;
}

export interface TopicHint {
  subjectSlug: string;
  slug: string;
  name: string;
}

export interface VisionCategorizeInput {
  imageBytes: Buffer;
  mimeType: string;
  allowedSubjects: SubjectHint[];
  allowedTopics: TopicHint[];
}

export interface VisionCategorizeResult {
  subjectSlug: string | null;
  topicSlug: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  /** Internal aggregate-budget hold; settled with the usage row. */
  budgetReservationId?: string;
}

export interface VisionPort {
  categorizeImage(
    input: VisionCategorizeInput,
  ): Promise<VisionCategorizeResult>;
}
