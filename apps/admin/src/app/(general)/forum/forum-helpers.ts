import Swal from "sweetalert2";
import type { ForumCoachIntent } from "@mentor/types";

export const COACH_INTENT_LABELS: Record<ForumCoachIntent, string> = {
    PLAN: "Planıma uyarla",
    NEXT_STEP: "Bir adım çıkar",
    STUDY_METHOD: "Yöntem bul",
    STRATEGY: "Strateji netleştir",
};

export async function showForumApiError(error: unknown, fallback: string): Promise<void> {
    const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        fallback;
    await Swal.fire({ icon: "error", title: "Hata", text: message });
}
