"use client";

import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { ADMIN_TOOLTIP_ID } from "./AdminTooltipHost";

type IconActionTone = "neutral" | "success" | "danger";

interface IconActionCommonProps {
    label: string;
    icon: ReactNode;
    tone?: IconActionTone;
    busy?: boolean;
    disabled?: boolean;
}

type IconActionProps = IconActionCommonProps & (
    | { href: string; onClick?: never }
    | { href?: never; onClick: MouseEventHandler<HTMLButtonElement> }
);

const TONE_CLASS: Record<IconActionTone, string> = {
    neutral: "btn-light",
    success: "btn-outline-success",
    danger: "btn-outline-danger",
};

export function IconAction({ label, icon, tone = "neutral", busy = false, disabled = false, ...action }: IconActionProps) {
    const className = `btn btn-icon admin-icon-action ${TONE_CLASS[tone]}`;
    const content = busy ? <span className="spinner-border spinner-border-sm" aria-hidden="true" /> : icon;
    const tooltipProps = {
        "aria-label": label,
        "data-tooltip-id": ADMIN_TOOLTIP_ID,
        "data-tooltip-content": label,
        "data-tooltip-place": "top" as const,
    };

    if (action.href) {
        if (disabled) {
            return <span className={`${className} disabled`} aria-disabled="true" {...tooltipProps}>{content}</span>;
        }
        return <Link href={action.href} className={className} {...tooltipProps}>{content}</Link>;
    }

    return (
        <button
            type="button"
            className={className}
            onClick={action.onClick}
            disabled={disabled || busy}
            aria-busy={busy || undefined}
            {...tooltipProps}
        >
            {content}
        </button>
    );
}
