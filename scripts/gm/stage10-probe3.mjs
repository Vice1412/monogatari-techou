/**
 * 階段 10 探測之三：故事／戰術 textarea 為什麼存不進去。
 *
 * 已知：名稱（input）存得進去，故事（textarea）與戰術（textarea）存不進去。
 * 這支只做一件事——分辨「React state 沒收到」還是「存檔時被丟掉」。
 */
import { launch } from './cdp.mjs';
import { BASE, openWorkshop, newNpc, gotoStep, setValue, section, note, report, dumpErrors, armDialog } from './lib.mjs';

const STAGE = 'stage10-probe';
const api = await launch();
armDialog(api, { accept: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const body = () => api.eval(`document.body.innerText`);
const card = () => api.eval(`(() => { const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]'); const c = a[0] || {}; return { name: (c.name || '').length, story: (c.story || '').length, tactics: (c.tactics || '').length, updatedAt: c.updatedAt || null }; })()`);
const ta = (sel) => api.eval(`(() => { const t = document.querySelector(${JSON.stringify(sel)}); return t ? t.value.length : -1; })()`);

const boot = async () => {
  await api.goto(BASE, { timeout: 30000 });
  await api.eval(`(() => { Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k)); return true; })()`);
  await api.goto(BASE, { timeout: 30000 });
  await sleep(900);
};

// ── A 短故事能不能存 ───────────────────────────────────────
section('A 短故事（20 字）能不能存');
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
note('A：步驟 7 的 textarea 清單', JSON.stringify(await api.eval(`[...document.querySelectorAll('textarea')].map((t) => ({ ph: (t.placeholder || '').slice(0, 24), len: t.value.length }))`)));
await setValue(api, 'textarea[placeholder*="起源"]', '短短的故事二十個字測試看看');
await sleep(400);
note('A：DOM 故事長度', await ta('textarea[placeholder*="起源"]'));
note('A：名稱欄位值', JSON.stringify(await api.eval(`(() => { const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('輸入名稱')); return i ? i.value : null; })()`)));
// 逼一次 re-render（改名稱），看故事會不會被 state 拉回去
await setValue(api, 'input[placeholder="輸入名稱..."]', '短故事卡');
await sleep(500);
note('A：re-render 後 DOM 故事長度（若變 0 代表 state 從沒收到）', await ta('textarea[placeholder*="起源"]'));
await api.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '儲存'); if (b) b.click(); return true; })()`);
await sleep(900);
note('A：存檔後卡片', JSON.stringify(await card()));

// ── B 直接用 React 事件觸發（模擬真人打字）──────────────────
section('B 改用 execCommand 模擬真人輸入');
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await api.eval(`(() => {
  const t = document.querySelector('textarea[placeholder*="起源"]');
  if (!t) return false;
  t.focus();
  return true;
})()`);
await sleep(200);
await api.send('Input.insertText', { text: '真人打字測試的故事內容' });
await sleep(400);
note('B：insertText 後 DOM 故事長度', await ta('textarea[placeholder*="起源"]'));
await setValue(api, 'input[placeholder="輸入名稱..."]', '真人打字卡');
await sleep(500);
note('B：re-render 後 DOM 故事長度', await ta('textarea[placeholder*="起源"]'));
await api.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '儲存'); if (b) b.click(); return true; })()`);
await sleep(900);
note('B：存檔後卡片', JSON.stringify(await card()));

// ── C 戰術欄位單獨測 ───────────────────────────────────────
section('C 戰術欄位（步驟 8）');
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 8);
await setValue(api, 'textarea', '優先攻擊施法者；血量低於一半時退到後排。');
await sleep(400);
note('C：DOM 戰術長度', await ta('textarea'));
await api.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '儲存'); if (b) b.click(); return true; })()`);
await sleep(900);
note('C：存檔後卡片', JSON.stringify(await card()));

// ── D 用 preview 驗證 state（不經存檔）────────────────────
section('D 不存檔，直接看預覽有沒有故事');
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await setValue(api, 'input[placeholder="輸入名稱..."]', '預覽驗證卡');
await setValue(api, 'textarea[placeholder*="起源"]', '這一段應該出現在角色卡上');
await sleep(500);
await api.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('立即查看角色卡')); if (b) b.click(); return true; })()`);
await sleep(1200);
note('D：預覽有故事文字嗎', String((await body()).includes('這一段應該出現在角色卡上')));
note('D：預覽頁籤鈕', JSON.stringify(await api.eval(`[...document.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim()).filter((t) => /構築|預覽/.test(t))`)));

dumpErrors(api);
report('階段 10 探測之三');
await api.close();
