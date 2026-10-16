import voTimings from './vo-timings.json';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Reading-speed estimate for a calm, beginner-friendly Kazakh narration.
const CHARS_PER_SEC = 16;
const SEC_PER_DIGIT = 0.26; // "1800" is spoken as several words
const DEFAULT_PAUSE = 0.35;

export type Line = {
  id: string;
  text: string;
  /** extra seconds of silence after the line (room for the visual to play out) */
  pause?: number;
};

export type SceneId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7' | 's8' | 's9' | 's10';

type SceneDef = {id: SceneId; name: string; lead: number; tail: number; lines: Line[]};

// The narration below is the exact Kazakh voiceover from the brief, split into sentences.
export const SCRIPT: SceneDef[] = [
  {
    id: 's1',
    name: 'Introduction',
    lead: 1.6,
    tail: 1.0,
    lines: [
      {id: 's1_1', text: 'Сәлем!'},
      {id: 's1_2', text: 'Егер сіз Higgsfield сайтына менің жеңілдік сілтемем арқылы кіріп, жеңілдікті қалай алуды білмей жүрсеңіз, бұл видео сізге арналған.'},
      {id: 's1_3', text: 'Қазір барлығын рет-ретімен, қарапайым тілмен түсіндіремін.'},
    ],
  },
  {
    id: 's2',
    name: 'Open the referral link',
    lead: 0.6,
    tail: 1.2,
    lines: [
      {id: 's2_1', text: 'Бірінші қадам.'},
      {id: 's2_2', text: 'Ең алдымен, бірінші арнадағы менің жеңілдік сілтемеме өтіңіз.', pause: 0.6},
      {id: 's2_3', text: 'Сілтемені басқаннан кейін Higgsfield сайты ашылады.'},
    ],
  },
  {
    id: 's3',
    name: 'Open the menu and register',
    lead: 0.5,
    tail: 1.4,
    lines: [
      {id: 's3_1', text: 'Екінші қадам.'},
      {id: 's3_2', text: 'Экранның сол жақ жоғарғы бұрышындағы төртбұрыш белгісін басыңыз.', pause: 0.5},
      {id: 's3_3', text: 'Сол жақтан мәзір ашылады.', pause: 0.6},
      {id: 's3_4', text: 'Оның төменгі жағында Sign Up немесе Log In деген батырмалар болады.', pause: 0.9},
      {id: 's3_5', text: 'Егер аккаунтыңыз әлі болмаса, Sign Up батырмасын басыңыз.'},
      {id: 's3_6', text: 'Ал аккаунтыңыз бар болса, Log In батырмасын таңдаңыз.', pause: 0.9},
      {id: 's3_7', text: 'Тіркелу үшін Google, Microsoft, Apple ID немесе электрондық поштаңызды пайдалануға болады.', pause: 0.6},
      {id: 's3_8', text: 'Өзіңізге ыңғайлы тәсілді таңдап, тіркелуді аяқтаңыз.', pause: 0.6},
    ],
  },
  {
    id: 's4',
    name: 'Open Go Premium',
    lead: 0.5,
    tail: 1.4,
    lines: [
      {id: 's4_1', text: 'Үшінші қадам.'},
      {id: 's4_2', text: 'Аккаунтқа кіргеннен кейін, экранның оң жақ жоғарғы бұрышындағы Upgrade батырмасын баспаңыз!', pause: 1.0},
      {id: 's4_3', text: 'Оның орнына сол жақтағы мәзірді қайта ашып, профиліңізге өтіңіз.', pause: 1.2},
      {id: 's4_4', text: 'Сол жерден Get Premium деген батырманы тауып, соны басыңыз.', pause: 0.6},
    ],
  },
  {
    id: 's5',
    name: 'Understand the annual billing price',
    lead: 0.6,
    tail: 1.0,
    lines: [
      {id: 's5_1', text: 'Төртінші қадам.'},
      {id: 's5_2', text: 'Енді жазылым таңдайтын бет ашылады.'},
      {id: 's5_3', text: 'Мұнда бір маңызды нәрсеге назар аударыңыз.', pause: 0.6},
      {id: 's5_4', text: 'Алғашында көрініп тұрған баға бір айдың бағасы сияқты көрінуі мүмкін.'},
      {id: 's5_5', text: 'Бірақ абай болыңыз!'},
      {id: 's5_6', text: 'Бұл — толық 12 айдың жалпы бағасын айларға бөліп көрсеткен сома.', pause: 0.5},
      {id: 's5_7', text: 'Яғни, төлемді бірден 12 айға жасауыңыз керек болады.', pause: 0.6},
      {id: 's5_8', text: 'Бізге бұл нұсқа қажет емес.'},
      {id: 's5_9', text: 'Бізге ай сайын төленетін жазылым керек.'},
    ],
  },
  {
    id: 's6',
    name: 'Switch to monthly billing',
    lead: 0.6,
    tail: 1.2,
    lines: [
      {id: 's6_1', text: 'Ол үшін Monthly деген батырманы табыңыз.', pause: 0.5},
      {id: 's6_2', text: 'Егер телефоныңыздың тік тұрған экранында бұл батырма көрінбесе, уайымдамаңыз.', pause: 4.4},
      {id: 's6_3', text: 'Телефонды көлденеңінен бұрыңыз.', pause: 1.0},
      {id: 's6_4', text: 'Сонда Monthly батырмасы көрінуі керек.', pause: 0.5},
      {id: 's6_5', text: 'Осы батырманы басып, ай сайынғы төлем түріне ауысыңыз.', pause: 1.0},
      {id: 's6_6', text: 'Есіңізде болсын: айлық жазылымның бағасы жылдық жазылымның айға бөлінген бағасынан жоғары болуы мүмкін.', pause: 0.8},
    ],
  },
  {
    id: 's7',
    name: 'Explain the Max discount',
    lead: 0.6,
    tail: 1.2,
    lines: [
      {id: 's7_1', text: 'Бесінші қадам.'},
      {id: 's7_2', text: 'Енді жеңілдікке назар аударайық.'},
      {id: 's7_3', text: 'Менің жеңілдігім тек Max жазылымына қолданылады.'},
      {id: 's7_4', text: 'Pro жазылымына бұл жеңілдік жүрмейді.', pause: 0.7},
      {id: 's7_5', text: 'Max жазылымының үш нұсқасы бар.', pause: 0.6},
      {id: 's7_6', text: 'Біріншісі — 1800 кредит.'},
      {id: 's7_7', text: 'Қалыпты бағасы 79 доллар болса, жеңілдікпен 59 долларға аласыз.', pause: 1.0},
      {id: 's7_8', text: 'Екіншісі — 3600 кредит.'},
      {id: 's7_9', text: 'Қалыпты бағасы 158 доллар, ал жеңілдікпен 115 доллар болады.', pause: 1.0},
      {id: 's7_10', text: 'Үшіншісі — 5400 кредит.'},
      {id: 's7_11', text: 'Қалыпты бағасы 237 доллар болса, жеңілдікпен небәрі 159 доллар тұрады.', pause: 1.0},
      {id: 's7_12', text: 'Көріп тұрғаныңыздай, кредит саны көбейген сайын бір кредиттің құны тиімдірек болады.', pause: 0.6},
      {id: 's7_13', text: 'Сондықтан өзіңізге қажетті нұсқаны таңдаңыз.', pause: 0.4},
    ],
  },
  {
    id: 's8',
    name: 'Select Max and complete payment',
    lead: 0.6,
    tail: 1.6,
    lines: [
      {id: 's8_1', text: 'Алтыншы қадам.'},
      {id: 's8_2', text: 'Қажетті Max жазылымын таңдағаннан кейін Get Max батырмасын басыңыз.', pause: 0.8},
      {id: 's8_3', text: 'Одан соң төлем беті ашылады.'},
      {id: 's8_4', text: 'Банк картаңыздың қажетті мәліметтерін енгізіп, төлемді растаңыз.', pause: 0.6},
      {id: 's8_5', text: 'Төлемді аяқтамас бұрын таңдалған жазылымның айлық екеніне және жеңілдікпен көрсетілген бағаның дұрыс екеніне тағы бір рет көз жеткізіңіз.', pause: 1.6},
    ],
  },
  {
    id: 's9',
    name: 'The three-hour deadline',
    lead: 0.6,
    tail: 1.2,
    lines: [
      {id: 's9_1', text: 'Соңғы әрі ең маңызды ескерту!', pause: 0.6},
      {id: 's9_2', text: 'Бұл жеңілдік аккаунтыңызды алғаш ашқан сәттен бастап небәрі үш сағат бойы қолжетімді болады.'},
      {id: 's9_3', text: 'Үш сағат өткеннен кейін жеңілдік жойылады.', pause: 0.6},
      {id: 's9_4', text: 'Сондықтан менің сілтемем арқылы тіркелген соң, қажетті жазылымды таңдап, төлемді үш сағаттың ішінде аяқтаңыз.', pause: 0.6},
    ],
  },
  {
    id: 's10',
    name: 'Final recap',
    lead: 0.6,
    tail: 2.6,
    lines: [
      {id: 's10_1', text: 'Осымен болды!'},
      {id: 's10_2', text: 'Енді сіз Higgsfield Max жазылымын жеңілдікпен қалай алуға болатынын білесіз.', pause: 1.6},
      {id: 's10_3', text: 'Егер видео пайдалы болса, сақтап қойыңыз.'},
      {id: 's10_4', text: 'Ал сұрақтарыңыз болса, маған жазыңыз!'},
    ],
  },
];

export const estimateSeconds = (text: string): number => {
  const digits = (text.match(/\d/g) ?? []).length;
  const chars = text.replace(/\d/g, '').length;
  return chars / CHARS_PER_SEC + digits * SEC_PER_DIGIT + 0.2;
};

type VoEntry = {duration: number; file?: string};
const VO: Record<string, VoEntry> = (voTimings as {lines?: Record<string, VoEntry>}).lines ?? {};

export type Cue = {id: string; from: number; to: number; text: string; file?: string};
export type SceneTiming = {id: SceneId; name: string; start: number; duration: number; cues: Record<string, Cue>};

const toFrames = (s: number) => Math.round(s * FPS);

export const TIMELINE: SceneTiming[] = (() => {
  let start = 0;
  return SCRIPT.map((scene) => {
    let t = scene.lead;
    const cues: Record<string, Cue> = {};
    for (const line of scene.lines) {
      const dur = VO[line.id]?.duration ?? estimateSeconds(line.text);
      cues[line.id] = {id: line.id, from: toFrames(t), to: toFrames(t + dur), text: line.text, file: VO[line.id]?.file};
      t += dur + (line.pause ?? DEFAULT_PAUSE);
    }
    const duration = toFrames(t + scene.tail);
    const timing: SceneTiming = {id: scene.id, name: scene.name, start, duration, cues};
    start += duration;
    return timing;
  });
})();

export const TOTAL_FRAMES = TIMELINE.reduce((sum, s) => sum + s.duration, 0);

export const sceneTiming = (id: SceneId): SceneTiming => {
  const s = TIMELINE.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
};

/** Cue helpers for one scene: at('s3_2') = first frame of that sentence, end('s3_2') = last. */
export const cues = (id: SceneId) => {
  const s = sceneTiming(id);
  const get = (lineId: string) => {
    const c = s.cues[lineId];
    if (!c) throw new Error(`Unknown line ${lineId}`);
    return c;
  };
  return {
    duration: s.duration,
    at: (lineId: string) => get(lineId).from,
    end: (lineId: string) => get(lineId).to,
    /** frame at fraction p (0..1) through a sentence — handy to hit a word mid-sentence */
    mid: (lineId: string, p: number) => Math.round(get(lineId).from + (get(lineId).to - get(lineId).from) * p),
  };
};
