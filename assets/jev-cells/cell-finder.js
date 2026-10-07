// Live cell finder: each pause in typing sends one Jev evaluation through /api/cells.
// Jev returns a probability for every cell type, so matches rise off the shelf like
// emoji suggestions. Escape leaves the search box so arrow keys drive the deck again.
import { cellSvg } from './cell-art.js';

const root = document.querySelector('#cell-finder');
const input = root.querySelector('.cf-input');
const status = root.querySelector('.cf-status');
const result = root.querySelector('.cf-result');
const shelf = root.querySelector('.cf-shelf');
const examples = root.querySelector('.cf-examples');

const categoryNames = {
  epithelium: 'Epithelium & glands',
  connective: 'Connective tissue & bone',
  muscle: 'Muscle',
  blood: 'Blood & immune',
  nervous: 'Nervous system',
  reproductive: 'Reproductive'
};
const exampleQueries = ['ciliated', 'columnar', 'columnar with brush border', 'multilobed nucleus', 'makes antibodies', 'eats bacteria', 'stores fat', 'star-shaped brain cell', 'carries oxygen', 'red granules, asthma'];
const idleText = `Type a description. Jev scores all cell types in one call.`;

const { cells } = await fetch('assets/jev-cells/cells.json').then(r => r.json());
const byKey = new Map(cells.map(cell => [cell.key, cell]));
const shelfCells = new Map();
let timer = 0, seq = 0, controller = null;

cells.forEach(cell => {
  const el = document.createElement('div');
  el.className = 'cf-cell';
  el.title = cell.name;
  el.innerHTML = cellSvg(cell);
  shelf.append(el);
  shelfCells.set(cell.key, el);
});
exampleQueries.forEach(text => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.addEventListener('click', () => { input.value = text; button.blur(); run(); });
  examples.append(button);
});
status.textContent = `${cells.length} cell types · typesafe-ai/jev via AI Gateway`;
showIdle();

input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 220); });
input.addEventListener('keydown', event => {
  if (event.key === 'Enter') { clearTimeout(timer); run(); }
  if (event.key === 'Escape') input.blur();
});

async function run() {
  const query = input.value.trim();
  if (query.length < 2) { showIdle(); return; }
  const id = ++seq;
  controller?.abort();
  controller = new AbortController();
  root.classList.add('is-asking');
  const started = performance.now();
  try {
    const response = await fetch('/api/cells', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: controller.signal
    });
    const answer = await response.json();
    if (id !== seq) return;
    if (!response.ok) throw new Error(answer.error || `HTTP ${response.status}`);
    show(answer, performance.now() - started);
  } catch (error) {
    if (error.name === 'AbortError' || id !== seq) return;
    status.textContent = `Jev unavailable: ${error.message}`;
  } finally {
    if (id === seq) root.classList.remove('is-asking');
  }
}

function showIdle() {
  seq++;
  controller?.abort();
  root.classList.remove('is-asking');
  shelf.classList.remove('has-query');
  shelfCells.forEach(el => el.classList.remove('is-hit', 'is-top'));
  result.innerHTML = `<p class="cf-idle">${idleText}</p>`;
}

function show(answer, roundTripMs) {
  const ranked = Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]);
  const [topKey, topP] = ranked[0];
  const runners = ranked.slice(1).filter(([, p]) => p >= 0.02).slice(0, 4);
  const top = byKey.get(topKey);

  shelf.classList.add('has-query');
  shelfCells.forEach((el, key) => {
    el.classList.toggle('is-top', key === topKey);
    el.classList.toggle('is-hit', runners.some(([k]) => k === key));
  });

  const pct = p => `${Math.round(p * 100)}%`;
  result.innerHTML = `
    <div class="cf-top">
      <div class="cf-top-art">${cellSvg(top)}</div>
      <div>
        <p class="cf-top-name">${top.name}</p>
        <p class="cf-top-category">${categoryNames[answer.category] || answer.category}</p>
        <p class="cf-bar"><i style="width:${pct(topP)}"></i><span>${pct(topP)}</span></p>
      </div>
    </div>
    <ol class="cf-runners">${runners.map(([key, p]) => `
      <li><span class="cf-runner-art">${cellSvg(byKey.get(key))}</span><span>${byKey.get(key).name}</span><span class="cf-bar"><i style="width:${pct(p)}"></i><span>${pct(p)}</span></span></li>`).join('')}
    </ol>`;
  const cost = answer.cost ? ` · $${Number(answer.cost).toFixed(5)}` : '';
  status.textContent = `Jev · ${Math.round(roundTripMs)} ms round trip${cost}`;
}
