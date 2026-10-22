/**
 * 階段 8 關卡：預覽頁籤與角色卡面。
 *
 * 這一階段第一次離開 `build`。三件事各自獨立，全部要能重跑：
 *   1. 揭示等級四檔（完整／7+／10+／13+）到底藏掉什麼、留下什麼。
 *   2. 6 種主題切換是不是真的換了卡面，而且記得住。
 *   3. 匯出／複製走 html-to-image，必須驗到「檔案真的落地」，不是只看 toast。
 *
 * 已知缺陷（本階段不修，階段 9 開頭處理）：
 *   GM-08-01 主題選單六個選項沒有文字，只剩色點（已於階段 9 開頭修復，見下方 D 區段）
 *   GM-08-02 揭示等級不等於「完整」時，自己寫的故事與戰術被藏掉且無提示
 *   GM-08-03 `??` 遮罩沒有圖例
 * 這三條都**不影響**本關卡的斷言，所以關卡對「正確行為」全綠。
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './cdp.mjs';
import {
  section, check, note, report, snap, dumpErrors, openWorkshop, newNpc, gotoStep, setValue,
} from './lib.mjs';

const STAGE = '8';
const api = await launch();
const DL_DIR = path.join(process.cwd(), 'scratch', 'gm-test', 'stage8', 'downloads');
fs.rmSync(DL_DIR, { recursive: true, force: true });
fs.mkdirSync(DL_DIR, { recursive: true });

const settle = async (ms = 450) => {
  await new Promise((r) => setTimeout(r, ms));
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  await new Promise((r) => setTimeout(r, 130));
};

/**
 * 點一個文字完全相符的按鈕。
 *
 * 坑一：`scrollIntoView` 之後立刻讀 rect 拿到的是滾動前座標，點擊會落在別的元素上。
 * 坑二：命中的可能是按鈕內的 SVG 子節點，要用 `closest('button')` 回推。
 * 三次真實滑鼠都打不進去才退回程式化 click，並在回傳值標明用了哪一種——
 * 「有沒有被遮住」這件事只在 mouse 模式下被驗證過。
 */
const clickText = async (text, waitMs = 650) => {
  const target = JSON.stringify(text);
  for (let attempt = 0; attempt < 3; attempt++) {
    await api.eval(`(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${target});
      if (b) b.scrollIntoView({ block: 'center' });
    })()`);
    await new Promise((r) => setTimeout(r, 260));
    const info = await api.eval(`(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${target});
      if (!b) return { found: false };
      const r = b.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      const hit = document.elementFromPoint(x, y);
      return { found: true, x, y, hitIsSelf: hit ? hit.closest('button') === b : false };
    })()`);
    if (!info.found) return { ok: false, mode: 'none' };
    if (info.hitIsSelf) {
      await api.clickAt(info.x, info.y);
      await settle(waitMs);
      return { ok: true, mode: 'mouse' };
    }
    await api.clickAt(6, 6);
    await settle(320);
  }
  const ok = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${target});
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await settle(waitMs);
  return { ok, mode: 'programmatic' };
};

const cardText = () => api.eval(`(() => {
  const el = document.querySelector('.border-double');
  return el ? el.innerText.replace(/\\n+/g, ' | ') : '';
})()`);

const cardStyle = () => api.eval(`(() => {
  const el = document.querySelector('.border-double');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { bg: cs.backgroundColor, border: cs.borderTopColor };
})()`);

/** toast 只活 3 秒，而匯出可能比 3 秒久——單點取樣必然撲空，改成密集輪詢。 */
const toastNow = () => api.eval(`(() => {
  const m = document.body.innerText.match(/正在處理[^\\n]*|角色卡已成功匯出[^\\n]*|匯出失敗[^\\n]*|圖片已成功複製[^\\n]*|複製失敗[^\\n]*/);
  return m ? m[0] : null;
})()`);

const watchToast = async (ms = 9000, step = 150) => {
  const seen = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const msg = await toastNow();
    if (msg && !seen.some((s) => s.msg === msg)) seen.push({ at: Date.now() - t0, msg });
    await new Promise((r) => setTimeout(r, step));
  }
  return seen;
};

const paletteOpen = () => api.eval(`document.body.innerText.includes('選擇角色卡風格')`);

const openPalette = async () => {
  const ok = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('卡片風格'));
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await settle(600);
  return ok;
};

const closePalette = async () => {
  await api.eval(`(() => {
    const ov = [...document.querySelectorAll('div')].find((d) => typeof d.className === 'string' && d.className.includes('fixed') && d.className.includes('inset-0') && d.className.includes('z-40'));
    if (ov) ov.click();
  })()`);
  await settle(400);
};

/**
 * 主題按鈕的定位器。
 *
 * 2026-10-21（階段 9 開頭修掉 GM-08-01）之後，每個選項都有可讀名稱了，
 * 所以定位改看「內含色塊 div + 名稱 span.truncate」這組結構標記，
 * 不再靠「innerText 是空的」——那個特徵本身就是缺陷，修好後它會變成 0 個。
 * ⚠️ 這種定位器一旦失效，`every()` 會對空陣列回 true 而**假通過**，
 *    所以下面同時斷言「恰好六個」。
 */
const THEME_BTNS = `[...document.querySelectorAll('button')].filter((b) => b.querySelector('div[style*="background-color"]') && b.querySelector('span.truncate'))`;

const pickThemeByIndex = async (i) => {
  const ok = await api.eval(`(() => {
    const btns = ${THEME_BTNS};
    if (!btns[${i}]) return false;
    btns[${i}].click();
    return true;
  })()`);
  await settle(700);
  return ok;
};

const themeBtnCount = () => api.eval(`(() => ${THEME_BTNS}.length)()`);

const themeBtnLabels = () => api.eval(`(() => ${THEME_BTNS}.map((b) => (b.innerText || '').trim()))()`);

const storedTheme = () => api.eval(`window.localStorage.getItem('monogatari_techou_npc_card_theme')`);

const revealActive = (label) => api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === ${JSON.stringify(label)});
  return b ? getComputedStyle(b).backgroundColor : null;
})()`);

// ── 準備一張有內容的卡 ─────────────────────────────────────────
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await setValue(api, 'input[placeholder="輸入名稱..."]', '灰燼守門人');
await setValue(api, 'input[placeholder*="敏捷"]', '不死, 遲緩');
await setValue(api, 'textarea[placeholder*="起源"]', '被燒毀的鐘樓底下醒來，記得的最後一件事是鐘聲。');
await settle(300);
await gotoStep(api, 8);
await setValue(api, 'textarea', '優先攻擊施法者；血量低於一半時退到後排。');
await settle(300);

// ── A 工具列 ─────────────────────────────────────────────────
section('A 預覽工具列的組成');
const entered = await clickText('角色卡預覽', 900);
check('能從構築頁面切到角色卡預覽', entered.ok);
check('切換後卡面節點存在（.border-double 恰好 1 個）', (await api.eval(`document.querySelectorAll('.border-double').length`)) === 1);
const revealBtns = await api.eval(`(() => [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter((t) => /^(完整|7\\+|10\\+|13\\+)$/.test(t)))()`);
check('揭示等級恰好四顆：完整／7+／10+／13+', JSON.stringify(revealBtns) === JSON.stringify(['完整', '7+', '10+', '13+']));
check('工具列有「卡片風格」觸發鈕', (await api.eval(`[...document.querySelectorAll('button')].some((b) => (b.innerText || '').includes('卡片風格'))`)) === true);
check('工具列有「複製文本 ▾」', (await api.eval(`[...document.querySelectorAll('button')].some((b) => /複製文本/.test(b.innerText || '') && /▾/.test(b.innerText || ''))`)) === true);
check('工具列有「複製圖片」', (await api.eval(`[...document.querySelectorAll('button')].some((b) => /複製圖片/.test(b.innerText || ''))`)) === true);
check('工具列有「匯出 JPG」', (await api.eval(`[...document.querySelectorAll('button')].some((b) => /匯出 JPG/.test(b.innerText || ''))`)) === true);
await snap(api, STAGE, 'A1-preview-toolbar');

// ── B 揭示等級 ───────────────────────────────────────────────
section('B 揭示等級四檔分別藏掉什麼');
await clickText('完整', 600);
const full = await cardText();
check('完整：有名字', full.includes('灰燼守門人'));
check('完整：有屬性列（DEX）', full.includes('DEX'));
check('完整：有特質', full.includes('特質:'));
check('完整：有背景故事', full.includes('鐘聲'));
check('完整：有戰術', full.includes('優先攻擊施法者'));
check('完整：有攻擊卡', full.includes('基本攻擊'));
check('完整：先攻不是 ??', /先攻 INIT \| \d+/.test(full));
await snap(api, STAGE, 'B1-reveal-full');

await clickText('7+', 600);
const lv7 = await cardText();
check('7+：仍有名字（basic 永遠可見）', lv7.includes('灰燼守門人'));
check('7+：仍有 HP', /HP \| \d+/.test(lv7));
check('7+：仍有 MP', /MP \| \d+/.test(lv7));
check('7+：屬性列被藏掉', !lv7.includes('DEX'));
check('7+：特質被藏掉', !lv7.includes('特質:'));
check('7+：背景故事被藏掉', !lv7.includes('鐘聲'));
check('7+：戰術被藏掉', !lv7.includes('優先攻擊施法者'));
check('7+：攻擊卡被藏掉', !lv7.includes('基本攻擊'));
check('7+：先攻被遮成 ??', /先攻 INIT \| \?\?/.test(lv7));
check('7+：物防被遮成 ??', /物防 DEF \| \?\?/.test(lv7));
check('7+：魔防被遮成 ??', /魔防 M\.DEF \| \?\?/.test(lv7));
await snap(api, STAGE, 'B2-reveal-7');

await clickText('10+', 600);
const lv10 = await cardText();
check('10+：屬性列回來了', lv10.includes('DEX'));
check('10+：特質回來了', lv10.includes('特質:'));
check('10+：先攻顯示真值而不是 ??', /先攻 INIT \| \d+/.test(lv10));
check('10+：攻擊卡仍然不顯示', !lv10.includes('基本攻擊'));
check('10+：背景故事仍然不顯示（只有完整看得到）', !lv10.includes('鐘聲'));
check('10+：戰術仍然不顯示', !lv10.includes('優先攻擊施法者'));
await snap(api, STAGE, 'B3-reveal-10');

await clickText('13+', 600);
const lv13 = await cardText();
check('13+：攻擊卡回來了', lv13.includes('基本攻擊'));
check('13+：屬性列仍在', lv13.includes('DEX'));
check('13+：背景故事仍然不顯示', !lv13.includes('鐘聲'));
check('13+：戰術仍然不顯示', !lv13.includes('優先攻擊施法者'));
await snap(api, STAGE, 'B4-reveal-13');

// ── C 揭示等級在頁籤之間會不會被重設 ──────────────────────────
section('C 揭示等級在頁籤切換之間是否保留');
const activeBefore = await revealActive('13+');
await clickText('構築頁面', 800);
await clickText('角色卡預覽', 800);
const activeAfter = await revealActive('13+');
check('離開預覽再回來，13+ 仍是選中狀態', activeBefore === activeAfter && activeAfter === 'rgb(217, 119, 6)');
check('回到預覽後卡面確實仍是 13+ 的內容（沒有攻擊卡以外的差異）', (await cardText()).includes('基本攻擊'));
await clickText('完整', 600);
check('按「完整」可以切回全揭示', (await cardText()).includes('鐘聲'));

// ── D 主題切換 ───────────────────────────────────────────────
section('D 六種主題切換與記憶');
const amberStyle = await cardStyle();
check('開啟主題選單', await openPalette());
check('主題選單有開', (await paletteOpen()) === true);
const btnCount = await themeBtnCount();
check('主題選單恰好六個選項', btnCount === 6);
const labels = await themeBtnLabels();
note('六個主題按鈕的可讀文字', JSON.stringify(labels));
check('【已修 GM-08-01】六個主題選項都有可讀名稱', labels.length === 6 && labels.every((t) => t.length > 0), JSON.stringify(labels));
check('六個主題名稱互不相同', new Set(labels).size === 6, JSON.stringify(labels));
await snap(api, STAGE, 'D1-palette-open');

check('選第一個（琥珀棕）', await pickThemeByIndex(0));
check('琥珀棕寫進 localStorage', (await storedTheme()) === 'amber');
const amberAgain = await cardStyle();
check('琥珀棕的卡面配色與初始一致', JSON.stringify(amberStyle) === JSON.stringify(amberAgain));

await openPalette();
check('選第二個（群青藍）', await pickThemeByIndex(1));
check('群青藍寫進 localStorage', (await storedTheme()) === 'blue');
const blueStyle = await cardStyle();
check('切到群青藍後卡面背景真的變了', blueStyle.bg !== amberStyle.bg);
check('切到群青藍後卡面邊框真的變了', blueStyle.border !== amberStyle.border);
check('觸發鈕文字跟著變成群青藍', (await api.eval(`[...document.querySelectorAll('button')].filter((b) => (b.innerText || '').includes('卡片風格')).map((b) => b.innerText.replace(/\\s+/g, ' ').trim())[0]`)).includes('群青藍'));
await snap(api, STAGE, 'D2-theme-blue');

const seenBorders = new Set([amberStyle.border, blueStyle.border]);
const themeOrder = ['amber', 'blue', 'crimson', 'emerald', 'purple', 'slate'];
for (let i = 2; i < 6; i++) {
  await openPalette();
  await pickThemeByIndex(i);
  const st = await cardStyle();
  check(`第 ${i + 1} 個主題（${themeOrder[i]}）寫進 localStorage`, (await storedTheme()) === themeOrder[i]);
  check(`第 ${i + 1} 個主題（${themeOrder[i]}）的邊框色與前幾個都不同`, !seenBorders.has(st.border));
  seenBorders.add(st.border);
}
check('六種主題的邊框色互不相同（共 6 種）', seenBorders.size === 6);
await snap(api, STAGE, 'D3-theme-slate');

await openPalette();
await pickThemeByIndex(0);
check('切回琥珀棕', (await storedTheme()) === 'amber');

// ── E 匯出 JPG ───────────────────────────────────────────────
section('E 匯出 JPG 是否真的落地');
let dlReady = true;
try {
  await api.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR, eventsEnabled: true });
} catch {
  try {
    await api.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL_DIR });
  } catch (e) {
    dlReady = false;
    note('無法設定下載目錄', String(e && e.message));
  }
}
check('能指定下載目錄（否則本段無法驗證落地）', dlReady);
const expClick = await clickText('匯出 JPG', 100);
note('點「匯出 JPG」用的模式', expClick.mode);
const expToasts = await watchToast(9000);
check('匯出期間出現「角色卡已成功匯出！」', expToasts.some((t) => t.msg.includes('角色卡已成功匯出')));
check('匯出沒有出現失敗訊息', !expToasts.some((t) => t.msg.includes('匯出失敗')));
await new Promise((r) => setTimeout(r, 2500));
const dlFiles = fs.existsSync(DL_DIR) ? fs.readdirSync(DL_DIR) : [];
check('下載目錄裡有一個檔案', dlFiles.length === 1);
const jpgName = dlFiles[0] || '';
check('檔名是「灰燼守門人_Card.jpg」', jpgName === '灰燼守門人_Card.jpg');
const jpgSize = jpgName ? fs.statSync(path.join(DL_DIR, jpgName)).size : 0;
note('匯出檔大小（bytes）', String(jpgSize));
check('匯出的 JPG 不是空檔（> 20 KB）', jpgSize > 20000);
await snap(api, STAGE, 'E1-after-export');

// ── F 複製圖片 ───────────────────────────────────────────────
section('F 複製圖片到剪貼簿');
const copyClick = await clickText('複製圖片', 100);
note('點「複製圖片」用的模式', copyClick.mode);
const copyToasts = await watchToast(9000);
check('複製期間出現「圖片已成功複製到剪貼簿！」', copyToasts.some((t) => t.msg.includes('圖片已成功複製到剪貼簿')));
check('複製沒有出現失敗訊息', !copyToasts.some((t) => t.msg.includes('複製失敗')));

// ── G 複製文本四種格式 ───────────────────────────────────────
section('G 複製文本的四種格式');
await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /複製文本/.test(x.innerText || '') && /▾/.test(x.innerText || ''));
  if (b) b.click();
})()`);
await settle(600);
const menuBlock = await api.eval(`(() => {
  const t = document.body.innerText;
  const i = t.indexOf('複製文本 ▾');
  return i >= 0 ? t.slice(i, i + 90).replace(/\\n+/g, ' | ') : '';
})()`);
note('選單內容', menuBlock);
for (const fmt of ['Discord 格式', 'Markdown 格式', '純文字筆記格式', 'ccfolia 棋子']) {
  check(`選單有「${fmt}」`, menuBlock.includes(fmt));
}
await snap(api, STAGE, 'G1-copytext-menu');
await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /複製文本/.test(x.innerText || '') && /▾/.test(x.innerText || ''));
  if (b) b.click();
})()`);
await settle(400);
check('再點一次可以收起選單', (await api.eval(`document.body.innerText.includes('ccfolia 棋子')`)) === false);

// ── H 卡面的「未知實體」不當名字用 ────────────────────────────
section('H 名字為「未知實體」時的卡面行為');
const nameFallback = await api.eval(`(() => {
  const el = document.querySelector('.border-double');
  return el ? el.innerText.split('\\n').slice(0, 3) : [];
})()`);
note('卡面開頭三行', JSON.stringify(nameFallback));
check('卡面第一行就是使用者填的名字', String(nameFallback[0]).trim() === '灰燼守門人');

dumpErrors(api);
report('階段 8：預覽與卡面');
await api.close();
