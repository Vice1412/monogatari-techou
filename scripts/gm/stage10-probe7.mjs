/**
 * 階段 10 探測之七：確認「儲存」走的是舊閉包。
 *
 * 假設：`useEffect` 把「儲存」按鈕塞進 ChapterHeader，依賴陣列只有 `state?.name`，
 * 所以按鈕上的 `handleSaveToLibrary` 停在「最後一次改名字」那次 render 的閉包裡。
 * Ctrl+S 的依賴陣列有 `state`，所以它拿到的是新的。
 *
 * 若假設成立：同一份內容，Ctrl+S 存得進去，按鈕存不進去。
 */
import { launch } from './cdp.mjs';
import { BASE, openWorkshop, newNpc, gotoStep, section, note, report, dumpErrors, armDialog } from './lib.mjs';

const STAGE = 'stage10-probe';
const api = await launch();
armDialog(api, { accept: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const typeInto = async (selector, text) => {
  await api.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.focus();
    if (el.setSelectionRange) el.setSelectionRange(0, el.value.length);
    return true;
  })()`);
  await api.send('Input.insertText', { text });
  await sleep(420);
};

const card = () => api.eval(`(() => { const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]'); const c = a[0] || {}; return { name: c.name || '', traits: (c.traits || '').length, story: (c.story || '').length, tactics: (c.tactics || '').length }; })()`);
const ctrlS = async () => {
  await api.eval(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); return true; })()`);
  await sleep(900);
};
const clickSave = async () => {
  await api.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '儲存'); if (b) b.click(); return true; })()`);
  await sleep(900);
};
const clickBack = async () => {
  await api.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '返回檔案庫'); if (b) b.click(); return true; })()`);
  await sleep(1100);
};

const boot = async () => {
  await api.goto(BASE, { timeout: 30000 });
  await api.eval(`(() => { Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k)); return true; })()`);
  await api.goto(BASE, { timeout: 30000 });
  await sleep(900);
  await openWorkshop(api, { stage: STAGE });
  await newNpc(api, { stage: STAGE });
};

const STORY = 'textarea[placeholder*="起源"]';
const NAME = 'input[placeholder="輸入名稱..."]';

// ── A 只改故事 → Ctrl+S ────────────────────────────────────
section('A 只改故事 → Ctrl+S');
await boot();
await gotoStep(api, 7);
await typeInto(STORY, '鐘聲響了三下');
await ctrlS();
note('A：Ctrl+S 之後', JSON.stringify(await card()));

// ── B 只改故事 → 按「儲存」───────────────────────────────
section('B 只改故事 → 按「儲存」');
await boot();
await gotoStep(api, 7);
await typeInto(STORY, '鐘聲響了三下');
await clickSave();
note('B：按鈕存檔之後', JSON.stringify(await card()));

// ── C 只改故事 → 按「返回檔案庫」─────────────────────────
section('C 只改故事 → 按「返回檔案庫」');
await boot();
await gotoStep(api, 7);
await typeInto(STORY, '鐘聲響了三下');
await clickBack();
note('C：返回檔案庫之後', JSON.stringify(await card()));

// ── D 先改名字再改故事 → 按「儲存」（名字進得去、故事進不去）──
section('D 名字 → 故事 → 按「儲存」');
await boot();
await gotoStep(api, 7);
await typeInto(NAME, '有名有姓');
await typeInto(STORY, '鐘聲響了三下');
await clickSave();
note('D：按鈕存檔之後', JSON.stringify(await card()));

// ── E 名字 → 故事 → 再改一次名字 → 按「儲存」───────────────
section('E 名字 → 故事 → 名字 → 按「儲存」');
await boot();
await gotoStep(api, 7);
await typeInto(NAME, '第一次改名');
await typeInto(STORY, '鐘聲響了三下');
await typeInto(NAME, '第二次改名');
await clickSave();
note('E：按鈕存檔之後', JSON.stringify(await card()));

// ── F 按鈕存檔後，介面說了什麼 ────────────────────────────
section('F 按鈕存檔後的介面回饋');
await boot();
await gotoStep(api, 7);
await typeInto(NAME, '回饋檢查');
await typeInto(STORY, '這段會被丟掉的故事');
await clickSave();
await sleep(300);
note('F：toast 文字', JSON.stringify(await api.eval(`(() => { const t = document.body.innerText; const i = t.indexOf('已成功儲存'); return i >= 0 ? t.slice(i, i + 40).replace(/\\n+/g, ' ') : null; })()`)));
await clickBack();
await sleep(400);
note('F：檔案庫卡片', JSON.stringify(await api.eval(`[...document.querySelectorAll('h3')].map((e) => e.innerText.trim())`)));
await api.eval(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '預覽'); if (b) b.click(); return true; })()`);
await sleep(1000);
note('F：檔案庫預覽裡有那段故事嗎', String((await api.eval(`document.body.innerText`)).includes('這段會被丟掉的故事')));

dumpErrors(api);
report('階段 10 探測之七');
await api.close();
