import type { ReactNode } from "react";

type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

const TONE_CLASS: Record<StatusTone, string> = {
    success: "bg-soft-success text-success",
    warning: "bg-soft-warning text-warning",
    danger: "bg-soft-danger text-danger",
    neutral: "bg-soft-secondary text-secondary",
    info: "bg-soft-info text-info",
};

interface StatusBadgeProps {
    tone: StatusTone;
    children: ReactNode;
}

export function StatusBadge({ tone, children }: StatusBadgeProps) {
    return <span className={`badge admin-status-badge ${TONE_CLASS[tone]}`}>{children}</span>;
}
