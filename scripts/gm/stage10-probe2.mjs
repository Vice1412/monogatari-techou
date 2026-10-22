/**
 * 階段 10 探測之二：補量三件事。
 *   P5b 超長文本到底有沒有存進去（第一次量到 localStorage 只有 1382 bytes，可疑）
 *   P3b 殘缺卡崩在哪一行（讀 ErrorBoundary 的 componentStack）
 *   P6b 390px 用 gotoStepMobile 重走八步
 *   P9  殘缺卡崩掉之後，還有沒有退路（刪除／修復暫存）
 */
import fs from 'node:fs';
import { launch } from './cdp.mjs';
import { BASE, openWorkshop, newNpc, gotoStep, gotoStepMobile, setValue, snap, section, note, report, dumpErrors, armDialog } from './lib.mjs';

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
const stack = () => api.eval(`(() => { const p = document.querySelector('pre'); return p ? p.innerText.split('\\n').slice(0, 18).join('\\n') : null; })()`);
const libCard = () => api.eval(`(() => { const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]'); const c = a[0] || {}; return { keys: Object.keys(c).length, name: (c.name || '').length, traits: (c.traits || '').length, story: (c.story || '').length, tactics: (c.tactics || '').length, skills: (c.skills || []).length, rawLen: (localStorage.getItem('monogatari_techou_npc_library') || '').length }; })()`);

const boot = async (seed) => {
  await api.goto(BASE, { timeout: 30000 });
  if (seed) await api.eval(seed);
  await api.goto(BASE, { timeout: 30000 });
  await sleep(900);
};

// ── P5b 超長文本是否真的存進去 ───────────────────────────────
section('P5b 超長文本：存檔後到底寫進了什麼');
await boot(`(() => { Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k)); return true; })()`);
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await setValue(api, 'input[placeholder="輸入名稱..."]', '長'.repeat(120));
await setValue(api, 'textarea[placeholder*="起源"]', '故'.repeat(6000));
await settle(500);
note('P5b：DOM 內故事長度', await api.eval(`(() => { const t = [...document.querySelectorAll('textarea')].find((x) => (x.placeholder || '').includes('起源')); return t ? t.value.length : -1; })()`));
await gotoStep(api, 8);
await settle(400);
note('P5b：步驟 8 的 textarea 數量', await api.eval(`document.querySelectorAll('textarea').length`));
note('P5b：步驟 8 的 textarea placeholder', JSON.stringify(await api.eval(`[...document.querySelectorAll('textarea')].map((t) => t.placeholder)`)));
await setValue(api, 'textarea', '戰'.repeat(3000));
await settle(400);
note('P5b：DOM 內戰術長度', await api.eval(`(() => { const t = document.querySelector('textarea'); return t ? t.value.length : -1; })()`));
await clickText('儲存', 1000);
await sleep(800);
note('P5b：存檔後卡片欄位長度', JSON.stringify(await libCard()));

// ── P3b 殘缺卡崩在哪 ────────────────────────────────────────
section('P3b 殘缺卡：崩在哪一個 .map');
await boot(`(() => {
  Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k));
  localStorage.setItem('monogatari_techou_npc_library', JSON.stringify([{ id: 'bare_1', name: '只有名字' }]));
  return true;
})()`);
await openWorkshop(api, { stage: STAGE });
await clickText('編輯', 900);
note('P3b：有 ErrorBoundary 嗎', String(await hasBoundary()));
note('P3b：錯誤訊息', JSON.stringify(await api.eval(`(() => { const t = document.body.innerText; const i = t.indexOf('錯誤資訊：'); return i >= 0 ? t.slice(i, i + 200).replace(/\\n+/g, ' ') : null; })()`)));
const st = await stack();
note('P3b：componentStack 前 18 行', st ? JSON.stringify(st) : 'null（details 未展開或無 stack）');
await api.eval(`(() => { const d = [...document.querySelectorAll('summary')]; d.forEach((s) => { if (/技術/.test(s.innerText)) s.click(); }); return true; })()`);
await settle(500);
const st2 = await stack();
note('P3b：展開後 componentStack', st2 ? JSON.stringify(st2) : 'null');
await snap(api, STAGE, 'P3b-boundary');

// ── P9 崩掉之後的退路 ──────────────────────────────────────
section('P9 崩掉之後還有沒有退路');
note('P9：錯誤頁上的按鈕', JSON.stringify(await api.eval(`[...document.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim())`)));
await clickText('重新整理頁面', 1400);
await sleep(1200);
note('P9：重載後還崩嗎', String(await hasBoundary()));
note('P9：重載後畫面首 100 字', JSON.stringify((await body()).slice(0, 100).replace(/\n+/g, ' | ')));
await openWorkshop(api, { stage: STAGE });
note('P9：檔案庫還看得到那張卡嗎', JSON.stringify(await api.eval(`[...document.querySelectorAll('h3')].map((e) => e.innerText.trim())`)));
const del = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /刪除/.test(x.getAttribute('aria-label') || '') || /刪除/.test(x.getAttribute('title') || ''));
  if (!b) return { found: false };
  b.click();
  return { found: true, aria: b.getAttribute('aria-label'), title: b.getAttribute('title') };
})()`);
note('P9：找得到刪除鈕嗎', JSON.stringify(del));
await settle(800);
note('P9：刪除後筆數', await api.eval(`JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]').length`));
note('P9：刪除後還崩嗎', String(await hasBoundary()));

// ── P6b 390px 重走八步 ────────────────────────────────────
section('P6b 390px：用下拉選單走八步');
await boot(`(() => { Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k)); return true; })()`);
await api.viewport(390, 844);
await sleep(800);
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
const walkM = [];
for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
  try { await gotoStepMobile(api, n); walkM.push(n); } catch { walkM.push('X' + n); }
}
note('P6b：八步走過', JSON.stringify(walkM));
note('P6b：有 ErrorBoundary 嗎', String(await hasBoundary()));
const ov = await api.eval(`({ docW: document.documentElement.scrollWidth, winW: window.innerWidth, overflowX: document.documentElement.scrollWidth > window.innerWidth + 2 })`);
note('P6b：構築頁橫向溢出', JSON.stringify(ov));
note('P6b：390px 下可見的按鈕（前 24 個）', JSON.stringify(await api.eval(`[...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => (b.innerText || b.getAttribute('aria-label') || b.getAttribute('title') || '').replace(/\\s+/g, ' ').trim()).filter(Boolean).slice(0, 24)`)));
await snap(api, STAGE, 'P6b-mobile-build');
await clickText('角色卡預覽', 900);
note('P6b：預覽有 ErrorBoundary 嗎', String(await hasBoundary()));
const ov2 = await api.eval(`({ docW: document.documentElement.scrollWidth, winW: window.innerWidth, overflowX: document.documentElement.scrollWidth > window.innerWidth + 2 })`);
note('P6b：預覽橫向溢出', JSON.stringify(ov2));
await snap(api, STAGE, 'P6b-mobile-preview');
await api.viewport(1440, 1000);
await sleep(600);

// ── P10 遷移後新舊鍵一致性（P2 的補充）─────────────────────
section('P10 舊卡的技能陣列到底是什麼形狀');
await boot(`(() => {
  Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k));
  localStorage.setItem('fabula-npc-library-v2', JSON.stringify([{
    id: 'legacy_1', name: '舊世代守衛', role: '暴徒', rank: '士兵', level: 10,
    selectedSpeciesId: 'undead', speciesConfig: {}, traits: '不死',
    story: '舊故事', tactics: '舊戰術',
    skills: [{ id: 's1', name: '揮擊', category: 'action', source: 'base', description: '造成傷害' }],
    affinities: {}, selectedNegativeSkills: [], linkedNpcs: [],
  }]));
  return true;
})()`);
await openWorkshop(api, { stage: STAGE });
note('P10：遷移後技能陣列形狀', JSON.stringify(await api.eval(`(() => {
  const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]');
  return (a[0].skills || []).map((s) => ({ keys: Object.keys(s).slice(0, 6), name: s.name ?? null, originalName: s.originalName ?? null, category: s.category ?? null }));
})()`)));

dumpErrors(api);
report('階段 10 探測之二');
await api.close();
