import { InfoHint } from "./InfoHint";

interface FieldLabelProps {
    htmlFor: string;
    label: string;
    hint?: string;
    required?: boolean;
}

export function FieldLabel({ htmlFor, label, hint, required = false }: FieldLabelProps) {
    return (
        <div className="admin-field-label">
            <label className="form-label mb-0" htmlFor={htmlFor}>
                {label}
                {required ? <span className="text-danger ms-1" aria-hidden="true">*</span> : null}
                {required ? <span className="visually-hidden"> (zorunlu)</span> : null}
            </label>
            {hint ? <InfoHint label={`${label} hakkında bilgi`} content={hint} /> : null}
        </div>
    );
}
