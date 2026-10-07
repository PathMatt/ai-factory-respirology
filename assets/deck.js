// Building the AI Factory: navigation, chrome and slide hooks.
// Contract with the lifted Camp Pods modules (unchanged): exactly one slide is visible
// (others carry [hidden]) and every change fires `deck-slide-change` with the slide id.
(() => {
  const deck = document.getElementById('deck');
  const slides = [...deck.querySelectorAll(':scope > .slide')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fill = deck.querySelector('.progress i');
  const counter = deck.querySelector('.counter');
  const notesPanel = deck.querySelector('.notes-panel');
  const notesText = deck.querySelector('.notes-text');
  const sweep = deck.querySelector('.sweep');
  const real = s => (s.dataset.alias ? document.getElementById(s.dataset.alias) : s);
  let current = -1, lungTimer = 0, jevScanFocus = false;
  slides.forEach(s => { s.hidden = true; });

  // ---------- Factory drawing: 7 slots, blocks drop in as sections pass ----------
  const G = 56, DX = 5, DY = 3;
  const BLOCKS = [[4, 16, 14], [20, 18, 22], [38, 20, 30], [58, 18, 24], [76, 18, 18], [94, 16, 26], [110, 18, 20]];
  const STACKS = { 2: [12, 16], 5: [5, 12], 6: [11, 14] };   // title art: block index → [x offset, height]
  function factorySvg(kind) {
    const slots = [], blocks = [];
    BLOCKS.forEach(([x, w, h], i) => {
      const t = G - h;
      const outline = `M${x} ${G}V${t}H${x + w}V${G}M${x} ${t}L${x + DX} ${t - DY}H${x + w + DX}L${x + w} ${t}M${x + w + DX} ${t - DY}V${G - DY}L${x + w} ${G}`;
      slots.push(`<path class="slot" style="--i:${i}" d="${outline}"/>`);
      let extra = '';
      for (let r = t + 4; r < G - 4; r += 6) for (let c = x + 3; c < x + w - 3; c += 5) extra += `<rect class="win" x="${c}" y="${r}" width="2" height="2.4"/>`;
      if (i === 6) {
        extra += `<rect class="front" x="${x + 11}" y="${t - 14}" width="4" height="14"/><polygon class="top" points="${x + 11},${t - 14} ${x + 12.5},${t - 15} ${x + 16.5},${t - 15} ${x + 15},${t - 14}"/>`;
        extra += `<path class="smoke" d="M${x + 13} ${t - 17}q-2 -3 0 -6"/><path class="smoke s2" d="M${x + 14} ${t - 17}q2 -3 0 -6"/>`;
        extra += `<rect class="lamp" x="${x + 3}" y="${t + 4}" width="3" height="3"/><rect class="lamp" x="${x + 9}" y="${t + 4}" width="3" height="3"/>`;
      }
      if (i === 2) extra += `<rect class="lamp" x="${x + 3}" y="${t + 10}" width="3" height="3"/><rect class="lamp" x="${x + 13}" y="${t + 16}" width="3" height="3"/>`;
      if (i === 5) extra += `<rect class="lamp" x="${x + 8}" y="${t + 4}" width="3" height="3"/>`;
      if (kind === 'art' && STACKS[i]) {
        const [sx, sh] = STACKS[i];
        slots.push(`<path class="stack" d="M${x + sx} ${t - 1.5}V${t - sh}H${x + sx + 4}V${t - 1.5}"/><circle class="stack-mouth" cx="${x + sx + 2}" cy="${t - sh - 1}" r=".1"/>`);
      }
      blocks.push(`<g class="blk" data-b="${i + 1}" style="transition-delay:${kind === 'full' ? i * 90 + 200 : 0}ms">
        <rect class="front" x="${x}" y="${t}" width="${w}" height="${h}"/>
        <polygon class="top" points="${x},${t} ${x + DX},${t - DY} ${x + w + DX},${t - DY} ${x + w},${t}"/>
        <polygon class="side" points="${x + w},${t} ${x + w + DX},${t - DY} ${x + w + DX},${G - DY} ${x + w},${G}"/>${extra}</g>`);
    });
    return `<svg class="factory" viewBox="0 0 140 60" preserveAspectRatio="xMidYMax meet">
      <path class="ground" d="M0 ${G}H140"/>${slots.join('')}${kind === 'art' ? '' : blocks.join('')}</svg>`;
  }
  deck.querySelectorAll('[data-motif]').forEach(el => { el.innerHTML = factorySvg(el.dataset.motif); });
  const corner = deck.querySelector('.motif');
  const setBuild = (root, n) => root.querySelectorAll('.blk').forEach(b => b.classList.toggle('on', Number(b.dataset.b) <= n));

  // ---------- Title: dust plumes billow from the stacks; words ride inside them ----------
  const titleSlide = document.getElementById('title');
  const dust = titleSlide.querySelector('.dust');
  const WORDS = ['eye tracking', 'mitotic figures', 'foundation models', 'embeddings', 'triage', 'reporting', 'Jev', 'reasoning', 'vision', 'agents', 'math', 'gaze', 'UMAP', 'dictation'];
  const MAX_WORDS = 16;
  const plume = document.createElement('canvas');
  plume.className = 'plume';
  const pctx = plume.getContext('2d');
  // Pre-rendered soft puff sprites (no CSS blur filters → cheap at 60fps).
  const sprite = rgb => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(.45, `rgba(${rgb},.55)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
  };
  const SPRITES = [sprite('214,196,158'), sprite('190,178,156'), sprite('201,168,106')];
  let dustRaf = 0, dustLast = 0, wordSpawn = 0, words = [], puffs = [], stackTimers = [], cw = 0, ch = 0, dpr = 1;
  // Stack mouths in the slide's own (unscaled) layout units. Measured relative to the
  // factory drawing, then mapped onto its layout box, so entrance transforms or stage
  // scaling at the moment of measurement can't misplace the plumes.
  const site = titleSlide.querySelector('.title-site');
  const mouths = () => {
    const tr = site.getBoundingClientRect();
    if (!tr.width) return [];
    const W = site.offsetWidth, H = site.offsetHeight, left = site.offsetLeft - W / 2, top = site.offsetTop;
    return [...titleSlide.querySelectorAll('.stack-mouth')].map(m => {
      const r = m.getBoundingClientRect();
      return [left + ((r.left + r.width / 2 - tr.left) / tr.width) * W, top + ((r.top + r.height / 2 - tr.top) / tr.height) * H];
    });
  };
  function sizeCanvas() {
    const W = titleSlide.clientWidth, H = titleSlide.clientHeight, r = titleSlide.getBoundingClientRect();
    dpr = .5 * (W ? r.width / W : 1);   // soft puffs need no resolution: half-res canvas keeps fill cost low
    if (W !== cw || H !== ch) {
      cw = W; ch = H;
      plume.width = Math.round(cw * dpr); plume.height = Math.round(ch * dpr); plume.style.width = cw + 'px'; plume.style.height = ch + 'px';
    }
  }
  // Fade everything out before it reaches the title block (top ~35% of the slide).
  const ceiling = y => Math.max(0, Math.min(1, (y - ch * .34) / (ch * .14)));
  function spawnPuff(si, w) {
    puffs.push({ si, x: (Math.random() - .5) * w * .006, y: w * .003, age: 0,
      life: 4.2 + Math.random() * 1.8, vy: w * (.03 + Math.random() * .014), vx: w * (.006 + Math.random() * .01) + (Math.random() - .5) * w * .012,
      wind: w * (.012 + Math.random() * .01), r0: w * (.012 + Math.random() * .006), r1: w * (.07 + Math.random() * .05),
      peak: .1 + Math.random() * .1, spr: SPRITES[Math.random() < .55 ? 0 : (Math.random() < .65 ? 1 : 2)], wob: Math.random() * 6.28 });
  }
  function spawnWord(si, w) {
    const el = document.createElement('span');
    el.textContent = WORDS[Math.floor(Math.random() * WORDS.length)];
    dust.append(el);
    words.push({ el, si, x: (Math.random() - .5) * w * .01, y: -w * .02, age: 0,
      life: 4 + Math.random() * 1.5, vy: w * (.028 + Math.random() * .01), vx: w * (.008 + Math.random() * .008),
      wind: w * (.012 + Math.random() * .008), phase: Math.random() * 6.28, amp: w * (.003 + Math.random() * .004),
      s0: .8 + Math.random() * .3, peak: .6 + Math.random() * .35 });
  }
  function step(dt, w, src) {
    src.forEach((m, i) => {
      stackTimers[i] = (stackTimers[i] ?? Math.random() * .05) - dt;
      while (stackTimers[i] <= 0) { spawnPuff(i, w); stackTimers[i] += .07 + Math.random() * .04; }
    });
    puffs = puffs.filter(p => {
      p.age += dt; const k = p.age / p.life; if (k >= 1) return false;
      p.y -= p.vy * dt * (1 - k * .55);
      p.x += (p.vx + p.wind * k + Math.sin(p.age * 1.3 + p.wob) * w * .003) * dt;
      return true;
    });
    wordSpawn -= dt;
    if (wordSpawn <= 0 && words.length < MAX_WORDS && src.length) { spawnWord(Math.floor(Math.random() * src.length), w); wordSpawn = .42 + Math.random() * .25; }
    words = words.filter(p => {
      p.age += dt; const k = p.age / p.life;
      if (k >= 1) { p.el.remove(); return false; }
      p.y -= p.vy * dt * (1 - k * .55);
      p.x += (p.vx + p.wind * k + Math.cos(p.age * 1.1 + p.phase) * p.amp) * dt;
      return true;
    });
  }
  function draw(w, src = mouths()) {
    if (!src.length) return;
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.clearRect(0, 0, cw, ch);
    for (const p of puffs) {
      const k = p.age / p.life, r = p.r0 + (p.r1 - p.r0) * Math.sqrt(k);
      const m = src[p.si] || src[0], X = m[0] + p.x, Y = m[1] + p.y;
      const a = p.peak * Math.min(1, k / .06) * (1 - k) * ceiling(Y);
      if (a < .004) continue;
      pctx.globalAlpha = a;
      pctx.drawImage(p.spr, X - r, Y - r, r * 2, r * 2);
    }
    pctx.globalAlpha = 1;
    for (const p of words) {
      const k = p.age / p.life;
      const m = src[p.si] || src[0], X = m[0] + p.x, Y = m[1] + p.y;
      const fade = Math.min(1, k / .15) * (1 - Math.max(0, (k - .5) / .5)) * ceiling(Y);
      p.el.style.opacity = (fade * p.peak).toFixed(3);
      p.el.style.transform = `translate(${X.toFixed(1)}px, ${Y.toFixed(1)}px) translate(-50%, -50%) scale(${(p.s0 * (1 + k * .5)).toFixed(3)})`;
    }
  }
  function dustFrame(now) {
    const dt = Math.min(.05, (now - dustLast) / 1000); dustLast = now;
    sizeCanvas();
    const w = cw, src = mouths();
    step(dt, w, src); draw(w, src);
    dustRaf = requestAnimationFrame(dustFrame);
  }
  function prewarm(seconds) {
    sizeCanvas();
    const w = cw, src = mouths();
    if (!src.length || !w) return;
    for (let t = 0; t < seconds; t += 1 / 30) step(1 / 30, w, src);
  }
  function startDust() {
    stopDust();
    dust.append(plume);
    if (reduced.matches) {
      // Static composition: frozen puffs above each stack, a few words caught inside them.
      prewarm(4.2);
      words.forEach(p => p.el.remove()); words = [];
      draw(cw);
      const w = cw, h = ch;
      [['foundation models', .4, .5, .55], ['eye tracking', .6, .47, .5], ['Jev', .47, .43, .45], ['embeddings', .64, .41, .35], ['mitotic figures', .7, .52, .5]]
        .forEach(([t, x, y, o]) => { const el = document.createElement('span'); el.textContent = t; el.style.opacity = o; el.style.transform = `translate(${x * w}px, ${y * h}px) translate(-50%, -50%)`; dust.append(el); });
      return;
    }
    prewarm(2.4);   // plumes are already billowing on the first visible frame
    dustLast = performance.now();
    dustRaf = requestAnimationFrame(dustFrame);
  }
  function stopDust() { cancelAnimationFrame(dustRaf); dustRaf = 0; words = []; puffs = []; stackTimers = []; wordSpawn = 0; dust.replaceChildren(); }
  reduced.addEventListener('change', () => { if (!titleSlide.hidden) startDust(); });

  // ---------- Build-up entrance ----------
  function buildUp(slide) {
    if (reduced.matches) return;
    const kids = [...slide.children].filter(el => !el.hidden && !/-reveal|input-reveal/.test(el.className) && !el.matches('.draft-tag[hidden], .lung-source-panel, .sr-only'));
    kids.forEach((el, i) => el.animate(
      [{ opacity: 0, transform: 'translateY(1.1cqw)' }, { opacity: 1, transform: 'none' }],
      { duration: 380, delay: Math.min(i, 6) * 70, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }));
  }

  // ---------- Slide hooks lifted from the Camp Pods nav script ----------
  const navier = document.getElementById('navier-stokes');
  const bench = document.getElementById('mitosis-benchmark');
  const finishReveal = s => { s.classList.remove('is-playing'); s.classList.add('is-complete'); s.dataset.state = 'finished'; };
  const playReveal = s => {
    if (reduced.matches || s.classList.contains('is-complete')) { finishReveal(s); return; }
    s.classList.add('is-playing'); s.dataset.state = 'playing';
  };
  navier.addEventListener('animationend', e => { if (e.target.classList.contains('navier-last')) finishReveal(navier); });
  bench.addEventListener('animationend', e => { if (e.target.classList.contains('benchmark-last')) finishReveal(bench); });

  // Foundation diagram: tiles split, encoder, embeddings type out, tools (CP renderFoundation).
  const fSlide = document.getElementById('foundation-models');
  const fTiles = [...fSlide.querySelectorAll('.foundation-tile')];
  const fWhole = fSlide.querySelector('.foundation-whole');
  const fModel = fSlide.querySelector('.foundation-model');
  const fPacket = fSlide.querySelector('.foundation-packet');
  const fEmb = fSlide.querySelector('.foundation-embeddings');
  const fVectors = [...fSlide.querySelectorAll('.foundation-vector')];
  const fNodes = [...fSlide.querySelectorAll('.foundation-nodes circle')];
  const fTools = fSlide.querySelector('.foundation-tools');
  const fTasks = [...fSlide.querySelectorAll('.foundation-task')];
  const fLabel = fSlide.querySelector('.foundation-slide-label');
  const ramp = (t, s, d) => Math.max(0, Math.min(1, (t - s) / d));
  let fPlayed = false, fFrame = 0;
  function renderFoundation(time) {
    const split = ramp(time, 1100, 1000), eased = split * split * (3 - 2 * split);
    fTiles.forEach(tile => {
      const col = Number(tile.dataset.col), row = Number(tile.dataset.row);
      tile.setAttribute('transform', `translate(${220 + col * 60 + (col - 1) * 13 * eased} ${290 + row * 54 + (row - 2) * 9 * eased})`);
      tile.querySelector('rect').style.strokeOpacity = ramp(time, 600, 500);
    });
    fWhole.style.opacity = 1 - split;
    fLabel.textContent = split === 1 ? 'Individual tiles' : 'Whole-slide image';
    fModel.style.opacity = ramp(time, 2350, 700);
    fEmb.style.opacity = ramp(time, 3500, 400);
    fVectors.forEach((v, i) => { const t = v.dataset.vector; v.textContent = t.slice(0, Math.floor(t.length * ramp(time, 3700 + i * 550, 500))); });
    const processing = time >= 3100 && time < 6400, travel = ((time - 3100) % 550) / 550;
    fPacket.style.opacity = processing ? 1 : 0;
    if (processing) fPacket.setAttribute('transform', `translate(${468 + 174 * travel} ${408 - 18 * Math.sin(travel * Math.PI)})`);
    fNodes.forEach((n, i) => { n.style.fill = processing && (Math.floor(time / 180) + i) % 5 === 0 ? 'var(--ink)' : 'var(--paper)'; });
    fTools.style.opacity = ramp(time, 6800, 450);
    fTasks.forEach((t, i) => { t.style.opacity = ramp(time, 7250 + i * 450, 400); });
  }
  function finishFoundation() { cancelAnimationFrame(fFrame); fFrame = 0; fPlayed = true; renderFoundation(9300); }
  function playFoundation() {
    if (reduced.matches || fPlayed) { finishFoundation(); return; }
    fPlayed = true;
    const t0 = performance.now();
    const step = now => { const t = now - t0; if (t >= 9300) { finishFoundation(); return; } renderFoundation(t); fFrame = requestAnimationFrame(step); };
    fFrame = requestAnimationFrame(step);
  }
  renderFoundation(0);

  // Jev race: streamed text vs one typed decision (CP playJevRace).
  const jev = document.getElementById('jev');
  const jevText = 'Chronic active gastritis raises concern for Helicobacter pylori. Organisms are not always visible on H&E, particularly when sparse, so a Warthin-Starry or immunohistochemical stain would be reasonable to';
  const jevValue = 'order_warthin_starry: true\nconfidence: 0.94\nroute_to: "GI desk"';
  let jevRaf = 0;
  function playJevRace() {
    cancelAnimationFrame(jevRaf);
    const llmOut = jev.querySelector('[data-out="llm"]'), jevOut = jev.querySelector('[data-out="jev"]');
    const llmClock = jev.querySelector('[data-clock="llm"]'), jevClock = jev.querySelector('[data-clock="jev"]');
    const llmMs = 7000, jevMs = 180;
    if (reduced.matches) { llmOut.textContent = jevText + '…'; llmClock.textContent = 'still going'; jevOut.textContent = jevValue; jevClock.textContent = '0.18 s'; return; }
    const t0 = performance.now();
    const frame = now => {
      const t = now - t0;
      llmOut.textContent = jevText.slice(0, Math.floor(jevText.length * Math.min(1, t / llmMs))) + (t < llmMs ? '▌' : '…');
      llmClock.textContent = t < llmMs ? `${(t / 1000).toFixed(1)} s` : 'still going';
      jevOut.textContent = t >= jevMs ? jevValue : '';
      jevClock.textContent = `${(Math.min(t, jevMs) / 1000).toFixed(2)} s`;
      if (t < llmMs && !jev.hidden) jevRaf = requestAnimationFrame(frame);
    };
    jevRaf = requestAnimationFrame(frame);
  }
  jev.querySelector('.jev-replay').addEventListener('click', playJevRace);

  // Lung case: one lung-case.js instance serves two slides; jump the tour to the slide's step.
  function lungStep(step) {
    const sl = document.getElementById('lung-case');
    clearInterval(lungTimer);
    const apply = () => { const b = sl.querySelectorAll('.lung-timeline button')[step]; if (b) b.click(); return !!b; };
    apply();
    let tries = 0;
    lungTimer = setInterval(() => {
      tries++;
      if ((sl.querySelector('.lung-loading').hidden && apply()) || tries > 200 || sl.hidden) clearInterval(lungTimer);
    }, 120);
  }

  function playVideos(slide) {
    if (document.hidden) return;
    slide.querySelectorAll('video[data-autoplay]').forEach(v => { v.muted = true; v.play().catch(() => { v.controls = true; }); });
  }

  // ---------- Navigation ----------
  function goTo(index, opts = {}) {
    const target = Math.max(0, Math.min(slides.length - 1, index));
    if (target === current && !opts.force) return;
    const prev = current, prevReal = prev >= 0 ? real(slides[prev]) : null;
    const logical = slides[target], el = real(logical);
    if (prevReal && prevReal !== el) {
      prevReal.querySelectorAll('video').forEach(v => v.pause());
      prevReal.classList.remove('is-active');
      if (prevReal === navier || prevReal === bench) finishReveal(prevReal);
      if (prevReal === fSlide) finishFoundation();
      if (prevReal === titleSlide) stopDust();
    }
    current = target;
    slides.forEach(s => { const show = s === el; if (s.hidden === show) s.hidden = !show; });
    el.classList.add('is-active');

    if (logical.dataset.heading) {
      el.querySelector('.fork-heading').textContent = logical.dataset.heading;
      el.querySelector('.chapter').textContent = logical.dataset.chapter;
    }
    const draft = el.querySelector('.draft-tag');
    if (draft) draft.hidden = logical.id !== 'lung-final';

    deck.dataset.dark = String(el.classList.contains('dark'));
    deck.dataset.hideMotif = String(logical.id === 'title' || logical.id === 'closing');
    setBuild(corner, Number(logical.dataset.build || 0));
    fill.style.transform = `scaleX(${(current + 1) / slides.length})`;
    counter.textContent = `${current + 1} / ${slides.length}`;
    notesText.textContent = logical.dataset.notes || '';
    if (location.hash !== `#${current + 1}`) history.replaceState(null, '', `#${current + 1}`);

    document.dispatchEvent(new CustomEvent('deck-slide-change', { detail: el.id }));

    if (el === navier || el === bench) playReveal(el);
    if (el === fSlide) playFoundation();
    if (el === jev && prevReal !== jev) playJevRace();
    if (el.id === 'lung-case') lungStep(Number(logical.dataset.lungStep || 0));
    if (el.id === 'title') {
      el.classList.remove('is-drawn', 'is-settled');
      void el.offsetWidth;
      el.classList.add('is-drawn');
      setTimeout(() => { if (el.classList.contains('is-drawn')) el.classList.add('is-settled'); }, 2600);
      if (prevReal !== el) requestAnimationFrame(startDust);
    }
    if (el.id === 'closing') setBuild(el, 7);
    playVideos(el);
    if (prevReal !== el) buildUp(el);
    if (prev >= 0 && slides[prev].id === 'workload' && target === prev + 1 && !reduced.matches) {
      sweep.classList.remove('run'); void sweep.offsetWidth; sweep.classList.add('run');
    }
    jevScanFocus = false;
  }
  const next = () => goTo(current + 1), prev = () => goTo(current - 1);

  function isTyping(t) { return t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"]'); }
  document.addEventListener('pointerdown', e => {
    jevScanFocus = !!(e.target instanceof Element && e.target.closest('#jev-scan .js-stage, #jev-scan .js-panel'));
  }, true);

  window.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (isTyping(e.target)) return;
    if (e.target instanceof Element && e.target.closest('.lung-source-panel')) return;
    const el = real(slides[current]);
    const k = e.key;
    const fwd = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Spacebar'].includes(k);
    const back = ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(k);
    if (k.startsWith('Arrow') && el.id === 'jev-scan' && jevScanFocus && el.classList.contains('is-paused')) return; // Jev pans the slide
    if (k === ' ' && e.target instanceof Element && e.target.closest('button, a')) return;
    if (fwd || back) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      // Camp Pods: first forward press on the cluster slide reveals the cancer clusters.
      if (fwd && el.id === 'cluster-embeddings' && el.dataset.revealed !== 'true') { document.dispatchEvent(new Event('cluster-cancer-reveal')); return; }
      fwd ? next() : prev();
    } else if (k === 'Home') { e.preventDefault(); goTo(0); }
    else if (k === 'End') { e.preventDefault(); goTo(slides.length - 1); }
    else if (k === 'n' || k === 'N') { notesPanel.hidden = !notesPanel.hidden; }
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, true);

  const INTERACTIVE = 'a, button, input, textarea, select, video, canvas, label, [role="dialog"], .lung-workspace, .cluster-interactive, .js-stage, .js-panel, .cf-shelf, .cf-result, .input-vm-stage, .openseadragon-container, .notes-panel';
  deck.addEventListener('click', e => {
    if (!(e.target instanceof Element) || e.target.closest(INTERACTIVE)) return;
    if (getSelection && String(getSelection()).length) return;
    const el = real(slides[current]);
    if (el.id === 'cluster-embeddings' && el.dataset.revealed !== 'true') { document.dispatchEvent(new Event('cluster-cancer-reveal')); return; }
    next();
  });

  window.addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n >= 1 && n !== current + 1) goTo(n - 1); });
  document.addEventListener('visibilitychange', () => {
    if (current < 0) return;
    const el = real(slides[current]);
    if (document.hidden) el.querySelectorAll('video[data-autoplay]').forEach(v => v.pause()); else playVideos(el);
  });

  // Start after the module scripts have registered their listeners.
  const start = () => {
    const n = parseInt(location.hash.slice(1), 10);
    goTo(n >= 1 && n <= slides.length ? n - 1 : 0, { force: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start);
  window.deckGoTo = n => goTo(n - 1);
})();
