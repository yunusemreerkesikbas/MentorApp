import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Paginated } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type { Env } from "../../../config/env.validation";
import { EmailTemplate, JobName } from "../../../shared/notifications/constants";
import { JOB_QUEUE_PORT, type JobQueuePort } from "../../../shared/ports/job-queue.port";
import { FeatureFlag } from "../../../common/config/config.catalog";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import {
  SignupInvitationRepository,
  type InvitationRole,
  type InvitationStatus,
  type SignupInvitationRow,
} from "../infrastructure/signup-invitation.repository";
import { UsersRepository } from "../infrastructure/users.repository";
import { TurnstileService } from "./turnstile.service";

export interface JoinWaitlistInput {
  email: string;
  role: InvitationRole;
  locale: "tr" | "en";
  turnstileToken?: string;
}

export interface AdminWaitlistEntry {
  id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  locale: "tr" | "en";
  createdAt: string;
  invitedAt: string | null;
}

export interface ListWaitlistQuery {
  status?: InvitationStatus;
  role?: InvitationRole;
  q?: string;
  page: number;
  pageSize: number;
}

function toEntry(row: SignupInvitationRow): AdminWaitlistEntry {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    locale: row.locale as "tr" | "en",
    createdAt: row.createdAt.toISOString(),
    invitedAt: row.invitedAt ? row.invitedAt.toISOString() : null,
  };
}

const notFound = () => new DomainError(ErrorCode.WAITLIST_ENTRY_NOT_FOUND, HttpStatus.NOT_FOUND);

/** Public waitlist. Never reveals whether an address is new, duplicate, registered or the mode is open. */
@Injectable()
export class WaitlistService {
  constructor(
    private readonly invitations: SignupInvitationRepository,
    private readonly users: UsersRepository,
    private readonly turnstile: TurnstileService,
    private readonly registry: ConfigRegistryService,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async join(input: JoinWaitlistInput): Promise<void> {
    await this.turnstile.assertValid(input.turnstileToken, "waitlist");
    const email = input.email.trim().toLowerCase();
    const [enabled, pilot] = await Promise.all([
      this.registry.get(FeatureFlag.SIGNUP_ENABLED),
      this.registry.get(FeatureFlag.SIGNUP_PILOT_ENABLED),
    ]);
    if (enabled === true && pilot === false) return; // open mode: nothing to wait for
    if (await this.users.findByEmailService(email)) return;
    await this.invitations.insertWaiting({ email, role: input.role, locale: input.locale });
  }

  async list(q: ListWaitlistQuery): Promise<Paginated<AdminWaitlistEntry>> {
    const page = await this.invitations.list({
      status: q.status,
      role: q.role,
      search: q.q,
      page: q.page,
      pageSize: q.pageSize,
    });
    return { ...page, items: page.items.map(toEntry) };
  }

  /** Invites a waiting row. An already-invited row is a re-invite and never counts against the cap. */
  async invite(id: string, actorId: string): Promise<AdminWaitlistEntry> {
    const existing = await this.invitations.findById(id);
    if (!existing) throw notFound();
    if (existing.status !== "invited") await this.assertCapacity();
    const row = await this.invitations.markInvited(id, actorId);
    if (!row) throw notFound();
    await this.sendInvitation(row);
    return toEntry(row);
  }

  async inviteEmail(
    input: { email: string; role: InvitationRole; locale: "tr" | "en" },
    actorId: string,
  ): Promise<AdminWaitlistEntry> {
    const email = input.email.trim().toLowerCase();
    // An existing account can only answer the invite with AUTH_EMAIL_IN_USE, and the row would hold
    // a cap slot for six months: refuse before writing or sending anything.
    if (await this.users.findByEmailService(email)) {
      throw new DomainError(ErrorCode.AUTH_EMAIL_IN_USE, HttpStatus.CONFLICT);
    }
    if (!(await this.invitations.findInvited(email))) await this.assertCapacity();
    const row = await this.invitations.upsertInvited({ email, role: input.role, locale: input.locale, invitedBy: actorId });
    await this.sendInvitation(row);
    return toEntry(row);
  }

  /** Resend is never capacity-gated: the person already holds an invitation. */
  async resend(id: string): Promise<void> {
    const row = await this.invitations.findById(id);
    if (!row || row.status !== "invited") throw notFound();
    await this.sendInvitation(row);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.invitations.deleteById(id))) throw notFound();
  }

  /** Only NEW invites are blocked at the cap; lowering it never locks out people already invited. */
  private async assertCapacity(): Promise<void> {
    const [max, invited] = await Promise.all([
      this.registry.get("signup.pilot.max_invited_emails"),
      this.invitations.countInvited(),
    ]);
    if (invited >= Number(max)) throw new DomainError(ErrorCode.WAITLIST_INVITE_LIMIT, HttpStatus.CONFLICT);
  }

  private async sendInvitation(row: SignupInvitationRow): Promise<void> {
    const base = this.config.get("APP_URL", { infer: true }).replace(/\/+$/, "");
    const path = row.locale === "en" ? "/en/signup?davet=1" : "/kayit?davet=1";
    const link = `${base}${path}${row.role === "coach" ? "&rol=koc" : ""}`;
    await this.queue.enqueue(JobName.SEND_EMAIL, {
      to: row.email,
      template: EmailTemplate.SIGNUP_INVITATION,
      // The row's language, not the admin's request: the adapter falls back to TR without it.
      variables: { link, lang: row.locale === "en" ? "en" : "tr" },
    });
  }

  purgeExpired(): Promise<void> {
    return this.invitations.purgeExpired();
  }
}
