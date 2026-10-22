/**
 * 階段 10 探測之五：把「受控欄位輸入後 state 有沒有收到」釘死。
 *
 * 方法：右側預覽面板是即時從 `state` 渲染的，所以**不存檔**也能判斷 state 有沒有收到。
 * 每個欄位單獨測一次（一次只碰一個欄位），再測組合。
 */
import { launch } from './cdp.mjs';
import { BASE, openWorkshop, newNpc, gotoStep, section, note, report, dumpErrors, armDialog } from './lib.mjs';

const STAGE = 'stage10-probe';
const api = await launch();
armDialog(api, { accept: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const typeInto = async (selector, text) => {
  const ok = await api.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.focus();
    if (el.setSelectionRange) el.setSelectionRange(0, el.value.length);
    return true;
  })()`);
  if (!ok) throw new Error('找不到 ' + selector);
  await api.send('Input.insertText', { text });
  await sleep(400);
  return true;
};

const dom = (selector) => api.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); return e ? e.value.length : -1; })()`);
const body = () => api.eval(`document.body.innerText`);
const card = () => api.eval(`(() => { const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]'); const c = a[0] || {}; return { name: (c.name || '').length, traits: (c.traits || '').length, story: (c.story || '').length, tactics: (c.tactics || '').length }; })()`);
const save = async () => {
  await api.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '儲存'); if (b) b.click(); return true; })()`);
  await sleep(900);
};
/** 右側即時預覽是否出現這段文字（＝state 收到了）。 */
const inPreview = async (needle) => (await body()).includes(needle);

const boot = async () => {
  await api.goto(BASE, { timeout: 30000 });
  await api.eval(`(() => { Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k)); return true; })()`);
  await api.goto(BASE, { timeout: 30000 });
  await sleep(900);
};

const NAME = 'input[placeholder="輸入名稱..."]';
const TRAITS = 'input[placeholder*="敏捷"]';
const STORY = 'textarea[placeholder*="起源"]';
const TACT = 'textarea';

const run = async (label, steps) => {
  await boot();
  await openWorkshop(api, { stage: STAGE });
  await newNpc(api, { stage: STAGE });
  await steps();
  await save();
  note(label + '：存檔後', JSON.stringify(await card()));
};

// ── T1 只改名稱 ────────────────────────────────────────────
section('T1 只改名稱');
await run('T1', async () => {
  await gotoStep(api, 7);
  await typeInto(NAME, '甲名稱');
  note('T1：DOM 名稱長度', String(await dom(NAME)));
  note('T1：預覽有「甲名稱」嗎', String(await inPreview('甲名稱')));
});

// ── T2 只改特質 ────────────────────────────────────────────
section('T2 只改特質');
await run('T2', async () => {
  await gotoStep(api, 7);
  await typeInto(TRAITS, '不死');
  note('T2：DOM 特質長度', String(await dom(TRAITS)));
  note('T2：預覽有「不死」嗎', String(await inPreview('不死')));
});

// ── T3 只改故事 ────────────────────────────────────────────
section('T3 只改故事');
await run('T3', async () => {
  await gotoStep(api, 7);
  await typeInto(STORY, '鐘聲響了三下');
  note('T3：DOM 故事長度', String(await dom(STORY)));
  note('T3：預覽有「鐘聲響了三下」嗎', String(await inPreview('鐘聲響了三下')));
});

// ── T4 只改戰術 ────────────────────────────────────────────
section('T4 只改戰術');
await run('T4', async () => {
  await gotoStep(api, 8);
  await typeInto(TACT, '優先攻擊施法者');
  note('T4：DOM 戰術長度', String(await dom(TACT)));
  note('T4：預覽有「優先攻擊施法者」嗎', String(await inPreview('優先攻擊施法者')));
});

// ── T5 名稱 → 故事（兩個都在步驟 7）───────────────────────
section('T5 名稱 → 故事');
await run('T5', async () => {
  await gotoStep(api, 7);
  await typeInto(NAME, '乙名稱');
  note('T5：改名後預覽有「乙名稱」嗎', String(await inPreview('乙名稱')));
  await typeInto(STORY, '乙的故事');
  note('T5：改故事後預覽有「乙名稱」嗎', String(await inPreview('乙名稱')));
  note('T5：改故事後預覽有「乙的故事」嗎', String(await inPreview('乙的故事')));
});

// ── T6 名稱 → 故事 → 換步 → 戰術 ─────────────────────────
section('T6 名稱 → 故事 → 換步 → 戰術');
await run('T6', async () => {
  await gotoStep(api, 7);
  await typeInto(NAME, '丙名稱');
  await typeInto(STORY, '丙的故事');
  note('T6：換步前預覽有名字嗎', String(await inPreview('丙名稱')));
  note('T6：換步前預覽有故事嗎', String(await inPreview('丙的故事')));
  await gotoStep(api, 8);
  note('T6：換步後預覽有名字嗎', String(await inPreview('丙名稱')));
  note('T6：換步後預覽有故事嗎', String(await inPreview('丙的故事')));
  await typeInto(TACT, '丙的戰術');
  note('T6：改戰術後預覽有名字嗎', String(await inPreview('丙名稱')));
  note('T6：改戰術後預覽有故事嗎', String(await inPreview('丙的故事')));
  note('T6：改戰術後預覽有戰術嗎', String(await inPreview('丙的戰術')));
});

// ── T7 全程用 setValue（對照組）──────────────────────────
section('T7 對照：全程 setValue');
const setVal = async (selector, value) => {
  await api.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(320);
};
await run('T7', async () => {
  await gotoStep(api, 7);
  await setVal(NAME, '丁名稱');
  await setVal(STORY, '丁的故事');
  note('T7：預覽有名字嗎', String(await inPreview('丁名稱')));
  note('T7：預覽有故事嗎', String(await inPreview('丁的故事')));
  await gotoStep(api, 8);
  await setVal(TACT, '丁的戰術');
  note('T7：預覽有名字嗎', String(await inPreview('丁名稱')));
  note('T7：預覽有故事嗎', String(await inPreview('丁的故事')));
  note('T7：預覽有戰術嗎', String(await inPreview('丁的戰術')));
});

dumpErrors(api);
report('階段 10 探測之五');
await api.close();
