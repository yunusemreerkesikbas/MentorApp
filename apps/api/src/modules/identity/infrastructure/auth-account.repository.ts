import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { userAuthAccounts } from "../../../database/schema";
import type { AuthProvider } from "../domain/identity.constants";

export type AuthAccountRow = typeof userAuthAccounts.$inferSelect;

@Injectable()
export class AuthAccountRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findByProviderSubject(
    provider: AuthProvider,
    providerSubject: string,
  ): Promise<AuthAccountRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(userAuthAccounts)
        .where(
          and(
            eq(userAuthAccounts.provider, provider),
            eq(userAuthAccounts.providerSubject, providerSubject),
          ),
        )
        .limit(1);
      return rows[0];
    });
  }

  async findByUserProvider(
    userId: string,
    provider: AuthProvider,
  ): Promise<AuthAccountRow | undefined> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(userAuthAccounts)
        .where(and(eq(userAuthAccounts.userId, userId), eq(userAuthAccounts.provider, provider)))
        .limit(1);
      return rows[0];
    });
  }

  async create(input: {
    userId: string;
    provider: AuthProvider;
    providerSubject: string;
    providerEmail: string;
  }): Promise<AuthAccountRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx.insert(userAuthAccounts).values(input).returning();
      return rows[0]!;
    });
  }
}
