"""O‘zbekcha (lotin yozuvi)."""

MESSAGES: dict[str, str] = {
    # --- Rollar --------------------------------------------------------------------------------
    "role.civilian": "Tinch aholi",
    "role.civilian.desc": "Kechasi sizda harakat yo‘q. Kunduzi muhokamada qatnashing, mafiyani topishga yordam bering va to‘g‘ri odamga ovoz bering.",
    "role.don": "Don",
    "role.don.desc": "Mafiya boshlig‘i. Kechasi mafiyaning umumiy qurbonini siz tanlaysiz: mafiya a’zolari ovoz beradi, lekin oxirgi qaror sizniki.",
    "role.mafia": "Mafiya",
    "role.mafia.desc": "Kechasi Don bilan birga qurbon tanlaysiz. Don tanlov qilmasa, mafiya ovozi hal qiladi. Don o‘lsa, mafiya a’zolaridan biri yangi Don bo‘ladi.",
    "role.killer": "Killer",
    "role.killer.desc": "Mafiyaning yollanma qotili. Mafiyani taniysiz va har kecha mafiyadan alohida bir o‘yinchini o‘zingiz o‘ldira olasiz.",
    "role.defender": "Himoyachi",
    "role.defender.desc": "Mafiya tomonidasiz, lekin mafiyani tanimaysiz. Kechasi bosh himoyachi bir o‘yinchini himoya qiladi: u Don yoki mafiya bo‘lsa, Komissar uni «Tinch aholi» deb ko‘radi, ertasi kuni osilsa — tirik qoladi.",
    "role.commissioner": "Komissar",
    "role.commissioner.desc": "Har kecha bir o‘yinchini tekshirasiz (rolini bilasiz) yoki otasiz. Birinchi kecha faqat tekshirish mumkin. Serjantlar tekshiruv natijasini biladi.",
    "role.sergeant": "Serjant",
    "role.sergeant.desc": "Komissarning yordamchisi. Komissarni taniysiz va uning tekshiruv natijalarini olasiz. Komissar o‘lsa, yangi Komissar siz bo‘lasiz.",
    "role.doctor": "Shifokor",
    "role.doctor.desc": "Har kecha bir o‘yinchini davolaysiz — u o‘sha kecha o‘lmaydi. Bir odamni ketma-ket ikki kecha davolab bo‘lmaydi, o‘zingizni o‘yinda faqat bir marta davolay olasiz.",
    "role.hacker": "Xaker",
    "role.hacker.desc": "Kechasi bir o‘yinchining telefonini buzasiz — uning o‘sha kechagi harakati bajarilmaydi. Bir odamni ketma-ket ikki kecha bloklab bo‘lmaydi.",
    "role.beggar": "Gado",
    "role.beggar.desc": "Kechasi bir o‘yinchining uyiga shisha so‘rab borasiz. Ertalab o‘sha uyga kechasi kimlar kelganini bilasiz.",
    "role.kamikaze": "Kamikadze",
    "role.kamikaze.desc": "Siz tinch aholisiz. Sizni kechasi kimdir o‘ldirsa, qotilni ham o‘zingiz bilan olib ketasiz — buni na Shifokor, na himoya to‘xtata oladi. Piromanning bombasiga qarshi ishlamaydi.",
    "role.suicide": "O‘zini o‘ldiruvchi",
    "role.suicide.desc": "Sizning o‘z g‘alaba shartingiz bor: kunduzgi ovoz berishda osilsangiz — g‘alaba qozonasiz.",
    "role.witch": "Jodugar",
    "role.witch.desc": "Tinch aholi tomonidasiz. Kechasi sizga birinchi marta hujum qilinganda sehringiz sizni saqlaydi, siz esa hujumchini jazolaysiz yoki kechirasiz. Sehr bir marta ishlaydi va Piromanning bombasiga qarshi kuchsiz.",
    "role.pyro": "Piroman (Portlatuvchi)",
    "role.pyro.desc": "Har kecha bir o‘yinchining uyiga bomba qo‘yasiz. Kamida uchta tirik odamda bomba bo‘lganda hammasini portlatishingiz mumkin (o‘zingiz ham o‘lasiz). Bomba qo‘yilganlarning hammasi o‘sha kecha o‘lsa — g‘alaba qozonasiz.",
    "role.wolf": "Bo‘ri",
    "role.wolf.desc": "Tinch aholi sifatida boshlaysiz. Mafiya yoki Killer hujum qilsa — o‘lmaysiz, mafiyaga qo‘shilasiz. Komissar otsa — o‘lmaysiz, Serjant bo‘lasiz. Boshqa hujumlardan odatdagidek o‘lasiz.",
    "role.maniac": "Manyak",
    "role.maniac.desc": "Hech kimning tomonida emassiz. Har kecha bir o‘yinchini o‘ldirasiz. Tirik qolgan oxirgi ikki o‘yinchidan biri bo‘lsangiz — g‘alaba qozonasiz.",
    "role.higgs": "Higgs-Man",
    "role.higgs.desc": "Juda kam uchraydigan alohida qahramon. Higgs maydoni sizni kechasi 3 ta o‘qdan saqlaydi — 4-o‘q o‘ldiradi. Birinchi marta osilganingizda ham tirik qolasiz. Kimning tomonini olishni o‘zingiz hal qilasiz: o‘yin oxirida tirik bo‘lsangiz, kim yutmasin, siz ham yutasiz va ikki baravar mukofot olasiz.",
    "role.was": "{role} <i>(avval {old})</i>",

    "faction.town": "🏘 Tinch aholi",
    "faction.mafia": "🤵 Mafiya",
    "faction.solo": "🎭 Mustaqil qahramonlar",

    # --- Tungi harakat tugmalari ---------------------------------------------------------------
    "action.mk": "🔫 Qurbonni tanlash",
    "action.kk": "🔪 O‘ldirish",
    "action.mn": "🪓 O‘ldirish",
    "action.ck": "🔍 Tekshirish",
    "action.sh": "🔫 Otish",
    "action.hl": "💉 Davolash",
    "action.bl": "💻 Bloklash",
    "action.pr": "🛡 Himoya qilish",
    "action.vs": "🍾 Uyiga borish",
    "action.bm": "💣 Bomba qo‘yish",
    "action.dt": "💥 Portlatish",
    "action.sk": "⏭ O‘tkazib yuborish",

    # --- O‘lim sabablari -----------------------------------------------------------------------
    "cause.mafia": "mafiya o‘ldirdi",
    "cause.killer": "Killer o‘ldirdi",
    "cause.maniac": "Manyak o‘ldirdi",
    "cause.commissioner": "Komissar otib tashladi",
    "cause.bomb": "bomba portladi",
    "cause.pyro_self": "o‘z bombalari bilan birga portladi",
    "cause.witch": "Jodugarning la’natiga uchradi",
    "cause.kamikaze": "Kamikadze o‘zi bilan olib ketdi",
    "cause.lynch": "osildi",
    "cause.desert": "o‘z xohishi bilan o‘yindan chiqdi",
    "cause.afk": "faol bo‘lmagani uchun chiqarildi",

    # --- Rol haqida xabar ----------------------------------------------------------------------
    "intro.role": "🎭 Sizning rolingiz: <b>{role}</b>",
    "intro.faction": "Tomon: <b>{faction}</b>",
    "intro.goal": "🎯 <b>Maqsadingiz:</b> {goal}",
    "goal.town": "mafiyani topib yo‘q qilish va o‘yin oxirigacha tirik qolish.",
    "goal.mafia": "tinch aholini kamaytirib, shaharni egallash va tirik qolish.",
    "goal.suicide": "kunduzgi ovoz berishda osilish.",
    "goal.pyro": "kamida uch kishiga bomba qo‘yib, hammasini birga portlatish.",
    "goal.maniac": "tirik qolgan oxirgi ikki o‘yinchidan biri bo‘lish.",
    "goal.higgs": "o‘yin oxirigacha tirik qolish — shunda mukofotingiz ikki baravar bo‘ladi.",
    "intro.team": "🤝 <b>Jamoangiz:</b>",
    "intro.alone": "• <i>(siz yolg‘izsiz)</i>",
    "intro.team_chat": "✉️ <i>Botga yozgan xabaringiz jamoangizga yuboriladi.</i>",
    "intro.partner": "🤝 <b>Ikkinchi himoyachi:</b>",
    "intro.head_defender": "👑 Siz — <b>bosh himoyachisiz</b>: kechasi nishonni siz tanlaysiz.",
    "intro.second_defender": "<i>Tungi nishonni bosh himoyachi tanlaydi. U o‘lsa, bosh himoyachi siz bo‘lasiz.</i>",
    "intro.higgs": "⚛️ <b>Higgs maydoni:</b> kechasi {armor} ta o‘qdan himoya va bir marta dordan qutulish.",
    "intro.items": "🎒 <b>Bu o‘yindagi buyumlaringiz:</b>",
    "intro.item.shield": "🛡 Himoya — tungi hujumdan bir marta",
    "intro.item.vote_shield": "⚖️ Ovoz berishdan himoya — bir marta",
    "intro.item.bullet": "💥 Himoyani teshib o‘tadigan o‘q",
    "intro.item.fake_doc": "📄 Soxta hujjat — Komissarning birinchi tekshiruvi uchun",
    "intro.survive_note": "⚠️ <i>Esda tuting: g‘alaba va mukofotni faqat o‘yin oxirigacha tirik qolganlar oladi.</i>",

    # --- Kecha ---------------------------------------------------------------------------------
    "night.title": "🌙 <b>{day}-kecha</b>",
    "night.body": "<i>Shahar uxlaydi...</i> Maxsus rollar bot bilan shaxsiy chatda harakat qiladi.\n🤫 <b>Kechasi guruhga yozilgan xabarlar o‘chiriladi.</b>",
    "night.alive": "👥 <b>Tirik o‘yinchilar ({count}):</b>",
    "night.roles": "🎭 <b>O‘yindagi rollar:</b> {roles}",
    "prompt.head": "🌙 <b>{day}-kecha</b> · Siz — <b>{role}</b>",
    "prompt.don": "Mafiyaning bugungi qurbonini tanlang. <b>Oxirgi qaror sizniki.</b>",
    "prompt.mafia": "Qurbon uchun ovoz bering. <i>Don tanlov qilmasa, mafiya ovozi hal qiladi.</i>",
    "prompt.killer": "Bugun kimni o‘ldirasiz?",
    "prompt.maniac": "Bugungi qurboningizni tanlang.",
    "prompt.commissioner": "Bugun nima qilasiz: <b>tekshirasizmi</b> yoki <b>otasizmi</b>?",
    "prompt.commissioner_first": "Birinchi kecha faqat <b>tekshirish</b> mumkin. Kimni tekshirasiz?",
    "prompt.doctor": "Bugun kimni davolaysiz?",
    "prompt.hacker": "Kimning telefonini buzasiz? <i>Uning bugungi harakati bajarilmaydi.</i>",
    "prompt.defender": "Bugun kimni himoya qilasiz?",
    "prompt.beggar": "Bugun kimning uyiga borasiz?",
    "prompt.pyro": "Kimning uyiga bomba qo‘yasiz?",
    "prompt.pyro_bombed": "💣 <b>Bomba qo‘yilganlar:</b> {names}",
    "prompt.pyro_ready": "💥 <b>Endi hammasini portlatish mumkin</b> (o‘zingiz ham o‘lasiz).",
    "prompt.none": "<i>Bugun kechasi sizda harakat yo‘q.</i>",
    "prompt.choose_hint": "👇 <i>Quyidagi tugmalardan birini bosing.</i>",
    "submit.not_night": "Hozir kecha emas.",
    "submit.not_alive": "Siz bu o‘yinda tirik o‘yinchi emassiz.",
    "submit.already": "Siz bu kecha tanlovingizni qilib bo‘ldingiz.",
    "submit.unavailable": "Bu harakat siz uchun mavjud emas.",
    "submit.bad_target": "Bu o‘yinchini tanlab bo‘lmaydi.",
    "submit.skip": "⏭ <b>Siz bu kecha hech narsa qilmaysiz.</b>",
    "submit.detonate": "💥 <b>Ertalab bombalar portlaydi...</b>",
    "submit.ok": "✅ <b>Tanlovingiz:</b> {action} → {target}",

    "announce.don": "🤵 <b>Don</b> <i>bugungi qurbonini belgiladi...</i>",
    "announce.mafia": "🕴 <b>Mafiya a’zosi</b> <i>qurbon uchun ovoz berdi...</i>",
    "announce.killer": "🔪 <b>Killer</b> <i>pichog‘ini charxlab, nishonini tanladi...</i>",
    "announce.maniac": "🪓 <b>Manyak</b> <i>qorong‘i ko‘chaga chiqdi...</i>",
    "announce.check": "🕵️ <b>Komissar</b> <i>tergov olib bormoqda...</i>",
    "announce.shoot": "🕵️ <b>Komissar</b> <i>to‘pponchasini ko‘tardi...</i>",
    "announce.heal": "👨‍⚕️ <b>Shifokor</b> <i>dori qutisini olib, navbatchilikka chiqdi...</i>",
    "announce.block": "💻 <b>Xaker</b> <i>kimningdir telefonini buzishga kirishdi...</i>",
    "announce.protect": "🛡 <b>Himoyachilar</b> <i>kimnidir himoyaga oldi...</i>",
    "announce.visit": "🍾 <b>Gado</b> <i>shisha izlab, kimningdir uyiga yo‘l oldi...</i>",
    "announce.bomb": "🔥 <b>Piroman</b> <i>kimningdir eshigi oldiga bomba qo‘ymoqda...</i>",
    "announce.detonate": "🔥 <b>Piroman</b> <i>detonatorni qo‘liga oldi...</i>",

    "night.team_vote": "🗳 {role} {name} → {target}",
    "night.hacked": "💻 Kechasi xaker telefoningizni buzdi — <b>harakatingiz bajarilmadi.</b>",
    "night.check_result": "🔍 <b>Tekshiruv natijasi:</b> {target} — <b>{role}</b>",
    "night.sergeant_relay": "👮 <b>Komissardan xabar:</b>\n{text}",
    "night.bomb_planted": "💣 {target} uyiga bomba qo‘yildi.",
    "night.shield_saved": "🛡 Kechasi sizga hujum qilindi, lekin <b>himoyangiz sizni saqlab qoldi!</b>",
    "night.bullet_pierced": "💥 <b>O‘qingiz nishonning himoyasini teshib o‘tdi!</b>",
    "night.higgs_absorbed": "⚛️ Sizga o‘q tegdi, lekin <b>Higgs maydoni saqlab qoldi!</b> Qolgan himoya: <b>{left}</b>",
    "night.witch_punished": "⚔️ Siz hujumchini la’nat bilan jazoladingiz.",
    "night.witch_forgave": "🕊 Siz hujumchini kechirdingiz.",
    "night.you_died": "☠️ <b>Siz halok bo‘ldingiz</b> <i>({cause})</i>.",
    "night.beggar_nobody": "hech kim kelmadi",
    "night.beggar_info": "🍾 Kechasi {target} uyiga kelganlar: <b>{names}</b>.",
    "night.checked_you": "{role} kechasi sizni <b>tekshirdi</b>.",
    "night.healed_you": "{role} kechasi sizga kelib, <b>davolab ketdi</b>.",
    "night.healed_saved": "⚠️ Kechasi sizga hujum qilindi, lekin {role} <b>sizni qutqarib qoldi!</b>",
    "night.hacked_idle": "{role} kechasi <b>telefoningizni buzdi</b>.",
    "night.protected_you": "{role} kechasi <b>sizni qo‘riqladi</b>.",
    "night.visited_you": "{role} kechasi eshigingizni taqillatib, <b>shisha so‘radi</b>.",
    "night.bombed_you": "{role} kechasi <b>eshigingiz oldiga bomba qo‘ydi!</b>",
    "night.wolf_mafia": "🐺 Mafiya sizga hujum qildi, lekin siz o‘lmadingiz! <b>Endi sizning rolingiz — {role}.</b>\n🤝 Jamoangiz: {team}",
    "night.wolf_sergeant": "🐺 Komissar sizni otdi, lekin siz o‘lmadingiz! <b>Endi sizning rolingiz — {role}.</b>\n🤝 Jamoangiz: {team}",
    "night.wolf_joined_mafia": "🐺 {name} mafiyaga qo‘shildi!",
    "night.wolf_joined_police": "🐺 {name} serjant bo‘lib qo‘shildi!",
    "promo.new_don": "🤵 Don halok bo‘ldi. <b>Endi yangi Don — siz!</b>",
    "promo.new_don_team": "🤵 Yangi Don: {name}",
    "promo.new_com": "🕵️ Komissar halok bo‘ldi. <b>Endi yangi Komissar — siz!</b>",
    "promo.new_com_team": "🕵️ Yangi Komissar: {name}",
    "promo.new_head": "👑 Bosh himoyachi halok bo‘ldi. <b>Keyingi kechadan boshlab nishonni siz tanlaysiz.</b>",
    "witch.prompt": "🧙‍♀️ Kechasi sizga {names} hujum qildi! <b>Sehringiz sizni saqlab qoldi.</b>\nHujumchini nima qilasiz?",
    "witch.punish": "⚔️ Jazolash",
    "witch.forgive": "🕊 Kechirish",
    "witch.timeout": "⌛ Vaqt tugadi — siz kechirdingiz.",
    "witch.ok_punish": "⚔️ Hujumchi jazolanadi.",
    "witch.ok_forgive": "🕊 Siz kechirdingiz.",

    # --- Tong ----------------------------------------------------------------------------------
    "morning.title": "🌅 <b>{day}-kun · Tong otdi!</b>",
    "morning.dead": "☠️ <b>Kechasi halok bo‘lganlar:</b>",
    "morning.dead_line": "• {name} — <b>{role}</b> <i>({cause})</i>",
    "morning.nobody": "😮 <b>Bugun kechasi hech kim halok bo‘lmadi.</b>",
    "morning.events": "📰 <b>Tungi yangiliklar:</b>",
    "morning.saved": "💉 <i>Shifokor kimningdir hayotini saqlab qoldi!</i>",
    "morning.explosion": "🔥 <i>Kechasi shaharni kuchli portlash larzaga keltirdi!</i>",
    "morning.witch": "🧙‍♀️ <i>Kimningdir uyida sehrli chaqnash ko‘rindi...</i>",
    "morning.kamikaze": "💣 <i>Kamikadze qotilini o‘zi bilan olib ketdi!</i>",
    "morning.pyro_won": "🔥 <b>Piroman barcha nishonlarini portlatdi — Piroman g‘alaba qozondi!</b>",
    "morning.pyro_failed": "🔥 <i>Piroman barcha nishonlarini yo‘q qila olmadi.</i>",
    "morning.alive": "👥 <b>Tirik o‘yinchilar ({count}):</b>",

    # --- Kun va ovoz berish --------------------------------------------------------------------
    "day.text": "☀️ <b>{day}-kun · Muhokama</b>\nShubhalilarni muhokama qiling. <b>{seconds} soniyadan</b> keyin ovoz berish boshlanadi.",
    "vote.start": "🗳 <b>Ovoz berish boshlandi!</b>\nBot bilan shaxsiy chatda kimni osish kerakligini tanlang. Vaqt: <b>{seconds} soniya</b>.\n<i>Har bir ovoz shu chatda e’lon qilinadi.</i>",
    "vote.prompt": "🗳 <b>{day}-kun · Ovoz berish</b>\nSizningcha, kimni osish kerak?",
    "vote.abstain_btn": "🤐 Betaraf qolish",
    "vote.cast": "🗳 {voter} o‘z ovozini <b>{target}</b> uchun berdi",
    "vote.cast_abstain": "🤐 {voter} <i>betaraf qoldi</i>",
    "vote.not_now": "Hozir ovoz berish o‘tmayapti.",
    "vote.not_alive": "Faqat tirik o‘yinchilar ovoz bera oladi.",
    "vote.already": "Siz ovoz berib bo‘ldingiz.",
    "vote.bad_target": "Bu o‘yinchiga ovoz berib bo‘lmaydi.",
    "vote.ok_abstain": "🤐 <b>Siz betaraf qoldingiz.</b>",
    "vote.ok": "✅ <b>Siz {target} uchun ovoz berdingiz.</b>",
    "vote.result_title": "🗳 <b>Ovoz berish natijasi</b>",
    "vote.result_line": "• {name} — <b>{count}</b> ovoz",
    "vote.abstained": "🤐 Betaraf qolganlar: <b>{count}</b>",
    "vote.silent": "😴 Ovoz bermaganlar: {names}",
    "vote.no_votes": "<i>Hech kim ovoz bermadi — bugun hech kim osilmaydi.</i>",
    "vote.tie": "⚖️ <b>Ovozlar teng bo‘ldi</b> — bugun hech kim osilmaydi.",
    "vote.saved": "🪢 {name} osilishiga oz qoldi, lekin <b>tirik qoldi!</b>",
    "vote.lynched": "🪢 {name} osildi. U <b>{role}</b> edi.",
    "vote.suicide_won": "🪢 {name} osildi. U <b>{role}</b> edi.\n🤡 <b>O‘zini o‘ldiruvchi maqsadiga erishdi va g‘alaba qozondi!</b>",
    "vote.higgs_saved": "⚛️ <b>Higgs maydoni sizni dordan qutqardi!</b> Bu himoya endi yo‘q.",
    "vote.vote_shield_used": "⚖️ <b>Ovoz berishdan himoyangiz sizni dordan qutqardi!</b>",
    "vote.you_lynched": "☠️ <b>Shahar sizni osdi.</b>",
    "vote.candidate": "👉 Eng ko‘p ovozni {name} oldi. <b>Endi uni haqiqatan osish kerakmi — 👍/👎 bilan hal qilamiz.</b>",
    "confirm.ask": "⚖️ <b>{day}-kun · Qarorni tasdiqlash</b>\n\nAholi {name} o‘yinchisini osishni taklif qildi. <b>Haqiqatan osamizmi?</b>\n👍 — osish kerak · 👎 — tirik qolsin\n\n<i>Tirik o‘yinchilar {seconds} soniya ichida tugmani bosadi (fikrni o‘zgartirish mumkin). 👍 ko‘p bo‘lsagina osiladi; teng bo‘lsa yoki 👎 ko‘p bo‘lsa — tirik qoladi.</i>",
    "confirm.closed": "⚖️ <b>Tasdiqlash yakunlandi</b> · {name}: 👍 <b>{yes}</b> · 👎 <b>{no}</b>",
    "confirm.stopped": "⚖️ <i>Tasdiqlash to‘xtatildi.</i>",
    "confirm.not_now": "Hozir tasdiqlash o‘tmayapti.",
    "confirm.not_alive": "Faqat shu o‘yindagi tirik o‘yinchilar ovoz bera oladi.",
    "confirm.self": "O‘z taqdiringiz bo‘yicha ovoz bera olmaysiz.",
    "confirm.ok_yes": "👍 Tanlovingiz: osish kerak.",
    "confirm.ok_no": "👎 Tanlovingiz: tirik qolsin.",
    "confirm.result_title": "⚖️ <b>Tasdiqlash natijasi</b>",
    "confirm.yes_line": "👍 Osish kerak (<b>{count}</b>): {names}",
    "confirm.no_line": "👎 Tirik qolsin (<b>{count}</b>): {names}",
    "confirm.spared": "🕊 {name} <b>tirik qoldi</b> — 👍 ovozlari 👎 ovozlaridan ko‘p bo‘lmadi.",
    "confirm.gone": "🚪 {name} o‘yindan chiqib ketdi — bugun hech kim osilmaydi.",
    "desert.public": "🚪 {name} <b>o‘z xohishi bilan o‘yindan chiqdi</b>. U <b>{role}</b> edi.",
    "afk.public": "💤 {name} ketma-ket <b>{nights} kecha</b> hech qanday harakat qilmagani uchun o‘yindan chiqarildi. U <b>{role}</b> edi.",
    "afk.dm": "💤 Siz ketma-ket <b>{nights} kecha</b> hech qanday harakat qilmadingiz, shuning uchun <b>o‘yindan chiqarildingiz</b>. Bu o‘yin mag‘lubiyat hisoblanadi.",

    # --- O‘yin yakuni --------------------------------------------------------------------------
    "result.nobody_alive": "🤝 Hech kim tirik qolmadi — durang",
    "result.won": "G‘alaba: {side}!",
    "result.draw_long": "🤝 O‘yin juda cho‘zilib ketdi — durang",
    "final.title": "🏁 <b>O‘yin tugadi!</b> {label}",
    "final.winners": "🏆 <b>G‘oliblar:</b>",
    "final.winner_line": "• {name} — {role}{bonus}",
    "final.bonus": " <b>+{reward} ₸</b>",
    "final.losers": "💀 <b>Yutqazganlar:</b>",
    "final.loser_line": "• {name} — {role} <i>({status})</i>",
    "final.status_alive": "tirik",
    "final.status_dead": "halok bo‘ldi",
    "final.days": "📅 O‘yin <b>{days}</b> kun davom etdi.",
    "final.rule": "<i>G‘alaba va mukofotni faqat tirik qolgan o‘yinchilar oladi.</i>",

    # --- Ro‘yxatdan o‘tish va o‘yin jarayoni ---------------------------------------------------
    "lobby.title": "🎲 <b>Mafiya o‘yiniga ro‘yxatdan o‘tish ochiq!</b>",
    "lobby.time": "⏳ Ro‘yxat tugashiga: <b>≈ {seconds} soniya</b>",
    "lobby.players": "👥 <b>Ro‘yxatdan o‘tganlar ({count}/{max}):</b>",
    "lobby.empty": "<i>— hozircha hech kim yo‘q —</i>",
    "lobby.min": "O‘yinni boshlash uchun kamida <b>{min}</b> o‘yinchi kerak.",
    "lobby.how": "👇 Quyidagi tugmani bosing, so‘ng botda <b>START</b> ni bosing. Rollar va tungi harakatlar shaxsiy chatda bo‘ladi.",
    "lobby.join_btn": "🎮 O‘yinga qo‘shilish",
    "lobby.busy": "Bu chatda allaqachon o‘yin yoki ro‘yxatdan o‘tish ketmoqda.",
    "lobby.closed_join": "❌ Bu o‘yinga ro‘yxatdan o‘tish yopilgan.",
    "lobby.already_joined": "✅ Siz «{chat}» chatidagi o‘yinga allaqachon yozilgansiz.",
    "lobby.other_game": "❌ Siz boshqa o‘yinga yozilgansiz yoki o‘ynayapsiz.",
    "lobby.full": "❌ Xona to‘la ({max} o‘yinchi).",
    "lobby.retry": "❌ Ro‘yxatdan o‘tib bo‘lmadi, qayta urinib ko‘ring.",
    "lobby.joined": "✅ <b>Siz «{chat}» chatidagi o‘yinga qo‘shildingiz!</b> ({count}/{max})\nRolingiz shu chatga keladi.",
    "lobby.left": "👋 Siz ro‘yxatdan chiqdingiz.",
    "lobby.not_in_game": "Siz hech qaysi o‘yinda emassiz.",
    "lobby.not_alive": "Siz bu o‘yinda tirik o‘yinchi emassiz.",
    "lobby.deserted": "🏃 Siz o‘yindan chiqdingiz. Bu o‘yin mag‘lubiyat hisoblanadi.",
    "lobby.extended": "⏳ Ro‘yxatdan o‘tish <b>{seconds} soniyaga</b> uzaytirildi.",
    "lobby.no_open": "Ochiq ro‘yxat yo‘q. Yangi o‘yin uchun /game yozing.",
    "lobby.need_min": "O‘yinni boshlash uchun kamida {min} o‘yinchi kerak (hozir {count}).",
    "lobby.reminder": "⏳ Ro‘yxat tugashiga <b>{seconds} soniya</b> qoldi!",
    "lobby.not_enough": "😔 O‘yinchilar yetarli emas ({count}/{min}). Ro‘yxat yopildi. Qayta boshlash uchun /game yozing.",
    "lobby.error": "⚠️ O‘yinni boshlashda xatolik yuz berdi. Ro‘yxat yopildi.",
    "lobby.closed": "🚫 Ro‘yxat yopildi.",
    "lobby.done": "✅ Ro‘yxat tugadi: <b>{count}</b> o‘yinchi. O‘yin boshlandi!",
    "game.purchased_role": "💎 <b>Sotib olgan rolingiz berildi!</b>",
    "game.unfulfilled": "🎭 Siz tanlagan {role} roli bu o‘yinda berilmadi ({count} o‘yinchi uchun mavjud emas yoki uni boshqa o‘yinchi avvalroq sotib olgan).\nTanlovingiz keyingi o‘yin uchun saqlandi. Xohlasangiz, olmosni qaytarib olishingiz mumkin.",
    "game.refund_btn": "💎 Olmosni qaytarish",
    "game.started": "🎭 <b>O‘yin boshlandi!</b> O‘yinchilar: <b>{count}</b>\nHar bir o‘yinchiga roli shaxsiy chatda yuborildi.",
    "game.composition": "🎭 <b>Rollar tarkibi:</b> {roles}",
    "game.dm_failed": "⚠️ Bot quyidagi o‘yinchilarga xabar yubora olmadi — botni ochib, /start bosing: {names}",
    "game.bot_btn": "🤖 Botga o‘tish",
    "game.night_over": "⌛ Kecha tugadi.",
    "game.vote_over": "⌛ Ovoz berish tugadi.",
    "game.stale": "⌛ Bu tanlov eskirgan.",
    "game.stale_vote": "⌛ Bu ovoz berish eskirgan.",
    "game.stale_witch": "⌛ Bu qaror eskirgan.",
    "game.unknown_action": "Noma’lum harakat.",
    "game.back": "⬅️ Orqaga",
    "game.mode": "{action}: <b>o‘yinchini tanlang.</b>",
    "game.last_words_prompt": "💬 <b>So‘nggi so‘zingizni yozing</b> — u umumiy chatga yuboriladi (bitta xabar).",
    "game.last_words_sent": "✅ So‘nggi so‘zingiz yuborildi.",
    "game.last_words": "💬 <b>{name}ning so‘nggi so‘zi:</b>\n<blockquote>{text}</blockquote>",
    "game.team_msg": "💬 {role} {name}:\n{text}",
    "game.defender_note": "🛡 Bosh himoyachi bugun {target} ni himoya qilishni tanladi.",
    "game.win_dm": "🏆 <b>O‘yin tugadi — siz g‘alaba qozondingiz!</b>{bonus}",
    "game.win_bonus": " Mukofot: <b>+{reward} ₸</b>",
    "game.lose_dm": "🏁 O‘yin tugadi. Bu safar mag‘lubiyat... <i>Keyingi safar omad!</i>",
    "game.lose_dead_dm": "🏁 O‘yin tugadi. Sizning tomoningiz yutdi, lekin <b>siz tirik qolmadingiz</b> — g‘alaba faqat tiriklarga beriladi.",
    "game.stopped": "🛑 O‘yin to‘xtatildi.",
    "game.stopped_admin": "🛑 O‘yinni administrator to‘xtatdi.",
    "game.error": "⚠️ Kutilmagan xatolik yuz berdi, o‘yin to‘xtatildi.",
    "game.shutdown": "⚠️ Bot to‘xtatildi, o‘yin to‘xtatildi.",
    "game.restarted": "⚠️ Bot qayta ishga tushirildi, avvalgi o‘yin to‘xtatildi. Yangi o‘yin: /game",
    "game.removed": "Bot guruhdan chiqarildi.",
    "game.migrated": "⚠️ Guruh superguruhga aylandi, o‘yinni qaytadan boshlang: /game",

    # --- Asosiy menyu --------------------------------------------------------------------------
    "btn.join": "🎮 O‘yinga qo‘shilish",
    "btn.room": "🏠 O‘yin xonasini ochish",
    "btn.profile": "👤 Mening profilim",
    "btn.shop": "🛍 Do‘kon",
    "btn.diamonds": "💎 Olmos sotib olish",
    "btn.role": "🎭 Rol tanlash",
    "btn.rules": "📜 Qoidalar",
    "btn.rating": "🏆 Reyting",
    "btn.daily": "🎁 Kunlik sovg‘a",
    "btn.help": "❓ Yordam",
    "btn.lang": "🌐 Til",
    "menu_hint": "Menyudan kerakli bo‘limni tanlang 👇",
    "welcome": (
        "🎭 <b>Mafiya botiga xush kelibsiz!</b>\n\n"
        "Men guruh chatlarida <b>4–50 kishilik</b> Mafiya o‘yinini olib boraman:\n"
        "• rollarni tasodifiy taqsimlayman va har bir o‘yinchiga <b>faqat shaxsiy chatda</b> aytaman;\n"
        "• tungi harakatlar va ovoz berish — shu shaxsiy chatda;\n"
        "• har bir harakat va ovoz guruhda alohida xabar bo‘lib e’lon qilinadi.\n\n"
        "<b>Boshlash:</b> meni guruhga qo‘shing, administrator qiling va guruhda /game yozing.\n"
        "Quyidagi menyudan foydalaning 👇"
    ),
    "help": (
        "❓ <b>Yordam</b>\n\n"
        "<b>Guruhda:</b>\n"
        "/game — yangi o‘yinga ro‘yxatni ochish\n"
        "/startgame — ro‘yxatni tugatib, o‘yinni darhol boshlash\n"
        "/extend — ro‘yxatni 30 soniyaga uzaytirish\n"
        "/leave — ro‘yxatdan yoki o‘yindan chiqish\n"
        "/give 5 — o‘yinchiga olmos sovg‘a qilish (uning xabariga javob sifatida)\n"
        "/give 3 — javobsiz yozsangiz: 🎁 olmos tarqatish, birinchi 3 kishi 1 💎 dan oladi\n"
        "/stop — o‘yinni to‘xtatish <i>(administratorlar)</i>\n"
        "/settingsmafia — ro‘yxat vaqti, kim boshlay olishi, til <i>(administratorlar)</i>\n"
        "/topmafia — haftaning eng yaxshi o‘yinchilari <i>(administratorlar)</i>\n\n"
        "<b>Shaxsiy chatda:</b>\n"
        "/profile — profil · /shop — do‘kon · /daily — kunlik sovg‘a\n"
        "/rating — reyting · /rules — qoidalar · /language — til\n"
        "/exchange — 💎 olmosni ₸ ga almashtirish\n"
        "/paysupport — to‘lov bo‘yicha yordam\n\n"
        "<b>O‘yin qanday o‘tadi:</b>\n"
        "1. Guruhda /game yoziladi, o‘yinchilar «🎮 O‘yinga qo‘shilish» tugmasini bosadi.\n"
        "2. Kamida 4 o‘yinchi yig‘ilsa, o‘yin boshlanadi (ko‘pi bilan 50).\n"
        "3. Rolingiz shu shaxsiy chatga keladi — <b>uni hech kimga ko‘rsatmang!</b>\n"
        "4. Kechasi rolingizga mos harakatni shu yerda tanlaysiz. <i>Ketma-ket 3 kecha hech narsa bosmasangiz, o‘yindan chiqarilasiz.</i>\n"
        "5. Kunduzi guruhda muhokama qilasiz, ovozni shu yerda berasiz, so‘ng guruhda qarorni 👍/👎 bilan tasdiqlaysiz.\n\n"
        "<b>O‘yin vaqtida guruh tartibi:</b>\n"
        "• o‘yinda qatnashmayotganlar va halok bo‘lganlarning xabari o‘chirilib, ular <b>2 daqiqaga</b> ovozsiz qilinadi;\n"
        "• kechasi barcha o‘yinchilarning xabari o‘chiriladi;\n"
        "• administratorlar xabarini <code>!</code> belgisi bilan boshlasa, u o‘chirilmaydi."
    ),
    "need_admin": (
        "⚠️ <b>O‘yinni olib borish uchun menga administrator huquqlari kerak:</b>\n"
        "• 🗑 xabarlarni o‘chirish;\n"
        "• 🚫 a’zolarni cheklash (begonalar va halok bo‘lganlarni ovozsiz qilish uchun);\n"
        "• 📌 xabarlarni qadash <i>(majburiy emas)</i>.\n\n"
        "Guruh sozlamalarida meni administrator qiling, so‘ng /game yozing."
    ),
    "bot_added": (
        "👋 Salom! Men — <b>Mafiya o‘yinining boshlovchisiman</b>.\n\n"
        "⚠️ <b>O‘yinni olib borish uchun menga administrator huquqlari kerak:</b>\n"
        "• 🗑 xabarlarni o‘chirish;\n"
        "• 🚫 a’zolarni cheklash;\n"
        "• 📌 xabarlarni qadash <i>(majburiy emas)</i>.\n\n"
        "Guruh sozlamalarida meni administrator qiling, so‘ng /game yozing."
    ),
    "bot_promoted": (
        "✅ <b>Rahmat! Administrator huquqlari berildi.</b>\n"
        "Ro‘yxatni ochish uchun /game yozing. Sozlamalar: /settingsmafia\n"
        "<i>Har bir o‘yinchi bot bilan shaxsiy chatni boshlashi kerak.</i>"
    ),
    "pay_support": (
        "💳 <b>To‘lov bo‘yicha yordam</b>\n\n"
        "Olmoslar Telegram Stars (⭐) evaziga sotiladi, to‘lov Telegramning o‘zida amalga oshadi.\n"
        "To‘lov tasdiqlangach, olmoslar balansingizga darhol qo‘shiladi; bitta to‘lov uchun olmos faqat bir marta beriladi.\n"
        "Muammo bo‘lsa, bot administratoriga Telegramdagi to‘lov xabarini yuboring."
    ),
    "terms": (
        "📄 <b>Shartlar</b>\n\n"
        "• ₸ — o‘yin ichidagi bepul valyuta, u haqiqiy pul emas va almashtirilmaydi.\n"
        "• 💎 olmos — Telegram Stars evaziga sotib olinadigan raqamli o‘yin mahsuloti.\n"
        "• Sotib olingan olmos va buyumlar faqat shu bot ichida ishlatiladi.\n"
        "• Olmosga sotiladigan imtiyozlar o‘yin qoidalari bilan cheklangan (bir o‘yinda bitta himoya, bitta o‘q va h.k.).\n"
        "• Qoidabuzarlik yoki firibgarlik aniqlansa, administrator hisobni cheklashi mumkin."
    ),
    "lang.choose": "🌐 <b>Tilni tanlang:</b>",
    "lang.set": "✅ Til o‘zgartirildi: <b>o‘zbekcha</b>.",
    "time.hm": "{h} soat {m} daqiqa",
    "time.m": "{m} daqiqa",

    # --- Qoidalar ------------------------------------------------------------------------------
    "rules.tab.general": "📖 Umumiy",
    "rules.tab.roles": "🎭 Rollar",
    "rules.tab.night": "🌙 Tun tartibi",
    "rules.tab.items": "🎒 Buyumlar",
    "rules.tab.balance": "⚖️ Balans",
    "rules.general": (
        "📖 <b>Umumiy qoidalar</b>\n\n"
        "• O‘yinda <b>{min}–{max}</b> o‘yinchi qatnashadi.\n"
        "• Rollar tasodifiy taqsimlanadi va faqat shaxsiy chatda aytiladi.\n"
        "• O‘yin <b>kechadan</b> boshlanadi: maxsus rollar shaxsiy chatda harakat qiladi, har bir harakat guruhda alohida xabar bo‘lib chiqadi (kimga ekani aytilmaydi).\n"
        "• Ertalab kim halok bo‘lgani va uning roli e’lon qilinadi.\n"
        "• Kunduzi muhokama, so‘ng shaxsiy chatda ovoz berish. Har bir ovoz guruhda e’lon qilinadi. Eng ko‘p ovoz olgan o‘yinchi bo‘yicha guruhda 👍/👎 tasdiqlash o‘tadi: 👍 ko‘p bo‘lsagina osiladi. Ovozlar teng bo‘lsa — hech kim osilmaydi.\n"
        "• O‘yin vaqtida begonalar va halok bo‘lganlarning xabari o‘chirilib, ular 2 daqiqaga ovozsiz qilinadi; kechasi barcha o‘yinchilarning xabari o‘chiriladi. Administratorlar <code>!</code> belgisi bilan yozishi mumkin.\n"
        "• O‘yindan chiqqan (/leave) o‘yinchining roli ochiladi va u mag‘lub bo‘ladi. Ketma-ket 3 kecha hech qanday harakat qilmagan o‘yinchi (AFK) ham o‘yindan chiqariladi.\n\n"
        "<b>G‘alaba shartlari</b>\n"
        "🏘 Tinch aholi — barcha Don, mafiya, Killer va Manyak yo‘q qilinsa.\n"
        "🤵 Mafiya — Don, mafiya va Killer soni qolganlardan (Himoyachilarsiz) kam bo‘lmasa va Manyak tirik bo‘lmasa.\n"
        "🪓 Manyak — tirik qolgan oxirgi ikki o‘yinchidan biri bo‘lsa.\n"
        "⚛️ Higgs-Man — o‘yin oxirida tirik bo‘lsa (kim yutmasin), mukofot ×2.\n"
        "🤡 O‘zini o‘ldiruvchi — osilsa; 🔥 Piroman — bomba qo‘yilganlarning hammasini portlatsa.\n\n"
        "🏆 <b>G‘alaba va ₸ mukofotni faqat o‘yin oxirigacha tirik qolganlar oladi.</b> "
        "<i>Istisno — o‘limi orqali yutadigan O‘zini o‘ldiruvchi va Piroman.</i>"
    ),
    "rules.roles_title": "🎭 <b>Rollar</b>",
    "rules.night": (
        "🌙 <b>Tungi harakatlarning hisoblanish tartibi</b>\n\n"
        "1. Barcha tungi tanlovlar yig‘iladi (bir vaqtda).\n"
        "2. 💻 Xaker bloklagan o‘yinchining harakati bajarilmaydi.\n"
        "3. 🛡 Bosh himoyachining nishoni aniqlanadi.\n"
        "4. 👨‍⚕️ Shifokor davolaydi — davolangan odam o‘sha kecha hujumdan ham, bombadan ham o‘lmaydi.\n"
        "5. 🤵 Mafiyaning umumiy hujumi (Donning qarori, bo‘lmasa mafiya ovozi).\n"
        "6. 🔪 Killer va 7. 🪓 Manyak hujum qiladi.\n"
        "8. 🕵️ Komissar tekshiradi yoki otadi.\n"
        "9. 🍾 Gado kimlar kelganini biladi.\n"
        "10. 🔥 Bombalar qo‘yiladi yoki portlatiladi.\n"
        "11. 🧙‍♀️ Jodugar hujumchini jazolaydi yoki kechiradi.\n"
        "12. 💣 Kamikadze qotilini o‘zi bilan olib ketadi (Shifokordan kuchli).\n"
        "13. 🐺 Bo‘rilar tomonini o‘zgartiradi.\n"
        "14. O‘limlar tasdiqlanadi, 15. g‘alaba shartlari tekshiriladi, 16. ertalabki xabar e’lon qilinadi.\n\n"
        "<i>⚛️ Higgs-Man maydoni dastlabki 3 hujumni o‘ziga oladi. Sotib olingan 🛡 himoya faqat birinchi o‘limga olib keladigan hujumni to‘xtatadi; u bombani, Kamikadze va Jodugarning maxsus ta’sirini to‘xtatmaydi.</i>"
    ),
    "rules.items_title": "🎒 <b>Buyumlar va imtiyozlar</b>",
    "rules.item_line": "{emoji} <b>{name}</b> — {price}\n<i>{desc}</i>\n",
    "rules.role_pick": "🎭 <b>Rol tanlash</b> — {price} 💎, kuchli rollar ({roles}) — {premium} 💎\n<i>Keyingi o‘yin uchun rol tanlaysiz. Rol o‘yinchilar soniga mos bo‘lsa beriladi, aks holda tanlov saqlanadi yoki olmosni qaytarib olishingiz mumkin. ⚛️ Higgs-Man sotilmaydi.</i>\n",
    "rules.exchange": "💱 <b>Almashtirish</b> — 1 💎 = {rate} ₸ <i>(faqat 💎 → ₸; /exchange)</i>\n",
    "rules.fairness": "⚖️ <b>Adolat:</b> bir o‘yinda ko‘pi bilan bitta himoya, bitta ovoz berishdan himoya va bitta o‘q ishlatiladi. Buyumlar faqat haqiqatan kerak bo‘lganda sarflanadi.",
    "rules.balance_title": "⚖️ <b>O‘yinchilar soniga qarab rollar</b>\n<i>(qolgan o‘rinlar — 👨 tinch aholi)</i>",
    "rules.higgs_rare": "⚛️ <b>Higgs-Man</b> — {min}+ o‘yinchida har bir o‘yinda ≈{chance}% ehtimol bilan bitta tinch aholi o‘rniga chiqadi.",
    "rules.rewards": "💰 <b>G‘alaba mukofoti:</b> {rewards}. Oraliq sonlar avtomatik hisoblanadi, ⚛️ Higgs-Man — ×2.",

    # --- Buyumlar ------------------------------------------------------------------------------
    "item.shields.name": "Himoya",
    "item.shields.desc": "Bir o‘yinda bir marta o‘limga olib keladigan tungi hujumdan saqlaydi (mafiya, Killer, Manyak, Komissarning o‘qi). Ishlatilgani hech kimga e’lon qilinmaydi.",
    "item.fake_docs.name": "Soxta hujjat",
    "item.fake_docs.desc": "Don, mafiya, Piroman yoki Manyak bo‘lsangiz, Komissarning birinchi tekshiruvi sizni «Tinch aholi» deb ko‘rsatadi. Faqat bitta o‘yinga yaroqli.",
    "item.vote_shields.name": "Ovoz berishdan himoya",
    "item.vote_shields.desc": "Kunduzgi ovoz berishda osilishga tanlansangiz, bir marta tirik qolasiz. Tungi hujumdan saqlamaydi.",
    "item.piercing_bullets.name": "Himoyani teshuvchi o‘q",
    "item.piercing_bullets.desc": "Don (mafiyaning umumiy hujumi), Killer, Komissar (otish) yoki Manyak bo‘lsangiz, hujumingiz nishonning sotib olingan himoyasini teshib o‘tadi. Faqat himoya haqiqatan teshilganda sarflanadi.",

    # --- Profil, do‘kon, reyting, sovg‘a -------------------------------------------------------
    "profile.title": "👤 <b>O‘yinchi profili</b>",
    "profile.player": "🎮 O‘yinchi: {name}",
    "profile.id": "🆔 ID: <code>{id}</code>",
    "profile.registered": "📅 Ro‘yxatdan o‘tgan sana: {date}",
    "profile.stats": "📊 <b>Statistika</b>",
    "profile.games": "O‘yinlar: <b>{n}</b>",
    "profile.wins": "G‘alabalar: <b>{n}</b>",
    "profile.losses": "Mag‘lubiyatlar: <b>{n}</b>",
    "profile.rate": "G‘alaba foizi: <b>{rate}</b>",
    "profile.rank": "Reytingdagi o‘rni: <b>{rank}</b>",
    "profile.recent": "🕹 <b>So‘nggi o‘yinlar</b>",
    "profile.recent_line": "{mark} {role} — {count} o‘yinchi{reward}",
    "profile.reward": ", <b>+{reward} ₸</b>",
    "profile.balance": "💰 <b>Balans</b>",
    "profile.tenge": "₸: <b>{n}</b>",
    "profile.diamonds": "💎 Olmos: <b>{n}</b>",
    "profile.items": "🎒 <b>Buyumlar</b>",
    "profile.shields": "🛡 Himoya: <b>{n}</b>",
    "profile.fake_docs": "📄 Soxta hujjat: <b>{n}</b>",
    "profile.premium": "💎 <b>Premium imtiyozlar</b>",
    "profile.vote_shields": "⚖️ Ovoz berishdan himoya: <b>{n}</b>",
    "profile.bullets": "💥 Himoyani teshuvchi o‘q: <b>{n}</b>",
    "profile.next_role": "🎭 Keyingi o‘yin roli: <b>{role}</b>{more}",
    "profile.queue_more": " <i>(navbatda yana {n} ta)</i>",
    "profile.next_none": "🎭 Keyingi o‘yin roli: <i>tanlanmagan</i>",
    "shop.title": "🛍 <b>Do‘kon</b>",
    "shop.balance": "Balansingiz: <b>{tenge} ₸</b> · <b>{diamonds} 💎</b>",
    "shop.footer": "<i>Buyumlar profilda saqlanadi va keyingi o‘yinlarda o‘zi ishlatiladi.</i>",
    "shop.bought": "✅ {emoji} <b>{name}</b> sotib olindi! Sizda: <b>{count}</b>. Qolgan balans: <b>{balance} {currency}</b>",
    "shop.no_funds": "Mablag‘ yetarli emas: {price} kerak, sizda {balance} {currency}.",
    "shop.unknown": "Noma’lum buyum.",
    "shop.ok_alert": "✅ Sotib olindi!",
    "dia.title": "💎 <b>Olmos sotib olish</b>",
    "dia.intro": "Paket qancha katta bo‘lsa, bitta olmos shuncha arzon.\nTo‘lov <b>Telegram Stars (⭐)</b> orqali xavfsiz amalga oshadi.",
    "dia.line": "• <b>{diamonds} 💎</b> — {price} ₸ <i>({per} ₸/💎)</i> · {stars} ⭐",
    "rp.title": "🎭 <b>Keyingi o‘yin uchun rol tanlash</b>",
    "rp.intro": "Narxi: <b>{price} 💎</b>; kuchli rollar ({roles}) — <b>{premium} 💎</b>. Rol o‘yinchilar soni yetarli bo‘lgan o‘yinda beriladi. Bir o‘yinda bitta tanlov ishlatiladi, qolganlari navbatda turadi.",
    "rp.line": "{role} — <b>{price} 💎</b> · <i>{min}+ o‘yinchi</i>",
    "rp.higgs_note": "{role} — <i>sotilmaydi, o‘yinda kamdan-kam va tasodifiy chiqadi.</i>",
    "rp.queue": "📋 <b>Navbatingiz:</b> {roles}",
    "rp.not_buyable": "Bu rolni sotib olib bo‘lmaydi.",
    "rp.no_funds": "Olmos yetarli emas: bu rol {price} 💎, sizda {balance} 💎. «💎 Olmos sotib olish» bo‘limini oching.",
    "rp.limit": "Navbatda ko‘pi bilan {limit} ta rol turishi mumkin.",
    "rp.failed": "Sotib olib bo‘lmadi.",
    "rp.ok_alert": "✅ Rol navbatga qo‘yildi!",
    "rp.saved": "✅ {role} roli {position} saqlandi. Qolgan balans: <b>{balance} 💎</b>",
    "rp.next_game": "keyingi o‘yin uchun",
    "rp.position": "navbatda {n}-o‘rinda",
    "rq.button": "📋 Mening navbatim",
    "rq.empty": "📋 Navbatingiz bo‘sh. Keyingi o‘yin uchun rol tanlanmagan.",
    "rq.title": "📋 <b>Rollar navbati</b> (birinchisi — keyingi o‘yin uchun):",
    "rq.refund_btn": "❌ {role} — 💎 qaytarish",
    "rr.in_game": "O‘yin yoki ro‘yxat vaqtida rolni qaytarib bo‘lmaydi.",
    "rr.gone": "Bu tanlov allaqachon ishlatilgan yoki qaytarilgan.",
    "rr.done": "💎 {n} ta olmos qaytarildi.",
    "rating.title": "🏆 <b>Eng yaxshi o‘yinchilar</b>",
    "rating.empty": "<i>Hozircha hech kim o‘ynamagan.</i>",
    "rating.line": "{medal} {name} — <b>{wins}</b> g‘alaba / {games} o‘yin ({rate}%)",
    "rating.me": "Sizning o‘rningiz: <b>{rank}</b>",
    "top.title": "🏆 <b>Hafta yulduzlari</b> · {chat}\n<i>Shu chatning so‘nggi 7 kunlik o‘yinlari bo‘yicha</i>",
    "top.line": "{medal} {name} — <b>{wins}</b> g‘alaba · {games} o‘yin · +{earned} ₸",
    "top.empty": "<i>So‘nggi 7 kunda bu chatda yakunlangan o‘yin bo‘lmadi.</i>",
    "top.admins_only": "⛔️ /topmafia buyrug‘i faqat chat administratorlari uchun.",
    "daily.ok": "🎁 {day}-kun sovg‘asi: <b>+{reward} ₸</b>!",
    "daily.balance": "Balansingiz: <b>{n} ₸</b>",
    "daily.tomorrow": "<i>Ertaga yana keling!</i>",
    "daily.wait": "⏳ Bugungi sovg‘ani oldingiz. Keyingi sovg‘agacha: <b>{time}</b>.",

    # --- Qo‘shilish, xonalar, guruh ------------------------------------------------------------
    "join.list": "🎮 <b>Ochiq o‘yinlar:</b>",
    "join.none": "Hozir siz a’zo bo‘lgan guruhlarda ochiq ro‘yxat yo‘q.\nYangi o‘yin ochish uchun guruhda /game yozing.",
    "join.not_member": "❌ Bu o‘yinga faqat o‘sha guruh a’zolari qo‘shila oladi.",
    "room.text": "🏠 <b>O‘yin xonasini ochish</b>\n\nO‘yin guruh chatida o‘tadi. Meni guruhga qo‘shing, administrator qiling va o‘sha guruhda /game yozing yoki quyidan bot bor guruhni tanlang.",
    "room.add_btn": "➕ Botni guruhga qo‘shish",
    "room.add_new_btn": "➕ Botni yangi guruhga qo‘shish",
    "room.not_member": "Siz bu guruh a’zosi emassiz.",
    "room.no_rights": "Botda bu guruhda administrator huquqlari yo‘q.",
    "room.opened_alert": "✅ Ro‘yxat ochildi!",
    "room.opened": "✅ «{chat}» guruhida ro‘yxat ochildi.",
    "group.admins_only": "⛔️ Bu chatda o‘yinni faqat administratorlar ocha va boshlay oladi.",
    "group.no_lobby": "Ochiq ro‘yxat yo‘q.",
    "group.stop_denied": "O‘yinni faqat guruh administratorlari to‘xtata oladi.",
    "group.no_game": "Bu chatda o‘yin yo‘q.",
    "group.not_in_game": "Siz bu chatdagi o‘yinda qatnashmayapsiz.",
    "group.open_bot_btn": "🤖 Botni ochish",

    # --- Chat sozlamalari ----------------------------------------------------------------------
    "settings.title": "⚙️ <b>Mafiya sozlamalari</b> — «{chat}»",
    "settings.reg": "⏱ Ro‘yxat vaqti: <b>{seconds} soniya</b>",
    "settings.start": "▶️ O‘yinni ocha va boshlay oladiganlar: <b>{mode}</b>",
    "settings.start.all": "👥 Hamma",
    "settings.start.admins": "👑 Faqat administratorlar",
    "settings.lang": "🌐 Til: <b>{lang}</b>",
    "settings.note": "<i>Quyidagi tugmalar bilan o‘zgartiring. O‘zgarishlar keyingi o‘yindan boshlab qo‘llanadi.</i>",
    "settings.admins_only": "Sozlamalarni faqat chat administratorlari o‘zgartira oladi.",
    "settings.saved": "✅ Saqlandi",
    "settings.close_btn": "✖️ Yopish",
    "settings.closed": "⚙️ Sozlamalar saqlandi.",
    "settings.sec": "{n} soniya",

    # --- To‘lov --------------------------------------------------------------------------------
    "pay.title": "{n} 💎 olmos",
    "pay.desc": "Mafiya botidagi {n} ta olmos (≈ {price} ₸). To‘lov tasdiqlangach, darhol balansga qo‘shiladi.",
    "pay.label": "{n} ta olmos",
    "pay.unknown_package": "Noma’lum paket.",
    "pay.bad_package": "Bu paket endi mavjud emas. Menyudan qaytadan tanlang.",
    "pay.unknown": "⚠️ To‘lov qabul qilindi, lekin paket topilmadi. /paysupport orqali murojaat qiling.",
    "pay.dup": "ℹ️ Bu to‘lov avval ro‘yxatga olingan, olmoslar balansga qo‘shilgan.",
    "pay.ok": "✅ <b>To‘lov tasdiqlandi! +{n} 💎</b>\nOlmos balansingiz: <b>{balance} 💎</b>",

    # --- Buyruqlar tavsifi ---------------------------------------------------------------------
    "give.usage": "💎 <b>Olmos sovg‘a qilish</b>\n• O‘yinchining xabariga javob sifatida <code>/give 5</code> yoki <code>/give @username 5</code> — o‘sha o‘yinchiga 5 💎.\n• Guruhda shunchaki <code>/give 3</code> — 🎁 olmos tarqatish: «Sovg‘ani ochish» tugmasini birinchi bosgan 3 kishi 1 💎 dan oladi.",
    "give.bad_amount": "❌ Olmos sonini to‘g‘ri yozing: 1 dan {max} gacha.",
    "give.unknown": "❌ {name} topilmadi. U avval botda /start bosishi kerak, yoki uning xabariga javob sifatida yozing.",
    "give.self": "❌ O‘zingizga olmos bera olmaysiz.",
    "give.bot": "❌ Botga olmos berib bo‘lmaydi.",
    "give.no_funds": "❌ Olmos yetarli emas: sizda <b>{balance} 💎</b> bor.",
    "give.ok": "💎 {giver} {receiver} o‘yinchisiga <b>{n} olmos</b> sovg‘a qildi!",
    "give.left": "Qolgan balansingiz: <b>{balance} 💎</b>",
    "give.dm": "🎁 {giver} sizga <b>{n} 💎</b> sovg‘a qildi! Balansingiz: <b>{balance} 💎</b>",
    "giveaway.open": "🎁 {giver} <b>{n} olmos</b> tarqatdi — ulgurib oling!\nHar kim <b>1 💎</b> oladi · Qoldi: <b>{left}/{n}</b>",
    "giveaway.done": "🎁 {giver} tarqatgan <b>{n} olmos</b> to‘liq olindi!",
    "giveaway.expired": "⌛ {giver} tarqatgan {n} 💎 muddati tugadi: olinmagan <b>{left} 💎</b> egasiga qaytarildi.",
    "giveaway.cancelled": "🎁 {giver} tarqatgan {n} 💎 yopildi — administrator barcha olmoslarni nolladi.",
    "giveaway.claimers": "✅ Olganlar ({count}): {names}",
    "giveaway.btn": "🎁 Sovg‘ani ochish",
    "giveaway.ok": "🎉 Siz 1 💎 oldingiz! Balansingiz: {balance} 💎",
    "giveaway.own": "O‘z sovg‘angizni ola olmaysiz 🙂",
    "giveaway.again": "Siz bu sovg‘adan olib bo‘ldingiz.",
    "giveaway.gone": "Kechirasiz, sovg‘a tugadi.",
    "ex.title": "💱 <b>Olmosni ₸ ga almashtirish</b>\nKurs: <b>1 💎 = {rate} ₸</b>\nSizda: <b>{diamonds} 💎</b> · <b>{tenge} ₸</b>\n\nNechta olmos almashtirasiz? Tugmani bosing yoki <code>/exchange 3</code> deb yozing.\n<i>Teskari almashtirish (₸ → 💎) yo‘q.</i>",
    "ex.btn": "{n} 💎 → {tenge} ₸",
    "ex.all_btn": "Hammasi: {n} 💎 → {tenge} ₸",
    "ex.ok": "✅ <b>{n} 💎</b> → <b>{tenge} ₸</b> almashtirildi.\nBalansingiz: <b>{diamonds} 💎</b> · <b>{balance} ₸</b>",
    "ex.no_funds": "Olmos yetarli emas: sizda {diamonds} 💎 bor.",
    "ex.usage": "Foydalanish: <code>/exchange 3</code> — 3 💎 almashtiradi (1 💎 = {rate} ₸). Soni: 1 dan {max} gacha.",
    "ex.shop_btn": "💱 Olmosni ₸ ga almashtirish (1 💎 = {rate} ₸)",
    "cmd.start": "Asosiy menyu",
    "cmd.profile": "Mening profilim",
    "cmd.shop": "Do‘kon",
    "cmd.exchange": "Olmosni ₸ ga almashtirish",
    "cmd.daily": "Kunlik sovg‘a",
    "cmd.rating": "Reyting",
    "cmd.rules": "Qoidalar",
    "cmd.language": "Tilni o‘zgartirish",
    "cmd.help": "Yordam",
    "cmd.paysupport": "To‘lov bo‘yicha yordam",
    "cmd.terms": "Shartlar",
    "cmd.game": "Yangi o‘yinga ro‘yxatni ochish",
    "cmd.startgame": "O‘yinni darhol boshlash",
    "cmd.extend": "Ro‘yxatni 30 soniyaga uzaytirish",
    "cmd.leave": "O‘yindan chiqish",
    "cmd.give": "O‘yinchiga olmos sovg‘a qilish",
    "cmd.stop": "O‘yinni to‘xtatish (administrator)",
    "cmd.settingsmafia": "Bot sozlamalari (administrator)",
    "cmd.topmafia": "Haftaning eng yaxshi o‘yinchilari (administrator)",
}
