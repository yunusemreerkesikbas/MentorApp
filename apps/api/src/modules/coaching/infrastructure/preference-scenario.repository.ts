import { Injectable } from "@nestjs/common";
import { and, asc, eq } from "drizzle-orm";
import type { PreferenceProgramSnapshotDto, PreferenceRankProfileDto } from "@mentor/types";
import type { DatabaseTx } from "../../../database/drizzle";
import {
  preferenceScenarioItems,
  preferenceScenarios,
} from "../../../database/schema";

export type PreferenceScenarioRow = typeof preferenceScenarios.$inferSelect;
export type PreferenceScenarioItemRow = typeof preferenceScenarioItems.$inferSelect;

export interface PreferenceScenarioAggregate {
  scenario: PreferenceScenarioRow;
  items: PreferenceScenarioItemRow[];
}

export interface SavePreferenceScenarioData {
  organizationId: string | null;
  datasetVersion: string;
  ranks: PreferenceRankProfileDto;
  snapshots: PreferenceProgramSnapshotDto[];
}

@Injectable()
export class PreferenceScenarioRepository {
  async findByUser(
    tx: DatabaseTx,
    userId: string,
  ): Promise<PreferenceScenarioAggregate | undefined> {
    const scenarios = await tx
      .select()
      .from(preferenceScenarios)
      .where(eq(preferenceScenarios.userId, userId))
      .limit(1);
    const scenario = scenarios[0];
    if (!scenario) return undefined;
    const items = await tx
      .select()
      .from(preferenceScenarioItems)
      .where(
        and(
          eq(preferenceScenarioItems.scenarioId, scenario.id),
          eq(preferenceScenarioItems.userId, userId),
        ),
      )
      .orderBy(asc(preferenceScenarioItems.position));
    return { scenario, items };
  }

  async create(
    tx: DatabaseTx,
    userId: string,
    data: SavePreferenceScenarioData,
  ): Promise<PreferenceScenarioAggregate> {
    const rows = await tx
      .insert(preferenceScenarios)
      .values({
        userId,
        organizationId: data.organizationId,
        examType: "YKS",
        datasetVersion: data.datasetVersion,
        rankSay: data.ranks.SAY,
        rankEa: data.ranks.EA,
        rankSoz: data.ranks.SÖZ,
        rankDil: data.ranks.DİL,
        rankTyt: data.ranks.TYT,
        revision: 1,
      })
      .returning();
    const scenario = rows[0]!;
    await this.replaceItems(tx, scenario.id, userId, data.snapshots);
    return (await this.findByUser(tx, userId))!;
  }

  async replace(
    tx: DatabaseTx,
    userId: string,
    expectedRevision: number,
    data: SavePreferenceScenarioData,
  ): Promise<PreferenceScenarioAggregate | undefined> {
    const rows = await tx
      .update(preferenceScenarios)
      .set({
        organizationId: data.organizationId,
        datasetVersion: data.datasetVersion,
        rankSay: data.ranks.SAY,
        rankEa: data.ranks.EA,
        rankSoz: data.ranks.SÖZ,
        rankDil: data.ranks.DİL,
        rankTyt: data.ranks.TYT,
        revision: expectedRevision + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(preferenceScenarios.userId, userId),
          eq(preferenceScenarios.revision, expectedRevision),
        ),
      )
      .returning({ id: preferenceScenarios.id });
    const scenario = rows[0];
    if (!scenario) return undefined;
    await this.replaceItems(tx, scenario.id, userId, data.snapshots);
    return this.findByUser(tx, userId);
  }

  async deleteByUser(tx: DatabaseTx, userId: string): Promise<void> {
    await tx
      .delete(preferenceScenarios)
      .where(eq(preferenceScenarios.userId, userId));
  }

  private async replaceItems(
    tx: DatabaseTx,
    scenarioId: string,
    userId: string,
    snapshots: PreferenceProgramSnapshotDto[],
  ): Promise<void> {
    await tx
      .delete(preferenceScenarioItems)
      .where(
        and(
          eq(preferenceScenarioItems.scenarioId, scenarioId),
          eq(preferenceScenarioItems.userId, userId),
        ),
      );
    if (snapshots.length === 0) return;
    await tx.insert(preferenceScenarioItems).values(
      snapshots.map((snapshot) => ({
        scenarioId,
        userId,
        position: snapshot.position,
        programCode: snapshot.code,
        programName: snapshot.name,
        faculty: snapshot.faculty,
        level: snapshot.level,
        scoreType: snapshot.scoreType,
        quota: snapshot.quota,
        guideYear: snapshot.guideYear,
        placementYear: snapshot.placementYear,
        successRank: snapshot.successRank,
        universityId: snapshot.universityId,
        universityName: snapshot.universityName,
        cityCode: snapshot.cityCode,
        cityName: snapshot.cityName,
        source: snapshot.source,
        sourceUrl: snapshot.sourceUrl,
        verifiedAt: new Date(snapshot.verifiedAt),
      })),
    );
  }
}
