import type { Locale } from '@birge/shared';

export interface LegalDoc {
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
}

/**
 * Пайдалану шарттары мен Құпиялылық саясатының үлгісі.
 * Жариялау алдында {operator} (заңды тұлға атауы мен мекенжайы) және {email} мәндерін нақтылаңыз,
 * қажет болса заңгерге көрсетіңіз.
 */
const UPDATED = '2026-10-27';

export const TERMS: Record<Locale, LegalDoc> = {
  kk: {
    title: 'Пайдалану шарттары',
    updated: `Соңғы жаңарту: ${UPDATED}`,
    sections: [
      {
        heading: '1. Жалпы ереже',
        body: [
          'Birge — достарыңызбен бір «бөлмеде» (серверде) бейне көріп, музыка тыңдап, дауыс немесе чат арқылы сөйлесуге арналған қызмет. Қызметті {operator} ұсынады (бұдан әрі — «біз»).',
          'Қосымшаны немесе веб-нұсқаны пайдалану арқылы сіз осы Шарттарға және Құпиялылық саясатына келісесіз. Келіспесеңіз, қызметті пайдаланбаңыз.',
        ],
      },
      {
        heading: '2. Жас шегі және аккаунт',
        body: [
          'Қызметті тек 16 жастан асқан адамдар пайдалана алады.',
          'Аккаунтты Apple ID, Google аккаунты, электрондық пошта немесе телефон нөмірі арқылы ашасыз. Шынайы ақпарат беріп, аккаунтыңызды басқаларға бермеуге міндеттенесіз. Аккаунтыңыз арқылы жасалған әрекеттерге өзіңіз жауаптысыз.',
        ],
      },
      {
        heading: '3. Бөлмелер және мазмұн',
        body: [
          'Бөлмеге 2-ден 50-ге дейін адам кіре алады. Бөлме иесі мен әкімшілері ойнатылатын медианы таңдайды: YouTube сілтемесі, бейне/аудио файлға тікелей сілтеме, өз құрылғысынан жүктелген файл немесе бөлісілген браузер қойындысы.',
          'Біз фильмдер мен музыка каталогын ұсынбаймыз. Бөлмеге қосылған мазмұнға оны қосқан қолданушы толық жауап береді. Тек өзіңізге тарату құқығы бар немесе еркін таратылатын мазмұнды қосыңыз. YouTube бейнелері YouTube-тың ресми ойнатқышы арқылы көрсетіледі және YouTube пайдалану шарттарына бағынады.',
          'Жүктелген файлдар тек сол бөлменің мүшелеріне қолжетімді және бөлме жабылғанда немесе аккаунт жойылғанда өшіріледі.',
        ],
      },
      {
        heading: '4. Тыйым салынған әрекеттер',
        body: [
          'Біз қолайсыз мазмұн мен дөрекі қолданушыларға мүлдем төзбейміз. Мыналарға тыйым салынады:',
          '• қорлау, қудалау, қоқан-лоқы, басқаларды кемсіту немесе өшпенділік тілі;\n• порнография, кәмелетке толмағандарға қатысты кез келген жыныстық мазмұн;\n• зорлық-зомбылықты, терроризмді, өзіне зиян келтіруді насихаттау;\n• авторлық құқықты бұзатын (пираттық) мазмұнды тарату;\n• спам, алаяқтық, басқа адамның атын жамылу;\n• заңсыз кез келген әрекет.',
        ],
      },
      {
        heading: '5. Модерация, шағым және бұғаттау',
        body: [
          'Кез келген хабарламаға, қолданушыға немесе бөлмеге қосымша ішінен шағымдануға және кез келген адамды бұғаттауға болады — бұғатталған адамның хабарламалары сізге көрінбейді, дауысы естілмейді.',
          'Чаттағы балағат сөздер автоматты түрде жабылады. Шағымдарды модераторлар 24 сағат ішінде қарап, ережені бұзған мазмұнды өшіреді және бұзушының аккаунтын бұғаттайды.',
          'Бөлме иесі мен әкімшілері хабарламаларды өшіріп, қатысушының микрофонын өшіріп, оны бөлмеден шығара не бұғаттай алады.',
        ],
      },
      {
        heading: '6. Авторлық құқық туралы шағымдар',
        body: [
          'Сіздің авторлық құқығыңыз бұзылды деп есептесеңіз, {email} мекенжайына хат жазыңыз: туындының атауы, бөлменің коды немесе сілтемесі, байланыс деректеріңіз және құқық иесі екеніңізді растайтын мәлімдеме. Біз мұндай мазмұнды жедел өшіреміз.',
        ],
      },
      {
        heading: '7. Аккаунтты жою және тоқтату',
        body: [
          'Аккаунтыңызды кез келген уақытта қосымшадағы «Баптаулар → Аккаунтты жою» арқылы немесе веб-сайттағы /delete-account беті арқылы жоя аласыз.',
          'Осы Шарттарды бұзған жағдайда біз аккаунтты ескертусіз бұғаттай не жоя аламыз.',
        ],
      },
      {
        heading: '8. Жауапкершілікті шектеу',
        body: [
          'Қызмет «бар күйінде» ұсынылады. Біз қызметтің үзіліссіз жұмысына кепілдік бермейміз және қолданушылар қосқан мазмұнға жауап бермейміз. Заң рұқсат еткен шекте біздің жауапкершілігіміз шектеледі.',
        ],
      },
      {
        heading: '9. Өзгерістер және байланыс',
        body: [
          'Шарттар өзгерсе, қосымшада хабарлаймыз. Сұрақтарыңызды {email} мекенжайына жіберіңіз. Шарттарға Қазақстан Республикасының заңнамасы қолданылады.',
        ],
      },
    ],
  },
  en: {
    title: 'Terms of Use',
    updated: `Last updated: ${UPDATED}`,
    sections: [
      {
        heading: '1. About Birge',
        body: [
          'Birge lets you watch videos and listen to music together with friends in a shared “room” (server) and talk by voice or text chat. The service is provided by {operator} (“we”, “us”).',
          "By using the app or the web version you agree to these Terms and to our Privacy Policy. If you don't agree, please don't use the service.",
        ],
      },
      {
        heading: '2. Age and accounts',
        body: [
          'You must be at least 16 years old to use Birge.',
          'You can create an account with Apple, Google, email or phone number. You agree to provide accurate information and not to share your account. You are responsible for activity on your account.',
        ],
      },
      {
        heading: '3. Rooms and content',
        body: [
          'A room holds 2 to 50 people. The room host and admins choose what plays: a YouTube link, a direct link to a video/audio file, a file uploaded from their device, or a shared browser tab.',
          'We do not provide a catalog of movies or music. The user who adds content to a room is fully responsible for it. Only add content you have the right to share or that is freely available. YouTube videos play through the official YouTube player and are subject to the YouTube Terms of Service.',
          'Uploaded files are only available to members of that room and are deleted when the room is closed or the uploader deletes their account.',
        ],
      },
      {
        heading: '4. Prohibited conduct',
        body: [
          'There is zero tolerance for objectionable content and abusive users. You must not post or share:',
          '• harassment, bullying, threats, discrimination or hate speech;\n• pornography or any sexual content involving minors;\n• content promoting violence, terrorism or self-harm;\n• content that infringes copyright (piracy);\n• spam, scams or impersonation;\n• anything illegal.',
        ],
      },
      {
        heading: '5. Moderation, reporting and blocking',
        body: [
          "You can report any message, user or room from inside the app and block anyone — you won't see a blocked person's messages or hear their voice.",
          'Profanity in chat is filtered automatically. Moderators review reports within 24 hours, remove content that breaks these Terms and ban users who post it.',
          'Room hosts and admins can delete messages, mute microphones, and remove or ban participants from their room.',
        ],
      },
      {
        heading: '6. Copyright complaints',
        body: [
          'If you believe your copyright is being infringed, email {email} with the title of the work, the room code or link, your contact details and a statement that you are the rights holder or authorised to act for them. We remove infringing content promptly.',
        ],
      },
      {
        heading: '7. Deleting your account and termination',
        body: [
          'You can delete your account at any time in Settings → Delete account, or on the /delete-account page of our website.',
          'We may suspend or delete accounts that violate these Terms without notice.',
        ],
      },
      {
        heading: '8. Disclaimer',
        body: [
          "The service is provided “as is”. We don't guarantee uninterrupted operation and are not responsible for content added by users. Our liability is limited to the extent permitted by law.",
        ],
      },
      {
        heading: '9. Changes and contact',
        body: [
          'We will let you know in the app if these Terms change. Questions: {email}. These Terms are governed by the laws of the Republic of Kazakhstan.',
        ],
      },
    ],
  },
};

export const PRIVACY: Record<Locale, LegalDoc> = {
  kk: {
    title: 'Құпиялылық саясаты',
    updated: `Соңғы жаңарту: ${UPDATED}`,
    sections: [
      {
        heading: '1. Біз қандай деректер жинаймыз',
        body: [
          '• Аккаунт: атыңыз, электрондық поштаңыз немесе телефон нөміріңіз, Apple/Google берген сәйкестендіргіш (және олар берсе — пошта), таңдаған тіліңіз.\n• Мазмұн: бөлме атаулары, чат хабарламалары, кезекке қосылған сілтемелер мен жүктелген файлдар, шағымдар.\n• Техникалық: кіру сессиялары (құрылғы түрі), қауіпсіздік үшін IP мекенжайы.',
          'Дауыс пен бөлісілген экран ағыны тек нақты уақытта таратылады — біз оларды жазбаймыз және сақтамаймыз. Микрофон тек сіз оны қосқанда ғана іске қосылады.',
        ],
      },
      {
        heading: '2. Не үшін қолданамыз',
        body: [
          'Қызметті көрсету (кіру, бөлмелер, синхронды ойнату, чат, дауыс), қауіпсіздік (алаяқтық пен спамға қарсы күрес), модерация (шағымдарды қарау) және заң талаптарын орындау үшін.',
        ],
      },
      {
        heading: '3. Біз не істемейміз',
        body: [
          'Біз жарнама көрсетпейміз, деректеріңізді сатпаймыз, басқа қосымшалар мен сайттар арқылы сізді бақыламаймыз (tracking) және үшінші тарап аналитикасын қолданбаймыз.',
        ],
      },
      {
        heading: '4. Кіммен бөлісеміз',
        body: [
          '• Бөлмедегі адамдар сіздің атыңызды, хабарламаларыңызды, дауысыңызды және сіз қосқан мазмұнды көреді/естиді.\n• Қызмет жеткізушілері: хостинг, дауыс серверi (LiveKit), пошта және SMS жіберу қызметтері, Apple мен Google (кіру үшін). Олар деректерді тек біздің тапсырмамыз бойынша өңдейді.\n• Заң талап еткенде — уәкілетті органдар.',
        ],
      },
      {
        heading: '5. Сақтау мерзімі',
        body: [
          'Аккаунт деректері — аккаунтты жойғанша. Хабарламалар мен жүктелген файлдар — бөлме жабылғанша немесе аккаунт жойылғанша. Кіру кодтары — 1 тәулік. Сессиялар — шыққанша немесе 180 күн. Шағымдар журналы — 1 жылға дейін.',
        ],
      },
      {
        heading: '6. Сіздің құқықтарыңыз',
        body: [
          'Деректеріңізбен танысуға, түзетуге және жоюға құқығыңыз бар. Аккаунтты қосымшаның өзінде («Баптаулар → Аккаунтты жою») немесе /delete-account бетінде жоя аласыз; Apple арқылы кірген болсаңыз, Apple токендері де қайтарып алынады. Басқа сұраулар үшін: {email}.',
          'Дербес деректер «Дербес деректер және оларды қорғау туралы» Қазақстан Республикасының Заңына сәйкес өңделеді.',
        ],
      },
      {
        heading: '7. Қауіпсіздік',
        body: [
          'Барлық байланыс шифрланған (HTTPS/TLS, WebRTC DTLS-SRTP). Кіру кодтары мен сессия токендері дерекқорда тек хэш түрінде сақталады, құпия токендер шифрланады.',
        ],
      },
      {
        heading: '8. Балалар',
        body: ['Қызмет 16 жасқа толмағандарға арналмаған. Мұндай аккаунт табылса, оны жоямыз.'],
      },
      {
        heading: '9. Байланыс',
        body: ['Деректерді өңдеуші: {operator}. Сұрақтар мен өтініштер: {email}.'],
      },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: `Last updated: ${UPDATED}`,
    sections: [
      {
        heading: '1. What we collect',
        body: [
          '• Account: your name, email address or phone number, the identifier Apple/Google give us (and the email they share, if any), and your language.\n• Content: room names, chat messages, links added to queues, uploaded files and reports.\n• Technical: sign-in sessions (device type) and IP address for security.',
          'Voice and shared-screen streams are relayed in real time only — we do not record or store them. The microphone is only active while you turn it on.',
        ],
      },
      {
        heading: '2. Why we use it',
        body: [
          'To provide the service (sign-in, rooms, synced playback, chat, voice), to keep it safe (fighting spam and abuse), for moderation (reviewing reports) and to comply with the law.',
        ],
      },
      {
        heading: "3. What we don't do",
        body: [
          "We don't show ads, don't sell your data, don't track you across other apps or websites and don't use third-party analytics.",
        ],
      },
      {
        heading: '4. Who we share it with',
        body: [
          '• People in your rooms see your name, messages, voice and the content you add.\n• Service providers: hosting, the voice server (LiveKit), email and SMS delivery, and Apple and Google for sign-in. They process data only on our instructions.\n• Authorities, when required by law.',
        ],
      },
      {
        heading: '5. How long we keep it',
        body: [
          'Account data — until you delete your account. Messages and uploaded files — until the room is closed or your account is deleted. Sign-in codes — 1 day. Sessions — until you sign out or 180 days. Report logs — up to 1 year.',
        ],
      },
      {
        heading: '6. Your rights',
        body: [
          'You can access, correct and delete your data. Delete your account in the app (Settings → Delete account) or on the /delete-account page; if you signed in with Apple, your Apple tokens are revoked too. For any other request: {email}.',
          'Personal data is processed in accordance with the Law of the Republic of Kazakhstan “On Personal Data and Their Protection” and, where applicable, the GDPR.',
        ],
      },
      {
        heading: '7. Security',
        body: [
          'All traffic is encrypted (HTTPS/TLS, WebRTC DTLS-SRTP). Sign-in codes and session tokens are stored only as hashes, and secret tokens are encrypted at rest.',
        ],
      },
      {
        heading: '8. Children',
        body: ['Birge is not intended for anyone under 16. If we learn that such an account exists, we delete it.'],
      },
      {
        heading: '9. Contact',
        body: ['Data controller: {operator}. Questions and requests: {email}.'],
      },
    ],
  },
};
