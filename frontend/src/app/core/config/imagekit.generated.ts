/** Updated by `npm run media:imagekit`; the endpoint is public, never a secret. */
export const IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/0ygikjead/catering';

export function imageKitMediaUrl(path: string): string {
  if (!IMAGEKIT_URL_ENDPOINT || !path.startsWith('/')) return path;
  return `${IMAGEKIT_URL_ENDPOINT}/fk-catering${path}`;
}
