import type { DashboardTone } from "./types";

const BADGE: Record<DashboardTone, string> = {
    primary: "bg-soft-primary text-primary",
    success: "bg-soft-success text-success",
    teal: "bg-soft-teal text-teal",
    warning: "bg-soft-warning text-warning",
    danger: "bg-soft-danger text-danger",
    muted: "bg-soft-secondary text-muted",
};

const TEXT: Record<DashboardTone, string> = {
    primary: "text-primary",
    success: "text-success",
    teal: "text-teal",
    warning: "text-warning",
    danger: "text-danger",
    muted: "text-muted",
};

const AVATAR: Record<DashboardTone, string> = {
    primary: "text-white bg-primary",
    success: "text-white bg-success",
    teal: "text-white bg-teal",
    warning: "text-white bg-warning",
    danger: "text-white bg-danger",
    muted: "text-dark bg-gray-200",
};

const PROGRESS: Record<DashboardTone, string> = {
    primary: "bg-primary",
    success: "bg-success",
    teal: "bg-teal",
    warning: "bg-warning",
    danger: "bg-danger",
    muted: "bg-secondary",
};

export function badgeToneClass(tone: DashboardTone): string {
    return BADGE[tone];
}

export function textToneClass(tone: DashboardTone): string {
    return TEXT[tone];
}

export function avatarToneClass(tone: DashboardTone): string {
    return AVATAR[tone];
}

export function progressToneClass(tone: DashboardTone): string {
    return PROGRESS[tone];
}

export function clampPercent(percent: number): number {
    if (percent < 0) return 0;
    if (percent > 100) return 100;
    return percent;
}
