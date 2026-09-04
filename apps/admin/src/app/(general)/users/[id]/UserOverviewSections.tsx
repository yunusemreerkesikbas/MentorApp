import { FormSection } from "@/components/shared/admin/FormSection";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import { ASSIGNABLE_ROLES } from "@/lib/roles";
import type { AdminUserDetail } from "@/lib/types";

export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

interface UserOverviewSectionsProps {
    busy: boolean;
    canManageRoles: boolean;
    user: AdminUserDetail;
    onAnonymize: () => void;
    onExport: () => void;
    onStatusChange: (status: UserStatus, label: string) => void;
    onToggleRole: (role: string) => void;
}

export function UserOverviewSections({ busy, canManageRoles, user, onAnonymize, onExport, onStatusChange, onToggleRole }: UserOverviewSectionsProps) {
    const statusTone = user.status === "ACTIVE" ? "success" : user.status === "SUSPENDED" ? "warning" : user.status === "BANNED" ? "danger" : "neutral";
    const statusLabel = user.status === "ACTIVE" ? "Aktif" : user.status === "SUSPENDED" ? "Askıda" : user.status === "BANNED" ? "Yasaklı" : user.status;

    return (
        <>
            <div className="col-lg-7">
                <FormSection title={user.displayName || "Kullanıcı bilgileri"}>
                    <dl className="row mb-0">
                        <dt className="col-4 text-muted fs-12">E-posta</dt><dd className="col-8">{user.email}</dd>
                        <dt className="col-4 text-muted fs-12">Durum</dt><dd className="col-8"><StatusBadge tone={statusTone}>{statusLabel}</StatusBadge></dd>
                        <dt className="col-4 text-muted fs-12">Roller</dt><dd className="col-8">{user.roles.map((role) => <span key={role} className="badge bg-soft-primary text-primary me-1">{role}</span>)}</dd>
                        <dt className="col-4 text-muted fs-12">STAFF</dt><dd className="col-8">{user.isStaff ? "Evet" : "Hayır"}</dd>
                        <dt className="col-4 text-muted fs-12">Sınav</dt><dd className="col-8">{user.examType ?? "—"} {user.examDate ? `· ${user.examDate}` : ""}</dd>
                        <dt className="col-4 text-muted fs-12">E-posta doğrulandı</dt><dd className="col-8">{user.emailVerified ? "Evet" : "Hayır"}</dd>
                        <dt className="col-4 text-muted fs-12">Kayıt</dt><dd className="col-8">{new Date(user.createdAt).toLocaleString("tr-TR")}</dd>
                    </dl>
                </FormSection>
            </div>
            <div className="col-lg-5">
                <FormSection title="Durum yönetimi">
                    <div className="d-flex flex-column gap-2">
                        {user.status !== "SUSPENDED" ? <button className="btn btn-outline-warning" disabled={busy} onClick={() => onStatusChange("SUSPENDED", "Askıya al")}>Askıya al</button> : null}
                        {user.status !== "BANNED" ? <button className="btn btn-outline-danger" disabled={busy} onClick={() => onStatusChange("BANNED", "Yasakla")}>Yasakla</button> : null}
                        {user.status !== "ACTIVE" ? <button className="btn btn-outline-success" disabled={busy} onClick={() => onStatusChange("ACTIVE", "Yeniden aktifleştir")}>Yeniden aktifleştir</button> : null}
                    </div>
                </FormSection>
                <FormSection title="KVKK" hint="Anonimleştirme kişisel verileri temizler, hesabı yasaklar ve geri alınamaz.">
                    <div className="d-flex flex-column gap-2">
                        <button className="btn btn-outline-primary" onClick={onExport}>Verileri dışa aktar (JSON)</button>
                        <button className="btn btn-danger" disabled={busy} onClick={onAnonymize}>Anonimleştir (silme hakkı)</button>
                    </div>
                </FormSection>
                {canManageRoles ? <FormSection title="Roller" hint="COACH panel erişimi vermez; yalnız koçluk yüzeyini açar. STAFF kullanıcı listesinden yönetilir.">
                    <div className="d-flex flex-column gap-2">
                        {ASSIGNABLE_ROLES.map((role) => {
                            const hasRole = user.roles.includes(role);
                            return <button key={role} className={`btn btn-sm ${hasRole ? "btn-outline-danger" : "btn-outline-success"}`} disabled={busy} onClick={() => onToggleRole(role)}>{hasRole ? `${role} kaldır` : `${role} ver`}</button>;
                        })}
                    </div>
                </FormSection> : null}
            </div>
        </>
    );
}
