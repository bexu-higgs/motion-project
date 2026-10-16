# AI сурет жасаудың негіздері · Higgsfield (KK)

Instagram-ға арналған тік (9:16) моушн-дизайн сабағы: Higgsfield-те AI сурет
генерациялаудың негіздері, қазақ тіліндегі дикторлық мәтін мен субтитрлер.

A ~90 s vertical (1080×1920, 30 fps) motion-design tutorial in Kazakh about the
fundamentals of AI image generation in Higgsfield, built with
[Remotion](https://www.remotion.dev/) (React → video).

![Storyboard](docs/storyboard.jpg)

## What's in the project

- Motion design for all 8 storyboard sections, with Kazakh narration (TTS) and
  Kazakh captions synced to it.
- Prompt formula (Нысан · Фон · Жарық · Композиция · Стиль), colour-coded prompt
  highlighting, a one-change iteration, shape cards, a variation grid and a recap.
- Quiet original music bed, subtle UI sounds, and the music dipping under the voice.
- Your real assets, used unmodified:

| Asset | File | Used in |
|---|---|---|
| Higgsfield logo | `public/brand/higgsfield-logo.jpg` | intro + end card (on a black plate matching its own background) |
| Image section screenshot | `public/screens/01-image-model-picker.jpg` | step 1: «Image» and «Nano Banana 2.1» highlighted |
| Prompt field screenshot | `public/screens/02-prompt-field.jpg` | step 2 (prompt field), step 4 (generate button) |
| Reference photo | `public/images/reference-bottle.jpg` | steps 3 and 6 |
| 3 Higgsfield results | `public/images/variant-1.jpg` … `variant-3.jpg` | steps 3, 4, 6 and the wrap-up |

The project never draws the Higgsfield interface or logo itself, and never fakes
generated images. Missing files render as labelled **PLACEHOLDER** panels. To
swap in screen recordings later, see **[docs/SHOT_LIST.md](docs/SHOT_LIST.md)**.

### Notes on this cut

- **Example prompt:** the brief's demo prompt is shown as «Мысал промпт», with
  *skincare bottle* changed to *glass water bottle* to match the reference photo.
  It illustrates how a prompt is built; it is not claimed to be the exact prompt
  behind the three results.
- **Step 4:** shows results 2 → 3, which differ visibly in one element (the stone
  base under the bottle).
- **Step 6:** the captions under the variations describe what each image shows.
- **Step 5:** the aspect-ratio and resolution controls are not shown, because
  there is no screenshot of them. The shape cards carry no ratio or resolution
  values, so nothing unsupported is displayed.
- **Label text:** the reference label reads «500 ML», but all three results read
  «506 ML» (the model changed it). The images are used as supplied.

## Quick start

```bash
npm install
npm run studio      # live preview + timeline scrubbing in the browser
npm run render      # -> out/higgsfield-image-basics-kk.mp4
npm run stills      # review frames + docs/storyboard.jpg
npm run check       # TypeScript
```

Remotion downloads its own headless Chrome on first render. To use an existing
Chromium instead, set `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome`.

## Timeline

Scene lengths follow the narration (`src/timeline.ts`); a sentence is never cut.

| Section | Storyboard | This cut |
|---|---|---|
| Intro: logo + title | 0–6 s | 0.0–6.5 s |
| 1 · Image + model choice | 6–17 s | 6.1–28.2 s |
| 2 · What is a prompt? | 17–27 s | 27.8–37.8 s |
| 3 · Product photo → ad | 27–49 s | 37.4–52.9 s |
| 4 · Generate, review, improve | 49–59 s | 52.5–63.0 s |
| 5 · Aspect ratio + resolution | 59–70 s | 62.6–73.8 s |
| 6 · Practice (1-, 2-, 3-нұсқа) | 70–85 s | 73.4–84.9 s |
| Wrap-up: recap + logo | 85–90 s | 84.5–92.5 s |

The three model sentences (L02–L04) take ~20 s at a calm pace, so step 1 runs
longer than its 11 s storyboard slot. Step 3 was tightened to compensate, and
steps 4–6 land within a second of the storyboard. Total: **92.5 s**.

## Editing

- **Assets, labels, prompt parts, variants:** `src/config.ts` (see the shot list).
- **Narration text:** `content/narration.json`. `text` is the caption shown on
  screen. `tts` is an optional pronunciation-only spelling (e.g. `Имидж` for
  *Image*, `Нано Банана` for *Nano Banana*) and never changes the captions.
- **Regenerate the voice:** `python3 -m pip install -r tools/requirements.txt`,
  then `npm run voice`. It downloads the Kazakh Piper voice and rewrites
  `public/audio/narration/*.wav` and `src/generated/narration-timing.json`.
  Options: `--speaker` (0–5; default 3) and `--length-scale` (>1 is slower).
- **Use a human voice-over instead:** save one WAV per line as
  `public/audio/narration/L01.wav` … `L13.wav`, then run `npm run voice:timing`.
  Captions and scene timing re-flow to the new audio.
- **Music and UI sounds:** `npm run audio` (procedural, deterministic).
- **Colours, fonts, safe areas:** `src/theme.ts`.

## Structure

```
content/narration.json        Kazakh script (single source of truth)
src/config.ts                 asset slots + lesson labels (edit after recording)
src/timeline.ts               scene timing derived from narration durations
src/scenes/*                  8 scenes: Intro, Model, Prompt, Ad, Iterate, Format, Practice, Wrap
src/components/*              captions, step header, ScreenPanel (recordings), slots, prompt card
src/generated/                narration timing (written by tools/tts.py)
public/audio/                 narration, music bed, UI sounds
tools/                        tts.py, music.py, sfx.py, fetch_voice.sh
docs/SHOT_LIST.md             recording guide
```

## Credits & licences

- **Narration voice:** synthetic, generated with [Piper](https://github.com/OHF-Voice/piper1-gpl)
  using the `kk-issai-high` voice (speaker *ISSAI_KazakhTTS_F1_Raya*), trained on
  ISSAI's [KazakhTTS / KazakhTTS2](https://github.com/IS2AI/Kazakh_TTS) dataset,
  **CC BY 4.0**. Credit ISSAI if you publish with this voice; a human voice-over
  is a drop-in replacement (see above).
- **Music and sound effects:** original, synthesised by `tools/music.py` and
  `tools/sfx.py`. No samples are used.
- **Fonts:** Onest and Inter (SIL Open Font License 1.1), via Fontsource.
- **Remotion:** free for individuals and companies of up to 3 people; larger
  companies need a [company licence](https://www.remotion.dev/license).
- Higgsfield and Nano Banana are names of their respective owners. The logo,
  interface and generated images shown in the video come from the recording you
  make.
