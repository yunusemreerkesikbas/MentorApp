"use client";
import { useState } from "react";
import Image from "next/image";
import type { AnnouncementAdPost, AnnouncementAdReviewView } from "@mentor/types";
import apiClient from "@/lib/apiClient";
import { resolveMediaUrl } from "@/lib/media-url";

export function AnnouncementAdReview() {
    const [input, setInput] = useState("");
    const [threadId, setThreadId] = useState("");
    const [view, setView] = useState<AnnouncementAdReviewView | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    async function run(action: "preview" | "approve" | "revoke") {
        const id = action === "preview" ? input.trim().replace(/\?.*$/, "").replace(/\/$/, "").split("/").pop() : threadId;
        if (!id) return;
        setBusy(true); setMessage("");
        try {
            const path = `/admin/ads/announcements/${encodeURIComponent(id)}`;
            if (action === "revoke") {
                await apiClient.delete(path);
                setView((current) => current ? { ...current, approval: null, approved: false } : null);
                setMessage("Duyuru reklam onayı kaldırıldı.");
            } else {
                const response = action === "preview" ? await apiClient.get<AnnouncementAdReviewView>(path)
                    : await apiClient.put<AnnouncementAdReviewView>(path, { contentRevision: view?.snapshot?.contentRevision });
                setThreadId(id); setView(response.data);
                if (action === "approve") setMessage(response.data.approved ? "Bu duyuru görünümü onaylandı." : "Görünüm değişti. Yeniden incele.");
            }
        } catch { setView(null); setMessage("İşlem tamamlanamadı veya görünüm değişti. Yeniden önizle."); }
        finally { setBusy(false); }
    }
    const snapshot = view?.snapshot;
    return <section className="card" aria-labelledby="announcement-ad-review-title">
        <div className="card-header"><h2 id="announcement-ad-review-title" className="card-title">Duyuru reklam incelemesi</h2></div>
        <div className="card-body">
            <p>Yalnız herkese açık duyuru odaları uygundur. Duyuru, görünür yorumlar, tüm yazarlar, görseller ve oda listesini incele. Sohbet, özel oda, anket ve desteklenmeyen medya uygun değildir. Alt yanıtları açmak reklamı kaldırır; aşağıda ilk görünüm incelenir.</p>
            <form className="d-flex gap-2 mb-3" onSubmit={(event) => { event.preventDefault(); void run("preview"); }}>
                <label htmlFor="announcement-ad-input" className="visually-hidden">Duyuru bağlantısı veya kimliği</label>
                <input id="announcement-ad-input" className="form-control" value={input} disabled={busy} placeholder="Duyuru bağlantısı veya kimliği"
                    onChange={(event) => { setInput(event.target.value); setView(null); setMessage(""); }} />
                <button className="btn btn-outline-primary" disabled={busy || !input.trim()}>Önizle</button>
            </form>
            <p role="status">{busy ? "İşlem sürüyor…" : message}</p>
            {view ? <>
                <p>{view.approved ? "Güncel duyuru görünümü onaylı." : "Güncel görünüm için eşleşen onay yok."}</p>
                {snapshot ? <>
                    <p><strong>Oda:</strong> {snapshot.zone.title} ({snapshot.zone.slug}) · {snapshot.examType}</p>
                    {snapshot.thread.title ? <h3 className="fs-5">{snapshot.thread.title}</h3> : null}
                    {snapshot.thread.isPinned ? <p>Sabitlenmiş duyuru</p> : null}
                    <ReviewedPost post={snapshot.thread} />
                    <p>{snapshot.thread.tags.map((tag) => `#${tag.slug} (${tag.name})`).join(" · ")}</p>
                    {snapshot.thread.commenterNames.length ? <p>Görünen katılımcılar: {snapshot.thread.commenterNames.join(", ")}</p> : null}
                    <h3 className="fs-6">Görünür yorumlar ({snapshot.comments.length})</h3>
                    {snapshot.comments.map((comment) => <div key={comment.id} className="border rounded p-3 mb-3">
                        <ReviewedPost post={comment} /><small>Alt yanıt: {comment.replyCount}</small>
                    </div>)}
                    <h3 className="fs-6">Yan menüdeki odalar</h3>
                    <ul>{snapshot.sidebarRooms.map((zone) => <li key={zone.id}>{zone.title} ({zone.slug}) · {zone.type}</li>)}</ul>
                </> : <p>Duyuru mevcut değil veya bu görünüm incelemeye uygun değil. Özel/eksik oda bilgisi veya bilinmeyen sınav bağlamı da reklamı engeller.</p>}
                <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primary" disabled={busy || !snapshot || view.approved} onClick={() => void run("approve")}>Görünümü inceledim, reklam için onayla</button>
                    <button type="button" className="btn btn-outline-danger" disabled={busy || !view.approval} onClick={() => void run("revoke")}>Duyuru onayını kaldır</button>
                </div>
            </> : null}
            <p className="text-muted mt-3">Onay reklamı tek başına açmaz. Alan ve Google birimi merkezi ayarlardan yönetilir. İçerik ve görünen oda listesi değişince yeniden inceleme gerekir.</p>
        </div>
    </section>;
}
function ReviewedPost({ post }: { post: AnnouncementAdPost }) {
    return <div>
        <div className="d-flex align-items-center gap-2 mb-2">
            {post.author.avatarUrl ? <Image unoptimized src={resolveMediaUrl(post.author.avatarUrl)} alt={post.author.name} width={64} height={64} style={{ objectFit: "cover" }} /> : null}
            <strong>{post.author.name} {post.author.username ? `@${post.author.username}` : ""}</strong>
        </div>
        <small>{post.createdAt}{post.editedAt ? ` · Düzenleme: ${post.editedAt}` : ""}</small>
        <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>
        <div className="d-flex flex-wrap gap-3">{post.attachments.map((attachment) => <Image key={attachment.id} unoptimized src={resolveMediaUrl(attachment.url)} alt="İncelenecek ekli görsel"
            width={attachment.width ?? 640} height={attachment.height ?? 480} style={{ maxWidth: "100%", height: "auto", maxHeight: 360, objectFit: "contain" }} />)}</div>
    </div>;
}
