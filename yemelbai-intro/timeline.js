// Интроның ортақ таймлайны (секунд). Бұл файлды intro.html (сурет) де,
// audio.py (дыбыс) та оқиды — сондықтан сурет пен дыбыс әрдайым синхронды.
// Ескерту: window.TIMELINE мәнін таза JSON күйінде сақтаңыз (audio.py JSON ретінде оқиды).
// 0 – introEnd: YEMELBAI FILMS × VeoSeeBot интросы; introEnd – duration: Ziyo Fest AI кадры.
window.TIMELINE = {
  "width": 1920,
  "height": 1080,
  "fps": 24,
  "duration": 21.0,
  "introEnd": 15.0,

  "studio": "YEMELBAI",
  "studioSub": "FILMS",
  "presents": "ҰСЫНАДЫ",
  "captionTop": "ФИЛЬМ ТОЛЫҚТАЙ",
  "captionBottom": "ЖИ ПЛАТФОРМАСЫНДА ЖАСАЛДЫ",
  "logoScale": 2.15,
  "ziyoTop": "ФИЛЬМ АРНАЙЫ",
  "ziyoBottom": "ҮШІН ЖАСАЛДЫ",
  "ziyoScale": 1.38,

  "lineStart": 0.5,
  "hit1": 1.75,
  "logoRise": 2.2,
  "filmsIn": 2.35,
  "presentsIn": 3.25,
  "logoOut": 4.5,
  "logoGone": 5.4,

  "dotIn": 5.6,
  "ping": 5.9,
  "pingInterval": 0.36,
  "pingCount": 3,

  "drawStart": 6.2,
  "hit2": 7.6,
  "wordIn": 7.95,
  "tagIn": 8.65,
  "captionIn": 9.15,
  "sweep": 10.0,

  "outro": 12.4,
  "lineCollapse": 13.0,
  "dotHit": 13.55,
  "dotGone": 14.0,
  "echoInterval": 0.42,

  "zSpin": 15.25,
  "zHit": 16.3,
  "zPixels": 16.42,
  "zWordIn": 16.6,
  "zCaptionIn": 17.15,
  "zSweep": 18.2,
  "zOut": 19.8,
  "zGone": 20.6
};
