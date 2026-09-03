"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { FiArrowLeft, FiMenu } from "react-icons/fi";

interface AdminBreadcrumb {
    label: string;
    href?: string;
}

interface AdminPageHeaderProps {
    title: string;
    breadcrumbs?: readonly AdminBreadcrumb[];
    actions?: ReactNode;
}

export function AdminPageHeader({ title, breadcrumbs = [], actions }: AdminPageHeaderProps) {
    const [actionsOpen, setActionsOpen] = useState(false);

    return (
        <header className="page-header admin-page-header">
            <div className="page-header-left d-flex align-items-center">
                <div className="page-header-title">
                    <h1>{title}</h1>
                </div>
                {breadcrumbs.length > 0 ? (
                    <nav aria-label="Sayfa yolu">
                        <ol className="breadcrumb">
                            {breadcrumbs.map((item) => (
                                <li className={`breadcrumb-item${item.href ? "" : " active"}`} key={`${item.label}-${item.href ?? "current"}`} aria-current={item.href ? undefined : "page"}>
                                    {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
                                </li>
                            ))}
                        </ol>
                    </nav>
                ) : null}
            </div>
            {actions ? (
                <div className="page-header-right ms-auto">
                    <div className={`page-header-right-items ${actionsOpen ? "page-header-right-open" : ""}`}>
                        <div className="d-flex d-md-none">
                            <button type="button" className="page-header-right-close-toggle btn btn-link" onClick={() => setActionsOpen(false)}>
                                <FiArrowLeft aria-hidden="true" />
                                <span>Geri</span>
                            </button>
                        </div>
                        {actions}
                    </div>
                    <button type="button" className="page-header-right-open-toggle btn btn-light d-md-none" onClick={() => setActionsOpen(true)} aria-label="Sayfa işlemlerini aç" aria-expanded={actionsOpen}>
                        <FiMenu aria-hidden="true" />
                    </button>
                </div>
            ) : null}
        </header>
    );
}
