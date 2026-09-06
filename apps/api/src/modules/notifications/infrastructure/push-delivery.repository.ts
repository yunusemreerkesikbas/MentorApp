import { Injectable } from "@nestjs/common";
import { and, eq, lte } from "drizzle-orm";
import type { DatabaseTx } from "../../../database/drizzle";
import { pushDeliveryClaims } from "../../../database/schema-push-delivery";

export interface PushDeliveryIdentity {
  userId: string;
  template: string;
  dedupeKey: string;
  endpointHash: string;
}

@Injectable()
export class PushDeliveryRepository {
  async claim(
    tx: DatabaseTx,
    identity: PushDeliveryIdentity,
    claimToken: string,
    leaseUntil: Date,
  ): Promise<"claimed" | "delivered" | "busy"> {
    const rows = await tx.insert(pushDeliveryClaims).values({ ...identity, claimToken, leaseUntil })
      .onConflictDoUpdate({
        target: [pushDeliveryClaims.userId, pushDeliveryClaims.template,
          pushDeliveryClaims.dedupeKey, pushDeliveryClaims.endpointHash],
        set: { claimToken, leaseUntil },
        setWhere: and(eq(pushDeliveryClaims.status, "PENDING"), lte(pushDeliveryClaims.leaseUntil, new Date())),
      }).returning({ id: pushDeliveryClaims.id });
    if (rows.length > 0) return "claimed";
    const [existing] = await tx.select({ status: pushDeliveryClaims.status }).from(pushDeliveryClaims)
      .where(this.identityFilter(identity)).limit(1);
    return existing?.status === "DELIVERED" ? "delivered" : "busy";
  }

  async complete(tx: DatabaseTx, identity: PushDeliveryIdentity, claimToken: string): Promise<void> {
    await tx.update(pushDeliveryClaims).set({ status: "DELIVERED", deliveredAt: new Date() })
      .where(and(this.identityFilter(identity), eq(pushDeliveryClaims.claimToken, claimToken)));
  }

  async release(tx: DatabaseTx, identity: PushDeliveryIdentity, claimToken: string): Promise<void> {
    await tx.update(pushDeliveryClaims).set({ leaseUntil: new Date(0) })
      .where(and(this.identityFilter(identity), eq(pushDeliveryClaims.claimToken, claimToken),
        eq(pushDeliveryClaims.status, "PENDING")));
  }

  private identityFilter(identity: PushDeliveryIdentity) {
    return and(eq(pushDeliveryClaims.userId, identity.userId), eq(pushDeliveryClaims.template, identity.template),
      eq(pushDeliveryClaims.dedupeKey, identity.dedupeKey), eq(pushDeliveryClaims.endpointHash, identity.endpointHash));
  }
}
