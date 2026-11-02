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
const { withServiceContext } = load('database/rls.ts');
const { ContentService } = load('modules/content/application/content.service.ts');
const { InfoArticleRepository } = load('modules/content/infrastructure/info-article.repository.ts');
const { ExamRepository } = load('modules/content/infrastructure/exam.repository.ts');
const { ExamEventRepository } = load('modules/content/infrastructure/exam-event.repository.ts');
const { SubjectRepository } = load('modules/content/infrastructure/subject.repository.ts');
const { TopicRepository } = load('modules/content/infrastructure/topic.repository.ts');
const { PublicHolidayRepository } = load('modules/content/infrastructure/public-holiday.repository.ts');
const { R2StorageAdapter } = load('shared/adapters/storage/r2-storage.adapter.ts');
const { ConfigService } = apiRequire('@nestjs/config');
const { EventEmitter2 } = apiRequire('@nestjs/event-emitter');
const { upsertArticleSchema } = apiRequire('@mentor/validation');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const directory = path.join(root, 'docs/editorial/yks');

async function main() {
  const mode = process.argv[2];
  if (!['dry-run', 'apply-local'].includes(mode)) throw Error('Explicit mode required');
  const env = apiRequire('dotenv').parse(fs.readFileSync(path.join(root, 'apps/api/.env')));
  const target = new URL(env.DATABASE_URL);
  if (target.hostname !== 'localhost' || target.port !== '5433' || target.pathname !== '/mentor') throw Error('Local database only');
  if (env.NODE_ENV !== 'development' || env.STORAGE_PROVIDER !== 'r2' || env.R2_PUBLIC_BUCKET !== 'mentor-public' ||
      (env.STORAGE_ACCESS_MODE && env.STORAGE_ACCESS_MODE !== 'direct')) throw Error('Unexpected development storage');
  const sourceFile = path.join(directory, 'media-sources.json');
  const sources = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  if (sources.images.length !== 7) throw Error('Exactly seven covers required');
  const publication = JSON.parse(fs.readFileSync(path.join(directory, 'publication-local.json'), 'utf8'));
  const config = new ConfigService({ ...env, STORAGE_ACCESS_MODE: 'direct', R2_JURISDICTION: env.R2_JURISDICTION ?? 'auto' });
  const storage = new R2StorageAdapter(config);
  const repo = new InfoArticleRepository();
  const emitter = new EventEmitter2();
  const events = [];
  emitter.onAny((name, payload) => events.push({ name, slug: payload.slug }));
  const content = (handle) => new ContentService(handle, new ExamRepository(), new ExamEventRepository(), repo,
    new SubjectRepository(), new TopicRepository(), new PublicHolidayRepository(), emitter, storage);
  const pool = createPool(env.DATABASE_URL);
  const db = createDatabase(pool);
  try {
    const snapshots = await withServiceContext(db, async (tx) => {
      const rows = [];
      for (const image of sources.images) {
        const row = await repo.findBySlug(tx, image.slug);
        if (!row?.publishedAt || row.family !== 'YKS' || row.bodyFormat !== 'MARKDOWN') throw Error('Unexpected article: ' + image.slug);
        if (row.coverImageKey || row.body.includes('## Görsel kaynağı')) throw Error('Cover/credit already exists: ' + image.slug);
        const original = publication.articles.find((item) => item.slug === row.slug);
        if (!original || sha256(row.body) !== original.bodySha256) throw Error('Article changed since publication: ' + image.slug);
        const bytes = fs.readFileSync(path.join(directory, image.file));
        if (sha256(bytes) !== image.sha256 || bytes.length > 200000 || image.width !== 1200 || image.height !== 630) throw Error('Invalid cover file');
        rows.push(row);
      }
      return rows;
    });
    const inputs = snapshots.map((row) => {
      const image = sources.images.find((item) => item.slug === row.slug);
      const note = row.slug === 'yks-net-hesaplama-puan-kosullari'
        ? 'Fotoğraf, sınav sonrası hesaplama çalışmasını temsil eder.'
        : 'Kapak fotoğrafı temsilidir.';
      const credit = `## Görsel kaynağı\n\nKapak fotoğrafı: [${image.author} / ${image.provider}](${image.sourceUrl}). [${image.license}](${image.licenseUrl}). ${note}`;
      image.creditMarkdown = credit;
      return upsertArticleSchema.parse({ slug: row.slug, title: row.title,
        body: row.body.trim() + '\n\n' + credit + '\n', bodyFormat: row.bodyFormat,
        family: row.family, category: row.category, source: row.source, sourceUrl: row.sourceUrl,
        verifiedAt: row.verifiedAt.toISOString(), verifiedBy: row.verifiedBy,
        metaTitle: row.metaTitle, metaDescription: row.metaDescription,
        authorName: row.authorName, authorTitle: row.authorTitle, authorBio: row.authorBio,
        coverImageKey: image.storageKey, coverImageAlt: image.alt,
        coverImageWidth: image.width, coverImageHeight: image.height });
    });
    console.log(JSON.stringify({ mode, validated: inputs.length, totalCoverBytes: sources.images.reduce((sum, image) => sum + image.bytes, 0), database: 'LOCAL', storageBucket: 'mentor-public' }));
    if (mode === 'dry-run') return;
    fs.writeFileSync(path.join(root, 'tmp/yks-blog-images/before-articles.json'), JSON.stringify(snapshots, null, 2));
    for (const image of sources.images) {
      const bytes = fs.readFileSync(path.join(directory, image.file));
      await storage.putObject(image.storageKey, bytes, 'image/webp');
      const publicUrl = storage.getPublicUrl(image.storageKey);
      const response = await fetch(publicUrl, { signal: AbortSignal.timeout(20000) });
      const received = Buffer.from(await response.arrayBuffer());
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/webp') || sha256(received) !== image.sha256) throw Error('Uploaded image verification failed: ' + image.slug);
      image.publicUrl = publicUrl;
      console.log('UPLOADED_AND_VERIFIED', image.slug);
    }
    const after = await db.transaction(async (outerTx) => {
      const service = content(outerTx);
      for (const input of inputs) await service.upsertArticle(input);
      return withServiceContext(outerTx, async (tx) => {
        const rows = [];
        for (const input of inputs) {
          const row = await repo.findBySlug(tx, input.slug);
          const old = snapshots.find((item) => item.slug === input.slug);
          if (row.body !== input.body || row.coverImageKey !== input.coverImageKey || row.publishedAt.toISOString() !== old.publishedAt.toISOString()) throw Error('Post-write verification failed');
          rows.push({ slug: row.slug, coverImageKey: row.coverImageKey, bodySha256: sha256(row.body), publishedAt: row.publishedAt.toISOString() });
        }
        return rows;
      });
    });
    const manifestPath = path.join(directory, 'metadata.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const article of manifest.articles) {
      const image = sources.images.find((item) => item.slug === article.slug);
      Object.assign(article, { coverImageKey: image.storageKey, coverImageAlt: image.alt, coverImageWidth: image.width, coverImageHeight: image.height });
      const bodyPath = path.join(directory, article.bodyFile);
      const body = fs.readFileSync(bodyPath, 'utf8');
      if (!body.includes('## Görsel kaynağı')) fs.writeFileSync(bodyPath, body.trim() + '\n\n' + image.creditMarkdown + '\n');
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(sourceFile, JSON.stringify(sources, null, 2) + '\n');
    const receipt = { appliedAt: new Date().toISOString(), environment: 'LOCAL', database: 'localhost:5433/mentor',
      storage: { provider: 'R2', bucket: 'mentor-public', purpose: 'Existing development media storage' },
      method: 'ContentService.upsertArticle in a single outer transaction', sourceManifest: 'media-sources.json',
      totalBytes: sources.images.reduce((sum, image) => sum + image.bytes, 0), events, articles: after };
    fs.writeFileSync(path.join(directory, 'media-publication-local.json'), JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify({ updated: after.length, publicationDatesPreserved: true, receipt: 'docs/editorial/yks/media-publication-local.json' }));
  } finally { await pool.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
