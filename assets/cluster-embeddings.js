// Real CAP26 fused embeddings. Cancer cluster IDs are the presenter's annotation.
const slide = document.querySelector('#cluster-embeddings');
const tissue = slide.querySelector('.cluster-tissue');
const overlay = slide.querySelector('.cluster-overlay');
const plot = slide.querySelector('.cluster-map');
const canvas = plot.querySelector('canvas');
const legend = slide.querySelector('.cluster-legend');
const loading = slide.querySelector('.cluster-loading');
const revealButton = slide.querySelector('.cluster-reveal-button');
const cancer = new Set([0, 8, 1, 3, 5]);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let payload, viewer, points = [], colours = new Map(), selected = null;
let started = false, ready = false, played = false, active = false, revealed = false;
let overlayOn = true, overlayAlpha = 0, plotAlpha = 0, frame = 0;
let project;
const ramp = (time, start, duration) => Math.max(0, Math.min(1, (time - start) / duration));
function rgba(hex, alpha) { return `rgba(${[1,3,5].map(i => parseInt(hex.slice(i,i+2),16)).join(',')},${alpha})`; }
function surface(target) {
  const box = target.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  if (!box.width || !box.height) return null;
  const w = Math.round(box.width*dpr), h = Math.round(box.height*dpr);
  if (target.width !== w || target.height !== h) { target.width=w; target.height=h; }
  const ctx = target.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,box.width,box.height);
  return {ctx, width:box.width, height:box.height};
}
function drawOverlay() {
  const s = surface(overlay);
  if (!s || !viewer?.world.getItemAt(0) || !payload || !overlayOn) return;
  const {ctx} = s;
  for (const tile of payload.tiles) {
    const a = viewer.viewport.imageToViewerElementCoordinates(new OpenSeadragon.Point(tile.x,tile.y));
    const b = viewer.viewport.imageToViewerElementCoordinates(new OpenSeadragon.Point(tile.x+tile.w,tile.y+tile.h));
    if (b.x<0 || b.y<0 || a.x>s.width || a.y>s.height) continue;
    const alpha = selected !== null ? (tile.clusterId===selected ? .72 : .035) : revealed ? (cancer.has(tile.clusterId) ? .6 : .04) : .4;
    ctx.fillStyle=rgba(colours.get(tile.clusterId),alpha*overlayAlpha);
    ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);
  }
}
function drawPlot() {
  const s = surface(canvas); if (!s || !payload) return;
  const {ctx,width,height}=s; ctx.scale(width/600,height/500);
  for (const tile of points) {
    const [x,y]=project(tile);
    const alpha=selected!==null ? (tile.clusterId===selected ? .9:.07) : revealed ? (cancer.has(tile.clusterId) ? .85:.13) : .72;
    ctx.fillStyle=rgba(colours.get(tile.clusterId),alpha);
    ctx.beginPath(); ctx.arc(x,y,1.65,0,Math.PI*2); ctx.fill();
  }
}
function draw() {drawOverlay();drawPlot();}
function choose(id) {
  selected=selected===id ? null:id;
  legend.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.cluster)===selected)));
  draw();
}
function setupPlot() {
  points=payload.tiles.filter(t=>Number.isFinite(t.ux)&&Number.isFinite(t.uy));
  const xs=points.map(t=>t.ux),ys=points.map(t=>t.uy);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=Math.min(530/(maxX-minX),400/(maxY-minY));
  const ox=(600-(maxX-minX)*scale)/2,oy=90;
  project=t=>[ox+(t.ux-minX)*scale,oy+(t.uy-minY)*scale];
  // Circle the principal cancer region; outlying members retain the highlight.
  const central=[];
  for(const id of cancer) {
    const group=points.filter(t=>t.clusterId===id);
    const sortedX=group.map(t=>t.ux).sort((a,b)=>a-b),sortedY=group.map(t=>t.uy).sort((a,b)=>a-b);
    const q=(a,f)=>a[Math.floor((a.length-1)*f)];
    central.push(...group.filter(t=>t.ux>=q(sortedX,.1)&&t.ux<=q(sortedX,.9)&&t.uy>=q(sortedY,.1)&&t.uy<=q(sortedY,.9)));
  }
  const coords=central.map(project),xx=coords.map(p=>p[0]),yy=coords.map(p=>p[1]);
  const cx=(Math.min(...xx)+Math.max(...xx))/2,cy=(Math.min(...yy)+Math.max(...yy))/2;
  const rx=(Math.max(...xx)-Math.min(...xx))/2+22,ry=(Math.max(...yy)-Math.min(...yy))/2+22;
  const factor=Math.max(...coords.map(([x,y])=>Math.hypot((x-cx)/rx,(y-cy)/ry)),1);
  const ring=plot.querySelector('ellipse');
  for(const [name,value] of Object.entries({cx,cy,rx:rx*factor*1.24,ry:ry*factor*1.12})) ring.setAttribute(name,value);
  plot.querySelector('.cluster-cancer-leader').setAttribute('d',`M 110 85 L ${cx} ${cy-ry*factor*1.12-8}`);
  payload.clusters.forEach(cluster=>{
    colours.set(cluster.id,cluster.color);
    const button=document.createElement('button');button.type='button';button.dataset.cluster=cluster.id;
    button.setAttribute('aria-label',`Cluster ${cluster.id}`);button.setAttribute('aria-pressed','false');
    const dot=document.createElement('i');dot.style.setProperty('--cluster',cluster.color);
    button.append(dot,document.createTextNode(String(cluster.id)));button.addEventListener('click',()=>choose(cluster.id));legend.append(button);
  });
}
function finishSequence() {
  cancelAnimationFrame(frame);played=true;overlayAlpha=1;plotAlpha=1;
  plot.style.opacity=1;legend.style.opacity=1;draw();
  slide.dataset.state=revealed?'annotated':'awaiting-click';
}
function revealCancer() {
  revealed=true;selected=null;
  slide.dataset.revealed='true';revealButton.hidden=true;
  slide.querySelector('.cluster-annotation').textContent='Cancer: clusters 0, 8, 1, 3 and 5. Annotation supplied by the presenter.';
  legend.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
  if(ready)finishSequence();
}
function play() {
  if(!ready||!active)return;
  if(played||reduced.matches||revealed){finishSequence();return;}
  played=true;const start=performance.now();
  const tick=now=>{
    if(!active)return;
    const time=now-start;
    overlayAlpha=ramp(time,1000,900);plotAlpha=ramp(time,1950,750);
    plot.style.opacity=plotAlpha;legend.style.opacity=plotAlpha;
    slide.dataset.state=time<1000?'tissue':time<1950?'overlay':'embeddings';
    draw();if(time>=3000)finishSequence();else frame=requestAnimationFrame(tick);
  };frame=requestAnimationFrame(tick);
}
async function initialize() {
  if(started)return;started=true;
  try {
    const response=await fetch('assets/wsi/clusters.json');if(!response.ok)throw new Error('Missing cluster data');
    payload=await response.json();setupPlot();
    viewer=OpenSeadragon({element:slide.querySelector('.cluster-viewer'),tileSources:'assets/wsi/slide.dzi',drawer:'canvas',showNavigationControl:false,showNavigator:false,animationTime:.5,springStiffness:7,maxZoomPixelRatio:2,visibilityRatio:1,constrainDuringPan:true,gestureSettingsMouse:{clickToZoom:false,dblClickToZoom:true}});
    viewer.addOnceHandler('tile-drawn',()=>{ready=true;loading.hidden=true;play();});
    ['animation','update-viewport','resize','open'].forEach(name=>viewer.addHandler(name,drawOverlay));
    viewer.addHandler('open-failed',()=>{loading.textContent='Slide unavailable';slide.dataset.state='error';});
  }catch{loading.textContent='Embeddings unavailable';slide.dataset.state='error';}
}
function enter(){active=true;initialize();if(ready){viewer.viewport.resize(new OpenSeadragon.Point(tissue.clientWidth,tissue.clientHeight),true);play();}}
document.addEventListener('deck-slide-change',event=>{if(event.detail===slide.id)enter();else{active=false;if(played)finishSequence();}});
document.addEventListener('cluster-cancer-reveal',revealCancer);
revealButton.addEventListener('click',revealCancer);
slide.querySelectorAll('[data-cluster-view]').forEach(button=>button.addEventListener('click',()=>{
  if(!viewer)return;
  const action=button.dataset.clusterView;
  if(action==='in'||action==='out')viewer.viewport.zoomBy(action==='in'?1.6:1/1.6).applyConstraints();
  if(action==='fit')viewer.viewport.goHome();
  if(action==='overlay'){overlayOn=!overlayOn;button.setAttribute('aria-pressed',String(overlayOn));drawOverlay();}
}));
canvas.addEventListener('click',event=>{
  if(!payload)return;
  const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*600/rect.width,y=(event.clientY-rect.top)*500/rect.height;
  let best=null,distance=18;
  for(const tile of points){const p=project(tile),d=Math.hypot(p[0]-x,p[1]-y);if(d<distance){best=tile.clusterId;distance=d;}}
  if(best!==null)choose(best);
});
new ResizeObserver(()=>{if(!slide.hidden)draw();}).observe(tissue);
new ResizeObserver(drawPlot).observe(plot);
reduced.addEventListener('change',event=>{if(event.matches&&ready)finishSequence();});
window.addEventListener('beforeprint',()=>{if(ready)finishSequence();});
if(!slide.hidden)enter();
