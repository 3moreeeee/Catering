// Removes only large, neutral background regions from official brand artwork.
// Small enclosed white details (for example Mayor's lettering) are preserved.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'public', 'img', 'brands');
const files = (await readdir(dir)).filter((name) => name.endsWith('.jpg'));

for (const name of files) {
  const input = path.join(dir, name);
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const count = width * height;
  const candidate = new Uint8Array(count);
  const visited = new Uint8Array(count);

  for (let pixel = 0; pixel < count; pixel++) {
    const offset = pixel * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    candidate[pixel] = a > 0 && r > 195 && g > 195 && b > 185 && spread < 65 ? 1 : 0;
  }

  const minimumBackgroundArea = Math.max(280, Math.round(count * 0.015));
  for (let start = 0; start < count; start++) {
    if (!candidate[start] || visited[start]) continue;
    const component = [];
    const queue = [start];
    visited[start] = 1;

    for (let cursor = 0; cursor < queue.length; cursor++) {
      const pixel = queue[cursor];
      component.push(pixel);
      const x = pixel % width;
      const neighbours = [pixel - width, pixel + width];
      if (x > 0) neighbours.push(pixel - 1);
      if (x + 1 < width) neighbours.push(pixel + 1);
      for (const next of neighbours) {
        if (next >= 0 && next < count && candidate[next] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
      }
    }

    if (component.length >= minimumBackgroundArea) {
      for (const pixel of component) data[pixel * 4 + 3] = 0;
    }
  }

  const output = path.join(dir, name.replace(/\.jpg$/, '.png'));
  await sharp(data, { raw: { width, height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(output);
  console.log(`Prepared ${path.basename(output)}`);
}
