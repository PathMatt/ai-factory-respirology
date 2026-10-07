// Jev drives the slide. Every navigation decision is a typed Jev question answered through
// /api/jev-scan: which fields to screen, where to start, how fast to move and where to go.
// Jev screens the rim of the lymph node first (where node meets fat), then the interior,
// until all node tissue is covered. The pathologist can Stop, or press Tumor: Jev then
// grows an annotation outward from the current field, ring by ring, and resumes.
// Jev sees only the optical-density sensor (H and E channels, density class, patch
// solidity), never pixels. Nothing here is a diagnosis.
const root = document.querySelector('#jev-scan');
const $ = sel => root.querySelector(sel);

const MAG = 10;             // screening magnification
const MAX_Q = 60;           // questions per call; larger sets run as parallel calls
const PALETTE = { glass: [250, 250, 248], adipose: [232, 223, 200], intermediate: [201, 143, 146], lymph: [76, 68, 88] };
const PACE_MS = { skip: 0, sweep: 220, slow: 650 };   // dwell lets 10x tiles resolve
const MOVE_S = { skip: 0.25, sweep: 0.4, slow: 0.5 };

let data, C, R, cls, H, E, tex, solid, fat, edge;
let viewer, fieldW = 6, fieldH = 4, fields = [], gen = 0, started = false;
let stats, trail, logCount, curField = null, paused = false, annotating = false, lookaheadBusy = false;
let annotations = [], overlays = [];

const fmt = n => (Math.round(n * 100) / 100).toFixed(2);
const pr = p => (Math.round(p * 100) / 100).toFixed(2).replace(/^0/, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isNode = i => cls[i] === 2 || cls[i] === 3;

new MutationObserver(() => { if (!root.hidden && !started) boot(); }).observe(root, { attributes: true, attributeFilter: ['hidden'] });

async function boot() {
  started = true;
  data = await fetch('assets/jev-scan/tumor_091.grid.json').then(r => r.json());
  [C, R] = data.grid;
  ({ cls, H, E, tex, solid, fat } = data);
  buildEdge();
  drawBaseMaps();
  viewer = OpenSeadragon({
    element: $('.js-viewer'), tileSources: data.dzi, prefixUrl: '',
    showNavigationControl: false, showNavigator: false, mouseNavEnabled: false,
    animationTime: 0.8, springStiffness: 7, visibilityRatio: 1, constrainDuringPan: false,
    blendTime: 0.15, immediateRender: true, imageLoaderLimit: 32, maxImageCacheCount: 600, drawer: 'canvas', crossOriginPolicy: 'Anonymous'
  });
  watchTileLevels();
  viewer.addOnceHandler('open', () => { measureField(); start(); });
  $('.js-restart').addEventListener('click', e => { e.currentTarget.blur(); start(); });
  $('.js-stop').addEventListener('click', e => { e.currentTarget.blur(); togglePause(); });
  $('.js-tumor').addEventListener('click', e => { e.currentTarget.blur(); annotateHere(); });
  root.querySelectorAll('.js-pad button').forEach(b => b.addEventListener('click', () => { b.blur(); nudge(b.dataset.dir); }));
  // While stopped, the arrow keys pan the slide instead of changing deck slides.
  window.addEventListener('keydown', e => {
    if (root.hidden || !paused || annotating || !e.key.startsWith('Arrow')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    nudge(e.key.slice(5).toLowerCase());
  }, true);
  document.addEventListener('keydown', e => {
    if (root.hidden || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) return;
    if (e.key === 's' || e.key === 'S') togglePause();
    if (e.key === 't' || e.key === 'T') annotateHere();
  });
  setInterval(renderStats, 250);
}

// ── Sensor ────────────────────────────────────────────────────────────────────
// Rim cells: node tissue within two cells of adipose, where the capsule and
// subcapsular sinus meet fat.
function buildEdge() {
  edge = new Uint8Array(R * C);
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (!isNode(r * C + c)) continue;
    search: for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < R && cc >= 0 && cc < C && cls[rr * C + cc] === 1) { edge[r * C + c] = 1; break search; }
    }
  }
}

function summarize(r0, c0, h, w) {
  const counts = [0, 0, 0, 0];
  let n = 0, hs = 0, es = 0, maxSolid = 0, texSum = 0, fatSum = 0, inter = 0, rim = 0, node = 0;
  for (let r = r0; r < Math.min(R, r0 + h); r++) for (let c = c0; c < Math.min(C, c0 + w); c++) {
    const i = r * C + c; n++; counts[cls[i]]++;
    if (cls[i] > 0) { hs += H[i]; es += E[i]; }
    if (isNode(i)) node++;
    if (edge[i]) rim++;
    if (cls[i] === 2) { inter++; maxSolid = Math.max(maxSolid, solid[i]); texSum += tex[i]; fatSum += fat[i]; }
  }
  const tissue = n - counts[0];
  return {
    mix: { glass: counts[0] / n, adipose: counts[1] / n, intermediate: counts[2] / n, lymph_node: counts[3] / n },
    tissue: tissue / n, node, rim: rim / n,
    H: tissue ? hs / tissue / 1000 : 0, E: tissue ? es / tissue / 1000 : 0,
    solidity: maxSolid / 100, texture: inter ? texSum / inter / 1000 : 0, fatNearby: inter ? fatSum / inter / 100 : 0
  };
}

function describe(s) {
  const mix = Object.entries(s.mix).filter(([, v]) => v >= 0.05).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k.replace('_', ' ')} ${Math.round(v * 100)}%`).join(', ') || 'glass';
  const rim = s.rim >= 0.08 ? '; on the node rim next to adipose' : '';
  const patch = s.mix.intermediate > 0 ? `; intermediate patch solidity ${fmt(s.solidity)}, texture ${fmt(s.texture)}` : '';
  return `${mix}${rim}; hematoxylin OD ${fmt(s.H)}, eosin OD ${fmt(s.E)}${patch}`;
}

function sensorState(s) {
  return {
    tissue_mix: Object.fromEntries(Object.entries(s.mix).map(([k, v]) => [k, +fmt(v)])),
    node_rim_fraction: +fmt(s.rim), hematoxylin_od: +fmt(s.H), eosin_od: +fmt(s.E),
    intermediate_patch: { solidity: +fmt(s.solidity), texture: +fmt(s.texture), fat_nearby: +fmt(s.fatNearby) }
  };
}

function measureField() {
  const el = $('.js-viewer'), perPx = data.objective / MAG;   // level-0 pixels per screen pixel
  fieldW = Math.max(2, Math.round(el.clientWidth * perPx / data.cellLevel0));
  fieldH = Math.max(2, Math.round(el.clientHeight * perPx / data.cellLevel0));
  fields = [];
  for (let r = 0; r < R; r += fieldH) for (let c = 0; c < C; c += fieldW) {
    fields.push({ key: `f_${r}_${c}`, r, c, s: summarize(r, c, fieldH, fieldW), screen: null, visited: false, lookahead: null });
  }
}
const isRim = f => f.s.rim >= 0.08;
const dist = (a, b) => Math.hypot((a.r - b.r) / fieldH, (a.c - b.c) / fieldW);
const remaining = () => fields.filter(f => f.screen && !f.visited);

// ── Tile pre-warming ──────────────────────────────────────────────────────────
// As soon as Jev picks the next field, its tiles are fetched into the browser cache
// (Blob tiles are immutable, cached for a year) at the pyramid level the viewer is
// actually drawing, so the stage lands on sharp tiles. Low-priority warming covers
// the likely fields after that when the queue is short. At most 12 fetches run at once.
const MAX_LEVEL = 16, TILE_PX = 256, PREFETCH_ACTIVE = 12, PREFETCH_CAP = 120;
const prefetched = new Set();
let prefetchQueue = [], prefetchActive = 0, recentLevels = [];

function watchTileLevels() {
  const re = /_files\/(\d+)\/\d+_\d+\.jpe?g/;
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      const m = e.name.match(re);
      if (!m || prefetched.has(e.name) || annotating) continue;
      recentLevels.push(+m[1]);
      if (recentLevels.length > 80) recentLevels.shift();
    }
  }).observe({ type: 'resource', buffered: true });
}

// The level the viewer is drawing at 10x: the highest level seen at least five times
// recently, or an estimate from the container size and device pixel ratio.
function drawLevel() {
  const counts = {};
  recentLevels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
  const seen = Object.keys(counts).map(Number).filter(l => counts[l] >= 5);
  if (seen.length) return Math.max(...seen);
  const px = $('.js-viewer').clientWidth * (window.devicePixelRatio || 1);
  return Math.min(MAX_LEVEL, MAX_LEVEL + Math.ceil(Math.log2(px / (fieldW * data.cellLevel0) * 0.5)));
}

function tileUrls(f, level) {
  const base = data.dzi.replace(/\.dzi$/, '_files'), scale = 2 ** (MAX_LEVEL - level), cell = data.cellLevel0;
  const [W, Hh] = data.level0, padW = fieldW * cell * 0.05, padH = fieldH * cell * 0.05;
  const x0 = Math.max(0, f.c * cell - padW), y0 = Math.max(0, f.r * cell - padH);
  const x1 = Math.min(W, (f.c + fieldW) * cell + padW), y1 = Math.min(Hh, (f.r + fieldH) * cell + padH);
  const urls = [];
  for (let ty = Math.floor(y0 / scale / TILE_PX); ty <= Math.floor((y1 - 1) / scale / TILE_PX); ty++)
    for (let tx = Math.floor(x0 / scale / TILE_PX); tx <= Math.floor((x1 - 1) / scale / TILE_PX); tx++) urls.push(`${base}/${level}/${tx}_${ty}.jpeg`);
  return urls;
}

function prewarm(f, urgent) {
  if (!f) return;
  const fresh = tileUrls(f, drawLevel()).filter(u => !prefetched.has(u) && !prefetchQueue.includes(u));
  prefetchQueue = urgent ? [...fresh, ...prefetchQueue].slice(0, PREFETCH_CAP) : [...prefetchQueue, ...fresh].slice(0, PREFETCH_CAP);
  pumpPrefetch();
}

function pumpPrefetch() {
  while (prefetchActive < PREFETCH_ACTIVE && prefetchQueue.length) {
    const url = prefetchQueue.shift();
    if (prefetched.has(url)) continue;
    prefetched.add(url); prefetchActive++;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = img.onerror = () => { prefetchActive--; if (stats) stats.warmed++; pumpPrefetch(); };
    img.src = url;
  }
}

// Warm the chosen next field first, then the two nearest unvisited fields beyond it.
function prewarmAhead(next) {
  prewarm(next, true);
  if (prefetchQueue.length > 24) return;   // keep bandwidth for the field Jev will land on
  remaining().filter(x => x !== next).sort((a, b) => dist(next, a) - dist(next, b)).slice(0, 2).forEach(x => prewarm(x, false));
}

// ── Jev calls ─────────────────────────────────────────────────────────────────
async function jev(state, questions, myGen) {
  const t0 = performance.now();
  stats.inflight++;
  try {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch('/api/jev-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, questions }) });
      const json = await response.json().catch(() => ({}));
      if (response.ok) {
        const ms = performance.now() - t0;
        if (myGen === gen) {
          stats.calls++; stats.decisions += Object.keys(questions).length; stats.cost += Number(json.cost || 0);
          stats.latencies.push(ms); stats.times.push(performance.now());
        }
        return { answers: json.answers, ms };
      }
      if (attempt >= 2 || myGen !== gen) throw new Error(json.error || `HTTP ${response.status}`);
      await sleep(600);
    }
  } finally { stats.inflight--; }
}

// Many questions, one state: split into parallel calls and merge the answers.
async function jevMany(state, entries, myGen) {
  const chunks = [];
  for (let i = 0; i < entries.length; i += MAX_Q) chunks.push(entries.slice(i, i + MAX_Q));
  const t0 = performance.now();
  const results = await Promise.all(chunks.map(chunk => jev(state, Object.fromEntries(chunk), myGen)));
  return { answers: Object.assign({}, ...results.map(r => r.answers)), ms: performance.now() - t0, calls: chunks.length };
}

const alive = myGen => myGen === gen;
async function gate(myGen) { while (alive(myGen) && (paused || annotating || root.hidden || document.hidden)) await sleep(120); }

// ── Main loop ─────────────────────────────────────────────────────────────────
async function start() {
  const myGen = ++gen;
  stats = { calls: 0, decisions: 0, cost: 0, latencies: [], times: [], inflight: 0, fields: 0, warmed: 0 };
  prefetchQueue = [];
  trail = []; logCount = 0; paused = false; annotating = false; lookaheadBusy = false; curField = null;
  overlays.forEach(o => viewer.removeOverlay(o)); overlays = []; annotations = [];
  root.classList.remove('is-annotating');
  measureField();
  $('.js-log').innerHTML = '';
  setPaused(false);
  setHud('Overview', '', 'survey');
  viewer.viewport.goHome(true);
  drawMaps();
  logLine('sensor', 0, `OD sensor · ${C} × ${R} cells`, `${fields.length} fields at ${MAG}× · H and E channels`);
  try {
    await gate(myGen);
    await sleep(600);
    await triage(myGen);
    let cur = await chooseStart(myGen);
    if (!cur) return;
    cur.visited = true; curField = cur;
    prewarmAhead(cur);
    await goToField(cur, 1.0);
    let pending = decide(cur, myGen);
    lookaheadLoop(myGen);
    while (alive(myGen)) {
      const d = await pending;
      await gate(myGen);
      if (!alive(myGen)) return;
      stats.fields++;
      setHud(`${Math.round(currentMag())}×`, `field (${cur.r},${cur.c})${isRim(cur) ? ' · rim' : ''}`, d.pace);
      renderSensor(cur);
      if (PACE_MS[d.pace]) await sleep(PACE_MS[d.pace]);
      await gate(myGen);
      const next = d.next || nearest(cur);
      if (!next) break;
      next.visited = true; curField = next;
      const move = goToField(next, d.next ? (MOVE_S[d.pace] || 0.32) : 0.7);
      pending = decide(next, myGen);
      await move;
      cur = next;
    }
    if (alive(myGen)) finish();
  } catch (error) {
    if (alive(myGen)) logLine('error', 0, 'Jev unavailable', error.message, 'is-answer');
  }
}

async function triage(myGen) {
  const candidates = fields.filter(f => f.s.tissue > 0.05);
  const entries = candidates.map(f => [f.key, {
    type: 'boolean', instructions: `Screen the field at row ${f.r}, col ${f.c}? ${describe(f.s)}`,
    criteria: { true: 'contains lymph node or intermediate-density tissue (10% or more)', false: 'adipose or glass only' } }]);
  const { answers, ms, calls } = await jevMany({ task: `Triage ${MAG}x fields of a sentinel lymph node from optical density` }, entries, myGen);
  if (!alive(myGen)) return;
  candidates.forEach(f => { f.screen = answers[f.key].probability >= 0.5; });
  const n = candidates.filter(f => f.screen).length;
  logLine('triage', ms, `triage · ${candidates.length} fields · ${calls} parallel calls`, `screen <b>${n}</b> · skip <b>${candidates.length - n}</b> adipose or glass`);
  drawMaps();
}

async function chooseStart(myGen) {
  const rim = fields.filter(f => f.screen && isRim(f));
  const options = (rim.length ? rim : fields.filter(f => f.screen)).slice(0, 200);
  if (!options.length) return null;
  const criteria = Object.fromEntries(options.map(f => [f.key, `field at row ${f.r}, col ${f.c}: ${describe(f.s)}`]));
  const { answers, ms } = await jev({ task: `Plan a ${MAG}x screen of a sentinel lymph node` }, { start: { type: 'choice',
    instructions: 'Where should screening begin? Start on the rim of the lymph node where it meets adipose tissue (subcapsular sinus), at the top of the node so the rim can be followed around.', criteria } }, myGen);
  if (!alive(myGen)) return null;
  const pick = options.find(f => f.key === answers.start.choice) || options[0];
  logLine('start', ms, `start · ${options.length} rim fields`, `begin at <b>(${pick.r},${pick.c})</b> ${pr(answers.start.probabilities[pick.key])} · rim first, then interior`);
  return pick;
}

function nearest(from, pred = () => true) {
  let best = null;
  for (const f of remaining()) if (pred(f) && (!best || dist(from, f) < dist(from, best))) best = f;
  return best;
}

async function decide(f, myGen) {
  const options = {}, targets = {};
  const find = (r, c) => fields.find(x => x.r === r && x.c === c);
  const around = { left: find(f.r, f.c - fieldW), right: find(f.r, f.c + fieldW), up: find(f.r - fieldH, f.c), down: find(f.r + fieldH, f.c) };
  for (const [dir, nb] of Object.entries(around)) {
    if (nb && nb.screen && !nb.visited) { options[dir] = `${dir}: ${describe(nb.s)}; unvisited`; targets[dir] = nb; }
  }
  const rimLeft = remaining().filter(isRim).length, total = remaining().length;
  const jr = nearest(f, isRim), ji = nearest(f, x => !isRim(x));
  if (jr && !Object.values(targets).includes(jr)) { options.jump_rim = `jump ${Math.round(dist(f, jr))} fields to the nearest unvisited rim field: ${describe(jr.s)}`; targets.jump_rim = jr; }
  if (ji && !Object.values(targets).includes(ji)) { options.jump_interior = `jump ${Math.round(dist(f, ji))} fields to the nearest unvisited interior field: ${describe(ji.s)}`; targets.jump_interior = ji; }
  const questions = {
    pace: { type: 'choice', instructions: `How should the ${MAG}x screen handle this field?`, criteria: {
      skip: 'mostly glass or adipose tissue: do not dwell, move on',
      sweep: 'mostly dense lymph node: keep moving at screening speed',
      slow: 'contains a solid intermediate-density patch: slow down and look closely' } }
  };
  if (Object.keys(options).length) questions.next = { type: 'choice',
    instructions: `Where should the screen move next? Cover the node rim first (${rimLeft} rim fields left), following it around; then sweep the interior (${total - rimLeft} left). Prefer adjacent unvisited fields over jumps.`,
    criteria: options };
  const state = { task: `Screen a sentinel lymph node at ${MAG}x from optical density only until all node tissue is covered`,
    field: { row: f.r, col: f.c, ...sensorState(f.s) }, rim_fields_left: rimLeft, interior_fields_left: total - rimLeft };
  const { answers, ms } = await jev(state, questions, myGen);
  const pace = answers.pace.choice, nextKey = answers.next?.choice;
  trail.push([f.r + fieldH / 2, f.c + fieldW / 2]);
  logLine('field', ms, `field (${f.r},${f.c})${isRim(f) ? ' rim' : ''}`,
    `pace <b>${pace}</b> ${pr(answers.pace.probabilities[pace])}${nextKey ? ` · next <b>${nextKey.replace('_', ' ')}</b> ${pr(answers.next.probabilities[nextKey])}` : ' · no unvisited fields left'}`,
    pace === 'slow' ? 'is-slow' : '');
  drawMaps(f);
  if (nextKey && targets[nextKey]) prewarmAhead(targets[nextKey]);
  return { pace, next: nextKey ? targets[nextKey] : null };
}

// Side channel: Jev scores the nearest unvisited fields while the stage moves.
async function lookaheadLoop(myGen) {
  if (lookaheadBusy) return;
  lookaheadBusy = true;
  try {
    while (alive(myGen)) {
      await gate(myGen);
      const from = curField;
      const ahead = remaining().filter(x => x.lookahead === null).sort((a, b) => dist(from, a) - dist(from, b)).slice(0, 12);
      if (!ahead.length) break;
      const questions = Object.fromEntries(ahead.map(x => [x.key, { type: 'boolean', instructions: `Should the screen slow down at the field at row ${x.r}, col ${x.c}? ${describe(x.s)}`,
        criteria: { true: 'a solid intermediate-density patch: solidity 0.6 or more, texture below 0.13', false: 'dense lymph node, adipose, glass, thin intermediate strands' } }]));
      const { answers, ms } = await jev({ task: 'Look ahead of the screen' }, questions, myGen);
      if (!alive(myGen)) break;
      let flagged = 0;
      ahead.forEach(x => { x.lookahead = answers[x.key].probability; if (x.lookahead >= 0.5) flagged++; });
      logLine('lookahead', ms, `look-ahead · ${ahead.length} fields`, `flag <b>${flagged}</b> to slow down`, 'is-side');
      drawMaps();
    }
  } catch { /* the main loop reports errors */ } finally { lookaheadBusy = false; }
}

// ── Pathologist controls ──────────────────────────────────────────────────────
function setPaused(value) {
  paused = value;
  $('.js-stop').innerHTML = paused ? 'Resume<kbd>S</kbd>' : 'Stop<kbd>S</kbd>';
  root.classList.toggle('is-paused', paused);
  if (paused) setHud($('.js-hud-mag').textContent, $('.js-hud-field').textContent, 'stopped');
}
function togglePause() {
  if (!stats || annotating) return;
  setPaused(!paused);
  logLine('control', 0, 'pathologist', paused ? '<b>stop</b> · arrows pan the slide · T annotates the view · S resumes' : '<b>resume</b> · Jev continues the screen', 'is-answer');
}

// Manual fine-tuning while stopped: pan a quarter of the view per press.
function nudge(dir) {
  if (!paused || annotating) return;
  const b = viewer.viewport.getBounds(true);
  const d = { left: [-b.width / 4, 0], right: [b.width / 4, 0], up: [0, -b.height / 4], down: [0, b.height / 4] }[dir];
  if (!d) return;
  setSpringTime(0.3);
  viewer.viewport.panBy(new OpenSeadragon.Point(d[0], d[1]));
}

// Cells in the current view, nearest the centre first (the pathologist may have nudged the view).
function viewCells() {
  const v = viewer.viewport.viewportToImageRectangle(viewer.viewport.getBounds(true)), cell = data.cellLevel0;
  const r0 = Math.max(0, Math.floor(v.y / cell)), r1 = Math.min(R - 1, Math.floor((v.y + v.height) / cell));
  const c0 = Math.max(0, Math.floor(v.x / cell)), c1 = Math.min(C - 1, Math.floor((v.x + v.width) / cell));
  const cr = (v.y + v.height / 2) / cell, cc = (v.x + v.width / 2) / cell, cells = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (cls[r * C + c] > 0) cells.push([r, c]);
  return cells.sort((a, b) => Math.hypot(a[0] + .5 - cr, a[1] + .5 - cc) - Math.hypot(b[0] + .5 - cr, b[1] + .5 - cc));
}

// Tumor: seed in the current field, then grow the annotation ring by ring. Each ring
// asks Jev, in parallel calls, whether every frontier cell belongs to the same tumor.
async function annotateHere() {
  if (!stats || annotating || !curField) return;
  const myGen = gen, f = curField;
  annotating = true; root.classList.add('is-annotating');
  setHud($('.js-hud-mag').textContent, `annotating near (${f.r},${f.c})`, 'annotate');
  logLine('control', 0, 'pathologist', `<b>tumor</b> at field (${f.r},${f.c}) · Jev builds the annotation`, 'is-answer');
  const before = { calls: stats.calls, decisions: stats.decisions }, t0 = performance.now();
  try {
    const cells = viewCells();
    const pool = cells.filter(([r, c]) => cls[r * C + c] === 2);
    const seedOptions = (pool.length ? pool : cells).slice(0, 60);
    if (!seedOptions.length) { logLine('annotate', 0, 'annotation', 'no tissue in this field', 'is-answer'); return; }
    const cellText = ([r, c]) => { const i = r * C + c; return `cell (${r},${c}): ${['glass', 'adipose', 'intermediate density', 'lymph node'][cls[i]]}, hematoxylin OD ${fmt(H[i] / 1000)}, eosin OD ${fmt(E[i] / 1000)}, solidity ${fmt(solid[i] / 100)}, texture ${fmt(tex[i] / 1000)}, fat nearby ${fmt(fat[i] / 100)}`; };
    const seedPick = await jev({ task: 'The pathologist flagged tumor in this field. Choose the seed cell for the annotation.' },
      { seed: { type: 'choice', instructions: 'Which cell is the most typical of the tumor: solid intermediate density with uniform texture, away from fat?',
        criteria: Object.fromEntries(seedOptions.map(([r, c]) => [`c_${r}_${c}`, cellText([r, c])])) } }, myGen);
    const seed = seedPick.answers.seed.choice.split('_').slice(1).map(Number);
    logLine('annotate', seedPick.ms, `seed · ${seedOptions.length} cells`, `seed <b>(${seed[0]},${seed[1]})</b> ${pr(seedPick.answers.seed.probabilities[seedPick.answers.seed.choice])}`, 'is-answer');
    const key = ([r, c]) => r * C + c;
    const accepted = new Set([key(seed)]), asked = new Set([key(seed)]);
    const ann = { cells: accepted, overlay: null };
    annotations.push(ann);
    renderAnnotation(ann);
    let frontier = [seed], ring = 0;
    const state = { task: 'Grow the tumor annotation the pathologist flagged, cell by cell', seed: { row: seed[0], col: seed[1], ...cellSensor(seed) } };
    while (frontier.length && accepted.size < 700 && alive(myGen)) {
      const next = [];
      for (const [r, c] of frontier) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc, k = rr * C + cc;
        if (rr < 0 || rr >= R || cc < 0 || cc >= C || asked.has(k) || cls[k] === 0) continue;
        asked.add(k); next.push([rr, cc]);
      }
      if (!next.length) break;
      ring++;
      const entries = next.map(([r, c]) => [`c_${r}_${c}`, { type: 'boolean', instructions: `Is ${cellText([r, c])} part of the same tumor?`,
        criteria: { true: 'intermediate density continuous with the tumor: solidity 0.45 or more, uniform texture', false: 'dense lymph node, adipose, glass, or thin sinus strands' } }]);
      const { answers, ms, calls } = await jevMany(state, entries, myGen);
      if (!alive(myGen)) return;
      frontier = next.filter(([r, c]) => answers[`c_${r}_${c}`].probability >= 0.5);
      frontier.forEach(cell => accepted.add(key(cell)));
      logLine('annotate', ms, `ring ${ring} · ${next.length} cells · ${calls} call${calls > 1 ? 's' : ''}`, `add <b>${frontier.length}</b> · annotation ${accepted.size} cells`, 'is-answer');
      renderAnnotation(ann);
      drawMaps(curField);
      const b = bounds(accepted);
      flyTo(b.c0 - 3, b.r0 - 3, b.c1 - b.c0 + 7, b.r1 - b.r0 + 7, 0.45);
    }
    const area = accepted.size * (data.cellLevel0 * data.mpp / 1000) ** 2;
    ann.label = `Tumor · ${accepted.size} cells · ${area.toFixed(2)} mm²`;
    renderAnnotation(ann);
    logLine('annotate', performance.now() - t0, 'annotation complete',
      `<b>${stats.calls - before.calls}</b> calls · <b>${stats.decisions - before.decisions}</b> decisions · ${area.toFixed(2)} mm²`, 'is-answer');
    await sleep(1600);
  } catch (error) {
    logLine('error', 0, 'annotation failed', error.message, 'is-answer');
  } finally {
    if (alive(myGen)) {
      await goToField(f, 0.8);
      annotating = false; root.classList.remove('is-annotating');
      setPaused(false);
      logLine('control', 0, 'Jev', `back to field (${f.r},${f.c}) · screening continues`, 'is-side');
    }
  }
}

function cellSensor([r, c]) {
  const i = r * C + c;
  return { hematoxylin_od: +fmt(H[i] / 1000), eosin_od: +fmt(E[i] / 1000), solidity: +fmt(solid[i] / 100), texture: +fmt(tex[i] / 1000) };
}
function bounds(set) {
  let r0 = R, c0 = C, r1 = 0, c1 = 0;
  set.forEach(k => { const r = Math.floor(k / C), c = k % C; r0 = Math.min(r0, r); c0 = Math.min(c0, c); r1 = Math.max(r1, r); c1 = Math.max(c1, c); });
  return { r0, c0, r1: r1 + 1, c1: c1 + 1 };
}
function outlinePath(set) {
  let fill = '', line = '';
  set.forEach(k => {
    const r = Math.floor(k / C), c = k % C;
    fill += `M${c} ${r}h1v1h-1z`;
    if (!set.has(k - C)) line += `M${c} ${r}h1`;
    if (!set.has(k + C)) line += `M${c} ${r + 1}h1`;
    if (c === 0 || !set.has(k - 1)) line += `M${c} ${r}v1`;
    if (c === C - 1 || !set.has(k + 1)) line += `M${c + 1} ${r}v1`;
  });
  return { fill, line };
}

function renderAnnotation(ann) {
  const b = bounds(ann.cells), cell = data.cellLevel0;
  const location = viewer.viewport.imageToViewportRectangle(b.c0 * cell, b.r0 * cell, (b.c1 - b.c0) * cell, (b.r1 - b.r0) * cell);
  const { fill, line } = outlinePath(ann.cells);
  if (!ann.overlay) {
    ann.overlay = document.createElement('div');
    ann.overlay.className = 'js-annotation';
    viewer.addOverlay({ element: ann.overlay, location });
    overlays.push(ann.overlay);
  } else viewer.updateOverlay(ann.overlay, location);
  ann.overlay.innerHTML = `<svg viewBox="${b.c0} ${b.r0} ${b.c1 - b.c0} ${b.r1 - b.r0}" preserveAspectRatio="none">
    <path d="${fill}" fill="#a54a46" fill-opacity=".18"/><path d="${line}" fill="none" stroke="#a54a46" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linecap="square"/></svg>
    ${ann.label ? `<span>${ann.label}</span>` : ''}`;
}

function finish() {
  setHud('Overview', 'all node tissue covered', 'survey');
  setSpringTime(1.2);
  viewer.viewport.goHome();
  const med = [...stats.latencies].sort((a, b) => a - b)[Math.floor(stats.latencies.length / 2)] || 0;
  logLine('done', 0, 'screen complete',
    `<b>${coverage()}%</b> of node tissue · ${stats.fields} fields · ${stats.calls} calls · ${stats.decisions} decisions · median ${Math.round(med)} ms · ${annotations.length} annotation(s)`, 'is-answer');
}

function coverage() {
  let total = 0, seen = 0;
  fields.forEach(f => { if (f.screen) { total += f.s.node; if (f.visited) seen += f.s.node; } });
  return total ? Math.round(seen / total * 100) : 0;
}

// ── Viewer ────────────────────────────────────────────────────────────────────
function setSpringTime(seconds) {
  const v = viewer.viewport;
  [v.centerSpringX, v.centerSpringY, v.zoomSpring].forEach(s => { if (s) s.animationTime = seconds; });
}
function flyTo(c, r, w, h, seconds) {
  setSpringTime(seconds);
  const cell = data.cellLevel0;
  viewer.viewport.fitBounds(viewer.viewport.imageToViewportRectangle(c * cell, r * cell, w * cell, h * cell));
  return sleep(seconds * 1000 + 40);
}
const goToField = (f, seconds) => flyTo(f.c, f.r, fieldW, fieldH, seconds);
// Screen pixels per level-0 pixel across the visible width, scaled to the 40x scan.
const currentMag = () => {
  const visible = viewer.viewport.viewportToImageRectangle(viewer.viewport.getBounds(true));
  return data.objective * viewer.viewport.getContainerSize().x / visible.width;
};

// ── Panel ─────────────────────────────────────────────────────────────────────
function setHud(mag, where, pace) {
  $('.js-hud-mag').textContent = mag;
  $('.js-hud-field').textContent = where;
  const el = $('.js-pace'); el.dataset.pace = pace; el.textContent = pace;
  root.dataset.pace = pace;
}

function renderStats() {
  if (!stats || root.hidden) return;
  const now = performance.now();
  const recent = stats.latencies.slice(-30).sort((a, b) => a - b);
  const set = (k, v) => { const el = root.querySelector(`[data-stat="${k}"]`); if (el) el.textContent = v; };
  set('calls', stats.calls);
  set('decisions', stats.decisions);
  set('rate', (stats.times.filter(t => now - t < 5000).length / 5).toFixed(1));
  set('median', recent.length ? Math.round(recent[Math.floor(recent.length / 2)]) : '—');
  set('fields', stats.fields);
  set('coverage', `${coverage()}%`);
  set('warmed', stats.warmed);
  set('cost', `$${stats.cost.toFixed(4)}`);
}

function logLine(kind, ms, what, detail, extra = '') {
  const li = document.createElement('li');
  li.className = extra;
  const numbered = !['control', 'sensor', 'done', 'error'].includes(kind);
  li.innerHTML = `<span class="n">${numbered ? `#${String(++logCount).padStart(3, '0')}` : ''}</span><span class="ms">${ms ? `${Math.round(ms)} ms` : ''}</span><span class="what">${what}</span><span class="ans">${detail}</span>`;
  const list = $('.js-log');
  list.prepend(li);
  while (list.children.length > 80) list.lastElementChild.remove();
}

function renderSensor(f) {
  const s = f.s, bar = (label, v, color) => `<div class="js-bar"><span>${label}</span><i><b style="width:${Math.round(v * 100)}%;background:${color}"></b></i><em>${Math.round(v * 100)}%</em></div>`;
  $('.js-sensor').innerHTML = `<p class="js-sensor-title">What Jev sees · field (${f.r},${f.c})${isRim(f) ? ' · node rim' : ''}</p>
    ${bar('lymph node', s.mix.lymph_node, 'rgb(76,68,88)')}${bar('intermediate', s.mix.intermediate, 'rgb(201,143,146)')}${bar('adipose', s.mix.adipose, 'rgb(214,200,165)')}
    <p class="js-sensor-nums">H ${fmt(s.H)} · E ${fmt(s.E)} · solidity ${fmt(s.solidity)} · texture ${fmt(s.texture)} · rim ${fmt(s.rim)}</p>`;
}

let bases = null;
function drawBaseMaps() {
  const mk = paint => {
    const cv = document.createElement('canvas'); cv.width = C; cv.height = R;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(C, R);
    for (let i = 0; i < R * C; i++) { const [r, g, b] = paint(i); img.data.set([r, g, b, 255], i * 4); }
    ctx.putImageData(img, 0, 0); return cv;
  };
  const ramp = (to, t) => PALETTE.glass.map((v, k) => Math.round(v + (to[k] - v) * Math.max(0, Math.min(1, t))));
  bases = {
    H: mk(i => cls[i] ? ramp([61, 52, 102], H[i] / 560) : PALETTE.glass),
    E: mk(i => cls[i] ? ramp([165, 74, 70], E[i] / 300) : PALETTE.glass),
    D: mk(i => [PALETTE.glass, PALETTE.adipose, PALETTE.intermediate, PALETTE.lymph][cls[i]])
  };
}

function drawMaps(current) {
  if (!bases) return;
  root.querySelectorAll('canvas[data-map]').forEach(cv => {
    const scale = 3;
    if (cv.width !== C * scale) { cv.width = C * scale; cv.height = R * scale; }
    const ctx = cv.getContext('2d'), px = v => v * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bases[cv.dataset.map], 0, 0, C * scale, R * scale);
    fields.forEach(f => {
      if (f.screen === false) { ctx.fillStyle = 'rgba(250,250,248,.6)'; ctx.fillRect(px(f.c), px(f.r), px(fieldW), px(fieldH)); }
      else if (f.visited) { ctx.fillStyle = 'rgba(22,22,22,.16)'; ctx.fillRect(px(f.c), px(f.r), px(fieldW), px(fieldH)); }
      else if (f.lookahead !== null && f.lookahead >= 0.5) { ctx.fillStyle = '#617f75'; ctx.beginPath(); ctx.arc(px(f.c + fieldW / 2), px(f.r + fieldH / 2), 3.2, 0, Math.PI * 2); ctx.fill(); }
    });
    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(22,22,22,.55)'; ctx.lineWidth = 1.2; ctx.beginPath();
      trail.slice(-80).forEach(([r, c], i) => (i ? ctx.lineTo(px(c), px(r)) : ctx.moveTo(px(c), px(r)))); ctx.stroke();
    }
    annotations.forEach(a => {
      ctx.fillStyle = 'rgba(165,74,70,.55)';
      a.cells.forEach(k => ctx.fillRect(px(k % C), px(Math.floor(k / C)), scale, scale));
    });
    if (current) { ctx.strokeStyle = '#161616'; ctx.lineWidth = 2; ctx.strokeRect(px(current.c) - 1, px(current.r) - 1, px(fieldW) + 2, px(fieldH) + 2); }
  });
}
