import { expect, test, type Page, type Route } from "@playwright/test";
import type { AuthUser } from "@mentor/types";

/**
 * W8 mentorship, in the browser.
 *
 * The student half exists because the feature shipped with no way in: `/kocum` and
 * `/kocluk-daveti` had no entry point anywhere in the app, so a student handed an invite code
 * could not reach the screen that redeems it. That path is the launch gate, and this holds it open.
 */

const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const INVITE_CODE = "MENTOR-KOC-ABCDEF012345";

function makeUser(roles: AuthUser["roles"]): AuthUser {
  return {
    id: STUDENT_ID,
    email: "ogrenci@test.local",
    displayName: "Ayşe Yılmaz",
    username: "ayse",
    avatarUrl: null,
    bio: null,
    website: null,
    roles,
    organizationId: null,
    examType: "KPSS",
    examVariant: "LISANS",
    examDate: "2026-07-26",
    dailyFocusGoalMinutes: null,
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

const DATA_SCOPE = ["ACTIVITY", "MOCK_EXAMS", "PLAN_TASK_TITLES", "MOOD_LEVEL", "EXAM_TRACK"];

interface CoachNote {
  body: string;
  updatedAt: string;
}

const MY_COACH = {
  linkId: "11111111-1111-4111-8111-111111111111",
  coachDisplayName: "Koç Mert",
  coachUsername: "kocmert",
  status: "ACTIVE",
  acceptedAt: "2026-09-01T10:00:00.000Z",
  dataScope: DATA_SCOPE,
  coachNote: null as CoachNote | null,
  coachProfile: null as Record<string, unknown> | null,
};

/**
 * A coach profile as the student receives it: two lines, plus every claim with whether anybody
 * checked it. Both kinds are present on purpose — since APP-089 the screen has to distinguish them,
 * and a fixture carrying only verified claims could not catch a screen that stopped.
 */
const COACH_PROFILE = {
  headline: "KPSS Türkçe koçu",
  bio: "On yıldır KPSS adaylarıyla çalışıyorum.",
  claims: [
    { claim: "INSTITUTION", value: "Ankara Üniversitesi", verified: true },
    { claim: "BRANCH", value: "Türkçe", verified: false },
  ],
};

test.describe("öğrenci tarafı", () => {
  test("profildeki Koçum satırı davet ekranına kadar götürür", async ({ page }) => {
    // The point of the slice: without this row the invite screen is unreachable from anywhere.
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto("/profil");

    await page.getByRole("link", { name: "Koçum" }).click();
    await expect(page).toHaveURL(/\/kocum$/);
    await expect(page.getByText("Henüz bir koçun yok")).toBeVisible();

    await page.getByRole("link", { name: "Koçluk daveti" }).click();
    await expect(page).toHaveURL(/\/kocluk-daveti$/);
    expect(api.acceptCalls).toBe(0);
  });

  test("kod önce veri kapsamını gösterir, kabul ondan sonra gelir", async ({ page }) => {
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto("/kocluk-daveti");

    await page.getByLabel("Davet kodu").fill(INVITE_CODE);
    await page.getByRole("button", { name: "Kodu getir" }).click();

    await expect(page.getByText("Koç Mert", { exact: false }).first()).toBeVisible();
    // KVKK informed consent: the scope list is part of the contract, not decorative copy.
    await expect(page.getByRole("heading", { name: "Koçunun görebildikleri" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Koçunun göremedikleri" })).toBeVisible();
    // Reading a code is not consenting to it.
    expect(api.acceptCalls).toBe(0);

    await page.getByRole("button", { name: "Onaylıyorum, bağlan" }).click();
    await expect.poll(() => api.acceptCalls).toBe(1);
  });

  test("onay ekranı koçun doğrulanmış profilini gösteriyor", async ({ page }) => {
    // The gap this closes: a student used to hand over private data to a NAME and nothing else.
    await mockApi(page, { roles: ["STUDENT"], myCoach: null, coachProfile: COACH_PROFILE });
    await page.goto("/kocluk-daveti");
    await page.getByLabel("Davet kodu").fill(INVITE_CODE);
    await page.getByRole("button", { name: "Kodu getir" }).click();

    await expect(page.getByText("KPSS Türkçe koçu")).toBeVisible();
    // The badge carries the value that was checked. What it MEANS is the group heading above it,
    // not the chip: a chip reading "doğrulandı" under a "henüz doğrulanmadı" heading would say the
    // opposite of the thing it sits under.
    await expect(page.getByText("Doğrulanan bilgiler")).toBeVisible();
    await expect(page.getByText("Kurum: Ankara Üniversitesi")).toBeVisible();

    // And the claim nobody checked is shown as exactly that (APP-089). Registration is self-service
    // now, so silence here would make an unchecked coach look identical to a checked one at the
    // moment a student decides to hand over private data.
    await expect(page.getByText("Koçun kendi beyanı, henüz doğrulanmadı")).toBeVisible();
    await expect(page.getByText("Branş: Türkçe")).toBeVisible();
  });

  test("profili olmayan koç için onay ekranı boş kart değil bunu söylüyor", async ({ page }) => {
    // A coach who holds the role without a registry row, and a suspended one, both look like this.
    await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto("/kocluk-daveti");
    await page.getByLabel("Davet kodu").fill(INVITE_CODE);
    await page.getByRole("button", { name: "Kodu getir" }).click();

    await expect(page.getByText("Bu koç hakkında henüz bir profil yok.")).toBeVisible();
  });

  test("?code= yalnız alanı doldurur, kendiliğinden bağlamaz", async ({ page }) => {
    // Clicking a link somebody sent is not consent, so the query param stops at the input.
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto(`/kocluk-daveti?code=${INVITE_CODE}`);

    await expect(page.getByLabel("Davet kodu")).toHaveValue(INVITE_CODE);
    expect(api.previewCalls).toBe(0);
    expect(api.acceptCalls).toBe(0);
  });

  test("koçun duran notu öğrencinin şeffaflık ekranında görünür", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT"],
      myCoach: {
        ...MY_COACH,
        coachNote: {
          body: "Bu hafta paragrafa ağırlık ver.",
          updatedAt: "2026-09-04T09:00:00.000Z",
        },
      },
    });
    await page.goto("/kocum");

    await expect(page.getByText("Koç Mert")).toBeVisible();
    await expect(page.getByText("Bu hafta paragrafa ağırlık ver.")).toBeVisible();
  });

  test("bayrak kapalıyken hata değil, kapalı durumu gösterir", async ({ page }) => {
    // The profile row shows regardless of the kill switch, so a toast would read as a bug on a
    // screen the student just opened. The switch is a state, not a failure.
    await mockApi(page, { roles: ["STUDENT"], myCoach: null, disabled: true });
    await page.goto("/kocum");

    await expect(page.getByText("Koçluk şu an kapalı")).toBeVisible();
    await expect(page.getByRole("link", { name: "Koçluk daveti" })).toHaveCount(0);
  });
});

test.describe("koç tarafı", () => {
  test("roster hazır davet linkini kopyalatır", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto("/kocluk");

    await expect(page.getByText(INVITE_CODE)).toBeVisible();

    await page.getByRole("button", { name: "Linki kopyala" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // The coach shares a link, not a bare code; the param only prefills the field.
    expect(copied).toContain(`/kocluk-daveti?code=${INVITE_CODE}`);
  });

  test("kokpit kohortu özetler ve öğrenci başına tek öneri verir", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
      roster: [
        rosterRow("Ada", ["PLAN_SLIPPING", "LOW_MOOD"], 0.2),
        rosterRow("Bora", ["INACTIVE"], null),
        rosterRow("Cem", [], 0.8),
      ],
    });
    await page.goto("/kocluk");

    await expect(page.getByText("3 öğrenciden 2 tanesi ilgi bekliyor.")).toBeVisible();
    // The average leaves Bora out: he planned nothing, and counting that as 0% would report a
    // cohort that never opened the plan screen as one that plans and fails.
    await expect(page.getByText("Plan uyumu %50 (2 öğrenci)")).toBeVisible();

    // Severity order, not the order the API happened to evaluate the flags in: the roster row
    // for Ada lists PLAN_SLIPPING first, and the breakdown still puts INACTIVE at the front.
    const chips = page.getByRole("list", { name: "Risk dağılımı" }).getByRole("listitem");
    await expect(chips).toHaveText(["Sessiz · 1", "Morali düşük · 1", "Plan aksıyor · 1"]);

    // One suggestion per student, for their worst flag — LOW_MOOD outranks PLAN_SLIPPING even
    // though the API lists it second.
    await expect(page.getByText("Ona bir not bırak, bu haftanın yükünü hafiflet.")).toBeVisible();
    await expect(page.getByText("Bu haftanın ödevini hafiflet.")).toHaveCount(0);
  });

  test("ilgilendim işareti bekleyen sayacını düşürüyor", async ({ page }) => {
    const api = await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
      roster: [
        rosterRow("Ada", ["PLAN_SLIPPING"], 0.2),
        rosterRow("Bora", ["INACTIVE"], null),
        rosterRow("Cem", [], 0.8),
      ],
    });
    await page.goto("/kocluk");

    await expect(page.getByText("3 öğrenciden 2 tanesi ilgi bekliyor.")).toBeVisible();

    // The button is offered only where there is something to attend to: Cem is calm.
    const marks = page.getByRole("button", { name: "İlgilendim" });
    await expect(marks).toHaveCount(2);
    await marks.first().click();

    // The band stops counting the handled student, and says so in the other half of the sentence.
    await expect(page.getByText("3 öğrenciden 1 tanesi ilgi bekliyor.")).toBeVisible();
    await expect(page.getByText("1 tanesiyle ilgilendin")).toBeVisible();
    await expect.poll(() => api.attentionCalls).toEqual([true]);

    // The flag itself is untouched — the mark quiets the worklist, it does not edit the data.
    const chips = page.getByRole("list", { name: "Risk dağılımı" }).getByRole("listitem");
    await expect(chips).toHaveText(["Sessiz · 1", "Plan aksıyor · 1"]);

    // And it is reversible from the same spot.
    await page.getByRole("button", { name: "İşareti kaldır" }).click();
    await expect(page.getByText("3 öğrenciden 2 tanesi ilgi bekliyor.")).toBeVisible();
    await expect.poll(() => api.attentionCalls).toEqual([true, false]);
  });

  test("koç kaydoluyor ve hesabı anında açılıyor", async ({ page }) => {
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto("/koc-basvurusu");

    await page.getByLabel("Tek cümlede sen").fill("KPSS Türkçe koçu");
    await page
      .getByLabel("Kendini anlat")
      .fill("On yıldır KPSS adaylarıyla çalışıyorum, paragraf ağırlıklı.");
    await page.getByLabel("Kurum").fill("Ankara Üniversitesi");
    await page.getByRole("button", { name: "Koç hesabımı aç" }).click();

    // No waiting room: the account is open, and the coach is handed to the profile they just
    // wrote. Since APP-090 that profile lives on the coach surface, not in the student shell —
    // this screen is only ever for somebody who is not a coach yet.
    await expect(page).toHaveURL(/\/kocluk\/profil$/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Koç hesabımı aç" })).toHaveCount(0);

    // The admin's columns never travel from the client — the API refuses a body carrying them.
    expect(Object.keys(api.application ?? {})).not.toContain("verifiedClaims_sent");
    expect((api.application as { headline: string }).headline).toBe("KPSS Türkçe koçu");
  });

  test("kayıt kapalıyken form hiç gösterilmiyor", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT"], myCoach: null, applicationsClosed: true });
    await page.goto("/koc-basvurusu");

    // The state arrives with the page now. Before APP-089 this was discoverable only by filling the
    // whole form and reading the 403 back, which is not a thing to do to somebody signup sent here.
    await expect(page.getByText("Koç kaydı şu an kapalı")).toBeVisible();
    await expect(page.getByLabel("Tek cümlede sen")).toHaveCount(0);
  });

  test("doğrulanmamış e-posta koça neyin eksik olduğunu söylüyor", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
      emailVerified: false,
      application: {
        id: "app-1",
        status: "ACTIVE",
        headline: "KPSS Türkçe koçu",
        bio: "…",
        institution: null,
        branch: null,
        years: null,
        note: null,
        submittedAt: "2026-09-01T00:00:00.000Z",
        reviewedAt: null,
        reviewNote: null,
        verifiedClaims: [],
      },
    });
    await page.goto("/koc-basvurusu");

    // The one blocker a coach can clear themselves, so it is the one this card names.
    await expect(page.getByText("e-postanı doğrulayınca", { exact: false })).toBeVisible();
  });

  test("durdurulan koç gerekçeyi görüyor ve geri dönüş kapısı bulunmuyor", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT"],
      myCoach: null,
      application: {
        id: "app-1",
        status: "SUSPENDED",
        headline: "Durdurulan koç",
        bio: "…",
        institution: null,
        branch: null,
        years: null,
        note: null,
        submittedAt: "2026-08-01T00:00:00.000Z",
        reviewedAt: "2026-08-05T00:00:00.000Z",
        reviewNote: "Şikayet üzerine durduruldu.",
        verifiedClaims: [],
      },
    });
    await page.goto("/koc-basvurusu");

    // The admin's words, verbatim. One-way: a decision, not a conversation.
    await expect(page.getByText("Şikayet üzerine durduruldu.")).toBeVisible();
    // No door back, because registering again is refused. A button here would be a dead end.
    await expect(page.getByRole("button", { name: "Koç hesabımı aç" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Koç paneline git" })).toHaveCount(0);
  });

  test("açık koç rozetleri ve panel bağlantısını görüyor", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
      application: {
        id: "app-1",
        status: "ACTIVE",
        headline: "KPSS Türkçe koçu",
        bio: "…",
        institution: "Ankara Üniversitesi",
        branch: "Türkçe",
        years: 10,
        note: null,
        submittedAt: "2026-08-01T00:00:00.000Z",
        reviewedAt: "2026-08-05T00:00:00.000Z",
        reviewNote: null,
        verifiedClaims: ["INSTITUTION", "BRANCH"],
      },
    });
    await page.goto("/koc-basvurusu");

    // The badge says what was CHECKED, never "this coach is good".
    await expect(page.getByText("Kurum doğrulandı")).toBeVisible();
    await expect(page.getByText("Branş doğrulandı")).toBeVisible();
    await expect(page.getByRole("link", { name: "Koç paneline git" })).toBeVisible();
  });

  test("koç profilini düzenliyor, iletişim bilgisi reddediliyor", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
      application: {
        id: "app-1",
        status: "ACTIVE",
        headline: "KPSS Türkçe koçu",
        bio: "On yıldır KPSS adaylarıyla çalışıyorum.",
        institution: "Ankara Üniversitesi",
        branch: "Türkçe",
        years: 10,
        note: null,
        submittedAt: "2026-08-01T00:00:00.000Z",
        reviewedAt: "2026-08-05T00:00:00.000Z",
        reviewNote: null,
        verifiedClaims: ["INSTITUTION"],
      },
    });
    await page.goto("/koc-basvurusu");

    await page.getByRole("button", { name: "Profili düzenle" }).click();
    // The vetted claims are not in the form: they are what an admin checked, and a coach who could
    // rewrite them would be rewriting somebody else's verification.
    await expect(page.getByLabel("Kurum")).toHaveCount(0);

    await page.getByLabel("Kendini anlat").fill("Bana 0532 123 45 67 numarasından ulaş");
    await page.getByRole("button", { name: "Kaydet" }).click();

    // Refusal, not masking: starring out the digits would leave the coach believing they had
    // written something they had not.
    await expect(page.getByText("iletişim bilgisi paylaşamazsın", { exact: false })).toBeVisible();

    await page.getByLabel("Kendini anlat").fill("Paragraf ağırlıklı çalışıyorum.");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("Paragraf ağırlıklı çalışıyorum.")).toBeVisible();
  });

  test("kontenjan koça görünür ve dolduğunda söylenir", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
      roster: [rosterRow("Ada", [], 0.5), rosterRow("Bora", [], 0.5)],
      maxActiveStudents: 2,
    });
    await page.goto("/kocluk");

    // The quota is enforced on the STUDENT's redemption, so the coach's own screen is the only
    // place they can learn about it before handing the code to someone who will be refused.
    await expect(page.getByText("2/2 öğrenci")).toBeVisible();
    await expect(page.getByText("Kontenjanın dolu.", { exact: false })).toBeVisible();
    // A full roster still empties; rotating is not blocked.
    await expect(page.getByRole("button", { name: "Yeni kod üret" })).toBeEnabled();
  });

  test("koç kendi veri kapsamını okuyabilir", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto("/kocluk");

    // Open by default on an empty roster: the coach's first screen is the one moment they have
    // nothing else to read, and the student saw this same contract before consenting.
    await expect(page.getByText("Günlük mod puanı (1-5)")).toBeVisible();
    await expect(
      page.getByText("Öğrencinin AI koçla konuştukları", { exact: false }),
    ).toBeVisible();
  });

  test("rapor silinen ödevi gösterir, çünkü yaşayan plan gösteremez", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto(`/kocluk/${STUDENT_ID}`);

    await expect(page.getByRole("heading", { name: "Silinen ödevler" })).toBeVisible();
    await expect(page.getByText("Silinecek deneme")).toBeVisible();
  });

  test("geçen haftayı kopyala yalnız koçun kendi satırlarını taslağa alır", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto(`/kocluk/${STUDENT_ID}`);

    const repeat = page.getByRole("button", { name: "Geçen haftayı kopyala" });
    await expect(repeat).toBeEnabled();
    await expect(page.getByText("0/21 görev")).toBeVisible();

    await repeat.click();

    // Two rows sit in last week and exactly one draft comes out: the student's own row is left
    // alone, because lifting it would turn their choice into the coach's assignment. The counter
    // carries the whole claim — asserting on the titles would match the report's plan list too,
    // which renders the same rows further down the page. `repeat-week.spec.ts` covers the
    // filtering itself; what this proves is that the button is wired to it.
    await expect(page.getByText("1/21 görev")).toBeVisible();
  });

  test("şablon kaydı programı gün ofsetine çevirir, tarihe değil", async ({ page }) => {
    const api = await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto(`/kocluk/${STUDENT_ID}`);

    // Compose two tasks on two different days of the shown week.
    await page.getByLabel("Görev", { exact: true }).fill("İlk görev");
    await page.getByRole("button", { name: "Seçili güne ekle" }).click();
    // The day chips, by their group label — matching on the rendered date would tie the test to
    // the browser's own calendar, and matching on the "· N" count only works after a draft exists.
    await page.getByRole("group", { name: "Gün seç" }).getByRole("button").nth(2).click();
    await page.getByLabel("Görev", { exact: true }).fill("İkinci görev");
    await page.getByRole("button", { name: "Seçili güne ekle" }).click();
    await expect(page.getByText("2/21 görev")).toBeVisible();

    await page.getByLabel("Şablon adı").fill("Hafta 1");
    await page.getByRole("button", { name: "Şablon olarak kaydet" }).click();

    await expect.poll(() => api.savedTemplates.length).toBe(1);
    const saved = api.savedTemplates[0]!;
    expect(saved.name).toBe("Hafta 1");
    // The whole point: the program is stored as offsets from its own first day, so it can be
    // re-dated onto any week. A saved date would pin it to the week it was composed in.
    expect(saved.tasks).toEqual([
      expect.objectContaining({ dayIndex: 0, title: "İlk görev" }),
      expect.objectContaining({ dayIndex: 2, title: "İkinci görev" }),
    ]);
    expect(JSON.stringify(saved.tasks)).not.toContain("taskDate");
  });

  test("başka sınav için kaydedilmiş şablonun konuları sessizce taşınmaz", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
      // The report's student sits KPSS; this template was built against YKS.
      templates: [
        {
          id: "tpl-1",
          name: "YKS haftası",
          examType: "YKS",
          updatedAt: "2026-09-01T00:00:00.000Z",
          tasks: [
            {
              dayIndex: 0,
              title: "Paragraf 20 soru",
              subject: "Türkçe",
              topic: "Paragraf",
              coachNote: null,
            },
          ],
        },
      ],
    });
    await page.goto(`/kocluk/${STUDENT_ID}`);

    await page.getByLabel("Şablondan yükle").selectOption({ label: "YKS haftası · 1 görev" });

    await expect(page.getByText("1/21 görev")).toBeVisible();
    // Said out loud, not silently thinned: `topic` is a soft ref into the content taxonomy and the
    // API never checks it against THIS student's exam.
    await expect(
      page.getByText("1 görevin konusu kaldırıldı", { exact: false }),
    ).toBeVisible();
  });

  test("not yazmak öğrenciye giden tek yönlü kaydı gönderir", async ({ page }) => {
    const api = await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto(`/kocluk/${STUDENT_ID}`);

    const field = page.getByRole("textbox", { name: "Öğrenciye notun" });
    await field.fill("Bu hafta paragrafa ağırlık ver.");
    await page.getByRole("button", { name: "Notu kaydet" }).click();

    await expect.poll(() => api.noteBodies).toEqual(["Bu hafta paragrafa ağırlık ver."]);
  });
});

/**
 * One ACTIVE roster row. Metrics carry the numbers the header's cohort band averages; `riskFlags`
 * drives both the flag counts and the per-student suggestion.
 */
function rosterRow(
  name: string,
  riskFlags: string[],
  planCompletionRate7d: number | null,
): Record<string, unknown> {
  return {
    linkId: `link-${name}`,
    studentId: `${name}-id`,
    studentDisplayName: name,
    studentUsername: null,
    status: "ACTIVE",
    acceptedAt: "2026-09-01T00:00:00.000Z",
    endedAt: null,
    riskFlags,
    attendedAt: null,
    // The server derives this; a flagged row starts out waiting, and the mark is what clears it.
    needsAttention: riskFlags.length > 0,
    metrics: {
      lastActiveDate: daysFromToday(-1),
      currentStreak: 2,
      focusMinutes7d: 120,
      sessions7d: 4,
      activeDays7d: 3,
      planCompletionRate7d,
      latestMockNet: 55,
      latestMockAt: daysFromToday(-2),
      moodLevel7dAvg: 4,
    },
  };
}

/** A date offset from today in the browser's own calendar, as `yyyy-mm-dd`. */
function daysFromToday(offset: number): string {
  const now = new Date();
  const shifted = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return new Date(shifted.getTime() - shifted.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

async function mockApi(
  page: Page,
  options: {
    roles: AuthUser["roles"];
    myCoach: typeof MY_COACH | null;
    disabled?: boolean;
    /** ACTIVE roster rows. The header's summary and seat count are both derived from these. */
    roster?: ReturnType<typeof rosterRow>[];
    maxActiveStudents?: number;
    /** The coach's saved programs, as `GET /v1/mentorship/templates` would return them. */
    templates?: Record<string, unknown>[];
    /** An existing registry row, as `GET /v1/mentorship/coach-registration/mine` would carry it. */
    application?: Record<string, unknown> | null;
    /** `mentorship.applications.open` being off — the screen says so before the form is filled. */
    applicationsClosed?: boolean;
    /** Unverified email keeps the invite code shut (APP-089). Defaults to verified. */
    emailVerified?: boolean;
    /** The coach's vetted profile as the student sees it; null = granted the role by hand. */
    coachProfile?: Record<string, unknown> | null;
  },
) {
  const user = makeUser(options.roles);
  let previewCalls = 0;
  let acceptCalls = 0;
  const noteBodies: (string | null)[] = [];
  const attentionCalls: boolean[] = [];
  /** The applicant's own row, or null before they apply. Mutated by the POST below. */
  let application: Record<string, unknown> | null = options.application ?? null;
  const savedTemplates: { name: string; tasks: unknown[] }[] = [];

  const report = {
    studentId: STUDENT_ID,
    studentDisplayName: "Ayşe Yılmaz",
    studentUsername: "ayse",
    acceptedAt: "2026-09-01T10:00:00.000Z",
    studentExamType: "KPSS",
    coachNote: null,
    riskFlags: [],
    attendedAt: null,
    needsAttention: false,
    activity: {
      lastActiveDate: daysFromToday(-1),
      currentStreak: 3,
      longestStreak: 9,
      sessions7d: 4,
      focusMinutes7d: 180,
      activeDays7d: 3,
      sessions28d: 12,
      focusMinutes28d: 640,
      activeDays28d: 11,
    },
    planCompletionRate7d: 0.6,
    mockTrend: [],
    latestMockSubjects: [],
    planTasks: [
      {
        taskDate: daysFromToday(-3),
        title: "Paragraf 20 soru",
        subject: "Türkçe",
        topic: "Paragraf",
        status: "DONE",
        assignedByCoach: true,
        coachNote: "Süre tut",
      },
      {
        taskDate: daysFromToday(-2),
        title: "Kendi çalışmam",
        subject: null,
        topic: null,
        status: "PENDING",
        assignedByCoach: false,
        coachNote: null,
      },
    ],
    droppedAssignments: [
      {
        taskDate: daysFromToday(-4),
        title: "Silinecek deneme",
        droppedAt: "2026-09-03T18:00:00.000Z",
      },
    ],
    moodTrend: [],
  };

  await page.route("http://localhost:3001/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname + url.search;
    const method = request.method();

    if (method === "OPTIONS") return json(route, null, 204);
    if (method === "POST" && path === "/v1/auth/refresh") {
      return json(route, { accessToken: "test-token", expiresIn: 3600, user });
    }
    if (method === "GET" && path === "/v1/users/me") return json(route, user);
    if (method === "GET" && path.startsWith("/v1/notifications?")) {
      return json(route, { items: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }
    if (method === "POST" && path === "/v1/notifications/stream-token") {
      return json(route, { token: "test-stream" });
    }
    if (method === "GET" && path.startsWith("/v1/notifications/stream?")) {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: corsHeaders,
        body: "",
      });
    }

    if (options.disabled && path.startsWith("/v1/mentorship/")) {
      return json(route, { code: "MENTORSHIP_DISABLED", message: "Koçluk kapalı" }, 403);
    }

    if (method === "GET" && path === "/v1/mentorship/my-coach") {
      // Empty 200, not a null body, when there is no coach — same as the API.
      return json(
        route,
        options.myCoach
          ? { ...options.myCoach, coachProfile: options.coachProfile ?? null }
          : options.myCoach,
        options.myCoach ? 200 : 204,
      );
    }
    if (method === "POST" && path === "/v1/mentorship/invitations/preview") {
      previewCalls += 1;
      return json(route, {
        coachDisplayName: "Koç Mert",
        coachUsername: "kocmert",
        dataScope: DATA_SCOPE,
        // Unspecified means "no profile", which is what every hand-granted coach looks like.
        coachProfile: options.coachProfile ?? null,
      });
    }
    if (method === "POST" && path === "/v1/mentorship/invitations/accept") {
      acceptCalls += 1;
      return json(route, MY_COACH);
    }
    // The profile screen gained a Google-linking card that queries on mount. The harness answers
    // unmatched routes with 204, and an empty body breaks it — which would take the whole profile
    // screen down and, with it, the "Koçum" row this suite navigates through.
    if (method === "GET" && path === "/v1/users/me/auth-accounts/google") {
      return json(route, { enabled: false, linked: false, providerEmail: null, canLink: false });
    }
    if (method === "GET" && path === "/v1/mentorship/templates") {
      return json(route, options.templates ?? []);
    }
    if (method === "POST" && path === "/v1/mentorship/templates") {
      const body = request.postDataJSON() as { name: string; tasks: unknown[] };
      savedTemplates.push(body);
      return json(route, { id: "tpl-new", updatedAt: "2026-09-05T00:00:00.000Z", ...body });
    }
    if (method === "DELETE" && path.startsWith("/v1/mentorship/templates/")) {
      return json(route, null, 204);
    }
    if (method === "GET" && path === "/v1/mentorship/overview") {
      return json(route, {
        inviteCode: { code: INVITE_CODE, expiresAt: "2026-09-30T00:00:00.000Z" },
        activeStudents: options.roster?.length ?? 0,
        maxActiveStudents: options.maxActiveStudents ?? 20,
        dataScope: DATA_SCOPE,
      });
    }
    if (method === "GET" && path.startsWith("/v1/mentorship/students?")) {
      const items = path.includes("status=ACTIVE") ? (options.roster ?? []) : [];
      return json(route, { items, total: items.length, page: 1, pageSize: 100 });
    }
    if (method === "GET" && path === `/v1/mentorship/students/${STUDENT_ID}`) {
      return json(route, report);
    }
    if (method === "PUT" && path === `/v1/mentorship/students/${STUDENT_ID}/note`) {
      noteBodies.push((request.postDataJSON() as { body: string | null }).body);
      return json(route, null, 204);
    }
    if (method === "PUT" && /\/v1\/mentorship\/students\/[^/]+\/attention$/.test(path)) {
      attentionCalls.push((request.postDataJSON() as { attended: boolean }).attended);
      return json(route, null, 204);
    }
    // Registration grants COACH, and the screen re-reads the principal before navigating so the
    // coach shell does not greet a brand-new coach with its role guard.
    if (method === "GET" && path === "/v1/users/me") {
      return json(route, { ...user, roles: ["STUDENT", "COACH"] });
    }
    if (method === "GET" && path === "/v1/mentorship/coach-registration/mine") {
      // The envelope, not the row: the form needs to know the intake is open BEFORE it is filled
      // in, and the panel needs the email flag to explain a locked invite code.
      return json(route, {
        registrationOpen: !options.applicationsClosed,
        registration: application,
        emailVerified: options.emailVerified ?? true,
      });
    }
    if (method === "PUT" && path === "/v1/mentorship/coach-registration/mine") {
      const body = request.postDataJSON() as { headline: string; bio: string };
      // Mirrors the API's Tier-1 refusal so the screen can be exercised against it.
      const joined = `${body.headline} ${body.bio}`.replace(/[\s.\-]/g, "");
      if (/\d{10}|@[a-z0-9._]{4,}/i.test(joined)) {
        return json(
          route,
          {
            code: "MENTORSHIP_CONTACT_NOT_ALLOWED",
            message: "Profilinde iletişim bilgisi paylaşamazsın.",
          },
          400,
        );
      }
      application = { ...(application ?? {}), ...body };
      return json(route, application);
    }
    if (method === "POST" && path === "/v1/mentorship/coach-registration") {
      if (options.applicationsClosed) {
        return json(route, { code: "MENTORSHIP_APPLICATIONS_CLOSED", message: "kapalı" }, 403);
      }
      const body = request.postDataJSON() as Record<string, unknown>;
      application = {
        id: "app-1",
        // ACTIVE straight away: nobody approves this, and the API grants COACH off the same call.
        status: "ACTIVE",
        institution: null,
        branch: null,
        years: null,
        note: null,
        submittedAt: new Date().toISOString(),
        reviewedAt: null,
        reviewNote: null,
        verifiedClaims: [],
        ...body,
      };
      return json(route, application, 201);
    }
    if (method === "GET" && path.startsWith("/v1/content/exams/")) {
      return json(route, [
        {
          subjectSlug: "turkce",
          subjectName: "Türkçe",
          slug: "paragraf",
          name: "Paragraf",
          sortOrder: 1,
        },
      ]);
    }

    return json(route, null, 204);
  });

  return {
    get previewCalls() {
      return previewCalls;
    },
    get acceptCalls() {
      return acceptCalls;
    },
    get noteBodies() {
      return noteBodies;
    },
    get attentionCalls() {
      return attentionCalls;
    },
    get application() {
      return application;
    },
    get savedTemplates() {
      return savedTemplates;
    },
  };
}

const corsHeaders = {
  "access-control-allow-origin": "http://localhost:3100",
  "access-control-allow-credentials": "true",
};

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: body == null ? "" : JSON.stringify(body),
  });
}
