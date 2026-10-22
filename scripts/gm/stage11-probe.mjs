/**
 * 階段 11 探測：修復批次的三個宣稱，逐條量。
 *
 * 這一關不是「重跑一次流程」，而是針對階段 11 動過的三件事各要一個**會失敗的證據**：
 *   A 不死 b1 相性 —— 原本引擎那份讀 `sp_undead_abs_choice`（這個 key 根本不存在），
 *                     於是選了 b1，卡面與戰鬥房間都還是「免疫」。修完要看到「吸收」。
 *   B 增益卡鍵盤   —— 原本是純 `div` ＋ `onClick`，Tab 直接跳過。修完要能 Tab 到、Enter 選。
 *   C 等級說明     —— GM-10-04 裁定「不開放中間值，但要說明」。文字要在控制項旁邊。
 *   D 未知定位     —— 補缺不改寫：`role` 有值但不認得時原樣保留，且面板不崩。
 *
 * 定位一律用「人看得到的文字」與 ARIA 屬性，不用 testid。
 */
import { launch } from './cdp.mjs';
import {
  BASE, openWorkshop, newNpc, gotoStep,
  section, check, note, report, dumpErrors,
} from './lib.mjs';

const STAGE = 11;
const api = await launch();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const clickText = async (text, waitMs = 900) => {
  const ok = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!b) return false; b.click(); return true;
  })()`);
  await sleep(waitMs);
  return ok;
};

const bodyText = () => api.eval(`document.body.innerText`);
const hasBoundary = () => api.eval(`document.body.innerText.includes('遭遇了阻礙')`);

const boot = async (seedScript) => {
  await api.goto(BASE, { timeout: 30000 });
  await api.eval(`(() => {
    Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k));
    return true;
  })()`);
  if (seedScript) await api.eval(seedScript);
  await api.goto(BASE, { timeout: 30000 });
  await sleep(950);
};

/** 卡面預覽的容器：`border-double` 是卡片外框，避免讀到整頁。 */
const cardFace = () => api.eval(`(() => {
  const el = document.querySelector('.border-double') || document.querySelector('#root');
  return el ? el.innerText : '';
})()`);

/** 卡面文字去空白後直接比對「屬性＋狀態」——卡面把九相排成一列一列，去空白就接得起來。 */
const faceSquashed = async () => String(await cardFace()).replace(/\s+/g, '');

// ═══ A 不死 b1 相性（跨路徑一致）═══════════════════════════
section('A 不死 b1：選了「免疫換吸收」，卡面與戰鬥房間都要是吸收');

const UNDEAD_SEED = `localStorage.setItem('monogatari_techou_npc_library', JSON.stringify([{
  id: 'undead_1', name: '不死測試', role: '暴徒', rank: '士兵', level: 5,
  faction: '敵方', traits: '', story: '', tactics: '',
  selectedSpeciesId: 'sp_undead',
  speciesConfig: { selectedBenefits: ['b1'] },
  skills: [], linkedNpcs: [], selectedNegativeSkills: [], selectedBossSkills: [],
  customRules: [], tags: [], affinities: null, overrides: null
}]))`;

await boot(UNDEAD_SEED);
await openWorkshop(api, { stage: STAGE });
await clickText('預覽', 1600);
const face = await faceSquashed();
note('A0 卡面（去空白）尾巴', face.slice(-260));
// 卡面一列是「狀態 → 英文代碼 → 官方字型字母 → 屬性字」（例：`吸收ABSd暗`），
// 所以照這個順序抓，不要假設「屬性在前」。
const affMap = {};
for (const m of face.matchAll(/(弱點|抗性|免疫|吸收)(?:VUL|RES|IMM|ABS)[a-z]?([\u4e00-\u9fff])/g)) affMap[m[2]] = m[1];
note('A4 卡面相性表', JSON.stringify(affMap));
check('A1 卡面「暗」顯示吸收（原本是免疫）', affMap['暗'] === '吸收', `暗=${affMap['暗'] || '讀不到'}`);
check('A2 卡面「光」仍是弱點（沒被 b1 波及）', affMap['光'] === '弱點', `光=${affMap['光'] || '讀不到'}`);
check('A3 卡面「毒」仍是免疫（b1 只換暗）', affMap['毒'] === '免疫', `毒=${affMap['毒'] || '讀不到'}`);

// A5 同一張卡推入戰鬥房間 → 戰鬥員的相性也要是 abs
await clickText('返回檔案庫', 1200);
const pushed = await clickText('入戰', 1600);
if (!pushed) {
  note('A5 找不到「入戰」按鈕（檔案庫動作列），跳過戰鬥房間比對', 'skip');
} else {
  const raw = await api.eval(`localStorage.getItem('monogatari_techou_active_combat') || ''`);
  check('A5 戰鬥房間收到的是「吸收」而不是「免疫」', raw.includes('"暗":"abs"') || raw.includes('"暗": "abs"'),
    `activeCombat 片段=${String(raw).replace(/\s+/g, ' ').slice(0, 200)}`);
}

// ═══ B 增益卡鍵盤可達 ═══════════════════════════════════════
section('B 增益卡：Tab 到得了、Enter 選得動');

await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 3);
// 增益卡要「先選一個物種」才會出現（物種瓷磚本身沒有 role）。
await clickText('野獸物種 BEAST', 900);

const cards = () => api.eval(`(() => {
  const list = [...document.querySelectorAll('[role="button"][aria-pressed]')];
  return list.map((el) => ({
    text: (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 24),
    pressed: el.getAttribute('aria-pressed'),
    disabled: el.getAttribute('aria-disabled'),
    tabIndex: el.tabIndex,
  }));
})()`);

let cs = await cards();
check('B1 增益卡是 role=button（原本是無角色的 div）', cs.length >= 5, `實測 ${cs.length} 張`);
check('B2 未選滿時 tabIndex 是 0（Tab 到得了）', cs.length > 0 && cs.every((c) => c.tabIndex === 0),
  JSON.stringify(cs.map((c) => c.tabIndex)));
check('B3 未選時 aria-pressed 是 false', cs.length > 0 && cs.every((c) => c.pressed === 'false'),
  JSON.stringify(cs.map((c) => c.pressed)));

// B4 真的用鍵盤選第一張
const pressedByKey = await api.eval(`(() => {
  const el = document.querySelector('[role="button"][aria-pressed]');
  if (!el) return 'no-card';
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  return document.activeElement === el ? 'focused' : 'not-focused';
})()`);
await sleep(500);
cs = await cards();
check('B4 Enter 鍵真的把第一張選起來', cs.length > 0 && cs[0].pressed === 'true', `${pressedByKey}；pressed=${cs[0]?.pressed}`);

// B5 選滿之後，剩下的卡 tabIndex 變 -1 且 aria-disabled
const max = await api.eval(`(() => {
  const m = (document.body.innerText.match(/\\d+\\s*\\/\\s*(\\d+)/) || [])[1];
  return m ? Number(m) : null;
})()`);
if (max && max >= 2) {
  await api.eval(`(() => {
    const els = [...document.querySelectorAll('[role="button"][aria-pressed]')];
    for (const el of els) {
      if (el.getAttribute('aria-pressed') === 'false' && el.getAttribute('aria-disabled') !== 'true') {
        el.focus();
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        break;
      }
    }
    return true;
  })()`);
  await sleep(500);
  cs = await cards();
  check('B5 選滿後剩下的卡 tabIndex 是 -1（不再騙人 Tab 得到）',
    cs.filter((c) => c.pressed === 'false').every((c) => c.tabIndex === -1),
    JSON.stringify(cs.map((c) => `${c.pressed}/${c.tabIndex}`)));
  note('B6 選滿後的卡片狀態', JSON.stringify(cs));
} else {
  note('B5 讀不到增益上限（Pick N），跳過選滿檢查', String(max));
}

// ═══ C 等級說明（GM-10-04 裁定）═════════════════════════════
section('C 等級：七個檔位是規則，但畫面上要說');

await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 2);

const levelUi = await api.eval(`(() => {
  const sels = [...document.querySelectorAll('select')];
  const lv = sels.find((s) => [...s.options].some((o) => o.textContent.includes('Lv. 5')));
  return {
    found: !!lv,
    options: lv ? [...lv.options].map((o) => o.textContent.trim()) : [],
    explained: document.body.innerText.includes('原書的等級是階級制'),
  };
})()`);

check('C1 等級下拉仍然只有 7 個檔位（沒有為了修說明而放寬）', levelUi.options.length === 7, JSON.stringify(levelUi.options));
check('C2 下拉下方有「階級制」的說明文字', levelUi.explained === true, `explained=${levelUi.explained}`);

// ═══ D 未知定位：補缺不改寫 ═════════════════════════════════
section('D 未知定位：原樣保留，面板不崩');

await boot(`localStorage.setItem('monogatari_techou_npc_library', JSON.stringify([{
  id: 'odd_1', name: '怪定位', role: '不存在的職業', rank: '士兵', level: 5,
  faction: '敵方', traits: '', story: '', tactics: '',
  selectedSpeciesId: 'sp_beast', speciesConfig: {}, skills: [], linkedNpcs: [],
  selectedNegativeSkills: [], selectedBossSkills: [], customRules: [], tags: [],
  affinities: null, overrides: null
}]))`);
await openWorkshop(api, { stage: STAGE });
await clickText('編輯', 1200);
check('D1 未知定位的卡按「編輯」不會崩', !(await hasBoundary()));
const shown = await bodyText();
check('D2 未知定位沒有被偷偷改成暴徒（畫面看得到原本的字）', shown.includes('不存在的職業'),
  `畫面是否含「不存在的職業」=${shown.includes('不存在的職業')}`);
const saved = await api.eval(`(() => {
  const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]');
  return (a[0] || {}).role;
})()`);
check('D3 存檔裡的 role 仍是原字串', saved === '不存在的職業', `role=${saved}`);

// 未知定位能不能走完第 4 步（那兩個原本會炸的 availableSkills）
await gotoStep(api, 4);
check('D4 未知定位走到第 4 步（技能）仍然不崩', !(await hasBoundary()));

dumpErrors(api);
const code = report('階段 11 探測（修復批次）');
await api.close();
process.exit(code);
