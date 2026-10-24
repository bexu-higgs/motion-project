# Seedance / Genjutsu промпттары — «Айдаһар жұмыртқасы»

Бұл промпттар blockout видеоны **қозғалыс пен камера референсі** ретінде пайдаланады
(Seedance-тағы «reference video → generate» тәсілі). Модель тек камераны, кадр
ауысуларын, кейіпкерлердің орнын, қозғалыс траекториясын және жарықтың өзгерісін
алады, ал blockout-тың қарапайым түрі мен материалдарын шынайы кадрға ауыстырады.

Промпттар **ағылшынша** жазылған: Seedance ағылшын (және қытай) тіліндегі
мәтінді әлдеқайда дәл түсінеді. Әр промпттың астында қазақша қысқа мазмұны бар.

## Қай файлды жүктеу керек

| Нұсқа | Видео референс (`@Video1`) | Ұзақтығы | Қашан қолдану |
|---|---|---|---|
| A — бір дубль | `renders/dragon_egg_blockout_30s.mp4` | 30 с | Модель 30 секундтық генерацияға рұқсат етсе |
| B — 1-бөлім | `renders/parts/part1_SH01-SH03_0-10s.mp4` | 10 с | Әр бөлімді бөлек генерациялап, кейін монтаждау |
| B — 2-бөлім | `renders/parts/part2_SH04-SH05_10-19.5s.mp4` | 9.5 с | |
| B — 3-бөлім | `renders/parts/part3_SH06-SH07_19.5-30s.mp4` | 10.5 с | |
| C — ірі план | `renders/closeup/look_at_each_other_5s.mp4` | 5 с | «Бір-біріне қарау» сахнасы, кезек-кезек ірі план |
| D — фотореализм | `renders/dragon_egg_blockout_30s.mp4` + `@image1`, `@image2` | 30 с | Кино стиліндегі фотореалистік нұсқа, адам мен айдаһар өз суреттеріңізден |

Генерация параметрлері (промптқа жазылмайды, интерфейстен қойылады):
16:9, ұзақтығы референс видеоның ұзақтығына тең, дыбыс — қалауыңызша.

Бөлімдер кадр ауысатын жерден кесілген, сондықтан монтажда түйіскен жер
байқалмайды. Кейіпкерлер үш бөлімде бірдей шығуы үшін бірінші бөлімнің
сәтті кадрынан адам мен айдаһардың суретін алып, келесі бөлімдерге
`@Image1` / `@Image2` ретінде қосуға болады (төмендегі «Қосымша» бөлімін қараңыз).

---

## A. Толық 30 секундтық промпт

```text
@Video1 is a coarse 3D blockout reference. Use only its camera positions, camera moves, shot cuts and their timing, character blocking, motion paths, order of events and lighting changes (sun direction and the warm glow coming from the egg). Do not use its untextured low-poly look, plain materials or flat sky.

The person in the rust-orange jacket in @Video1 is the person: a lone traveler in a worn rust-brown jacket, dark trousers, brown leather boots, short dark hair.
The round mossy stone at the end of the stone path in @Video1 is the exposed top of a giant dragon egg buried in the ground.
The tall dark egg in @Video1 is the same giant dragon egg: about 1.6 meters tall, dark teal shell flecked with bronze, its upper part covered in moss and soil so that at first it looks like a boulder.
The teal creature in @Video1 is a newborn baby dragon: teal-blue scales, cream belly, small ivory horns and back spikes, large golden eyes, thin wings.

An old-growth forest with huge moss-covered trunks, ferns, a shallow stream and a path of mossy stepping stones; soft morning sunlight falls through the canopy in beams, light mist between the trees.

Shot 1: wide crane-down shot; the person walks along the mossy stepping stones across the stream.
Shot 2: high follow shot from behind the person's right shoulder; the stones ahead, among them one larger round mossy stone.
Shot 3: low side view; the person's right foot lands on the round stone, the surface cracks and the leg breaks through up to the knee; warm golden light leaks out of the hole; the person loses balance, braces with both hands on the stone, pulls the foot out and steps back.
Shot 4: wide side view; the ground trembles, soil and moss slide away, and the round stone keeps pushing up out of the earth until a giant egg stands on the forest floor; the person backs away with bent knees.
Shot 5: low three-quarter angle with the person in the left foreground; glowing cracks spread over the shell and pulse like a heartbeat; the shell bursts outward in a flash of light and fragments fall around; the person shields their face with an arm; a damp baby dragon rises from the lower half of the shell, opens its mouth in a small cry, shakes its head and spreads its wings.
Shot 6: over-the-shoulder shot from behind the person; the baby dragon turns its head toward the person and tilts it with curiosity; the person slowly steps closer, kneels and holds out the right hand; the dragon stretches its neck and sniffs the hand.
Shot 7: side two-shot; the dragon pushes its head up into the person's palm and the person strokes it; the dragon half closes its eyes, comes closer, sits up and presses its cheek against the person's chest with its eyes closed; the person wraps an arm around its neck and holds it close; the camera slowly pulls back.

Keep only one person, one egg and one baby dragon throughout. Keep the person's clothing, the dragon's colors and size (its head reaches the chest of the kneeling person) and all left/right positions as in @Video1.
The person does not speak; no narration, no on-screen text. Sound: forest ambience and the stream, stone and shell cracking, a deep rumble of the ground, the baby dragon's soft chirps.
```

**Қазақша мазмұны:** blockout-тан тек камера, монтаж, кейіпкерлердің орны мен
қозғалысы алынады. Адам — тот-қызғылт күрте киген жолаушы; дөңгелек мүкті тас —
жерге көмілген алып айдаһар жұмыртқасының төбесі; көгілдір мақұлық — жаңа туған
бала айдаһар. 7 кадр сценарийі: жүріс → тасқа басу → аяқ жұмыртқаны жарып кіреді →
жұмыртқа жерден көтеріледі → жарқырап жарылады → айдаһар қанатын жаяды → адам
тізерлеп қолын созады → айдаһар басын алақанға тосып, кеудесіне басады, адам құшақтайды.

---

## B. Үш бөлімге бөлінген промпттар

### 1-бөлім · SH01–SH03 · 0–10 с

```text
@Video1 is a coarse 3D blockout reference. Use only its camera positions, camera moves, shot cuts and their timing, character blocking, motion paths and lighting. Do not use its untextured low-poly look, plain materials or flat sky.

The person in the rust-orange jacket in @Video1 is the person: a lone traveler in a worn rust-brown jacket, dark trousers, brown leather boots, short dark hair.
The round mossy stone at the end of the stone path in @Video1 is the exposed top of a giant dragon egg buried in the ground; it looks exactly like a mossy boulder.

An old-growth forest with huge moss-covered trunks, ferns, a shallow stream and a path of mossy stepping stones; soft morning sunlight falls through the canopy in beams, light mist between the trees.

Shot 1: wide crane-down shot; the person walks along the mossy stepping stones across the stream.
Shot 2: high follow shot from behind the person's right shoulder; the stones ahead, among them one larger round mossy stone.
Shot 3: low side view; the person's right foot lands on the round stone, the surface cracks and the leg breaks through up to the knee; warm golden light leaks out of the hole; the person loses balance, braces with both hands on the stone, pulls the foot out and steps back, staring at the glowing hole.

Keep one person and the same clothing throughout, and all left/right positions as in @Video1.
The person does not speak; no narration, no on-screen text. Sound: forest ambience, the stream, footsteps on stone, a sharp crack of breaking shell.
```

### 2-бөлім · SH04–SH05 · 10–19.5 с

```text
@Video1 is a coarse 3D blockout reference. Use only its camera positions, camera moves, shot cuts and their timing, character blocking, motion paths and lighting changes (the pulsing warm glow from the egg and the flash when it bursts). Do not use its untextured low-poly look, plain materials or flat sky.

The person in the rust-orange jacket in @Video1 is the person: a lone traveler in a worn rust-brown jacket, dark trousers, brown leather boots, short dark hair.
The dark egg in @Video1 is a giant dragon egg about 1.6 meters tall: dark teal shell flecked with bronze, its top covered in moss and soil.
The teal creature in @Video1 is a newborn baby dragon: teal-blue scales, cream belly, small ivory horns and back spikes, large golden eyes, thin wings.

The same old-growth forest with huge mossy trunks and ferns, soft morning sunlight through the canopy.

At the start the person stands a few steps from a mossy mound with a small glowing hole in it.
Shot 4: wide side view; the ground trembles, soil and moss slide away, and the mound keeps pushing up out of the earth until a giant egg stands on the forest floor; the person backs away with bent knees.
Shot 5: low three-quarter angle with the person in the left foreground; glowing cracks spread over the shell and pulse like a heartbeat; the shell bursts outward in a flash of light and fragments fall around; the person shields their face with an arm; a damp baby dragon rises from the lower half of the shell, opens its mouth in a small cry, shakes its head and spreads its wings.

Keep only one person, one egg and one baby dragon. Keep all left/right positions as in @Video1.
The person does not speak; no narration, no on-screen text. Sound: a deep rumble of the ground, cracking shell, a soft burst, the baby dragon's first chirp.
```

### 3-бөлім · SH06–SH07 · 19.5–30 с

```text
@Video1 is a coarse 3D blockout reference. Use only its camera positions, camera moves, shot cuts and their timing, character blocking and motion paths. Do not use its untextured low-poly look, plain materials or flat sky.

The person in the rust-orange jacket in @Video1 is the person: a lone traveler in a worn rust-brown jacket, dark trousers, brown leather boots, short dark hair.
The teal creature in @Video1 is a newborn baby dragon: teal-blue scales, cream belly, small ivory horns and back spikes, large golden eyes, thin folded wings. Its head reaches the chest of the kneeling person.

The same old-growth forest with huge mossy trunks and ferns, soft morning sunlight through the canopy; broken pieces of a giant eggshell lie around the dragon.

Shot 6: over-the-shoulder shot from behind the person; the baby dragon stands in the remains of its shell, turns its head toward the person and tilts it with curiosity; the person slowly steps closer, kneels and holds out the right hand; the dragon stretches its neck and sniffs the hand.
Shot 7: side two-shot; the dragon pushes its head up into the person's palm and the person gently strokes it; the dragon half closes its eyes, comes closer, sits up and presses its cheek against the person's chest with its eyes closed; the person wraps an arm around its neck and holds it close, head bowed toward the dragon; the camera slowly pulls back.

Keep only one person and one baby dragon. Keep all left/right positions as in @Video1.
The person does not speak; no narration, no on-screen text. Sound: quiet forest ambience, soft breathing, the baby dragon's gentle purring chirps.
```

---

## C. «Бір-біріне қарау» — 5 секундтық ірі план сахнасы

Референс: `renders/closeup/look_at_each_other_5s.mp4` (5 с, 5 кадр). Фильмде SH05
(жұмыртқа жарылуы) мен SH06 (адам жақындап тізерлеуі) арасына қойылады.

```text
@Video1 is a coarse 3D blockout reference. Use only its camera positions, framing, shot cuts and their timing, character blocking, head turns and motion paths. Do not use its untextured low-poly look, plain materials, cartoon faces or flat sky.

The person in the rust-orange jacket in @Video1 is the person: a lone traveler in a worn rust-brown jacket, short dark hair, a natural realistic face.
The teal creature in @Video1 is a newborn baby dragon: teal-blue scales, cream belly and throat, small ivory horns, very large golden eyes, slightly damp skin, small half-folded wings. It stands among the pieces of its broken eggshell.

The same old-growth forest with moss-covered trunks and ferns, soft morning light through the canopy, shallow depth of field in every close-up.

The mood moves from fear to tenderness.
Shot 1: close-up of the person's face from slightly below. Having just watched the egg burst, the person is frightened: eyes wide, eyebrows raised and drawn together, lips parted, quick shallow breathing; the person leans back and takes half a step away, one hand raised in front of the chest and the other pressed to the chest.
Shot 2: close-up of the baby dragon looking up at the person. Its pupils slowly widen from thin slits into big round dark pupils, it blinks once, tilts its head to one side and lets out a tiny chirp.
Shot 3: close-up of the person again. The fear drains away: the eyebrows relax, the raised hand slowly lowers, the head tilts a little, the person blinks and a soft, surprised smile appears.
Shot 4: close-up of the baby dragon. It squints happily, tilts its head the other way, gives a small hop with a quick flutter of its wings and chirps again.
Shot 5: medium shot over the back of the dragon's head; the smiling person takes a careful step toward the dragon and starts to hold out a hand, palm up.

Keep one person and one baby dragon. The person always looks at the dragon and the dragon always looks at the person, with the same screen directions as in @Video1.
The person does not speak; no narration, no on-screen text. Sound: quiet forest ambience, the person's nervous breathing that calms down, the baby dragon's soft chirps.
```

**Қазақша мазмұны:** бес кадр кезектесіп жүреді. Адам қорқып артқа шегінеді →
айдаһардың қарашығы үлкейіп, басын қисайтып шырылдайды → адам жұмсарып жымияды →
айдаһар қуанып секіреді → адам айдаһарға қарай қадам басып, қолын созады.
Бетке эмоцияны (қорқу, жымию) blockout-тағы манекен ғана шамамен көрсетеді,
шынайы бет әлпетін промпттағы сипаттама береді.

## D. Фотореалистік, кинематографиялық 30 секундтық промпт (@image1 — адам, @image2 — айдаһар)

Жүктелетін файлдар: `@video1` — `renders/dragon_egg_blockout_30s.mp4`,
`@image1` — адамның суреті, `@image2` — айдаһардың суреті.
Камера, кадр құрылымы, монтаж уақыты мен қозғалыстың бәрі `@video1`-ден алынады.
Сыртқы келбетті тек суреттер береді, сондықтан промптта адам мен айдаһардың
түсі немесе киімі сипатталмаған.

```text
Photorealistic, cinematic live-action re-render of @video1.

@video1 is a 3D blockout reference. Keep exactly its camera positions, camera moves, framing and lens choices, shot cuts and their timing, character positions, motion paths, the order and timing of every action, and its lighting directions: sunlight falling through the canopy and the warm golden glow coming from inside the egg. Do not use its untextured low-poly shapes, plain colours, mannequin faces or flat grey sky.
@image1 defines the person's face, hair, body and clothing; do not use its background or framing.
@image2 defines the baby dragon's head shape, eyes, scales, colours, horns and wings; do not use its background or framing.
@image1 and @image2 do not change the camera, framing or composition of @video1.

The person in the rust-orange jacket in @video1 is the person from @image1.
The teal creature in @video1 is the baby dragon from @image2, at the newborn size shown in @video1: when the person kneels, the dragon's head reaches the person's chest.
The round mossy stone at the end of the stepping-stone path in @video1 is the exposed top of a giant dragon egg buried in the ground. The tall dark egg in @video1 is the same egg: about 1.6 meters tall, a dark shell flecked with bronze, its top covered in moss and soil so that at first it looks like a boulder.

Look: an old-growth forest in the early morning with huge moss-covered trunks, ferns, a shallow clear stream and mossy stepping stones; soft volumetric sunbeams through the canopy, light mist and dust floating in the light; realistic skin, fabric, wet moss, bark, eggshell and scale textures; a natural film colour grade with warm sunlight and cool green shadows; realistic depth of field and subtle film grain, like a feature film.

Shot 1: wide establishing crane-down shot; the person walks across the mossy stepping stones over the stream.
Shot 2: high follow shot from behind the person's right shoulder; the person watches their footing on the stones ahead, among them one larger round mossy stone.
Shot 3: low side view; the person's right foot lands on the round stone, the surface cracks and the leg breaks through up to the knee; warm golden light spills out of the hole; startled, the person throws out both arms for balance, braces both hands on the stone, pulls the leg free and backs away, staring at the glowing hole.
Shot 4: wide side view; the ground trembles, soil and moss slide away and the round stone pushes up out of the earth until a giant egg stands on the forest floor; the person backs away with bent knees, eyes fixed on it.
Shot 5: low three-quarter angle with the person in the left foreground; golden cracks spread over the shell and pulse like a heartbeat; the shell bursts outward in a flash of light and fragments fall around; the person flinches and shields their face with a forearm; the damp baby dragon rises from the lower half of the shell, opens its mouth in a small first cry, shakes its head and spreads its wings.
Shot 6: over-the-shoulder shot from behind the person; the baby dragon turns its head toward the person and tilts it with curiosity; the person slowly steps closer, kneels on one knee and holds out the right hand; the dragon stretches its neck and sniffs the hand.
Shot 7: side two-shot; the dragon pushes its head up into the person's palm and the person gently strokes it with a soft smile; the dragon half closes its eyes, comes closer, sits up and presses its cheek against the person's chest with its eyes closed; the person, now kneeling on both knees, wraps an arm around its neck and bows their head over it; the camera slowly pulls back.

Keep only one person, one egg and one baby dragon. The person keeps the look of @image1 and the dragon keeps the look of @image2 in every shot. Keep all screen directions and left/right positions as in @video1.
The person does not speak; no narration, no on-screen text. Sound: forest ambience and the stream, footsteps on stone, stone and shell cracking, a deep rumble of the ground, the person's startled breathing, the baby dragon's soft chirps.
```

**Қазақша мазмұны:** фотореалистік, кино стиліндегі қайта рендер. `@video1`-ден камераның
орны мен қозғалысы, кадр құрылымы, монтаж уақыты және әрекеттердің реті өзгеріссіз
алынады. Адамның келбеті `@image1`-ден, айдаһардың келбеті `@image2`-ден алынады.
Жұмыртқа суретте жоқ болғандықтан, мәтінмен сипатталған. Көрініс: таңғы мүкті орман,
ағаштар арасынан түскен күн сәулесі, жеңіл тұман, шынайы текстуралар, кино түс-реңі.

## Қосымша: кейіпкер суреттерін қосу

Бірінші генерациядан кейін адам мен айдаһар ұнаса, олардың анық кадрын (немесе
жеке генерацияланған кейіпкер суретін) сақтап, келесі промпттардың басына мына
жолдарды қосыңыз — сонда үш бөлімде кейіпкерлер бірдей болады:

```text
@Image1 defines the person's face, hair and clothing; do not use its background.
@Image2 defines the baby dragon's head shape, scale colors, horns and wings; do not use its background.
```

## Кеңестер

- **Seedance**: «Reference video» ретінде blockout-ты жүктеңіз, промптты қойыңыз,
  16:9 және референс ұзақтығын таңдаңыз. Нәтиже blockout-тан алыс кетсе,
  промпттағы `Use only its camera positions...` жолын қалдырып, сахна сипаттамасын
  қысқартыңыз.
- **Genjutsu** немесе басқа video-to-video құралдары: сол бөлімдерді (немесе
  `renders/shots/` ішіндегі жеке кадрларды) кіріс видео ретінде беріп, сол
  промпттың мәтінін стиль/сахна сипаттамасы ретінде қолданыңыз.
- Әр кадр жеке керек болса: `renders/shots/SH01...SH07.mp4`.
