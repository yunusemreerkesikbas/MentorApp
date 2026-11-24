# F4 Real Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-drawn phone screens on F4 cards 1–4 with real app screenshots and swap them into the 19 Nov Metricool post.

**Architecture:** Capture four PNGs (mobile emulator for cards 1 and 3, web at 390×844 for cards 2 and 4) from a demo account, store them in the kit's `public/screens/`, and pass each to the existing `Phone` component as an `<Img>` screen. Render with Remotion, then update the Metricool post's media.

**Tech Stack:** Remotion 4 kit (`marketing/social`), Expo app on the Android emulator (adb screencap), Next.js web + Playwright, local NestJS API + docker Postgres, Metricool connector + Claude in Chrome upload.

**Spec:** `docs/plans/2026-11-17-f4-real-screens-design.md`

## Global Constraints

- Card copy, layout, Puhu art, card 5 and the post text stay as they are.
- What the phone shows must match the card line: card 1 three tasks with one done, card 2 "Masada 4 kişi" and a running timer, card 3 the nickname "Gizli Kahraman", card 4 the koç message "Bu hafta harika gidiyorsun.".
- No trace of a test account: realistic Turkish name, YKS, no "test", no empty states, no error banners, no Expo Go dev button, no PREMIUM upsell.
- Post publishes on its own on 2026-11-19 19:00 (Europe/Istanbul); it is not moved to draft.
- Nothing is committed (the owner commits).

## Review Focus

- Text inside the phone too small to read at feed size → crop each screenshot to the screen's top part when needed so the key line is readable on a 1080-wide card (checked on the render at 50 % scale).
- Screenshot aspect differs from the 378×822 screen box → `objectFit: "cover"`, `objectPosition: "top"`; check that the status bar is not cut.
- Light vs dark theme mismatch between mobile and web shots → all four in light theme.
- Notification/time in the status bar shows a dev clock or battery warning → status bar set to demo mode (`adb shell settings put global sysui_demo_allowed 1`, clock 09:41) or cropped.
- Metricool carousel order changes when swapping media → check `getScheduledPosts` returns the five URLs in card order after the update.

---

### Task 1: Demo stack and data

**Files:** scratchpad scripts only (seed SQL/JS), `apps/mobile/.expo/qa-accounts.json` (gitignored) gets key `f4demo`.

- [ ] Start Postgres (docker `mentor-postgres` :5433), API (`node --enable-source-maps dist/main.js` in apps/api), web on :3000 (`web-dev` launch config), emulator `Puhu_Pixel` + Expo (see memory recipe).
- [ ] Create demo student "Elif" (YKS) via mobile signup; finish onboarding.
- [ ] Today's plan: "2 seans çalış" (done), "40 paragraf çöz", "10 dk tekrar".
- [ ] Weekly recap READY for last week with nickname Gizli Kahraman (TITLE_FOCUS_TRAVELER_LABEL) and a plausible total.
- [ ] A koç account linked to Elif who sends "Bu hafta harika gidiyorsun."; Elif replies "Teşekkürler!".
- [ ] A study room with Elif + 3 other demo students joined, timer running.
- Verify: each screen opens without errors in the app/web.

### Task 2: Capture screens

**Files:** Create `marketing/social/public/screens/F4-1.png`, `F4-2.png`, `F4-3.png`, `F4-4.png`.

- [ ] Card 1: panel "Bugünün yolu" on the emulator, light theme, demo-mode status bar, `adb exec-out screencap -p`.
- [ ] Card 3: weekly recap story on the nickname slide, same method.
- [ ] Card 2: web room page, Playwright 390×844 DPR 3, logged in as Elif.
- [ ] Card 4: web /kocum chat, same Playwright setup.
- Verify: open each PNG; it meets the Global Constraints.

### Task 3: Use the screens in F4

**Files:** Modify `marketing/social/src/pieces/F4.tsx` (CARDS, remove TodayScreen/WeekScreen/KocScreen/Shell/Check and the F1Screen/MasaPopOut import if unused), `marketing/social/src/art.ts` (add `SCREENS` paths if that is where paths live), test `marketing/social/test/art.test.ts` (asset exists check).

- [ ] Add a test that every `screens/F4-n.png` path used by F4 exists in `public/`.
- [ ] Run `npx vitest run test/art.test.ts`; expect FAIL before files/paths are wired, PASS after.
- [ ] `function Screen({ src }: { src: string })` renders `<Img>` 100 % × 100 %, `objectFit: "cover"`, `objectPosition: "top"`; each card's `screen` uses it.
- [ ] `npx tsc --noEmit` and `npx vitest run` green (76+ tests).
- [ ] Render `F4` cards 1–5 to `out/F4/` (existing render script), view each PNG.

### Task 4: Swap media in Metricool

- [ ] Upload the four new PNGs through Chrome (Metricool create-post trick, draft), read their static URLs with `getScheduledPosts`, delete nothing else.
- [ ] `updateScheduledPost` on uuid `-7877503676810441303`: media = 4 new URLs + the existing card 5 URL, all other fields as returned (draft false, autoPublish true, alt texts unchanged unless the screen description changed).
- [ ] Remove the helper draft created for the upload (owner OK asked first).
- Verify: `getScheduledPosts` shows the post at 2026-11-19 19:00 with five media in order.
