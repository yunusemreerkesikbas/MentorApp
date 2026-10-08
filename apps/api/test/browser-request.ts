import request from "supertest";

/** Ordinary lifecycle fixtures represent browser requests. Boundary tests use raw supertest. */
const browserRequest: typeof request = Object.assign((app: Parameters<typeof request>[0],
  options?: Parameters<typeof request>[1]) => {
  const client = request(app, options);
  const post = client.post.bind(client);
  client.post = (url: string) => post(url).set("Origin", /\/auth\/admin(?:\/|$)/i.test(url)
    ? process.env.ADMIN_APP_URL ?? "http://localhost:3002"
    : process.env.APP_URL ?? "http://localhost:3000");
  return client;
}, request);

export default browserRequest;
