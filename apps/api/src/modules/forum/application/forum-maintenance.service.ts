import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { ForumThreadService } from "./forum-thread.service";

/** Sweep cadence. Orphan grace is 24h and each run is batch-bounded (500), so 6h is ample headroom. */
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Runs the orphan-attachment sweep on its own timer, so the flip does NOT depend on someone
 * remembering to register a Render Cron entry (there is no IaC in this repo). Mirrors
 * JobRunnerService: an in-process interval on every API instance. Concurrent sweeps across
 * instances are harmless — the sweep is idempotent (missing storage objects are a no-op and the
 * pending rows are deleted by key). The internal HTTP endpoint stays as the manual/ops override.
 */
@Injectable()
export class ForumMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ForumMaintenanceService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private sweeping = false;

  constructor(
    private readonly threads: ForumThreadService,
    private readonly config: ConfigRegistryService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    // Never hold the process open just for maintenance.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One guarded sweep pass. Errors are logged, never thrown — a failure must not kill the timer. */
  private async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      if (!(await this.config.get("forum.enabled"))) return;
      const { deleted } = await this.threads.cleanupOrphanAttachments();
      if (deleted > 0) {
        this.logger.log(`Forum attachment sweep removed ${deleted} orphaned upload(s).`);
      }
    } catch (err) {
      this.logger.error("Forum attachment sweep failed", err);
    } finally {
      this.sweeping = false;
    }
  }
}
