/**
 * A note left on the desk: something did not load or did not go through, and the one thing to do
 * about it. Paper-coloured in both themes so it reads on dark wood as well as light.
 */
export function DeskNotice({
  message,
  actionLabel,
  onAction,
  alert = false,
  disabled = false,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  alert?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      role={alert ? "alert" : undefined}
      className="desk-notice mx-auto flex max-w-[560px] flex-wrap items-center justify-center gap-3 px-5 py-4 text-center text-sm font-semibold"
    >
      <span>{message}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        className="min-h-11 rounded-full border-2 px-4 font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] disabled:opacity-60"
        style={{ borderColor: "rgba(42, 33, 24, 0.22)" }}
      >
        {actionLabel}
      </button>
    </div>
  );
}
