export interface StorageReadActor {
  userId: string;
  sessionId: string;
}
export interface StorageUsageLimits {
  storedBytes: number;
  classA: number;
  classB: number;
  transferBytes: number;
}
export type StorageOperation =
  | { kind: "put"; key: string; bytes: number; contentType: string }
  | { kind: "copy"; sourceKey: string; key: string }
  | { kind: "read"; key: string; maxBytes?: number }
  | { kind: "list"; prefix: string; limit: number }
  | { kind: "delete"; key: string };
export interface StorageReservation {
  id: string;
  kind: StorageOperation["kind"] | "initialization";
  key?: string;
  reservedBytes: number;
  reservedTransferBytes: number;
  classA: number;
  classB: number;
}
export interface StorageObjectRecord {
  key: string;
  bytes: number;
  contentType: string;
  state: "confirmed" | "uncertain" | "deleting";
}
export interface StorageScope {
  accountId: string;
  publicBucket: string;
  privateBucket: string;
  jurisdiction: "eu";
}
