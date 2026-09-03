"use client";

import { Tooltip } from "react-tooltip";

export const ADMIN_TOOLTIP_ID = "mentor-admin-tooltip";

export function AdminTooltipHost() {
    return (
        <Tooltip
            id={ADMIN_TOOLTIP_ID}
            className="admin-tooltip"
            positionStrategy="fixed"
            openEvents={{ mouseenter: true, focus: true, click: true }}
            closeEvents={{ mouseleave: true, blur: true }}
            globalCloseEvents={{ escape: true, scroll: true, resize: true, clickOutsideAnchor: true }}
            role="tooltip"
        />
    );
}
