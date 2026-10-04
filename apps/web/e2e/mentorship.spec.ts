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
const REPORT_ID = "55555555-5555-4555-8555-555555555555";

/** A week the coach finalized, as the student's side of the API returns it (the safe projection). */
const MY_WEEKLY_REPORT = {
  id: REPORT_ID,
  locale: "tr",
  studentDisplayName: "Ayşe Yılmaz",
  coachDisplayName: "Koç Mert",
  period: {
    startDate: "2026-08-31",
    endDate: "2026-09-06",
    previousStartDate: "2026-08-24",
    previousEndDate: "2026-08-30",
    timeZone: "Europe/Istanbul",
  },
  version: 1,
  finalizedAt: "2026-09-07T10:00:00.000Z",
  snapshot: {
    period: {
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      previousStartDate: "2026-08-24",
      previousEndDate: "2026-08-30",
      timeZone: "Europe/Istanbul",
    },
    current: { focusMinutes: 180, sessions: 5, activeDays: 4, plannedTasks: 6, completedTasks: 4, completionRate: 2 / 3, hasRecordedActivity: true },
    previous: { focusMinutes: 120, sessions: 4, activeDays: 3, plannedTasks: 0, completedTasks: 0, completionRate: null, hasRecordedActivity: true },
    deltas: { focusMinutes: 60, sessions: 1, activeDays: 1, plannedTasks: 6, completedTasks: 4, completionRate: null },
    subjects: [],
    mocks: {
      examScopeName: null,
      currentAttemptCount: 0,
      previousAttemptCount: 0,
      currentAverageNet: null,
      previousAverageNet: null,
      currentPublishers: [],
      previousPublishers: [],
      subjects: [],
    },
    limitations: [],
  },
  subjectNames: {},
  coachEvaluation: "Ritmi birlikte koruyalım.",
};

/** The same week with nothing logged in the app: the page must not print a row of zeroes. */
const EMPTY_WEEKLY_REPORT = {
  ...MY_WEEKLY_REPORT,
  snapshot: {
    ...MY_WEEKLY_REPORT.snapshot,
    current: { focusMinutes: 0, sessions: 0, activeDays: 0, plannedTasks: 0, completedTasks: 0, completionRate: null, hasRecordedActivity: false },
    limitations: ["NO_CURRENT_ACTIVITY"],
  },
};

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

const DATA_SCOPE = [
  "ACTIVITY",
  "MOCK_EXAMS",
  "PLAN_TASK_TITLES",
  "MOOD_LEVEL",
  "EXAM_TRACK",
];

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
  studentNote: null as CoachNote | null,
  coachProfile: null as Record<string, unknown> | null,
  seatWaiting: false,
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
  test("profildeki Koçum satırı davet ekranına kadar götürür", async ({
    page,
  }) => {
    // The point of the slice: without this row the invite screen is unreachable from anywhere.
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto("/profil");

    await page.getByRole("link", { name: "Koçum" }).click();
    await expect(page).toHaveURL(/\/kocum$/);
    await expect(page.getByText("Henüz bir koçun yok")).toBeVisible();

    await page.getByRole("link", { name: "Davet kodunu gir" }).click();
    await expect(page).toHaveURL(/\/kocluk-daveti$/);
    expect(api.acceptCalls).toBe(0);
  });

  test("kod önce veri kapsamını gösterir, kabul ondan sonra gelir", async ({
    page,
  }) => {
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto("/kocluk-daveti");

    await page.getByLabel("Davet kodu").fill(INVITE_CODE);
    await page.getByRole("button", { name: "Kodu getir" }).click();

    await expect(
      page.getByText("Koç Mert", { exact: false }).first(),
    ).toBeVisible();
    // KVKK informed consent: the scope list is part of the contract, not decorative copy.
    await expect(page.getByRole("heading", { name: "Koçun görecekleri" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Koçun göremeyecekleri" })).toBeVisible();
    // Reading a code is not consenting to it.
    expect(api.acceptCalls).toBe(0);

    await page.getByRole("button", { name: "Onaylıyorum, bağlan" }).click();
    await expect.poll(() => api.acceptCalls).toBe(1);
  });

  test("onay tek sayfada açılır: kod çipe döner, ekranda her an tek dolu ledge", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto("/kocluk-daveti");

    const ledges = page.locator('[class*="shadow-[0_4px_0_var(--play-cta-edge)]"]:visible');
    await expect(ledges).toHaveCount(1);
    await expect(ledges).toHaveText("Kodu getir");

    await page.getByLabel("Davet kodu").fill(INVITE_CODE);
    await page.getByRole("button", { name: "Kodu getir" }).click();

    // The code folds into a chip and its button leaves; the consent is the one filled ledge.
    await expect(page.getByText("MENTOR-KOC-ABCD…2345")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kodu getir" })).toHaveCount(0);
    await expect(ledges).toHaveCount(1);
    await expect(ledges).toHaveText("Onaylıyorum, bağlan");
    // The button that had focus is gone; focus lands on who is asking, not on the page body.
    await expect(page.getByRole("heading", { name: "Koç Mert", level: 2 })).toBeFocused();

    // "Değiştir" opens the field again with the code still in it, and focus goes back to it.
    await page.getByRole("button", { name: "Değiştir" }).click();
    await expect(page.getByLabel("Davet kodu")).toHaveValue(INVITE_CODE);
    await expect(page.getByLabel("Davet kodu")).toBeFocused();
    await expect(page.getByRole("button", { name: "Onaylıyorum, bağlan" })).toHaveCount(0);
  });

  test("koçunun kendi daveti yeniden açılınca bağlantıyı sonlandırması istenmez", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT"], myCoach: MY_COACH });
    await page.goto(`/kocluk-daveti?code=${INVITE_CODE}`);
    await page.getByRole("button", { name: "Kodu getir" }).click();

    const decision = page.getByRole("region", { name: "Karar" });
    await expect(decision).toContainText("Koç Mert zaten koçun.");
    await expect(decision.getByText(/bağlanmak için önce/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Onaylıyorum, bağlan" })).toHaveCount(0);
  });

  test("geçersiz kod alanın altında söylenir, geçici bir bildirimde değil", async ({ page }) => {
    const message = "Bu davet kodu geçerli değil. Koçundan yeni bir kod isteyebilirsin.";
    await mockApi(page, {
      roles: ["STUDENT"],
      myCoach: null,
      previewError: { status: 404, code: "MENTORSHIP_INVITE_NOT_FOUND", message },
    });
    await page.goto("/kocluk-daveti");

    const field = page.getByLabel("Davet kodu");
    await field.fill("MENTOR-KOC-000000000000");
    await page.getByRole("button", { name: "Kodu getir" }).click();

    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(new RegExp(message));
    await expect(page.getByText("Bir sorun oluştu")).toHaveCount(0);
    // Typing again is a new attempt, so the old verdict goes.
    await field.fill(INVITE_CODE);
    await expect(field).not.toHaveAttribute("aria-invalid", "true");
  });

  test("Koçum, koçun kesinleştirdiği haftayı listeler; rapor koçun değerlendirmesiyle açılır", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT"], myCoach: MY_COACH, weeklyReport: true });
    await page.goto("/kocum");

    const card = page.getByRole("region", { name: "Haftalık değerlendirmelerin" });
    await card.getByRole("link", { name: /31 Ağustos/ }).click();
    await expect(page.getByRole("heading", { name: "Haftalık değerlendirmen" })).toBeVisible();
    // The coach's words come first, under the coach's name, before any number.
    const evaluation = page.getByRole("region", { name: "Koç Mert" });
    await expect(evaluation).toContainText("Koçunun değerlendirmesi");
    await expect(evaluation.getByText("Ritmi birlikte koruyalım.")).toBeVisible();
    // Every drawing carries its sentence for a screen reader.
    await expect(
      page.getByRole("img", { name: "Kayıtlı çalışma: bu hafta 3 sa, önceki hafta 2 sa" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "Aktif gün: bu hafta 4/7, önceki hafta 3/7" })).toBeVisible();
  });

  test("kayıtsız haftada sıfır tablosu yerine Puhu'nun cümlesi çıkar", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT"], myCoach: MY_COACH, weeklyReport: "empty" });
    await page.goto(`/kocum/haftalik-raporlar/${REPORT_ID}`);

    await expect(page.getByRole("region", { name: "Koç Mert" })).toBeVisible();
    await expect(page.getByText("Bu hafta uygulamaya kayıt düşmemiş.", { exact: false })).toBeVisible();
    await expect(page.getByRole("img", { name: /bu hafta/ })).toHaveCount(0);
  });

  test("öğrenci Koçum'dan koçuna tek bir not bırakır, düzenler ve kaldırır", async ({ page }) => {
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: MY_COACH });
    await page.goto("/kocum");

    const card = page.getByRole("region", { name: "Koçuna notun" });
    await card.getByRole("button", { name: "Not yaz" }).click();
    const field = card.getByRole("textbox", { name: "Koçuna notun", exact: true });
    await expect(field).toBeFocused();
    await expect(field).toHaveAccessibleDescription(/Koçun bunu senin raporunda görür/);
    await field.fill("Cuma akşamları çalışamıyorum.");
    await card.getByRole("button", { name: "Notu kaydet" }).click();

    await expect.poll(() => api.myNoteBodies).toEqual(["Cuma akşamları çalışamıyorum."]);
    await expect(card.getByText("Cuma akşamları çalışamıyorum.")).toBeVisible();
    await expect(card.getByRole("textbox")).toHaveCount(0);
    // The editor closed under the keyboard; focus goes to the card, not to the page body.
    await expect(card.getByRole("heading", { name: "Koçuna notun" })).toBeFocused();

    await card.getByRole("button", { name: "Düzenle" }).click();
    await card.getByRole("button", { name: "Notu kaldır" }).click();
    await expect.poll(() => api.myNoteBodies).toEqual(["Cuma akşamları çalışamıyorum.", null]);
    await expect(card.getByRole("button", { name: "Not yaz" })).toBeVisible();
  });

  test("kesinleşmiş hafta yoksa Koçum'da kart çizilmez", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT"], myCoach: MY_COACH });
    await page.goto("/kocum");
    await expect(page.getByRole("heading", { name: "Koçunun gördükleri" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Haftalık değerlendirmelerin" })).toHaveCount(0);
  });

  test("kabulden sonra Koçum bir kez karşılar; yenileyince karşılama tekrar etmez", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto(`/kocluk-daveti?code=${INVITE_CODE}`);
    await page.getByRole("button", { name: "Kodu getir" }).click();
    await page.getByRole("button", { name: "Onaylıyorum, bağlan" }).click();

    await expect(page.getByText("Koç Mert artık koçun.", { exact: false })).toBeVisible();
    // The greeting is spent on arrival: the address bar no longer carries it.
    await expect(page).toHaveURL(/\/kocum$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Koç Mert" })).toBeVisible();
    await expect(page.getByText("artık koçun", { exact: false })).toHaveCount(0);
  });

  test("bağlantıyı sonlandırma onayı yıkıcı: kırmızı ledge, odak Vazgeç'te", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT"], myCoach: MY_COACH });
    await page.goto("/kocum");
    // Under the data it stops, not at the top of the page.
    const trigger = page
      .getByRole("region", { name: "Koçunun gördükleri" })
      .getByRole("button", { name: "Bağlantıyı sonlandır" });
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Koçunla bağlantın sonlansın mı?" });
    const end = dialog.getByRole("button", { name: "Sonlandır" });
    const cancel = dialog.getByRole("button", { name: "Vazgeç" });
    // Solid surface, no glass (overlay kit, 2026-09-28).
    await expect(dialog).toHaveCSS("backdrop-filter", "none");
    // Focus starts on "Vazgeç", so the consequence has to come with the dialog's name.
    await expect(dialog).toHaveAccessibleDescription(/Verilerine erişimi hemen kapanır/);
    // Irreversible: the one filled ledge is danger red, and focus starts on the way out.
    await expect(end).toHaveCSS("background-color", "rgb(180, 35, 24)");
    await expect(cancel).toBeFocused();
    // "Vazgeç" is a text link, not a second ledge.
    await expect(cancel).toHaveCSS("box-shadow", "none");
    // Focus stays in the dialog: Tab from the last action goes round to the first, and back.
    await page.keyboard.press("Tab");
    await expect(end).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(cancel).toBeFocused();
    await cancel.click();
    await expect(dialog).toHaveCount(0);
    // And it returns to the control that opened the dialog.
    await expect(trigger).toBeFocused();
  });

  test("zaten koçu olan öğrenci bunu onay metnini okumadan önce görür", async ({ page }) => {
    const api = await mockApi(page, {
      roles: ["STUDENT"],
      myCoach: MY_COACH,
      previewCoach: { coachDisplayName: "Koç Ayşe", coachUsername: "kocayse" },
    });
    await page.goto(`/kocluk-daveti?code=${INVITE_CODE}`);

    await expect(page.getByText(/Zaten bir koçun var: Koç Mert/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Koçum'a git" })).toBeVisible();
    await page.getByRole("button", { name: "Kodu getir" }).click();
    await expect(page.getByRole("heading", { name: "Koçun görecekleri" })).toBeVisible();
    // A consent they cannot give is not offered; the decision says what comes first instead.
    await expect(page.getByRole("button", { name: "Onaylıyorum, bağlan" })).toHaveCount(0);
    await expect(page.getByText("Koç Ayşe'ye bağlanmak için önce Koçum'dan Koç Mert ile", { exact: false })).toBeVisible();
    expect(api.acceptCalls).toBe(0);
  });

  test("kabulün reddi ekranda kalır, kaybolan bir bildirimde değil", async ({ page }) => {
    const message = "Koçunun koltukları şu an dolu. Koçuna haber ver, yer açılınca yeniden dene.";
    await mockApi(page, {
      roles: ["STUDENT"],
      myCoach: null,
      acceptError: { status: 409, code: "MENTORSHIP_SEATS_FULL", message },
    });
    await page.goto(`/kocluk-daveti?code=${INVITE_CODE}`);
    await page.getByRole("button", { name: "Kodu getir" }).click();
    await page.getByRole("button", { name: "Onaylıyorum, bağlan" }).click();

    // On the page itself, whole, for as long as the screen is open; not a passing "Bir sorun
    // oluştu" toast whose text a phone cut short.
    await expect(page.getByRole("alert").filter({ hasText: message })).toHaveText(message);
    await expect(page.getByText("Bir sorun oluştu")).toHaveCount(0);
  });

  test("onay ekranı koçun doğrulanmış profilini gösteriyor", async ({
    page,
  }) => {
    // The gap this closes: a student used to hand over private data to a NAME and nothing else.
    await mockApi(page, {
      roles: ["STUDENT"],
      myCoach: null,
      coachProfile: COACH_PROFILE,
    });
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
    await expect(
      page.getByText("Koçun kendi beyanı, henüz doğrulanmadı"),
    ).toBeVisible();
    await expect(page.getByText("Branş: Türkçe")).toBeVisible();
  });

  test("profili olmayan koç için onay ekranı boş kart değil bunu söylüyor", async ({
    page,
  }) => {
    // A coach who holds the role without a registry row, and a suspended one, both look like this.
    await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto("/kocluk-daveti");
    await page.getByLabel("Davet kodu").fill(INVITE_CODE);
    await page.getByRole("button", { name: "Kodu getir" }).click();

    await expect(
      page.getByText("Bu koç hakkında henüz bir profil yok."),
    ).toBeVisible();
  });

  test("?code= yalnız alanı doldurur, kendiliğinden bağlamaz", async ({
    page,
  }) => {
    // Clicking a link somebody sent is not consent, so the query param stops at the input.
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto(`/kocluk-daveti?code=${INVITE_CODE}`);

    await expect(page.getByLabel("Davet kodu")).toHaveValue(INVITE_CODE);
    expect(api.previewCalls).toBe(0);
    expect(api.acceptCalls).toBe(0);
  });

  test("koçun duran notu öğrencinin şeffaflık ekranında görünür", async ({
    page,
  }) => {
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
    await expect(
      page.getByText("Bu hafta paragrafa ağırlık ver."),
    ).toBeVisible();
  });

  test("koltuk bekleyen bağda öğrenci durumu kendi ekranında okur", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT"], myCoach: { ...MY_COACH, seatWaiting: true } });
    await page.goto("/kocum");

    await expect(page.getByText("Koç Mert")).toBeVisible();
    await expect(page.getByText("Koçunun koltukları şu an dolu.", { exact: false })).toBeVisible();
  });

  test("bayrak kapalıyken hata değil, kapalı durumu gösterir", async ({
    page,
  }) => {
    // The profile row shows regardless of the kill switch, so a toast would read as a bug on a
    // screen the student just opened. The switch is a state, not a failure.
    await mockApi(page, { roles: ["STUDENT"], myCoach: null, disabled: true });
    await page.goto("/kocum");

    await expect(page.getByText("Koçluk şu an kapalı")).toBeVisible();
    await expect(page.getByRole("link", { name: "Davet kodunu gir" })).toHaveCount(0);
  });
});

test.describe("koç tarafı", () => {
  test("roster hazır davet linkini kopyalatır", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto("/kocluk");

    // Masked at rest: the code is a bearer secret and copying never needed it visible.
    await expect(page.getByText(INVITE_CODE)).toHaveCount(0);
    await expect(page.getByText("MENTOR-KOC-••••••••••••")).toBeVisible();

    // No students yet: the round is the invitation, and copying the link is its one ledge.
    await page.getByRole("button", { name: "Davet linkini kopyala" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // The coach shares a link, not a bare code; the param only prefills the field.
    expect(copied).toContain(`/kocluk-daveti?code=${INVITE_CODE}`);
  });

  test("tur bekleyenleri sayar ve öğrenci başına tek öneri verir", async ({
    page,
  }) => {
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

    // The count lives in one place: the round's title.
    await expect(
      page.getByRole("heading", { name: "2 öğrenci seni bekliyor" }),
    ).toBeVisible();

    // Severity order, not the order the API happened to evaluate the flags in: Ada's row arrives
    // with PLAN_SLIPPING first, and her pills still lead with LOW_MOOD.
    const ada = page.getByTestId("student-row").filter({ hasText: "Ada" });
    const adaText = await ada.innerText();
    expect(adaText.indexOf("Morali düşük")).toBeGreaterThan(-1);
    expect(adaText.indexOf("Morali düşük")).toBeLessThan(adaText.indexOf("Plan aksıyor"));

    // One suggestion per student, for their worst flag: LOW_MOOD outranks PLAN_SLIPPING even
    // though the API lists it second.
    await expect(
      ada.getByText("Ona bir not bırak, bu haftanın yükünü hafiflet."),
    ).toBeVisible();
    await expect(page.getByText("Bu haftanın ödevini hafiflet.")).toHaveCount(
      0,
    );
  });

  test("ilgilendim işareti turu ilerletir ve aynı yerden geri alınır", async ({
    page,
  }) => {
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

    await expect(
      page.getByRole("heading", { name: "2 öğrenci seni bekliyor" }),
    ).toBeVisible();

    // The mark is offered only where there is something to attend to: Cem is calm.
    await expect(page.getByTestId("attention-toggle")).toHaveCount(2);
    const attention = page.getByRole("button", { name: "Ada: ilgilendim", exact: true });
    await expect(attention).toHaveAttribute("aria-pressed", "false");
    await attention.click();

    await expect(
      page.getByRole("heading", { name: "1 öğrenci seni bekliyor" }),
    ).toBeVisible();
    await expect.poll(() => api.attentionCalls).toEqual([true]);
    // The flag itself is untouched: the mark quiets the worklist, it does not edit the data.
    await expect(
      page.getByTestId("student-row").filter({ hasText: "Ada" }).getByText("Plan aksıyor"),
    ).toBeVisible();

    // And it is reversible from the same spot.
    await expect(attention).toHaveAttribute("aria-pressed", "true");
    await attention.click();
    await expect(
      page.getByRole("heading", { name: "2 öğrenci seni bekliyor" }),
    ).toBeVisible();
    await expect.poll(() => api.attentionCalls).toEqual([true, false]);
  });

  test("koç kaydoluyor ve hesabı anında açılıyor", async ({ page }) => {
    const api = await mockApi(page, { roles: ["STUDENT"], myCoach: null });
    await page.goto("/koc-ol");

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
    await expect(
      page.getByRole("button", { name: "Koç hesabımı aç" }),
    ).toHaveCount(0);

    // The admin's columns never travel from the client — the API refuses a body carrying them.
    expect(Object.keys(api.application ?? {})).not.toContain(
      "verifiedClaims_sent",
    );
    expect((api.application as { headline: string }).headline).toBe(
      "KPSS Türkçe koçu",
    );
  });

  test("kayıt kapalıyken form hiç gösterilmiyor", async ({ page }) => {
    await mockApi(page, {
      roles: ["STUDENT"],
      myCoach: null,
      applicationsClosed: true,
    });
    await page.goto("/koc-ol");

    // The state arrives with the page now. Before APP-089 this was discoverable only by filling the
    // whole form and reading the 403 back, which is not a thing to do to somebody signup sent here.
    await expect(page.getByText("Koç kaydı şu an kapalı")).toBeVisible();
    await expect(page.getByLabel("Tek cümlede sen")).toHaveCount(0);
  });

  test("doğrulanmamış e-posta koça neyin eksik olduğunu söylüyor", async ({
    page,
  }) => {
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
    await page.goto("/koc-ol");

    // The one blocker a coach can clear themselves, so it is the one this card names.
    await expect(
      page.getByText("e-postanı doğrulayınca", { exact: false }),
    ).toBeVisible();
  });

  test("durdurulan koç gerekçeyi görüyor ve geri dönüş kapısı bulunmuyor", async ({
    page,
  }) => {
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
    await page.goto("/koc-ol");

    // The admin's words, verbatim. One-way: a decision, not a conversation.
    await expect(page.getByText("Şikayet üzerine durduruldu.")).toBeVisible();
    // No door back, because registering again is refused. A button here would be a dead end.
    await expect(
      page.getByRole("button", { name: "Koç hesabımı aç" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Koç paneline git" }),
    ).toHaveCount(0);
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
    await page.goto("/koc-ol");

    // The badge says what was CHECKED, never "this coach is good".
    await expect(page.getByText("Kurum doğrulandı")).toBeVisible();
    await expect(page.getByText("Branş doğrulandı")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Koç paneline git" }),
    ).toBeVisible();
  });

  test("koç profilini düzenliyor, iletişim bilgisi reddediliyor", async ({
    page,
  }) => {
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
    await page.goto("/koc-ol");

    await page.getByRole("button", { name: "Profili düzenle" }).click();
    // The vetted claims are not in the form: they are what an admin checked, and a coach who could
    // rewrite them would be rewriting somebody else's verification.
    await expect(page.getByLabel("Kurum")).toHaveCount(0);

    await page
      .getByLabel("Kendini anlat")
      .fill("Bana 0532 123 45 67 numarasından ulaş");
    await page.getByRole("button", { name: "Kaydet" }).click();

    // Refusal, not masking: starring out the digits would leave the coach believing they had
    // written something they had not.
    await expect(
      page.getByText("iletişim bilgisi paylaşamazsın", { exact: false }),
    ).toBeVisible();

    await page
      .getByLabel("Kendini anlat")
      .fill("Paragraf ağırlıklı çalışıyorum.");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(
      page.getByText("Paragraf ağırlıklı çalışıyorum."),
    ).toBeVisible();
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
    await expect(page.getByText("koltuk dolu", { exact: false })).toContainText("2/2");
    await expect(page.getByText("2 öğrenci sınırına ulaştın.")).toBeVisible();
    // Full means the next student is refused, so the card stops offering the code to share.
    await expect(page.getByText("MENTOR-KOC-", { exact: false })).toHaveCount(0);
  });

  test("koç kendi veri kapsamını Ayarlar'dan okuyabilir", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });

    // It used to be a permanent accordion on the roster. A consent document is read once when the
    // coach starts and re-read when they wonder, so it lives in settings and opens on demand.
    await page.goto("/kocluk");
    await expect(page.getByText("Günlük mod puanı (1-5)")).toHaveCount(0);

    await page.goto("/ayarlar");
    await page
      .getByRole("button", { name: /Öğrencinde neyi görürsün/ })
      .click();

    const contract = page.getByRole("dialog");
    await expect(contract.getByText("Günlük mod puanı (1-5)")).toBeVisible();
    // The student saw this same contract before consenting, and this is the half a coach must
    // not skim (AGENTS §4 #5).
    await expect(
      contract.getByText("Öğrencinin AI koçla konuştukları", { exact: false }),
    ).toBeVisible();
  });

  test("rapor silinen ödevi gösterir, çünkü yaşayan plan gösteremez", async ({
    page,
  }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto(`/kocluk/${STUDENT_ID}`);

    await expect(
      page.getByRole("heading", { name: "Planından çıkardığı" }),
    ).toBeVisible();
    await expect(page.getByText("Silinecek deneme")).toBeVisible();
  });

  test("haftadan seçilen görev düzenlenir ve panel kapanınca korunur", async ({
    page,
  }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto(`/kocluk/${STUDENT_ID}`);
    await openWeekPlanner(page);
    const panel = page.getByRole("dialog").first();
    await panel
      .getByRole("button", { name: "Sonraki hafta", exact: true })
      .click();
    await panel.getByRole("button", { name: "Önceki görevlerden seç" }).click();
    await panel.getByRole("checkbox").first().check();
    await panel
      .getByRole("button", { name: "Seçilenleri ekle (1)", exact: true })
      .click();
    await panel.getByRole("button", { name: /: düzenle$/ }).click();
    await expect(panel.getByRole("heading", { name: "Görevi düzenle" })).toBeVisible();
    await panel.getByLabel("Görev", { exact: true }).fill("Uyarlanmış görev");
    await page.keyboard.press("Escape");
    await openWeekPlanner(page);
    await expect(panel.getByLabel("Görev", { exact: true })).toHaveValue(
      "Uyarlanmış görev",
    );
    // An edit still in the form holds the send back, so it is never sent half-way.
    await expect(
      panel.getByRole("button", { name: "1 görevi planına ekle" }),
    ).toBeDisabled();
    await panel.getByRole("button", { name: "Değişikliği kaydet" }).click();
    await expect(panel.getByText("Uyarlanmış görev")).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "1 görevi planına ekle" }),
    ).toBeEnabled();
    await panel.getByRole("button", { name: "Önceki görevlerden seç" }).click();
    await expect(panel.getByRole("checkbox").first()).toBeDisabled();
  });

  test("görev formu hep açık, yazılan görev taslağa eklenmeden gönderilmez", async ({
    page,
  }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.goto(`/kocluk/${STUDENT_ID}`);
    await openWeekPlanner(page);
    const panel = page.getByRole("dialog").first();
    await expect(panel.getByRole("heading", { name: "Yeni görev" })).toBeVisible();
    await panel.getByLabel("Görev", { exact: true }).fill("Paragraf: 25 soru");
    await expect(
      panel.getByText("Formdaki görevi önce taslağa ekle ya da temizle."),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Taslağa ekle" }).click();
    await expect(panel.getByText("Bu programda · 1/21")).toBeVisible();
    await expect(panel.getByLabel("Görev", { exact: true })).toHaveValue("");
    await expect(
      panel.getByRole("button", { name: "1 görevi planına ekle" }),
    ).toBeEnabled();
    // The sources are links; earlier tasks open in place.
    const source = panel.getByRole("button", { name: "Önceki görevlerden seç" });
    await expect(source).toHaveAttribute("aria-expanded", "false");
    await source.click();
    await expect(source).toHaveAttribute("aria-expanded", "true");
  });

  test("kapasiteyi aşan seçim kesilmeden gösterilir", async ({ page }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    await page.route("**/planning-tasks?**", async (route) => {
      const from = new URL(route.request().url()).searchParams.get("from")!;
      return json(route, {
        items: Array.from({ length: 22 }, (_, i) => ({
          id: `source-${i}`,
          taskDate: from,
          title: `Görev ${i}`,
          subject: null,
          topic: null,
          coachNote: null,
          assignedByCoach: true,
          status: "PENDING",
        })),
        page: 1,
        pageSize: 100,
        total: 22,
      });
    });
    await page.goto(`/kocluk/${STUDENT_ID}`);
    await openWeekPlanner(page);
    const panel = page.getByRole("dialog").first();
    await panel
      .getByRole("button", { name: "Sonraki hafta", exact: true })
      .click();
    await panel.getByRole("button", { name: "Önceki görevlerden seç" }).click();
    await panel.getByRole("button", { name: "Görünenleri seç" }).click();
    await expect(
      panel.getByRole("button", { name: "Seçilenleri ekle (22)" }),
    ).toBeDisabled();
    await expect(
      panel.getByText("Bir gönderimde en fazla 21 görev olabilir.", {
        exact: false,
      }),
    ).toBeVisible();
    await panel.getByRole("checkbox").first().uncheck();
    await panel.getByRole("button", { name: "Seçilenleri ekle (21)" }).click();
    await expect(
      panel.getByRole("button", { name: "21 görevi planına ekle" }),
    ).toBeEnabled();
  });

  test("iki taslağı düzenleyip tarih değiştirerek tek gönderimde atar", async ({
    page,
  }) => {
    await mockApi(page, { roles: ["STUDENT", "COACH"], myCoach: null });
    const sent: {
      tasks: { title: string; taskDate: string; coachNote: string | null }[];
    }[] = [];
    await page.route("**/planning-tasks?**", async (route) => {
      const from = new URL(route.request().url()).searchParams.get("from")!;
      return json(route, {
        items: ["Birinci", "İkinci"].map((title, i) => ({
          id: `source-${i}`,
          taskDate: from,
          title,
          subject: null,
          topic: null,
          coachNote: null,
          assignedByCoach: true,
          status: i === 0 ? "DONE" : "PENDING",
        })),
        page: 1,
        pageSize: 100,
        total: 2,
      });
    });
    await page.route(`**/students/${STUDENT_ID}/assignments`, async (route) => {
      sent.push(route.request().postDataJSON());
      return json(route, sent.at(-1)!.tasks, 201);
    });
    await page.goto(`/kocluk/${STUDENT_ID}`);
    await openWeekPlanner(page);
    const panel = page.getByRole("dialog").first();
    await panel
      .getByRole("button", { name: "Sonraki hafta", exact: true })
      .click();
    await panel.getByRole("button", { name: "Önceki görevlerden seç" }).click();
    await panel.getByRole("button", { name: "Görünenleri seç" }).click();
    await panel.getByRole("button", { name: "Seçilenleri ekle (2)" }).click();
    await panel.getByRole("button", { name: "Birinci: düzenle" }).click();
    await panel.getByLabel("Görev", { exact: true }).fill("Birinci uyarlama");
    await panel.getByLabel("Notun (isteğe bağlı)").fill("Önce kısa tekrar");
    await panel.getByRole("button", { name: "Tarih", exact: true }).click();
    await page.getByRole("button", { name: "Bugün", exact: true }).click();
    await panel.getByRole("button", { name: "Değişikliği kaydet" }).click();
    await panel.getByRole("button", { name: "İkinci: düzenle" }).click();
    await panel.getByLabel("Görev", { exact: true }).fill("İkinci uyarlama");
    await panel.getByRole("button", { name: "Değişikliği kaydet" }).click();
    await panel
      .getByRole("button", { name: "Sonraki hafta", exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: test.info().outputPath("weekly-planner.png"),
    });
    await panel.getByRole("button", { name: "2 görevi planına ekle" }).click();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]!.tasks.map((task) => task.title)).toEqual([
      "Birinci uyarlama",
      "İkinci uyarlama",
    ]);
    expect(sent[0]!.tasks[0]!.coachNote).toBe("Önce kısa tekrar");
    expect(sent[0]!.tasks[0]!.taskDate < sent[0]!.tasks[1]!.taskDate).toBe(
      true,
    );
    expect(JSON.stringify(sent)).not.toContain("source-");
    await expect(panel).not.toBeVisible();
  });

  test("şablon kaydı programı gün ofsetine çevirir, tarihe değil", async ({
    page,
  }) => {
    const api = await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
    });
    await page.goto(`/kocluk/${STUDENT_ID}`);
    await openWeekPlanner(page);

    // Compose two tasks on two different days of the shown week.
    await page
      .getByRole("button", { name: "Sonraki hafta", exact: true })
      .click();
    // The form is always open and writes to the chosen day.
    await page.getByLabel("Görev", { exact: true }).fill("İlk görev");
    await page.getByRole("button", { name: "Taslağa ekle" }).click();
    // The day chips, by their group label — matching on the rendered date would tie the test to
    // the browser's own calendar, and matching on the count only works after a draft exists.
    await page
      .getByRole("group", { name: "Gün seç" })
      .getByRole("button")
      .nth(2)
      .click();
    await page.getByLabel("Görev", { exact: true }).fill("İkinci görev");
    await page.getByRole("button", { name: "Taslağa ekle" }).click();
    await expect(page.getByText("Bu programda · 2/21")).toBeVisible();

    // Saving sits under the program, one link that opens the name field.
    await page.getByRole("button", { name: "Şablon olarak kaydet" }).click();
    await page.getByLabel("Şablon adı").fill("Hafta 1");
    await page.getByRole("button", { name: "Şablonu kaydet" }).click();

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

  test("başka sınav için kaydedilmiş şablonun konuları sessizce taşınmaz", async ({
    page,
  }) => {
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
    await openWeekPlanner(page);

    // "Şablondan yükle" is a link that opens the saved programs as a menu.
    await page
      .getByRole("button", { name: "Şablondan yükle", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "YKS haftası · 1 görev", exact: true })
      .click();

    await expect(page.getByText("Bu programda · 1/21")).toBeVisible();
    // Said out loud, not silently thinned: `topic` is a soft ref into the content taxonomy and the
    // API never checks it against THIS student's exam.
    await expect(
      page.getByText("1 görevin konusu kaldırıldı", { exact: false }),
    ).toBeVisible();
  });

  test("not yazmak öğrenciye giden tek yönlü kaydı gönderir", async ({
    page,
  }) => {
    const api = await mockApi(page, {
      roles: ["STUDENT", "COACH"],
      myCoach: null,
    });
    await page.goto(`/kocluk/${STUDENT_ID}`);
    // The note card edits in place, on every screen size.
    await page.getByRole("button", { name: "Not yaz" }).click();

    const field = page.getByRole("textbox", { name: "Ayşe'ye notun" });
    await field.fill("Bu hafta paragrafa ağırlık ver.");
    await page.getByRole("button", { name: "Notu kaydet" }).click();

    await expect
      .poll(() => api.noteBodies)
      .toEqual(["Bu hafta paragrafa ağırlık ver."]);
  });
});

/** The week composer lives in the report's side panel; the week hero's ledge opens it on every size. */
async function openWeekPlanner(page: Page) {
  await page.getByRole("button", { name: "Haftayı planla" }).click();
}

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
      dailyFocusMinutes14d: [0, 20, 0, 40, 0, 0, 30, 0, 60, 0, 0, 25, 0, 0],
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
  const shifted = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offset,
  );
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
    /** The accept's refusal (seats full, already linked…), as the API words it. */
    acceptError?: { status: number; code: string; message: string };
    /** The preview's refusal (unknown or spent code), as the API words it. */
    previewError?: { status: number; code: string; message: string };
    /** Who the invite is from; defaults to the student's own coach, Koç Mert. */
    previewCoach?: { coachDisplayName: string; coachUsername: string };
    /** One finalized week on the student's side; left out, the student has none. "empty": a week with no record. */
    weeklyReport?: boolean | "empty";
  },
) {
  const user = makeUser(options.roles);
  let myCoach = options.myCoach;
  let previewCalls = 0;
  let acceptCalls = 0;
  const noteBodies: (string | null)[] = [];
  const myNoteBodies: (string | null)[] = [];
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
    dailyFocusMinutes28d: Array.from({ length: 28 }, (_, day) => (day % 3 === 0 ? 45 : 0)),
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
      return json(route, {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        unreadCount: 0,
      });
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
      return json(
        route,
        { code: "MENTORSHIP_DISABLED", message: "Koçluk kapalı" },
        403,
      );
    }

    if (method === "GET" && path === "/v1/mentorship/my-coach") {
      // Empty 200, not a null body, when there is no coach — same as the API.
      return json(
        route,
        myCoach ? { ...myCoach, coachProfile: options.coachProfile ?? null } : myCoach,
        myCoach ? 200 : 204,
      );
    }
    if (method === "GET" && path.startsWith("/v1/mentorship/my-coach/weekly-reports?")) {
      const items = options.weeklyReport
        ? [{ id: REPORT_ID, locale: "tr", period: MY_WEEKLY_REPORT.period, version: 1, finalizedAt: MY_WEEKLY_REPORT.finalizedAt, replacesId: null }]
        : [];
      return json(route, { items, total: items.length, page: 1, pageSize: 20 });
    }
    if (method === "GET" && path === `/v1/mentorship/my-coach/weekly-reports/${REPORT_ID}`) {
      return json(route, options.weeklyReport === "empty" ? EMPTY_WEEKLY_REPORT : MY_WEEKLY_REPORT);
    }
    if (method === "POST" && path === "/v1/mentorship/invitations/preview") {
      previewCalls += 1;
      if (options.previewError) {
        const { status, code, message } = options.previewError;
        return json(route, { code, message }, status);
      }
      return json(route, {
        coachDisplayName: options.previewCoach?.coachDisplayName ?? "Koç Mert",
        coachUsername: options.previewCoach?.coachUsername ?? "kocmert",
        dataScope: DATA_SCOPE,
        // Unspecified means "no profile", which is what every hand-granted coach looks like.
        coachProfile: options.coachProfile ?? null,
      });
    }
    if (method === "POST" && path === "/v1/mentorship/invitations/accept") {
      acceptCalls += 1;
      if (options.acceptError) {
        const { status, code, message } = options.acceptError;
        return json(route, { code, message }, status);
      }
      // Linked from here on: Koçum reads the coach the accept just created.
      myCoach = MY_COACH;
      return json(route, MY_COACH);
    }
    // The profile screen gained a Google-linking card that queries on mount. The harness answers
    // unmatched routes with 204, and an empty body breaks it — which would take the whole profile
    // screen down and, with it, the "Koçum" row this suite navigates through.
    if (method === "GET" && path === "/v1/users/me/auth-accounts/google") {
      return json(route, {
        enabled: false,
        linked: false,
        providerEmail: null,
        canLink: false,
      });
    }
    if (method === "GET" && url.pathname.endsWith("/planning-tasks")) {
      const from = url.searchParams.get("from")!;
      const pageNumber = Number(url.searchParams.get("page"));
      const items = report.planTasks.map((row, i) => ({
        ...row,
        id: `planning-${i}`,
        taskDate: from,
      }));
      return json(route, {
        items: items.slice(pageNumber - 1, pageNumber),
        total: items.length,
        page: pageNumber,
        pageSize: 1,
      });
    }
    if (method === "GET" && path === "/v1/mentorship/templates") {
      return json(route, options.templates ?? []);
    }
    if (method === "POST" && path === "/v1/mentorship/templates") {
      const body = request.postDataJSON() as { name: string; tasks: unknown[] };
      savedTemplates.push(body);
      return json(route, {
        id: "tpl-new",
        updatedAt: "2026-09-05T00:00:00.000Z",
        ...body,
      });
    }
    if (method === "DELETE" && path.startsWith("/v1/mentorship/templates/")) {
      return json(route, null, 204);
    }
    if (method === "GET" && path === "/v1/mentorship/overview") {
      return json(route, {
        inviteCode: {
          code: INVITE_CODE,
          expiresAt: "2026-09-30T00:00:00.000Z",
        },
        activeStudents: options.roster?.length ?? 0,
        maxActiveStudents: options.maxActiveStudents ?? 20,
        freeSeats: 3,
        paidSeats: 0,
        usedSeats: options.roster?.length ?? 0,
        sponsorshipEnabled: true,
        // The server's figure: free + paid, never past the follow cap.
        seatAllowance: Math.min(3, options.maxActiveStudents ?? 20),
        seatPlansOnSale: false,
        dataScope: DATA_SCOPE,
      });
    }
    if (method === "GET" && path.startsWith("/v1/mentorship/students?")) {
      const items = path.includes("status=ACTIVE")
        ? (options.roster ?? [])
        : [];
      return json(route, {
        items,
        total: items.length,
        page: 1,
        pageSize: 100,
      });
    }
    if (method === "GET" && path === `/v1/mentorship/students/${STUDENT_ID}`) {
      return json(route, report);
    }
    if (
      method === "PUT" &&
      path === `/v1/mentorship/students/${STUDENT_ID}/note`
    ) {
      noteBodies.push((request.postDataJSON() as { body: string | null }).body);
      return json(route, null, 204);
    }
    if (method === "PUT" && path === "/v1/mentorship/my-coach/note") {
      myNoteBodies.push((request.postDataJSON() as { body: string | null }).body);
      return json(route, null, 204);
    }
    if (
      method === "PUT" &&
      /\/v1\/mentorship\/students\/[^/]+\/attention$/.test(path)
    ) {
      attentionCalls.push(
        (request.postDataJSON() as { attended: boolean }).attended,
      );
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
        phoneVerified: true,
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
        return json(
          route,
          { code: "MENTORSHIP_APPLICATIONS_CLOSED", message: "kapalı" },
          403,
        );
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
    // The report embeds the weekly-report card. The 204 fallback reads as a broken preview and its
    // error toast lands on the plan panel's buttons; the flag-off answer keeps the card quiet.
    if (
      path.startsWith(`/v1/mentorship/students/${STUDENT_ID}/weekly-reports`)
    ) {
      return json(
        route,
        { code: "MENTORSHIP_WEEKLY_REPORT_DISABLED", message: "kapalı" },
        404,
      );
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
    get myNoteBodies() {
      return myNoteBodies;
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
  "access-control-allow-origin":
    process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
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
