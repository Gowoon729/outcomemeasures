/* 아웃컴 메저 – 구글 시트 팀 모드 연결 (치료사 앱 전용)
 * 연결하지 않으면 아무 일도 하지 않습니다. 연결 정보는 백업 파일에 들어가지 않도록 따로 보관합니다. */
const SYNC = (() => {
  const CK = 'om_sync_v1';
  let cfg = null, hooks = null, timer = null, busy = false, again = false, status = '';
  const listeners = [];

  function loadCfg() { try { cfg = JSON.parse(localStorage.getItem(CK) || 'null'); } catch (e) { cfg = null; } return cfg; }
  function saveCfg() { try { localStorage.setItem(CK, JSON.stringify(cfg)); } catch (e) {} }
  const connected = () => !!(cfg && cfg.url && cfg.key);
  const hash = s => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return x + ':' + s.length; };
  function emit() { listeners.forEach(f => { try { f(); } catch (e) {} }); }
  function setStatus(s) { status = s; emit(); }

  // 서버에 올릴 모양 (이름 동기화를 끄면 이름·메모는 비워서 올림)
  function forms(S) {
    const o = {};
    Object.values(S.patients).forEach(p => { o['p:' + p.code] = cfg.syncNames ? p : Object.assign({}, p, { name: '', memo: '' }); });
    S.results.forEach(r => { o['r:' + r.id] = r; });
    S.notes.forEach(n => { o['n:' + n.id] = n; });
    S.sent.forEach(s => { o['s:' + s.id] = s; });
    Object.entries((S.settings && S.settings.interp) || {}).forEach(([k, v]) => { o['i:' + k] = v; });
    Object.values(S.custom || {}).forEach(c => { if (JSON.stringify(c).length < 45000) o['c:' + c.id] = c; });   // 셀 한도 넘는 큰 설문은 올리지 않음(링크에 담아 보냄)
    return o;
  }

  // 저장할 때마다 호출: 무엇이 바뀌었는지(추가·수정·삭제)를 표시해 둔다.
  function touch(S) {
    if (!connected() || (hooks && hooks.applying)) return;
    const f = forms(S), now = Date.now();
    Object.keys(f).forEach(k => {
      const h = hash(JSON.stringify(f[k]));
      if (cfg.h[k] !== h) { cfg.h[k] = h; cfg.u[k] = now; cfg.dirty[k] = 1; delete cfg.del[k]; }
    });
    Object.keys(cfg.h).forEach(k => {
      if (!(k in f)) { delete cfg.h[k]; cfg.u[k] = now; cfg.del[k] = 1; delete cfg.dirty[k]; }
    });
    saveCfg(); schedule(3000);
  }
  function schedule(ms) { if (!connected()) return; clearTimeout(timer); timer = setTimeout(() => run(), ms); }

  async function call(req) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 40000);
    try {
      const r = await fetch(cfg.url, { method: 'POST', body: JSON.stringify(req), signal: ctl.signal });
      const j = await r.json();
      if (!j.ok) { const e = new Error(j.error || 'fail'); e.code = j.error; throw e; }
      return j;
    } finally { clearTimeout(to); }
  }

  // ----- 서버에서 받은 항목을 내 기록에 합치기 -----
  function applyItems(S, items) {
    let n = 0; hooks.applying = true;
    try {
      items.forEach(it => {
        const k = it.k, t = k[0], id = k.slice(2);
        if ((cfg.u[k] || 0) > it.u) return;                       // 내 쪽이 더 최신 → 내 것 유지(다음에 올라감)
        let obj = null; if (!it.del) { try { obj = JSON.parse(it.j); } catch (e) { return; } }
        const arr = { r: S.results, n: S.notes, s: S.sent }[t];
        if (t === 'p') {
          const cur = S.patients[id];
          if (it.del) { if (!cur) { cfg.u[k] = it.u; return; } delete S.patients[id]; }
          else {
            const mine = cur || {};
            S.patients[id] = Object.assign({}, obj, { name: obj.name || mine.name || '환자 ' + id, memo: obj.memo || mine.memo || '' });
          }
        } else if (t === 'i') {
          if (it.del) delete S.settings.interp[id]; else S.settings.interp[id] = obj;
        } else if (t === 'c') {
          S.custom = S.custom || {};
          if (it.del) delete S.custom[id]; else S.custom[id] = obj;
          if (hooks.onCustom) hooks.onCustom(id);
        } else if (arr) {
          const i = arr.findIndex(x => x.id === id);
          if (it.del) { if (i >= 0) arr.splice(i, 1); }
          else if (i >= 0) arr[i] = obj;
          else if (t === 'r' && arr.some(x => x.p === obj.p && x.d === obj.d && x.q === obj.q)) { /* 같은 결과가 이미 있음 */ }
          else arr.push(obj);
        } else return;
        // 받은 직후 상태를 '이미 서버와 같음'으로 기록해 되돌려 올리지 않게 한다
        cfg.u[k] = it.u; delete cfg.dirty[k]; delete cfg.del[k];
        if (it.del) delete cfg.h[k];
        else { const f = forms(S)[k]; if (f) cfg.h[k] = hash(JSON.stringify(f)); }
        n++;
      });
    } finally { hooks.applying = false; }
    return n;
  }

  async function run(manual) {
    if (!connected()) return;
    if (busy) { again = true; return; }
    busy = true; setStatus('동기화 중…');
    let got = 0, inboxN = 0;
    try {
      for (let loop = 0; loop < 30; loop++) {
        const S = hooks.getS(), f = forms(S);
        const put = {}, del = {}, sentU = {};
        let cnt = 0;
        for (const k of Object.keys(cfg.dirty)) { if (cnt >= 200) break; if (!f[k]) { delete cfg.dirty[k]; continue; } put[k] = { u: cfg.u[k], j: JSON.stringify(f[k]) }; sentU[k] = cfg.u[k]; cnt++; }
        for (const k of Object.keys(cfg.del)) { if (cnt >= 200) break; del[k] = cfg.u[k]; sentU[k] = cfg.u[k]; cnt++; }
        const res = await call({ a: 'sync', key: cfg.key, since: cfg.since, put, del });
        Object.keys(sentU).forEach(k => { if (cfg.u[k] === sentU[k]) { delete cfg.dirty[k]; delete cfg.del[k]; } });
        got += applyItems(hooks.getS(), res.items);
        cfg.since = res.now; if (res.sv) cfg.sv = res.sv; saveCfg();
        if (got) { hooks.save(); hooks.afterApply(); }
        if (res.inbox && res.inbox.length) {
          const ids = await hooks.onInbox(res.inbox);
          if (ids && ids.length) { inboxN += ids.length; await call({ a: 'ack', key: cfg.key, ids }); }
        }
        if (!Object.keys(cfg.dirty).length && !Object.keys(cfg.del).length) break;
      }
      cfg.last = Date.now(); cfg.err = ''; saveCfg();
      setStatus('');
      if (inboxN || got) hooks.afterApply();
      if (inboxN && hooks.toast) hooks.toast(`📥 새 결과 ${inboxN}건이 도착했어요`);
    } catch (e) {
      cfg.err = e.code === 'auth' ? '키가 맞지 않아요. 관리자에게 키를 다시 받아 주세요.' : (e.name === 'AbortError' ? '응답이 늦어요. 잠시 뒤 다시 시도됩니다.' : '연결하지 못했어요. 인터넷을 확인해 주세요.');
      saveCfg(); setStatus('');
      if (manual) throw e;
    } finally {
      busy = false;
      if (again) { again = false; schedule(1500); }
    }
  }

  // ----- 연결 · 해제 -----
  function normUrl(u) { u = String(u || '').trim(); return /^https?:\/\/\S+$/.test(u) ? u : ''; }
  async function connect(url, key, syncNames) {
    url = normUrl(url); key = String(key || '').trim();
    if (!url || !key) throw Object.assign(new Error('input'), { code: 'input' });
    const prev = cfg; cfg = { url, key };
    try {
      const r = await call({ a: 'ping', key });
      cfg = { url, key, me: r.me, team: r.team, sv: r.sv || 2, since: 0, syncNames: !!syncNames, h: {}, u: {}, dirty: {}, del: {}, last: 0, err: '' };
      saveCfg();
    } catch (e) { cfg = prev; throw e; }
    hooks.save();                       // 지금 있는 기록 전부를 '올릴 것'으로 표시
    return run(true);
  }
  function disconnect() { clearTimeout(timer); cfg = null; try { localStorage.removeItem(CK); } catch (e) {} emit(); }

  // 환자 링크에 붙일 값: 환자 화면이 결과를 바로 시트로 보낼 수 있게 함
  function linkParams() {
    if (!connected() || !cfg.me) return '';
    const m = cfg.url.match(/^https:\/\/script\.google\.com\/macros\/s\/([^/]+)\/exec$/);
    return '&s=' + encodeURIComponent(m ? m[1] : cfg.url) + '&t=' + encodeURIComponent(cfg.me.id);
  }
  // 내 설문지가 시트에서 받아 갈 수 있는 상태인지 (새 스크립트 + 올라가 있음)
  function customReady(id) { return connected() && cfg.me && (cfg.sv || 0) >= 3 && !cfg.dirty['c:' + id] && !!cfg.h['c:' + id]; }
  function pendingCustom() { return connected() ? Object.keys(cfg.dirty).some(k => k[0] === 'c') : false; }
  async function members(op, args) { return call(Object.assign({ a: 'members', key: cfg.key, op }, args || {})); }
  async function setSyncNames(on) {
    cfg.syncNames = !!on; Object.keys(cfg.h).forEach(k => { if (k[0] === 'p') delete cfg.h[k]; }); saveCfg();
    hooks.save(); schedule(500);
  }

  function attach(h) {
    hooks = Object.assign({ applying: false }, h); loadCfg();
    if (connected()) { cfg.h = cfg.h || {}; cfg.u = cfg.u || {}; cfg.dirty = cfg.dirty || {}; cfg.del = cfg.del || {}; schedule(800); }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(500); });
    setInterval(() => { if (document.visibilityState === 'visible') schedule(100); }, 60000);
  }
  const SV_NEED = 3;   // 이 앱이 기대하는 시트 스크립트 버전
  const scriptOld = () => !!(connected() && cfg.me && cfg.me.role === 'admin' && (cfg.sv || 0) < SV_NEED && !cfg.err);
  const info = () => cfg;
  const statusText = () => status;
  const onChange = f => listeners.push(f);
  return { scriptOld, customReady, pendingCustom, attach, touch, run, connect, disconnect, connected, info, statusText, onChange, linkParams, members, setSyncNames, normUrl };
})();
