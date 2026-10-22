/**
 * 階段 6 探勘（一次性，不是關卡）：先量步驟 5–6 的實際結構，再寫斷言。
 *
 * 為什麼要探勘：步驟 5 的內容完全由「階級是不是冠位」決定——
 * 非冠位只看到一顆大鎖頭，冠位才看到 40 個 Boss 技能分成數個子類別。
 * 而且額度 `maxAllowedBossSkills = 1 + availableRoleSkillsBudget`，
 * 士兵 Lv.5 的職業額度是 0，等於**只能選一個**——「選三個會警告」那條規則根本踩不到。
 */
import { launch } from './cdp.mjs';
import { openWorkshop, newNpc, gotoStep, snap, note, section, armDialog, report } from './lib.mjs';

const api = await launch();
armDialog(api, { accept: true });
await openWorkshop(api, { stage: 6 });
await newNpc(api, { stage: 6 });
await gotoStep(api, 5);

const clickBtnText = async (text) => {
  const xy = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)});
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!xy) return { ok: false };
  await api.clickAt(xy.x, xy.y);
  await new Promise((r) => setTimeout(r, 800));
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  return { ok: true, xy };
};

section('P1. 非冠位畫面');
const txtLocked = await api.text();
note('步驟 5 開頭文字', txtLocked.slice(0, 800).replace(/\n+/g, ' | '));
const multBtns = await api.eval(`(() => [...document.querySelectorAll('button')]
  .map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim())
  .filter((t) => /^\\d 倍率$/.test(t)))()`);
note('倍率按鈕', JSON.stringify(multBtns));
await snap(api, 6, 'P1-locked');

section('P2. 點倍率 3 覺醒');
const awake = await clickBtnText('3 倍率');
note('點擊結果', JSON.stringify(awake));
const txtChamp = await api.text();
note('冠位後文字（前 1000 字）', txtChamp.slice(0, 1000).replace(/\n+/g, ' | '));

const tabs = await api.eval(`(() => [...document.querySelectorAll('button')]
  .filter((b) => /flex-shrink-0/.test(b.className) && /rounded-lg/.test(b.className))
  .map((b) => (b.innerText || '').replace(/\\s+/g, ' ').trim()))()`);
note('分類 tabs', JSON.stringify(tabs));

const bossCards = () => api.eval(`(() => [...document.querySelectorAll('[id^="boss-skill-"]')].map((el) => {
  const card = el.firstElementChild || el;
  const cs = getComputedStyle(card);
  const r = card.getBoundingClientRect();
  return {
    id: el.id.replace('boss-skill-', ''),
    text: (card.innerText || '').replace(/\\s+/g, ' ').slice(0, 42),
    border: cs.borderColor,
    opacity: cs.opacity,
    filter: cs.filter,
    x: Math.round(r.left + r.width / 2),
    y: Math.round(r.top + 24),
  };
}))()`);

const cards = await bossCards();
note('第一個 tab 的卡片數', String(cards.length));
note('第一張卡', JSON.stringify(cards[0]));
note('卡片文字樣本', JSON.stringify(cards.slice(0, 6).map((c) => c.text.slice(0, 24))));
await snap(api, 6, 'P2-champ');

section('P3. 選一個 Boss 技能');
const first = cards[0];
if (first) {
  await api.clickAt(first.x, first.y);
  await new Promise((r) => setTimeout(r, 700));
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  await new Promise((r) => setTimeout(r, 200));
}
const afterPick = await bossCards();
note('選後第一張卡', JSON.stringify(afterPick[0]));
const disabled = afterPick.filter((c) => Number(c.opacity) < 0.9 || /grayscale/.test(c.filter));
note('選後變灰的卡片數', `${disabled.length} / ${afterPick.length}`);
const navBar = await api.eval(`document.body.innerText.includes('技能導航')`);
note('出現「技能導航」列', String(navBar));
const txtAfter = await api.text();
note('選後文字尾巴', txtAfter.slice(-600).replace(/\n+/g, ' | '));
await snap(api, 6, 'P3-one-picked');

section('P4. 再點第二張（額度已滿？）');
const second = afterPick.find((c) => c.id !== first?.id && Number(c.opacity) >= 0.9);
note('可點的第二張', second ? second.text.slice(0, 24) : '沒有（全部變灰）');
if (second) {
  await api.clickAt(second.x, second.y);
  await new Promise((r) => setTimeout(r, 700));
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  const after2 = await bossCards();
  note('選第二張後，已選數', String(after2.filter((c) => c.border === 'rgb(217, 119, 6)').length));
  const txt2 = await api.text();
  note('是否有「過多的 Boss 技能」', String(txt2.includes('過多的 Boss 技能')));
  note('是否有「技能列表重複」', String(txt2.includes('技能列表重複')));
}

section('P5. 步驟 6：負面技能');
await gotoStep(api, 6);
const txt6 = await api.text();
note('步驟 6 文字', txt6.slice(0, 900).replace(/\n+/g, ' | '));
const negCards = await api.eval(`(() => [...document.querySelectorAll('[id^="skill-card-"]')].map((el) => {
  const card = el.firstElementChild || el;
  const cs = getComputedStyle(card);
  const r = card.getBoundingClientRect();
  return {
    id: el.id.replace('skill-card-', ''),
    text: (card.innerText || '').replace(/\\s+/g, ' ').slice(0, 46),
    border: cs.borderColor,
    opacity: cs.opacity,
    x: Math.round(r.left + r.width / 2),
    y: Math.round(r.top + 24),
  };
}))()`);
note('負面技能卡片數', String(negCards.length));
note('負面技能卡片', JSON.stringify(negCards.map((c) => ({ id: c.id, text: c.text.slice(0, 30), opacity: c.opacity }))));
await snap(api, 6, 'P5-negative');

if (negCards[0]) {
  await api.clickAt(negCards[0].x, negCards[0].y);
  await new Promise((r) => setTimeout(r, 700));
  await api.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 4, y: 4, button: 'none' });
  const afterNeg = await api.eval(`(() => [...document.querySelectorAll('[id^="skill-card-"]')].map((el) => {
    const card = el.firstElementChild || el;
    const cs = getComputedStyle(card);
    return { id: el.id.replace('skill-card-', ''), border: cs.borderColor, opacity: cs.opacity };
  }))()`);
  note('選一個負面技能後', JSON.stringify(afterNeg.slice(0, 8)));
  const txtNeg = await api.text();
  note('選後是否有提示', String(txtNeg.slice(-500).replace(/\n+/g, ' | ')));
  await snap(api, 6, 'P6-negative-picked');
}

report('階段 6 探勘（步驟 5–6 結構）');
await api.close();
