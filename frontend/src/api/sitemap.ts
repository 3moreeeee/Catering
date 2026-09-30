import type { Request, Response } from 'express';
import { CATEGORIES } from '../app/data/assistant-knowledge';
import { catalogueApi } from './catalogue-api';

const ORIGIN = 'https://www.catering.com.tn';
const LOCALES = ['fr', 'en'] as const;

interface SitemapEntry {
  readonly slug: string;
  readonly categoryId: string;
  readonly updatedAt: string | null;
}

/** Indexable pages without catalogue data of their own. Legal pages and 404 are noindex. */
const STATIC_PATHS: readonly { path: string; priority: string; changefreq: string }[] = [
  { path: '', priority: '1.0', changefreq: 'weekly' },
  { path: 'products', priority: '0.9', changefreq: 'weekly' },
  ...CATEGORIES.map((category) => ({
    path: `products/${category.slug}`,
    priority: '0.8',
    changefreq: 'weekly',
  })),
  { path: 'about', priority: '0.7', changefreq: 'monthly' },
  { path: 'brands', priority: '0.7', changefreq: 'monthly' },
  { path: 'industries', priority: '0.7', changefreq: 'monthly' },
  { path: 'contact', priority: '0.7', changefreq: 'monthly' },
];

type Fetch = (url: string, init?: RequestInit) => Promise<globalThis.Response>;

/**
 * sitemap.xml, generated per request from the active catalogue in the
 * database: a product added in the back office is listed on the next crawl,
 * a deactivated one disappears. If the API cannot answer, the response is a
 * 503 so crawlers retry, rather than a sitemap that silently drops every product.
 */
export async function buildSitemap(api: string, fetcher: Fetch = fetch): Promise<string | null> {
  let entries: readonly SitemapEntry[];
  try {
    const response = await fetcher(`${api}/products/sitemap`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    entries = (await response.json()) as SitemapEntry[];
  } catch {
    return null;
  }

  const today = new Date().toISOString().split('T')[0]!;
  const urls = [
    ...STATIC_PATHS.map((page) => ({ ...page, lastmod: today })),
    ...entries.map((entry) => ({
      path: `products/${CATEGORIES.find((c) => c.id === entry.categoryId)?.slug ?? entry.categoryId}/${entry.slug}`,
      priority: '0.6',
      changefreq: 'weekly',
      lastmod: entry.updatedAt ? entry.updatedAt.split('T')[0]! : today,
    })),
  ];

  const href = (locale: string, path: string): string =>
    escapeXml(`${ORIGIN}/${locale}${path ? `/${path}` : ''}`);
  const body = urls
    .flatMap((url) =>
      LOCALES.map(
        (locale) => `  <url>
    <loc>${href(locale, url.path)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
${LOCALES.map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt}" href="${href(alt, url.path)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${href('fr', url.path)}"/>
  </url>`,
      ),
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;
}

export async function handleSitemap(req: Request, res: Response): Promise<void> {
  const xml = await buildSitemap(catalogueApi(req));
  if (xml === null) {
    res.setHeader('Retry-After', '300');
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).type('text/plain').send('Catalogue temporarily unavailable.');
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).type('application/xml').send(xml);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
