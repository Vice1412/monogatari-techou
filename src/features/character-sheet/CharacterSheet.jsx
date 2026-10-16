import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Download,
  Upload,
  Trash2,
  Copy,
  Play,
  Search,
  Filter,
  ArrowUpDown,
  FileCode
} from 'lucide-react';
import {
  GiCrossedSwords,
  GiHazardSign,
  GiCheckMark,
  GiSpellBook,
  GiScrollQuill,
  GiQuillInk,
  GiScrollUnfurled,
  GiShield,
  GiLaurelCrown
} from 'react-icons/gi';
import GameIcon from '../../components/ui/GameIcon';
import FUIcon from '../../components/ui/FUIcon';
import CharacterEditor from './components/CharacterEditor';
import CharacterPlayHUD from './components/CharacterPlayHUD';
import CharacterLogModal from './components/CharacterLogModal';
import { createNewCharacter, calculateCharacterStats, getCharacterLevel } from './utils/characterEngine';
import { CHARACTER_THEMES, getCharacterTheme } from './utils/characterThemes';
import {
  isFultimatorCharacter,
  convertFultimatorToMonogatari,
  convertMonogatariToFultimator
} from './utils/fultimatorConverter.js';
import JRPGButton from '../../components/ui/JRPGButton';
import JRPGBadge from '../../components/ui/JRPGBadge';
import { withEn } from '../../utils/properNouns';
import { STORAGE_KEYS } from '../../data/keys';
import { readJSON, writeJSON } from '../../data/store';
import { findDuplicateStartingHeroicSkills } from './utils/characterEngine';

const STORAGE_KEY = STORAGE_KEYS.characterRoster;

export default function CharacterSheet({ onOpenDice = null, onSubNavChange = null }) {
  const [roster, setRoster] = useState(() => {
    const parsed = readJSON(STORAGE_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  });

  const [activeCharId, setActiveCharId] = useState(null);
  const [viewMode, setViewMode] = useState('roster'); // 'roster' | 'play' | 'editor'
  const [isLogOpen, setIsLogOpen] = useState(false);  // 成長履歷彈窗
  const [editorTab, setEditorTab] = useState(1);      // 編輯器開啟時要停在哪個分頁
  const [toastMessage, setToastMessage] = useState(null);

  // Gallery Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'name_asc' | 'level_desc' | 'level_asc'

  useEffect(() => {
    writeJSON(STORAGE_KEY, roster);
  }, [roster]);

  // 開局名額的同團重複檢查（Playtest Materials 2026-10-01 p.4）——只有這一頁看得到整份名冊。
  //
  // 開卡規則**存在各角色身上**（`char.creationRules`），所以這裡不必傳規則進來；
  // 只有「那張卡自己」開了開局英雄技能，它的名額才算數。見 `CreationRulesPanel` 的說明。
  const duplicateStartingHeroic = findDuplicateStartingHeroicSkills(roster);

  const showToast = (msg, type = 'info') => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleOpenPlayMode = (char) => {
    setActiveCharId(char.id);
    setViewMode('play');
  };

  const handleOpenEditorMode = (char) => {
    setActiveCharId(char.id);
    setEditorTab(1);
    setViewMode('editor');
  };

  // 成長履歷：名冊與跑團卡都能開，內容是同一份（角色物件內的 log）
  const handleOpenLog = (char) => {
    if (!char) return;
    setActiveCharId(char.id);
    setIsLogOpen(true);
  };

  const handleCreateCharacter = () => {
    const fresh = createNewCharacter();
    setRoster(prev => [fresh, ...prev]);
    setActiveCharId(fresh.id);
    setViewMode('editor');
    showToast('已創建新冒險者，開啟創角導引！');
  };

  const handleDeleteCharacter = (charId) => {
    setRoster(prev => prev.filter(c => c.id !== charId));
    if (activeCharId === charId) {
      setActiveCharId(null);
      setViewMode('roster');
    }
    showToast('已刪除角色卡');
  };

  const handleDuplicateCharacter = (char) => {
    const cloned = {
      ...JSON.parse(JSON.stringify(char)),
      id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: `${char.name || '冒險者'}【副本】`,
      updatedAt: new Date().toISOString()
    };
    setRoster(prev => [cloned, ...prev]);
    showToast('已複製角色副本！');
  };

  const handleUpdateActiveCharacter = (updatedChar) => {
    setRoster(prev => prev.map(c => c.id === updatedChar.id ? updatedChar : c));
  };

  const handleSendToCombatDirect = (char) => {
    try {
      const stats = calculateCharacterStats(char);
      const activeCombat = readJSON(STORAGE_KEYS.activeCombat, { combatants: [] });
      const combatants = activeCombat.combatants || [];

      const curHp = char.currentHp !== null && char.currentHp !== undefined ? char.currentHp : stats.maxHp;
      const curMp = char.currentMp !== null && char.currentMp !== undefined ? char.currentMp : stats.maxMp;
      const curIp = char.currentIp !== null && char.currentIp !== undefined ? char.currentIp : stats.maxIp;

      const existingIdx = combatants.findIndex(c => c.sourceId === char.id);
      const combatantData = {
        instanceId: `comb_${char.id}_${Date.now()}`,
        sourceId: char.id,
        sourceType: 'character',
        name: char.name || '冒險者',
        avatar: char.avatar || null,
        faction: '玩家隊伍',
        level: getCharacterLevel(char),
        rank: '玩家',
        role: (char.classes || []).map(c => c.className).join(' / ') || '冒險者',
        species: '玩家',
        hp: {
          current: curHp,
          max: stats.maxHp,
          crisisThreshold: stats.crisisThreshold
        },
        mp: {
          current: curMp,
          max: stats.maxMp
        },
        ip: {
          current: curIp,
          max: stats.maxIp
        },
        fabulaPoints: char.fabulaPoints ?? 3,
        attributes: {
          dex: stats.currentDex,
          ins: stats.currentIns,
          mig: stats.currentMig,
          wlp: stats.currentWlp
        },
        defense: stats.def,
        magicDefense: stats.mdef,
        initiative: stats.init,
        hasActed: false,
        statusEffects: { ...char.statusAfflictions },
        skills: (char.classes || []).flatMap(cl => (cl.skills || []).map(sk => ({
          id: `${cl.className}_${sk.name}`,
          name: `${sk.name} (SL ${sk.sl})`,
          category: 'skill',
          desc: `【${cl.className}】特技`,
          isRevealed: true
        }))),
        rawCharData: char
      };

      if (existingIdx >= 0) {
        combatants[existingIdx] = combatantData;
      } else {
        combatants.push(combatantData);
      }

      activeCombat.combatants = combatants;
      writeJSON(STORAGE_KEYS.activeCombat, activeCombat);
      showToast(`已將【${char.name}】推入戰鬥房間！`);
    } catch (e) {
      console.error(e);
      showToast('入戰失敗，請確認角色數據完整。');
    }
  };

  // Full Roster Export
  const handleExportJSON = () => {
    if (roster.length === 0) {
      showToast('目前名冊尚無任何角色，無法匯出');
      return;
    }
    const blob = new Blob([JSON.stringify(roster, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fu_characters_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('角色名冊已匯出為 JSON！');
  };

  // Single Character Export (Native or Fultimator format)
  const handleExportSingleCharacter = (char, format = 'native') => {
    const isFult = format === 'fultimator';
    const data = isFult ? convertMonogatariToFultimator(char) : char;
    const filename = isFult
      ? `fultimator_${(char.name || 'pc').replace(/\s+/g, '_')}_${Date.now()}.json`
      : `fu_char_${(char.name || 'pc').replace(/\s+/g, '_')}_${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(isFult ? `已匯出【${char.name}】為 Fultimator 相容格式！` : `已匯出【${char.name}】單卡 JSON！`);
  };

  // Import JSON with automatic Fultimator schema detection
  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (Array.isArray(parsed)) {
          let fultimatorCount = 0;
          const convertedList = parsed.map(item => {
            if (isFultimatorCharacter(item)) {
              fultimatorCount++;
              return convertFultimatorToMonogatari(item);
            }
            return item;
          });
          setRoster(prev => {
            const combined = [...convertedList];
            prev.forEach(item => {
              if (!combined.some(c => c.id === item.id)) combined.push(item);
            });
            return combined;
          });
          showToast(fultimatorCount > 0
            ? `成功匯入 ${convertedList.length} 張卡片（含 ${fultimatorCount} 位 Fultimator 角色無縫轉換）！`
            : `成功匯入 ${convertedList.length} 張角色卡！`);
        } else if (parsed && typeof parsed === 'object') {
          if (isFultimatorCharacter(parsed)) {
            const converted = convertFultimatorToMonogatari(parsed);
            setRoster(prev => [converted, ...prev]);
            showToast(`成功匯入 Fultimator 角色「${converted.name}」！已無縫轉換為《物語手帳》格式。`);
          } else {
            setRoster(prev => [parsed, ...prev]);
            showToast(`成功匯入「${parsed.name || '冒險者'}」！`);
          }
        }
      } catch (err) {
        showToast('JSON 解析失敗，請確認檔案格式是否正確');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeChar = roster.find(c => c.id === activeCharId) || roster[0] || null;

  useEffect(() => {
    if (!activeChar && viewMode !== 'roster') {
      setViewMode('roster');
    }
  }, [activeChar, viewMode]);

  // Available classes in existing roster for filter dropdown
  const availableClasses = useMemo(() => {
    const set = new Set();
    roster.forEach(c => {
      (c.classes || []).forEach(cl => {
        if (cl.className) set.add(cl.className);
      });
    });
    return Array.from(set).sort();
  }, [roster]);

  // Filtered and Sorted Roster for Gallery
  const filteredRoster = useMemo(() => {
    let list = [...roster];

    // Search keyword (name, identity, theme, classes)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => {
        const nameMatch = (c.name || '').toLowerCase().includes(q);
        const identityMatch = (c.identity || '').toLowerCase().includes(q);
        const themeMatch = (c.theme || '').toLowerCase().includes(q);
        const classMatch = (c.classes || []).some(cl => (cl.className || '').toLowerCase().includes(q));
        return nameMatch || identityMatch || themeMatch || classMatch;
      });
    }

    // Filter by class
    if (classFilter !== 'all') {
      list = list.filter(c => (c.classes || []).some(cl => cl.className === classFilter));
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'level_desc') {
        return getCharacterLevel(b) - getCharacterLevel(a);
      }
      if (sortBy === 'level_asc') {
        return getCharacterLevel(a) - getCharacterLevel(b);
      }
      // 'recent'
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

    return list;
  }, [roster, searchQuery, classFilter, sortBy]);

  // Update only themeColor to prevent overwriting modified character data with stale closures
  const handleUpdateActiveCharacterTheme = (themeId) => {
    const targetId = activeChar?.id || activeCharId;
    if (!targetId) return;
    setRoster(prev => prev.map(c => {
      if (c.id === targetId) {
        return { ...c, themeColor: themeId, updatedAt: new Date().toISOString() };
      }
      return c;
    }));
  };

  // Persistent 6 Theme Color Circles for top right header
  const renderThemeCircles = (char) => {
    if (!char) return null;
    const currentThemeId = char.themeColor || 'emerald';

    const currentTheme = getCharacterTheme(currentThemeId);

    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white/80 border shadow-2xs transition-colors"
        style={{ borderColor: currentTheme.border }}
      >
        {Object.values(CHARACTER_THEMES).map(t => {
          const isSelected = currentThemeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleUpdateActiveCharacterTheme(t.id)}
              className={`w-5 h-5 rounded-full transition-all relative flex items-center justify-center cursor-pointer ${
                isSelected
                  ? 'scale-120 shadow-xs'
                  : 'opacity-70 hover:opacity-100 hover:scale-110'
              }`}
              style={{
                backgroundColor: t.accent,
                borderColor: t.accentDark,
                boxShadow: isSelected ? `0 0 0 2px #fff, 0 0 0 4px ${t.accent}` : undefined
              }}
              title={`切換主題：${t.name}`}
            >
              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white block shadow-xs" />}
            </button>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (!onSubNavChange) return;

    if (viewMode === 'editor') {
      onSubNavChange({
        label: '返回角色名冊',
        subTitle: `構築與成長：${activeChar?.name || '冒險者'}`,
        onBack: () => setViewMode('roster'),
        extraRight: renderThemeCircles(activeChar),
        theme: getCharacterTheme(activeChar?.themeColor)
      });
    } else if (viewMode === 'play') {
      onSubNavChange({
        label: '返回角色名冊',
        subTitle: `跑團面板：${activeChar?.name || '冒險者'}`,
        onBack: () => setViewMode('roster'),
        extraRight: renderThemeCircles(activeChar),
        theme: getCharacterTheme(activeChar?.themeColor)
      });
    } else {
      onSubNavChange(null);
    }
  }, [viewMode, activeChar?.id, activeChar?.name, activeChar?.themeColor, activeChar?.updatedAt, onSubNavChange]);

  return (
    <div className="space-y-6">
      {/* Mode 1: Character Roster (Overview & Gallery) */}
      {viewMode === 'roster' && (
        <div className="space-y-6">
          {/* Top Control Bar: Search & Filters on left, Actions on right (Matches NPC Workshop hierarchy) */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pb-4 border-b border-emerald-200">
            {/* Search Input & Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              <div className="relative min-w-[200px] max-w-xs flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/60 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋姓名、身份、職業..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-emerald-200 bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25 text-xs text-emerald-950 placeholder:text-emerald-700/50 shadow-xs transition-all"
                />
              </div>

              {availableClasses.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white border border-emerald-200 px-2.5 py-1.5 rounded-lg shadow-xs">
                  <Filter className="w-3.5 h-3.5 text-emerald-700" />
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="bg-transparent text-xs font-medium text-emerald-950 focus:outline-none cursor-pointer"
                  >
                    <option value="all">全部職業（{roster.length}）</option>
                    {availableClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
              )}

              {roster.length > 1 && (
                <div className="flex items-center gap-1.5 bg-white border border-emerald-200 px-2.5 py-1.5 rounded-lg shadow-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-emerald-700" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent text-xs font-medium text-emerald-950 focus:outline-none cursor-pointer"
                  >
                    <option value="recent">最近更新</option>
                    <option value="name_asc">角色名稱（筆劃/字母）</option>
                    <option value="level_desc">等級（高至低）</option>
                    <option value="level_asc">等級（低至高）</option>
                  </select>
                </div>
              )}

              {(searchQuery || classFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setClassFilter('all'); }}
                  className="text-xs px-2.5 py-1.5 rounded-lg text-emerald-800 hover:bg-emerald-100 transition-colors font-medium"
                >
                  重設
                </button>
              )}
            </div>

            {/* Actions: Import, Backup, Create */}
            <div className="flex items-center gap-2 justify-end shrink-0 flex-wrap">
              {roster.length > 0 && (
                <span className="text-xs font-mono font-medium text-emerald-800 mr-1 hidden md:inline">
                  顯示 {filteredRoster.length} / 共 {roster.length} 位
                </span>
              )}

              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
                <span
                  className="bg-white hover:bg-emerald-50 text-emerald-950 border border-emerald-200 px-3.5 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition-all hover:scale-102 justify-center text-xs cursor-pointer"
                  title="支援匯入《物語手帳》備份或 Fultimator 導出之角色 JSON"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-700" />
                  <span>匯入卡片</span>
                </span>
              </label>

              <button
                type="button"
                onClick={handleExportJSON}
                disabled={roster.length === 0}
                className="bg-white hover:bg-emerald-50 text-emerald-950 border border-emerald-200 px-3.5 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition-all hover:scale-102 justify-center text-xs disabled:opacity-40 disabled:pointer-events-none"
                title="匯出全站冒險者名冊 JSON 備份"
              >
                <Download className="w-3.5 h-3.5 text-emerald-700" />
                <span>備份名冊</span>
              </button>

              <button
                type="button"
                onClick={handleCreateCharacter}
                className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-1.5 shadow-md transition-all hover:scale-102 justify-center text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>建立新角色</span>
              </button>
            </div>
          </div>

          {/* 開局名額的「同團不得重複」（Playtest Materials 2026-10-01 p.4）。
              這是團務層級的規則，所以只有持有名冊的這一頁檢查得到。 */}
          {duplicateStartingHeroic.length > 0 && (
            <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
              <GiLaurelCrown className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-amber-950">
                <strong>開局名額撞了</strong>
                ：官方選用規則明文「同一團不得有兩個角色用這個名額拿到同一個英雄技能」。
                <ul className="mt-1 list-disc list-inside">
                  {duplicateStartingHeroic.map((d) => (
                    <li key={d.name}>
                      【{d.name}】被 {d.characters.join('、')} 同時用開局名額取得
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Roster Empty State (Matches NPC Workshop empty card) */}
          {roster.length === 0 ? (
            <div className="text-center py-20 bg-[#fffdf9] rounded-xl border border-emerald-300/70 border-dashed flex flex-col items-center justify-center shadow-xs">
              <div className="relative mb-6 group flex items-center justify-center">
                <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all duration-700 w-28 h-28 -translate-x-4 -translate-y-2"></div>
                <GiScrollUnfurled className="w-20 h-20 text-emerald-700/60 group-hover:text-emerald-800/90 transition-all duration-500 relative z-10 drop-shadow" />
              </div>
              <p className="text-emerald-950 font-bold tracking-widest text-lg">名冊目前空空如也</p>
              <p className="text-emerald-700/80 text-sm mt-2">點擊右上方按鈕開始創造你的第一位冒險者吧！</p>
              <button
                type="button"
                onClick={handleCreateCharacter}
                className="mt-6 bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all hover:scale-105 text-sm"
              >
                <Plus className="w-4 h-4" /> 建立第一位角色
              </button>
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="text-center py-16 bg-[#fffdf9] rounded-xl border border-emerald-200 border-dashed flex flex-col items-center justify-center shadow-xs">
              <p className="text-emerald-950 font-bold text-base">找不到符合條件的冒險者</p>
              <p className="text-emerald-700/70 text-xs mt-1">請嘗試變更搜尋關鍵字或職業篩選。</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setClassFilter('all'); }}
                className="mt-4 text-xs font-bold text-emerald-800 hover:underline"
              >
                清除所有篩選條件
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRoster.map(char => {
                const charTheme = getCharacterTheme(char.themeColor);
                const stats = calculateCharacterStats(char);
                const curHp = char.currentHp ?? stats.maxHp;
                const curMp = char.currentMp ?? stats.maxMp;
                const curIp = char.currentIp ?? stats.maxIp;
                const isCrisis = curHp <= stats.crisisThreshold;
                // 四維還沒指派完 → 六項數值不成立（見 calculateCharacterStats 的 attributesUnset）
                const statsUnset = Boolean(stats.attributesUnset);

                return (
                  <div
                    key={char.id}
                    className="bg-[#fffdf9] rounded-xl shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group relative border-2"
                    style={{ borderColor: isCrisis ? '#ef4444' : charTheme.border }}
                  >
                    <div className={`h-1.5 bg-gradient-to-r ${charTheme.gradient}`} />

                    {/* Profile Header */}
                    <div
                      className="p-4 flex items-start gap-3.5 border-b transition-colors duration-200"
                      style={{ backgroundColor: charTheme.headerBg, borderColor: charTheme.border }}
                    >
                      <div
                        onClick={() => handleOpenEditorMode(char)}
                        className="w-12 h-12 rounded-xl bg-[#fffdf9] border overflow-hidden shrink-0 flex items-center justify-center font-serif text-xl font-bold shadow-inner cursor-pointer hover:scale-105 hover:ring-2 hover:ring-emerald-500/50 transition-all group relative"
                        style={{ borderColor: charTheme.border, color: charTheme.accent }}
                        title="點擊前往編輯此角色與肖像"
                      >
                        {char.avatar ? (
                          char.avatar.startsWith('http') || char.avatar.startsWith('data:') ? (
                            <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" />
                          ) : (
                            <GameIcon name={char.avatar} className="w-7 h-7" style={{ color: charTheme.accent }} />
                          )
                        ) : (
                          <GameIcon name={char.classes?.[0]?.className || 'GiSparkles'} className="w-7 h-7" style={{ color: charTheme.accent }} />
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[8px] font-bold">
                          編輯
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4
                            className="font-serif font-bold text-base truncate transition-colors"
                            style={{ color: charTheme.textDark }}
                          >
                            {char.name || '冒險者'}
                          </h4>
                          <JRPGBadge variant={charTheme.badgeVariant} size="xs">
                            Lv {getCharacterLevel(char)}
                          </JRPGBadge>
                          {isCrisis && (
                            <JRPGBadge variant="rose" size="xs" className="flex items-center gap-1 font-mono">
                              <FUIcon name="crisis" className="text-xs leading-none" />
                              <span>危機</span>
                            </JRPGBadge>
                          )}
                        </div>

                        <p className="text-[11px] text-[#7c6a58] mt-0.5 line-clamp-1">
                          {char.identity || '未設定身份'} · <span style={{ color: charTheme.accent, fontWeight: 'bold' }}>{char.theme || '未設定主題'}</span>
                        </p>

                        {/* Classes Badges */}
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {(char.classes || []).map((c, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-1.5 py-0.5 rounded border font-mono font-medium"
                              style={{ backgroundColor: '#fffdf9', borderColor: charTheme.border, color: charTheme.textDark }}
                            >
                              {withEn(c.className)} Lv{c.level}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Fultimator-Style Visual Resource Meters (HP / MP / IP) */}
                    <div className="p-3.5 space-y-2 border-b bg-[#f5efdf]/70" style={{ borderColor: charTheme.border }}>
                      {/* HP Gauge */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold flex items-center gap-1" style={{ color: isCrisis ? '#b91c1c' : '#991b1b' }}>
                            HP
                            {isCrisis && <FUIcon name="crisis" className="text-xs inline-block" />}
                          </span>
                          <span className="font-bold text-[#3c2415]">{statsUnset ? '—' : `${curHp} / ${stats.maxHp}`}</span>
                        </div>
                        <div className="h-2 w-full bg-[#e8dec8] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${isCrisis ? 'bg-gradient-to-r from-red-600 to-rose-700' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}
                            style={{ width: `${Math.max(0, Math.min(100, (curHp / stats.maxHp) * 100))}%` }}
                          />
                        </div>
                      </div>

                      {/* MP Gauge */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold text-blue-800">MP</span>
                          <span className="font-bold text-[#3c2415]">{statsUnset ? '—' : `${curMp} / ${stats.maxMp}`}</span>
                        </div>
                        <div className="h-2 w-full bg-[#e8dec8] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-blue-500 to-indigo-600"
                            style={{ width: `${Math.max(0, Math.min(100, (curMp / stats.maxMp) * 100))}%` }}
                          />
                        </div>
                      </div>

                      {/* IP Gauge */}
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold text-emerald-800">IP</span>
                          <span className="font-bold text-[#3c2415]">{curIp} / {stats.maxIp}</span>
                        </div>
                        <div className="h-2 w-full bg-[#e8dec8] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-600"
                            style={{ width: `${Math.max(0, Math.min(100, (curIp / stats.maxIp) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Attributes Dice Pills & Combat Matrix */}
                    <div className="p-3 border-b space-y-2 bg-[#fffdf9]" style={{ borderColor: charTheme.border }}>
                      {/* Four Attributes Grid */}
                      <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-xs">
                        {[
                          { key: 'dex', label: 'DEX', cur: stats.currentDex, base: stats.baseDex },
                          { key: 'ins', label: 'INS', cur: stats.currentIns, base: stats.baseIns },
                          { key: 'mig', label: 'MIG', cur: stats.currentMig, base: stats.baseMig },
                          { key: 'wlp', label: 'WLP', cur: stats.currentWlp, base: stats.baseWlp }
                        ].map(attr => (
                          <div
                            key={attr.key}
                            className="p-1 rounded-lg border bg-[#f5efdf] flex flex-col items-center"
                            style={{ borderColor: charTheme.border }}
                          >
                            <span className="text-[10px] font-bold text-[#7c6a58]">{attr.label}</span>
                            <span className="font-black text-[#3c2415] flex items-center gap-0.5">
                              <span>d{attr.cur}</span>
                              {attr.cur < attr.base && (
                                <span className="text-[9px] text-red-500 line-through">d{attr.base}</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Defense & Initiative Row */}
                      <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-[#f5efdf] border border-[#d6c7ab] text-[11px] font-mono">
                        <span className="text-[#6b5a4b]">DEF <strong className="text-[#3c2415]">{statsUnset ? '—' : stats.def}</strong></span>
                        <span className="text-[#d6c7ab]">|</span>
                        <span className="text-blue-900">M.DEF <strong className="text-blue-950">{stats.mdef}</strong></span>
                        <span className="text-[#d6c7ab]">|</span>
                        <span className="text-[#6b5a4b]">INIT <strong className="text-[#3c2415]">+{stats.init}</strong></span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div
                      className="p-3 flex items-center justify-between gap-1.5 mt-auto transition-colors duration-200 bg-[#f5efdf]/80 border-t"
                      style={{ borderColor: charTheme.border }}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDuplicateCharacter(char)}
                          className="p-1.5 rounded-lg text-[#6b5a4b] hover:text-[#3c2415] hover:bg-[#ebdcc4] transition-colors"
                          title="複製卡片"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSendToCombatDirect(char)}
                          className="p-1.5 rounded-lg text-[#6b5a4b] hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          title="推入戰鬥房間"
                        >
                          <GiCrossedSwords className="w-4 h-4 text-rose-700" />
                        </button>
                        <button
                          onClick={() => handleExportSingleCharacter(char, 'native')}
                          className="p-1.5 rounded-lg text-[#6b5a4b] hover:text-amber-800 hover:bg-amber-100/60 transition-colors"
                          title="匯出單卡 JSON"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportSingleCharacter(char, 'fultimator')}
                          className="p-1.5 rounded-lg text-[#6b5a4b] hover:text-purple-700 hover:bg-purple-50 transition-colors font-mono text-[10px] font-bold"
                          title="匯出為 Fultimator 相容格式"
                        >
                          <FileCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenLog(char)}
                          className="p-1.5 rounded-lg text-[#6b5a4b] hover:text-amber-800 hover:bg-amber-100/60 transition-colors"
                          title="成長履歷"
                        >
                          <GiScrollQuill className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCharacter(char.id)}
                          className="p-1.5 rounded-lg text-[#6b5a4b] hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          title="刪除角色"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          onClick={() => handleOpenEditorMode(char)}
                          className="px-2.5 py-1 rounded-lg border bg-[#fffdf9] hover:bg-[#f4ebd9] text-xs font-bold transition-colors shadow-xs flex items-center gap-1"
                          style={{ borderColor: charTheme.border, color: charTheme.textDark }}
                          title="進入創角與加點工作台"
                        >
                          <GiQuillInk className="w-3.5 h-3.5" style={{ color: charTheme.accent }} />
                          <span>構築與成長</span>
                        </button>

                        <JRPGButton
                          variant={charTheme.buttonVariant || 'primary'}
                          size="xs"
                          icon={Play}
                          onClick={() => handleOpenPlayMode(char)}
                          title="跑團中用：HP／MP／狀態、攻擊與咒語、命刻"
                        >
                          跑團面板
                        </JRPGButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Live Play HUD */}
      {viewMode === 'play' && activeChar && (
        <CharacterPlayHUD
          character={activeChar}
          themeId={activeChar.themeColor || 'emerald'}
          onChange={handleUpdateActiveCharacter}
          onBackToRoster={() => setViewMode('roster')}
          onOpenEditor={(tab) => {
            // 一定要驗型別：`onClick={onOpenEditor}` 會把**點擊事件物件**當成第一個參數傳進來，
            // 一旦存進 state，編輯器就會試著把那個物件渲染出來 → 整棵樹炸掉（畫面全黑＝死機）。
            setEditorTab(typeof tab === 'number' && tab >= 1 ? tab : 1);
            setViewMode('editor');
          }}
          onOpenLog={() => handleOpenLog(activeChar)}
          onOpenDice={onOpenDice}
          showToast={showToast}
        />
      )}

      {/* 成長履歷彈窗（名冊與跑團卡共用同一份） */}
      <CharacterLogModal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        theme={getCharacterTheme(activeChar?.themeColor)}
        character={activeChar}
        onChange={handleUpdateActiveCharacter}
        showToast={showToast}
      />

      {/* Mode 3: Step-by-Step Builder Wizard */}
      {viewMode === 'editor' && activeChar && (
        <CharacterEditor
          character={activeChar}
          themeId={activeChar.themeColor || 'emerald'}
          onChange={handleUpdateActiveCharacter}
          onBackToRoster={() => setViewMode('roster')}
          onEnterPlayMode={() => setViewMode('play')}
          initialTab={editorTab}
          showToast={showToast}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border-2 border-emerald-600 text-emerald-950 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 font-medium text-xs animate-fade-in">
          <GiCheckMark className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
