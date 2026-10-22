/**
 * 階段 10 探測：邊界與韌性。
 *
 * 這一階段問的是「我亂搞之後救得回來嗎？」。只看四件事：
 *   1. 沒存就重載 → 丟掉什麼、有沒有警告
 *   2. 舊存檔／殘缺存檔 → 讀不讀得進來、會不會炸
 *   3. 超長輸入 → 卡面撐不撐得住
 *   4. 390px → 還走不走得完 8 步
 *
 * 純探測，不寫斷言。量到的東西再挑成 stage10.mjs 的關卡。
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './cdp.mjs';
import { BASE, OUT_ROOT, openWorkshop, newNpc, gotoStep, setValue, snap, section, note, report, dumpErrors, armDialog } from './lib.mjs';

const STAGE = 'stage10-probe';
const api = await launch();
armDialog(api, { accept: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async (ms = 450) => {
  await sleep(ms);
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  await sleep(120);
};

const clickText = async (text, waitMs = 700) => {
  const target = JSON.stringify(text);
  const find = `[...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${target})`;
  for (let attempt = 0; attempt < 3; attempt++) {
    await api.eval(`(() => { const b = ${find}; if (b) b.scrollIntoView({ block: 'center' }); })()`);
    await sleep(260);
    const info = await api.eval(`(() => {
      const b = ${find};
      if (!b) return { found: false };
      const r = b.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      const hit = document.elementFromPoint(x, y);
      return { found: true, x, y, hitIsSelf: hit ? hit.closest('button') === b : false };
    })()`);
    if (!info.found) return { ok: false, mode: 'none' };
    if (info.hitIsSelf) { await api.clickAt(info.x, info.y); await settle(waitMs); return { ok: true, mode: 'mouse' }; }
    await api.clickAt(6, 6);
    await settle(300);
  }
  const ok = await api.eval(`(() => { const b = ${find}; if (!b) return false; b.click(); return true; })()`);
  await settle(waitMs);
  return { ok, mode: 'programmatic' };
};

const body = () => api.eval(`document.body.innerText`);
const hasBoundary = () => api.eval(`document.body.innerText.includes('遭遇了阻礙')`);
const boundaryTitle = () => api.eval(`(() => { const t = document.body.innerText; const i = t.indexOf('遭遇了阻礙'); return i >= 0 ? t.slice(Math.max(0, i - 20), i + 120).replace(/\\n+/g, ' | ') : null; })()`);
const libRaw = () => api.eval(`(() => { const r = localStorage.getItem('monogatari_techou_npc_library'); return r === null ? null : { len: r.length, head: r.slice(0, 60) }; })()`);
const libTotal = () => api.eval(`(() => { try { const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]'); return Array.isArray(a) ? a.length : -1; } catch { return -1; } })()`);
const names = () => api.eval(`[...document.querySelectorAll('h3')].map((e) => e.innerText.trim())`);
const hasBoundarySrc = fs.existsSync('src') ? null : null;

const boot = async (seed) => {
  await api.goto(BASE, { timeout: 30000 });
  if (seed) await api.eval(seed);
  await api.goto(BASE, { timeout: 30000 });
  await sleep(900);
};

// ════════════════════════════════════════════════════════════
section('P0 基線：清空並造一張卡');
await boot(`(() => {
  Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k));
  return true;
})()`);
note('清空後 libRaw', JSON.stringify(await libRaw()));
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await setValue(api, 'input[placeholder="輸入名稱..."]', '基線卡');
await settle(300);
await clickText('儲存', 900);
await sleep(700);
note('存檔後筆數', String(await libTotal()));

// ── P1 沒存就重載 ────────────────────────────────────────────
section('P1 未存草稿：填了六步不存，然後重載');
await clickText('建立新 NPC', 900);
await gotoStep(api, 7);
await setValue(api, 'input[placeholder="輸入名稱..."]', '還沒存就被我搞丟的卡');
await setValue(api, 'textarea[placeholder*="起源"]', '這段故事在重載後還在嗎？');
await settle(400);
note('重載前：畫面有名字嗎', String((await body()).includes('還沒存就被我搞丟的卡')));
note('重載前：localStorage 筆數', String(await libTotal()));
await api.goto(BASE, { timeout: 30000 });
await sleep(1000);
note('重載後：筆數', String(await libTotal()));
note('重載後：還看得到那個名字嗎', String((await body()).includes('還沒存就被我搞丟的卡')));
note('重載後：落在哪一頁（首 120 字）', JSON.stringify((await body()).slice(0, 120).replace(/\n+/g, ' | ')));
await openWorkshop(api, { stage: STAGE });
note('重載後：檔案庫卡片', JSON.stringify(await names()));

// ── P2 舊鍵遷移 ─────────────────────────────────────────────
section('P2 舊鍵遷移（fabula-npc-library-v2 → 權威鍵）');
const LEGACY_CARD = {
  id: 'legacy_1',
  name: '舊世代守衛',
  role: '暴徒',
  rank: '士兵',
  level: 10,
  selectedSpeciesId: 'undead',
  speciesConfig: {},
  traits: '不死',
  story: '舊存檔帶過來的故事。',
  tactics: '舊存檔帶過來的戰術。',
  skills: [{ id: 's1', name: '揮擊⚡', category: 'action', source: 'base', description: '造成傷害' }],
  affinities: {},
  selectedNegativeSkills: [],
  linkedNpcs: [],
};
await boot(`(() => {
  Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k));
  localStorage.setItem('fabula-npc-library-v2', ${JSON.stringify(JSON.stringify([LEGACY_CARD]))});
  return true;
})()`);
note('遷移後：權威鍵', JSON.stringify(await libRaw()));
note('遷移後：舊鍵還在嗎', String(await api.eval(`localStorage.getItem('fabula-npc-library-v2') !== null`)));
await openWorkshop(api, { stage: STAGE });
note('遷移後：檔案庫卡片', JSON.stringify(await names()));
note('遷移後：舊卡的技能名（哨兵是否被清）', JSON.stringify(await api.eval(`(() => {
  const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]');
  const c = a[0] || {};
  return { name: c.name, lv: c.level, skills: (c.skills || []).map((s) => s.name), story: !!c.story, tactics: !!c.tactics };
})()`)));

// ── P3 殘缺卡（只有 id 和名字）────────────────────────────────
section('P3 殘缺卡：只有 id 與 name');
await boot(`(() => {
  Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k));
  localStorage.setItem('monogatari_techou_npc_library', JSON.stringify([{ id: 'bare_1', name: '只有名字' }]));
  return true;
})()`);
await openWorkshop(api, { stage: STAGE });
note('殘缺卡：檔案庫卡片', JSON.stringify(await names()));
note('殘缺卡：有 ErrorBoundary 嗎', String(await hasBoundary()));
const editBare = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '編輯');
  if (!b) return false; b.click(); return true;
})()`);
note('殘缺卡：點得到編輯嗎', String(editBare));
await settle(900);
note('殘缺卡：編輯後有 ErrorBoundary 嗎', String(await hasBoundary()));
if (await hasBoundary()) note('殘缺卡：ErrorBoundary 標題', JSON.stringify(await boundaryTitle()));
if (!(await hasBoundary())) {
  const stepWalk = [];
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
    try { await gotoStep(api, n); stepWalk.push(n); } catch { stepWalk.push('X' + n); }
  }
  note('殘缺卡：八步走過', JSON.stringify(stepWalk));
  note('殘缺卡：走完有 ErrorBoundary 嗎', String(await hasBoundary()));
  const pv = await clickText('角色卡預覽', 900);
  note('殘缺卡：預覽可按', String(pv.ok));
  note('殘缺卡：預覽有 ErrorBoundary 嗎', String(await hasBoundary()));
  if (await hasBoundary()) note('殘缺卡：預覽 ErrorBoundary 標題', JSON.stringify(await boundaryTitle()));
  await snap(api, STAGE, 'P3-bare-card');
}

// ── P4 壞型別卡 ─────────────────────────────────────────────
section('P4 壞型別卡：關鍵欄位是 null');
await boot(`(() => {
  Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k));
  localStorage.setItem('monogatari_techou_npc_library', JSON.stringify([{
    id: 'bad_1', name: '壞型別', role: '暴徒', rank: '士兵', level: 10,
    skills: null, speciesConfig: null, affinities: null, linkedNpcs: null,
    selectedNegativeSkills: null, selectedBossSkills: null, customRules: null,
    attributes: null, story: null, tactics: null, traits: null,
  }]));
  return true;
})()`);
note('壞型別：有 ErrorBoundary 嗎', String(await hasBoundary()));
await openWorkshop(api, { stage: STAGE });
note('壞型別：檔案庫卡片', JSON.stringify(await names()));
note('壞型別：開工坊後有 ErrorBoundary 嗎', String(await hasBoundary()));
if (await hasBoundary()) note('壞型別：ErrorBoundary 標題', JSON.stringify(await boundaryTitle()));
else {
  const b2 = await api.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '編輯'); if (!b) return false; b.click(); return true; })()`);
  await settle(900);
  note('壞型別：編輯可按', String(b2));
  note('壞型別：編輯後有 ErrorBoundary 嗎', String(await hasBoundary()));
  if (await hasBoundary()) note('壞型別：編輯 ErrorBoundary 標題', JSON.stringify(await boundaryTitle()));
  else {
    const walk = [];
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) { try { await gotoStep(api, n); walk.push(n); } catch { walk.push('X' + n); } }
    note('壞型別：八步走過', JSON.stringify(walk));
    await clickText('角色卡預覽', 900);
    note('壞型別：預覽有 ErrorBoundary 嗎', String(await hasBoundary()));
    if (await hasBoundary()) note('壞型別：預覽 ErrorBoundary 標題', JSON.stringify(await boundaryTitle()));
    await snap(api, STAGE, 'P4-bad-types');
  }
}

// ── P5 超長文本 ─────────────────────────────────────────────
section('P5 超長文本');
await boot(`(() => {
  Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k));
  return true;
})()`);
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
const LONG_NAME = '灰'.repeat(120);
await setValue(api, 'input[placeholder="輸入名稱..."]', LONG_NAME);
await setValue(api, 'input[placeholder*="敏捷"]', '特'.repeat(400));
await setValue(api, 'textarea[placeholder*="起源"]', '故'.repeat(6000));
await settle(500);
note('超長：名字欄位長度', await api.eval(`(() => { const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('輸入名稱')); return i ? i.value.length : -1; })()`));
note('超長：故事欄位長度', await api.eval(`(() => { const t = [...document.querySelectorAll('textarea')].find((x) => (x.placeholder || '').includes('起源')); return t ? t.value.length : -1; })()`));
await gotoStep(api, 8);
await setValue(api, 'textarea', '戰'.repeat(3000));
await settle(400);
await clickText('儲存', 900);
await sleep(700);
note('超長：存檔後筆數', String(await libTotal()));
note('超長：存檔後 localStorage 大小', await api.eval(`(localStorage.getItem('monogatari_techou_npc_library') || '').length`));
await clickText('角色卡預覽', 1000);
note('超長：預覽有 ErrorBoundary 嗎', String(await hasBoundary()));
const overflow = await api.eval(`(() => {
  const el = document.querySelector('.border-double');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), scrollW: el.scrollWidth, clientW: el.clientWidth, docScrollW: document.documentElement.scrollWidth, winW: window.innerWidth };
})()`);
note('超長：卡面尺寸與溢出', JSON.stringify(overflow));
note('超長：卡片有沒有把整頁撐出橫向捲軸', String(await api.eval(`document.documentElement.scrollWidth > window.innerWidth + 2`)));
await snap(api, STAGE, 'P5-long-text');

// ── P6 390px 手機版 ─────────────────────────────────────────
section('P6 390px 手機版');
await api.viewport(390, 844);
await sleep(700);
await clickText('返回檔案庫', 900);
note('390：有 ErrorBoundary 嗎', String(await hasBoundary()));
note('390：檔案庫看得到卡嗎', JSON.stringify(await names()));
const mobLib = await api.eval(`({ docW: document.documentElement.scrollWidth, winW: window.innerWidth, overflowX: document.documentElement.scrollWidth > window.innerWidth + 2 })`);
note('390：檔案庫橫向溢出', JSON.stringify(mobLib));
await snap(api, STAGE, 'P6-mobile-library');
const mobNew = await clickText('建立新 NPC', 900);
note('390：建立新 NPC 可按', String(mobNew.ok));
const walkM = [];
for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
  try { await gotoStep(api, n); walkM.push(n); } catch { walkM.push('X' + n); }
}
note('390：八步走過', JSON.stringify(walkM));
const mobBuild = await api.eval(`({ docW: document.documentElement.scrollWidth, winW: window.innerWidth, overflowX: document.documentElement.scrollWidth > window.innerWidth + 2 })`);
note('390：構築頁橫向溢出', JSON.stringify(mobBuild));
await snap(api, STAGE, 'P6-mobile-build');
await clickText('角色卡預覽', 900);
const mobPv = await api.eval(`({ docW: document.documentElement.scrollWidth, winW: window.innerWidth, overflowX: document.documentElement.scrollWidth > window.innerWidth + 2 })`);
note('390：預覽橫向溢出', JSON.stringify(mobPv));
await snap(api, STAGE, 'P6-mobile-preview');
await api.viewport(1440, 1000);
await sleep(600);

// ── P7 等級選項 ─────────────────────────────────────────────
section('P7 等級：能不能填任意等級');
await boot(`(() => {
  Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k));
  return true;
})()`);
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 2);
const lvUi = await api.eval(`(() => {
  const btns = [...document.querySelectorAll('button')].filter((b) => /^Lv\\.?\\s*\\d+$/.test((b.innerText || '').replace(/\\s+/g, ' ').trim()));
  const nums = [...document.querySelectorAll('input[type="number"]')].map((i) => ({ ph: i.placeholder, min: i.min, max: i.max, val: i.value }));
  const ranges = [...document.querySelectorAll('input[type="range"]')].map((i) => ({ min: i.min, max: i.max, val: i.value }));
  const selects = [...document.querySelectorAll('select')].map((s) => [...s.options].map((o) => o.text));
  return { lvButtons: btns.map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim()), numbers: nums, ranges, selects };
})()`);
note('等級：可選按鈕', JSON.stringify(lvUi.lvButtons));
note('等級：數字輸入框', JSON.stringify(lvUi.numbers));
note('等級：滑桿', JSON.stringify(lvUi.ranges));
note('等級：下拉選單', JSON.stringify(lvUi.selects));
await snap(api, STAGE, 'P7-level');

// ── P8 自由模式回退（GM-04-03 已修，驗證）─────────────────────
section('P8 自由模式：改值後切回嚴謹模式');
await gotoStep(api, 4);
const freeToggle = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /自由模式|嚴謹模式/.test(x.innerText || ''));
  if (!b) return { found: false };
  b.click();
  return { found: true, label: (b.innerText || '').trim() };
})()`);
note('自由模式：切換鈕', JSON.stringify(freeToggle));
await settle(700);
note('自由模式：有確認框嗎', String((await body()).includes('FREE EDIT MODE') || (await body()).includes('自由編輯')));
await snap(api, STAGE, 'P8-free-mode');
note('自由模式：畫面上有自訂骰子嗎', String((await body()).includes('自訂') || (await body()).includes('custom')));

dumpErrors(api);
report('階段 10 探測（邊界與韌性）');
await api.close();
