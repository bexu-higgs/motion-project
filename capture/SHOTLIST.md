# Higgsfield: түсірілім тізімі (shot list)

## Жағдайы

| Материал | Кім жасайды | Күйі |
|---|---|---|
| `02-video-section`, `03-text-to-video`, `05-model-picker`, `06-settings` | `tools/capture.mjs` (логинсіз, нақты сайт, 1.5×) | ✅ дайын |
| `04-image-to-video`: суретті **Add references → Upload file** арқылы жүктеу + промпт + Generate | автор (экран жазбасы; жүктеу логинді қажет етеді) | ⏳ |
| `start-frame.jpg`, `03b-t2v-result`, `04b-i2v-result`/`08-review-v1`, `08-review-v2`, `09-final-clip` | автор (Seedance 2.5, 5s, 9:16; сынақ 720p, финал 1080p) | ⏳ |

Видеодағы әр интерфейс кадры Higgsfield-тің **нақты** интерфейсінен жазылады. Интерфейс ойдан салынбайды. Тек таңдалған модельде шынымен көрінетін опциялар көрсетіледі. Файлдар `assets/` ішіне дәл осы атаулармен салынады. `project.config.json` оларды автоматты түрде қосады.

## Жазу баптаулары

* Браузер терезесі **1280×720** (немесе 1440×810), масштабы 100–125%. Видеода экран 1000 px енге кішірейтіледі, сондықтан UI мәтіндері оқылатындай болуы керек.
* 30 fps, MP4 (H.264). Тінтуір баяу әрі анық қозғалсын. Әр басудың алдында 0,3–0,5 с кідіріс жасаңыз.
* Жеке деректер (email, баланс, басқа жобалар) кадрға түспесін.
* `tools/capture.mjs` осыны автоматты түрде жасайды: көрінетін курсор мен басу ізін салады, 30 fps MP4 шығарады (`capture/shots.json` арқылы).

## Интерфейс жазбалары

| Файл | Сахна | Ұзақтығы | Не көрсетіледі |
|---|---|---|---|
| `assets/captures/02-video-section.mp4` | 02 · 10–25 с | ≈ 14 с | Басты беттен **Video** бөліміне өту. Text-to-Video және Image-to-Video жолдарының қалай басталатыны (мәтін өрісі / сурет жүктеу). |
| `assets/captures/03-text-to-video.mp4` | 03 · 25–50 с | ≈ 22 с | Text-to-Video: промпт өрісіне мысал промптты жазу. **Промпт толық жазылған соң ғана** генерация батырмасын басу. |
| `assets/captures/04-image-to-video.mp4` | 04 · 50–75 с | ≈ 20 с | Image-to-Video: бір адамның суретін жүктеу (бастапқы кадр), нұсқаулықты жазу, генерацияны бастау. |
| `assets/captures/05-model-picker.mp4` | 05 · 75–95 с | ≈ 18 с | Модель тізімін ашу, сипаттамаларға қысқаша қарау, сабаққа **бір** модельді таңдау. |
| `assets/captures/06-settings.mp4` | 06 · 95–112 с | ≈ 15 с | Таңдалған модельдің нақты ұзақтық, ажыратымдылық және кадр пішімі басқарулары. |

## Генерация нәтижелері (бір модельмен)

Сахна 05-те таңдалған модель қалған барлық демонстрацияда қолданылады.

| Файл | Кіріс | Промпт |
|---|---|---|
| `assets/captures/03b-t2v-result.mp4` | мәтін | `A character walks slowly through a neon-lit city street in light rain at night. The camera follows smoothly from behind. Reflections shimmer on the pavement, cinematic lighting, steady motion.` |
| `assets/media/start-frame.jpg` | — | Бір адамның фотосы (бастапқы кадр). Пайдалану құқығы бар сурет болуы керек. |
| `assets/captures/04b-i2v-result.mp4` және `08-review-v1.mp4` | start-frame | `The person slowly turns toward the camera and gives a subtle smile. The camera makes a gentle push-in. Preserve the person’s face, clothing, framing, and lighting. Keep the movement smooth and natural.` |
| `assets/captures/08-review-v2.mp4` | start-frame | Дәл сол промпт, **тек камера сөйлемі өзгереді**: `The camera slowly pushes in toward the face.` |
| `assets/captures/09-final-clip.mp4` | start-frame | Практика нұсқасы: бір әрекет + бір камера қозғалысы + қысқа ұзақтық. Ең сәттісі таңдалады. |

`04b-i2v-result.mp4` пен `08-review-v1.mp4` бір файл болуы мүмкін (көшірмесі).

## Бренд

* `assets/brand/higgsfield-logo.svg`: Higgsfield-тің **ресми** логотипі (сайттан немесе brand kit-тен; SVG немесе мөлдір PNG). Ол қайта салынбайды және созылмайды: композиция арақатынасын әрқашан сақтайды.

## Конфигурация (`project.config.json`)

* `model.name`: сахна 05-те таңдалған модельдің интерфейстегі **дәл** атауы (бос болса, атау көрсетілмейді).
* `settings.durations / resolutions / aspectRatios`: таңдалған модельде **шынымен көрінетін** мәндер ғана. Бос болса, сандар көрсетілмейді, тек түсіндірме беріледі.
* Әр жазба үшін: `trimStart` / `trimEnd` (секунд), `speed`, `zoom` (`[{ "t": 2, "x": 0.3, "y": 0.6, "s": 1.6 }]` — жазба ішінде жақындату), `highlights` (`[{ "t": 3, "d": 2, "x": 0.1, "y": 0.8, "w": 0.3, "h": 0.1, "label": "Prompt" }]` — нақты UI элементін көгілдір рамкамен белгілеу; координаттар 0..1).
