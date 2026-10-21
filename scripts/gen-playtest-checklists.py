"""生成 docs/playtest/ 的兩份打勾清單（英雄技能 115、金手指 46）。

用途：S5／S6 階段要「逐筆測完」，需要一份可打勾的索引。
只讀 `rulesData.json`，不改任何資料。

用法：
    python scripts/gen-playtest-checklists.py
"""

import json
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "src/features/character-sheet/data/rulesData.json"
OUT = ROOT / "docs/playtest"

SRC_LABEL = {
    "core": "核心",
    "highFantasy": "高奇",
    "naturalFantasy": "自然",
    "technoFantasy": "科技",
    "bonus": "特典",
    "playtest": "公測",
}
SRC_ORDER = ["core", "highFantasy", "naturalFantasy", "technoFantasy", "bonus"]

TICK_RULES = (
    "> **打勾規則**：`☐` 未測 → `✔` 測過無問題 → `▲` 有缺陷（填缺陷號）→ `✕` 不適用（附一句為什麼）。"
)


def cell(text):
    return (text or "").replace("|", "／").replace("\n", " ")


def gen_heroic(data):
    lines = [
        "# 英雄技能打勾表（115 筆）",
        "",
        "> 自動生成自 `rulesData.json` 的 `heroicSkills`（生成器：`scripts/gen-playtest-checklists.py`）。",
        "> **只當索引與進度用**——效果全文在 S5 時由 dump 腳本輸出到該次 session 記錄，不重複抄在這裡。",
        ">",
        TICK_RULES,
        "> 每一筆要回答三問：**①需求在開卡時達得到嗎 ②前置講清楚了嗎 ③效果讀得懂嗎**。",
        "",
    ]
    total = 0
    for src in SRC_ORDER:
        items = [h for h in data["heroicSkills"] if h.get("source") == src]
        total += len(items)
        lines += [
            f"## {SRC_LABEL[src]}（{len(items)} 筆）",
            "",
            "| # | 技能 | 需求 | 測 | 缺陷 | 備註 |",
            "|---|---|---|---|---|---|",
        ]
        for i, h in enumerate(items, 1):
            lines.append(f"| {i} | {cell(h.get('name'))} | {cell(h.get('requirement'))} | ☐ | | |")
        lines.append("")
    lines.append(
        f"**合計 {total} 筆**。另有 `playtestHeroicSkills.js` 的公測新增技能與 "
        "`variantArcanistHeroicSkills.js` 的變體專屬技能，於 S4 處理。"
    )
    (OUT / "checklist-heroic.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return total


def gen_quirks(data):
    quirks = data["quirks"]
    lines = [
        f"# 金手指打勾表（{len(quirks)} 筆）",
        "",
        "> 自動生成自 `rulesData.json` 的 `quirks`（生成器：`scripts/gen-playtest-checklists.py`）。",
        ">",
        TICK_RULES,
        "> 每一筆要回答三問：**①畫面有沒有告訴我選了它會改什麼 ②它的效果我在卡上執行得到嗎 ③它跟別的選擇會打架嗎**。",
        "",
        "| # | 金手指 | 效果含「選擇／選項」 | 測 | 缺陷 | 備註 |",
        "|---|---|---|---|---|---|",
    ]
    with_choice = 0
    for i, q in enumerate(quirks, 1):
        desc = q.get("desc") or ""
        has = "選擇" in desc or "選項" in desc
        with_choice += has
        lines.append(f"| {i} | {cell(q.get('name'))} | {'**是**' if has else ''} | ☐ | | |")
    lines += [
        "",
        f"**合計 {len(quirks)} 筆**，其中 **{with_choice} 筆**效果文含「選擇／選項」——"
        "這些是 H1／H4 假設（金手指目前只有名稱比對、無法承載選項）的重點驗證對象。",
    ]
    (OUT / "checklist-quirks.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return with_choice


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    heroic = gen_heroic(data)
    choice = gen_quirks(data)
    print(f"checklist-heroic.md  {heroic} 筆")
    print(f"checklist-quirks.md  {len(data['quirks'])} 筆（含選擇字樣 {choice} 筆）")


if __name__ == "__main__":
    main()
