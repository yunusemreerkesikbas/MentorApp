# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mentorship-weekly-report.spec.ts >> panelde başka haftaya bakmak kartın haftasını değiştirmez
- Location: e2e\mentorship-weekly-report.spec.ts:197:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('dialog', { name: 'Haftalık değerlendirme' })
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByRole('dialog', { name: 'Haftalık değerlendirme' })
    13 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e3]:
    - banner [ref=e4]:
      - link "Profiline git" [ref=e5] [cursor=pointer]:
        - /url: /topluluk/uye/deniz
        - generic [ref=e6]: KD
      - generic [ref=e7]:
        - paragraph [ref=e8]: Günaydın
        - paragraph [ref=e9]:
          - generic [ref=e10]: Koç Deniz
      - generic [ref=e11]:
        - button "Koyu temaya geç" [ref=e14] [cursor=pointer]:
          - img
          - img
        - button "Bildirimler" [ref=e15]:
          - img [ref=e16]
    - navigation "Ana menü" [ref=e19]:
      - generic [ref=e20]:
        - link "Öğrencilerim" [ref=e21] [cursor=pointer]:
          - /url: /kocluk
          - img [ref=e25]
        - link "Plan" [ref=e29] [cursor=pointer]:
          - /url: /plan
          - img [ref=e32]
        - link "Blog" [ref=e34] [cursor=pointer]:
          - /url: /blog
          - img [ref=e37]
        - link "Topluluk" [ref=e39] [cursor=pointer]:
          - /url: /topluluk
          - img [ref=e42]
        - link "Ayarlar" [ref=e47] [cursor=pointer]:
          - /url: /ayarlar
          - img [ref=e50]
    - generic [ref=e53]:
      - main [ref=e54]:
        - generic [ref=e55]:
          - link "Öğrencilerim" [ref=e57] [cursor=pointer]:
            - /url: /kocluk
            - img [ref=e58]
            - text: Öğrencilerim
          - generic [ref=e60]:
            - generic [ref=e61]:
              - generic [ref=e62]: AY
              - generic [ref=e63]:
                - heading "Ayşe Yılmaz" [level=1] [ref=e64]
                - generic [ref=e66]: KPSS · 1 Eylül 2026 tarihinden beri
            - button "Diğer işlemler" [ref=e69] [cursor=pointer]:
              - img [ref=e70]
        - generic [ref=e74]:
          - region "Bu hafta 2 sa çalıştı" [ref=e75]:
            - generic [ref=e76]:
              - img [ref=e79]
              - paragraph [ref=e83]: Ayşe yolunda görünüyor. Haftayı birlikte planlamak için iyi bir an.
            - heading "Bu hafta 2 sa çalıştı" [level=2] [ref=e84]
            - list "Bu hafta, gün gün" [ref=e85]:
              - listitem [ref=e86]:
                - generic [ref=e87]: "21 Eylül Pazartesi: 40 dk çalıştı."
                - generic [ref=e88]: 40 dk
                - generic [ref=e91]:
                  - generic [ref=e92]: Pzt
                  - generic [ref=e93]: "21"
              - listitem [ref=e94]:
                - generic [ref=e95]: "22 Eylül Salı: çalışma yok."
                - generic [ref=e98]:
                  - generic [ref=e99]: Sal
                  - generic [ref=e100]: "22"
              - listitem [ref=e101]:
                - generic [ref=e102]: "23 Eylül Çarşamba: 40 dk çalıştı."
                - generic [ref=e103]: 40 dk
                - generic [ref=e106]:
                  - generic [ref=e107]: Çar
                  - generic [ref=e108]: "23"
              - listitem [ref=e109]:
                - generic [ref=e110]: "24 Eylül Perşembe: çalışma yok."
                - generic [ref=e113]:
                  - generic [ref=e114]: Per
                  - generic [ref=e115]: "24"
              - listitem [ref=e116]:
                - generic [ref=e117]: "25 Eylül Cuma: 40 dk çalıştı."
                - generic [ref=e118]: 40 dk
                - generic [ref=e121]:
                  - generic [ref=e122]: Cum
                  - generic [ref=e123]: "25"
              - listitem [ref=e124]:
                - generic [ref=e125]: "26 Eylül Cumartesi: çalışma yok."
                - generic [ref=e128]: Bugün
              - listitem [ref=e129]:
                - generic [ref=e130]: "27 Eylül Pazar: henüz gelmedi."
                - generic [ref=e133]:
                  - generic [ref=e134]: Paz
                  - generic [ref=e135]: "27"
            - paragraph [ref=e137]: Bu hafta için verdiğin bir görev yok.
            - generic [ref=e138]:
              - button "Haftayı planla" [ref=e139] [cursor=pointer]:
                - img [ref=e140]
                - text: Haftayı planla
              - button "Not bırak" [ref=e142] [cursor=pointer]:
                - img [ref=e143]
                - text: Not bırak
          - region "Notun" [ref=e145]:
            - heading "Notun" [level=2] [ref=e147]
            - generic [ref=e148]:
              - paragraph [ref=e149]: Henüz not bırakmadın. İlk günlerde kısa bir not çok iş görür.
              - button "Not yaz" [ref=e150] [cursor=pointer]:
                - img [ref=e151]
                - text: Not yaz
          - region "Haftalık değerlendirme" [ref=e153]:
            - generic [ref=e154]:
              - heading "Haftalık değerlendirme" [level=2] [ref=e155]
              - generic [ref=e156]: Taslak
            - paragraph [ref=e157]: 31 Ağustos – 6 Eylül haftası hazır. Değerlendirmeni yaz, PDF'i Ayşe'ye sen ilet.
            - button "Değerlendirmeyi aç" [ref=e159] [cursor=pointer]:
              - img [ref=e160]
              - text: Değerlendirmeyi aç
          - region "Çalışma ritmi" [ref=e163]:
            - generic [ref=e164]:
              - heading "Çalışma ritmi" [level=2] [ref=e165]
              - generic [ref=e166]: Son 4 hafta
            - generic [ref=e167]:
              - generic [ref=e168]:
                - generic [ref=e169]:
                  - generic [ref=e170]: Pzt
                  - generic [ref=e171]: Sal
                  - generic [ref=e172]: Çar
                  - generic [ref=e173]: Per
                  - generic [ref=e174]: Cum
                  - generic [ref=e175]: Cmt
                  - generic [ref=e176]: Paz
                - img "Son 4 haftada 13 aktif gün, toplam 8 sa 40 dk" [ref=e177]:
                  - 'generic "31 Ağu Pzt: 0 dk" [ref=e178]'
                  - 'generic "1 Eyl Sal: 40 dk" [ref=e179]'
                  - 'generic "2 Eyl Çar: 0 dk" [ref=e180]'
                  - 'generic "3 Eyl Per: 40 dk" [ref=e181]'
                  - 'generic "4 Eyl Cum: 0 dk" [ref=e182]'
                  - 'generic "5 Eyl Cmt: 40 dk" [ref=e183]'
                  - 'generic "6 Eyl Paz: 0 dk" [ref=e184]'
                  - 'generic "7 Eyl Pzt: 40 dk" [ref=e185]'
                  - 'generic "8 Eyl Sal: 0 dk" [ref=e186]'
                  - 'generic "9 Eyl Çar: 40 dk" [ref=e187]'
                  - 'generic "10 Eyl Per: 0 dk" [ref=e188]'
                  - 'generic "11 Eyl Cum: 40 dk" [ref=e189]'
                  - 'generic "12 Eyl Cmt: 0 dk" [ref=e190]'
                  - 'generic "13 Eyl Paz: 40 dk" [ref=e191]'
                  - 'generic "14 Eyl Pzt: 0 dk" [ref=e192]'
                  - 'generic "15 Eyl Sal: 40 dk" [ref=e193]'
                  - 'generic "16 Eyl Çar: 0 dk" [ref=e194]'
                  - 'generic "17 Eyl Per: 40 dk" [ref=e195]'
                  - 'generic "18 Eyl Cum: 0 dk" [ref=e196]'
                  - 'generic "19 Eyl Cmt: 40 dk" [ref=e197]'
                  - 'generic "20 Eyl Paz: 0 dk" [ref=e198]'
                  - 'generic "21 Eyl Pzt: 40 dk" [ref=e199]'
                  - 'generic "22 Eyl Sal: 0 dk" [ref=e200]'
                  - 'generic "23 Eyl Çar: 40 dk" [ref=e201]'
                  - 'generic "24 Eyl Per: 0 dk" [ref=e202]'
                  - 'generic "25 Eyl Cum: 40 dk" [ref=e203]'
                  - 'generic "26 Eyl Cmt: 0 dk" [ref=e204]'
              - generic [ref=e206]:
                - generic [ref=e207]:
                  - generic [ref=e208]: 8 sa 40 dk
                  - generic [ref=e209]: 4 haftada kayıtlı çalışma, 13 aktif gün
                - generic [ref=e210]:
                  - img [ref=e212]
                  - generic [ref=e214]:
                    - generic [ref=e215]: 3 gün seri
                    - generic [ref=e216]: en uzun 9 gün
            - paragraph [ref=e217]:
              - generic [ref=e218]: Çalışma yok
              - generic [ref=e220]: 1–29 dk
              - generic [ref=e222]: 30–89 dk
              - generic [ref=e224]: 90+ dk
              - generic [ref=e226]: henüz gelmedi
          - region "Denemeler" [ref=e228]:
            - heading "Denemeler" [level=2] [ref=e229]
            - paragraph [ref=e230]: Henüz deneme yok. Ayşe deneme ekledikçe netleri burada çizilir.
          - region "Plan" [ref=e231]:
            - heading "Plan" [level=2] [ref=e233]
            - paragraph [ref=e234]: Son iki haftada ve ileride görev yok. Haftayı sen planlayabilirsin.
          - region "Ruh hali" [ref=e235]:
            - generic [ref=e236]:
              - heading "Ruh hali" [level=2] [ref=e237]
              - generic [ref=e238]: Son 14 gün
            - paragraph [ref=e239]: Son iki haftada mod kaydı yok.
      - generic [ref=e240]:
        - button [ref=e241]
        - dialog "Haftalık değerlendirme" [ref=e242]:
          - generic [ref=e245]:
            - generic [ref=e246]:
              - generic [ref=e247]:
                - heading "Haftalık değerlendirme" [level=2] [ref=e248]
                - paragraph [ref=e249]: Ayşe Yılmaz · 24 Ağustos – 6 Eylül
              - button "Kapat" [ref=e250] [cursor=pointer]:
                - img [ref=e251]
            - generic [ref=e255]:
              - generic [ref=e256]:
                - button "Önceki hafta" [ref=e257] [cursor=pointer]:
                  - img [ref=e258]
                  - text: Önceki hafta
                - generic [ref=e260]: Taslak
                - button "Sonraki hafta" [ref=e261] [cursor=pointer]:
                  - text: Sonraki hafta
                  - img [ref=e262]
              - generic [ref=e264]:
                - table [ref=e266]:
                  - rowgroup [ref=e271]:
                    - row "Bu hafta ve önceki 24 Ağu – 6 Eyl 24 – 30 Ağu" [ref=e272]:
                      - columnheader "Bu hafta ve önceki" [ref=e273]
                      - columnheader "24 Ağu – 6 Eyl" [ref=e274]
                      - columnheader "24 – 30 Ağu" [ref=e275]
                  - rowgroup [ref=e276]:
                    - row "Kayıtlı çalışma 3 sa 2 sa" [ref=e277]:
                      - rowheader "Kayıtlı çalışma" [ref=e278]
                      - cell "3 sa" [ref=e279]
                      - cell "2 sa" [ref=e280]
                    - row "Aktif gün 4 3" [ref=e281]:
                      - rowheader "Aktif gün" [ref=e282]
                      - cell "4" [ref=e283]
                      - cell "3" [ref=e284]
                    - row "Tamamlanan görev 4/6 0/0" [ref=e285]:
                      - rowheader "Tamamlanan görev" [ref=e286]
                      - cell "4/6" [ref=e287]
                      - cell "0/0" [ref=e288]
                - table [ref=e290]:
                  - rowgroup [ref=e295]:
                    - row "Derslere göre 24 Ağu – 6 Eyl 24 – 30 Ağu" [ref=e296]:
                      - columnheader "Derslere göre" [ref=e297]
                      - columnheader "24 Ağu – 6 Eyl" [ref=e298]
                      - columnheader "24 – 30 Ağu" [ref=e299]
                  - rowgroup [ref=e300]:
                    - row "Türkçe 120 dk 60 dk" [ref=e301]:
                      - rowheader "Türkçe" [ref=e302]
                      - cell "120 dk" [ref=e303]
                      - cell "60 dk" [ref=e304]
                - generic [ref=e305]:
                  - table [ref=e307]:
                    - rowgroup [ref=e312]:
                      - row "Deneme · KPSS Lisans 24 Ağu – 6 Eyl 24 – 30 Ağu" [ref=e313]:
                        - columnheader "Deneme · KPSS Lisans" [ref=e314]
                        - columnheader "24 Ağu – 6 Eyl" [ref=e315]
                        - columnheader "24 – 30 Ağu" [ref=e316]
                    - rowgroup [ref=e317]:
                      - row "Ortalama net 61,5 58" [ref=e318]:
                        - rowheader "Ortalama net" [ref=e319]
                        - cell "61,5" [ref=e320]
                        - cell "58" [ref=e321]
                  - paragraph [ref=e322]: Bu hafta 1, önceki hafta 1 deneme. Deneme güçlükleri eşit olmayabilir. Net değişimi tek başına öğrenme sonucu değildir.
              - region "Görüşmeye hazırlan" [ref=e323]:
                - generic [ref=e324]:
                  - generic [ref=e325]:
                    - heading "Görüşmeye hazırlan" [level=3] [ref=e326]
                    - paragraph [ref=e327]: Yalnız sen görürsün. Bir odak, bir soru ve bir sonraki adım.
                  - button "Hazırlık oluştur" [ref=e328] [cursor=pointer]:
                    - img [ref=e329]
                    - text: Hazırlık oluştur
                - button "Odak konusu ekle (isteğe bağlı)" [ref=e332] [cursor=pointer]
              - generic [ref=e334]:
                - generic [ref=e335]: Öğrenciyle paylaşılacak değerlendirme
                - textbox "Öğrenciyle paylaşılacak değerlendirme PDF'te görünür, PDF'i Ayşe'ye sen iletirsin. Özel hazırlık notlarını buraya yazma. 0/1200" [ref=e336]
                - generic [ref=e337]: PDF'te görünür, PDF'i Ayşe'ye sen iletirsin. Özel hazırlık notlarını buraya yazma. 0/1200
              - group [ref=e338]:
                - generic "Sonlandırılmış raporlar (0)" [ref=e339] [cursor=pointer]
            - generic [ref=e340]:
              - button "Vazgeç" [ref=e341] [cursor=pointer]
              - button "Raporu sonlandır" [ref=e342] [cursor=pointer]
```

# Test source

```ts
  110 |   await section.getByRole("button", { name: "Değerlendirmeyi aç" }).click();
  111 |   const panel = page.getByRole("dialog", { name: "Haftalık değerlendirme" });
  112 |   await expect(panel).toBeVisible();
  113 |   // The canvas table: this week against the one before; sessions and plan percentages stay in the PDF.
  114 |   await expect(panel.getByRole("rowheader", { name: "Tamamlanan görev" })).toBeVisible();
  115 |   await expect(panel.getByRole("cell", { name: "3 sa", exact: true })).toBeVisible();
  116 |   await expect(panel.getByText("Seans", { exact: true })).toHaveCount(0);
  117 |   // The subject's name, never its slug.
  118 |   await expect(panel.getByText("Türkçe", { exact: true })).toBeVisible();
  119 |   await expect(panel.getByText("turkce")).toHaveCount(0);
  120 | 
  121 |   await panel.getByRole("button", { name: "Hazırlık oluştur" }).click();
  122 |   await expect(panel.getByText("Kayıtlı çalışma süresi arttı.")).toBeVisible();
  123 |   expect(api.briefCalls).toBe(1);
  124 | 
  125 |   await panel
  126 |     .getByLabel("Öğrenciyle paylaşılacak değerlendirme")
  127 |     .fill("Ritmi birlikte koruyalım.");
  128 |   await panel.getByRole("button", { name: "Raporu sonlandır" }).click();
  129 |   await expect(
  130 |     panel.getByRole("link", { name: "Sonlandırılan raporu aç" }),
  131 |   ).toBeVisible();
  132 |   await expect.poll(() => api.finalizeBodies.length).toBe(1);
  133 |   expect(api.finalizeBodies[0]).toMatchObject({
  134 |     weekStart: "2026-08-31",
  135 |     sourceFingerprint: SOURCE_FINGERPRINT,
  136 |     coachEvaluation: "Ritmi birlikte koruyalım.",
  137 |   });
  138 |   expect(
  139 |     await page.evaluate(
  140 |       () => document.documentElement.scrollWidth <= window.innerWidth,
  141 |     ),
  142 |   ).toBe(true);
  143 | });
  144 | 
  145 | test("görüşme hazırlığı yönlendirmeyi korur, değişikliği belirtir ve haftalar arasında taşımaz", async ({
  146 |   page,
  147 | }) => {
  148 |   const api = await mockWeeklyReportApi(page, { preparation: true });
  149 |   await page.goto(`/kocluk/${STUDENT_ID}`);
  150 |   const open = page.getByRole("button", { name: "Değerlendirmeyi aç" });
  151 |   await open.click();
  152 |   const panel = page.getByRole("dialog", { name: "Haftalık değerlendirme" });
  153 |   // The focus waits behind its link; once written, the panel opens with it showing.
  154 |   await panel.getByRole("button", { name: "Odak konusu ekle (isteğe bağlı)" }).click();
  155 |   const context = panel.getByLabel("Bu görüşmede odaklanmak istediğin konu");
  156 |   await expect(context).toHaveAttribute("maxlength", "500");
  157 |   await context.fill("Program yoğunluğunu konuşacağız.");
  158 |   await page.keyboard.press("Escape");
  159 |   await expect(panel).toHaveCount(0);
  160 |   await open.click();
  161 |   await expect(context).toHaveValue("Program yoğunluğunu konuşacağız.");
  162 |   await panel.getByRole("button", { name: "Hazırlık oluştur" }).click();
  163 |   await expect(
  164 |     panel.getByRole("heading", { name: "Görüşmenin odağı" }),
  165 |   ).toBeVisible();
  166 |   await expect(
  167 |     panel.getByRole("heading", { name: "Olası sonraki adım" }),
  168 |   ).toBeVisible();
  169 |   expect(api.briefBodies[0]).toMatchObject({
  170 |     coachContext: "Program yoğunluğunu konuşacağız.",
  171 |   });
  172 |   await context.fill("Yeni yönlendirme");
  173 |   await expect(panel.getByRole("status")).toContainText(
  174 |     "önceki yönlendirmeye ait",
  175 |   );
  176 |   await panel.getByRole("button", { name: "Hazırlığı güncelle" }).click();
  177 |   await expect(
  178 |     panel.getByText("Bu hazırlıkta kullandığın yönlendirme: Yeni yönlendirme"),
  179 |   ).toBeVisible();
  180 |   await page.reload();
  181 |   await open.click();
  182 |   await expect(context).toHaveValue("Yeni yönlendirme");
  183 |   await panel
  184 |     .getByRole("button", { name: "Önceki hafta", exact: true })
  185 |     .click();
  186 |   await expect(context).toHaveValue("");
  187 |   await expect(
  188 |     panel.getByRole("heading", { name: "Görüşmenin odağı" }),
  189 |   ).toHaveCount(0);
  190 |   expect(
  191 |     await page.evaluate(
  192 |       () => document.documentElement.scrollWidth <= window.innerWidth,
  193 |     ),
  194 |   ).toBe(true);
  195 | });
  196 | 
  197 | test("panelde başka haftaya bakmak kartın haftasını değiştirmez", async ({
  198 |   page,
  199 | }) => {
  200 |   await mockWeeklyReportApi(page);
  201 |   await page.goto(`/kocluk/${STUDENT_ID}`);
  202 |   const section = page.getByRole("region", { name: "Haftalık değerlendirme" });
  203 |   // The latest week, 31 August to 6 September.
  204 |   await expect(section).toContainText("6 Eylül");
  205 |   await section.getByRole("button", { name: "Değerlendirmeyi aç" }).click();
  206 |   const panel = page.getByRole("dialog", { name: "Haftalık değerlendirme" });
  207 |   await panel.getByRole("button", { name: "Önceki hafta", exact: true }).click();
  208 |   await expect(panel).toContainText("24");
  209 |   await page.keyboard.press("Escape");
> 210 |   await expect(panel).toHaveCount(0);
      |                       ^ Error: expect(locator).toHaveCount(expected) failed
  211 |   await expect(section).toContainText("6 Eylül");
  212 |   await expect(section).not.toContainText("24 Ağustos");
  213 | });
  214 | 
  215 | test("yazdırma görünümü yalnız paylaşılabilir sözleşmeyi kullanır", async ({
  216 |   page,
  217 | }) => {
  218 |   const api = await mockWeeklyReportApi(page);
  219 |   await page.goto(
  220 |     `/kocluk/${STUDENT_ID}/haftalik-raporlar/${REPORT_ID}/yazdir`,
  221 |   );
  222 | 
  223 |   await expect(
  224 |     page.getByRole("heading", { name: "Haftalık öğrenci değerlendirmesi" }),
  225 |   ).toBeVisible();
  226 |   await expect(page.getByText("Ritmi birlikte koruyalım.")).toBeVisible();
  227 |   await expect(page.getByText("Hazırlayan: Koç Deniz")).toBeVisible();
  228 |   await expect(page.getByText("Türkçe", { exact: true })).toBeVisible();
  229 |   await expect(page.getByText("turkce")).toHaveCount(0);
  230 |   await expect(page.getByRole("button", { name: "PDF indir" })).toBeVisible();
  231 |   await expect(page.getByRole("button", { name: "Yazdır" })).toBeVisible();
  232 |   await expect(page.getByText("ÖZEL AI NOTU")).toHaveCount(0);
  233 |   expect(
  234 |     api.requestedPaths.some((path) => path.endsWith(`/${REPORT_ID}/share`)),
  235 |   ).toBe(true);
  236 |   expect(
  237 |     api.requestedPaths.some((path) => path.endsWith(`/${REPORT_ID}`)),
  238 |   ).toBe(false);
  239 | 
  240 |   const downloadPromise = page.waitForEvent("download");
  241 |   await page.getByRole("button", { name: "PDF indir" }).click();
  242 |   const download = await downloadPromise;
  243 |   expect(download.suggestedFilename()).toBe(
  244 |     "ayse-yilmaz-haftalik-degerlendirme-2026-08-31.pdf",
  245 |   );
  246 | 
  247 |   await page.emulateMedia({ media: "print" });
  248 |   await expect(page.locator(".weekly-report-print-toolbar")).toHaveCSS(
  249 |     "display",
  250 |     "none",
  251 |   );
  252 | });
  253 | 
  254 | test("detay raporu başarısız olduğunda isteği sonsuz tekrarlamaz", async ({
  255 |   page,
  256 | }) => {
  257 |   const api = await mockWeeklyReportApi(page, { failStudentReport: true });
  258 | 
  259 |   await page.goto(`/kocluk/${STUDENT_ID}`);
  260 |   // Said in place, with one way to ask again; never a loop of requests.
  261 |   await expect(
  262 |     page.getByRole("alert").filter({ hasText: "Öğrencinin raporu açılamadı." }),
  263 |   ).toBeVisible();
  264 |   await expect.poll(() => api.studentReportCalls).toBeGreaterThan(0);
  265 |   await page.waitForTimeout(500);
  266 |   const settledCalls = api.studentReportCalls;
  267 |   expect(settledCalls).toBeLessThanOrEqual(2);
  268 |   await page.waitForTimeout(1_000);
  269 |   expect(api.studentReportCalls).toBe(settledCalls);
  270 | });
  271 | 
  272 | test("haftalık rapor başarısız olduğunda isteği sonsuz tekrarlamaz", async ({
  273 |   page,
  274 | }) => {
  275 |   const api = await mockWeeklyReportApi(page, { failWeeklyPreview: true });
  276 | 
  277 |   await page.goto(`/kocluk/${STUDENT_ID}`);
  278 |   await expect(page.getByText("Ayşe Yılmaz").first()).toBeVisible();
  279 |   // Said in the card, with its retry; no toast on top of it.
  280 |   await expect(
  281 |     page
  282 |       .getByRole("region", { name: "Haftalık değerlendirme" })
  283 |       .getByText("Haftalık değerlendirme açılamadı."),
  284 |   ).toBeVisible();
  285 |   await expect(page.getByText("Bir sorun oluştu")).toHaveCount(0);
  286 |   await expect.poll(() => api.weeklyPreviewCalls).toBeGreaterThan(0);
  287 |   await page.waitForTimeout(500);
  288 |   const settledCalls = api.weeklyPreviewCalls;
  289 |   expect(settledCalls).toBeLessThanOrEqual(2);
  290 |   await page.waitForTimeout(1_000);
  291 |   expect(api.weeklyPreviewCalls).toBe(settledCalls);
  292 | });
  293 | 
  294 | async function mockWeeklyReportApi(
  295 |   page: Page,
  296 |   options: {
  297 |     failStudentReport?: boolean;
  298 |     failWeeklyPreview?: boolean;
  299 |     preparation?: boolean;
  300 |   } = {},
  301 | ) {
  302 |   const user: AuthUser = {
  303 |     id: COACH_ID,
  304 |     email: "koc@test.local",
  305 |     displayName: "Koç Deniz",
  306 |     username: "deniz",
  307 |     avatarUrl: null,
  308 |     bio: null,
  309 |     website: null,
  310 |     roles: ["COACH"],
```