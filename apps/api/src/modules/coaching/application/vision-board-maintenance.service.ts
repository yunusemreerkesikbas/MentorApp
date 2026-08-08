import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { VisionService } from "./vision.service";

/** Orphan grace is 24h and each pass is batch-bounded, so 6h leaves plenty of headroom. */
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Timer for the vision-board orphan sweep. Mirrors `ForumMaintenanceService` rather than reusing
 * it: coaching owns `vision_boards`, and a forum service reaching into it would cross a
 * bounded-context line (workstreams §2). Sweeping is idempotent, so concurrent passes across API
 * instances are harmless.
 */
@Injectable()
export class VisionBoardMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VisionBoardMaintenanceService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private sweeping = false;

  constructor(private readonly vision: VisionService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    // Never hold the process open just for maintenance.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One guarded pass. Errors are logged, never thrown — a failure must not kill the timer. */
  private async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const { deleted } = await this.vision.cleanupOrphanImages();
      if (deleted > 0) {
        this.logger.log(`Vision board sweep removed ${deleted} orphaned upload(s).`);
      }
    } catch (err) {
      this.logger.error("Vision board orphan sweep failed", err);
    } finally {
      this.sweeping = false;
    }
  }
}
