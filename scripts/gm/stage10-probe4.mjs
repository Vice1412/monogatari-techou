/**
 * 階段 10 探測之四：用「真人輸入」重測超長文本，並把 textarea 的選取問題釘死。
 *
 * 前三次探測用 `setValue`（原生 setter + 派發 input 事件）在受控 textarea 上
 * 出現不穩定行為：DOM 有值、state 沒收到。改用 CDP `Input.insertText`
 * （真正走輸入法管線，React 一定收得到）重測。
 */
import { launch } from './cdp.mjs';
import { BASE, openWorkshop, newNpc, gotoStep, snap, section, note, report, dumpErrors, armDialog } from './lib.mjs';

const STAGE = 'stage10-probe';
const api = await launch();
armDialog(api, { accept: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 真人輸入：聚焦 → 全選 → insertText。受控欄位一定會收到 onChange。 */
const typeInto = async (selector, text) => {
  const ok = await api.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.focus();
    if (el.setSelectionRange) el.setSelectionRange(0, el.value.length);
    return true;
  })()`);
  if (!ok) throw new Error('typeInto 找不到 ' + selector);
  await api.send('Input.insertText', { text });
  await sleep(320);
};

const card = () => api.eval(`(() => { const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]'); const c = a[0] || {}; return { keys: Object.keys(c).length, name: (c.name || '').length, traits: (c.traits || '').length, story: (c.story || '').length, tactics: (c.tactics || '').length, rawLen: (localStorage.getItem('monogatari_techou_npc_library') || '').length }; })()`);
const body = () => api.eval(`document.body.innerText`);
const hasBoundary = () => api.eval(`document.body.innerText.includes('遭遇了阻礙')`);

const boot = async () => {
  await api.goto(BASE, { timeout: 30000 });
  await api.eval(`(() => { Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k)); return true; })()`);
  await api.goto(BASE, { timeout: 30000 });
  await sleep(900);
};

const clickText = async (text) => {
  const ok = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!b) return false; b.click(); return true;
  })()`);
  await sleep(800);
  return ok;
};

// ── A 步驟 7／8 到底有幾個 textarea ────────────────────────
section('A textarea 盤點');
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
note('A：步驟 7 的 input 清單', JSON.stringify(await api.eval(`[...document.querySelectorAll('input')].map((i, n) => ({ n, ph: (i.placeholder || '').slice(0, 22), val: (i.value || '').slice(0, 14), type: i.type })).slice(0, 14)`)));
note('A：步驟 7 的 textarea 清單', JSON.stringify(await api.eval(`[...document.querySelectorAll('textarea')].map((t, n) => ({ n, ph: (t.placeholder || '').slice(0, 26), len: t.value.length }))`)));
await gotoStep(api, 8);
note('A：步驟 8 的 textarea 清單', JSON.stringify(await api.eval(`[...document.querySelectorAll('textarea')].map((t, n) => ({ n, ph: (t.placeholder || '').slice(0, 26), len: t.value.length }))`)));

// ── B 真人輸入：短文本 ────────────────────────────────────
section('B 真人輸入短文本（名稱＋特質＋故事＋戰術）');
await gotoStep(api, 7);
await typeInto('input[placeholder="輸入名稱..."]', '真人輸入卡');
await typeInto('input[placeholder*="敏捷"]', '不死, 遲緩');
await typeInto('textarea[placeholder*="起源"]', '鐘聲在灰燼裡響了三下。');
await gotoStep(api, 8);
await typeInto('textarea', '優先攻擊施法者；血量低於一半時退到後排。');
note('B：輸入後 DOM 各欄長度', JSON.stringify(await api.eval(`(() => {
  const name = document.querySelector('input[placeholder="輸入名稱..."]');
  const tr = document.querySelector('input[placeholder*="敏捷"]');
  const ta = document.querySelector('textarea');
  return { name: name ? name.value.length : -1, traits: tr ? tr.value.length : -1, tactics: ta ? ta.value.length : -1 };
})()`)));
await clickText('儲存');
await sleep(900);
note('B：存檔後卡片', JSON.stringify(await card()));

// ── C 真人輸入：超長文本 ──────────────────────────────────
section('C 真人輸入超長文本');
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await typeInto('input[placeholder="輸入名稱..."]', '灰'.repeat(120));
await typeInto('input[placeholder*="敏捷"]', '特'.repeat(400));
await typeInto('textarea[placeholder*="起源"]', '故'.repeat(6000));
note('C：DOM 故事長度', await api.eval(`(() => { const t = document.querySelector('textarea[placeholder*="起源"]'); return t ? t.value.length : -1; })()`));
await gotoStep(api, 8);
await typeInto('textarea', '戰'.repeat(3000));
note('C：DOM 戰術長度', await api.eval(`(() => { const t = document.querySelector('textarea'); return t ? t.value.length : -1; })()`));
await clickText('儲存');
await sleep(1000);
note('C：存檔後卡片', JSON.stringify(await card()));
await clickText('角色卡預覽');
await sleep(1200);
note('C：預覽有 ErrorBoundary 嗎', String(await hasBoundary()));
const ov = await api.eval(`(() => {
  const el = document.querySelector('.border-double');
  const r = el ? el.getBoundingClientRect() : null;
  return { cardH: r ? Math.round(r.height) : null, cardW: r ? Math.round(r.width) : null, docW: document.documentElement.scrollWidth, winW: window.innerWidth, overflowX: document.documentElement.scrollWidth > window.innerWidth + 2, bodyH: document.body.scrollHeight };
})()`);
note('C：超長卡面', JSON.stringify(ov));
note('C：卡面出現 120 字的名字了嗎', String((await body()).includes('灰'.repeat(120))));
await snap(api, STAGE, 'C-long-card');

// ── D 超長之後能不能救回來 ────────────────────────────────
section('D 超長之後：編輯、刪除、匯出還正常嗎');
await clickText('返回檔案庫');
await sleep(600);
note('D：檔案庫卡片名長度', JSON.stringify(await api.eval(`[...document.querySelectorAll('h3')].map((e) => e.innerText.trim().length)`)));
note('D：卡片有撐破版面嗎', JSON.stringify(await api.eval(`({ docW: document.documentElement.scrollWidth, winW: window.innerWidth })`)));
const editOk = await clickText('編輯');
note('D：編輯可按', String(editOk));
note('D：編輯後有 ErrorBoundary 嗎', String(await hasBoundary()));

dumpErrors(api);
report('階段 10 探測之四');
await api.close();
