import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { MistakeNotebookService } from "./mistake-notebook.service";
import { VisionService } from "./vision.service";

/** Orphan grace is 24h and each pass is batch-bounded, so 6h leaves plenty of headroom. */
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Timer for coaching's orphan sweeps — vision-board collage photos and mistake-notebook photos.
 * Mirrors `ForumMaintenanceService` rather than reusing it: coaching owns both tables, and a forum
 * service reaching into them would cross a bounded-context line (workstreams §2). Sweeping is
 * idempotent, so concurrent passes across API instances are harmless.
 *
 * One timer for both prefixes rather than one per feature: they share the grace window and the
 * batch bound, and a second interval would only buy a second thing to forget to start.
 */
@Injectable()
export class VisionBoardMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VisionBoardMaintenanceService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private sweeping = false;

  constructor(
    private readonly vision: VisionService,
    private readonly notebook: MistakeNotebookService,
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

  /** One guarded pass. Errors are logged, never thrown — a failure must not kill the timer. */
  private async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const { deleted } = await this.vision.cleanupOrphanImages();
      if (deleted > 0) {
        this.logger.log(`Vision board sweep removed ${deleted} orphaned upload(s).`);
      }
      // Separate try: a board sweep that throws must not skip the notebook's, or one broken
      // prefix would silently leave the other's personal data at a public URL indefinitely.
    } catch (err) {
      this.logger.error("Vision board orphan sweep failed", err);
    }
    try {
      const { deleted } = await this.notebook.cleanupOrphanImages();
      if (deleted > 0) {
        this.logger.log(`Notebook sweep removed ${deleted} orphaned upload(s).`);
      }
    } catch (err) {
      this.logger.error("Notebook orphan sweep failed", err);
    } finally {
      this.sweeping = false;
    }
  }
}
