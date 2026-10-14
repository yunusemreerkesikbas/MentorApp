import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { edgeOriginMiddleware } from "./edge-origin";

const secret = "test-edge-secret-that-is-at-least-32-chars";
const cronSecret = "test-cron-secret-that-is-at-least-32-chars";

function app(nodeEnv = "production") {
  const parsed = vi.fn();
  const server = express();
  server.use(edgeOriginMiddleware({ get: (key: string) => ({
    NODE_ENV: nodeEnv, EDGE_ORIGIN_SECRET: secret, CRON_SECRET: cronSecret,
  })[key] } as never));
  server.use(express.json({ verify: parsed }));
  server.use((req, res) => res.json({ ip: req.ip }));
  return { server, parsed };
}

describe("edge origin boundary", () => {
  it("rejects direct origin access before parsing the body", async () => {
    const { server, parsed } = app();
    await request(server).post("/v1/auth/login").send({ password: "dummy" }).expect(403);
    expect(parsed).not.toHaveBeenCalled();
  });

  it.each([undefined, "garbage", "192.0.2.1, 192.0.2.2", "192.0.2.1:443", "fe80::1%eth0"])(
    "rejects missing or malformed Cloudflare IP %s", async (ip) => {
      const req = request(app().server).post("/v1/auth/login").set("x-mentor-origin-secret", secret);
      if (ip !== undefined) req.set("cf-connecting-ip", ip);
      await req.send({}).expect(403);
    },
  );

  it.each(["192.0.2.7", "2001:db8::7"])("uses only the verified Cloudflare IP %s", async (ip) => {
    const response = await request(app().server).post("/v1/auth/login")
      .set("x-mentor-origin-secret", secret).set("cf-connecting-ip", ip)
      .set("x-forwarded-for", "198.51.100.8").send({}).expect(200);
    expect(response.body.ip).toBe(ip);
  });

  it("ignores forwarded IP and origin-secret headers during development", async () => {
    const response = await request(app("development").server).get("/v1/users/me")
      .set("cf-connecting-ip", "192.0.2.7").set("x-forwarded-for", "198.51.100.8").expect(200);
    expect(response.body.ip).not.toBe("192.0.2.7");
    expect(response.body.ip).not.toBe("198.51.100.8");
  });

  it("allows only GET health endpoints and authenticated POST cron directly", async () => {
    const { server } = app();
    await request(server).get("/v1/health").expect(200);
    await request(server).get("/v1/health/ready").expect(200);
    await request(server).post("/v1/health").send({}).expect(403);
    await request(server).get("/v1/health/other").expect(403);
    await request(server).post("/v1/internal/cron/process-jobs").set("x-cron-secret", cronSecret).send({}).expect(200);
    await request(server).post("/v1/internal/cron/process-jobs").set("Authorization", `Bearer ${cronSecret}`).send({}).expect(200);
    await request(server).post("/v1/internal/cron/process-jobs").set("x-cron-secret", "wrong").send({}).expect(403);
    await request(server).get("/v1/internal/cron/process-jobs").set("x-cron-secret", cronSecret).expect(403);
  });
});
