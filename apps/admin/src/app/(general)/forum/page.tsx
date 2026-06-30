'use client';
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Paginated, ZoneView } from "@mentor/types";
import PageHeader from "@/components/shared/pageHeader/PageHeader";
import apiClient from "@/lib/apiClient";
import { JOIN_POLICY_LABELS, ZONE_TYPE_LABELS } from "./ZoneForm";

export default function ForumZonesPage() {
    const [zones, setZones] = useState<ZoneView[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const { data } = await apiClient.get<Paginated<ZoneView>>("/forum/zones?pageSize=100");
            setZones(data.items);
        } catch {
            setZones([]);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <>
            <PageHeader>
                <Link href="/forum/new" className="btn btn-primary btn-sm">
                    + Yeni Zone
                </Link>
            </PageHeader>
            <div className="main-content">
                <div className="row">
                    <div className="col-12">
                        <div className="card stretch stretch-full">
                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-hover mb-0">
                                        <thead>
                                            <tr>
                                                <th>Tür</th>
                                                <th>Başlık</th>
                                                <th>Slug</th>
                                                <th>Katılım</th>
                                                <th>Sınav</th>
                                                <th>Üye</th>
                                                <th>Oluşturulma</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading && (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-4">Yükleniyor…</td>
                                                </tr>
                                            )}
                                            {!loading && error && (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-4 text-danger">Yüklenemedi.</td>
                                                </tr>
                                            )}
                                            {!loading && !error && zones.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-4 text-muted">
                                                        Henüz zone yok.{" "}
                                                        <Link href="/forum/new">İlkini oluştur →</Link>
                                                    </td>
                                                </tr>
                                            )}
                                            {!loading && zones.map((z) => (
                                                <tr key={z.id}>
                                                    <td>
                                                        <span className="badge bg-soft-primary text-primary">
                                                            {ZONE_TYPE_LABELS[z.type] ?? z.type}
                                                        </span>
                                                    </td>
                                                    <td>{z.title}</td>
                                                    <td><code className="fs-12">{z.slug}</code></td>
                                                    <td>{JOIN_POLICY_LABELS[z.joinPolicy] ?? z.joinPolicy}</td>
                                                    <td>{z.examType ?? <span className="text-muted">—</span>}</td>
                                                    <td>{z.memberCount}</td>
                                                    <td>{new Date(z.createdAt).toLocaleDateString("tr-TR")}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
