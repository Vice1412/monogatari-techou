/**
 * 階段 5 探勘：步驟 4 下半（攻擊與技能庫／咒語與自訂能力）實際長什麼樣。
 *
 * 這不是關卡，是量測。跑完看 log 再據此寫 stage5.mjs 的斷言。
 * 理由：這兩個子分頁的內容隨「職業」而變（士兵可能沒有咒語書），
 * 先盲寫斷言會大量誤報，浪費一輪。
 */
import { launch } from './cdp.mjs';
import {
  openWorkshop, newNpc, gotoStep, snap, note, report, armDialog, dumpErrors,
} from './lib.mjs';

const api = await launch();
armDialog(api, { accept: true });

const clickEl = async (finderJs, waitMs = 400) => {
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
);

const accordions = () => api.eval(`(() => [...document.querySelectorAll('button')]
  .filter((b) => b.querySelector('h2'))
  .map((b) => {
    const t = b.querySelector('h2').innerText.trim();
    const full = b.innerText.replace(/\\s+/g, ' ').trim();
    return { title: t, badge: full.slice(full.indexOf(t) + t.length).trim(), expanded: /border-b/.test(b.className) };
  }))()`);

const expandAll = async () => {
  for (const a of await accordions()) {
    if (a.expanded) continue;
    await clickEl(`[...document.querySelectorAll('button')].find((b) => b.querySelector('h2') && b.querySelector('h2').innerText.trim() === ${JSON.stringify(a.title)})`);
  }
};

const cards = () => api.eval(`(() => [...document.querySelectorAll('[id^="skill-card-"]')].map((el) => {
  const card = el.firstElementChild || el;
  const cs = getComputedStyle(card);
  return {
    id: el.id,
    text: (card.innerText || '').replace(/\\s+/g, ' ').slice(0, 64),
    border: cs.borderColor,
    opacity: cs.opacity,
    filter: cs.filter,
    h: Math.round(card.getBoundingClientRect().height),
  };
}))()`);

const searchInputs = () => api.eval(`(() => [...document.querySelectorAll('input[type="text"]')]
  .map((i) => i.placeholder)
  .filter(Boolean))()`);

await openWorkshop(api, { stage: 5 });
await newNpc(api, { stage: 5 });
await gotoStep(api, 4);

note('子分頁', JSON.stringify(await subTabs()));

await clickSubTab('攻擊與技能庫');
note('skills 子分頁（未展開）', JSON.stringify(await accordions()));
await snap(api, 5, 'P1-skills-collapsed');
await expandAll();
note('skills 子分頁（展開後）', JSON.stringify(await accordions()));
note('skills 的搜尋框', JSON.stringify(await searchInputs()));
const skillCards = await cards();
note('skills 卡片數', skillCards.length);
note('skills 前 8 張', JSON.stringify(skillCards.slice(0, 8)));
await snap(api, 5, 'P2-skills-expanded');

await clickSubTab('咒語與自訂能力');
note('spells 子分頁（未展開）', JSON.stringify(await accordions()));
await expandAll();
note('spells 子分頁（展開後）', JSON.stringify(await accordions()));
note('spells 的搜尋框', JSON.stringify(await searchInputs()));
const spellCards = await cards();
note('spells 卡片數', spellCards.length);
note('spells 前 8 張', JSON.stringify(spellCards.slice(0, 8)));
note('spells 頁面文字片段', (await api.eval('document.body.innerText')).replace(/\s+/g, ' ').slice(0, 600));
await snap(api, 5, 'P3-spells-expanded');

dumpErrors(api);
report('階段 5 探勘');
await api.close();
