/**
 * 階段 10 探測之六：直接讀 React fiber 裡的 state。
 *
 * 前面五支探測互相矛盾：DOM 有值、預覽「看起來」有值、存檔卻沒有。
 * `document.body.innerText` 在 Chrome 會回傳表單控件的**當前值**，
 * 所以「預覽有 X 嗎」這條斷言是空的——它讀到的是輸入框自己。
 *
 * 這支改用唯一可信的兩個來源：
 *   1. React fiber 的 hook state（真正餵給存檔的東西）
 *   2. 逼一次 re-render 之後 DOM 還剩多少（受控欄位會被 state 拉回去）
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
};

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

const dom = (selector) => api.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); return e ? e.value.length : -1; })()`);

/** 從 fiber 裡撈出任何「看起來像 NPC 草稿」的 hook state。 */
const fiberState = () => api.eval(`(() => {
  const rootEl = document.getElementById('root');
  if (!rootEl) return { error: 'no #root' };
  const key = Object.keys(rootEl).find((k) => k.startsWith('__reactContainer$'));
  if (!key) return { error: 'no react container key', keys: Object.keys(rootEl).slice(0, 6) };
  const found = [];
  const seen = new Set();
  const walk = (f, depth) => {
    if (!f || depth > 40 || found.length > 6) return;
    let h = f.memoizedState; let i = 0;
    while (h && i < 120) {
      const v = h.memoizedState;
      if (v && typeof v === 'object' && !Array.isArray(v) && 'skills' in v && 'story' in v && 'tactics' in v) {
        const label = (f.type && (f.type.name || f.type.displayName)) || String(f.type);
        const sig = label + '#' + i;
        if (!seen.has(sig)) {
          seen.add(sig);
          found.push({ comp: label, hook: i, name: (v.name || '').length, traits: (v.traits || '').length, story: (v.story || '').length, tactics: (v.tactics || '').length, level: v.level });
        }
      }
      h = h.next; i++;
    }
    walk(f.child, depth + 1);
    walk(f.sibling, depth);
  };
  walk(rootEl[key], 0);
  return { found };
})()`);

const card = () => api.eval(`(() => { const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]'); const c = a[0] || {}; return { name: (c.name || '').length, traits: (c.traits || '').length, story: (c.story || '').length, tactics: (c.tactics || '').length }; })()`);

const boot = async () => {
  await api.goto(BASE, { timeout: 30000 });
  await api.eval(`(() => { Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k)); return true; })()`);
  await api.goto(BASE, { timeout: 30000 });
  await sleep(900);
  await openWorkshop(api, { stage: STAGE });
  await newNpc(api, { stage: STAGE });
};

const NAME = 'input[placeholder="輸入名稱..."]';
const TRAITS = 'input[placeholder*="敏捷"]';
const STORY = 'textarea[placeholder*="起源"]';
const TACT = 'textarea';

// ── F0 fiber 能不能讀到 ───────────────────────────────────
section('F0 fiber 讀取能力');
await boot();
note('F0：fiber 掃描結果', JSON.stringify(await fiberState()));

// ── F1 真人輸入故事：state 收到了嗎 ──────────────────────
section('F1 真人輸入故事 → 讀 fiber');
await gotoStep(api, 7);
await typeInto(STORY, '鐘聲響了三下');
note('F1：DOM 故事長度', String(await dom(STORY)));
note('F1：fiber state', JSON.stringify(await fiberState()));
note('F1：逼 re-render（改名稱）後 DOM 故事長度', (await typeInto(NAME, '逼渲染')) && String(await dom(STORY)));
note('F1：逼 re-render 後 fiber state', JSON.stringify(await fiberState()));

// ── F2 setValue 故事：state 收到了嗎 ────────────────────
section('F2 setValue 故事 → 讀 fiber');
await boot();
await gotoStep(api, 7);
await setVal(STORY, '鐘聲響了三下');
note('F2：DOM 故事長度', String(await dom(STORY)));
note('F2：fiber state', JSON.stringify(await fiberState()));
note('F2：逼 re-render 後 DOM 故事長度', (await setVal(NAME, '逼渲染')) && String(await dom(STORY)));

// ── F3 特質 ──────────────────────────────────────────────
section('F3 特質');
await boot();
await gotoStep(api, 7);
await typeInto(TRAITS, '不死');
note('F3：DOM 特質長度', String(await dom(TRAITS)));
note('F3：fiber state', JSON.stringify(await fiberState()));

// ── F4 戰術 ──────────────────────────────────────────────
section('F4 戰術');
await boot();
await gotoStep(api, 8);
await typeInto(TACT, '優先攻擊施法者');
note('F4：DOM 戰術長度', String(await dom(TACT)));
note('F4：fiber state', JSON.stringify(await fiberState()));

// ── F5 名稱（對照組）────────────────────────────────────
section('F5 名稱');
await boot();
await gotoStep(api, 7);
await typeInto(NAME, '對照名稱');
note('F5：fiber state', JSON.stringify(await fiberState()));

// ── F6 存檔，然後看 localStorage 與 fiber 是否一致 ───────
section('F6 存檔一致性');
await boot();
await gotoStep(api, 7);
await typeInto(NAME, '一致性卡');
await typeInto(STORY, '一致性的故事內容');
await typeInto(TRAITS, '不死');
await gotoStep(api, 8);
await typeInto(TACT, '一致性的戰術內容');
note('F6：存檔前 fiber', JSON.stringify(await fiberState()));
await api.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '儲存'); if (b) b.click(); return true; })()`);
await sleep(1000);
note('F6：存檔後 fiber', JSON.stringify(await fiberState()));
note('F6：存檔後 localStorage', JSON.stringify(await card()));

dumpErrors(api);
report('階段 10 探測之六');
await api.close();
