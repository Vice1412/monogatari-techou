/**
 * 階段 4：步驟 4 上半——「基礎數值與相性」子分頁。
 *
 * 新手 GM 的問題意識：這一頁同時混了四件不同性質的事——
 * 反派等級（世界觀階級）、屬性相性（有額度的預算制）、自由模式（開關規則）、
 * 自訂骰子（只在自由模式出現）。第一次打開的人分不出「哪些能動、為什麼不能動」。
 *
 * 所以測的重點不是「有沒有畫出來」，而是：
 *   不能動的地方，畫面有沒有告訴我為什麼不能動。
 *
 * 走法一律用真實滑鼠事件（`Input.dispatchMouseEvent`）。
 * 階段 3 的教訓：`el.click()` 對 `div` 上的 React onClick 會靜默失效，不可靠。
 */
import { launch } from './cdp.mjs';
import {
  BASE, openWorkshop, newNpc, gotoStep, snap, section, check, note, report, dumpErrors, armDialog,
} from './lib.mjs';

const STAGE = 4;
const api = await launch();
armDialog(api, { accept: true });

const DAMAGE_TYPES = ['物理', '風', '電', '暗', '土', '火', '冰', '光', '毒'];

/** 右側「即時預覽」的數值。 */
const readStats = () => api.eval(`(() => {
  const t = document.body.innerText;
  const i = t.indexOf('即時預覽');
  const seg = i >= 0 ? t.slice(i) : t;
  const g = (re) => { const m = seg.match(re); return m ? m[1].trim() : null; };
  return {
    DEX: g(/DEX\\s*\\n\\s*(d\\d+)/),
    INS: g(/INS\\s*\\n\\s*(d\\d+)/),
    MIG: g(/MIG\\s*\\n\\s*(d\\d+)/),
    WLP: g(/WLP\\s*\\n\\s*(d\\d+)/),
    HP: g(/HP\\s*\\n\\s*(\\d+)/),
    MP: g(/MP\\s*\\n\\s*(\\d+)/),
    Init: g(/先攻[^\\n]*\\n\\s*(\\d+)/),
    Def: g(/物防[^\\n]*\\n\\s*(\\d+)/),
    MDef: g(/魔防[^\\n]*\\n\\s*(\\d+)/),
    line: g(/(Lv \\d+ \\|[^\\n]*)/),
  };
})()`);

/** 相性面板的容器表達式（給 finder 用）。 */
const PANEL = `(() => {
  const h = [...document.querySelectorAll('h2')].find((x) => x.innerText.includes('屬性相性配置'));
  return h ? h.closest('div').parentElement : null;
})()`;

/**
 * 點一個元素。`finderJs` 是一段「回傳 Element 或 null」的 JS。
 * 分兩次 eval：先滾到定位，再重取座標——`scrollIntoView` 會移動版面，
 * 一次取完的座標會過期（階段 3 實測）。
 */
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

/** 四個相性分頁：標籤、計數、是否 disabled。 */
const affinityTabs = () => api.eval(`(() => {
  const panel = ${PANEL};
  if (!panel) return [];
  return [...panel.querySelectorAll('button')]
    .filter((b) => /弱點 VUL|抗性 RES|免疫 IMM|吸收 ABS/.test(b.innerText))
    .map((b) => {
      const txt = b.innerText.replace(/\\s+/g, ' ').trim();
      const m = txt.match(/(\\d+)\\s*\\/\\s*(\\d+|∞)/);
      return {
        text: txt,
        key: txt.split(' ')[0],
        curr: m ? Number(m[1]) : null,
        max: m ? (m[2] === '∞' ? '∞' : Number(m[2])) : null,
        disabled: b.disabled,
        opacity: getComputedStyle(b).opacity,
        grayscale: getComputedStyle(b).filter,
      };
    });
})()`);

/** 九個傷害類型卡。 */
const affinityCells = () => api.eval(`(() => {
  const panel = ${PANEL};
  if (!panel) return [];
  const grid = panel.querySelector('.grid.grid-cols-3');
  if (!grid) return [];
  return [...grid.children].map((b, i) => {
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    return {
      idx: i,
      type: ${JSON.stringify(DAMAGE_TYPES)}[i] || null,
      label: (b.innerText.split('\\n').pop() || '').trim(),
      disabled: b.disabled,
      borderStyle: cs.borderStyle,
      opacity: cs.opacity,
      hasLock: !!b.querySelector('svg'),
      title: b.getAttribute('title') || (b.querySelector('[title]') || {}).title || '',
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
    };
  });
})()`);

const clickType = (type) => {
  const i = DAMAGE_TYPES.indexOf(type);
  return clickEl(`(() => {
    const panel = ${PANEL};
    if (!panel) return null;
    const grid = panel.querySelector('.grid.grid-cols-3');
    return grid ? grid.children[${i}] || null : null;
  })()`);
};

const clickTab = (key) => clickEl(`(() => {
  const panel = ${PANEL};
  if (!panel) return null;
  return [...panel.querySelectorAll('button')].find((b) => b.innerText.replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(key)})) || null;
})()`);

/** 相性區整段的文字（找「為什麼不能動」的說明）。 */
const panelText = () => api.eval(`(() => {
  const panel = ${PANEL};
  return panel ? panel.innerText.replace(/\\s+/g, ' ').trim() : '';
})()`);

/** 反派等級的按鈕。 */
const villainTiers = () => api.eval(`(() => {
  const lab = [...document.querySelectorAll('label')].find((l) => l.innerText.includes('反派等級'));
  if (!lab) return [];
  const box = lab.closest('div');
  return [...box.querySelectorAll('button')].map((b, i) => {
    const r = b.getBoundingClientRect();
    return {
      idx: i,
      text: b.innerText.replace(/\\s+/g, ' ').trim(),
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
    };
  });
})()`);

const clickVillainTier = (i) => clickEl(`(() => {
  const lab = [...document.querySelectorAll('label')].find((l) => l.innerText.includes('反派等級'));
  if (!lab) return null;
  return lab.closest('div').querySelectorAll('button')[${i}] || null;
})()`);

/** 步驟 4 的三個子分頁。 */
const subTabs = () => api.eval(`(() => {
  return [...document.querySelectorAll('button')]
    .filter((b) => /基礎數值與相性|攻擊與技能庫|咒語與自訂能力|^數值$|^技能$|^咒語$/.test(b.innerText.trim()))
    .map((b) => ({ text: b.innerText.replace(/\\s+/g, ' ').trim(), cls: String(b.className).slice(0, 70) }));
})()`);

const clickSubTab = (name) => clickEl(`(() => {
  return [...document.querySelectorAll('button')]
    .find((b) => b.innerText.replace(/\\s+/g, ' ').includes(${JSON.stringify(name)})) || null;
})()`);

/** 自由模式開關（頂部工具列的「嚴謹模式／自由模式」）。 */
const freeModeState = () => api.eval(`(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /嚴謹模式|自由模式/.test(x.innerText));
  return b ? { text: b.innerText.replace(/\\s+/g, ' ').trim(), title: b.title } : null;
})()`);

const clickFreeMode = () => clickEl(`(() => {
  return [...document.querySelectorAll('button')].find((x) => /嚴謹模式|自由模式/.test(x.innerText)) || null;
})()`, 700);

/** 自訂骰子卡是否出現，以及四個屬性目前的骰子。 */
const customDiceState = () => api.eval(`(() => {
  const h = [...document.querySelectorAll('h4')].find((x) => x.innerText.includes('自定義 NPC 體質與基礎骰子'));
  if (!h) return null;
  const box = h.closest('div').parentElement.parentElement;
  const grid = box.querySelector('.grid');
  const cards = grid ? [...grid.children] : [];
  return {
    present: true,
    gridCount: cards.length,
    cards: cards.map((c) => ({
      text: c.innerText.replace(/\\s+/g, ' ').trim().slice(0, 80),
      buttons: [...c.querySelectorAll('button')].map((b) => b.innerText.trim()),
    })),
    hasReset: [...box.querySelectorAll('button')].some((b) => b.innerText.includes('重置')),
  };
})()`);

try {
  await api.goto(BASE, { timeout: 30000 });
  await api.eval('localStorage.clear()');
  await openWorkshop(api, { stage: STAGE });
  await newNpc(api, { stage: STAGE });
  await snap(api, STAGE, 'A0-new-npc');

  // ─────────────────────────────────────────────── A
  section('A. 從步驟 3 進到步驟 4');
  await gotoStep(api, STAGE);
  await snap(api, STAGE, 'A-step4');
  const txtA = await api.text();
  check('進到步驟 4 並看到標題', txtA.includes('步驟 4：調整數值與能力'));
  check('有說明文字', txtA.includes('系統會根據你的定位與等級自動為你計算可用額度'));
  const tabsA = await subTabs();
  note('三個子分頁', JSON.stringify(tabsA.map((t) => t.text)));
  check('三個子分頁都在', tabsA.length >= 3, JSON.stringify(tabsA.map((t) => t.text)));
  const statsA = await readStats();
  note('進入步驟 4 的預覽', JSON.stringify(statsA));

  // ─────────────────────────────────────────────── B
  section('B. 反派等級');
  const tiersB = await villainTiers();
  note('反派等級選項', JSON.stringify(tiersB.map((t) => t.text)));
  check('反派等級有 4 個選項', tiersB.length === 4, JSON.stringify(tiersB.map((t) => t.text)));
  check('每個選項都標了 UP 點數', tiersB.every((t) => /UP/.test(t.text)), JSON.stringify(tiersB.map((t) => t.text)));
  const txtB0 = await api.text();
  const hasUpNotice0 = /已賦予\s*\d+\s*點終極點數/.test(txtB0);
  note('預設狀態是否顯示終極點數提示', String(hasUpNotice0));
  if (tiersB.length >= 2) {
    await clickVillainTier(1);
    await snap(api, STAGE, 'B-tier-selected');
    const txtB1 = await api.text();
    const m1 = txtB1.match(/已賦予\s*(\d+)\s*點終極點數/);
    note('選了第二個階級後的提示', m1 ? m1[0] : '（沒有提示）');
    check('選了反派階級後會說明拿到幾點終極點數', !!m1, '選了階級但畫面上沒說這代表什麼');
    // 能不能取消回「無」
    await clickVillainTier(0);
    const txtB2 = await api.text();
    check('可以選回第一個（取消反派階級）', !/已賦予\s*\d+\s*點終極點數/.test(txtB2) || tiersB[0].text.includes('無'),
      `選回「${tiersB[0].text}」後仍顯示終極點數提示`);
  }

  // ─────────────────────────────────────────────── C
  section('C. 屬性相性的四個分頁與額度');
  const tabsC = await affinityTabs();
  note('四個分頁', JSON.stringify(tabsC));
  check('四個分頁都在（弱點／抗性／免疫／吸收）', tabsC.length === 4, JSON.stringify(tabsC.map((t) => t.text)));
  const disabledC = tabsC.filter((t) => t.disabled);
  note('被禁用的分頁', JSON.stringify(disabledC.map((t) => t.text)));
  const txtC = await panelText();
  const hasReasonC = /額度為 0|沒有額度|尚未解鎖|升級後|Lv\.\s*\d+\s*解鎖|職業沒有/.test(txtC);
  check('被禁用的分頁有說明「為什麼不能點」', disabledC.length === 0 || hasReasonC,
    `${disabledC.length} 個分頁是灰的（${disabledC.map((t) => t.text).join('、')}），但面板上沒有任何說明`);
  note('面板文字（前 400 字）', txtC.slice(0, 400));

  // ─────────────────────────────────────────────── D
  section('D. 相性的循環與額度上限');
  const cellsD0 = await affinityCells();
  note('九個傷害類型', JSON.stringify(cellsD0.map((c) => ({ t: c.type, l: c.label, d: c.disabled }))));
  check('九個傷害類型都在', cellsD0.length === 9, String(cellsD0.length));
  check('初始全部是「一般」', cellsD0.every((c) => c.label === '一般'),
    JSON.stringify(cellsD0.filter((c) => c.label !== '一般').map((c) => `${c.type}:${c.label}`)));

  // 找一個有額度的分頁
  const usableTab = tabsC.find((t) => !t.disabled && t.max !== 0);
  note('可用的分頁', usableTab ? usableTab.text : '（沒有）');
  if (usableTab) {
    await clickTab(usableTab.key);
    await new Promise((r) => setTimeout(r, 300));
    const target = cellsD0.find((c) => !c.disabled) || cellsD0[0];
    note('要點的第一個類型', target ? target.type : '（無）');
    if (target) {
      await clickType(target.type);
      await snap(api, STAGE, 'D-first-pick');
      const after1 = await affinityCells();
      const c1 = after1.find((c) => c.type === target.type);
      note(`${target.type} 點一次後`, JSON.stringify(c1 && c1.label));
      check('點一次會變成該分頁的狀態（弱點／抗性…）', c1 && c1.label !== '一般', String(c1 && c1.label));
      const tabsD1 = await affinityTabs();
      const usedTab1 = tabsD1.find((t) => t.key === usableTab.key);
      note('計數變化', JSON.stringify({ before: usableTab.curr, after: usedTab1 && usedTab1.curr }));
      check('分頁計數 +1', usedTab1 && usedTab1.curr === usableTab.curr + 1,
        JSON.stringify({ before: usableTab.curr, after: usedTab1 && usedTab1.curr }));

      // 再點一次應該退回「一般」
      await clickType(target.type);
      const after2 = await affinityCells();
      const c2 = after2.find((c) => c.type === target.type);
      check('同一張卡再點一次會退回「一般」', c2 && c2.label === '一般', String(c2 && c2.label));

      // 把額度用完，再點別的類型
      const max = Number(usableTab.max) || 0;
      for (let i = 0; i < max; i += 1) {
        const free = (await affinityCells()).find((c) => !c.disabled && c.label === '一般');
        if (!free) break;
        await clickType(free.type);
      }
      const tabsFull = await affinityTabs();
      const fullTab = tabsFull.find((t) => t.key === usableTab.key);
      note('額度用完後的分頁', JSON.stringify(fullTab));
      check('計數可以填到上限', fullTab && fullTab.curr === fullTab.max, JSON.stringify(fullTab));
      const cellsFull = await affinityCells();
      const stillNormal = cellsFull.filter((c) => c.label === '一般' && !c.disabled);
      note('額度用完後仍可按的「一般」卡', JSON.stringify(stillNormal.map((c) => c.type)));
      check('額度用完後，其他「一般」卡會一併變灰（不會讓人白點）', stillNormal.length === 0,
        JSON.stringify(stillNormal.map((c) => c.type)));
      // 額度滿時點一張灰卡：確認真的不動（灰卡是 disabled，點下去不會有事件）
      if (stillNormal.length === 0) {
        const anyNormal = cellsFull.find((c) => c.label === '一般');
        if (anyNormal) {
          await clickType(anyNormal.type);
          const afterOver = await affinityCells();
          const overCell = afterOver.find((c) => c.type === anyNormal.type);
          check('額度用完後點灰卡不會生效', overCell && overCell.label === '一般', String(overCell && overCell.label));
        }
      }
      const txtD = await panelText();
      note('額度用完後的面板文字', txtD.slice(0, 300));
    }
  }

  // ─────────────────────────────────────────────── E
  section('E. 物種鎖定：不死物種自帶的抗性');
  await gotoStep(api, 3);
  await clickEl(`(() => {
    return [...document.querySelectorAll('button')].find((b) => b.innerText.includes('不死物種')) || null;
  })()`, 700);
  const txtE3 = await api.text();
  note('步驟 3 選不死後', txtE3.includes('不死物種 UNDEAD') ? '已選' : '（沒選到）');
  await gotoStep(api, STAGE);
  await snap(api, STAGE, 'E-undead-locked');
  const cellsE = await affinityCells();
  note('不死物種下的九個類型', JSON.stringify(cellsE.map((c) => ({ t: c.type, l: c.label, d: c.disabled, b: c.borderStyle, lock: c.hasLock }))));
  const lockedE = cellsE.filter((c) => c.hasLock);
  note('被鎖定的類型', JSON.stringify(lockedE.map((c) => `${c.type}(${c.label})`)));
  check('不死物種鎖住了光／暗／毒', lockedE.length === 3 && ['光', '暗', '毒'].every((t) => lockedE.some((c) => c.type === t)),
    JSON.stringify(lockedE.map((c) => c.type)));
  check('鎖定的類型用虛線框標示', lockedE.length > 0 && lockedE.every((c) => c.borderStyle === 'dashed'),
    JSON.stringify(lockedE.map((c) => `${c.type}:${c.borderStyle}`)));
  const txtE = await panelText();
  const hasVisibleExplain = /物種|自帶|綁定/.test(txtE);
  check('鎖定的類型有「看得見」的說明（不是只有滑鼠移上去的 title）', hasVisibleExplain,
    '只有一個鎖頭圖示和 title="物種綁定"；觸控裝置上 title 根本看不到');
  const lockedTitles = lockedE.map((c) => c.title).filter(Boolean);
  note('鎖頭 title', JSON.stringify(lockedTitles));
  if (lockedE.length > 0) {
    const beforeLockClick = (await affinityCells()).find((c) => c.type === lockedE[0].type);
    await clickType(lockedE[0].type);
    const afterLockClick = (await affinityCells()).find((c) => c.type === lockedE[0].type);
    check('鎖定的類型點不動', afterLockClick && afterLockClick.label === beforeLockClick.label,
      `${beforeLockClick.label} → ${afterLockClick && afterLockClick.label}`);
  }

  // ─────────────────────────────────────────────── F
  section('F. 自由模式開關');
  const fm0 = await freeModeState();
  note('目前模式', JSON.stringify(fm0));
  check('頂部有規則模式切換', !!fm0, '找不到「嚴謹模式／自由模式」按鈕');
  if (fm0) {
    await clickFreeMode();
    await snap(api, STAGE, 'F-free-mode-dialog');
    const txtF1 = await api.text();
    const hasModal = txtF1.includes('FREE EDIT MODE') || txtF1.includes('確認開啟自定義');
    note('點下去後的畫面（前 300 字）', txtF1.slice(0, 300));
    check('點「嚴謹模式」會先跳確認（不是直接放寬）', hasModal, '沒有確認步驟就直接切成自由模式');
    if (hasModal) {
      note('確認 Modal 的警示文字', txtF1.slice(txtF1.indexOf('警示'), txtF1.indexOf('警示') + 260));
      const ok = await clickEl(`(() => {
        return [...document.querySelectorAll('button')].find((b) => b.innerText.includes('確認開啟自定義')) || null;
      })()`, 800);
      note('按下「確認開啟自定義」', JSON.stringify(ok));
    }
    const fm1 = await freeModeState();
    note('確認後的模式', JSON.stringify(fm1));
    check('確認後切換成自由模式', fm1 && fm1.text.includes('自由'), JSON.stringify(fm1));
    const diceF = await customDiceState();
    note('自訂骰子卡', JSON.stringify(diceF && { present: diceF.present, hasReset: diceF.hasReset, cards: diceF.cards.map((c) => c.text) }));
    check('自由模式後出現「自定義 NPC 體質與基礎骰子」', !!diceF && diceF.present, '開了自由模式但沒有出現骰子調整區');
    const tabsF = await affinityTabs();
    note('自由模式下的分頁', JSON.stringify(tabsF.map((t) => t.text)));
    check('自由模式下四個分頁都不再被禁用', tabsF.every((t) => !t.disabled),
      JSON.stringify(tabsF.filter((t) => t.disabled).map((t) => t.text)));
  }

  // ─────────────────────────────────────────────── G
  section('G. 自訂骰子（自由模式）');
  const diceG = await customDiceState();
  if (diceG && diceG.present) {
    check('四個屬性都有骰子選項', diceG.cards.length === 4, JSON.stringify(diceG.cards.map((c) => c.text)));
    check('每個屬性有 4 個骰子可選（d6/d8/d10/d12）',
      diceG.cards.every((c) => ['d6', 'd8', 'd10', 'd12'].every((d) => c.buttons.includes(d))),
      JSON.stringify(diceG.cards.map((c) => c.buttons)));
    check('還沒改過時不顯示「重置體質骰子」（避免空按鈕）', !diceG.hasReset,
      '一開自由模式就有重置鈕，但此時沒有任何東西可重置');
    const beforeG = await readStats();
    // 把 MIG 改成 d12（力量 → HP）
    const changed = await clickEl(`(() => {
      const h = [...document.querySelectorAll('h4')].find((x) => x.innerText.includes('自定義 NPC 體質與基礎骰子'));
      if (!h) return null;
      const box = h.closest('div').parentElement.parentElement;
      const card = [...box.querySelectorAll('div')].find((d) => d.innerText.trim().startsWith('力量'));
      if (!card) return null;
      return [...card.querySelectorAll('button')].find((b) => b.innerText.trim() === 'd12') || null;
    })()`, 600);
    const afterG = await readStats();
    note('改 MIG d12 前後', JSON.stringify({ before: beforeG, after: afterG, changed }));
    check('改力量骰會連動 HP', beforeG.HP !== afterG.HP, `HP 沒變（${beforeG.HP}）`);
    const diceG2 = await customDiceState();
    const migCard = diceG2 && diceG2.cards.find((c) => c.text.startsWith('力量'));
    note('力量卡的文字', migCard ? migCard.text : JSON.stringify(diceG2 && diceG2.cards.map((c) => c.text)));
    check('改過的屬性會標「已自定義」', !!migCard && /已自定義/.test(migCard.text), String(migCard && migCard.text));
    check('改過之後出現「重置體質骰子」', !!diceG2 && diceG2.hasReset,
      '改壞了卻沒有重置鈕，只能一個一個改回預設值');
  }

  // ─────────────────────────────────────────────── H
  section('H. 子分頁切換是否保留狀態');
  const beforeH = await readStats();
  const pickedBeforeH = (await affinityCells()).filter((c) => c.label !== '一般').map((c) => `${c.type}:${c.label}`);
  await clickSubTab('攻擊與技能庫');
  await new Promise((r) => setTimeout(r, 500));
  const onSkills = (await api.text()).includes('基礎攻擊與核心能力');
  note('切到「攻擊與技能庫」', String(onSkills));
  check('可以切到「攻擊與技能庫」', onSkills, '子分頁切不過去');
  await snap(api, STAGE, 'H-skills-subtab');
  await clickSubTab('基礎數值與相性');
  await new Promise((r) => setTimeout(r, 500));
  const afterH = await readStats();
  const pickedAfterH = (await affinityCells()).filter((c) => c.label !== '一般').map((c) => `${c.type}:${c.label}`);
  note('切回來的相性', JSON.stringify({ before: pickedBeforeH, after: pickedAfterH }));
  check('切換子分頁不會弄丟相性配置', JSON.stringify(pickedBeforeH) === JSON.stringify(pickedAfterH),
    JSON.stringify({ before: pickedBeforeH, after: pickedAfterH }));
  check('切換子分頁不會弄丟數值', JSON.stringify(beforeH) === JSON.stringify(afterH),
    JSON.stringify({ before: beforeH, after: afterH }));

  // ─────────────────────────────────────────────── I
  section('I. 關掉自由模式後，超出規則的設定會怎樣');
  const preI = await customDiceState();
  note('切回嚴謹前，骰子卡狀態', JSON.stringify(preI && { present: preI.present, hasReset: preI.hasReset, cards: preI.cards.map((c) => c.text) }));
  const preStats = await readStats();
  note('切回嚴謹前的數值', JSON.stringify(preStats));
  await clickFreeMode();
  await new Promise((r) => setTimeout(r, 700));
  await snap(api, STAGE, 'I-back-to-strict');
  const toastI = await api.eval(`(() => {
    const t = document.body.innerText;
    const i = t.indexOf('已恢復嚴謹模式');
    return i >= 0 ? t.slice(i, i + 90).replace(/\\s+/g, ' ').trim() : null;
  })()`);
  note('切回嚴謹模式的提示', toastI || '（沒抓到）');
  const fmI = await freeModeState();
  note('關閉後模式', JSON.stringify(fmI));
  check('可以切回嚴謹模式', fmI && fmI.text.includes('嚴謹'), JSON.stringify(fmI));
  const statsI = await readStats();
  note('切回嚴謹後的數值', JSON.stringify(statsI));
  check('切回嚴謹模式時會說明「自訂骰子已被還原」', !!toastI && /骰子|體質|自訂/.test(toastI),
    toastI ? `提示只寫「${toastI}」，沒提自訂骰子被還原` : '切回嚴謹模式沒有任何提示');
  check('切回嚴謹模式後骰子確實回到標準值', statsI.MIG === 'd10' || statsI.HP === '70',
    JSON.stringify({ MIG: statsI.MIG, HP: statsI.HP }));
  const tabsI = await affinityTabs();
  note('切回嚴謹後的分頁', JSON.stringify(tabsI.map((t) => t.text)));
  const overI = tabsI.filter((t) => t.curr !== null && t.max !== '∞' && t.curr > t.max);
  note('超出額度的分頁', JSON.stringify(overI.map((t) => t.text)));
  check('切回嚴謹模式後，超出額度的相性有被標示或修正', overI.length === 0 || /超出|超過|重新計算/.test(await panelText()),
    JSON.stringify(overI.map((t) => t.text)));

  // ─────────────────────────────────────────────── J
  section('J. console 錯誤');
  const errs = dumpErrors(api);
  note('錯誤數', api.errors.length);
  console.log(errs);

  const code = report('階段 4：步驟 4 上半（數值）', errs);
  await api.close();
  process.exit(code);
} catch (err) {
  console.log('\n腳本中斷：' + (err && err.stack ? err.stack : err));
  console.log(dumpErrors(api));
  try { await snap(api, STAGE, 'ZZ-crash'); } catch { /* 忽略 */ }
  report('階段 4：步驟 4 上半（數值）（中斷）');
  await api.close();
  process.exit(2);
}
