"use client";

import { useState } from "react";
import type { AdQuestionReviewView } from "@mentor/types";
import apiClient from "@/lib/apiClient";
import { CommunityQuestionAdReview } from "./CommunityQuestionAdReview";

export function QuestionAdReview() {
    const [input, setInput] = useState("");
    const [questionId, setQuestionId] = useState("");
    const [view, setView] = useState<AdQuestionReviewView | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");

    async function preview() {
        const id = input.trim().replace(/\?.*$/, "").replace(/\/$/, "").split("/").pop();
        setView(null);
        if (!id) { setMessage("Bir soru bağlantısı veya soru kimliği gir."); return; }
        setBusy(true);
        setMessage("");
        try {
            const response = await apiClient.get<AdQuestionReviewView>(`/admin/ads/questions/${encodeURIComponent(id)}`);
            setQuestionId(id);
            setView(response.data);
        } catch { setMessage("Soru yüklenemedi. Yeniden deneyebilirsin."); }
        finally { setBusy(false); }
    }

    async function review(approve: boolean) {
        setBusy(true);
        setMessage("");
        try {
            if (approve) {
                const response = await apiClient.put<AdQuestionReviewView>(`/admin/ads/questions/${questionId}`, {
                    contentRevision: view?.question?.contentRevision,
                });
                setView(response.data);
                setMessage(response.data.approved ? "Bu içerik sürümü onaylandı." : "İçerik değişti. Yeniden önizle ve incele.");
            } else {
                await apiClient.delete(`/admin/ads/questions/${questionId}`);
                setView((current) => current ? { ...current, approval: null, approved: false } : null);
                setMessage("Reklam onayı kaldırıldı.");
            }
        } catch { setMessage("İşlem tamamlanamadı veya içerik değişti. Yeniden önizle ve incele."); setView(null); }
        finally { setBusy(false); }
    }

    return (
        <section className="card" aria-labelledby="question-ad-review-title">
            <div className="card-header"><h2 id="question-ad-review-title" className="card-title">Soru-cevap reklam incelemesi</h2></div>
            <div className="card-body">
                <p>Yalnız herkese açık, cevaplanmış sorular incelenebilir. Soru ve tüm cevapların Google yayıncı politikalarına ve gizlilik koşullarına uygunluğunu kontrol et. İçerik değişince yeniden onay gerekir.</p>
                <form onSubmit={(event) => { event.preventDefault(); void preview(); }} className="d-flex gap-2 mb-3">
                    <label htmlFor="question-ad-input" className="visually-hidden">Soru bağlantısı veya kimliği</label>
                    <input id="question-ad-input" className="form-control" placeholder="Soru bağlantısı veya kimliği" value={input} disabled={busy}
                        onChange={(event) => { setInput(event.target.value); setView(null); setMessage(""); }} />
                    <button className="btn btn-outline-primary" disabled={busy || !input.trim()}>Önizle</button>
                </form>
                <div role="status" aria-live="polite">{busy ? "İşlem sürüyor…" : message}</div>
                {view ? <>
                    <p className="mt-3">{view.approved ? "Güncel içerik sürümü onaylı." : view.approval ? "Önceki onay güncel içerikle eşleşmiyor." : "Reklam onayı yok."}</p>
                    {view.question ? <>
                        <h3 className="fs-5">{view.question.title}</h3>
                        <p style={{ whiteSpace: "pre-wrap" }}>{view.question.body}</p>
                        <h4 className="fs-6">Tüm cevaplar ({view.question.answers.length})</h4>
                        {view.question.answers.map((answer) => <div className="border rounded p-3 mb-2" key={answer.id}>
                            {answer.isAccepted ? <strong>Kabul edilmiş cevap</strong> : null}
                            <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{answer.body}</p>
                        </div>)}
                        {!view.question.examType ? <p>Sınav bağlamı doğrulanamadığı için onay verilemez.</p> : null}
                    </> : <p>Soru herkese açık değil, cevaplanmamış veya topluluk kapalı.</p>}
                    <div className="d-flex flex-wrap gap-2 mt-3">
                        <button type="button" className="btn btn-primary" disabled={busy || view.approved || !view.question?.examType || !view.question.contentRevision}
                            onClick={() => void review(true)}>İçeriği inceledim, reklam için onayla</button>
                        <button type="button" className="btn btn-outline-danger" disabled={busy || !view.approval}
                            onClick={() => void review(false)}>Onayı kaldır</button>
                    </div>
                    <p className="text-muted mt-3 mb-0">Bu onay reklamı tek başına açmaz. Reklam alanı ve Google birim yolu merkezi ayarlardan yönetilir. Onay ve kaldırma işlemleri denetim kaydına yazılır.</p>
                    <CommunityQuestionAdReview key={`${questionId}:${view.question?.contentRevision}:${view.approved}`} questionId={questionId} />
                </> : null}
            </div>
        </section>
    );
}
