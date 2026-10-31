import { Module } from "@nestjs/common";
import { IdentityModule } from "../../modules/identity/identity.module";
import { StorageModule } from "./storage.module";
import { MediaController } from "./media.controller";
import { MediaReadService } from "./media-read.service";

/** HTTP authorization consumes Identity's public session interface outside StorageModule. */
@Module({
  imports: [IdentityModule, StorageModule],
  controllers: [MediaController],
  providers: [MediaReadService],
})
export class MediaGatewayModule {}
