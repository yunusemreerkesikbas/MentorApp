'use client';
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { ZoneJoinPolicy, ZoneType } from "@mentor/types";
import apiClient from "@/lib/apiClient";

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
    [ZoneType.ANNOUNCEMENT]: "Duyuru",
    [ZoneType.CHAT]: "Sohbet",
    [ZoneType.QA]: "Soru-Cevap",
};

export const JOIN_POLICY_LABELS: Record<ZoneJoinPolicy, string> = {
    [ZoneJoinPolicy.OPEN]: "Açık (herkese anında)",
    [ZoneJoinPolicy.REQUEST]: "İstek (sahip onaylar)",
};

export default function ZoneForm() {
    const router = useRouter();
    const [f, setF] = useState({
        type: ZoneType.CHAT,
        title: "",
        description: "",
        examType: "",
        emoji: "",
        joinPolicy: ZoneJoinPolicy.OPEN,
    });
    const [busy, setBusy] = useState(false);
    const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
        setF((p) => ({ ...p, [k]: e.target.value }));

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            await apiClient.post("/forum/zones", {
                type: f.type,
                title: f.title.trim(),
                description: f.description.trim() || undefined,
                examType: f.examType.trim() || undefined,
                emoji: f.emoji.trim() || undefined,
                joinPolicy: f.joinPolicy,
            });
            await Swal.fire({ icon: "success", title: "Zone oluşturuldu", timer: 1100, showConfirmButton: false });
            router.push("/forum");
        } catch (err) {
            const message =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Zone oluşturulamadı.";
            Swal.fire({ icon: "error", title: "Hata", text: message });
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} className="card stretch stretch-full">
            <div className="card-body">
                <div className="row g-3">
                    <div className="col-md-3">
                        <label className="form-label">Tür</label>
                        <select className="form-select" value={f.type} onChange={set("type")}>
                            {Object.values(ZoneType).map((t) => (
                                <option key={t} value={t}>{ZONE_TYPE_LABELS[t]}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Katılım Politikası</label>
                        <select className="form-select" value={f.joinPolicy} onChange={set("joinPolicy")}>
                            {Object.values(ZoneJoinPolicy).map((p) => (
                                <option key={p} value={p}>{JOIN_POLICY_LABELS[p]}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <label className="form-label">Sınav Tipi <span className="text-muted">(opsiyonel)</span></label>
                        <input
                            className="form-control"
                            value={f.examType}
                            onChange={set("examType")}
                            placeholder="KPSS"
                            maxLength={32}
                        />
                    </div>
                    <div className="col-md-2">
                        <label className="form-label">Emoji <span className="text-muted">(opsiyonel)</span></label>
                        <input
                            className="form-control"
                            value={f.emoji}
                            onChange={set("emoji")}
                            placeholder="📚"
                            maxLength={8}
                        />
                    </div>
                    <div className="col-12">
                        <label className="form-label">Başlık</label>
                        <input
                            className="form-control"
                            value={f.title}
                            onChange={set("title")}
                            required
                            minLength={2}
                            maxLength={120}
                            placeholder="KPSS Genel Sohbet"
                        />
                    </div>
                    <div className="col-12">
                        <label className="form-label">Açıklama <span className="text-muted">(opsiyonel)</span></label>
                        <textarea
                            className="form-control"
                            rows={3}
                            value={f.description}
                            onChange={set("description")}
                            maxLength={2000}
                            placeholder="Bu zone hakkında kısa bir açıklama…"
                        />
                    </div>
                </div>
                <div className="mt-3 d-flex gap-2">
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? "Oluşturuluyor…" : "Zone Oluştur"}
                    </button>
                    <button type="button" className="btn btn-light" onClick={() => router.push("/forum")}>
                        İptal
                    </button>
                </div>
            </div>
        </form>
    );
}
