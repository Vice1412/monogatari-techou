/**
 * 階段 5：步驟 4 下半——「攻擊與技能庫」與「咒語與自訂能力」兩個子分頁。
 *
 * 新手 GM 的問題意識：這一頁把「已自動配好的東西」（基礎攻擊）、
 * 「要花額度的東西」（客製化規則）、「完全自由的東西」（自訂技能）、
 * 「要選了前置技能才會出現的東西」（咒語書）混在一起，
 * 而且每一區都是一個預設收起的摺疊面板。
 *
 * 所以測的重點：
 *   1. 額度制的區塊在額度為 0 時會不會整個消失（消失 = 新手不知道它存在）。
 *   2. 選中／取消的視覺回饋是否足夠，額度用滿時其他卡片是否明確灰掉。
 *   3. 摺疊面板的展開／收起是否可逆。
 *   4. 空狀態與「已配置」徽章是否互相矛盾。
 */
import { launch } from './cdp.mjs';
import {
  openWorkshop, newNpc, gotoStep, snap, section, check, note, report, dumpErrors, armDialog,
  setValue,
} from './lib.mjs';

const STAGE = 5;
const api = await launch();
armDialog(api, { accept: true });

const AMBER = 'rgb(217, 119, 6)';
const BEIGE = 'rgb(214, 199, 171)';

const clickEl = async (finderJs, waitMs = 450) => {
  const found = await api.eval(`(() => {
    const el = ${finderJs};
    if (!el) return { ok: false, reason: '找不到元素' };
    el.scrollIntoView({ block: 'center' });
    return { ok: true, text: (el.innerText || '').replace(/\\s+/g, ' ').slice(0, 48) };
  })()`);
  if (!found || !found.ok) return found || { ok: false };
  await new Promise((r) => setTimeout(r, 250));
  const xy = await api.eval(`(() => {
    const el = ${finderJs};
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!xy) return { ok: false, reason: '座標取得失敗' };
  await api.clickAt(xy.x, xy.y);
  await new Promise((r) => setTimeout(r, waitMs));
  return { ok: true, text: found.text, xy };
};

const subTabs = () => api.eval(`(() => [...document.querySelectorAll('button')]
  .filter((b) => /基礎數值與相性|攻擊與技能庫|咒語與自訂能力/.test(b.innerText))
  .map((b) => b.innerText.replace(/\\s+/g, ' ').trim()))()`);

const clickSubTab = (name) => clickEl(
  `[...document.querySelectorAll('button')].find((b) => b.innerText.replace(/\\s+/g, ' ').includes(${JSON.stringify(name)}))`,
  600,
);

/** 摺疊面板：標題、徽章、是否展開。 */
const accordions = () => api.eval(`(() => [...document.querySelectorAll('button')]
  .filter((b) => b.querySelector('h2'))
  .map((b) => {
    const t = b.querySelector('h2').innerText.trim();
    const full = b.innerText.replace(/\\s+/g, ' ').trim();
    return { title: t, badge: full.slice(full.indexOf(t) + t.length).trim(), expanded: /border-b/.test(b.className) };
  }))()`);

const accordionButton = (title) => `[...document.querySelectorAll('button')].find((b) => b.querySelector('h2') && b.querySelector('h2').innerText.trim() === ${JSON.stringify(title)})`;

const expandAccordion = async (title) => {
  const acc = (await accordions()).find((a) => a.title === title);
  if (!acc) return { ok: false, reason: '面板不存在' };
  if (acc.expanded) return { ok: true, already: true };
  return clickEl(accordionButton(title));
};

const collapseAccordion = async (title) => {
  const acc = (await accordions()).find((a) => a.title === title);
  if (!acc) return { ok: false, reason: '面板不存在' };
  if (!acc.expanded) return { ok: true, already: true };
  return clickEl(accordionButton(title));
};

/** 技能卡（SkillCard 與 EditableSkill 都掛 `skill-card-<id>`）。 */
const skillCards = () => api.eval(`(() => [...document.querySelectorAll('[id^="skill-card-"]')].map((el) => {
  const card = el.firstElementChild || el;
  const cs = getComputedStyle(card);
  const r = card.getBoundingClientRect();
  return {
    id: el.id.replace('skill-card-', ''),
    text: (card.innerText || '').replace(/\\s+/g, ' ').slice(0, 44),
    border: cs.borderColor,
    opacity: cs.opacity,
    filter: cs.filter,
    x: Math.round(r.left + r.width / 2),
    y: Math.round(r.top + r.height / 2),
  };
}))()`);

/**
 * 用「卡片文字前綴」定位並點擊。
 * 不能用 id：`SkillCard` 選中後 targetId 會從 `brute_cust_0` 換成執行期產生的技能 id，
 * DOM id 跟著變，舊 id 就再也找不到（2026-10-21 實測）。
 */
const clickCardByText = async (textPrefix) => {
  const finder = `[...document.querySelectorAll('[id^="skill-card-"]')].find((e) => {
    const card = e.firstElementChild || e;
    return (card.innerText || '').replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(textPrefix)});
  })`;
  const ok = await api.eval(`(() => { const el = ${finder}; if (!el) return false; el.scrollIntoView({ block: 'center' }); return true; })()`);
  if (!ok) return { ok: false, reason: '找不到卡片' };
  await new Promise((r) => setTimeout(r, 250));
  const xy = await api.eval(`(() => {
    const el = ${finder};
    if (!el) return null;
    const card = el.firstElementChild || el;
    const r = card.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + 24) };
  })()`);
  if (!xy) return { ok: false, reason: '座標取得失敗' };
  await api.clickAt(xy.x, xy.y);
  await new Promise((r) => setTimeout(r, 500));
  // 滑鼠停在卡片上會觸發 `hover:border-amber-600`，讓「未選中」讀成琥珀色。
  // 讀邊框前必須把真實游標移開（階段 5 實測：取消選中後仍讀到 rgb(217,119,6)）。
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  await new Promise((r) => setTimeout(r, 150));
  return { ok: true };
};

/** 等到某張卡的邊框變成指定顏色（React 換 id／重繪有延遲，直接讀會讀到前一幀）。 */
const waitCardBorder = async (textPrefix, expected, tries = 10) => {
  let last = null;
  for (let i = 0; i < tries; i += 1) {
    last = (await skillCards()).find((c) => c.text.startsWith(textPrefix));
    if (last && last.border === expected) return last;
    await new Promise((r) => setTimeout(r, 200));
  }
  return last;
};

const badgeOf = async (title) => {
  const acc = (await accordions()).find((a) => a.title === title);
  return acc ? acc.badge : null;
};

// ─────────────────────────────────────────────────────────────
await openWorkshop(api, { stage: STAGE });
await newNpc(api, { stage: STAGE });
await gotoStep(api, 4);

section('A. 三個子分頁與各區塊的存在性（士兵 Lv.5）');
const tabs = await subTabs();
check('三個子分頁都在', tabs.length === 3, JSON.stringify(tabs));
const stepText = await api.eval('document.body.innerText');
check('預設停在「基礎數值與相性」', stepText.includes('屬性相性配置'));

await clickSubTab('攻擊與技能庫');
const accSkills = await accordions();
note('skills 子分頁的面板', JSON.stringify(accSkills));
const hasBasic = accSkills.some((a) => a.title === '基礎攻擊與核心能力');
const hasCustom = accSkills.some((a) => a.title === '客製化規則');
const hasRole = accSkills.some((a) => a.title === '定位技能');
check('有「基礎攻擊與核心能力」', hasBasic);
check('有「客製化規則」', hasCustom);
const roleHint = await api.eval(`document.body.innerText.includes('「定位技能」的額度由職業與等級決定')`);
check(
  '「定位技能」額度為 0 時，畫面上有說明它為什麼不見了',
  hasRole || roleHint === true,
  hasRole ? '面板直接顯示' : (roleHint ? '面板隱藏，但有說明文字' : '面板消失且沒有任何說明（GM-05-01）'),
);
await snap(api, STAGE, 'A1-skills-collapsed');

section('B. 摺疊面板的展開／收起');
const beforeExpand = (await accordions()).find((a) => a.title === '客製化規則');
check('面板預設是收起的', beforeExpand && beforeExpand.expanded === false);
const bodyBefore = await api.eval(`document.body.innerText.includes('壞脾氣')`);
check('收起時看不到裡面的卡片', bodyBefore === false);
await expandAccordion('客製化規則');
const afterExpand = (await accordions()).find((a) => a.title === '客製化規則');
check('點標題可以展開', afterExpand && afterExpand.expanded === true);
await collapseAccordion('客製化規則');
const afterCollapse = (await accordions()).find((a) => a.title === '客製化規則');
check('再點一次可以收起', afterCollapse && afterCollapse.expanded === false);
await expandAccordion('客製化規則');
await expandAccordion('基礎攻擊與核心能力');
await snap(api, STAGE, 'A2-skills-expanded');

section('C. 客製化規則的額度互動');
const badge0 = await badgeOf('客製化規則');
check('額度徽章顯示 0 / 1', /0\s*\/\s*1/.test(badge0 || ''), `實際：${badge0}`);
check('額度沒用完時標「待配置」', /待配置/.test(badge0 || ''), `實際：${badge0}`);

const cards0 = await skillCards();
const custCards = cards0.filter((c) => c.id.startsWith('brute_cust_'));
note('客製化規則卡片', JSON.stringify(custCards.map((c) => ({ id: c.id, text: c.text.slice(0, 18), border: c.border }))));
check('客製化規則列出 6 張卡', custCards.length === 6, `實際 ${custCards.length} 張`);

const first = custCards[0];
const firstKey = first.text.slice(0, 6);
check('卡片未選中時是米色邊框', first.border === BEIGE, `實際 ${first.border}`);
await clickCardByText(firstKey);
const afterPick = await waitCardBorder(firstKey, AMBER);
check('點卡片後變成琥珀色邊框（選中）', afterPick && afterPick.border === AMBER, `實際 ${afterPick && afterPick.border}`);
const badge1 = await badgeOf('客製化規則');
check('選一張後額度變 1 / 1', /1\s*\/\s*1/.test(badge1 || ''), `實際：${badge1}`);
check('額度用滿後標「已完成」', /已完成/.test(badge1 || ''), `實際：${badge1}`);

const rest = (await skillCards()).filter((c) => c.id.startsWith('brute_cust_') && !c.text.startsWith(firstKey));
const greyed = rest.filter((c) => Number(c.opacity) < 0.9 || /grayscale/.test(c.filter));
check('額度用滿後其餘卡片明確變灰', greyed.length === rest.length, `${greyed.length} / ${rest.length} 張變灰`);
await snap(api, STAGE, 'C1-budget-full');

await clickCardByText(firstKey);
const afterUnpick = await waitCardBorder(firstKey, BEIGE);
check('再點同一張可以取消選中', afterUnpick && afterUnpick.border === BEIGE, `實際 ${afterUnpick && afterUnpick.border}`);
const badgeBack = await badgeOf('客製化規則');
check('取消後額度回到 0 / 1', /0\s*\/\s*1/.test(badgeBack || ''), `實際：${badgeBack}`);
const rest2 = (await skillCards()).filter((c) => c.id.startsWith('brute_cust_') && !c.text.startsWith(firstKey));
const greyed2 = rest2.filter((c) => Number(c.opacity) < 0.9 || /grayscale/.test(c.filter));
check('取消後其他卡片恢復可點', greyed2.length === 0, `仍有 ${greyed2.length} 張灰著`);

section('D. 基礎攻擊卡的可編輯欄位');
const basicIds = (await skillCards()).filter((c) => /^b\d_/.test(c.id)).map((c) => c.id);
check('基礎攻擊有 2 張（普通攻擊／強力攻擊）', basicIds.length === 2, `實際 ${basicIds.length} 張`);
const selectInfo = await api.eval(`(() => ${JSON.stringify(basicIds)}.map((id) => {
  const el = document.getElementById('skill-card-' + id);
  const card = el && (el.firstElementChild || el);
  if (!card) return null;
  return [...card.querySelectorAll('select')].map((s) => ({
    label: (s.closest('label') || {}).innerText || '',
    first: s.options[0] ? s.options[0].textContent : '',
    count: s.options.length,
  }));
}))()`);
note('基礎攻擊的下拉', JSON.stringify(selectInfo));
const flatSelects = (selectInfo || []).flat().filter(Boolean);
check('基礎攻擊卡有下拉欄位', flatSelects.length >= 2, `實際 ${flatSelects.length} 個`);
const hasRange = flatSelects.some((s) => /距離/.test(s.label));
const hasDamage = flatSelects.some((s) => /屬性/.test(s.label));
check('下拉包含「距離」', hasRange);
check('下拉包含「屬性」（九種傷害類型）', hasDamage && flatSelects.some((s) => s.count >= 9));

section('E. 完全自訂技能（空狀態與新增）');
await clickSubTab('咒語與自訂能力');
const accSpells = await accordions();
note('spells 子分頁的面板', JSON.stringify(accSpells));
const hasSelfMade = accSpells.some((a) => a.title === '完全自訂技能');
check('有「完全自訂技能」', hasSelfMade);
const hasSpellbook = accSpells.some((a) => a.title === '咒語書配置');
note('士兵 Lv.5 是否出現「咒語書配置」', hasSpellbook ? '有' : '沒有（此職業此刻沒有咒語書技能，屬預期）');
const selfBadge = await badgeOf('完全自訂技能');
check(
  '「完全自訂技能」在 0 個自訂能力時標「選用區塊」而非「已配置」',
  /選用區塊/.test(selfBadge || ''),
  `實際徽章：${selfBadge}（0 個能力卻標已完成，新手會以為這區已經做完了）（GM-05-02）`,
);

const emptyBefore = await api.eval(`document.body.innerText.includes('目前尚無自訂能力')`);
check('空狀態顯示「目前尚無自訂能力」', emptyBefore === true);
await clickEl(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '加入能力清單')`);
const emptyAfterBlank = await api.eval(`document.body.innerText.includes('目前尚無自訂能力')`);
check('名稱留空時不會新增（仍顯示空狀態）', emptyAfterBlank === true);
await snap(api, STAGE, 'E1-selfmade-empty');

await setValue(api, 'input[placeholder="能力名稱"]', '測試用能力');
await setValue(api, 'textarea[placeholder="輸入效果與敘述..."]', '這是階段 5 自動填入的測試描述。');
await new Promise((r) => setTimeout(r, 300));
await clickEl(`[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '加入能力清單')`);
const addedText = await api.eval('document.body.innerText');
check('填好名稱與描述後可以新增', addedText.includes('測試用能力'));
check('新增後空狀態消失', !addedText.includes('目前尚無自訂能力'));
const inPreview = await api.eval(`(() => {
  const t = document.body.innerText;
  const i = t.indexOf('即時預覽');
  return i >= 0 && t.slice(i).includes('測試用能力');
})()`);
check('新增的自訂能力出現在右側即時預覽', inPreview === true);
const selfBadgeAfter = await badgeOf('完全自訂技能');
check('新增 1 項後徽章變「已加入 1 項」', /已加入 1 項/.test(selfBadgeAfter || ''), `實際：${selfBadgeAfter}`);
await snap(api, STAGE, 'E2-selfmade-added');

section('F. 跨子分頁的一致性');
await clickSubTab('基礎數值與相性');
await new Promise((r) => setTimeout(r, 400));
await clickSubTab('攻擊與技能庫');
const accBack = await accordions();
const customStill = accBack.find((a) => a.title === '客製化規則');
note('切回後客製化規則面板', JSON.stringify(customStill));
check('切走再切回，面板與資料都還在', !!customStill);

section('G. 換成有咒語書的職業（法師）');
await gotoStep(api, 1);
const roleCandidates = await api.eval(`(() => {
  const seen = new Set();
  return [...document.querySelectorAll('button, div[class*="cursor-pointer"], [role="button"]')]
    .map((b) => ({ tag: b.tagName, text: (b.innerText || '').replace(/\\s+/g, ' ').trim() }))
    .filter((x) => x.text && x.text.length < 32 && /法師|獵人|士兵|破壞者|衛士|修補匠|野蠻人|盜賊/.test(x.text))
    .filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true)));
})()`);
note('角色卡候選', JSON.stringify(roleCandidates));
const mageHit = await clickEl(`[...document.querySelectorAll('button, div[class*="cursor-pointer"], [role="button"]')].find((b) => {
  const t = (b.innerText || '').replace(/\\s+/g, ' ').trim();
  return t.length < 32 && t.includes('法師');
})`, 700);
note('點法師卡', JSON.stringify(mageHit));
if (mageHit && mageHit.ok) {
  await gotoStep(api, 4);
  await clickSubTab('咒語與自訂能力');
  const accMage = await accordions();
  note('法師的 spells 面板', JSON.stringify(accMage));
  const spellbook = accMage.find((a) => a.title === '咒語書配置');
  check('法師出現「咒語書配置」', !!spellbook, JSON.stringify(accMage.map((a) => a.title)));
  if (spellbook) {
    check('咒語書額度徽章有 x / N', /\d+\s*\/\s*\d+/.test(spellbook.badge || ''), `實際：${spellbook.badge}`);
    await expandAccordion('咒語書配置');
    await snap(api, STAGE, 'G1-mage-spellbook');
    const spellState = await api.eval(`(() => {
      const t = document.body.innerText;
      const m = t.match(/已選咒語\\s*\\((\\d+)\\s*\\/\\s*(\\d+)\\)/);
      return m ? { curr: Number(m[1]), cap: Number(m[2]) } : null;
    })()`);
    note('已選咒語計數', JSON.stringify(spellState));
    check('「已選咒語」有 x / N 計數', !!spellState);
  }
}

dumpErrors(api);
report('階段 5：步驟 4 下半（技能與咒語）');
await api.close();
