/**
 * 階段 3：步驟 3「設定物種」。
 *
 * 新手 GM 的問題意識：物種是「換了會連帶改變別的東西」的欄位。
 * 這一段要回答的不是「八個物種畫得出來嗎」，而是：
 *   換物種時，哪些東西該被重置、哪些該保留？實際是哪一種？
 *
 * 走法刻意照畫面文字（不碰 class、不碰 testid），因為「找不找得到」本身是測試對象。
 */
import { launch } from './cdp.mjs';
import {
  BASE, openWorkshop, newNpc, gotoStep, snap, section, check, note, report, dumpErrors, sliceText, setValue, armDialog,
} from './lib.mjs';

const STAGE = 3;
const api = await launch();
// 換物種現在會問一次「會清空物種設定與手動抗性，要繼續嗎」。
// 預設一律接受，避免未處理的 confirm 凍結 JS 執行緒（階段 1 踩過）。
armDialog(api, { accept: true });

/** 預覽區數值（右側「即時預覽」）。 */
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

/** 物種增益的「已選 / 上限」。 */
const pickCount = () => api.eval(`(() => {
  const m = document.body.innerText.match(/物種增益選擇[^\\n]*\\n\\s*(\\d+) \\/ (\\d+)/);
  return m ? { picked: Number(m[1]), max: Number(m[2]) } : null;
})()`);

/** 物種增益區塊的存在與否（換物種後可能整塊消失）。 */
const hasBonusBlock = () => api.eval(`document.body.innerText.includes('物種增益選擇')`);

/** 目前被標記為「已選」的增益文字（靠外框顏色反推，因為它沒有 aria 狀態）。 */
const pickedBonusTexts = () => api.eval(`(() => {
  const lab = [...document.querySelectorAll('label')].find((l) => l.innerText.includes('物種增益選擇'));
  if (!lab) return [];
  // 標題列的 nextElementSibling 現在可能是「已選滿」提示 <p>，不能直接假設是增益清單。
  const wrap = lab.closest('div').parentElement;
  const body = wrap ? wrap.querySelector('.grid') : null;
  if (!body) return [];
  return [...body.children].map((c) => {
    const box = c.firstElementChild || c;
    const cs = getComputedStyle(box);
    const r = c.getBoundingClientRect();
    return {
      text: c.innerText.trim().replace(/\\s+/g, ' ').slice(0, 30),
      border: cs.borderColor,
      bg: cs.backgroundColor,
      x: Math.round(r.left + r.width / 2),
      y: Math.round(r.top + r.height / 2),
      h: Math.round(r.height),
    };
  });
})()`);

/** 物種瓷磚是否為「已選」狀態。 */
const speciesState = () => api.eval(`(() => {
  const names = ['野獸物種', '構裝體物種', '惡魔物種', '元素物種', '類人物種', '魔獸物種', '植物物種', '不死物種'];
  return names.map((n) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes(n));
    if (!b) return { name: n, found: false };
    const cs = getComputedStyle(b);
    return { name: n, found: true, border: cs.borderColor, bg: cs.backgroundColor };
  });
})()`);

/** 預覽裡「Lv 5 | 士兵 | 物種」那一行的物種欄。 */
const previewSpecies = async () => {
  const s = await readStats();
  if (!s.line) return null;
  const parts = s.line.split('|').map((x) => x.trim());
  return parts.length >= 3 ? parts.slice(2).join(' | ') : null;
};

/**
 * 點一張物種增益卡。
 *
 * 走「先滾到定位、再重取座標、最後發真實滑鼠事件」這條路。
 * 為什麼不用 `el.click()`：實測它在增益卡上「選中」有效、「取消」卻靜默無效
 * （同一段程式在獨立診斷腳本裡兩種都有效，差異無法隔離，不冒這個風險）。
 * 為什麼不一次取座標：`scrollIntoView` 會移動版面，先取好的座標就過期了——
 * 所以分成「滾動」與「取座標」兩次 eval，中間等 250ms。
 */
const clickBonus = async (fragment) => {
  const found = await api.eval(`(() => {
    const lab = [...document.querySelectorAll('label')].find((l) => l.innerText.includes('物種增益選擇'));
    if (!lab) return { ok: false, reason: '找不到增益區塊' };
    const body = lab.closest('div').parentElement.querySelector('.grid');
    if (!body) return { ok: false, reason: '找不到增益清單' };
    const idx = [...body.children].findIndex((c) => c.innerText.includes(${JSON.stringify(fragment)}));
    if (idx < 0) return { ok: false, reason: '找不到卡片：' + ${JSON.stringify(fragment)} };
    const card = body.children[idx].firstElementChild || body.children[idx];
    card.scrollIntoView({ block: 'center' });
    return { ok: true, idx };
  })()`);
  if (!found || !found.ok) return found || { ok: false };
  await new Promise((res) => setTimeout(res, 250));
  const xy = await api.eval(`(() => {
    const lab = [...document.querySelectorAll('label')].find((l) => l.innerText.includes('物種增益選擇'));
    const body = lab.closest('div').parentElement.querySelector('.grid');
    const idx = [...body.children].findIndex((c) => c.innerText.includes(${JSON.stringify(fragment)}));
    const card = body.children[idx].firstElementChild || body.children[idx];
    const r = card.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + 36), w: Math.round(r.width), h: Math.round(r.height) };
  })()`);
  await api.clickAt(xy.x, xy.y);
  await new Promise((res) => setTimeout(res, 450));
  return { ok: true, idx: found.idx, xy };
};

/** 點畫面上文字含 `text` 的最內層可點元素（同樣走 DOM click，避免遮擋與位移問題）。 */
const clickButton = async (text) => {
  const r = await api.eval(`(() => {
    const cands = [...document.querySelectorAll('div, button, label')]
      .filter((el) => el.innerText && el.innerText.includes(${JSON.stringify(text)}))
      .sort((a, b) => a.innerText.length - b.innerText.length);
    const el = cands[0];
    if (!el) return { ok: false, reason: '找不到含「' + ${JSON.stringify(text)} + '」的元素' };
    el.scrollIntoView({ block: 'center' });
    el.click();
    return { ok: true, tag: el.tagName, len: el.innerText.length };
  })()`);
  await new Promise((res) => setTimeout(res, 500));
  return r;
};

/** 把物種增益全部取消（額度滿時未選項是 disabled，只能點已選那張）。 */
const clearPicks = async () => {
  for (let i = 0; i < 8; i += 1) {
    const pc = await pickCount();
    if (!pc || pc.picked === 0) return true;
    const rows = await pickedBonusTexts();
    const sel = rows.find((r) => r.border === 'rgb(217, 119, 6)');
    if (!sel) return false;
    await clickBonus(sel.text.slice(0, 12));
  }
  const end = await pickCount();
  return !!end && end.picked === 0;
};

try {
  await api.goto(BASE, { timeout: 30000 });
  await api.eval('localStorage.clear()');
  await openWorkshop(api, { stage: STAGE });
  await newNpc(api, { stage: STAGE });
  await gotoStep(api, STAGE);
  await snap(api, STAGE, 'A-step3-empty');

  // ─────────────────────────────────────────────── A
  section('A. 剛進步驟 3（還沒選物種）');
  const txtA = await api.text();
  check('步驟標題在畫面上', txtA.includes('步驟 3：設定物種'));
  check('有一句說明物種影響什麼', txtA.includes('物種決定了 NPC 的基本屬性'));
  const tiles = await speciesState();
  check('八個物種都在', tiles.filter((t) => t.found).length === 8, JSON.stringify(tiles.map((t) => t.name)));
  check('未選物種時沒有「物種增益選擇」區塊', (await hasBonusBlock()) === false);
  const s0 = await readStats();
  note('未選物種的預覽', JSON.stringify(s0));
  check('未選物種時預覽沒有物種欄', (await previewSpecies()) === null);
  check('未選物種時 HP 仍是 70', s0.HP === '70', `HP=${s0.HP}`);
  check('八個瓷磚都沒有「已選」樣式（外框一致）', new Set(tiles.map((t) => t.border)).size === 1,
    JSON.stringify([...new Set(tiles.map((t) => t.border))]));

  // ─────────────────────────────────────────────── B
  section('B. 選「野獸物種」');
  await api.clickText('野獸物種');
  await new Promise((r) => setTimeout(r, 700));
  await snap(api, STAGE, 'B-beast-selected');
  const txtB = await api.text();
  check('出現「野獸物種 BEAST」區塊標題', txtB.includes('野獸物種 BEAST'));
  check('有「固定物種特性」區塊', txtB.includes('固定物種特性'));
  check('野獸的固定特性寫「無額外的固定特性」', txtB.includes('此物種無額外的固定特性'));
  check('出現「物種增益選擇 (Pick 2)」', /物種增益選擇\s*\(?[Pp]ick 2\)?/.test(txtB) || txtB.includes('物種增益選擇'));
  const pc0 = await pickCount();
  note('增益計數', JSON.stringify(pc0));
  check('增益計數初始為 0 / 2', pc0 && pc0.picked === 0 && pc0.max === 2, JSON.stringify(pc0));
  check('預覽物種欄變成「野獸物種 BEAST」', (await previewSpecies()) === '野獸物種 BEAST', String(await previewSpecies()));
  const s1 = await readStats();
  check('選物種本身不改 HP', s1.HP === '70', `HP=${s1.HP}`);
  const tilesB = await speciesState();
  check('被選中的瓷磚有不同外框', new Set(tilesB.map((t) => t.border)).size > 1,
    JSON.stringify([...new Set(tilesB.map((t) => t.border))]));
  note('五個增益選項', (await pickedBonusTexts()).map((b) => b.text).join(' / '));

  // ─────────────────────────────────────────────── C
  section('C. 選第一個增益（最大 HP +10）');
  const okC = await clickBonus('最大 HP 增加 10 點');
  check('增益可以被點選', okC);
  const pc1 = await pickCount();
  check('計數變成 1 / 2', pc1 && pc1.picked === 1, JSON.stringify(pc1));
  const s2 = await readStats();
  note('選 HP+10 後預覽', JSON.stringify(s2));
  check('預覽 HP 由 70 變 80', s2.HP === '80', `HP=${s2.HP}`);
  check('MP 沒有被連帶改動', s2.MP === '45', `MP=${s2.MP}`);
  const pickedC = await pickedBonusTexts();
  note('已選樣式', JSON.stringify(pickedC.slice(0, 2)));

  // ─────────────────────────────────────────────── D
  section('D. 選第二個增益（學咒語 + MP +10）');
  await clickBonus('學習一個咒語');
  await new Promise((r) => setTimeout(r, 400));
  await snap(api, STAGE, 'D-two-picked');
  const pc2 = await pickCount();
  check('計數變成 2 / 2', pc2 && pc2.picked === 2, JSON.stringify(pc2));
  const s3 = await readStats();
  check('預覽 MP 由 45 變 55', s3.MP === '55', `MP=${s3.MP}`);
  check('HP 仍是 80（兩個增益疊加）', s3.HP === '80', `HP=${s3.HP}`);
  const txtD = await api.text();
  const spellChooser = /舔舐傷口|護罩|戰吼/.test(txtD);
  check('選了「學咒語」後出現咒語選擇（舔舐傷口／護罩／戰吼）', spellChooser);
  if (spellChooser) {
    note('咒語選擇相關文字', (await sliceText(api, '學習一個咒語', '即時預覽', 400)).replace(/\n+/g, ' | '));
  }

  // ─────────────────────────────────────────────── E
  section('E. 額度用完後再點第三個');
  const beforeE = await pickCount();
  await clickBonus('對抗檢定獲得 +3 加成');
  const pc3 = await pickCount();
  const s4 = await readStats();
  note('超額後的計數與預覽', JSON.stringify({ pc3, HP: s4.HP, MP: s4.MP }));
  check('計數不會超過上限 2', pc3 && pc3.picked <= 2, JSON.stringify(pc3));
  check('超額點擊不會改變 HP／MP', s4.HP === s3.HP && s4.MP === s3.MP, JSON.stringify({ HP: s4.HP, MP: s4.MP }));
  const txtE = await api.text();
  const hasOverflowHint = /已滿|已選滿|上限|最多選|超過|無法再選/.test(txtE);
  check('超額時有文字說明（否則 GM 只會覺得「點了沒反應」）', hasOverflowHint,
    `畫面沒有「已滿／上限／最多選」等字樣；計數=${JSON.stringify(pc3)}`);

  // ─────────────────────────────────────────────── F
  section('F. 可重複的增益（額外定位技能，最多 2 次）');
  const txtF = await api.text();
  const repeatable = txtF.includes('此技能最多可選2次');
  check('畫面有標示「最多可選2次」的增益', repeatable);
  if (repeatable) {
    const cleared = await clearPicks();
    const pcF0 = await pickCount();
    note('清空後的計數', JSON.stringify({ cleared, pcF0 }));
    check('可以把已選的增益全部取消回 0 / 2', cleared && pcF0 && pcF0.picked === 0, JSON.stringify(pcF0));
    await clickBonus('額外定位技能');
    const pcF1 = await pickCount();
    await clickBonus('額外定位技能');
    const pcF2 = await pickCount();
    note('連點兩次「額外定位技能」', JSON.stringify({ after1: pcF1, after2: pcF2 }));
    check('同一個增益可以被選兩次（額度足夠時）', pcF2 && pcF2.picked === 2, JSON.stringify({ after1: pcF1, after2: pcF2 }));
    const repeatLabel = await api.eval(`(() => {
      const m = document.body.innerText.match(/累計[^0-9]{0,8}(\\d+)\\s*\\/\\s*2/);
      return m ? m[1] : null;
    })()`);
    note('「累計」標記', String(repeatLabel));
    check('選兩次後出現「累計: 2/2」標記', repeatLabel === '2', `累計標記=${repeatLabel}`);
    await snap(api, STAGE, 'F-repeatable');
    // 第三次點擊：0 -> 1 -> 2 -> 0 的循環
    await clickBonus('額外定位技能');
    const pcF3 = await pickCount();
    note('第三次點擊後', JSON.stringify(pcF3));
    check('第三次點擊會退回 0（循環 0→1→2→0）', pcF3 && pcF3.picked === 0, JSON.stringify(pcF3));
  }

  // ─────────────────────────────────────────────── G
  section('G. 換物種：野獸 → 類人（重置還是保留）');
  await clearPicks();
  await clickBonus('最大 HP 增加 10 點');
  const beforeG = await readStats();
  note('換物種前的野獸配置', JSON.stringify({ HP: beforeG.HP, MP: beforeG.MP, pick: await pickCount() }));
  check('前置：野獸的 HP+10 已生效（HP 80）', beforeG.HP === '80', `HP=${beforeG.HP}`);
  await api.clickText('類人物種');
  await new Promise((r) => setTimeout(r, 700));
  await snap(api, STAGE, 'G-humanoid');
  const txtG = await api.text();
  check('物種標題換成「類人物種 HUMANOID」', txtG.includes('類人物種 HUMANOID'));
  check('出現類人的固定特性（添加一個傷害弱點）', txtG.includes('添加一個傷害弱點'));
  check('出現弱點選擇器', txtG.includes('選擇弱點') || txtG.includes('選擇...'));
  const pcG = await pickCount();
  note('類人的增益計數', JSON.stringify(pcG));
  check('增益上限跟著物種變（野獸 2 → 類人 3）', pcG && pcG.max === 3, `max=${pcG && pcG.max}`);
  note('類人的增益區塊文字', (await sliceText(api, '物種增益選擇', '即時預覽', 500)).replace(/\n+/g, ' | '));
  check('類人的增益描述沒有留下野獸的「額外定位技能（最多可選2次）」字樣',
    !txtG.includes('此技能最多可選2次'), '畫面仍寫著野獸版本的「最多可選2次」');
  const s5 = await readStats();
  note('換成類人後預覽', JSON.stringify(s5));
  check('野獸的 HP+10 已退回（HP 回到 70）', s5.HP === '70', `HP=${s5.HP}（換之前 ${beforeG.HP}）`);
  check('野獸的 MP+10 已退回（MP 回到 45）', s5.MP === '45', `MP=${s5.MP}（換之前 ${beforeG.MP}）`);
  check('預覽物種欄變成類人', (await previewSpecies()) === '類人物種 HUMANOID', String(await previewSpecies()));

  // ─────────────────────────────────────────────── G2
  section('G2. 類人的弱點選擇，換物種再換回來還在嗎');
  const weakOptions = await api.eval(`(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => s.closest('div')?.innerText.includes('選擇弱點'));
    return sel ? [...sel.options].map((o) => o.value).filter(Boolean) : [];
  })()`);
  note('弱點選項', weakOptions.join(' / '));
  if (weakOptions.length > 1) {
    const target = weakOptions.find((o) => o !== '' && o !== '選擇...') || weakOptions[1];
    const setOk = await api.eval(`(() => {
      const sel = [...document.querySelectorAll('select')].find((s) => s.closest('div')?.innerText.includes('選擇弱點'));
      if (!sel) return { ok: false, reason: '找不到弱點選擇器' };
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, ${JSON.stringify(target)});
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true, value: sel.value };
    })()`);
    note('設定弱點', `${target}（${JSON.stringify(setOk)}）`);
    await new Promise((r) => setTimeout(r, 500));
    const afterSet = await api.eval(`(() => {
      const sel = [...document.querySelectorAll('select')].find((s) => s.closest('div')?.innerText.includes('選擇弱點'));
      return sel ? sel.value : null;
    })()`);
    check('弱點選擇器接受設定', afterSet === target, `選到 ${afterSet}`);
    await snap(api, STAGE, 'G2-humanoid-weak');
    await api.clickText('野獸物種');
    await new Promise((r) => setTimeout(r, 600));
    await api.clickText('類人物種');
    await new Promise((r) => setTimeout(r, 600));
    const back = await api.eval(`(() => {
      const sel = [...document.querySelectorAll('select')].find((s) => s.closest('div')?.innerText.includes('選擇弱點'));
      return sel ? sel.value : null;
    })()`);
    note('換回類人後的弱點', String(back));
    check('換物種再換回來，弱點選擇還在（或明確被清空且有提示）',
      back === target || back === '' || back === null,
      `弱點變成「${back}」，且過程中沒有任何提示`);
    if (back !== target) {
      note('換物種會清空弱點選擇', `原本 ${target} → 現在 ${back}`);
    }
  }

  // ─────────────────────────────────────────────── G3
  section('G3. 需要填空的增益（類人「領域」，描述裡有【 】）');
  const txtG3a = await api.text();
  const hasEmptyBracket = /在與【\s*】相關的對抗檢定/.test(txtG3a);
  check('未填時描述會露出空的「【 】」', hasEmptyBracket,
    '沒看到空括號，可能已被填過');
  note('空括號的實際文字', (txtG3a.match(/在與[^\n]{0,40}對抗檢定[^\n]{0,20}/) || ['（無）'])[0]);
  await clickBonus('相關的對抗檢定中獲得');
  await new Promise((r) => setTimeout(r, 500));
  const hasField = await api.eval(`(() => {
    const i = [...document.querySelectorAll('input[type="text"], textarea')]
      .find((el) => (el.getAttribute('placeholder') || '').includes('皇家守衛'));
    return i ? { placeholder: i.getAttribute('placeholder') } : null;
  })()`);
  check('選了之後出現對應的輸入框', !!hasField, '選了「領域」增益但找不到輸入框');
  if (hasField) {
    note('輸入框 placeholder', hasField.placeholder);
    const filled = await api.eval(`(() => {
      const el = [...document.querySelectorAll('input[type="text"], textarea')]
        .find((x) => (x.getAttribute('placeholder') || '').includes('皇家守衛'));
      if (!el) return { ok: false };
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, '皇家守衛');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return { ok: true };
    })()`);
    await new Promise((r) => setTimeout(r, 500));
    await snap(api, STAGE, 'G3-domain-filled');
    const txtG3b = await api.text();
    check('填完後描述裡的【 】被替換成實際內容', /在與【\s*皇家守衛\s*】/.test(txtG3b),
      `填入「皇家守衛」後描述仍是：${(txtG3b.match(/在與【[^】]*】/) || ['（找不到）'])[0]}`);
    note('填入後的描述', (txtG3b.match(/在與【[^】]*】[^\n]{0,20}/) || ['（無）'])[0]);
    void filled;
  }

  // ─────────────────────────────────────────────── G4
  section('G4. 換物種前的確認（取消要保得住資料）');
  const speciesNow = () => previewSpecies();
  // 先在目前物種上留下可辨識的設定
  await clickBonus('額外定位技能');
  const pcG4 = await pickCount();
  const beforeG4 = await speciesNow();
  note('取消前：物種與計數', JSON.stringify({ species: beforeG4, pc: pcG4 }));
  const disarm = armDialog(api, { accept: false });
  await api.clickText('野獸物種');
  await new Promise((r) => setTimeout(r, 700));
  const dlg = disarm();
  note('confirm 是否跳出', JSON.stringify(dlg));
  check('換物種前會跳確認', dlg.fired, '沒有跳確認，一切換就直接清空');
  if (dlg.last) {
    note('confirm 的內容', String(dlg.last.message || dlg.last.text || JSON.stringify(dlg.last)).slice(0, 160));
    check('confirm 內容有說「會清空」', /清空|不會恢復/.test(String(dlg.last.message || '')),
      `確認訊息沒有說明後果：${String(dlg.last.message || '')}`);
  }
  const afterCancel = await speciesNow();
  const pcAfterCancel = await pickCount();
  note('取消後：物種與計數', JSON.stringify({ species: afterCancel, pc: pcAfterCancel }));
  check('按取消後物種沒變', afterCancel === beforeG4, `${beforeG4} → ${afterCancel}`);
  check('按取消後剛才的設定還在', pcAfterCancel && pcG4 && pcAfterCancel.picked === pcG4.picked,
    JSON.stringify({ before: pcG4, after: pcAfterCancel }));
  // 恢復成一律接受，後面還要換物種
  armDialog(api, { accept: true });
  await api.clickText('野獸物種');
  await new Promise((r) => setTimeout(r, 700));
  const afterAccept = await speciesNow();
  note('按確定後物種', String(afterAccept));
  check('按確定後物種真的換過去', afterAccept && afterAccept.includes('BEAST'), String(afterAccept));
  // 換回類人，讓後面的 H 段（換回野獸）還有東西可換
  await api.clickText('類人物種');
  await new Promise((r) => setTimeout(r, 700));
  note('G4 結束時物種', String(await speciesNow()));

  // ─────────────────────────────────────────────── H
  section('H. 換回野獸：先前的增益還記得嗎');
  await api.clickText('野獸物種');
  await new Promise((r) => setTimeout(r, 700));
  await snap(api, STAGE, 'H-back-to-beast');
  const pcH = await pickCount();
  const s6 = await readStats();
  note('換回野獸後', JSON.stringify({ pc: pcH, HP: s6.HP, MP: s6.MP }));
  check('換回來後計數是 0 / 2（不記憶）或 2 / 2（記憶）', pcH && (pcH.picked === 0 || pcH.picked === 2), JSON.stringify(pcH));
  check('計數與數值一致（不會出現「顯示 2/2 但 HP 沒加」）',
    pcH && ((pcH.picked === 0 && s6.HP === '70') || (pcH.picked === 2 && s6.HP === '80')),
    JSON.stringify({ picked: pcH && pcH.picked, HP: s6.HP }));

  // ─────────────────────────────────────────────── I
  section('I. 物種咒語是否流進步驟 4');
  // 重新選滿兩個增益，其中一個是學咒語
  await clickBonus('學習一個咒語');
  await new Promise((r) => setTimeout(r, 350));
  const spellPicked = await api.text();
  const spellOptions = ['舔舐傷口', '護罩', '戰吼'].filter((s) => spellPicked.includes(s));
  note('咒語選項', spellOptions.join(' / '));
  if (spellOptions.length) {
    await clickButton(spellOptions[0]);
    await new Promise((r) => setTimeout(r, 500));
    await snap(api, STAGE, 'I-spell-chosen');
    const s7 = await readStats();
    note('選咒語後預覽', JSON.stringify({ HP: s7.HP, MP: s7.MP }));
    const chosenMark = await api.eval(`(() => {
      const m = document.body.innerText.match(/已選咒語[^\\n]{0,30}/);
      return m ? m[0] : null;
    })()`);
    note('已選咒語標記', String(chosenMark));
    await gotoStep(api, 4);
    const txt4 = await api.text();
    check('步驟 4 出現該咒語', txt4.includes(spellOptions[0]),
      `步驟 4 找不到「${spellOptions[0]}」。步驟 4 開頭：${txt4.slice(txt4.indexOf('步驟 4'), txt4.indexOf('步驟 4') + 300).replace(/\n+/g, ' | ')}`);
    await snap(api, STAGE, 'I-step4-spell');
    await gotoStep(api, STAGE);
  }

  // ─────────────────────────────────────────────── J
  section('J. 相性徽章（右上「弱／抗／免」）是否隨物種變化');
  const badge = () => api.eval(`(() => {
    const m = document.body.innerText.match(/弱\\s*(\\d+)[^0-9]{0,8}抗\\s*(\\d+)[^0-9]{0,8}免\\s*(\\d+)/);
    return m ? { weak: Number(m[1]), resist: Number(m[2]), immune: Number(m[3]) } : null;
  })()`);
  const bBeast = await badge();
  await api.clickText('不死物種');
  await new Promise((r) => setTimeout(r, 700));
  await snap(api, STAGE, 'J-undead');
  const bUndead = await badge();
  note('野獸 vs 不死的相性徽章（手動分配的計數）', JSON.stringify({ beast: bBeast, undead: bUndead }));
  note('不死物種的固定特性原文', '添加對光傷害的弱點、對暗傷害和毒傷害的免疫，以及對中毒狀態效果的免疫');
  const badgeInfo = await api.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('▽ 弱'));
    return b ? { text: b.innerText.replace(/\\s+/g, ' ').trim(), title: b.title } : null;
  })()`);
  note('徽章完整文字', JSON.stringify(badgeInfo));
  check('徽章旁邊標出物種自帶的抗性（不死：光弱、暗免、毒免）',
    !!badgeInfo && /物種[:：]/.test(badgeInfo.text)
      && /光\s*弱/.test(badgeInfo.text) && /暗\s*免/.test(badgeInfo.text) && /毒\s*免/.test(badgeInfo.text),
    `選了不死物種（自帶「光弱點、暗與毒免疫」）後徽章只寫 ${JSON.stringify(badgeInfo && badgeInfo.text)}`);
  check('徽章有標「手動」或 title 說明它只算手動額度',
    !!badgeInfo && (/手動/.test(badgeInfo.text) || /手動|不佔額度/.test(badgeInfo.title)),
    `徽章沒有任何字樣說明它不含物種自帶抗性；title=${JSON.stringify(badgeInfo && badgeInfo.title)}`);
  await snap(api, STAGE, 'J-undead');

  // ─────────────────────────────────────────────── K
  section('K. 完全不選物種就按「下一步」');
  await api.eval('localStorage.clear()');
  await api.goto(BASE, { timeout: 30000 });
  await openWorkshop(api, { stage: STAGE });
  await newNpc(api, { stage: STAGE });
  await gotoStep(api, STAGE);
  await api.clickText('下一步');
  await new Promise((r) => setTimeout(r, 800));
  const txtK = await api.text();
  const onStep4 = txtK.includes('步驟 4：調整數值與能力');
  await snap(api, STAGE, 'K-skip-species');
  note('未選物種按下一步的結果', onStep4 ? '直接進到步驟 4（不阻擋，符合自由模式）' : '停在步驟 3 或被擋');
  const toastK = await api.eval(`(() => {
    const m = document.body.innerText.match(/還沒選物種[^\\n]{0,60}/);
    return m ? m[0] : null;
  })()`);
  note('提示訊息', String(toastK));
  check('未選物種時「下一步」會給提示', !!toastK,
    '直接放行且沒有任何提示，GM 不會知道自己漏了物種');
  check('提示不會擋住流程（自由模式仍可留空）', onStep4,
    '被擋在步驟 3，這樣「無物種」的自由用法就沒了');

  // ─────────────────────────────────────────────── 收尾
  section('L. console 錯誤');
  const errs = dumpErrors(api);
  note('錯誤數', api.errors.length);
  console.log(errs);

  const code = report('階段 3：設定物種', errs);
  await api.close();
  process.exit(code);
} catch (err) {
  console.log('\n腳本中斷：' + (err && err.stack ? err.stack : err));
  console.log(dumpErrors(api));
  try { await snap(api, STAGE, 'ZZ-crash'); } catch { /* 忽略 */ }
  report('階段 3：設定物種（中斷）');
  await api.close();
  process.exit(2);
}
