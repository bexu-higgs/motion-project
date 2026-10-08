# motion-project

This is a motion-design intro video project for Instagram: a 20-second cinematic opener for an AI education brand, with a Kazakh voiceover, kinetic typography, motion graphics and sound design all running on one timeline.

**Output files**

| File | Format |
|---|---|
| `output/intro_9x16.mp4` | 1080×1920, 30 fps, Instagram Reels / Stories |
| `output/intro_16x9.mp4` | 1920×1080, 30 fps, YouTube / course platforms |
| `output/intro_mix.wav` | Final mix (voice + sound design), 48 kHz / 24-bit |

---

## Script (voiceover)

> «Сәлем! Сіздермен бірге Бексұлтан. Сіздерге ЖАСАНДЫ ИНТЕЛЛЕКТ туралы нақты базалық сабақтарды үйрететін боламын!»

The voiceover text is used exactly as written. It was only split at phrase boundaries for synthesis. The voice is the male narrator *Iseke* from ISSAI KazakhTTS (a Piper/VITS model, CC-BY-4.0). Each phrase was synthesized in 8 takes. Whisper (large-v3-turbo) transcribed every take, and the take closest to the script was kept.

## Timeline

Word onsets were measured from the voiceover audio, using DTW alignment against each word synthesized on its own. The animation and the sound design are both driven by the same cue sheet (`src/timeline.json`).

| Time (s) | Voice | On screen | Motion idea | Sound |
|---|---|---|---|---|
| 0.00–0.60 | — | Dark tech space, a single core point | Two digital pulses: the system wakes up | Low drone, soft digital pulses |
| **0.60** | «Сәлем!» | **СӘЛЕМ!** | Letters rise from below a mask and pull together horizontally; light burst and digital wave on the exact syllable | Swell → sub impact, high shimmer, whoosh |
| 1.62–3.28 | «Сіздермен бірге» | (no subtitles) | The word breaks into fragments that drift through 3D space, then gather together | Particle "grains", rising whoosh |
| **3.28** | «Бексұлтан» | **БЕКСҰЛТАН** | Fragments lock into letters one by one (geometric frame + flash); camera push-in; light sweep at 4.02 | A tick for each letter, lock impact, airy sweep |
| 4.83–5.45 | — | The name flows away | A twisting ribbon of light enters from the left: the viewer is carried forward | Panning L→R whoosh |
| **5.45** | «Сіздерге» | **СІЗДЕРГЕ** | Each letter is revealed exactly as the ribbon head passes it (skew → upright) | UI click, swish |
| 6.55–7.40 | — | — | Everything focuses into the core; camera rushes in | Rising riser, stops at the cut |
| **7.40** | «жасанды» | **ЖАСАНДЫ** | HERO: the core bursts into a 3D neural network; the word appears as an algorithmic dot field, then a scanning beam renders it solid | Deep sub boom, chord, data ticks, scan sound |
| **8.24** | «интеллект» | **ИНТЕЛЛЕКТ** | The two words are two layers of one neural network: signals run from every ЖАСАНДЫ letter to every ИНТЕЛЛЕКТ letter, and each letter "fires" as an outline, then turns solid | A rising "zip" + activation tick for each letter |
| 8.9–11.1 | — | Hero composition | Network rotates, data packets, HUD arcs, second scan | Quiet data blips |
| **11.10** | «туралы» | — | Scan-out: abstract → structure. Network nodes settle into an orthogonal grid; links become right-angled connectors | Reorganizing whoosh, snap clicks |
| **11.57** | «нақты» | **01 НАҚТЫ** | Module border draws out of the connector; the word is typed in with a cursor | Glide + click + a tick for each letter |
| **12.06** | «базалық» | **02 БАЗАЛЫҚ** | Same, the next block | Same (one step higher) |
| **12.54** | «сабақтарды» | **03 САБАҚТАРДЫ** | Same, the last block | Same |
| 14.80–15.35 | — | — | All modules collapse into a single line of light | Converging whoosh |
| **15.35** | «үйрететін» | **ҮЙРЕТЕТІН** | Rises out of the line | Soft impact, swish |
| **16.02** | «боламын!» | **БОЛАМЫН!** | Lands with weight (scale 1.32 → 1): flash, wave, camera shake | Main sub impact, resolving chord |
| 17.17–20.0 | — | **Lockup:** mark + БЕКСҰЛТАН + ЖАСАНДЫ ИНТЕЛЛЕКТ | Shutter closes into the line → point → mark (ring + 3 nodes); name rises, light sweep; the network glows faintly in the background | Chime, airy sweep, fading tail |

**Palette:** dark neutral background `#030509`, cyan `#48E2FF`, electric blue `#3876FF`, a little violet `#8E70FF`, white `#F2F7FC`.
**Typeface:** Montserrat 600–800 (OFL), which fully covers the Kazakh alphabet (Ә Ғ Қ Ң Ө Ұ Ү Һ І).

---

## How it is built

```
audio/build_vo.py   Kazakh TTS (sherpa-onnx + ISSAI KazakhTTS) with Whisper-scored take selection
audio/align.py      places phrases, DTW word alignment, writes the cue sheet → src/timeline.json
audio/sfx.py        procedural sound design (numpy/scipy), every hit read from the cue sheet
audio/mix.py        voice chain (EQ, de-ess, compression), ducking, -14 LUFS delivery
src/index.html      deterministic canvas renderer: renderFrame(t); open it in a browser to preview with sound
src/scene.js        all motion design
render/render.mjs   Playwright frame capture → ffmpeg
build.sh            end-to-end rebuild
```

- **Rebuild:** `./build.sh`. This reuses the committed voice takes in `assets/vo`.
- **New voice:** `TTS=… ASR=… ./build.sh --voice`. Models come from the `k2-fsa/sherpa-onnx` GitHub releases (`tts-models/vits-piper-kk_KZ-issai-high`, `asr-models/sherpa-onnx-whisper-turbo`).
- **Preview:** serve the repo root (`npx serve .`), open `/src/index.html` and click ▶. Add `?w=1920&h=1080` for 16:9.
- **Capture:** frames are captured at 60 fps, then blended down to 30 fps (2-frame blend = 180° shutter motion blur). Encoded as H.264 High + AAC 320k with faststart.
