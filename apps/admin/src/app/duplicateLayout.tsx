'use client'
import type { ReactNode } from "react";
import AdminShell from "@/components/shared/AdminShell";

// Kept for the root "/" page (outside the (general) route group) — same protected shell.
export default function DuplicateLayout({ children }: { children: ReactNode }) {
    return <AdminShell>{children}</AdminShell>;
}
