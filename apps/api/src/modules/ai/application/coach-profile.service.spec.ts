import { CoachProfileService } from "./coach-profile.service";

const profile = (consent: "PENDING" | "GRANTED" | "DECLINED") => ({
  calibrationStatus: "COMPLETED" as const,
  memoryConsent: consent,
  supportPreference: null,
  directnessPreference: null,
  updatedAt: new Date().toISOString(),
});

function makeService(consent: "PENDING" | "GRANTED" | "DECLINED") {
  const profiles = { get: vi.fn(async () => profile(consent)), patch: vi.fn() };
  const facts = {
    listActive: vi.fn(async () => [{ id: "fact-1" }]),
    upsertChatFact: vi.fn(async () => undefined),
    getById: vi.fn(),
    updateByUser: vi.fn(),
    listPaged: vi.fn(),
    deleteByUser: vi.fn(),
    clear: vi.fn(),
    deleteExpired: vi.fn(),
  };
  const config = { get: vi.fn(async () => 30) };
  const users = { getMe: vi.fn(async () => ({ examType: "YKS" })) };
  const content = {
    getExamCalendarByFamily: vi.fn(async () => ({ exam: { id: "exam-1" } })),
    listExamSubjectsByExamId: vi.fn(async () => [
      { slug: "matematik", name: "Matematik" },
    ]),
  };
  return {
    service: new CoachProfileService(
      profiles as never,
      facts as never,
      config as never,
      users as never,
      content as never,
    ),
    facts,
  };
}

describe("CoachProfileService", () => {
  it("does not inject or learn memories without explicit consent", async () => {
    const { service, facts } = makeService("PENDING");
    await expect(service.getPromptMemories("user-1")).resolves.toEqual([]);
    await service.learnFromChat(
      "user-1",
      "message-1",
      "Akşamları daha iyi çalışıyorum",
      {
        key: "STUDY_TIME",
        value: "EVENING",
        sourceQuote: "Akşamları daha iyi çalışıyorum",
      },
    );
    expect(facts.listActive).not.toHaveBeenCalled();
    expect(facts.upsertChatFact).not.toHaveBeenCalled();
  });

  it("stores only a validated structured fact after consent", async () => {
    const { service, facts } = makeService("GRANTED");
    await service.learnFromChat("user-1", "message-1", "Önceliğim matematik", {
      key: "PRIORITY_SUBJECT",
      value: "matematik",
      sourceQuote: "Önceliğim matematik",
    });
    expect(facts.upsertChatFact).toHaveBeenCalledWith(
      "user-1",
      "message-1",
      expect.objectContaining({ key: "PRIORITY_SUBJECT", value: "Matematik" }),
    );
    expect(JSON.stringify(facts.upsertChatFact.mock.calls)).not.toContain(
      "Önceliğim matematik",
    );
  });

  it("keeps an edited transient fact time-limited", async () => {
    const { service, facts } = makeService("GRANTED");
    facts.getById.mockResolvedValue({
      id: "fact-1",
      key: "CHALLENGE_CATEGORY",
      value: "FOCUS",
      source: "CHAT",
      expiresAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    facts.updateByUser.mockImplementation(
      async (
        _userId: string,
        _id: string,
        value: string,
        expiresAt: Date | null,
      ) => ({
        id: "fact-1",
        key: "CHALLENGE_CATEGORY",
        value,
        source: "USER_EDIT",
        expiresAt: expiresAt?.toISOString() ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    const before = Date.now();
    await service.updateMemory("user-1", "fact-1", { value: "PLANNING" });

    expect(facts.updateByUser).toHaveBeenCalledWith(
      "user-1",
      "fact-1",
      "PLANNING",
      expect.any(Date),
    );
    const expiresAt = facts.updateByUser.mock.calls[0]?.[3] as Date;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 30 * 24 * 60 * 60 * 1000,
    );
  });
});
