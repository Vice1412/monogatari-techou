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
// F-015（2026-10-27）：名冊卡上的「這張卡是哪個規則開的」徽章，唯一來源在 creationRules。
import { describeRuleBadges } from './data/creationRules';
import { CHARACTER_THEMES, getCharacterTheme } from './utils/characterThemes';
import {
  isFultimatorCharacter,
  convertFultimatorToMonogatari,
  convertMonogatariToFultimator
} from './utils/fultimatorConverter.js';
import JRPGButton from '../../components/ui/JRPGButton';
import EmptyState from '../../components/ui/EmptyState';
import JRPGBadge from '../../components/ui/JRPGBadge';
import { STORAGE_KEYS } from '../../data/keys';
import { readJSON, writeJSON } from '../../data/store';
import { findDuplicateStartingHeroicSkills } from './utils/characterEngine';
import { formatInitiative, isInitiativeVariant } from './data/initiativeVariant';
import { normalizeRosterClassNames } from './data/sourcebookConfig';

const STORAGE_KEY = STORAGE_KEYS.characterRoster;

export default function CharacterSheet({ onOpenDice = null, onSubNavChange = null }) {
  const [roster, setRoster] = useState(() => {
    const parsed = readJSON(STORAGE_KEY, []);
    // 舊存檔的職業名正名（§BF：秘儀師【Playtest】 → 秘儀師【變體】）。
    // 不刪不改任何資料，只是把查不到資料的舊鍵換成現行鍵；下面的 writeJSON 會自然寫回。
    return Array.isArray(parsed) ? normalizeRosterClassNames(parsed) : [];
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
    const currentThemeId = char.themeColor || 'amber';

    const currentTheme = getCharacterTheme(currentThemeId);

    return (
      <div
 className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/80 border transition-colors"
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
                  ? 'shadow-e1'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                backgroundColor: t.accent,
                borderColor: t.accentDark,
                boxShadow: isSelected ? `0 0 0 2px #fff, 0 0 0 4px ${t.accent}` : undefined
              }}
              title={`切換主題：${t.name}`}
            >
              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white block shadow-e1" />}
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
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pb-4 border-b border-[#d6c7ab]">
            {/* Search Input & Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              <div className="relative min-w-[200px] max-w-xs flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6b5a4b]/60 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋姓名、身份、職業..."
                  className="w-full pl-9 pr-3 py-2 rounded border border-[#d6c7ab] bg-white/90 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3c2415]/25 text-xs text-[#2c221e] placeholder:text-[#6b5a4b]/50 transition-all"
                />
              </div>

              {availableClasses.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white border border-[#d6c7ab] px-2.5 py-1.5 rounded">
                  <Filter className="w-3.5 h-3.5 text-[#6b5a4b]" />
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="bg-transparent text-xs font-medium text-[#2c221e] focus:outline-none cursor-pointer"
                  >
                    <option value="all">全部職業（{roster.length}）</option>
                    {availableClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
              )}

              {roster.length > 1 && (
                <div className="flex items-center gap-1.5 bg-white border border-[#d6c7ab] px-2.5 py-1.5 rounded">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#6b5a4b]" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent text-xs font-medium text-[#2c221e] focus:outline-none cursor-pointer"
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
                  className="text-xs px-2.5 py-1.5 rounded text-[#6b5a4b] hover:bg-[#f4ebd9] transition-colors font-medium"
                >
                  重設
                </button>
              )}
            </div>

            {/* Actions: Import, Backup, Create */}
            <div className="flex items-center gap-2 justify-end shrink-0 flex-wrap">
              {roster.length > 0 && (
                <span className="text-xs font-mono font-medium text-[#6b5a4b] mr-1 hidden md:inline">
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
                  className="bg-white hover:bg-[#f4ebd9] text-[#2c221e] border border-[#d6c7ab] px-3.5 py-2 rounded font-bold flex items-center gap-1.5 transition-all justify-center text-xs cursor-pointer"
                  title="支援匯入《物語手帳》備份或 Fultimator 導出之角色 JSON"
                >
                  <Upload className="w-3.5 h-3.5 text-[#6b5a4b]" />
                  <span>匯入卡片</span>
                </span>
              </label>

              <button
                type="button"
                onClick={handleExportJSON}
                disabled={roster.length === 0}
                className="bg-white hover:bg-[#f4ebd9] text-[#2c221e] border border-[#d6c7ab] px-3.5 py-2 rounded font-bold flex items-center gap-1.5 transition-all justify-center text-xs disabled:opacity-40 disabled:pointer-events-none"
                title="匯出全站冒險者名冊 JSON 備份"
              >
                <Download className="w-3.5 h-3.5 text-[#6b5a4b]" />
                <span>備份名冊</span>
              </button>

              <button
                type="button"
                onClick={handleCreateCharacter}
                className="bg-[#a63d40] hover:bg-[#8c3235] text-[#fffdf9] px-4 py-2 rounded font-bold flex items-center gap-1.5 shadow-md transition-all justify-center text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>建立新角色</span>
              </button>
            </div>
          </div>

          {/* 開局名額的「同團不得重複」（Playtest Materials 2026-10-01 p.4）。
              這是團務層級的規則，所以只有持有名冊的這一頁檢查得到。 */}
          {duplicateStartingHeroic.length > 0 && (
            <div className="mt-4 rounded border-2 border-[#d6c7ab] bg-[#f9f5eb] px-4 py-3 flex items-start gap-2.5">
              <GiLaurelCrown className="w-4 h-4 text-[#6b5a4b] shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-[#2c221e]">
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
            <EmptyState
              kind="roster"
              icon={GiScrollUnfurled}
              title="名冊目前空空如也"
              teach="名冊只存在這台裝置上。建立第一位冒險者之後，記得用封面右上角的「備份」把它存成檔案。"
              action={{ label: '建立第一位角色', onClick: handleCreateCharacter, icon: Plus }}
              minHeight="320px"
            />
          ) : filteredRoster.length === 0 ? (
            <div className="text-center py-16 bg-[#fffdf9] rounded border border-[#d6c7ab] border-dashed flex flex-col items-center justify-center">
              <p className="text-[#2c221e] font-bold text-base">找不到符合條件的冒險者</p>
              <p className="text-[#6b5a4b]/70 text-xs mt-1">請嘗試變更搜尋關鍵字或職業篩選。</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setClassFilter('all'); }}
                className="mt-4 text-xs font-bold text-[#6b5a4b] hover:underline"
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
                // 先攻變體（公測 p.34）：名冊上的先攻同樣不顯示數字。
                const initiativeVariant = isInitiativeVariant(char);
                // 開卡規則徽章（F-015）：四張卡四組規則，外觀原本完全一致，只能一張一張點進去分辨。
                const ruleBadges = describeRuleBadges(char.creationRules);
                const ruleBadgesShown = ruleBadges.slice(0, 4);
                const ruleBadgesRest = ruleBadges.slice(4);

                return (
                  <div
                    key={char.id}
                    className="bg-[#fffdf9] rounded hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col group relative border"
                    style={{ borderColor: isCrisis ? '#8c2d36' : charTheme.border }}
                  >
                    <div className="h-1 shrink-0" style={{ backgroundColor: charTheme.accent }} />

                    {/* 頂部半身/全身立繪區（約佔 40%-50% 高度） */}
                    <div
                      onClick={() => handleOpenEditorMode(char)}
                      className="relative w-full h-64 sm:h-72 overflow-hidden bg-[#f4ebd9]/40 flex items-center justify-center shrink-0 cursor-pointer group/portrait"
                      title="點擊前往編輯此角色與肖像"
                    >
                      {/* 立繪圖片或 GameIcon 象徵 */}
                      {char.avatar && (char.avatar.startsWith('http') || char.avatar.startsWith('data:')) ? (
                        <img
                          src={char.avatar}
                          alt={char.name}
                          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover/portrait:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#f4ebd9]/40">
                          <GameIcon
                            name={char.avatar || char.classes?.[0]?.className || 'GiSparkles'}
                            className="w-16 h-16 opacity-75 transition-transform duration-300 group-hover/portrait:scale-110"
                            style={{ color: charTheme.accent }}
                          />
                          <span className="text-t10 text-[#7c6a58] mt-2 font-mono">未上傳立繪</span>
                        </div>
                      )}

                      {/* 頂部浮層：等級徽章與危機標籤 */}
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                        <JRPGBadge variant={charTheme.badgeVariant} size="xs" className="shadow-sm">
                          Lv {getCharacterLevel(char)}
                        </JRPGBadge>
                        {isCrisis && (
                          <JRPGBadge variant="danger" size="xs" className="flex items-center gap-1 font-mono shadow-sm">
                            <FUIcon name="crisis" className="text-xs leading-none" />
                            <span>危機</span>
                          </JRPGBadge>
                        )}
                      </div>

                      {/* 懸停編輯提示 */}
                      <div className="absolute inset-0 bg-[#3c2415]/10 opacity-0 group-hover/portrait:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="px-2 py-1 rounded bg-[#fffdf9]/95 text-t10 font-bold text-[#3c2415] shadow-sm">
                          更換肖像
                        </span>
                      </div>

                      {/* 漸變融合遮罩：由透明平滑過渡至背景色 #fffdf9，無縫沒入下半部 */}
                      <svg className="absolute inset-x-0 bottom-0 h-28 w-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <defs>
                          <linearGradient id={`portrait-fade-${char.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fffdf9" stopOpacity="0" />
                            <stop offset="60%" stopColor="#fffdf9" stopOpacity="0.75" />
                            <stop offset="100%" stopColor="#fffdf9" stopOpacity="1" />
                          </linearGradient>
                        </defs>
                        <rect width="100" height="100" fill={`url(#portrait-fade-${char.id})`} />
                      </svg>

                      {/* 角色姓名與身世主題：自然浮現在漸隱過渡處 */}
                      <div className="absolute inset-x-0 bottom-1 px-4 z-10 pointer-events-none">
                        <h4
                          className="font-serif font-bold text-t16 truncate transition-colors"
                          style={{ color: charTheme.textDark }}
                        >
                          {char.name || '冒險者'}
                        </h4>
                        <div className="text-t11 text-[#7c6a58] mt-0.5 truncate">
                          {char.identity || '未設定身份'} · <span style={{ color: charTheme.accent, fontWeight: 'bold' }}>{char.theme || '未設定主題'}</span>
                        </div>
                      </div>
                    </div>

                    {/* 下半部分數據面板 */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3.5 bg-[#fffdf9]">
                      {/* 1. 狀態條：HP、MP、IP 橫向極簡進度條 */}
                      <div className="space-y-2">
                        {/* HP Gauge */}
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-t11 font-mono leading-none">
                            <span className="font-bold flex items-center gap-1" style={{ color: isCrisis ? '#a63d40' : '#3c2415' }}>
                              HP
                              {isCrisis && <FUIcon name="crisis" className="text-xs inline-block" />}
                            </span>
                            <span className="font-bold text-[#3c2415]">{statsUnset ? '—' : `${curHp} / ${stats.maxHp}`}</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#f4ebd9] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${isCrisis ? 'bg-[#a63d40]' : 'bg-gauge-hp'}`}
                              style={{ width: `${Math.max(0, Math.min(100, (curHp / stats.maxHp) * 100))}%` }}
                            />
                          </div>
                        </div>

                        {/* MP Gauge */}
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-t11 font-mono leading-none">
                            <span className="font-bold text-[#3c2415]">MP</span>
                            <span className="font-bold text-[#3c2415]">{statsUnset ? '—' : `${curMp} / ${stats.maxMp}`}</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#f4ebd9] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300 bg-gauge-mp"
                              style={{ width: `${Math.max(0, Math.min(100, (curMp / stats.maxMp) * 100))}%` }}
                            />
                          </div>
                        </div>

                        {/* IP Gauge */}
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-t11 font-mono leading-none">
                            <span className="font-bold text-[#6b5a4b]">IP</span>
                            <span className="font-bold text-[#3c2415]">{curIp} / {stats.maxIp}</span>
                          </div>
                          <div className="h-1.5 w-full bg-[#f4ebd9] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300 bg-gauge-ip"
                              style={{ width: `${Math.max(0, Math.min(100, (curIp / stats.maxIp) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 2. 職業信息：簡潔的文本標籤 */}
                      <div className="text-t11 font-mono flex items-center gap-1 flex-wrap text-[#6b5a4b]">
                        <span className="font-bold text-[#3c2415]">職業</span>
                        {char.classes && char.classes.length > 0 ? (
                          char.classes.map((c, i) => (
                            <span key={i} className="text-[#3c2415] font-medium">
                              【{c.className} Lv{c.level}】
                            </span>
                          ))
                        ) : (
                          <span className="text-[#7c6a58]">【未配置職業】</span>
                        )}
                      </div>

                      {/* 2.5 開卡規則徽章（F-015，2026-10-27）
                          以前名冊上完全看不出這張卡是哪個規則開的——把卡名剔除後，
                          全文搜「魔晶石／底力／營地活動」一個都沒中。20 張卡要點 20 次才分得出。
                          這裡只印「與官方核心規則不同」的項目（`describeRuleBadges` 是唯一來源），
                          完整清單仍在角色卡展開後的「此團開卡規則」。 */}
                      <div
                        className="flex items-center gap-1 flex-wrap"
                        data-testid={`roster-rules-${char.id}`}
                        title={ruleBadges.map((b) => b.label).join('、')}
                      >
                        {ruleBadgesShown.map((badge) => (
                          <span
                            key={badge.key}
                            className="text-t10 font-bold px-1.5 py-0.5 rounded border bg-[#f4ebd9]/70 border-[#e8dcc4] text-[#6b5a4b]"
                          >
                            {badge.label}
                          </span>
                        ))}
                        {ruleBadgesRest.length > 0 && (
                          <span
                            className="text-t10 font-bold px-1.5 py-0.5 rounded border bg-[#f4ebd9]/40 border-[#e8dcc4] text-[#7c6a58]"
                            title={ruleBadgesRest.map((b) => b.label).join('、')}
                          >
                            +{ruleBadgesRest.length}
                          </span>
                        )}
                      </div>

                      {/* 3. 核心屬性：橫向四屬性微圓角小卡片 */}
                      <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
                        {[
                          { key: 'dex', label: 'DEX', cur: stats.currentDex, base: stats.baseDex },
                          { key: 'ins', label: 'INS', cur: stats.currentIns, base: stats.baseIns },
                          { key: 'mig', label: 'MIG', cur: stats.currentMig, base: stats.baseMig },
                          { key: 'wlp', label: 'WLP', cur: stats.currentWlp, base: stats.baseWlp }
                        ].map(attr => (
                          <div
                            key={attr.key}
                            className="py-1 px-0.5 rounded bg-[#f4ebd9]/80 border border-[#e8dcc4] flex flex-col items-center"
                          >
                            <span className="text-t10 font-bold text-[#7c6a58]">{attr.label}</span>
                            <span className="text-t12 font-black text-[#3c2415] flex items-center gap-0.5">
                              <span>d{attr.cur}</span>
                              {attr.cur < attr.base && (
                                <span className="text-t10 text-[#8c2d36] line-through">d{attr.base}</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 4. 衍生屬性：DEF, M.DEF, INIT 數值一行排布 */}
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#f4ebd9]/60 border border-[#e8dcc4] text-t11 font-mono">
                        <span className="text-[#6b5a4b]">DEF <strong className="text-[#3c2415]">{statsUnset ? '—' : stats.def}</strong></span>
                        <span className="text-[#d6c7ab]">|</span>
                        <span className="text-[#2c221e]">M.DEF <strong className="text-[#2c221e]">{stats.mdef}</strong></span>
                        <span className="text-[#d6c7ab]">|</span>
                        <span className="text-[#6b5a4b]">INIT <strong className="text-[#3c2415]">{formatInitiative(stats.init, initiativeVariant)}</strong></span>
                      </div>

                      {/* 5. 底部操作區 */}
                      <div className="pt-2 mt-auto border-t border-[#e8dcc4] flex items-center justify-between gap-1">
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleDuplicateCharacter(char)}
                            className="p-1.5 rounded text-[#6b5a4b] hover:text-[#3c2415] hover:bg-[#f4ebd9] transition-colors"
                            title="複製卡片"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendToCombatDirect(char)}
                            className="p-1.5 rounded text-[#6b5a4b] hover:text-[#76252d] hover:bg-[#f9f5eb] transition-colors"
                            title="推入戰鬥房間"
                          >
                            <GiCrossedSwords className="w-3.5 h-3.5 text-[#8c2d36]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportSingleCharacter(char, 'native')}
                            className="p-1.5 rounded text-[#6b5a4b] hover:text-[#2c221e] hover:bg-[#f4ebd9] transition-colors"
                            title="匯出單卡 JSON"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportSingleCharacter(char, 'fultimator')}
                            className="p-1.5 rounded text-[#6b5a4b] hover:text-[#2c221e] hover:bg-[#f4ebd9] transition-colors font-mono text-t10 font-bold"
                            title="匯出為 Fultimator 相容格式"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenLog(char)}
                            className="p-1.5 rounded text-[#6b5a4b] hover:text-[#2c221e] hover:bg-[#f4ebd9] transition-colors"
                            title="成長履歷"
                          >
                            <GiScrollQuill className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCharacter(char.id)}
                            className="p-1.5 rounded text-[#6b5a4b] hover:text-[#8c2d36] hover:bg-[#f9f5eb] transition-colors"
                            title="刪除角色"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleOpenEditorMode(char)}
                            className="px-2.5 py-1 rounded border border-[#d6c7ab] bg-[#fffdf9] hover:bg-[#f4ebd9] text-t11 font-bold text-[#3c2415] transition-colors flex items-center gap-1"
                            title="進入創角與加點工作台"
                          >
                            <GiQuillInk className="w-3.5 h-3.5" style={{ color: charTheme.accent }} />
                            <span>構築與成長</span>
                          </button>

                          <JRPGButton
                            variant="primary"
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
          themeId={activeChar.themeColor || 'amber'}
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
          roster={roster}
          onPartnerCleared={(partnerId) => {
            /* 【合體之力】施展後雙方命刻一起清空（原文 p.131）——
               自己那份由 ZeroPowerBlock 寫回，伙伴那份在這裡寫。 */
            if (!partnerId) return;
            setRoster((prev) =>
              prev.map((c) =>
                c.id === partnerId
                  ? { ...c, zeroPower: { ...(c.zeroPower || {}), clock: 0 } }
                  : c
              )
            );
          }}
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
          themeId={activeChar.themeColor || 'amber'}
          onChange={handleUpdateActiveCharacter}
          onBackToRoster={() => setViewMode('roster')}
          onEnterPlayMode={() => setViewMode('play')}
          initialTab={editorTab}
          showToast={showToast}
          // 底力技的「整團不得重複」需要看得到隊友（見 data/zeroPowers.js 的團隊約束）
          roster={roster}
        />
      )}

      {/* Toast Notification
          `role="status"`（隱含 aria-live="polite"）讓螢幕閱讀器能收到「已存檔／已定稿／
          已卸下副手」這類回饋——原本這些訊息只有視覺變化，讀屏使用者完全收不到
          （2026-10-20 實測：全站 `[aria-live],[role="status"],[role="alert"]` 回傳空集合，
          見 `docs/playtest/findings.md` F-007）。
          **容器必須常駐**：live region 要先存在於 DOM，內容變化才會被播報；
          條件渲染整個容器等於每次都插入新節點，播報不會觸發。所以無訊息時
          用 `sr-only` 收起來，而不是從 DOM 移除。 */}
      <div
        role="status"
        aria-live="polite"
        className={
          toastMessage
            ? 'fixed bottom-6 right-6 z-50 bg-white border-2 border-[#3c2415] text-[#2c221e] px-4 py-2.5 rounded shadow-e3 flex items-center gap-2 font-medium text-xs animate-fade-in'
            : 'sr-only'
        }
      >
        {toastMessage && <GiCheckMark className="w-4 h-4 text-[#6b5a4b] shrink-0" />}
        <span>{toastMessage || ''}</span>
      </div>
    </div>
  );
}
