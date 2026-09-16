import { cloneElement, isValidElement, type ReactElement } from "react";
import getIcon from "@/utils/getIcon";

export function DashboardIcon({ name, size, className }: { name: string; size: number; className?: string }) {
    const icon = getIcon(name);
    if (!isValidElement(icon)) return null;
    return cloneElement(icon as ReactElement<{ size?: number; className?: string }>, { size, className });
}
