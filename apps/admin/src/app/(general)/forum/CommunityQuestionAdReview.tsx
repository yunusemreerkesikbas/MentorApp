"use client";

import { useState } from "react";
import Image from "next/image";
import type { Attachment, CommunityQuestionAdAuthor, CommunityQuestionAdReviewView } from "@mentor/types";
import apiClient from "@/lib/apiClient";
import { resolveMediaUrl } from "@/lib/media-url";

export function CommunityQuestionAdReview({ questionId }: { questionId: string }) {
    const [view, setView] = useState<CommunityQuestionAdReviewView | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const path = `/admin/ads/questions/${questionId}/community`;

    async function run(action: "preview" | "approve" | "revoke") {
        setBusy(true); setMessage("");
        try {
            if (action === "revoke") {
                await apiClient.delete(path);
                setView((current) => current ? { ...current, approval: null, approved: false } : null);
                setMessage("Topluluk görünümü onayı kaldırıldı. Herkese açık metin onayı korunuyor.");
            } else {
                const response = action === "preview" ? await apiClient.get<CommunityQuestionAdReviewView>(path)
                    : await apiClient.put<CommunityQuestionAdReviewView>(path, { contentRevision: view?.snapshot?.contentRevision });
                setView(response.data);
                if (action === "approve") setMessage(response.data.approved ? "Bu Topluluk görünümü onaylandı." : "Görünüm değişti. Yeniden önizleyip inceleyebilirsin.");
            }
        } catch { setView(null); setMessage("İşlem tamamlanamadı veya görünüm değişti. Yeniden önizleyebilirsin."); }
        finally { setBusy(false); }
    }
    const snapshot = view?.snapshot;
    return <section className="border-top pt-4 mt-4" aria-labelledby="community-ad-review-title">
        <h3 id="community-ad-review-title" className="fs-5">Topluluk soru görünümü için ayrı onay</h3>
        <p>Önce yukarıdaki herkese açık metni onayla. Ardından bu görünümdeki tüm yazarları, görselleri ve yan panel sorularını incele. Farklı okuyucuların önerileri farklı olabilir; onay yalnız tam eşleşen görünümde geçerlidir.</p>
        <button type="button" className="btn btn-outline-primary mb-3" disabled={busy} onClick={() => void run("preview")}>Topluluk görünümünü önizle</button>
        <p role="status">{busy ? "İşlem sürüyor…" : message}</p>
        {view ? <>
            {!snapshot ? <p>Bu görünüm reklam incelemesine uygun değil. Özel içerik, desteklenmeyen medya veya yüklenemeyen yan panel bulunabilir.</p> : <>
                <p>{view.approved ? "Güncel görünüm onaylı." : "Güncel görünüm için eşleşen onay yok."}</p>
                {!view.publicApproved ? <p>Önce güncel herkese açık metin onayı gerekiyor.</p> : null}
                <p><strong>Oda:</strong> {snapshot.zone.title} ({snapshot.zone.slug})</p>
                <h4 className="fs-6">{snapshot.question.title}</h4>
                <ReviewedAuthor author={snapshot.question.author} />
                <p style={{ whiteSpace: "pre-wrap" }}>{snapshot.question.body}</p>
                <p>{snapshot.question.tags.map((tag) => `#${tag}`).join(" ")}</p>
                <ReviewedImages attachments={snapshot.question.attachments} />
                <h4 className="fs-6">Cevaplar ({snapshot.answers.length})</h4>
                {snapshot.answers.map((answer) => <div key={answer.id} className="border rounded p-3 mb-3">
                    <ReviewedAuthor author={answer.author} />
                    {answer.isAccepted ? <strong>Kabul edilmiş cevap</strong> : null}
                    <p style={{ whiteSpace: "pre-wrap" }}>{answer.body}</p>
                    <ReviewedImages attachments={answer.attachments} />
                </div>)}
                <h4 className="fs-6">Yan paneldeki diğer sorular</h4>
                {snapshot.waitingQuestions.length === 0 ? <p>Ek soru gösterilmiyor.</p> : <ul>
                    {snapshot.waitingQuestions.map((item) => <li key={item.id}><strong>{item.title}</strong> · {item.authorName} · {item.zoneTitle} ({item.zoneSlug}) · {item.createdAt}</li>)}
                </ul>}
            </>}
            <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" disabled={busy || !snapshot || !view.publicApproved || view.approved} onClick={() => void run("approve")}>Bu görünümün tamamını inceledim, onayla</button>
                <button type="button" className="btn btn-outline-danger" disabled={busy || !view.approval} onClick={() => void run("revoke")}>Yalnız Topluluk onayını kaldır</button>
            </div>
        </> : null}
    </section>;
}

function ReviewedAuthor({ author }: { author: CommunityQuestionAdAuthor }) {
    return <div className="d-flex align-items-center gap-2 my-2">
        {author.avatarUrl ? <Image unoptimized src={resolveMediaUrl(author.avatarUrl)} alt={author.name} width={64} height={64} style={{ objectFit: "cover" }} /> : null}
        <span>{author.name} {author.username ? `@${author.username}` : ""}</span>
    </div>;
}
function ReviewedImages({ attachments }: { attachments: Attachment[] }) {
    return <div className="d-flex flex-wrap gap-3">{attachments.map((attachment) => <Image key={attachment.id} unoptimized
        src={resolveMediaUrl(attachment.url)} alt="İncelenecek ekli görsel" width={attachment.width ?? 640} height={attachment.height ?? 480}
        style={{ maxWidth: "100%", height: "auto", maxHeight: 360, objectFit: "contain" }} />)}</div>;
}
