# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: knowledge.spec.ts >> anonim ve İngilizce ziyaretçiye lokalize rehberlik sunar
- Location: e2e\knowledge.spec.ts:197:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('link', { name: 'Add to calendar' })
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for getByRole('link', { name: 'Add to calendar' })
    14 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - navigation [ref=e5]:
          - link "Mentor" [ref=e6] [cursor=pointer]:
            - /url: /en
          - link "Blog" [ref=e7] [cursor=pointer]:
            - /url: /en/blog
        - link "Log in" [ref=e8] [cursor=pointer]:
          - /url: /en/login
    - main [ref=e9]:
      - generic [ref=e10]:
        - article [ref=e11]:
          - navigation "Breadcrumb" [ref=e12]:
            - link "Blog" [ref=e13] [cursor=pointer]:
              - /url: /en/blog
            - img [ref=e14]
            - link "Application" [ref=e16] [cursor=pointer]:
              - /url: /en/blog?category=APPLICATION
          - generic [ref=e17]:
            - heading "KPSS Başvuru Süreci" [level=1] [ref=e18]
            - paragraph [ref=e19]: KPSS başvurusunun temel adımları ve resmî kaynaklara yönlendirme.
            - paragraph [ref=e20]:
              - generic [ref=e21]: Mentor Editor
              - generic [ref=e22]: ·
              - time [ref=e23]: June 1, 2026
              - generic [ref=e24]: ·
              - generic [ref=e25]: 1 min read
          - generic [ref=e26]:
            - img [ref=e27]
            - generic [ref=e30]:
              - paragraph [ref=e31]: Verified content
              - paragraph [ref=e32]:
                - generic [ref=e33]: "Source:"
                - link "ÖSYM" [ref=e34] [cursor=pointer]:
                  - /url: https://www.osym.gov.tr
                  - text: ÖSYM
                  - img [ref=e35]
                - generic [ref=e38]: ·
                - generic [ref=e39]: "Last verified: June 1, 2026"
                - generic [ref=e40]: ·
                - generic [ref=e41]: "Updated: July 18, 2026"
              - paragraph [ref=e42]: We take official dates and processes from the institution's source and update this post if they change.
          - generic [ref=e43]:
            - heading "Başvuru özeti" [level=2] [ref=e44]
            - paragraph [ref=e45]:
              - text: KPSS başvurusu
              - strong [ref=e46]: ÖSYM Aday İşlemleri Sistemi (AİS)
              - text: üzerinden yapılır. Başvuru döneminde adaylar sınav tercihlerini ve kişisel bilgilerini sisteme girer.
            - heading "Temel adımlar" [level=3] [ref=e47]
            - list [ref=e48]:
              - listitem [ref=e49]: ÖSYM AİS hesabına giriş yapın.
              - listitem [ref=e50]: Başvuru formunu eksiksiz doldurun.
              - listitem [ref=e51]: Sınav ücretini yatırın ve başvurunuzu onaylayın.
            - blockquote [ref=e52]:
              - paragraph [ref=e53]:
                - text: Resmî tarihler ve duyurular için
                - link "ÖSYM" [ref=e54] [cursor=pointer]:
                  - /url: https://www.osym.gov.tr
                - text: kaynağını takip edin. Kesin sınav günü için uygulamadaki
                - strong [ref=e55]: Sınav günü
                - text: kartına bakın.
          - complementary "Advertisement" [ref=e57]:
            - generic [ref=e58]: Advertisement
          - region "Want to explore this topic?" [ref=e60]:
            - heading "Want to explore this topic?" [level=2] [ref=e61]
            - paragraph [ref=e63]: If something in this post is on your mind, let's look at it together.
            - generic [ref=e64]:
              - link "Sign in to ask the Coach" [ref=e65] [cursor=pointer]:
                - /url: /en/login
              - paragraph [ref=e66]: Your coach explains using verified sources.
        - complementary "About this post" [ref=e67]:
          - region "Exam day" [ref=e68]:
            - heading "Exam day" [level=2] [ref=e69]
            - generic [ref=e70]:
              - paragraph [ref=e71]: 30 Aralık 2026
              - paragraph [ref=e72]: KPSS Lisans 2026
            - paragraph [ref=e73]:
              - img [ref=e74]
              - text: 96 days to the exam
            - paragraph [ref=e77]:
              - img [ref=e78]
              - generic [ref=e81]:
                - text: "Source:"
                - link "ÖSYM" [ref=e82] [cursor=pointer]:
                  - /url: https://osym.gov.tr
                - text: "· Last verified: August 16, 2026"
            - link "Add to calendar" [ref=e83] [cursor=pointer]:
              - /url: data:text/calendar;charset=utf-8,BEGIN%3AVCALENDAR%0D%0AVERSION%3A2.0%0D%0APRODID%3A-%2F%2FMentor%2F%2FBilgi%20Merkezi%2F%2FEN%0D%0ACALSCALE%3AGREGORIAN%0D%0AMETHOD%3APUBLISH%0D%0AX-WR-CALNAME%3AMentor%20exam%20calendar%0D%0ABEGIN%3AVEVENT%0D%0AUID%3Ab6d32d72-c1c8-4384-9350-a8d54bdcbf5b-EXAM_DATE%40mentor%0D%0ADTSTAMP%3A20260815T225800Z%0D%0ADTSTART%3BVALUE%3DDATE%3A20261230%0D%0ASUMMARY%3AKPSS%20Lisans%202026%20-%20Exam%20day%0D%0ADESCRIPTION%3ASource%3A%20%C3%96SYM%5Cnhttps%3A%2F%2Fosym.gov.tr%5CnLast%20verified%3A%20August%2015%5C%2C%202026%0D%0AURL%3Ahttps%3A%2F%2Fosym.gov.tr%0D%0ASTATUS%3ACONFIRMED%0D%0ATRANSP%3ATRANSPARENT%0D%0AEND%3AVEVENT%0D%0AEND%3AVCALENDAR%0D%0A
              - img [ref=e84]
              - text: Add to calendar
          - region "Related posts" [ref=e86]:
            - heading "Related posts" [level=2] [ref=e87]
            - list [ref=e88]:
              - listitem [ref=e89]:
                - link "KPSS Sınav Günü Kuralları Exam process Jun 1, 2026" [ref=e90] [cursor=pointer]:
                  - /url: /en/blog/kpss-sinav-gunu-kurallari
                  - img [ref=e92]
                  - generic [ref=e96]:
                    - heading "KPSS Sınav Günü Kuralları" [level=3] [ref=e97]
                    - paragraph [ref=e98]:
                      - generic [ref=e99]: Exam process
                      - generic [ref=e100]: ·
                      - time [ref=e101]: Jun 1, 2026
              - listitem [ref=e102]:
                - link "KPSS Sonuç ve Yerleştirme Süreci General Jun 1, 2026" [ref=e103] [cursor=pointer]:
                  - /url: /en/blog/kpss-sonuc-yerlestirme-sureci
                  - img [ref=e105]
                  - generic [ref=e107]:
                    - heading "KPSS Sonuç ve Yerleştirme Süreci" [level=3] [ref=e108]
                    - paragraph [ref=e109]:
                      - generic [ref=e110]: General
                      - generic [ref=e111]: ·
                      - time [ref=e112]: Jun 1, 2026
          - region "Share" [ref=e113]:
            - heading "Share" [level=2] [ref=e114]
            - generic [ref=e115]:
              - link "Share on WhatsApp" [ref=e116] [cursor=pointer]:
                - /url: https://wa.me/?text=KPSS%20Ba%C5%9Fvuru%20S%C3%BCreci%20https%3A%2F%2Fmentor.example%2Fblog%2Fkpss-basvuru-sureci
                - img [ref=e117]
              - link "Share on X" [ref=e119] [cursor=pointer]:
                - /url: https://twitter.com/intent/tweet?text=KPSS%20Ba%C5%9Fvuru%20S%C3%BCreci&url=https%3A%2F%2Fmentor.example%2Fblog%2Fkpss-basvuru-sureci
                - img [ref=e120]
              - link "Share on Facebook" [ref=e122] [cursor=pointer]:
                - /url: https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fmentor.example%2Fblog%2Fkpss-basvuru-sureci
                - img [ref=e123]
              - button "Copy link" [ref=e125] [cursor=pointer]:
                - img [ref=e126]
    - contentinfo [ref=e129]:
      - generic [ref=e130]:
        - heading "Legal" [level=2] [ref=e131]
        - list [ref=e132]:
          - listitem [ref=e133]:
            - link "Personal Data Protection Notice" [ref=e134] [cursor=pointer]:
              - /url: /en/legal/kvkk-aydinlatma
          - listitem [ref=e135]:
            - link "Privacy Policy" [ref=e136] [cursor=pointer]:
              - /url: /en/legal/gizlilik-politikasi
          - listitem [ref=e137]:
            - link "Terms of Use" [ref=e138] [cursor=pointer]:
              - /url: /en/legal/kullanim-kosullari
          - listitem [ref=e139]:
            - link "Distance Sales Agreement" [ref=e140] [cursor=pointer]:
              - /url: /en/legal/mesafeli-satis-sozlesmesi
          - listitem [ref=e141]:
            - link "Pre-Sale Information Form" [ref=e142] [cursor=pointer]:
              - /url: /en/legal/on-bilgilendirme-formu
          - listitem [ref=e143]:
            - link "Refunds and Right of Withdrawal" [ref=e144] [cursor=pointer]:
              - /url: /en/legal/iade-ve-cayma-hakki
          - listitem [ref=e145]:
            - link "Cookie preferences" [ref=e146] [cursor=pointer]:
              - /url: /en/cookie-preferences
  - alert [ref=e147]
  - dialog "Your analytics cookie choice" [ref=e148]:
    - heading "Your analytics cookie choice" [level=2] [ref=e149]
    - paragraph [ref=e150]:
      - text: We measure anonymous usage data only with your permission to improve Mentor.
      - link "View details and preferences" [ref=e151] [cursor=pointer]:
        - /url: /en/cookie-preferences
    - generic [ref=e152]:
      - button "Reject" [ref=e153]
      - button "Accept" [ref=e154]
```

# Test source

```ts
  142 | });
  143 | 
  144 | test("oturumlu ziyaretçi hub'da panel bağlantısı alır", async ({ page }) => {
  145 |   const api = await mockKnowledgeApi(page);
  146 |   await page.goto("/blog");
  147 | 
  148 |   await expect(page.getByRole("link", { name: "Panele dön" })).toHaveAttribute(
  149 |     "href",
  150 |     "/panel",
  151 |   );
  152 |   expect(api.unexpected).toEqual([]);
  153 | });
  154 | 
  155 | test("makaleyi Koç composerına taşır ama otomatik göndermez", async ({
  156 |   page,
  157 | }) => {
  158 |   await page.addInitScript(() =>
  159 |     window.localStorage.setItem("mentor.analytics-consent.v1", "rejected"),
  160 |   );
  161 |   const api = await mockKnowledgeApi(page);
  162 |   await page.goto(`/blog/${article.slug}`);
  163 |   const jsonLd = await page
  164 |     .locator('script[type="application/ld+json"]')
  165 |     .allTextContents();
  166 |   expect(jsonLd.join(" ")).toContain("Article");
  167 |   expect(jsonLd.join(" ")).toContain("BreadcrumbList");
  168 |   expect(jsonLd.join(" ")).toContain('"name":"Blog"');
  169 |   expect(jsonLd.join(" ")).toContain("https://www.osym.gov.tr");
  170 |   await expect(
  171 |     page.getByRole("link", { name: "WhatsApp ile paylaş" }),
  172 |   ).toHaveAttribute("href", /wa\.me/);
  173 |   await expect(page.getByRole("link", { name: "X ile paylaş" })).toBeVisible();
  174 |   await expect(
  175 |     page.getByRole("link", { name: "Facebook ile paylaş" }),
  176 |   ).toBeVisible();
  177 |   await expect(page.getByRole("button", { name: "Bağlantıyı kopyala" })).toBeVisible();
  178 |   await page.getByRole("link", { name: "Koçla konuş" }).click();
  179 | 
  180 |   await expect
  181 |     .poll(() => new URL(page.url()).searchParams.get("contextArticleSlug"))
  182 |     .toBe(article.slug);
  183 | 
  184 |   await expect(
  185 |     page.getByRole("textbox", { name: "Koçuna mesaj yaz" }),
  186 |   ).toHaveValue(
  187 |     '"KPSS Başvuru Süreci" konusunu doğrulanmış kaynaklara dayanarak açıklar mısın?',
  188 |   );
  189 |   expect(
  190 |     api.requests.some(
  191 |       ({ method, path }) => method === "POST" && path === "/v1/coach/chat",
  192 |     ),
  193 |   ).toBe(false);
  194 |   expect(api.unexpected).toEqual([]);
  195 | });
  196 | 
  197 | test("anonim ve İngilizce ziyaretçiye lokalize rehberlik sunar", async ({
  198 |   page,
  199 | }) => {
  200 |   const api = await mockKnowledgeApi(page, { authenticated: false });
  201 |   await page.goto(`/en/blog/${article.slug}`);
  202 | 
  203 |   await expect(page.getByRole("link", { name: "Mentor" })).toBeVisible();
  204 |   await expect(
  205 |     page.getByRole("link", { name: "Sign in to ask the Coach" }),
  206 |   ).toHaveAttribute("href", "/en/login");
  207 |   await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
  208 |     "content",
  209 |     /noindex, follow/i,
  210 |   );
  211 |   await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
  212 |     "href",
  213 |     new RegExp(`/blog/${article.slug}$`),
  214 |   );
  215 |   await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
  216 |     "content",
  217 |     "Mentor",
  218 |   );
  219 |   await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
  220 |     "content",
  221 |     "en_US",
  222 |   );
  223 |   await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute(
  224 |     "content",
  225 |     /^https?:\/\//,
  226 |   );
  227 |   await expect(page.locator('meta[name="twitter:image"]').first()).toHaveAttribute(
  228 |     "content",
  229 |     /^https?:\/\//,
  230 |   );
  231 |   expect(api.unexpected).toEqual([]);
  232 | 
  233 |   const hub = await page.context().newPage();
  234 |   const hubApi = await mockKnowledgeApi(hub);
  235 |   await hub.goto("/en/blog");
  236 |   await expect(hub.getByRole("link", { name: "KPSS", exact: true })).toHaveAttribute(
  237 |     "aria-current",
  238 |     "page",
  239 |   );
  240 |   await expect(hub.getByRole("heading", { name: article.title }).first()).toBeVisible();
  241 |   // The isolated seed's 2026 calendar is now past; a stale event must not offer an ICS download.
> 242 |   await expect(hub.getByRole("link", { name: "Add to calendar" })).toHaveCount(0);
      |                                                                    ^ Error: expect(locator).toHaveCount(expected) failed
  243 |   expect(hubApi.unexpected).toEqual([]);
  244 | });
  245 | 
  246 | test("oturumlu ziyaretçi de public chrome görür ve panel bağlantısı alır", async ({
  247 |   page,
  248 | }) => {
  249 |   const api = await mockKnowledgeApi(page);
  250 | 
  251 |   await page.goto(`/blog/${article.slug}`);
  252 | 
  253 |   await expect(page.getByRole("link", { name: "Mentor" })).toBeVisible();
  254 |   await expect(page.getByRole("link", { name: "Panele dön" })).toHaveAttribute(
  255 |     "href",
  256 |     "/panel",
  257 |   );
  258 |   await expect(page.getByTestId("app-sidebar")).toHaveCount(0);
  259 |   await expect(page.getByRole("link", { name: "Giriş yap" })).toHaveCount(0);
  260 |   expect(api.unexpected).toEqual([]);
  261 | });
  262 | 
  263 | test("refresh oturumu yoksa public header giriş bağlantısını korur", async ({
  264 |   page,
  265 | }) => {
  266 |   const api = await mockKnowledgeApi(page, { authenticated: false });
  267 | 
  268 |   await page.goto(`/en/blog/${article.slug}`);
  269 | 
  270 |   await expect(page.getByRole("link", { name: "Log in" })).toHaveAttribute(
  271 |     "href",
  272 |     "/en/login",
  273 |   );
  274 |   await expect(page.getByRole("link", { name: "Go to dashboard" })).toHaveCount(0);
  275 |   expect(api.unexpected).toEqual([]);
  276 | });
  277 | 
  278 | test("anonim makale reklamı doğrulanmış slug ile limited ayarları display öncesi uygular", async ({
  279 |   page,
  280 | }) => {
  281 |   await page.setViewportSize({ width: 1280, height: 240 });
  282 |   await installDisplayGpt(page, false);
  283 |   const api = await mockKnowledgeApi(page, { authenticated: false });
  284 |   let requestedSlug: string | null = null;
  285 |   await page.route(
  286 |     `${process.env.QA_STAGE2_API_URL?.trim() || "http://localhost:3001/v1"}/ads/public/placements/knowledge.article.end**`,
  287 |     async (route) => {
  288 |       requestedSlug = new URL(route.request().url()).searchParams.get("contentSlug");
  289 |       await json(route, enabledContextualPlacement);
  290 |     },
  291 |   );
  292 | 
  293 |   await page.goto(`/blog/${article.slug}`);
  294 | 
  295 |   await page.waitForTimeout(150);
  296 |   expect(requestedSlug).toBeNull();
  297 |   await page.getByRole("region", { name: "Bu konu kafanı mı kurcalıyor?" }).scrollIntoViewIfNeeded();
  298 |   await expect.poll(() => requestedSlug).toBe(article.slug);
  299 |   await expect(page.getByRole("complementary", { name: "Reklam" })).toBeVisible();
  300 |   const log = await page.evaluate(() =>
  301 |     (window as unknown as { __mentorGptLog: string[] }).__mentorGptLog,
  302 |   );
  303 |   expect(log.indexOf("privacy:limited")).toBeLessThan(log.indexOf("display"));
  304 |   expect(log).toContain("sizes:320x100,728x90");
  305 |   expect(api.unexpected).toEqual([]);
  306 | });
  307 | 
  308 | test("contextual no-fill alanı çöker; Premium kullanıcı GPT indirmez", async ({
  309 |   page,
  310 |   context,
  311 | }) => {
  312 |   await installDisplayGpt(page, true);
  313 |   const api = await mockKnowledgeApi(page, { authenticated: false });
  314 |   await page.route(
  315 |     `${process.env.QA_STAGE2_API_URL?.trim() || "http://localhost:3001/v1"}/ads/public/placements/knowledge.article.end**`,
  316 |     (route) => json(route, enabledContextualPlacement),
  317 |   );
  318 |   await page.goto(`/blog/${article.slug}`);
  319 |   const adSlot = page.locator('aside[aria-label="Reklam"]');
  320 |   await expect
  321 |     .poll(() =>
  322 |       api.requests.some(
  323 |         ({ method, path }) =>
  324 |           method === "POST" && path === "/v1/auth/refresh",
  325 |       ),
  326 |     )
  327 |     .toBe(true);
  328 |   await adSlot.evaluate((element) => element.scrollIntoView({ block: "center" }));
  329 |   await expect(adSlot).toBeHidden();
  330 | 
  331 |   const premiumPage = await context.newPage();
  332 |   let gptRequests = 0;
  333 |   premiumPage.on("request", (request) => {
  334 |     if (request.url().includes("/tag/js/gpt.js")) gptRequests += 1;
  335 |   });
  336 |   await mockKnowledgeApi(premiumPage);
  337 |   await premiumPage.goto(`/blog/${article.slug}`);
  338 |   await premiumPage.waitForTimeout(200);
  339 |   expect(gptRequests).toBe(0);
  340 | });
  341 | 
  342 | const subscription: SubscriptionView = {
```