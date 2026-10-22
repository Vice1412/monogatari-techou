/**
 * 建角草稿（`npcDraft`）的端到端稽核 —— **手動**，不進 `npm test`。
 *
 * 為什麼要獨立一支（SSR 與 `audit-npc-workshop.mjs` 都只守了一半）：
 *   - `tests/npcWorkshopUi.test.mjs` F 段證明「讀回」正確，但用的是注入的假儲存後端。
 *   - `audit-npc-workshop.mjs` 證明「寫入」正確，但**刻意不 reload**（reload 會毀掉後續檢查）。
 * 中間那一段——真 localStorage 寫進去、真 reload 之後接回來、提示條兩顆按鈕真的能按——
 * 兩邊都沒踩到。這一支補的正是那一段。
 *
 * 用法：
 *   npm run dev            # 另開一個終端，或已在跑
 *   node scripts/audit-npc-draft.mjs
 *   GM_BASE=http://localhost:3000/ node scripts/audit-npc-draft.mjs   # 覆寫網址
 *
 * ⚠️ 兩條量測陷阱（都在這裡踩過）：
 *   1. 腳本**必須自己 `process.exit()`**：`launch()` 起的 Chrome 子行程會讓事件迴圈活著，
 *      不顯式結束就會「跑完了但不返回」。而輸出若被管線（`| Select-Object`）緩衝，
 *      看起來會像「完全沒動」——所以每個階段都直接 `process.stdout.write`。
 *   2. 封面章節卡是 `<div>`，文字是「NPC工坊 / 完整功能 / 點擊翻開」，**不是按鈕**；
 *      而且翻頁動畫期間（約 850ms）`onClick` 會被 `transitionState` 吃掉，
 *      所以點之前要先等。用 `innerText === 'NPC工坊'` 找不到它。
 */
/**
 * 一次性探測：建角草稿在**真瀏覽器 + 真 localStorage** 上的完整迴圈。
 *
 * 為什麼還要這一支（SSR 與稽核都已經各守一半）：
 *   - `test:npcworkshopui` F 段證明「讀回」正確，但用的是注入的假後端。
 *   - `audit-npc-workshop.mjs` 證明「寫入」正確，但刻意不 reload（reload 會毀掉後面的檢查）。
 * 中間那一段——真 localStorage 寫進去、真 reload 之後接回來——兩邊都沒踩到，所以在這裡補一次。
 *
 * ⚠️ 這支腳本必須自己 `process.exit()`：`launch()` 起的 Chrome 子行程會讓事件迴圈活著，
 * 不顯式結束就會「跑完了但不返回」（第一次寫的時候就是這樣卡住，而且因為輸出被管線緩衝，
 * 看起來像完全沒動）。
 */
import { launch } from './gm/cdp.mjs';
import { BASE, STEP_ANCHORS, check, gotoStep, report, section } from './gm/lib.mjs';

const DRAFT_KEY = 'monogatari_techou_npc_draft';
const NAME = '草稿接回測試體';
const log = (s) => process.stdout.write(`${s}\n`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const api = await launch({ port: 9345 });
const draft = () => api.eval(`localStorage.getItem(${JSON.stringify(DRAFT_KEY)})`);

// 封面要先點「NPC工坊」章節，工坊才會掛載（App.jsx 是條件渲染）。
const enterWorkshop = async (expect) => {
  await api.goto(BASE);
  await api.waitText('NPC工坊');
  // 封面有翻頁動畫（closing → 約 850ms 才解除），期間章節卡的 onClick 會被 transitionState 吃掉。
  await wait(1600);
  await api.eval(`(() => {
    const cands = [...document.querySelectorAll('div')]
      .filter((e) => {
        const s = (e.innerText || '').trim();
        return s.startsWith('NPC工坊') && s.includes('點擊翻開');
      });
    if (!cands.length) return 'not-found';
    cands[cands.length - 1].click();
    return 'ok';
  })()`);
  await api.waitText(expect);
  await wait(500);
};

let code = 1;
try {
  section('A 建角 → 自動暫存');
  log('A: 進站');
  await enterWorkshop('建立新 NPC');
  await api.eval(`[...document.querySelectorAll('button')]
    .find((b) => b.innerText.includes('建立新 NPC')).click()`);
  await api.waitText('建構步驟');
  log('A: 已進建角頁');

  const named = await api.eval(`(() => {
    const inp = [...document.querySelectorAll('input')]
      .find((i) => /名稱/.test(i.placeholder || '') || i.value === '未命名');
    if (!inp) return 'no-input:' + [...document.querySelectorAll('input')]
      .map((i) => (i.placeholder || '') + '=' + i.value).join(',');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(inp, ${JSON.stringify(NAME)});
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  // 名稱欄位不在第 1 步（工坊在第 7 步才問稱呼），所以改用「走到第 3 步」證明
  // 「人站在哪裡」也被記住——這才是草稿比單純存 NPC 多出來的那一半。
  await gotoStep(api, 3);
  await api.waitText(STEP_ANCHORS[2]);
  await wait(1400);
  const raw = await draft();
  const obj = (() => { try { return JSON.parse(raw || 'null'); } catch (e) { return null; } })();
  log(`A: draft=${raw ? raw.slice(0, 90) : 'null'}`);
  check('走到第 3 步後草稿寫進真 localStorage', !!obj, `savedAt=${obj?.savedAt || '無'}（名稱欄位探測：${named}）`);
  check('草稿記著 mainTab=build 與 step=3', obj?.mainTab === 'build' && String(obj?.step) === '3',
    `mainTab=${obj?.mainTab} step=${obj?.step}`);

  section('B reload → 自動接回建角頁且停在第 3 步');
  // 有草稿且離開時在建角頁 → 工坊一掛載就是建角頁，不會有「建立新 NPC」可按。
  await enterWorkshop(STEP_ANCHORS[2]);
  await wait(900);
  const afterReload = await api.text();
  check('reload 後直接回到建角頁（不是檔案庫）', afterReload.includes('建構步驟'), afterReload.slice(0, 100));
  check('reload 後仍停在第 3 步', afterReload.includes(STEP_ANCHORS[2]), '沒有第 3 步錨點');

  section('C 從檔案庫離開 → 提示條');
  const back = await api.eval(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => b.innerText.trim() === '返回檔案庫');
    if (!btn) return 'not-found';
    btn.click();
    return 'ok';
  })()`);
  await wait(1000);
  log(`C: 返回檔案庫=${back}`);
  await enterWorkshop('建立新 NPC');
  await wait(900);
  const libText = await api.text();
  check('停在檔案庫並顯示接續提示條', libText.includes('上次有一份沒存進檔案庫的草稿'), libText.slice(0, 140));
  check('提示條提供「繼續編輯」', libText.includes('繼續編輯'));

  section('D 提示條的兩顆按鈕');
  const resume = await api.eval(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => b.innerText.trim() === '繼續編輯');
    if (!btn) return 'not-found';
    btn.click();
    return 'ok';
  })()`);
  await wait(900);
  const resumed = await api.text();
  check('「繼續編輯」回到建角頁且停在第 3 步',
    resume === 'ok' && resumed.includes(STEP_ANCHORS[2]), `${resume} / ${resumed.slice(0, 80)}`);

  // 丟棄：`draftOffer` 是元件的 state，按過「繼續編輯」就被消耗掉了，
  // 所以必須重新載入頁面讓提示條從 storage 重新長出來（草稿此時的 mainTab 是 library）。
  await api.eval(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => b.innerText.trim() === '返回檔案庫');
    if (btn) btn.click();
    return 'ok';
  })()`);
  await wait(1000);
  await enterWorkshop('建立新 NPC');
  await wait(900);
  const discard = await api.eval(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => b.innerText.trim() === '丟棄');
    if (!btn) return 'not-found';
    btn.click();
    return 'ok';
  })()`);
  await wait(900);
  const afterDiscard = await api.text();
  const keyGone = await api.eval(`localStorage.getItem(${JSON.stringify(DRAFT_KEY)}) === null`);
  check('「丟棄」真的清掉草稿鍵', discard === 'ok' && keyGone === true, `${discard} keyGone=${keyGone}`);
  check('丟棄後提示條消失', !afterDiscard.includes('上次有一份沒存進檔案庫的草稿'),
    afterDiscard.slice(0, 140));

  code = report('建角草稿端到端稽核');
} catch (e) {
  log(`\n探測失敗：${e.message}`);
} finally {
  api.proc?.kill();
}
process.exit(code);
