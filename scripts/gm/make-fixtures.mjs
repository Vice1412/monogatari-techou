/**
 * 產生 GM 實測用的存檔夾具（可重跑即重建）。
 *
 * 為什麼不用 `npcEngine.createNewNPC()` 產生：
 * 它與 `NPCWorkshop.jsx` 內手寫的 `createNewNPC` **不是同一份**
 * （引擎版 name「新創魔獸 / NPC」、有 faction／tags、預設物種 `sp_beast`；
 * 元件版 name「未知實體」、無 faction／tags、`selectedSpeciesId: null`）。
 * 夾具若照引擎版產生，測到的就不是玩家新建出來的那張卡。
 * 所以這裡只寫「元件版一定有的欄位」，其餘交給 `migrateNpcState` 補
 * ——正好順便驗證遷移層。
 *
 * 執行：`node scripts/gm/make-fixtures.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = path.resolve('scratch/gm-test/fixtures');
fs.mkdirSync(dir, { recursive: true });

const npc = (over) => ({
  id: 'npc_fixture',
  name: '測試 NPC',
  traits: '',
  story: '',
  tactics: '',
  role: '暴徒',
  level: 5,
  rank: '士兵',
  championMultiplier: 1,
  partyLevel: 5,
  villainTier: 'none',
  avatarBase64: null,
  avatarScale: 1,
  avatarFit: 'cover',
  avatarOffsetX: 0,
  avatarOffsetY: 0,
  skills: [],
  selectedSpeciesId: null,
  speciesConfig: { selectedBenefits: [] },
  overrideEnabled: false,
  overrides: { hp: 0, mp: 0, init: 0, def: 0, mdef: 0 },
  customDice: {},
  isFreeModeEnabled: false,
  ...over,
});

const a = npc({
  id: 'npc_fixture_a',
  name: '測試暴徒',
  traits: '兇猛、耐打',
  role: '暴徒',
  level: 10,
  rank: '精英',
  partyLevel: 10,
  selectedSpeciesId: 'sp_beast',
});

const b = npc({
  id: 'npc_fixture_b',
  name: '測試法師',
  traits: '狡詐',
  role: '法師',
  level: 20,
  rank: '冠位',
  championMultiplier: 2,
  partyLevel: 20,
  selectedSpeciesId: 'sp_demon',
});

const write = (name, data) => {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 2), 'utf8');
  console.log(`寫出 ${name}`);
};

write('npc-a.json', a);
write('npc-b.json', b);
write('library-backup.json', [a, b]);
