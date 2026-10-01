/**
 * The panel ("Bugün") the scene rises out of and returns to. A faithful mock of DESIGN.md §6.1
 * (hero card, path, week band, quests, tab bar) built from the real tokens and copy, plus the
 * context beats of the single film: tap the current node → "Bitti olarak işaretle" → ✓ draws →
 * the seventh flame lights → the week becomes a 7-day streak (which is what earns rhythm_found).
 */
import { clamp, ease, kick, progress, spring } from "./engine.mjs";
import { SPRINGS } from "./timeline.mjs";

export const ASSET = "../../apps/web/public";

const icon = (paths, size = 24, stroke = 2) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  bell: icon('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>', 22),
  check: (id) =>
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path ${id ? `id="${id}"` : ""} pathLength="1" d="M5.5 12.5l4.2 4.2L18.5 7.8"/></svg>`,
  play: '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7l-10.2-6.4A1 1 0 0 0 8.5 5.6z" fill="currentColor"/></svg>',
  book: icon('<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>', 22),
  chest: icon('<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 13h18M5 9V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v2"/><rect x="10.5" y="11.5" width="3" height="4" rx="1"/>', 22),
  home: icon('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>', 24),
  calendar: icon('<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>', 24),
  coach: icon('<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20.5l1.4-5A8.5 8.5 0 1 1 21 11.5z"/><path d="M12 7.5l1.1 2.4 2.4 1.1-2.4 1.1L12 14.5l-1.1-2.4L8.5 11l2.4-1.1z" fill="currentColor" stroke-width="1"/>', 26),
  chart: icon('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>', 24),
  notebook: icon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>', 24),
  timer: icon('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>', 20),
  list: icon('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>', 20),
  playSmall: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6z" fill="currentColor"/></svg>',
  checkSmall: icon('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 18, 2.6),
};

const STATUS = (ink) => `
  <span style="color:${ink}">9:41</span>
  <span class="icons" style="color:${ink}">
    <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3A10.5 10.5 0 0 0 8 .3 10.5 10.5 0 0 0 .5 3.4l1.3 1.3A8.7 8.7 0 0 1 8 2.2zm0 3.6c1.4 0 2.7.5 3.7 1.5L13 6a7.2 7.2 0 0 0-10 0l1.3 1.3c1-1 2.3-1.5 3.7-1.5zm0 3.5c-.6 0-1.1.2-1.5.6L8 11.4l1.5-1.5c-.4-.4-.9-.6-1.5-.6z"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity="0.4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="currentColor" opacity="0.4"/></svg>
  </span>`;

const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cts", "Paz"];

/** Two states of the same day. `before` is what the student sees when they tap; `after` is the
 *  panel that is already waiting under the curtain when it lifts. */
const STATE = {
  before: {
    bubble: "Bir adım daha, haftan tamamlanıyor.",
    title: "Bugün 3 adım var. Sıradaki 25 dakika.",
    ledge: "Problemler · 25 dk başla",
    chestMeta: "6/7 gün",
    goal: "Bugün 25 / 50 dk",
  },
  after: {
    bubble: "Bu hafta her gün buradaydın.",
    title: "Bugün 3 adım var. Sıradaki 20 dakika.",
    ledge: "Tarih tekrarı · 20 dk başla",
    chestMeta: "7/7 gün",
    goal: "Bugün 50 / 50 dk",
  },
};

export function buildPanel(app, scenario) {
  app.className = scenario.theme === "dark" ? "theme-dark" : "theme-light";
  const flame = `${ASSET}/img/flame.png`;
  app.innerHTML = `
    <div class="app-blob cyan"></div><div class="app-blob pink"></div><div class="app-blob blue"></div>
    <header class="p-header">
      <div class="avatar" id="pAvatar">S</div>
      <div>
        <div class="greet-title">Günaydın, Selin</div>
        <div class="greet-sub">Pazar, 28 Eylül</div>
      </div>
      <div class="bell">${ICONS.bell}</div>
    </header>
    <section class="card hero">
      <div class="hero-inner">
        <div class="bubble-row">
          <img src="${ASSET}/mascot/puhu/puhu-happy.png" alt="" />
          <div class="bubble" id="pBubble"></div>
        </div>
        <h1 class="hero-title" id="pTitle"></h1>
        <ol class="path">
          <li class="stop"><div class="slot"><div class="node done">${ICONS.check()}</div></div><span class="lbl">Paragraf</span><span class="meta">25 dk</span></li>
          <li class="stop" id="pStop1"><span class="conn reached"></span><div class="slot"><div class="node current" id="pNode1"><span id="pPlay" style="position:absolute;inset:0;display:grid;place-items:center;padding-left:3px">${ICONS.play}</span><span id="pCheckWrap" style="position:absolute;inset:0;display:grid;place-items:center">${ICONS.check("pCheck")}</span></div></div><span class="lbl">Problemler</span><span class="meta">25 dk</span><div class="tip" id="pTip1">Sıradaki</div></li>
          <li class="stop" id="pStop2"><span class="conn" id="pConn2"></span><div class="slot"><div class="node upcoming" id="pNode2">${ICONS.book}</div></div><span class="lbl">Tarih tekrarı</span><span class="meta">20 dk</span><div class="tip" id="pTip2" style="display:none">Sıradaki</div></li>
          <li class="stop"><span class="conn"></span><div class="slot"><div class="node chest">${ICONS.chest}</div></div><span class="lbl">Sandık</span><span class="meta" id="pChestMeta"></span></li>
        </ol>
        <div class="ledge" id="pLedge"></div>
        <span class="text-link">Planı düzenle ›</span>
      </div>
      <div class="week-band">
        <ol class="days">
          ${DAYS.map((d, i) => {
            const today = i === 6;
            return `<li class="day"><span class="dot ${today ? "today" : "active"}" id="pDot${i}">${
              today
                ? `<img class="idle" id="pFlameIdle" src="${flame}" alt="" style="position:absolute"/><img id="pFlameNew" src="${flame}" alt="" style="position:absolute"/>`
                : `<img src="${flame}" alt=""/>`
            }</span><span class="wd ${today ? "today" : ""}">${d}</span></li>`;
          }).join("")}
        </ol>
        <div class="streak">
          <div class="streak-count"><img src="${flame}" alt="" /><span class="num-wrap"><span id="pNumOld">6</span><span class="next" id="pNumNew">7</span></span><span>gün seri</span></div>
          <div class="goal" id="pGoal"></div>
        </div>
      </div>
    </section>
    <section class="card quests">
      <div class="quests-head">Günlük görevler <span id="pQuestCount">1/3 tamam</span></div>
      <div class="q-row"><div class="q-well" style="background:var(--well-blue)">${ICONS.timer}</div><div><div class="q-title">Bir odak seansı bitir</div><div class="q-meta">Tamam</div></div></div>
      <div class="q-row"><div class="q-well" style="background:var(--well-peri)">${ICONS.list}</div><div><div class="q-title">Planından iki adım tamamla</div><div class="q-meta">1/2</div></div></div>
    </section>
    <nav class="tabbar">
      <span class="on">${ICONS.home}</span>
      <span>${ICONS.calendar}</span>
      <span class="fab">${ICONS.coach}</span>
      <span>${ICONS.chart}</span>
      <span>${ICONS.notebook}</span>
    </nav>
    <div class="menu" id="pMenu">
      <div class="menu-item" id="pMenuStart">${ICONS.playSmall}<span>Seansla başla</span></div>
      <div class="menu-item" id="pMenuDone">${ICONS.checkSmall}<span>Bitti olarak işaretle</span></div>
    </div>`;

  const $ = (id) => app.querySelector(`#${id}`);
  const refs = {
    app,
    avatar: $("pAvatar"),
    bubble: $("pBubble"),
    title: $("pTitle"),
    ledge: $("pLedge"),
    chestMeta: $("pChestMeta"),
    goal: $("pGoal"),
    node1: $("pNode1"),
    node2: $("pNode2"),
    conn2: $("pConn2"),
    tip1: $("pTip1"),
    tip2: $("pTip2"),
    play: $("pPlay"),
    check: $("pCheck"),
    flameIdle: $("pFlameIdle"),
    flameNew: $("pFlameNew"),
    dot6: $("pDot6"),
    numOld: $("pNumOld"),
    numNew: $("pNumNew"),
    questCount: $("pQuestCount"),
    menu: $("pMenu"),
    menuDone: $("pMenuDone"),
    applied: null,
  };
  applyState(refs, "before");
  return refs;
}

/** Centre of an element in screen coordinates (the screen is never transformed). */
export function centerOf(el, screen) {
  const a = el.getBoundingClientRect();
  const s = screen.getBoundingClientRect();
  return { x: a.left - s.left + a.width / 2, y: a.top - s.top + a.height / 2, w: a.width, h: a.height };
}

/** Places the node menu under the current node once layout is known. */
export function placeMenu(refs, screen) {
  const node = centerOf(refs.node1, screen);
  refs.menu.style.left = `${Math.round(node.x - 60)}px`;
  refs.menu.style.top = `${Math.round(node.y + 44)}px`;
}

function applyState(refs, key) {
  if (refs.applied === key) return;
  refs.applied = key;
  const s = STATE[key];
  refs.bubble.textContent = s.bubble;
  refs.title.textContent = s.title;
  refs.ledge.textContent = s.ledge;
  refs.chestMeta.textContent = s.chestMeta;
  refs.goal.textContent = s.goal;
  refs.questCount.textContent = key === "after" ? "2/3 tamam" : "1/3 tamam";
  const after = key === "after";
  // Problemler becomes a done stop; Tarih tekrarı becomes the big "Sıradaki" node.
  refs.node1.className = after ? "node done" : "node current";
  refs.node2.className = after ? "node current" : "node upcoming";
  refs.node2.innerHTML = after ? `<span style="padding-left:3px;display:grid">${ICONS.play}</span>` : ICONS.book;
  refs.conn2.className = after ? "conn reached" : "conn";
  refs.tip1.style.display = after ? "none" : "";
  refs.tip2.style.display = after ? "" : "none";
}

const pop = spring(SPRINGS.badge);
const checkKick = kick({ stiffness: 420, damping: 16 });

/**
 * Context beats for video time `T`. `afterAt` is when the panel quietly switches to its
 * after-state (under the curtain, or instantly in the reduced film).
 */
export function renderPanel(T, refs, scenario, afterAt) {
  const ctx = scenario.context;
  const reduced = Boolean(scenario.reduced);
  applyState(refs, T >= afterAt ? "after" : "before");

  if (!ctx) {
    refs.menu.style.opacity = "0";
    refs.play.style.opacity = "1";
    refs.check.style.strokeDasharray = "1";
    refs.check.style.strokeDashoffset = "1";
    refs.flameNew.style.transform = "scale(0)";
    refs.flameIdle.style.opacity = "0.3";
    refs.numOld.style.transform = "translateY(0)";
    refs.numNew.style.transform = "translateY(110%)";
    return;
  }

  // Node press (the panel's 2 px press).
  const pressing = T >= ctx.nodeTap && T < ctx.nodeTap + 0.12;
  const checkAge = T - ctx.check;
  const nodePop = checkAge > 0 && !reduced ? 1 + 0.12 * checkKick(checkAge) : 1;
  if (refs.applied === "before") {
    refs.node1.style.transform = `translateY(${pressing ? 2 : 0}px) scale(${nodePop})`;
  } else {
    refs.node1.style.transform = "";
  }

  // Menu: 160 ms open (fade + slight vertical scale), 120 ms close.
  const open = reduced ? (T >= ctx.menuOpen ? 1 : 0) : ease.outQuad(progress(T, ctx.menuOpen, 0.16));
  const close = reduced ? (T >= ctx.menuClose ? 1 : 0) : ease.inQuad(progress(T, ctx.menuClose, 0.12));
  const menuOpacity = clamp(open - close);
  refs.menu.style.opacity = String(menuOpacity);
  refs.menu.style.transform = `scaleY(${0.94 + 0.06 * open}) translateY(${(1 - open) * -4}px)`;
  refs.menu.style.visibility = menuOpacity > 0.001 ? "visible" : "hidden";
  const itemHot = T >= ctx.itemTap - 0.06 && T < ctx.menuClose + 0.12;
  refs.menuDone.style.background = itemHot ? "var(--play-selected)" : "transparent";

  // ✓ replaces the play glyph and draws itself (SuccessCheck ≈350 ms).
  const halo = reduced ? (checkAge >= 0 ? 0 : 1) : 1 - ease.outQuad(progress(T, ctx.check, 0.25));
  if (refs.applied === "before") {
    refs.node1.style.boxShadow = `0 5px 0 var(--play-cta-edge), 0 0 0 ${8 * halo}px var(--play-selected)`;
  } else {
    refs.node1.style.boxShadow = "";
  }
  refs.play.style.opacity = String(reduced ? (checkAge >= 0 ? 0 : 1) : 1 - progress(T, ctx.check, 0.1));
  const draw = reduced ? (checkAge >= 0 ? 1 : 0) : ease.outQuart(progress(T, ctx.check + 0.04, 0.35));
  refs.check.style.strokeDasharray = "1";
  refs.check.style.strokeDashoffset = String(1 - draw);
  refs.tip1.style.opacity = String(refs.applied === "before" ? 1 - progress(T, ctx.check, 0.2) : 1);

  // Seventh flame: the week becomes a 7-day streak.
  const flameAge = T - ctx.flame;
  const flameScale = flameAge <= 0 ? 0 : reduced ? 1 : pop.value(flameAge);
  refs.flameNew.style.transform = `scale(${flameScale})`;
  refs.flameIdle.style.opacity = String(flameAge > 0 ? 0 : 0.3);
  refs.dot6.style.background = flameAge > 0 ? "var(--streak-soft)" : "transparent";
  const swap = reduced ? (flameAge > 0 ? 1 : 0) : ease.outQuart(progress(T, ctx.flame + 0.05, 0.3));
  refs.numOld.style.transform = `translateY(${-110 * swap}%)`;
  refs.numOld.style.opacity = String(1 - swap);
  refs.numNew.style.transform = `translateY(${110 * (1 - swap)}%)`;
}
