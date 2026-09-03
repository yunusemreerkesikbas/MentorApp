import type { ReactNode } from "react";
import { InfoHint } from "./InfoHint";

interface FormSectionProps {
    title: string;
    hint?: string;
    children: ReactNode;
    footer?: ReactNode;
}

export function FormSection({ title, hint, children, footer }: FormSectionProps) {
    return (
        <section className="card stretch stretch-full admin-form-section">
            <div className="card-header">
                <div className="d-flex align-items-center gap-2">
                    <h2 className="card-title">{title}</h2>
                    {hint ? <InfoHint label={`${title} bölümü hakkında bilgi`} content={hint} /> : null}
                </div>
            </div>
            <div className="card-body">{children}</div>
            {footer ? <div className="card-footer">{footer}</div> : null}
        </section>
    );
}
