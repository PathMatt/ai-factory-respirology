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
  // ---------- Title-only detailed factory (line art). Corner/closing motif above is untouched. ----------
  function titleFactorySvg() {
    const GY = 112, out = [], det = [], glow = [];
    let n = 0;
    const L = d => out.push(`<path class="slot" style="--i:${n++ % 7}" d="${d}"/>`);   // main outlines (draw-in)
    const D = d => det.push(`<path d="${d}"/>`);                                        // fine detail (fades in)
    const win = (x, y, w, h, lit, k) => {
      det.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`);
      if (lit) glow.push(`<rect class="glow${k ? ' f' + k : ''}" x="${x + .35}" y="${y + .35}" width="${w - .7}" height="${h - .7}"/>`);
    };
    // Chimney: tapered, banded, capped, with a ladder; mouth marks where the plume starts.
    const mouths = [];
    const chimney = (cx, base, top, wb, wt, ladderSide) => {
      const xl0 = cx - wb / 2, xr0 = cx + wb / 2, xl1 = cx - wt / 2, xr1 = cx + wt / 2;
      L(`M${xl0} ${base}L${xl1} ${top + 3}M${xr0} ${base}L${xr1} ${top + 3}`);
      L(`M${xl1 - 1.2} ${top + 3}H${xr1 + 1.2}V${top}H${xl1 - 1.2}Z`);                // cap
      const bands = [.18, .45, .72];
      bands.forEach(f => { const y = top + 3 + (base - top - 3) * f, hw = (wt + (wb - wt) * f) / 2; D(`M${cx - hw} ${y}H${cx + hw}M${cx - hw} ${y + 1.2}H${cx + hw}`); });
      const lx = ladderSide > 0 ? xr0 + .6 : xl0 - 2.4, lx1 = ladderSide > 0 ? xr1 + .6 : xl1 - 2.4;
      D(`M${lx} ${base}L${lx1} ${top + 4}M${lx + 1.8} ${base}L${lx1 + 1.8} ${top + 4}`);
      for (let y = base - 2; y > top + 5; y -= 2.6) { const f = (base - y) / (base - top - 4), x = lx + (lx1 - lx) * f; D(`M${x} ${y}H${x + 1.8}`); }
      mouths.push(`<circle class="stack-mouth" cx="${cx}" cy="${top - .8}" r=".1"/>`);
    };

    // Water tower
    L(`M12 ${GY}L15 66M30 ${GY}L27 66M21 ${GY}V66`);
    D(`M13.2 98L28.8 84M13.2 84L28.8 98M14.4 80L27.6 70M14.4 70L27.6 80`);
    L(`M11 66H31V50H11ZM11 50Q21 41 31 50`);
    D(`M11 55H31M11 61H31M21 41V38`);

    // A: pitched-roof warehouse with loading bays and a brick hint
    L(`M36 ${GY}V78L58 64L80 78V${GY}M34 79L58 63L82 79`);
    for (const x of [40, 60]) { L(`M${x} ${GY}V96H${x + 14}V${GY}`); for (let y = 99; y < GY; y += 3) D(`M${x + 1} ${y}H${x + 13}`); }
    win(54, 70, 8, 5, true, 1); D(`M58 70V75`);
    D(`M37 84H40M38.5 87H41.5M37 90H40M76 86H79M77.5 89H80.5`);

    // B: main hall with a sawtooth roof, two rows of windows, central door
    const bx0 = 86, bx1 = 170, bTop = 72, tooth = 21;
    let roof = `M${bx0} ${GY}V${bTop}`;
    for (let x = bx0; x < bx1; x += tooth) roof += `L${x} ${bTop - 11}L${x + tooth} ${bTop}`;
    L(roof + `V${GY}`);
    for (let x = bx0; x < bx1; x += tooth) { D(`M${x + 1} ${bTop - 9.5}L${x + 1} ${bTop - 2}`); D(`M${x + 2.5} ${bTop - 8}L${x + 2.5} ${bTop - 1}`); }   // north-light glazing
    const litB = new Set([2, 5, 6, 9, 13, 16, 19]);
    let wi = 0;
    for (const y of [78, 89]) for (let x = bx0 + 4; x < bx1 - 6; x += 6.6) { const k = wi++; if (y === 89 && x > 120 && x < 136) continue; win(x, y, 3.6, 5.2, litB.has(k), k % 3 === 0 ? 2 : (k % 5 === 0 ? 3 : 0)); }
    L(`M122 ${GY}V99H134V${GY}`); D(`M128 99V${GY}`);
    D(`M${bx0} 97H${bx1}`);                                                            // plinth line
    chimney(114, bTop - 11, 12, 9, 6.2, 1);

    // Pipe rack: A → B (low) and B → C (high, on supports)
    L(`M80 86H86M80 90H86`); D(`M82.5 85V91`);
    L(`M170 66H182M170 69H182`); D(`M174 66V69M178 66V69M176 69V${GY}`);

    // C: boiler house, panelled, with two chimneys
    L(`M182 ${GY}V70H224V${GY}`); D(`M180.5 70H225.5`);
    for (let x = 188; x < 224; x += 6) D(`M${x} 74V${GY - 2}`);                       // panel seams
    win(186, 76, 5, 4, true, 3); win(204, 76, 5, 4, false); win(214, 76, 5, 4, true, 0);
    L(`M195 ${GY}V100H205V${GY}`);
    chimney(193, 70, 24, 7.5, 5.4, -1);
    chimney(213, 70, 32, 7, 5, 1);

    // Conveyor: D → C, rising on a truss with rollers
    L(`M226 92L246 78M226 95L246 81`);
    for (let i = 0; i <= 4; i++) { const x = 228 + i * 4.4, y = 93.1 - i * 3.08; D(`M${x} ${y + 1.6}V${GY}`); }
    for (let i = 0; i < 5; i++) det.push(`<circle cx="${229 + i * 4}" cy="${91.6 - i * 2.8}" r=".6"/>`);

    // D: small pitched shed with a gear on the gable
    L(`M246 ${GY}V80L258 72L270 80V${GY}M244.5 81L258 71L271.5 81`);
    L(`M252 ${GY}V102H262V${GY}`); for (let y = 104.5; y < GY; y += 2.5) D(`M253 ${y}H261`);
    const gx = 258, gy = 88, teeth = [];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; teeth.push(`M${(gx + Math.cos(a) * 4.2).toFixed(2)} ${(gy + Math.sin(a) * 4.2).toFixed(2)}L${(gx + Math.cos(a) * 5.6).toFixed(2)} ${(gy + Math.sin(a) * 5.6).toFixed(2)}`); }
    det.push(`<g class="gear"><circle cx="${gx}" cy="${gy}" r="4.2"/><circle cx="${gx}" cy="${gy}" r="1.4"/><path d="${teeth.join('')}"/></g>`);

    return `<svg class="factory factory-art" viewBox="0 0 280 120" preserveAspectRatio="xMidYMax meet">
      <path class="ground" d="M0 ${GY}H280"/><g class="glows">${glow.join('')}</g>${out.join('')}<g class="det">${det.join('')}</g>${mouths.join('')}</svg>`;
  }
  deck.querySelectorAll('[data-motif]').forEach(el => { el.innerHTML = el.dataset.motif === 'art' ? titleFactorySvg() : factorySvg(el.dataset.motif); });
  const corner = deck.querySelector('.motif');
  const setBuild = (root, n) => root.querySelectorAll('.blk').forEach(b => b.classList.toggle('on', Number(b.dataset.b) <= n));

  // ---------- Title: dust plumes billow from the stacks; words ride inside them ----------
  // Reusable plume scene (title + closing bookend): one instance per slide, runs only while active.
  function plumeScene(titleSlide, ceil0) {
    const dust = titleSlide.querySelector('.dust');
    const WORDS = ['eye tracking', 'mitotic figures', 'foundation models', 'embeddings', 'triage', 'reporting', 'Jev', 'reasoning', 'vision', 'agents', 'math', 'gaze', 'UMAP', 'dictation'];
    const MAX_WORDS = 9;
    const plume = document.createElement('canvas');
    plume.className = 'plume';
    const pctx = plume.getContext('2d');
    // Pre-rendered smoke sprites (no CSS blur filters → cheap at 60fps).
    // Billows: clusters of soft lobes, lit from above with a greyer underside, so each puff reads as volume.
    const haze = rgb => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(.45, `rgba(${rgb},.5)`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c;
    };
    const billow = (seed, lit, mid, shade) => {
      let s = seed;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const S = 192, c = document.createElement('canvas'); c.width = c.height = S;
      const g = c.getContext('2d'), lobes = [];
      const n = 10 + Math.floor(rnd() * 6);
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.283, d = Math.pow(rnd(), .7) * 46;
        lobes.push([96 + Math.cos(a) * d, 100 + Math.sin(a) * d * .8, Math.max(16, 42 - d * .45 + rnd() * 10)]);
      }
      lobes.sort((p, q) => q[1] - p[1]);   // lower lobes first, lit upper lobes overlap them
      for (const [x, y, r] of lobes) {
        const gr = g.createRadialGradient(x - r * .28, y - r * .34, 0, x, y, r);
        gr.addColorStop(0, `rgba(${lit},.95)`); gr.addColorStop(.42, `rgba(${mid},.6)`);
        gr.addColorStop(.8, `rgba(${shade},.22)`); gr.addColorStop(1, `rgba(${shade},0)`);
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
      }
      g.globalCompositeOperation = 'source-atop';
      const v = g.createLinearGradient(0, 40, 0, 170);
      v.addColorStop(0, 'rgba(255,244,220,.12)'); v.addColorStop(.55, 'rgba(120,112,100,0)'); v.addColorStop(1, 'rgba(14,26,40,.45)');
      g.fillStyle = v; g.fillRect(0, 0, S, S);
      return c;
    };
    const BILLOWS = [];
    for (let i = 0; i < 8; i++) BILLOWS.push(i % 3 === 2
      ? billow(7919 * (i + 3), '236,214,170', '201,172,118', '120,104,82')     // warm brass
      : billow(7919 * (i + 3), '238,230,212', '196,186,166', '104,100,96'));   // pale ash
    const HAZE = [haze('206,192,162'), haze('176,166,148')];
    let dustRaf = 0, dustLast = 0, T = 0, frame = 0, src0 = [], words = [], puffs = [], stackTimers = [], wordTimers = [], cw = 0, ch = 0, dpr = 1;
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
      dpr = .42 * (W ? r.width / W : 1);   // soft puffs need little resolution: a reduced-res canvas keeps fill cost low
      if (W !== cw || H !== ch) {
        cw = W; ch = H;
        plume.width = Math.round(cw * dpr); plume.height = Math.round(ch * dpr); plume.style.width = cw + 'px'; plume.style.height = ch + 'px';
      }
    }
    // Fade everything out before it reaches the title block (top ~35% of the slide).
    const ceiling = y => Math.max(0, Math.min(1, (y - ch * ceil0) / (ch * .14)));
    // Divergence-free swirl (curl of a drifting stream function): gives the plume eddies without noise textures.
    const curl = (x, y, t, w) => {
      const X = x / w, Y = y / w, p = 9 * X + .5 * t, q = 7 * Y - .4 * t, r = 14 * X - 11 * Y + .7 * t;
      return [w * (-.0105 * Math.sin(p) * Math.sin(q) - .0099 * Math.cos(r)), -w * (.0135 * Math.cos(p) * Math.cos(q) + .0126 * Math.cos(r))];
    };
    // Three layers per stack: a dense core at the mouth, the main billows, and a faint haze that spreads higher up.
    const KINDS = {
      core:   { every: .075, life: [1.3, .7], r0: [.006, .003], r1: [.026, .012], peak: [.42, .16], vy: [.04, .012], spin: .5 },
      billow: { every: .15, life: [4.6, 1.8], r0: [.012, .006], r1: [.062, .042], peak: [.26, .12], vy: [.033, .012], spin: .25 },
      haze:   { every: .55, life: [6.2, 1.6], r0: [.03, .01], r1: [.13, .05], peak: [.075, .035], vy: [.026, .008], spin: 0 },
    };
    const R = ([a, b]) => a + Math.random() * b;
    function spawnPuff(si, w, kind) {
      const K = KINDS[kind];
      puffs.push({ si, kind, x: (Math.random() - .5) * w * .006, y: w * .002, age: 0, life: R(K.life),
        vy: w * R(K.vy), vx: w * (.004 + Math.random() * .008), wind: w * (.012 + Math.random() * .01),
        r0: w * R(K.r0), r1: w * R(K.r1), peak: R(K.peak), rot: Math.random() * 6.283, spin: (Math.random() - .5) * K.spin,
        spr: kind === 'haze' ? HAZE[Math.random() < .6 ? 0 : 1] : BILLOWS[Math.floor(Math.random() * BILLOWS.length)] });
    }
    function spawnWord(si, w) {
      const shown = new Set(words.map(p => p.el.textContent));
      const pool = WORDS.filter(t => !shown.has(t));
      const el = document.createElement('span');
      el.textContent = pool[Math.floor(Math.random() * pool.length)];
      dust.append(el);
      words.push({ el, si, x: (Math.random() - .5) * w * .008, y: -w * .028, age: 0,
        life: 4.4 + Math.random() * 1.2, vy: w * (.03 + Math.random() * .006), vx: w * (.006 + Math.random() * .006),
        wind: w * (.012 + Math.random() * .006), s0: .85 + Math.random() * .2, peak: .78 + Math.random() * .2 });
    }
    function move(p, dt, w, src, follow) {
      const k = p.age / p.life, m = src[p.si] || src[0];
      const [ux, uy] = curl(m[0] + p.x, m[1] + p.y, T, w), turb = follow * Math.min(1, k * 3);   // calm at the mouth, eddying higher up
      p.y -= p.vy * dt * (1 - k * .55) - uy * turb * dt;
      p.x += (p.vx + p.wind * k + ux * turb) * dt;
    }
    function step(dt, w, src) {
      T += dt;
      src.forEach((m, i) => {
        const tm = stackTimers[i] || (stackTimers[i] = { core: Math.random() * .05, billow: Math.random() * .1, haze: Math.random() * .3 });
        for (const kind in KINDS) { tm[kind] -= dt; while (tm[kind] <= 0) { spawnPuff(i, w, kind); tm[kind] += KINDS[kind].every * (.75 + Math.random() * .5); } }
        // Words: each stack releases its own, spaced out so they never stack on top of one another.
        wordTimers[i] = (wordTimers[i] ?? .3 + i * .55 + Math.random() * .4) - dt;
        if (wordTimers[i] <= 0) {
          const crowded = words.length >= MAX_WORDS || words.some(p => { const n = src[p.si] || src[0]; return Math.abs(n[1] + p.y - m[1] + w * .028) < w * .04 && Math.abs(n[0] + p.x - m[0]) < w * .13; });
          if (crowded) wordTimers[i] = .2; else { spawnWord(i, w); wordTimers[i] = 1.45 + Math.random() * .6; }
        }
      });
      puffs = puffs.filter(p => { p.age += dt; if (p.age >= p.life) return false; p.rot += p.spin * dt; move(p, dt, w, src, 1); return true; });
      words = words.filter(p => { p.age += dt; if (p.age >= p.life) { p.el.remove(); return false; } move(p, dt, w, src, .7); return true; });
    }
    function draw(w, src = mouths()) {
      if (!src.length) return;
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pctx.clearRect(0, 0, cw, ch);
      for (const p of puffs) {
        const k = p.age / p.life, r = p.r0 + (p.r1 - p.r0) * Math.sqrt(k);
        const m = src[p.si] || src[0], X = m[0] + p.x, Y = m[1] + p.y;
        // Dense near the stack, thinning as it rises and spreads.
        const a = p.peak * Math.min(1, k / .08) * Math.pow(1 - k, 1.4) * ceiling(Y);
        if (a < .004) continue;
        pctx.globalAlpha = a;
        const c = Math.cos(p.rot) * dpr, s = Math.sin(p.rot) * dpr;
        pctx.setTransform(c, s, -s, c, X * dpr, Y * dpr);
        pctx.drawImage(p.spr, -r, -r, r * 2, r * 2);
      }
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pctx.globalAlpha = 1;
      for (const p of words) {
        const k = p.age / p.life;
        const m = src[p.si] || src[0], X = m[0] + p.x, Y = m[1] + p.y;
        const fade = Math.min(1, k / .15) * (1 - Math.max(0, (k - .55) / .45)) * ceiling(Y);
        p.el.style.opacity = (fade * p.peak).toFixed(3);
        p.el.style.transform = `translate(${X.toFixed(1)}px, ${Y.toFixed(1)}px) translate(-50%, -50%) scale(${(p.s0 * (1 + k * .45)).toFixed(3)})`;
      }
    }
    function dustFrame(now) {
      const dt = Math.min(.05, (now - dustLast) / 1000); dustLast = now;
      sizeCanvas();
      if (!src0.length || ++frame % 30 === 0) src0 = mouths();   // stacks don't move; re-measure occasionally (resize)
      const w = cw, src = src0;
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
        const w = cw, src = mouths();
        if (!src.length) return;
        // Words placed relative to their stack so they sit inside the frozen plumes.
        [['Jev', 0, .015, -.045, .7], ['foundation models', 0, .035, -.075, .55], ['eye tracking', 1, .01, -.05, .7], ['embeddings', 1, .03, -.11, .45], ['mitotic figures', 2, .045, -.1, .6]]
          .forEach(([t, si, dx, dy, o]) => { const m = src[si] || src[0], el = document.createElement('span'); el.textContent = t; el.style.opacity = o; el.style.transform = `translate(${m[0] + dx * w}px, ${m[1] + dy * w}px) translate(-50%, -50%)`; dust.append(el); });
        return;
      }
      prewarm(2.4);   // plumes are already billowing on the first visible frame
      dustLast = performance.now();
      dustRaf = requestAnimationFrame(dustFrame);
    }
    function stopDust() { cancelAnimationFrame(dustRaf); dustRaf = 0; words = []; puffs = []; stackTimers = []; wordTimers = []; T = 0; src0 = []; dust.replaceChildren(); }
    reduced.addEventListener('change', () => { if (!titleSlide.hidden) startDust(); });
    return { start: startDust, stop: stopDust };
  }
  const titleSlide = document.getElementById('title');
  const closingSlide = document.getElementById('closing');
  const scenes = new Map([[titleSlide, plumeScene(titleSlide, .38)], [closingSlide, plumeScene(closingSlide, .40)]]);


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

  // HP exposure history: one question over a synthetic note; each exposure links back to its source sentence.
  const hpSlide = document.getElementById('hp-history');
  const hpTimers = [];
  const hpSources = n => hpSlide.querySelectorAll(`[data-hit="${n}"]`);
  function resetHp() { hpTimers.splice(0).forEach(clearTimeout); delete hpSlide.dataset.revealed; hpSlide.querySelectorAll('.is-on, .is-focus').forEach(x => x.classList.remove('is-on', 'is-focus')); }
  function revealHp() {
    if (hpSlide.dataset.revealed === 'true') return;
    hpSlide.dataset.revealed = 'true';
    const hits = [...hpSlide.querySelectorAll('.hp-hit')];
    hits.forEach((li, i) => {
      const on = () => hpSources(li.dataset.hit).forEach(x => x.classList.add('is-on'));
      if (reduced.matches) on(); else hpTimers.push(setTimeout(on, 250 + i * 260));
    });
  }
  hpSlide.querySelector('.hp-run').addEventListener('click', e => { e.currentTarget.blur(); revealHp(); });
  hpSlide.querySelectorAll('[data-hit]').forEach(x => {
    const focus = on => { if (hpSlide.dataset.revealed === 'true') hpSources(x.dataset.hit).forEach(y => y.classList.toggle('is-focus', on)); };
    x.addEventListener('pointerenter', () => focus(true));
    x.addEventListener('pointerleave', () => focus(false));
  });

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
      if (scenes.has(prevReal)) scenes.get(prevReal).stop();
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
    if (el === hpSlide && prevReal !== hpSlide) resetHp();
    if (el.id === 'lung-case') lungStep(Number(logical.dataset.lungStep || 0));
    if (scenes.has(el)) {
      el.classList.remove('is-drawn', 'is-settled');
      void el.offsetWidth;
      el.classList.add('is-drawn');
      setTimeout(() => { if (el.classList.contains('is-drawn')) el.classList.add('is-settled'); }, 2600);
      if (prevReal !== el) requestAnimationFrame(scenes.get(el).start);
    }
    playVideos(el);
    if (prevReal !== el) buildUp(el);
    if (prev >= 0 && slides[prev].id === 'workload' && target === prev + 1 && !reduced.matches) {
      sweep.classList.remove('run'); void sweep.offsetWidth; sweep.classList.add('run');
    }
    jevScanFocus = false;
  }
  const next = () => goTo(current + 1), prev = () => goTo(current - 1);

  // Camp Pods' closing sequence asks for its title slide when it finishes; here that is the Thank-you slide.
  document.addEventListener('closing-title-request', () => {
    if (slides[current] && slides[current].id === 'closing-future') goTo(slides.findIndex(s => s.id === 'closing'));
  });
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
      if (fwd && el === hpSlide && el.dataset.revealed !== 'true') { revealHp(); return; }
      fwd ? next() : prev();
    } else if (k === 'Home') { e.preventDefault(); goTo(0); }
    else if (k === 'End') { e.preventDefault(); goTo(slides.length - 1); }
    else if (k === 'n' || k === 'N') { notesPanel.hidden = !notesPanel.hidden; }
    else if (k === 'f' || k === 'F') {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, true);

  const INTERACTIVE = 'a, button, input, textarea, select, video, canvas, label, [role="dialog"], .lung-workspace, .cluster-interactive, .js-stage, .js-panel, .cf-shelf, .cf-result, .hp-results, .input-vm-stage, .openseadragon-container, .notes-panel';
  deck.addEventListener('click', e => {
    if (!(e.target instanceof Element) || e.target.closest(INTERACTIVE)) return;
    if (getSelection && String(getSelection()).length) return;
    const el = real(slides[current]);
    if (el.id === 'cluster-embeddings' && el.dataset.revealed !== 'true') { document.dispatchEvent(new Event('cluster-cancer-reveal')); return; }
    if (el === hpSlide && el.dataset.revealed !== 'true') { revealHp(); return; }
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
