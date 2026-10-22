/**
 * 階段 7 探勘：步驟 7（身份：名稱／頭像／特質／故事／關聯實體）與步驟 8（戰術）。
 *
 * 不是關卡，是把結構量出來再寫 stage7.mjs。重點在頭像那條鏈：
 * 上傳 → 裁切視窗 → 套用，三段各自可能失敗，而且失敗時畫面不一定有訊息。
 */
import path from 'node:path';
import { launch } from './cdp.mjs';
import {
  openWorkshop, newNpc, gotoStep, snap, section, note, report, dumpErrors, armDialog, uploadFile, setValue,
} from './lib.mjs';

const STAGE = '7-probe';
const api = await launch();
armDialog(api, { accept: true });

const settle = async (ms = 400) => {
  await new Promise((r) => setTimeout(r, ms));
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  await new Promise((r) => setTimeout(r, 120));
};

const clickText = async (text, waitMs = 600) => {
  const xy = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button, label')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!xy) return false;
  await api.clickAt(xy.x, xy.y);
  await settle(waitMs);
  return true;
};

await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);

section('P1 步驟 7 的欄位');
const fields = await api.eval(`(() => ({
  labels: [...document.querySelectorAll('label')].map((l) => (l.innerText || '').replace(/\\s+/g, ' ').trim()),
  inputs: [...document.querySelectorAll('input')].map((i) => ({ type: i.type, ph: i.placeholder, val: (i.value || '').slice(0, 20) })),
  textareas: [...document.querySelectorAll('textarea')].map((t) => ({ ph: t.placeholder, val: (t.value || '').slice(0, 20) })),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim()).filter((t) => t && t.length < 24),
}))()`);
note('labels', JSON.stringify(fields.labels));
note('inputs', JSON.stringify(fields.inputs));
note('textareas', JSON.stringify(fields.textareas));
note('buttons', JSON.stringify(fields.buttons));

section('P2 名稱 → 預覽同步');
await setValue(api, 'input[placeholder="輸入名稱..."]', '測試傀儡');
await settle(500);
const nameSync = await api.eval(`(() => {
  const t = document.body.innerText;
  const i = t.indexOf('即時預覽');
  return i >= 0 ? t.slice(i, i + 120).replace(/\\n+/g, ' | ') : '';
})()`);
note('預覽開頭', nameSync);

section('P3 頭像：上傳 → 裁切視窗');
// 頁面上有多個 input[type=file]（備份匯入也是），直接 querySelector 會抓到備份那個。
// 頭像的那一個包在「上傳本地照片」的 label 裡。
const fileInfo = await api.eval(`(() => [...document.querySelectorAll('input[type="file"]')].map((e, i) => ({
  i, accept: e.accept,
  label: e.closest('label') ? (e.closest('label').innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 16) : null,
})))()`);
note('所有 file input', JSON.stringify(fileInfo));
const AVATAR_SEL = 'label[class*="cursor-pointer"] input[type="file"]';
// 檔案上傳那條自動化打不進去：`DOM.setFileInputFiles` 對這個 hidden input
// （`className="hidden"`，display:none）送得出去但 change 從不觸發，
// 帶不帶 objectGroup、用不用 DataTransfer 注入都一樣。改用「網址載入」測同一條裁切鏈，
// 它走的是同一個 `setIsCropModalOpen(true)` 出口。
const dataUrl = await api.eval(`(() => {
  const c = document.createElement('canvas');
  c.width = 120; c.height = 120;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c67836'; ctx.fillRect(0, 0, 120, 120);
  ctx.strokeStyle = '#3c2415'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 112, 112);
  return c.toDataURL('image/png');
})()`);
await setValue(api, 'input[type="url"]', dataUrl);
await settle(200);
await clickText('網址載入', 1100);
const uploadDiag = await api.eval(`(() => {
  const t = document.body.innerText;
  const m = t.match(/請輸入有效的圖片網址[^\\n]*|正在讀取[^\\n]*|圖片[^\\n]*失敗[^\\n]*/);
  return { toast: m ? m[0] : null, bodyHasCrop: t.includes('縮放大小') };
})()`);
note('網址載入診斷', JSON.stringify(uploadDiag));
const modal = await api.eval(`(() => {
  const t = document.body.innerText;
  const has = (s) => t.includes(s);
  const range = [...document.querySelectorAll('input[type="range"]')].map((r) => ({ min: r.min, max: r.max, val: r.value }));
  const btns = [...document.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim()).filter((x) => /取消|完成裁切|套用|快速|\\d+%/.test(x));
  return { hasScale: has('縮放大小'), hasQuick: has('快速倍率'), range, btns };
})()`);
note('裁切視窗', JSON.stringify(modal));
await snap(api, STAGE, 'P3-crop-modal');

section('P4 套用裁切');
const applied = await clickText('完成裁切並套用', 1200);
note('點「完成裁切並套用」', String(applied));
const afterCrop = await api.eval(`(() => ({
  img: !!document.querySelector('img[alt="Avatar Preview"]'),
  removeBtn: document.body.innerText.includes('移除圖片'),
  clearBtn: document.body.innerText.includes('清除圖片'),
  recrop: document.body.innerText.includes('重新調整大小'),
}))()`);
note('套用後', JSON.stringify(afterCrop));
await snap(api, STAGE, 'P4-avatar-applied');

section('P5 關聯實體');
const link = await api.eval(`(() => {
  const t = document.body.innerText;
  const i = t.indexOf('關聯實體設置');
  return { has: i >= 0, block: i >= 0 ? t.slice(i, i + 260).replace(/\\n+/g, ' | ') : '' };
})()`);
note('關聯實體區塊', JSON.stringify(link));

section('P6 步驟 8');
await gotoStep(api, 8);
const step8 = await api.eval(`(() => ({
  text: document.body.innerText.slice(0, 400).replace(/\\n+/g, ' | '),
  textareas: [...document.querySelectorAll('textarea')].map((t) => ({ ph: t.placeholder, h: t.clientHeight })),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim()).filter(Boolean),
}))()`);
note('步驟 8 textareas', JSON.stringify(step8.textareas));
note('步驟 8 buttons', JSON.stringify(step8.buttons));
await snap(api, STAGE, 'P6-step8');

section('P7 立即查看角色卡');
const toPreview = await clickText('立即查看角色卡', 900);
note('點「立即查看角色卡」', String(toPreview));
const tab = await api.eval(`(() => {
  const t = document.body.innerText;
  return { preview: t.includes('角色卡預覽') || t.includes('匯出'), build: t.includes('構築頁面') };
})()`);
note('分頁狀態', JSON.stringify(tab));
await snap(api, STAGE, 'P7-preview');

dumpErrors(api);
report('階段 7 探勘（步驟 7–8 結構）');
await api.close();
