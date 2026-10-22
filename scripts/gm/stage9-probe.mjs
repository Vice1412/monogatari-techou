/**
 * 階段 9 探勘：輸出與互操作。
 *
 * 要量的是「這張卡離開工坊之後還完整嗎」：
 *   1. 四種文字格式各自長什麼樣、揭示等級會不會連輸出一起遮。
 *   2. JSON 匯出→匯入往返，值有沒有被吃掉。
 *   3. 全庫備份（陣列）餵回「匯入 NPC」——這是 GM-01-01 的正面對撞。
 *   4. 入戰推送寫進 activeCombat 的內容。
 *   5. 關聯跳轉（需要檔案庫裡有第二張卡）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './cdp.mjs';
import {
  BASE, openWorkshop, newNpc, gotoStep, setValue, snap, section, note, report, dumpErrors, armDialog, uploadFile,
} from './lib.mjs';

const STAGE = '9-probe';
const api = await launch();
armDialog(api, { accept: true });

const settle = async (ms = 500) => {
  await new Promise((r) => setTimeout(r, ms));
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  await new Promise((r) => setTimeout(r, 130));
};

const clickText = async (text, waitMs = 700) => {
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

const toastNow = () => api.eval(`(() => {
  const t = document.body.innerText;
  const m = t.match(/已複製[^\\n]*|成功匯出[^\\n]*|已讀取[^\\n]*|已從備份檔[^\\n]*|已成功備份[^\\n]*|無效的 JSON[^\\n]*|已將【[^\\n]*|入戰失敗[^\\n]*|已儲存[^\\n]*/);
  return m ? m[0] : null;
})()`);

const watchToast = async (ms = 6000, step = 150) => {
  const seen = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const msg = await toastNow();
    if (msg && !seen.some((s) => s.msg === msg)) seen.push({ at: Date.now() - t0, msg });
    await new Promise((r) => setTimeout(r, step));
  }
  return seen;
};

// ── 乾淨起點 ─────────────────────────────────────────────────
await api.goto(BASE, { timeout: 30000 });
await api.eval(`(() => {
  ['monogatari_techou_npc_library', 'monogatari_techou_active_combat', 'fu_companion_npc_library', 'fabula-npc-library-v2', 'fu_npc_library'].forEach((k) => localStorage.removeItem(k));
  return true;
})()`);
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

section('P0 先存一張卡進檔案庫');
const saveR = await clickText('儲存', 900);
note('儲存點擊模式', saveR.mode);
note('存檔 toast', JSON.stringify(await watchToast(4000)));
note('檔案庫筆數', await api.eval(`(() => { const raw = localStorage.getItem('monogatari_techou_npc_library'); const a = JSON.parse(raw || '[]'); return a.length; })()`));

// ── P1 四種文字格式 ──────────────────────────────────────────
section('P1 四種文字格式的實際輸出');
await clickText('角色卡預覽', 900);
await api.eval(`(() => {
  window.__copied = [];
  if (!window.__clipPatched) {
    window.__clipPatched = true;
    navigator.clipboard.writeText = (t) => { window.__copied.push(t); return Promise.resolve(); };
  }
  return true;
})()`);

const grabFormat = async (label) => {
  await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /複製文本/.test(x.innerText || '') && /▾/.test(x.innerText || ''));
    if (b) b.click();
  })()`);
  await settle(450);
  const r = await clickText(label, 700);
  const toasts = await watchToast(2500, 120);
  const txt = await api.eval(`window.__copied.length ? window.__copied[window.__copied.length - 1] : null`);
  return { r, toasts, txt };
};

for (const [key, label] of [['discord', 'Discord 格式'], ['markdown', 'Markdown 格式'], ['plain', '純文字筆記格式'], ['ccfolia', 'ccfolia 棋子 (Ctrl+V)']]) {
  const got = await grabFormat(label);
  note(`${key} 點擊`, got.r.mode);
  note(`${key} toast`, JSON.stringify(got.toasts.map((t) => t.msg)));
  note(`${key} 長度`, String(got.txt ? got.txt.length : 0));
  note(`${key} 前 400 字`, JSON.stringify(got.txt ? got.txt.slice(0, 400) : null));
  note(`${key} 有故事嗎`, String(got.txt ? got.txt.includes('鐘聲') : null));
  note(`${key} 有戰術嗎`, String(got.txt ? got.txt.includes('優先攻擊施法者') : null));
}

section('P2 揭示等級 10+ 時輸出會不會跟著遮');
await clickText('10+', 600);
const md10 = await grabFormat('Markdown 格式');
note('10+ markdown 長度', String(md10.txt ? md10.txt.length : 0));
note('10+ markdown 有故事嗎', String(md10.txt ? md10.txt.includes('鐘聲') : null));
note('10+ markdown 有戰術嗎', String(md10.txt ? md10.txt.includes('優先攻擊施法者') : null));
note('10+ 畫面有提示條嗎', String(await api.eval(`document.body.innerText.includes('研究檢定視角')`)));
note('10+ 提示條全文', JSON.stringify(await api.eval(`(() => { const t = document.body.innerText; const i = t.indexOf('目前是研究檢定視角'); return i >= 0 ? t.slice(i, i + 120).replace(/\\n+/g, ' ') : null; })()`)));
await clickText('7+', 600);
note('7+ 提示條有提到 ?? 嗎', String(await api.eval(`(() => { const t = document.body.innerText; const i = t.indexOf('目前是研究檢定視角'); return i >= 0 ? t.slice(i, i + 160).includes('??') : null; })()`)));
await snap(api, STAGE, 'P2-reveal-hint');
await clickText('完整', 600);

// ── P3 主題選單現在有文字了嗎 ────────────────────────────────
section('P3 主題選單的文字（GM-08-01 修復驗證）');
await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('卡片風格'));
  if (b) b.click();
})()`);
await settle(500);
const themeLabels = await api.eval(`(() => [...document.querySelectorAll('button')].filter((b) => b.querySelector('div[style*="background-color"]') && (b.innerText || '').trim().length <= 6).map((b) => (b.innerText || '').trim()))()`);
note('主題按鈕文字', JSON.stringify(themeLabels));
await snap(api, STAGE, 'P3-theme-labels');
await api.eval(`(() => {
  const ov = [...document.querySelectorAll('div')].find((d) => typeof d.className === 'string' && d.className.includes('fixed') && d.className.includes('inset-0') && d.className.includes('z-40'));
  if (ov) ov.click();
})()`);
await settle(400);

// ── P4 匯出 JSON ─────────────────────────────────────────────
section('P4 匯出單張 JSON（檔案庫每張卡的「匯出」）');
const dlDir = 'E:\\MINGWAN\\Projects\\monogatari-techou\\scratch\\gm-test\\stage9-probe\\downloads';
await api.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dlDir, eventsEnabled: true }).catch(() => {});
const backR = await clickText('返回檔案庫', 900);
note('返回檔案庫', backR.mode);
note('檔案庫按鈕清單', JSON.stringify(await api.eval(`(() => [...document.querySelectorAll('button')].map((b) => ((b.innerText || '').replace(/\\s+/g, ' ').trim() || (b.getAttribute('title') || '')).slice(0, 24)).filter((t) => t))()`)));
const expJson = await api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '').startsWith('匯出「'));
  if (!b) return false;
  b.click();
  return true;
})()`);
note('匯出 JSON 有按鈕嗎', String(expJson));
note('匯出 JSON toast', JSON.stringify((await watchToast(3000)).map((t) => t.msg)));

section('P5 全庫備份');
const backupR = await clickText('備份全庫', 700);
note('備份全庫點擊', backupR.mode);
note('備份 toast', JSON.stringify((await watchToast(3000)).map((t) => t.msg)));
await new Promise((r) => setTimeout(r, 2000));
note('下載目錄', JSON.stringify(await api.eval(`null`)));

// ── P6 入戰推送 ─────────────────────────────────────────────
section('P6 入戰推送');
const pushR = await clickText('入戰', 700);
note('入戰點擊', pushR.mode);
note('入戰 toast', JSON.stringify((await watchToast(3000)).map((t) => t.msg)));
note('activeCombat 內容', await api.eval(`(() => { const raw = localStorage.getItem('monogatari_techou_active_combat'); if (!raw) return null; const o = JSON.parse(raw); return JSON.stringify({ keys: Object.keys(o), count: (o.combatants || []).length, first: (o.combatants || [])[0] ? Object.keys((o.combatants || [])[0]) : null }); })()`));

section('P7 用備份檔餵「匯入單張 NPC」（GM-01-01 正面對撞）');
await new Promise((r) => setTimeout(r, 1500));
const files = fs.existsSync(dlDir) ? fs.readdirSync(dlDir) : [];
note('下載目錄內容', JSON.stringify(files.map((f) => ({ f, size: fs.statSync(path.join(dlDir, f)).size }))));
const backupFile = files.find((f) => f.includes('library_backup'));
const singleFile = files.find((f) => f.endsWith('_fabula_ultima.json'));
note('備份檔', String(backupFile));
note('單張檔', String(singleFile));
if (backupFile) {
  const p = path.join(dlDir, backupFile);
  const raw = fs.readFileSync(p, 'utf8');
  note('備份檔開頭', JSON.stringify(raw.slice(0, 40)));
  note('備份檔是陣列嗎', String(Array.isArray(JSON.parse(raw))));
}
const tagged = await api.eval(`(() => {
  const inputs = [...document.querySelectorAll('input[type="file"]')];
  const target = inputs.find((i) => { const lab = i.closest('label'); return lab && lab.innerText.includes('匯入單張 NPC'); });
  if (!target) return false;
  target.setAttribute('data-gm-import', '1');
  return true;
})()`);
note('找到匯入 input 嗎', String(tagged));
if (tagged && backupFile) {
  await uploadFile(api, '[data-gm-import="1"]', path.join(dlDir, backupFile));
  const toasts = await watchToast(4000);
  note('匯入備份檔的 toast', JSON.stringify(toasts.map((t) => t.msg)));
  note('有 ErrorBoundary 嗎', String(await api.eval(`document.body.innerText.includes('冒險儀座遭遇了阻礙')`)));
  note('頁面首 200 字', JSON.stringify(await api.eval(`document.body.innerText.slice(0, 200).replace(/\\n+/g, ' | ')`)));
  note('檔案庫筆數', await api.eval(`(() => { const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]'); return a.length; })()`));
}
if (singleFile) {
  await api.eval(`(() => { const el = document.querySelector('[data-gm-import="1"]'); if (el) el.value = ''; return true; })()`);
  await uploadFile(api, '[data-gm-import="1"]', path.join(dlDir, singleFile));
  const toasts2 = await watchToast(4000);
  note('匯入單張檔的 toast', JSON.stringify(toasts2.map((t) => t.msg)));
  note('有 ErrorBoundary 嗎（單張）', String(await api.eval(`document.body.innerText.includes('冒險儀座遭遇了阻礙')`)));
  note('載入後畫面首 200 字', JSON.stringify(await api.eval(`document.body.innerText.slice(0, 200).replace(/\\n+/g, ' | ')`)));
}

dumpErrors(api);
report('階段 9 探勘（輸出與互操作）');
await api.close();
