import type { ReactNode } from "react";

interface FormSectionProps {
    title: string;
    hint?: string;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
}

export function FormSection({ title, hint, children, footer, className }: FormSectionProps) {
    const sectionClass = ["card stretch stretch-full admin-form-section", className].filter(Boolean).join(" ");

    return (
        <section className={sectionClass}>
            <div className="card-body">
                <div className="mb-4">
                    <h5 className="fw-bold mb-0">{title}</h5>
                    {hint ? <p className="fs-12 text-muted mb-0 mt-1">{hint}</p> : null}
                </div>
                {children}
            </div>
            {footer ? <div className="card-footer">{footer}</div> : null}
        </section>
    );
}
