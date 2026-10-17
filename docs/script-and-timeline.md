# Module 03 — Prompt Writing · Script & Timeline

**Higgsfield AI Course · Module 03 · «ПРОМПТ ЖАЗУДЫ ҮЙРЕНУ»**
Educational motion-design video introducing beginners to prompt logic for AI image and video generation.

| Spec | Value |
| --- | --- |
| Format | 16:9, 1920×1080, 30 fps, H.264 (yuv420p, BT.709) |
| Duration | 120.0 s |
| Audio | 48 kHz stereo AAC · Kazakh narration · UI/transition SFX · **no music** · −16 LUFS integrated, −1.5 dBTP |
| Subtitles | None |
| Render | `renders/module03-prompt-writing.mp4` |

Core message: **understand the logic of a prompt — don't memorise ready-made prompts.** Every scene shows one idea turning into a structured instruction, and every part of the instruction changing something you can see.

---

## Design system

| Token | Value | Use |
| --- | --- | --- |
| Background | `#0B0D11` charcoal, soft radial lift, 48 px dot grid at 4.5 % | every scene |
| Ink | `#F4F6FA` / `#A9B1BF` / `#636B79` | primary / secondary / tertiary text |
| Cyan | `#2FE0F2` | highlight, focus, "correct", active state |
| Violet | `#9B7BFF` | secondary accent (tracking path, alternating underlines) |
| Red | `#FF5468` | unwanted elements (Scene 5 only) |
| Amber | `#F7B955` | vague wording, caveats |
| Display type | Inter Display 700 | headlines, titles |
| UI type | Inter 500–700, tracked caps for labels | chips, kickers, labels |
| Prompt type | JetBrains Mono 400 | everything typed into a prompt field |

Motion rules: cubic in-out for layout moves (0.6–1.1 s), out-cubic for entrances (0.4–0.6 s), letter-rise kinetic type (22–35 ms stagger), one camera move at a time, 0.6 s cross-fade between scenes. Glow is reserved for the element the narration is talking about.

The "AI results" are procedural vector illustrations of one recurring shot — *a young man in a black coat walking down a rainy neon street at night* — so that camera, lighting and wording changes are compared on the same subject. They can be replaced with real Higgsfield generations frame-for-frame (see `src/js/illus-*.js`).

---

## Timeline overview

| # | Scene | Brief | Final cut | Narration |
| --- | --- | --- | --- | --- |
| 1 | The power of a prompt | 0–10 | 0:00.0 – 0:12.0 | 1.00 – 11.25 |
| 2 | The structure of a good prompt | 10–25 | 0:11.4 – 0:26.8 | 12.00 – 25.76 |
| 3 | Character, environment & action | 25–40 | 0:26.2 – 0:40.6 | 26.90 – 39.09 |
| 4 | Camera, lighting & atmosphere | 40–55 | 0:40.0 – 0:55.2 | 40.60 – 53.94 |
| 5 | What is a negative prompt? | 55–70 | 0:54.6 – 1:10.4 | 55.30 – 69.94 |
| 6 | Improving a bad result | 70–85 | 1:09.8 – 1:25.6 | 70.50 – 82.01 |
| 7 | Practical exercise: two prompts, one idea | 85–105 | 1:25.0 – 1:42.6 | 85.70 – 100.56 |
| 8 | Understand the logic + final frame | 105–120 | 1:42.0 – 2:00.0 | 102.70 – 117.24 |

Scenes overlap by 0.6 s (cross-fade). Boundaries follow the narration: Scene 1's three sentences need ~10.3 s after the opening light-point, so it runs to 0:12; Scene 7 gives back the difference. Total runtime is exactly 120 s.

---

## Scene 1 — The power of a prompt · 0:00.0 – 0:12.0

| Time | Visual | SFX |
| --- | --- | --- |
| 0.0 | Black. A cyan point of light fades up at centre. | soft pop |
| 0.9 | The point stretches into a line, then opens into a floating glass workspace. | whoosh |
| 2.0 | Idea icon (light bulb) draws in and lights up. Text cursor blinks. | pop |
| 3.1 | **IDEA** is typed. | keys |
| 4.3 | IDEA decodes letter by letter into **PROMPT**; an input field forms around it with a Generate button. | data ticks, pop |
| 5.9 | Generate is pressed. The field grows to full frame while the shot "denoises" in: rainy neon street, character walking toward camera. | click, generation shimmer, rain |
| 7.4 | Slow camera push-in. Title rises over a bottom scrim. | whoosh |
| 8.7 | Chain builds word by word, each arrow drawing in. | ticks |

On-screen text: **03 — ПРОМПТ ЖАЗУДЫ ҮЙРЕНУ** · **IDEA → PROMPT → RESULT**

> **VO** (1.00) AI-ға ойыңызды дұрыс жеткізуді үйренгіңіз келе ме? (4.45) Ол үшін промпт жазудың логикасын түсіну керек. (7.25) Бұл сабақта идеяңызды нақты әрі түсінікті нұсқауға айналдыруды үйренеміз.

## Scene 2 — The structure of a good prompt · 0:11.4 – 0:26.8

| Time | Visual | SFX |
| --- | --- | --- |
| 11.7 | A blank prompt card appears at centre with a blinking cursor. | pop |
| 12.9 | It becomes a column with five dashed, numbered slots; an empty preview frame opens on the right. | whoosh, ticks |
| 14.95 | **КЕЙІПКЕР · SUBJECT** slides in → the character appears in a neutral grey "previs" space. | click, keys |
| 15.66 | **ОРТА · ENVIRONMENT** → the street builds around him. | click, whoosh |
| 16.33 | **ӘРЕКЕТ · ACTION** → he starts walking. | click |
| 17.10 | **КАМЕРА · CAMERA** → camera icon, REC dot, rule-of-thirds and corner brackets; framing tightens. | click, shutter |
| 17.86 | **ЖАРЫҚ ЖӘНЕ СТИЛЬ · LIGHTING & STYLE** → grey previs re-lights to neon night with rain; a palette strip shifts from greys to neon. | click, shimmer, rain |
| 19.75 | The five cards collapse into one cohesive prompt (phrases underlined by part). | whoosh, pop |
| 21.05 | Split screen: **VAGUE** "a man in a city" → flat generic result · **DETAILED** merged prompt → the cinematic shot. | whoosh, keys, shimmer |

Each card's snippet: *a young man in a black coat* · *rainy neon city street at night* · *walks slowly toward the camera* · *medium shot, slow dolly-in* · *neon rim light, cinematic, moody*.

On-screen text: **КЕЙІПКЕР · ОРТА · ӘРЕКЕТ · КАМЕРА · ЖАРЫҚ ЖӘНЕ СТИЛЬ**

> **VO** (12.00) Жақсы промпт бірнеше маңызды бөліктен тұрады: кейіпкер, орта, әрекет, камера, жарық және визуалдық стиль. (20.40) Әр бөлікті нақты сипаттау арқылы AI-ға қандай нәтиже қажет екенін жақсырақ түсіндіресіз.

## Scene 3 — Character, environment & action · 0:26.2 – 0:40.6

| Time | Visual | SFX |
| --- | --- | --- |
| 26.4 | A neutral mannequin stands on a grid floor in empty space. The example prompt types in below (dim). | keys |
| 26.90 | **WHO?** connects to the figure; it becomes the young man in the black coat. "A young man wearing a black coat" lights up. | pop |
| 28.69 | **WHERE?** connects to the street; buildings rise, neon flickers on, rain starts. "through a rainy futuristic city street at night" lights up. | pop, whoosh, rain |
| 30.56 | **WHAT HAPPENS?** connects to his feet; a dashed path shows him walking slowly toward camera. "walks slowly" lights up. | pop |
| 33.10 | «a person walks» (amber) appears beside the prompt, is struck through, and an arrow points to the specific version. | pop, tick |
| 36.14 | Clothes → environment → action pulse in turn, label and phrase together. | ticks |

Example prompt (exact): *A young man wearing a black coat walks slowly through a rainy futuristic city street at night.*

On-screen text: **WHO? · WHERE? · WHAT HAPPENS?**

> **VO** (26.90) Алдымен кейіпкердің кім екенін, оның қай жерде орналасқанын және не істеп жатқанын сипаттаңыз. (33.10) Мысалы, жай ғана «адам жүріп келеді» деудің орнына, оның киімін, ортасын және әрекетін нақтылауға болады.

## Scene 4 — Camera, lighting & atmosphere · 0:40.0 – 0:55.2

| Time | Visual | SFX |
| --- | --- | --- |
| 40.3 | **CAMERA ANGLE**: three frames of the same moment — WIDE · MEDIUM · CLOSE-UP. | pops |
| 43.0 | They shrink to a filmstrip; the main stage plays the wide shot. | whoosh |
| 44.35 | Cut to medium shot (shallow depth of field). | shutter |
| 45.30 | Cut to close-up: profile, neon rim light on the face, slow push-in. | shutter |
| 46.85 | **CAMERA MOVEMENT**: top-down diagram. Camera on a track, field-of-view cone. | whoosh |
| 47.20 | DOLLY IN: camera travels toward the subject; inset shot pushes in to match. | slide |
| 48.44 | TRACKING (dashed violet): the alternative — moving alongside. | slide |
| 50.20 | **LIGHTING · STYLE · ATMOSPHERE**. Same character, same street, same framing: SOFT MORNING LIGHT → DRAMATIC SIDE LIGHT → NEON · DARK ATMOSPHERE, revealed with horizontal wipes. | whoosh, swipes, rain |

On-screen text: **CAMERA ANGLE · CAMERA MOVEMENT · LIGHTING · STYLE · ATMOSPHERE**

> **VO** (40.60) Камера бұрышы мен қозғалысын да көрсетіңіз. (43.30) Жалпы көрініс пе, әлде кейіпкердің бетіне жақын кадр ма? (47.20) Камера жақындай ма, әлде жанымен қозғала ма? (50.50) Жарық, түс және атмосфера да нәтижеге тікелей әсер етеді.

## Scene 5 — What is a negative prompt? · 0:54.6 – 1:10.4

| Time | Visual | SFX |
| --- | --- | --- |
| 54.8 | **NEGATIVE PROMPT** headline. Prompt field types the example prompt; caption beneath. | whoosh, keys |
| 56.7 | Generate → portrait resolves with flaws: blurred face, a seven-fingered hand, a ghost duplicate, garbled text, flat low-detail rendering. | click, shimmer |
| 58.0 | Clean red dashed outlines tag each flaw: BLURRY · HANDS · DUPLICATE · TEXT · LOW DETAIL. | soft error blips |
| 59.6 | The Negative Prompt field slides in under the main prompt. | whoosh |
| 60.60 | The negative prompt is typed; as each term completes, its flaw disappears and its outline turns into a cyan check. | keys, checks |
| 65.0 | Regenerate shimmer across the clean portrait. | click, shimmer |
| 66.80 | Caveat: an amber **≠ 100%** chip; a faint trace of the text artifact returns inside a dashed amber outline — it narrows the odds, it doesn't guarantee. | pop |

Example prompt (exact): *Portrait of a young man, cinematic lighting, realistic skin texture.*
Example negative prompt (exact): *blurry, distorted hands, duplicate subjects, unwanted text, low detail.*

On-screen text: **NEGATIVE PROMPT** · **НЕГІЗГІ НҰСҚАУ — ҚАЖЕТТІ НӘТИЖЕ** · **NEGATIVE PROMPT — ҚАЖЕТСІЗ ЭЛЕМЕНТТЕРДІ ШЕКТЕУ**

> **VO** (55.30) Negative Prompt — нәтижеде көрінбеуі керек элементтерді көрсетуге арналған қосымша нұсқау. (60.60) Мысалы, бұлыңғырлықты, артық кейіпкерлерді немесе бұрмаланған қолдарды шектеуге болады. (66.80) Бірақ ол барлық қатені міндетті түрде жояды деген сөз емес.

## Scene 6 — Improving a bad result · 1:09.8 – 1:25.6

| Time | Visual | SFX |
| --- | --- | --- |
| 70.0 | A flat, grey, generic result appears; a red ✕ marks it as "not what I meant". Beside it the prompt: *a man walking somewhere in a nice city, cool style* — **VAGUE PROMPT**. | shimmer, pop, error |
| 72.3 | The whole prompt gets selected (the replace-everything reflex) — rejected with ✕, selection clears. | tick, error |
| 75.40 | The vague parts light up amber with "?" markers: *a man* · *walking somewhere* · *in a nice city* · *cool style*. | ticks |
| 78.30 | Editor opens — **MORE SPECIFIC DETAILS**. Only the vague parts are replaced: *a young man in a black coat* · *walks slowly toward the camera* · *on a rainy neon-lit street at night* · *medium shot, slow dolly-in*. | keys |
| 81.8 | Layout rises; the original prompt stays under the original image for comparison. Generate pressed. | whoosh, click, shimmer |
| 82.4 | **IMPROVED RESULT** wipes in horizontally beside the original; same idea, now specific. Cyan ✓. | swipe, check |

On-screen text: **VAGUE PROMPT · MORE SPECIFIC DETAILS · IMPROVED RESULT**

> **VO** (70.50) Егер нәтиже ойыңыздағыдай болмаса, промптты бірден толығымен ауыстырудың қажеті жоқ. (75.40) Алдымен қай бөлігі түсініксіз екенін анықтаңыз. (78.30) Содан кейін қажетті детальдарды нақтылап, нәтижені қайта тексеріңіз.

## Scene 7 — Practical exercise: two prompts, one idea · 1:25.0 – 1:42.6

| Time | Visual | SFX |
| --- | --- | --- |
| 85.3 | **ONE IDEA** (chip: a robot in a desert) → moves to the header; **TWO PROMPTS** joins it. Two equal panels open. | whoosh, pop |
| 87.8 | Prompt A typed → Generate → flat midday desert, small boxy robot, eye level. | keys, click, shimmer |
| 90.9 | Prompt B typed → Generate → low-angle golden-hour desert, towering brushed-metal robot, warm backlight, blowing sand. | keys, click, shimmer, wind |
| 96.2 | **COMPARE THE RESULTS**. Numbered markers appear one by one, each tying a phrase in Prompt B to what it changed in the image: 1 CHARACTER · 2 ENVIRONMENT · 3 CAMERA ANGLE · 4 LIGHTING · 5 ATMOSPHERE. Prompt A's two generic words get grey markers. | ticks |
| 99.6 | Coverage row under each prompt: B specifies all five relevant details, A only two, vaguely. The comparison is about relevant details, not word count. | pop |

Prompt A (exact): *A robot stands in a desert.*
Prompt B (exact): *A tall futuristic robot with a brushed-metal body stands alone in a vast golden desert at sunset. Wide cinematic shot, low camera angle, wind blowing sand across the ground, warm backlighting, dramatic atmosphere, highly detailed science-fiction aesthetic.*

On-screen text: **ONE IDEA · TWO PROMPTS · COMPARE THE RESULTS**

> **VO** (85.70) Енді тәжірибе жасап көріңіз. (87.60) Бірінші промптта идеяңызды қысқаша сипаттаңыз. (90.70) Екінші промптта кейіпкерді, ортаны, камераны және жарықты нақтылаңыз. (96.20) Екі нәтижені салыстырып, қандай нұсқа сіздің ойыңызды дәлірек жеткізгенін анықтаңыз.

## Scene 8 — Understand the logic · 1:42.0 – 2:00.0

| Time | Visual | SFX |
| --- | --- | --- |
| 102.1 | All parts drift back in as floating cards (five parts + Negative Prompt). | whoosh |
| 103.7 | **ПРОМПТТЫ ЖАТТАМА** rises at the top; the cards snap into a prompt blueprint: IDEA → five parts → PROMPT → RESULT, Negative Prompt feeding in. | pop, ticks, slide |
| 105.7 | **ОНЫҢ ЛОГИКАСЫН ТҮСІН!** in cyan. | pop |
| 107.9 | The blueprint's result frame expands to full screen and resolves into the finished shot. | shimmer, rain |
| 109.6 | Slow pull-back: the shot settles into a frame; **IDEA → STRUCTURE → PROMPT → RESULT** builds beneath. | ticks |
| 114.4 | Frame fades; minimal dark background. | whoosh |
| 115.0 | Final frame: **PROMPT WRITING**, cyan rule, **ОЙЫҢДЫ AI-ҒА ДҰРЫС ЖЕТКІЗ**, soft cyan glow. | low swell |
| 119.0 | Fade to black at 120.0. | — |

> **VO** (102.70) Ең бастысы — дайын промпттарды жаттап алу емес, олардың логикасын түсіну. (107.80) Ойыңызды нақты сипаттауды үйренсеңіз, кез келген идеяңызды AI-ға тиімдірек жеткізе аласыз. (115.60) Келесі сабақта кездескенше!

---

## Production notes

- **Narration** — synthesized offline with Piper TTS using the ISSAI Kazakh voice `kk-issai-high`, male speaker *KazakhTTS2_M2* (dataset licence CC BY 4.0). Text is reproduced exactly (`script/voiceover.kk.json`); the speech engine alone receives two pronunciation respellings: *AI* → «Эй-Ай» and *Negative Prompt* → «Негатив промпт». Lines that need word-accurate sync (the five parts, WHO/WHERE/WHAT, wide vs close-up, dolly vs tracking, the negative-prompt examples) are synthesized phrase by phrase and joined with short pauses, so the visual cue lands on the word. For a human recording, read to the timecodes above; `audio/vo/*.flac` is the guide track.
- **Sound** — every effect is procedurally generated (`tools/sfx.py`): key clicks, UI clicks, ticks, pops, whooshes, generation shimmer, shutter, check/error blips, rain and wind beds, final swell. Effects are side-chain ducked under the voice. No music.
- **On-screen text** — exactly the text requested per scene, plus small English interface chips (Prompt, Generate, WIDE/MEDIUM/CLOSE-UP, DOLLY IN/TRACKING, shot/lighting names, artifact tags) that label what is being demonstrated.
