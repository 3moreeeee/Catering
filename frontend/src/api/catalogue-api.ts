import type { Request } from 'express';

/**
 * The catalogue API as seen from this Node server: CATALOGUE_API_URL when set,
 * otherwise this site's own `/api`, which the host forwards to the backend
 * (vercel.json). Same route the server-rendered pages use.
 */
export function catalogueApi(req: Request): string {
  const configured = process.env['CATALOGUE_API_URL']?.replace(/\/+$/, '');
  return configured || `${req.protocol}://${req.get('host')}/api`;
}
