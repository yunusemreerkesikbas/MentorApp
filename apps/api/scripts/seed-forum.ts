/**
 * Forum test-data seeder (dev only). Fills the community with realistic Turkish content so the UI
 * can be exercised with volume: several zones, many threads, comments, and likes.
 *
 * Run:  pnpm --filter @mentor/api seed:forum
 *
 * Idempotent-ish: ghost authors live under @seed.mentor.local; each run wipes ONLY seed-authored
 * threads/comments/reactions (real users' own posts are untouched) and regenerates a fresh set.
 * Refuses to run when NODE_ENV=production. Membership is added for EVERY active user so whoever
 * you log in as sees the feed. Ghost accounts have an invalid password hash — they cannot log in.
 */
import "dotenv/config";
import { Pool, type PoolClient } from "pg";

const SEED_DOMAIN = "seed.mentor.local";
const LIKE = "❤️";

const PEOPLE = [
  "Ahmet Yılmaz", "Elif Demir", "Mehmet Kaya", "Zeynep Şahin", "Emre Çelik",
  "Büşra Aydın", "Mert Arslan", "Merve Doğan", "Can Öztürk", "Ayşe Yıldız",
  "Burak Koç", "Selin Aksoy", "Kerem Polat", "Derya Kurt", "Onur Şimşek",
];

const ZONES = [
  { slug: "kpss-genel-sohbet", type: "CHAT", emoji: "💬", title: "KPSS Genel Sohbet", description: "KPSS'ye hazırlananların genel sohbet alanı." },
  { slug: "kpss-matematik", type: "CHAT", emoji: "➗", title: "Matematik & Geometri", description: "Soru çözümü, kısa yollar, kaynak paylaşımı." },
  { slug: "kpss-turkce", type: "CHAT", emoji: "📚", title: "Türkçe & Paragraf", description: "Paragraf taktikleri, dil bilgisi ve deneme paylaşımları." },
  { slug: "kpss-duyurular", type: "ANNOUNCEMENT", emoji: "📢", title: "Duyurular", description: "ÖSYM ve platform duyuruları." },
  { slug: "kpss-soru-cevap", type: "QA", emoji: "❓", title: "Soru & Cevap", description: "Takıldığın soruyu sor, cevabını al." },
];

const CHAT_MESSAGES = [
  "Bugün 4 saat matematik çalıştım, sonunda çıkarımlı bölünebilme mantığını oturttum 💪",
  "Arkadaşlar coğrafya bölge haritalarını nasıl ezberliyorsunuz? Aklımda kalmıyor bir türlü.",
  "Deneme sınavında 78 net yaptım, geçen haftaya göre 9 net artış var 🎉",
  "Sabah erken kalkıp çalışmak gerçekten çok verimli, tavsiye ederim.",
  "Tarih konusunda Osmanlı duraklama dönemi kafamı karıştırıyor, kaynak öneriniz var mı?",
  "Bugün motivasyonum çok düşük, biraz mola verip akşam devam edeceğim.",
  "Vatandaşlık konusunda temel hak ve hürriyetleri tablo yaparak çalışın, çok işe yarıyor.",
  "Paragrafta anlam bütünlüğü sorularında hız kazandım, günde 40 soru çözüyorum.",
  "Yeni bir çalışma planı yaptım, haftalık hedeflerle ilerlemek çok daha kolay.",
  "Geometride açıortay sorularını sürekli yanlış yapıyorum, video önerisi olan?",
  "Bugünkü hedefim 200 soru, şu an 130'dayım, akşama biter inşallah.",
  "Çıkmış sorularla çalışmak sanılandan çok daha faydalı, deneyin derim.",
  "Türkçe deneme sonuçlarım stabil, artık matematiğe ağırlık vereceğim.",
  "Konu tekrarı yapmadan soru çözmek işe yaramıyormuş, dersimi aldım 😅",
  "Herkese kolay gelsin, bu hafta çok verimli geçsin 🙌",
  "Coğrafyada iklim tiplerini şarkı gibi ezberledim, çok saçma ama işe yarıyor.",
  "Deneme sınavına girerken süre tutmak şart, gerçek sınav temposunu yakalayın.",
  "Matematikte problemler kısmında çok zorlanıyorum, öneriniz var mı?",
  "Bugün ilk kez 85 net barajını geçtim, çok mutluyum 🥹",
  "Akşamları sadece tekrar yapıyorum, yeni konuya sabah başlıyorum, bana iyi geliyor.",
];

const ANNOUNCEMENTS = [
  "📢 2026 KPSS Lisans başvuru tarihleri açıklandı. Detaylar için ÖSYM sayfasını kontrol edin.",
  "Platformda yeni deneme sınavı modülü yayında! Profil sayfasından erişebilirsiniz.",
  "Bu hafta sonu canlı soru çözüm etkinliği yapılacak. Katılım için duyuruyu takip edin.",
  "Sistem bakımı nedeniyle Pazar 03:00-05:00 arası kısa kesintiler olabilir.",
  "Yeni Türkçe konu anlatım videoları eklendi. İyi çalışmalar!",
];

const QUESTIONS = [
  { title: "Bölünebilme kurallarında 11'e bölünebilme nasıl uygulanır?", body: "11'e bölünebilme kuralını tam anlayamadım. Basamakları toplarken artı eksi mantığı nasıl işliyor, örnekle açıklayabilir misiniz?" },
  { title: "Paragrafta ana düşünce ile yardımcı düşünceyi nasıl ayırt ederim?", body: "Sürekli yardımcı düşünceyi ana düşünce sanıyorum. Sizin kullandığınız pratik bir yöntem var mı?" },
  { title: "Osmanlı'da Tanzimat Fermanı'nın en önemli sonucu nedir?", body: "Sınavda sık çıkıyor ama hangi maddesinin daha kritik olduğunu çıkaramıyorum." },
  { title: "Vatandaşlıkta yasama dokunulmazlığı ile yasama sorumsuzluğu farkı?", body: "İkisi sürekli karışıyor. Kısa ve net bir ayrım kurabilir misiniz?" },
  { title: "Geometride benzerlikte alan oranı neden karesi alınıyor?", body: "Kenar oranı k ise alan oranı neden k^2 oluyor, mantığını anlamak istiyorum." },
  { title: "Coğrafyada Türkiye'nin matematik konumu neleri etkiler?", body: "Matematik konum ve özel konum ayrımını netleştiren bir örnek verebilir misiniz?" },
  { title: "Deneme sınavında zaman yönetimi için öneriniz nedir?", body: "Matematiğe çok takılıp Türkçeye vakit kalmıyor. Nasıl bir sıra izlemeliyim?" },
  { title: "Sözel mantık sorularında hız nasıl kazanılır?", body: "Tablo mu kuruyorsunuz, şema mı? En verimli yöntem hangisi?" },
];

const COMMENTS = [
  "Kesinlikle katılıyorum, bende de aynısı oldu.",
  "Süper, teşekkürler paylaşım için 🙏",
  "Bunu deneyeceğim, çok mantıklı geldi.",
  "Aynı konuda ben de takılıyordum, iyi oldu.",
  "Hangi kaynağı kullanıyorsun bu konuda?",
  "Helal olsun, motive oldum 💪",
  "Bence konu tekrarını ihmal etme, çok fark ediyor.",
  "Tebrikler, emeğinin karşılığını alıyorsun 🎉",
  "Bu taktiği bana da öğretir misin?",
  "Ben de bugün benzer bir şey yaşadım, dayanışma güzel.",
  "Video önerisi için DM atabilir misin?",
  "Harika ilerleme, böyle devam!",
];

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(arr: T[]): T => arr[rand(arr.length)]!;
const chance = (p: number) => Math.random() < p;
/** Monday 00:00 UTC of the current week — matches CommunityService's leaderboard window. */
const startOfWeekUtc = (now: Date): Date => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
};
const slugName = (name: string) =>
  name.toLowerCase().replaceAll("ı", "i").replaceAll("ş", "s").replaceAll("ç", "c")
    .replaceAll("ğ", "g").replaceAll("ü", "u").replaceAll("ö", "o").replace(/[^a-z]+/g, "-");
/** Random Date within the last `days`, biased toward more recent. */
const someTimeAgo = (days: number) => new Date(Date.now() - Math.floor(Math.random() ** 1.6 * days * 86_400_000));
/** N distinct items from arr. */
function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(rand(copy.length), 1)[0]!);
  return out;
}

async function main() {
  if ((process.env.NODE_ENV ?? "").toLowerCase() === "production") {
    throw new Error("Refusing to seed forum data in production.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (load apps/api/.env).");

  const pool = new Pool({ connectionString: url });
  const c: PoolClient = await pool.connect();
  const stats = {
    users: 0,
    zones: ZONES.length,
    members: 0,
    threads: 0,
    comments: 0,
    replies: 0,
    likes: 0,
    commentLikes: 0,
    xpRows: 0,
  };
  try {
    await c.query("BEGIN");
    await c.query("select set_config('app.role','SERVICE',true)");

    // 1) Ghost authors ---------------------------------------------------------
    const seedUserIds: string[] = [];
    for (const name of PEOPLE) {
      const emailSlug = slugName(name); // e.g. "ahmet-yilmaz" (hyphens ok in an email local part)
      // username has a format check (^[a-z0-9_]{3,24}$) — no hyphens, so use underscores.
      const handle = emailSlug.replace(/-/g, "_").slice(0, 24);
      const email = `${emailSlug}@${SEED_DOMAIN}`;
      let res = await c.query<{ id: string }>("select id from users where lower(email)=lower($1)", [email]);
      if (!res.rows[0]) {
        res = await c.query<{ id: string }>(
          `insert into users (email, password_hash, display_name, username, roles, exam_type, email_verified_at, kvkk_accepted_at)
           values ($1, 'SEED_NO_LOGIN', $2, $3, '{STUDENT}', 'KPSS', now(), now()) returning id`,
          [email, name, handle],
        );
        stats.users++;
      } else {
        // Backfill a handle on ghost users seeded before usernames were added.
        await c.query("update users set username = $1 where id = $2 and username is null", [
          handle,
          res.rows[0].id,
        ]);
      }
      seedUserIds.push(res.rows[0]!.id);
    }
    const ownerId = seedUserIds[0]!;

    // 2) Wipe prior seed-authored content (leave real users' posts intact) -----
    const seedThreads = await c.query<{ id: string }>(
      "select id from forum_threads where author_id = any($1)", [seedUserIds],
    );
    const seedThreadIds = seedThreads.rows.map((r) => r.id);
    // Order matters: reactions → replies (children) → top-level posts → threads (FK-safe).
    await c.query(
      `delete from forum_post_reactions where user_id = any($1)
         or post_id in (select id from forum_posts where author_id = any($1) or thread_id = any($2))`,
      [seedUserIds, seedThreadIds],
    );
    await c.query("delete from forum_reactions where user_id = any($1) or thread_id = any($2)", [
      seedUserIds,
      seedThreadIds,
    ]);
    await c.query(
      `delete from forum_posts where parent_post_id is not null
         and (author_id = any($1) or thread_id = any($2))`,
      [seedUserIds, seedThreadIds],
    );
    await c.query("delete from forum_posts where author_id = any($1) or thread_id = any($2)", [
      seedUserIds,
      seedThreadIds,
    ]);
    if (seedThreadIds.length) {
      await c.query("delete from forum_threads where id = any($1)", [seedThreadIds]);
    }

    // 3) Zones (upsert by slug) -----------------------------------------------
    const zoneId: Record<string, string> = {};
    for (const z of ZONES) {
      const res = await c.query<{ id: string }>(
        `insert into forum_zones (type, title, slug, description, emoji, exam_type, join_policy, visibility, created_by)
         values ($1,$2,$3,$4,$5,'KPSS','OPEN','PUBLIC',$6)
         on conflict (slug) do update set
           title = excluded.title, description = excluded.description,
           emoji = excluded.emoji, type = excluded.type
         returning id`,
        [z.type, z.title, z.slug, z.description, z.emoji, ownerId],
      );
      zoneId[z.slug] = res.rows[0]!.id;
    }

    // 4) Membership: every active user in every zone (so any login sees the feed)
    const everyone = (await c.query<{ id: string }>("select id from users where status='ACTIVE'")).rows.map((r) => r.id);
    for (const z of ZONES) {
      for (const uid of everyone) {
        const role = uid === ownerId ? "OWNER" : "MEMBER";
        const r = await c.query(
          `insert into forum_zone_members (zone_id, user_id, role, status)
           values ($1,$2,$3,'ACTIVE') on conflict (zone_id, user_id) do nothing`,
          [zoneId[z.slug], uid, role],
        );
        stats.members += r.rowCount ?? 0;
      }
    }

    // 5) Threads + comments + likes -------------------------------------------
    const addLikes = async (threadId: string, max: number) => {
      const likers = sample(seedUserIds, rand(max + 1));
      for (const uid of likers) {
        await c.query(
          `insert into forum_reactions (thread_id, user_id, emoji, created_at)
           values ($1,$2,$3, now()) on conflict do nothing`,
          [threadId, uid, LIKE],
        );
        stats.likes++;
      }
    };
    const addPostLikes = async (postId: string, max: number) => {
      for (const uid of sample(seedUserIds, rand(max + 1))) {
        await c.query(
          `insert into forum_post_reactions (post_id, user_id, emoji, created_at)
           values ($1,$2,$3, now()) on conflict do nothing`,
          [postId, uid, LIKE],
        );
        stats.commentLikes++;
      }
    };
    const addComments = async (threadId: string, after: Date, max: number) => {
      const n = rand(max + 1);
      for (let i = 0; i < n; i++) {
        const at = new Date(after.getTime() + (i + 1) * (3_600_000 + rand(72_000_000)));
        const res = await c.query<{ id: string }>(
          `insert into forum_posts (thread_id, author_id, body, created_at, updated_at)
           values ($1,$2,$3,$4,$4) returning id`,
          [threadId, pick(seedUserIds), pick(COMMENTS), at.toISOString()],
        );
        const commentId = res.rows[0]!.id;
        stats.comments++;
        // Some comments get nested replies + their own likes (recursive thread test data).
        if (chance(0.4)) {
          const replies = rand(3) + 1;
          for (let j = 0; j < replies; j++) {
            const rat = new Date(at.getTime() + (j + 1) * (1_800_000 + rand(36_000_000)));
            await c.query(
              `insert into forum_posts (thread_id, parent_post_id, author_id, body, created_at, updated_at)
               values ($1,$2,$3,$4,$5,$5)`,
              [threadId, commentId, pick(seedUserIds), pick(COMMENTS), rat.toISOString()],
            );
            stats.replies++;
          }
        }
        await addPostLikes(commentId, 5);
      }
    };

    const seedFeed = async (slug: string, bodies: string[], count: number, opts: { authorPool?: string[]; likeMax: number; commentMax: number }) => {
      for (let i = 0; i < count; i++) {
        const at = someTimeAgo(20);
        const author = pick(opts.authorPool ?? seedUserIds);
        const res = await c.query<{ id: string }>(
          `insert into forum_threads (zone_id, author_id, body, status, created_at, updated_at)
           values ($1,$2,$3,'OPEN',$4,$4) returning id`,
          [zoneId[slug], author, pick(bodies), at.toISOString()],
        );
        stats.threads++;
        await addComments(res.rows[0]!.id, at, opts.commentMax);
        await addLikes(res.rows[0]!.id, opts.likeMax);
      }
    };

    await seedFeed("kpss-genel-sohbet", CHAT_MESSAGES, 34, { likeMax: 9, commentMax: 6 });
    await seedFeed("kpss-matematik", CHAT_MESSAGES, 22, { likeMax: 7, commentMax: 5 });
    await seedFeed("kpss-turkce", CHAT_MESSAGES, 20, { likeMax: 7, commentMax: 5 });
    // Announcements: only the owner/mod posts; still likeable + commentable by members.
    await seedFeed("kpss-duyurular", ANNOUNCEMENTS, 6, { authorPool: [ownerId], likeMax: 12, commentMax: 4 });

    // 6) QA questions (title + body) with a few answers ------------------------
    for (let i = 0; i < 14; i++) {
      const q = pick(QUESTIONS);
      const at = someTimeAgo(20);
      const res = await c.query<{ id: string }>(
        `insert into forum_threads (zone_id, author_id, title, body, status, created_at, updated_at)
         values ($1,$2,$3,$4,'OPEN',$5,$5) returning id`,
        [zoneId["kpss-soru-cevap"], pick(seedUserIds), q.title, q.body, at.toISOString()],
      );
      stats.threads++;
      if (chance(0.8)) await addComments(res.rows[0]!.id, at, 4); // answers reuse forum_posts
      await addLikes(res.rows[0]!.id, 5);
    }

    // 7) Effort board (Emek Panosu): weekly XP + enable the economy in dev ------
    // The community leaderboard ranks XP earned since Monday 00:00 UTC, scoped to the exam-type
    // cohort. Grant every active user a spread of XP dated within THIS week so the board is populated
    // for whoever logs in. Idempotent: wipe prior seed XP first (reason='seed.xp'; real grants stay).
    await c.query("delete from ledger_entries where reason = 'seed.xp'");
    const weekStart = startOfWeekUtc(new Date()).getTime();
    const weekSpan = Date.now() - weekStart;
    for (const uid of everyone) {
      const rows = 1 + rand(4); // 1–4 grants → varied weekly totals
      for (let i = 0; i < rows; i++) {
        const amount = 20 + rand(180); // 20–199 XP per grant
        const at = new Date(weekStart + Math.random() * weekSpan);
        await c.query(
          `insert into ledger_entries (user_id, unit, amount, reason, status, created_at)
           values ($1, 'XP', $2, 'seed.xp', 'CONFIRMED', $3)`,
          [uid, amount, at.toISOString()],
        );
        stats.xpRows++;
      }
    }
    // Turn on the economy so the board's XP/level/leaderboard are visible (dev only). Direct override
    // upsert — the running API caches config, so RESTART the api (or toggle via admin) to pick it up.
    await c.query(
      `insert into config_overrides (key, value, updated_at)
       values ('economy.enabled', 'true'::jsonb, now())
       on conflict (key) do update set value = 'true'::jsonb, updated_at = now()`,
    );

    await c.query("COMMIT");
    console.log("Forum seed complete:", JSON.stringify(stats, null, 2));
    console.log("economy.enabled override set → RESTART the api (or toggle in admin) for it to apply.");
  } catch (err) {
    await c.query("ROLLBACK");
    throw err;
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Forum seed failed:", err);
  process.exit(1);
});
