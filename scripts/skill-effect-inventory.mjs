/**
 * 技能效果盤點（Skill Effect Inventory）
 *
 * 目的：把「四類規則物件」攤平成同一種列，供覆蓋稽核與護欄使用：
 *   ① 職業技能（29 職 × 5）② 英雄技能（核心 115 ＋ 公測 43 ＋ 變體）
 *   ③ 金手指（46，含每個選項）④ 營地活動（15）
 *
 * 為什麼要一支腳本而不是人工清單：
 * 本專案過去四次「還有幾條沒修」的答案都是靠人手數的，而人手數的結果與現況不符。
 * 這裡只負責**列舉**（不判斷）；判斷寫在 `src/features/character-sheet/data/effectFlows.js`。
 *
 * ⚠️ 兩個踩過的坑（都寫在這裡，因為下一個改這支腳本的人一定會踩）：
 *   1. **資料模組一律靜態 import**。用 `import(url)` 動態載入時 esbuild 不會 bundle，
 *      執行期才去讀 `.json`，Node 直接丟 `ERR_IMPORT_ATTRIBUTE_MISSING`。
 *   2. **CLI 判定不能只看檔名**。bundle 後入口檔名變成 `skillEffectInventory.mjs`，
 *      用 `endswith('skill-effect-inventory.mjs')` 判斷會**成功但一個字都不印**。
 *
 * 用法：
 *   npm run audit:flows                 # 摘要
 *   npm run audit:flows -- --list        # 逐筆列出（id / 名稱 / 類別）
 *   npm run audit:flows -- --json out.json
 */
import fs from 'node:fs';
import path from 'node:path';
import rulesData from '../src/features/character-sheet/data/rulesData.json';
import { PLAYTEST_HEROIC_SKILLS } from '../src/features/character-sheet/data/playtestHeroicSkills.js';
import { VARIANT_ARCANIST_HEROIC_SKILLS } from '../src/features/character-sheet/data/variantArcanistHeroicSkills.js';
import { SUBOPTION_SKILLS_CONFIG, getSkillSuboptionConfig } from '../src/features/character-sheet/data/skillSuboptionsData.js';
import { CAMP_ACTIVITIES } from '../src/features/character-sheet/data/campActivities.js';

const stripMd = (s) => String(s || '').replace(/\*\*/g, '').trim();

/** 職業技能：29 職 × 5 條。 */
const collectClassSkills = () => {
  const out = [];
  for (const [className, def] of Object.entries(rulesData.classes || {})) {
    for (const sk of def.skills || []) {
      out.push({
        id: `class:${className}:${sk.name}`,
        category: 'class',
        className,
        name: sk.name,
        maxSL: sk.maxSL ?? null,
        source: def.source || '',
        text: stripMd(sk.desc),
        hasSuboptions: Boolean(getSkillSuboptionConfig(className, sk.name))
      });
    }
  }
  return out;
};

/** 英雄技能：核心（`rulesData.heroicSkills`）＋公測＋秘儀師變體。 */
const collectHeroicSkills = () => {
  const out = [];
  const push = (bucket, hs) => out.push({
    id: `heroic:${hs.name}`,
    category: 'heroic',
    bucket,
    name: hs.name,
    requirement: hs.requirement || '',
    maxAcquisitions: hs.maxAcquisitions ?? null,
    source: hs.source || bucket,
    text: stripMd(hs.effect || hs.desc)
  });

  (rulesData.heroicSkills || []).forEach((hs) => push('core', hs));
  (PLAYTEST_HEROIC_SKILLS || []).forEach((hs) => push('playtest', hs));
  (VARIANT_ARCANIST_HEROIC_SKILLS || []).forEach((hs) => push('variant', hs));
  return out;
};

/** 金手指：46 個本體；選項各自有 `effects`。 */
const collectQuirks = () => (rulesData.quirks || []).map((q) => ({
  id: `quirk:${q.name}`,
  category: 'quirk',
  name: q.name,
  text: stripMd(q.desc),
  flavor: stripMd(q.flavor),
  hasEffects: Boolean(q.effects && Object.keys(q.effects).length),
  optionCount: (q.options || []).length
    + (q.optionGroups || []).reduce((n, g) => n + (g.options || []).length, 0)
}));

/** 營地活動：15 條（每條有 6 個結果）。 */
const collectCampActivities = () => (CAMP_ACTIVITIES || []).map((a) => ({
  id: `camp:${a.id}`,
  category: 'camp',
  name: a.name,
  target: a.target || '',
  text: stripMd(a.desc),
  resultCount: (a.results || []).length
}));

export function buildInventory() {
  return [
    ...collectClassSkills(),
    ...collectHeroicSkills(),
    ...collectQuirks(),
    ...collectCampActivities()
  ];
}

export const SUBOPTION_CONFIG_KEYS = Object.keys(SUBOPTION_SKILLS_CONFIG || {});

/**
 * 名稱 → 它在 `src/` 出現過幾次（**不含**資料目錄與 `rulesData.json` 自己）。
 *
 * ⚠️ 這是**線索**，不是證據（手冊的教訓：文字命中 ≠ 功能存在，文字沒命中 ≠ 功能不存在）。
 * 它的用途只有一個：把 373 筆分成「有人寫過它的名字」與「一個字都沒有」兩堆，
 * 讓需要逐條讀的範圍從 373 縮到幾十。判定一律靠讀原始碼與實測。
 */
const collectNameRefs = (items) => {
  // ⚠️ 不要用 `import.meta.url` 推根目錄：bundle 之後它指向 `.test-build/`，
  // 推出來的根目錄會是專案的上一層，於是掃不到任何檔案而「每筆都 0 命中」——
  // 那看起來像「全部都沒接線」，是最容易被當成結論的假訊號。
  const root = process.cwd();
  const srcDir = path.join(root, 'src');
  const skip = [/[\\/]data[\\/]/, /\.json$/];
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jsx?|css)$/.test(entry.name) && !skip.some((re) => re.test(full))) files.push(full);
    }
  };
  if (fs.existsSync(srcDir)) walk(srcDir);

  const cache = files.map((f) => ({ file: path.relative(root, f).replace(/\\/g, '/'), text: fs.readFileSync(f, 'utf8') }));
  for (const it of items) {
    const hits = cache.filter((c) => c.text.includes(it.name));
    it.refFiles = hits.map((h) => h.file);
    it.refCount = hits.length;
  }
  return items;
};

// bundle 後入口檔名會變，所以兩種都認；不認字尾就會「成功但不印」。
const invokedDirectly = /skill-effect-inventory\.mjs$|skillEffectInventory\.mjs$/.test(process.argv[1] || '');

if (invokedDirectly) {
  const items = buildInventory();
  const byCat = items.reduce((acc, it) => {
    acc[it.category] = (acc[it.category] || 0) + 1;
    return acc;
  }, {});

  const jsonFlag = process.argv.indexOf('--json');
  if (jsonFlag > -1 && process.argv[jsonFlag + 1]) {
    collectNameRefs(items);
    const out = path.resolve(process.cwd(), process.argv[jsonFlag + 1]);
    fs.writeFileSync(out, JSON.stringify(items, null, 1), 'utf8');
    console.log(`wrote ${items.length} items -> ${out}`);
  } else if (process.argv.includes('--list')) {
    for (const it of items) console.log(`${it.id}\t${it.name}\t${it.category}`);
  } else if (process.argv.includes('--audit')) {
    collectNameRefs(items);
    const rows = items.map((it) => ({
      id: it.id,
      category: it.category,
      refs: it.refCount,
      where: it.refFiles.slice(0, 3).join(' ')
    }));
    const zero = rows.filter((r) => r.refs === 0);
    console.log('總筆數', items.length, '／名稱在 src/ 完全沒出現：', zero.length);
    const byCatZero = zero.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1;
      return acc;
    }, {});
    console.log('零命中分類：', byCatZero);
    const jsonOut = process.argv[process.argv.indexOf('--audit') + 1];
    if (jsonOut && !jsonOut.startsWith('--')) {
      const out = path.resolve(process.cwd(), jsonOut);
      fs.writeFileSync(out, JSON.stringify(rows, null, 1), 'utf8');
      console.log('wrote', out);
    } else {
      for (const r of zero) console.log(`0\t${r.category}\t${r.id}`);
    }
  } else {
    console.log('總筆數', items.length);
    console.table(byCat);
    console.log('有通用子選項介面的職業技能：', items.filter((i) => i.hasSuboptions).length);
    const dupIds = items.map((i) => i.id).filter((id, i, a) => a.indexOf(id) !== i);
    if (dupIds.length) console.log('重複 id:', [...new Set(dupIds)].join(', '));
    const byBucket = items.filter((i) => i.category === 'heroic').reduce((acc, it) => {
      acc[it.bucket] = (acc[it.bucket] || 0) + 1;
      return acc;
    }, {});
    console.log('英雄技能分批：', byBucket);
  }
}
