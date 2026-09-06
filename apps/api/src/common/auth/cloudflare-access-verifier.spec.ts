import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { CloudflareAccessVerifier } from "./cloudflare-access-verifier";

describe("CloudflareAccessVerifier", () => {
  it("verifies issuer, audience, signature and email using the team JWKS", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    const keySet = createLocalJWKSet({
      keys: [{ ...jwk, kid: "key-1", alg: "RS256", use: "sig" }],
    });
    const token = await new SignJWT({ email: "Admin@Mentor.test" })
      .setProtectedHeader({ alg: "RS256", kid: "key-1" })
      .setIssuer("https://mentor.cloudflareaccess.com")
      .setAudience("access-audience")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    const verifier = new CloudflareAccessVerifier({
      get: (key: string) =>
        key === "CLOUDFLARE_ACCESS_TEAM_DOMAIN"
          ? "https://mentor.cloudflareaccess.com"
          : "access-audience",
    } as never, () => keySet);

    await expect(verifier.verify(token)).resolves.toEqual({ email: "admin@mentor.test" });
  });

  it("rejects an assertion minted for another Access application", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    const keySet = createLocalJWKSet({ keys: [{ ...jwk, kid: "key-2" }] });
    const token = await new SignJWT({ email: "admin@mentor.test" })
      .setProtectedHeader({ alg: "RS256", kid: "key-2" })
      .setIssuer("https://mentor.cloudflareaccess.com")
      .setAudience("wrong-audience")
      .setExpirationTime("5m")
      .sign(privateKey);
    const verifier = new CloudflareAccessVerifier({
      get: (key: string) =>
        key === "CLOUDFLARE_ACCESS_TEAM_DOMAIN"
          ? "https://mentor.cloudflareaccess.com"
          : "expected-audience",
    } as never, () => keySet);

    await expect(verifier.verify(token)).rejects.toThrow();
  });
});
