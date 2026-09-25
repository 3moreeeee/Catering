/**
 * Vercel entry point for Angular SSR.
 *
 * Vercel serves dist/fk-catering/browser as static files, which covers every
 * prerendered page and asset. Anything it cannot find there — the bare `/`
 * locale redirect, legacy WordPress URLs, unknown paths, and the /api routes
 * declared in src/server.ts — is rewritten here (see vercel.json) and handled
 * by the same Express app that `npm run serve:ssr:fk-catering` runs locally.
 * The original request URL is preserved through the rewrite.
 */
const serverModule = import('../dist/fk-catering/server/server.mjs');

export default async function handler(req, res) {
  const { reqHandler } = await serverModule;
  return reqHandler(req, res);
}
