import type {
  ApplyPlanAdaptationResultDto,
  CoachAccessDto,
  CoachActionResultDto,
  CoachChatReplyDto,
  CoachConversationDto,
  CoachConversationMessagesDto,
  CoachMemoryFactDto,
  CoachPlanAdaptationBriefDto,
  CoachPlanAdaptationDto,
  CoachProfileDto,
  Paginated,
} from "@mentor/types";
import type {
  ApplyPlanAdaptationInput,
  CoachActionDecisionInput,
  CoachPlanAdaptationInput,
  CoachProfilePatchInput,
} from "@mentor/validation";
import { http } from "@mentor/api-client";

export async function fetchCoachAccess(): Promise<CoachAccessDto | null> {
  try {
    return (await http<CoachAccessDto>("/v1/coach/access")) as CoachAccessDto;
  } catch {
    return null;
  }
}

export async function listCoachConversations(
  pageSize = 10,
): Promise<CoachConversationDto[]> {
  const res = (await http<Paginated<CoachConversationDto>>(
    `/v1/coach/conversations?page=1&pageSize=${pageSize}`,
  )) as Paginated<CoachConversationDto>;
  return res.items;
}

export async function listCoachMessages(
  conversationId: string,
  pageSize = 40,
): Promise<CoachConversationMessagesDto> {
  return (await http<CoachConversationMessagesDto>(
    `/v1/coach/conversations/${conversationId}/messages?page=1&pageSize=${pageSize}`,
  )) as CoachConversationMessagesDto;
}

export async function sendCoachMessage(input: {
  message: string;
  conversationId?: string;
  contextMockExamId?: string;
  contextArticleSlug?: string;
}): Promise<CoachChatReplyDto> {
  return (await http<CoachChatReplyDto>("/v1/coach/chat", {
    method: "POST",
    body: JSON.stringify({
      message: input.message,
      ...(input.conversationId ? { conversationId: input.conversationId } : {}),
      ...(input.contextMockExamId
        ? { contextMockExamId: input.contextMockExamId }
        : {}),
      ...(input.contextArticleSlug
        ? { contextArticleSlug: input.contextArticleSlug }
        : {}),
    }),
  })) as CoachChatReplyDto;
}

export async function decideCoachAction(
  messageId: string,
  input: CoachActionDecisionInput,
): Promise<CoachActionResultDto> {
  return (await http<CoachActionResultDto>(
    `/v1/coach/messages/${messageId}/action`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )) as CoachActionResultDto;
}

export async function setCoachMessageFeedback(
  messageId: string,
  feedback: 1 | -1 | null,
): Promise<void> {
  await http<void>(`/v1/coach/messages/${messageId}/feedback`, {
    method: "PATCH",
    body: JSON.stringify({ feedback }),
  });
}

export async function fetchPlanAdaptationBrief(): Promise<CoachPlanAdaptationBriefDto | null> {
  try {
    return (await http<CoachPlanAdaptationBriefDto>(
      "/v1/coach/plan-adaptation/brief",
    )) as CoachPlanAdaptationBriefDto;
  } catch {
    return null;
  }
}

export async function requestCoachPlanAdaptation(
  input: CoachPlanAdaptationInput,
): Promise<CoachPlanAdaptationDto> {
  return (await http<CoachPlanAdaptationDto>("/v1/coach/plan-adaptation", {
    method: "POST",
    body: JSON.stringify(input),
  })) as CoachPlanAdaptationDto;
}

export async function applyCoachPlanAdaptation(
  input: ApplyPlanAdaptationInput,
): Promise<ApplyPlanAdaptationResultDto> {
  return (await http<ApplyPlanAdaptationResultDto>("/v1/plan-tasks/adapt", {
    method: "POST",
    body: JSON.stringify(input),
  })) as ApplyPlanAdaptationResultDto;
}

export async function fetchCoachProfile(): Promise<CoachProfileDto | null> {
  try {
    return (await http<CoachProfileDto>("/v1/coach/profile")) as CoachProfileDto;
  } catch {
    return null;
  }
}

export async function updateCoachProfilePreferences(
  input: CoachProfilePatchInput,
): Promise<CoachProfileDto> {
  return (await http<CoachProfileDto>("/v1/coach/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  })) as CoachProfileDto;
}

export async function listCoachMemories(): Promise<CoachMemoryFactDto[]> {
  try {
    return (await http<CoachMemoryFactDto[]>(
      "/v1/coach/memories",
    )) as CoachMemoryFactDto[];
  } catch {
    return [];
  }
}

export async function deleteCoachMemory(id: string): Promise<void> {
  await http<void>(`/v1/coach/memories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
