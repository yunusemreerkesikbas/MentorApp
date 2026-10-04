export type DashboardTone = "primary" | "success" | "teal" | "warning" | "danger" | "muted";

export type KpiItem = {
    id: string;
    icon: string;
    title: string;
    value: string | number;
    hint?: string;
    href?: string;
    subtitle?: string;
    tone?: DashboardTone;
    badge?: { text: string; tone: DashboardTone };
    progress?: { label: string; percent: number };
};

export type WindowSeries = {
    id: string;
    title: string;
    value: string;
    color: string;
    categories: string[];
    data: number[];
};

export type BucketItem = { id: string; label: string; value: number };

export type StripItem = {
    id: string;
    icon: string;
    title: string;
    value: string | number;
    tone?: DashboardTone;
};
