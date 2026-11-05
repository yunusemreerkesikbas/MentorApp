import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

/**
 * Availability fixture for the invite-only signup suite (`playwright.waitlist.config.ts`). The web
 * reads `signupWaitlist` on the server, where `page.route` cannot reach, so the suite flips it here:
 * `POST /__qa/availability {"signupWaitlist": boolean, "studentSignup"?: boolean}` (`studentSignup`
 * defaults back to true; false is closed mode, `signup.enabled=false`). Coach signup stays closed, so
 * any coach CTA on the page is there because of the waitlist alone. No real user data or database is
 * involved.
 *
 * `QA_WAITLIST_MODE=open` starts with the waitlist off: the ordinary suite can borrow it on the
 * default API port when no API is running (`QA_WAITLIST_API_PORT=3001`).
 */
let signupWaitlist = process.env.QA_WAITLIST_MODE !== "open";
let studentSignup = true;

function availability() {
  return {
    aiCoach: true, coachPurchases: true, coachRegistration: true, coachSignup: true, economy: true, forum: true,
    humanCoaching: true, invites: true, social: true, signupWaitlist, studentPurchases: true, studentSignup,
    studyRooms: true,
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: Buffer) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
  });
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  // The browser calls this API too (session refresh, coach status): answer it like the real one.
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, accept-language");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  const json = (body: unknown, status = 200) => {
    res.statusCode = status;
    res.end(JSON.stringify(body));
  };

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (path === "/health") return json({});
  if (path === "/__qa/availability" && req.method === "POST") {
    const next = JSON.parse(await readBody(req)) as { signupWaitlist?: unknown; studentSignup?: unknown };
    if (typeof next.signupWaitlist === "boolean") signupWaitlist = next.signupWaitlist;
    studentSignup = typeof next.studentSignup === "boolean" ? next.studentSignup : true;
    return json(availability());
  }
  if (path === "/v1/app/availability") return json(availability());
  if (path === "/v1/auth/coach-signup/status") return json({ open: false });
  if (path === "/v1/auth/refresh") return json({ code: "AUTH_INVALID_REFRESH", message: "Oturum bulunamadı." }, 401);
  if (path === "/v1/auth/waitlist" && req.method === "POST") {
    res.statusCode = 204;
    res.end();
    return;
  }
  json({ code: "NOT_FOUND" }, 404);
}

const server = createServer((req, res) => void handle(req, res));
server.listen(Number(process.env.QA_WAITLIST_API_PORT ?? "3381"), "localhost");
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
