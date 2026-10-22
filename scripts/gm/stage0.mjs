/**
 * 階段 0：測試通道自我驗證（不是功能測試）。
 *
 * 這一支只回答一個問題：**我能不能在無頭瀏覽器裡真的走到工坊的 8 個步驟並截圖？**
 * 若它失敗，後面 11 個階段全部無從開始——所以它自己必須是「會失敗」的測試
 * （刻意改壞 `STEP_ANCHORS` 任一項 → 這裡必須 FAIL，見 `docs/npc-workshop-gm-test.md` §4）。
 *
 * 執行：`node scripts/gm/stage0.mjs`（需先 `npm run dev`）
 */
import { launch } from './cdp.mjs';
import {
  section, check, note, report, snap, openWorkshop, newNpc, gotoStep,
  STEP_ANCHORS, dumpErrors,
} from './lib.mjs';

const api = await launch();
try {
  section('A. 書封 → NPC 工坊');
  await openWorkshop(api, { stage: 0 });
  const entry = await api.text();
  check('進入工坊（看到「建立新 NPC」）', entry.includes('建立新 NPC'));
  note('入口畫面前 120 字', entry.replace(/\s+/g, ' ').slice(0, 120));

  section('B. 建立新 NPC');
  await newNpc(api, { stage: 0 });
  const afterNew = await api.text();
  check('新卡已進入建角流程（看到步驟 1 錨點）', afterNew.includes(STEP_ANCHORS[0]));

  section('C. 八道步驟逐一可達');
  for (let n = 1; n <= 8; n += 1) {
    try {
      await gotoStep(api, n);
      const txt = await api.text();
      check(`步驟 ${n}「${STEP_ANCHORS[n - 1]}」`, txt.includes(STEP_ANCHORS[n - 1]));
      await snap(api, 0, `step${n}`);
    } catch (e) {
      check(`步驟 ${n}「${STEP_ANCHORS[n - 1]}」`, false, e.message.split('\n')[0]);
      await snap(api, 0, `step${n}-FAILED`);
    }
  }

  section('D. 環境事實');
  note('視窗', await api.eval('`${innerWidth}x${innerHeight}`'));
  note('localStorage 鍵', await api.eval('Object.keys(localStorage).join(", ") || "（空）"'));
  note('console 錯誤數', api.errors.length);
  if (api.errors.length) {
    check('無 console 錯誤／例外', false, dumpErrors(api));
  } else {
    check('無 console 錯誤／例外', true);
  }
} catch (e) {
  check('階段 0 整體流程', false, e.message);
  await snap(api, 0, 'fatal');
  console.log(dumpErrors(api));
} finally {
  await api.close();
}

process.exit(report('階段 0：通道驗證'));
