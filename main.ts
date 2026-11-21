// Gallery of Shadows — entry program (Node 22, standard library only).
// Copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json with the vendored make.fun library.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight: refuse to hand in a bundle the gate would reject, instead of
// writing a broken /output. Checks the entry point, the screenshot count and
// size caps, and that every screenshot is a whole JPEG or PNG by its magic.
const indexHtml = join(here, 'game', 'index.html');
if (!existsSync(indexHtml)) throw new Error('missing game/index.html');
if (statSync(indexHtml).size > 1024 * 1024) throw new Error('game/index.html over 1 MiB');
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => !f.startsWith('.')).sort() : [];
if (shots.length < 3 || shots.length > 4) throw new Error(`need 3-4 screenshots, found ${shots.length}`);
for (const shot of shots) {
  const buf = readFileSync(join(shotsDir, shot));
  if (buf.length > 262144) throw new Error(`screenshot ${shot} over 256 KiB`);
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (!isJpeg && !isPng) throw new Error(`screenshot ${shot} is not a JPEG or PNG`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
if (Buffer.byteLength(dossier) > 1572864) throw new Error('dossier.json over 1.5 MiB');
writeFileSync(join(out, 'dossier.json'), dossier);
// Post-write sanity: the dossier must parse back as the JSON buildDossier wrote.
JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
