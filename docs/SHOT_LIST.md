# Assets, and how to swap in recordings

Every Higgsfield-specific visual in the video comes from a real file in
`public/`. Nothing in the project imitates the Higgsfield interface: the motion
graphics explain the lesson, and the screenshots and results show the product.
A missing file renders as a striped **PLACEHOLDER** panel, so the video always
renders.

## Current assets

| Slot (`src/config.ts`) | File | Scene |
|---|---|---|
| `LOGO_FILES` | `brand/higgsfield-logo.jpg` | intro + end card |
| `RECORDINGS.model` | `screens/01-image-model-picker.jpg` | 1 · Image және модель |
| `RECORDINGS.promptField` | `screens/02-prompt-field.jpg` | 2 · Промпт деген не? |
| `RECORDINGS.generate` | `screens/02-prompt-field.jpg` | 4 · Жасау және жетілдіру |
| `IMAGES.reference` | `images/reference-bottle.jpg` | 3 · Өнім суретінен жарнама, 6 · Практика |
| `IMAGES.variant1–3` | `images/variant-1.jpg` … `variant-3.jpg` | 3, 4, 6, wrap-up |

## Screenshots vs. recordings

A `RECORDINGS` slot accepts either a screenshot (`.jpg`, `.png`, `.webp`) or a
screen recording (`.mp4`). Both support camera moves (`focus`) and highlights
(`callouts`):

- **Screenshot:** times are seconds from the start of the scene.
- **Recording:** times are seconds in the source file, and `segments` can cut
  out waiting time.

Rectangles are always in source pixels (`x`, `y` = top-left corner).

```ts
model: {
  file: 'screens/01-image-model-picker.jpg',
  size: [1080, 1028],
  focus: [
    {at: 0, x: 0, y: 0, w: 1080, h: 756},     // top of the list
    {at: 9.0, x: 0, y: 272, w: 1080, h: 756}, // scroll down to the model
  ],
  callouts: [{from: 9.2, to: 13.5, x: 36, y: 488, w: 1008, h: 148, click: true}],
  ...
}
```

Use the interface's **exact wording** for a callout `label`, or leave it out.
To find coordinates, open the image (or a frame grabbed with
`ffmpeg -ss 3 -i rec.mp4 -frames:v 1 frame.png`) in any image editor.

## Optional upgrades

- **Step 5 · aspect ratio + resolution:** add a screenshot or recording of these
  controls for the selected model as a new slot, and place it in
  `src/scenes/FormatScene.tsx`. Fill `RATIO_LABELS` / `RESOLUTION_LABELS` only with
  values the UI shows for that model.
- **Steps 3–4 as recordings:** record the upload, the typing and the Generate
  click, then point `RECORDINGS.generate` (and a new upload slot) at the MP4s.
- **Exact prompt:** if you want the prompt card to show the exact prompt behind
  the results, edit `DEMO_PROMPT` in `src/config.ts`. Keep the
  `part` tags (Нысан / Фон / Жарық / Композиция / Стиль) on the matching phrases.
