/**
 * 把四份稽核結果（`scratch/flows/*.json`）合併成執行期資料模組
 * `src/features/character-sheet/data/effectFlows.json`。
 *
 * 為什麼要有這支腳本、而不是手寫那份 JSON：
 * 373 筆 ÷ 四類，手寫必然漂移（少一筆、id 打錯、`control` 缺欄位都不會有人發現）。
 * 這支腳本把「合併」與「驗證」放在同一個地方，而且**驗證失敗就整批不寫檔**——
 * 半份資料比沒有資料更糟（同 P35 的 `p35_apply.mjs` 教訓：替換腳本沒有斷言「真的改到了」）。
 *
 * 驗證（任何一項不過就 exit 1，不寫檔）：
 *   ① 筆數與 `skill-effect-inventory.mjs` 的盤點逐筆相等（id 集合完全相同）
 *   ② `flow` / `control.kind` / `effects[].target` 全在封閉詞彙內
 *   ③ `control.kind === 'counter'` 必須有 `max` 與 `reset`
 *   ④ `control.kind === 'button'` 必須有 `label` 與 `outcome`
 *   ⑤ `narrative` 必須有 `note`（說明為什麼算不出來）
 *
 * 用法：`npm run build:flows`
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildInventory } from './skill-effect-inventory.mjs';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'scratch', 'flows');
const OUT = path.join(ROOT, 'src', 'features', 'character-sheet', 'data', 'effectFlows.json');

const FLOW_KINDS = ['modifier', 'state', 'action', 'grant', 'narrative'];
const CONTROL_KINDS = ['none', 'counter', 'toggle', 'button', 'select'];
const TARGETS = [
  'hpMax', 'mpMax', 'ipMax', 'def', 'mdef', 'initiative', 'check', 'damage', 'damageTaken',
  'resistance', 'vulnerability', 'immunity', 'statusApplied', 'mpCost', 'ipCost', 'zenit',
  'exp', 'fp', 'inventorySlots', 'actionEconomy', 'range', 'other'
];

/**
 * 稽核結果裡的 `status` 只是**快照**；執行期改記「靠什麼接的」（`apply.via`）。
 *
 * 為什麼不再存 status：台賬會腐化（本專案被發現過四次）。`via` 是**可驗證的機制名**，
 * 而每個機制名都對應一段真的程式：改壞它，測試會紅。
 *
 * 第一期接線後的分派規則：
 *   · `narrative` → `none`（本來就不該有效果）
 *   · 稽核標 `wired` → `existing`（舊有客製實作，附證據行號）
 *   · 有控件（counter／toggle／button）→ `flow-control`：跑團卡上真的按得到，
 *     計數器寫 `character.flowState`、按鈕走 `flowActionPlan`（扣成本＋寫履歷）
 *   · 沒有控件但有數值效果 → `flow-listed`：列在「效果加成（依條件）」，
 *     附條件原文（算不進數字，但玩家看得到「什麼時候 +多少」）
 *   · 其餘 → `untracked`（真的還沒接）
 */
/**
 * 稽核時「只有文字」、但其實已經由**舊有模組**接上的條目（逐筆列名，不是通則）。
 *
 * 為什麼不用通則：`flow === 'grant'` 且沒有控件的條目有 54 筆，它們大多是
 * 「授予一個實體」而實體自己就有面板（咒語／夥伴／僕從／牌組／食譜）。
 * 但**儀式學派權限**沒有面板——它只是 `spellGrants` 裡的一張來源表。
 * 用通則會把「沒有面板的授予」一概當成已接，那等於把缺口藏起來。
 */
const INTEGRATED_BY_MODULE = {
  'class:嵌合師:嵌合學派儀式': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/spellGrants.js:208（RITUAL_SKILL_SOURCES 第 2 筆）']
  }
};

const deriveApply = (row) => {
  if (row.flow === 'narrative') return { via: 'none' };
  const integrated = INTEGRATED_BY_MODULE[row.id];
  if (integrated) return integrated;
  if (row.status === 'wired') {
    return {
      via: 'existing',
      evidence: (row.evidence || []).map((e) => e.at).filter(Boolean).slice(0, 3)
    };
  }
  const kind = row.control?.kind || 'none';
  if (kind === 'counter' || kind === 'toggle' || kind === 'button' || kind === 'select') {
    return { via: 'flow-control' };
  }
  if (Array.isArray(row.effects) && row.effects.length > 0) {
    return { via: 'flow-listed' };
  }
  return { via: 'untracked' };
};

const errors = [];

const load = (cat) => {
  const p = path.join(SRC_DIR, `${cat}.json`);
  if (!fs.existsSync(p)) {
    errors.push(`缺少分類檔 ${p}`);
    return [];
  }
  const rows = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(rows)) {
    errors.push(`${cat}.json 不是陣列`);
    return [];
  }
  return rows;
};

const rows = [
  ...load('class'),
  ...load('heroic'),
  ...load('quirk'),
  ...load('camp')
];

const inventory = buildInventory();
const inventoryIds = new Set(inventory.map((i) => i.id));
const seen = new Set();

const items = [];
for (const row of rows) {
  const where = `${row.id || '(無 id)'}`;

  if (!row.id || !inventoryIds.has(row.id)) {
    errors.push(`id 不在盤點清單內：${where}`);
    continue;
  }
  if (seen.has(row.id)) errors.push(`重複 id：${where}`);
  seen.add(row.id);

  if (!FLOW_KINDS.includes(row.flow)) errors.push(`${where}：flow 不合法 (${row.flow})`);
  const controlKind = row.control?.kind || 'none';
  if (!CONTROL_KINDS.includes(controlKind)) {
    errors.push(`${where}：control.kind 不合法 (${controlKind})`);
  }
  if (controlKind === 'counter' && (!row.control?.max || !row.control?.reset)) {
    errors.push(`${where}：counter 缺 max 或 reset`);
  }
  // `select`（第三期）：「選一個」的條目。沒有 `options` 就等於畫一個空白下拉，
  // 玩家選不到任何東西——那比不畫更糟（看起來像壞掉）。
  if (controlKind === 'select' && (!row.control?.label || !(row.control?.options || []).length)) {
    errors.push(`${where}：select 缺 label 或 options`);
  }
  if (controlKind === 'button' && (!row.control?.label || !row.control?.outcome)) {
    errors.push(`${where}：button 缺 label 或 outcome`);
  }
  if (row.flow === 'narrative' && !row.note) {
    errors.push(`${where}：narrative 必須寫理由`);
  }

  // 第二期：結構化條件（`when`）。兩種寫法都要吃：
  //   · 條目級 `when`   —— 整條效果共用同一個條件（多數情況）
  //   · 效果級 `fx.when` —— 同一條目裡不同效果條件不同時用（例如「未裝備武器 +2 物防」＋
  //                        「30 級後徒手 +10」，兩者不是同一個條件）
  // 只收條目級會讓效果級靜默失效（資料寫了、程式沒讀），反之亦然。
  const itemWhen = Array.isArray(row.when) && row.when.length ? row.when.map((c) => ({ ...c })) : null;
  const effects = (row.effects || []).map((fx) => {
    if (!TARGETS.includes(fx.target)) errors.push(`${where}：target 不合法 (${fx.target})`);
    const fxWhen = Array.isArray(fx.when) && fx.when.length ? fx.when.map((c) => ({ ...c })) : null;
    return {
      target: fx.target,
      perSL: Number(fx.perSL) || 0,
      flat: Number(fx.flat) || 0,
      scope: fx.scope || 'permanent',
      condition: fx.condition || '',
      ...(fx.note ? { note: fx.note } : {}),
      ...(fxWhen ? { when: fxWhen } : {})
    };
  });

  const inv = inventory.find((i) => i.id === row.id);

  items.push({
    id: row.id,
    category: row.category || inv?.category || '',
    className: inv?.className || '',
    name: row.name || inv?.name || '',
    flow: row.flow,
    ...(inv?.maxSL != null ? { maxSL: inv.maxSL } : {}),
    ...(inv?.bucket ? { bucket: inv.bucket } : {}),
    control: controlKind === 'none'
      ? { kind: 'none' }
      : {
        kind: controlKind,
        label: row.control?.label || '',
        ...(row.control?.max ? { max: row.control.max } : {}),
        ...(row.control?.reset ? { reset: row.control.reset } : {}),
        ...(row.control?.initial != null ? { initial: row.control.initial } : {}),
        ...(row.control?.step != null ? { step: row.control.step } : {}),
        ...(row.control?.cost && Object.keys(row.control.cost).length ? { cost: row.control.cost } : {}),
        ...(row.control?.outcome ? { outcome: row.control.outcome } : {}),
        // `select` 的選項：值與顯示名（值必須是資料層認得的字串——類別要用
        // 裝備表的 `category` 值，例如「鬥毆」而不是技能原文「格鬥」）。
        ...(Array.isArray(row.control?.options) && row.control.options.length
          ? {
            options: row.control.options.map((o) => ({
              value: String(o.value),
              label: String(o.label || o.value)
            }))
          }
          : {})
      },
    effects,
    ...(itemWhen ? { when: itemWhen } : {}),
    apply: deriveApply(row),
    ...(row.note ? { note: row.note } : {}),
    evidence: (row.evidence || []).slice(0, 4)
  });
}

for (const id of inventoryIds) {
  if (!seen.has(id)) errors.push(`盤點有、分類沒有：${id}`);
}

if (errors.length) {
  console.error(`✗ 驗證失敗（${errors.length} 條），**不寫檔**：`);
  errors.slice(0, 40).forEach((e) => console.error('  - ' + e));
  if (errors.length > 40) console.error(`  …其餘 ${errors.length - 40} 條`);
  process.exit(1);
}

items.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const payload = {
  _note: '由 npm run build:flows 產生（來源：scratch/flows/*.json ＋ scripts/skill-effect-inventory.mjs）。不要手改。',
  _schema: 1,
  count: items.length,
  items
};

fs.writeFileSync(OUT, JSON.stringify(payload, null, 1), 'utf8');

const byFlow = items.reduce((acc, it) => { acc[it.flow] = (acc[it.flow] || 0) + 1; return acc; }, {});
const byApply = items.reduce((acc, it) => { acc[it.apply.via] = (acc[it.apply.via] || 0) + 1; return acc; }, {});
console.log(`✓ 寫出 ${items.length} 筆 → ${path.relative(ROOT, OUT)}`);
console.log('  flow ', byFlow);
console.log('  apply', byApply);
