# 三名教徒生圖 Prompt（v2·動態·免洗路人版）

> 風格要求：二次元、白色背景、乾淨二分（cell shading）
> 核心方向：**dynamic pose** + **generic disposable minion**——玩家看到就知道是雜魚，不投入感情
> 用於 ImageGen 或同類工具

---

## 共通風格指令（每條 prompt 前綴）

```
Anime style, clean cel-shading, two-tone flat shading, solid pure white background, full body, single character, no ground shadow, no gradient, no texture, simple lighting, dynamic action pose, mid-motion, generic NPC character, no distinguishing facial features, forgettable design
```

### 設計理念

- **動態姿勢**：每個教徒都處於動作中途（衝刺、舉盾、揮刀），不是站著讓你看
- **免洗路人**：臉部刻意模糊化（陰影遮擋 / 無五官細節），體型和服裝高度制式化，像同一條流水線出來的
- **零魅力**：不用「狡猾」「忠誠」「虔誠」這種帶性格暗示的詞；用「generic」「standard」「uniform」取代
- **三人差異只靠體型和武器**：不靠髮色瞳色表情——因為臉都看不太到

---

## 1. 隱紗教徒（Lv 10 獵人）

### Prompt A——斗篷穿戴狀態（戰鬥中）

```
Anime style, clean cel-shading, two-tone flat shading, solid pure white background, full body, single character, no ground shadow, no gradient, no texture, simple lighting, dynamic action pose, mid-motion, generic NPC character, no distinguishing facial features, forgettable design.

A generic cultist grunt in a dark grey hooded cloak, mid-sized slim build, completely unremarkable appearance. The hood is pulled up and casts a heavy shadow over the entire upper face — no eyes, no nose, no expression visible, just a dark void where the face should be. A plain dark scarf covers the mouth and jaw. The cloak is tattered and shapeless, draping over the body like a rag, its lower edges fading into a faint white-line shimmer suggesting semi-invisibility. Underneath: a standard dark navy tunic, black trousers, soft boots — nothing decorative, no insignia, no jewelry. He is captured mid-lunge, body low and forward, one foot sliding ahead, a short curved dagger thrust forward in a stabbing motion. The pose is fast and aggressive but the character himself looks like he could be any of a hundred identical grunts. Cool muted palette: dark navy, grey, faded purple. No individuality, no personality, replaceable foot soldier energy.
```

### Prompt B——斗篷褪去後（備用）

```
Anime style, clean cel-shading, two-tone flat shading, solid pure white background, full body, single character, no ground shadow, no gradient, no texture, simple lighting, dynamic action pose, mid-motion, generic NPC character, no distinguishing facial features, forgettable design.

A generic cultist grunt without his cloak, mid-sized slim build, completely unremarkable. The hood is down but the face is still mostly hidden — messy dark hair covers the forehead and eyes, a plain scarf still covers the mouth. Only a vague hint of a nose and chin is visible. He wears a standard dark navy tunic, black trousers, soft boots — plain, mass-produced, no decoration. He is captured mid-dodge, body twisting sideways, one arm raised to deflect, the other holding a short curved dagger in a reverse grip. The pose suggests he was caught off-guard and is scrambling. Cool muted palette: dark navy, grey. Exposed, ordinary, just another grunt who lost his gimmick. No individuality.
```

---

## 2. 守庫教徒（Lv 10 衛士）

```
Anime style, clean cel-shading, two-tone flat shading, solid pure white background, full body, single character, no ground shadow, no gradient, no texture, simple lighting, dynamic action pose, mid-motion, generic NPC character, no distinguishing facial features, forgettable design.

A generic cultist grunt, large and broad-shouldered, thick heavy build, completely unremarkable. He wears a heavy dark grey padded coat with frost-white fur at the collar — functional cold-weather gear, not fashion. Underneath is a black armored vest with riveted metal plates, plain and utilitarian. Thick trousers tucked into heavy iron-shod boots. A metal half-helm covers the entire top of his head down to the nose bridge — only the lower half of the face is visible, and even that is cast in shadow: a dull expressionless mouth and a stubbled jaw, no readable emotion. He is captured mid-charge, body weight thrown forward into a shield-bash, a massive rectangular tower shield held out in front of him like a battering ram, his right fist cocked back ready to follow up. Wide aggressive stance, feet stomping the ground. Warm-neutral palette: dark grey, iron black, frost white fur, brown. A wall of a man, but a wall you've seen a hundred times before. No personality, no identity, interchangeable brute.
```

---

## 3. 祭儀教徒（Lv 10 輔助）

```
Anime style, clean cel-shading, two-tone flat shading, solid pure white background, full body, single character, no ground shadow, no gradient, no texture, simple lighting, dynamic action pose, mid-motion, generic NPC character, no distinguishing facial features, forgettable design.

A generic cultist grunt, short and thin, almost childlike in stature but clearly an adult, completely unremarkable. He wears a dark crimson hooded robe that is too large for him, the hem pooling at the ankles, sleeves covering the hands — a mass-produced cultist robe, not tailored. The hood is pulled deep over the face and the interior is pure shadow — no face visible at all, just darkness under the hood. No eyes, no mouth, no identity. He is captured mid-cast, both arms raised in front of his chest holding a small ritual dagger upright, a few simple geometric magical sigils (a circle, a triangle) floating near the blade tip, faintly glowing pale teal. His body is upright but leaning slightly forward, caught in the middle of a chant, robes swaying from the motion. Muted palette: dark crimson, black, pale teal accents. A nobody, a prop, the kind of cultist you don't bother learning the name of. No presence, no aura, disposable ceremony fodder.
```

---

## 使用說明

### v1 → v2 改動摘要

| 項目 | v1（舊版） | v2（動態·免洗版） |
|---|---|---|
| 姿勢 | front-facing pose（站樁） | dynamic action pose, mid-motion（動作中途） |
| 臉部 | 有個性（狐狸眼、琥珀瞳、忠誠表情、虔誠目光） | 完全遮擋或純黑陰影，無五官可辨 |
| 性格詞 |狡猾 / 忠誠 / 虔誠 / dangerous aura | generic / unremarkable / interchangeable / disposable |
| 髮色瞳色 | 有指定（暗紫黑髮、琥珀黃眼、蒼綠眼） | 全部遮住，看不見 |
| 裝飾細節 | 有（幾何花紋、鐵靴、魔力符號） | 去裝飾化，強調 mass-produced / standard / plain |
| 角色魅力 | 高（各自有氛圍和 aura） | 零（明確寫 forgettable / replaceable / a nobody） |

### 核心寫法

1. **臉部全遮**：隱紗教徒用「兜帽陰影＋圍巾」遮到只剩下巴；守庫教徒用「半盔到鼻橋＋下半臉陰影」；祭儀教徒用「兜帽深到純黑」——三人連一隻眼睛都看不到，玩家無從產生感情投射
2. **動態姿勢**：衝刺刺擊 / 舉盾衝撞 / 舉刀詠唱——三人都在「做事」的中途，不是站著讓你端詳
3. **制式化**：每個人都寫了 standard / mass-produced / plain / no insignia——強調他們是同一條流水線的消耗品
4. **零個性詞**：prompt 裡刻意避開所有帶性格暗示的形容詞，用 generic / unremarkable / interchangeable / disposable / a nobody / a prop 取代

### 配色邏輯（不變）

- 隱紗教徒：冷色系（navy/grey/purple）
- 守庫教徒：鐵色系（iron grey/frost white/brown）
- 祭儀教徒：暗紅＋蒼綠光點

三人站在一起時，剪影高矮胖瘦不同（祭儀最矮最瘦、守庫最高最壯、隱紗中等偏瘦），但都沒有臉、都在動、都長得像消耗品。
