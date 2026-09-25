// =============================================================================
// VIDEO PIPELINE
//
// Turns the generator's masters in public/videos-claude-prompt/ into web
// deliverables in public/video/ and public/img/chapters/.
//
// A generator gives you a master, not a web asset: 720p at 1.5–3.6 Mbit/s with
// an audio track nobody will ever hear. This script produces, per film:
//
//   public/video/<slug>.mp4          H.264, desktop 16:9, no audio
//   public/video/<slug>.av1.mp4      AV1 if the local ffmpeg can encode it
//   public/video/<slug>.mobile.mp4   H.264, 4:5 centre crop for narrow screens
//   public/img/chapters/<slug>.avif  poster, AVIF
//   public/img/chapters/<slug>.webp  poster, WebP fallback
//   public/img/chapters/<slug>.jpg   poster, universal fallback
//
// The poster is the LCP element on the homepage, so it is produced at the same
// pixel dimensions the hero renders at and never scaled up in the browser.
//
// Sources are never modified. Re-running is safe and idempotent.
//
// Usage:  node scripts/prepare-videos.mjs [--force]
// =============================================================================

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, stat, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SRC_DIR = path.join(root, 'public', 'videos-claude-prompt');
const VIDEO_OUT = path.join(root, 'public', 'video');
const POSTER_OUT = path.join(root, 'public', 'img', 'chapters');
const SOURCE_DIRS = [SRC_DIR, VIDEO_OUT];

const force = process.argv.includes('--force');

/**
 * The mapping from generator filename to site slug.
 *
 * `posterAt` is a fraction of the film's duration. It is chosen per film as the
 * moment the composition has settled — usually near the end, because every
 * chapter is directed to finish on a stable frame. This frame is what most
 * visitors on a phone will actually see, so it is picked deliberately rather
 * than defaulting to frame 0.
 *
 * `bakedText` records films that have French copy rendered into the picture.
 * Those cannot ship in the English locale and are reported at the end of the
 * run so the defect stays visible.
 *
 * `crop` is an ffmpeg crop rectangle applied before every other filter. It is
 * used to cut burned-in copy out of the frame so the site can render its own
 * translatable headline instead. Cropping costs composition, so it is a
 * stopgap: the correct fix is to regenerate the film without text. Each crop
 * records what it removes and what it protects.
 */
const FILMS = [
  {
    match: '20260910194818',
    slug: 'hero-products',
    posterAt: 0.9,
    bakedText: false,
    keepWidthOnMobile: true,
  },
  {
    match: 'Syrup_pouring_into_iced_drink',
    slug: 'monin-fraicheur',
    posterAt: 0.62,
    bakedText: false,
  },
  {
    match: 'Mustard_descending_on_burger',
    slug: 'sauce-burger',
    posterAt: 0.88,
    bakedText: false,
  },
  {
    match: 'Camera_panning_across_cooking_meat',
    slug: 'delicio-grill',
    posterAt: 0.9,
    bakedText: true,
    // Removes the right 500px, which carries "Des sauces pensées pour la
    // cuisson" plus a visible tonal seam in the background. Keeps the Delicio
    // bottle (x≈130–290) and the whole steak (right edge x≈760).
    crop: 'crop=780:720:0:0',
  },
  {
    match: 'Camera_orbiting_verrine_dessert',
    slug: 'emballage-verrine',
    posterAt: 0.75,
    bakedText: true,
    // "Votre produit mérite sa présentation." fades in at about 5.4s. Trimming
    // before it keeps the entire composition — a crop would have had to cut
    // through the middle of the frame, where the verrine is.
    trimEnd: 5.0,
  },
  {
    match: 'Translucent_coat_hanging_in_light',
    slug: 'hygiene-protocole',
    posterAt: 0.25,
    bakedText: true,
    // The headline appears here at about 1.5s, so only the opening is usable.
    // 1.4s alone would read as a twitch, so the segment is played forward then
    // backward into a 2.8s loop that returns to its own first frame. The shot
    // is a slow drift of hanging fabric, which survives that treatment without
    // looking reversed.
    trimEnd: 1.4,
    pingPong: true,
  },
  {
    match: 'Product_animation_dropping_and_l',
    slug: 'selection-1985',
    // The last frame, and this one is load-bearing rather than a preference.
    // The hero plays this film exactly once and then holds on its final frame,
    // so the poster underneath has to be that same frame: it is what a visitor
    // sees before the film starts, what remains after it ends, and what stands
    // in for the film entirely under reduced motion, Save-Data or no
    // JavaScript. Any other still would show the row half-assembled.
    //
    // Not 1.0: the poster is grabbed with an input seek, and seeking to the
    // very last frame of a 5.013s file lands past the end and writes nothing.
    // 0.975 is 4.89s — the row has been at rest since about 4.7s, so this is
    // the settled frame with two frames in hand.
    posterAt: 0.975,
    // No crop, no trim: the generator delivered this one clean.
    bakedText: false,
    // The whole subject is the width of the frame — nine references landing in
    // a row — so a narrow screen keeps the full width and gets a shorter band
    // rather than a 4:5 slice with two thirds of the catalogue cut off.
    keepWidthOnMobile: true,
  },
  {
    // The hero's previous film: a lateral tracking shot across the same row.
    // Superseded by the drop above, which says the same thing without a baked
    // French headline and without needing 5.6s trimmed off the front to find a
    // frame where every reference is present. Kept here, unwired, because the
    // master is still in the repository and the mapping is the record of what
    // it was and why it is no longer used.
    match: 'Camera_tracking_product_display',
    slug: 'selection-tracking',
    posterAt: 0.95,
    bakedText: true,
    crop: 'crop=1280:530:0:190',
    keepWidthOnMobile: true,
    trimStart: 5.6,
    retired: true,
  },
  {
    match: 'Spoon_lifting_mayonnaise',
    slug: 'delicio-mayonnaise',
    posterAt: 0.4,
    bakedText: true,
    // The baked headline contains a typo — "à l'échelle peohelle
    // professionnelle". Not wired into the site until it is regenerated.
    broken: true,
  },
];

async function ffmpegHasEncoder(name) {
  try {
    const { stdout } = await run('ffmpeg', ['-hide_banner', '-encoders'], {
      maxBuffer: 1024 * 1024 * 8,
    });
    return stdout.includes(name);
  } catch {
    return false;
  }
}

async function probeDuration(file) {
  const { stdout } = await run('ffprobe', [
    '-v',
    'quiet',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    file,
  ]);
  return Number.parseFloat(stdout.trim());
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function sizeKb(file) {
  const info = await stat(file);
  return Math.round(info.size / 1024);
}

/**
 * Encodes one variant, stepping the quality down until the file fits its
 * ceiling. Food macro tolerates compression well — the first thing to break is
 * grain in the shadows — so walking CRF up is safer than dropping resolution.
 */
async function encodeUnderBudget(input, output, buildArgs, crfLadder, ceilingKb) {
  for (const crf of crfLadder) {
    await run('ffmpeg', ['-y', '-v', 'error', '-i', input, ...buildArgs(crf), output], {
      maxBuffer: 1024 * 1024 * 16,
    });
    const kb = await sizeKb(output);
    if (kb <= ceilingKb) {
      return { crf, kb, underBudget: true };
    }
  }
  return { crf: crfLadder.at(-1), kb: await sizeKb(output), underBudget: false };
}

async function main() {
  await mkdir(VIDEO_OUT, { recursive: true });
  await mkdir(POSTER_OUT, { recursive: true });

  const sources = (
    await Promise.all(
      SOURCE_DIRS.map(async (dir) =>
        (await readdir(dir)).map((name) => ({ dir, name })),
      ),
    )
  ).flat();
  const hasAv1 = await ffmpegHasEncoder('libsvtav1');
  if (!hasAv1) {
    console.log('note: libsvtav1 not available in this ffmpeg — skipping AV1 variants.\n');
  }

  const report = [];

  for (const film of FILMS) {
    if (film.retired) {
      console.log(`SKIP  ${film.slug} — retired, kept only as a record of the mapping`);
      continue;
    }
    const source = sources.find(({ name }) => name.includes(film.match));
    if (!source) {
      console.log(`SKIP  ${film.slug} — no source matching "${film.match}"`);
      continue;
    }
    const input = path.join(source.dir, source.name);

    const desktop = path.join(VIDEO_OUT, `${film.slug}.mp4`);
    const av1 = path.join(VIDEO_OUT, `${film.slug}.av1.mp4`);
    const mobile = path.join(VIDEO_OUT, `${film.slug}.mobile.mp4`);
    const posterPng = path.join(POSTER_OUT, `${film.slug}.png`);

    if (!force && (await exists(desktop)) && (await exists(posterPng.replace('.png', '.avif')))) {
      console.log(`KEEP  ${film.slug} — already built (use --force to rebuild)`);
      continue;
    }

    const duration = await probeDuration(input);
    // The poster must come from the part of the film that actually ships, so it
    // is timed inside the trimmed segment, never against the master's length.
    const start = film.trimStart ?? 0;
    const usable = film.trimEnd ?? duration - start;
    const posterTime = (start + usable * film.posterAt).toFixed(2);

    /**
     * Builds the video-filter arguments for one variant.
     *
     * The crop always comes first. When a film is ping-ponged the chain has to
     * move into `-filter_complex`, because the segment is split, reversed and
     * concatenated onto itself to produce a loop that ends on its own first
     * frame — `-vf` cannot express that.
     */
    const vf = (...parts) => {
      const chain = [film.crop, ...parts].filter(Boolean).join(',');
      if (!film.pingPong) {
        return chain ? ['-vf', chain] : [];
      }
      const head = chain ? `[0:v]${chain},split[a][b]` : '[0:v]split[a][b]';
      return ['-filter_complex', `${head};[b]reverse[r];[a][r]concat=n=2:v=1[v]`, '-map', '[v]'];
    };

    /**
     * Cuts the film to the segment that ships: `trimStart` seeks past footage
     * that does not serve the composition, `trimEnd` stops before burned-in
     * copy fades in. Both sit after `-i`, which is the accurate-seek form —
     * slower than seeking on the input, and worth it at these file sizes.
     */
    const trim = [
      ...(film.trimStart ? ['-ss', String(film.trimStart)] : []),
      ...(film.trimEnd ? ['-t', String(film.trimEnd)] : []),
    ];

    // ---- desktop H.264 -----------------------------------------------------
    // -an strips audio: the page plays muted, so an audio track is pure weight.
    // +faststart moves the index to the front so playback can begin on the
    // first bytes rather than after the whole file has arrived.
    const h264 = await encodeUnderBudget(
      input,
      desktop,
      (crf) => [
        ...trim,
        ...vf(),
        '-c:v',
        'libx264',
        '-crf',
        String(crf),
        '-preset',
        'slow',
        '-profile:v',
        'high',
        '-pix_fmt',
        'yuv420p',
        '-an',
        '-movflags',
        '+faststart',
      ],
      [26, 29, 32, 35, 38],
      900,
    );

    // ---- AV1 ---------------------------------------------------------------
    let av1Result = null;
    if (hasAv1) {
      av1Result = await encodeUnderBudget(
        input,
        av1,
        (crf) => [
          ...trim,
          ...vf(),
          '-c:v',
          'libsvtav1',
          '-crf',
          String(crf),
          '-preset',
          '6',
          '-pix_fmt',
          'yuv420p',
          '-an',
          '-movflags',
          '+faststart',
        ],
        [34, 38, 42, 46, 50],
        600,
      );
    }

    // ---- mobile 4:5 centre crop -------------------------------------------
    // Not a scaled desktop file: a narrow screen gets its own framing, so the
    // subject still fills the frame at 390px instead of becoming a detail.
    const mobileResult = await encodeUnderBudget(
      input,
      mobile,
      (crf) => [
        ...trim,
        // A narrow screen gets its own framing rather than a scaled-down
        // desktop file. The default is a 4:5 centre slice, but a film whose
        // whole subject is the width of the frame — the product row — keeps
        // its full width and simply becomes a shorter band.
        ...vf(...(film.keepWidthOnMobile ? ['scale=720:-2'] : ['crop=ih*4/5:ih', 'scale=720:-2'])),
        '-c:v',
        'libx264',
        '-crf',
        String(crf),
        '-preset',
        'slow',
        '-pix_fmt',
        'yuv420p',
        '-an',
        '-movflags',
        '+faststart',
      ],
      [28, 31, 34, 37, 40],
      500,
    );

    // ---- posters -----------------------------------------------------------
    await run('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-ss',
      posterTime,
      '-i',
      input,
      // Crop only: a single still has nothing to ping-pong.
      ...(film.crop ? ['-vf', film.crop] : []),
      '-frames:v',
      '1',
      posterPng,
    ]);

    const buffer = await sharp(posterPng).toBuffer();
    await sharp(buffer)
      .avif({ quality: 62, effort: 6 })
      .toFile(path.join(POSTER_OUT, `${film.slug}.avif`));
    await sharp(buffer)
      .webp({ quality: 76 })
      .toFile(path.join(POSTER_OUT, `${film.slug}.webp`));
    await sharp(buffer)
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(path.join(POSTER_OUT, `${film.slug}.jpg`));
    await rm(posterPng);

    const posterKb = await sizeKb(path.join(POSTER_OUT, `${film.slug}.avif`));

    report.push({
      slug: film.slug,
      h264: h264.kb,
      h264Ok: h264.underBudget,
      av1: av1Result?.kb ?? null,
      mobile: mobileResult.kb,
      mobileOk: mobileResult.underBudget,
      poster: posterKb,
      bakedText: film.bakedText,
      broken: film.broken ?? false,
    });

    console.log(
      `BUILT ${film.slug.padEnd(20)} h264 ${String(h264.kb).padStart(4)}kB  ` +
        `av1 ${String(av1Result?.kb ?? '—').padStart(4)}kB  ` +
        `mobile ${String(mobileResult.kb).padStart(4)}kB  ` +
        `poster ${String(posterKb).padStart(3)}kB`,
    );
  }

  const over = report.filter((r) => !r.h264Ok || !r.mobileOk);
  const baked = report.filter((r) => r.bakedText);
  const broken = report.filter((r) => r.broken);

  console.log('\n---');
  if (over.length) {
    console.log(`OVER BUDGET: ${over.map((r) => r.slug).join(', ')}`);
  } else if (report.length) {
    console.log('All variants under budget.');
  }
  if (baked.length) {
    console.log(
      `BAKED-IN FRENCH TEXT (blocks the English locale, cannot reflow on mobile):\n  ` +
        baked.map((r) => r.slug).join('\n  '),
    );
  }
  if (broken.length) {
    console.log(`NOT SHIPPABLE: ${broken.map((r) => r.slug).join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
