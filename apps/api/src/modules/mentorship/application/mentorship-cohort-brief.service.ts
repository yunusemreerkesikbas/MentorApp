import { Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import type {
  MentorshipCohortBriefDto,
  MentorshipCohortBriefItemDto,
  MentorshipRiskFlagId,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import type { MentorshipCohortBriefItem } from "../../../database/schema";
import { CohortBriefService as AiCohortBriefWriter } from "../../ai/application/cohort-brief.service";
import {
  buildCohortBriefEvidence,
  cohortBriefFingerprint,
  selectCohortBriefRows,
} from "../../ai/domain/cohort-brief-prompt";
import type { PromptLocale } from "../../ai/domain/prompt-locale";
import { todayIso } from "../../coaching/domain/date.util";
import { UsersService } from "../../identity/application/users.service";
import { isNewForStudent, toRiskPairs } from "../domain/risk-pairs";
import { MentorshipCohortBriefRepository } from "../infrastructure/mentorship-cohort-brief.repository";
import { MentorshipLinkRepository } from "../infrastructure/mentorship-link.repository";
import { MentorshipLinkService } from "./mentorship-link.service";
import { MentorshipRosterService } from "./mentorship-roster.service";

/**
 * The coach's cohort brief (W8 side).
 *
 * Same split as the per-student brief: this service owns **authorization and the cache**, the AI
 * module owns **the text**. There is no `requireActiveLink` here and there must not be — that gate
 * answers "may this coach see THIS student", and this endpoint asks about the coach's own roster,
 * which `listRoster(coachId, …)` is already scoped to. The gate that does apply is `assertEnabled`
 * plus `@Roles(COACH)`.
 *
 * Reading is free and writing is not, so the two verbs are genuinely different operations rather
 * than one with a flag: `read` touches no LLM and no quota, `generate` is the only path that can
 * spend either.
 */
@Injectable()
export class MentorshipCohortBriefService {
  constructor(
    private readonly links: MentorshipLinkService,
    private readonly linkRepo: MentorshipLinkRepository,
    private readonly roster: MentorshipRosterService,
    private readonly repo: MentorshipCohortBriefRepository,
    private readonly users: UsersService,
    private readonly config: ConfigRegistryService,
    private readonly writer: AiCohortBriefWriter,
  ) {}

  /**
   * The stored brief, or null when there is none.
   *
   * Deliberately does NOT recompute the roster: it resolves the two things a stored brief cannot
   * hold honestly — who is still followed, and what those people are called — with two light
   * queries instead of the six the cohort evidence costs. The screen loads this beside the roster
   * itself, and paying for that snapshot twice on one page view would be the whole saving gone.
   */
  async read(coachId: string): Promise<MentorshipCohortBriefDto | null> {
    await this.links.assertEnabled();
    const row = await this.repo.find(coachId);
    if (!row) return null;
    const items = await this.hydrate(coachId, row.brief.items);
    return {
      overall: row.brief.overall,
      items,
      model: "cache",
      generatedAt: row.generatedAt.toISOString(),
    };
  }

  /**
   * Write a new brief, or hand back the stored one when the cohort has not moved.
   *
   * Order matters: the flag, then the roster (cheap enough), then the fingerprint compare, and only
   * then anything that costs money. A coach opening the panel twice before breakfast pays once.
   */
  async generate(coach: {
    id: string;
    roles: string[];
  }): Promise<MentorshipCohortBriefDto> {
    await this.links.assertEnabled();
    const now = new Date();
    const maxActiveStudents = await this.config.get(
      "mentorship.coach.max_active_students",
    );
    // One page IS the cohort: the page size is the roster ceiling, so nothing is ranked out of view.
    const page = await this.roster.listRoster(
      coach.id,
      "ACTIVE",
      1,
      maxActiveStudents,
      now,
    );
    const locale = (I18nContext.current()?.lang ?? "tr") as PromptLocale;
    const evidence = buildCohortBriefEvidence(page.items, todayIso(now));
    const fingerprint = cohortBriefFingerprint(evidence, locale);

    const stored = await this.repo.find(coach.id);
    if (stored && stored.fingerprint === fingerprint) {
      // Nothing about the cohort changed since the last brief. Writing the same summary again would
      // cost the coach a quota unit and the platform an LLM call for a byte-identical answer.
      return {
        overall: stored.brief.overall,
        items: await this.hydrate(coach.id, stored.brief.items),
        model: "cache",
        generatedAt: stored.generatedAt.toISOString(),
      };
    }

    // The same selection the evidence was built from, so `S1` maps back to the student it described.
    const selected = selectCohortBriefRows(page.items);
    // Nobody needs the coach today. That is a real answer, not a reason to pay a model to invent
    // one — and it is still worth storing, so the next call can recognise an unchanged calm cohort.
    if (selected.length === 0) {
      const empty = { overall: "", items: [] as MentorshipCohortBriefItem[] };
      await this.repo.upsert(coach.id, empty, fingerprint, [], now);
      return { overall: "", items: [], model: "empty", generatedAt: now.toISOString() };
    }

    const baseline = new Set(stored?.pairs ?? []);
    const result = await this.writer.generate(evidence, coach, locale);

    const byRef = new Map(
      evidence.students.map((student, index) => [student.ref, selected[index]!]),
    );
    const items: MentorshipCohortBriefItem[] = [];
    for (const item of result.items) {
      const row = byRef.get(item.ref);
      if (!row) continue;
      items.push({
        studentId: row.studentId,
        riskFlags: [...row.riskFlags],
        why: item.why,
        action: item.action,
        isNew: isNewForStudent(
          { studentId: row.studentId, flags: row.riskFlags },
          baseline,
        ),
      });
    }

    // What we record as reported is what the coach can actually read: the lines that made it into
    // the brief. A student cut off by the ten-row ceiling, or skipped by the model, was never shown
    // — greeting them as old news tomorrow would silence the one morning they finally appear.
    const pairs = toRiskPairs(
      items.map((item) => ({ studentId: item.studentId, flags: item.riskFlags })),
    );
    await this.repo.upsert(
      coach.id,
      { overall: result.overall, items },
      fingerprint,
      pairs,
      now,
    );
    return {
      overall: result.overall,
      items: await this.hydrate(coach.id, items),
      model: result.model,
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Turn stored lines into rendered ones: drop anyone this coach no longer follows, and resolve
   * names live.
   *
   * Both halves are non-negotiable. Ending a link revokes consent, so a brief written yesterday
   * must not keep describing someone who left this morning. And the name is never stored, so a
   * student who exercises erasure is anonymized here too, rather than surviving in a cache written
   * for a different person.
   */
  private async hydrate(
    coachId: string,
    items: readonly MentorshipCohortBriefItem[],
  ): Promise<MentorshipCohortBriefItemDto[]> {
    if (items.length === 0) return [];
    const maxActiveStudents = await this.config.get(
      "mentorship.coach.max_active_students",
    );
    const { rows } = await this.linkRepo.listByCoach(
      coachId,
      "ACTIVE",
      1,
      maxActiveStudents,
    );
    const active = new Set(rows.map((row) => row.studentId));
    const live = items.filter((item) => active.has(item.studentId));
    if (live.length === 0) return [];
    const people = await this.users.listDisplayIdentities(
      live.map((item) => item.studentId),
    );
    return live.map((item) => ({
      studentId: item.studentId,
      studentDisplayName: people.get(item.studentId)?.displayName ?? "",
      riskFlags: item.riskFlags as MentorshipRiskFlagId[],
      why: item.why,
      action: item.action,
      isNew: item.isNew,
    }));
  }
}
