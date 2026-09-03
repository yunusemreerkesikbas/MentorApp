import type { ReactNode } from "react";
import { FiAlertCircle, FiInbox } from "react-icons/fi";

type AsyncStateProps = {
    status: "loading" | "empty" | "error";
    title: string;
    size?: "default" | "compact";
    description?: string;
    action?: ReactNode;
    onRetry?: () => void;
};

export function AsyncState({ status, title, size = "default", description, action, onRetry }: AsyncStateProps) {
    const className = `admin-async-state${size === "compact" ? " admin-async-state-compact" : ""}`;

    if (status === "loading") {
        return (
            <div className={`${className} admin-async-state-loading`} role="status" aria-live="polite">
                <span className="visually-hidden">{title}</span>
                {(size === "compact" ? [0, 1] : [0, 1, 2, 3]).map((row) => (
                    <div className="admin-skeleton-row placeholder-glow" key={row} aria-hidden="true">
                        <span className="placeholder col-4" />
                        <span className="placeholder col-2" />
                        <span className="placeholder col-2" />
                        <span className="placeholder col-1" />
                    </div>
                ))}
            </div>
        );
    }

    const Icon = status === "error" ? FiAlertCircle : FiInbox;
    return (
        <div className={className} role={status === "error" ? "alert" : "status"}>
            <span className={`admin-state-icon ${status === "error" ? "text-danger" : "text-muted"}`}>
                <Icon aria-hidden="true" />
            </span>
            <h2 className="h6 mb-1">{title}</h2>
            {description ? <p className="text-muted mb-3">{description}</p> : null}
            {onRetry ? (
                <button type="button" className="btn btn-light" onClick={onRetry}>Yeniden dene</button>
            ) : action}
        </div>
    );
}
