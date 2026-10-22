/**
 * GM 實測語意層：把 CDP 的「原子操作」包成「GM 在做的事」。
 *
 * 設計原則（與 `tests/` 的護欄相反）：
 * - **不寫死版面**。這裡的每個函式都在找「人看得到的文字」，不是在找 class 或 testid。
 *   GM 實測要重現的是玩家的視野；用 testid 定位等於繞過了「找不找得到」這個缺陷類型。
 * - **失敗要能讀**。找不到就回報「找不到 + 畫面上有什麼」，不要 throw 一個 undefined。
 * - **每步留證據**。`snap()` 一律先建目錄再截圖，檔名即紀錄。
 */
import fs from 'node:fs';
import path from 'node:path';

export const BASE = process.env.GM_BASE || 'http://127.0.0.1:5173';
export const OUT_ROOT = path.resolve('scratch/gm-test');

const lines = [];
let pass = 0;
let fail = 0;

export const section = (title) => { lines.push(`\n── ${title} ──`); };

export const check = (label, ok, detail = '') => {
  if (ok) { pass += 1; lines.push(`  PASS  ${label}`); }
  else { fail += 1; lines.push(`  FAIL  ${label}${detail ? `\n          → ${detail}` : ''}`); }
  return ok;
};

/** 觀察型紀錄：不算通過也不算失敗，純粹把「畫面實際長怎樣」留在日誌裡。 */
export const note = (label, value) => { lines.push(`  NOTE  ${label}${value === undefined ? '' : `：${value}`}`); };

export const report = (stageName, extra = '') => {
  lines.push('');
  lines.push('='.repeat(56));
  lines.push(`  ${stageName}：通過 ${pass} / ${pass + fail}${fail ? `，失敗 ${fail}` : '（全部通過）'}`);
  lines.push('='.repeat(56));
  const out = lines.join('\n') + (extra ? `\n${extra}` : '');
  console.log(out);
  return fail === 0 ? 0 : 1;
};

export const snapDir = (stage) => {
  const dir = path.join(OUT_ROOT, `stage${stage}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export const snap = async (api, stage, name) => {
  const file = path.join(snapDir(stage), `${name}.png`);
  await api.shot(file);
  return file;
};

/** 把目前的 console／例外傾印出來——React 例外被 ErrorBoundary 吞掉時，這是唯一線索。 */
export const dumpErrors = (api) => {
  if (!api.errors.length) return '  （無 console 錯誤）';
  return api.errors.slice(0, 12)
    .map((e) => `  [${e.kind}] ${String(e.text).split('\n')[0].slice(0, 200)}`)
    .join('\n');
};

/**
 * 從書封走到 NPC 工坊。
 * 這一段刻意做成「照著畫面文字走」，因為它同時是階段 1 的測試對象：
 * 如果連入口都找不到，那就是 GM-01 的第一個缺陷。
 */
export const openWorkshop = async (api, { stage = 0 } = {}) => {
  await api.goto(BASE, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800)); // 封面翻頁動畫 550ms
  await snap(api, stage, '00-cover');

  const coverText = await api.text();
  if (coverText.includes('點擊翻開')) {
    await api.clickText('點擊翻開');
    await new Promise((r) => setTimeout(r, 900));
  }

  const entered = await api.clickText('NPC工坊');
  if (!entered?.ok) {
    const alt = await api.clickText('NPC 工坊');
    if (!alt?.ok) throw new Error(`書封上找不到「NPC工坊」入口。畫面文字：\n${(await api.text()).slice(0, 600)}`);
  }
  // 翻頁遮罩 550ms + lazy chunk 載入
  await api.waitText('建立新 NPC', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 400));
  await snap(api, stage, '01-workshop-entry');
  return true;
};

/** 點「建立新 NPC」（空庫時這是唯一能做的事）。 */
export const newNpc = async (api, { stage = 0 } = {}) => {
  const r = await api.clickText('建立新 NPC');
  if (!r?.ok) throw new Error(`找不到「建立新 NPC」按鈕（${r?.reason}）`);
  await api.waitFor(`!!document.querySelector('input, textarea, select')`, { timeout: 10000 });
  await new Promise((r2) => setTimeout(r2, 400));
  await snap(api, stage, '02-new-npc');
  return true;
};

export const STEP_TITLES = ['定位', '等級', '物種', '能力', 'Boss', '負面', '特質', '戰術'];
export const STEP_ANCHORS = [
  '步驟 1：選擇NPC的定位',
  '步驟 2：分配等級與階級',
  '步驟 3：設定物種',
  '步驟 4：調整數值與能力',
  '步驟 5：Boss 技能',
  '步驟 6：配置負面技能',
  '步驟 7：設定稱呼與特質',
  '步驟 8：戰術與行動',
];

/** 切換建角步驟（桌機側欄）。手機版另有 <select>，見 `gotoStepMobile`。 */
export const gotoStep = async (api, n) => {
  const label = `${n}. ${STEP_TITLES[n - 1]}`;
  const r = await api.clickText(label, { exact: true });
  if (!r?.ok) {
    const loose = await api.clickText(label);
    if (!loose?.ok) throw new Error(`找不到步驟按鈕「${label}」（${r?.reason}）`);
  }
  await api.waitText(STEP_ANCHORS[n - 1], { timeout: 10000 });
  await new Promise((res) => setTimeout(res, 250));
  return true;
};

export const gotoStepMobile = async (api, n) => {
  await api.eval(`(() => {
    const sel = document.querySelector('select');
    if (!sel) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, ${JSON.stringify(String(n))});
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await api.waitText(STEP_ANCHORS[n - 1], { timeout: 10000 });
  return true;
};

/** 目前畫面屬於第幾步（用錨點文字反查，不依賴內部 state）。 */
export const currentStep = async (api) => {
  const txt = await api.text();
  const idx = STEP_ANCHORS.findIndex((a) => txt.includes(a));
  return idx === -1 ? 0 : idx + 1;
};

/** 抓一段區塊文字（以錨點切段），給「這塊到底寫了什麼」的紀錄用。 */
export const sliceText = async (api, fromAnchor, toAnchor = null, max = 1200) => {
  const txt = await api.text();
  const i = txt.indexOf(fromAnchor);
  if (i === -1) return `（找不到錨點「${fromAnchor}」）`;
  const j = toAnchor ? txt.indexOf(toAnchor, i + fromAnchor.length) : -1;
  return txt.slice(i, j === -1 ? i + max : j).replace(/\n{2,}/g, '\n').slice(0, max);
};

/** 設定受控輸入框的值（必須走原生 setter ＋ input 事件，否則 React 收不到）。 */
export const setValue = async (api, selector, value) => {
  const r = await api.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { ok: false, reason: 'not found' };
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: el.value };
  })()`);
  if (!r?.ok) throw new Error(`setValue 失敗：${selector}（${r?.reason}）`);
  await new Promise((res) => setTimeout(res, 250));
  return r.value;
};

/**
 * 上傳檔案到 `<input type="file">`。
 * 用 CDP `DOM.setFileInputFiles`——這是 Playwright 上傳檔案的同一條底層路徑，
 * 會觸發真正的 `input`／`change` 事件，React 的 onChange 收得到。
 */
export const uploadFile = async (api, selector, filePath) => {
  await api.send('DOM.enable');
  // 同一個 input 連續上傳同一個檔案時，`change` 不會再觸發（value 沒變）。
  // 先清空 value，否則第二次上傳會靜默失敗——看起來像「程式不吃這個檔」。
  await api.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) el.value = ''; })()`);
  const r = await api.send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(selector)})`,
    objectGroup: 'gm-upload',
  });
  const objectId = r.result?.objectId;
  if (!objectId) throw new Error(`找不到檔案輸入框：${selector}`);
  await api.send('DOM.setFileInputFiles', { files: [filePath], objectId });
  await new Promise((res) => setTimeout(res, 700));
  return true;
};

/**
 * 設定下一個 `window.confirm`／`alert` 的處理方式（預設 accept，見 `cdp.mjs`）。
 * 回傳一個查詢器：呼叫它可得知「剛才那個對話框到底有沒有出現」。
 *
 * 為什麼不是「註冊一個只處理一次的監聽器」：dialog 一開，頁面主執行緒凍結，
 * 任何沒被接住的 dialog 都會讓後續每一次 `Runtime.evaluate` 永不返回，
 * 表現成「腳本卡死」。所以策略是**全域預設處理**，這裡只改策略。
 */
export const armDialog = (api, { accept = true } = {}) => {
  api.dialogPolicy = accept ? 'accept' : 'reject';
  const before = api.dialogs.length;
  return () => ({
    fired: api.dialogs.length > before,
    last: api.dialogs[api.dialogs.length - 1] || null,
  });
};

/** 檔案庫卡片標題，依畫面順序。 */
export const cardNames = async (api) =>
  api.eval(`[...document.querySelectorAll('h3')].map((e) => e.innerText.trim()).filter(Boolean)`);

/** 目前檔案庫顯示「N / 共 M 隻」的實際文字（找不到回 null）。 */
export const libCount = async (api) =>
  api.eval(`(() => {
    const m = document.body.innerText.match(/顯示\\s*(\\d+)\\s*\\/\\s*共\\s*(\\d+)\\s*隻/);
    return m ? { shown: Number(m[1]), total: Number(m[2]) } : null;
  })()`);

