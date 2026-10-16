import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import { migrateLegacyStorage } from './data/store';
import './index.css';

// 一次性舊鍵遷移，必須在任何元件讀取儲存之前完成。
// 目前涵蓋全部 7 個權威鍵：把 `fu_companion_*`／`fabula-*` 等舊前綴的內容，
// 搬到新的 `monogatari_techou_*` 權威鍵（2026-10-16 前綴更名）。
// 遷移本身冪等、不覆寫、且不刪除舊鍵，因此可安全重複執行、完全可逆。
migrateLegacyStorage();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
