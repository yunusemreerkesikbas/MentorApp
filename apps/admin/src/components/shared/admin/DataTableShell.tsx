import type { ReactNode } from "react";

interface DataTableShellProps {
    children: ReactNode;
    toolbar?: ReactNode;
    state?: ReactNode;
}

export function DataTableShell({ children, toolbar, state }: DataTableShellProps) {
    return (
        <section className="card stretch stretch-full admin-data-table">
            {toolbar ? <div className="card-header admin-data-table-toolbar">{toolbar}</div> : null}
            <div className="card-body p-0">
                {state ?? <div className="table-responsive">{children}</div>}
            </div>
        </section>
    );
}
