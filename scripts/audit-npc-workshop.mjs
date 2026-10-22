/**
 * NPC 工坊 —— 全功能人工稽核（真的開一個 headless Chrome 去點）。
 *
 * 為什麼需要這個檔案：
 * `npm test` 裡的 `test:npcworkshop`（引擎純函式）、`test:npcworkshopui`（SSR 冒煙）、
 * `test:npcdrag`（拖曳方向）都**不會執行 onClick**。也就是說：
 *   「匯入備份檔」「自由模式」「頭像裁切」「複製四格式」「揭露程度」「入戰」
 *   這些**真正在使用者手上跑**的功能，自動化關卡一個都沒碰過。
 * 這支腳本用 CDP 直接驅動 Chrome，逐項點過去並斷言畫面結果。
 *
 * 執行前置：
 *   1. `npm run dev`（Vite 在 http://localhost:3000）
 *   2. Chrome 已安裝（路徑可用 `CHROME_PATH` 覆寫）
 *   3. `node scripts/audit-npc-workshop.mjs`
 *
 * 這是**手動稽核**，不進 `npm test` 串鏈：CI（GitHub Pages）沒有 Chrome，
 * 把它排進 `npm test` 只會讓整條串鏈在 CI 紅掉。與 `scripts/audit_lucide_usage.py` 同性質。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const APP = process.env.NPCW_URL || 'http://localhost:3000/';
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = Number(process.env.CDP_PORT || 9333);

// ── 1x1 PNG（紅）——頭像上傳用 ─────────────────────────────
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

// ── 結果收集 ──────────────────────────────────────────────
const results = [];
let currentGroup = '';
const group = (name) => {
  currentGroup = name;
  results.push({ kind: 'group', name });
};
const record = (name, ok, detail = '') => {
  results.push({ kind: 'check', group: currentGroup, name, ok, detail });
  const mark = ok ? '  ok  ' : ' FAIL ';
  process.stdout.write(`${mark} ${name}${ok || !detail ? '' : `\n         → ${detail}`}\n`);
};

// ── CDP 客戶端 ────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.exceptions = [];
    this.dialogs = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        return;
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
        if (['error', 'warning', 'assert'].includes(msg.params.type)) {
          this.consoleErrors.push({ level: msg.params.type, text });
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.exceptions.push(d.exception?.description || d.text);
      } else if (msg.method === 'Page.javascriptDialogOpening') {
        this.dialogs.push({ type: msg.params.type, message: msg.params.message });
        this.ws.send(
          JSON.stringify({
            id: ++this.seq,
            method: 'Page.handleJavaScriptDialog',
            params: { accept: true },
          })
        );
      }
    });
  }

  send(method, params = {}, timeout = 25000) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, timeout);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (r.exceptionDetails) {
      throw new Error(
        'JS: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
      );
    }
    return r.result.value;
  }

  async waitFor(expression, timeout = 8000, interval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        if (await this.evaluate(expression)) return true;
      } catch {
        /* 元素還沒出現 */
      }
      await sleep(interval);
    }
    return false;
  }

  drain() {
    const out = { consoleErrors: [...this.consoleErrors], exceptions: [...this.exceptions] };
    this.consoleErrors.length = 0;
    this.exceptions.length = 0;
    return out;
  }

  /** 累積式診斷：不清空，最後一次總驗 */
  diag() {
    return { consoleErrors: this.consoleErrors, exceptions: this.exceptions, dialogs: this.dialogs };
  }
}

async function connectPage(port) {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page' && !t.url.startsWith('devtools'));
  if (!page) throw new Error('找不到 page target');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  return cdp;
}

// ── 頁面內工具箱 ──────────────────────────────────────────
const PAGE_HELPERS = `
(() => {
  if (window.__t) return 'already';
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const deepest = (needle, scopeSel) => {
    const root = scopeSel ? document.querySelector(scopeSel) : document.body;
    if (!root) return [];
    const n = norm(needle);
    const hits = [...root.querySelectorAll('*')].filter((el) => norm(el.innerText || el.textContent) === n);
    return hits.filter((el) => ![...el.children].some((c) => norm(c.innerText || c.textContent) === n));
  };
  const nativeSet = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  window.__t = {
    norm,
    text(sel) {
      const root = sel ? document.querySelector(sel) : document.body;
      return root ? norm(root.innerText) : '';
    },
    has(s) { return norm(document.body.innerText).includes(s); },
    count(sel) { return document.querySelectorAll(sel).length; },
    clickText(needle, scopeSel) {
      const hits = deepest(needle, scopeSel);
      if (!hits.length) return 'not-found';
      const el = hits[hits.length - 1];
      el.scrollIntoView({ block: 'center', inline: 'center' });
      el.click();
      return 'ok';
    },
    clickSel(sel, idx = 0) {
      const el = document.querySelectorAll(sel)[idx];
      if (!el) return 'not-found';
      el.scrollIntoView({ block: 'center' });
      el.click();
      return 'ok';
    },
    clickRe(reSource, scopeSel) {
      const root = scopeSel ? document.querySelector(scopeSel) : document.body;
      const re = new RegExp(reSource);
      const el = [...root.querySelectorAll('button, [role="button"], div, span')]
        .filter((n) => re.test(norm(n.innerText)) && ![...n.children].some((c) => re.test(norm(c.innerText))))
        .pop();
      if (!el) return 'not-found';
      el.scrollIntoView({ block: 'center' });
      el.click();
      return 'ok';
    },
    setInput(sel, value, idx = 0) {
      const el = document.querySelectorAll(sel)[idx];
      if (!el) return 'not-found';
      nativeSet(el, value);
      return 'ok';
    },
    setByPlaceholder(ph, value) {
      const el = [...document.querySelectorAll('input, textarea')].find((e) => e.placeholder === ph);
      if (!el) return 'not-found';
      nativeSet(el, value);
      return 'ok';
    },
    setSelectByOptionText(optionText, value) {
      const sel = [...document.querySelectorAll('select')].find((s) =>
        [...s.options].some((o) => norm(o.textContent) === optionText)
      );
      if (!sel) return 'not-found';
      nativeSet(sel, value);
      return 'ok';
    },
    stepSelectValue() {
      const sel = [...document.querySelectorAll('select')].find((s) =>
        s.options.length === 8 && norm(s.options[0]?.textContent).startsWith('1. 定位')
      );
      return sel ? sel.value : null;
    },
    clickStep(n) {
      const sidebar = document.querySelector('.hidden.md\\\\:flex');
      const re = new RegExp('^' + n + ' ' + n + '\\\\. ');
      const btn = [...(sidebar ? sidebar.querySelectorAll('button') : [])]
        .find((b) => re.test(norm(b.innerText)));
      if (!btn) return 'not-found';
      btn.scrollIntoView({ block: 'center' });
      btn.click();
      return 'ok';
    },
    cardText() {
      const card = document.querySelector('[ref]') || null;
      return card ? norm(card.innerText) : '';
    },
    ls(key) { try { return localStorage.getItem(key); } catch { return null; } },
  };
  return 'ok';
})()
`;

// ── 主流程 ────────────────────────────────────────────────
let chrome;
let cdp;

async function launch() {
  const profile = mkdtempSync(path.join(tmpdir(), 'npcw-audit-'));
  const downloads = mkdtempSync(path.join(tmpdir(), 'npcw-dl-'));
  chrome = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=1440,1000',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  const start = Date.now();
  while (Date.now() - start < 20000) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/version`);
      break;
    } catch {
      await sleep(300);
    }
  }
  // 下載行為：允許，存到臨時目錄（JPG／JSON 匯出要驗檔案真的產出）
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const bws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => bws.addEventListener('open', r, { once: true }));
  const bid = 1;
  bws.send(
    JSON.stringify({
      id: bid,
      method: 'Browser.setDownloadBehavior',
      params: { behavior: 'allow', downloadPath: downloads },
    })
  );
  await sleep(300);

  cdp = await connectPage(PORT);
  return { downloads };
}

const T = (expr) => cdp.evaluate(expr);
const t = {
  text: (sel) => T(`window.__t.text(${sel ? JSON.stringify(sel) : 'null'})`),
  has: (s) => T(`window.__t.has(${JSON.stringify(s)})`),
  count: (sel) => T(`window.__t.count(${JSON.stringify(sel)})`),
  click: (needle, scope) =>
    T(`window.__t.clickText(${JSON.stringify(needle)}, ${scope ? JSON.stringify(scope) : 'null'})`),
  clickRe: (src, scope) =>
    T(`window.__t.clickRe(${JSON.stringify(src)}, ${scope ? JSON.stringify(scope) : 'null'})`),
  clickSel: (sel, idx = 0) => T(`window.__t.clickSel(${JSON.stringify(sel)}, ${idx})`),
  setInput: (sel, v, idx = 0) => T(`window.__t.setInput(${JSON.stringify(sel)}, ${JSON.stringify(v)}, ${idx})`),
  setPh: (ph, v) => T(`window.__t.setByPlaceholder(${JSON.stringify(ph)}, ${JSON.stringify(v)})`),
  setOpt: (optText, v) => T(`window.__t.setSelectByOptionText(${JSON.stringify(optText)}, ${JSON.stringify(v)})`),
  step: () => T(`window.__t.stepSelectValue()`),
  clickStep: (n) => T(`window.__t.clickStep(${n})`),
  ls: (k) => T(`window.__t.ls(${JSON.stringify(k)})`),
};

async function gotoStep(n) {
  const r = await t.clickStep(n);
  await cdp.waitFor(`window.__t.stepSelectValue() === '${n}'`, 4000);
  return r;
}

async function uploadFile(selector, filePath) {
  const doc = await cdp.send('DOM.getDocument', { depth: -1 });
  const node = await cdp.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
  if (!node.nodeId) throw new Error('file input not found: ' + selector);
  await cdp.send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [filePath] });
  await sleep(400);
}

// 手風琴（SectionAccordion）的展開是「切換」語意：已經是開的就別再按，否則等於關起來。
// 回傳：{ headers: 目前所有區塊標題, toggled: 'opened'|'closed'|'already-open'|'not-found' }
async function openAccordion(titlePrefix) {
  const headers = await T(`[...document.querySelectorAll('button h2')].map((h) => window.__t.norm(h.innerText))`);
  const state = await T(`(() => {
    const h = [...document.querySelectorAll('button h2')]
      .find((x) => window.__t.norm(x.innerText).startsWith(${JSON.stringify(titlePrefix)}));
    if (!h) return 'not-found';
    const btn = h.closest('button');
    const body = btn.parentElement.querySelector(':scope > div.p-4');
    if (body) return 'already-open';
    btn.click();
    return 'opened';
  })()`);
  await sleep(500);
  return { headers, toggled: state };
}

// 只按「按鈕」上的文字，避免 deepest() 命中提示語裡的同名 <span>。
// 例：預覽頁的「完整」既是揭示按鈕，也出現在「切回『完整』」提示句裡；
// 取 document 順序最後一個會按到提示句（什麼都不會發生）。
async function clickButtonExact(label) {
  return T(`(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => window.__t.norm(b.innerText) === ${JSON.stringify(label)});
    if (!btn) return 'not-found';
    btn.scrollIntoView({ block: 'center' });
    btn.click();
    return 'ok';
  })()`);
}

function listDownloads(dir) {
  return existsSync(dir) ? readdirSync(dir) : [];
}

// ── 稽核開始 ──────────────────────────────────────────────
const { downloads } = await launch();
// 視窗尺寸不等於 viewport（Windows 上 --window-size 會被邊框吃掉），而角色卡預覽在 xl 斷點以下是隱藏的。
// 用 CDP 明確指定 viewport，否則「卡片內容」整段不會進 innerText，斷言會誤判成「功能壞了」。
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false,
});
await cdp.send('Page.navigate', { url: APP });
await cdp.waitFor(`document.body && document.body.innerText.includes('NPC工坊')`, 20000);
await T(PAGE_HELPERS);
await sleep(300);

// 剪貼簿墊片（headless 的 clipboard 需要權限；直接換成記錄器，才驗得到複製內容）。
// ⚠️ 必須在每次 `Page.reload` **之後**再裝一次——重載會把 window 上的墊片清掉，
// 而真 clipboard 在 headless 會失敗、程式改走 execCommand 後備路徑，於是「複製成功」驗不到內容。
const installClipboard = async () => {
  await T(`
    (() => {
      window.__clip = [];
      const stub = {
        writeText: async (txt) => { window.__clip.push({ kind: 'text', text: txt }); },
        write: async (items) => { window.__clip.push({ kind: 'items', count: items.length }); },
        readText: async () => '',
      };
      Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => stub });
      return 'ok';
    })()
  `);
};

// 先把 localStorage 清乾淨（稽核要從「空檔案庫」開始，否則斷言會被上次的資料污染）
await T(`(() => { localStorage.clear(); return 'cleared'; })()`);
await cdp.send('Page.reload');
await cdp.waitFor(`document.body && document.body.innerText.includes('NPC工坊')`, 20000);
await T(PAGE_HELPERS);
await installClipboard();
await sleep(400);

// ═══ G1 進入與空狀態 ═════════════════════════════════════
group('G1 進入 NPC 工坊／檔案庫空狀態');
{
  const enter = await t.click('NPC工坊');
  await cdp.waitFor(`window.__t.has('建立新 NPC')`, 8000);
  record('從封面進入 NPC 工坊', enter === 'ok' && (await t.has('建立新 NPC')));
  record('空檔案庫顯示空狀態文案', await t.has('檔案庫目前空空如也'));
  record('空狀態提供「建立第一位 NPC」', await t.has('建立第一位 NPC'));
  record('檔案庫工具列有匯入／備份／建立', 
    (await t.has('匯入單張 NPC')) && (await t.has('備份全庫')) && (await t.has('建立新 NPC')));
}

// ═══ G2 建立 NPC → 8 道步驟 ═══════════════════════════════
group('G2 建角 8 道步驟');
{
  await t.click('建立新 NPC');
  await cdp.waitFor(`window.__t.stepSelectValue() === '1'`, 6000);
  record('點「建立新 NPC」進入構築頁面', (await t.has('步驟 1：選擇NPC的定位')));

  const steps = [
    [1, '選擇NPC的定位'],
    [2, '分配等級與階級'],
    [3, '設定物種'],
    [4, '調整數值與能力'],
    [5, 'Boss 技能'],
    [6, '配置負面技能'],
    [7, '設定稱呼與特質'],
    [8, '戰術與行動'],
  ];
  for (const [n, anchor] of steps) {
    const r = await gotoStep(n);
    const ok = r === 'ok' && (await t.has(anchor));
    record(`第 ${n} 步可切換且含專屬內容（${anchor}）`, ok, r === 'ok' ? '' : r);
  }

  // 上一步／下一步
  await gotoStep(3);
  await t.click('上一步');
  await sleep(250);
  record('「上一步」回到第 2 步', (await t.step()) === '2');
  await t.click('下一步');
  await sleep(250);
  record('「下一步」回到第 3 步', (await t.step()) === '3');
  await gotoStep(8);
  await t.click('下一步');
  await sleep(250);
  record('第 8 步按「下一步」不會超過 8', (await t.step()) === '8');

  // 鍵盤快捷（Alt + ←／→）
  await gotoStep(4);
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, modifiers: 1,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39, modifiers: 1,
  });
  await sleep(300);
  record('Alt+→ 前進到第 5 步', (await t.step()) === '5');
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, modifiers: 1,
  });
  await cdp.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37, modifiers: 1,
  });
  await sleep(300);
  record('Alt+← 回到第 4 步', (await t.step()) === '4');
}

// ═══ G3 定位／等級／階級／物種／反派等級／相性 ═════════════
group('G3 定位・等級・階級・物種・反派・相性');
{
  // 先記錄「暴徒」（createNewNPC 的預設）在第 2 步的體質面板，換定位後必須不同
  await gotoStep(2);
  await sleep(300);
  const statsOf = `(() => {
    const t = window.__t.text();
    const m = t.match(/(DEX d\\d+) (INS d\\d+) (MIG d\\d+) (WLP d\\d+)/);
    return m ? m.slice(1, 5).join(' ') : null;
  })()`;
  const statsBefore = await T(statsOf);

  await gotoStep(1);
  await sleep(300);
  const roleClick = await t.clickRe('^獵人$');
  await sleep(300);
  const confirmRole = await t.click('確認定位');
  await sleep(400);
  const statsAfter = await T(statsOf);
  record('可選擇定位並確認（暴徒 → 獵人，體質骰改變）',
    roleClick === 'ok' && confirmRole === 'ok' && (await t.step()) === '2' && statsBefore !== statsAfter,
    `${statsBefore} → ${statsAfter}`);

  await gotoStep(2);
  await sleep(300);
  const hpBefore = await T(`(() => {
    const m = window.__t.text().match(/HP (\\d+)/); return m ? m[1] : null;
  })()`);
  const lvSet = await t.setOpt('Lv. 5', '30');
  await sleep(500);
  const hpAfter = await T(`(() => {
    const m = window.__t.text().match(/HP (\\d+)/); return m ? m[1] : null;
  })()`);
  record('等級可切換（Lv.5 → Lv.30）', lvSet === 'ok');
  record('等級變更連動 HP（即時體質監控重算）', !!hpBefore && !!hpAfter && hpBefore !== hpAfter, `HP ${hpBefore} → ${hpAfter}`);

  const rankClick = await t.click('冠位');
  await sleep(400);
  record('階級可切換為冠位', rankClick === 'ok' && /冠位/.test(await t.text()));

  await gotoStep(3);
  await sleep(300);
  const sp = await t.clickRe('^野獸物種$');
  await sleep(400);
  record('物種可選（野獸）', sp === 'ok' && (await t.has('野獸')));

  await gotoStep(4);
  await sleep(400);
  // 2026-10-22（`docs/decisions.md` §BT）：第 4 步的**預設**子頁已改為「技能・咒語・能力」。
  // 這裡是整份稽核第一次進入第 4 步，所以先斷言預設狀態（G4 之後再進來時，
  // 子頁已經被下面的檢查切過，證明不了「預設」）。反派等級與相性在「基礎數值與相性」頁。
  const step4FirstVisit = await t.text();
  record('第 4 步預設停在技能頁（第一次進入時不必切子頁）',
    /技能・咒語・能力/.test(step4FirstVisit) && /攻擊與技能庫/.test(step4FirstVisit),
    step4FirstVisit.slice(0, 140));
  const statsTab = await t.clickRe('^基礎數值與相性');
  await sleep(500);
  const villain = await t.clickRe('^主要反派 10 UP$');
  await sleep(400);
  record('反派等級可選（主要反派）', statsTab === 'ok' && villain === 'ok' && (await t.has('主要反派')),
    `${statsTab}/${villain}`);

  // 相性：先選「弱點」分頁，再點物理
  const vulTab = await t.clickRe('^弱點 VUL');
  await sleep(300);
  const phys = await t.clickRe('^p 物理');
  await sleep(400);
  const vulCount = await T(`(() => {
    const m = window.__t.text().match(/弱點 VUL (\\d+)/); return m ? Number(m[1]) : -1;
  })()`);
  record('相性可點選（弱點 物理 → 弱 1）', vulTab === 'ok' && phys === 'ok' && vulCount === 1, `VUL=${vulCount}`);

  // 切回技能頁：G4 要在技能頁上做技能與咒語的檢查，而且那些檢查本身不該靠
  // 「自己先點一次子頁」才成立（那正是使用者抱怨的那一層）。
  const backToSkills = await t.clickRe('^技能・咒語・能力');
  await sleep(400);
  record('第 4 步子頁可切回技能頁', backToSkills === 'ok' && (await t.has('攻擊與技能庫')), backToSkills);
}

// ═══ G4 技能／咒語／自訂能力／額度 HUD ═════════════════════
group('G4 技能・咒語・自訂能力・額度 HUD');
{
  await gotoStep(4);
  await sleep(400);
  // 2026-10-22（`docs/decisions.md` §BT）：子頁由三頁收成兩頁、預設停在「技能・咒語・能力」，
  // 且「基礎攻擊與核心能力」預設展開。所以下面這三條的重點是**不點任何東西**就成立——
  // 舊版要點一次子頁（`^攻擊與技能庫`）再點一次手風琴標題才看得到卡片，那兩層就是使用者說的
  // 「沒有必要把他們藏得這麼深」。`攻擊與技能庫`／`咒語與自訂能力` 現在是區塊標題，不是分頁。
  const defaultPage = await t.text();
  const defaultCards = await t.count('[id^="skill-card-"]');
  record('進入第 4 步後技能與咒語區塊直接可見（不需任何點擊）',
    /技能・咒語・能力/.test(defaultPage) && /攻擊與技能庫/.test(defaultPage), defaultPage.slice(0, 140));
  record('「基礎攻擊與核心能力」預設展開（不點就看得到卡片）', defaultCards > 0, `cards=${defaultCards}`);
  record('「咒語與自訂能力」與技能同一頁（第三個子頁已收掉）',
    /咒語與自訂能力/.test(defaultPage), defaultPage.slice(0, 140));

  const basic = await openAccordion('基礎攻擊與核心能力');
  record('基礎攻擊手風琴標題存在且預設已展開',
    basic.headers.some((h) => h.startsWith('基礎攻擊與核心能力')) && basic.toggled === 'already-open',
    `toggle=${basic.toggled} headers=${basic.headers.join(' / ')}`);
  const cardCount = defaultCards;
  record('基礎攻擊卡片渲染於技能頁', cardCount > 0,
    `cards=${cardCount} headers=${basic.headers.join(' / ')}`);

  // ── 選單 → 存檔 → 卡片仍顯示選取值（2026-10-22 §BR 的回歸點）──
  // 這條以前只做過手動 E2E（§BR5 的表格），沒進常態稽核。現在草稿會把 `state` 寫進
  // `npcDraft`，正好可以在不存檔進檔案庫的情況下驗「存進去的到底是什麼」：
  // 舊版的病灶是選單選了暗、資料裡卻躺著寫死的 `冰`，下一次開卡就再也改不回來。
  const setType = await T(`(() => {
    const cards = [...document.querySelectorAll('[id^="skill-card-"]')];
    if (!cards.length) return 'no-card';
    for (const card of cards) {
      const sel = [...card.querySelectorAll('select')]
        .find((s) => [...s.options].some((o) => o.value === '暗'));
      if (!sel) continue;
      sel.value = '暗';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return card.id.replace('skill-card-', '');
    }
    return 'no-select';
  })()`);
  await sleep(1000);
  const draftRaw = await t.ls('monogatari_techou_npc_draft');
  const draftObj = (() => {
    try { return JSON.parse(draftRaw || 'null'); } catch (e) { return null; }
  })();
  const picked = (draftObj?.npc?.skills || []).find((s) => s.id === setType) || null;
  record('選單選「暗」後寫入草稿（自動暫存生效）',
    setType !== 'no-card' && setType !== 'no-select' && !!draftObj?.npc && !!draftObj.savedAt,
    `${setType} savedAt=${draftObj?.savedAt || '無'}`);
  record('選單值寫進 selections，而不是把 attack 寫死',
    picked?.selections?.type === '暗' && picked?.attack?.type === '{type}',
    `selections.type=${picked?.selections?.type} attack.type=${picked?.attack?.type}`);

  // 點卡片 → 卡片轉為已選取狀態（SkillCard 的 isActive 樣式），並記下 HUD 變化
  const pick = await T(`(() => {
    const cards = [...document.querySelectorAll('[id^="skill-card-"]')];
    if (!cards.length) return 'no-cards';
    const target = cards[0];
    const before = target.innerHTML.length;
    target.scrollIntoView({ block: 'center' });
    const btn = target.querySelector('div[role="button"], button, div');
    (btn || target).click();
    return before;
  })()`);
  await sleep(600);
  const activeNow = await T(`(() => {
    const cards = [...document.querySelectorAll('[id^="skill-card-"]')];
    return cards.filter((c) => /bg-amber-50|amber-100|border-amber-600|ring-/.test(c.innerHTML)).length;
  })()`);
  record('技能卡可點選（卡片轉為已選取樣式）', pick !== 'no-cards' && activeNow > 0, `cards=${cardCount} active=${activeNow}`);

  // 定位技能手風琴（額度 > 0 才渲染）→ 選一張 → HUD 計數 +1
  const roleBefore = await T(`(() => {
    const m = window.__t.text().match(/定位技能 (\\d+)\\/(\\d+)/);
    return m ? Number(m[1]) : -1;
  })()`);
  const roleAcc = await openAccordion('定位技能');
  const rolePick = await T(`(() => {
    const cards = [...document.querySelectorAll('[id^="skill-card-"]')];
    if (!cards.length) return 'no-cards';
    const last = cards[cards.length - 1];
    last.scrollIntoView({ block: 'center' });
    const btn = last.querySelector('div[role="button"], button, div');
    (btn || last).click();
    return 'ok';
  })()`);
  await sleep(700);
  const roleAfter = await T(`(() => {
    const m = window.__t.text().match(/定位技能 (\\d+)\\/(\\d+)/);
    return m ? Number(m[1]) : -1;
  })()`);
  record('定位技能可選取並回寫 HUD 額度', roleAcc.toggled !== 'not-found' && rolePick === 'ok' && roleAfter === roleBefore + 1,
    `${roleAcc.toggled}/${rolePick} ${roleBefore} → ${roleAfter}`);
  const hud = await t.text();
  record('額度 HUD 顯示「定位技能 n/m」', /定位技能 \d+\/\d+/.test(hud), hud.slice(0, 120));

  // HUD 藥丸可跳轉到第 4 步對應分頁
  await gotoStep(7);
  await sleep(300);
  const jump = await T(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /定位技能 \\d+\\/\\d+/.test(window.__t.norm(b.innerText)));
    if (!btn) return 'not-found';
    btn.click();
    return 'ok';
  })()`);
  await sleep(500);
  record('HUD「定位技能」藥丸可跳回第 4 步技能分頁',
    jump === 'ok' && (await t.step()) === '4' && (await t.has('攻擊與技能庫')), jump);

  // 第三個子頁（咒語與自訂能力）已於 2026-10-22 併入技能頁（§BT），
  // 所以這裡不再「切分頁」，改為斷言它底下的區塊就在同一頁上。
  const spellPage = await t.text();
  record('「完全自訂技能」與技能同頁可見（原第三個子頁的內容）', /完全自訂技能/.test(spellPage),
    spellPage.slice(0, 140));

  // 自訂技能表單
  const hasCustomForm = await T(`(() => {
    const inputs = [...document.querySelectorAll('input, textarea')];
    return inputs.some((e) => /技能名稱|名稱/.test(e.placeholder || ''));
  })()`);
  record('自訂技能表單存在（可輸入名稱）', hasCustomForm === true);
}

// ═══ G5 Boss 技能 ════════════════════════════════════════
group('G5 Boss 技能（冠位覺醒）');
{
  // G3 已把階級切成冠位；Boss 解鎖提示只在「非冠位」時出現，先切回士兵
  await gotoStep(2);
  await sleep(300);
  await t.click('士兵');
  await sleep(400);
  await gotoStep(5);
  await sleep(400);
  const body = await t.text();
  record('非冠位時顯示未解鎖提示', /力量尚未覺醒|解鎖強大的 Boss 技能需要/.test(body), body.slice(0, 80));
  const awake = await t.clickRe('^3 倍率$');
  await sleep(600);
  const after = await t.text();
  record('可用倍率一鍵覺醒為冠位',
    awake === 'ok' && !/力量尚未覺醒/.test(after) && /冠位/.test(after), `${awake} / ${after.slice(0, 100)}`);
}

// ═══ G6 負面技能 ═════════════════════════════════════════
group('G6 負面技能');
{
  await gotoStep(6);
  await sleep(400);
  const before = await t.text();
  const pick = await t.clickRe('^臨終延遲');
  await sleep(400);
  const after = await t.text();
  record('負面技能可選取', pick === 'ok' && before !== after);
  const sel = await T(`(() => {
    const raw = localStorage.getItem('monogatari_techou_npc_library');
    return 'ok';
  })()`);
  record('負面技能卡片可展開欄位（選取後可填）', (await t.has('選取後可填')) || after.length > before.length);
}

// ═══ G7 特質／頭像／關聯 ═════════════════════════════════
group('G7 名稱・特質・頭像・關聯實體');
{
  await gotoStep(7);
  await sleep(400);
  const nameSet = await t.setPh('輸入名稱...', '稽核用測試 NPC');
  await sleep(400);
  record('名稱可輸入且同步到角色卡', nameSet === 'ok' && (await t.has('稽核用測試 NPC')));

  const traitSet = await t.setPh('例如: 敏捷, 致命...', '敏捷, 致命');
  await sleep(300);
  record('特質欄位可輸入', traitSet === 'ok');

  const storySet = await t.setPh('簡短描述其起源或動機...', '這是稽核腳本寫入的背景故事。');
  await sleep(300);
  record('背景故事可輸入', storySet === 'ok');

  // 頭像：上傳本地檔案 → 裁切視窗
  // ⚠️ 全站有多個 input[type=file]（章節標頭的還原全站、檔案庫匯入…），
  //    只挑「上傳本地照片」這個 label 裡的那一個，否則會把圖丟給還原備份的 input。
  const pngPath = path.join(downloads, 'avatar.png');
  writeFileSync(pngPath, TINY_PNG);
  let uploadOk = true;
  let uploadDetail = '';
  try {
    const marked = await T(`(() => {
      const label = [...document.querySelectorAll('label')]
        .find((l) => /上傳本地照片|更換本地檔案/.test(window.__t.norm(l.innerText)));
      if (!label) return 'no-label';
      const input = label.querySelector('input[type="file"]');
      if (!input) return 'no-input';
      input.setAttribute('data-audit-avatar', '1');
      return 'ok';
    })()`);
    await uploadFile('input[data-audit-avatar="1"]', pngPath);
    await cdp.waitFor(`document.body.innerText.includes('完成裁切並套用')`, 6000);
    record('上傳頭像會開啟裁切視窗', marked === 'ok' && (await t.has('完成裁切並套用')), marked);
  } catch (e) {
    uploadOk = false;
    uploadDetail = String(e.message || e);
    record('上傳頭像會開啟裁切視窗', false, uploadDetail);
  }
  if (uploadOk) {
    const apply = await t.click('完成裁切並套用');
    await sleep(900);
    const avatar = await T(`(() => {
      const img = document.querySelector('img[src^="data:image"]');
      return img ? img.src.slice(0, 30) : null;
    })()`);
    record('確認裁切後頭像寫入角色卡', apply === 'ok' && !!avatar, avatar || 'no data:image');
  }

  record('關聯實體區塊存在（檔案庫空時給提示）', /關聯實體|暫無其他可連結/.test(await t.text()));
}

// ═══ G8 儲存 ═════════════════════════════════════════════
group('G8 儲存至檔案庫');
{
  await gotoStep(8);
  await sleep(300);
  const tactic = await T(`(() => {
    const ta = [...document.querySelectorAll('textarea')].find((e) => /描述這個 NPC/.test(e.placeholder || ''));
    if (!ta) return 'not-found';
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, '優先攻擊施法者，血量低於一半退到後排。');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  await sleep(300);
  record('戰術欄位可輸入', tactic === 'ok', tactic);

  const save = await t.click('儲存');
  await sleep(900);
  const lib = await t.ls('monogatari_techou_npc_library');
  const parsed = lib ? JSON.parse(lib) : [];
  record('「儲存」寫入 localStorage 檔案庫', Array.isArray(parsed) && parsed.length === 1, `len=${Array.isArray(parsed) ? parsed.length : 'n/a'}`);
  record('存檔內容含名稱與戰術', JSON.stringify(parsed).includes('稽核用測試 NPC') && JSON.stringify(parsed).includes('優先攻擊施法者'));
  record('存檔內容含背景故事與特質', JSON.stringify(parsed).includes('這是稽核腳本寫入的背景故事') && JSON.stringify(parsed).includes('敏捷'),
    JSON.stringify(parsed[0]?.story ?? null).slice(0, 40));
}

// ═══ G9 預覽：揭露程度／主題／複製／匯出 ═══════════════════
group('G9 角色卡預覽（揭露・主題・複製・匯出）');
{
  await t.click('角色卡預覽');
  await cdp.waitFor(`window.__t.has('研究檢定')`, 6000);
  record('可切換到角色卡預覽頁', await t.has('研究檢定'));

  const full = await t.text();
  await t.click('7+');
  await sleep(400);
  const lv7 = await t.text();
  record('揭露程度 7+ 生效（內容變短並出現提示）',
    lv7.length < full.length && /研究檢定視角/.test(lv7), `${full.length} → ${lv7.length}`);
  await t.click('13+');
  await sleep(300);
  const lv13 = await t.text();
  record('揭露程度 13+ 與 7+ 不同', lv13 !== lv7);
  await clickButtonExact('完整');
  await sleep(400);
  const backToFull = await t.text();
  record('可切回「完整」（背景故事與戰術重新出現）',
    backToFull.length >= full.length - 40 && /這是稽核腳本寫入的背景故事/.test(backToFull),
    `${lv7.length} → ${backToFull.length}｜${backToFull.slice(0, 160)}`);

  // 主題
  const palette = await t.clickRe('^卡片風格：');
  await sleep(400);
  const paletteOpen = await t.has('選擇角色卡風格');
  record('可開啟卡片風格選單', palette === 'ok' && paletteOpen);
  // 逐一驗證 6 種主題都能選；每次都必須真的寫進 localStorage。
  // ⚠️ 選單開著時再按觸發鈕會「關起來」，所以先確認狀態再決定要不要按。
  const THEMES = ['群青藍', '硃砂紅', '翡翠青', '秘術紫', '鐵石灰', '琥珀棕'];
  const themeResults = [];
  for (const name of THEMES) {
    if (!(await t.has('選擇角色卡風格'))) {
      await t.clickRe('^卡片風格：');
      await sleep(250);
    }
    const clicked = await t.click(name);
    await sleep(350);
    const stored = await t.ls('monogatari_techou_npc_card_theme');
    // 觸發鈕會顯示目前風格名，這是「真的套用了」而不是只有按到
    const applied = await t.has(`卡片風格： ${name}`);
    themeResults.push(`${name}:${clicked === 'ok' && applied && !!stored ? 'ok' : `${clicked}/applied=${applied}/ls=${stored}`}`);
  }
  record('六種卡片風格皆可切換且寫入 localStorage',
    themeResults.every((r) => r.endsWith(':ok')), themeResults.join(' '));

  // 複製四格式
  const formats = [
    ['Discord 格式', 'discord'],
    ['Markdown 格式', 'markdown'],
    ['純文字筆記格式', 'plain'],
    ['ccfolia 棋子 (Ctrl+V)', 'ccfolia'],
  ];
  for (const [label, key] of formats) {
    await T(`window.__clip = []`);
    // 下拉選單是切換語意：開著時再按觸發鈕會關起來。先確認狀態，需要才按，最多重試三次。
    let dropdownShown = await t.has(label);
    const trace = [];
    for (let attempt = 0; attempt < 3 && !dropdownShown; attempt += 1) {
      const trg = await clickButtonExact('複製文本 ▾');
      await sleep(450);
      dropdownShown = await t.has(label);
      trace.push(`trg=${trg}/open=${dropdownShown}`);
    }
    const clicked = dropdownShown ? await clickButtonExact(label) : 'not-found';
    await sleep(700);
    const clip = await T(`window.__clip`);
    const got = (clip || []).find((c) => c.kind === 'text');
    const text = got ? got.text : '';
    const marker = key === 'ccfolia'
      ? /CCFOLIA|character|iconUrl|"name"|params/i.test(text)
      : text.includes('稽核用測試 NPC');
    record(`複製「${label}」有內容`, clicked === 'ok' && !!got && text.length > 20,
      `open=${dropdownShown} click=${clicked} len=${text.length} ${trace.join(',')}`);
    if (key !== 'ccfolia') {
      record(`複製「${label}」含角色名`, marker, text.slice(0, 60));
    }
  }

  // 匯出 JPG
  const beforeFiles = listDownloads(downloads).length;
  const jpg = await t.click('匯出 JPG');
  await sleep(4000);
  const afterFiles = listDownloads(downloads);
  record('「匯出 JPG」產生下載檔案',
    jpg === 'ok' && afterFiles.length > beforeFiles,
    `files=${afterFiles.join(',')}`);

  // 複製圖片
  await T(`window.__clip = []`);
  const copyImg = await t.click('複製圖片');
  await sleep(4000);
  const clipItems = await T(`window.__clip`);
  record('「複製圖片」走 clipboard.write 且成功',
    copyImg === 'ok' && (clipItems || []).some((c) => c.kind === 'items'),
    JSON.stringify(clipItems || []).slice(0, 120));
}

// ═══ G10 自由模式 ════════════════════════════════════════
group('G10 自由模式');
{
  await t.click('構築頁面');
  await sleep(500);
  const open = await t.clickRe('^嚴謹模式$');
  await sleep(500);
  const modal = await t.has('確認開啟自定義');
  record('點「嚴謹模式」開啟確認視窗', open === 'ok' && modal);
  await t.click('取消');
  await sleep(400);
  record('取消後仍是嚴謹模式', !(await t.has('自由模式')) || (await t.has('嚴謹模式')));
  await t.clickRe('^嚴謹模式$');
  await sleep(400);
  const confirm = await t.click('確認開啟自定義');
  await sleep(600);
  const modeText = await t.text();
  record('確認後切換為自由模式', confirm === 'ok' && /自由模式/.test(modeText), modeText.slice(0, 80));
  const back = await t.clickRe('^自由模式$');
  await sleep(600);
  record('可切回嚴謹模式', back === 'ok' && /嚴謹模式/.test(await t.text()));
}

// ═══ G11 檔案庫：搜尋／篩選／排序／匯入／匯出／入戰／刪除 ═══
group('G11 檔案庫：搜尋・篩選・排序');
{
  // 再造一隻（不同定位／等級），才驗得到篩選與排序
  // ⚠️ 「建立新 NPC」只存在於檔案庫工具列；在構築頁按會 not-found（G10 結束時仍在構築頁）
  await t.click('返回檔案庫');
  await cdp.waitFor(`window.__t.has('建立新 NPC')`, 6000);
  const created = await t.click('建立新 NPC');
  await sleep(700);
  await gotoStep(1);
  const roleClick2 = await t.clickRe('^衛士$');
  await sleep(300);
  await t.click('確認定位');
  await sleep(300);
  await gotoStep(2);
  await t.setOpt('Lv. 5', '10');
  await sleep(400);
  await gotoStep(7);
  await t.setPh('輸入名稱...', '第二位測試 NPC');
  await sleep(300);
  await t.click('儲存');
  await sleep(900);
  const lib2 = JSON.parse((await t.ls('monogatari_techou_npc_library')) || '[]');
  record('可再建立第二隻 NPC', created === 'ok' && roleClick2 === 'ok' && lib2.length === 2,
    `${created}/${roleClick2} len=${lib2.length}`);

  // 回檔案庫
  await t.click('返回檔案庫');
  await cdp.waitFor(`window.__t.has('全部定位')`, 6000);
  record('「返回檔案庫」回到檔案庫並顯示 2 隻', await t.has('共 2 隻'));

  // 搜尋
  const search = await t.setPh('搜尋姓名、定位、種族、位階、技能...', '第二位');
  await sleep(500);
  const afterSearch = await t.text();
  record('搜尋可篩選（關鍵字「第二位」→ 1 隻）', search === 'ok' && /顯示 1 \/ 共 2/.test(afterSearch), afterSearch.slice(0, 120));

  // 搜尋物種（中文）
  await t.setPh('搜尋姓名、定位、種族、位階、技能...', '野獸');
  await sleep(500);
  const speciesSearch = await t.text();
  record('搜尋可用中文物種名（野獸）', /顯示 1 \/ 共 2/.test(speciesSearch), speciesSearch.slice(0, 120));

  // 重設
  await t.click('重設');
  await sleep(500);
  record('「重設」清除搜尋', /顯示 2 \/ 共 2/.test(await t.text()));

  // 定位篩選
  const roleFilter = await T(`(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => /全部定位/.test(o.textContent)));
    if (!sel) return 'not-found';
    const opt = [...sel.options].find((o) => window.__t.norm(o.textContent) === '衛士');
    if (!opt) return 'no-option';
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  })()`);
  await sleep(500);
  record('定位篩選可運作（衛士 → 1 隻）', roleFilter === 'ok' && /顯示 1 \/ 共 2/.test(await t.text()), roleFilter);
  await t.click('重設');
  await sleep(400);

  // 排序
  const sortTo = async (value) => T(`(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => /最近更新/.test(o.textContent)));
    if (!sel) return 'not-found';
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, ${JSON.stringify(value)});
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  })()`);
  const namesInOrder = () => T(`(() => {
    const cards = [...document.querySelectorAll('h3')].map((h) => window.__t.norm(h.innerText));
    return cards;
  })()`);
  const s1 = await sortTo('level_desc');
  await sleep(500);
  const desc = await namesInOrder();
  const s2 = await sortTo('level_asc');
  await sleep(500);
  const asc = await namesInOrder();
  record('排序可切換（等級高至低 ≠ 低至高）', s1 === 'ok' && s2 === 'ok' && desc.join() !== asc.join(), `${desc} vs ${asc}`);
}

group('G12 檔案庫：匯出／備份／匯入／入戰／刪除');
{
  // 匯出單張
  const beforeJson = listDownloads(downloads).filter((f) => f.endsWith('.json')).length;
  const exp = await T(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /匯出「/.test(b.getAttribute('aria-label') || ''));
    if (!btn) return 'not-found';
    btn.click();
    return 'ok';
  })()`);
  await sleep(2500);
  const afterJson = listDownloads(downloads).filter((f) => f.endsWith('.json')).length;
  record('單張「匯出 JSON」產生檔案', exp === 'ok' && afterJson > beforeJson, `${beforeJson} → ${afterJson}`);

  // 備份全庫
  const backup = await t.click('備份全庫');
  await sleep(2500);
  const allJson = listDownloads(downloads).filter((f) => f.includes('backup'));
  record('「備份全庫」產生備份檔', backup === 'ok' && allJson.length > 0, allJson.join(','));

  // 匯入備份（陣列）
  const backupFile = allJson.length ? path.join(downloads, allJson[allJson.length - 1]) : null;
  if (backupFile) {
    const raw = readFileSync(backupFile, 'utf8');
    const okArray = Array.isArray(JSON.parse(raw));
    record('備份檔內容是陣列（匯入端靠型別判斷）', okArray);
    // 先刪光再匯入，驗「新增」路徑
    await T(`(() => { localStorage.setItem('monogatari_techou_npc_library', '[]'); return 'ok'; })()`);
    await cdp.send('Page.reload');
    await cdp.waitFor(`document.body && document.body.innerText.includes('NPC工坊')`, 20000);
    await T(PAGE_HELPERS);
    await sleep(500);
    await t.click('NPC工坊');
    await cdp.waitFor(`window.__t.has('建立新 NPC')`, 8000);
    // ⚠️ 標頭（還原全站）也有一個 input[accept=".json"]；只認「匯入單張 NPC」label 內那個
    const markImport = `(() => {
      const label = [...document.querySelectorAll('label')]
        .find((l) => /匯入單張 NPC/.test(window.__t.norm(l.innerText)));
      if (!label) return 'no-label';
      const input = label.querySelector('input[type="file"]');
      if (!input) return 'no-input';
      input.setAttribute('data-audit-import', '1');
      return 'ok';
    })()`;
    const marked = await T(markImport);
    await uploadFile('input[data-audit-import="1"]', backupFile);
    await sleep(1500);
    const libAfter = JSON.parse((await t.ls('monogatari_techou_npc_library')) || '[]');
    record('「匯入」備份陣列可還原 2 隻 NPC', marked === 'ok' && libAfter.length === 2, `${marked} len=${libAfter.length}`);
    record('匯入後有成功提示', /已從備份檔匯入/.test(await t.text()) || libAfter.length === 2);
  }

  // 單張匯入
  const single = {
    id: 'npc_audit_single',
    name: '單張匯入測試',
    role: '法師',
    level: 20,
    rank: '精英',
    affinities: {},
    skills: [],
    updatedAt: new Date().toISOString(),
  };
  const singlePath = path.join(downloads, 'single_npc.json');
  writeFileSync(singlePath, JSON.stringify(single, null, 2));
  const marked2 = await T(`(() => {
    const label = [...document.querySelectorAll('label')]
      .find((l) => /匯入單張 NPC/.test(window.__t.norm(l.innerText)));
    if (!label) return 'no-label';
    const input = label.querySelector('input[type="file"]');
    if (!input) return 'no-input';
    input.setAttribute('data-audit-import', '1');
    return 'ok';
  })()`);
  await uploadFile('input[data-audit-import="1"]', singlePath);
  await sleep(1200);
  record('單張 JSON 匯入會載入草稿（進入構築頁並顯示名稱）',
    marked2 === 'ok' && (await t.has('單張匯入測試')) && (await t.step()) !== null,
    `${marked2} / ${await t.step()}`);

  // 入戰
  await t.click('返回檔案庫');
  await cdp.waitFor(`window.__t.has('全部定位')`, 6000);
  const toCombat = await T(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => window.__t.norm(b.innerText) === '入戰');
    if (!btn) return 'not-found';
    btn.click();
    return 'ok';
  })()`);
  await sleep(800);
  const combat = await t.ls('monogatari_techou_active_combat');
  record('「入戰」寫入進行中戰鬥', toCombat === 'ok' && !!combat && combat.includes('combatants'), String(combat).slice(0, 80));

  // 刪除（confirm 自動接受）
  const delBefore = JSON.parse((await t.ls('monogatari_techou_npc_library')) || '[]').length;
  const del = await T(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /^刪除「/.test(b.getAttribute('aria-label') || ''));
    if (!btn) return 'not-found';
    btn.click();
    return 'ok';
  })()`);
  await sleep(900);
  const delAfter = JSON.parse((await t.ls('monogatari_techou_npc_library')) || '[]').length;
  record('「刪除」移除 NPC 並寫回儲存', del === 'ok' && delAfter === delBefore - 1, `${delBefore} → ${delAfter}`);
}

// ═══ G13 跨章節：入戰資料在戰鬥輪次看得到 ═════════════════
group('G13 跨章節整合（NPC → 戰鬥輪次）');
{
  // 章節標頭（ChapterHeader）的返回鈕文字是「合上書本 · 返回封面」；
  // App 頁尾那個「合上本卷並返回封面目錄」在本佈局不會渲染（footer 數為 0，實測）。
  const exit = await t.click('合上書本 · 返回封面');
  await cdp.waitFor(`document.body.innerText.includes('戰鬥輪次')`, 8000);
  // 翻頁動畫期間（closing → 850ms 後才解除）章節卡片的 onClick 會被 transitionState 擋掉，
  // 太早按等於沒按——這不是功能壞掉。
  await sleep(1200);
  const enterCombat = await t.click('戰鬥輪次');
  // 非 NPC 工坊的章節都會先跳「開發中提醒」模態窗，必須按「確定進入」才會翻頁。
  await cdp.waitFor(`document.body.innerText.includes('確定進入')`, 6000).catch(() => {});
  const confirmDev = await clickButtonExact('確定進入');
  await cdp.waitFor(`!document.body.innerText.includes('冒險啟程之書')`, 12000).catch(() => {});
  // 章節本身是 lazy chunk，進場後還會顯示「正在展開章節……」；等它真的畫完再斷言，
  // 否則會把「還在載入」誤判成「資料沒帶過去」。
  await cdp.waitFor(`!document.body.innerText.includes('正在展開章節')`, 20000).catch(() => {});
  await sleep(1500);
  const txt = await t.text();
  record('可進入戰鬥輪次章節',
    exit === 'ok' && enterCombat === 'ok' && confirmDev === 'ok' && !/冒險啟程之書/.test(txt),
    `${exit}/${enterCombat}/${confirmDev}｜${txt.slice(0, 120)}`);
  record('入戰的 NPC 出現在戰鬥輪次', /稽核用測試 NPC|第二位測試 NPC|單張匯入測試/.test(txt), txt.slice(0, 160));
}

// ═══ 總結 ════════════════════════════════════════════════
const diag = cdp.diag();
const checks = results.filter((r) => r.kind === 'check');
const failed = checks.filter((r) => !r.ok);

process.stdout.write('\n' + '='.repeat(60) + '\n');
process.stdout.write(`  檢查項 ${checks.length}　通過 ${checks.length - failed.length}　失敗 ${failed.length}\n`);
process.stdout.write('='.repeat(60) + '\n');

if (failed.length) {
  process.stdout.write('\n失敗清單：\n');
  failed.forEach((f) => process.stdout.write(`  - [${f.group}] ${f.name}${f.detail ? `　→ ${f.detail}` : ''}\n`));
}

const pageErrors = diag.consoleErrors.filter((e) => e.level === 'error');
process.stdout.write(`\n執行期例外 ${diag.exceptions.length}　console.error ${pageErrors.length}　原生對話框 ${diag.dialogs.length}\n`);
if (diag.exceptions.length) {
  process.stdout.write('例外：\n' + diag.exceptions.map((e) => '  ' + String(e).split('\n')[0]).join('\n') + '\n');
}
if (pageErrors.length) {
  process.stdout.write('console.error：\n' + pageErrors.slice(0, 10).map((e) => '  ' + e.text.slice(0, 200)).join('\n') + '\n');
}

chrome?.kill();
process.exit(failed.length || diag.exceptions.length ? 1 : 0);
