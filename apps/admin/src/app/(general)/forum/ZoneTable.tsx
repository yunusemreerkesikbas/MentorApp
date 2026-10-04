import Link from "next/link";
import { FiPlus } from "react-icons/fi";
import type { ZoneView } from "@mentor/types";
import { AsyncState } from "@/components/shared/admin/AsyncState";
import { DataTableShell } from "@/components/shared/admin/DataTableShell";
import { StatusBadge } from "@/components/shared/admin/StatusBadge";
import { JOIN_POLICY_LABELS, ZONE_TYPE_LABELS } from "./ZoneForm";

export function ZoneTable({ zones }: { zones: ZoneView[] }) {
    return (
        <DataTableShell
            toolbar={
                <div>
                    <h5 className="mb-1">Topluluk odaları</h5>
                    <p className="mb-0 fs-12 text-muted">Sohbet, duyuru ve soru-cevap alanları.</p>
                </div>
            }
            state={
                zones.length === 0 ? (
                    <AsyncState
                        status="empty"
                        title="Henüz oda yok"
                        description="Topluluğun ilk odasını oluşturabilirsiniz."
                        action={
                            <Link href="/forum/new" className="btn btn-primary">
                                <FiPlus aria-hidden="true" /> Yeni oda
                            </Link>
                        }
                    />
                ) : undefined
            }
        >
            <table className="table table-hover mb-0 forum-zones-table">
                <thead>
                    <tr className="border-b">
                        <th>Oda</th>
                        <th>Tür</th>
                        <th>Katılım</th>
                        <th>Sınav</th>
                        <th>Üye</th>
                        <th>Oluşturulma</th>
                    </tr>
                </thead>
                <tbody>
                    {zones.map((zone) => (
                        <tr key={zone.id} className="chat-single-item">
                            <td>
                                <div className="d-flex align-items-center gap-3">
                                    <div className="avatar-text user-avatar-text">
                                        {zone.emoji?.trim() || zone.title.slice(0, 1)}
                                    </div>
                                    <div>
                                        <span className="d-block">{zone.title}</span>
                                        <code className="fs-12 text-muted">{zone.slug}</code>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <StatusBadge tone="info">
                                    {ZONE_TYPE_LABELS[zone.type] ?? zone.type}
                                </StatusBadge>
                            </td>
                            <td>{JOIN_POLICY_LABELS[zone.joinPolicy] ?? zone.joinPolicy}</td>
                            <td>{zone.examType ?? <span className="text-muted">—</span>}</td>
                            <td>{zone.memberCount}</td>
                            <td>{new Date(zone.createdAt).toLocaleDateString("tr-TR")}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </DataTableShell>
    );
}
