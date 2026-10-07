// Workload coding with Jev. Jev reads a pathology report and answers typed questions
// (procedure, intent, site, counts, malignancy, synoptic, stains), several of them twice
// in different words for redundancy. A fixed rule engine then applies the 2014 L4E coding
// workbook rules to those answers. All calls run in parallel and render as they land.
const root = document.querySelector('#l4e');
const $ = sel => root.querySelector(sel);

const L = { L1: 0.125, L2: 0.25, L3: 0.5, L4: 1, L5: 5, L6: 10 };
const PER_DAY = 7560 / 210;   // workbook: mean annual L4E over 210 working days

const EXAMPLES = {
  biopsy: { label: 'Biopsy example', expected: 4.5, text: `SURGICAL PATHOLOGY REPORT (synthetic demonstration case)

CLINICAL HISTORY
64-year-old with rectal bleeding and chronic diarrhea. Colonoscopy: ascending colon polyp, rectal mass at 8 cm, random biopsies for diarrhea.

GROSS DESCRIPTION
A. "Ascending colon polyp": 1 tan polypoid fragment, 0.6 cm. Entirely submitted in 1 cassette.
B. "Random sigmoid biopsies": 4 tan mucosal fragments, 0.2 to 0.4 cm. Entirely submitted in 1 cassette.
C. "Rectal mass biopsy": 3 tan-white firm fragments, 0.3 to 0.5 cm. Entirely submitted in 1 cassette.

FINAL DIAGNOSIS
A. Colon, ascending, polypectomy: Tubular adenoma. Negative for high-grade dysplasia.
B. Colon, sigmoid, random biopsies: Colonic mucosa with no significant pathologic abnormality. No microscopic colitis.
C. Rectum, mass, biopsy: Invasive adenocarcinoma, moderately differentiated.

COMMENT
Mismatch repair immunohistochemistry (MLH1, PMS2, MSH2, MSH6) was performed on part C for treatment planning: intact nuclear expression of all four proteins.` },
  resection: { label: 'Resection example', expected: 11, text: `SURGICAL PATHOLOGY REPORT (synthetic demonstration case)

CLINICAL HISTORY
71-year-old with cecal adenocarcinoma diagnosed on biopsy. Right hemicolectomy.

GROSS DESCRIPTION
A. "Right colon": Right hemicolectomy, 28 cm of colon with 6 cm of terminal ileum and appendix. Ulcerated cecal tumor, 4.5 cm, grossly invading pericolic fat, 3.0 cm from the radial margin. 22 lymph nodes identified.
Cassette summary: A1 to A3 tumor at deepest invasion; A4 proximal margin; A5 distal margin; A6 radial margin; A7 to A20 lymph nodes; A21 to A24 appendix and background mucosa. Total 24 cassettes.

FINAL DIAGNOSIS
A. Right colon and terminal ileum, right hemicolectomy: Invasive adenocarcinoma, low grade, invading through the muscularis propria into pericolic tissue (pT3). Metastatic carcinoma in 2 of 22 lymph nodes (pN1b). All margins negative. See synoptic report.

SYNOPTIC REPORT (CAP Colon and Rectum Resection)
Procedure: right hemicolectomy. Tumor site: cecum. Histologic type: adenocarcinoma. Histologic grade: low grade. Tumor size: 4.5 cm. Tumor extent: invades through muscularis propria into pericolic tissue. Lymphovascular invasion: present. Margins: negative. Regional lymph nodes: 2 of 22 involved. pTNM: pT3 pN1b.

ANCILLARY STUDIES
Mismatch repair immunohistochemistry for treatment planning: loss of MLH1 and PMS2 expression; MSH2 and MSH6 retained.` }
};

const STAINS = ['MLH1', 'PMS2', 'MSH2', 'MSH6', 'ER', 'PR', 'HER2', 'Ki-67', 'CK7', 'CK20', 'CDX2', 'TTF-1', 'p40', 'p63', 'S100', 'SOX10', 'CD3', 'CD20', 'CD45', 'GATA3', 'synaptophysin', 'chromogranin', 'AE1/AE3', 'PAS', 'trichrome', 'Giemsa', 'Warthin-Starry', 'Ziehl-Neelsen'];

const RULES = {
  r1_medical_biopsy: 'Rule 1: medical biopsy of non-neoplastic disease, not gastrointestinal (1 L4 per 5 fragments)',
  r1_surgical_biopsy: 'Rule 1: surgical biopsy of a suspected neoplastic lesion, not gastrointestinal and not a simple skin lesion (1 L4 per lesion)',
  r1_gi_medical: 'Rule 1: gastrointestinal medical biopsy, esophagus to rectum, for inflammation, IBD or diarrhea (1 L3 per 3 fragments)',
  r1_gi_surgical: 'Rule 1: gastrointestinal surgical biopsy of a polyp, mass or discrete lesion (1 L3 per lesion; high grade or malignant 1 L4)',
  r1_skin_simple: 'Rule 1: benign skin lesion, basal or squamous cell carcinoma (1 L3 per lesion)',
  r2_core: 'Rule 2: surgical core biopsies, not breast or prostate (1 L4 per 5 cores)',
  r2_breast_prostate: 'Rule 2: breast or prostate core biopsies (1 L4 for the first core, 1 L2 for each additional core)',
  r2_medical_core: 'Rule 2: medical core biopsy, such as liver for liver tests or kidney for proteinuria (1 L5)',
  r3_curettings: 'Rule 3: curettings, endometrial biopsy, TURP or TURBT (1 L4 for the first 3 blocks, 1 L2 per extra block)',
  r4_resection: 'Rule 4: resection, surgical or medical (1 L2 per block)',
  r9_post_therapy: 'Rule 9: resection after therapy with no residual tumor (1 L6 for the first 40 blocks)'
};

const SHORT = { r1_medical_biopsy: 'R1 medical', r1_surgical_biopsy: 'R1 surgical', r1_gi_medical: 'R1 GI medical', r1_gi_surgical: 'R1 GI surgical',
  r1_skin_simple: 'R1 skin', r2_core: 'R2 cores', r2_breast_prostate: 'R2 breast/prostate', r2_medical_core: 'R2 medical core',
  r3_curettings: 'R3 curettings', r4_resection: 'R4 resection', r9_post_therapy: 'R9 post-therapy' };

let running = 0, stats;

$('.l4e-examples').addEventListener('click', e => {
  const b = e.target.closest('button[data-example]');
  if (!b) return;
  b.blur();
  $('.l4e-text').value = EXAMPLES[b.dataset.example].text;
  root.dataset.example = b.dataset.example;
  run();
});
$('.l4e-run').addEventListener('click', e => { e.currentTarget.blur(); run(); });
$('.l4e-text').addEventListener('input', () => { root.dataset.example = ''; });
$('.l4e-text').addEventListener('keydown', e => { if (e.key === 'Escape') e.target.blur(); });
$('.l4e-text').value = EXAMPLES.biopsy.text;
root.dataset.example = 'biopsy';

async function jev(state, questions, myRun) {
  const t0 = performance.now();
  const response = await fetch('/api/jev-scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state, questions }) });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
  const ms = performance.now() - t0;
  if (myRun === running) { stats.calls++; stats.questions += Object.keys(questions).length; stats.cost += Number(json.cost || 0); stats.ms.push(ms); renderStats(); }
  return { a: json.answers, ms };
}

function partsOf(text) {
  const dx = text.split(/FINAL DIAGNOSIS/i)[1] || text;
  const parts = [];
  for (const m of dx.matchAll(/^\s*([A-H])[.)]\s+([^\n]+)/gm)) if (!parts.some(p => p.letter === m[1])) parts.push({ letter: m[1], label: m[2].split(':')[0].trim() });
  return parts.length ? parts : [{ letter: 'A', label: 'Specimen' }];
}

const numberOptions = text => {
  const nums = [...new Set([...text.matchAll(/\b(\d{1,2})\b/g)].map(m => +m[1]).filter(n => n > 0))].sort((a, b) => a - b);
  return Object.fromEntries([['not_stated', 'not stated in the report'], ...nums.map(n => [`n_${n}`, String(n)])]);
};
const numberOf = key => (key && key.startsWith('n_') ? +key.slice(2) : null);
const pct = p => `${Math.round(p * 100)}%`;
const top = ans => [ans.choice, ans.probabilities[ans.choice]];

async function run() {
  const text = $('.l4e-text').value.trim();
  if (!text) return;
  const myRun = ++running;
  stats = { calls: 0, questions: 0, cost: 0, ms: [], t0: performance.now() };
  const parts = partsOf(text), nums = numberOptions(text);
  const stains = STAINS.filter(s => new RegExp(`\\b${s.replace(/[-/]/g, '[-/ ]?')}\\b`, 'i').test(text));
  const out = $('.l4e-results');
  out.innerHTML = `<div class="l4e-case"><p class="l4e-h">Case</p><div class="l4e-rows" data-case><p class="l4e-wait">asking Jev…</p></div></div>
    ${parts.map(p => `<div class="l4e-part" data-part="${p.letter}"><p class="l4e-h">Part ${p.letter} · ${p.label}</p><div class="l4e-rows"><p class="l4e-wait">asking Jev…</p></div><p class="l4e-code"></p></div>`).join('')}
    ${stains.length ? `<div class="l4e-part" data-stains><p class="l4e-h">Ancillary stains · ${stains.join(', ')}</p><div class="l4e-rows"><p class="l4e-wait">asking Jev…</p></div><p class="l4e-code"></p></div>` : ''}`;
  $('.l4e-total').innerHTML = '<span class="l4e-total-n">…</span>';
  renderStats();
  const state = { report: text };

  const caseCall = jev(state, {
    parts: { type: 'choice', instructions: 'How many separately labeled specimen parts (A, B, C...) does this report contain?', criteria: Object.fromEntries([1, 2, 3, 4, 5, 6].map(n => [`n_${n}`, `${n} part${n > 1 ? 's' : ''}`])) },
    related: { type: 'boolean', instructions: 'Are all parts from the same procedure and the same lesion (coded together as one case)?' }
  }, myRun).then(({ a, ms }) => {
    if (myRun !== running) return;
    const [k, p] = top(a.parts), n = numberOf(k);
    rows(root.querySelector('[data-case]'), ms, [
      ['parts', `${n}`, p, `parser ${parts.length} · ${n === parts.length ? 'agree' : 'differ'}`, n === parts.length],
      ['one procedure, one lesion', a.related.probability >= 0.5 ? 'yes' : 'no', Math.max(a.related.probability, 1 - a.related.probability)]
    ]);
  });

  const partCalls = parts.map(part => jev(state, {
    procedure: { type: 'choice', instructions: `What kind of specimen is part ${part.letter}?`, criteria: {
      biopsy: 'biopsy or polypectomy fragments (forceps, punch, shave, snare)', core: 'needle core biopsy',
      curetting: 'curettings, endometrial biopsy, TURP or TURBT chips', resection: 'excision or resection of an organ or segment',
      post_therapy_no_residual: 'resection after neoadjuvant therapy with no residual tumor' } },
    intent: { type: 'choice', instructions: `Why was part ${part.letter} taken?`, criteria: {
      medical: 'medical: to diagnose non-neoplastic disease such as inflammation, colitis, diarrhea, rash, transplant or organ dysfunction',
      surgical: 'surgical: to characterize a suspected neoplasm, polyp, mass or discrete lesion' } },
    site: { type: 'choice', instructions: `Where is part ${part.letter} from?`, criteria: {
      gi: 'gastrointestinal tract from esophagus to rectum', skin: 'skin', breast: 'breast', prostate: 'prostate', other: 'any other organ or site' } },
    rule: { type: 'choice', instructions: `Which workload coding rule applies to part ${part.letter}?`, criteria: RULES },
    malignant: { type: 'boolean', instructions: `Does the final diagnosis for part ${part.letter} include invasive carcinoma or another malignancy?` },
    high_grade: { type: 'boolean', instructions: `Is part ${part.letter} high grade (high-grade dysplasia) or malignant?` },
    synoptic_required: { type: 'boolean', instructions: `Does part ${part.letter} require a full CAP synoptic report (definitive resection or excision of a malignancy)?` },
    synoptic_present: { type: 'boolean', instructions: `Does the report contain a synoptic or checklist section covering part ${part.letter}?` },
    lesions: { type: 'choice', instructions: `How many clinically distinct lesions were sampled in part ${part.letter}?`, criteria: { n_1: '1 lesion', n_2: '2 lesions', n_3: '3 lesions', n_4: '4 or more lesions' } },
    fragments: { type: 'choice', instructions: `How many tissue fragments or cores were received in part ${part.letter}, per the gross description?`, criteria: nums },
    blocks: { type: 'choice', instructions: `How many blocks or cassettes were submitted for part ${part.letter}?`, criteria: nums },
    blocks_check: { type: 'choice', instructions: `What is the highest cassette number listed for part ${part.letter} (for example ${part.letter}24 means 24)? If only a count is given, use it.`, criteria: nums }
  }, myRun).then(({ a, ms }) => {
    if (myRun !== running) return null;
    const result = codePart(part, a);
    const el = root.querySelector(`[data-part="${part.letter}"]`);
    rows(el.querySelector('.l4e-rows'), ms, result.rows);
    el.querySelector('.l4e-code').innerHTML = result.code;
    el.classList.toggle('is-flagged', result.flags > 0);
    return result;
  }));

  const stainCall = stains.length ? jev(state, Object.fromEntries(stains.map(s => [s.replace(/[^A-Za-z0-9]/g, '_'), {
    type: 'choice', instructions: `How was ${s} used in this report?`, criteria: {
      diagnostic: 'diagnostic immunohistochemistry or special stain requested after initial review (Rule 7, 1 L1)',
      therapeutic: 'therapeutic or predictive immunohistochemistry used for treatment planning, such as ER, PR, HER2 or mismatch repair (Rule 8, 1 L3)',
      ws_zn: 'Warthin-Starry or Ziehl-Neelsen stain (1 L3)', routine: 'routine stain, not coded', not_done: 'mentioned but not performed' } }])), myRun).then(({ a, ms }) => {
    if (myRun !== running) return 0;
    const value = { diagnostic: L.L1, therapeutic: L.L3, ws_zn: L.L3, routine: 0, not_done: 0 };
    const code = { diagnostic: 'L1', therapeutic: 'L3', ws_zn: 'L3', routine: '—', not_done: '—' };
    let total = 0;
    const r = stains.map(s => { const [k, p] = top(a[s.replace(/[^A-Za-z0-9]/g, '_')]); total += value[k]; return [s, `${k.replace('_', ' ')} · ${code[k]}`, p]; });
    const el = root.querySelector('[data-stains]');
    rows(el.querySelector('.l4e-rows'), ms, r);
    el.querySelector('.l4e-code').innerHTML = `Rules 7 and 8 · <b>+${total.toFixed(2)} L4E</b>`;
    return total;
  }) : Promise.resolve(0);

  try {
    const [, partResults, stainTotal] = await Promise.all([caseCall, Promise.all(partCalls), stainCall]);
    if (myRun !== running) return;
    const total = partResults.reduce((s, r) => s + (r ? r.value : 0), 0) + stainTotal;
    const flags = partResults.reduce((s, r) => s + (r ? r.flags : 0), 0);
    const ex = EXAMPLES[root.dataset.example];
    const check = ex ? `<span class="l4e-check ${Math.abs(ex.expected - total) < 0.01 ? 'ok' : 'off'}">workbook rules by hand: ${ex.expected} L4E ${Math.abs(ex.expected - total) < 0.01 ? '✓' : '≠'}</span>` : '';
    $('.l4e-total').innerHTML = `<span class="l4e-total-n">${total.toFixed(2)}</span><span class="l4e-total-u">L4E</span>
      <span class="l4e-total-note">${(total / PER_DAY * 100).toFixed(0)}% of an average pathologist day (${PER_DAY.toFixed(0)} L4E) · ${flags ? `<b>${flags} redundancy flag${flags > 1 ? 's' : ''}</b>` : 'all redundancy checks agree'}</span>${check}`;
  } catch (error) {
    if (myRun === running) $('.l4e-total').innerHTML = `<span class="l4e-total-note">Jev unavailable: ${error.message}</span>`;
  }
}

// Rule engine: the workbook's rules applied to Jev's answers.
function codePart(part, a) {
  const [proc, pProc] = top(a.procedure), [intent, pIntent] = top(a.intent), [site, pSite] = top(a.site), [direct, pDirect] = top(a.rule);
  const malignant = a.malignant.probability >= 0.5, highGrade = a.high_grade.probability >= 0.5;
  const synReq = a.synoptic_required.probability >= 0.5, synPresent = a.synoptic_present.probability >= 0.5;
  const lesions = numberOf(top(a.lesions)[0]) || 1;
  const fragments = numberOf(top(a.fragments)[0]) || 1;
  const b1 = numberOf(top(a.blocks)[0]), b2 = numberOf(top(a.blocks_check)[0]);
  const blocks = Math.max(b1 || 0, b2 || 0) || 1;

  let derived;
  if (proc === 'resection') derived = 'r4_resection';
  else if (proc === 'post_therapy_no_residual') derived = 'r9_post_therapy';
  else if (proc === 'curetting') derived = 'r3_curettings';
  else if (proc === 'core') derived = intent === 'medical' ? 'r2_medical_core' : (site === 'breast' || site === 'prostate') ? 'r2_breast_prostate' : 'r2_core';
  else if (site === 'gi') derived = intent === 'medical' ? 'r1_gi_medical' : 'r1_gi_surgical';
  else if (site === 'skin' && intent === 'surgical' && !malignant) derived = 'r1_skin_simple';
  else derived = intent === 'medical' ? 'r1_medical_biopsy' : 'r1_surgical_biopsy';

  const value = rule => {
    switch (rule) {
      case 'r1_medical_biopsy': return [Math.ceil(fragments / 5) * L.L4, `${Math.ceil(fragments / 5)} L4 (${fragments} fragments)`];
      case 'r1_surgical_biopsy': return [lesions * L.L4, `${lesions} L4 (${lesions} lesion${lesions > 1 ? 's' : ''})`];
      case 'r1_gi_medical': return [Math.ceil(fragments / 3) * L.L3, `${Math.ceil(fragments / 3)} L3 (${fragments} fragments)`];
      case 'r1_gi_surgical': return highGrade || malignant ? [lesions * L.L4, `${lesions} L4 (high grade or malignant)`] : [lesions * L.L3, `${lesions} L3 (${lesions} lesion${lesions > 1 ? 's' : ''})`];
      case 'r1_skin_simple': return [lesions * L.L3, `${lesions} L3`];
      case 'r2_core': return [Math.ceil(fragments / 5) * L.L4, `${Math.ceil(fragments / 5)} L4 (${fragments} cores)`];
      case 'r2_breast_prostate': return [L.L4 + (fragments - 1) * L.L2, `1 L4 + ${fragments - 1} L2`];
      case 'r2_medical_core': return [L.L5, '1 L5'];
      case 'r3_curettings': return [L.L4 + Math.max(0, blocks - 3) * L.L2, `1 L4 + ${Math.max(0, blocks - 3)} L2`];
      case 'r4_resection': { const v = blocks * L.L2, min = intent === 'medical' ? L.L5 : L.L3; return [Math.max(v, min), `${blocks} L2 (${blocks} blocks)${v < min ? `, minimum ${intent === 'medical' ? 'L5' : 'L3'}` : ''}`]; }
      case 'r9_post_therapy': return [L.L6 + Math.max(0, blocks - 40) * L.L2, `1 L6 + ${Math.max(0, blocks - 40)} L2`];
      default: return [0, '—'];
    }
  };
  const [vDerived] = value(derived), [vDirect] = value(direct);
  // Workbook: if more than one rule applies, use the rule with the higher L4E value.
  const rule = vDirect > vDerived ? direct : derived;
  let [v, how] = value(rule);
  const synoptic = synReq || synPresent;
  if (synoptic) { v = Math.max(v + 3 * L.L4, L.L5); how += ' + 3 L4 synoptic (Rule 5)'; }

  const agreeRule = derived === direct, agreeSyn = synReq === synPresent, agreeMal = malignant === highGrade || (!malignant && highGrade), agreeBlocks = !b1 || !b2 || b1 === b2;
  const flags = [agreeRule, agreeSyn, agreeMal, agreeBlocks].filter(x => !x).length;
  const yn = x => (x >= 0.5 ? 'yes' : 'no'), conf = x => Math.max(x, 1 - x);
  return {
    value: v, flags,
    rows: [
      ['procedure', proc.replace(/_/g, ' '), pProc], ['intent', intent, pIntent], ['site', site === 'gi' ? 'GI tract' : site, pSite],
      ['rule, derived', SHORT[derived], null],
      ['rule, asked', SHORT[direct], pDirect, agreeRule ? 'agree' : 'differ', agreeRule],
      ['malignant', yn(a.malignant.probability), conf(a.malignant.probability)],
      ['high grade', yn(a.high_grade.probability), conf(a.high_grade.probability), agreeMal ? 'agree' : 'differ', agreeMal],
      ['synoptic needed', yn(a.synoptic_required.probability), conf(a.synoptic_required.probability)],
      ['synoptic present', yn(a.synoptic_present.probability), conf(a.synoptic_present.probability), agreeSyn ? 'agree' : 'differ', agreeSyn],
      ['lesions, pieces', `${lesions} · ${fragments}`, null],
      ['blocks, 2 ways', `${b1 ?? '—'} · ${b2 ?? '—'}`, null, agreeBlocks ? 'agree' : 'differ', agreeBlocks]
    ],
    code: `${RULES[rule].split(':')[0]}${synoptic ? ' + Rule 5' : ''} · ${how} = <b>${v.toFixed(2)} L4E</b>`
  };
}

function rows(el, ms, list) {
  el.innerHTML = list.map(([q, ans, p, check, ok]) => `<p class="l4e-row"><span class="q">${q}</span><span class="a">${ans}</span><span class="p">${p == null ? '' : pct(p)}</span><span class="c ${ok === undefined ? '' : ok ? 'ok' : 'off'}">${check || ''}</span></p>`).join('')
    + `<p class="l4e-ms">${Math.round(ms)} ms · ${list.length} answers</p>`;
}

function renderStats() {
  const med = [...stats.ms].sort((a, b) => a - b)[Math.floor(stats.ms.length / 2)];
  $('.l4e-stats').textContent = `${stats.calls} Jev calls · ${stats.questions} questions · ${stats.ms.length ? `median ${Math.round(med)} ms` : 'running'} · $${stats.cost.toFixed(4)}`;
}
