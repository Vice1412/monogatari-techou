/**
 * 階段 9 關卡：輸出與互操作。
 *
 * 問題意識：**這張卡離開工坊之後還完整嗎？**
 * 前八個階段都在看「畫面上有沒有東西」；這一階段看的是**送出去的東西對不對**——
 * 四種文字格式、JSON 往返、全庫備份、入戰推送、關聯跳轉。
 *
 * 本關卡同時驗收階段 9 開頭修的六個缺陷：
 *   GM-08-01 主題選單文字被正則吃光 → 期望六個非空名稱
 *   GM-08-02 揭示視角沒有提示條     → 期望 10+ 時有說明、完整時沒有
 *   GM-08-03 `??` 沒有圖例          → 期望 7+ 的提示條提到 ??
 *   GM-09-01 三種格式缺背景故事     → 期望四種格式都含故事
 *   GM-09-02 ccfolia 不理揭示等級   → 期望 10+ 的 ccfolia 不含故事／戰術、initiative 0
 *   GM-09-03 非完整視角仍說「全文本」→ 期望 toast 帶視角註記
 *   GM-09-04 匯出 JSON 是死碼       → 期望檔案庫每張卡都有匯出按鈕且真的落地
 *   GM-01-01 備份陣列餵匯入會炸掉    → 期望匯入成功、不進 ErrorBoundary
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './cdp.mjs';
import {
  BASE, OUT_ROOT, openWorkshop, newNpc, gotoStep, setValue, snap, section, check, note, report, dumpErrors, armDialog, uploadFile, libCount,
} from './lib.mjs';

const STAGE = 'stage9';
const DL = path.join(OUT_ROOT, STAGE, 'downloads');
fs.mkdirSync(DL, { recursive: true });
for (const f of fs.readdirSync(DL)) fs.unlinkSync(path.join(DL, f));

const api = await launch();
armDialog(api, { accept: true });

const settle = async (ms = 500) => {
  await new Promise((r) => setTimeout(r, ms));
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  await new Promise((r) => setTimeout(r, 130));
};

/** 真滑鼠優先；被 sticky／SVG 擋住時退回程式點擊（並回報用了哪一種）。 */
const clickText = async (text, waitMs = 700) => {
  const target = JSON.stringify(text);
  const find = `[...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${target})`;
  for (let attempt = 0; attempt < 3; attempt++) {
    await api.eval(`(() => { const b = ${find}; if (b) b.scrollIntoView({ block: 'center' }); })()`);
    await new Promise((r) => setTimeout(r, 260));
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
    if (info.hitIsSelf) {
      await api.clickAt(info.x, info.y);
      await settle(waitMs);
      return { ok: true, mode: 'mouse' };
    }
    await api.clickAt(6, 6);
    await settle(320);
  }
  const ok = await api.eval(`(() => { const b = ${find}; if (!b) return false; b.click(); return true; })()`);
  await settle(waitMs);
  return { ok, mode: 'programmatic' };
};

/** 用 title 前綴點「只有圖示」的按鈕。 */
const clickByTitlePrefix = async (prefix, waitMs = 700) => {
  const ok = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').startsWith(${JSON.stringify(prefix)}));
    if (!b) return false;
    b.scrollIntoView({ block: 'center' });
    b.click();
    return true;
  })()`);
  await settle(waitMs);
  return ok;
};

const bodyText = () => api.eval(`document.body.innerText`);

/** 密集取樣：toast 只活 3 秒，單次取樣會把「很快」誤判成「沒發生」。 */
const watchToast = async (ms = 5000, step = 120) => {
  const seen = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const msg = await api.eval(`(() => {
      const t = document.body.innerText;
      const m = t.match(/已複製[^\\n]*|成功匯出[^\\n]*|已讀取[^\\n]*|已從備份檔[^\\n]*|已成功備份[^\\n]*|無效的 JSON[^\\n]*|這個備份檔[^\\n]*|已將【[^\\n]*|入戰失敗[^\\n]*|已成功儲存[^\\n]*|已切換至[^\\n]*|已刪除[^\\n]*/);
      return m ? m[0].trim() : null;
    })()`);
    if (msg && !seen.some((s) => s.msg === msg)) seen.push({ at: Date.now() - t0, msg });
    await new Promise((r) => setTimeout(r, step));
  }
  return seen;
};

const hasBoundary = () => api.eval(`document.body.innerText.includes('遭遇了阻礙') || document.body.innerText.includes('重新載入')`);

/** 攔截剪貼簿寫入，回傳「按下去之後真正被複製的那段字」。 */
const installClipboardSpy = () => api.eval(`(() => {
  window.__copied = [];
  navigator.clipboard.writeText = (t) => { window.__copied.push(t); return Promise.resolve(); };
  return true;
})()`);
const lastCopied = () => api.eval(`window.__copied && window.__copied.length ? window.__copied[window.__copied.length - 1] : null`);

const openCopyMenu = async () => {
  await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /複製文本/.test(x.innerText || '') && /▾/.test(x.innerText || ''));
    if (b) b.click();
  })()`);
  await settle(450);
};

const copyAs = async (label) => {
  await openCopyMenu();
  const r = await clickText(label, 600);
  const toasts = await watchToast(2200);
  return { r, toasts, text: await lastCopied() };
};

const openPreview = async () => {
  const r = await clickText('角色卡預覽', 900);
  return r;
};

/**
 * 檔案庫筆數。優先讀畫面上的「顯示 N / 共 M 隻」，但那段字只在檔案庫頁籤存在；
 * 停在構築頁時退回 localStorage，否則會把「不在那一頁」誤判成「一張卡都沒有」。
 */
const libTotal = async (api) => {
  const dom = await libCount(api);
  if (dom) return dom.total;
  return api.eval(`(() => {
    try {
      const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]');
      return Array.isArray(a) ? a.length : -1;
    } catch { return -1; }
  })()`);
};

// ════════════════════════════════════════════════════════════
await api.goto(BASE, { timeout: 30000 });
await api.eval(`(() => {
  ['monogatari_techou_npc_library', 'monogatari_techou_active_combat', 'fu_companion_npc_library', 'fabula-npc-library-v2', 'fu_npc_library'].forEach((k) => localStorage.removeItem(k));
  return true;
})()`);
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });

section('設定：造一張有故事、有戰術、有特質的卡');
await gotoStep(api, 7);
await setValue(api, 'input[placeholder="輸入名稱..."]', '灰燼守門人');
await setValue(api, 'input[placeholder*="敏捷"]', '不死, 遲緩');
await setValue(api, 'textarea[placeholder*="起源"]', '被燒毀的鐘樓底下醒來，記得的最後一件事是鐘聲。');
await settle(300);
await gotoStep(api, 8);
await setValue(api, 'textarea', '優先攻擊施法者；血量低於一半時退到後排。');
await settle(300);
await clickText('儲存', 900);
await new Promise((r) => setTimeout(r, 600));
check('設定：檔案庫有 1 張卡', (await libTotal(api)) === 1, `實際 ${await libTotal(api)}`);

await openPreview();
await installClipboardSpy();

// ── A 四種格式的實際輸出（完整視角）─────────────────────────
section('A 四種文字格式（完整視角）');
const FMT = [
  ['Discord', 'Discord 格式', 'discord'],
  ['Markdown', 'Markdown 格式', 'markdown'],
  ['純文字筆記', '純文字筆記格式', 'plain'],
  ['ccfolia', 'ccfolia 棋子 (Ctrl+V)', 'ccfolia'],
];
const out = {};
for (const [name, label, key] of FMT) {
  const got = await copyAs(label);
  out[key] = got;
  check(`A-${key}-1 能複製「${name}」`, got.r.ok, `mode=${got.r.mode}`);
  check(`A-${key}-2 有成功提示`, got.toasts.length > 0, JSON.stringify(got.toasts.map((t) => t.msg)));
  check(`A-${key}-3 剪貼簿拿到非空字串`, !!got.text && got.text.length > 100, `${got.text ? got.text.length : 0} 字`);
  check(`A-${key}-4 含背景故事`, !!got.text && got.text.includes('鐘聲'));
  check(`A-${key}-5 含戰術慣例`, !!got.text && got.text.includes('優先攻擊施法者'));
}
check('A-01 Discord 用 yaml 圍欄包標頭', out.discord.text.startsWith('```yaml'));
check('A-02 Discord 標頭含名字與等級', /=== 灰燼守門人 \(Lv\.5\) ===/.test(out.discord.text));
check('A-03 Markdown 用 ### 標題', out.markdown.text.startsWith('### 灰燼守門人'));
check('A-04 純文字筆記不含 Markdown 井號', !out.plain.text.includes('###'));
check('A-05 ccfolia 是合法 JSON', (() => { try { JSON.parse(out.ccfolia.text); return true; } catch { return false; } })());
check('A-06 ccfolia kind 為 character', (() => { try { return JSON.parse(out.ccfolia.text).kind === 'character'; } catch { return false; } })());
check('A-07 ccfolia 有 HP/MP 狀態欄', (() => {
  try {
    const labels = JSON.parse(out.ccfolia.text).data.status.map((s) => s.label);
    return labels.includes('HP') && labels.includes('MP');
  } catch { return false; }
})());
check('A-08 四種格式長度互不相同（不是同一份字串換皮）', new Set(FMT.map(([, , k]) => out[k].text.length)).size === 4,
  FMT.map(([, , k]) => `${k}:${out[k].text.length}`).join(' '));
note('四種格式長度', FMT.map(([, , k]) => `${k}=${out[k].text.length}`).join(' '));
await snap(api, STAGE, 'A1-copy-menu');

// ── B 揭示等級與輸出的一致性 ────────────────────────────────
section('B 揭示等級：畫面遮了，輸出有沒有一起遮');
check('B-01 完整視角沒有提示條', !(await bodyText()).includes('目前是研究檢定視角'));
await clickText('10+', 600);
const hint10 = await api.eval(`(() => { const t = document.body.innerText; const i = t.indexOf('目前是研究檢定視角'); return i >= 0 ? t.slice(i, i + 120).replace(/\\n+/g, ' ') : null; })()`);
check('B-02 10+ 出現視角提示條（GM-08-02）', !!hint10, JSON.stringify(hint10));
check('B-03 提示條點名「背景故事與戰術」', !!hint10 && hint10.includes('背景故事') && hint10.includes('戰術'));
check('B-04 提示條告訴 GM 怎麼切回去', !!hint10 && hint10.includes('完整'));
check('B-05 10+ 的提示條不提 ??（數值仍可見）', !!hint10 && !hint10.includes('??'));
await snap(api, STAGE, 'B1-hint-10');
await clickText('7+', 600);
const hint7 = await api.eval(`(() => { const t = document.body.innerText; const i = t.indexOf('目前是研究檢定視角'); return i >= 0 ? t.slice(i, i + 160).replace(/\\n+/g, ' ') : null; })()`);
check('B-06 7+ 的提示條解釋 ??（GM-08-03）', !!hint7 && hint7.includes('??'), JSON.stringify(hint7));
await snap(api, STAGE, 'B2-hint-7');

await clickText('10+', 600);
const md10 = await copyAs('Markdown 格式');
check('B-07 10+ 的 Markdown 不含背景故事', !!md10.text && !md10.text.includes('鐘聲'));
check('B-08 10+ 的 Markdown 不含戰術', !!md10.text && !md10.text.includes('優先攻擊施法者'));
check('B-09 10+ 的 Markdown 比完整視角短', !!md10.text && md10.text.length < out.markdown.text.length,
  `${md10.text ? md10.text.length : 0} < ${out.markdown.text.length}`);
check('B-10 10+ 的提示語不再宣稱「全文本」（GM-09-03）',
  md10.toasts.some((t) => t.msg.includes('10+ 視角')) && !md10.toasts.some((t) => t.msg.includes('全文本')),
  JSON.stringify(md10.toasts.map((t) => t.msg)));

const cc10 = await copyAs('ccfolia 棋子 (Ctrl+V)');
let cc10json = null;
try { cc10json = JSON.parse(cc10.text); } catch { cc10json = null; }
check('B-11 10+ 的 ccfolia 仍是合法 JSON', !!cc10json);
check('B-12 10+ 的 ccfolia memo 不含背景故事（GM-09-02）', !!cc10json && !cc10json.data.memo.includes('鐘聲'),
  cc10json ? JSON.stringify(cc10json.data.memo.slice(0, 80)) : 'null');
check('B-13 10+ 的 ccfolia memo 不含戰術', !!cc10json && !cc10json.data.memo.includes('優先攻擊施法者'));
check('B-14 10+ 的 ccfolia 先攻給真實值（10+ 已揭示數值）', !!cc10json && cc10json.data.initiative === 7,
  cc10json ? String(cc10json.data.initiative) : 'null');
check('B-15 10+ 的 ccfolia 仍給 HP/MP（7+ 也看得到）', !!cc10json && cc10json.data.status.length >= 2);
note('10+ ccfolia memo', cc10json ? JSON.stringify(cc10json.data.memo) : 'null');

await clickText('7+', 600);
const cc7 = await copyAs('ccfolia 棋子 (Ctrl+V)');
let cc7json = null;
try { cc7json = JSON.parse(cc7.text); } catch { cc7json = null; }
check('B-16 7+ 的 ccfolia 不洩漏特質', !!cc7json && !cc7json.data.memo.includes('不死, 遲緩'),
  cc7json ? JSON.stringify(cc7json.data.memo.slice(0, 80)) : 'null');
check('B-17 7+ 的 ccfolia 先攻被遮成 0', !!cc7json && cc7json.data.initiative === 0,
  cc7json ? String(cc7json.data.initiative) : 'null');
check('B-17b 7+ 的 ccfolia 仍給 HP/MP（畫面上 7+ 也看得到）', !!cc7json && cc7json.data.status.length >= 2);
await clickText('完整', 600);
const mdFull = await copyAs('Markdown 格式');
check('B-18 切回完整後故事回來了', !!mdFull.text && mdFull.text.includes('鐘聲'));
check('B-19 切回完整後提示條消失', !(await bodyText()).includes('目前是研究檢定視角'));

// ── C 主題選單（GM-08-01）───────────────────────────────────
section('C 卡片風格選單的文字');
await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('卡片風格'));
  if (b) b.click();
})()`);
await settle(500);
const themeLabels = await api.eval(`(() => [...document.querySelectorAll('button')].filter((b) => b.querySelector('div[style*="background-color"]') && (b.innerText || '').trim().length <= 6).map((b) => (b.innerText || '').trim()))()`);
check('C-01 六個主題按鈕都有文字（GM-08-01）', themeLabels.length === 6 && themeLabels.every((t) => t.length > 0), JSON.stringify(themeLabels));
check('C-02 六個名稱互不相同', new Set(themeLabels).size === 6, JSON.stringify(themeLabels));
check('C-03 名稱是完整主題名（不再被正則削掉前綴）', themeLabels.includes('琥珀棕') && themeLabels.includes('秘術紫'), JSON.stringify(themeLabels));
await snap(api, STAGE, 'C1-theme-labels');
await api.eval(`(() => {
  const ov = [...document.querySelectorAll('div')].find((d) => typeof d.className === 'string' && d.className.includes('fixed') && d.className.includes('inset-0') && d.className.includes('z-40'));
  if (ov) ov.click();
})()`);
await settle(400);

// ── D 入戰推送 ─────────────────────────────────────────────
section('D 入戰推送');
await clickText('返回檔案庫', 900);
check('D-00 已回到檔案庫', (await bodyText()).includes('建立新 NPC'));
const push = await clickText('入戰', 800);
check('D-01 入戰按鈕可按', push.ok, `mode=${push.mode}`);
const pushToast = await watchToast(2500);
check('D-02 入戰有成功提示', pushToast.some((t) => t.msg.includes('已將【灰燼守門人】推入戰鬥房間')), JSON.stringify(pushToast.map((t) => t.msg)));
const combat1 = await api.eval(`(() => { const o = JSON.parse(localStorage.getItem('monogatari_techou_active_combat') || 'null'); return o ? { n: (o.combatants || []).length, first: (o.combatants || [])[0] || null } : null; })()`);
check('D-03 activeCombat 寫入了 1 名參戰者', !!combat1 && combat1.n === 1, JSON.stringify(combat1 && combat1.n));
check('D-04 參戰者有名字', !!combat1 && combat1.first && combat1.first.name === '灰燼守門人', combat1 && combat1.first ? combat1.first.name : 'null');
check('D-05 參戰者帶了 HP/MP', !!combat1 && combat1.first && combat1.first.hp?.current === 70 && combat1.first.mp?.current === 45,
  combat1 && combat1.first ? JSON.stringify({ hp: combat1.first.hp, mp: combat1.first.mp }) : 'null');
check('D-06 參戰者帶了先攻與防禦', !!combat1 && combat1.first && combat1.first.initiative === 7 && combat1.first.defense === 8,
  combat1 && combat1.first ? `init=${combat1.first.initiative} def=${combat1.first.defense}` : 'null');
check('D-07 參戰者保留了原始 NPC 資料（可回溯）', !!combat1 && combat1.first && !!combat1.first.rawNpcData);
check('D-08 參戰者沒有 hasActed 以外的殘留狀態', !!combat1 && combat1.first && combat1.first.hasActed === false,
  combat1 && combat1.first ? String(combat1.first.hasActed) : 'null');
await clickText('入戰', 700);
const combat2 = await api.eval(`(() => { const o = JSON.parse(localStorage.getItem('monogatari_techou_active_combat') || 'null'); return o ? (o.combatants || []).length : 0; })()`);
check('D-09 再按一次入戰會再加一名（不覆蓋）', combat2 === 2, String(combat2));

// ── E 匯出單張 JSON（GM-09-04）──────────────────────────────
section('E 匯出單張 JSON');
await api.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true }).catch(() => {});
const exportTitles = await api.eval(`(() => [...document.querySelectorAll('button')].map((b) => b.getAttribute('title') || '').filter((t) => t.startsWith('匯出「')))()`);
check('E-01 每張卡都有「匯出 JSON」按鈕（GM-09-04）', exportTitles.length === 1, JSON.stringify(exportTitles));
const expOk = await clickByTitlePrefix('匯出「灰燼守門人」的 JSON 存檔');
check('E-02 匯出按鈕可按', expOk);
const expToast = await watchToast(2500);
check('E-03 匯出有成功提示', expToast.some((t) => t.msg.includes('成功匯出「灰燼守門人」')), JSON.stringify(expToast.map((t) => t.msg)));
await new Promise((r) => setTimeout(r, 1200));
const singleFile = fs.readdirSync(DL).find((f) => f.endsWith('_fabula_ultima.json'));
check('E-04 落地檔名為 <名字>_fabula_ultima.json', singleFile === '灰燼守門人_fabula_ultima.json', String(singleFile));
let singleObj = null;
if (singleFile) {
  const raw = fs.readFileSync(path.join(DL, singleFile), 'utf8');
  try { singleObj = JSON.parse(raw); } catch { singleObj = null; }
}
check('E-05 檔案是物件（單張），不是陣列', !!singleObj && !Array.isArray(singleObj));
check('E-06 檔案保留了名字與等級', !!singleObj && singleObj.name === '灰燼守門人' && singleObj.level === 5,
  singleObj ? `name=${singleObj.name} lv=${singleObj.level}` : 'null');
check('E-07 檔案保留了背景故事與戰術', !!singleObj && !!singleObj.story && !!singleObj.tactics);
check('E-08 檔案有 id（匯入才不會撞號）', !!singleObj && typeof singleObj.id === 'string' && singleObj.id.length > 0);
note('單張 JSON 大小', singleFile ? String(fs.statSync(path.join(DL, singleFile)).size) : 'n/a');

// ── F 全庫備份（GM-01-01 的來源）─────────────────────────────
section('F 全庫備份');
const backupOk = await clickText('備份全庫', 800);
check('F-01 備份全庫可按', backupOk.ok, `mode=${backupOk.mode}`);
const backupToast = await watchToast(2500);
check('F-02 備份提示帶筆數', backupToast.some((t) => /已成功備份包含 1 個 NPC/.test(t.msg)), JSON.stringify(backupToast.map((t) => t.msg)));
await new Promise((r) => setTimeout(r, 1200));
const backupFile = fs.readdirSync(DL).find((f) => f.includes('library_backup'));
check('F-03 落地檔名含 library_backup 與日期', !!backupFile && /^monogatari_techou_npc_library_backup_\d{4}-\d{2}-\d{2}\.json$/.test(backupFile), String(backupFile));
let backupArr = null;
if (backupFile) {
  const raw = fs.readFileSync(path.join(DL, backupFile), 'utf8');
  try { backupArr = JSON.parse(raw); } catch { backupArr = null; }
}
check('F-04 備份內容是陣列（不是物件）', Array.isArray(backupArr), backupArr === null ? 'parse 失敗' : typeof backupArr);
check('F-05 備份長度等於檔案庫筆數', Array.isArray(backupArr) && backupArr.length === 1, Array.isArray(backupArr) ? String(backupArr.length) : 'n/a');

// ── G 匯入往返（GM-01-01 正面對撞）──────────────────────────
section('G 匯入往返');
const tagImport = () => api.eval(`(() => {
  const target = [...document.querySelectorAll('input[type="file"]')].find((i) => {
    const lab = i.closest('label');
    return lab && lab.innerText.includes('匯入單張 NPC');
  });
  if (!target) return false;
  target.setAttribute('data-gm-import', '1');
  return true;
})()`);
check('G-00 找得到「匯入單張 NPC」的檔案輸入框', await tagImport());

await uploadFile(api, '[data-gm-import="1"]', path.join(DL, backupFile));
const gToasts = await watchToast(3500);
check('G-01 備份陣列不再炸成 ErrorBoundary（GM-01-01）', !(await hasBoundary()));
check('G-02 匯入備份檔有明確回報', gToasts.some((t) => t.msg.includes('已從備份檔匯入')), JSON.stringify(gToasts.map((t) => t.msg)));
check('G-03 回報同時講「新增」與「覆蓋」', gToasts.some((t) => t.msg.includes('新增') && t.msg.includes('覆蓋')), JSON.stringify(gToasts.map((t) => t.msg)));
check('G-04 同 id 視為覆蓋，檔案庫不會長出重複卡', (await libTotal(api)) === 1, String(await libTotal(api)));
check('G-05 匯入後停在被選取的檔案庫頁', (await bodyText()).includes('建立新 NPC'));

await api.eval(`(() => { const el = document.querySelector('[data-gm-import="1"]'); if (el) el.value = ''; return true; })()`);
await uploadFile(api, '[data-gm-import="1"]', path.join(DL, singleFile));
const g2 = await watchToast(3500);
check('G-06 單張 JSON 匯入成功', g2.some((t) => t.msg.includes('已讀取「灰燼守門人」')), JSON.stringify(g2.map((t) => t.msg)));
check('G-07 單張匯入不炸 ErrorBoundary', !(await hasBoundary()));
check('G-08 單張匯入後跳到構築頁', (await bodyText()).includes('建構步驟'));
// 名稱欄在步驟 7；匯入只切頁籤、不動步驟，所以要先跳回步驟 7 才讀得到。
await gotoStep(api, 7);
const roundTripName = await api.eval(`(() => { const i = [...document.querySelectorAll('input')].find((x) => (x.placeholder || '').includes('輸入名稱')); return i ? i.value : null; })()`);
check('G-09 往返後名字逐字相同', roundTripName === '灰燼守門人', String(roundTripName));
check('G-10 單張匯入不會自動進檔案庫（要按儲存）', (await libTotal(api)) === 1, String(await libTotal(api)));

// ── H 關聯跳轉（階段 8 延後項）──────────────────────────────
section('H 關聯跳轉');
await clickText('返回檔案庫', 900);
await clickText('建立新 NPC', 900);
await gotoStep(api, 7);
await setValue(api, 'input[placeholder="輸入名稱..."]', '灰燼見習生');
await settle(300);
check('H-01 只有 1 張卡時關聯區塊顯示空狀態', (await bodyText()).includes('檔案庫中暫無其他可連結的實體'));
await clickText('儲存', 900);
await new Promise((r) => setTimeout(r, 700));
check('H-02 檔案庫變成 2 張', (await libTotal(api)) === 2, String(await libTotal(api)));

await clickText('返回檔案庫', 900);
check('H-02b 回到檔案庫看得到兩張卡', (await api.eval(`[...document.querySelectorAll('h3')].map((e) => e.innerText.trim())`)).length === 2,
  JSON.stringify(await api.eval(`[...document.querySelectorAll('h3')].map((e) => e.innerText.trim())`)));

const editA = await api.eval(`(() => {
  const btns = [...document.querySelectorAll('button')].filter((b) => (b.innerText || '').trim() === '編輯');
  const target = btns.find((b) => {
    let p = b;
    for (let i = 0; i < 3 && p; i++) { p = p.parentElement; if (p && (p.innerText || '').includes('灰燼守門人')) return true; }
    return false;
  });
  if (!target) return false;
  target.scrollIntoView({ block: 'center' });
  target.click();
  return true;
})()`);
check('H-03 找得到「灰燼守門人」的編輯按鈕', editA);
await settle(900);
await gotoStep(api, 7);
check('H-04 有 2 張卡時關聯區塊出現候選', !(await bodyText()).includes('檔案庫中暫無其他可連結的實體'));
const linkSel = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('灰燼見習生') && x.className.includes('border-2'));
  if (!b) return { found: false };
  b.scrollIntoView({ block: 'center' });
  b.click();
  const after = getComputedStyle(b).borderColor;
  return { found: true, border: after };
})()`);
check('H-05 點候選即建立連結', linkSel.found, JSON.stringify(linkSel));
await settle(500);
const linkBorder = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('灰燼見習生') && x.className.includes('border-2'));
  return b ? getComputedStyle(b).borderColor : null;
})()`);
check('H-06 已連結的候選被標成琥珀色', linkBorder === 'rgb(217, 119, 6)', String(linkBorder));
await snap(api, STAGE, 'H1-link-selected');
await clickText('儲存', 900);
await new Promise((r) => setTimeout(r, 700));
await openPreview();
const jumpBar = await api.eval(`(() => {
  const t = document.body.innerText;
  const i = t.indexOf('關聯實體快速跳轉');
  return i >= 0 ? t.slice(i, i + 80).replace(/\\n+/g, ' ') : null;
})()`);
check('H-07 預覽出現「關聯實體快速跳轉」', !!jumpBar, JSON.stringify(jumpBar));
check('H-08 跳轉列列出「灰燼見習生」', !!jumpBar && jumpBar.includes('灰燼見習生'));
await snap(api, STAGE, 'H2-jump-bar');
const jumpR = await clickText('灰燼見習生', 1000);
const jumpToast = await watchToast(2500);
check('H-09 點跳轉會切換到另一張卡', jumpToast.some((t) => t.msg.includes('已切換至「灰燼見習生」')), JSON.stringify(jumpToast.map((t) => t.msg)));
check('H-10 切換後卡片標題變成「灰燼見習生」', (await api.eval(`(() => { const el = document.querySelector('.border-double'); return el ? el.innerText.slice(0, 40) : null; })()`))?.includes('灰燼見習生'),
  JSON.stringify(await api.eval(`(() => { const el = document.querySelector('.border-double'); return el ? el.innerText.slice(0, 40) : null; })()`)));
check('H-11 切換後檔案庫仍是 2 張（跳轉不是複製）', (await libTotal(api)) === 2, String(await libTotal(api)));
check('H-12 跳轉列不會被匯出（它在卡框外）', await api.eval(`(() => { const el = document.querySelector('.border-double'); return el ? !el.innerText.includes('關聯實體快速跳轉') : false; })()`));

dumpErrors(api);
report('階段 9（輸出與互操作）');
await api.close();
