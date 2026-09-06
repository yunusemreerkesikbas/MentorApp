import type { Readable } from "node:stream";
import { DomainError, ValidationFailedError } from "../../common/errors/domain-error";
import { ErrorCode } from "../../common/errors/error-code";

/** Attach only after authorization and atomic claim. Never buffer more than the ticket cap. */
export function readUploadStream(stream: Readable, maxBytes: number, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let pendingError: Error | null = null;
    const timer = setTimeout(() => fail(new DomainError(ErrorCode.BAD_REQUEST, 408)), timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      stream.off("data", onData);
      stream.off("end", onEnd);
      stream.off("error", fail);
      stream.off("aborted", onAborted);
      stream.off("close", onClose);
    }
    function fail(error: Error) {
      cleanup();
      // Drain the remaining request body so Node can send the structured HTTP
      // error instead of resetting the connection while the client is writing.
      stream.resume();
      chunks.length = 0;
      reject(error);
    }
    function onData(chunk: Buffer | string) {
      if (pendingError) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > maxBytes) {
        pendingError = new DomainError(ErrorCode.BAD_REQUEST, 413);
        chunks.length = 0;
        return;
      }
      chunks.push(bytes);
    }
    function onEnd() {
      cleanup();
      if (pendingError) return reject(pendingError);
      if (size === 0) return reject(new ValidationFailedError({ reason: "empty_upload" }));
      resolve(Buffer.concat(chunks, size));
    }
    function onAborted() { fail(new ValidationFailedError({ reason: "upload_aborted" })); }
    function onClose() { if (!stream.readableEnded) onAborted(); }
    stream.on("data", onData);
    stream.once("end", onEnd);
    stream.once("error", fail);
    stream.once("aborted", onAborted);
    stream.once("close", onClose);
  });
}
