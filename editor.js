/* 아웃컴 메저 – 3단계: 설문지 추가 화면 (치료사 앱 전용)
 * - 직접 만들기 / AI 변환 요청문 복사 → 답 붙여넣어 가져오기
 * - 점수 테스트(모두 최저·최고, 직접 답해 보기) · 환자 화면 미리보기
 * - 📨 내 설문지로 저장 (S.custom, 버전 관리: 점수 계산이 바뀌면 새 버전)
 * - 📚 모두에게 게시 (GitHub 토큰을 넣은 기기에서만, q/*.json + catalog.json 갱신)
 * 의존: OM(common.js), S·save·go·CAT·QMETA·ensureCatalog·toast(index.html) */
const ED = (() => {
  const esc = OM.esc;
  const DRAFT = 'om_editor_draft_v1', GHK = 'om_gh_v1';
  let q = null, cid = null, joint = 'knee', from = null;   // from: {pubId, pendingName} 기본 설문지에서 복사했을 때
  let dirty = false, leaving = false, draftT = null;
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---------- 모델 도우미 ----------
  const items = () => q.sections.flatMap(s => s.items);
  function newId() {
    const used = new Set(items().map(it => it.id)); let n = items().length + 1;
    while (used.has('q' + n)) n++; return 'q' + n;
  }
  function newItem(like) {
    const it = { id: newId(), q: '' };
    if (like && like.options) it.options = clone(like.options);
    else if (like && like.scale) it.scale = clone(like.scale);
    else if (like && like.input) { it.input = clone(like.input); it.scored = false; }
    else it.options = [{ label: '보기 1', score: 0 }, { label: '보기 2', score: 1 }];
    if (like && like.optional) it.optional = true;
    if (like && like.scored === false) it.scored = false;
    return it;
  }
  function blank() { return { name: '', short: '', source: '', intro: '', notes: [], sections: [{ title: '', items: [newItemFirst()] }], scoring: null }; }
  function newItemFirst() { return { id: 'q1', q: '', options: [{ label: '보기 1', score: 0 }, { label: '보기 2', score: 1 }] }; }
  const kindOf = it => it.options ? 'options' : it.scale ? 'scale' : it.input && it.input.type === 'number' ? 'number' : 'text';

  // 보기 글 ↔ 보기 목록. 한 줄에 하나, 맨 앞 숫자가 점수 (점수 없는 보기는 '-'로 시작하거나 숫자 없이)
  function optsToText(opts) { return (opts || []).map(o => (o.score === null || o.score === undefined ? '- ' : o.score + ': ') + o.label).join('\n'); }
  function textToOpts(t) {
    return String(t).split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      let m = l.match(/^(-?\d+(?:\.\d+)?)\s*(?:[:=.)]\s*|\s+)(.+)$/);
      if (m) return { label: m[2].trim(), score: +m[1] };
      m = l.match(/^-\s*(.+)$/);
      return { label: (m ? m[1] : l).trim(), score: null };
    });
  }
  // 문항 번호 "1-5, 8" ↔ id 목록
  function numsToIds(t) {
    const all = items(), out = [];
    String(t || '').split(/[,，\s]+/).filter(Boolean).forEach(part => {
      const m = part.match(/^(\d+)(?:[-~](\d+))?$/); if (!m) return;
      const a = +m[1], b = m[2] ? +m[2] : a;
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (all[i - 1] && !out.includes(all[i - 1].id)) out.push(all[i - 1].id);
    });
    return out;
  }
  function idsToNums(ids) {
    const all = items(); const ns = (ids || []).map(id => all.findIndex(it => it.id === id) + 1).filter(n => n > 0).sort((a, b) => a - b);
    const out = []; for (let i = 0; i < ns.length; i++) { let j = i; while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++; out.push(j > i ? `${ns[i]}-${ns[j]}` : `${ns[i]}`); i = j; }
    return out.join(', ');
  }
  function dropRefs(id) {
    const sc = q.scoring; if (!sc) return;
    if (sc.items) sc.items = sc.items.filter(x => x !== id);
    (sc.subscales || []).forEach(sb => sb.items = sb.items.filter(x => x !== id));
    if (sc.weights) delete sc.weights[id];
  }

  // 저장용 정리 (빈 칸 지우기)
  function cleaned() {
    const d = clone(q);
    ['name', 'short', 'source', 'intro'].forEach(k => d[k] = String(d[k] || '').trim());
    d.notes = (d.notes || []).map(s => String(s).trim()).filter(Boolean);
    if (!d.notes.length) delete d.notes;
    d.sections.forEach(s => {
      if (!String(s.title || '').trim()) delete s.title; if (!String(s.desc || '').trim()) delete s.desc;
      s.items.forEach(it => {
        if (it.scale) { ['minLabel', 'maxLabel'].forEach(k => { if (!it.scale[k]) delete it.scale[k]; }); if (!it.reverse) delete it.reverse; }
        if (it.input) ['unit', 'placeholder'].forEach(k => { if (!it.input[k]) delete it.input[k]; });
        if (!it.optional) delete it.optional; if (it.scored !== false) delete it.scored;
      });
    });
    d.sections = d.sections.filter(s => s.items.length);
    if (d.scoring) {
      const sc = d.scoring;
      if (sc.items && !sc.items.length) delete sc.items;
      if (sc.subscales && !sc.subscales.length) delete sc.subscales;
      if (sc.weights && !Object.keys(sc.weights).length) delete sc.weights;
      ['maxMissing', 'multiplier', 'offset', 'divisor', 'min', 'max'].forEach(k => { if (sc[k] === '' || sc[k] === null || sc[k] === undefined || isNaN(sc[k])) delete sc[k]; });
      if (!sc.text) delete sc.text;
    }
    delete d.ver; delete d.id;
    return d;
  }
  // 점수 계산에 영향을 주는 부분만 (같으면 같은 버전으로 덮어씀)
  function fingerprint(d) {
    return JSON.stringify({ it: d.sections.flatMap(s => s.items).map(it => [it.id, it.options ? it.options.map(o => o.score ?? null) : null, it.scale ? [it.scale.min, it.scale.max] : null, it.input ? it.input.type : null, !!it.reverse, it.scored !== false]), sc: d.scoring || null });
  }

  // ---------- 초안 자동 보관 (폰에서 실수로 닫혀도 이어서) ----------
  function markDirty() { dirty = true; clearTimeout(draftT); draftT = setTimeout(() => { try { localStorage.setItem(DRAFT, JSON.stringify({ q, cid, joint, from, at: Date.now() })); } catch (e) {} }, 600); }
  function clearDraft() { clearTimeout(draftT); try { localStorage.removeItem(DRAFT); } catch (e) {} }
  async function offerDraft() {
    let d = null; try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) {}
    if (!d || !d.q) return false;
    const ok = await OM.dialog(`작성하다 만 설문지가 있어요.\n"${d.q.name || '이름 없음'}" (${new Date(d.at).toLocaleString()})\n이어서 할까요?`, { cancel: true, okText: '이어서 하기' });
    if (!ok) { clearDraft(); return false; }
    q = d.q; cid = d.cid; joint = d.joint || 'knee'; from = d.from; dirty = true; open(); return true;
  }

  // ---------- 열기 ----------
  function open() { leaving = true; go('editor'); leaving = false; }
  async function newBlank() {
    if (await offerDraft()) return;
    q = blank(); cid = null; from = null; joint = (CAT && CAT.joints[0] && CAT.joints[0].id) || 'etc'; dirty = false; open();
  }
  function editCustom(id) {
    const c = S.custom[id]; if (!c) return;
    q = clone(c.vers[c.cur]); cid = id; joint = c.joint; from = c.pub ? { pubId: c.pub } : (c.from || null); dirty = false; open();
  }
  async function copyPublished(jid, idx) {
    await ensureCatalog();
    const j = CAT.joints.find(x => x.id === jid), it = j && j.items[idx]; if (!it) return;
    if (!it.id) {   // 준비 중(문항 없음): 이름과 메모만 가지고 새로 만들기
      q = blank(); q.name = it.name.replace(/\s*\(([^)]+)\)\s*$/, ''); const m = it.name.match(/\(([^)]+)\)\s*$/); if (m) q.short = m[1];
      if (it.note) q.notes = ['(목록 메모) ' + it.note];
      from = { pendingName: it.name };
    } else {
      try { q = clone(await OM.loadQ(it.id)); } catch (e) { OM.alertBox('설문지를 불러오지 못했어요.'); return; }
      delete q.id; from = { pubId: it.id };
    }
    cid = null; joint = jid; dirty = true; open();
    toast(it.id ? '복사본을 만들었어요. 원본은 그대로예요.' : '준비 중인 설문지를 새로 만들어요.');
  }

  // ---------- 화면 ----------
  function jointOptions(sel) {
    const js = (CAT ? CAT.joints : []).map(j => [j.id, j.name]).concat([['etc', '기타']]);
    return js.map(([id, n]) => `<option value="${id}" ${id === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
  }
  async function render() {
    try { await ensureCatalog(); } catch (e) {}
    const root = document.getElementById('edRoot');
    if (!q) { root.innerHTML = '<div class="card"><p class="sub">편집할 설문지가 없어요.</p><button class="btn btn-line" onclick="go(\'forms\')">← 설문지 목록</button></div>'; return; }
    const title = cid ? '✏️ 내 설문지 고치기' : from && from.pubId ? '✏️ 기본 설문지 복사본' : '✏️ 새 설문지';
    let h = `<div class="card"><button class="link-btn" onclick="go('forms')">← 설문지 목록</button>
      <h2 style="margin-top:6px">${title}</h2>
      ${from && from.pubId ? `<p class="sub">원본: ${esc(from.pubId)} · 고친 내용은 저장해야 반영되고, 원본은 그대로예요.</p>` : ''}
      <label class="field">설문지 이름 *</label><input type="text" data-top="name" value="${esc(q.name)}" placeholder="예: 경부 기능 제한 지수">
      <div class="ed-mini"><div><label class="field">약어</label><input type="text" data-top="short" value="${esc(q.short || '')}" placeholder="예: NDI"></div>
      <div><label class="field">관절</label><select data-top="joint">${jointOptions(joint)}</select></div></div>
      <label class="field">출처</label><input type="text" data-top="source" value="${esc(q.source || '')}" placeholder="예: 피티에듀 평가지 p15-17">
      <label class="field">환자 안내문</label><textarea data-top="intro" style="min-height:70px" placeholder="예: 각 문항에서 가장 가까운 것 하나를 골라 주세요.">${esc(q.intro || '')}</textarea>
      <label class="field">의견·메모 (한 줄에 하나)</label><textarea data-top="notes" style="min-height:60px" placeholder="예: 의견: 8a '7-15분'은 '11-15분' 오기로 보임 (원문 그대로 둠)">${esc((q.notes || []).join('\n'))}</textarea>
      <div class="ed-hint">원문이 틀려 보여도 문항은 원문 그대로 두고, 여기에 의견으로 적어 두세요.</div>
      <button class="btn btn-line" onclick="ED.openAI(true)">🤖 AI 변환 결과 붙여넣기 (이 화면 내용 바꾸기)</button></div>`;

    // 문항
    let n = 0;
    h += `<div class="card"><h2>문항 (${items().length}개)</h2>
      <p class="sub">보기는 한 줄에 하나씩, <b>맨 앞 숫자가 점수</b>예요. 예) <span class="code">0: 전혀 없다</span>. 점수 없는 보기는 <span class="code">- 해당 없음</span>처럼 써요.</p>`;
    q.sections.forEach((sec, si) => {
      h += `<div class="ed-sec">`;
      if (q.sections.length > 1 || sec.title || sec.desc) {
        h += `<div class="ed-item-top"><b>구역 ${si + 1}</b><span class="ed-tools">${q.sections.length > 1 ? `<button onclick="ED.act('secDel',${si})">구역 삭제</button>` : ''}</span></div>
          <input type="text" data-sec="${si}" data-k="title" value="${esc(sec.title || '')}" placeholder="구역 제목 (예: 통증)">
          <input type="text" data-sec="${si}" data-k="desc" value="${esc(sec.desc || '')}" placeholder="구역 설명 (선택)" style="margin-top:6px">`;
      }
      sec.items.forEach((it, ii) => { n++; h += itemHtml(it, si, ii, n); });
      h += `<button class="btn btn-line" onclick="ED.act('add',${si})">＋ 문항 추가${sec.items.length ? ' (위 문항과 같은 보기)' : ''}</button></div>`;
    });
    h += `<button class="btn btn-line" onclick="ED.act('secAdd')">＋ 구역 추가 (제목으로 묶기)</button></div>`;

    h += scoringHtml();

    // 검사·테스트
    h += `<div class="card"><h2>🧪 검사 · 점수 테스트</h2><div id="edCheck"></div>
      <div class="row"><button class="btn btn-line" onclick="ED.extreme('min')">모두 최저 답</button><button class="btn btn-line" onclick="ED.extreme('max')">모두 최고 답</button></div>
      <div id="edExtreme"></div>
      <button class="btn btn-line" onclick="ED.test()">✍️ 직접 답해 보며 점수 보기</button>
      <button class="btn btn-line" onclick="ED.preview()">👀 환자 화면 미리보기 (새 창)</button></div>`;

    // 고급
    h += `<div class="card"><details class="ed-adv" id="edAdv"><summary>⚙️ 고급: JSON 직접 보기·고치기</summary>
      <p class="sub" style="margin-top:6px">분류 규칙(위험군 등)처럼 화면에 없는 설정은 여기서 고쳐요.</p>
      <textarea class="mono" id="edJson"></textarea><button class="btn btn-line" onclick="ED.applyJson()">이 JSON으로 바꾸기</button></details></div>`;

    // 저장
    h += `<div class="ed-bar"><button class="btn btn-main" onclick="ED.saveMine()">📨 내 설문지로 저장</button>
      ${gh() ? `<button class="btn btn-line" onclick="ED.publish()">📚 모두에게 게시 (GitHub)</button>` : ''}</div>`;
    root.innerHTML = h;
    root.oninput = onInput; root.onchange = onChange;
    document.getElementById('edAdv').ontoggle = e => { if (e.target.open) document.getElementById('edJson').value = JSON.stringify(cleaned(), null, 1); };
    check();
  }

  function itemHtml(it, si, ii, n) {
    const k = kindOf(it), a = `data-it="${si}.${ii}"`;
    let body = '';
    if (k === 'options') {
      const sc = it.options.filter(o => o.score !== null && o.score !== undefined).map(o => o.score);
      body = `<textarea ${a} data-k="opts" style="min-height:${Math.min(60 + it.options.length * 24, 220)}px">${esc(optsToText(it.options))}</textarea>
        <div class="ed-hint" data-sum="${si}.${ii}">${optSummary(it.options)}</div>`;
    } else if (k === 'scale') {
      body = `<div class="ed-mini"><div><label class="field">최소</label><input type="number" ${a} data-k="smin" value="${it.scale.min}"></div><div><label class="field">최대</label><input type="number" ${a} data-k="smax" value="${it.scale.max}"></div></div>
        <div class="ed-mini"><div><label class="field">최소 쪽 설명</label><input type="text" ${a} data-k="sminL" value="${esc(it.scale.minLabel || '')}" placeholder="0 = 통증 없음"></div><div><label class="field">최대 쪽 설명</label><input type="text" ${a} data-k="smaxL" value="${esc(it.scale.maxLabel || '')}" placeholder="10 = 최악"></div></div>
        <label class="ed-chk"><input type="checkbox" ${a} data-k="reverse" ${it.reverse ? 'checked' : ''}>역채점 (큰 숫자일수록 낮은 점수)</label>`;
    } else if (k === 'number') {
      body = `<div class="ed-mini"><div><label class="field">최소</label><input type="number" ${a} data-k="imin" value="${it.input.min ?? ''}" placeholder="제한 없음"></div><div><label class="field">최대</label><input type="number" ${a} data-k="imax" value="${it.input.max ?? ''}" placeholder="제한 없음"></div></div>
        <label class="field">단위</label><input type="text" ${a} data-k="iunit" value="${esc(it.input.unit || '')}" placeholder="예: 세, %, 분">`;
    } else {
      body = `<label class="field">입력 칸 안내 글</label><input type="text" ${a} data-k="iph" value="${esc(it.input.placeholder || '')}" placeholder="예: 자유롭게 적어 주세요">`;
    }
    return `<div class="ed-item"><div class="ed-item-top"><b>${n}.</b><span class="sub code" style="font-size:.72rem">${esc(it.id)}</span>
      <span class="ed-tools"><button onclick="ED.act('up',${si},${ii})" aria-label="위로">↑</button><button onclick="ED.act('down',${si},${ii})" aria-label="아래로">↓</button><button onclick="ED.act('dup',${si},${ii})" aria-label="복제">⧉</button><button onclick="ED.act('del',${si},${ii})" aria-label="삭제">🗑</button></span></div>
      <textarea ${a} data-k="q" style="min-height:52px" placeholder="질문">${esc(it.q)}</textarea>
      <select ${a} data-k="kind" style="margin-top:6px">${[['options', '보기 고르기'], ['scale', '숫자 척도 (예: 0~10)'], ['number', '숫자 직접 입력'], ['text', '글 직접 입력']].map(([v, l]) => `<option value="${v}" ${v === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${body}
      <label class="ed-chk"><input type="checkbox" ${a} data-k="optional" ${it.optional ? 'checked' : ''}>'해당 없음(건너뛰기)' 허용</label>
      <label class="ed-chk"><input type="checkbox" ${a} data-k="exclude" ${it.scored === false ? 'checked' : ''}>점수에서 제외 (나이·메모 등)</label></div>`;
  }
  function optSummary(opts) {
    const sc = opts.filter(o => o.score !== null && o.score !== undefined).map(o => o.score);
    return `보기 ${opts.length}개 · ${sc.length ? `점수 ${Math.min(...sc)}~${Math.max(...sc)}` : '점수 없음'}${sc.length && sc.length < opts.length ? ` · 점수 없는 보기 ${opts.length - sc.length}개` : ''}`;
  }

  const METHODS = [['', '계산 안 함 (답변만 저장)'], ['sum', '합계'], ['mean', '평균 (공식 가능)'], ['percent', '백분율 (답한 문항 만점 대비 %)'], ['weighted', '가중 합'], ['subsum', '영역 점수의 합'], ['subscales', '영역 점수만 (총점 없음)']];
  function scoringHtml() {
    const sc = q.scoring, m = sc ? sc.method : '';
    let h = `<div class="card"><h2>채점</h2><p class="sub">원문에 채점법이 없으면 '계산 안 함'으로 두세요 (문서에 없음).</p>
      <select data-sc="method">${METHODS.map(([v, l]) => `<option value="${v}" ${v === m ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    if (!sc) {
      h += `<label class="field">점수 방향 (문항별 비교 색 표시용)</label><select data-top="hb">${[['', '정하지 않음'], ['true', '높을수록 좋음'], ['false', '낮을수록 좋음']].map(([v, l]) => `<option value="${v}" ${String(q.higherIsBetter ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      return h + '</div>';
    }
    const v = k => sc[k] === undefined || sc[k] === null ? '' : sc[k];
    h += `<label class="field">채점법 설명</label><input type="text" data-sc="text" value="${esc(sc.text || '')}" placeholder="예: 10문항 합 (0~50)">`;
    if (m !== 'subscales') {
      h += `<div class="ed-mini"><div><label class="field">최저 점수</label><input type="number" step="any" data-sc="min" value="${v('min')}"></div><div><label class="field">최고 점수</label><input type="number" step="any" data-sc="max" value="${v('max')}"></div></div>
        <button class="btn btn-line btn-sm" style="margin-top:8px" onclick="ED.autoRange()">↻ 문항으로 자동 계산</button>`;
    }
    h += `<div class="ed-mini"><div><label class="field">단위</label><select data-sc="unit"><option value="점" ${sc.unit !== '%' ? 'selected' : ''}>점</option><option value="%" ${sc.unit === '%' ? 'selected' : ''}>%</option></select></div>
      <div><label class="field">방향 *</label><select data-sc="hb">${[['', '고르세요'], ['true', '높을수록 좋음'], ['false', '낮을수록 좋음']].map(([x, l]) => `<option value="${x}" ${String(sc.higherIsBetter ?? '') === x ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>`;
    if (['sum', 'mean', 'percent', 'weighted'].includes(m)) {
      h += `<label class="field">총점에 쓰는 문항 번호</label><input type="text" data-sc="items" value="${esc(idsToNums(sc.items))}" placeholder="비우면 점수 문항 전부 (예: 1-11)">
        <label class="field">답 안 한 문항이 몇 개 넘으면 계산 안 함</label><input type="number" data-sc="maxMissing" value="${v('maxMissing')}" placeholder="비우면 제한 없음">`;
    }
    if (m === 'mean') h += `<div class="ed-mini"><div><label class="field">평균에 더할 값</label><input type="number" step="any" data-sc="offset" value="${v('offset')}" placeholder="0"></div><div><label class="field">그다음 곱할 값</label><input type="number" step="any" data-sc="multiplier" value="${v('multiplier')}" placeholder="1"></div></div>
      <div class="ed-hint">결과 = (평균 + 더할 값) × 곱할 값. 예) DASH: (평균 − 1) × 25 → −1, 25</div>`;
    if (m === 'weighted') h += `<label class="field">가중치 (한 줄에 "문항번호: 가중치")</label><textarea data-sc="weights" style="min-height:70px" placeholder="1: 2&#10;2: 1.5">${esc(Object.entries(sc.weights || {}).map(([id, w]) => `${idsToNums([id])}: ${w}`).join('\n'))}</textarea>
      <div class="ed-mini"><div><label class="field">나눌 값</label><input type="number" step="any" data-sc="divisor" value="${v('divisor')}" placeholder="1"></div></div>`;
    // 영역
    h += `<h3>영역 점수 ${m === 'subsum' || m === 'subscales' ? '*' : '(선택)'}</h3>`;
    (sc.subscales || []).forEach((sb, k) => {
      const a = `data-sub="${k}"`;
      h += `<div class="ed-sub"><div class="ed-item-top"><b>영역 ${k + 1}</b><span class="ed-tools"><button onclick="ED.act('subDel',${k})">삭제</button></span></div>
        <input type="text" ${a} data-k="name" value="${esc(sb.name)}" placeholder="영역 이름 (예: 통증)">
        <label class="field">문항 번호</label><input type="text" ${a} data-k="items" value="${esc(idsToNums(sb.items))}" placeholder="예: 1-5">
        <div class="ed-mini"><div><label class="field">계산</label><select ${a} data-k="calc"><option value="sum">합</option><option value="mean" ${sb.calc === 'mean' ? 'selected' : ''}>평균</option></select></div>
        <div><label class="field">곱할 값</label><input type="number" step="any" ${a} data-k="multiplier" value="${sb.multiplier ?? ''}" placeholder="1"></div></div>
        <div class="ed-mini"><div><label class="field">최저</label><input type="number" step="any" ${a} data-k="min" value="${sb.min ?? ''}" placeholder="0"></div><div><label class="field">최고</label><input type="number" step="any" ${a} data-k="max" value="${sb.max ?? ''}"></div></div>
        ${m !== 'subscales' ? `<label class="ed-chk"><input type="checkbox" ${a} data-k="measure" ${sb.measure ? 'checked' : ''}>전후 비교에 따로 표시</label>` : ''}
        <label class="ed-chk"><input type="checkbox" ${a} data-k="requireAll" ${sb.requireAll ? 'checked' : ''}>모두 답해야 계산</label></div>`;
    });
    h += `<button class="btn btn-line" onclick="ED.act('subAdd')">＋ 영역 추가</button>`;
    if (sc.classify && sc.classify.length) h += `<div class="note">분류 규칙 ${sc.classify.length}개: ${sc.classify.map(c => esc(c.label)).join(', ')} (고치려면 아래 '고급: JSON')</div>`;
    return h + '</div>';
  }

  // ---------- 입력 처리 ----------
  const num = v => v === '' || v === null || v === undefined || isNaN(+v) ? undefined : +v;
  function onInput(e) {
    const t = e.target; if (!t.dataset) return;
    if (t.type === 'checkbox' || t.tagName === 'SELECT') return;   // change 에서 처리
    applyField(t, false);
  }
  function onChange(e) {
    const t = e.target; if (!t.dataset) return;
    const re = applyField(t, true);
    if (re) render();
  }
  // 바뀐 칸을 모델에 반영. 화면을 다시 그려야 하면 true
  function applyField(t, final) {
    const d = t.dataset, val = t.type === 'checkbox' ? t.checked : t.value;
    let re = false;
    if (d.top) {
      if (d.top === 'joint') joint = val;
      else if (d.top === 'notes') q.notes = val.split('\n');
      else if (d.top === 'hb') { if (val === '') delete q.higherIsBetter; else q.higherIsBetter = val === 'true'; }
      else q[d.top] = val;
    } else if (d.sec !== undefined) {
      q.sections[+d.sec][d.k] = val;
    } else if (d.it) {
      const [si, ii] = d.it.split('.').map(Number), it = q.sections[si].items[ii];
      switch (d.k) {
        case 'q': it.q = val; break;
        case 'opts': it.options = textToOpts(val); const s = document.querySelector(`[data-sum="${si}.${ii}"]`); if (s) s.innerText = optSummary(it.options); break;
        case 'smin': if (num(val) !== undefined) it.scale.min = num(val); break;
        case 'smax': if (num(val) !== undefined) it.scale.max = num(val); break;
        case 'sminL': it.scale.minLabel = val; break;
        case 'smaxL': it.scale.maxLabel = val; break;
        case 'reverse': it.reverse = val; break;
        case 'imin': if (num(val) === undefined) delete it.input.min; else it.input.min = num(val); break;
        case 'imax': if (num(val) === undefined) delete it.input.max; else it.input.max = num(val); break;
        case 'iunit': it.input.unit = val; break;
        case 'iph': it.input.placeholder = val; break;
        case 'optional': it.optional = val; break;
        case 'exclude': if (val) it.scored = false; else delete it.scored; break;
        case 'kind': {
          const keep = it.q; delete it.options; delete it.scale; delete it.input; delete it.reverse;
          if (val === 'options') it.options = [{ label: '보기 1', score: 0 }, { label: '보기 2', score: 1 }];
          else if (val === 'scale') it.scale = { min: 0, max: 10, minLabel: '', maxLabel: '' };
          else { it.input = { type: val }; it.scored = false; }
          if (val === 'options' || val === 'scale') delete it.scored;
          it.q = keep; re = true; break;
        }
      }
    } else if (d.sc) {
      if (d.sc === 'method') {
        if (!val) q.scoring = null;
        else {
          const old = q.scoring || {};
          q.scoring = Object.assign({ unit: val === 'percent' ? '%' : '점', higherIsBetter: q.higherIsBetter ?? old.higherIsBetter }, old, { method: val });
          if (val === 'percent') { q.scoring.unit = '%'; q.scoring.min = 0; q.scoring.max = 100; }
          if ((val === 'subsum' || val === 'subscales') && !(q.scoring.subscales || []).length) q.scoring.subscales = [{ name: '', items: [] }];
          if (q.scoring.higherIsBetter === undefined) delete q.scoring.higherIsBetter;
          if (q.scoring.min === undefined && val !== 'subscales') { const r = rangeOf(); if (r) { q.scoring.min = r[0]; q.scoring.max = r[1]; } }
        }
        re = true;
      } else {
        const sc = q.scoring;
        if (d.sc === 'items') { if (final) { sc.items = numsToIds(val); if (!sc.items.length) delete sc.items; } }
        else if (d.sc === 'hb') { if (val === '') delete sc.higherIsBetter; else sc.higherIsBetter = val === 'true'; }
        else if (d.sc === 'weights') {
          if (final) { const w = {}; val.split('\n').forEach(l => { const m = l.match(/^\s*([\d\s,~-]+?)\s*[:=]\s*(-?[\d.]+)\s*$/); if (m) numsToIds(m[1]).forEach(id => w[id] = +m[2]); }); sc.weights = w; }
        }
        else if (['text', 'unit'].includes(d.sc)) sc[d.sc] = val;
        else { if (num(val) === undefined) delete sc[d.sc]; else sc[d.sc] = num(val); }
      }
    } else if (d.sub !== undefined) {
      const sb = q.scoring.subscales[+d.sub];
      if (d.k === 'name') sb.name = val;
      else if (d.k === 'items') { if (final) sb.items = numsToIds(val); }
      else if (d.k === 'calc') { if (val === 'mean') sb.calc = 'mean'; else delete sb.calc; }
      else if (d.k === 'measure' || d.k === 'requireAll') { if (val) sb[d.k] = true; else delete sb[d.k]; }
      else { if (num(val) === undefined) delete sb[d.k]; else sb[d.k] = num(val); }
    } else return false;
    markDirty(); check();
    return re;
  }

  function act(kind, a, b) {
    const secs = q.sections;
    if (kind === 'add') { const list = secs[a].items; list.push(newItem(list[list.length - 1])); }
    else if (kind === 'dup') { const c = clone(secs[a].items[b]); c.id = newId(); secs[a].items.splice(b + 1, 0, c); }
    else if (kind === 'del') {
      const it = secs[a].items[b];
      if (items().length === 1) { OM.alertBox('문항이 하나는 있어야 해요.'); return; }
      secs[a].items.splice(b, 1); dropRefs(it.id);
    }
    else if (kind === 'up' || kind === 'down') {
      const flat = []; secs.forEach((s, si) => s.items.forEach((it, ii) => flat.push([si, ii])));
      const pos = flat.findIndex(([si, ii]) => si === a && ii === b), to = pos + (kind === 'up' ? -1 : 1);
      if (to < 0 || to >= flat.length) return;
      const [sa, ia] = flat[pos], [sb, ib] = flat[to];
      if (sa === sb) { const l = secs[sa].items; [l[ia], l[ib]] = [l[ib], l[ia]]; }
      else { const it = secs[sa].items.splice(ia, 1)[0]; if (kind === 'up') secs[sb].items.push(it); else secs[sb].items.unshift(it); }
    }
    else if (kind === 'secAdd') secs.push({ title: '', items: [newItem(items()[items().length - 1])] });
    else if (kind === 'secDel') {
      if (!confirm(`구역 ${a + 1}을 지울까요? 안의 문항은 앞 구역으로 옮겨져요.`)) return;
      const moved = secs.splice(a, 1)[0].items; secs[Math.max(0, a - 1)].items.push(...moved);
    }
    else if (kind === 'subAdd') { q.scoring.subscales = q.scoring.subscales || []; q.scoring.subscales.push({ name: '', items: [] }); }
    else if (kind === 'subDel') q.scoring.subscales.splice(a, 1);
    markDirty();
    const y = window.scrollY; render().then(() => window.scrollTo(0, y));
  }

  // ---------- 검사 · 점수 테스트 ----------
  function withId(d) { const x = clone(d); x.id = cid || 'u_test'; return x; }
  function check() {
    const el = document.getElementById('edCheck'); if (!el) return;
    const r = OM.validateQ(withId(cleaned()));
    el.innerHTML = !r.errors.length && !r.warnings.length ? '<div class="ed-ok">✅ 문제 없어요</div>'
      : `<ul class="ed-check">${r.errors.map(x => `<li class="e">❌ ${esc(x)}</li>`).join('')}${r.warnings.map(x => `<li class="w">⚠️ ${esc(x)}</li>`).join('')}</ul>`;
  }
  // 모든 점수 문항을 최저(또는 최고) 점수로 답했을 때의 답
  function extremeVals(d, mode) {
    const v = {};
    d.sections.flatMap(s => s.items).forEach(it => {
      if (it.options) {
        const sc = it.options.map(o => o.score).filter(x => x !== null && x !== undefined);
        if (sc.length) v[it.id] = it.scored === false ? sc[0] : (mode === 'min' ? Math.min(...sc) : Math.max(...sc));
      } else if (it.scale) {
        const lowRaw = it.reverse ? it.scale.max : it.scale.min, highRaw = it.reverse ? it.scale.min : it.scale.max;
        v[it.id] = mode === 'min' ? lowRaw : highRaw;
      } else if (it.input && it.input.type === 'number' && it.scored !== false) {
        const x = mode === 'min' ? it.input.min : it.input.max; if (x !== undefined) v[it.id] = x;
      }
    });
    return v;
  }
  function scoreText(d, vals) {
    if (!d.scoring) return '계산 안 함 (답변만 저장)';
    const r = OM.score(d, vals);
    const main = d.scoring.method === 'subscales' ? '' : `총점 ${OM.fmt(d, r.score)}`;
    const subs = r.subs.map(x => `${x.name || '(이름 없음)'} ${x.score ?? '-'}${x.max !== undefined ? '/' + x.max : ''}`).join(' · ');
    return [main, subs, r.category ? '분류: ' + r.category : '', r.missing ? `빠진 답 ${r.missing}개` : ''].filter(Boolean).join('\n');
  }
  function rangeOf() {
    const d = withId(cleaned()); if (!d.scoring) return null;
    const a = OM.score(Object.assign({}, d, { scoring: Object.assign({}, d.scoring, { maxMissing: undefined }) }), extremeVals(d, 'min')).score;
    const b = OM.score(Object.assign({}, d, { scoring: Object.assign({}, d.scoring, { maxMissing: undefined }) }), extremeVals(d, 'max')).score;
    if (a === null || b === null) return null;
    return [Math.min(a, b), Math.max(a, b)];
  }
  function autoRange() {
    const r = rangeOf(); if (!r) { OM.alertBox('문항 점수로 범위를 계산할 수 없어요. 직접 입력해 주세요.'); return; }
    q.scoring.min = r[0]; q.scoring.max = r[1]; markDirty(); render(); toast(`점수 범위 ${r[0]}~${r[1]}`);
  }
  function extreme(mode) {
    const d = withId(cleaned());
    document.getElementById('edExtreme').innerHTML = `<div class="ed-score">${mode === 'min' ? '⬇️ 모두 최저 답' : '⬆️ 모두 최고 답'}\n${esc(scoreText(d, extremeVals(d, mode)))}</div>`;
  }
  function overlay() {
    let o = document.getElementById('edTest');
    if (!o) { o = document.createElement('div'); o.id = 'edTest'; o.className = 'overlay'; o.innerHTML = `<div class="wrap"><div class="overlay-top"><div class="row" style="align-items:center"><h1 style="flex:1;margin:0">🧪 점수 테스트</h1><button class="btn btn-line btn-sm" onclick="ED.closeTest()">닫기</button></div><div class="ed-score" id="edLive"></div><div class="sub" style="margin-top:4px">테스트 답은 저장되지 않아요.</div></div><div class="card" id="edTestRoot"></div></div>`; document.body.appendChild(o); }
    return o;
  }
  function test(def) {
    const d = def || withId(cleaned());
    const v = OM.validateQ(d); if (v.errors.length) { OM.alertBox('먼저 고칠 곳이 있어요:\n' + v.errors.join('\n')); return; }
    const o = overlay(); o.classList.add('show'); o.scrollTop = 0;
    const live = document.getElementById('edLive');
    const show = ans => { const res = OM.toResult(d, ans[d.id] || {}); live.innerText = scoreText(d, res.v); };
    const answers = {};
    OM.runSurvey({ root: document.getElementById('edTestRoot'), qs: [d], answers, onChange: show,
      onFinish: () => { show(answers); live.innerText = '✅ 다 답했어요\n' + live.innerText; o.scrollTop = 0; } });
    show(answers);
  }
  function closeTest() { const o = document.getElementById('edTest'); if (o) o.classList.remove('show'); }
  function testCustom(id) { const c = S.custom[id]; if (c) test(clone(c.vers[c.cur])); }
  async function preview() {
    const d = withId(cleaned()); d.id = 'u_preview'; d.ver = 1;
    const v = OM.validateQ(d); if (v.errors.length) { OM.alertBox('먼저 고칠 곳이 있어요:\n' + v.errors.join('\n')); return; }
    const w = window.open('', '_blank');
    const url = OM.baseUrl() + 'survey.html#p=PREVIEW&q=u_preview.1&d=' + await OM.packDefs([d]);
    if (w) w.location.href = url; else location.href = url;
  }

  // ---------- JSON · AI ----------
  function normalize(o) {
    if (Array.isArray(o)) o = o[0];
    if (o && o.questionnaire) o = o.questionnaire;
    if (!o || typeof o !== 'object') throw new Error('형식');
    if (!o.sections && Array.isArray(o.items)) o.sections = [{ items: o.items }];
    if (!Array.isArray(o.sections)) throw new Error('문항 없음');
    const used = new Set(); let n = 0;
    o.sections.forEach(s => {
      s.items = (s.items || s.questions || []).map(it => {
        n++;
        it = Object.assign({}, it);
        if (it.question && !it.q) it.q = it.question; delete it.question;
        let id = String(it.id || '').replace(/[^A-Za-z0-9_]/g, '');
        if (!id || used.has(id)) { id = 'q' + n; while (used.has(id)) id += '_'; }
        used.add(id); it.id = id; it.q = String(it.q || '');
        if (it.options) it.options = it.options.map(op => typeof op === 'string' ? { label: op, score: null } : { label: String(op.label ?? op.text ?? ''), score: op.score === '' || op.score === null || op.score === undefined || isNaN(+op.score) ? null : +op.score });
        if (it.scale) it.scale = { min: +it.scale.min, max: +it.scale.max, minLabel: it.scale.minLabel || '', maxLabel: it.scale.maxLabel || '' };
        return it;
      });
      delete s.questions;
    });
    if (o.scoring && !o.scoring.method) o.scoring = null;
    if (o.notes && !Array.isArray(o.notes)) o.notes = [String(o.notes)];
    delete o.id; delete o.ver; delete o.interpretation;
    return o;
  }
  function parseLoose(text) {
    let t = String(text || '');
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) t = fence[1];
    const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('nojson');
    t = t.slice(a, b + 1);
    try { return JSON.parse(t); } catch (e) { return JSON.parse(t.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')); }
  }
  async function loadFromText(text, replaceCurrent) {
    let o;
    try { o = normalize(parseLoose(text)); }
    catch (e) { await OM.alertBox('AI 답에서 설문지 JSON을 찾지 못했어요.\nAI에게 "JSON만 코드 블록으로 다시 줘"라고 해 보세요.'); return false; }
    if (!replaceCurrent) { cid = null; from = null; joint = (CAT && CAT.joints[0] && CAT.joints[0].id) || 'etc'; }
    q = o; q.notes = q.notes || []; dirty = true; markDirty();
    open();
    const r = OM.validateQ(withId(cleaned()));
    await OM.alertBox(`문항 ${items().length}개를 가져왔어요.${q.scoring ? '' : '\n채점법이 없어 답변만 저장하는 설문으로 들어왔어요.'}\n\n아래 '🧪 검사'에서 ${r.errors.length ? `고칠 곳 ${r.errors.length}개` : '확인'}하고, 원문과 한 번 비교한 뒤 저장해 주세요.`);
    return true;
  }
  async function applyJson() {
    const t = document.getElementById('edJson').value;
    if (await loadFromText(t, true)) toast('JSON을 적용했어요');
  }
  const PROMPT = `아래 [설문지 원문]을 물리치료 설문 앱에 넣을 JSON으로 바꿔 줘.

지켜야 할 것
1. 원문에 있는 내용만 써. 문항·보기·점수·채점법을 지어내거나 고치지 마.
2. 원문에 채점법(점수 계산 방법)이 없으면 "scoring": null 로 두고, notes 에 "채점법 문서에 없음"이라고 적어.
3. 원문에 보기 점수가 없으면 그 보기의 "score"는 null.
4. 원문이 틀려 보이거나 애매한 곳은 고치지 말고 notes 에 "의견: …"으로 적어.
5. 문항·보기 문구는 원문 그대로 (번역·요약하지 마).
6. 답은 JSON 하나만, \`\`\`json 코드 블록 안에 줘.

형식
{
  "name": "설문지 이름",
  "short": "약어 (예: NDI)",
  "source": "출처 (자료 이름과 쪽)",
  "intro": "환자에게 보여 줄 안내문",
  "notes": ["의견이나 확인할 점"],
  "sections": [
    {
      "title": "구역 제목 (없으면 빈칸)",
      "items": [
        { "id": "q1", "q": "1. 보기를 고르는 문항", "options": [ {"label": "보기", "score": 0}, {"label": "보기", "score": 1} ] },
        { "id": "q2", "q": "2. 0~10 숫자로 답하는 문항", "scale": {"min": 0, "max": 10, "minLabel": "0 = 통증 없음", "maxLabel": "10 = 최악의 통증"} },
        { "id": "q3", "q": "나이", "input": {"type": "number", "unit": "세"}, "scored": false },
        { "id": "q4", "q": "기타 의견", "input": {"type": "text"}, "scored": false }
      ]
    }
  ],
  "scoring": {
    "method": "sum",
    "min": 0, "max": 50, "unit": "점",
    "higherIsBetter": false,
    "text": "원문 채점법 요약"
  }
}

문항 규칙
- 문항마다 답 종류는 셋 중 하나: options(보기 고르기), scale(숫자 척도, 최대 21칸), input(직접 입력: number 또는 text)
- 점수에 들어가지 않는 문항(나이, 메모 등)은 "scored": false
- 건너뛸 수 있는 문항(해당 없음 허용)은 "optional": true
- 척도를 거꾸로 채점하면 "reverse": true
- id는 영어·숫자로, 겹치지 않게

채점 규칙 (method)
- "sum": 점수 합
- "mean": 답한 문항의 평균. 공식이 있으면 결과 = (평균 + "offset") × "multiplier"
- "percent": 답한 문항 만점 대비 % ("unit": "%")
- "weighted": 가중 합 → "weights": {"q1": 2}, "divisor": 나눌 값
- "subsum": 영역 점수의 합 / "subscales": 영역 점수만 (총점 없음)
- 영역: "subscales": [{"name": "통증", "items": ["q1","q2"], "calc": "sum" 또는 "mean", "max": 20, "measure": true}]
- 일부 문항만 총점에 쓰면 "items": ["q1","q2"]
- 빠진 답이 몇 개를 넘으면 계산하지 않는 규칙이 있으면 "maxMissing": 개수
- 점수로 위험군 등을 나누는 규칙이 있으면 "classify": [{"label": "고위험", "when": [["total", ">=", 4]]}]
- MCID·MDC 값은 넣지 마 (치료사가 따로 입력함)

[설문지 원문]
`;
  async function openAI(replaceCurrent) {
    if (!replaceCurrent && await offerDraft()) return;
    const ok = await OM.dialog('🤖 AI로 설문지 변환하기', { cancel: true, okText: '가져오기', html:
      `<p class="sub"><b>①</b> 요청문을 복사해서 ChatGPT·Claude 같은 AI에 붙여넣고, 맨 아래에 <b>설문지 원문</b>(글 붙여넣기 또는 사진 첨부)을 넣어 보내세요.</p>
       <button class="btn btn-line" onclick="ED.copyPrompt()">📋 ① AI 변환 요청문 복사</button>
       <p class="sub" style="margin-top:12px"><b>②</b> AI 답을 <b>전부</b> 복사해서 아래에 붙여넣으세요.</p>
       <button class="btn btn-line" onclick="ED.pasteAI()">📋 클립보드에서 붙여넣기</button>
       <textarea id="aiText" placeholder="AI 답 붙여넣기 ( \`\`\`json { ... } \`\`\` )" style="margin-top:8px"></textarea>
       ${replaceCurrent ? '<p class="sub" style="margin-top:6px">⚠️ 지금 편집 화면의 내용이 바뀌어요.</p>' : ''}` });
    if (!ok) return;
    await loadFromText(document.getElementById('aiText').value, !!replaceCurrent);
  }
  async function pasteAI() {
    try { document.getElementById('aiText').value = await navigator.clipboard.readText(); }
    catch (e) { const t = document.getElementById('aiText'); t.placeholder = '클립보드를 읽을 수 없어요. 여기를 길게 눌러 직접 붙여넣어 주세요.'; t.focus(); }
  }
  async function copyPrompt() {
    try { await navigator.clipboard.writeText(PROMPT); toast('요청문을 복사했어요. AI에 붙여넣고 원문을 이어 붙이세요.'); }
    catch (e) { const t = document.getElementById('aiText'); t.value = PROMPT; t.select(); toast('아래 칸의 요청문을 길게 눌러 복사해 주세요.'); }
  }

  // ---------- 📨 내 설문지로 저장 ----------
  function usedVersions(id) {
    const vs = new Set();
    S.results.forEach(r => { if (r.q === id) vs.add(String(r.qv || 1)); });
    S.sent.forEach(s => { if (s.qv && s.qv[id] && !s.closed) vs.add(String(s.qv[id])); });
    return vs;
  }
  async function saveMine() {
    const d = cleaned(); const v = OM.validateQ(withId(d));
    if (v.errors.length) { await OM.alertBox('저장하기 전에 고칠 곳이 있어요:\n\n' + v.errors.join('\n')); return; }
    if (v.warnings.length && !(await OM.confirmBox('확인할 점이 있어요:\n\n' + v.warnings.join('\n') + '\n\n그래도 저장할까요?'))) return;
    let msg;
    if (!cid || !S.custom[cid]) {
      const A = 'abcdefghijkmnpqrstuvwxyz23456789'; let id;
      do { id = 'u_' + Array.from({ length: 8 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (S.custom[id]);
      d.id = id; d.ver = 1;
      S.custom[id] = { id, joint, cur: 1, vers: { 1: d }, d: OM.nowStr() };
      if (from && from.pubId) S.custom[id].from = { pubId: from.pubId };
      cid = id; msg = '내 설문지로 저장했어요 ✅\n[보내기] 탭의 해당 관절에서 고를 수 있어요.';
    } else {
      const c = S.custom[cid]; const curDef = c.vers[c.cur];
      d.id = cid;
      const changed = fingerprint(d) !== fingerprint(curDef);
      if (changed && usedVersions(cid).has(String(c.cur))) {
        const nv = Math.max(...Object.keys(c.vers).map(Number)) + 1; d.ver = nv; c.vers[nv] = d; c.cur = nv;
        msg = `점수 계산 방식이 바뀌어 새 버전(v${nv})으로 저장했어요 ✅\n이미 받은 결과와 보낸 링크는 원래 버전으로 계속 채점돼요.`;
      } else { d.ver = c.cur; c.vers[c.cur] = d; msg = '저장했어요 ✅'; }
      c.joint = joint; c.d = OM.nowStr(); delete c.hidden;
      const keep = usedVersions(cid); Object.keys(c.vers).forEach(k => { if (k !== String(c.cur) && !keep.has(k)) delete c.vers[k]; });
    }
    delete QMETA[cid]; save(); dirty = false; clearDraft();
    await OM.alertBox(msg);
    leaving = true; go('forms'); leaving = false;
  }
  async function removeCustom(id) {
    const c = S.custom[id]; if (!c) return; const name = c.vers[c.cur].name;
    const n = S.results.filter(r => r.q === id).length;
    if (n) {
      if (!(await OM.confirmBox(`"${name}"로 받은 결과가 ${n}건 있어요.\n결과를 계속 볼 수 있도록 설문지 내용은 남겨 두고, 목록과 [보내기]에서만 숨길까요?`))) return;
      c.hidden = true;
    } else {
      if (!(await OM.confirmBox(`"${name}"를 지울까요?\n되돌릴 수 없어요.`))) return;
      delete S.custom[id];
    }
    delete QMETA[id]; save(); go('forms');
  }
  async function confirmLeave(v) {
    if (!(await OM.confirmBox('저장하지 않은 내용이 있어요. 나갈까요?\n(작성 중인 내용은 이 기기에 임시 보관돼서 다음에 이어서 할 수 있어요)'))) return;
    dirty = false; leaving = true; go(v); leaving = false;
  }

  // ---------- 📚 모두에게 게시 (GitHub) ----------
  function gh() { try { const g = JSON.parse(localStorage.getItem(GHK) || 'null'); return g && g.token ? g : null; } catch (e) { return null; } }
  function guessRepo() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/); const seg = location.pathname.split('/').filter(Boolean)[0] || '';
    return { owner: m ? m[1] : '', repo: m && seg && !seg.includes('.') ? seg : '' };
  }
  const utf8b64 = t => { const b = new TextEncoder().encode(t); let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return btoa(s); };
  const b64utf8 = s => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, '')), c => c.charCodeAt(0)));
  async function ghFetch(g, method, path, body) {
    const r = await fetch(`https://api.github.com/repos/${g.owner}/${g.repo}${path}`, {
      method, cache: 'no-store', headers: { Authorization: 'Bearer ' + g.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined });
    if (r.status === 404 && method === 'GET' && path.startsWith('/contents/')) return null;
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.message || r.status); e.status = r.status; throw e; }
    return j;
  }
  const getFile = (g, p) => ghFetch(g, 'GET', `/contents/${p}?ref=${encodeURIComponent(g.branch)}&t=${Date.now()}`);
  const putFile = (g, p, text, sha, message) => ghFetch(g, 'PUT', `/contents/${p}`, Object.assign({ message, content: utf8b64(text), branch: g.branch }, sha ? { sha } : {}));
  const ghErr = e => e.status === 401 ? '토큰이 맞지 않거나 기간이 끝났어요. 설정에서 토큰을 다시 넣어 주세요.'
    : e.status === 403 ? '토큰에 쓰기 권한이 없어요. 토큰 권한의 Contents를 "Read and write"로 해 주세요.'
    : e.status === 404 ? '저장소를 찾을 수 없어요. 아이디·저장소 이름과 토큰의 저장소 선택을 확인해 주세요.'
    : '게시하지 못했어요. 인터넷을 확인하고 다시 시도해 주세요.\n(' + e.message + ')';

  function renderGhCard() {
    const el = document.getElementById('ghCard'); if (!el) return;
    const g = gh();
    el.innerHTML = g ? `<h2>📚 모두에게 게시 (GitHub)</h2><p class="sub">연결됨: <b>${esc(g.owner)}/${esc(g.repo)}</b> (${esc(g.branch)})<br>설문지 편집 화면에 [📚 모두에게 게시] 버튼이 보여요. 토큰은 이 기기에만 있고 백업·시트에 들어가지 않아요.</p>
        <div class="row"><button class="btn btn-line" onclick="ED.ghTest()">연결 확인</button><button class="btn btn-line" onclick="ED.ghSetup()">바꾸기</button><button class="btn btn-danger" onclick="ED.ghOff()">해제</button></div>`
      : `<h2>📚 모두에게 게시 (관리자용)</h2><p class="sub">GitHub 저장소 주인만 쓰는 기능이에요. 만든 설문지를 기본 설문지 목록에 올려서, 이 앱을 쓰는 모든 사람에게 보이게 해요. 토큰은 이 기기에만 저장되고 백업·시트에는 들어가지 않아요.</p>
        <button class="btn btn-line" onclick="ED.ghSetup()">GitHub 연결하기</button>`;
  }
  async function ghSetup() {
    const g = gh() || Object.assign({ branch: 'main' }, guessRepo());
    const ok = await OM.dialog('GitHub 연결', { cancel: true, okText: '저장', html:
      `<div class="sub" style="white-space:normal"><b>토큰 만드는 법</b> (PC 권장)<br>GitHub → 오른쪽 위 프로필 → Settings → 맨 아래 Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token<br>· Repository access: <b>Only select repositories</b> → 이 앱 저장소<br>· Permissions → Repository → <b>Contents: Read and write</b><br>· Generate 후 나온 토큰(github_pat_…)을 복사</div>
       <label class="field" for="ghO">GitHub 아이디</label><input id="ghO" type="text" autocomplete="off" value="${esc(g.owner || '')}">
       <label class="field" for="ghR">저장소 이름</label><input id="ghR" type="text" autocomplete="off" value="${esc(g.repo || '')}">
       <label class="field" for="ghB">브랜치</label><input id="ghB" type="text" autocomplete="off" value="${esc(g.branch || 'main')}">
       <label class="field" for="ghT">토큰</label><input id="ghT" type="password" autocomplete="off" placeholder="github_pat_…" value="${esc(g.token || '')}">` });
    if (!ok) return;
    const n = { owner: document.getElementById('ghO').value.trim(), repo: document.getElementById('ghR').value.trim(), branch: document.getElementById('ghB').value.trim() || 'main', token: document.getElementById('ghT').value.trim() };
    if (!n.owner || !n.repo || !n.token) { await OM.alertBox('아이디, 저장소 이름, 토큰을 모두 넣어 주세요.'); return; }
    try { localStorage.setItem(GHK, JSON.stringify(n)); } catch (e) {}
    renderGhCard(); await ghTest();
  }
  async function ghTest() {
    const g = gh(); if (!g) return;
    try {
      toast('확인하는 중…');
      const r = await ghFetch(g, 'GET', '');
      const cat = await getFile(g, 'catalog.json');
      if (r.permissions && !r.permissions.push) throw Object.assign(new Error('push'), { status: 403 });
      await OM.alertBox(cat ? `연결됐어요 ✅\n${g.owner}/${g.repo}${r.private ? '' : '\n\n※ 이 저장소는 Public이에요. 게시한 설문지는 누구나 볼 수 있으니, 원저작권·사용 허락을 확인한 설문지만 게시해 주세요.'}` : '저장소에는 연결됐지만 catalog.json이 없어요. 앱 파일이 올라간 저장소인지 확인해 주세요.');
    } catch (e) { await OM.alertBox(ghErr(e)); }
  }
  async function ghOff() { if (!(await OM.confirmBox('이 기기에서 GitHub 연결(토큰)을 지울까요?'))) return; try { localStorage.removeItem(GHK); } catch (e) {} renderGhCard(); }

  async function publish() {
    const g = gh(); if (!g) return;
    const d = cleaned(); const v = OM.validateQ(withId(d));
    if (v.errors.length) { await OM.alertBox('게시하기 전에 고칠 곳이 있어요:\n\n' + v.errors.join('\n')); return; }
    await ensureCatalog();
    const slug = from && from.pubId ? from.pubId : String(d.short || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const ok = await OM.dialog('📚 모두에게 게시', { cancel: true, okText: '게시', html:
      `<p class="sub">GitHub 저장소(${esc(g.owner)}/${esc(g.repo)})의 기본 설문지 목록에 올려요. 앱을 쓰는 모든 사람에게 보여요.</p>
       <label class="field" for="pbId">파일 이름 (영어 소문자·숫자·_)</label><input id="pbId" type="text" autocomplete="off" value="${esc(slug)}" placeholder="예: visa_p">
       <label class="field" for="pbJ">관절</label><select id="pbJ">${jointOptions(joint)}</select>
       <label class="field" for="pbN">목록에 보일 이름</label><input id="pbN" type="text" value="${esc(d.name + (d.short ? ` (${d.short})` : ''))}">
       <label class="field" for="pbM">목록 메모 (선택)</label><input id="pbM" type="text" value="${esc(d.scoring ? '' : '채점법 문서에 없음: 답변만 저장')}">
       <label class="ed-chk"><input type="checkbox" id="pbOk">원저작권·사용 허락을 확인했어요 (저장소가 Public이면 누구나 볼 수 있어요)</label>` });
    if (!ok) return;
    const id = document.getElementById('pbId').value.trim(), pj = document.getElementById('pbJ').value;
    const pname = document.getElementById('pbN').value.trim() || d.name, pnote = document.getElementById('pbM').value.trim();
    if (!document.getElementById('pbOk').checked) { await OM.alertBox('저작권·사용 허락 확인에 체크해 주세요.'); return; }
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(id)) { await OM.alertBox('파일 이름은 영어 소문자로 시작하고, 영어 소문자·숫자·_만 2~31자로 써 주세요.'); return; }
    try {
      toast('게시하는 중…');
      const path = `q/${id}.json`; const old = await getFile(g, path);
      if (old && !(await OM.confirmBox(id === (from && from.pubId)
        ? `기본 설문지 "${id}"를 이 내용으로 바꿀까요?\n이미 받은 결과의 총점은 저장 당시 점수가 유지되지만, 영역 점수·문항 비교는 새 내용으로 보여요.`
        : `"${id}" 이름의 설문지가 이미 있어요. 덮어쓸까요?`))) return;
      const def = Object.assign({ id }, d);
      await putFile(g, path, JSON.stringify(def, null, 1) + '\n', old && old.sha, `설문지 게시: ${pname}`);
      for (let tries = 0; tries < 2; tries++) {
        const cf = await getFile(g, 'catalog.json'); if (!cf) throw new Error('catalog.json 없음');
        const cat = JSON.parse(b64utf8(cf.content));
        cat.joints.forEach(j => j.items = j.items.filter(it => it.id !== id && !(from && from.pendingName && !it.id && it.name === from.pendingName)));
        let J = cat.joints.find(j => j.id === pj); if (!J) { J = { id: pj, name: '기타', items: [] }; cat.joints.push(J); }
        const item = { id, name: pname, status: d.scoring ? 'ready' : 'answers' }; if (pnote) item.note = pnote;
        J.items.push(item);
        try { await putFile(g, 'catalog.json', JSON.stringify(cat, null, 1) + '\n', cf.sha, `목록에 추가: ${pname}`); break; }
        catch (e) { if (tries || (e.status !== 409 && e.status !== 422)) throw e; }
      }
      if (cid && S.custom[cid]) { S.custom[cid].pub = id; save(); }
      CAT = null; delete QMETA[id]; dirty = false; clearDraft();
      await OM.alertBox(`게시했어요 ✅ (${id})\nGitHub Pages에 반영되기까지 1~2분 걸려요. 다른 사람은 앱을 새로 열면 보여요.${cid ? '\n\n같은 내용의 내 설문지는 [보내기]에서 숨겨져요 (중복 방지). 이미 받은 결과는 그대로 볼 수 있어요.' : ''}`);
      leaving = true; go('forms'); leaving = false;
    } catch (e) { await OM.alertBox(ghErr(e)); }
  }

  return {
    get dirty() { return dirty; }, get leaving() { return leaving; },
    render, newBlank, editCustom, copyPublished, act, autoRange, extreme, test, testCustom, closeTest, preview,
    openAI, pasteAI, copyPrompt, applyJson, saveMine, removeCustom, confirmLeave,
    renderGhCard, ghSetup, ghTest, ghOff, publish,
    _t: { textToOpts, optsToText, numsToIds, idsToNums, normalize, parseLoose, fingerprint, PROMPT }
  };
})();
