# ClawVille Office 圖檔生成 Prompt

這份文件提供正式展示版 Office View 所需的 AI 圖檔生成 prompt。

設計方向：
- 主題：魅魔風、奇幻辦公室、內部 dashboard 展示用
- 對外觀感：成熟、時尚、帶魔族元素，但維持 workplace-safe
- 禁止方向：情色、裸露、未成年感、過度 fetish 化、破壞辦公室可讀性的誇張鏡頭

建議輸出規格：
- 背景圖：`2048x1228` 或 `2400x1440`
- 角色圖：`768x1024` 或 `1024x1365`
- 檔案格式：`png`
- 背景去背：角色圖需要透明背景

## 1. 正式背景圖 Prompt

用途：
- 檔名建議：`frontend/public/office/themes/succubus-showcase/background.png`
- 對應程式設定：`NEXT_PUBLIC_OFFICE_THEME=succubus_showcase`

正向 prompt：

```text
wide fantasy office interior, succubus-inspired corporate workspace, elegant demon-themed office for adult staff, premium showcase illustration, isometric-to-side hybrid scene suitable for UI overlay, large central hallway, clearly separated desk zones, meeting room, break lounge, incident response desk, collaboration hub, readable floor layout, polished lighting, crimson and teal accent lights, black stone, dark walnut furniture, soft neon sigils, subtle horns-and-tail motifs in decor only, mature stylish atmosphere, high readability for top-layer dashboard tokens, clean negative space for UI overlays, cinematic but practical, premium game environment concept art, no characters in the scene, no text, no watermark
```

負向 prompt：

```text
nsfw, erotic, lingerie, cleavage focus, fetish, childlike, chibi, crowded composition, fish-eye lens, extreme perspective, blurry floor plan, unreadable furniture layout, heavy fog, text, watermark, logo, extra rooms, duplicate desks, broken architecture
```

額外要求：
- 保留清楚可辨識的走道、桌面與障礙物輪廓
- 不要把場景畫得太滿，讓 hover card / token 疊上去仍可讀
- 視角不要太高，避免人物圖像難以融入

## 2. 正式角色圖 Prompt Template

用途：
- 角色圖放在 `frontend/public/office/themes/succubus-showcase/portraits/`
- 檔名固定：
  - `planner.png`
  - `researcher.png`
  - `builder.png`
  - `reviewer.png`
  - `responder.png`
  - `staff.png`

共用正向 prompt template：

```text
full-body fantasy office worker portrait, adult succubus-inspired staff member, workplace-safe, elegant horns, subtle tail silhouette, stylish corporate fashion, polished boots, layered blazer or office uniform, premium character concept art, clean front-facing or slight 3/4 pose, transparent background, high readability at small size, strong silhouette, soft rim light, refined facial expression, mature professional mood, game UI portrait asset, no text, no watermark
```

共用負向 prompt：

```text
nsfw, exposed breasts, fetish outfit, lingerie, bikini, childlike proportions, oversized head, chibi, photoreal uncanny face, cropped limbs, cut-off feet, busy background, text, watermark, extra arms, extra legs
```

### Planner

追加 prompt：

```text
strategist, coordinator, poised posture, clipboard or holographic planning tablet, calm confident expression, crimson and sapphire palette
```

### Researcher

追加 prompt：

```text
analyst, knowledge worker, arcane data specialist, floating document shards or subtle rune interface, observant expression, teal and violet palette
```

### Builder

追加 prompt：

```text
tool-using engineer, execution specialist, utility belt, compact magical tool, practical confident stance, amber and cyan palette
```

### Reviewer

追加 prompt：

```text
quality reviewer, inspector, composed critical expression, ledger or seal of approval motif, silver and indigo palette
```

### Responder

追加 prompt：

```text
incident responder, crisis desk specialist, alert expression, subtle emergency sigil motif, crimson and ember palette
```

### Staff

追加 prompt：

```text
general office worker, neutral versatile role, approachable expression, balanced dark office palette
```

## 3. 建議工作流程

1. 先生成背景圖，確認桌區/走道/會議區/休息區構圖成立。
2. 再生成六張角色圖，輸出透明背景 `png`。
3. 圖檔放到：
   - `frontend/public/office/themes/succubus-showcase/background.png`
   - `frontend/public/office/themes/succubus-showcase/portraits/*.png`
4. 設定：

```bash
NEXT_PUBLIC_OFFICE_THEME=succubus_showcase
NEXT_PUBLIC_OFFICE_THEME_ASSET_BASE=/office/themes/succubus-showcase
NEXT_PUBLIC_OFFICE_BACKGROUND_IMAGE=
NEXT_PUBLIC_OFFICE_PORTRAIT_BASE_PATH=
```

5. 重新校正 `frontend/lib/officeMap.ts` 的 walkable / obstacles / zones / anchorPoints。
