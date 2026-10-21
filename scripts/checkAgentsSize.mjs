#!/usr/bin/env node
/**
 * AGENTS.md 大小守門員 —— 判準、門檻與「為什麼」見 AGENTS.md §7.3。
 *
 * 為什麼需要這支：AGENTS.md 會被 harness 當成 workspace instruction 自動注入，
 * 有 65,536 bytes 的硬上限，超出即**從尾端截斷**——而尾端通常是最新的規則。
 * 這支腳本讓「快爆了」在變成「已經爆了」之前就看得見，而不是靠人記得去量。
 *
 * 用法：npm run check:agents
 * 退出碼：0 = 正常或僅警告；1 = 超過失敗門檻。
 */
import fs from 'node:fs';
import path from 'node:path';

const FILE = path.resolve(process.cwd(), 'AGENTS.md');
const HARD_CAP = 65536; // harness 的注入預算

// 門檻可用環境變數覆寫，純粹為了「刻意破壞驗證」時不必改原始碼：
//   AGENTS_WARN_AT=30000 npm run check:agents   → 走警告分支
//   AGENTS_FAIL_AT=30000 npm run check:agents   → 走失敗分支（exit 1）
const envInt = (key, fallback) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};
const WARN_AT = envInt('AGENTS_WARN_AT', 56000); // 開始警告
const FAIL_AT = envInt('AGENTS_FAIL_AT', 62000); // 直接失敗

if (!fs.existsSync(FILE)) {
  console.error(`找不到 ${FILE}`);
  process.exit(1);
}

const raw = fs.readFileSync(FILE); // Buffer
const total = raw.byteLength; // ← 正確的位元組數
const text = raw.toString('utf8');

// ⚠️ 陷阱：text.length 是 **UTF-16 字元數**。本檔幾乎全是中文（UTF-8 下 3 bytes/字），
// 用 text.length 量會少算約 2/3，於是「還有空間」其實早就爆了。
// 這支腳本從頭到尾只用 Buffer.byteLength。
const eol = text.includes('\r\n') ? 2 : 1;
const lines = text.split(/\r?\n/);
const lineBytes = lines.map((l) => Buffer.byteLength(l, 'utf8') + eol);

// 以 `## ` 切節（`###` 不算，否則會切太碎）
const sections = [];
let current = { title: '（檔頭：標題與前言）', start: 0 };
lines.forEach((ln, i) => {
  if (/^## /.test(ln)) {
    sections.push(current);
    current = { title: ln.replace(/^## /, '').trim(), start: i };
  }
});
sections.push(current);

const rows = sections.map((s, k) => {
  const end = k + 1 < sections.length ? sections[k + 1].start : lines.length;
  let size = 0;
  for (let i = s.start; i < end; i += 1) size += lineBytes[i];
  return { title: s.title, from: s.start + 1, count: end - s.start, size };
});

const num = (n) => n.toLocaleString('en-US');
const pct = (n) => `${((n / total) * 100).toFixed(1)}%`; // 佔本檔的比例
const pctCap = (n) => `${((n / HARD_CAP) * 100).toFixed(1)}%`; // 佔上限的比例

console.log('');
console.log(`AGENTS.md 大小稽核 —— 上限 ${num(HARD_CAP)} bytes（超出即截斷尾端）`);
console.log('');
console.log(
  `目前 ${num(total)} bytes ＝ 上限的 ${pctCap(total)}，剩餘 ${num(HARD_CAP - total)} bytes`
);
console.log('');

for (const r of [...rows].sort((a, b) => b.size - a.size)) {
  const bar = '#'.repeat(Math.max(1, Math.round((r.size / total) * 40)));
  console.log(
    `  ${num(r.size).padStart(7)} bytes  ${pct(r.size).padStart(6)}  ${bar.padEnd(40)} ${r.title}`
  );
}
console.log('');

const fattest = [...rows].sort((a, b) => b.size - a.size).slice(0, 3);

if (total > FAIL_AT) {
  console.error(`超出失敗門檻 ${num(FAIL_AT)} bytes。最肥的三節：`);
  for (const r of fattest) {
    console.error(`  - §${r.title}：${num(r.size)} bytes（${pct(r.size)}，第 ${r.from} 行起）`);
  }
  console.error('');
  console.error('依 AGENTS.md §7.1 的三條准入測試逐條檢查這三節：');
  console.error('  1. 違反它 = 做錯事嗎？（純背景／純歷史 → docs/decisions.md）');
  console.error('  2. 它適用於每一次任務嗎？（只在某類任務 → docs/*.md 操作手冊）');
  console.error('  3. 它含會變的數字或狀態嗎？（→ docs/state.md）');
  console.error('');
  process.exit(1);
}

if (total > WARN_AT) {
  console.warn(`已超過警告門檻 ${num(WARN_AT)} bytes（上限的 ${pctCap(total)}）。最肥的三節：`);
  for (const r of fattest) {
    console.warn(`  - §${r.title}：${num(r.size)} bytes（${pct(r.size)}，第 ${r.from} 行起）`);
  }
  console.warn('');
  console.warn('先套 §7.1 的三條准入測試，再決定要不要動手——不要直接開始「壓縮」。');
  console.warn('');
  process.exit(0);
}

console.log(`在警告門檻 ${num(WARN_AT)} bytes 之下，還有 ${num(WARN_AT - total)} bytes 的餘裕。`);
console.log('');
