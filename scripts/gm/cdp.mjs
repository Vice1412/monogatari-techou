/**
 * 極簡 CDP 驅動器（無外部依賴，Node 24 內建 WebSocket）。
 *
 * 來源：`scratch/cdp.mjs`（原本是臨時探測腳本，2026-10-21 版控化為
 * NPC 工坊 GM 實測的正式通道，見 `docs/npc-workshop-gm-test.md` §4）。
 *
 * 為什麼不用 SSR：`tests/npcWorkshopUi.test.mjs` 的 `react-dom/server` 渲染
 * **不執行事件**（`AGENTS.md` §1）。GM 實測要的正是事件鏈——點錯、連點、
 * 填錯、來回切、重新整理。那些只有真瀏覽器測得到。
 *
 * 為什麼不用 Playwright：本專案 `devDependencies` 只有 vite／tailwind，
 * 裝一整套瀏覽器會讓 `npm ci` 變重，且 CI 沒有 Chrome。這裡只用 CDP，
 * 沒有新依賴，失敗時就是「本機沒 Chrome」這一個明確原因。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

const findChrome = () => {
  const hit = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!hit) throw new Error(`找不到 Chrome／Edge，候選路徑：\n${CHROME_CANDIDATES.join('\n')}`);
  return hit;
};

export async function launch({ port = 9333, profile, width = 1440, height = 1000 } = {}) {
  const chrome = findChrome();
  const userDataDir = profile || fs.mkdtempSync(path.join(os.tmpdir(), 'fu-gm-cdp-'));
  const proc = spawn(chrome, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-features=Translate,BackForwardCache',
    `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: 'ignore', detached: false });

  let targets = null;
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      targets = await res.json();
      if (targets.some((t) => t.type === 'page')) break;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const page = targets?.find((t) => t.type === 'page');
  if (!page) throw new Error('找不到 page target（Chrome 沒起來？）');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} ${JSON.stringify(msg.error.data || '')}`));
      else resolve(msg.result);
    } else if (msg.method) {
      listeners.forEach((fn) => fn(msg));
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  // ── 頁面錯誤蒐集 ───────────────────────────────────────────────
  // GM 實測最容易漏掉的缺陷型態：React 丟出的例外被 ErrorBoundary 吞掉，
  // 畫面還在、只是少一塊。不收集 console／exception 就永遠看不到。
  const errors = [];
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Log.enable');
  listeners.add((msg) => {
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push({ kind: 'exception', text: d.exception?.description || d.text, at: d.url, line: d.lineNumber });
    } else if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ');
      errors.push({ kind: `console.${msg.params.type}`, text });
    } else if (msg.method === 'Log.entryAdded' && ['error'].includes(msg.params.entry.level)) {
      errors.push({ kind: 'log.error', text: msg.params.entry.text, at: msg.params.entry.url });
    }
  });

  const api = {
    send,
    ws,
    proc,
    userDataDir,
    errors,
    onEvent: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },

    async eval(expression, { awaitPromise = true, returnByValue = true } = {}) {
      const r = await send('Runtime.evaluate', {
        expression, awaitPromise, returnByValue, userGesture: true, includeCommandLineAPI: true,
      });
      if (r.exceptionDetails) {
        throw new Error(`eval 失敗：${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ''}`);
      }
      return r.result.value;
    },

    /** 等待某個表達式為真（給 React 狀態更新用，不要用固定 sleep 賭）。 */
    async waitFor(expression, { timeout = 15000, interval = 150 } = {}) {
      const start = Date.now();
      let last = null;
      while (Date.now() - start < timeout) {
        try {
          const v = await api.eval(expression);
          if (v) return v;
          last = v;
        } catch (e) { last = e.message; }
        await new Promise((r) => setTimeout(r, interval));
      }
      throw new Error(`waitFor 逾時（${timeout}ms）：${expression}\n最後值：${JSON.stringify(last)}`);
    },

    /** 等待畫面出現某段文字（最常用的一種 waitFor）。 */
    async waitText(text, opts = {}) {
      return api.waitFor(`document.body.innerText.includes(${JSON.stringify(text)})`, opts);
    },

    async goto(url, { waitText: text = null, timeout = 20000 } = {}) {
      await send('Page.navigate', { url });
      const start = Date.now();
      while (Date.now() - start < timeout) {
        await new Promise((r) => setTimeout(r, 200));
        try {
          const state = await api.eval('document.readyState');
          if (state !== 'complete') continue;
          if (!text) return true;
          const found = await api.eval(`document.body.innerText.includes(${JSON.stringify(text)})`);
          if (found) return true;
        } catch { /* navigation in flight */ }
      }
      throw new Error(`等待逾時：${text || 'load'}`);
    },

    async text() { return api.eval('document.body.innerText'); },

    /**
     * 用**真實滑鼠事件**點擊（CDP Input）——`el.click()` 對這個 app 不一定生效：
     * 翻書遮罩存在時 React 的 onClick 收不到合成 click。座標點擊才是玩家真的在做的事。
     */
    async clickText(label, { exact = false, index = 0, within = null, selector = 'button, [role="button"], a, label, li, div, option' } = {}) {
      const expr = `(() => {
        const scope = ${within ? `document.querySelector(${JSON.stringify(within)})` : 'document.body'};
        if (!scope) return { ok: false, reason: 'scope not found' };
        const label = ${JSON.stringify(label)};
        const exact = ${exact};
        const all = [...scope.querySelectorAll(${JSON.stringify(selector)})];
        const hits = all.filter((el) => {
          const t = (el.innerText || '').trim().replace(/\\s+/g, ' ');
          if (!t) return false;
          const hit = exact ? t === label : t.includes(label);
          if (!hit) return false;
          return !all.some((other) => other !== el && el.contains(other) && ((other.innerText||'').trim().replace(/\\s+/g,' ').includes(label)));
        });
        const el0 = hits.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        }).map((el) => ({ el, area: el.getBoundingClientRect().width * el.getBoundingClientRect().height }))
          .sort((a, b) => a.area - b.area);
        const el = el0[${index}]?.el;
        if (!el) return { ok: false, reason: 'not found', count: hits.length };
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        const x = Math.round(r.left + r.width / 2);
        const y = Math.round(r.top + r.height / 2);
        const top = document.elementFromPoint(x, y);
        return { ok: true, x, y, tag: el.tagName, text: (el.innerText||'').trim().slice(0, 60),
                 count: hits.length, topTag: top?.tagName, topText: (top?.innerText||'').trim().slice(0,40),
                 inside: el.contains(top) };
      })()`;
      const info = await api.eval(expr);
      if (!info?.ok) return info;
      await api.clickAt(info.x, info.y);
      return info;
    },

    async clickAt(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      await new Promise((r) => setTimeout(r, 150));
      return true;
    },

    /**
     * 按住拖曳。輪播（步驟 1 的定位捲軸）只認 `mousedown` → `mousemove` → `mouseup` 的位移，
     * 用 `clickAt` 點不動它——新手也是用拖的，所以這個事件序列必須跟真人一樣。
     */
    async drag(x1, y1, x2, y2, { steps = 8 } = {}) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x1, y: y1, button: 'none' });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x1, y: y1, button: 'left', clickCount: 1 });
      for (let i = 1; i <= steps; i += 1) {
        const x = Math.round(x1 + ((x2 - x1) * i) / steps);
        const y = Math.round(y1 + ((y2 - y1) * i) / steps);
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
        await new Promise((r) => setTimeout(r, 40));
      }
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2, y: y2, button: 'left', clickCount: 1 });
      await new Promise((r) => setTimeout(r, 250));
      return true;
    },

    /** 真的打字（觸發 React onChange 需要先聚焦再逐字 keyDown）。 */
    async typeText(selector, value, { clear = true } = {}) {
      const focused = await api.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return { ok: false };
        el.focus();
        if (${clear}) {
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, '');
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return { ok: true };
      })()`);
      if (!focused?.ok) return focused;
      for (const ch of value) {
        await send('Input.dispatchKeyEvent', { type: 'char', text: ch });
      }
      await api.eval(`document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new Event('change', { bubbles: true }))`);
      return { ok: true };
    },

    async viewport(width, height = 900) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
      await new Promise((r) => setTimeout(r, 200));
      return { width, height };
    },

    async shot(file) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    },

    async close() {
      try { ws.close(); } catch { /* noop */ }
      try { proc.kill(); } catch { /* noop */ }
    },
  };

  // ── 對話框（confirm／alert）預設自動處理 ─────────────────────
  // 不處理的話，dialog 一開，頁面 JS 主執行緒就被凍住，
  // 之後每一個 Runtime.evaluate 都會**永遠不返回**——表現是「腳本卡死」，
  // 而不是「某個檢查失敗」。這是最容易誤判成「程式壞了」的一種測試故障。
  api.dialogPolicy = 'accept';   // 'accept' | 'reject'
  api.dialogs = [];
  listeners.add(async (msg) => {
    if (msg.method !== 'Page.javascriptDialogOpening') return;
    const accept = api.dialogPolicy !== 'reject';
    api.dialogs.push({ type: msg.params.type, message: msg.params.message, accepted: accept });
    try {
      await send('Page.handleJavaScriptDialog', { accept });
    } catch { /* 已被別處關閉 */ }
  });

  return api;
}
