(() => {
  const slides = [...document.querySelectorAll('.input-slide')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let active = null;
  function finish(slide) {
    slide.classList.remove('is-playing');
    slide.classList.add('is-complete');
    slide.dataset.state = 'finished';
  }
  function playMedia(slide) {
    if (reduced.matches || document.hidden) return;
    slide.querySelectorAll('.input-main-video').forEach(video => {
      if (!video.ended) video.play().catch(() => { video.controls = true; });
    });
  }
  slides.forEach(slide => {
    const main = slide.querySelector('.input-main-video');
    const inset = slide.querySelector('.input-video-inset video');
    if (main && inset) {
      const sync = () => {
        if (!Number.isFinite(inset.duration) || inset.duration <= 0) return;
        const target = main.currentTime % inset.duration;
        if (Math.abs(inset.currentTime - target) > .15) inset.currentTime = target;
        if (main.paused || main.ended) inset.pause();
        else if (inset.paused) inset.play().catch(() => {});
      };
      inset.loop = true;
      main.addEventListener('timeupdate', sync);
      main.addEventListener('seeked', sync);
      main.addEventListener('play', sync);
      main.addEventListener('pause', () => inset.pause());
      main.addEventListener('ended', () => inset.pause());
      inset.addEventListener('loadedmetadata', sync);
    }
    slide.addEventListener('animationend', e => {
      if (e.target.classList.contains('input-last')) finish(slide);
    });
  });
  function activate(id) {
    if (active && active.id !== id) {
      finish(active);
      active.querySelectorAll('video').forEach(v => v.pause());
    }
    active = slides.find(slide => slide.id === id) || null;
    if (!active) return;
    if (active.dataset.visited || reduced.matches) finish(active);
    else { active.classList.add('is-playing'); active.dataset.state = 'playing'; }
    active.dataset.visited = 'true';
    active.querySelectorAll('video[data-video]').forEach(v => {
      if (v.getAttribute('src')) return;
      v.src = v.dataset.video;
      v.muted = true;
      v.load();
    });
    playMedia(active);
  }
  document.addEventListener('deck-slide-change', e => activate(e.detail));
  document.addEventListener('visibilitychange', () => {
    if (!active) return;
    if (document.hidden) active.querySelectorAll('video').forEach(v => v.pause());
    else playMedia(active);
  });
  reduced.addEventListener('change', e => {
    if (!e.matches || !active) return;
    finish(active); active.querySelectorAll('video').forEach(v => v.pause());
  });
  window.addEventListener('beforeprint', () => slides.forEach(finish));

  const trace = document.querySelector('#eye-tracking video');
  const caption = document.querySelector('#eye-tracking .input-transcript');
  let segments = [];
  const updateTranscript = () => {
    const time = trace.currentTime * 5;
    const segment = segments.find(s => time >= s.start && time < s.end) || (trace.ended ? segments.at(-1) : null);
    caption.textContent = segment ? segment.text : '';
  };
  fetch('assets/inputs/viewmaster-eye-trace-transcript-segments.json')
    .then(r => { if (!r.ok) throw Error('Transcript unavailable'); return r.json(); })
    .then(data => { segments = data.segments; updateTranscript(); })
    .catch(() => { caption.textContent = 'Recorded eye-tracking demonstration'; });
  trace.addEventListener('timeupdate', updateTranscript);
  trace.addEventListener('seeked', updateTranscript);

  const vm = document.querySelector('#viewmaster');
  const buttons = [...vm.querySelectorAll('[data-evidence]')];
  const svg = vm.querySelector('svg');
  const field = svg.querySelector('image');
  const gaze = svg.querySelector('circle');
  let evidence = [];
  let requested = 'pleura';
  function selectEvidence(id) {
    requested = id;
    const e = evidence.find(item => item.id === id);
    if (!e) return;
    svg.setAttribute('viewBox', `0 0 ${e.width} ${e.height}`);
    svg.setAttribute('aria-label', `${e.label}. Original recorded field and gaze location.`);
    field.setAttribute('href', e.src);
    field.setAttribute('width', e.width);
    field.setAttribute('height', e.height);
    gaze.setAttribute('cx', e.gaze[0]); gaze.setAttribute('cy', e.gaze[1]);
    gaze.setAttribute('r', e.width * .017);
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.evidence === id)));
  }
  buttons.forEach(b => b.addEventListener('click', () => selectEvidence(b.dataset.evidence)));
  fetch('assets/inputs/evidence.json')
    .then(r => { if (!r.ok) throw Error('Evidence unavailable'); return r.json(); })
    .then(data => { evidence = data; selectEvidence(requested); })
    .catch(() => { buttons.slice(1).forEach(b => b.disabled = true); });
  activate(document.querySelector('.slide:not([hidden])')?.id);
})();
