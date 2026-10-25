import { createServer } from "node:http";

/** SSR-only browser fixture. No real user data, database or Google inventory is involved. */
const questionId = "11111111-1111-4111-8111-111111111111";
const question = {
  id: questionId, title: "Çalışma düzenimi nasıl sürdürebilirim?",
  body: "Her gün küçük bir adımla ilerlemek istiyorum.",
  createdAt: "2026-10-01T00:00:00Z", contentRevision: "a".repeat(64), examType: "LGS",
  answers: [{ id: "22222222-2222-4222-8222-222222222222", body: "Küçük ve sürdürülebilir bir hedefle başlayabilirsin.", isAccepted: true, createdAt: "2026-10-01T01:00:00Z" }],
};
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/health") { res.end("{}"); return; }
  if (req.url === `/v1/forum/public/questions/${questionId}`) { res.end(JSON.stringify(question)); return; }
  if (req.url === "/v1/forum/public/questions/44444444-4444-4444-8444-444444444444") {
    res.end(JSON.stringify({ ...question, id: "44444444-4444-4444-8444-444444444444", body: `${question.body}\n`.repeat(100) })); return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ code: "NOT_FOUND" }));
});
server.listen(3371, "localhost");
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
