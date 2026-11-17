// APPI 평가 차트 (치료사 전용). 이 기기의 브라우저에만 저장되고, 구글 시트로는 올라가지 않습니다.
// 양식 출처: APPI 수정 평가서 양식 (appi.kr) 1~2쪽. 가설별 지지·배제 소견은 치료사 요청으로 추가한 칸.
const CH = (() => {
  const SRC = '출처: APPI 수정 평가서 양식 (appi.kr)';
  const IMG_NOTE = '인체 도식: APPI 양식';
  const IMG = 'data:image/png;base64,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'; // 인체 도식(APPI 양식)을 코드에 직접 넣어 별도 파일 없이 표시
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
    const p = S.patients[c.p] || {}, d = c.d, img = IMG;
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
