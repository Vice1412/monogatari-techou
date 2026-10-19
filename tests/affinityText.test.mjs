/**
 * 九相屬性標記（`src/components/ui/affinityText.js`）測試。
 *
 * 執行：npm run test:affinity
 *
 * ── 為什麼有這道關卡 ──────────────────────────────────────────────
 * 2026-10-05：速查手冊的「魔能發電模組」被畫成「魔能發⚡電模組」。
 * 根因不是資料寫錯，而是**判定邏輯**用負向後顧逐一排除例外詞
 * （曲風／暴風／中毒／微光／暗影／物理防禦／電壓／火器／火焰），
 * 而黑名單永遠追不上語言——「發電」只是當天剛好踩到的那一個。
 * 稽核全資料層後，同一類誤標共 **317 處**（風暴／光環／暗黑之刃／火砲模組／
 * 靈光一閃／交叉火力／墓土之子／放電形態／月光玉蘭／燈光／物理抵抗…）。
 *
 * 現在判定改成「情境白名單 ＋ 夾字否決」，並由本檔鎖住四件事：
 *   A. 誤標表 —— 實際踩到的 100+ 個詞，永遠不准再標
 *   B. 正標表 —— 真正的屬性用法，一個都不准少
 *   C. 資料層掃描 —— 把誤標詞放回真實資料，確認真的不再命中
 *   D. 渲染器同步 —— FUIcon 必須使用同一份比對器，不得再長出第二條正則
 */
import fs from 'node:fs';
import path from 'node:path';
import { findAffinityTokens, AFFINITY_BASES } from '../src/components/ui/affinityText.js';

import rulesData from '../src/features/character-sheet/data/rulesData.json';
import { RULE_CODEX } from '../src/features/character-sheet/data/ruleCodexData.js';
import * as ruleCodexExpansion from '../src/features/character-sheet/data/ruleCodexExpansion.js';
import * as expansionPresets from '../src/features/character-sheet/data/expansionPresets.js';
import * as skillSuboptions from '../src/features/character-sheet/data/skillSuboptionsData.js';
import * as sourcebookConfig from '../src/features/character-sheet/data/sourcebookConfig.js';
import * as gourmetData from '../src/features/character-sheet/data/gourmetData.js';
import * as starterPresets from '../src/features/character-sheet/data/starterPresets.js';
import * as aceOfCards from '../src/features/character-sheet/data/aceOfCardsData.js';
import * as pilotVehicle from '../src/features/character-sheet/data/pilotVehicleData.js';
import * as tinkererProjects from '../src/features/character-sheet/data/tinkererProjects.js';
import * as classResources from '../src/features/character-sheet/data/classResources.js';
import * as wayfarerCompanion from '../src/features/character-sheet/data/wayfarerCompanionData.js';
import * as properNouns from '../src/utils/properNouns.js';

let pass = 0;
let fail = 0;
const lines = [];

const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else fail += 1;
  lines.push(
    ok
      ? `  PASS  ${label}`
      : `  FAIL  ${label}\n          期望 ${JSON.stringify(expected)}\n          實得 ${JSON.stringify(actual)}`
  );
};
const checkTrue = (label, cond) => check(label, !!cond, true);
const section = (t) => lines.push(`\n=== ${t} ===`);

const raws = (text) => findAffinityTokens(text).map((t) => t.raw);
const kinds = (text) => findAffinityTokens(text).map((t) => t.kind);

// ─────────────────────────────────────────────────────────── A
section('A. 誤標表：這些詞一個字都不准被標成屬性');
// 全部取自 2026-10-05 全資料層稽核（舊正則實際畫錯的 317 處）。
// 每個詞後面括號是當時被畫錯的那個字。
const FALSE_POSITIVES = [
  // 名稱類（技能／咒語／裝備／模組／專有名詞）
  '劍刃風暴', '靈光一閃', '貿易之風', '暗黑之刃', '暗黑之心', '暗黑之血', '暗黑力量',
  '冰川覆裂', '冰凍堡壘', '冰雪時代', '伊格尼斯之火', '交叉火力', '電流術', '靜電',
  '輝光', '光能掌握', '放電形態', '毒物形態', '光環', '重型火槍', '烈風', '微風', '旋風',
  '光照射線', '月光玉蘭', '火砲模組', '魔能發電模組', '風元素爆發', '風元素詛咒',
  '土元素爆發', '土元素詛咒', '火元素爆發', '火元素詛咒', '電元素爆發', '電元素詛咒',
  '冰元素爆發', '冰元素詛咒', '風暴擊', '旋風攻勢', '墓土之子', '風行長靴', '光榮的命運',
  '潔净月光', '棄暗投明之人', '電馭吸血鬼', '焦火', '狂風提琴', '魅惑麥克風', '弧光連枷',
  '風暴騎士團', '聖火的信徒', '風味', '風暴', '風之源泉【洞察】', '土之源泉（由你自選）',
  '火之源泉【靈巧】', '電之源泉【力量】', '冰之源泉【意志】',
  // 敘述類（金手指／天賦／模組說明）
  '當你在陽光下施展該咒語', '這片土地的規則', '神秘的生命之光', '並配備明亮燈光',
  '依賴蠻力或物理抵抗', '放電生物、雷元素', '飛翼獸、火箭', '槍蝦、火元素',
  '蜘蛛、毒蛇、毒性史萊姆', '無法與外界進行物理交互', '也無法與你進行物理交互',
  '神奇的火花', '從書的文風和語調', '希望Hope和火山Volcano', '發電機', '神秘電路',
  '軍火販子', '帶去光明', '榮光之中', '地獄生物的怒火', '懷疑的目光', '電子遊戲',
  '聚光燈', '至暗之時已到', '不屬於物理的傷害類型', '變成一種物理以外的傷害類型',
  '電能', '毒藥和腐爛的事物', '火、熱、金屬', '寒冷、冰、沉默', '霧、雨、風暴',
  '製造一道閃光', '定期充電', '戰鬥風格', '陰暗的', '光環和屏障',
  '受你施放的光環和/或屏障咒語', '選擇三種不同風味', '你發展這種戰鬥風格',
  '暗黑之刃', '火元素', '土元素', '風元素', '電元素', '冰元素',
  '毒蛇', '毒性史萊姆', '發電機', '電路', '軍火',
  // 舊版黑名單原本就在擋、新版必須同樣擋住的詞（證明新規則涵蓋舊規則）
  '暗影突襲', '黑暗', '中毒', '微光視覺', '曲風', '暴風', '疾風',
  '物理防禦強化', '電壓', '火器', '火焰噴射模組',
];

for (const phrase of FALSE_POSITIVES) {
  check(`「${phrase}」不得標記`, raws(phrase), []);
}
check(`誤標表共 ${FALSE_POSITIVES.length} 條`, FALSE_POSITIVES.length >= 100, true);

// ─────────────────────────────────────────────────────────── B
section('B. 正標表：真正的屬性用法一個都不准少');
const TRUE_POSITIVES = [
  ['【火】屬性傷害', ['【火】']],
  ['傷害類型轉為【電】屬性。', ['【電】']],
  ['（風）', ['風']],
  ['風之源泉（風）', ['風']],
  ['火屬性', ['火屬性']],
  ['暗屬性傷害', ['暗屬性傷害']],
  ['物理抗性', ['物理抗性']],
  ['毒系傷害', ['毒系傷害']],
  ['毒傷', ['毒傷']],
  ['不是物理類型', ['物理類型']],
  ['你獲得對物理傷害的抗性', ['物理傷害']],
  ['對暗與毒屬性傷害的抗性', ['暗', '毒屬性傷害']],
  ['獲得對暗、光和毒屬性傷害的新親和力', ['暗', '光', '毒屬性傷害']],
  ['風、電、土、火或冰', ['風', '電', '土', '火', '冰']],
  ['風／電／暗／土／火／冰／光／毒', ['風', '電', '暗', '土', '火', '冰', '光', '毒']],
  ['風土火電或冰', ['風', '土', '火', '電', '冰']],
  ['1.風 2.電 3.暗 4.土 5.火 6.毒', ['風', '電', '暗', '土', '火', '毒']],
  ['受到風、電或冰屬性傷害', ['風', '電', '冰屬性傷害']],
  ['在電、暗、火、冰、光中選擇一種傷害類型', ['電', '暗', '火', '冰', '光']],
  ['風弱電、電弱土', ['風', '電', '電', '土']],
  ['(HR + 8) 物理', ['物理']],
  ['【HR + 5】物理', ['物理']],
  ['暗', ['暗']],
  ['變為土或物理屬性', ['土', '物理屬性']],
  ['類型為光；為奇數則為暗', ['光', '暗']],
  ['該傷害變為暗或光屬性', ['暗', '光屬性']],
  ['額外造成 5 點傷害，傷害類型轉為【土】屬性。', ['【土】']],
  ['風、電、暗、土、火、冰、毒中選擇一個傷害類型', ['風', '電', '暗', '土', '火', '冰', '毒']],
];
for (const [text, expected] of TRUE_POSITIVES) {
  check(`「${text}」`, raws(text), expected);
}

section('B2. 判定種類（每種情境各有其依據）');
check('括號【火】', kinds('【火】屬性傷害'), ['bracket']);
check('括號（火）', kinds('選擇（火）屬性'), ['bracket']);
check('明確後綴', kinds('火屬性'), ['suffix']);
check('列舉', kinds('風、電或冰'), ['list', 'list', 'list']);
check('編號列舉', kinds('1.風 2.電'), ['numbered', 'numbered']);
check('繫詞', kinds('變為土'), ['copula']);
check('傷害式尾綴', kinds('(HR + 8) 物理'), ['damage-tail']);
check('整串即屬性詞', kinds('暗'), ['standalone']);
check('空字串', raws(''), []);
check('null', findAffinityTokens(null), []);
check('undefined', findAffinityTokens(undefined), []);
check('非字串', findAffinityTokens(42), []);

// ─────────────────────────────────────────────────────────── C
section('C. 資料層掃描：誤標詞放回真實資料後仍不得命中');
const SOURCES = {
  'rulesData.json': rulesData,
  'ruleCodexData.js': RULE_CODEX,
  'ruleCodexExpansion.js': ruleCodexExpansion,
  'expansionPresets.js': expansionPresets,
  'skillSuboptionsData.js': skillSuboptions,
  'sourcebookConfig.js': sourcebookConfig,
  'gourmetData.js': gourmetData,
  'starterPresets.js': starterPresets,
  'aceOfCardsData.js': aceOfCards,
  'pilotVehicleData.js': pilotVehicle,
  'tinkererProjects.js': tinkererProjects,
  'classResources.js': classResources,
  'wayfarerCompanionData.js': wayfarerCompanion,
  'properNouns.js': properNouns,
};

const walk = (node, keyPath, out) => {
  if (typeof node === 'string') return void out.push({ keyPath, text: node });
  if (Array.isArray(node)) return void node.forEach((v, i) => walk(v, `${keyPath}[${i}]`, out));
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, keyPath ? `${keyPath}.${k}` : k, out);
  }
};

const corpus = [];
for (const [label, mod] of Object.entries(SOURCES)) {
  const out = [];
  walk(mod, label, out);
  corpus.push(...out);
}
checkTrue(`語料共 ${corpus.length} 個字串欄位`, corpus.length > 5000);

// C1：誤標詞在語料中出現時，其字元範圍內不得有任何標記
let overlaps = [];
for (const { keyPath, text } of corpus) {
  const tokens = findAffinityTokens(text);
  if (tokens.length === 0) continue;
  for (const phrase of FALSE_POSITIVES) {
    let from = text.indexOf(phrase);
    while (from !== -1) {
      const stop = from + phrase.length;
      const hit = tokens.find((t) => t.index < stop && t.index + t.raw.length > from);
      if (hit) overlaps.push(`${keyPath}：「${phrase}」內的「${hit.raw}」`);
      from = text.indexOf(phrase, from + 1);
    }
  }
}
check('誤標詞在真實資料中零命中', overlaps.slice(0, 20), []);

// C2：夾字否決——靠「列舉」成立的標記，左右不得同時被非黏著漢字夾住。
// （獨立於比對器重寫一次這條不變式：就算日後有人把比對器放寬成「裸字全命中」，
//   「發電」「風格」「光環」這類詞也會在這裡亮紅燈。明確後綴如「物理傷害」不在此列。）
const HAN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const GLUE = '、，,；;：:／/·・或與及和弱|｜-－—～~＋+＝=*　 \t\n\r（）()【】「」『』〈〉《》〔〕。！？!?0123456789０１２３４５６７８９';
const isGlue = (c) => c !== undefined && GLUE.includes(c);
const isBaseEnd = (text, i) =>
  i >= 0 && AFFINITY_BASES.some((b) => i - b.length + 1 >= 0 && text.startsWith(b, i - b.length + 1));
const wedgedBoth = [];
let listTokens = 0;
for (const { keyPath, text } of corpus) {
  for (const t of findAffinityTokens(text)) {
    if (t.kind !== 'list') continue;
    listTokens += 1;
    const left = t.index > 0 ? text[t.index - 1] : undefined;
    const right = text[t.index + t.raw.length];
    const leftWedged = left !== undefined && HAN.test(left) && !isGlue(left) && !isBaseEnd(text, t.index - 1);
    const rightWedged = right !== undefined && HAN.test(right) && !isGlue(right) && !AFFINITY_BASES.some((b) => text.startsWith(b, t.index + t.raw.length));
    if (leftWedged && rightWedged) wedgedBoth.push(`${keyPath}：「${t.raw}」（…${text.slice(Math.max(0, t.index - 4), t.index + t.raw.length + 4)}…）`);
  }
}
check('列舉標記在語料中確實存在（掃描有效）', listTokens > 100, true);
check('沒有被漢字左右夾住的列舉標記', wedgedBoth.slice(0, 20), []);

section('C3. 速查手冊實際內容（本次回報的現場）');
const codexRow = (id, name) => {
  for (const sec of RULE_CODEX[id].sections || []) {
    if (sec.kind !== 'table') continue;
    const row = sec.rows.find((r) => r[0] === name);
    if (row) return row;
  }
  return null;
};
const pilotSupport = codexRow('pilot', '魔能發電模組');
checkTrue('機師支援模組：魔能發電模組存在', !!pilotSupport);
check('魔能發電模組：名稱不標記', raws(pilotSupport[0]), []);
check('魔能發電模組：效果不標記', raws(pilotSupport[1]), []);
check('武裝模組：火砲模組名稱不標記', raws(codexRow('pilot', '火砲模組')[0]), []);
check('武裝模組：傷害欄 (HR + 8) 火 仍標記', raws('(HR + 8) 火'), ['火']);
check('支援模組：挖掘模組說明不標記', raws('此載具可掘穿地面，並配備明亮燈光。'), []);
check('祈喚者：風之源泉（風）只標括號內', raws('風之源泉（風）'), ['風']);
check('魔奏者：傷害【風】，狀態【緩慢】', raws('傷害【風】，狀態【緩慢】，屬性【INS】'), ['【風】']);

// ─────────────────────────────────────────────────────────── D
section('D. 渲染器同步：不得再長出第二條正則');
const fuiSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/ui/FUIcon.jsx'),
  'utf8'
);
checkTrue('FUIcon 使用共用的比對器', fuiSource.includes("from './affinityText'"));
checkTrue('FUIcon 使用 findAffinityTokens', fuiSource.includes('findAffinityTokens('));
check('FUIcon 已無舊版黑名單正則', fuiSource.includes('(?<![曲暴疾])'), false);
check('FUIcon 已無內嵌屬性正則', fuiSource.includes('const regex ='), false);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
