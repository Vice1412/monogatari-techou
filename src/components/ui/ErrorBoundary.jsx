import React from 'react';
import { GiHazardSign, GiSparkles, GiBookAura } from 'react-icons/gi';
import { STORAGE_KEYS } from '../../data/keys';
import { removeKey } from '../../data/store';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[物語手帳] Caught Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetCache = () => {
    const ok = window.confirm(
      '此操作會清除「目前進行中的戰鬥」（輪次、參戰者、場景時鐘），'
      + '角色卡與 NPC 檔案庫不受影響。\n\n建議先確認已完成匯出備份。要繼續嗎？'
    );
    if (!ok) return;
    try {
      removeKey(STORAGE_KEYS.activeCombat);
      // Keep characters and NPCs unless user explicitly wants to purge, but fix any corrupted active view
      window.location.href = window.location.origin + window.location.pathname;
    } catch (e) {
      window.location.reload();
    }
  };

  // 2026-10-16 移除 `handleHardReset`。
  // 它呼叫 store.clearAll() 清空**全部** localStorage，但確認文案只寫「清除所有暫存」——
  // 「暫存」聽起來像快取，實際上會連角色名冊與 NPC 檔案庫一起刪掉，是不可逆的資料破壞。
  // 它同時與 `src/data/keys.js` 的明文承諾（舊鍵永不刪除、遷移完全可逆）直接衝突。
  // 該函式從未被任何 JSX 接線（全檔僅出現定義處一次），故直接移除而非改寫文案。

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.toString() || '未知運行時錯誤';
      const errorStack = this.state.errorInfo?.componentStack || this.state.error?.stack || '';

      if (this.props.inline) {
        return (
          <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 text-amber-950 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <div className="w-6 h-6 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-800">
                  <GiHazardSign className="w-3.5 h-3.5" />
                </div>
                <span>【{this.props.label || '此模組'}】載入暫時遇到狀況</span>
              </div>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="px-3 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition-colors flex items-center gap-1 shadow-2xs"
              >
                <GiSparkles className="w-3.5 h-3.5" />
                <span>重試載入</span>
              </button>
            </div>
            <p className="text-t12 text-amber-900/90 leading-relaxed font-sans">
              已為您安全隔離此區塊異常。其餘跑團功能、生命資源（HP/MP/IP）、行囊與擲骰判定仍可正常使用。
            </p>
            {errorMsg && (
              <details className="text-[10px] text-amber-800/80">
                <summary className="cursor-pointer hover:underline">查看技術錯誤代碼</summary>
                <div className="mt-1 p-2 rounded-lg bg-white/90 border border-amber-200 font-mono text-rose-800 break-all leading-tight">
                  {errorMsg}
                </div>
              </details>
            )}
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[#f5efdf] text-[#2c221e] flex items-center justify-center p-4 selection:bg-amber-200">
          <div className="max-w-lg w-full bg-[#fffdfa] border-2 border-[#c5b59a] rounded-2xl shadow-e3 p-6 sm:p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
              <GiHazardSign className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h1 className="font-serif font-black text-2xl tracking-wide text-[#2c221e]">
                冒險儀表遭遇了阻礙
              </h1>
              <p className="text-xs text-[#705e4d] leading-relaxed">
                系統在渲染畫面時捕捉到了例外錯誤。不用擔心，您的角色存檔均安全保存在本機中。
              </p>
            </div>

            {/* Error Message Snippet */}
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-left font-mono text-xs text-rose-900 break-words">
              <span className="font-bold block text-[11px] text-rose-700 font-sans mb-0.5">錯誤資訊：</span>
              <span>{errorMsg}</span>
            </div>

            {/* Recovery Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-serif font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5"
              >
                <GiSparkles className="w-4 h-4" />
                <span>重新整理頁面</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-amber-50 border border-[#c5b59a] text-[#3c2415] font-serif font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <GiBookAura className="w-4 h-4" />
                <span>修復暫存並重載</span>
              </button>
            </div>

            {/* Collapsible Stack Trace */}
            {errorStack && (
              <details className="text-left pt-2 border-t border-[#e2d8c3]">
                <summary className="text-[11px] text-[#6b5a4b] font-mono cursor-pointer hover:text-[#3c2415] transition-colors">
                  展開技術調試追蹤
                </summary>
                <pre className="mt-2 p-2.5 rounded-lg bg-[#f4ebd9] text-[#2c221e] text-[10px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                  {errorStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
