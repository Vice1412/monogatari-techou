/**
 * 階段 10 探測之八：殘缺卡修好了嗎。
 *
 * 修的是 `migrateNpcState` 的形狀保證（陣列補 `[]`、物件補 `{}`、認不得的職業退回「暴徒」），
 * 以及檔案庫載入時濾掉非物件條目。
 */
import { launch } from './cdp.mjs';
import { BASE, openWorkshop, section, note, report, dumpErrors, armDialog } from './lib.mjs';

const STAGE = 'stage10-probe';
const api = await launch();
armDialog(api, { accept: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasBoundary = () => api.eval(`document.body.innerText.includes('遭遇了阻礙')`);
const names = () => api.eval(`[...document.querySelectorAll('h3')].map((e) => e.innerText.trim())`);

const clickText = async (text, waitMs = 900) => {
  const ok = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!b) return false; b.click(); return true;
  })()`);
  await sleep(waitMs);
  return ok;
};

const seed = async (cards) => {
  await api.goto(BASE, { timeout: 30000 });
  await api.eval(`(() => {
    Object.keys(localStorage).filter((k) => /npc|fabula|fu_/i.test(k)).forEach((k) => localStorage.removeItem(k));
    localStorage.setItem('monogatari_techou_npc_library', ${JSON.stringify(JSON.stringify(cards))});
    return true;
  })()`);
  await api.goto(BASE, { timeout: 30000 });
  await sleep(900);
  await openWorkshop(api, { stage: STAGE });
};

// ── A 只有名字的卡 ────────────────────────────────────────
section('A 只有名字的卡');
await seed([{ id: 'bare_1', name: '只有名字' }]);
note('A：檔案庫', JSON.stringify(await names()));
note('A：載入後有 ErrorBoundary 嗎', String(await hasBoundary()));
await clickText('編輯', 1200);
note('A：按「編輯」後有 ErrorBoundary 嗎', String(await hasBoundary()));
note('A：編輯頁首 160 字', JSON.stringify((await api.eval(`document.body.innerText`)).slice(0, 160).replace(/\n+/g, ' | ')));
note('A：名稱欄位', JSON.stringify(await api.eval(`(() => { const i = document.querySelector('input[placeholder="輸入名稱..."]'); return i ? i.value : null; })()`)));
note('A：補完後的欄位型別', JSON.stringify(await api.eval(`(() => {
  const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]');
  const c = a[0] || {};
  const t = (v) => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
  return { skills: t(c.skills), linkedNpcs: t(c.linkedNpcs), speciesConfig: t(c.speciesConfig), role: c.role, level: c.level, rank: c.rank, name: c.name };
})()`)));

// ── B 壞型別的卡 ──────────────────────────────────────────
section('B 壞型別的卡');
await seed([{
  id: 'bad_1', name: '壞型別', role: '不存在的職業', level: 'abc', rank: null,
  skills: null, speciesConfig: null, affinities: null, linkedNpcs: null,
  selectedNegativeSkills: null, selectedBossSkills: null, customRules: null,
  attributes: null, story: null, tactics: null, traits: null, overrides: null,
}]);
note('B：檔案庫', JSON.stringify(await names()));
await clickText('編輯', 1200);
note('B：按「編輯」後有 ErrorBoundary 嗎', String(await hasBoundary()));
note('B：補完後', JSON.stringify(await api.eval(`(() => {
  const a = JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]');
  const c = a[0] || {};
  const t = (v) => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
  return { skills: t(c.skills), story: t(c.story), tactics: t(c.tactics), traits: t(c.traits), role: c.role, level: c.level, rank: c.rank, overrides: JSON.stringify(c.overrides) };
})()`)));

// ── C 陣列裡混進垃圾 ──────────────────────────────────────
section('C 陣列裡混進 null 與字串');
await seed([null, '這不是卡', 42, { id: 'ok_1', name: '正常的卡' }]);
note('C：有 ErrorBoundary 嗎', String(await hasBoundary()));
note('C：檔案庫', JSON.stringify(await names()));
note('C：陣列長度（應為 1）', String(await api.eval(`JSON.parse(localStorage.getItem('monogatari_techou_npc_library') || '[]').length`)));

// ── D 整份存檔不是陣列 ────────────────────────────────────
section('D 整份存檔是物件而不是陣列');
await api.goto(BASE, { timeout: 30000 });
await api.eval(`(() => { localStorage.setItem('monogatari_techou_npc_library', '{"oops":true}'); return true; })()`);
await api.goto(BASE, { timeout: 30000 });
await sleep(900);
await openWorkshop(api, { stage: STAGE });
note('D：有 ErrorBoundary 嗎', String(await hasBoundary()));
note('D：檔案庫（應為空狀態）', JSON.stringify(await names()));

// ── E 整份存檔是壞 JSON ───────────────────────────────────
section('E 整份存檔是壞 JSON');
await api.goto(BASE, { timeout: 30000 });
await api.eval(`(() => { localStorage.setItem('monogatari_techou_npc_library', '{{{ broken'); return true; })()`);
await api.goto(BASE, { timeout: 30000 });
await sleep(900);
await openWorkshop(api, { stage: STAGE });
note('E：有 ErrorBoundary 嗎', String(await hasBoundary()));
note('E：檔案庫（應為空狀態）', JSON.stringify(await names()));
note('E：壞資料有沒有被覆寫成合法值', JSON.stringify(await api.eval(`localStorage.getItem('monogatari_techou_npc_library')`)));

dumpErrors(api);
report('階段 10 探測之八');
await api.close();
