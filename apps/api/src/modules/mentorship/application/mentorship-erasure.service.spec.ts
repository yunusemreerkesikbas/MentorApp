import { describe, expect, it, vi } from "vitest";
import { MentorshipErasureService } from "./mentorship-erasure.service";

const USER = "11111111-1111-4111-8111-111111111111";

function setup(purgedLinkIds: string[]) {
  const links = { purgeForUser: vi.fn(async () => purgedLinkIds) };
  const codes = { purgeForCoach: vi.fn(async () => undefined) };
  const templates = { purgeForCoach: vi.fn(async () => undefined) };
  const plan = { clearMentorshipOrigin: vi.fn(async () => purgedLinkIds.length) };
  const service = new MentorshipErasureService(
    links as never,
    codes as never,
    templates as never,
    plan as never,
  );
  return { service, links, codes, templates, plan };
}

describe("MentorshipErasureService", () => {
  it("drops the links, the coach's invite code and their saved templates", async () => {
    const { service, links, codes, templates } = setup(["link-1"]);
    await service.eraseUserData(USER);
    expect(links.purgeForUser).toHaveBeenCalledWith(USER);
    expect(codes.purgeForCoach).toHaveBeenCalledWith(USER);
    // Explicit, not by cascade: erasure anonymizes the `users` row rather than deleting it, so
    // `mentorship_program_templates.coach_id`'s ON DELETE CASCADE never fires.
    expect(templates.purgeForCoach).toHaveBeenCalledWith(USER);
  });

  /**
   * The reason this service is not just two deletes: `plan_tasks.origin_ref_id` is a soft ref with
   * no FK, so deleting the link alone leaves the erased coach's students holding tasks badged
   * "from your coach" that the API refuses to let them edit — pointing at a row that is gone.
   */
  it("clears the mentorship origin from the tasks those links assigned", async () => {
    const { service, plan } = setup(["link-1", "link-2"]);
    await service.eraseUserData(USER);
    expect(plan.clearMentorshipOrigin).toHaveBeenCalledWith(["link-1", "link-2"]);
  });

  it("does no origin work when the user had no links at all", async () => {
    const { service, plan } = setup([]);
    await service.eraseUserData(USER);
    expect(plan.clearMentorshipOrigin).toHaveBeenCalledWith([]);
  });
});
