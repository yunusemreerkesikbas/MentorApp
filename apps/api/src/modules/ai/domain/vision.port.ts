/**
 * Vision provider seam (§8). Photo → subject CATEGORIZE only (never solve — §4 #2).
 * Swapped by VISION_PROVIDER env (fake = dev/test default).
 */
export const VISION_PORT = Symbol("VISION_PORT");

export interface SubjectHint {
  slug: string;
  name: string;
}

export interface VisionCategorizeInput {
  imageBytes: Buffer;
  mimeType: string;
  allowedSubjects: SubjectHint[];
}

export interface VisionCategorizeResult {
  subjectSlugs: string[];
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface VisionPort {
  categorizeImage(input: VisionCategorizeInput): Promise<VisionCategorizeResult>;
}
