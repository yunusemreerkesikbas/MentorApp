import { Injectable } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { pushEndpointSchema } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { ValidationFailedError } from "../../../common/errors/domain-error";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
] as const) blocked.addSubnet(address, prefix, "ipv6");

export class UnsafePushEndpointError extends ValidationFailedError {}

export function isPublicPushAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  return family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

export interface ResolvedPushEndpoint {
  url: URL;
  address: string;
  family: number;
}

/** Resolve before storage and immediately before send; the adapter pins this address. */
@Injectable()
export class PushEndpointPolicy {
  constructor(private readonly registry: ConfigRegistryService) {}

  async resolve(endpoint: string): Promise<ResolvedPushEndpoint> {
    if (!pushEndpointSchema.safeParse(endpoint).success) throw new UnsafePushEndpointError();
    const url = new URL(endpoint);
    const timeoutMs = await this.registry.get("notifications.push.request_timeout_ms") as number;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const addresses = await Promise.race([
        lookup(url.hostname, { all: true, verbatim: true }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Push DNS resolution timed out")), timeoutMs);
        }),
      ]);
      if (addresses.length === 0 || addresses.some(({ address }) => !isPublicPushAddress(address))) {
        throw new UnsafePushEndpointError();
      }
      return { url, ...addresses[0]! };
    } finally {
      clearTimeout(timer);
    }
  }
}
