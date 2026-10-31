import { DomainError } from "../../common/errors/domain-error";
import { ErrorCode } from "../../common/errors/error-code";
import { isPrivateKey, isPublicKey } from "./storage-prefixes";
import { uploadPolicy } from "./upload-policy";
import type { StorageOperation } from "./storage-budget.types";

const unavailable = () => new DomainError(ErrorCode.STORAGE_TEMPORARILY_UNAVAILABLE, 503);

/** Validate the single raw-provider boundary, including calls from background work. */
export function validateStorageOperation(operation: StorageOperation): void {
  if (operation.kind === "list") {
    if (!knownPath(operation.prefix, true) || !Number.isInteger(operation.limit) || operation.limit < 1 || operation.limit > 1000) throw unavailable();
    return;
  }
  if (!knownPath(operation.key, false)) throw unavailable();
  if (operation.kind === "copy" && !knownPath(operation.sourceKey, false)) throw unavailable();
  if (operation.kind === "read" && operation.maxBytes !== undefined &&
      (!Number.isSafeInteger(operation.maxBytes) || operation.maxBytes <= 0)) throw unavailable();
  if (operation.kind === "put") {
    const policy = uploadPolicy(operation.key, operation.key.split("/")[1] ?? "", operation.contentType);
    if (!Number.isSafeInteger(operation.bytes) || operation.bytes <= 0 || operation.bytes > policy.maxBytes) throw unavailable();
  }
}

function knownPath(key: string, prefix: boolean): boolean {
  if (!(isPrivateKey(key) || isPublicKey(key)) || key.length > 512 || /[%\\]/.test(key)) return false;
  const segments = (prefix && key.endsWith("/") ? key.slice(0, -1) : key).split("/");
  return segments.every(part => part.length > 0 && part !== "." && part !== ".." && /^[A-Za-z0-9_.-]+$/.test(part));
}
