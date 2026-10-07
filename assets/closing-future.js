// A schematic future workflow, with illustrative case flags and human review.
(() => {
  'use strict';
  const root=document.getElementById('closing-future'), svg=root.querySelector('svg');
  const NS='http://www.w3.org/2000/svg',ink='#161616',paper='#fafaf8',green='#617f75',red='#a54a46';
  const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n);},mix=(a,b,p)=>a+(b-a)*p;
  const E=(tag,attrs,parent)=>{const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent?.append(n);return n;};
  const G=p=>E('g',{},p),P=(p,d,extra={})=>E('path',{d,fill:'none',stroke:ink,'stroke-width':2.4,'stroke-linecap':'round','stroke-linejoin':'round',...extra},p);
  const R=(p,x,y,w,h,extra={})=>E('rect',{x,y,width:w,height:h,rx:3,fill:paper,stroke:ink,'stroke-width':2,...extra},p);
  const T=(p,x,y,text,size=24,extra={})=>{const n=E('text',{x,y,'font-size':size,fill:ink,...extra},p);n.textContent=text;return n;};
  const fade=(n,t,a,b=550)=>n.style.opacity=clamp((t-a)/b);
  const draw=(n,t,a,b=900)=>{n.setAttribute('pathLength',1);n.style.strokeDasharray=1;n.style.strokeDashoffset=1-ease((t-a)/b);};
  const world=G(svg),lab=G(world),line=G(world),machine=G(world),routes=G(world),robot=G(world);
  T(lab,151,311,'From the lab',25);P(lab,'M 115 616 H 455 M 129 616 V 637 M 442 616 V 637',{stroke:'#85857e'});
  for(let i=0;i<13;i++)E('circle',{cx:142+i*22,cy:624,r:5,fill:paper,stroke:'#85857e','stroke-width':1.5},lab);
  const stack=Array.from({length:24},(_,i)=>{const g=G(lab),y=597-i*9;P(g,`M 215 ${y} L 344 ${y} L 353 ${y+5} L 351 ${y+10} L 213 ${y+10} Z M 215 ${y+4} H 348`,{'stroke-width':1.7});return g;});
  T(lab,236,675,'Slides',22);
  // Scanner with a visible slide aperture and a rotating, ink-only AI indicator.
  R(machine,645,369,202,238,{rx:10});P(machine,'M 645 410 H 847 M 667 573 H 825 M 676 607 V 617 M 816 607 V 617');
  R(machine,708,415,77,11,{rx:1,fill:'#e8e8e1'});T(machine,746,651,'Scan + AI',25,{'text-anchor':'middle'});
  const ai=G(machine),spinner=G(ai);P(spinner,'M 746 466 A 34 34 0 1 1 714 489',{'stroke-width':2.7});P(spinner,'M 708 481 L 714 489 L 722 482');T(ai,746,508,'AI',23,{'text-anchor':'middle'});
  const scanBeam=P(machine,'M 673 444 H 820',{stroke:green,'stroke-width':2});
  // A two-link arm. Joint angles come from the wrist position, keeping both links attached.
  P(robot,'M 461 631 H 560 L 550 611 H 472 Z');R(robot,489,583,44,29);const armOuter=P(robot,'',{'stroke-width':21,stroke:ink}),armBack=P(robot,'',{'stroke-width':16,stroke:paper}),armEdge=P(robot,'',{'stroke-width':2.6});
  const joints=[0,1,2].map(()=>E('circle',{r:10,fill:paper,stroke:ink,'stroke-width':2.2},robot));
  const gripper=G(robot);P(gripper,'M -15 0 V 15 L -8 20 M 15 0 V 15 L 8 20 M -17 0 H 17');const carried=R(gripper,-28,18,56,8,{rx:1,fill:paper});
  function arm(x,y){const bx=511,by=589,L1=172,L2=190,dx=x-bx,dy=y-by,d=Math.min(L1+L2-1,Math.hypot(dx,dy));const ang=Math.atan2(dy,dx)-Math.acos(clamp((L1*L1+d*d-L2*L2)/(2*L1*d)));const ex=bx+Math.cos(ang)*L1,ey=by+Math.sin(ang)*L1;const path=`M ${bx} ${by} L ${ex} ${ey} L ${x} ${y}`;armOuter.setAttribute('d',path);armBack.setAttribute('d',path);armEdge.setAttribute('d',path);[[bx,by],[ex,ey],[x,y]].forEach(([cx,cy],i)=>{joints[i].setAttribute('cx',cx);joints[i].setAttribute('cy',cy);});gripper.setAttribute('transform',`translate(${x} ${y})`);}
  const routePaths=[P(routes,'M 850 488 H 925 Q 948 488 970 457 L 1088 323',{stroke:green}),P(routes,'M 850 488 H 1088',{stroke:red}),P(routes,'M 850 488 H 925 Q 948 488 970 525 L 1088 623',{stroke:'#777'})];
  const stain=G(routes);P(stain,'M 1135 282 H 1151 V 300 L 1166 317 V 352 H 1120 V 317 L 1135 300 Z M 1120 331 H 1166');T(stain,1200,321,'Additional stains',23);T(stain,1200,350,'Approved protocols',17,{fill:'#777'});
  const returnPath=P(routes,'M 1144 270 Q 1144 238 1078 238 H 748 V 356',{stroke:green,'stroke-dasharray':'4 7','stroke-width':1.6});
  const priority=G(routes);R(priority,1108,448,72,49);P(priority,'M 1144 497 V 514 M 1128 514 H 1160 M 1100 520 H 1188');T(priority,1210,478,'Priority reads',23,{fill:red});
  const prepLabel=T(routes,1100,737,'Pre-analysis',24);
  const packets=Array.from({length:12},(_,i)=>R(routes,-7,-4,14,8,{rx:1,fill:paper,stroke:[green,red,ink][i%3]}));
  const caseBoard=G(svg);R(caseBoard,160,240,1280,500,{rx:10});P(caseBoard,'M 160 289 H 1440',{stroke:'#c6c5bd','stroke-width':1.4});T(caseBoard,194,272,'Case prepared for pathologist review',22);
  P(caseBoard,'M 745 740 V 773 M 855 740 V 773 M 682 779 H 917',{'stroke-width':2});
  // Hand-drawn histology schematic. Closed cubic curves keep every contour smooth
  // at both the workflow thumbnail scale and the enlarged review-screen scale.
  const tissue=G(caseBoard),tissueOutline='M 240 473 C 225 423 244 370 285 348 C 327 325 367 326 409 337 C 451 349 468 351 509 338 C 567 320 623 332 670 357 C 715 381 744 423 748 470 C 753 520 732 564 698 604 C 658 650 604 673 553 660 C 520 651 505 651 473 658 C 425 669 394 644 349 642 C 302 640 271 621 253 586 C 232 547 232 516 240 473 Z';
  P(tissue,tissueOutline,{stroke:'#8d7c85',fill:'#f4e9ed','stroke-width':2});
  const defs=E('defs',{},svg),clip=E('clipPath',{id:'prepared-tissue-clip'},defs);E('path',{d:tissueOutline},clip);
  const micro=G(tissue);micro.setAttribute('clip-path','url(#prepared-tissue-clip)');
  // A periodic Catmull-Rom curve rendered as cubic Beziers, never a polygon.
  function softLoop(cx,cy,rx,ry,phase=0,n=12){
    const points=Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n,r=1+.075*Math.sin(i*2.2+phase)+.04*Math.cos(i*3.1+phase);return[cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r];});
    let d=`M ${points[0][0]} ${points[0][1]}`;
    for(let i=0;i<n;i++){const p0=points[(i+n-1)%n],p1=points[i],p2=points[(i+1)%n],p3=points[(i+2)%n];d+=` C ${p1[0]+(p2[0]-p0[0])/6} ${p1[1]+(p2[1]-p0[1])/6} ${p2[0]-(p3[0]-p1[0])/6} ${p2[1]-(p3[1]-p1[1])/6} ${p2[0]} ${p2[1]}`;}return d+' Z';
  }
  // Light stromal fibres and spindle nuclei, kept sparse so the flags stay legible.
  for(let i=0;i<32;i++){const x=253+(i*83%466),y=355+(i*59%292);P(micro,`M ${x} ${y} q 13 -8 27 0 t 26 3`,{stroke:'#d9bfc9','stroke-width':1,opacity:.62});E('ellipse',{cx:x+16,cy:y+8,rx:3.3,ry:1.2,fill:'#b397ad',opacity:.55,transform:`rotate(${(i*37)%140-70} ${x+16} ${y+8})`},micro);}
  function gland(parent,cx,cy,rx,ry,angle,phase,dense=false){
    const g=G(parent);g.setAttribute('transform',`translate(${cx} ${cy}) rotate(${angle})`);
    P(g,softLoop(0,0,rx,ry,phase),{stroke:dense?'#8f6f91':'#b196ac',fill:dense?'#d6bfd8':'#e6d3e3','stroke-width':1.4});
    P(g,softLoop(1,-1,rx*.57,ry*.56,phase+.4),{stroke:'#baa5b9',fill:'#faf7f4','stroke-width':1});
    const count=dense?12:10;
    for(let j=0;j<count;j++){const a=j*Math.PI*2/count+.1*Math.sin(j+phase),x=Math.cos(a)*rx*.78,y=Math.sin(a)*ry*.79;E('ellipse',{cx:x,cy:y,rx:dense?2.8:2.3,ry:dense?1.8:1.4,fill:dense?'#88688b':'#a58ba4',opacity:.85,transform:`rotate(${a*180/Math.PI+90} ${x} ${y})`},g);}
    return g;
  }
  [[289,407,24,32,-24],[356,376,28,22,12],[426,390,25,34,-16],[521,376,29,20,8],[599,376,26,24,24],[299,489,31,27,-12],[326,566,24,34,25],[389,612,30,20,-8],[454,586,25,31,-17],[539,612,34,23,10],[608,567,24,30,25],[670,527,29,23,-14],[646,606,22,27,38]].forEach((g,i)=>gland(micro,...g,i*.8));
  // Rounded, fused gland profiles suggest complex architecture without claiming
  // a real diagnosis. The annotation ring arrives with the corresponding note.
  const architecture=G(micro);
  P(architecture,'M 424 463 C 418 443 433 426 453 431 C 463 410 488 416 499 432 C 519 419 542 432 540 450 C 565 460 566 482 550 496 C 558 519 535 539 514 529 C 501 548 477 542 468 526 C 444 540 423 522 429 503 C 409 494 410 473 424 463 Z',{stroke:'#977699',fill:'#d9c3dc','stroke-width':1.8});
  [[447,460,13,18,-25],[477,449,14,12,18],[514,454,13,18,-12],[534,486,12,15,25],[500,500,15,20,-16],[464,503,15,12,8],[442,484,10,9,22]].forEach((g,i)=>gland(architecture,...g,i+2,true));
  const nearMargin=G(micro);
  P(nearMargin,softLoop(695,430,44,49,1.5),{stroke:'#aa849d',fill:'#e2c9dc','stroke-width':1.7});
  [[679,409,13,15,-24],[705,407,12,16,20],[684,436,15,12,8],[714,435,11,15,-14],[700,457,13,11,12]].forEach((g,i)=>gland(nearMargin,...g,i+4,true));
  const lesion=P(tissue,'M 652 388 C 674 368 710 376 728 399 C 745 421 745 448 726 468 C 707 488 677 482 656 463 C 637 446 636 409 652 388 Z',{stroke:red,fill:'none','stroke-width':2.3});
  const margin=P(caseBoard,'M 770 337 V 654',{stroke:red,'stroke-dasharray':'4 7','stroke-width':1.5});
  const marginMark=P(caseBoard,'M 742 428 H 770 M 742 420 V 436 M 770 420 V 436',{stroke:red,'stroke-width':2});
  const archRing=E('ellipse',{cx:488,cy:479,rx:89,ry:74,fill:'none',stroke:green,'stroke-width':2},caseBoard);
  const marginLabel=T(caseBoard,781,644,'Margin',16,{fill:red});
  const notes=G(caseBoard);T(notes,872,334,'Prepared notes',20,{fill:'#777'});
  const noteTexts=['Cancer close to margin','High-risk architectural features','Pre-ordered stains'];
  const noteNodes=noteTexts.map((text,i)=>{const g=G(notes);E('circle',{cx:882,cy:380+i*106,r:4,fill:i===0?red:i===1?green:ink},g);const line=T(g,902,388+i*106,'',25);return {g,line,text};});
  const protocolNote=T(notes,902,631,'Under approved protocols',18,{fill:'#777'});
  const review=T(caseBoard,902,697,'Ready for your review.',23,{fill:green});
  T(caseBoard,230,694,'Schematic case',16,{fill:'#888'});
  const starts=[0,2500,13000,19000,23000,26000,29000,33500],end=39500;
  let elapsed=0,playing=false,moving=false,active=false,visited=false,raf=0,last=0,autoland=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),caption=root.querySelector('.closing-caption'),heading=root.querySelector('h2');
  const playButton=root.querySelector('[data-closing="play"]'),nextButton=root.querySelector('[data-closing="next"]');
  function render(t){
    const stage=starts.reduce((n,a,i)=>t>=a?i:n,0);root.dataset.step=stage+1;root.dataset.state=playing?'playing':t>=end?'finished':'paused';
    heading.textContent=t<21000?'The future we can build':'A case, ready for review';caption.textContent=t<2500?'The work keeps coming.':t<13000?'One slide at a time. Scanned and prepared.':t<19000?'Additional stains. Priority reads. Prepared cases.':t<23000?'The case arrives with a head start.':'';
    fade(lab,t,0);stack.forEach((g,i)=>{const picked=t<2500?0:Math.min(3,Math.floor((t-2500)/3500));g.style.opacity=t>i*65&&i<24-picked?1:0;});
    fade(robot,t,2100);fade(machine,t,2000);world.style.opacity=1-ease((t-19400)/2400);
    const cyc=clamp((t-2500)/3500),iteration=Math.floor(Math.max(0,t-2500)/3500),f=clamp(((t-2500)%3500)/3500);
    let wx=565,wy=369,carry=false;
    if(t>=2500&&t<13000){
      const targets=[[560,352],[282,371+Math.min(iteration,2)*9],[282,333],[746,381],[746,393],[560,352]];
      const q=f*5,i=Math.min(4,Math.floor(q)),p=ease(q-i);wx=mix(targets[i][0],targets[i+1][0],p);wy=mix(targets[i][1],targets[i+1][1],p);carry=f>=.2&&f<.8;
    }arm(wx,wy);carried.style.opacity=carry?1:0;
    fade(ai,t,5000);spinner.setAttribute('transform',`rotate(${(t-5000)*.2} 746 500)`);scanBeam.style.opacity=t>5000&&t<19000?1:0;scanBeam.setAttribute('transform',`translate(0 ${((Math.max(0,t-5000)%1800)/1800)*104})`);
    fade(routes,t,13000);routePaths.forEach((p,i)=>draw(p,t,13000+i*700,1500));fade(stain,t,13700);fade(priority,t,14400);fade(prepLabel,t,15100);returnPath.style.opacity=clamp((t-15800)/900);
    packets.forEach((g,i)=>{const f=clamp((t-13700-i*330)/2200),lane=i%3;g.style.opacity=t>=13700+i*330&&f<1?1:0;const x=mix(851,1091,f),y=f<.32?488:mix(488,[323,488,623][lane],ease((f-.32)/.68));g.setAttribute('transform',`translate(${x} ${y})`);});
    fade(caseBoard,t,15100);const z=ease((t-19000)/3600);caseBoard.setAttribute('transform',`translate(${1064.8*(1-z)} ${524.6*(1-z)}) scale(${mix(.22,1,z)})`);
    fade(notes,t,22500);noteNodes.forEach(({g,line,text},i)=>{const at=23000+i*3000;g.style.opacity=t>=at?1:0;line.textContent=text.slice(0,Math.max(0,Math.floor((t-at)/48)));});
    fade(margin,t,23000);fade(marginMark,t,23500);fade(marginLabel,t,23000);fade(lesion,t,23000);fade(archRing,t,26000);fade(protocolNote,t,30500);fade(review,t,33500);
    playButton.textContent=playing?'Pause':'Play';playButton.disabled=t>=end;nextButton.textContent='Title slide';
  }
  function schedule(){if(raf||!active||document.hidden||(!playing&&!moving))return;last=performance.now();raf=requestAnimationFrame(tick);}
  function tick(now){raf=0;if(!active||document.hidden)return;elapsed+=Math.min(100,now-last);last=now;render(Math.min(elapsed,end));if(elapsed>=end){playing=false;moving=false;render(end);if(autoland){autoland=false;document.dispatchEvent(new Event('closing-title-request'));}return;}if(playing||moving)raf=requestAnimationFrame(tick);}
  playButton.addEventListener('click',()=>{playing=!playing;moving=false;autoland=playing;render(elapsed);schedule();});
  nextButton.addEventListener('click',()=>document.dispatchEvent(new Event('closing-title-request')));
  root.querySelector('[data-closing="replay"]').addEventListener('click',()=>{elapsed=reduced.matches?end:0;playing=!reduced.matches;autoland=playing;render(elapsed);schedule();});
  function activate(id){cancelAnimationFrame(raf);raf=0;if(active){playing=false;moving=false;render(elapsed);}active=id===root.id;if(!active)return;if(!visited){visited=true;elapsed=reduced.matches?end:0;playing=!reduced.matches;autoland=playing;}render(elapsed);schedule();}
  document.addEventListener('deck-slide-change',e=>activate(e.detail));document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else schedule();});
  reduced.addEventListener('change',e=>{if(e.matches&&active){playing=false;moving=false;autoland=false;elapsed=end;cancelAnimationFrame(raf);raf=0;render(end);}});
  window.addEventListener('beforeprint',()=>{cancelAnimationFrame(raf);raf=0;playing=false;autoland=false;render(end);});render(0);activate(document.querySelector('.slide:not([hidden])')?.id);
})();
