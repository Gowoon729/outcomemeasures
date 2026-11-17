// APPI 평가 차트 (치료사 전용). 이 기기의 브라우저에만 저장되고, 구글 시트로는 올라가지 않습니다.
// 양식 출처: APPI 수정 평가서 양식 (appi.kr) 1~2쪽. 가설별 지지·배제 소견은 치료사 요청으로 추가한 칸.
const CH = (() => {
  const SRC = '출처: APPI 수정 평가서 양식 (appi.kr)';
  const IMG_NOTE = '인체 도식: APPI 양식';
  const IMG = 'img/appi_body.png';
  const esc = s => OM.esc(String(s ?? ''));
  const nowDate = () => OM.nowStr().slice(0, 10);

  const ox = (k, l) => ({ k, l, t: 'ox' });
  const area = (k, l, h) => ({ k, l, t: 'area', h });
  const text = (k, l) => ({ k, l, t: 'text' });
  // 화면·인쇄·비교·CSV가 모두 이 목록 하나를 씁니다.
  const SECS = [
    { t: '1쪽 · 기본 정보', f: [
      { k: 'date', l: '일시', t: 'date' }, text('birth', '생년월일(나이)'), text('job', '직업'),
      { k: 'marks', l: '통증 부위 (인체 도식을 터치해서 표시)', t: 'body' },
      { k: 'feel', l: '통증 느낌', t: 'multi', o: ['찌르는 통증', '쑤시는 통증', '둔한 통증', '뻣뻣한 느낌'] },
      text('injDate', '다친 날짜') ] },
    { t: '추가 특수 질문', f: [ ox('lock', '잠기는 증상'), ox('give', '힘빠짐 증상'), ox('click', '딸깍거리는 소리'), ox('stab', '찌르는 느낌'), ox('numb', '먹먹함') ] },
    { t: '현재 호소하는 문제 / 손상 기전', f: [
      area('cc', '현재 호소하는 문제 / 손상 기전'),
      area('hosp', '병원을 다녀온 적이 있는지? 있다면 약 처방 및 어떤 치료 받았는지?'),
      area('effort', '낫기 위해 어떤 노력을 했는지?') ] },
    { t: '행동에 따른 증상', f: [
      area('worse', '통증이 심해지는 동작/패턴'), area('better', '통증이 줄어드는 동작/패턴'),
      ox('p24walk', '24시간 통증 패턴 – 걸을 때'), ox('p24day', '24시간 통증 패턴 – 낮'), ox('p24eve', '24시간 통증 패턴 – 오후, 저녁'),
      ox('p24sleep', '24시간 통증 패턴 – 잠잘 때'), ox('p24morn', '24시간 통증 패턴 – 아침') ] },
    { t: 'VAS · 통증 경과', f: [
      { k: 'vasMin', l: 'VAS 제일 안 아플 때', t: 'text', num: 1 }, { k: 'vasMax', l: 'VAS 제일 아플 때', t: 'text', num: 1 }, { k: 'vasNow', l: 'VAS 현재', t: 'text', num: 1 },
      { k: 'cont', l: '통증이 지속적 / 간헐적', t: 'choice', o: ['지속적', '간헐적'] },
      { k: 'trend', l: '통증이 나아지고 있는지 / 같은지 / 심해지는지', t: 'choice', o: ['나아지고 있음', '같음', '심해지고 있음'] },
      { k: 'irr1', l: '한번 통증이 나타나면 지속되는 정도(irritability)', t: 'choice', o: ['mild(<1min)', 'moderate(<5min)', 'severe(<10min)'] } ] },
    { t: '과거력 · 가족력 · 약 · 사회적 요인', f: [
      area('hx', '과거력 혹은 과거에 질병으로 치료받은 경험 있는지?'), area('fam', '가족력 혹은 앓고 있는 질병이 있는지?'),
      area('meds', '현재 복용하는 약이 있는지?'), area('social', '사회적 요인(직업, 취미)') ] },
    { t: '진단에 앞선 3가지 가설 (Hypothesis)', f: [
      ...[1, 2, 3].flatMap(n => [
        { k: `h${n}n`, l: '가설', t: 'text', g: `${n}순위 가설` },
        area(`h${n}p`, '지지 소견 (Positive)'), area(`h${n}g`, '배제 소견 (Negative)') ]) ] },
    { t: '2쪽 · 관찰 및 기능적 검사 Observation & Functional test', f: [
      area('obs', '관찰 및 기능적 검사'),
      { k: 'arom', l: 'AROM', t: 'cross' }, { k: 'prom', l: 'PROM', t: 'cross' },
      area('palp', '촉진 Palpation – pain, swelling, end-feel, stiffness, tightness'),
      area('res', '저항 검사 Resisted tests'),
      area('other', '진단학적 검사 Other tests – diagnostic tests, neurodynamic tests') ] },
    { t: '신경학적 검사 Neurological tests', f: [ area('neuS', '① strength test'), area('neuN', '② sensation test'), area('neuR', '③ reflex test') ] },
    { t: '분석 Analysis', f: [ area('key', '① 중요하게 발견된 부분 key findings'), area('goals', '② 단기, 장기 목표 short/long term goals') ] },
    { t: '치료 및 계획 Treatment – test and retest', f: [ area('plan', '치료 및 계획') ] },
    { t: '분류 · 진단', f: [
      text('site', 'Site'),
      { k: 'stage', l: 'Stage', t: 'choice', o: ['acute', 'subacute', 'chronic'] },
      { k: 'sev', l: 'Severity', t: 'choice', o: ['mild', 'moderate', 'severe'] },
      { k: 'stab', l: 'Stability', t: 'choice', o: ['changing', 'same', 'worsening'] },
      { k: 'nat', l: 'Nature', t: 'choice', o: ['chemical', 'mechanical'] },
      { k: 'irr2', l: 'Irritability', t: 'choice', o: ['mild', 'moderate', 'severe'] }, text('irr2how', 'Irritability – How long?'),
      text('prog', 'Progression / Rate of improvement'),
      { k: 'reg', l: 'Regular or Irregular pattern of symptom', t: 'choice', o: ['Regular', 'Irregular'] },
      area('dx', 'Diagnosis/hypothesis') ] },
  ];
  const FIELDS = SECS.flatMap(s => s.f);
  const CROSS = [['u', '↑'], ['d', '↓'], ['l', '←'], ['r', '→']];

  let cur = null, view = 'list', sel = new Set(), timer = null;
  const charts = () => (S.charts = S.charts || []);
  const byId = id => charts().find(c => c.id === id);
  const root = () => document.getElementById('chRoot');
  const patient = () => S.patients[curP];
  const mine = () => charts().filter(c => c.p === curP).sort((a, b) => (b.d.date || '').localeCompare(a.d.date || '') || (b.c || '').localeCompare(a.c || ''));

  function valText(f, d) {
    const v = d[f.k];
    if (f.t === 'multi') return (v || []).join(', ');
    if (f.t === 'body') return (v || []).length ? `${v.length}곳 표시` : '';
    if (f.t === 'cross') return v ? CROSS.filter(([x]) => v[x]).map(([x, a]) => `${a} ${v[x]}`).join('   ') : '';
    return v || '';
  }
  function summary(c) { return c.d.dx || c.d.h1n || c.d.cc || ''; }

  function open(code) { curP = code; cur = null; view = 'list'; sel = new Set(); go('chart'); }
  function render() {
    const p = patient(); if (!p) { go('patients'); return; }
    if (view === 'edit' && byId(cur)) renderEdit(); else if (view === 'cmp' && sel.size === 2) renderCmp(); else renderList();
  }

  // ---------- 목록 ----------
  function renderList() {
    view = 'list'; const p = patient(), list = mine();
    root().innerHTML = `<div class="card">
        <button class="link-btn" onclick="go('patient')">← ${esc(p.name)}</button>
        <h2 style="margin-top:6px">📋 APPI 평가 차트</h2>
        <div class="sub">${esc(SRC)}<br>이 기기에만 저장됩니다 (구글 시트로 올라가지 않아요). 엑셀로는 ⚙️ 설정에서 내보낼 수 있어요.</div>
        <button class="btn btn-main" onclick="CH.add()">＋ 새 차트 작성</button>
      </div>
      <div class="card">
        <h2>저장된 차트 ${list.length}개</h2>
        ${list.length ? `<div class="sub">두 개를 체크하면 나란히 비교할 수 있어요.</div>` : '<div class="sub" style="margin-top:6px">아직 차트가 없습니다.</div>'}
        ${list.map(c => `<div class="list-item">
          <input type="checkbox" ${sel.has(c.id) ? 'checked' : ''} onchange="CH.toggleSel('${c.id}',this.checked)" style="width:20px;height:20px;flex:none">
          <div class="grow" onclick="CH.edit('${c.id}')"><b>${esc(c.d.date || '날짜 없음')}</b> <span class="sub">· ${esc(epName(p, c.ep))}</span>
            <div class="sub">${esc(summary(c).slice(0, 40)) || '(내용 없음)'}</div></div>
          <button class="chip" onclick="CH.print('${c.id}')">🖨</button>
        </div>`).join('')}
        ${sel.size === 2 ? `<button class="btn btn-main" onclick="CH.compare()">↔ 선택한 2개 비교하기</button>` : ''}
      </div>`;
  }
  function toggleSel(id, on) {
    on ? sel.add(id) : sel.delete(id);
    if (sel.size > 2) { sel = new Set([...sel].slice(-2)); }
    renderList();
  }
  function add() {
    const p = patient(), last = mine()[0];
    const c = { id: uid('c'), p: curP, ep: p.ep, c: OM.nowStr(), u: OM.nowStr(), d: { date: nowDate(), birth: last ? last.d.birth || '' : '', job: last ? last.d.job || '' : '' } };
    charts().push(c); save(); edit(c.id);
  }
  function edit(id) { cur = id; view = 'edit'; renderEdit(); window.scrollTo(0, 0); }

  // ---------- 입력 화면 ----------
  function chipsHtml(f, d) {
    const v = d[f.k];
    return `<div class="chips ch-wrap">${f.o.map(o => `<button type="button" class="chip${f.t === 'multi' ? ((v || []).includes(o) ? ' on' : '') : (v === o ? ' on' : '')}" data-k="${f.k}" data-v="${esc(o)}" data-t="${f.t}" onclick="CH.pick(this)">${esc(o)}</button>`).join('')}</div>`;
  }
  function fieldHtml(f, d) {
    const head = f.g ? `<h3>${esc(f.g)}</h3>` : '';
    if (f.t === 'ox') return `<div class="ch-oxrow"><span>${esc(f.l)}</span><div class="chips ch-wrap" style="margin:0">${['O', 'X'].map(o => `<button type="button" class="chip${d[f.k] === o ? ' on' : ''}" data-k="${f.k}" data-v="${o}" data-t="ox" onclick="CH.pick(this)">${o}</button>`).join('')}</div></div>`;
    if (f.t === 'body') return `<label class="field">${esc(f.l)}</label>
      <div class="ch-body" id="chBody" onclick="CH.mark(event)"><img src="${IMG}" alt="인체 도식">${(d.marks || []).map(m => `<div class="ch-dot" style="left:${m.x}%;top:${m.y}%"></div>`).join('')}</div>
      <div class="row" style="margin-top:6px;align-items:center"><span class="sub" id="chMarkCount" style="flex:1">표시한 곳 ${(d.marks || []).length}곳 · ${esc(IMG_NOTE)}</span>
        <button class="btn btn-line btn-sm" onclick="CH.unmark(1)">↩ 하나 지우기</button><button class="btn btn-line btn-sm" onclick="CH.unmark(0)">모두 지우기</button></div>`;
    if (f.t === 'cross') {
      const v = d[f.k] || {}, inp = (x, a) => `<input type="text" placeholder="${a}" value="${esc(v[x] || '')}" oninput="CH.setX('${f.k}','${x}',this.value)">`;
      return `<label class="field">${esc(f.l)}</label><div class="ch-cross"><span></span>${inp('u', '↑')}<span></span>${inp('l', '←')}<div class="circ">${esc(f.l)}</div>${inp('r', '→')}<span></span>${inp('d', '↓')}<span></span></div>`;
    }
    if (f.t === 'choice' || f.t === 'multi') return `${head}<label class="field">${esc(f.l)}</label>${chipsHtml(f, d)}`;
    if (f.t === 'date') return `<label class="field">${esc(f.l)}</label><input type="date" value="${esc(d[f.k] || '')}" oninput="CH.set('${f.k}',this.value)">`;
    if (f.t === 'area') return `${head}<label class="field">${esc(f.l)}</label><textarea style="min-height:84px" oninput="CH.set('${f.k}',this.value)">${esc(d[f.k] || '')}</textarea>`;
    return `${head}<label class="field">${esc(f.l)}</label><input type="text" ${f.num ? 'inputmode="decimal"' : ''} value="${esc(d[f.k] || '')}" oninput="CH.set('${f.k}',this.value)">`;
  }
  function renderEdit() {
    const c = byId(cur), p = patient(), d = c.d;
    root().innerHTML = `<div class="card">
        <button class="link-btn" onclick="CH.back()">← 차트 목록</button>
        <h2 style="margin-top:6px">📋 APPI 평가 차트 · ${esc(p.name)}</h2>
        <div class="sub">${esc(epName(p, c.ep))}<br>${esc(SRC)}</div>
        <div class="sub" id="chSaved" style="margin-top:6px">✅ 입력하면 자동으로 저장돼요.</div>
        <div class="row" style="margin-top:8px"><button class="btn btn-line" onclick="CH.print('${c.id}')">🖨 인쇄 · PDF</button><button class="btn btn-line" onclick="CH.del('${c.id}')">🗑 삭제</button></div>
      </div>
      ${SECS.map(s => `<div class="card"><h2>${esc(s.t)}</h2>${s.f.map(f => fieldHtml(f, d)).join('')}</div>`).join('')}
      <button class="btn btn-main" onclick="CH.back()">✔ 완료 (목록으로)</button>`;
  }
  function touched() {
    const c = byId(cur); if (!c) return; c.u = OM.nowStr();
    clearTimeout(timer); const el = document.getElementById('chSaved'); if (el) el.innerText = '저장 중…';
    timer = setTimeout(() => { save(); const e = document.getElementById('chSaved'); if (e) e.innerText = '✅ 자동 저장됨'; }, 500);
  }
  function set(k, v) { const c = byId(cur); if (!c) return; c.d[k] = v; touched(); }
  function setX(k, x, v) { const c = byId(cur); if (!c) return; c.d[k] = c.d[k] || {}; c.d[k][x] = v; touched(); }
  function pick(btn) {
    const c = byId(cur); if (!c) return; const k = btn.dataset.k, v = btn.dataset.v, t = btn.dataset.t;
    if (t === 'multi') { const a = c.d[k] || []; c.d[k] = a.includes(v) ? a.filter(x => x !== v) : [...a, v]; btn.classList.toggle('on'); }
    else { const on = c.d[k] === v; c.d[k] = on ? '' : v; btn.parentNode.querySelectorAll('.chip').forEach(b => b.classList.remove('on')); if (!on) btn.classList.add('on'); }
    touched();
  }
  function mark(ev) {
    const c = byId(cur); if (!c) return; const r = document.getElementById('chBody').getBoundingClientRect();
    const x = Math.round(((ev.clientX - r.left) / r.width) * 1000) / 10, y = Math.round(((ev.clientY - r.top) / r.height) * 1000) / 10;
    c.d.marks = c.d.marks || []; c.d.marks.push({ x, y }); drawMarks(); touched();
  }
  function unmark(one) { const c = byId(cur); if (!c) return; c.d.marks = one ? (c.d.marks || []).slice(0, -1) : []; drawMarks(); touched(); }
  function drawMarks() {
    const c = byId(cur), box = document.getElementById('chBody'); box.querySelectorAll('.ch-dot').forEach(e => e.remove());
    (c.d.marks || []).forEach(m => { const e = document.createElement('div'); e.className = 'ch-dot'; e.style.left = m.x + '%'; e.style.top = m.y + '%'; box.appendChild(e); });
    document.getElementById('chMarkCount').innerText = `표시한 곳 ${(c.d.marks || []).length}곳 · ${IMG_NOTE}`;
  }
  function back() { clearTimeout(timer); save(); cur = null; view = 'list'; renderList(); window.scrollTo(0, 0); }
  async function del(id) {
    if (!await OM.confirmBox('이 차트를 삭제할까요?\n되돌릴 수 없습니다.')) return;
    S.charts = charts().filter(c => c.id !== id); sel.delete(id); save(); cur = null; view = 'list'; renderList();
  }

  // ---------- 비교 ----------
  function bodyDots(d) { return `<div class="ch-body" style="pointer-events:none"><img src="${IMG}" alt="인체 도식">${(d.marks || []).map(m => `<div class="ch-dot" style="left:${m.x}%;top:${m.y}%"></div>`).join('')}</div>`; }
  function compare() { view = 'cmp'; renderCmp(); window.scrollTo(0, 0); }
  function renderCmp() {
    const [a, b] = [...sel].map(byId).sort((x, y) => (x.d.date || '').localeCompare(y.d.date || '')), p = patient();
    const rows = SECS.map(s => {
      const rs = s.f.filter(f => f.t !== 'body').map(f => [f, valText(f, a.d), valText(f, b.d)]).filter(([, x, y]) => x || y);
      return rs.length ? `<tr><th colspan="3" style="text-align:left;background:var(--bg)">${esc(s.t)}</th></tr>` + rs.map(([f, x, y]) => `<tr><td><b>${esc(f.g ? f.g + ' – ' : '')}${esc(f.l)}</b></td><td class="${x !== y ? 'diff' : ''}">${esc(x)}</td><td class="${x !== y ? 'diff' : ''}">${esc(y)}</td></tr>`).join('') : '';
    }).join('');
    root().innerHTML = `<div class="card">
        <button class="link-btn" onclick="CH.back()">← 차트 목록</button>
        <h2 style="margin-top:6px">↔ 차트 비교 · ${esc(p.name)}</h2>
        <div class="sub">왼쪽이 이전, 오른쪽이 이후예요. 노란 칸은 서로 다른 항목입니다. ${esc(SRC)}</div>
        <div class="grid2" style="margin-top:10px"><div><b>${esc(a.d.date || '')}</b>${bodyDots(a.d)}</div><div><b>${esc(b.d.date || '')}</b>${bodyDots(b.d)}</div></div>
        <div class="sub" style="margin-top:4px">${esc(IMG_NOTE)}</div>
      </div>
      <div class="card"><table class="hist ch-cmp"><tr><th style="width:34%">항목</th><th>${esc(a.d.date || '이전')}</th><th>${esc(b.d.date || '이후')}</th></tr>${rows || '<tr><td colspan="3">입력된 내용이 없습니다.</td></tr>'}</table></div>`;
  }

  // ---------- 인쇄 ----------
  function printHtml(c) {
    const p = S.patients[c.p] || {}, d = c.d, img = new URL(IMG, location.href).href;
    const dots = (d.marks || []).map(m => `<i style="left:${m.x}%;top:${m.y}%"></i>`).join('');
    const sec = s => {
      const body = s.f.filter(f => f.t !== 'body' && f.k !== 'date' && f.k !== 'birth' && f.k !== 'job').map(f => {
        const long = f.t === 'area' || f.t === 'cross';
        return `<tr><th>${esc(f.g ? f.g + ' – ' : '')}${esc(f.l)}</th><td class="${long ? 'long' : ''}">${esc(valText(f, d))}</td></tr>`;
      }).join('');
      return body ? `<h2>${esc(s.t)}</h2><table>${body}</table>` : '';
    };
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>APPI 평가 차트 ${esc(p.name || '')} ${esc(d.date || '')}</title><style>
      @page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:-apple-system,"Malgun Gothic","Noto Sans KR",sans-serif;font-size:11px;color:#111}
      h1{font-size:16px;margin:0 0 4px}h2{font-size:12px;margin:12px 0 4px;padding:3px 6px;background:#eee;border:1px solid #999}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:4px 6px;vertical-align:top;text-align:left}th{width:34%;font-weight:600;background:#fafafa}
      td.long{min-height:36px;white-space:pre-wrap;height:36px}td{white-space:pre-wrap}.src{color:#555;font-size:10px;margin-top:2px}
      .fig{position:relative;width:260px;border:1px solid #999;margin:6px 0}.fig img{width:100%;display:block}.fig i{position:absolute;width:10px;height:10px;border-radius:50%;background:#d00;border:1px solid #fff;transform:translate(-50%,-50%)}
      h2,table{page-break-inside:avoid}</style></head><body>
      <h1>APPI 평가 차트</h1><div class="src">${esc(SRC)}</div>
      <table style="margin-top:6px"><tr><th>이름</th><td>${esc(p.name || '')}</td><th>일시</th><td>${esc(d.date || '')}</td></tr><tr><th>생년월일(나이)</th><td>${esc(d.birth || '')}</td><th>직업</th><td>${esc(d.job || '')}</td></tr></table>
      <h2>통증 부위</h2><div class="fig"><img src="${img}">${dots}</div><div class="src">${esc(IMG_NOTE)}</div>
      ${SECS.map(sec).join('')}
      <div class="src" style="margin-top:12px">${esc(SRC)} · ${esc(IMG_NOTE)}</div></body></html>`;
  }
  function print(id) {
    const c = byId(id); if (!c) return;
    let f = document.getElementById('chPrintFrame'); if (f) f.remove();
    f = document.createElement('iframe'); f.id = 'chPrintFrame'; f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    const doc = f.contentWindow.document; doc.open(); doc.write(printHtml(c)); doc.close();
    const im = doc.querySelector('img'), run = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { OM.alertBox('인쇄 창을 열지 못했어요. 브라우저의 공유/인쇄 메뉴를 써 주세요.'); } };
    if (im && !im.complete) { im.onload = run; im.onerror = run; } else setTimeout(run, 150);
  }

  // ---------- 엑셀(CSV) ----------
  function exportCSV(names) {
    if (!charts().length) { OM.alertBox('내보낼 APPI 차트가 없습니다.'); return; }
    const cell = v => { const t = String(v ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    const head = ['회원코드', ...(names ? ['이름'] : []), '치료회차', ...FIELDS.map(f => (f.g ? f.g + ' – ' : '') + f.l)];
    const rows = charts().slice().sort((a, b) => (a.p + (a.d.date || '')).localeCompare(b.p + (b.d.date || ''))).map(c => {
      const p = S.patients[c.p] || {};
      return [c.p, ...(names ? [p.name] : []), c.ep, ...FIELDS.map(f => f.t === 'body' ? ((c.d.marks || []).length ? (c.d.marks || []).length + '곳' : '') : valText(f, c.d))].map(cell).join(',');
    });
    download(`APPI_평가차트_${nowDate()}.csv`, '﻿' + [head.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
  }

  return { open, render, add, edit, set, setX, pick, mark, unmark, back, del, toggleSel, compare, print, exportCSV };
})();
