/**
 * 階段 12：NPC 工坊「自訂功能」逐項巡檢
 *
 * 範圍（自由模式解鎖的五類能力 + 開關本身）：
 *   A 自由模式開關（確認視窗、取消、確認）
 *   B 自訂骰子（四屬性 × 四檔、已自定義標記、HP 連動、重置）
 *   C 切回嚴謹模式的還原（資料保留、數值還原、toast）
 *   D 完全自訂技能（快速新增、空名稱、分類切換、預覽）
 *   E 客製化規則（額度 1、六張卡、超額擋阻）
 *   F 自由模式解除額度（同一組卡片可再選）
 *
 * 位置備忘（2026-10-22 實測）：體質骰子卡在「步驟 4 → 基礎數值與相性」；
 * 客製化規則在「步驟 4 → 攻擊與技能庫」（手風琴預設收合，要先點開）；
 * 完全自訂技能在「步驟 4 → 咒語與自訂能力」。
 *
 * 用法：GM_BASE=http://localhost:3002 node scripts/gm/stage12-custom.mjs
 * 這支是手動工具，刻意不串進 `npm test`（需要真的瀏覽器與 dev server）。
 */
import { launch } from './cdp.mjs';
import { BASE, openWorkshop, newNpc, gotoStep, snap, section, check, note, report, dumpErrors } from './lib.mjs';

const STAGE = 12;
const api = await launch();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const bodyText = () => api.eval('document.body.innerText').then(String);
const has = async (s) => (await bodyText()).includes(s);
const hitsOf = async (s) => ((await bodyText()).match(new RegExp(s, 'g')) || []).length;

const clickText = async (text, wait = 600) => {
  const ok = await api.eval(`(() => {
    const els = [...document.querySelectorAll('button,label,div[role="button"],a')];
    const el = els.find((e) => (e.innerText || '').trim() === ${JSON.stringify(text)})
      || els.find((e) => (e.innerText || '').trim().includes(${JSON.stringify(text)}));
    if (!el) return false;
    el.click();
    return true;
  })()`);
  await sleep(wait);
  return ok;
};

/** toast 只活約 3 秒，密集輪詢才抓得到。 */
const watchToast = async (needle, ms = 3200) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await has(needle)) return true;
    await sleep(140);
  }
  return false;
};

/** 預覽卡面文字（右側即時預覽與角色卡預覽共用 .border-double）。 */
const cardFace = () => api.eval(`(() => {
  const el = document.querySelector('.border-double');
  return el ? el.innerText : '';
})()`).then(String);

const hp = async () => {
  const m = (await cardFace()).match(/HP\s*(\d+)/);
  return m ? Number(m[1]) : null;
};

/**
 * 體質骰子卡：`cards[0]` 才是外框（最後一個命中的是只含標籤與「預設 dX」的標題列）。
 */
const diceCard = (label) => api.eval(`(() => {
  const cards = [...document.querySelectorAll('div')].filter((d) => {
    const t = (d.innerText || '').trim();
    return t.startsWith(${JSON.stringify(label)}) && t.length < 160;
  });
  const card = cards[0];
  if (!card) return null;
  return {
    text: card.innerText.replace(/\\s+/g, ' ').trim(),
    dice: [...card.querySelectorAll('button')].map((b) => (b.innerText || '').trim()),
  };
})()`);

const clickDie = (label, die) => api.eval(`(() => {
  const cards = [...document.querySelectorAll('div')].filter((d) => {
    const t = (d.innerText || '').trim();
    return t.startsWith(${JSON.stringify(label)}) && t.length < 160;
  });
  const card = cards[0];
  if (!card) return false;
  const btn = [...card.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === ${JSON.stringify(die)});
  if (!btn) return false;
  btn.click();
  return true;
})()`);

/** 客製化規則的計數：讀該區塊標題列的 `current / max`（取含數字的**最短**命中，即標題列）。 */
const custCounter = () => api.eval(`(() => {
  const nodes = [...document.querySelectorAll('*')]
    .filter((n) => (n.innerText || '').includes('客製化規則') && /(\\d+)\\s*\\/\\s*(∞|\\d+)/.test(n.innerText || ''))
    .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
  const n = nodes[0];
  if (!n) return null;
  const m = (n.innerText || '').match(/(\\d+)\\s*\\/\\s*(∞|\\d+)/);
  return m ? { cur: Number(m[1]), max: Number.isFinite(Number(m[2])) ? Number(m[2]) : -1 } : null;
})()`);

const custCardCount = () => api.eval('document.querySelectorAll(\'[id^="skill-card-brute_cust_"]\').length');

/** SkillCard 的選用綁在「內層根 div」的 onClick（外層 wrapper 沒有）。 */
const selectCustCard = (idx) => api.eval(`(() => {
  const cards = [...document.querySelectorAll('[id^="skill-card-brute_cust_"]')];
  const w = cards[${idx}];
  if (!w) return false;
  const inner = w.firstElementChild;
  if (!inner) return false;
  inner.click();
  return true;
})()`);

// ─────────────────────────────────────────────
section('S. 開場：清空存檔、開一張新卡');
await api.goto(BASE, { timeout: 30000 });
await api.eval(`(() => { Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k)); return true; })()`);
await api.goto(BASE, { timeout: 30000 });
await sleep(950);
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
const hpBase = await hp();
note('預覽 HP（嚴謹模式基準）', hpBase);

// ─────────────────────────────────────────────
section('A. 自由模式開關');
check('A1 預設是嚴謹模式', await has('嚴謹模式'));
await clickText('嚴謹模式', 700);
check('A2 點擊後出現確認視窗', await has('開啟自定義模式'));
check('A3 確認視窗開著時還沒真的開啟', !(await has('自由模式')));
await clickText('取消', 600);
check('A4 按「取消」後回到嚴謹模式（視窗關閉、狀態未變）',
  !(await has('開啟自定義模式')) && (await has('嚴謹模式')));
await clickText('嚴謹模式', 700);
await clickText('確認開啟自定義', 900);
check('A5 按「確認開啟自定義」後切到自由模式', await has('自由模式'));

// 體質骰子卡住在「步驟 4 → 基礎數值與相性」，先導航過去。
await gotoStep(api, 4);
await sleep(800);
check('A6 自由模式出現「自定義 NPC 體質與基礎骰子」區塊', await has('自定義 NPC 體質與基礎骰子'));
await snap(api, STAGE, 'A-free-mode-on');

// ─────────────────────────────────────────────
section('B. 自訂骰子');
const mig0 = await diceCard('力量 MIG');
note('力量 MIG 卡片初始文字', mig0 && mig0.text);
check('B1 四張屬性卡都在（靈巧／洞察／力量／意志）',
  (await has('靈巧 DEX')) && (await has('洞察 INS')) && (await has('力量 MIG')) && (await has('意志 WLP')));
check('B2 力量卡的骰鈕是 d6／d8／d10／d12 四檔',
  !!mig0 && JSON.stringify(mig0.dice) === JSON.stringify(['d6', 'd8', 'd10', 'd12']),
  mig0 && JSON.stringify(mig0.dice));
check('B3 未改動時顯示「預設」與目前骰', !!mig0 && /預設\s*d10/.test(mig0.text), mig0 && mig0.text.slice(0, 40));
await clickDie('力量 MIG', 'd12');
await sleep(600);
const mig1 = await diceCard('力量 MIG');
check('B4 改成 d12 後出現「已自定義」標記', !!mig1 && mig1.text.includes('已自定義'), mig1 && mig1.text.slice(0, 50));
const hpAfter = await hp();
check('B5 改 MIG 會連動重算 HP（d10→d12 應 +10）', hpAfter === hpBase + 10, `${hpBase} → ${hpAfter}`);
check('B6 卡片說得出影響（HP +10）', !!mig1 && /HP \+10/.test(mig1.text), mig1 && mig1.text.slice(-60));
await clickText('重置體質骰子', 700);
const mig2 = await diceCard('力量 MIG');
check('B7 重置後回到預設值（HP 復原、標記消失）',
  (await hp()) === hpBase && !!mig2 && !mig2.text.includes('已自定義'), `HP=${await hp()}`);
check('B8 沒有自訂骰子時「重置體質骰子」按鈕消失', !(await has('重置體質骰子')));

// ─────────────────────────────────────────────
section('C. 切回嚴謹模式：資料保留、數值還原');
await clickDie('力量 MIG', 'd12');
await sleep(500);
const hpCustom = await hp();
await clickText('自由模式', 900);
const toastBack = await watchToast('自訂骰子已還原');
check('C1 切回嚴謹模式後體質骰子區塊消失', !(await has('自定義 NPC 體質與基礎骰子')));
check('C2 切回時有 toast 說明「自訂骰子已還原為標準值」', toastBack);
check('C3 切回後 HP 回到標準值', (await hp()) === hpBase, `${hpCustom} → ${await hp()}`);
await clickText('嚴謹模式', 700);
await clickText('確認開啟自定義', 900);
const mig3 = await diceCard('力量 MIG');
check('C4 再開自由模式，先前的自訂骰子仍在（資料保留）',
  (await hp()) === hpCustom && !!mig3 && mig3.text.includes('已自定義'), `HP=${await hp()}`);
await clickText('重置體質骰子', 600);

// ─────────────────────────────────────────────
section('D. 完全自訂技能');
await gotoStep(api, 4);
await sleep(700);
await clickText('咒語與自訂能力', 900);
check('D1 步驟 4 的「咒語與自訂能力」分頁有「完全自訂技能」區塊', await has('完全自訂技能'));
const formOk = await api.eval(`(() => !!document.querySelector('input[placeholder="能力名稱"]')
  && !!document.querySelector('textarea[placeholder="輸入效果與敘述..."]'))()`);
check('D2 快速新增表單在（能力名稱／效果敘述／分類）',
  (await has('快速新增自訂能力')) && formOk, 'placeholder 不進 innerText，改查 DOM');
const NAME = '測試用自訂能力';
const countBefore = await hitsOf(NAME);
await clickText('加入能力清單', 800);
const countEmpty = await hitsOf(NAME);
check('D3 空名稱按「加入能力清單」不會新增', countEmpty === countBefore, `${countBefore} → ${countEmpty}`);

const setField = async (placeholder, value) => {
  await api.eval(`(() => {
    const el = document.querySelector('input[placeholder=${JSON.stringify(placeholder)}]')
      || document.querySelector('textarea[placeholder=${JSON.stringify(placeholder)}]');
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(260);
};
await setField('能力名稱', NAME);
await setField('輸入效果與敘述...', '這是一段測試敘述，用來確認自訂能力會進清單。');
await clickText('加入能力清單', 900);
const toastAdd = await watchToast('成功新增自訂技能');
const countAfter = await hitsOf(NAME);
check('D4 填了名稱與敘述後新增成功（有 toast）', toastAdd);
check('D5 自訂技能出現在清單（畫面上開始出現這個名稱）', countAfter > countBefore, `${countBefore} → ${countAfter}`);
check('D6 清單上看得到剛剛的名稱', await has(NAME));

await api.eval(`(() => {
  const sels = [...document.querySelectorAll('select')];
  const sel = sels.find((s) => [...s.options].some((o) => o.value === 'spell') && [...s.options].some((o) => o.value === 'rule'));
  if (!sel) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(sel, 'spell');
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})()`);
await sleep(600);
check('D7 分類切到「咒語」後出現目標／MP／持續時間欄位',
  (await has('目標')) && (await has('MP 消耗')) && (await has('持續時間')));
check('D8 自訂技能出現在右側預覽卡', (await cardFace()).includes(NAME));
await snap(api, STAGE, 'D-custom-skill');

// ─────────────────────────────────────────────
section('E. 客製化規則（嚴謹模式額度 1）');
await clickText('攻擊與技能庫', 900);
if (await has('自由模式')) { await clickText('自由模式', 900); }   // E 段要驗嚴謹模式的額度
check('E0 已切回嚴謹模式再驗額度', await has('嚴謹模式'));
await clickText('客製化規則', 800);   // 手風琴預設收合，要先展開
const cust0 = await custCounter();
note('客製化規則計數', JSON.stringify(cust0));
check('E1 客製化規則區塊存在且額度是 1', !!cust0 && cust0.max === 1, JSON.stringify(cust0));
const custCards = await custCardCount();
check('E2 暴徒的客製化規則卡有六張', custCards === 6, `實測 ${custCards} 張`);
await selectCustCard(0);
await sleep(700);
const cust1 = await custCounter();
check('E3 選第一張後計數變 1 / 1', !!cust1 && cust1.cur === 1, JSON.stringify(cust1));
await selectCustCard(1);
await sleep(700);
const cust2 = await custCounter();
check('E4 嚴謹模式下選不了第二張（計數仍是 1）', !!cust2 && cust2.cur === 1, JSON.stringify(cust2));

// ─────────────────────────────────────────────
section('F. 自由模式解除額度');
await clickText('嚴謹模式', 700);
await clickText('確認開啟自定義', 900);
await clickText('攻擊與技能庫', 700);
if ((await custCardCount()) === 0) { await clickText('客製化規則', 800); }   // 已展開就不要再點（會收起來）
await selectCustCard(1);
await sleep(800);
const cust3 = await custCounter();
check('F1 自由模式下同一張卡可以再選（計數變 2、上限顯示為無限）', !!cust3 && cust3.cur === 2 && cust3.max === -1, JSON.stringify(cust3));
check('F2 自由模式下標題列明說「解鎖限制」', await has('解鎖限制'));
note('自由模式下卡片是否標「額度溢出失效」', await has('額度溢出失效'));
await snap(api, STAGE, 'F-over-budget');

// ─────────────────────────────────────────────
section('G. 自由模式的「超額」到底算不算數（可量測）');
// 選取中的卡片外框 id 會從 `skill-card-brute_cust_N` 變成 `skill-card-skill_<timestamp>`，
// 所以「已選中的卡片」只能用標題文字定位（索引會位移，2026-10-22 踩過）。
const selectedTitles = () => api.eval(`(() => [...document.querySelectorAll('[id^="skill-card-skill_"]')]
  .map((w) => (w.innerText || '').split('\\n')[0].trim()))()`);
const toggleCust = async (title, wait = 600) => {
  const ok = await api.eval(`(() => {
    const w = [...document.querySelectorAll('[id^="skill-card-"]')]
      .find((x) => (x.innerText || '').includes(${JSON.stringify(title)}));
    if (!w || !w.firstElementChild) return false;
    w.firstElementChild.click();
    return true;
  })()`);
  await sleep(wait);
  return ok;
};
for (const title of await selectedTitles()) { await toggleCust(title); }
const custReset = await custCounter();
note('清空後的計數', JSON.stringify(custReset));
note('清空後仍在選取中的卡片', JSON.stringify(await selectedTitles()));
const hpClean = await hp();
await toggleCust('壞脾氣');            // 無 HP 效果，先選
await toggleCust('提升最大生命');      // +10 HP，第二張 → 被判定超額
const custPair = await custCounter();
const hpPair = await hp();
note('兩張都選之後的計數', JSON.stringify(custPair));
note('HP：單張基準 → 兩張（第二張是 +10 HP 那張）', hpClean + ' → ' + hpPair);
const badge = await has('額度溢出失效');
check('G1 自由模式仍允許選到兩張（計數 2）', !!custPair && custPair.cur === 2, JSON.stringify(custPair));
check('G2 被判定超額的那張（+10 HP）仍然算數', hpPair === hpClean + 10, hpClean + ' → ' + hpPair);
check('G3 卡片與標題不互相矛盾（要嘛不算數且標「溢出」，要嘛算數且不標）',
  (hpPair === hpClean + 10) !== badge, '算數=' + (hpPair === hpClean + 10) + '、標溢出=' + badge);

// ─────────────────────────────────────────────
section('H. 兩處「有沒有告訴我」：空名稱提示、額度用完的說明');
await gotoStep(api, 4);
await sleep(600);
await clickText('咒語與自訂能力', 800);
await clickText('加入能力清單', 700);
check('H1 空名稱／空敘述新增時有錯誤提示（不是靜靜地不動作）', await watchToast('不可為空'));

// 回到嚴謹模式，只留一張客製化規則，再看「其餘卡片為什麼不能選」有沒有寫出來。
await clickText('攻擊與技能庫', 800);
if (await has('自由模式')) { await clickText('自由模式', 900); }
if ((await custCardCount()) === 0) { await clickText('客製化規則', 800); }
for (const title of await selectedTitles()) {
  if (title.includes('壞脾氣')) { await toggleCust(title); }
}
const custStrict = await custCounter();
note('嚴謹模式下只留一張的計數', JSON.stringify(custStrict));
const disabledInfo = await api.eval(`(() => {
  const w = document.querySelector('[id="skill-card-brute_cust_2"]');
  if (!w || !w.firstElementChild) return null;
  return { cls: w.firstElementChild.className.replace(/\\s+/g, ' ').slice(0, 200) };
})()`);
note('未選中的第三張卡外框 class', disabledInfo && disabledInfo.cls);
const explained = (await has('已達上限')) || (await has('額度已滿')) || (await has('客製化額度'))
  || (await has('無法再選')) || (await has('已用完'));
check('H2 額度用完時，畫面上有文字說明為什麼其餘卡片不能選', explained);

// ─────────────────────────────────────────────
dumpErrors(api);
const code = report('階段 12 自訂功能巡檢');
await api.close();
process.exit(code);
