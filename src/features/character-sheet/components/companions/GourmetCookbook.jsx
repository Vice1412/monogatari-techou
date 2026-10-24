import React, { useMemo, useState } from 'react';
import {
  GiCookingPot,
  GiKnifeFork,
  GiMushroom,
  GiBookCover,
  GiDiceTwentyFacesTwenty,
  GiSaltShaker,
  GiPerspectiveDiceSixFacesRandom,
  GiTrashCan,
  GiCheckMark,
  GiScrollUnfurled,
  GiHazardSign
} from 'react-icons/gi';
import { renderTextWithAffinities } from '../../../../components/ui/FUIcon';
import EmptyState from '../../../../components/ui/EmptyState';
import {
  TASTES,
  TASTE_SHORT,
  TASTE_ROLL,
  ALL_TASTE_PAIRS,
  tastePairKey,
  parseTastePairKey,
  pairsFromTastes,
  ingredientCapacity,
  INGREDIENT_PRICE,
  DELICACY_EFFECTS,
  formatEffect,
  formatEffectSentence,
  unusedEffects,
  composeDelicacyText,
  conflictingPairKeys,
  findDuplicateEffects,
  cookbookProgress,
  countByTaste,
  groupByTaste,
  parseRollSequence,
  assignSequence
} from '../../data/gourmetData';

/**
 * 美食家工坊（Gourmet Cookbook）
 *
 * ## 核心原則：食譜一旦寫上就固定
 *
 * 原書 p.153：某個口味組合首次使用時骰 d12 決定效果，**之後永久固定**
 * （包含「選火／選冰」這類選擇）。因此本 UI：
 * - **已決定的格子不可改選項**，只能「刪除此格」重來——對應「用戶不小心寫錯」的情境。
 * - 未決定的格子提供兩種寫入方式：**骰 d12** 或**手動指定骰值**（給在實體桌面擲骰的玩家）。
 * - 骰出後先進「待確認」狀態，讓玩家**先選好屬性／體質再寫入**，避免一寫就鎖死成預設值。
 *
 * ## 食材的口味呈現（2026-10-04 使用者回饋）
 *
 * 需求是兩件事：① 一眼看出每種口味**還剩多少** ② 清單本身要好找。
 * 方案是**統計列（同時是篩選器）＋ 分組清單**：
 * - **統計列**直接回答「剩多少」，不必互動就看得到；同時它本身就是篩選控制項——
 *   一份空間做兩件事，不浪費。
 * - **分組清單**回答「哪個是哪個」，依官方口味順序（苦→鹹→酸→甜→鮮）分組。
 *
 * **手機／電腦兼顧**（使用者提問）：
 * - 統計列 `grid-cols-3 sm:grid-cols-6`——手機排成 **2 列各 3 個**（每個約 110px，好按），
 *   電腦排成 **1 列 6 個**（省高度）。這是關鍵：六個擠成一列在手機上會太小。
 * - 清單維持手機 1 欄（食材名稱讀得清楚）、電腦 2 欄；群組標題橫跨整列。
 * - 烹飪分頁的選料區套用同一套分組，因為組口味時你正是**照口味在找食材**。
 */

const TASTE_COLOR = {
  苦味: 'bg-[#f9f5eb] border-[#d6c7ab] text-[#3c2415]',
  鹹味: 'bg-[#f9f5eb] border-[#d6c7ab] text-[#3c2415]',
  酸味: 'bg-[#f9f5eb] border-[#d6c7ab] text-[#3c2415]',
  甜味: 'bg-[#f9f5eb] border-[#d6c7ab] text-[#3c2415]',
  鮮味: 'bg-[#f9f5eb] border-[#d6c7ab] text-[#3c2415]'
};

/** 群組標題用的小圓點色（與 TASTE_COLOR 同色系）。 */
const TASTE_DOT = {
  苦味: 'bg-[#3c2415]',
  鹹味: 'bg-[#3c2415]',
  酸味: 'bg-[#3c2415]',
  甜味: 'bg-[#3c2415]',
  鮮味: 'bg-[#a63d40]'
};

const SUB_TABS = [
  { id: 'ingredients', label: '食材', Icon: GiMushroom },
  { id: 'cookbook', label: '食譜書', Icon: GiBookCover },
  { id: 'cook', label: '烹飪', Icon: GiKnifeFork }
];

/** 通用複製（含舊瀏覽器退路）。 */
const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 落到退路 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

export default function GourmetCookbook({ character, onChange, showToast = () => {} }) {
  const [subTab, setSubTab] = useState('ingredients');
  const [newName, setNewName] = useState('');
  const [newTaste, setNewTaste] = useState(TASTES[0]);
  const [lastRoll, setLastRoll] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [selectedPair, setSelectedPair] = useState(null);
  const [pending, setPending] = useState(null);
  const [picked, setPicked] = useState([]);
  const [dishName, setDishName] = useState('');
  /** 口味篩選：null = 全部。食材與烹飪分頁共用（你在兩邊找的是同一批東西）。 */
  const [tasteFilter, setTasteFilter] = useState(null);
  /** 批次填寫：{ pairKey: { roll, choice } } —— 供在實體桌面擲骰的玩家一次輸入多筆。 */
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchDraft, setBatchDraft] = useState({});
  const [batchSeq, setBatchSeq] = useState('');

  const data = character?.gourmetData || {};
  const ingredients = data.ingredients || [];
  const cookbook = data.cookbook || {};

  const gourmetClass = (character?.classes || []).find((c) => c.className === '美食家');
  const cookingSL = Math.max(
    0,
    Math.floor(Number((gourmetClass?.skills || []).find((s) => s.name === '烹飪')?.sl) || 0)
  );
  const capacity = ingredientCapacity(cookingSL);
  const level = Math.max(1, Math.floor(Number(character?.level) || 1));

  const duplicates = useMemo(() => findDuplicateEffects(cookbook), [cookbook]);
  const progress = cookbookProgress(cookbook);
  const remaining = useMemo(() => unusedEffects(cookbook, level), [cookbook, level]);
  const tasteCounts = useMemo(() => countByTaste(ingredients), [ingredients]);
  /** 食材是否已達上限——滿了就擋住新增，並常駐顯示提示。 */
  const isFull = ingredients.length >= capacity;

  const write = (patch) => {
    onChange({
      ...character,
      gourmetData: { ...data, ...patch },
      updatedAt: new Date().toISOString()
    });
  };

  if (cookingSL <= 0) return null;

  const visibleIngredients = tasteFilter
    ? ingredients.filter((i) => i.taste === tasteFilter)
    : ingredients;
  const groups = groupByTaste(visibleIngredients);

  // ── 食材 ────────────────────────────────────────────────
  const addIngredient = (taste, name) => {
    if (ingredients.length >= capacity) {
      showToast(`食材已達上限（${capacity} 份），請先使用或丟棄`, 'warning');
      return false;
    }
    const finalTaste = taste || TASTES[0];
    write({
      ingredients: [
        ...ingredients,
        {
          id: `ing_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: (name || '').trim() || `${TASTE_SHORT[finalTaste]}味食材`,
          taste: finalTaste
        }
      ]
    });
    return true;
  };

  const removeIngredient = (id) => {
    write({ ingredients: ingredients.filter((i) => i.id !== id) });
    setPicked((p) => p.filter((x) => x !== id));
  };

  const commitRename = (id) => {
    const name = renameDraft.trim();
    if (name) {
      write({ ingredients: ingredients.map((i) => (i.id === id ? { ...i, name } : i)) });
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  /** 骰 d6 決定口味。骰到 6（由你決定）時以玩家選定的口味直接新增。 */
  const rollIngredient = () => {
    const d6 = Math.floor(Math.random() * 6) + 1;
    const taste = TASTE_ROLL[d6];
    setLastRoll({ die: 'd6', value: d6, taste: taste || newTaste, isFree: taste === null });

    if (taste === null) {
      if (addIngredient(newTaste, newName)) {
        setNewName('');
        showToast(`骰出 6：由你決定 → 記為【${newTaste}】`, 'success');
      }
      return;
    }
    if (addIngredient(taste, newName)) {
      setNewName('');
      showToast(`骰出 ${d6}：【${taste}】`, 'success');
    }
  };

  // ── 食譜書 ──────────────────────────────────────────────
  const startPending = (key, roll) => {
    const def = DELICACY_EFFECTS[roll];
    setPending({ key, roll, choice: def.choice ? def.choice.options[0] : null });
    setSelectedPair(key);
  };

  const rollPair = (key) => startPending(key, Math.floor(Math.random() * 12) + 1);

  const commitPending = () => {
    if (!pending) return;
    const { key, roll, choice } = pending;
    write({ cookbook: { ...cookbook, [key]: { roll, choice } } });
    showToast(`【${key}】已寫入食譜：${DELICACY_EFFECTS[roll].label}`, 'success');
    setPending(null);
  };

  const clearPair = (key) => {
    const next = { ...cookbook };
    delete next[key];
    write({ cookbook: next });
    if (pending?.key === key) setPending(null);
    showToast(`已刪除【${key}】的記錄，可重新決定`, 'info');
  };

  // ── 批次填寫（給在實體桌面擲骰的玩家）───────────────────
  //
  // 問題：一個一個點進格子填出目，骰 3 顆就要十幾個動作。
  // 解法：**快速輸入序列**——把擲出的數字照順序打成一串（`7 3 12`），
  // 自動依序填入尚未決定的組合；下方再逐列確認與調整屬性／體質，
  // 最後一次寫入。這樣「骰 3 顆」只需一次輸入 + 一次確認。
  //
  /** 尚未決定的組合，依官方口味順序。 */
  const undecidedPairs = ALL_TASTE_PAIRS.filter((k) => !cookbook[k]?.roll);

  /** 把序列依序填入尚未決定的組合（解析與配對邏輯在 data 層，已測試）。 */
  const applySequence = (raw) => {
    setBatchDraft(assignSequence(undecidedPairs, parseRollSequence(raw)));
  };

  /** 把批次草稿一次寫入食譜（此後固定）。 */
  const commitBatch = () => {
    const filled = Object.entries(batchDraft).filter(([, v]) => v && v.roll);
    if (filled.length === 0) {
      showToast('尚未輸入任何骰值', 'warning');
      return;
    }
    const next = { ...cookbook };
    for (const [k, v] of filled) next[k] = { roll: v.roll, choice: v.choice };
    write({ cookbook: next });
    showToast(`已寫入 ${filled.length} 筆食譜記錄`, 'success');
    setBatchDraft({});
    setBatchSeq('');
    setBatchOpen(false);
  };

  // ── 烹飪 ────────────────────────────────────────────────
  const togglePick = (id) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        showToast('一次最多組合 3 份食材', 'warning');
        return prev;
      }
      return [...prev, id];
    });
  };

  const pickedIngredients = picked.map((id) => ingredients.find((i) => i.id === id)).filter(Boolean);
  const cookPairs = pairsFromTastes(pickedIngredients.map((i) => i.taste));
  const canCook = pickedIngredients.length >= 2;
  const dishText = composeDelicacyText(dishName, cookPairs, cookbook, level);
  const conflicts = conflictingPairKeys(cookPairs, cookbook);

  // ── 共用區塊 ────────────────────────────────────────────

  /** 口味統計列（同時是篩選器）。 */
  const renderTasteBar = () => (
    <div className="p-2.5 rounded-xl bg-[#f4ebd9] border border-[#d6c7ab]">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-bold text-[#3c2415]">口味分布</span>
        <span className="text-[10px] font-mono text-[#6b5a4b]">點口味可只看該類</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
        <button
          type="button"
          onClick={() => setTasteFilter(null)}
          className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
            tasteFilter === null
              ? 'bg-[#3c2415] border-[#3c2415] text-[#fbf7ee] ring-2 ring-[#3c2415]'
              : 'bg-white border-[#d6c7ab] text-[#3c2415] hover:bg-[#e8dcc4]'
          }`}
        >
          <span>全部</span>
          <span className="text-[13px] font-black">{ingredients.length}</span>
        </button>
        {TASTES.map((t) => {
          const n = tasteCounts[t] || 0;
          const on = tasteFilter === t;
          return (
            <button
              key={t}
              type="button"
              disabled={n === 0}
              onClick={() => setTasteFilter(on ? null : t)}
              title={n === 0 ? `沒有${t}食材` : `只看${t}（${n} 份）`}
              className={`flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
                n === 0
                  ? 'bg-[#fbf7ee] border-[#d6c7ab] text-[#7c6a58] cursor-not-allowed'
                  : on
                    ? 'ring-2 ring-[#3c2415] ' + (TASTE_COLOR[t] || '')
                    : TASTE_COLOR[t] + ' hover:brightness-95 cursor-pointer'
              }`}
            >
              <span>{TASTE_SHORT[t]}</span>
              <span className="text-[13px] font-black">{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  /** 依口味分組的清單。`renderItem` 決定每筆怎麼呈現。 */
  const renderGrouped = (renderItem) => {
    if (ingredients.length === 0) {
      /* 空 vs 查無：這兩件事長得一樣、意思完全不同（§8.4）。
         前者是「你還沒有任何食材」——要教會他食材從哪來；
         後者是「篩選條件下沒有」——要告訴他怎麼離開這個畫面。
         原本兩者都是同一行 `text-[#6b5a4b]`（2.56:1），等於都沒說。 */
      return (
        <EmptyState
          kind="ingredients"
          icon={GiMushroom}
          title="還沒有任何食材"
          teach="食材在旅途中採集取得；採到的每一樣都會按口味列在這裡，烹飪時從中挑選。"
        />
      );
    }
    if (groups.length === 0) {
      return (
        <EmptyState
          kind="ingredient-flavour"
          icon={GiSaltShaker}
          title="這個口味沒有食材"
          teach="手上的食材不在這個口味裡；點上面的「全部」或換一個口味就看得到。"
        />
      );
    }
    return (
      <div className="space-y-2.5">
        {groups.map((g) => (
          <div key={g.taste}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${TASTE_DOT[g.taste] || 'bg-[#7c6a58]'}`} />
              <span className="text-[11px] font-bold text-[#3c2415]">{g.taste}</span>
              <span className="text-[10px] font-mono text-[#6b5a4b]">（{g.items.length}）</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">{g.items.map(renderItem)}</div>
          </div>
        ))}
      </div>
    );
  };

  /** 待確認骰值的編輯面板（食譜書與烹飪共用）。 */
  const renderPendingEditor = (key) => {
    if (!pending || pending.key !== key) return null;
    const def = DELICACY_EFFECTS[pending.roll];
    return (
      <div className="p-2 rounded-lg bg-[#f9f5eb] border border-[#d6c7ab] space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <span className="font-mono font-black text-[#3c2415]">d12 = {pending.roll}</span>
          <span className="font-bold text-[#3c2415]">{def.label}</span>
          <span className="text-[#3c2415]">
            {renderTextWithAffinities(formatEffect(pending.roll, pending.choice, level))}
          </span>
        </div>
        {def.choice && (
          <label className="flex items-center gap-2 text-[11px] font-bold text-[#6b5a4b]">
            <span>選擇{def.choice.label}</span>
            <select
              value={pending.choice || ''}
              onChange={(e) => setPending({ ...pending, choice: e.target.value })}
              className="px-1.5 py-0.5 rounded border border-[#d6c7ab] bg-white text-[11px] text-[#3c2415] cursor-pointer"
            >
              {def.choice.options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={commitPending}
            className="px-2.5 py-1 rounded-lg bg-[#a63d40] hover:bg-[#76252d] text-[#fffdf9] text-[11px] font-bold cursor-pointer"
          >
            寫入食譜（此後固定）
          </button>
          <button
            type="button"
            onClick={() => rollPair(key)}
            className="px-2 py-1 rounded-lg border border-[#d6c7ab] bg-white hover:bg-[#f4ebd9] text-[11px] font-bold text-[#3c2415] cursor-pointer"
          >
            重骰
          </button>
          <button
            type="button"
            onClick={() => setPending(null)}
            className="px-2 py-1 rounded-lg border border-[#d6c7ab] bg-white hover:bg-[#e8dcc4] text-[11px] font-bold text-[#6b5a4b] cursor-pointer"
          >
            取消
          </button>
        </div>
      </div>
    );
  };

  /** 未決定格子的操作區：骰 d12 或手動指定。 */
  const renderUndecidedActions = (key) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => rollPair(key)}
          className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-[#f9f5eb] hover:bg-[#f4ebd9] text-[11px] font-bold text-[#3c2415] flex items-center gap-1 cursor-pointer"
        >
          <GiDiceTwentyFacesTwenty className="w-3 h-3" />
          <span>骰 d12</span>
        </button>
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-white hover:bg-[#e8dcc4] text-[11px] font-bold text-[#6b5a4b] cursor-pointer"
        >
          {manualOpen ? '收起手動指定' : '手動指定骰值'}
        </button>
      </div>
      {manualOpen && (
        <div>
          <div className="text-[10px] text-[#6b5a4b] font-mono mb-1">
            在實體桌面擲出的 d12 結果，直接點數字：
          </div>
          <div className="grid grid-cols-6 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => startPending(key, n)}
                title={DELICACY_EFFECTS[n].label}
                className="py-1.5 rounded-lg border border-[#d6c7ab] bg-white hover:bg-[#f4ebd9] text-[12px] font-black text-[#3c2415] cursor-pointer"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl bg-white border border-[#d6c7ab] overflow-hidden">
      {/* 標題列 */}
      <div className="px-3.5 py-2.5 bg-[#f4ebd9] border-b border-[#d6c7ab] flex items-center justify-between flex-wrap gap-2">
        <span className="font-bold text-sm text-[#3c2415] flex items-center gap-1.5">
          <GiCookingPot className="w-4 h-4 text-[#6b5a4b]" />
          <span>美食家工坊</span>
        </span>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-lg bg-white border border-[#d6c7ab] text-xs font-bold text-[#3c2415]">
            食材 <span className="text-base font-black">{ingredients.length}</span>
            <span className="text-[#6b5a4b]"> / {capacity}</span>
          </span>
          <span className="px-2 py-1 rounded-lg bg-white border border-[#d6c7ab] text-xs font-bold text-[#3c2415]">
            食譜 <span className="text-base font-black">{progress}</span>
            <span className="text-[#6b5a4b]"> / 15</span>
          </span>
        </div>
      </div>

      {/* 子分頁 */}
      <div className="flex border-b border-[#d6c7ab]">
        {SUB_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`flex-1 px-3 py-2 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
              subTab === id ? 'bg-[#e8dcc4] text-[#3c2415]' : 'bg-white text-[#6b5a4b] hover:bg-[#f4ebd9]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="p-3.5 space-y-3">
        {/* ══════════ 食材 ══════════ */}
        {subTab === 'ingredients' && (
          <>
            {/* d6 對照表——讓玩家在助手外也能擲骰 */}
            <div className="p-2.5 rounded-xl bg-[#f4ebd9] border border-[#d6c7ab]">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3c2415] mb-1.5">
                <GiPerspectiveDiceSixFacesRandom className="w-3.5 h-3.5 text-[#6b5a4b]" />
                <span>取得食材時骰 d6 決定口味</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                {[1, 2, 3, 4, 5, 6].map((face) => (
                  <div
                    key={face}
                    className={`flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg border text-[11px] font-bold ${
                      lastRoll?.die === 'd6' && lastRoll.value === face
                        ? 'bg-[#e8dcc4] border-[#3c2415] text-[#2c221e] ring-2 ring-[#3c2415]'
                        : 'bg-white border-[#d6c7ab] text-[#3c2415]'
                    }`}
                  >
                    <span className="font-mono text-[#6b5a4b]">{face}</span>
                    <span>{TASTE_ROLL[face] || '由你決定'}</span>
                  </div>
                ))}
              </div>
              {lastRoll?.die === 'd6' && (
                <div className="mt-1.5 text-[11px] font-bold text-[#3c2415]">
                  上次骰出 <span className="font-mono">{lastRoll.value}</span>
                  {lastRoll.isFree
                    ? `（由你決定 → 記為【${lastRoll.taste}】）`
                    : `（${lastRoll.taste}）`}
                </div>
              )}
            </div>

            {/* 口味分布（同時是篩選器） */}
            {renderTasteBar()}

            {/* 新增食材（滿了則整區停用並常駐警示） */}
            <div className="space-y-1.5">
              {isFull && (
                <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#f9f5eb] border border-[#8c2d36] text-[11px] font-bold text-[#8c2d36]">
                  <GiHazardSign className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    背包已滿（{ingredients.length} / {capacity}）——請先使用或丟棄食材才能再取得。
                  </span>
                </div>
              )}
              <div
                className={`flex items-end gap-2 flex-wrap p-2.5 rounded-xl border ${
                  isFull ? 'bg-[#fbf7ee] border-[#d6c7ab] opacity-70' : 'bg-white border-[#d6c7ab]'
                }`}
              >
                <label className="flex flex-col gap-1 text-[11px] font-bold text-[#6b5a4b]">
                  <span>名稱（可留空，之後仍可改）</span>
                  <input
                    type="text"
                    value={newName}
                    disabled={isFull}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例：石化蜂蜜"
                    className="w-36 px-2 py-1 rounded-lg border border-[#d6c7ab] bg-white text-xs text-[#3c2415] disabled:bg-[#f4ebd9] disabled:text-[#7c6a58]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-bold text-[#6b5a4b]">
                  <span>口味（骰到 6 時用這個）</span>
                  <select
                    value={newTaste}
                    disabled={isFull}
                    onChange={(e) => setNewTaste(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-[#d6c7ab] bg-white text-xs text-[#3c2415] cursor-pointer disabled:bg-[#f4ebd9] disabled:text-[#7c6a58]"
                  >
                    {TASTES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={rollIngredient}
                  disabled={isFull}
                  title={isFull ? '背包已滿' : '骰 d6 決定口味'}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 ${
                    isFull
                      ? 'border-[#e8dcc4] bg-[#f4ebd9] text-[#7c6a58] cursor-not-allowed'
                      : 'border-[#d6c7ab] bg-[#f9f5eb] hover:bg-[#f4ebd9] text-[#3c2415] cursor-pointer'
                  }`}
                >
                  <GiPerspectiveDiceSixFacesRandom className="w-3.5 h-3.5" />
                  <span>骰 d6 取得</span>
                </button>
                <button
                  type="button"
                  disabled={isFull}
                  onClick={() => { addIngredient(newTaste, newName); setNewName(''); }}
                  title={isFull ? '背包已滿' : '直接新增'}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${
                    isFull
                      ? 'border-[#e8dcc4] bg-[#f4ebd9] text-[#7c6a58] cursor-not-allowed'
                      : 'border-[#d6c7ab] bg-white hover:bg-[#e8dcc4] text-[#6b5a4b] cursor-pointer'
                  }`}
                >
                  直接新增
                </button>
              </div>
            </div>

            <p className="text-t12 text-[#6b5a4b] font-mono">
              購買：隨機口味 {INGREDIENT_PRICE.random}z／自選口味 {INGREDIENT_PRICE.chosen}z
              ・休息於定居點可獲 {cookingSL} 份
            </p>

            {/* 依口味分組的食材清單 */}
            {renderGrouped((ing) => (
              <div
                key={ing.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs ${TASTE_COLOR[ing.taste] || 'bg-[#fbf7ee] border-[#d6c7ab]'}`}
              >
                <GiMushroom className="w-3.5 h-3.5 shrink-0" />
                {renamingId === ing.id ? (
                  <>
                    <input
                      type="text"
                      autoFocus
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(ing.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="flex-1 min-w-0 px-1.5 py-0.5 rounded border border-current bg-white text-xs font-bold"
                    />
                    <button type="button" onClick={() => commitRename(ing.id)} title="確定" className="shrink-0 cursor-pointer">
                      <GiCheckMark className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setRenamingId(ing.id); setRenameDraft(ing.name); }}
                      title="點擊改名"
                      className="font-bold truncate flex-1 text-left cursor-pointer hover:underline"
                    >
                      {ing.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeIngredient(ing.id)}
                      title="丟棄"
                      className="shrink-0 opacity-60 hover:opacity-100 cursor-pointer"
                    >
                      <GiTrashCan className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </>
        )}

        {/* ══════════ 食譜書 ══════════ */}
        {subTab === 'cookbook' && (
          <>
            {duplicates.length > 0 && (
              <div className="px-2.5 py-2 rounded-lg bg-[#f9f5eb] border border-[#8c2d36]/50 text-[11px] text-[#8c2d36] font-bold">
                規則衝突：以下組合產生了相同效果。原書要求每個組合效果皆不相同，請刪掉其中一個重骰。
                {duplicates.map((keys, i) => (
                  <span key={i} className="block font-mono">{keys.join('　／　')}</span>
                ))}
              </div>
            )}

            <div>
              <div className="text-[11px] font-bold text-[#3c2415] mb-1.5">
                點格子看效果（數字＝該組合骰出的 d12）
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(5, minmax(0, 1fr))' }}>
                <div />
                {TASTES.map((t) => (
                  <div key={`h_${t}`} className="text-center text-[11px] font-bold text-[#6b5a4b] pb-0.5">
                    {TASTE_SHORT[t]}
                  </div>
                ))}
                {TASTES.map((rowTaste, r) => {
                  const cells = [];
                  cells.push(
                    <div key={`rh_${rowTaste}`} className="flex items-center text-[11px] font-bold text-[#6b5a4b] pr-1">
                      {TASTE_SHORT[rowTaste]}
                    </div>
                  );
                  for (let s = 0; s < r; s += 1) cells.push(<div key={`sp_${rowTaste}_${s}`} />);
                  for (let c = r; c < TASTES.length; c += 1) {
                    const key = tastePairKey(rowTaste, TASTES[c]);
                    const entry = cookbook[key];
                    const on = selectedPair === key;
                    const isPending = pending?.key === key;
                    cells.push(
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedPair(on ? null : key)}
                        title={key}
                        className={`h-11 rounded-lg border text-[13px] font-black transition-all cursor-pointer ${on ? 'ring-2 ring-[#3c2415] ' : ''}${
                          isPending
                            ? 'bg-[#e8dcc4] border-[#3c2415] text-[#2c221e]'
                            : entry?.roll
                              ? 'bg-[#e8dcc4] border-[#c9b48f] text-[#3c2415]'
                              : 'bg-[#fbf7ee] border-[#d6c7ab] text-[#7c6a58]'
                        }`}
                      >
                        {isPending ? pending.roll : entry?.roll ? entry.roll : '·'}
                      </button>
                    );
                  }
                  return cells;
                })}
              </div>
            </div>

            {selectedPair && (
              <div className="p-2.5 rounded-xl bg-[#f4ebd9] border border-[#d6c7ab] space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#3c2415]">{selectedPair}</span>
                  {cookbook[selectedPair]?.roll && (
                    <button
                      type="button"
                      onClick={() => clearPair(selectedPair)}
                      className="text-[10px] font-mono text-[#6b5a4b] hover:text-[#76252d] cursor-pointer"
                    >
                      刪除此格（重新決定）
                    </button>
                  )}
                </div>

                {pending?.key === selectedPair ? (
                  renderPendingEditor(selectedPair)
                ) : cookbook[selectedPair]?.roll ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-[#3c2415]">{cookbook[selectedPair].roll}</span>
                      <span className="text-xs text-[#3c2415]">
                        {renderTextWithAffinities(
                          formatEffect(cookbook[selectedPair].roll, cookbook[selectedPair].choice, level)
                        )}
                      </span>
                    </div>
                    <p className="text-t12 text-[#6b5a4b] font-mono">
                      此效果已固定。若當初寫錯，請按上方「刪除此格」重新決定。
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-t12 text-[#6b5a4b]">
                      尚未決定。首次使用這個組合時決定，之後永久固定。
                    </p>
                    {renderUndecidedActions(selectedPair)}
                  </>
                )}
              </div>
            )}

            {/* 批次填寫（給在實體桌面擲骰的玩家） */}
            {undecidedPairs.length > 0 && (
              <div className="p-2.5 rounded-xl bg-white border border-[#d6c7ab] space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-[#3c2415] flex items-center gap-1.5">
                    <GiDiceTwentyFacesTwenty className="w-3.5 h-3.5 text-[#6b5a4b]" />
                    <span>批次填寫（尚未決定 {undecidedPairs.length} 格）</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBatchOpen((v) => !v);
                      setBatchDraft({});
                      setBatchSeq('');
                    }}
                    className="px-2 py-0.5 rounded border border-[#d6c7ab] bg-white hover:bg-[#e8dcc4] text-[11px] font-bold text-[#6b5a4b] cursor-pointer"
                  >
                    {batchOpen ? '收起' : '展開'}
                  </button>
                </div>

                {batchOpen && (
                  <>
                    <div className="p-2 rounded-lg bg-[#f4ebd9] border border-[#d6c7ab]">
                      <div className="text-[11px] font-bold text-[#3c2415] mb-1">
                        快速輸入：把擲出的 d12 照順序打成一串
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <input
                          type="text"
                          value={batchSeq}
                          onChange={(e) => {
                            setBatchSeq(e.target.value);
                            applySequence(e.target.value);
                          }}
                          placeholder="例：7 3 12 5"
                          className="flex-1 min-w-[8rem] px-2 py-1 rounded-lg border border-[#d6c7ab] bg-white text-xs font-mono text-[#3c2415]"
                        />
                        <button
                          type="button"
                          onClick={() => { setBatchSeq(''); setBatchDraft({}); }}
                          className="px-2 py-1 rounded-lg border border-[#d6c7ab] bg-white hover:bg-[#e8dcc4] text-[11px] font-bold text-[#6b5a4b] cursor-pointer"
                        >
                          清除
                        </button>
                      </div>
                      <p className="text-t12 text-[#6b5a4b] font-mono mt-1">
                        支援空白、逗號、頓號分隔；會依官方口味順序填入下方各列。
                      </p>
                    </div>

                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {undecidedPairs.map((key) => {
                        const draft = batchDraft[key] || {};
                        const def = draft.roll ? DELICACY_EFFECTS[draft.roll] : null;
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-1.5 flex-wrap px-1.5 py-1 rounded-lg border border-[#d6c7ab] bg-[#f4ebd9]"
                          >
                            <span className="text-[11px] font-bold text-[#3c2415] w-24 shrink-0">{key}</span>
                            <input
                              type="number"
                              min={1}
                              max={12}
                              value={draft.roll || ''}
                              onChange={(e) => {
                                const n = parseInt(e.target.value, 10);
                                setBatchDraft((d) => {
                                  const nx = { ...d };
                                  if (!Number.isInteger(n) || n < 1 || n > 12) {
                                    delete nx[key];
                                  } else {
                                    const df = DELICACY_EFFECTS[n];
                                    nx[key] = {
                                      roll: n,
                                      choice: df.choice ? d[key]?.choice || df.choice.options[0] : null
                                    };
                                  }
                                  return nx;
                                });
                              }}
                              placeholder="d12"
                              className="w-14 px-1.5 py-0.5 rounded border border-[#d6c7ab] bg-white text-center font-mono text-[11px] text-[#3c2415]"
                            />
                            {def?.choice && (
                              <select
                                value={draft.choice || ''}
                                onChange={(e) =>
                                  setBatchDraft((d) => ({ ...d, [key]: { ...d[key], choice: e.target.value } }))
                                }
                                className="px-1.5 py-0.5 rounded border border-[#d6c7ab] bg-white text-[11px] text-[#3c2415] cursor-pointer"
                              >
                                {def.choice.options.map((o) => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            )}
                            <span className="text-[10px] text-[#3c2415] flex-1 min-w-[7rem]">
                              {def ? (
                                renderTextWithAffinities(formatEffect(draft.roll, draft.choice, level))
                              ) : (
                                <span className="text-[#6b5a4b]">—</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={commitBatch}
                      className="w-full px-3 py-2 rounded-xl bg-[#a63d40] hover:bg-[#76252d] text-[#fffdf9] text-xs font-bold shadow-sm transition-colors cursor-pointer"
                    >
                      一次寫入食譜（此後固定）
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-white border border-[#d6c7ab]">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3c2415] mb-1.5">
                <GiScrollUnfurled className="w-3.5 h-3.5 text-[#6b5a4b]" />
                <span>尚未骰出的效果（{remaining.length} / 12）</span>
              </div>
              {remaining.length === 0 ? (
                <p className="text-t12 text-[#3c2415] font-bold">✓ 12 種效果全部用上了。</p>
              ) : (
                <div className="space-y-1">
                  {remaining.map((e) => (
                    <div key={e.roll} className="flex items-start gap-2 text-[11px]">
                      <span className="font-mono font-black text-[#3c2415] w-5 shrink-0 text-right">{e.roll}</span>
                      <span className="text-[#3c2415]">{renderTextWithAffinities(e.text)}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-t12 text-[#6b5a4b] font-mono mt-1.5">
                原書要求每個組合效果不得重複，故這份清單即「還能骰出什麼」。
              </p>
            </div>
          </>
        )}

        {/* ══════════ 烹飪 ══════════ */}
        {subTab === 'cook' && (
          <>
            {renderTasteBar()}

            <div className="text-[11px] font-bold text-[#6b5a4b]">
              選擇 2～3 份食材（已選 {pickedIngredients.length} 份）
            </div>

            {/* 依口味分組的選料區——組口味時正是照口味在找食材 */}
            {renderGrouped((ing) => {
              const on = picked.includes(ing.id);
              return (
                <button
                  key={ing.id}
                  type="button"
                  onClick={() => togglePick(ing.id)}
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer text-left ${
                    on
                      ? 'ring-2 ring-[#3c2415] ' + (TASTE_COLOR[ing.taste] || '')
                      : TASTE_COLOR[ing.taste] || 'bg-[#fbf7ee] border-[#d6c7ab]'
                  }`}
                >
                  <span className="block truncate">{ing.name}</span>
                  <span className="block text-[10px] font-mono opacity-80">{ing.taste}</span>
                </button>
              );
            })}

            {canCook && (
              <div className="p-2.5 rounded-xl bg-[#f4ebd9] border border-[#d6c7ab] space-y-2">
                <label className="flex flex-col gap-1 text-[11px] font-bold text-[#6b5a4b]">
                  <span>這份美食的名字</span>
                  <input
                    type="text"
                    value={dishName}
                    onChange={(e) => setDishName(e.target.value)}
                    placeholder="例：石化蜂蜜燉菇"
                    className="px-2 py-1 rounded-lg border border-[#d6c7ab] bg-white text-xs text-[#3c2415]"
                  />
                </label>

                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#3c2415]">
                  <GiSaltShaker className="w-3.5 h-3.5 text-[#6b5a4b]" />
                  <span>這份美食的效果（{cookPairs.length} 項）</span>
                </div>

                <div className="space-y-2">
                  {cookPairs.map((key) => {
                    const entry = cookbook[key];
                    const [a, b] = parseTastePairKey(key);
                    const isConflict = conflicts.includes(key);
                    return (
                      <div
                        key={key}
                        className={`p-1.5 rounded-lg border space-y-1.5 ${
                          isConflict ? 'bg-[#f9f5eb] border-[#8c2d36]' : 'bg-white border-[#d6c7ab]'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-bold w-24 shrink-0 ${isConflict ? 'text-[#8c2d36]' : 'text-[#3c2415]'}`}>
                            {a}＋{b}
                          </span>
                          {isConflict && (
                            <span className="text-[10px] font-bold text-[#8c2d36] flex items-center gap-1">
                              <GiHazardSign className="w-3 h-3" />
                              與其他效果衝突，只能保留一個
                            </span>
                          )}
                        </div>

                        {pending?.key === key ? (
                          renderPendingEditor(key)
                        ) : entry?.roll ? (
                          <span className="text-[11px] text-[#3c2415] block">
                            {renderTextWithAffinities(formatEffectSentence(entry.roll, entry.choice, level))}
                          </span>
                        ) : (
                          renderUndecidedActions(key)
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="p-2 rounded-lg bg-white border border-[#d6c7ab]">
                  <pre className="text-[11px] text-[#3c2415] whitespace-pre-wrap font-sans leading-relaxed m-0">
                    {dishText}
                  </pre>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyToClipboard(dishText);
                    showToast(ok ? '已複製美食效果' : '複製失敗，請手動選取', ok ? 'success' : 'warning');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-[#a63d40] hover:bg-[#76252d] text-[#fffdf9] text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  複製這份美食的完整效果
                </button>
              </div>
            )}
            {!canCook && ingredients.length > 0 && (
              <p className="text-t12 text-[#6b5a4b] text-center">請至少選擇 2 份食材</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
