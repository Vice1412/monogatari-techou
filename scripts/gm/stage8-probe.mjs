import path from 'node:path';
import fs from 'node:fs';
/**
 * 階段 8 探勘：預覽頁籤與角色卡面。
 *
 * 這一階段第一次離開 `build`。要量的是三件互相獨立的東西：
 *   1. 揭示等級（完整／7+／10+／13+）到底藏掉哪些區塊——藏錯比不藏更糟。
 *   2. 6 種主題切換是不是真的換了卡面，還是只換了按鈕上的字。
 *   3. 匯出／複製走的是 html-to-image，無頭環境下最容易靜默失敗的一段。
 */
import { launch } from './cdp.mjs';
import {
  openWorkshop, newNpc, gotoStep, snap, section, note, report, dumpErrors, armDialog, setValue,
} from './lib.mjs';

const STAGE = '8-probe';
const api = await launch();
armDialog(api, { accept: true });

const settle = async (ms = 450) => {
  await new Promise((r) => setTimeout(r, ms));
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  await new Promise((r) => setTimeout(r, 130));
};

/**
 * 點一個文字完全相符的按鈕。
 *
 * 兩個坑（都是探勘工具自己的，不是產品的）：
 *   1. `scrollIntoView` 之後立刻讀 `getBoundingClientRect` 拿到的是**滾動前**的座標，
 *      於是點擊落在別的元素上。必須等一輪重排。
 *   2. 命中的可能是按鈕裡的 SVG 子節點，要用 `closest('button')` 回推。
 * 所以每次都做「滾動 → 等 → 量 → 驗證命中 → 必要時重試」。
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
      const owner = hit ? hit.closest('button') : null;
      return {
        found: true, x, y,
        rect: { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
        hitTag: hit ? hit.tagName : null,
        hitText: hit ? (hit.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 40) : null,
        hitIsSelf: owner === b,
      };
    })()`);
    if (!info.found) return { ok: false, reason: '找不到按鈕' };
    if (info.hitIsSelf) {
      await api.clickAt(info.x, info.y);
      await settle(waitMs);
      return { ok: true, mode: 'mouse', attempt, ...info };
    }
    // 被別的東西蓋住：先把它點掉（多半是選單遮罩），再重試。
    await api.clickAt(6, 6);
    await settle(320);
  }
  // 三次真實滑鼠都打不進去：退回程式化 click。
  // 這不是「測不到就算了」——button 上的 `.click()` 一樣會走 React 的 onClick，
  // 差別只在於沒有經過真實指標，所以「有沒有被遮住」這件事不再被驗證。
  const diag = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${target});
    if (!b) return { ok: false };
    const r = b.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    b.click();
    return {
      ok: true,
      coveredBy: hit ? (hit.tagName + ' ' + (hit.className || '').toString().slice(0, 60)) : null,
      coveredOwner: hit && hit.closest('button') ? (hit.closest('button').innerText || '').trim().slice(0, 30) : null,
    };
  })()`);
  await settle(waitMs);
  return { ok: diag.ok === true, mode: 'programmatic', ...diag };
};

const cardText = () => api.eval(`(() => {
  const el = document.querySelector('.border-double');
  return el ? el.innerText.replace(/\\n+/g, ' | ') : null;
})()`);

const cardBg = () => api.eval(`(() => {
  const el = document.querySelector('.border-double');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { bg: cs.backgroundColor, border: cs.borderTopColor };
})()`);

const toastNow = () => api.eval(`(() => {
  const m = document.body.innerText.match(/正在處理[^\\n]*|角色卡已成功匯出[^\\n]*|匯出失敗[^\\n]*|圖片已成功複製[^\\n]*|複製失敗[^\\n]*/);
  return m ? m[0] : null;
})()`);

/**
 * toast 只活 3 秒，而匯出可能要 4 秒以上——單點取樣必然撲空。
 * 所以改成密集輪詢，記下每一條曾經出現過的訊息與出現時間。
 */
const watchToast = async (ms = 12000, step = 150) => {
  const seen = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const msg = await toastNow();
    if (msg && !seen.some((s) => s.msg === msg)) seen.push({ at: Date.now() - t0, msg });
    await new Promise((r) => setTimeout(r, step));
  }
  return seen;
};

await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });

// 做一張有內容的卡：名稱、等級 20、冠位、一個 Boss 技能、一個負面技能、特質、故事、戰術。
await gotoStep(api, 7);
await setValue(api, 'input[placeholder="輸入名稱..."]', '灰燼守門人');
await setValue(api, 'input[placeholder*="敏捷"]', '不死, 遲緩');
await setValue(api, 'textarea[placeholder*="起源"]', '被燒毀的鐘樓底下醒來，記得的最後一件事是鐘聲。');
await settle(300);
await gotoStep(api, 8);
await setValue(api, 'textarea', '優先攻擊施法者；血量低於一半時退到後排。');
await settle(300);

section('P1 預覽工具列');
await clickText('角色卡預覽', 900);
const toolbar = await api.eval(`(() => ({
  texts: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim()).filter(Boolean).slice(0, 40),
  revealButtons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter((t) => /^(完整|7\\+|10\\+|13\\+)$/.test(t)),
  themeLabel: (document.body.innerText.match(/卡片風格：\\s*\\S+/) || [null])[0],
}))()`);
note('按鈕文字', JSON.stringify(toolbar.texts));
note('揭示等級按鈕', JSON.stringify(toolbar.revealButtons));
note('主題標籤', String(toolbar.themeLabel));
await snap(api, STAGE, 'P1-preview-toolbar');

section('P2 卡面基本結構');
const card0 = await cardText();
note('卡面文字（完整）', String(card0).slice(0, 700));
note('卡面配色', JSON.stringify(await cardBg()));

section('P3 四個揭示等級');
for (const lv of ['完整', '7+', '10+', '13+']) {
  await clickText(lv, 600);
  const t = await cardText();
  note(`揭示「${lv}」`, String(t).slice(0, 620));
  await snap(api, STAGE, `P3-reveal-${lv.replace('+', 'plus')}`);
}

section('P4 六種主題');
await clickText('完整', 500);
// 主題按鈕的 innerText 因為 flex 換行變成「卡片風格： 琥珀棕」，精確比對抓不到，用 contains。
// 這一顆的座標在無頭環境下會被別的節點蓋住（診斷顯示命中一個游離的 SVG path），
// 所以直接用程式化 click——它是 `<button>`，`.click()` 一樣走 React 的 onClick。
const openPalette = async () => {
  const opened = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('卡片風格'));
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await settle(600);
  return opened;
};
await openPalette();
const themeOpen = await api.eval(`document.body.innerText.includes('選擇角色卡風格')`);
note('主題下拉有開嗎', String(themeOpen));
const themeList = await api.eval(`(() => {
  const t = document.body.innerText;
  const i = t.indexOf('選擇角色卡風格');
  return { open: i >= 0, block: i >= 0 ? t.slice(i, i + 160).replace(/\\n+/g, ' | ') : '' };
})()`);
note('主題選單', JSON.stringify(themeList));
await snap(api, STAGE, 'P4-theme-menu');

section('P5 匯出與複製');
const exportBtn = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /匯出/.test(x.innerText || ''));
  return b ? (b.innerText || '').replace(/\\s+/g, ' ').trim() : null;
})()`);
note('匯出按鈕文字', String(exportBtn));
const copyImg = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /複製圖片/.test(x.innerText || ''));
  return b ? (b.innerText || '').replace(/\\s+/g, ' ').trim() : null;
})()`);
note('複製圖片按鈕文字', String(copyImg));

section('P6 匯出 JPG 實跑');
// 主題選單有一個 `fixed inset-0 z-40` 的透明遮罩，會吃掉所有點擊——先關掉它。
await api.eval(`(() => {
  const ov = [...document.querySelectorAll('div')].find((d) => typeof d.className === 'string' && d.className.includes('fixed') && d.className.includes('inset-0') && d.className.includes('z-40'));
  if (ov) ov.click();
})()`);
await settle(500);
note('遮罩關掉後選單還在嗎', String(await api.eval(`document.body.innerText.includes('選擇角色卡風格')`)));
note('卡面節點數', String(await api.eval(`document.querySelectorAll('.border-double').length`)));
const okExport = await clickText(String(exportBtn), 100);
note('點匯出的命中診斷', JSON.stringify(okExport));
const exportToasts = await watchToast(14000);
note('匯出期間出現過的 toast', JSON.stringify(exportToasts));
await snap(api, STAGE, 'P6-after-export');

section('P7 主題切換是否真的換了卡面');
const before = await cardBg();
await openPalette();
const paletteRaw = await api.eval(`(() => {
  const open = document.body.innerText.includes('選擇角色卡風格');
  const btns = [...document.querySelectorAll('button')]
    .map((b) => ({ txt: (b.innerText || '').replace(/\\s+/g, ' ').trim(), title: b.title || '' }))
    .filter((b) => b.txt.length > 0 && b.txt.length < 24);
  return { open, btns };
})()`);
note('主題選單開著嗎', String(paletteRaw.open));
note('短文字按鈕', JSON.stringify(paletteRaw.btns));
const pickTheme = async (name) => {
  const ok = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(name)}));
    if (!b) return false;
    b.click();
    return true;
  })()`);
  await settle(650);
  return ok;
};

const closePalette = async () => {
  await api.eval(`(() => {
    const ov = [...document.querySelectorAll('div')].find((d) => d.className && typeof d.className === 'string' && d.className.includes('fixed') && d.className.includes('inset-0') && d.className.includes('z-40'));
    if (ov) ov.click();
  })()`);
  await settle(400);
};
for (const name of ['群青藍', '硃砂紅', '翡翠青', '秘術紫', '鐵石灰', '琥珀棕']) {
  const ok = await pickTheme(name);
  const bg = await cardBg();
  note(`主題「${name}」`, `${ok ? '已點' : '找不到'} → ${JSON.stringify(bg)}`);
  if (ok) await snap(api, STAGE, `P7-theme-${name}`);
  if (ok) await openPalette();
}
await api.clickAt(6, 6);
await settle(300);

section('P8 複製圖片');
const okCopy = await clickText('複製圖片', 100);
note('點複製圖片的命中診斷', JSON.stringify(okCopy));
const copyToasts = await watchToast(14000);
note('複製圖片期間出現過的 toast', JSON.stringify(copyToasts));

section('P9 複製文本下拉');
const okCopyText = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /複製文本/.test(x.innerText || '') && /▾/.test(x.innerText || ''));
  if (!b) return false;
  b.click();
  return true;
})()`);
await settle(600);
const menu = await api.eval(`(() => {
  const t = document.body.innerText;
  const i = t.indexOf('複製文本');
  return { ok: ${'true'}, block: i >= 0 ? t.slice(i, i + 120).replace(/\\n+/g, ' | ') : '' };
})()`);
note('複製文本選單', JSON.stringify(menu));
await snap(api, STAGE, 'P9-copytext-menu');

section('P10 揭示等級是否會跟著離開預覽而重設');
const revealBefore = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '10+');
  return b ? getComputedStyle(b).backgroundColor : null;
})()`);
await clickText('10+', 600);
const activeBg = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '10+');
  return b ? getComputedStyle(b).backgroundColor : null;
})()`);
await clickText('構築頁面', 800);
await clickText('角色卡預覽', 800);
const stillActive = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '10+');
  return b ? getComputedStyle(b).backgroundColor : null;
})()`);
note('揭示鈕未選時底色', String(revealBefore));
note('揭示鈕選 10+ 時底色', String(activeBg));
note('離開再回來後 10+ 的底色', String(stillActive));
note('揭示等級是否被保留', String(activeBg === stillActive));

section('P11 匯出 JPG 是否真的落地成檔案');
const dlDir = path.join(process.cwd(), 'scratch', 'gm-test', 'stage8-probe', 'downloads');
fs.mkdirSync(dlDir, { recursive: true });
let dlOk = true;
try {
  await api.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dlDir, eventsEnabled: true });
} catch (e) {
  dlOk = false;
  note('Browser.setDownloadBehavior 失敗', String(e && e.message));
}
if (!dlOk) {
  try {
    await api.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dlDir });
    dlOk = true;
  } catch (e) {
    note('Page.setDownloadBehavior 也失敗', String(e && e.message));
  }
}
note('下載目錄設定', String(dlOk));
await closePalette();
const exp2 = await clickText('匯出 JPG', 100);
note('再點一次匯出', JSON.stringify(exp2));
const t2 = await watchToast(9000);
note('第二次匯出的 toast', JSON.stringify(t2));
await new Promise((r) => setTimeout(r, 2500));
const files = fs.existsSync(dlDir) ? fs.readdirSync(dlDir).map((f) => ({ f, size: fs.statSync(path.join(dlDir, f)).size })) : [];
note('下載目錄內容', JSON.stringify(files));

dumpErrors(api);
report('階段 8 探勘（預覽與卡面結構）');
await api.close();
