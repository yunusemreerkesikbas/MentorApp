const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
apiRequire('reflect-metadata');
apiRequire('ts-node').register({ transpileOnly: true, project: path.join(root, 'apps/api/tsconfig.json') });
const load = (file) => require(path.join(root, 'apps/api/src', file));
const { createPool, createDatabase } = load('database/drizzle.ts');
const { ContentService } = load('modules/content/application/content.service.ts');
const { InfoArticleRepository } = load('modules/content/infrastructure/info-article.repository.ts');
const { ExamRepository } = load('modules/content/infrastructure/exam.repository.ts');
const { ExamEventRepository } = load('modules/content/infrastructure/exam-event.repository.ts');
const { SubjectRepository } = load('modules/content/infrastructure/subject.repository.ts');
const { TopicRepository } = load('modules/content/infrastructure/topic.repository.ts');
const { PublicHolidayRepository } = load('modules/content/infrastructure/public-holiday.repository.ts');
const { withServiceContext } = load('database/rls.ts');
const { EventEmitter2 } = apiRequire('@nestjs/event-emitter');
const { upsertArticleSchema } = apiRequire('@mentor/validation');

async function main() {
  const mode = process.argv[2];
  if (!['dry-run', 'publish-local'].includes(mode)) throw Error('Explicit mode required');
  const env = apiRequire('dotenv').parse(fs.readFileSync(path.join(root, 'apps/api/.env')));
  const target = new URL(env.DATABASE_URL);
  if (target.hostname !== 'localhost' || target.port !== '5433' || target.pathname !== '/mentor') {
    throw Error('This one-off operation only supports localhost:5433/mentor');
  }
  const directory = path.join(root, 'docs/editorial/yks');
  const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'metadata.json'), 'utf8'));
  if (metadata.articles.length !== 7) throw Error('Expected exactly seven articles');
  const at = new Date().toISOString();
  const inputs = metadata.articles.map(({ bodyFile, editorial, publishedAt, ...fields }) => {
    const related = editorial.relatedArticles.map((item) => `- [${item.anchor}](http://localhost:3000/blog/${item.slug})`).join('\n');
    const body = fs.readFileSync(path.join(directory, bodyFile), 'utf8').trim() + '\n\n## İlgili yazılar\n\n' + related + '\n';
    return upsertArticleSchema.parse({ ...fields, body, authorName: 'PuhuKoç',
      verifiedBy: 'ÖSYM kaynak karşılaştırması (otomatik)', verifiedAt: at });
  });
  const pool = createPool(env.DATABASE_URL);
  const db = createDatabase(pool);
  const repo = new InfoArticleRepository();
  const emitter = new EventEmitter2();
  const events = [];
  emitter.onAny((name, payload) => events.push({ name, slug: payload.slug }));
  const storage = Object.freeze({ getPublicUrl() { throw Error('Text-only operation cannot access media'); } });
  const content = (handle) => new ContentService(handle, new ExamRepository(), new ExamEventRepository(),
    repo, new SubjectRepository(), new TopicRepository(), new PublicHolidayRepository(), emitter, storage);
  try {
    const preflight = await withServiceContext(db, async (tx) => {
      const found = [];
      for (const input of inputs) {
        const row = await repo.findBySlug(tx, input.slug);
        if (row) found.push(row.slug);
      }
      return found;
    });
    if (preflight.length) throw Error('Existing article(s); refusing to overwrite: ' + preflight.join(', '));
    console.log(JSON.stringify({ mode, environment: 'LOCAL', target: 'localhost:5433/mentor', articles: inputs.length, preflight: 'NO_SLUG_CONFLICTS' }));
    if (mode === 'dry-run') return;
    const written = await db.transaction(async (outerTx) => {
      const service = content(outerTx);
      for (const input of inputs) {
        await service.upsertArticle(input);
        await service.publishArticle(input.slug, at);
      }
      return withServiceContext(outerTx, async (tx) => {
        const rows = [];
        for (const input of inputs) {
          const row = await repo.findBySlug(tx, input.slug);
          if (!row?.publishedAt || row.body !== input.body || row.metaTitle !== input.metaTitle || row.family !== 'YKS') {
            throw Error('Verification failed for ' + input.slug);
          }
          rows.push({ id: row.id, slug: row.slug, publishedAt: row.publishedAt.toISOString(),
            verifiedAt: row.verifiedAt.toISOString(), verifiedBy: row.verifiedBy,
            bodySha256: crypto.createHash('sha256').update(row.body).digest('hex'),
            url: 'http://localhost:3000/blog/' + row.slug });
        }
        return rows;
      });
    });
    const receipt = { environment: 'LOCAL', database: 'localhost:5433/mentor', publishedAt: at,
      method: 'ContentService.upsertArticle + ContentService.publishArticle, single outer transaction',
      operator: 'Automated execution of user publication request', events, articles: written };
    fs.writeFileSync(path.join(directory, 'publication-local.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify({ published: written.length, events: events.length, receipt: 'docs/editorial/yks/publication-local.json' }));
  } finally { await pool.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
