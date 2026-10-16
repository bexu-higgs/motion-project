# Recording guide & asset checklist

Everything Higgsfield-specific in the video comes from **your own screen recording
of the real site**. Nothing in the project imitates the Higgsfield interface: the
motion graphics explain the lesson; the recordings show the product. Until a file
exists, its slot renders as a striped **PLACEHOLDER** panel, so you can always
render and see what is still missing.

Drop files into `public/` with exactly these names, then run `npm run render`.

| Slot | File | Shown in | On screen for |
|---|---|---|---|
| Logo | `brand/higgsfield-logo.svg` (or `.png` / `.webp`) | intro + end card | ~6 s + ~2 s |
| REC 01 | `recordings/01-image-model.mp4` | Step 1 · Image және модель | ~22 s (large for the first ~11 s) |
| REC 02 | `recordings/02-prompt-field.mp4` | Step 2 · Промпт деген не? | ~10 s |
| REC 03 | `recordings/03-upload-and-prompt.mp4` | Step 3 · Өнім суретінен жарнама | ~15 s (large for the first ~5 s) |
| REC 04 | `recordings/04-generate-iterate.mp4` | Step 4 · Жасау және жетілдіру | ~10 s |
| REC 05 | `recordings/05-aspect-resolution.mp4` | Step 5 · Кадр пішімі мен ажыратымдылық | ~11 s |
| Image | `images/reference-bottle.png` | Steps 3 and 6 | |
| Image | `images/result-1.png` | Step 4 | |
| Image | `images/result-2.png` | Step 4 | |
| Image | `images/variant-1.png`, `variant-2.png`, `variant-3.png` | Step 6 + wrap-up | |

Durations follow the narration and shift slightly if the voice is regenerated.
Open `npm run studio` to see the exact timing.

## Before you record

- **Logo:** use the official file from Higgsfield as provided: a light or
  white version for dark backgrounds, SVG preferred. It is displayed as-is,
  never redrawn, recoloured or stretched.
- **Reference photo:** a clean photo of an **unbranded** skincare bottle on a
  plain background (your own photo, or stock you have rights to). No labels,
  logos or brand names. Save the same file as `images/reference-bottle.png`.
- **Browser:** record a 1920×1080 window (or larger; set `size` in
  `src/config.ts` to the real pixel size). Set **page zoom to 125–150 %** so the
  interface text stays readable after it is scaled into a phone-sized panel.
  Hide bookmarks and extensions, and close other tabs.
- **Privacy:** keep e-mail addresses, credit balances and other personal data
  out of frame, or set a `focus` rectangle that crops them out.
- **Format:** MP4 (H.264), 30 or 60 fps, no audio needed.
- **Model:** in the Image section, use **Nano Banana** if it is available in your
  account. If it isn't, use the closest instruction-based editing model and change
  `MODEL_NAME` in `src/config.ts` to the exact name your account shows. The
  narration names Nano Banana, so re-check that sentence too.

## The shots

### REC 01 · Image section → model (≈ 12–20 s of action)
1. Start on the Higgsfield home or dashboard.
2. Click the **Image** section in the real navigation.
3. Open the model picker and pause ~2 s so it can be read. Don't scroll through
   the whole catalogue.
4. Select **Nano Banana**, then hold on the Image page for 3–4 s with it selected.

### REC 02 · Prompt field (≈ 5–10 s)
Hold on the empty prompt field with the cursor in it. You can skip this file and
point `promptField.file` at REC 03 with a `segments` entry from before the typing.

### REC 03 · Upload + prompt (≈ 15–25 s)
1. Upload `reference-bottle.png` using the real upload control.
2. Type or paste the demo prompt exactly:

```
Turn this simple skincare bottle into a premium studio advertisement. Preserve the bottle’s shape and proportions. Place it on a clean ivory pedestal against a warm beige background. Use soft side lighting, subtle shadows, crisp detail, and elegant product photography. Do not add text, logos, or extra objects.
```

The video also types this text into a large, colour-coded card, so it stays
readable on a phone even when the UI is small.

### REC 04 · Generate → review → change one thing (record everything; cut the waiting)
1. Click the real **Generate** button. Keep recording until the result appears.
   Save it as `images/result-1.png`.
2. In the prompt, change **only** the background phrase:
   `against a warm beige background.` → `against a soft sage-green background.`
3. Generate again and save the result as `images/result-2.png`.

Use `segments` (below) to cut out the generation wait so the clip fits ~10 s.

### REC 05 · Aspect ratio + resolution (≈ 8–12 s)
1. Open the real aspect-ratio control for the selected model and pause ~2 s on
   the options.
2. Open the resolution control and pause ~2 s.

The shape cards in this step show only shapes and their uses (Шаршы / Пост,
Тік / Сторис, Көлденең / Баннер). To print ratio or resolution values on them,
fill `RATIO_LABELS` / `RESOLUTION_LABELS` in `src/config.ts`, using **only**
values your recording shows for this model.

### Practice variations (images only, no recording needed)
Keep the same reference photo and core prompt, and change **one** element per
generation. These exact edits match the labels in the video (`VARIANTS` in
`src/config.ts`):

| File | Changes | Replace | With |
|---|---|---|---|
| `variant-1.png` | Фон | `against a warm beige background.` | `against a soft blush-pink background.` |
| `variant-2.png` | Жарық | `Use soft side lighting, subtle shadows,` | `Use warm golden window light, subtle shadows,` |
| `variant-3.png` | Композиция | `Place it on a clean ivory pedestal` | `Show it in a low-angle close-up on a clean ivory pedestal` |

`FINAL_PICK` chooses which variation is "saved" in the wrap-up (default: 2).

## Fitting recordings: trims, zoom and callouts

All values go in the slot's entry in `RECORDINGS` (`src/config.ts`).
**Times are seconds in the source file** (what any video player shows) and
**rectangles are source pixels** (`x`, `y` = top-left corner). To find
coordinates, grab a frame (`ffmpeg -ss 3 -i rec.mp4 -frames:v 1 frame.png`) and
read the pixel positions in any image editor.

```ts
model: {
  file: 'recordings/01-image-model.mp4',
  size: [1920, 1080],
  // play 0–6 s, then 14–20 s at 1.5× (cuts the boring middle)
  segments: [{start: 0, end: 6}, {start: 14, end: 20, rate: 1.5}],
  // camera: full window, then ease into the model picker by 4 s
  focus: [
    {at: 0, x: 0, y: 0, w: 1920, h: 1080},
    {at: 4, x: 120, y: 160, w: 720, h: 540},
  ],
  // highlight the real "Image" nav item from 1.0 s to 3.0 s, with a click
  callouts: [{from: 1.0, to: 3.0, x: 40, y: 210, w: 160, h: 56, label: 'Image', click: true}],
  ...
}
```

- After the last segment, the final frame is held, so short clips are fine.
- Callouts stay locked to their UI element while the camera zooms. Use the
  interface's **exact wording** for `label`, or leave it out.
- For readable text, aim for `focus` rectangles about **≤ 800 px wide** at 125 %
  page zoom (the panel is 1000 px wide on a 1080 px frame).
