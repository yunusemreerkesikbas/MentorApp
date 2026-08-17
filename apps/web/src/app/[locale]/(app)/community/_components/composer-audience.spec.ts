import { describe, expect, it } from "vitest";
import type { ZoneView } from "@mentor/types";
import { eligibleComposerZones } from "./composer-audience";

const candidate = (patch: Partial<ZoneView>): ZoneView => ({
  id: crypto.randomUUID(),
  type: "CHAT",
  title: "Topluluk",
  slug: "topluluk",
  description: null,
  visibility: "PUBLIC",
  joinPolicy: "OPEN",
  examType: null,
  emoji: null,
  isArchived: false,
  memberCount: 1,
  threadCount: 0,
  myStatus: "ACTIVE",
  myRole: "MEMBER",
  canModerate: false,
  createdAt: "2026-08-15T00:00:00.000Z",
  ...patch,
});

describe("composer audience eligibility", () => {
  it("shows only active CHAT and moderated ANNOUNCEMENT zones for a post", () => {
    const chat = candidate({ title: "Chat" });
    const announcement = candidate({ type: "ANNOUNCEMENT", title: "Duyuru", canModerate: true });
    const readOnlyAnnouncement = candidate({ type: "ANNOUNCEMENT", title: "Salt okunur" });
    const inactive = candidate({ title: "Ayrıldığım", myStatus: null });
    const qa = candidate({ type: "QA", title: "Soru" });

    expect(eligibleComposerZones([chat, announcement, readOnlyAnnouncement, inactive, qa], "share"))
      .toEqual([chat, announcement]);
  });

  it("shows only active QA zones in question mode", () => {
    const qa = candidate({ type: "QA", title: "Soru" });
    const chat = candidate({ title: "Chat" });
    expect(eligibleComposerZones([qa, chat], "question")).toEqual([qa]);
  });
});
