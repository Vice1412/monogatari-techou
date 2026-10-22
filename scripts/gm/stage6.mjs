/**
 * 階段 6：步驟 5（Boss 技能）與步驟 6（負面技能）。
 *
 * 新手 GM 的問題意識：這兩步是全流程裡**唯一的「換取」機制**——
 * 步驟 5 用「定位技能額度」換 Boss 技能，步驟 6 用「一個顯著弱點」換額外額度。
 * 換取類機制的失敗模式不是「算錯」，是「換了但沒說換掉了什麼」。
 *
 * 所以測的重點：
 *   1. 非冠位時，畫面上有沒有說清楚「為什麼不能用」以及「怎麼解鎖」。
 *   2. 覺醒之後，Boss 技能的分類、額度、警告（>2 個、同子類別重複）是否都到位。
 *   3. **Boss 技能吃掉定位技能額度時，有沒有任何即時說明**（`maxRoleSkills` 會從 3 掉到 1）。
 *   4. 負面技能只能選一個——選了之後其他卡是否明確變灰。
 *   5. 負面技能的文案是模板，填空欄位在未填時長什麼樣。
 */
import { launch } from './cdp.mjs';
import {
  openWorkshop, newNpc, gotoStep, snap, section, check, note, report, dumpErrors, armDialog,
} from './lib.mjs';

const STAGE = 6;
const api = await launch();
armDialog(api, { accept: true });

const AMBER = 'rgb(217, 119, 6)';
const BEIGE = 'rgb(214, 199, 171)';

const settle = async (ms = 500) => {
  await new Promise((r) => setTimeout(r, ms));
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  await new Promise((r) => setTimeout(r, 150));
};

const clickBtnText = async (text, waitMs = 700) => {
  const xy = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
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

const clickBtnContains = async (needle, waitMs = 700) => {
  const xy = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').includes(${JSON.stringify(needle)}));
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

/** 讀某個前綴的卡片（Boss 用 boss-skill-，負面用 negative-skill-）。 */
const cardsByPrefix = (prefix) => api.eval(`(() => [...document.querySelectorAll('[id^="${prefix}"]')].map((el) => {
  const card = el.firstElementChild || el;
  const cs = getComputedStyle(card);
  const r = card.getBoundingClientRect();
  return {
    id: el.id.replace('${prefix}', ''),
    text: (card.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 40),
    border: cs.borderColor,
    opacity: cs.opacity,
    filter: cs.filter,
    x: Math.round(r.left + r.width / 2),
    y: Math.round(r.top + 24),
  };
}))()`);

const clickCard = async (prefix, id) => {
  const xy = await api.eval(`(() => {
    const el = document.getElementById('${prefix}' + ${JSON.stringify(id)});
    const card = el && (el.firstElementChild || el);
    if (!card) return null;
    // 步驟 5 的「技能導航」與規則警告是 sticky 區塊，會蓋住視窗上緣；
    // 把卡片滾到視窗底部（block: 'end'）再點上緣，就不會被蓋到。
    card.scrollIntoView({ block: 'end' });
    const r = card.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + 24) };
  })()`);
  if (!xy) return { ok: false, reason: '找不到卡片' };
  await api.clickAt(xy.x, xy.y);
  await settle(650);
  return { ok: true };
};

/** 分類 tab（步驟 5 冠位後）。 */
const bossTabs = () => api.eval(`(() => [...document.querySelectorAll('button')]
  .filter((b) => /flex-shrink-0/.test(b.className) && /rounded-lg/.test(b.className))
  .map((b) => ({ text: (b.innerText || '').replace(/\\s+/g, ' ').trim(), active: /bg-amber-700/.test(b.className) })))()`);

/** 「定位技能」額度徽章（左側面板）。 */
const roleBudget = () => api.eval(`(() => {
  const m = document.body.innerText.match(/定位技能\\s*(\\d+)\\s*\\/\\s*(\\d+)/);
  return m ? { used: Number(m[1]), max: Number(m[2]) } : null;
})()`);

/** 右側即時預覽的文字（用來確認「選了之後卡上有沒有」）。 */
const previewText = () => api.eval(`(() => {
  const t = document.body.innerText;
  const i = t.indexOf('即時預覽');
  return i >= 0 ? t.slice(i, i + 1600) : '';
})()`);

// ─────────────────────────────────────────────────────────────
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 5);

section('A. 非冠位時的步驟 5');
const txtLocked = await api.text();
check('顯示「力量尚未覺醒」', txtLocked.includes('力量尚未覺醒'));
check('說明目前階級是「士兵」', /目前是「士兵」/.test(txtLocked));
check('說明解鎖條件是「冠位」', txtLocked.includes('解鎖強大的 Boss 技能需要「冠位」階級'));
const multBtns = await api.eval(`(() => [...document.querySelectorAll('button')]
  .map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim())
  .filter((t) => /^\\d 倍率$/.test(t)))()`);
check('提供 6 個倍率按鈕', multBtns.length === 6, JSON.stringify(multBtns));
check('非冠位時沒有 Boss 技能卡片', (await cardsByPrefix('boss-skill-')).length === 0);
check('非冠位時沒有分類分頁', (await bossTabs()).length === 0);
await snap(api, STAGE, 'A1-locked');

section('B. 點倍率 3 一鍵覺醒');
const awake = await clickBtnText('3 倍率', 900);
check('倍率按鈕可點', awake.ok === true);
const txtChamp = await api.text();
check('出現覺醒提示「成功覺醒為冠位 (倍率 x3)」', /成功覺醒為冠位（?\(?倍率 x3\)?）?/.test(txtChamp) || txtChamp.includes('成功覺醒為冠位'));
const preview1 = await previewText();
check('預覽的階級變成「冠位 (3)」', /冠位\s*\(?3\)?/.test(preview1), preview1.slice(0, 120).replace(/\n+/g, ' | '));
const tabs = await bossTabs();
note('分類分頁', JSON.stringify(tabs.map((t) => t.text)));
check('出現 Boss 技能分類分頁', tabs.length >= 5, `實際 ${tabs.length} 個`);
const budgetChamp = await roleBudget();
note('覺醒後的定位技能額度', JSON.stringify(budgetChamp));
check('覺醒後定位技能額度變成 3', budgetChamp && budgetChamp.max === 3, JSON.stringify(budgetChamp));
await snap(api, STAGE, 'B1-awakened');

section('C. 選 Boss 技能與規則警告');
const cards0 = await cardsByPrefix('boss-skill-');
check('目前分頁有 Boss 技能卡片', cards0.length > 0, `實際 ${cards0.length} 張`);
const first = cards0[0];
await clickCard('boss-skill-', first.id);
const afterPick = await cardsByPrefix('boss-skill-');
const picked = afterPick.find((c) => c.id === first.id);
check('點卡片後變成琥珀色（選中）', picked && picked.border === AMBER, `實際 ${picked && picked.border}`);
const navAfter1 = await api.eval(`document.body.innerText.includes('技能導航')`);
check('選第一個之後出現「技能導航」列', navAfter1 === true);
const preview2 = await previewText();
check('預覽的卡片上出現「特殊規則」', preview2.includes('特殊規則'));
check('預覽的卡片上出現該技能名稱', preview2.includes(first.text.split(' ')[0]));

const second = afterPick.find((c) => c.id !== first.id && c.border === BEIGE);
if (second) {
  await clickCard('boss-skill-', second.id);
  const txt2 = await api.text();
  check('同一個子類別選第二個時，出現「技能列表重複」警告', txt2.includes('技能列表重複'));
  check('選兩個時還不算「過多」', !txt2.includes('過多的 Boss 技能'));
  const budget2 = await roleBudget();
  note('選 2 個後的定位技能額度', JSON.stringify(budget2));
  check(
    '選 2 個 Boss 技能後，定位技能額度從 3 掉到 2',
    budget2 && budget2.max === 2,
    JSON.stringify(budget2),
  );
  const explained = /替換|佔用|扣掉|消耗/.test(txt2.slice(txt2.indexOf('步驟 5：Boss 技能'), txt2.indexOf('步驟 5：Boss 技能') + 400));
  note(
    '「Boss 技能會吃掉定位技能額度」有沒有即時說明',
    explained ? '有（標題下方的規則提醒）' : '只有標題下方那句泛用提醒，額度變化本身沒有任何提示（GM-06-01 候選）',
  );

  const third = (await cardsByPrefix('boss-skill-')).find((c) => c.id !== first.id && c.id !== second.id && c.border === BEIGE);
  if (third) {
    await clickCard('boss-skill-', third.id);
    const txt3 = await api.text();
    check('選到第三個時出現「過多的 Boss 技能」警告', txt3.includes('過多的 Boss 技能'));
    await snap(api, STAGE, 'C1-three-warnings');
    await clickCard('boss-skill-', third.id);
    const txt3b = await api.text();
    check('取消第三個後「過多」警告消失', !txt3b.includes('過多的 Boss 技能'));
  }
}

section('D. 分類分頁切換');
const tabsNow = await bossTabs();
const otherTab = tabsNow.find((t) => !t.active);
if (otherTab) {
  const cardsBefore = await cardsByPrefix('boss-skill-');
  await clickBtnContains(otherTab.text.split(' ')[0], 700);
  const cardsAfter = await cardsByPrefix('boss-skill-');
  const tabsAfter = await bossTabs();
  check('切換分類後卡片內容改變', JSON.stringify(cardsBefore.map((c) => c.id)) !== JSON.stringify(cardsAfter.map((c) => c.id)));
  check('切換後該分頁標為選中', tabsAfter.find((t) => t.text.startsWith(otherTab.text.split(' ')[0]))?.active === true);
  await snap(api, STAGE, 'D1-other-tab');
}

const tabsFinal = await bossTabs();
const withCount = tabsFinal.filter((t) => /\s\d+$/.test(t.text));
note('帶計數徽章的分頁', JSON.stringify(withCount.map((t) => t.text)));
check('有分頁顯示已選數量', withCount.length > 0);

section('E. 步驟 6：負面技能');
await gotoStep(api, 6);
const txt6 = await api.text();
check('步驟 6 有標題與說明', txt6.includes('步驟 6：配置負面技能'));
check('說明「配備一個顯著的弱點以換取額外的額度」', /一個顯著的弱點/.test(txt6));
const negCards = await cardsByPrefix('negative-skill-');
note('負面技能卡片', JSON.stringify(negCards.map((c) => ({ id: c.id, text: c.text.slice(0, 22), opacity: c.opacity }))));
check('列出 8 張負面技能卡', negCards.length === 8, `實際 ${negCards.length} 張`);
const placeholder = negCards.some((c) => /中恢復|點的\s|受到\s|用他們的\s/.test(c.text));
note('卡片文字是否含未填的填空位', placeholder ? '有（模板變數未填，例如「無法從  中恢復」）' : '沒有');
await snap(api, STAGE, 'E1-negative-list');

const neg0 = negCards[0];
const budgetBeforeNeg = await roleBudget();
await clickCard('negative-skill-', neg0.id);
const budgetAfterNeg = await roleBudget();
note('選負面技能前後的定位技能額度', `${JSON.stringify(budgetBeforeNeg)} → ${JSON.stringify(budgetAfterNeg)}`);
check(
  '選一個負面技能後，定位技能額度 +1（這就是說明裡說的「換取額外的額度」）',
  budgetBeforeNeg && budgetAfterNeg && budgetAfterNeg.max === budgetBeforeNeg.max + 1,
  `${JSON.stringify(budgetBeforeNeg)} → ${JSON.stringify(budgetAfterNeg)}`,
);
const txtAfterNegPick = await api.text();
const negPageSays = /定位技能額度 \+1/.test(txtAfterNegPick);
check('選定弱點後，步驟 6 畫面上出現「定位技能額度 +1」的回饋', negPageSays === true);
note(
  '步驟 6 畫面本身有沒有說「你換到了什麼」',
  negPageSays ? '有（說明區塊下方多一行綠字）' : '沒有——額度只反映在左側面板的數字上（GM-06-01）',
);
const negAfter = await cardsByPrefix('negative-skill-');
const negPicked = negAfter.find((c) => c.id === neg0.id);
check('點負面技能卡後變成琥珀色（選中）', negPicked && negPicked.border === AMBER, `實際 ${negPicked && negPicked.border}`);
const others = negAfter.filter((c) => c.id !== neg0.id);
const othersGrey = others.filter((c) => Number(c.opacity) < 0.9 || /grayscale/.test(c.filter));
check('只能選一個：選了之後其餘 7 張明確變灰', othersGrey.length === others.length, `${othersGrey.length} / ${others.length} 張變灰`);
const previewNeg = await previewText();
check('預覽出現該負面技能', previewNeg.includes(neg0.text.split(' ')[0]));
await snap(api, STAGE, 'E2-negative-picked');

await clickCard('negative-skill-', neg0.id);
const negBack = await cardsByPrefix('negative-skill-');
const negBackFirst = negBack.find((c) => c.id === neg0.id);
check('再點一次可以取消選中', negBackFirst && negBackFirst.border !== AMBER, `實際 ${negBackFirst && negBackFirst.border}`);
const othersBack = negBack.filter((c) => c.id !== neg0.id && (Number(c.opacity) < 0.9 || /grayscale/.test(c.filter)));
check('取消後其餘卡片恢復可點', othersBack.length === 0, `仍有 ${othersBack.length} 張灰著`);

section('F. 跨步驟一致性');
await gotoStep(api, 5);
// 步驟 5 的分類分頁會記住上次停在哪一個（activeBossTab），D 段切走之後要先切回第一個分頁，
// 否則讀到的是「控制技能」分頁——那裡本來就沒有已選技能，會誤判成「選擇丟了」。
const tabsBack = await bossTabs();
if (tabsBack[0] && !tabsBack[0].active) await clickBtnContains(tabsBack[0].text.split(' ')[0], 700);
const bossBack = await cardsByPrefix('boss-skill-');
const stillPicked = bossBack.filter((c) => c.border === AMBER);
check('回到步驟 5，先前選的 Boss 技能仍在', stillPicked.length >= 2, `實際 ${stillPicked.length} 張仍選中`);

dumpErrors(api);
report('階段 6：步驟 5–6（Boss 與負面技能）');
await api.close();
