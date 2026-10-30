/**
 * 條目交叉引用（cross-reference）契約測試 —— 2026-10-30。
 *
 * 執行：`npm run test:crossrefs`
 *
 * ## 這一組在守什麼
 *
 * 使用者要求「神秘魔法書裡那些英雄技能和金手指，點一下要能看到效果；其他寫到
 * 別的技能效果的，也照同樣方式處理」。實作在 `data/crossRefs.js`，規則有三條
 * （明確清單／引用線索／【】括號），但**規則本身會錯**，所以這裡把兩端都釘住：
 *
 * 1. **該連的連得到**：神秘魔法書那八個名字、`使用X技能` 這類句型、並列清單。
 * 2. **不該連的不連**：`升級`、`消失`、`覺醒`、`彗星` 這些在日常句裡是普通詞。
 *    （第一版沒有這道牆，掃 46 條金手指命中 22 次，其中 14 次是假的。）
 * 3. **連到的東西真的有內容**：每個引用名稱都要能查到條目，而且正文不是空的——
 *    否則點下去會開出一個空白視窗，比不連更糟。
 *
 * ## 為什麼不驗「畫面上有沒有那顆 span」
 *
 * 那由 `test:ui` 的渲染層負責。這裡驗的是**判定**——判定錯了，畫面再漂亮也是錯的。
 */
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import {
  resolveRefNames, lookupEntry, hasEntry, REF_NAMES,
} from '../src/features/character-sheet/data/crossRefs.js';

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
const section = (t) => lines.push(`\n=== ${t} ===`);

const quirk = (n) => rulesData.quirks.find((q) => q.name === n);
const heroic = (n) => rulesData.heroicSkills.find((h) => h.name === n);
const classSkill = (n) => Object.values(rulesData.classes)
  .flatMap((c) => c.skills || [])
  .find((s) => s.name === n);

// ─────────────────────────────────────────────────────────── A
section('A. 火山（VOLCANO）：正式版定名，公測舊名不得回來');

const volcano = heroic('火山');

check('【火山】在英雄技能表裡', Boolean(volcano), true);
check('公測舊名【超魔法】已不存在', Boolean(heroic('超魔法')), false);
check('神秘魔法書引用的是【火山】', /彗星、額外咒語、希望和火山/.test(quirk('神秘魔法書').desc), true);
check('全資料不再出現「超魔法」三個字', /超魔法/.test(JSON.stringify(rulesData)), false);

// 正式版把「改名／換屬性」寫成咒語自己的可選條款，預設是火。
check('效果文有「可以另取名字」的條款', /更貼合角色設定的名字/.test(volcano.effect), true);
check('效果文列的可換屬性＝風、電、土、冰', /風、電、土、冰/.test(volcano.effect), true);
check('傷害預設是火屬性（兩個選項各一次）',
  (volcano.effect.match(/火屬性傷害/g) || []).length, 2);
check('不再有「選擇其中一個屬性」的公測寫法',
  /選擇其中一個屬性/.test(volcano.effect), false);
check('MP 40', /MP40/.test(volcano.effect), true);
check('傷害 50／30', [/50點/.test(volcano.effect), /30點/.test(volcano.effect)], [true, true]);
check('20 級 +5、40 級 +10', [/增加5/.test(volcano.effect), /增加10/.test(volcano.effect)], [true, true]);
check('無視抗性和免疫', /無視抗性和免疫/.test(volcano.effect), true);

// ─────────────────────────────────────────────────────────── B
section('B. 神秘魔法書：八個並列名稱全部變成可點引用');

const grimRefs = resolveRefNames(quirk('神秘魔法書').desc, '神秘魔法書');

check('八個名稱一個不少',
  ['彗星', '額外咒語', '希望', '火山', '草木成精', '機器人', '會說話的野獸', '大夢一場']
    .filter((n) => !grimRefs.includes(n)), []);
check('沒有多連出第九個', grimRefs.length, 8);
check('每個都查得到條目', grimRefs.filter((n) => !lookupEntry(n)), []);
check('每個條目的正文都不是空的',
  grimRefs.filter((n) => !(lookupEntry(n).body || '').trim()), []);
check('類型標籤正確（四英雄、四金手指）',
  grimRefs.map((n) => lookupEntry(n).kindLabel).sort(),
  ['英雄技能', '英雄技能', '英雄技能', '英雄技能', '金手指', '金手指', '金手指', '金手指']);

// ─────────────────────────────────────────────────────────── C
section('C. 引用線索：「使用／獲得／施展 X 技能」抓得到');

[
  ['進階蛻皮', '蛻皮'],
  ['夢之刃', '暗影突襲'],
  ['振作起來', '我相信你'],
  ['魔法折射', '元素祈喚'],
  ['神符精通', '徽記學'],
  ['牌運亨通', '魔法卡組'],
].forEach(([own, expect]) => {
  const entry = heroic(own) || classSkill(own);
  const text = entry.effect || entry.desc;
  check(`${own} → ${expect}`, resolveRefNames(text, own).includes(expect), true);
});

// ─────────────────────────────────────────────────────────── D
section('D. 並列清單：只有第一個吃到線索，其餘要自動補齊');

const three = resolveRefNames(classSkill('戰車碾壓').desc, '戰車碾壓');
check('戰車碾壓 → 主教法令、騎兵衝鋒、帝王堅壘',
  ['主教法令', '騎兵衝鋒', '帝王堅壘'].filter((n) => !three.includes(n)), []);
check('（自檢）句子裡真的有三個名稱',
  ['主教法令', '騎兵衝鋒', '帝王堅壘'].filter((n) => classSkill('戰車碾壓').desc.includes(n)).length, 3);

// ─────────────────────────────────────────────────────────── E
section('E. 反例：日常詞不得被連成技能（第一版就是在這裡出錯）');

[
  ['天才的宿敵', '升級'], // 「他升級為了實力更強的反派」＝動詞
  ['應劫之人', '彗星'], // 「超大彗星」＝天體
  ['武器縛靈', '消失'], // 「你會立即消失」＝動詞
  ['固執的懷疑論者', '覺醒'], // 「力量也開始覺醒」＝動詞
  ['交織的靈魂\\戒指裡的老爺爺', '消失'],
  ['綁定和召喚', '探索'], // 「透過探索和故事推進」＝普通名詞
].forEach(([own, bad]) => {
  const entry = quirk(own) || classSkill(own);
  const text = entry.desc;
  check(`${own} 不連「${bad}」`, resolveRefNames(text, own).includes(bad), false);
});

// ─────────────────────────────────────────────────────────── F
section('F. 【】書名括號：專案既有的引用慣例');

check('粉碎擊 → 破甲擊（靠【】抓到）',
  resolveRefNames(heroic('粉碎擊').effect, '粉碎擊').includes('破甲擊'), true);
check('（自檢）粉碎擊的效果文裡真的有【破甲擊】',
  /【破甲擊】/.test(heroic('粉碎擊').effect), true);

// ─────────────────────────────────────────────────────────── G
section('G. 邊界：不存在的名稱、自己、空字串');

check('查不到的名稱回 null', lookupEntry('這個條目不存在'), null);
check('hasEntry 對不存在名稱回 false', hasEntry('這個條目不存在'), false);
check('空字串不會炸', resolveRefNames('', null), []);
check('null 不會炸', resolveRefNames(null, null), []);
check('條目不會引用自己（進階蛻皮不含「進階蛻皮」）',
  resolveRefNames(heroic('進階蛻皮').effect, '進階蛻皮').includes('進階蛻皮'), false);

// ─────────────────────────────────────────────────────────── H
section('H. 索引完整性：引用池裡沒有「查不到的空殼」');

check('可引用名稱數 > 300', REF_NAMES.length > 300, true);
check('每個可引用名稱都查得到條目', REF_NAMES.filter((n) => !lookupEntry(n)), []);
check('每個條目都有類型標籤', REF_NAMES.filter((n) => !lookupEntry(n).kindLabel), []);
check('名稱長度都 ≥ 2（單字名會誤連到處都是）',
  REF_NAMES.filter((n) => n.length < 2), []);

// ─────────────────────────────────────────────────────────── I
// 2026-10-30：規則用語以**英文版為準**（使用者指示）。
//
// 神祕魔法書「意識的覺醒」原本寫「可以在任何玩家角色的回合結束時施展該咒語」，
// 但 Core p.124 `MYSTERIOUS GRIMOIRE` 寫的是：
//   `Once per conflict, if requested, the NPC will cast one of these spells. Spells cast
//    this way will be cast at the end of the current round, require no Mind Points, and
//    use 2d10 for the Magic Check (if needed).`
//
// 「任一玩家角色的回合結束」＝一輪可以觸發多次（每個人的回合結束都算），
// 「本輪結束」＝一輪一次。這是機制差異，不是措辭差異，所以釘死在這裡。
//
// 為什麼放在這支檔案：神祕魔法書是全站引用最多的條目，也是這輪改動的起點；
// 它的文字契約（八個引用 ＋ 規則用語）集中在一處，改壞了會同時紅。
section('I. 神祕魔法書的規則用語：以英文原書為準');

const grimDesc = quirk('神秘魔法書').desc;

check('施展時機＝本輪結束（英文：at the end of the current round）',
  /本輪結束時施展該咒語/.test(grimDesc), true);
check('不再是「任何玩家角色的回合結束」',
  /任何玩家角色的回合結束/.test(grimDesc), false);
check('每次衝突限一次（英文：once per conflict）', /每次衝突限一次/.test(grimDesc), true);
check('不消耗 MP', /不需要消耗MP/.test(grimDesc), true);
check('施法檢定用 2d10', /2d10/.test(grimDesc), true);

// ─────────────────────────────────────────────────────────── 結果
console.log(lines.join('\n'));
console.log(`\n${'='.repeat(56)}`);
console.log(`  通過 ${pass} / ${pass + fail}${fail > 0 ? `　失敗 ${fail}` : '　（全部通過）'}`);
console.log(`${'='.repeat(56)}`);
process.exit(fail > 0 ? 1 : 0);
