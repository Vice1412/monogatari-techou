/**
 * 階段 1：入口與檔案庫（新手 GM 視角）。
 *
 * 這一支模擬「一個拿到空站、只讀過規則書的 GM」的第一段路：
 * 空庫 → 生出第一張卡 → 找回來 → 搜尋／篩選／排序 → 刪除 → 備份 → 匯入 → 重新整理。
 *
 * 判準見 `docs/npc-workshop-gm-test.md` §1：
 * 每項檢查只問「GM 看不看得到、懂不懂、救不救得回」，不問程式碼寫得漂不漂亮。
 *
 * 執行：`$env:GM_BASE='http://localhost:3001'; node scripts/gm/stage1.mjs`
 */
import path from 'node:path';
import { launch } from './cdp.mjs';
import {
  BASE, section, check, note, report, snap, openWorkshop, cardNames, libCount,
  uploadFile, setValue, armDialog, dumpErrors, STEP_ANCHORS, sliceText,
} from './lib.mjs';

const FIX = path.resolve('scratch/gm-test/fixtures');
const f = (n) => path.join(FIX, n);
const SEARCH = 'input[placeholder^="搜尋姓名"]';
// ⚠️ 頁面上有**兩個** `input[accept=".json"]`：工坊的「匯入 NPC」與 App 根層的「還原」（整站備份還原，
// 匯入後會 alert 並刷新頁面）。用 `document.querySelector` 會命中錯的那個——實測就是這樣把
// 畫面刷回封面的。這裡限定在檔案庫內容區（`.max-w-6xl`）之內。
const IMPORT = '.max-w-6xl input[accept=".json"]';

const api = await launch();

/** 設定下拉選單（依 option value），回傳是否成功。 */
const setSelect = (value) => api.eval(`(() => {
  const sel = [...document.querySelectorAll('select')]
    .find((s) => s.querySelector('option[value=' + JSON.stringify(${JSON.stringify(value)}) + ']'));
  if (!sel) return { ok: false, reason: 'no select with value ${value}' };
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(sel, ${JSON.stringify(value)});
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
})()`);

/** 點第 index 張卡片最右邊那顆按鈕（垃圾桶，只有圖示沒有文字）。 */
const clickCardDelete = async (index = 0) => {
  const info = await api.eval(`(() => {
    const h3s = [...document.querySelectorAll('h3')];
    const h3 = h3s[${index}];
    if (!h3) return { ok: false, reason: 'no card' };
    const card = h3.closest('div.overflow-hidden') || h3.parentElement.parentElement;
    const btns = [...card.querySelectorAll('button')];
    const del = btns[btns.length - 1];
    del.scrollIntoView({ block: 'center' });
    const r = del.getBoundingClientRect();
    return { ok: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
             name: h3.innerText.trim(), btnText: del.innerText.trim(), hasTitle: del.getAttribute('title') };
  })()`);
  if (!info?.ok) return info;
  await api.clickAt(info.x, info.y);
  await new Promise((r) => setTimeout(r, 400));
  return info;
};

const goLibrary = async () => {
  const r = await api.clickText('返回檔案庫');
  if (!r?.ok) throw new Error(`找不到「返回檔案庫」（${r?.reason}）`);
  await new Promise((res) => setTimeout(res, 500));
};

const saveAndReturn = async () => {
  const s = await api.clickText('儲存', { exact: true });
  if (!s?.ok) throw new Error(`找不到「儲存」按鈕（${s?.reason}）`);
  await new Promise((res) => setTimeout(res, 500));
  const t = await api.text();
  const toastLine = (t.match(/已成功儲存[^\n]*/) || [''])[0];
  await goLibrary();
  const count = await libCount(api);
  return { saved: Boolean(toastLine), toastLine, total: count?.total ?? null, hitText: s.text };
};

try {
  // ── 清庫：回到「一個新 GM 剛打開網站」的狀態 ──────────────────
  await api.goto(BASE, { timeout: 30000 });
  await api.eval('localStorage.clear()');
  await api.goto(BASE, { timeout: 30000 });
  await openWorkshop(api, { stage: 1 });

  section('A. 空庫狀態：新手 GM 第一眼看到什麼');
  const empty = await api.text();
  check('空態有明確說明', empty.includes('檔案庫目前空空如也'));
  check('空態有下一步指引', empty.includes('點擊右上方按鈕開始創造你的第一個 NPC 吧'));
  check('中央有引導按鈕「建立第一位 NPC」', empty.includes('建立第一位 NPC'));
  check('右上也有「建立新 NPC」', empty.includes('建立新 NPC'));
  note('空態可見按鈕（右上列）', '匯入 NPC／備份全庫／建立新 NPC');
  // 2026-10-21 階段 11 修正：這條斷言原本寫「頁面上只有一個 JSON 匯入入口」，一直紅，
  // 但它問錯了問題——兩個 <input accept=".json"> 都是 className="hidden"，由 label／按鈕代理，
  // 所以「DOM 有幾個」既不代表看得到、也不代表點得到。真正的風險是「誤觸會覆蓋全站資料」，
  // 階段 1 的 GM-01-01 已經用兩件事擋掉：型別分派（單卡檔不會被當成整站備份）＋入口標示「全站」並加警示。
  // 這裡改成守那兩件事，不再守一個沒有意義的節點數。
  const jsonInputs = await api.eval(`document.querySelectorAll('input[accept=".json"]').length`);
  const restoreWarned = await api.eval(`(() => {
    const el = document.querySelector('input[accept=".json"][aria-label*="還原"]');
    const label = el ? el.closest('label') : null;
    return { title: label ? (label.getAttribute('title') || '') : '', text: label ? (label.innerText || '') : '' };
  })()`);
  note('兩個 .json 入口', `DOM 共 ${jsonInputs} 個，皆為 hidden，由 label／按鈕代理`);
  check('「還原全站備份」有明確標示與警示（誤觸會覆蓋全站）',
    /全站/.test(restoreWarned.text) && /覆蓋/.test(restoreWarned.title),
    `標籤=${restoreWarned.text}／title=${restoreWarned.title}`);
  await snap(api, 1, 'A-empty-library');

  section('B. 建立第一張卡 → 儲存 → 回檔案庫');
  await api.clickText('建立第一位 NPC');
  await api.waitText(STEP_ANCHORS[0], { timeout: 15000 });
  check('「建立第一位 NPC」進入建角流程', true);
  await snap(api, 1, 'B-build-step1');
  const saveRes = await saveAndReturn();
  check('儲存後有成功提示', saveRes.saved, `實得：「${saveRes.toastLine}」`);
  const afterFirst = await api.text();
  check('儲存後回到檔案庫並看到 1 張卡', afterFirst.includes('共 1 隻'));
  await snap(api, 1, 'B-first-card');

  section('C. 卡片資訊：GM 認不認得出這張卡');
  const names1 = await cardNames(api);
  note('卡片標題', JSON.stringify(names1));
  check('卡片顯示預設名稱「未知實體」', names1.includes('未知實體'));
  check('卡片顯示等級 Lv. 5', afterFirst.includes('Lv. 5'));
  check('卡片顯示位階【士兵】', afterFirst.includes('【士兵】'));
  check('卡片顯示職業「暴徒」', afterFirst.includes('暴徒'));
  note('缺少的資訊（GM 可能需要）', '最後更新時間、物種、標籤／備註');

  section('D. 匯入單張 NPC JSON：會不會自動進檔案庫');
  await uploadFile(api, IMPORT, f('npc-a.json'));
  await new Promise((r) => setTimeout(r, 800));
  const afterImport = await api.text();
  check('匯入後進入建構頁並載入該卡', afterImport.includes('測試暴徒'));
  note('匯入後所在頁面', afterImport.includes('構築頁面') ? '構築頁面（build）' : '不確定');
  check('匯入後「不會」自動入庫（需手動儲存）', !afterImport.includes('共 2 隻'),
    '實測：匯入後直接停在建構頁，檔案庫數量未變 → 新手會以為已經存好了');
  await snap(api, 1, 'D-imported-build');
  const saved2 = await saveAndReturn();
  check('手動儲存後入庫（共 2 張）', saved2.total === 2, JSON.stringify(saved2));

  section('E. 再匯入一張（Lv20 冠位）');
  await uploadFile(api, IMPORT, f('npc-b.json'));
  await new Promise((r) => setTimeout(r, 800));
  const saved3 = await saveAndReturn();
  const lib3 = await libCount(api);
  check('三張卡都在檔案庫', lib3?.total === 3, JSON.stringify({ ...saved3, lib3 }));
  note('匯入後儲存的提示文字', `「${saved3.toastLine || '（沒有出現）'}」`);
  await snap(api, 1, 'E-three-cards');

  section('F. 排序：三張卡、四種排序');
  const sortOk = await setSelect('level_desc');
  await new Promise((r) => setTimeout(r, 300));
  const desc = await cardNames(api);
  check('「等級（高至低）」可選', sortOk?.ok, JSON.stringify(sortOk));
  check('等級高至低：測試法師(20) 在最前', desc[0] === '測試法師', JSON.stringify(desc));
  await setSelect('level_asc');
  await new Promise((r) => setTimeout(r, 300));
  const asc = await cardNames(api);
  check('等級低至高：未知實體(5) 在最前', asc[0] === '未知實體', JSON.stringify(asc));
  await setSelect('name_asc');
  await new Promise((r) => setTimeout(r, 300));
  note('名稱排序結果', JSON.stringify(await cardNames(api)));
  await setSelect('recent');
  await new Promise((r) => setTimeout(r, 300));
  const recent = await cardNames(api);
  note('「最近更新」排序結果', JSON.stringify(recent));
  check('「最近更新」把剛匯入的排在前面', recent[0] === '測試法師', JSON.stringify(recent));
  await snap(api, 1, 'F-sorted');

  section('G. 搜尋：五種 GM 會輸入的關鍵字');
  const search = async (q) => {
    await setValue(api, SEARCH, q);
    await new Promise((r) => setTimeout(r, 300));
    return { count: await libCount(api), text: await api.text() };
  };

  const g1 = await search('測試');
  check('搜姓名「測試」→ 2 張', g1.count?.shown === 2, JSON.stringify(g1.count));

  const g2 = await search('暴徒');
  check('搜「暴徒」→ 2 張（1 張職業是暴徒、1 張名字含暴徒）', g2.count?.shown === 2, JSON.stringify(g2.count));

  const g3 = await search('野獸');
  check('搜物種中文「野獸」→ 應為 1 張', g3.count?.shown === 1,
    `實測 ${JSON.stringify(g3.count)}——搜尋只比對英文 label（BEAST），中文物種名搜不到`);

  const g4 = await search('BEAST');
  check('搜物種英文「BEAST」→ 1 張', g4.count?.shown === 1, JSON.stringify(g4.count));

  const g5 = await search('不存在的關鍵字XYZ');
  check('無結果時有說明', g5.text.includes('找不到符合條件的 NPC'));
  check('無結果時有「清除所有篩選條件」出口', g5.text.includes('清除所有篩選條件'));
  await snap(api, 1, 'G-no-result');
  await api.clickText('清除所有篩選條件');
  await new Promise((r) => setTimeout(r, 300));
  check('清除篩選後恢復 3 張', (await libCount(api))?.shown === 3);

  section('H. 刪除：取消與確認');
  const beforeDel = (await libCount(api))?.total;
  const cancelArm = armDialog(api, { accept: false });
  const del1 = await clickCardDelete(0);
  await new Promise((r) => setTimeout(r, 600));
  note('刪除按鈕', `文字「${del1?.btnText || '（空）'}」，title=${del1?.hasTitle || '無'}`);
  check('刪除按鈕有可辨識的文字或提示', Boolean(del1?.btnText || del1?.hasTitle),
    `實測：文字「${del1?.btnText || '（空）'}」、title=${del1?.hasTitle || '無'}`
    + '——只有一個紅色垃圾桶圖示，且它與「入戰」相鄰，新手要靠位置猜');
  check('取消確認後卡片仍在', (await libCount(api))?.total === beforeDel,
    `取消前 ${beforeDel}，取消後 ${(await libCount(api))?.total}`);
  note('取消對話框是否真的出現', cancelArm().fired ? '是' : '否（可能沒攔到）');

  const acceptArm = armDialog(api, { accept: true });
  await clickCardDelete(0);
  await new Promise((r) => setTimeout(r, 700));
  const afterDel = await libCount(api);
  check('確認刪除後數量 -1', afterDel?.total === beforeDel - 1, JSON.stringify(afterDel));
  const delText = await api.text();
  check('刪除後有回饋提示', delText.includes('已刪除'), '（找不到「已刪除」）');
  note('刪除後是否有復原入口', delText.includes('復原') ? '有' : '沒有（確認後即消失，只能靠備份）');
  await snap(api, 1, 'H-after-delete');

  section('I. 備份全庫');
  await api.clickText('備份全庫');
  await new Promise((r) => setTimeout(r, 500));
  const backupText = await api.text();
  check('備份有成功提示', /已成功備份包含 \d+ 個 NPC/.test(backupText),
    backupText.match(/已成功備份[^\n]*/) ? `實得：${backupText.match(/已成功備份[^\n]*/)[0]}` : '（無提示）');
  note('備份檔名格式', 'monogatari_techou_npc_library_backup_YYYY-MM-DD.json（下載觸發，headless 無法驗證落地）');

  section('J. 用「匯入 NPC」還原全庫備份（陣列格式）');
  const beforeJ = await libCount(api);
  await uploadFile(api, IMPORT, f('library-backup.json'));
  await new Promise((r) => setTimeout(r, 1200));
  const jText = await api.text();
  const jState = {
    stillInLibrary: jText.includes('檔案庫目前空空如也') || /共 \d+ 隻/.test(jText),
    showsBuild: jText.includes('構築頁面'),
    showsStep1: jText.includes(STEP_ANCHORS[0]),
    count: await libCount(api),
    errors: api.errors.length,
  };
  note('匯入陣列後畫面狀態', JSON.stringify(jState));
  check('匯入備份檔（陣列）不會炸掉畫面', !jText.includes('發生錯誤') && jState.errors === 0,
    `console 錯誤 ${jState.errors} 筆：\n${dumpErrors(api)}`);
  check('匯入備份檔（陣列）後仍能正常顯示', jState.showsBuild || jState.stillInLibrary,
    `畫面文字前 200 字：${jText.replace(/\s+/g, ' ').slice(0, 200)}`);
  note('匯入備份檔後檔案庫數量', JSON.stringify(jState.count) + `（匯入前 ${JSON.stringify(beforeJ)}）`);
  await snap(api, 1, 'J-import-array');

  section('K. 重新整理後資料還在嗎');
  await api.goto(BASE, { timeout: 30000 });
  await openWorkshop(api, { stage: 1 });
  const afterReload = await api.text();
  const reloadCount = await libCount(api);
  check('重新整理後卡片仍在', afterReload.includes('測試'), JSON.stringify(reloadCount));
  note('重新整理後數量', JSON.stringify(reloadCount));
  await snap(api, 1, 'K-after-reload');

  section('L. console 錯誤總覽');
  check('整段流程無 console 錯誤', api.errors.length === 0, dumpErrors(api));
} catch (e) {
  check('階段 1 整體流程', false, e.message);
  await snap(api, 1, 'fatal');
  console.log(dumpErrors(api));
} finally {
  await api.close();
}

process.exit(report('階段 1：入口與檔案庫'));
