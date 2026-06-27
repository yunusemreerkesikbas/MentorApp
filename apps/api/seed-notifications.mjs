import { Pool } from "pg";

const pool = new Pool({ connectionString: "postgres://mentor:mentor@localhost:5433/mentor" });

const { rows: users } = await pool.query(
  "SELECT id, email FROM users WHERE exam_type IS NOT NULL"
);
console.log(`Seeding ${users.length} users...`);

const templates = [
  { category: "COACH",   title: "Koçundan bir not",       body: "Bugün çalışma planına bak, hedeflerine bir adım daha yaklaş!" },
  { category: "PLAN",    title: "Planın güncellendi",      body: "Bugünkü 3 görev seni bekliyor. Hazır mısın?" },
  { category: "CONTENT", title: "Yeni içerik eklendi",     body: "Tarih konusunda yeni bir özet yayınlandı. İncele!" },
  { category: "COACH",   title: "Pomodoro tekniği",        body: "25 dk odak, 5 dk mola — dene ve farkı gör." },
  { category: "PLAN",    title: "Dünkü görev eksik kaldı", body: "Dün tamamlayamadığın görevi bugün yapmayı unutma." },
];

for (const user of users) {
  await pool.query("DELETE FROM user_notifications WHERE user_id = $1", [user.id]);
  for (const n of templates) {
    await pool.query(
      "INSERT INTO user_notifications (user_id, category, title, body) VALUES ($1, $2, $3, $4)",
      [user.id, n.category, n.title, n.body]
    );
  }
  console.log("  ✓", user.email);
}

console.log("Done!");
await pool.end();
