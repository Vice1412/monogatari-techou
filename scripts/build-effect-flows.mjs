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
const CONTROL_KINDS = ['none', 'counter', 'toggle', 'button', 'select', 'multiSelect', 'text', 'recordList'];

const RESOURCE_BACKED_IDS = Object.freeze({
  'quirk:富家子弟': 'fatigue',
  'quirk:實驗逃亡體': 'instability',
  'quirk:棄暗投明之人': 'subversion',
  'quirk:遺物使用者': 'anomaly',
  'quirk:固執的懷疑論者': 'doubt',
  'class:商人:貿易之風': 'tradePoints',
  'class:商人:真正的財富': 'tradePoints',
  'class:商人:我聽說過': 'tradePoints',
  'class:商人:小金庫': 'tradePoints',
  'heroic:怒潮拳': 'courage',
  'heroic:旋風攻勢': 'momentum',
  'heroic:藥水霧化': 'nebulization',
  'class:死靈術士:超越死界': 'gravePoints',
  'class:熵師:幸運七': 'luckyNumber'
});
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
  },
  'class:徽記師:徽記學': {
    via: 'existing',
    evidence: ['src/features/character-sheet/components/companions/SymbolistMarks.jsx']
  },
  'class:徽記師:咒語徽記': {
    via: 'existing',
    evidence: ['src/features/character-sheet/components/CharacterPlayHUD.jsx:4060']
  },
  'class:美食家:烹飪': {
    via: 'existing',
    evidence: ['src/features/character-sheet/components/companions/GourmetCookbook.jsx']
  },
  'class:美食家:加點愛': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/gourmetActions.js:applyDashOfLove']
  },
  'class:美食家:鹽與胡椒': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/gourmetActions.js:applySaltAndPepper']
  },
  'class:商人:過期食品': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/inventory.js:consumeInventoryItem']
  },
  'class:修補匠:藥水雨': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/inventory.js:consumeInventoryItem']
  },
  'class:旅人:有備無患': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/travelRoll.js:evalTravelRoll']
  },
  'class:旅人:寶藏獵人': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/travelRoll.js:evalTravelRoll']
  },
  'class:旅人:通曉道路': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/travelRoll.js:resolveTravelDie']
  },
  'class:美食家:準備食材': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/travelRoll.js:evalTravelRoll']
  },
  'class:靈師:支援魔法': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/pendingBuffs.js:applySupportMagic']
  },
  'class:吟唱者:我相信你': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/pendingBuffs.js:applyIBelieveInYou']
  },
  'class:吟唱者:能言善辯': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/pendingBuffs.js:applySmoothTalker']
  },
  'class:機師:壓縮技術': {
    via: 'existing',
    evidence: ['src/features/character-sheet/utils/pendingBuffs.js:applyCompressionTechnique']
  }
};

const deriveApply = (row) => {
  const rawControls = Array.isArray(row.controls) && row.controls.length
    ? row.controls
    : [row.control || { kind: 'none' }];
  const hasInteractive = rawControls.some((c) => c && c.kind !== 'none' && c.kind !== 'counter');

  if (RESOURCE_BACKED_IDS[row.id] && !hasInteractive) {
    return {
      via: 'existing',
      evidence: [`src/features/character-sheet/data/classResources.js（backedBy: ${RESOURCE_BACKED_IDS[row.id]}）`]
    };
  }
  if (row.flow === 'narrative') return { via: 'none' };
  const integrated = INTEGRATED_BY_MODULE[row.id];
  if (integrated && !hasInteractive) return integrated;
  if (row.status === 'wired') {
    return {
      via: 'existing',
      evidence: (row.evidence || []).map((e) => e.at).filter(Boolean).slice(0, 3)
    };
  }
  const hasAnyControl = rawControls.some((c) => c && c.kind !== 'none');
  if (hasAnyControl) {
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

  const rawControls = Array.isArray(row.controls) && row.controls.length > 0
    ? row.controls
    : [row.control || { kind: 'none' }];

  const backedBy = RESOURCE_BACKED_IDS[row.id] || null;

  for (let cIdx = 0; cIdx < rawControls.length; cIdx += 1) {
    const ctrl = rawControls[cIdx];
    const cKind = ctrl?.kind || 'none';
    const cWhere = rawControls.length > 1 ? `${where}[c${cIdx}]` : where;
    if (!CONTROL_KINDS.includes(cKind)) {
      errors.push(`${cWhere}：control.kind 不合法 (${cKind})`);
    }
    if (cKind === 'counter' && (!ctrl?.max || !ctrl?.reset) && !backedBy) {
      errors.push(`${cWhere}：counter 缺 max 或 reset`);
    }
    if (cKind === 'select' && (!ctrl?.label || !(ctrl?.options || []).length)) {
      errors.push(`${cWhere}：select 缺 label 或 options`);
    }
    if (cKind === 'button' && (!ctrl?.label || !ctrl?.outcome)) {
      errors.push(`${cWhere}：button 缺 label 或 outcome`);
    }
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

  const formatControl = (ctrl) => {
    const k = ctrl?.kind || 'none';
    if (backedBy && k === 'counter') {
      return { kind: 'none', backedBy };
    }
    if (k === 'none') return { kind: 'none', ...(backedBy ? { backedBy } : {}) };
    return {
      kind: k,
      label: ctrl?.label || '',
      ...(ctrl?.max ? { max: ctrl.max } : {}),
      ...(ctrl?.reset ? { reset: ctrl.reset } : {}),
      ...(ctrl?.initial != null ? { initial: ctrl.initial } : {}),
      ...(ctrl?.cost && Object.keys(ctrl.cost).length ? { cost: ctrl.cost } : {}),
      ...(ctrl?.gain && Object.keys(ctrl.gain).length ? { gain: ctrl.gain } : {}),
      // 擲骰式累積：`{ resource, dice, sign?, max?, onlyIfRollLte? }`。
      // 沒有這個欄位時，「+1d6 不穩定值」只是 label 上的一句願望（W5 驗收時抓到的）。
      ...(ctrl?.roll && typeof ctrl.roll === 'object' ? { roll: ctrl.roll } : {}),
      // 歸零某個資源（裁定 1A：「自私片刻」把差生點清零）。
      ...(Array.isArray(ctrl?.zero) && ctrl.zero.length ? { zero: ctrl.zero } : {}),
      // 同組互斥（裁定 3A：【穩固突變】的追獵／腕力／靈巧只能選一個）。
      ...(Array.isArray(ctrl?.groups) && ctrl.groups.length ? { groups: ctrl.groups } : {}),
      // 每次取得的上限（裁定 5A：【解剖學家】2 × 取得次數）。
      ...(Number.isFinite(ctrl?.maxPerTake) ? { maxPerTake: ctrl.maxPerTake } : {}),
      ...(ctrl?.outcome ? { outcome: ctrl.outcome } : {}),
      ...(Array.isArray(ctrl?.options) && ctrl.options.length
        ? {
          options: ctrl.options.map((o) => ({
            value: String(o.value),
            label: String(o.label || o.value)
          }))
        }
        : {}),
      ...(Array.isArray(ctrl?.fields) ? { fields: ctrl.fields } : {}),
      ...(ctrl?.min != null ? { min: ctrl.min } : {}),
      ...(ctrl?.multiline != null ? { multiline: ctrl.multiline } : {}),
      ...(ctrl?.maxLength != null ? { maxLength: ctrl.maxLength } : {})
    };
  };

  const formattedControls = rawControls.map(formatControl);
  const primaryControl = formattedControls[0] || { kind: 'none' };

  items.push({
    id: row.id,
    category: row.category || inv?.category || '',
    className: inv?.className || '',
    name: row.name || inv?.name || '',
    flow: row.flow,
    ...(inv?.maxSL != null ? { maxSL: inv.maxSL } : {}),
    ...(inv?.bucket ? { bucket: inv.bucket } : {}),
    control: primaryControl,
    controls: formattedControls,
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
