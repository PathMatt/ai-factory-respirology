(()=>{'use strict';
// Scanner inventories are presenter-supplied. Geography is schematic; icons are illustrative.
const NS='http://www.w3.org/2000/svg',paper='#fafaf8',ink='#161616';
const E=(tag,attrs,parent)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent?.append(n);return n};
const G=(parent,attrs={})=>E('g',attrs,parent);
const P=(parent,d,attrs={})=>E('path',{d,class:'ink',fill:'none',stroke:ink,'stroke-width':2,...attrs},parent);
const T=(parent,x,y,text,size=24,attrs={})=>{const n=E('text',{x,y,'font-size':size,...attrs},parent);n.textContent=text;return n};
function hospital(parent){const g=G(parent);P(g,'M -42 0 L -43 -45 L -20 -46 L -20 -73 L 20 -74 L 21 -45 L 43 -44 L 42 0 Z',{fill:paper});P(g,'M -20 -44 L -20 -1 M 21 -44 L 21 -1 M -8 0 L -8 -21 L 8 -21 L 8 0 M -7 -61 L 7 -61 M 0 -68 L 0 -54');for(const x of [-33,-7,8,31])for(const y of [-34,-24])P(g,`M ${x-3} ${y} l 6 -.3`);P(g,'M -47 3 Q 0 1 48 3',{'stroke-width':1,opacity:.35});return g}
function scanner(parent,type,x,y,scale=1){const g=G(parent,{transform:`translate(${x} ${y}) scale(${scale})`});
 if(type==='aperio'){P(g,'M -46 0 L -47 -74 Q -47 -85 -40 -92 L -30 -116 L 35 -116 L 47 -85 L 46 0 Z',{fill:paper});P(g,'M -46 -76 Q 0 -71 47 -76 M -30 -115 L -26 -93 L 27 -93 L 35 -115 M -21 -88 L -20 -77 L 12 -77 L 12 -88 Z M -38 -65 L -38 -12 L 37 -12 L 38 -65 M -39 0 L -39 5 M 39 0 L 39 5');E('circle',{cx:23,cy:-83,r:3,fill:'none',stroke:ink,'stroke-width':2,class:'ink'},g);E('circle',{cx:35,cy:-83,r:3,fill:'none',stroke:ink,'stroke-width':2,class:'ink'},g)}
 else if(type==='ocus'){P(g,'M -32 0 L -34 -24 L -27 -32 L 27 -32 L 34 -24 L 33 0 Z M 18 -32 L 18 -83 L -22 -84 Q -30 -84 -30 -76 L -30 -62 L 5 -61 L 6 -33',{fill:paper});P(g,'M -30 -62 L -25 -49 L -10 -49 L -7 -61 M -25 -49 L -25 -40 L -12 -40 L -11 -49 M -25 -17 L 21 -17 L 25 -23 L -20 -23 Z M -28 -7 L 27 -7');}
 else {P(g,'M -45 0 L -46 -112 Q -46 -121 -36 -121 L 37 -121 Q 46 -121 46 -111 L 45 0 Z',{fill:paper});P(g,'M -46 -92 L 46 -92 M -34 -82 L 6 -82 L 6 -22 L -34 -22 Z M 15 -82 L 34 -82 L 34 -61 L 15 -61 Z M -34 -17 L 34 -17 M -37 0 L -37 5 M 36 0 L 36 5 M -27 -73 L -1 -73 M -27 -62 L -1 -62 M -27 -51 L -1 -51 M -27 -40 L -1 -40');E('circle',{cx:24,cy:-43,r:4,fill:'none',stroke:ink,'stroke-width':2,class:'ink'},g);}
 return g;
}
const xy=(lon,lat)=>[(lon+81.25)*81,(43-lat)*111];
const sites=[{name:'University Hospital',short:'UH',ll:[-81.2745,43.0125]},{name:'St. Joseph’s Hospital',short:'St. Joseph’s',ll:[-81.2548,43.0000]},{name:'Victoria Hospital',short:'Victoria',ll:[-81.2267,42.9605]}];
const regionalPosition=ll=>{const [x,y]=xy(...ll);return [790+x*1.35,620+y*1.35]};
const lhscPoint=regionalPosition(sites[0].ll);
const regionalLayout={'St. Thomas':{label:[827,681]},Woodstock:{label:[875,609]},Chatham:{label:[565,719]},Stratford:{label:[844,553]},'Owen Sound':{label:[855,389]}};
const regionSites=[{name:'St. Thomas',ll:[-81.180,42.756],label:[970,755]},{name:'Woodstock',ll:[-80.735,43.115],label:[1040,618]},{name:'Chatham',ll:[-82.190,42.405],label:[330,770]},{name:'Stratford',ll:[-80.989,43.369],label:[960,497]},{name:'Owen Sound',ll:[-80.913,44.563],label:[970,285]}];
const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n)},mix=(a,b,p)=>a+(b-a)*p;
function fade(g,t,start,duration=600){g.style.opacity=clamp((t-start)/duration)}
function draw(g,t,start,duration=950){g.querySelectorAll('path').forEach(p=>{p.setAttribute('pathLength','1');p.style.strokeDasharray=1;p.style.strokeDashoffset=1-ease((t-start)/duration)})}
function makeMap(id,regional){if(!document.querySelector(`#${id} svg`))return null;const svg=document.querySelector(`#${id} svg`),defs=E('defs',{},svg),clip=E('clipPath',{id:`clip-${id}`},defs);E('rect',{x:125,y:205,width:1350,height:615},clip);const canvas=G(svg,{'clip-path':`url(#clip-${id})`}),world=G(canvas),roads=G(world),river=G(world);
// Minimal schematic roads connect the three hospital entrances.
const cityRoutes=[
'M 754 720 H 820 Q 840 720 840 700 V 570 Q 840 550 820 550 H 650 Q 628 550 628 528 V 480',
'M 754 720 H 720 Q 700 720 700 700 V 580 Q 700 560 680 560 H 570 Q 542 560 542 532 V 405',
'M 628 480 H 595 Q 575 480 575 460 V 425 Q 575 405 555 405 H 542'];
cityRoutes.forEach(d=>{const path=P(roads,d,{stroke:'#babbb5','stroke-width':1.3});path.setAttribute('transform','translate(-11.8181818 -8.5454545) scale(.018181818)')});
// A quiet London street grid and the forks of the Thames anchor the local scene.
const city=G(roads,{transform:'translate(-11.8181818 -8.5454545) scale(.018181818)'});
E('rect',{x:175,y:245,width:715,height:545,rx:22,fill:'#f2f1ec',stroke:'none'},city);
const park=G(city);P(park,'M 355 270 Q 440 240 505 288 L 490 407 Q 430 456 368 405 Z',{fill:'#e5eade',stroke:'none'});
for(const x of [290,375,465,550,628,700,825])P(city,`M ${x} 260 V 770`,{stroke:'#deded6','stroke-width':2});
for(const y of [345,420,510,565,610,670,720])P(city,`M 195 ${y} H 867`,{stroke:'#deded6','stroke-width':2});
const thames='M 480 245 C 455 287 507 324 474 359 S 412 399 438 447 S 484 509 437 548 S 383 582 401 626 C 424 661 485 631 529 650 S 601 664 654 639 S 750 617 870 649 M 401 626 C 345 632 336 681 287 695 S 222 726 176 717';
P(city,thames,{stroke:'#c1d4d3','stroke-width':10,'stroke-linecap':'round'});
for(const [d,name,x,y] of [
 ['M 195 345 H 867','Fanshawe Park Rd',705,334],
 ['M 195 510 H 867','Oxford St',213,499],
 ['M 195 720 H 867','Commissioners Rd',213,741],
 ['M 628 260 V 770','Richmond St',640,765],
 ['M 700 565 V 770','Wellington Rd',711,602]
]){P(city,d,{stroke:'#c4c4ba','stroke-width':2.4});T(city,x,y,name,12,{fill:'#92958a'});}
T(city,334,462,'THAMES RIVER',11,{fill:'#90a9a8',transform:'rotate(-70 334 462)','letter-spacing':1.5});
// Keep the animated vehicles on the foreground connecting streets.
cityRoutes.forEach(d=>P(city,d,{stroke:'#b6b8af','stroke-width':2.2}));
const boundary=G(world);
const lakes=G(world);
P(lakes,window.ontarioGeography.ontario,{fill:'#f3f1e8',stroke:'#b7b8ae','stroke-width':.7});
window.ontarioGeography.lakes.forEach(lake=>P(lakes,lake.d,{fill:'#e9efec',stroke:'#9baea5','stroke-width':.65}));
const locator=G(canvas,{'data-ontario-locator':'true'});
E('rect',{x:192,y:213,width:226,height:240,rx:2,fill:paper,stroke:'#c8cdc6','stroke-width':.8},locator);
P(locator,window.ontarioGeography.inset,{fill:'#efeee7',stroke:'#8b938c','stroke-width':1});
E('rect',{x:331,y:370,width:47,height:50,fill:'#839e8e22',stroke:'#617f75','stroke-width':1.1},locator);
T(locator,210,437,'ONTARIO',17,{'letter-spacing':2,fill:'#6f786f'});
const regionRoads=G(world);P(regionRoads,'M -79 66 Q -36 32 0 3 L 42 -13 M 0 3 L 5 27 M 0 3 L 21 -41 L 25 -174',{stroke:'#d7d8d0','stroke-width':.35});
const consultRoadLayer=G(canvas);
const pins=sites.map((s,i)=>{const g=G(canvas,{'data-reveal':'hospital', 'data-site':s.name});const icon=hospital(g);const dot=E('circle',{cx:0,cy:3,r:3,fill:ink},g);return{g,icon,dot,s}});
const labels=G(canvas,{'data-reveal':'local-labels'});const localLabels=sites.map((s,i)=>T(labels,[542,628,754][i],[290,535,630][i],s.name,22,{class:'label','text-anchor':'middle'}));
T(canvas,1450,235,'N',18,{class:'north muted'});P(canvas,'M 1456 278 L 1456 246 M 1450 253 L 1456 245 L 1462 253',{stroke:'#85857e','stroke-width':1.2});
const place=T(canvas,210,280,'LONDON',16,{fill:'#a0a096','letter-spacing':4});
const equipment=[];
if(!regional){
const uh=G(canvas,{'data-reveal':'uh-scanners'});
T(uh,965,265,'UNIVERSITY HOSPITAL',16,{'letter-spacing':1.5,fill:'#74786e'});
scanner(uh,'aperio',1005,377,.62);scanner(uh,'ocus',1140,377,.60);scanner(uh,'ocus',1190,377,.60);scanner(uh,'spectral',1350,377,.62);
T(uh,1005,409,'Aperio AT II',17,{'text-anchor':'middle'});T(uh,1165,409,'2 × Grundium Ocus',17,{'text-anchor':'middle'});T(uh,1350,409,'Spectral M',17,{'text-anchor':'middle'});T(uh,1350,433,'Pramana',14,{'text-anchor':'middle',class:'muted'});equipment.push(uh);
const vh=G(canvas,{'data-reveal':'vh-scanner'});
T(vh,965,660,'VICTORIA HOSPITAL',16,{'letter-spacing':1.5,fill:'#74786e'});scanner(vh,'spectral',1005,767,.62);T(vh,1080,720,'Spectral M',23);T(vh,1080,749,'Pramana',17,{class:'muted'});equipment.push(vh);
const sj=G(canvas,{'data-reveal':'sj-scanner'});
T(sj,965,460,'ST. JOSEPH’S HOSPITAL',16,{'letter-spacing':1.5,fill:'#74786e'});scanner(sj,'spectral',1005,570,.62);T(sj,1080,523,'Spectral M',23);T(sj,1080,552,'Pramana',17,{class:'muted'});T(sj,1300,544,'?',40);equipment.push(sj);
}
// People and transport are independent editable line drawings, timed after the hospitals.
let transport=null;
if(!regional){
 const layer=G(canvas,{'data-transport':'scene'});
 const circle=(g,x,y,r)=>E('circle',{cx:x,cy:y,r,fill:paper,stroke:ink,'stroke-width':1.8},g);
 function person(parent){const g=G(parent);circle(g,0,-44,7);P(g,'M 0 -36 L -2 -16 M -1 -31 L -13 -22 M -1 -31 L 12 -22 M -2 -16 L -11 0 M -2 -16 L 9 0');return g}
 const desk=G(layer,{'data-transport':'desk',transform:'translate(814 706) scale(.55)'});
 circle(desk,0,-62,8);P(desk,'M -2 -53 Q -8 -41 -3 -27 L 21 -27 L 24 -3 M -3 -44 L 17 -37 L 31 -38 M -14 -46 L -14 -20 L 9 -20 M -11 -20 L -14 -2 M 8 -20 L 12 -2 M 22 -31 H 102 M 29 -31 V 0 M 94 -31 V 0 M 59 -34 V -42 M 47 -34 H 71 M 42 -70 H 87 V -43 H 42 Z');

 const boarding=person(layer);boarding.setAttribute('data-transport','boarding');
 const arrived=person(layer);arrived.setAttribute('transform','translate(678 455) scale(.65)');arrived.setAttribute('data-transport','arrived');
 function vehicle(kind){const g=G(layer,{'data-transport':kind});const body=G(g);
 if(kind==='cab'){P(body,'M -34 -6 V -24 L -22 -28 L -13 -43 H 13 L 25 -28 L 37 -24 V -6 Z',{fill:paper});P(body,'M -17 -29 L -9 -39 H 9 L 17 -29 Z M -2 -39 V -29 M -8 -43 V -51 H 10 V -43 M -31 -17 H -22 M 26 -17 H 34');}
 else{P(body,'M -42 -8 V -49 H 8 V -8 Z M 8 -8 V -36 H 27 L 40 -23 V -8 Z',{fill:paper});P(body,'M 14 -31 H 25 L 33 -23 H 14 Z M -25 -36 H -10 V -20 H -25 Z M -21 -36 V -41 H -14 V -36 M -18 -32 V -24 M -22 -28 H -14');}
 circle(body,-23,-6,6);circle(body,25,-6,6);return {g,body};}
 const cab=vehicle('cab'),fromVictoria=vehicle('victoria-truck'),fromJoseph=vehicle('joseph-truck');
 const paths=cityRoutes.map(d=>P(layer,d,{stroke:'none'}));
 const cabRoute=P(layer,'M 542 405 H 555 Q 575 405 575 425 V 460 Q 575 480 595 480 H 628',{stroke:'none','data-cab-route':'University Hospital to St. Joseph’s Hospital'});

 function place(v,path,progress){const n=path.getTotalLength(),pt=path.getPointAtLength(n*progress),ahead=path.getPointAtLength(Math.min(n,n*progress+2)),behind=path.getPointAtLength(Math.max(0,n*progress-2));v.g.setAttribute('transform',`translate(${pt.x} ${pt.y}) scale(.60)`);v.body.setAttribute('transform',`scale(${ahead.x-behind.x<-.1?-1:1} 1)`)}
 transport={render(t){fade(desk,t,2550,700);draw(desk,t,2550,1000);
 const walk=ease((t-3900)/1550);boarding.setAttribute('transform',`translate(${mix(490,542,walk)} ${mix(380,405,walk)}) scale(.65)`);boarding.style.opacity=t<5350?clamp((t-3500)/400):1-clamp((t-5350)/500);
 fade(cab.g,t,3750,500);place(cab,cabRoute,ease((t-6050)/4900));cab.g.style.opacity=t<11700?clamp((t-3750)/500):1-clamp((t-11700)/600);fade(arrived,t,11000,650);
 fade(fromVictoria.g,t,12600,500);place(fromVictoria,paths[1],ease((t-13300)/5200));fade(fromJoseph.g,t,13200,500);place(fromJoseph,paths[2],ease((t-14000)/4000));
 // Park each truck beside the University entrance so both specimen flows remain visible.
 if(t>18400)fromVictoria.g.setAttribute('transform',`translate(${mix(542,440,ease((t-18400)/700))} 405) scale(.60)`);
 if(t>18000)fromJoseph.g.setAttribute('transform',`translate(${mix(542,470,ease((t-18000)/700))} 460) scale(.60)`);

 }};
}
const regionalPins=regional?regionSites.map(s=>{s={...s,...regionalLayout[s.name],point:regionalPosition(s.ll)};const g=G(canvas,{'data-reveal':'regional-hospital'}),icon=hospital(g),label=G(canvas,{'data-reveal':'regional-label'}),line=P(label,'',{stroke:'#85857e','stroke-width':1.2});T(label,...s.label,s.name,20,{class:'label'});return {g,icon,label,line,s}}):[];
const londonGroup=G(canvas,{'data-reveal':'london-label'});T(londonGroup,751,624,'LHSC',21,{'text-anchor':'end',class:'label'});
const lakeLabels=G(canvas,{'data-reveal':'lake-labels'});
T(lakeLabels,610,386,'Lake Huron',19,{class:'muted',transform:'rotate(-15 610 386)'});
T(lakeLabels,904,336,'Georgian Bay',17,{class:'muted'});
T(lakeLabels,890,778,'Lake Erie',19,{class:'muted'});
T(lakeLabels,1120,525,'Lake Ontario',18,{class:'muted'});
// Regional consultation cases travel to University Hospital, not the London centroid.
let consultations=null;
if(regional){
 const layer=G(canvas,{'data-consultation':'deliveries'});
 const destination=G(layer,{'data-consultation':'destination'});
 T(destination,505,792,'Consult cases to LHSC',20,{class:'label'});
 const deliveries=regionSites.map((site,i)=>{
  const [sx,sy]=regionalPosition(site.ll);
  const route=P(consultRoadLayer,`M ${sx} ${sy+3} Q ${mix(sx,lhscPoint[0],.5)} ${sy+12} ${lhscPoint[0]} ${lhscPoint[1]+3}`,{stroke:'#bcbdb5','stroke-width':1.5,'stroke-dasharray':'4 7','data-consultation-route':site.name});
  const truck=G(layer,{'data-consultation-truck':site.name}),body=G(truck);
  P(body,'M -32 -5 V -35 H 7 V -5 Z M 7 -5 V -27 H 21 L 31 -16 V -5 Z',{fill:paper,'stroke-width':1.6});
  P(body,'M 12 -23 H 20 L 26 -16 H 12 Z M -27 -27 H -5 V -13 H -27 Z M -23 -23 H -9 M -23 -19 H -9',{'stroke-width':1.3});
  for(const cx of [-20,21])E('circle',{cx,cy:-4,r:4.5,fill:paper,stroke:ink,'stroke-width':1.6},body);
  // An accompanying slide folder makes the cargo visible during travel.
  const cargo=G(truck);P(cargo,'M -13 -43 V -58 H -5 L -2 -54 H 13 V -43 Z',{fill:paper,'stroke-width':1.2});
  const delivered=G(layer,{'data-consultation-case':site.name,transform:`translate(${762+i*3} ${643-i*2}) scale(.25)`});
  P(delivered,'M 0 0 V -22 H 8 L 11 -18 H 28 V 0 Z M 5 -12 H 23 M 5 -7 H 23',{fill:paper,'stroke-width':1.5});
  return {route,truck,body,cargo,delivered,start:8100+i*2750};
 });
 consultations={render(t){fade(destination,t,7800,650);deliveries.forEach(({route,truck,body,delivered,start},i)=>{
  const progress=ease((t-start-350)/2200),length=route.getTotalLength(),pt=route.getPointAtLength(length*progress),a=route.getPointAtLength(Math.max(0,length*progress-2)),b=route.getPointAtLength(Math.min(length,length*progress+2));
  route.style.opacity=clamp((t-start+300)/900)*.45;
  truck.setAttribute('transform',`translate(${pt.x} ${pt.y}) scale(.30)`);body.setAttribute('transform',`scale(${b.x-a.x<0?-1:1} 1)`);
  truck.style.opacity=clamp((t-start)/450)*(1-clamp((progress-.92)/.08));
  fade(delivered,t,start+2400,400);
 })}};
}
function render(t){const z=regional?ease((t-1100)/2700):0,scale=55*Math.pow(1.35/55,z),tx=mix(650,790,z),ty=mix(470,620,z);world.setAttribute('transform',`translate(${tx} ${ty}) scale(${scale})`);roads.style.opacity=1-z;river.style.opacity=1-z*.8;boundary.style.opacity=1-z;lakes.style.opacity=z;locator.style.opacity=regional?z:0;regionRoads.style.opacity=regional?0:z;place.style.opacity=1-z;labels.style.opacity=1-z;
pins.forEach(({g,icon,s},i)=>{const [x,y]=xy(...s.ll);const spread=ease((z-.55)/.45);g.setAttribute('transform',`translate(${mix(tx+x*scale,lhscPoint[0],spread)} ${mix(ty+y*scale,lhscPoint[1],spread)})`);icon.setAttribute('transform',`scale(${mix(.78,.30,z)})`);fade(g,t,regional?0:[250,1150,700][i],regional?1:650);if(regional&&i>0)g.style.opacity=1-spread;if(!regional)draw(icon,t,[250,1150,700][i],1000)});
if(!regional){localLabels.forEach((l,i)=>fade(l,t,[450,1350,900][i]));equipment.forEach((g,i)=>{fade(g,t,[19500,20800,22100][i]);draw(g,t,[19500,20800,22100][i],1100)});transport.render(t)}
regionalPins.forEach(({g,icon,label,line,s},i)=>{const [px,py]=s.point;g.setAttribute('transform',`translate(${px} ${py})`);icon.setAttribute('transform','scale(.30)');fade(g,t,3900+i*650);draw(icon,t,3900+i*650,850);fade(label,t,4100+i*650);let lx=s.label[0]-17,ly=s.label[1]-8;if(s.name==='Chatham')lx=345;line.setAttribute('d','')});londonGroup.style.opacity=regional?clamp((t-3400)/700):0;lakeLabels.style.opacity=regional?clamp((t-2800)/800):0;
if(consultations)consultations.render(t);
}render(0);return{render,duration:regional?22100:23900};}

const scenes=Object.fromEntries(Object.entries({london:makeMap('london',false),region:makeMap('region',true)}).filter(([,v])=>v)),seen=new Set();
let active=null,raf=0,start=0,playing=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function finish(){cancelAnimationFrame(raf);playing=false;if(active)scenes[active].render(scenes[active].duration)}
function tick(now){if(!active||!playing)return;const t=Math.min(now-start,scenes[active].duration);scenes[active].render(t);if(t<scenes[active].duration)raf=requestAnimationFrame(tick);else playing=false}
function replay(){if(!active)return;cancelAnimationFrame(raf);start=performance.now();playing=true;if(reduced.matches)finish();else{scenes[active].render(0);raf=requestAnimationFrame(tick)}}
document.addEventListener('deck-slide-change',e=>{finish();active=scenes[e.detail]?e.detail:null;const c=document.querySelector('.controls');c.hidden=!active;if(!active)return;if(seen.has(active)||reduced.matches)finish();else{seen.add(active);replay()}});
const nav=delta=>document.dispatchEvent(new CustomEvent('pathology-navigate',{detail:{delta}}));
document.querySelector('#previous').onclick=()=>nav(-1);
document.querySelector('#next').onclick=()=>{if(playing)finish();else nav(1)};
document.querySelector('#replay').onclick=replay;
window.pathologyMaps={handleKey(e,id){if(e.key==='Home'||e.key==='End'){e.preventDefault();document.dispatchEvent(new CustomEvent('pathology-navigate',{detail:{edge:e.key}}));return true}if(e.key.toLowerCase()==='f'){e.preventDefault();if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.();return true}if(!scenes[id])return false;if(e.key.toLowerCase()==='r'){replay();return true}if(e.key===' '||e.key==='ArrowRight'){e.preventDefault();if(playing)finish();else nav(1);return true}return false}};
document.querySelector('.deck').addEventListener('click',e=>{if(active&&!e.target.closest('button,a,video')){if(playing)finish();else nav(1)}});
window.addEventListener('beforeprint',()=>Object.values(scenes).forEach(s=>s.render(s.duration)));
})();
