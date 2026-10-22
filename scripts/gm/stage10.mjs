/**
 * 階段 10 關卡：邊界與韌性。
 *
 * 這一關守的是「新手 GM 最不想遇到、也最難自己救回來」的四件事：
 *   A 存檔完整性  —— 改完按「儲存」，改的東西真的進去了嗎（GM-10-01）
 *   B 殘缺與壞資料 —— 卡片缺欄位／型別壞掉，會不會一按「編輯」就整頁白掉（GM-10-02）
 *   C 離場警告    —— 十幾分鐘的草稿在重新載入時有沒有攔一下（GM-10-03）
 *   D 舊鍵遷移    —— 舊世代存檔進不進得來、舊鍵會不會被吃掉
 *   E 超長文本    —— 6,000 字背景故事存不存得下、卡面撐不撐破
 *   F 390px       —— 手機寬度走不走得完八步
 *   G 自由模式    —— 解除規則限制的確認視窗
 *
 * 定位一律用「人看得到的文字」與 placeholder，不用 testid——這一關要抓的正是
 * 「看不看得懂、按不按得到」，用 testid 定位等於繞過被測物。
 */
import { launch } from './cdp.mjs';
import {
  BASE, openWorkshop, newNpc, gotoStep, gotoStepMobile,
  snap, section, check, note, report, dumpErrors, armDialog,
} from './lib.mjs';

const STAGE = 10;
const api = await launch();
armDialog(api, { accept: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 真人輸入：聚焦 → 全選 → insertText。受控欄位一定收得到 onChange。 */
const typeInto = async (selector, text) => {
  const ok = await api.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.focus();
    if (el.setSelectionRange) el.setSelectionRange(0, el.value.length);
    return true;
  })()`);
  if (!ok) throw new Error(`找不到欄位：${selector}`);
  await api.send('Input.insertText', { text });
  await sleep(420);
};

const clickText = async (text, waitMs = 900) => {
  const ok = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!b) return false; b.click(); return true;
  })()`);
  await sleep(waitMs);
  return ok;
};

const ctrlS = async () => {
  await api.eval(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true })); return true; })()`);
  await sleep(900);
};

/** 卡片長度簽章：只比長度，不比內容——這一關問的是「有沒有進去」。 */
const card = () => api.eval(`(() => {
  const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]');
  const c = a[0] || {};
  return {
    count: a.length,
    name: (c.name || '').length,
    traits: (c.traits || '').length,
    story: (c.story || '').length,
    tactics: (c.tactics || '').length,
    role: c.role || null,
    level: c.level ?? null,
    rank: c.rank || null,
  };
})()`);

const hasBoundary = () => api.eval(`document.body.innerText.includes('遭遇了阻礙')`);
const names = () => api.eval(`[...document.querySelectorAll('h3')].map((e) => e.innerText.trim())`);
const bodyText = () => api.eval(`document.body.innerText`);

/** 觸發一次 beforeunload，回報有沒有被攔下來。 */
const unloadBlocked = () => api.eval(`(() => {
  const e = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
})()`);

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

const STORY = 'textarea[placeholder*="起源"]';
const TACT = 'textarea';
const NAME = 'input[placeholder="輸入名稱..."]';
const TRAITS = 'input[placeholder*="敏捷"]';
const STORY_TEXT = '鐘聲在灰燼裡響了三下。';

// ═══ A 存檔完整性（GM-10-01）═══════════════════════════════
section('A 存檔完整性：改完之後，改的東西進得去嗎');

// A1 只改故事 → 按「儲存」
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await typeInto(STORY, STORY_TEXT);
await clickText('儲存');
let c = await card();
check('A1 只改背景故事，按「儲存」後故事存得進去', c.story === STORY_TEXT.length, `實測 story=${c.story}，預期 ${STORY_TEXT.length}`);

// A2 只改故事 → 按「返回檔案庫」
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await typeInto(STORY, STORY_TEXT);
await clickText('返回檔案庫', 1200);
c = await card();
check('A2 只改背景故事，按「返回檔案庫」後故事存得進去', c.story === STORY_TEXT.length, `實測 story=${c.story}`);

// A3 只改故事 → Ctrl+S
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await typeInto(STORY, STORY_TEXT);
await ctrlS();
c = await card();
check('A3 只改背景故事，按 Ctrl+S 後故事存得進去', c.story === STORY_TEXT.length, `實測 story=${c.story}`);

// A4 名字 → 故事 → 儲存（舊版只會存到名字）
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await typeInto(NAME, '灰燼守門人');
await typeInto(STORY, STORY_TEXT);
await clickText('儲存');
c = await card();
check('A4 名字與故事都改，按「儲存」後兩者都在', c.name === 5 && c.story === STORY_TEXT.length, `name=${c.name} story=${c.story}`);

// A5 名字 → 故事 → 再改名字 → 儲存（舊版會「偶爾成功」，最難察覺）
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await typeInto(NAME, '第一次改名');
await typeInto(STORY, STORY_TEXT);
await typeInto(NAME, '第二次改名');
await clickText('儲存');
c = await card();
check('A5 名字與故事交替編輯後存檔，兩者都在', c.name === 5 && c.story === STORY_TEXT.length, `name=${c.name} story=${c.story}`);

// A6 四欄全填 → 儲存 → 重新載入後還在
await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await typeInto(NAME, '完整四欄');
await typeInto(TRAITS, '不死, 遲緩');
await typeInto(STORY, STORY_TEXT);
await gotoStep(api, 8);
await typeInto(TACT, '優先攻擊施法者。');
await clickText('儲存');
c = await card();
check('A6 名稱／特質／故事／戰術四欄都存得進去',
  c.name === 4 && c.traits === 6 && c.story === STORY_TEXT.length && c.tactics === 8,
  `name=${c.name} traits=${c.traits} story=${c.story} tactics=${c.tactics}`);
await api.goto(BASE, { timeout: 30000 });
await sleep(900);
c = await card();
check('A6b 重新載入之後四欄還在', c.story === STORY_TEXT.length && c.tactics === 8, `story=${c.story} tactics=${c.tactics}`);

// ═══ B 殘缺與壞資料（GM-10-02）════════════════════════════
section('B 殘缺與壞資料：卡片壞掉時，救不救得回來');

// B1 只有名字的卡
await boot(`localStorage.setItem('monogatari_techou_npc_library', JSON.stringify([{ id: 'bare_1', name: '只有名字' }]))`);
await openWorkshop(api, { stage: STAGE });
check('B1a 只有名字的卡仍進得了檔案庫', (await names()).includes('只有名字'), JSON.stringify(await names()));
await clickText('編輯', 1200);
check('B1b 只有名字的卡按「編輯」不會整頁崩', !(await hasBoundary()));
check('B1c 崩掉時不會只丟一句 reading \'map\'', !(await bodyText()).includes("reading 'map')"));
c = await card();
check('B1d 缺欄位被補成合法型別（職業／等級／稱號）', c.role === '暴徒' && c.level === 5 && c.rank === '士兵', JSON.stringify(c));

// B2 壞型別的卡
await boot(`localStorage.setItem('monogatari_techou_npc_library', JSON.stringify([{
  id: 'bad_1', name: '壞型別', role: '不存在的職業', level: 'abc', rank: null,
  skills: null, speciesConfig: null, affinities: null, linkedNpcs: null,
  selectedNegativeSkills: null, selectedBossSkills: null, customRules: null,
  attributes: null, story: null, tactics: null, traits: null, overrides: null,
}]))`);
await openWorkshop(api, { stage: STAGE });
await clickText('編輯', 1200);
check('B2 欄位型別全壞的卡按「編輯」不會崩', !(await hasBoundary()));
c = await card();
// `role` 是「有值但不認得」：只補缺、不改寫（`tests/npcWorkshop.test.mjs` G 段在守）。
// 未知定位能開，是因為 `case 4` 的兩個 `ROLES_DATA[state.role].availableSkills`
// 已改成 `?.` ＋ 空陣列回退（階段 11），不是因為把定位偷偷換掉。
check('B2b 壞掉的等級被收斂成 5、但未知的定位原樣保留', c.level === 5 && c.role === '不存在的職業',
  `level=${c.level} role=${c.role}`);
// 畫面只畫得出六個已知定位，所以「有沒有載入」不能看轉盤——要看上面那條警示。
check('B2c 未知定位有被說出來（畫面出現「不在本版資料裡」的警示）',
  String(await bodyText()).includes('不在本版資料裡'));

// B3 陣列裡混進垃圾
await boot(`localStorage.setItem('monogatari_techou_npc_library', JSON.stringify([null, '這不是卡', 42, { id: 'ok_1', name: '正常的卡' }]))`);
await openWorkshop(api, { stage: STAGE });
check('B3a 檔案庫陣列裡的垃圾條目被濾掉，只留合法卡', (await names()).join() === '正常的卡', JSON.stringify(await names()));
check('B3b 濾掉之後陣列長度是 1', (await card()).count === 1, `count=${(await card()).count}`);

// B4 整份存檔不是陣列
await boot(`localStorage.setItem('monogatari_techou_npc_library', '{"oops":true}')`);
await openWorkshop(api, { stage: STAGE });
check('B4 整份存檔是物件時，檔案庫退成空狀態而不是崩掉', !(await hasBoundary()));

// B5 整份存檔是壞 JSON
await boot(`localStorage.setItem('monogatari_techou_npc_library', '{{{ broken')`);
await openWorkshop(api, { stage: STAGE });
check('B5 整份存檔是壞 JSON 時，檔案庫退成空狀態而不是崩掉', !(await hasBoundary()));

// ═══ C 離場警告（GM-10-03）═══════════════════════════════
section('C 離場警告：未存的草稿在重新載入時有沒有攔一下');

await boot(`localStorage.setItem('monogatari_techou_npc_library', JSON.stringify([{
  id: 'saved_1', name: '已存過的卡', role: '暴徒', rank: '士兵', level: 5,
  selectedSpeciesId: 'sp_beast', speciesConfig: { selectedBenefits: [] },
  traits: '不死', story: '已經存過的故事', tactics: '已經存過的戰術',
  skills: [], affinities: {}, customDice: {}, isFreeModeEnabled: false,
}]))`);
await openWorkshop(api, { stage: STAGE });
await clickText('編輯', 1200);
check('C1 開啟已存檔的卡、什麼都沒改時，離場不攔（不誤報）', (await unloadBlocked()) === false);
await gotoStep(api, 7);
await typeInto(STORY, STORY_TEXT);
check('C2 改了背景故事但還沒存，離場會被攔', (await unloadBlocked()) === true);
await clickText('儲存');
check('C3 存檔之後，離場不再被攔', (await unloadBlocked()) === false);
await clickText('返回檔案庫', 1100);
check('C4 回到檔案庫之後，離場不攔（草稿已落地）', (await unloadBlocked()) === false);
// 全新草稿本來就是「還沒落地的東西」，所以它會被攔——這是刻意行為，記在這裡免得日後被當成誤報。
await newNpc(api, { stage: STAGE });
note('C5 剛建立的 NPC 尚未存檔，離場會被攔（刻意：那是十幾分鐘的工序）', String(await unloadBlocked()));

// ═══ D 舊鍵遷移 ══════════════════════════════════════════
section('D 舊鍵遷移：舊世代存檔進不進得來、舊鍵會不會被吃掉');

await boot(`localStorage.setItem('fabula-npc-library-v2', JSON.stringify([{
  id: 'legacy_1', name: '舊世代守衛', role: '暴徒', rank: '士兵', level: 10,
  selectedSpeciesId: 'undead', speciesConfig: {}, traits: '不死',
  story: '舊故事', tactics: '舊戰術', skills: [], affinities: {},
}]))`);
await openWorkshop(api, { stage: STAGE });
const legacy = await api.eval(`(() => {
  const auth = localStorage.getItem('monogatari_techou_npc_library');
  const old = localStorage.getItem('fabula-npc-library-v2');
  return { authLen: (auth || '').length, oldKept: !!old, names: auth ? JSON.parse(auth).map((n) => n.name) : [] };
})()`);
check('D1 舊鍵的內容被搬進權威鍵', legacy.names.includes('舊世代守衛'), JSON.stringify(legacy.names));
check('D2 舊鍵沒有被刪掉（遷移可逆）', legacy.oldKept === true);
await clickText('編輯', 1200);
check('D3 遷移進來的舊卡可以編輯、不會崩', !(await hasBoundary()));
c = await card();
check('D4 舊卡的等級與故事都留著', c.level === 10 && c.story === 3, `level=${c.level} story=${c.story}`);

// ═══ E 超長文本 ═════════════════════════════════════════
section('E 超長文本：6,000 字背景故事撐不撐得住');

await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 7);
await typeInto(NAME, '灰'.repeat(120));
await typeInto(STORY, '故'.repeat(6000));
await gotoStep(api, 8);
await typeInto(TACT, '戰'.repeat(3000));
await clickText('儲存');
c = await card();
check('E1 120 字名字存得進去', c.name === 120, `name=${c.name}`);
check('E2 6,000 字背景故事存得進去', c.story === 6000, `story=${c.story}`);
check('E3 3,000 字戰術存得進去', c.tactics === 3000, `tactics=${c.tactics}`);
await clickText('角色卡預覽', 1200);
const ov = await api.eval(`({ docW: document.documentElement.scrollWidth, winW: window.innerWidth })`);
check('E4 超長內容不會讓頁面橫向溢出', ov.docW <= ov.winW + 2, JSON.stringify(ov));
check('E5 超長內容下預覽不會崩', !(await hasBoundary()));
await snap(api, STAGE, 'E-long-card');
await clickText('返回檔案庫', 1100);
await clickText('編輯', 1200);
check('E6 超長內容的卡還進得去編輯', !(await hasBoundary()));

// ═══ F 390px ════════════════════════════════════════════
section('F 390px：手機寬度走不走得完八步');

await boot();
await api.viewport(390, 844);
await sleep(800);
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
const walked = [];
for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
  try { await gotoStepMobile(api, n); walked.push(n); } catch { walked.push(`X${n}`); }
}
check('F1 390px 下八步全部走得到', walked.join() === '1,2,3,4,5,6,7,8', JSON.stringify(walked));
const ovm = await api.eval(`({ docW: document.documentElement.scrollWidth, winW: window.innerWidth })`);
check('F2 390px 構築頁沒有橫向溢出', ovm.docW <= ovm.winW + 2, JSON.stringify(ovm));
check('F3 390px 走完八步不會崩', !(await hasBoundary()));
await snap(api, STAGE, 'F-mobile-build');
await clickText('角色卡預覽', 1100);
const ovp = await api.eval(`({ docW: document.documentElement.scrollWidth, winW: window.innerWidth })`);
check('F4 390px 預覽頁沒有橫向溢出', ovp.docW <= ovp.winW + 2, JSON.stringify(ovp));
await snap(api, STAGE, 'F-mobile-preview');
await api.viewport(1440, 1000);
await sleep(600);

// ═══ G 自由模式 ═════════════════════════════════════════
section('G 自由模式：解除規則限制的確認視窗');

await boot();
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await clickText('嚴謹模式', 900);
const freeModal = await api.eval(`document.body.innerText.includes('FREE EDIT MODE')`);
check('G1 點「嚴謹模式」會先跳確認視窗', freeModal === true);
const modalBtns = await api.eval(`[...document.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim()).filter(Boolean)`);
note('G1：確認視窗出現時的按鈕', JSON.stringify(modalBtns.slice(-6)));
await clickText('取消', 700);
check('G2 確認視窗可以取消，模式不變', (await bodyText()).includes('嚴謹模式'));

dumpErrors(api);
const code = report('階段 10 關卡（邊界與韌性）');
await api.close();
process.exit(code);
