/** Soft pastel blobs — DESIGN.md §2.2; full coach surface (page width + under mobile tab). */
export function CoachChatBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-16"
      data-testid="coach-chat-backdrop"
    >
      <div
        className="absolute -left-28 -top-24 h-[28rem] w-[28rem] rounded-full blur-[150px]"
        style={{ backgroundColor: "var(--blob-pink)", opacity: "var(--blob-pink-opacity)" }}
      />
      <div
        className="absolute -right-32 top-[18%] h-[32rem] w-[32rem] rounded-full blur-[150px]"
        style={{ backgroundColor: "var(--blob-blue)", opacity: "var(--blob-blue-opacity)" }}
      />
      <div
        className="absolute -bottom-16 left-[8%] h-[30rem] w-[30rem] rounded-full blur-[150px]"
        style={{ backgroundColor: "var(--blob-cyan)", opacity: "var(--blob-cyan-opacity)" }}
      />
      <div
        className="absolute bottom-0 right-[-12%] h-80 w-80 rounded-full blur-[140px]"
        style={{ backgroundColor: "var(--blob-blue)", opacity: "var(--blob-blue-opacity)" }}
      />
    </div>
  );
}
