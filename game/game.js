// Gallery of Shadows — a top-down stealth game.
// You are Wren, a thief in the Meridian Gallery after dark. Slip past the
// guards, pocket three artifacts on every floor, and reach the skylight exit
// unseen. Guards see in cones: stay out of them, hide in the plants, sneak
// when close, and toss a coin to pull a guard away from your path.
// Plain canvas 2D, no libraries, no network: everything is drawn and sounded
// here, in this file.
'use strict';

const TILE = 40;
const COLS = 24;
const ROWS = 15;
const W = COLS * TILE; // 960
const H = ROWS * TILE; // 600

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const $ = (id) => document.getElementById(id);
const hudLevel = $('hud-level'), hudGems = $('hud-gems'), hudCoins = $('hud-coins');
const hudAlert = $('hud-alert'), hudTime = $('hud-time');
const detectBar = $('detect'), detectFill = $('detect-fill');
const toastEl = $('toast'), overlayEl = $('overlay');
const ovTitle = $('ov-title'), ovSub = $('ov-sub'), ovBody = $('ov-body'), ovBtn = $('ov-btn');

// ---- tiny helpers ---------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const tileAt = (tx, ty, map) => {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return map[ty][tx];
};
const isSolid = (ch) => ch === '#' || ch === 'T';
// Line of sight on the tile grid: sample the segment, blocked by walls/cases.
function losClear(x0, y0, x1, y1, map) {
  const d = dist(x0, y0, x1, y1);
  const steps = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const ch = tileAt(Math.floor((x0 + (x1 - x0) * t) / TILE), Math.floor((y0 + (y1 - y0) * t) / TILE), map);
    if (isSolid(ch)) return false;
  }
  return true;
}
// Circle vs solid tiles: slide along walls.
function moveCircle(e, dx, dy, map) {
  const r = e.r;
  let nx = e.x + dx;
  if (!hitsSolid(nx, e.y, r, map)) e.x = nx;
  let ny = e.y + dy;
  if (!hitsSolid(e.x, ny, r, map)) e.y = ny;
}
function hitsSolid(x, y, r, map) {
  const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE), y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!isSolid(tileAt(tx, ty, map))) continue;
      const cx = clamp(x, tx * TILE, tx * TILE + TILE);
      const cy = clamp(y, ty * TILE, ty * TILE + TILE);
      if (dist(x, y, cx, cy) < r) return true;
    }
  }
  return false;
}

// ---- levels ---------------------------------------------------------------
// '#': wall, 'T': display case (cover, blocks sight), 'B': plant (hide spot),
// 'A': artifact, 'E': exit, 'P': player start, 'G': guard spawn.
const LEVELS = [
  {
    name: 'Gallery I — The Grand Hall',
    map: [
      '########################',
      '#P....T....#.....A.....#',
      '#..........#...........#',
      '#..B...T...#....G......#',
      '#..........#...........#',
      '#..T....B......T....#..#',
      '#...................#..#',
      '#..G......T.........#..#',
      '#...................#..#',
      '#..T.....B....T..A..#..#',
      '#......................#',
      '#..B....T.............E#',
      '#......................#',
      '#.....T....B......A....#',
      '########################',
    ],
    guards: [
      { spawn: [17, 3], path: [[17, 3], [19, 3], [19, 7], [17, 7]] },
      { spawn: [3, 7], path: [[3, 7], [2, 7], [2, 12], [9, 12], [9, 7]] },
    ],
    hint: 'Two guards walk the hall. The plants hide you — crouch in them (hold Shift) and a guard can stare straight through you.',
  },
  {
    name: 'Gallery II — The Vault Corridor',
    map: [
      '########################',
      '#P...#......T.....A....#',
      '#....#...............#.#',
      '#.B..#..T......G....#..#',
      '#....#...............#.#',
      '#.T..#..B....T....#....#',
      '#....#..........#......#',
      '#.........G..........#.#',
      '#....#..........#......#',
      '#.B..#..T....B..#......#',
      '#....#...............#.#',
      '#....#..A.....T....#...#',
      '#.T..#..........#......#',
      '#....#..B.....G.....A.E#',
      '########################',
    ],
    guards: [
      { spawn: [15, 3], path: [[15, 3], [19, 3], [19, 9]] },
      { spawn: [10, 7], path: [[10, 7], [10, 12], [14, 12]] },
      { spawn: [14, 13], path: [[14, 13], [18, 13], [18, 10]] },
    ],
    hint: 'Three guards, tighter corridors. A thrown coin (click) pulls the nearest guard to the clink — spend your three coins well.',
  },
  {
    name: 'Gallery III — The Rooftop Gallery',
    map: [

      '########################',
      '#P..T....#......A......#',
      '#........#.............#',
      '#..B..T..#...G.....B...#',
      '#......................#',
      '#...T.B..#...T...#.....#',
      '#........#.......#.....#',
      '#..G.....#..A....#.G...#',
      '#........#.............#',
      '#.....T..#...T...#.....#',
      '#........#.......#.....#',
      '#..BT...........T#.B...#',
      '#........#.......#.....#',
      '#..G..A..#....G.....B.E#',
      '########################',
    ],
    guards: [
      { spawn: [13, 3], path: [[13, 3], [16, 3], [16, 6], [13, 6]] },
      { spawn: [3, 7], path: [[3, 7], [7, 7], [7, 12], [3, 12]] },
      { spawn: [19, 7], path: [[19, 7], [21, 7], [21, 12], [19, 12]] },
      { spawn: [3, 13], path: [[3, 13], [7, 13], [7, 10], [3, 10]] },
      { spawn: [14, 13], path: [[14, 13], [18, 13], [18, 8], [14, 8]] },
    ],
    hint: 'Four guards on the last floor. Take all three artifacts, then slip out through the skylight — and try never to be seen at all.',
  },
];

// ---- game state -----------------------------------------------------------
const S = {
  screen: 'title', // title | play | paused | caught | leveldone | win
  levelIdx: 0,
  map: null,
  player: null,
  guards: [],
  artifacts: [],
  exit: null,
  coins: [],
  coinCount: 3,
  detection: 0, // 0..1, worst guard's view of you
  spotted: 0, // times a guard went fully alert
  ghost: true, // never fully spotted so far
  time: 0, // seconds in this run
  score: 0,
  muted: false,
  frozen: false, // screenshot staging: render only, no updates
  msg: '',
  msgT: 0,
};

// ---- audio (all synthesized, no files) ------------------------------------
let actx = null;
function audio() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
  }
  return actx;
}
function tone(freq, dur, type, vol, when) {
  if (S.muted) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + (when || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol || 0.08, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const sfx = {
  step() { tone(180 + Math.random() * 60, 0.05, 'triangle', 0.015); },
  pickup() { tone(660, 0.12, 'sine', 0.09); tone(990, 0.18, 'sine', 0.09, 0.09); },
  coin() { tone(1320, 0.07, 'square', 0.05); tone(1760, 0.1, 'square', 0.04, 0.06); },
  alert() { tone(220, 0.16, 'sawtooth', 0.11); tone(165, 0.22, 'sawtooth', 0.11, 0.14); },
  caught() { tone(110, 0.5, 'sawtooth', 0.12); tone(82, 0.7, 'sawtooth', 0.12, 0.2); },
  unlock() { tone(523, 0.12, 'sine', 0.09); tone(659, 0.12, 'sine', 0.09, 0.1); tone(784, 0.2, 'sine', 0.09, 0.2); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'sine', 0.1, i * 0.13)); },
};

// ---- level loading --------------------------------------------------------
function loadLevel(idx) {
  const L = LEVELS[idx];
  S.levelIdx = idx;
  S.map = L.map;
  S.guards = [];
  S.artifacts = [];
  S.coins = [];
  S.coinCount = 3;
  S.detection = 0;
  L.map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const cx = x * TILE + TILE / 2, cy = y * TILE + TILE / 2;
      if (ch === 'P') S.player = { x: cx, y: cy, r: 13, face: 0, sneak: false, moving: false, stepT: 0 };
      if (ch === 'A') S.artifacts.push({ x: cx, y: cy, tx: x, ty: y, got: false, bob: Math.random() * 6 });
      if (ch === 'E') S.exit = { x: cx, y: cy, tx: x, ty: y, open: false };
    });
  });
  L.guards.forEach((gd) => {
    S.guards.push({
      x: gd.spawn[0] * TILE + TILE / 2, y: gd.spawn[1] * TILE + TILE / 2, r: 13,
      path: gd.path.map(([px, py]) => ({ x: px * TILE + TILE / 2, y: py * TILE + TILE / 2 })),
      wp: 1, dir: 1, face: Math.PI / 2, pauseT: 0,
      state: 'patrol', // patrol | suspicious | alerted
      target: null, lookT: 0, loseT: 0, suspicion: 0,
      viewDist: 195, fov: (78 * Math.PI) / 180, speed: 72,
    });
  });
  hudLevel.textContent = L.name.split('—')[0].trim();
  showToast(L.hint, 5200);
  updateHud();
}

function tileOf(e) {
  return { x: Math.floor(e.x / TILE), y: Math.floor(e.y / TILE) };
}
function playerHidden() {
  const t = tileOf(S.player);
  return tileAt(t.x, t.y, S.map) === 'B' && S.player.sneak;
}
function playerInBush() {
  const t = tileOf(S.player);
  return tileAt(t.x, t.y, S.map) === 'B';
}

// ---- input ---------------------------------------------------------------
const keys = {};
let mouse = { x: 0, y: 0 };
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'm' || e.key === 'M') toggleMute();
  if ((e.key === 'r' || e.key === 'R') && S.screen === 'caught') startLevel(S.levelIdx);
  if ((e.key === 'Enter' || e.key === ' ') && (S.screen === 'leveldone' || S.screen === 'win')) ovBtn.click();
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * W;
  mouse.y = ((e.clientY - r.top) / r.height) * H;
});
canvas.addEventListener('click', (e) => {
  if (S.screen !== 'play') return;
  const r = canvas.getBoundingClientRect();
  const wx = ((e.clientX - r.left) / r.width) * W;
  const wy = ((e.clientY - r.top) / r.height) * H;
  throwCoin(wx, wy);
});
$('btn-mute').addEventListener('click', toggleMute);
$('btn-pause').addEventListener('click', togglePause);
ovBtn.addEventListener('click', () => {
  audio();
  if (S.screen === 'title') startRun();
  else if (S.screen === 'leveldone') startLevel(S.levelIdx + 1);
  else if (S.screen === 'caught') startLevel(S.levelIdx);
  else if (S.screen === 'win') startRun();
});

function toggleMute() {
  S.muted = !S.muted;
  $('btn-mute').textContent = S.muted ? '✕' : '♪';
  $('btn-mute').style.opacity = S.muted ? 0.55 : 1;
}
function togglePause() {
  if (S.screen === 'play') { S.screen = 'paused'; showOverlay('Paused', 'Take a breath. The guards keep their rounds — they will not wait forever.', 'Resume', ''); }
  else if (S.screen === 'paused') { hideOverlay(); S.screen = 'play'; }
}

// ---- coins ---------------------------------------------------------------
function throwCoin(wx, wy) {
  if (S.coinCount <= 0) { showToast('No coins left — slip past instead.', 1800); return; }
  const p = S.player;
  const d = dist(p.x, p.y, wx, wy);
  const maxThrow = 330;
  const t = d > maxThrow ? maxThrow / d : 1;
  const tx = p.x + (wx - p.x) * t, ty = p.y + (wy - p.y) * t;
  S.coinCount--;
  S.coins.push({ x0: p.x, y0: p.y, x: p.x, y: p.y, tx, ty, t: 0, landed: false, ring: 0 });
  sfx.coin();
  updateHud();
}

// ---- guard vision --------------------------------------------------------
function guardSees(g) {
  const p = S.player;
  const d = dist(g.x, g.y, p.x, p.y);
  if (d > g.viewDist) return 0;
  const ang = Math.atan2(p.y - g.y, p.x - g.x);
  if (Math.abs(angDiff(ang, g.face)) > g.fov / 2) return 0;
  if (!losClear(g.x, g.y, p.x, p.y, S.map)) return 0;
  if (playerHidden()) return 0;
  let rate = 0.85 * (1 - (d / g.viewDist) * 0.6);
  if (p.sneak) rate *= 0.45;
  if (playerInBush()) rate *= 0.5;
  return rate;
}
function guardHears(g) {
  const p = S.player;
  if (p.sneak || !p.moving) return 0;
  const d = dist(g.x, g.y, p.x, p.y);
  if (d > 150) return 0;
  return 0.5 * (1 - d / 150);
}

// ---- update --------------------------------------------------------------
function update(dt) {
  S.time += dt;
  updatePlayer(dt);
  updateGuards(dt);
  updateCoins(dt);
  updateArtifacts(dt);
  updateDetection(dt);
  if (S.msgT > 0) {
    S.msgT -= dt * 1000;
    if (S.msgT <= 0) toastEl.style.display = 'none';
  }
}

function updatePlayer(dt) {
  const p = S.player;
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  p.sneak = !!(keys['shift']);
  p.moving = dx !== 0 || dy !== 0;
  if (p.moving) {
    const len = Math.hypot(dx, dy);
    const speed = p.sneak ? 85 : 150;
    const step = (speed * dt) / len;
    moveCircle(p, dx * step, dy * step, S.map);
    p.face = Math.atan2(dy, dx);
    p.stepT += dt;
    if (p.stepT > (p.sneak ? 0.55 : 0.34)) {
      p.stepT = 0;
      if (!p.sneak) sfx.step();
    }
  }
}

function updateGuards(dt) {
  const p = S.player;
  for (const g of S.guards) {
    const seen = guardSees(g);
    const heard = guardHears(g);
    if (g.state === 'alerted') {
      // Chase the player's live position; give up after losing sight.
      g.target = { x: p.x, y: p.y };
      if (seen > 0) { g.loseT = 0; } else { g.loseT += dt; }
      if (g.loseT > 3.2) {
        g.state = 'suspicious';
        g.lookT = 0;
        g.target = { x: p.x, y: p.y };
      }
      if (dist(g.x, g.y, p.x, p.y) < 26) { caught(); return; }
    } else if (seen > 0) {
      S.detection = Math.min(1, S.detection + seen * dt);
      if (S.detection >= 1) {
        g.state = 'alerted';
        g.loseT = 0;
        S.spotted++;
        S.ghost = false;
        sfx.alert();
        showToast('SPOTTED! Break line of sight — now!', 2200);
      }
    } else if (heard > 0) {
      g.suspicion += heard * dt;
      if (g.suspicion >= 1) {
        g.state = 'suspicious';
        g.suspicion = 0;
        g.target = { x: p.x, y: p.y };
        g.lookT = 0;
      }
    } else if (g.state === 'suspicious') {
      // Walk to the point of interest, look around, then resume patrol.
      if (g.target) {
        if (moveToward(g, g.target, 95 * dt)) {
          g.target = null;
          g.lookT = 2.2;
        }
      } else if (g.lookT > 0) {
        g.lookT -= dt;
        g.face += dt * 1.6;
        if (g.lookT <= 0) { g.state = 'patrol'; g.suspicion = 0; }
      }
      continue;
    }

    if (g.state === 'patrol') {
      if (g.pauseT > 0) {
        g.pauseT -= dt;
        g.face += dt * 0.5;
      } else {
        const wp = g.path[g.wp];
        if (moveToward(g, wp, g.speed * dt)) {
          g.wp += g.dir;
          if (g.wp >= g.path.length || g.wp < 0) {
            g.dir *= -1;
            g.wp += g.dir * 2;
          }
          g.pauseT = 0.7;
        }
      }
    } else if (g.state === 'alerted') {
      moveToward(g, g.target, 168 * dt);
    }
  }
}

// Steer toward a point with wall sliding; true when arrived.
function moveToward(g, target, step) {
  const d = dist(g.x, g.y, target.x, target.y);
  if (d < 6) return true;
  const nx = ((target.x - g.x) / d) * Math.min(step, d);
  const ny = ((target.y - g.y) / d) * Math.min(step, d);
  g.face = Math.atan2(target.y - g.y, target.x - g.x);
  moveCircle(g, nx, ny, S.map);
  return dist(g.x, g.y, target.x, target.y) < 6;
}

function updateCoins(dt) {
  for (const c of S.coins) {
    if (!c.landed) {
      c.t += dt / 0.45;
      if (c.t >= 1) {
        c.t = 1;
        c.landed = true;
        c.ring = 1;
        sfx.coin();
        // The clink pulls every guard in earshot toward the coin.
        for (const g of S.guards) {
          if (g.state === 'alerted') continue;
          if (dist(g.x, g.y, c.tx, c.ty) < 280) {
            g.state = 'suspicious';
            g.suspicion = 0;
            g.target = { x: c.tx, y: c.ty };
            g.lookT = 0;
          }
        }
      }
      c.x = c.x0 + (c.tx - c.x0) * c.t;
      c.y = c.y0 + (c.ty - c.y0) * c.t - Math.sin(c.t * Math.PI) * 26;
    } else if (c.ring > 0) {
      c.ring = Math.max(0, c.ring - dt * 1.4);
    }
  }
  S.coins = S.coins.filter((c) => !c.landed || c.ring > 0);
}

function updateArtifacts(dt) {
  const p = S.player;
  for (const a of S.artifacts) {
    if (a.got) continue;
    a.bob += dt;
    if (dist(p.x, p.y, a.x, a.y) < 26) {
      a.got = true;
      sfx.pickup();
      const n = S.artifacts.filter((x) => x.got).length;
      showToast(n >= S.artifacts.length ? 'All artifacts pocketed — the skylight exit is open!' : `Artifact ${n} of ${S.artifacts.length} pocketed.`, 2400);
      if (n >= S.artifacts.length) {
        S.exit.open = true;
        sfx.unlock();
      }
      updateHud();
    }
  }
  if (S.exit.open) {
    const e = S.exit;
    if (dist(p.x, p.y, e.x, e.y) < 26) levelDone();
  }
}

function updateDetection(dt) {
  const anySeen = S.guards.some((g) => guardSees(g) > 0);
  if (!anySeen && S.detection > 0) S.detection = Math.max(0, S.detection - dt * 0.35);
  const anyAlert = S.guards.some((g) => g.state === 'alerted');
  const anySusp = S.guards.some((g) => g.state === 'suspicious');
  hudAlert.textContent = anyAlert ? 'SPOTTED — RUN!' : anySusp ? 'SUSPICIOUS' : S.detection > 0.25 ? 'SEEN?' : 'UNSEEN';
  hudAlert.className = anyAlert ? 'alerted' : anySusp || S.detection > 0.25 ? 'suspicious' : '';
  detectBar.style.display = S.detection > 0.02 ? 'block' : 'none';
  detectFill.style.width = `${Math.round(S.detection * 100)}%`;
  const t = Math.floor(S.time);
  hudTime.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function updateHud() {
  const n = S.artifacts.filter((a) => a.got).length;
  hudGems.textContent = `◆ ${n}/${S.artifacts.length}`;
  hudCoins.textContent = `● ${S.coinCount}`;
}

// ---- flow ----------------------------------------------------------------
function showToast(msg, ms) {
  S.msg = msg;
  S.msgT = ms || 2500;
  toastEl.textContent = msg;
  toastEl.style.display = 'block';
}
function showOverlay(title, sub, bodyHtml, btnLabel) {
  ovTitle.textContent = title;
  ovSub.textContent = sub;
  ovBody.innerHTML = bodyHtml;
  ovBtn.textContent = btnLabel;
  overlayEl.classList.remove('hidden');
}
function hideOverlay() { overlayEl.classList.add('hidden'); }

function startRun() {
  S.time = 0;
  S.score = 0;
  S.spotted = 0;
  S.ghost = true;
  S.screen = 'play';
  hideOverlay();
  startLevel(0);
}
function startLevel(idx) {
  loadLevel(idx);
  S.screen = 'play';
  hideOverlay();
}
function levelDone() {
  const t = Math.floor(S.time);
  const bonus = Math.max(0, 900 - t * 5);
  S.score += 300 + bonus;
  sfx.win();
  if (S.levelIdx + 1 >= LEVELS.length) {
    S.screen = 'win';
    const ghostBonus = S.ghost ? 500 : 0;
    S.score += ghostBonus;
    showOverlay('THE CLEAN GETAWAY',
      'Every artifact, every floor — and the gallery never knew you were there.',
      `<p>Time <span class="stat">${fmtTime(S.time)}</span> &nbsp;·&nbsp; Times spotted <span class="stat">${S.spotted}</span></p>` +
      `<p>Ghost bonus (never fully spotted): <span class="stat">+${ghostBonus}</span></p>` +
      `<p>Final score: <span class="stat">${S.score}</span></p>` +
      `<p>Thank you for playing <b>Gallery of Shadows</b>. Press play to run the heist again — faster, quieter.</p>`,
      'Play again');
  } else {
    S.screen = 'leveldone';
    showOverlay(`FLOOR ${S.levelIdx + 1} CLEARED`,
      LEVELS[S.levelIdx + 1].name,
      `<p>Artifacts pocketed, exit reached. Time so far <span class="stat">${fmtTime(S.time)}</span> · Score <span class="stat">${S.score}</span></p>` +
      `<p>${LEVELS[S.levelIdx + 1].hint}</p>`,
      'Next floor');
  }
}
function caught() {
  S.screen = 'caught';
  sfx.caught();
  showOverlay('CAUGHT!',
    'A guard got a hand on you under the gallery lights.',
    `<p>The guards walk their rounds again from the start of this floor, and its artifacts are back in their cases — pocket them again.</p>` +
    `<p>Tip: <b>Shift</b> to sneak, hide in the <b>plants</b>, and toss a <b>coin</b> (click) to pull a guard away.</p>`,
    'Retry this floor (R)');
}
function fmtTime(s) {
  const t = Math.floor(s);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// ---- rendering -----------------------------------------------------------
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawFloor();
  drawExit();
  drawArtifacts();
  drawCover();
  drawCoins();
  drawGuards();
  drawPlayer();
  drawDarkness();
}

function drawFloor() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const ch = S.map[y][x];
      const px = x * TILE, py = y * TILE;
      if (ch === '#') {
        ctx.fillStyle = '#232742';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#31365c';
        ctx.fillRect(px, py, TILE, 5);
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(px, py + TILE - 2, TILE, 2);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#171a2c' : '#141728';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        if (ch === 'B') {
          ctx.fillStyle = '#12291a';
          ctx.beginPath();
          ctx.arc(px + 12, py + 14, 11, 0, Math.PI * 2);
          ctx.arc(px + 26, py + 10, 12, 0, Math.PI * 2);
          ctx.arc(px + 28, py + 27, 10, 0, Math.PI * 2);
          ctx.arc(px + 11, py + 28, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1d4a2b';
          ctx.beginPath();
          ctx.arc(px + 14, py + 13, 5, 0, Math.PI * 2);
          ctx.arc(px + 25, py + 24, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  // Soft gold carpet runner down the middle hall, purely decorative.
  ctx.fillStyle = 'rgba(201,162,39,0.07)';
  ctx.fillRect(0, H / 2 - 20, W, TILE);
}

function drawCover() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (S.map[y][x] !== 'T') continue;
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = '#3a2f18';
      ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(px + 3, py + 3, TILE - 6, 3);
      ctx.fillRect(px + 3, py + TILE - 6, TILE - 6, 3);
      ctx.fillStyle = 'rgba(180,220,255,0.16)';
      ctx.fillRect(px + 7, py + 7, TILE - 14, TILE - 14);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(px + 9, py + 9, 8, 3);
    }
  }
}

function drawExit() {
  const e = S.exit;
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
  ctx.save();
  ctx.fillStyle = e.open ? `rgba(80,220,130,${0.25 + 0.2 * pulse})` : 'rgba(120,120,120,0.18)';
  ctx.fillRect(e.x - 18, e.y - 18, 36, 36);
  ctx.strokeStyle = e.open ? '#50dc82' : '#777';
  ctx.lineWidth = 2;
  ctx.strokeRect(e.x - 18, e.y - 18, 36, 36);
  ctx.fillStyle = e.open ? '#a9f5c3' : '#999';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(e.open ? 'EXIT' : 'LOCKED', e.x, e.y + 4);
  ctx.restore();
}

function drawArtifacts() {
  for (const a of S.artifacts) {
    if (a.got) continue;
    const bob = Math.sin(a.bob * 2) * 3;
    const pulse = 0.5 + 0.5 * Math.sin(a.bob * 3);
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.25 * pulse;
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(a.x, a.y + bob, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 10 + bob);
    ctx.lineTo(a.x + 8, a.y + bob);
    ctx.lineTo(a.x, a.y + 10 + bob);
    ctx.lineTo(a.x - 8, a.y + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 5 + bob);
    ctx.lineTo(a.x + 3, a.y + bob);
    ctx.lineTo(a.x, a.y + 5 + bob);
    ctx.lineTo(a.x - 3, a.y + bob);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawCoins() {
  for (const c of S.coins) {
    if (!c.landed) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (c.ring > 0) {
      ctx.strokeStyle = `rgba(255,217,77,${c.ring})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.tx, c.ty, (1 - c.ring) * 46 + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(c.tx, c.ty, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function coneColor(g) {
  if (g.state === 'alerted') return 'rgba(255,70,70,0.30)';
  if (g.state === 'suspicious') return 'rgba(242,201,76,0.26)';
  return 'rgba(90,160,255,0.20)';
}
function drawGuards() {
  for (const g of S.guards) {
    // Vision cone.
    ctx.save();
    ctx.fillStyle = coneColor(g);
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.x, g.y, g.viewDist, g.face - g.fov / 2, g.face + g.fov / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Body: navy guard with a cap brim toward facing.
    ctx.fillStyle = '#2c3e6e';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = g.state === 'alerted' ? '#ff5d5d' : g.state === 'suspicious' ? '#f2c94c' : '#7fa8e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#dfe6ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.face) * (g.r + 7), g.y + Math.sin(g.face) * (g.r + 7));
    ctx.stroke();
    // Alert mark.
    if (g.state !== 'patrol') {
      ctx.fillStyle = g.state === 'alerted' ? '#ff5d5d' : '#f2c94c';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.state === 'alerted' ? '!' : '?', g.x, g.y - g.r - 6);
    }
  }
}

function drawPlayer() {
  const p = S.player;
  // Sneak ring.
  if (p.sneak) {
    ctx.strokeStyle = 'rgba(143,214,160,0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = '#c97b2d';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd9a0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.face) * (p.r + 6), p.y + Math.sin(p.face) * (p.r + 6));
  ctx.stroke();
  // Hood point.
  ctx.fillStyle = '#8a5420';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.face) * 6, p.y + Math.sin(p.face) * 6, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawDarkness() {
  // Night in the gallery: darkness everywhere except a pool of light
  // around Wren, so the cones and the exit glow read at a glance.
  const p = S.player;
  const g = ctx.createRadialGradient(p.x, p.y, 60, p.x, p.y, 300);
  g.addColorStop(0, 'rgba(4,5,12,0)');
  g.addColorStop(1, 'rgba(4,5,12,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ---- main loop -----------------------------------------------------------
let lastT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  if (S.screen === 'play' && !S.frozen) update(dt);
  draw();
}

// ---- screenshot staging --------------------------------------------------
// ?shot=cover | alert | hide | win — deterministic scenes for the entry's
// screenshots. These are real renders of the game's own code: the scene is
// staged through the same loadLevel/update path, then frozen mid-frame.
function stageShot(name) {
  S.frozen = true;
  if (name === 'cover') {
    loadLevel(0);
    S.player.x = 9 * TILE + 20; S.player.y = 7 * TILE + 20; S.player.face = Math.PI;
    S.player.sneak = true;
    S.artifacts[0].got = true;
    S.detection = 0.35;
    S.guards[0].x = 19 * TILE + 20; S.guards[0].y = 3 * TILE + 20; S.guards[0].face = Math.PI;
    S.guards[1].x = 3 * TILE + 20; S.guards[1].y = 10 * TILE + 20; S.guards[1].face = -Math.PI / 2;
    S.screen = 'play';
    updateHud();
  } else if (name === 'alert') {
    loadLevel(1);
    S.player.x = 13 * TILE + 20; S.player.y = 8 * TILE + 20; S.player.face = -Math.PI / 2;
    S.artifacts[0].got = true; S.artifacts[1].got = true;
    S.detection = 1;
    const g = S.guards[1];
    g.state = 'alerted'; g.x = 10 * TILE + 20; g.y = 5 * TILE + 20;
    g.face = Math.atan2(S.player.y - g.y, S.player.x - g.x);
    S.guards[0].x = 17 * TILE + 20; S.guards[0].y = 5 * TILE + 20; S.guards[0].face = Math.PI;
    S.guards[0].state = 'suspicious';
    S.screen = 'play';
    updateHud();
  } else if (name === 'hide') {
    loadLevel(0);
    S.player.x = 3 * TILE + 20; S.player.y = 3 * TILE + 20; S.player.face = 0;
    S.player.sneak = true;
    S.coins.push({ x0: 0, y0: 0, x: 8 * TILE, y: 5 * TILE, tx: 8 * TILE, ty: 5 * TILE, t: 1, landed: true, ring: 0.8 });
    const g = S.guards[1];
    g.state = 'suspicious'; g.target = { x: 8 * TILE, y: 5 * TILE };
    g.x = 5 * TILE + 20; g.y = 7 * TILE + 20;
    g.face = Math.atan2(5 * TILE - g.y, 8 * TILE - g.x);
    S.screen = 'play';
    updateHud();
  } else if (name === 'win') {
    loadLevel(2);
    S.artifacts.forEach((a) => { a.got = true; });
    S.exit.open = true;
    S.player.x = 21 * TILE + 20; S.player.y = 13 * TILE + 20; S.player.face = 0;
    S.time = 214; S.score = 2450; S.spotted = 0; S.ghost = true;
    S.screen = 'win';
    showOverlay('THE CLEAN GETAWAY',
      'Every artifact, every floor — and the gallery never knew you were there.',
      `<p>Time <span class="stat">03:34</span> &nbsp;·&nbsp; Times spotted <span class="stat">0</span></p>` +
      `<p>Ghost bonus (never fully spotted): <span class="stat">+500</span></p>` +
      `<p>Final score: <span class="stat">2450</span></p>` +
      `<p>Thank you for playing <b>Gallery of Shadows</b>. Press play to run the heist again — faster, quieter.</p>`,
      'Play again');
    updateHud();
  }
  // One HUD refresh so the frozen frame shows the staged state (alert text,
  // detection bar, timer) exactly as live play would.
  updateDetection(0);
  draw();
}

// ---- init ----------------------------------------------------------------
function init() {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  loadLevel(0);
  if (shot) {
    hideOverlay();
    stageShot(shot);
  } else {
    S.screen = 'title';
    showOverlay('GALLERY OF SHADOWS',
      'A stealth game in the Meridian Gallery, after dark.',
      `<p>You are <b>Wren</b>, a thief with three floors to empty. Pocket <b>three artifacts</b> on each floor, then slip out through the <b>skylight exit</b> — unseen.</p>` +
      `<p>Guards see in <b>cones</b>: blue is their patrol, yellow means they are suspicious, red means they are chasing you. Walls and display cases block their sight. <b>Plants</b> hide you while you sneak (hold <b>Shift</b>).</p>` +
      `<p>Running is loud. A <b>click</b> throws one of your three coins — the clink pulls a guard to the spot. Get caught and the floor starts over.</p>`,
      'Begin the heist');
  }
  requestAnimationFrame(frame);
}

// For automated smoke tests (keyboard simulation, state reads).
window.__game = {
  S,
  startRun, startLevel,
  state() {
    return {
      screen: S.screen, level: S.levelIdx, time: Math.round(S.time),
      detection: +S.detection.toFixed(2),
      player: { x: Math.round(S.player.x), y: Math.round(S.player.y) },
      artifacts: S.artifacts.filter((a) => a.got).length,
      exitOpen: S.exit.open,
      guards: S.guards.map((g) => ({ state: g.state, x: Math.round(g.x), y: Math.round(g.y) })),
    };
  },
};

init();
