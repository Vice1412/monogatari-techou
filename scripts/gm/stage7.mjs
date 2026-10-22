/**
 * 階段 7：步驟 7（身份：名稱／頭像／特質／故事／關聯實體）與步驟 8（戰術）。
 *
 * 新手 GM 的問題意識：這兩步是「把數據變成角色」的地方，也是唯一需要跟外部檔案打交道的地方。
 * 頭像那條鏈有三段（選檔 → 裁切 → 套用），每段都可能靜默失敗：
 * 選錯格式、裁切視窗沒開、套用後沒出現。所以測的重點是**每一段有沒有回饋**。
 *
 * 自動化限制：`DOM.setFileInputFiles` 對步驟 7 那個 `className="hidden"` 的 input
 * 送得出去但 `change` 從不觸發（帶不帶 objectGroup、改用 DataTransfer 注入都一樣），
 * 所以檔案上傳路徑走的是同一個出口的「網址載入」分支。這一點在 §5 階段 7 記錄。
 */
import { launch } from './cdp.mjs';
import {
  openWorkshop, newNpc, gotoStep, snap, section, check, note, report, dumpErrors, armDialog, setValue,
} from './lib.mjs';

const STAGE = 7;
const api = await launch();
armDialog(api, { accept: true });

const settle = async (ms = 500) => {
  await new Promise((r) => setTimeout(r, ms));
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  await new Promise((r) => setTimeout(r, 140));
};

const clickText = async (text, waitMs = 700) => {
  const xy = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button, label')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!xy) return { ok: false, reason: '找不到按鈕' };
  await api.clickAt(xy.x, xy.y);
  await settle(waitMs);
  return { ok: true };
};

const previewText = () => api.eval(`(() => {
  const t = document.body.innerText;
  const i = t.indexOf('即時預覽');
  return i >= 0 ? t.slice(i, i + 900) : '';
})()`);

const cropOpen = () => api.eval(`(() => document.body.innerText.includes('縮放大小') && document.body.innerText.includes('完成裁切並套用'))()`);

const makeDataUrl = () => api.eval(`(() => {
  const c = document.createElement('canvas');
  c.width = 120; c.height = 120;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c67836'; ctx.fillRect(0, 0, 120, 120);
  ctx.strokeStyle = '#3c2415'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 112, 112);
  return c.toDataURL('image/png');
})()`);

// ─────────────────────────────────────────────────────────────
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);

section('A. 步驟 7 的欄位');
const txt7 = await api.text();
check('標題是「步驟 7：設定稱呼與特質」', txt7.includes('步驟 7：設定稱呼與特質'));
check('說明提到名字、頭像、特質與背景故事', /起個名字.*頭像.*特質.*背景故事/.test(txt7));
const namePh = await api.eval(`(() => { const e = document.querySelector('input[placeholder="輸入名稱..."]'); return e ? e.value : null; })()`);
check('名稱欄位有預設值「未知實體」', namePh === '未知實體', String(namePh));
check('特質欄位有範例提示', (await api.eval(`!!document.querySelector('input[placeholder*="敏捷"]')`)) === true);
check('背景故事欄位有提示', (await api.eval(`!!document.querySelector('textarea[placeholder*="起源"]')`)) === true);

await setValue(api, 'input[placeholder="輸入名稱..."]', '灰燼守門人');
await settle(450);
const preview1 = await previewText();
check('改名字後，右側預覽立刻同步', preview1.includes('灰燼守門人'), preview1.slice(0, 80).replace(/\n+/g, ' | '));

await setValue(api, 'input[placeholder="輸入名稱..."]', '');
await settle(450);
const preview2 = await previewText();
check('名稱清空後，預覽不再顯示舊名字', !preview2.includes('灰燼守門人'), preview2.slice(0, 80).replace(/\n+/g, ' | '));
await setValue(api, 'input[placeholder="輸入名稱..."]', '灰燼守門人');
await settle(300);
await snap(api, STAGE, 'A1-step7');

section('B. 頭像：空狀態與入口');
check('空狀態提示「可拖曳圖片至此」', (await api.text()).includes('可拖曳圖片至此'));
check('有「上傳本地照片」按鈕', (await api.text()).includes('上傳本地照片'));
check('有圖片網址輸入框', (await api.eval(`!!document.querySelector('input[type="url"]')`)) === true);
check('說明支援的格式與縮放上限', /JPG.*PNG.*GIF.*WebP/.test(txt7) && txt7.includes('500%'));

section('C. 頭像：網址載入 → 裁切 → 套用');
const dataUrl = await makeDataUrl();
await setValue(api, 'input[type="url"]', dataUrl);
await settle(200);
const loadBtn = await clickText('網址載入', 1100);
check('「網址載入」按鈕可點', loadBtn.ok === true);
check('載入後開啟裁切視窗', (await cropOpen()) === true);
const cropInfo = await api.eval(`(() => {
  const ranges = [...document.querySelectorAll('input[type="range"]')].map((r) => ({ min: r.min, max: r.max, val: r.value }));
  const quick = [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter((t) => /^\\d+%$/.test(t));
  return { ranges, quick };
})()`);
note('裁切視窗控制項', JSON.stringify(cropInfo));
check('裁切視窗有縮放滑桿', cropInfo.ranges.length >= 1, JSON.stringify(cropInfo.ranges));
check('縮放滑桿上限是 500%', cropInfo.ranges[0] && Number(cropInfo.ranges[0].max) === 5, JSON.stringify(cropInfo.ranges[0]));
check('提供快速倍率按鈕', cropInfo.quick.length >= 5, JSON.stringify(cropInfo.quick));
await snap(api, STAGE, 'C1-crop-modal');

const cancel = await clickText('取消', 700);
check('裁切視窗可以取消', cancel.ok === true && (await cropOpen()) === false);
const afterCancel = await api.eval(`(() => ({
  img: !!document.querySelector('img[alt="Avatar Preview"]'),
  recrop: document.body.innerText.includes('重新調整大小'),
}))()`);
check('取消後沒有套用頭像', afterCancel.img === false && afterCancel.recrop === false, JSON.stringify(afterCancel));

await setValue(api, 'input[type="url"]', dataUrl);
await settle(200);
await clickText('網址載入', 1100);
const apply = await clickText('完成裁切並套用', 1200);
check('「完成裁切並套用」可點', apply.ok === true);
const afterApply = await api.eval(`(() => ({
  img: !!document.querySelector('img[alt="Avatar Preview"]'),
  removeBtn: document.body.innerText.includes('移除圖片'),
  clearBtn: document.body.innerText.includes('清除圖片'),
  recrop: document.body.innerText.includes('重新調整大小'),
}))()`);
note('套用後的控制項', JSON.stringify(afterApply));
check('套用後預覽框出現圖片', afterApply.img === true);
check('套用後出現「重新調整大小」', afterApply.recrop === true);
check('套用後出現「清除圖片」', afterApply.clearBtn === true);
await snap(api, STAGE, 'C2-avatar-applied');

section('D. 關聯實體');
const linkBlock = await api.eval(`(() => {
  const t = document.body.innerText;
  const i = t.indexOf('關聯實體設置');
  return i >= 0 ? t.slice(i, i + 200) : '';
})()`);
check('有關聯實體區塊', linkBlock.length > 0);
check('標示「雙向自動關聯」', linkBlock.includes('雙向自動關聯'));
check('說明會自動建立雙向連結', /自動建立雙向連結/.test(linkBlock));
check('檔案庫只有自己時，說明「暫無其他可連結的實體」', linkBlock.includes('檔案庫中暫無其他可連結的實體'));

section('E. 步驟 8：戰術');
await gotoStep(api, 8);
const txt8 = await api.text();
check('標題是「步驟 8：戰術與行動」', txt8.includes('步驟 8：戰術與行動'));
check('說明「最後決定 NPC 的戰術。」', txt8.includes('最後決定 NPC 的戰術'));
const tacticPh = await api.eval(`(() => { const t = [...document.querySelectorAll('textarea')].find((x) => x.clientHeight > 100); return t ? t.placeholder : null; })()`);
note('戰術欄位的 placeholder', JSON.stringify(tacticPh));
check(
  '戰術欄位有說明性的提示文字（不是「...」）',
  typeof tacticPh === 'string' && tacticPh.length > 6 && tacticPh !== '...',
  JSON.stringify(tacticPh),
);
await snap(api, STAGE, 'E1-step8');

await setValue(api, 'textarea', '優先攻擊施法者；血量低於一半時退到後排。');
await settle(450);
const preview3 = await previewText();
check('寫入戰術後，預覽同步出現', preview3.includes('優先攻擊施法者'), preview3.slice(0, 80).replace(/\n+/g, ' | '));

section('F. 收尾：立即查看角色卡');
const toPreview = await clickText('立即查看角色卡', 1000);
check('有「立即查看角色卡」按鈕', toPreview.ok === true);
const onPreviewTab = await api.eval(`(() => {
  const t = document.body.innerText;
  return { export: /匯出|下載/.test(t), card: t.includes('灰燼守門人') };
})()`);
note('切換後畫面', JSON.stringify(onPreviewTab));
check('切換後離開構築頁面（出現匯出或下載）', onPreviewTab.export === true);
check('切換後角色卡上仍是同一個 NPC', onPreviewTab.card === true);
await snap(api, STAGE, 'F1-preview');

section('G. 導航');
await clickText('返回檔案庫', 900);
const backOk = await api.eval(`document.body.innerText.includes('返回') || document.body.innerText.includes('建立新 NPC')`);
note('返回檔案庫', String(backOk));

dumpErrors(api);
report('階段 7：步驟 7–8（身份與戰術）');
await api.close();
