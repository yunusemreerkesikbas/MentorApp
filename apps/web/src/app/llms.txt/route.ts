import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/forum-public";

/**
 * Machine-readable index for AI search systems and LLM agents (https://llmstxt.org).
 * Summarizes PuhuKoç's product spirit, supported exam families, free vs. premium scope,
 * and canonical public routes without inventing official dates or quotas.
 */
export function GET(): NextResponse {
  const origin = siteUrl();
  const body = [
    "# PuhuKoç",
    "",
    "> KPSS, YKS, LGS, ALES ve DGS’ye hazırlananlar için yapay zekâ destekli sınav yoldaşlığı ve çalışma topluluğu platformu.",
    "",
    "PuhuKoç bir soru bankası veya video ders sitesi değildir; uzun sınav hazırlık yolculuğunda yalnızlığı ve motivasyon kaybını bitiren bir yoldaşlık platformudur. Yapay zekâ koç Puhu, haftalık çalışma planı, odak seansı (Pomodoro / kronometre), yanlış defteri (2/7/21 gün aralıklı tekrar), sanal çalışma masası, topluluk soru-cevap forumu ve insan koç panelini tek çatıda birleştirir.",
    "",
    "## Desteklenen Sınav Aileleri",
    "- KPSS (Kamu Personel Seçme Sınavı: Lisans, Ön Lisans, Ortaöğretim)",
    "- YKS (Yükseköğretim Kurumları Sınavı: TYT, AYT, YDT)",
    "- LGS (Liselere Geçiş Sistemi / 8. Sınıf)",
    "- ALES (Akademik Personel ve Lisansüstü Eğitimi Giriş Sınavı)",
    "- DGS (Dikey Geçiş Sınavı)",
    "",
    "## Ücretsiz ve Premium Kapsamı",
    "- **Ücretsiz (0 TRY):** Haftalık ve günlük çalışma planı, online Pomodoro ve odak seansı (25/5, 50/10, özel süre, kronometre, kütüphane/kafe/ev ortam sesleri), arkadaşlarla ortak çalışma masası, yanlış defteri, deneme net kaydı, topluluk forumu, XP/Coin görevleri ve resmi kaynaklı sınav rehberleri.",
    "- **Premium:** Puhu (yapay zekâ koçun) ile birebir sohbet, Puhu’yla akıllı haftalık plan uyarlama, seans ve duygu durumu yansımaları, haftalık derin analiz / haftanın hikâyesi, sınırsız özel defter ve reklamsız deneyim.",
    "- **Koçlar İçin (`/koclar`):** İnsan sınav koçları ve rehber öğretmenler için 3 öğrenciye kadar ücretsiz öğrenci takip koltuğu, sabah turu sinyal paneli ve haftalık raporlama.",
    "",
    "## Ana Sayfalar ve Ücretsiz Araçlar",
    `- [Ana Sayfa](${origin}/): PuhuKoç sınav yoldaşlığı platformu genel bakış.`,
    `- [Ücretsiz Online Pomodoro Sayaç](${origin}/pomodoro-sayac): 25/5 ve 50/10 odak sayacı, kütüphane/kafe/ev sesleri ve sanal çalışma odası.`,
    `- [YKS Çalışma Programı](${origin}/yks-calisma-programi): TYT ve AYT dengeli haftalık ders çalışma programı oluşturucu.`,
    `- [TYT Çalışma Programı](${origin}/tyt-calisma-programi): TYT odaklı günlük ve haftalık çalışma planı.`,
    `- [LGS Çalışma Programı (8. Sınıf)](${origin}/lgs-calisma-programi): 8. sınıf ve LGS için okul temposuna uyumlu haftalık çalışma programı.`,
    `- [Yanlış Defteri Uygulaması](${origin}/yanlis-defteri-uygulamasi): Yanlış yapılan soruları fotoğrafla veya yazarak kaydetme, ders/konu ayrımı ve 2, 7, 21 gün aralıklı tekrar kartları.`,
    `- [Ders Çalışma Uygulaması](${origin}/ders-calisma-uygulamasi): KPSS, YKS, LGS, ALES ve DGS için çalışma planı, odak seansı, yanlış defteri ve çalışma masası genel bakışı.`,
    `- [Koçlar İçin](${origin}/koclar): İnsan sınav koçları için öğrenci takip ve sabah turu paneli.`,
    `- [Doğrulanmış Sınav Rehberleri (Blog)](${origin}/blog): KPSS, YKS, LGS, ALES ve DGS için resmi kaynaklı rehberler ve sınav takvimleri.`,
    `- [Topluluk Soru-Cevap Keşfi](${origin}/topluluk): Öğrencilerin sınav hazırlık soruları ve cevapları.`,
    `- [Site Haritası](${origin}/sitemap.xml): Tüm kanonik sayfalar ve doğrulanmış rehberler.`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
