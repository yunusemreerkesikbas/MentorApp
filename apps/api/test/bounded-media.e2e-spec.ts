import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import request from "supertest";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigRegistryService } from "../src/common/config/config-registry.service";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { CONFIG_CATALOG } from "../src/common/config/config.catalog";
import { createDatabase } from "../src/database/drizzle";
import { TokenService } from "../src/modules/identity/application/token.service";
import { AuthSessionRepository } from "../src/modules/identity/infrastructure/auth-session.repository";
import { RAW_STORAGE_PORT } from "../src/shared/ports/storage.port";
import { StorageBudgetRepository } from "../src/shared/storage/storage-budget.repository";
import { StorageBudgetService } from "../src/shared/storage/storage-budget.service";
import { BoundedStorageAdapter } from "../src/shared/storage/bounded-storage.adapter";
import { MediaReadGrantService } from "../src/shared/storage/media-read-grant.service";
import { MediaReadService } from "../src/shared/storage/media-read.service";
import { MediaController } from "../src/shared/storage/media.controller";
import { assertLocalTestDatabase } from "./database-target";

const tables=["storage_budget_state","storage_reservations","storage_object_manifest"];
const limits={storedBytes: 524288000, classA: 10000, classB: 100000, transferBytes: 1073741824};
const actor={userId:randomUUID(),sessionId:randomUUID()}; const otherSession=randomUUID();
const privateKey=`notebook/${actor.userId}/${randomUUID()}.png`;
const publicKey=`avatars/${actor.userId}/${randomUUID()}.png`;
const raw={readObject:vi.fn(async (_key:string,_maxBytes?:number) => Buffer.from("png"))};

describe("bounded media HTTP boundary", () => {
  let app:INestApplication; let pool:Pool; let repository:StorageBudgetRepository; let grants:MediaReadGrantService; let tokens:TokenService;
  const snapshots=new Map<string,Record<string,unknown>[]>();
  beforeAll(async () => {
    const target=process.env.TEST_DATABASE_URL ?? "postgres://mentor:mentor@localhost:5433/mentor_storage_budget_test";
    assertLocalTestDatabase(target); pool=new Pool({connectionString:target});
    for (const table of tables) snapshots.set(table,(await pool.query(`select * from ${table}`)).rows);
    await pool.query("insert into users(id,email,password_hash,display_name,kvkk_accepted_at) values ($1,$2,'fixture','Media fixture',now())",[actor.userId,`media-${actor.userId}@example.test`]);
    await pool.query("insert into auth_sessions(id,user_id,expires_at) values ($1,$3,now()+interval '1 hour'),($2,$3,now()+interval '1 hour')",[actor.sessionId,otherSession,actor.userId]);
    const db=createDatabase(pool); repository=new StorageBudgetRepository(db);
    const config=new ConfigService({STORAGE_ACCESS_MODE:"bounded",MEDIA_READ_SECRET:"test-media-http-secret-0000000000000000000"});
    const registry={get:vi.fn(async (key:keyof typeof CONFIG_CATALOG) => CONFIG_CATALOG[key].default)};
    const budget=new StorageBudgetService(repository,registry as never);
    tokens=new TokenService(new JwtService(),config,new AuthSessionRepository(db));
    const bounded=new BoundedStorageAdapter(raw as never,budget);
    const module=await Test.createTestingModule({controllers:[MediaController],providers:[MediaReadGrantService,MediaReadService,
      {provide:ConfigService,useValue:config},{provide:ConfigRegistryService,useValue:registry},
      {provide:StorageBudgetRepository,useValue:repository},{provide:TokenService,useValue:tokens},{provide:RAW_STORAGE_PORT,useValue:bounded},
    ]}).compile();
    app=module.createNestApplication(); app.setGlobalPrefix("v1"); app.useGlobalFilters(new AllExceptionsFilter()); await app.init();
    grants=app.get(MediaReadGrantService);
  });
  beforeEach(async () => {
    raw.readObject.mockClear(); await pool.query(`truncate ${tables.join(",")}`);
    await pool.query("insert into storage_budget_state(id,status,scope_fingerprint,transfer_bytes) values (1,'READY',$1,0)",["0".repeat(64)]);
    for (const key of [privateKey,publicKey]) await repository.settle((await repository.reserve({kind:"put",key,bytes:3,contentType:"image/png"},limits)).id,"succeeded");
    await pool.query("update auth_sessions set revoked_at=null where user_id=$1",[actor.userId]);
  });
  afterAll(async () => {
    await app?.close();
    if (pool && snapshots.size===tables.length) {
      await pool.query(`truncate ${tables.join(",")}`);
      for (const table of tables) for (const row of snapshots.get(table) ?? []) {
        const cols=Object.keys(row); await pool.query(`insert into ${table} (${cols.join(",")}) values (${cols.map((_,i)=>`$${i+1}`).join(",")})`,Object.values(row));
      }
      await pool.query("delete from users where id=$1",[actor.userId]);
    }
    await pool?.end();
  });
  const privateUrl=() => `/v1/storage/media/private?grant=${grants.issue(privateKey,actor,300)}`;
  const publicUrl=() => `/v1/storage/media/public/${publicKey}`;

  it("serves private bytes with no-store, no-referrer and explicit MIME",async () => {
    const res=await request(app.getHttpServer()).get(privateUrl()).expect(200);
    expect(res.headers).toMatchObject({"cache-control":"no-store","referrer-policy":"no-referrer","x-content-type-options":"nosniff"});
    expect(res.headers["content-type"]).toContain("image/png"); expect(raw.readObject).toHaveBeenCalledWith(privateKey,3);
  });
  it("refuses a grant from a revoked session while the owner has another live session",async () => {
    const url=privateUrl(); await pool.query("update auth_sessions set revoked_at=now() where id=$1",[actor.sessionId]);
    await expect(tokens.validateSession(otherSession,actor.userId)).resolves.toMatchObject({sessionId:otherSession});
    await request(app.getHttpServer()).get(url).expect(401); expect(raw.readObject).not.toHaveBeenCalled();
  });
  it("serves public content but refuses private prefixes and encoded paths",async () => {
    await request(app.getHttpServer()).get(publicUrl()).expect(200); raw.readObject.mockClear();
    for (const path of [`/v1/storage/media/public/${privateKey}`,`/v1/storage/media/public/unknown/key.png`,
      `/v1/storage/media/public/avatars%2F${actor.userId}%2Fphoto.png`]) {
      const res=await request(app.getHttpServer()).get(path); expect(res.status).toBeGreaterThanOrEqual(400);
    }
    expect(raw.readObject).not.toHaveBeenCalled();
  });
  it("authorizes HEAD without provider calls, and refuses unsupported methods",async () => {
    await request(app.getHttpServer()).head(privateUrl()).expect(200);
    await request(app.getHttpServer()).head(publicUrl()).expect(200);
    await request(app.getHttpServer()).head("/v1/storage/media/private?grant=bad").expect(401);
    await request(app.getHttpServer()).post(privateUrl()).expect(405);
    expect(raw.readObject).not.toHaveBeenCalled();
  });
  it("refuses exhausted reads before the backend and does not disclose usage",async () => {
    await pool.query("update storage_budget_state set class_b=100000");
    const res=await request(app.getHttpServer()).get(privateUrl()).expect(503);
    expect(res.body.code).toBe("STORAGE_TEMPORARILY_UNAVAILABLE"); expect(JSON.stringify(res.body)).not.toContain("100000");
    expect(raw.readObject).not.toHaveBeenCalled();
  });
  it("serializes concurrent requests for the final two read attempts",async () => {
    await pool.query("update storage_budget_state set class_b=99998");
    const url=privateUrl(); const responses=await Promise.all([request(app.getHttpServer()).get(url),request(app.getHttpServer()).get(url)]);
    expect(responses.map(res=>res.status).sort()).toEqual([200,503]); expect(raw.readObject).toHaveBeenCalledTimes(1);
    expect((await pool.query("select class_b from storage_budget_state")).rows[0]?.class_b).toBe(100000);
  });
  it("stops photo bytes at the transfer ceiling while HEAD still authorizes metadata",async () => {
    await pool.query("update storage_budget_state set transfer_bytes=1073741824");
    await request(app.getHttpServer()).get(privateUrl()).expect(503);
    await request(app.getHttpServer()).head(privateUrl()).expect(200);
    expect(raw.readObject).not.toHaveBeenCalled();
  });
});
