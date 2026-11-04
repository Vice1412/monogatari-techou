/**
 * SSR HTML 的屬性判斷小工具（給測試用）。
 *
 * 為什麼要有這一支：本專案的按鈕 class 一律含 `disabled:cursor-not-allowed`，
 * 所以「這份 HTML 裡有沒有 `disabled` 這個字」**永遠是 true**——
 * 用它來斷言「按鈕被禁用」會變成假綠（把 `disabled` 屬性整段拿掉，測試照樣全綠）。
 * 2026-11-04 的 W1 驗收就抓到三處這種寫法。
 *
 * 正確做法：取出那一個標籤，先拔掉 `class="…"`，再判斷有沒有 `disabled` 屬性。
 */

/** 取某個 `data-testid` 的整個開始標籤（含 `<` 與 `>`）；找不到回空字串。 */
export const tagOf = (html, testId) => {
  if (typeof html !== 'string' || !testId) return '';
  const at = html.indexOf(`data-testid="${testId}"`);
  if (at < 0) return '';
  const start = html.lastIndexOf('<', at);
  const end = html.indexOf('>', at);
  if (start < 0 || end < 0) return '';
  return html.slice(start, end + 1);
};

/** 這個 `data-testid` 的標籤有沒有 `disabled` **屬性**（不是 class 裡的 `disabled:`）。 */
export const hasDisabledAttr = (html, testId) => {
  const tag = tagOf(html, testId);
  if (!tag) return false;
  // 先把 class 值整段拔掉：`disabled:cursor-not-allowed` 是 Tailwind 的變體前綴，不是屬性。
  const withoutClass = tag.replace(/class="[^"]*"/, '');
  return /\sdisabled(=|\s|>)/.test(withoutClass);
};

/** HTML 裡有沒有這個 `data-testid`（用來證明「按鈕存在」，避免對空氣斷言）。 */
export const hasTestId = (html, testId) => (
  typeof html === 'string' && Boolean(testId) && html.includes(`data-testid="${testId}"`)
);
