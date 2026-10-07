// Curated evidence replay. No live model call and no model chain-of-thought.
const slide = document.querySelector('#lung-case');
const $ = s => slide.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const steps = [
  {key:'prepare',name:'Context',title:'Read with context.',observation:'One lung section, with saved regions and a calibrated tissue map.',rule:'Size, pattern, STAS and pleural involvement each need their own evidence.',decision:'Retrieve the relevant notes before reviewing the slide.',ref:'lung_resection_specimen_grossing',duration:7000,tag:'Whole section · saved analysis'},
  {key:'map',name:'Tissue map',title:'Let structure guide the search.',observation:'7,809 tiles. Three encoders. Twelve unsupervised clusters.',rule:'Architectural patterns guide review. A cluster is a search aid, not a diagnosis.',decision:'Use the map to find the mass, then examine its boundaries.',ref:'lung_adenocarcinoma',duration:9000,tag:'Fused embeddings · H-optimus / OpenMidnight / Virchow'},
  {key:'size',name:'Tumor size',title:'Measure the main mass.',observation:'The saved contour measures 8.2 mm. The initial recorded footprint was 11.9 mm.',rule:'Separate the main tumor from detached air-space spread. Correlate with the other blocks and gross size.',decision:'Exclude the STAS extension from this section’s measurement.',ref:'lung_resection_specimen_grossing',duration:10500,tag:'8.2 mm · calibrated contour diameter'},
  {key:'stas',name:'STAS',title:'Beyond the tumor edge.',observation:'The saved field shows detached tumor clusters in surrounding air spaces.',rule:'STAS lies beyond the main tumor. Check viability, distribution and cutting artifact.',decision:'Saved call: STAS present. Review the highlighted field in context.',ref:'stas_assessment',duration:9000,tag:'STAS · saved positive field'},
  {key:'pleura',name:'Pleura',title:'Close is not invasion.',observation:'The saved review records a closest approach of about 0.7 mm to the pleura.',rule:'Resolve the external elastic-layer relationship with an elastic stain when H&E is equivocal.',decision:'No definite VPI in the saved H&E review. Movat is the next review step.',ref:'pleural_pathology',duration:10000,tag:'Closest pleural field · invasion unresolved'},
  {key:'lymphatic',name:'Lymphatic',title:'A small focus matters.',observation:'Saved LVI focus: tumor clusters within a lymphatic-appearing space in subpleural fibrosis.',rule:'Distinguish tumor in an air space from tumor in a lymphatic or vascular space.',decision:'Saved call: LVI present. Confirm the lining and exclude retraction artifact.',ref:'stas_assessment',duration:9000,tag:'Lymphatic invasion focus · saved LVI annotation'},
  {key:'review',name:'Review',title:'Every finding has a place.',observation:'',rule:'',decision:'',ref:null,duration:Infinity,tag:'Saved findings · select one to return to its evidence'}
];
let data, refs, payload, viewer, base, colours = new Map(), ready = false, loading = false;
let index = 0, elapsed = 0, last = 0, frame = 0, playing = false, entered = false;
let features = true, clusters = false, embeddings = false, selectedCluster = null, selectedTile = null, projected = [];
let rulerActive = false, rulerPoints = [], rulerPreview = null;
let previousSourceFocus = null, resumeAfterSource = false, exploring = false;
const blocks = [...slide.querySelectorAll('.lung-evidence-block')];
const buttons = steps.map((s,i) => {
  const b = document.createElement('button'); b.type='button'; b.textContent=`${String(i+1).padStart(2,'0')} ${s.name}`;
  b.addEventListener('click',()=>{pause();setStep(i);}); $('.lung-timeline').append(b); return b;
});
function syncToggles() {
  for(const [name,value] of Object.entries({features,clusters,embeddings})) $(`[data-lung-toggle="${name}"]`).setAttribute('aria-pressed',String(value));
  $('.lung-plot').hidden=!embeddings;
}
function reveal() {
  blocks.forEach((b,i)=>b.classList.toggle('is-visible',!playing || reduced.matches || elapsed>i*1500));
  $('.lung-progress').textContent=index===6?'Ready for review':`${index+1} / ${steps.length} · ${playing?'playing':'paused'}`;
  $('.lung-play').textContent=playing?'Pause tour':index===6?'Play again':'Play tour';
}
function pause() { playing=false; cancelAnimationFrame(frame); frame=0; reveal(); }
function play() {
  if(!ready || slide.hidden || document.hidden) return;
  if(index===6)setStep(0);
  if(exploring)restoreFinding();
  setRulerActive(false);
  playing=true; last=performance.now(); reveal(); cancelAnimationFrame(frame); frame=requestAnimationFrame(tick);
}
function tick(now) {
  if(!playing || slide.hidden || document.hidden) {pause();return;}
  elapsed+=now-last;last=now;
  if(elapsed>=steps[index].duration) {setStep(index+1);if(index===6){pause();return;}}
  reveal();drawOverlay();frame=requestAnimationFrame(tick);
}
function regionForStep() {
  const field=data?.fields.find(f=>f.key===steps[index].key);
  if(field) {
    // Center the diagnostic part of each saved high-resolution field on the wide viewer.
    // The complete saved field remains available by zooming out or panning.
    const [x,y,w,h]=field.region;
    if(field.key==='stas')return [x,y+h*.15,w,h*.68];
    if(field.key==='pleura')return [x,y+h*.28,w,h*.54];
    if(field.key==='lymphatic')return [x,y+h*.22,w,h*.54];
    return field.region;
  }
  return [0,0,data.slide.width,data.slide.height];
}
function fitRegion(region, immediate = false) {
  if(!base)return;
  const [x,y,w,h]=region, sx=payload.scale.x,sy=payload.scale.y;
  const r=base.imageToViewportRectangle(x*sx,y*sy,w*sx,h*sy);
  const pad=.06; viewer.viewport.fitBounds(new OpenSeadragon.Rect(r.x-r.width*pad,r.y-r.height*pad,r.width*(1+2*pad),r.height*(1+2*pad)),immediate||reduced.matches);
}
function setStep(i) {
  clearRuler();setRulerActive(false);
  index=Math.max(0,Math.min(6,i));elapsed=0;exploring=false;selectedTile=null;selectedCluster=null;
  const s=steps[index];
  $('.lung-step-kicker').textContent=`EVIDENCE TRACE · ${String(index+1).padStart(2,'0')} / 07`;
  $('.lung-step-heading').textContent=s.title;
  $('.lung-observation').textContent=s.observation;$('.lung-rule').textContent=s.rule;$('.lung-decision').textContent=s.decision;
  $('.lung-field-tag').textContent=s.tag;$('.lung-tile-note').textContent='';
  blocks.forEach(b=>b.hidden=index===6);$('.lung-summary').hidden=index!==6;
  buttons.forEach((b,j)=>{b.setAttribute('aria-current',j===index?'step':'false');b.classList.toggle('done',j<index);});
  // Automatic tour demonstrates both layers at the map stage, then restores clean H&E.
  clusters=index===1;embeddings=index===1;features=true;syncToggles();
  $('.lung-cluster-keys').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
  if(ready)fitRegion(regionForStep());
  reveal();draw(); slide.dataset.step=s.key;
}
function surface(canvas) {
  const b=canvas.getBoundingClientRect(); if(!b.width||!b.height)return null;
  const dpr=Math.min(devicePixelRatio,2),w=Math.round(b.width*dpr),h=Math.round(b.height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,b.width,b.height);
  return {ctx,width:b.width,height:b.height};
}
function pixel(x,y,source=true) {
  const p=base.imageToViewportCoordinates(x*(source?payload.scale.x:1),y*(source?payload.scale.y:1));
  return viewer.viewport.pixelFromPoint(p,true);
}
// Store endpoints in original scanner pixels, never screen or downsampled pixels.
function sourcePoint(position) {
  const p=base.viewportToImageCoordinates(viewer.viewport.pointFromPixel(position,true));
  return [p.x/payload.scale.x,p.y/payload.scale.y];
}
function rulerMm(a,b) {
  return Math.hypot((b[0]-a[0])*payload.source.mppX,(b[1]-a[1])*payload.source.mppY)/1000;
}
function syncRuler() {
  $('.lung-ruler').setAttribute('aria-pressed',String(rulerActive));
  $('.lung-ruler-clear').disabled=!rulerPoints.length;
  $('.lung-viewer').classList.toggle('is-measuring',rulerActive);
  $('.lung-scale-note').textContent=rulerPoints.length===2
    ?`${rulerMm(...rulerPoints).toFixed(2)} mm · ${rulerActive?'click to start a new ruler':'ruler retained'}`
    :rulerActive?(rulerPoints.length?'Click end point · drag to pan · scroll to zoom':'Click start point · drag to pan · scroll to zoom')
    :'Drag to pan · scroll to zoom';
}
function setRulerActive(active) {
  rulerActive=active;rulerPreview=null;
  if(!active && rulerPoints.length===1)rulerPoints=[];
  syncRuler();draw();
}
function clearRuler() {rulerPoints=[];rulerPreview=null;syncRuler();draw();}
function drawRuler(ctx,width,height) {
  if(!rulerPoints.length)return;
  const points=rulerPoints.length===1&&rulerPreview?[rulerPoints[0],rulerPreview]:rulerPoints;
  const screen=points.map(p=>pixel(...p));
  ctx.save();ctx.strokeStyle='#286c73';ctx.lineWidth=2;ctx.setLineDash(points.length===2&&rulerPoints.length===1?[4,4]:[]);
  if(screen.length===2){ctx.beginPath();ctx.moveTo(screen[0].x,screen[0].y);ctx.lineTo(screen[1].x,screen[1].y);ctx.stroke();}
  ctx.setLineDash([]);
  for(const p of screen){ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fillStyle='#fafaf8';ctx.fill();ctx.stroke();}
  if(screen.length===2)label(ctx,`${rulerMm(...points).toFixed(2)} mm`,Math.max(8,Math.min(width-100,(screen[0].x+screen[1].x)/2+8)),Math.max(22,Math.min(height-10,(screen[0].y+screen[1].y)/2-10)),'#286c73');
  ctx.restore();
}
function label(ctx,text,x,y,color='#161616') {
  ctx.font=`${Math.max(11,slide.clientWidth*.0085)}px 'Courier New', monospace`;
  const w=ctx.measureText(text).width;ctx.fillStyle='#fafaf8ef';ctx.fillRect(x-5,y-15,w+10,21);ctx.fillStyle=color;ctx.fillText(text,x,y);
}
function drawBox(ctx,box,color,dashed=false) {
  const a=pixel(box[0],box[1]),b=pixel(box[0]+box[2],box[1]+box[3]);
  ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.setLineDash(dashed?[5,5]:[]);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.setLineDash([]);
}
function drawOverlay() {
  const s=surface($('.lung-overlay'));if(!s||!base||!data||!payload)return;
  const {ctx,width,height}=s;
  if(clusters)for(const t of payload.tiles) {
    const a=pixel(t.x,t.y,false),b=pixel(t.x+t.w,t.y+t.h,false);
    if(b.x<0||b.y<0||a.x>width||a.y>height)continue;
    ctx.globalAlpha=selectedCluster===null?.28:t.clusterId===selectedCluster?.6:.025;
    ctx.fillStyle=colours.get(t.clusterId);ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);
  }
  ctx.globalAlpha=1;
  if(selectedTile){const t=selectedTile;drawBox(ctx,[t.x/payload.scale.x,t.y/payload.scale.y,t.w/payload.scale.x,t.h/payload.scale.y],'#161616');}
  drawRuler(ctx,width,height);
  if(!features||exploring)return;
  const key=steps[index].key;
  if(['size','review','map'].includes(key)) {
    const h=data.annotations[0].hull.map(p=>pixel(...p));ctx.beginPath();h.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.strokeStyle='#985a4b';ctx.lineWidth=2;ctx.stroke();
    if(key==='size'&&!rulerActive&&!rulerPoints.length) {
      const [a,b]=data.measurement.endpoints.map(p=>pixel(...p));
      const f=playing?Math.min(1,elapsed/1900):1;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f);ctx.strokeStyle='#161616';ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
      for(const p of [a,b]){ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fillStyle='#161616';ctx.fill();}
      label(ctx,'8.2 mm',(a.x+b.x)/2+8,(a.y+b.y)/2);
    }
  }
  const ids=key==='stas'?[8]:key==='pleura'?[7]:key==='lymphatic'?[9]:key==='review'?[8,7,9]:[];
  for(const id of ids)drawBox(ctx,data.annotations[id].bbox,'#985a4b',true);
  // Scale bar derives from calibration, not the image's nominal magnification.
  const px=pixel(1000/data.slide.mpp_x,0).x-pixel(0,0).x;
  const mm=px>width*.3?.1:1,length=px*mm;
  if(length>15&&length<width*.5){ctx.strokeStyle='#161616';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(width-length-18,height-22);ctx.lineTo(width-18,height-22);ctx.stroke();label(ctx,mm===1?'1 mm':'100 μm',width-length-18,height-30);}
}
function drawPlot() {
  if(!embeddings||!payload)return;
  const s=surface($('.lung-plot canvas'));if(!s)return;
  const {ctx,width,height}=s,tiles=payload.tiles.filter(t=>Number.isFinite(t.ux)&&Number.isFinite(t.uy));
  const xs=tiles.map(t=>t.ux),ys=tiles.map(t=>t.uy),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=Math.min((width-20)/(maxX-minX),(height-18)/(maxY-minY));
  const ox=(width-(maxX-minX)*scale)/2,oy=(height-(maxY-minY)*scale)/2;
  projected=tiles.map(t=>({t,x:ox+(t.ux-minX)*scale,y:oy+(t.uy-minY)*scale}));
  for(const p of projected){ctx.globalAlpha=selectedCluster===null?.72:p.t.clusterId===selectedCluster?.95:.08;ctx.fillStyle=colours.get(p.t.clusterId);ctx.beginPath();ctx.arc(p.x,p.y,1.15,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;
  if(selectedTile){const p=projected.find(p=>p.t.id===selectedTile.id);if(p){ctx.strokeStyle='#161616';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.stroke();}}
}
function draw(){if(!slide.hidden){drawOverlay();drawPlot();}}
function chooseCluster(id) {
  pause();if(exploring)restoreFinding();selectedCluster=selectedCluster===id?null:id;selectedTile=null;clusters=true;syncToggles();
  $('.lung-cluster-keys').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.cluster)===selectedCluster)));
  $('.lung-tile-note').textContent=selectedCluster===null?'':`Cluster ${selectedCluster} · ${payload.clusters.find(c=>c.id===selectedCluster).size} tiles`;
  draw();
}
function initReferences() {
  const root=$('.lung-source-content');
  const title=document.createElement('h3');title.textContent='Evidence you can inspect';root.append(title);
  const intro=document.createElement('p');intro.textContent='This is a curated replay of the saved PPS case review, originally produced with google/gemini-3.1-pro-preview. The Astra preview label describes the proposed interface. No new Astra run, live retrieval, stain order or clinical sign-out occurs.';root.append(intro);
  for(const r of refs.articles){const section=document.createElement('section');section.dataset.reference=r.id;const h=document.createElement('h4');h.textContent=`Mattipedia · ${r.title}`;const p=document.createElement('p');p.textContent=r.summary;const small=document.createElement('small');small.textContent=`${r.section} · retrieved from your vault ${r.retrieved}`;section.append(h,p,small);root.append(section);}
  const cap=document.createElement('a');cap.href=refs.clinicalReference.url;cap.target='_blank';cap.rel='noopener noreferrer';cap.textContent=refs.clinicalReference.title;root.append(cap);
  const note=document.createElement('p');note.textContent='8.2 mm is recomputed from the saved contour and 0.26348 μm/pixel calibration. The approximately 0.7 mm pleural distance is a recorded estimate; its measurement endpoints were not saved. It is not reproduced as an exact ruler. Final size and staging require the complete specimen and pleural assessment.';root.append(note);
  const source=document.createElement('a');source.href=data.provenance.source;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Original PPS case review';root.append(source);
  const method=document.createElement('p');method.textContent='Embedding layer: saved H-optimus, OpenMidnight and Virchow representations, PCA-128 per encoder, normalized concatenation, UMAP and K-means. Cluster colors are unsupervised groups. They are not feature-specific STAS, VPI or LVI classifiers. Field boxes are saved review regions, not cell-level segmentation.';root.append(method);
}
function openSources(all = false) {
  previousSourceFocus=document.activeElement;resumeAfterSource=playing;pause();$('.lung-source-panel').hidden=false;$('.lung-close-sources').focus();
  const panel=$('.lung-source-panel');
  panel.querySelectorAll('[data-reference]').forEach(e=>e.classList.toggle('lung-reference-active',!all&&e.dataset.reference===(exploring?'lung_adenocarcinoma':steps[index].ref)));
  panel.scrollTop=0;
}
function closeSources() { $('.lung-source-panel').hidden=true;previousSourceFocus?.focus();if(resumeAfterSource)play(); }
async function initialize() {
  if(loading||ready)return;loading=true;
  try {
    const paths=['assets/lung-case/case.json','assets/lung-case/references.json','assets/wsi/clusters.json'];
    [data,refs,payload]=await Promise.all(paths.map(async p=>{const r=await fetch(p);if(!r.ok)throw new Error(p);return r.json();}));
    payload.clusters.forEach(c=>{colours.set(c.id,c.color);const b=document.createElement('button');b.type='button';b.dataset.cluster=c.id;b.textContent=c.id;b.style.setProperty('--cluster',c.color);b.setAttribute('aria-label',`Cluster ${c.id}, ${c.size} tiles`);b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>chooseCluster(c.id));$('.lung-cluster-keys').append(b);});
    initReferences();
    viewer=OpenSeadragon({element:$('.lung-viewer'),tileSources:'assets/wsi/slide.dzi',showNavigationControl:false,showNavigator:true,navigatorPosition:'TOP_RIGHT',navigatorWidth:80,navigatorHeight:115,navigatorAutoFade:true,animationTime:.9,springStiffness:6,maxZoomPixelRatio:3,visibilityRatio:.7,constrainDuringPan:true,gestureSettingsMouse:{clickToZoom:false,dblClickToZoom:true}});
    viewer.addHandler('open',()=>{
      base=viewer.world.getItemAt(0);ready=true;$('.lung-ruler').disabled=false;$('.lung-loading').hidden=true;
      // Original high-resolution saved fields are placed at their exact slide coordinates.
      for(const f of data.fields){const r=base.imageToViewportRectangle(f.region[0]*payload.scale.x,f.region[1]*payload.scale.y,f.region[2]*payload.scale.x,f.region[3]*payload.scale.y);viewer.addSimpleImage({url:`assets/lung-case/${f.image}`,x:r.x,y:r.y,width:r.width,success:()=>draw()});}
      setStep(index);if(!slide.hidden&&!reduced.matches)play();
    });
    viewer.addHandler('open-failed',()=>{$('.lung-loading').hidden=false;$('.lung-loading').textContent='Slide could not load. Reload to retry.';pause();});
    viewer.addHandler('animation',draw);viewer.addHandler('resize',draw);viewer.addHandler('update-viewport',draw);
    viewer.addHandler('canvas-click',e=>{
      if(!rulerActive||!ready||!e.quick)return;
      e.preventDefaultAction=true;pause();
      const point=sourcePoint(e.position);
      if(point[0]<0||point[1]<0||point[0]>data.slide.width||point[1]>data.slide.height)return;
      if(rulerPoints.length===2)rulerPoints=[];
      rulerPoints.push(point);rulerPreview=null;syncRuler();draw();
    });
    viewer.addHandler('canvas-double-click',e=>{if(rulerActive)e.preventDefaultAction=true;});
    $('.lung-viewer').addEventListener('pointermove',e=>{
      if(!rulerActive||rulerPoints.length!==1||e.buttons)return;
      const rect=viewer.canvas.getBoundingClientRect();
      rulerPreview=sourcePoint(new OpenSeadragon.Point(e.clientX-rect.left,e.clientY-rect.top));draw();
    });
    $('.lung-viewer').addEventListener('pointerleave',()=>{rulerPreview=null;draw();});
    viewer.addHandler('canvas-drag',pause);viewer.addHandler('canvas-scroll',pause);
    slide.dataset.state='loaded';
  } catch(e) { $('.lung-loading').textContent='Saved case could not load. Reload to retry.';slide.dataset.state='error'; }
  finally {loading=false;}
}
for(const b of slide.querySelectorAll('[data-lung-toggle]'))b.addEventListener('click',()=>{
  pause();const key=b.dataset.lungToggle;if(key==='features')features=!features;if(key==='clusters')clusters=!clusters;if(key==='embeddings')embeddings=!embeddings;syncToggles();draw();
});
function restoreFinding() {
  exploring=false;selectedTile=null;
  const s=steps[index];$('.lung-step-heading').textContent=s.title;$('.lung-observation').textContent=s.observation;$('.lung-rule').textContent=s.rule;$('.lung-decision').textContent=s.decision;$('.lung-field-tag').textContent=s.tag;
  blocks.forEach(b=>b.hidden=index===6);$('.lung-summary').hidden=index!==6;$('.lung-tile-note').textContent='';
  if(ready)fitRegion(regionForStep());reveal();draw();
}
$('.lung-ruler').addEventListener('click',()=>{pause();setRulerActive(!rulerActive);});
$('.lung-ruler-clear').addEventListener('click',clearRuler);
document.addEventListener('keydown',e=>{
  if(!slide.hidden&&e.key==='Escape'&&rulerActive&&$('.lung-source-panel').hidden){e.preventDefault();e.stopPropagation();setRulerActive(false);}
});
$('.lung-fit').addEventListener('click',()=>{pause();restoreFinding();});
$('.lung-play').addEventListener('click',()=>playing?pause():play());
$('.lung-replay').addEventListener('click',()=>{setStep(0);play();});
$('.lung-source-link').addEventListener('click',()=>openSources());$('.lung-all-sources').addEventListener('click',()=>openSources(true));$('.lung-close-sources').addEventListener('click',closeSources);
$('.lung-clear-cluster').addEventListener('click',()=>{selectedCluster=null;selectedTile=null;$('.lung-tile-note').textContent='';$('.lung-cluster-keys').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));draw();});
$('.lung-plot canvas').addEventListener('click',e=>{
  if(!projected.length)return;pause();const b=e.currentTarget.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top;
  const p=projected.reduce((a,p)=>Math.hypot(p.x-x,p.y-y)<Math.hypot(a.x-x,a.y-y)?p:a);
  if(Math.hypot(p.x-x,p.y-y)>10)return;selectedTile=p.t;exploring=true;
  $('.lung-step-heading').textContent='Embedding → tissue.';
  $('.lung-observation').textContent=`Selected tile ${p.t.id} belongs to cluster ${p.t.clusterId}.`;
  $('.lung-rule').textContent='Similar embeddings help locate related morphology. Confirm the tissue finding visually.';
  $('.lung-decision').textContent='Explore this tile. Fit field returns to the saved case finding.';
  blocks.forEach(b=>b.hidden=false);$('.lung-summary').hidden=true;reveal();
  fitRegion([(p.t.x-p.t.w*2)/payload.scale.x,(p.t.y-p.t.h*2)/payload.scale.y,p.t.w*5/payload.scale.x,p.t.h*5/payload.scale.y]);
  $('.lung-tile-note').textContent=`Tile ${p.t.id} · cluster ${p.t.clusterId}`;$('.lung-field-tag').textContent='Embedding selection · inspect the matching tissue tile';draw();
});
for(const [name,detail,i] of [['Tumor · 8.2 mm','Saved contour; section measurement',2],['STAS · present','Saved field beyond the tumor',3],['Pleura · unresolved','Closest approach ≈0.7 mm; elastic stain needed',4],['Lymphatic focus · LVI present','Saved finding; inspect the lining',5]]) {
  const b=document.createElement('button');b.type='button';b.textContent=name;const small=document.createElement('small');small.textContent=detail;b.append(small);b.addEventListener('click',()=>{pause();setStep(i);});$('.lung-summary').append(b);
}
$('.lung-source-panel').addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.stopPropagation();closeSources();}
    if(e.key==='Tab'){
      const items=[...e.currentTarget.querySelectorAll('button,a[href]')],first=items[0],last=items.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
document.addEventListener('deck-slide-change',e=>{
  if(e.detail==='lung-case') {if(!entered){entered=true;initialize();}else if(ready){draw();reveal();}}
  else {pause();setRulerActive(false);$('.lung-source-panel').hidden=true;}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
reduced.addEventListener('change',()=>{if(reduced.matches)pause();});
new ResizeObserver(draw).observe($('.lung-stage'));
window.addEventListener('beforeprint',pause);
setStep(0);
