// Интроның ортақ таймлайны (секунд). Бұл файлды intro.html (сурет) де,
// audio.py (дыбыс) та оқиды — сондықтан сурет пен дыбыс әрдайым синхронды.
// Ескерту: { ... } ішін таза JSON күйінде сақтаңыз (audio.py JSON ретінде оқиды).
window.TIMELINE = {
  "width": 1920,
  "height": 1080,
  "fps": 24,
  "duration": 15.0,

  "studio": "YEMELBAI",
  "studioSub": "FILMS",
  "presents": "ҰСЫНАДЫ",
  "title": "ЖАҢҒЫРЫҚ",

  "lineStart": 0.5,
  "hit1": 1.75,
  "logoRise": 2.2,
  "filmsIn": 2.35,
  "presentsIn": 3.25,
  "logoOut": 4.5,
  "logoGone": 5.4,

  "dotIn": 5.7,
  "ping": 6.1,
  "pingInterval": 0.36,
  "pingCount": 5,

  "converge": 7.3,
  "hit2": 8.2,
  "echoInterval": 0.42,
  "echoCount": 7,
  "sweep": 9.3,

  "titleOut": 12.3,
  "lineCollapse": 12.9,
  "dotHit": 13.45,
  "dotGone": 13.9
};
