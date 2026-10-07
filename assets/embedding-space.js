// Adapted from CAP26 EmbeddingCloud3D: identical seed, point count and centres.
// Synthetic teaching geometry, not patient embeddings or a measured projection.
const slide = document.querySelector('#embedding-space');
const mount = slide.querySelector('.embedding-mount');
const copy = [...slide.querySelectorAll('.embedding-copy p')];
const key = slide.querySelector('.embedding-key');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const clusters = [
  { color: '#9b635c', centre: [-1.15, .35, .1] },
  { color: '#537b70', centre: [1.1, .55, -.35] },
  { color: '#78678a', centre: [.05, -1.05, .3] }
];
let seed = 20260803;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const gaussian = () => Math.max(-2.5, Math.min(2.5, Math.sqrt(-2 * Math.log(Math.max(random(), 1e-6))) * Math.cos(2 * Math.PI * random())));
const points = clusters.flatMap((cluster, c) => Array.from({ length: 320 }, (_, i) => {
  const index = c * 320 + i;
  const end = cluster.centre.map(value => value + gaussian() * .42);
  return { start: [((index % 40) / 39 - .5) * 3.5, (.5 - Math.floor(index / 40) / 23) * 3.5 * .62, 0], end, cluster: c,
    near: Math.hypot(...end.map((value, j) => value - clusters[0].centre[j])) < .62 };
}));
let THREE, renderer, scene, camera, group, geometry, query, positions, colors;
let canvas, context, initialized = false, played = false, active = false, raf = 0;
let time = 0, startedAt = 0, yaw = 0, pitch = 0, zoom = 5.5, dragging = null;
const ramp = (value, start, duration) => Math.max(0, Math.min(1, (value - start) / duration));
const smooth = value => value * value * (3 - 2 * value);
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const palette = clusters.map(c => rgb(c.color)), neutral = rgb('#79736f'), paper = rgb('#fafaf8');

function setupFallback() {
  renderer?.dispose(); renderer = null;
  canvas?.remove();
  canvas = document.createElement('canvas');
  mount.append(canvas); context = canvas.getContext('2d');
  slide.dataset.renderer = 'canvas';
  bindControls(); resize();
}
async function initialize() {
  if (initialized) return;
  initialized = true;
  try {
    if (new URLSearchParams(location.search).has('safe')) throw new Error('Use canvas renderer');
    THREE = await import('./vendor/three.module.min.js');
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    canvas = renderer.domElement; mount.append(canvas);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
    group = new THREE.Group(); scene.add(group);
    positions = new Float32Array(points.length * 3); colors = new Float32Array(points.length * 3);
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: .075, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: .9, depthWrite: false });
    const cloud = new THREE.Points(geometry, material);
    cloud.frustumCulled = false; group.add(cloud);
    query = new THREE.Mesh(new THREE.SphereGeometry(.62, 14, 10), new THREE.MeshBasicMaterial({ color: '#161616', wireframe: true, transparent: true, opacity: 0, depthWrite: false }));
    query.position.set(...clusters[0].centre); group.add(query);
    slide.dataset.renderer = 'webgl';
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); setupFallback(); render(); }, { once: true });
    bindControls(); resize();
  } catch { setupFallback(); }
  if (!slide.hidden) enter();
}
function bindControls() {
  canvas.addEventListener('pointerdown', event => {
    dragging = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging) return;
    yaw += (event.clientX - dragging.x) * .008;
    pitch = Math.max(-1.1, Math.min(1.1, pitch + (event.clientY - dragging.y) * .008));
    dragging = { x: event.clientX, y: event.clientY }; render();
  });
  const release = () => { dragging = null; };
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', event => {
    event.preventDefault(); zoom = Math.max(3.5, Math.min(8, zoom + event.deltaY * .004)); render();
  }, { passive: false });
}
function resize() {
  const width = mount.clientWidth, height = mount.clientHeight;
  if (!width || !height || !canvas) return;
  if (renderer) {
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  } else {
    const ratio = Math.min(devicePixelRatio, 2); canvas.width = width * ratio; canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  render();
}
function project([x, y, z]) {
  const ay = yaw + .33 * smooth(ramp(time, 1100, 4500));
  const ax = pitch + .12 * smooth(ramp(time, 1100, 4500));
  const rx = x * Math.cos(ay) + z * Math.sin(ay), rz = z * Math.cos(ay) - x * Math.sin(ay);
  const ry = y * Math.cos(ax) - rz * Math.sin(ax), depth = y * Math.sin(ax) + rz * Math.cos(ax);
  const scale = mount.clientHeight / (2 * Math.tan(21 * Math.PI / 180) * (zoom - depth));
  return [mount.clientWidth / 2 + rx * scale, mount.clientHeight / 2 - ry * scale, scale];
}
function render() {
  if (!canvas || !mount.clientWidth) return;
  const settle = smooth(ramp(time, 1100, 2700));
  const colouring = smooth(ramp(time, 4100, 1200));
  const highlight = smooth(ramp(time, 6400, 1300));
  copy.forEach((p, i) => p.classList.toggle('is-visible', time >= [0, 4000, 6400][i]));
  key.classList.toggle('is-visible', time >= 4100);
  slide.dataset.state = time >= 9000 ? 'finished' : time < 1100 ? 'tiles' : time < 4100 ? 'clustering' : time < 6400 ? 'morphology' : 'neighbours';
  slide.dataset.rotation = `${yaw.toFixed(2)},${pitch.toFixed(2)}`;
  slide.dataset.zoom = zoom.toFixed(2);
  if (context) context.clearRect(0, 0, mount.clientWidth, mount.clientHeight);
  points.forEach((point, i) => {
    const e = ramp(settle, ((i * 37) % 100) / 100 * .45, .55);
    const position = point.start.map((v, j) => v + (point.end[j] - v) * e + (j === 2 ? Math.sin(e * Math.PI) * .55 : 0));
    const fade = point.near ? 0 : highlight * .5;
    const color = neutral.map((v, j) => { const base = v + (palette[point.cluster][j] - v) * colouring; return base + (paper[j] - base) * fade; });
    if (renderer) {
      positions.set(position, i * 3);
      const c = new THREE.Color().setRGB(...color, THREE.SRGBColorSpace);
      colors.set([c.r, c.g, c.b], i * 3);
    } else {
      const [x, y, scale] = project(position);
      context.fillStyle = `rgb(${color.map(v => Math.round(v * 255)).join(',')})`;
      context.beginPath(); context.arc(x, y, Math.max(1, scale * .028), 0, Math.PI * 2); context.fill();
    }
  });
  if (renderer) {
    geometry.attributes.position.needsUpdate = true; geometry.attributes.color.needsUpdate = true;
    group.rotation.set(pitch + .12 * smooth(ramp(time, 1100, 4500)), yaw + .33 * smooth(ramp(time, 1100, 4500)), 0);
    query.material.opacity = highlight * .24;
    camera.position.z = zoom; renderer.render(scene, camera);
  } else if (highlight > 0) {
    const [x, y, scale] = project(clusters[0].centre);
    context.strokeStyle = `rgba(22,22,22,${highlight * .36})`;
    for (const squash of [.35, .7, 1]) { context.beginPath(); context.ellipse(x, y, scale * .62 * squash, scale * .62, 0, 0, Math.PI * 2); context.stroke(); }
  }
}
function finish() { cancelAnimationFrame(raf); time = 9000; played = true; render(); }
function enter() {
  active = true;
  if (!initialized) { initialize(); return; }
  if (!canvas) return;
  resize();
  if (played || reduceMotion.matches) { finish(); return; }
  played = true; startedAt = performance.now();
  const tick = now => {
    if (!active) return;
    time = Math.min(9000, now - startedAt); render();
    if (time < 9000) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}
new ResizeObserver(resize).observe(mount);
slide.querySelector('[data-embedding-reset]').addEventListener('click', () => { yaw = 0; pitch = 0; zoom = 5.5; render(); });
document.addEventListener('deck-slide-change', event => {
  if (event.detail === slide.id) enter();
  else { active = false; if (played) finish(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { active = false; if (played) finish(); }
  else if (!slide.hidden) enter();
});
reduceMotion.addEventListener('change', event => { if (event.matches && played) finish(); });
window.addEventListener('beforeprint', finish);
if (!slide.hidden) enter();
