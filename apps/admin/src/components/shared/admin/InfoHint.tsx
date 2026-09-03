"use client";

import { useId } from "react";
import { FiInfo } from "react-icons/fi";
import type { PlacesType } from "react-tooltip";
import { ADMIN_TOOLTIP_ID } from "./AdminTooltipHost";

interface InfoHintProps {
    label: string;
    content: string;
    placement?: PlacesType;
}

export function InfoHint({ label, content, placement = "top" }: InfoHintProps) {
    const descriptionId = useId();

    return (
        <>
            <button
                type="button"
                className="admin-info-hint"
                aria-label={label}
                aria-describedby={descriptionId}
                data-tooltip-id={ADMIN_TOOLTIP_ID}
                data-tooltip-content={content}
                data-tooltip-place={placement}
            >
                <FiInfo aria-hidden="true" />
            </button>
            <span id={descriptionId} className="visually-hidden">{content}</span>
        </>
    );
}
