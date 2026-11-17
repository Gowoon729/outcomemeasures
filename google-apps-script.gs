/**
 * 아웃컴 메저 – 구글 시트 팀 모드 서버 (v3)
 *
 * [설치 방법]  구글 시트(웹) → 확장 프로그램 → Apps Script
 *  1) 이 파일 내용을 전부 붙여넣고 저장 (💾)
 *  2) 위쪽 함수 선택 칸에서 'setup' 선택 → ▶ 실행 → (처음엔 권한 허용)
 *  3) 시트에 'members' 탭이 생기고, 거기에 '관리자 키'가 적혀 있습니다. (이게 내 열쇠)
 *  4) 배포 → 새 배포 → 유형: 웹 앱 → 실행 계정: 나 / 액세스: 모든 사용자 → 배포
 *  5) 나온 '웹 앱 URL'과 관리자 키를 아웃컴 메저 [설정 → 구글 시트 연결]에 입력
 *
 * ※ 코드를 고친 뒤에는 [배포 → 배포 관리 → ✏️ → 버전: 새 버전 → 배포]를 해야 반영됩니다.
 * ※ 이 시트 파일 자체를 팀원에게 공유하지 마세요. 시트를 열 수 있는 사람은 모든 기록이 보입니다.
 *    팀원에게는 '웹 앱 URL + 본인 키'만 주면 됩니다.
 */

const T_MEMBERS = 'members', T_STORE = 'store', T_INBOX = 'inbox', T_INFO = 'info';
const MAX_CODE = 45000;      // 셀 하나 한도(5만 자) 안쪽
const MAX_PENDING = 500;     // 한 사람 앞으로 쌓일 수 있는 미수신 결과 수
const SERVER_VER = 3;        // v3: 내 설문지(getq) 지원

// ---------- 시트 도우미 ----------
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name, header) {
  let s = ss_().getSheetByName(name);
  if (!s) { s = ss_().insertSheet(name); if (header) { s.appendRow(header); s.setFrozenRows(1); } }
  return s;
}
function readAll_(sh, cols) {
  const n = sh.getLastRow();
  return n > 1 ? sh.getRange(2, 1, n - 1, cols).getValues() : [];
}
function randKey_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 28); }
function str_(v) { return v === null || v === undefined ? '' : String(v); }

// ---------- 최초 설정 / 메뉴 ----------
function setup() {
  const m = sheet_(T_MEMBERS, ['id', '이름', '키(비밀)', '역할', '만든 시각']);
  sheet_(T_STORE, ['member', 'key', 'u', 'st', 'del', 'json']);
  sheet_(T_INBOX, ['id', '받은 시각', 'member', '환자 코드', '작성 시각', '결과 코드', '상태']);
  const info = sheet_(T_INFO, null);
  if (!info.getRange('A1').getValue()) { info.getRange('A1').setValue('팀 이름'); info.getRange('B1').setValue('우리 팀'); }
  if (!readAll_(m, 5).length) {
    m.appendRow([newId_(m), '관리자', randKey_(), 'admin', new Date().toISOString()]);
  }
  m.activate();
  return '설정 완료: members 탭의 관리자 키를 확인하세요.';
}
function newId_(m) {
  const used = {}; readAll_(m, 1).forEach(r => used[str_(r[0])] = 1);
  let id; do { id = 'm' + Math.floor(Math.random() * 36 * 36 * 36 * 36).toString(36).padStart(4, '0'); } while (used[id]);
  return id;
}
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('아웃컴 메저')
      .addItem('처음 설정 (한 번만)', 'setup')
      .addItem('팀원 추가', 'menuAdd_')
      .addToUi();
  } catch (e) {}
}
function menuAdd_() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('추가할 팀원 이름');
  if (r.getSelectedButton() !== ui.Button.OK || !r.getResponseText().trim()) return;
  const m = sheet_(T_MEMBERS, ['id', '이름', '키(비밀)', '역할', '만든 시각']);
  const key = randKey_();
  m.appendRow([newId_(m), r.getResponseText().trim(), key, 'member', new Date().toISOString()]);
  ui.alert('추가했습니다.\n이 팀원의 키: ' + key + '\n(members 탭에서도 볼 수 있어요)');
}

// ---------- 웹 앱 진입점 ----------
function doGet() {
  return ContentService.createTextOutput('아웃컴 메저 서버가 동작 중입니다.');
}
function doPost(e) {
  let out;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const req = JSON.parse(e.postData.contents);
    out = route_(req);
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function route_(req) {
  if (req.a === 'submit') return submit_(req);                       // 환자: 열쇠 없이 '보내기'만 가능
  if (req.a === 'getq') return getq_(req);                           // 환자: '내 설문지' 문항 받아 가기 (환자 기록은 안 줌)
  const m = findMember_(req.key);
  if (!m) return { ok: false, error: 'auth' };
  switch (req.a) {
    case 'ping': return { ok: true, sv: SERVER_VER, me: { id: m.id, name: m.name, role: m.role }, team: team_() };
    case 'sync': return sync_(m, req);
    case 'ack': return ack_(m, req.ids || []);
    case 'members': return members_(m, req);
  }
  return { ok: false, error: 'unknown' };
}

function team_() { return str_(sheet_(T_INFO, null).getRange('B1').getValue()) || '우리 팀'; }

function findMember_(key) {
  key = str_(key); if (!key) return null;
  const rows = readAll_(sheet_(T_MEMBERS, ['id', '이름', '키(비밀)', '역할', '만든 시각']), 5);
  for (let i = 0; i < rows.length; i++) {
    if (str_(rows[i][2]) === key) return { id: str_(rows[i][0]), name: str_(rows[i][1]), role: str_(rows[i][3]) === 'admin' ? 'admin' : 'member', row: i + 2 };
  }
  return null;
}

// ---------- 환자 결과 접수 ----------
function submit_(req) {
  const t = str_(req.t), p = str_(req.p), d = str_(req.d), code = str_(req.code);
  if (!/^[A-Za-z0-9-]{1,24}$/.test(p) || code.indexOf('OMR1.') !== 0 || code.length > MAX_CODE) return { ok: false, error: 'bad' };
  const members = readAll_(sheet_(T_MEMBERS, ['id', '이름', '키(비밀)', '역할', '만든 시각']), 5);
  if (!members.some(r => str_(r[0]) === t)) return { ok: false, error: 'nomember' };
  const sh = sheet_(T_INBOX, ['id', '받은 시각', 'member', '환자 코드', '작성 시각', '결과 코드', '상태']);
  const rows = readAll_(sh, 7);
  let pending = 0;
  for (let i = 0; i < rows.length; i++) {
    if (str_(rows[i][2]) !== t) continue;
    if (str_(rows[i][6]) === '') { pending++; if (str_(rows[i][5]) === code) return { ok: true, dup: true }; }
  }
  if (pending >= MAX_PENDING) return { ok: false, error: 'full' };
  sh.appendRow([Utilities.getUuid().slice(0, 8), new Date().toISOString(), t, p, d.slice(0, 20), code, '']);
  return { ok: true };
}
// 치료사가 만든 '내 설문지'의 문항만 돌려줌 (store 의 c:설문id 행, 요청한 버전만)
function getq_(req) {
  const t = str_(req.t), id = str_(req.id), v = str_(req.v);
  if (!/^u_[A-Za-z0-9]{1,20}$/.test(id)) return { ok: false, error: 'bad' };
  const rows = readAll_(sheet_(T_STORE, ['member', 'key', 'u', 'st', 'del', 'json']), 6);
  for (let i = 0; i < rows.length; i++) {
    if (str_(rows[i][0]) !== t || str_(rows[i][1]) !== 'c:' + id || Number(rows[i][4]) === 1) continue;
    let c; try { c = JSON.parse(str_(rows[i][5])); } catch (e) { return { ok: false, error: 'bad' }; }
    const def = c && c.vers && c.vers[v || c.cur];
    return def ? { ok: true, q: def } : { ok: false, error: 'none' };
  }
  return { ok: false, error: 'none' };
}
function ack_(m, ids) {
  const sh = sheet_(T_INBOX, ['id', '받은 시각', 'member', '환자 코드', '작성 시각', '결과 코드', '상태']);
  const rows = readAll_(sh, 7); const set = {}; ids.forEach(i => set[str_(i)] = 1);
  let n = 0;
  rows.forEach((r, i) => {
    if (str_(r[2]) === m.id && set[str_(r[0])] && str_(r[6]) === '') { sh.getRange(i + 2, 6, 1, 2).setValues([['', '처리됨']]); n++; }
  });
  return { ok: true, n: n };
}

// ---------- 동기화 ----------
// 요청: {a:'sync', key, since, put:{키:{u,j}}, del:{키:u}}
// 응답: {ok, now, items:[{k,u,del,j}], inbox:[{id,code}]}
function sync_(m, req) {
  const sh = sheet_(T_STORE, ['member', 'key', 'u', 'st', 'del', 'json']);
  const rows = readAll_(sh, 6);
  const origLen = rows.length;
  const idx = {};
  rows.forEach((r, i) => { if (str_(r[0]) === m.id) idx[str_(r[1])] = i; });
  const now = Date.now(), since = Number(req.since) || 0;
  const touched = {}, forced = {}, changedOld = [];

  const apply = (k, u, del, j) => {
    u = Number(u) || 0;
    const i = idx[k];
    if (i !== undefined && Number(rows[i][2]) >= u) { forced[k] = 1; return; }   // 서버 쪽이 더 최신 → 되돌려 보냄
    const row = [m.id, k, u, now, del ? 1 : 0, del ? '' : str_(j)];
    if (i !== undefined) { rows[i] = row; if (i < origLen) changedOld.push(i); }
    else { rows.push(row); idx[k] = rows.length - 1; }
    touched[k] = 1;
  };
  const put = req.put || {}, del = req.del || {};
  Object.keys(put).forEach(k => apply(k, put[k].u, false, put[k].j));
  Object.keys(del).forEach(k => apply(k, del[k], true, ''));

  if (changedOld.length > 20) {
    sh.getRange(2, 1, rows.length, 6).setValues(rows);
  } else {
    changedOld.forEach(i => sh.getRange(i + 2, 1, 1, 6).setValues([rows[i]]));
    if (rows.length > origLen) sh.getRange(origLen + 2, 1, rows.length - origLen, 6).setValues(rows.slice(origLen));
  }

  const items = [];
  rows.forEach(r => {
    if (str_(r[0]) !== m.id) return;
    const k = str_(r[1]);
    if (touched[k]) return;
    if (forced[k] || Number(r[3]) > since) items.push({ k: k, u: Number(r[2]), del: Number(r[4]) === 1, j: str_(r[5]) });
  });

  const inbox = [];
  readAll_(sheet_(T_INBOX, ['id', '받은 시각', 'member', '환자 코드', '작성 시각', '결과 코드', '상태']), 7).forEach(r => {
    if (str_(r[2]) === m.id && str_(r[6]) === '' && str_(r[5])) inbox.push({ id: str_(r[0]), code: str_(r[5]) });
  });
  return { ok: true, sv: SERVER_VER, now: now, items: items, inbox: inbox };
}

// ---------- 팀원 관리 (관리자만) ----------
function members_(me, req) {
  if (me.role !== 'admin') return { ok: false, error: 'admin' };
  const sh = sheet_(T_MEMBERS, ['id', '이름', '키(비밀)', '역할', '만든 시각']);
  const rows = readAll_(sh, 5);
  const find = id => rows.findIndex(r => str_(r[0]) === str_(id));
  switch (req.op) {
    case 'list':
      return { ok: true, team: team_(), list: rows.map(r => ({ id: str_(r[0]), name: str_(r[1]), key: str_(r[2]), role: str_(r[3]) === 'admin' ? 'admin' : 'member' })) };
    case 'add': {
      const name = str_(req.name).trim().slice(0, 30); if (!name) return { ok: false, error: 'bad' };
      const key = randKey_(), id = newId_(sh);
      sh.appendRow([id, name, key, 'member', new Date().toISOString()]);
      return { ok: true, id: id, name: name, key: key };
    }
    case 'rekey': {
      const i = find(req.id); if (i < 0) return { ok: false, error: 'none' };
      const key = randKey_(); sh.getRange(i + 2, 3).setValue(key);
      return { ok: true, key: key };
    }
    case 'rename': {
      const i = find(req.id); if (i < 0) return { ok: false, error: 'none' };
      sh.getRange(i + 2, 2).setValue(str_(req.name).trim().slice(0, 30));
      return { ok: true };
    }
    case 'team':
      sheet_(T_INFO, null).getRange('B1').setValue(str_(req.name).trim().slice(0, 40));
      return { ok: true };
    case 'remove': {
      const i = find(req.id); if (i < 0) return { ok: false, error: 'none' };
      if (str_(rows[i][3]) === 'admin') return { ok: false, error: 'admin' };
      if (req.purge) purge_(str_(req.id));
      sh.deleteRow(i + 2);
      return { ok: true };
    }
  }
  return { ok: false, error: 'unknown' };
}
function purge_(id) {
  [[T_STORE, 6, 0], [T_INBOX, 7, 2]].forEach(a => {
    const sh = sheet_(a[0], null); const rows = readAll_(sh, a[1]);
    for (let i = rows.length - 1; i >= 0; i--) if (str_(rows[i][a[2]]) === id) sh.deleteRow(i + 2);
  });
}
