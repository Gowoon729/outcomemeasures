// 치료사 앱(index.html)과 환자 설문(survey.html)이 함께 쓰는 기능
const OM = (() => {
  const qCache = {};
  let catalog = null;

  async function loadCatalog() {
    if (catalog) return catalog;
    const r = await fetch('catalog.json', { cache: 'no-cache' });
    catalog = await r.json();
    return catalog;
  }
  async function loadQ(id) {
    if (qCache[id]) return qCache[id];
    const r = await fetch('q/' + id + '.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('설문지를 찾을 수 없습니다: ' + id);
    qCache[id] = await r.json();
    return qCache[id];
  }
  function allItems(q) { return q.sections.flatMap(s => s.items); }
  function scoredItems(q) { return allItems(q).filter(it => it.scored !== false); }
  function itemMax(it) {
    if (it.options) return Math.max(...it.options.map(o => o.score ?? 0));
    return it.scale.max;
  }
  const r1 = n => Math.round(n * 10) / 10;
  // 문항 하나의 점수 (숫자척도 역채점 지원). 답이 없으면 null
  function itemScore(it, val) {
    if (val === null || val === undefined) return null;
    if (it.scale && it.reverse) return it.scale.min + it.scale.max - val;
    return val;
  }

  // answers: { itemId: value }
  // scoring.method: sum | mean | percent | weighted | subsum(영역 점수의 합) | subscales(영역 점수만)
  // subscale.calc: sum(기본) | mean, subscale.multiplier / scoring.multiplier: 곱할 값
  function score(q, answers) {
    const sc = q.scoring;
    const extras = {};
    allItems(q).filter(it => it.scored === false).forEach(it => { if (answers[it.id] !== undefined) extras[it.id] = answers[it.id]; });
    if (!sc) return { score: null, extras, subs: [] };
    const all = scoredItems(q);
    const byId = Object.fromEntries(all.map(it => [it.id, it]));
    const items = sc.items ? sc.items.map(id => byId[id]).filter(Boolean) : all;   // 총점에 쓰는 문항
    const val = it => itemScore(it, answers[it.id]);
    const answered = items.filter(it => val(it) !== null);
    const missing = items.length - answered.length;
    const raw = answered.reduce((a, it) => a + val(it), 0);
    const subs = (sc.subscales || []).map(sub => {
      const subItems = sub.items.map(id => byId[id]).filter(Boolean);
      const its = subItems.filter(it => val(it) !== null);
      if (sub.requireAll && its.length < subItems.length) return { name: sub.name, max: sub.max, score: null, raw: null, answered: its.length };
      const sum = its.reduce((a, it) => a + val(it), 0);
      let v = sub.calc === 'mean' ? (its.length ? sum / its.length : null) : sum;
      if (v !== null && sub.offset) v = v + sub.offset;
      if (v !== null && sub.multiplier) v = v * sub.multiplier;
      return { name: sub.name, max: sub.max, score: v === null ? null : r1(v), raw: v, answered: its.length };
    });
    let s = null;
    if (sc.maxMissing !== undefined && missing > sc.maxMissing) s = null;
    else if (sc.method === 'sum') s = raw;
    else if (sc.method === 'mean') s = answered.length ? r1((raw / answered.length + (sc.offset || 0)) * (sc.multiplier || 1)) : null;
    else if (sc.method === 'percent') {
      const maxAns = answered.reduce((a, it) => a + itemMax(it), 0);
      s = maxAns ? r1(raw / maxAns * 100) : null;
    } else if (sc.method === 'weighted') {
      const w = sc.weights || {};
      s = r1(answered.reduce((a, it) => a + (w[it.id] ?? 1) * val(it), 0) / (sc.divisor || 1));
    } else if (sc.method === 'subsum') {
      s = subs.some(x => x.raw === null) ? null : r1(subs.reduce((a, x) => a + x.raw, 0));
    }
    // 분류 규칙 (예: STarT Back 위험군)
    let category = '';
    if (sc.classify && s !== null) {
      const get = k => k === 'total' ? s : (subs.find(x => x.name === k) || {}).score;
      const ok = ([k, op, v]) => { const x = get(k); if (x === null || x === undefined) return false; return op === '<=' ? x <= v : op === '>=' ? x >= v : op === '<' ? x < v : op === '>' ? x > v : x === v; };
      const hit = sc.classify.find(c => c.when.every(ok)); if (hit) category = hit.label;
    }
    return { score: s, raw, answeredCount: answered.length, missing, subs, extras, category };
  }
  // 비교·해석에 쓰는 지표 목록 (총점 1개, 또는 영역별 여러 개)
  function measures(q) {
    const sc = q.scoring; if (!sc) return [];
    if (sc.method === 'subscales') return sc.subscales.map(sb => ({ key: q.id + '#' + sb.name, name: sb.name, min: sb.min ?? 0, max: sb.max, unit: sb.unit || sc.unit || '점', hb: sc.higherIsBetter, get: r => (score(q, r.v || {}).subs.find(x => x.name === sb.name) || {}).score ?? null }));
    const main = { key: q.id, name: q.short || q.name, min: sc.min, max: sc.max, unit: sc.unit || '점', hb: sc.higherIsBetter, get: r => r.s, main: true };
    const extra = (sc.subscales || []).filter(sb => sb.measure).map(sb => ({ key: q.id + '#' + sb.name, name: sb.name, min: sb.min ?? 0, max: sb.max, unit: sb.unit || sc.unit || '점', hb: sb.higherIsBetter ?? sc.higherIsBetter, get: r => (score(q, r.v || {}).subs.find(x => x.name === sb.name) || {}).score ?? null }));
    return [main, ...extra];
  }
  function fmtM(m, v) { if (v === null || v === undefined) return '-'; return m.unit === '%' ? v + '%' : v + (m.max !== undefined ? ' / ' + m.max : ''); }
  function fmt(q, s) {
    if (s === null || s === undefined) return '계산 안 함';
    const sc = q.scoring || {};
    if (sc.unit === '%') return s + '%';
    return s + (sc.max !== undefined ? ' / ' + sc.max : '') ;
  }

  // ----- 결과 코드 (UTF-8 JSON → base64url) -----
  function b64e(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    const bin = atob(s); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function encodeResult(obj) { return 'OMR1.' + b64e(JSON.stringify(obj)); }
  function findCodes(text) { return (String(text).match(/OMR1\.[A-Za-z0-9_-]+/g) || []); }
  function decodeResult(code) { return JSON.parse(b64d(code.slice(5))); }

  function nowStr() { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; }
  function esc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function baseUrl() { return location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, ''); }
  function isKakao() { return /KAKAOTALK/i.test(navigator.userAgent); }

  // ----- 대화상자 -----
  function dialog(msg, opts = {}) {
    return new Promise(res => {
      let m = document.getElementById('omModal');
      if (!m) {
        m = document.createElement('div'); m.id = 'omModal'; m.className = 'modal';
        m.innerHTML = '<div class="modal-box"><div id="omModalMsg"></div><div id="omModalExtra"></div><div class="modal-btns"><button id="omModalNo" class="mb-no">취소</button><button id="omModalOk" class="mb-ok">확인</button></div></div>';
        document.body.appendChild(m);
      }
      document.getElementById('omModalMsg').innerText = msg;
      document.getElementById('omModalExtra').innerHTML = opts.html || '';
      const ok = document.getElementById('omModalOk'), no = document.getElementById('omModalNo');
      ok.innerText = opts.okText || '확인'; no.style.display = opts.cancel ? '' : 'none';
      const done = v => { m.classList.remove('show'); ok.onclick = no.onclick = null; res(v); };
      ok.onclick = () => done(true); no.onclick = () => done(false);
      m.classList.add('show');
    });
  }
  const alertBox = (msg, html) => dialog(msg, { html });
  const confirmBox = msg => dialog(msg, { cancel: true });

  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); await alertBox(okMsg || '복사했습니다.'); }
    catch (e) {
      await alertBox('아래 내용을 길게 눌러 복사해 주세요.', `<textarea readonly class="copybox">${esc(text)}</textarea>`);
    }
  }
  async function shareText(text, title) {
    if (navigator.share) {
      try { await navigator.share({ text, title }); return true; }
      catch (e) { if (e && e.name === 'AbortError') return false; }
    }
    await copyText(text, '복사했습니다. 카카오톡이나 문자에 붙여넣어 보내 주세요.');
    return true;
  }

  async function renderCredit(el, full) {
    try {
      const cat = await loadCatalog(); const cr = cat.credit; if (!cr) return;
      el.innerHTML = full ? cr.lines.map(esc).join('<br>') : esc(cr.short);
    } catch (e) {}
  }
  function qSourceHtml(q) {
    return `<div class="qsrc">출처: ${esc(q.source || '')}${(q.refs || []).length ? '<br>원저: ' + q.refs.map(esc).join('<br>') : ''}</div>`;
  }
  return { measures, fmtM, itemScore, renderCredit, qSourceHtml, loadCatalog, loadQ, allItems, scoredItems, itemMax, score, fmt, encodeResult, decodeResult, findCodes, nowStr, esc, baseUrl, isKakao, dialog, alertBox, confirmBox, copyText, shareText };
})();
