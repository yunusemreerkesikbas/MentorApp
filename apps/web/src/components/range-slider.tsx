"use client";

/**
 * The one gradient-fill range track used everywhere a value is dragged: the vision-board and
 * notebook side panels' rotation/opacity/size fields, the board's floating opacity control, and
 * the notebook drawing toolbar's thickness/opacity strip. Colours are props, not hardcoded tokens,
 * because the drawing toolbar's tray is permanently dark (it never takes `--color-surface`) while
 * every other caller sits on the app's normal light/dark surface.
 */
export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  label: string;
  onChange: (value: number) => void;
  onCommit?: () => void;
  /** Appended to the value chip — "px", "°", "%", or left blank for a plain ratio. */
  unit?: string;
  decimals?: number;
  /** Track colour left of the thumb (the filled portion). Defaults to the brand accent. */
  fillColor?: string;
  /** Track colour right of the thumb (the unfilled portion). Defaults to the surface container. */
  trackColor?: string;
  /** Renders just the bare track with no value chip — for tight spaces like a floating toolbar. */
  showValue?: boolean;
  className?: string;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  label,
  onChange,
  onCommit,
  unit = "",
  decimals = 0,
  fillColor = "var(--color-accent)",
  trackColor = "var(--color-surface-container)",
  showValue = true,
  className,
}: RangeSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  const track = (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onPointerDown={onCommit}
      onKeyDown={onCommit}
      onChange={(event) => onChange(Number(event.target.value))}
      className={`mentor-range h-1.5 ${className ?? "w-full flex-1"}`}
      style={{
        background: `linear-gradient(to right, ${fillColor} ${pct}%, ${trackColor} ${pct}%)`,
      }}
    />
  );

  if (!showValue) return track;

  return (
    <div className="flex items-center gap-2">
      {track}
      <span
        className="flex h-9 min-w-16 shrink-0 items-center justify-center gap-0.5 rounded-[var(--radius-card)] border px-1.5"
        style={{ borderColor: "rgba(17, 17, 17, 0.12)" }}
      >
        <input
          type="number"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value.toFixed(decimals)}
          onFocus={onCommit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isNaN(next)) return;
            onChange(Math.min(max, Math.max(min, next)));
          }}
          className="w-full min-w-0 bg-transparent text-center text-xs font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          style={{ color: "var(--color-body)" }}
        />
        {unit ? (
          <span
            className="shrink-0 text-xs font-semibold"
            style={{ color: "var(--color-secondary)" }}
          >
            {unit}
          </span>
        ) : null}
      </span>
    </div>
  );
}
