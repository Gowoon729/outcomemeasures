// 설문 작성 화면 (환자 링크 survey.html 과 치료사 앱의 현장 작성에서 함께 사용)
// OM.runSurvey({ root, qs, answers, onChange(answers), onFinish(results, date) })
(function () {
  const esc = OM.esc;

  function runSurvey(opt) {
    const { root, qs } = opt;
    const answers = opt.answers || {};
    qs.forEach(q => { answers[q.id] = answers[q.id] || {}; });
    let step = 0;

    root.innerHTML = `
      <div class="sub" data-r="step"></div>
      <div class="progress"><div data-r="bar"></div></div>
      <h2 data-r="title" style="margin-top:8px"></h2>
      <div data-r="src"></div>
      <p class="sub" data-r="intro"></p>
      <div data-r="body"></div>
      <button class="btn btn-main" data-r="next">다음</button>
      <button class="btn btn-line" data-r="prev">이전</button>`;
    const $ = k => root.querySelector(`[data-r="${k}"]`);
    $('next').onclick = next; $('prev').onclick = prev;

    function render() {
      const q = qs[step], a = answers[q.id];
      $('step').innerText = `설문 ${step + 1} / ${qs.length}`;
      $('bar').style.width = (step / qs.length * 100) + '%';
      $('title').innerText = q.name;
      $('src').innerHTML = OM.qSourceHtml(q);
      $('intro').innerText = q.intro || '';
      let html = '';
      q.sections.forEach(sec => {
        if (sec.title) html += `<div class="sec-title">${esc(sec.title)}</div>`;
        if (sec.desc) html += `<p class="sub sec-desc">${esc(sec.desc)}</p>`;
        sec.items.forEach(it => {
          html += `<div class="q" data-q="${esc(it.id)}">${esc(it.q)}</div>`;
          if (it.input) {
            const t = it.input.type === 'number' ? 'number' : 'text';
            html += `<div class="inrow"><input type="${t}" ${t === 'number' ? 'inputmode="decimal" step="any"' : ''} data-in="${esc(it.id)}" value="${a[it.id] === undefined || a[it.id] === null ? '' : esc(a[it.id])}" placeholder="${esc(it.input.placeholder || '')}">${it.input.unit ? `<span>${esc(it.input.unit)}</span>` : ''}</div>`;
          } else if (it.options) {
            html += `<div class="opts">` + it.options.map((o, j) => `<button type="button" class="${a[it.id] === j ? 'on' : ''}" data-i="${esc(it.id)}" data-v="${j}">${esc(o.label)}</button>`).join('') + `</div>`;
          } else {
            let b = ''; for (let v = it.scale.min; v <= it.scale.max; v++) b += `<button type="button" class="${a[it.id] === v ? 'on' : ''}" data-i="${esc(it.id)}" data-v="${v}">${v}</button>`;
            html += `<div class="scale">${b}</div><div class="scale-labels"><span>${esc(it.scale.minLabel || '')}</span><span>${esc(it.scale.maxLabel || '')}</span></div>`;
          }
          if (it.optional) html += `<button class="skip" type="button" data-skip="${esc(it.id)}">${a[it.id] === null ? '✔ 해당 없음으로 표시됨' : '해당 없음 (건너뛰기)'}</button>`;
        });
      });
      $('body').innerHTML = html;
      $('body').querySelectorAll('button[data-i]').forEach(btn => btn.onclick = () => {
        const id = btn.dataset.i;
        btn.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
        a[id] = +btn.dataset.v;
        const qEl = $('body').querySelector(`[data-q="${CSS.escape(id)}"]`); if (qEl) qEl.classList.remove('missing');
        const sk = $('body').querySelector(`[data-skip="${CSS.escape(id)}"]`); if (sk) sk.innerText = '해당 없음 (건너뛰기)';
        opt.onChange && opt.onChange(answers, step);
      });
      $('body').querySelectorAll('input[data-in]').forEach(inp => inp.oninput = () => {
        const it = OM.allItems(q).find(x => x.id === inp.dataset.in); const raw = inp.value.trim();
        if (raw === '') { delete a[it.id]; }
        else if (it.input.type === 'number') {
          const n = +raw; if (isNaN(n)) return;
          a[it.id] = n;
        } else a[it.id] = raw;
        const qEl = $('body').querySelector(`[data-q="${CSS.escape(it.id)}"]`); if (qEl) qEl.classList.remove('missing');
        const sk = $('body').querySelector(`[data-skip="${CSS.escape(it.id)}"]`); if (sk) sk.innerText = '해당 없음 (건너뛰기)';
        opt.onChange && opt.onChange(answers, step);
      });
      $('body').querySelectorAll('button[data-skip]').forEach(btn => btn.onclick = () => {
        const id = btn.dataset.skip; a[id] = null;
        btn.parentElement.querySelectorAll(`button[data-i="${CSS.escape(id)}"]`).forEach(b => b.classList.remove('on'));
        const inp = btn.parentElement.querySelector(`input[data-in="${CSS.escape(id)}"]`); if (inp) inp.value = '';
        btn.innerText = '✔ 해당 없음으로 표시됨';
        opt.onChange && opt.onChange(answers, step);
      });
      $('prev').style.display = step === 0 ? 'none' : '';
      $('next').innerText = step === qs.length - 1 ? '완료' : '다음';
    }
    function next() {
      const q = qs[step], a = answers[q.id];
      const bad = OM.allItems(q).find(it => it.input && it.input.type === 'number' && typeof a[it.id] === 'number' && ((it.input.min !== undefined && a[it.id] < it.input.min) || (it.input.max !== undefined && a[it.id] > it.input.max)));
      if (bad) { OM.alertBox(`"${bad.q}"에는 ${bad.input.min}~${bad.input.max} 사이 숫자를 넣어 주세요.`); return; }
      const miss = OM.allItems(q).filter(it => a[it.id] === undefined);
      if (miss.length) {
        miss.forEach(it => { const el = $('body').querySelector(`[data-q="${CSS.escape(it.id)}"]`); if (el) el.classList.add('missing'); });
        const first = $('body').querySelector(`[data-q="${CSS.escape(miss[0].id)}"]`);
        if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        OM.alertBox(`답하지 않은 문항이 ${miss.length}개 있어요. 빨간 글씨 문항을 확인해 주세요.`);
        return;
      }
      if (step < qs.length - 1) { step++; render(); window.scrollTo(0, 0); opt.onChange && opt.onChange(answers, step); return; }
      $('bar').style.width = '100%';
      const date = OM.nowStr();
      opt.onFinish(qs.map(q => toResult(q, answers[q.id])), date);
    }
    function prev() { if (step > 0) { step--; render(); window.scrollTo(0, 0); } }
    render();
    return { goto(n) { step = n; render(); } };
  }

  // 보기 번호(picks)와 점수(vals)로 나눠 결과 만들기
  function toResult(q, a) {
    const vals = {}, picks = {};
    OM.allItems(q).forEach(it => {
      const v = a[it.id];
      if (v === null || v === undefined) { vals[it.id] = null; return; }
      if (it.options) { picks[it.id] = v; vals[it.id] = it.options[v].score ?? null; }
      else vals[it.id] = v;
    });
    return { q: q.id, a: picks, v: vals, s: OM.score(q, vals).score };
  }

  OM.runSurvey = runSurvey;
})();
