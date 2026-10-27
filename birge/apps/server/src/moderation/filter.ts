/**
 * Чаттағы балағат сөздерді жұлдызшамен жабатын қарапайым сүзгі
 * (App Store 1.2 және Google Play UGC саясаттары талап ететін «қолайсыз мазмұнды сүзу»).
 * Сөз түбірімен басталатын сөздер жабылады; қысқа немесе кәдімгі сөздермен
 * сәйкес келетін түбірлер — тек толық сөз ретінде.
 */
const STEMS = [
  // en
  'fuck',
  'motherfuck',
  'shit',
  'bitch',
  'cunt',
  'asshole',
  'bastard',
  'whore',
  'slut',
  'nigger',
  'nigga',
  'faggot',
  // ru (Қазақстанда жиі кездеседі)
  'хуй',
  'хуе',
  'хуё',
  'хуя',
  'пизд',
  'ебат',
  'ебан',
  'ебал',
  'ебуч',
  'ёбан',
  'еблан',
  'заеб',
  'уеб',
  'выеб',
  'бляд',
  'блят',
  'сука',
  'суки',
  'мудак',
  'мудил',
  'пидор',
  'пидар',
  'гандон',
  'шлюх',
  'залуп',
  // kk
  'қотақ',
  'сігейін',
  'сігіп',
  'сіктір',
  'амыңды',
];

const EXACT = new Set(['fag', 'fags', 'dick', 'dicks', 'pussy', 'retard', 'сик', 'сік', 'бля', 'ам', 'амың', 'манда', 'ебу']);

const WORD = /[\p{L}\p{N}]+/gu;

const LOOKALIKE: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '@': 'a', $: 's', ё: 'е' };

function normalize(word: string): string {
  return word
    .toLowerCase()
    .split('')
    .map((ch) => LOOKALIKE[ch] ?? ch)
    .join('');
}

export function isProfane(word: string): boolean {
  const w = normalize(word);
  if (EXACT.has(w)) return true;
  return STEMS.some((stem) => w.startsWith(normalize(stem)));
}

export function filterText(text: string): { text: string; flagged: boolean } {
  let flagged = false;
  const out = text.replace(WORD, (word) => {
    if (!isProfane(word)) return word;
    flagged = true;
    return word[0] + '*'.repeat(Math.max(1, word.length - 1));
  });
  return { text: out, flagged };
}
