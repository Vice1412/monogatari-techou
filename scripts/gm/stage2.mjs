/**
 * 階段 2：步驟 1–2（定位與等級）。
 *
 * 新手 GM 的第二段路：挑一個定位、決定等級與階級，然後看「即時體質監控」的數字對不對得上。
 *
 * 判準見 `docs/npc-workshop-gm-test.md` §1。
 * 執行：`$env:GM_BASE='http://localhost:3001'; node scripts/gm/stage2.mjs`
 */
import { launch } from './cdp.mjs';
import {
  BASE, section, check, note, report, snap, openWorkshop, newNpc,
  gotoStep, dumpErrors, STEP_ANCHORS,
} from './lib.mjs';

const api = await launch();

/** 從 body 文字取「標籤 → 下一個非空行」的數值。 */
const readStats = async () => {
  const lines = (await api.text()).split('\n').map((s) => s.trim()).filter(Boolean);
  const get = (label) => {
    const i = lines.indexOf(label);
    return i >= 0 ? lines[i + 1] : null;
  };
  return {
    DEX: get('DEX'), INS: get('INS'), MIG: get('MIG'), WLP: get('WLP'),
    HP: get('HP'), MP: get('MP'), Init: get('先攻'), Def: get('物防'), MDef: get('魔防'),
  };
};

/** 目前的定位名稱：取輪播中被放大那張卡的標題。 */
const currentRole = () => api.eval(`(() => {
  const cards = [...document.querySelectorAll('div[style*="rotateY"]')];
  const active = cards.find((c) => c.style.opacity === '1' || c.style.opacity === '');
  if (!active) return null;
  const t = active.innerText.split('\\n').map((s) => s.trim()).filter(Boolean);
  return { title: t[0] || null, lines: t.slice(0, 4) };
})()`);

const clickArrow = (side) => api.eval(`(() => {
  const b = [...document.querySelectorAll('button')]
    .find((x) => x.className.includes('absolute ${side}-4') && x.className.includes('rounded-full'));
  if (!b) return { ok: false };
  b.click();
  return { ok: true };
})()`);

const setLevel = (lv) => api.eval(`(() => {
  const sel = [...document.querySelectorAll('select')]
    .find((s) => [...s.options].some((o) => /^Lv\\.\\s*\\d+$/.test(o.textContent.trim())));
  if (!sel) return { ok: false, reason: 'no level select' };
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(sel, ${JSON.stringify(String(lv))});
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, now: sel.value, options: [...sel.options].map((o) => o.textContent.trim()) };
})()`);

const clickMultiplier = (n) => api.eval(`(() => {
  const b = [...document.querySelectorAll('button')]
    .find((x) => x.innerText.trim() === ${JSON.stringify(String(n))} && x.className.includes('h-12'));
  if (!b) return { ok: false };
  b.click();
  return { ok: true };
})()`);

const milestoneCount = () => api.eval(`(() => {
  const h = [...document.querySelectorAll('h4')].find((x) => x.innerText.includes('天賦里程碑'));
  if (!h) return 0;
  const box = h.parentElement;
  return [...box.querySelectorAll('span')].filter((s) => /^Lv\\.\\s*\\d+$/.test(s.innerText.trim())).length;
})()`);

try {
  await api.goto(BASE, { timeout: 30000 });
  await api.eval('localStorage.clear()');
  await api.goto(BASE, { timeout: 30000 });
  await openWorkshop(api, { stage: 2 });
  await newNpc(api, { stage: 2 });

  section('A. 步驟 1：定位輪播');
  const r0 = await currentRole();
  note('初始定位卡內容', JSON.stringify(r0));
  check('步驟 1 有環狀捲軸', Boolean(r0?.title), JSON.stringify(r0));
  check('初始定位是「暴徒」', r0?.title?.startsWith('暴徒'), `實得「${r0?.title}」`);
  check('畫面說明提到可以滑動', (await api.text()).includes('環狀捲軸已開啟'));
  await snap(api, 2, 'A-step1-initial');

  section('B. 左右箭頭換定位');
  await clickArrow('right');
  await new Promise((r) => setTimeout(r, 700));
  const r1 = await currentRole();
  check('按右箭頭會換定位', r1?.title !== r0?.title, `暴徒 → ${r1?.title}`);
  note('右箭頭後的定位', r1?.title);
  await clickArrow('left');
  await new Promise((r) => setTimeout(r, 700));
  const r2 = await currentRole();
  check('按左箭頭會回到「暴徒」', r2?.title?.startsWith('暴徒'), `實得「${r2?.title}」`);

  section('C. 點旁邊的卡片換定位');
  const neighbour = await api.eval(`(() => {
    const cards = [...document.querySelectorAll('div[style*="rotateY"]')]
      .filter((c) => c.style.opacity !== '1');
    const c = cards[0];
    if (!c) return { ok: false };
    const r = c.getBoundingClientRect();
    return { ok: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
             title: c.innerText.split('\\n').map((s) => s.trim()).filter(Boolean)[0] };
  })()`);
  if (neighbour?.ok) {
    await api.clickAt(neighbour.x, neighbour.y);
    await new Promise((r) => setTimeout(r, 700));
  }
  const r3 = await currentRole();
  check('點非當前卡片會切過去', r3?.title !== '暴徒', `點了「${neighbour?.title}」，現在是「${r3?.title}」`);  await snap(api, 2, 'B-role-changed');

  section('D. 拖曳換定位（新手最可能的操作方式）');
  const beforeDrag = (await currentRole())?.title;
  const box = await api.eval(`(() => {
    const el = [...document.querySelectorAll('div')].find((d) => d.className.includes('h-[500px]'));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2) };
  })()`);
  if (box) await api.drag(box.cx + 160, box.cy, box.cx - 160, box.cy);
  await new Promise((r) => setTimeout(r, 700));
  const afterDrag = (await currentRole())?.title;
  check('拖曳會換定位', Boolean(afterDrag) && afterDrag !== beforeDrag, `${beforeDrag} → ${afterDrag}`);

  section('E. 定位說明看得懂嗎');
  const roleInfo = await currentRole();
  note('定位卡上顯示的文字', JSON.stringify(roleInfo?.lines));
  check('定位卡有名稱以外的說明', (roleInfo?.lines?.length || 0) >= 2, JSON.stringify(roleInfo?.lines));
  await snap(api, 2, 'C-role-info');

  section('F. 步驟 2：初始數值');
  await gotoStep(api, 2);
  const s5 = await readStats();
  note('Lv.5 初始數值', JSON.stringify(s5));
  check('即時體質監控有 HP/MP/先攻/物防/魔防', Boolean(s5.HP && s5.MP && s5.Init && s5.Def && s5.MDef), JSON.stringify(s5));
  check('即時體質監控有 DEX/INS/MIG/WLP', Boolean(s5.DEX && s5.INS && s5.MIG && s5.WLP), JSON.stringify(s5));
  await snap(api, 2, 'D-step2-initial');

  section('G. 改等級：數字會不會跟著動');
  const lvl = await setLevel(10);
  await new Promise((r) => setTimeout(r, 500));
  const s10 = await readStats();
  note('等級選項', JSON.stringify(lvl?.options));
  check('等級只有 7 個固定選項（5/10/20/30/40/50/60）', lvl?.options?.length === 7, JSON.stringify(lvl?.options));
  check('Lv.10 的 HP 與 Lv.5 不同', s10.HP !== s5.HP, `${s5.HP} → ${s10.HP}`);
  note('Lv.10 數值', JSON.stringify(s10));

  await setLevel(60);
  await new Promise((r) => setTimeout(r, 500));
  const s60 = await readStats();
  note('Lv.60 數值', JSON.stringify(s60));
  const m60 = await milestoneCount();
  note('Lv.60 的天賦里程碑條數', m60);
  check('Lv.60 的 HP 高於 Lv.10', Number(s60.HP) > Number(s10.HP), `${s10.HP} → ${s60.HP}`);
  check('Lv.60 有解鎖天賦里程碑', m60 > 0, `實得 ${m60} 條`);
  await snap(api, 2, 'E-lv60');

  section('H. 降級再升級：天賦會不會消失就回不來');
  await setLevel(5);
  await new Promise((r) => setTimeout(r, 500));
  const m5 = await milestoneCount();
  const s5b = await readStats();
  check('降回 Lv.5 後數值回到原值', s5b.HP === s5.HP, `${s5.HP} vs ${s5b.HP}`);
  note('Lv.5 的天賦里程碑條數', m5);
  await setLevel(60);
  await new Promise((r) => setTimeout(r, 500));
  const m60b = await milestoneCount();
  const s60b = await readStats();
  check('升回 Lv.60 後里程碑條數恢復', m60b === m60, `第一次 ${m60} 條，降級再升級後 ${m60b} 條`);
  check('升回 Lv.60 後數值恢復', s60b.HP === s60.HP, `${s60.HP} vs ${s60b.HP}`);
  await snap(api, 2, 'F-level-roundtrip');

  section('I. 階級：士兵 → 精英 → 冠位');
  await api.clickText('士兵', { exact: true });
  await new Promise((r) => setTimeout(r, 400));
  const sSoldier = await readStats();
  await api.clickText('精英', { exact: true });
  await new Promise((r) => setTimeout(r, 500));
  const sElite = await readStats();
  note('精英 HP 倍率', `${sSoldier.HP} → ${sElite.HP}`);
  check('精英 HP 翻倍', Number(sElite.HP) === Number(sSoldier.HP) * 2, `${sSoldier.HP} → ${sElite.HP}`);
  check('精英先攻 +2', Number(sElite.Init) === Number(sSoldier.Init) + 2, `${sSoldier.Init} → ${sElite.Init}`);

  await api.clickText('冠位', { exact: true });
  await new Promise((r) => setTimeout(r, 600));
  const t2 = await api.text();
  check('切到冠位後出現倍率選擇器', t2.includes('冠位等級') && t2.includes('當前可額外配置'));
  const sChamp1 = await readStats();
  note('冠位 x1 數值', JSON.stringify(sChamp1));
  check('冠位 x1 的 MP 為精英時的兩倍', Number(sChamp1.MP) === Number(sElite.MP) * 2, `${sElite.MP} → ${sChamp1.MP}`);
  await snap(api, 2, 'G-champion');

  section('J. 冠位倍率 1 → 3 → 6');
  await clickMultiplier(3);
  await new Promise((r) => setTimeout(r, 500));
  const sChamp3 = await readStats();
  check('倍率 3 的 HP 是倍率 1 的三倍', Number(sChamp3.HP) === Number(sChamp1.HP) * 3, `${sChamp1.HP} → ${sChamp3.HP}`);
  check('倍率 3 的顯示同步（HP x3）', (await api.text()).includes('HP x3'));
  await clickMultiplier(6);
  await new Promise((r) => setTimeout(r, 500));
  const sChamp6 = await readStats();
  check('倍率 6 的 HP 是倍率 1 的六倍', Number(sChamp6.HP) === Number(sChamp1.HP) * 6, `${sChamp1.HP} → ${sChamp6.HP}`);
  note('冠位 x6 數值', JSON.stringify(sChamp6));
  await snap(api, 2, 'H-champion-x6');

  section('K. 切回士兵：倍率有沒有歸零');
  await api.clickText('士兵', { exact: true });
  await new Promise((r) => setTimeout(r, 500));
  const backSoldier = await readStats();
  check('切回士兵後 HP 回到未加成', Number(backSoldier.HP) === Number(sSoldier.HP), `${sChamp6.HP} → ${backSoldier.HP}`);
  await api.clickText('冠位', { exact: true });
  await new Promise((r) => setTimeout(r, 500));
  const champAgain = await readStats();
  check('再切回冠位時倍率已重置為 1', Number(champAgain.HP) === Number(sChamp1.HP), `實得 HP ${champAgain.HP}（x1 應為 ${sChamp1.HP}）`);
  note('切換後是否記得上次的倍率', Number(champAgain.HP) === Number(sChamp1.HP) ? '不記得（重置為 1）' : '有記住');

  section('L. 鍵盤 Alt + 左右切步');
  const stepNow = (await api.text()).includes(STEP_ANCHORS[1]);
  const pressAltArrow = async (dir) => {
    const key = dir === 'left' ? 'ArrowLeft' : 'ArrowRight';
    const vk = dir === 'left' ? 37 : 39;
    await api.send('Input.dispatchKeyEvent', {
      type: 'keyDown', key, code: key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: 1,
    });
    await api.send('Input.dispatchKeyEvent', {
      type: 'keyUp', key, code: key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: 1,
    });
    await new Promise((r) => setTimeout(r, 600));
  };
  check('按鈕上有寫出 Alt 快捷鍵', (await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('上一步'));
    return b ? (b.getAttribute('title') || '') : '';
  })()`)).includes('Alt'));
  await pressAltArrow('left');
  const tAfterLeft = await api.text();
  check('在步驟 2 按 Alt + ← 會回到步驟 1', stepNow && tAfterLeft.includes(STEP_ANCHORS[0]), '（按了 Alt + ← 之後沒回到步驟 1）');
  await pressAltArrow('right');
  check('按 Alt + → 會回到步驟 2', (await api.text()).includes(STEP_ANCHORS[1]));
  await snap(api, 2, 'I-keyboard-nav');

  section('M. console 錯誤總覽');
  check('整段流程無 console 錯誤', api.errors.length === 0, dumpErrors(api));
} catch (e) {
  check('階段 2 整體流程', false, e.message);
  await snap(api, 2, 'fatal');
  console.log(dumpErrors(api));
} finally {
  await api.close();
}

process.exit(report('階段 2：定位與等級'));
