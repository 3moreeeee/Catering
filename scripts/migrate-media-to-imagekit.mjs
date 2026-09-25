/**
 * Uploads served images/videos to ImageKit, then rewrites matching media URLs
 * in Neon in one transaction. Safe to resume through tmp/imagekit-manifest.json.
 * Secrets are read from backend-SpringBoot/.env and are never printed.
 */
import { Blob } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'tmp', 'imagekit-manifest.json');
const generatedConfigPath = path.join(
  root,
  'src',
  'app',
  'core',
  'config',
  'imagekit.generated.ts',
);
const seedPath = path.join(
  root,
  'backend-SpringBoot',
  'src',
  'main',
  'resources',
  'seed',
  'catalog-seed.json',
);

loadEnv([path.join(root, 'backend-SpringBoot', '.env'), path.join(root, 'tmp', '.env')]);

const privateKey = required('IMAGEKIT_PRIVATE_KEY');
const endpoint = required('IMAGEKIT_URL_ENDPOINT').replace(/\/+$/, '');
const databaseUrl =
  process.env.NEON_DATABASE_URL_DIRECT || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Missing NEON_DATABASE_URL_DIRECT or NEON_DATABASE_URL.');
if (!privateKey.startsWith('private_'))
  throw new Error('IMAGEKIT_PRIVATE_KEY has an invalid format.');
if (!/^https:\/\//.test(endpoint)) throw new Error('IMAGEKIT_URL_ENDPOINT must be an HTTPS URL.');
syncPrimaryImageKitEnv();

const files = [
  ...walk(path.join(root, 'public', 'img')),
  ...walk(path.join(root, 'public', 'video')),
].filter((file) => !file.includes(`${path.sep}_original${path.sep}`));
const manifest = readManifest();
const pending = files.filter((file) => !manifest[toWebPath(file)]);

console.log(
  `ImageKit migration: ${files.length} served assets, ${files.length - pending.length} already uploaded, ${pending.length} pending.`,
);

let completed = 0;
const failures = [];
await parallel(pending, 5, async (file) => {
  const webPath = toWebPath(file);
  try {
    manifest[webPath] = await upload(file, webPath);
    completed += 1;
    writeManifest(manifest);
    if (completed % 25 === 0 || completed === pending.length) {
      console.log(`Uploaded ${completed}/${pending.length}.`);
    }
  } catch (error) {
    failures.push(`${webPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
});

if (failures.length) {
  console.error(`Upload stopped with ${failures.length} failed asset(s):`);
  for (const failure of failures.slice(0, 20)) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  await rewriteNeonUrls(manifest, databaseUrl);
  rewriteSeed(manifest);
  writeGeneratedConfig(endpoint);
  console.log(
    `ImageKit migration complete: ${Object.keys(manifest).length} assets mapped; Neon URLs updated.`,
  );
}

async function upload(file, webPath) {
  const relativeDirectory = path.posix.dirname(webPath);
  const form = new FormData();
  form.set('file', new Blob([await fs.promises.readFile(file)]), path.basename(file));
  form.set('fileName', path.basename(file));
  form.set('folder', `/fk-catering${relativeDirectory}`);
  form.set('useUniqueFileName', 'false');
  form.set('isPrivateFile', 'false');
  form.set('tags', 'fk-catering,migrated');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}` },
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    if (response.ok) {
      const result = await response.json();
      if (!result.url) throw new Error('ImageKit returned no URL.');
      return result.url;
    }
    const body = await response.text();
    if (attempt === 3 || (response.status < 429 && response.status < 500)) {
      throw new Error(`HTTP ${response.status} ${body.slice(0, 180)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
  }
  throw new Error('Upload failed.');
}

async function rewriteNeonUrls(mapping, connectionString) {
  const rows = Object.entries(mapping).map(([localPath, remoteUrl]) => ({
    local_path: localPath,
    remote_url: remoteUrl,
  }));
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    const payload = JSON.stringify(rows);
    await client.query(
      `update product_images p set src = m.remote_url
       from jsonb_to_recordset($1::jsonb) as m(local_path text, remote_url text)
       where p.src = m.local_path`,
      [payload],
    );
    await client.query(
      `update categories c set image = m.remote_url
       from jsonb_to_recordset($1::jsonb) as m(local_path text, remote_url text)
       where c.image = m.local_path`,
      [payload],
    );
    await client.query(
      `update brands b set logo = m.remote_url
       from jsonb_to_recordset($1::jsonb) as m(local_path text, remote_url text)
       where b.logo = m.local_path`,
      [payload],
    );
    await client.query('commit');
    const verification = await client.query(`
      select
        (select count(*) from products) as products,
        (select count(*) from products where price is not null) as priced_products,
        (select count(*) from products where description_fr is not null and description_fr <> '') as described_products,
        (select count(*) from products where offer_price is not null) as offers,
        (select count(*) from product_images) as product_images,
        (select count(*) from product_images where src like 'http%') as hosted_product_images,
        (select min(src) from product_images) as sample_product_image,
        (select count(*) from categories) as categories,
        (select count(*) from brands) as brands,
        (select count(*) from persons) as users,
        (select count(*) from carts) as carts,
        (select count(*) from quotes) as quotes
    `);
    const counts = verification.rows[0];
    console.log(
      `Neon verified: ${counts.products} products (${counts.priced_products} priced, ${counts.described_products} described), ` +
        `${counts.hosted_product_images}/${counts.product_images} product images hosted, ${counts.categories} categories, ` +
        `${counts.brands} brands, ${counts.users} users, ${counts.carts} carts, ${counts.quotes} quotes, ${counts.offers} offers.`,
    );
    if (counts.hosted_product_images !== counts.product_images) {
      console.log(`Unmatched Neon image example: ${counts.sample_product_image}`);
    }
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

function rewriteSeed(mapping) {
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  for (const category of seed.categories ?? [])
    if (mapping[category.image]) category.image = mapping[category.image];
  for (const brand of seed.brands ?? []) if (mapping[brand.logo]) brand.logo = mapping[brand.logo];
  for (const product of seed.products ?? []) {
    for (const image of product.images ?? [])
      if (mapping[image.src]) image.src = mapping[image.src];
  }
  fs.writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
}

function writeGeneratedConfig(url) {
  fs.writeFileSync(
    generatedConfigPath,
    `/** Updated by \`npm run media:imagekit\`; the endpoint is public, never a secret. */\n` +
      `export const IMAGEKIT_URL_ENDPOINT = ${JSON.stringify(url)};\n\n` +
      `export function imageKitMediaUrl(path: string): string {\n` +
      `  if (!IMAGEKIT_URL_ENDPOINT || !path.startsWith('/')) return path;\n` +
      `  return \`${'${IMAGEKIT_URL_ENDPOINT}'}/fk-catering${'${path}'}\`;\n` +
      `}\n`,
    'utf8',
  );
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function toWebPath(file) {
  return `/${path.relative(path.join(root, 'public'), file).split(path.sep).join('/')}`;
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) return {};
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function writeManifest(value) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function parallel(items, concurrency, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) await worker(queue.shift());
    }),
  );
}

function loadEnv(candidates) {
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    for (const raw of fs.readFileSync(candidate, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
    // Continue so a secondary file can fill variables intentionally left blank
    // in the primary backend .env. Existing non-empty values keep precedence.
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function syncPrimaryImageKitEnv() {
  const target = path.join(root, 'backend-SpringBoot', '.env');
  if (!fs.existsSync(target)) return;
  let content = fs.readFileSync(target, 'utf8');
  for (const name of ['IMAGEKIT_PUBLIC_KEY', 'IMAGEKIT_PRIVATE_KEY', 'IMAGEKIT_URL_ENDPOINT']) {
    const value = process.env[name]?.trim();
    if (!value) continue;
    const pattern = new RegExp(`^(${name}=)\\s*$`, 'm');
    if (pattern.test(content)) content = content.replace(pattern, `$1${value}`);
  }
  fs.writeFileSync(target, content, 'utf8');
}
