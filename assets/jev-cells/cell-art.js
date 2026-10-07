// Cartoon cells for the Jev cell finder. Each cell is drawn in a 100 × 100 box
// from a small set of shapes, with its defining feature and a friendly face.
const O = '#3b2f3f';          // outline
const N = '#7a67bd';          // nucleus
const ND = '#4d3d8c';         // dark nucleus
const W = 'stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"';

const fill = (c) => `fill="${c}" stroke="${O}" ${W}`;
const line = (d, c = O, w = 2) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const dot = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const nucleus = (x, y, r, c = N) => `<circle cx="${x}" cy="${y}" r="${r}" ${fill(c)}/>${dot(x + r * 0.25, y - r * 0.2, r * 0.28, '#b9a9ee')}`;

function face(x, y, s = 1, light = false) {
  const eye = light ? '#fff' : O, glint = light ? O : '#fff';
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="-9" cy="3.5" rx="3.2" ry="2" fill="#ff8fa3" opacity=".55"/><ellipse cx="9" cy="3.5" rx="3.2" ry="2" fill="#ff8fa3" opacity=".55"/>
    <circle cx="-5" cy="0" r="2.4" fill="${eye}"/><circle cx="5" cy="0" r="2.4" fill="${eye}"/>
    <circle cx="-4.2" cy="-.9" r=".8" fill="${glint}"/><circle cx="5.8" cy="-.9" r=".8" fill="${glint}"/>
    <path d="M -3 4 Q 0 7 3 4" fill="none" stroke="${eye}" stroke-width="1.5" stroke-linecap="round"/></g>`;
}

// Deterministic scatter so every render of a cell looks the same.
function scatter(n, cx, cy, rx, ry, r, color, seed = 1) {
  let out = '', s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand());
    out += dot((cx + Math.cos(a) * rx * d).toFixed(1), (cy + Math.sin(a) * ry * d).toFixed(1), r, color);
  }
  return out;
}

const shapes = {
  columnar(c) {
    let top = '';
    if (c.top === 'brush') for (let x = 35; x <= 65; x += 3) top += line(`M ${x} 18 V 11`, O, 1.4);
    if (c.top === 'cilia') for (let x = 35; x <= 65; x += 5) top += line(`M ${x} 18 q -3 -6 0 -10 q 3 -4 -1 -8`, O, 1.6);
    return `${top}<rect x="31" y="18" width="38" height="72" rx="11" ${fill(c.color)}/>
      <ellipse cx="50" cy="73" rx="9" ry="11" ${fill(N)}/>${face(50, 42)}`;
  },
  goblet(c) {
    return `<path d="M 40 90 L 40 64 Q 20 44 28 20 Q 50 8 72 20 Q 80 44 60 64 L 60 90 Z" ${fill(c.color)}/>
      ${scatter(9, 50, 30, 17, 10, 3.2, '#ffffff', 3)}
      <ellipse cx="50" cy="80" rx="8" ry="5" ${fill(ND)}/>${face(50, 52)}`;
  },
  polygon(c) {
    let detail = '';
    if (c.detail === 'spines') for (const [x, y] of [[50, 12], [84, 32], [84, 72], [50, 92], [16, 72], [16, 32]]) detail += line(`M ${x} ${y} l ${(x - 50) * 0.12} ${(y - 52) * 0.12}`, O, 2);
    if (c.detail === 'crystals') detail += `<rect x="62" y="60" width="11" height="3.5" rx="1.5" fill="#d0584f"/><rect x="26" y="66" width="9" height="3" rx="1.5" fill="#d0584f" transform="rotate(-25 30 67)"/>`;
    const halo = c.detail === 'fried-egg' ? `<circle cx="50" cy="42" r="15" fill="#fff" opacity=".45"/>` : '';
    const spines = c.detail === 'spines' ? detail : '', crystals = c.detail === 'crystals' ? detail : '';
    return `${spines}<path d="M 50 14 L 83 33 L 83 71 L 50 90 L 17 71 L 17 33 Z" ${fill(c.color)}/>${halo}${crystals}
      ${nucleus(50, 42, 10)}${face(50, 66)}`;
  },
  cuboid(c) {
    let extra = '', body = `<rect x="22" y="28" width="56" height="56" rx="9" ${fill(c.color)}/>`, nuc = nucleus(50, 48, 10);
    if (c.detail === 'dome') { body = `<path d="M 16 84 L 16 46 Q 50 6 84 46 L 84 84 Z" ${fill(c.color)}/>`; nuc = nucleus(40, 50, 8) + nucleus(60, 50, 8); }
    if (c.detail === 'lamellar') extra = scatter(5, 50, 38, 20, 6, 3, '#ffffff', 5) + scatter(5, 50, 38, 20, 6, 1.2, '#9a8fb0', 5);
    if (c.detail === 'colloid') extra = `<ellipse cx="50" cy="16" rx="26" ry="10" fill="#f6a7c1" stroke="${O}" stroke-width="2"/>`;
    if (c.detail === 'brush') for (let x = 25; x <= 75; x += 3) extra += line(`M ${x} 28 V 21`, O, 1.4);
    if (c.detail === 'eccentric') nuc = nucleus(37, 48, 10, ND);
    return `${extra}${body}${nuc}${face(52, 70)}`;
  },
  flat(c) {
    let extra = '';
    if (c.detail === 'bumpy') for (let x = 14; x <= 86; x += 6) extra += `<circle cx="${x}" cy="${51 - Math.sin((x - 6) / 88 * Math.PI) * 6}" r="2" fill="${c.color}" stroke="${O}" stroke-width="1.4"/>`;
    if (c.detail === 'vessel') extra = `<ellipse cx="50" cy="80" rx="11" ry="6" fill="#e8545a" stroke="${O}" stroke-width="2"/><ellipse cx="50" cy="80" rx="4.5" ry="2.3" fill="#f59ea1"/>`;
    return `${extra}<path d="M 6 62 Q 50 44 94 62 Q 50 72 6 62 Z" ${fill(c.color)}/>
      <ellipse cx="30" cy="58" rx="11" ry="6" ${fill(N)}/>${face(64, 60, 0.75)}`;
  },
  spindle(c) {
    let nuc = `<rect x="22" y="47" width="30" height="8" rx="4" ${fill(N)}/>`;
    if (c.detail === 'wavy') nuc = line('M 20 52 q 5 -5 10 0 t 10 0 t 10 0 t 10 0', ND, 4.5);
    let extra = '';
    if (c.detail === 'wrap') extra = `<circle cx="50" cy="80" r="12" fill="#fff5f7" stroke="${O}" stroke-width="2"/>`;
    return `${extra}<path d="M 6 52 Q 50 26 94 50 Q 50 76 6 52 Z" ${fill(c.color)}/>${nuc}${face(68, 50, 0.8)}`;
  },
  pyramid(c) {
    let extra = '';
    if (c.detail === 'apical-red') extra = scatter(10, 50, 30, 10, 8, 3, '#e0343a', 7);
    if (c.detail === 'zymogen') extra = scatter(9, 50, 30, 10, 8, 3, '#ef5e7a', 11);
    if (c.detail === 'basal-blue') extra = scatter(14, 50, 76, 18, 7, 1.8, '#5563b5', 13);
    return `<path d="M 24 88 L 39 16 L 61 16 L 76 88 Z" ${fill(c.color)}/>${extra}${nucleus(50, 72, 9)}${face(50, 48)}`;
  },
  round(c) {
    let inner = '', faceMark = face(50, 72);
    switch (c.nucleus) {
      case 'big': inner = `<circle cx="50" cy="50" r="25" ${fill(ND)}/>`; faceMark = face(50, 52, 1, true); break;
      case 'multilobe': inner = line('M 30 46 L 44 36 L 58 44 L 70 36', ND, 2.2) + [[30, 46], [44, 36], [58, 44], [70, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.5" ${fill(N)}/>`).join(''); break;
      case 'bilobe': inner = `<circle cx="37" cy="42" r="10" ${fill(N)}/><circle cx="63" cy="42" r="10" ${fill(N)}/>${line('M 46 42 H 54', N, 3)}`; break;
      case 'clockface': inner = `<circle cx="42" cy="36" r="9" fill="#fff" opacity=".6"/><circle cx="62" cy="46" r="14" ${fill(N)}/>` +
        [0, 60, 120, 180, 240, 300].map(a => dot((62 + Math.cos(a * Math.PI / 180) * 8.5).toFixed(1), (46 + Math.sin(a * Math.PI / 180) * 8.5).toFixed(1), 2.4, ND)).join(''); break;
      case 'kidney': inner = `<path d="M 32 36 Q 50 24 68 36 Q 74 50 62 52 Q 52 42 42 52 Q 28 52 32 36 Z" ${fill(N)}/>`; break;
      case 'central': inner = nucleus(50, 42, 12); break;
      default: inner = '';
    }
    let granules = '';
    if (c.detail === 'red-granules') granules = scatter(26, 50, 52, 28, 28, 2.4, '#f06a3b', 17);
    if (c.detail === 'dark-granules') granules = scatter(40, 50, 50, 28, 28, 2.6, '#4a2f86', 19);
    if (c.detail === 'fine-granules') granules = scatter(22, 50, 55, 26, 24, 1.6, '#c88a2c', 23);
    const halo = c.detail === 'halo' ? `<circle cx="50" cy="42" r="19" fill="#ffffff"/>` : '';
    return `<circle cx="50" cy="52" r="36" ${fill(c.color)}/>${halo}${inner}${granules}${faceMark}`;
  },
  rbc(c) {
    return `<circle cx="50" cy="52" r="36" ${fill(c.color)}/><circle cx="50" cy="52" r="17" fill="#f59ea1"/>${face(50, 52)}`;
  },
  platelet(c) {
    return `<path d="M 36 46 Q 44 30 60 38 Q 72 46 64 60 Q 50 72 38 62 Q 28 56 36 46 Z" ${fill(c.color)}/>
      ${scatter(6, 50, 50, 9, 7, 1.8, '#6a3fa0', 29)}${face(50, 54, 0.6)}`;
  },
  blob(c) {
    return `<path d="M 20 52 Q 12 30 32 24 Q 44 8 60 20 Q 84 16 84 40 Q 96 56 80 70 Q 72 90 52 84 Q 30 92 24 74 Q 8 66 20 52 Z" ${fill(c.color)}/>
      <circle cx="68" cy="36" r="6" fill="#fff" stroke="${O}" stroke-width="1.5"/><circle cx="30" cy="42" r="4.5" fill="#fff" stroke="${O}" stroke-width="1.5"/><circle cx="64" cy="70" r="5" fill="#fff" stroke="${O}" stroke-width="1.5"/>
      <path d="M 38 34 Q 50 26 58 36 Q 54 46 44 44 Q 36 44 38 34 Z" ${fill(N)}/>${face(46, 62)}`;
  },
  giant(c) {
    const nuclei = c.detail === 'multi'
      ? [[30, 38], [44, 30], [60, 32], [72, 42], [36, 52], [62, 52]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="5" ${fill(N)}/>`).join('')
      : `<path d="M 30 40 Q 34 24 48 30 Q 58 20 68 32 Q 78 40 70 50 Q 64 58 52 52 Q 40 60 32 52 Q 24 48 30 40 Z" ${fill(N)}/>`;
    return `<path d="M 8 56 Q 6 20 44 12 Q 86 8 92 44 Q 98 80 60 88 Q 16 94 8 56 Z" ${fill(c.color)}/>${nuclei}${face(50, 72)}`;
  },
  dendritic(c) {
    const arms = [[50, 6], [88, 28], [90, 76], [52, 94], [12, 74], [10, 26]];
    const pigment = c.detail === 'pigment' ? arms.map(([x, y], i) => dot(((x + 50) / 2 + 3).toFixed(1), ((y + 50) / 2).toFixed(1), 3, '#7a4a24') + dot(x, y, 2.6, '#7a4a24')).join('') : '';
    return arms.map(([x, y]) => line(`M 50 50 Q ${(x + 50) / 2 + 6} ${(y + 50) / 2 - 6} ${x} ${y}`, O, 7)).join('')
      + arms.map(([x, y]) => line(`M 50 50 Q ${(x + 50) / 2 + 6} ${(y + 50) / 2 - 6} ${x} ${y}`, c.color, 3.6)).join('')
      + `<circle cx="50" cy="50" r="19" ${fill(c.color)}/>${pigment}${face(50, 54, 0.8)}`;
  },
  podocyte(c) {
    let feet = '';
    for (let i = 0; i < 6; i++) { const x = 20 + i * 12; feet += line(`M ${50 + (x - 50) * 0.3} 50 Q ${x} 64 ${x} 78`, O, 5) + line(`M ${50 + (x - 50) * 0.3} 50 Q ${x} 64 ${x} 78`, c.color, 2.4); }
    return `<path d="M 6 88 Q 50 74 94 88" fill="none" stroke="#e8545a" stroke-width="5" stroke-linecap="round"/>${feet}
      <circle cx="50" cy="36" r="22" ${fill(c.color)}/><circle cx="50" cy="30" r="7" ${fill(N)}/>${face(50, 44, 0.8)}`;
  },
  fat(c) {
    return `<circle cx="50" cy="50" r="42" ${fill(c.color)}/><path d="M 84 34 Q 94 50 84 66 Q 88 50 84 34 Z" ${fill(ND)}/>${face(46, 52)}`;
  },
  lacuna(c) {
    const bone = c.detail === 'bone';
    const matrix = bone ? '#f5d9cf' : '#b9cdf2';
    const canals = bone ? [[10, 30], [90, 28], [12, 76], [88, 78], [50, 8], [50, 94]].map(([x, y]) => line(`M 50 52 L ${x} ${y}`, '#b97c68', 1.4)).join('') : '';
    return `<rect x="4" y="8" width="92" height="88" rx="16" fill="${matrix}" stroke="${O}" stroke-width="2"/>${canals}
      <ellipse cx="50" cy="52" rx="28" ry="22" fill="#fffdf8" stroke="${O}" stroke-width="2"/>
      <ellipse cx="50" cy="52" rx="21" ry="16" ${fill(c.color)}/><circle cx="50" cy="46" r="6" ${fill(N)}/>${face(50, 58, 0.65)}`;
  },
  fiber(c) {
    if (c.detail === 'cardiac') {
      let stripes = '';
      for (let x = 12; x <= 86; x += 6) stripes += line(`M ${x} 42 V 62`, '#c55a6c', 1.4);
      return `<path d="M 4 42 H 60 L 80 22 L 94 32 L 76 50 L 96 62 L 90 72 L 64 62 H 4 Z" ${fill(c.color)}/>${stripes}
        ${line('M 40 40 V 64', O, 3)}<ellipse cx="24" cy="52" rx="7" ry="4.5" ${fill(N)}/>${face(56, 52, 0.7)}`;
    }
    let stripes = '';
    for (let x = 10; x <= 90; x += 5) stripes += line(`M ${x} 38 V 66`, '#c55a6c', 1.4);
    return `<rect x="4" y="34" width="92" height="36" rx="10" ${fill(c.color)}/>${stripes}
      <ellipse cx="22" cy="36" rx="7" ry="3.2" ${fill(N)}/><ellipse cx="74" cy="68" rx="7" ry="3.2" ${fill(N)}/>${face(50, 52, 0.85)}`;
  },
  neuron(c) {
    const dendrites = [['M 40 40 Q 26 26 14 22', 'M 26 30 L 18 38'], ['M 58 36 Q 66 18 60 6', 'M 64 18 L 74 12'], ['M 36 58 Q 20 66 10 62', ''], ['M 50 34 Q 44 18 34 10', '']]
      .map(([a, b]) => line(a, O, 5.5) + line(a, c.color, 2.8) + (b ? line(b, O, 4) + line(b, c.color, 1.8) : '')).join('');
    return `${dendrites}${line('M 62 60 Q 80 72 96 92', O, 5.5)}${line('M 62 60 Q 80 72 96 92', c.color, 2.8)}
      <path d="M 50 26 L 68 44 L 62 66 L 36 64 L 30 42 Z" ${fill(c.color)}/><circle cx="50" cy="44" r="9" ${fill('#9f8fdc')}/>${dot(52, 43, 3, ND)}${face(49, 58, 0.7)}`;
  },
  purkinje(c) {
    const tree = ['M 50 58 V 30', 'M 50 40 Q 34 30 26 14', 'M 50 36 Q 66 26 76 10', 'M 38 26 L 28 26', 'M 32 20 L 20 20', 'M 64 22 L 76 24', 'M 50 30 Q 48 16 52 6', 'M 70 16 L 84 18']
      .map(d => line(d, O, 5) + line(d, c.color, 2.4)).join('');
    return `${tree}${line('M 50 90 V 98', O, 4)}<path d="M 50 50 Q 70 60 66 76 Q 60 92 50 92 Q 40 92 34 76 Q 30 60 50 50 Z" ${fill(c.color)}/>
      <circle cx="50" cy="68" r="7" ${fill(N)}/>${face(50, 82, 0.6)}`;
  },
  astro(c) {
    let arms = '';
    for (let i = 0; i < 10; i++) { const a = i * 36 * Math.PI / 180, x = 50 + Math.cos(a) * 44, y = 52 + Math.sin(a) * 42; arms += line(`M 50 52 L ${x.toFixed(1)} ${y.toFixed(1)}`, O, 4.5) + line(`M 50 52 L ${x.toFixed(1)} ${y.toFixed(1)}`, c.color, 2); }
    return `${arms}<circle cx="50" cy="52" r="18" ${fill(c.color)}/><circle cx="50" cy="46" r="6" ${fill(N)}/>${face(50, 58, 0.7)}`;
  },
  microglia(c) {
    const arms = ['M 30 52 Q 16 44 8 30', 'M 16 46 L 6 50', 'M 70 50 Q 84 40 92 26', 'M 84 42 L 94 46', 'M 44 60 Q 36 80 26 90', 'M 58 60 Q 66 80 80 88']
      .map(d => line(d, O, 4) + line(d, c.color, 1.8)).join('');
    return `${arms}<ellipse cx="50" cy="52" rx="22" ry="13" ${fill(c.color)}/><rect x="38" y="44" width="24" height="6" rx="3" ${fill(ND)}/>${face(50, 58, 0.6)}`;
  },
  schwann(c) {
    return `${line('M 2 72 H 98', '#9d8a6a', 5)}
      <ellipse cx="50" cy="72" rx="40" ry="12" fill="none" stroke="${O}" stroke-width="2"/><ellipse cx="50" cy="72" rx="34" ry="8" fill="none" stroke="#c8a55a" stroke-width="2"/>
      <path d="M 18 64 Q 50 12 82 64 Z" ${fill(c.color)}/><ellipse cx="50" cy="48" rx="10" ry="5" ${fill(N)}/>${face(50, 34, 0.7)}`;
  },
  rod(c) {
    let discs = '';
    for (let y = 10; y <= 36; y += 4) discs += line(`M 40 ${y} H 60`, '#6b7ac2', 1.6);
    return `<rect x="38" y="6" width="24" height="34" rx="6" ${fill(c.color)}/>${discs}
      <rect x="40" y="40" width="20" height="44" rx="8" ${fill(c.color)}/><ellipse cx="50" cy="70" rx="7" ry="9" ${fill(N)}/>
      ${line('M 50 84 V 94', O, 3)}${face(50, 52, 0.55)}`;
  },
  sperm(c) {
    return `${line('M 44 50 Q 56 40 66 50 T 86 50 T 98 48', O, 3)}<rect x="36" y="45" width="10" height="10" rx="3" ${fill('#cfd9ec')}/>
      <ellipse cx="24" cy="50" rx="17" ry="12" ${fill(c.color)}/><path d="M 10 44 Q 18 34 30 38" fill="none" stroke="#7a8fc9" stroke-width="3"/>${face(22, 52, 0.7)}`;
  },
  oocyte(c) {
    return `<circle cx="50" cy="50" r="46" fill="#f7eef7" stroke="${O}" stroke-width="2"/>${scatter(10, 50, 50, 44, 44, 3, '#e8c9e0', 31)}
      <circle cx="50" cy="50" r="36" ${fill(c.color)}/><circle cx="62" cy="38" r="10" ${fill('#b3a4e6')}/>${dot(64, 37, 3.5, ND)}${face(46, 60)}`;
  },
  sertoli(c) {
    return `<path d="M 28 92 Q 22 60 34 36 Q 40 16 50 8 Q 62 18 66 38 Q 78 62 72 92 Z" ${fill(c.color)}/>
      <path d="M 42 80 L 58 80 L 50 64 Z" ${fill(N)}/>${dot(40, 30, 3, '#7a8fc9')}${dot(62, 44, 3, '#7a8fc9')}${face(50, 50, 0.85)}`;
  }
};

export function cellSvg(cell, label = cell.name) {
  const draw = shapes[cell.art] || shapes.round;
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${draw(cell)}</svg>`;
}
