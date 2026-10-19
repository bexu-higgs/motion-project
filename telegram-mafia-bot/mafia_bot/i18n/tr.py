"""Türkçe."""

MESSAGES: dict[str, str] = {
    # --- Roller --------------------------------------------------------------------------------
    "role.civilian": "Vatandaş",
    "role.civilian.desc": "Gece bir eyleminiz yok. Gündüz tartışmaya katılın, mafyayı bulmaya yardım edin ve doğru kişiye oy verin.",
    "role.don": "Don",
    "role.don.desc": "Mafyanın lideri. Gece mafyanın ortak kurbanını siz seçersiniz: mafya üyeleri oy verir ama son karar sizindir.",
    "role.mafia": "Mafya",
    "role.mafia.desc": "Gece Don ile birlikte kurban seçersiniz. Don seçim yapmazsa mafyanın oyu karar verir. Don ölürse mafya üyelerinden biri yeni Don olur.",
    "role.killer": "Tetikçi",
    "role.killer.desc": "Mafyanın kiralık katili. Mafyayı tanırsınız ve her gece mafyadan ayrı olarak bir oyuncuyu kendi başınıza öldürebilirsiniz.",
    "role.defender": "Koruyucu",
    "role.defender.desc": "Mafyanın tarafındasınız ama mafyayı tanımazsınız. Gece baş koruyucu bir oyuncuyu korur: bu kişi Don ya da mafyaysa Komiser onu «Vatandaş» olarak görür, ertesi gün asılırsa da hayatta kalır.",
    "role.commissioner": "Komiser",
    "role.commissioner.desc": "Her gece bir oyuncuyu kontrol eder (rolünü öğrenirsiniz) ya da ateş edersiniz. İlk gece yalnızca kontrol edebilirsiniz. Çavuşlar kontrol sonuçlarını öğrenir.",
    "role.sergeant": "Çavuş",
    "role.sergeant.desc": "Komiserin yardımcısı. Komiseri tanırsınız ve onun kontrol sonuçlarını alırsınız. Komiser ölürse yeni Komiser siz olursunuz.",
    "role.doctor": "Doktor",
    "role.doctor.desc": "Her gece bir oyuncuyu iyileştirirsiniz — o gece ölmez. Aynı kişiyi iki gece üst üste iyileştiremezsiniz, kendinizi oyun boyunca yalnızca bir kez iyileştirebilirsiniz.",
    "role.hacker": "Hacker",
    "role.hacker.desc": "Gece bir oyuncunun telefonunu hacklersiniz — onun o geceki eylemi gerçekleşmez. Aynı kişiyi iki gece üst üste engelleyemezsiniz.",
    "role.beggar": "Dilenci",
    "role.beggar.desc": "Gece bir oyuncunun evine şişe istemeye gidersiniz. Sabah o eve gece kimlerin geldiğini öğrenirsiniz.",
    "role.kamikaze": "Kamikaze",
    "role.kamikaze.desc": "Bir vatandaşsınız. Biri sizi gece öldürürse katilinizi de yanınızda götürürsünüz — bunu ne Doktor ne de koruma durdurabilir. Piroman'ın bombasına karşı işe yaramaz.",
    "role.suicide": "İntiharcı",
    "role.suicide.desc": "Kendi kazanma koşulunuz var: gündüz oylamasında asılırsanız — kazanırsınız.",
    "role.witch": "Cadı",
    "role.witch.desc": "Vatandaşların tarafındasınız. Gece size ilk kez saldırıldığında büyünüz sizi korur ve saldırganı cezalandırmayı ya da affetmeyi siz seçersiniz. Büyü yalnızca bir kez işe yarar ve Piroman'ın bombasına karşı güçsüzdür.",
    "role.pyro": "Piroman (Bombacı)",
    "role.pyro.desc": "Her gece bir oyuncunun evine bomba koyarsınız. En az üç canlı oyuncuda bomba olduğunda hepsini patlatabilirsiniz (siz de ölürsünüz). Bombalananların hepsi o gece ölürse — kazanırsınız.",
    "role.wolf": "Kurt Adam",
    "role.wolf.desc": "Vatandaş olarak başlarsınız. Mafya ya da Tetikçi size saldırırsa ölmezsiniz, mafyaya katılırsınız. Komiser ateş ederse ölmezsiniz, Çavuş olursunuz. Diğer saldırılarda her zamanki gibi ölürsünüz.",
    "role.maniac": "Seri Katil",
    "role.maniac.desc": "Kimsenin tarafında değilsiniz. Her gece bir oyuncuyu öldürürsünüz. Hayatta kalan son iki oyuncudan biri olursanız — kazanırsınız.",
    "role.higgs": "Higgs-Man",
    "role.higgs.desc": "Çok nadir görülen özel bir karakter. Higgs alanı sizi gece 3 kurşundan korur — 4. kurşun öldürür. İlk asılışınızdan da sağ çıkarsınız. Kimin tarafını tutacağınıza siz karar verirsiniz: oyunun sonunda hayattaysanız, kim kazanırsa kazansın siz de kazanır ve iki kat ödül alırsınız.",
    "role.was": "{role} <i>(önceden {old})</i>",

    "faction.town": "🏘 Vatandaşlar",
    "faction.mafia": "🤵 Mafya",
    "faction.solo": "🎭 Bağımsızlar",

    # --- Gece eylem düğmeleri ------------------------------------------------------------------
    "action.mk": "🔫 Kurban seç",
    "action.kk": "🔪 Öldür",
    "action.mn": "🪓 Öldür",
    "action.ck": "🔍 Kontrol et",
    "action.sh": "🔫 Ateş et",
    "action.hl": "💉 İyileştir",
    "action.bl": "💻 Engelle",
    "action.pr": "🛡 Koru",
    "action.vs": "🍾 Ziyaret et",
    "action.bm": "💣 Bomba koy",
    "action.dt": "💥 Patlat",
    "action.sk": "⏭ Geç",

    # --- Ölüm nedenleri ------------------------------------------------------------------------
    "cause.mafia": "mafya öldürdü",
    "cause.killer": "Tetikçi öldürdü",
    "cause.maniac": "Seri Katil öldürdü",
    "cause.commissioner": "Komiser vurdu",
    "cause.bomb": "bomba patladı",
    "cause.pyro_self": "kendi bombalarıyla birlikte patladı",
    "cause.witch": "Cadının lanetine uğradı",
    "cause.kamikaze": "Kamikaze yanında götürdü",
    "cause.lynch": "asıldı",
    "cause.desert": "oyundan kaçtı",

    # --- Rol mesajı ----------------------------------------------------------------------------
    "intro.role": "🎭 Rolünüz: <b>{role}</b>",
    "intro.faction": "Taraf: <b>{faction}</b>",
    "intro.goal": "🎯 <b>Hedefiniz:</b> {goal}",
    "goal.town": "mafyayı bulup yok etmek ve oyunun sonuna kadar hayatta kalmak.",
    "goal.mafia": "vatandaşları azaltıp şehri ele geçirmek ve hayatta kalmak.",
    "goal.suicide": "gündüz oylamasında asılmak.",
    "goal.pyro": "en az üç kişiye bomba koyup hepsini birlikte patlatmak.",
    "goal.maniac": "hayatta kalan son iki oyuncudan biri olmak.",
    "goal.higgs": "oyunun sonuna kadar hayatta kalmak — o zaman ödülünüz iki katına çıkar.",
    "intro.team": "🤝 <b>Takımınız:</b>",
    "intro.alone": "• <i>(yalnızsınız)</i>",
    "intro.team_chat": "✉️ <i>Bota yazdığınız mesajlar takımınıza iletilir.</i>",
    "intro.partner": "🤝 <b>Diğer koruyucu:</b>",
    "intro.head_defender": "👑 Siz <b>baş koruyucusunuz</b>: gece hedefi siz seçersiniz.",
    "intro.second_defender": "<i>Gece hedefini baş koruyucu seçer. O ölürse baş koruyucu siz olursunuz.</i>",
    "intro.higgs": "⚛️ <b>Higgs alanı:</b> {armor} gece kurşununa karşı koruma ve bir kez idamdan kurtulma.",
    "intro.items": "🎒 <b>Bu oyundaki eşyalarınız:</b>",
    "intro.item.shield": "🛡 Koruma — gece saldırısına karşı bir kez",
    "intro.item.vote_shield": "⚖️ Oylama koruması — bir kez",
    "intro.item.bullet": "💥 Zırh delici kurşun",
    "intro.item.fake_doc": "📄 Sahte belge — Komiserin ilk kontrolü için",
    "intro.survive_note": "⚠️ <i>Unutmayın: yalnızca oyunun sonuna kadar hayatta kalanlar kazanır ve ödül alır.</i>",

    # --- Gece ----------------------------------------------------------------------------------
    "night.title": "🌙 <b>{day}. gece</b>",
    "night.body": "<i>Şehir uykuya dalıyor...</i> Özel roller botla özel sohbette hareket eder.\n🤫 <b>Gece gruba yazılan mesajlar silinir.</b>",
    "night.alive": "👥 <b>Hayattaki oyuncular ({count}):</b>",
    "night.roles": "🎭 <b>Oyundaki roller:</b> {roles}",
    "prompt.head": "🌙 <b>{day}. gece</b> · Siz — <b>{role}</b>",
    "prompt.don": "Mafyanın bu geceki kurbanını seçin. <b>Son karar sizin.</b>",
    "prompt.mafia": "Kurban için oy verin. <i>Don seçim yapmazsa mafyanın oyu karar verir.</i>",
    "prompt.killer": "Bu gece kimi öldüreceksiniz?",
    "prompt.maniac": "Bu geceki kurbanınızı seçin.",
    "prompt.commissioner": "Bu gece ne yapacaksınız: <b>kontrol</b> mü edeceksiniz, yoksa <b>ateş</b> mi?",
    "prompt.commissioner_first": "İlk gece yalnızca <b>kontrol</b> edebilirsiniz. Kimi kontrol edeceksiniz?",
    "prompt.doctor": "Bu gece kimi iyileştireceksiniz?",
    "prompt.hacker": "Kimin telefonunu hackleyeceksiniz? <i>Onun bu geceki eylemi gerçekleşmez.</i>",
    "prompt.defender": "Bu gece kimi koruyacaksınız?",
    "prompt.beggar": "Bu gece kimin evine gideceksiniz?",
    "prompt.pyro": "Kimin evine bomba koyacaksınız?",
    "prompt.pyro_bombed": "💣 <b>Bomba konulanlar:</b> {names}",
    "prompt.pyro_ready": "💥 <b>Artık hepsini patlatabilirsiniz</b> (siz de ölürsünüz).",
    "prompt.none": "<i>Bu gece bir eyleminiz yok.</i>",
    "prompt.choose_hint": "👇 <i>Aşağıdaki düğmelerden birine basın.</i>",
    "submit.not_night": "Şu an gece değil.",
    "submit.not_alive": "Bu oyunda hayattaki bir oyuncu değilsiniz.",
    "submit.already": "Bu gece seçiminizi zaten yaptınız.",
    "submit.unavailable": "Bu eylem size açık değil.",
    "submit.bad_target": "Bu oyuncuyu seçemezsiniz.",
    "submit.skip": "⏭ <b>Bu gece bir şey yapmıyorsunuz.</b>",
    "submit.detonate": "💥 <b>Sabah bombalar patlayacak...</b>",
    "submit.ok": "✅ <b>Seçiminiz:</b> {action} → {target}",

    "announce.don": "🤵 <b>Don</b> <i>bu geceki kurbanını belirledi...</i>",
    "announce.mafia": "🕴 <b>Bir mafya üyesi</b> <i>kurban için oy verdi...</i>",
    "announce.killer": "🔪 <b>Tetikçi</b> <i>bıçağını bileyip hedefini seçti...</i>",
    "announce.maniac": "🪓 <b>Seri Katil</b> <i>karanlık sokaklara çıktı...</i>",
    "announce.check": "🕵️ <b>Komiser</b> <i>soruşturma yürütüyor...</i>",
    "announce.shoot": "🕵️ <b>Komiser</b> <i>tabancasını kaldırdı...</i>",
    "announce.heal": "👨‍⚕️ <b>Doktor</b> <i>ilk yardım çantasını alıp nöbete çıktı...</i>",
    "announce.block": "💻 <b>Hacker</b> <i>birinin telefonunu hacklemeye başladı...</i>",
    "announce.protect": "🛡 <b>Koruyucular</b> <i>birini korumaya aldı...</i>",
    "announce.visit": "🍾 <b>Dilenci</b> <i>şişe aramak için birinin evine yöneldi...</i>",
    "announce.bomb": "🔥 <b>Piroman</b> <i>birinin kapısının önüne bomba koyuyor...</i>",
    "announce.detonate": "🔥 <b>Piroman</b> <i>fünyeyi eline aldı...</i>",

    "night.team_vote": "🗳 {role} {name} → {target}",
    "night.hacked": "💻 Gece bir hacker telefonunuzu hackledi — <b>eyleminiz gerçekleşmedi.</b>",
    "night.check_result": "🔍 <b>Kontrol sonucu:</b> {target} — <b>{role}</b>",
    "night.sergeant_relay": "👮 <b>Komiserden mesaj:</b>\n{text}",
    "night.bomb_planted": "💣 {target} adlı oyuncunun evine bomba konuldu.",
    "night.shield_saved": "🛡 Gece size saldırıldı ama <b>korumanız sizi kurtardı!</b>",
    "night.bullet_pierced": "💥 <b>Kurşununuz hedefin korumasını deldi!</b>",
    "night.higgs_absorbed": "⚛️ Vuruldunuz ama <b>Higgs alanı sizi kurtardı!</b> Kalan koruma: <b>{left}</b>",
    "night.witch_punished": "⚔️ Saldırganı lanetle cezalandırdınız.",
    "night.witch_forgave": "🕊 Saldırganı affettiniz.",
    "night.you_died": "☠️ <b>Öldünüz</b> <i>({cause})</i>.",
    "night.beggar_nobody": "kimse gelmedi",
    "night.beggar_info": "🍾 Gece {target} adlı oyuncunun evine gelenler: <b>{names}</b>.",
    "night.wolf_mafia": "🐺 Mafya size saldırdı ama ölmediniz! <b>Artık rolünüz: {role}.</b>\n🤝 Takımınız: {team}",
    "night.wolf_sergeant": "🐺 Komiser sizi vurdu ama ölmediniz! <b>Artık rolünüz: {role}.</b>\n🤝 Takımınız: {team}",
    "night.wolf_joined_mafia": "🐺 {name} mafyaya katıldı!",
    "night.wolf_joined_police": "🐺 {name} çavuş olarak katıldı!",
    "promo.new_don": "🤵 Don öldü. <b>Artık yeni Don sizsiniz!</b>",
    "promo.new_don_team": "🤵 Yeni Don: {name}",
    "promo.new_com": "🕵️ Komiser öldü. <b>Artık yeni Komiser sizsiniz!</b>",
    "promo.new_com_team": "🕵️ Yeni Komiser: {name}",
    "promo.new_head": "👑 Baş koruyucu öldü. <b>Bir sonraki geceden itibaren hedefi siz seçeceksiniz.</b>",
    "witch.prompt": "🧙‍♀️ Gece size {names} saldırdı! <b>Büyünüz sizi kurtardı.</b>\nSaldırganı ne yapacaksınız?",
    "witch.punish": "⚔️ Cezalandır",
    "witch.forgive": "🕊 Affet",
    "witch.timeout": "⌛ Süre doldu — affettiniz.",
    "witch.ok_punish": "⚔️ Saldırgan cezalandırılacak.",
    "witch.ok_forgive": "🕊 Affettiniz.",

    # --- Sabah ---------------------------------------------------------------------------------
    "morning.title": "🌅 <b>{day}. gün · Sabah oldu!</b>",
    "morning.dead": "☠️ <b>Bu gece ölenler:</b>",
    "morning.dead_line": "• {name} — <b>{role}</b> <i>({cause})</i>",
    "morning.nobody": "😮 <b>Bu gece kimse ölmedi.</b>",
    "morning.events": "📰 <b>Gece haberleri:</b>",
    "morning.saved": "💉 <i>Doktor birinin hayatını kurtardı!</i>",
    "morning.explosion": "🔥 <i>Gece şehri büyük bir patlama sarstı!</i>",
    "morning.witch": "🧙‍♀️ <i>Birinin evinde büyülü bir parıltı görüldü...</i>",
    "morning.kamikaze": "💣 <i>Kamikaze katilini de yanında götürdü!</i>",
    "morning.pyro_won": "🔥 <b>Piroman tüm hedeflerini patlattı — Piroman kazandı!</b>",
    "morning.pyro_failed": "🔥 <i>Piroman tüm hedeflerini yok edemedi.</i>",
    "morning.alive": "👥 <b>Hayattaki oyuncular ({count}):</b>",

    # --- Gündüz ve oylama ----------------------------------------------------------------------
    "day.text": "☀️ <b>{day}. gün · Tartışma</b>\nŞüphelileri tartışın. Oylama <b>{seconds} saniye</b> sonra başlayacak.",
    "vote.start": "🗳 <b>Oylama başladı!</b>\nKimin asılacağını botla özel sohbette seçin. Süre: <b>{seconds} sn</b>.\n<i>Her oy bu sohbette duyurulur.</i>",
    "vote.prompt": "🗳 <b>{day}. gün · Oylama</b>\nSizce kim asılmalı?",
    "vote.abstain_btn": "🤐 Çekimser kal",
    "vote.cast": "🗳 {voter} oyunu <b>{target}</b> için verdi",
    "vote.cast_abstain": "🤐 {voter} <i>çekimser kaldı</i>",
    "vote.not_now": "Şu an oylama yapılmıyor.",
    "vote.not_alive": "Yalnızca hayattaki oyuncular oy verebilir.",
    "vote.already": "Zaten oy verdiniz.",
    "vote.bad_target": "Bu oyuncuya oy veremezsiniz.",
    "vote.ok_abstain": "🤐 <b>Çekimser kaldınız.</b>",
    "vote.ok": "✅ <b>{target} için oy verdiniz.</b>",
    "vote.result_title": "🗳 <b>Oylama sonucu</b>",
    "vote.result_line": "• {name} — <b>{count}</b> oy",
    "vote.abstained": "🤐 Çekimser kalanlar: <b>{count}</b>",
    "vote.silent": "😴 Oy vermeyenler: {names}",
    "vote.no_votes": "<i>Kimse oy vermedi — bugün kimse asılmayacak.</i>",
    "vote.tie": "⚖️ <b>Oylar eşit</b> — bugün kimse asılmayacak.",
    "vote.saved": "🪢 {name} asılmak üzereydi ama <b>hayatta kaldı!</b>",
    "vote.lynched": "🪢 {name} asıldı. Rolü <b>{role}</b> idi.",
    "vote.suicide_won": "🪢 {name} asıldı. Rolü <b>{role}</b> idi.\n🤡 <b>İntiharcı amacına ulaştı ve kazandı!</b>",
    "vote.higgs_saved": "⚛️ <b>Higgs alanı sizi idamdan kurtardı!</b> Bu koruma artık yok.",
    "vote.vote_shield_used": "⚖️ <b>Oylama korumanız sizi idamdan kurtardı!</b>",
    "vote.you_lynched": "☠️ <b>Şehir sizi astı.</b>",
    "desert.public": "🏃 {name} oyundan kaçtı. Rolü <b>{role}</b> idi.",

    # --- Oyun sonu -----------------------------------------------------------------------------
    "result.nobody_alive": "🤝 Kimse hayatta kalmadı — berabere",
    "result.won": "Kazanan: {side}!",
    "result.draw_long": "🤝 Oyun çok uzadı — berabere",
    "final.title": "🏁 <b>Oyun bitti!</b> {label}",
    "final.winners": "🏆 <b>Kazananlar:</b>",
    "final.winner_line": "• {name} — {role}{bonus}",
    "final.bonus": " <b>+{reward} ₸</b>",
    "final.losers": "💀 <b>Kaybedenler:</b>",
    "final.loser_line": "• {name} — {role} <i>({status})</i>",
    "final.status_alive": "hayatta",
    "final.status_dead": "öldü",
    "final.days": "📅 Oyun <b>{days}</b> gün sürdü.",
    "final.rule": "<i>Yalnızca hayatta kalan oyuncular kazanır ve ödül alır.</i>",

    # --- Kayıt ve oyun akışı -------------------------------------------------------------------
    "lobby.title": "🎲 <b>Mafya oyunu için kayıt açık!</b>",
    "lobby.time": "⏳ Kaydın bitmesine: <b>≈ {seconds} sn</b>",
    "lobby.players": "👥 <b>Kayıtlılar ({count}/{max}):</b>",
    "lobby.empty": "<i>— henüz kimse yok —</i>",
    "lobby.min": "Oyunu başlatmak için en az <b>{min}</b> oyuncu gerekir.",
    "lobby.how": "👇 Aşağıdaki düğmeye basın, ardından botta <b>START</b>'a dokunun. Roller ve gece eylemleri özel sohbette olur.",
    "lobby.join_btn": "🎮 Oyuna katıl",
    "lobby.busy": "Bu sohbette zaten bir oyun ya da kayıt sürüyor.",
    "lobby.closed_join": "❌ Bu oyunun kaydı kapandı.",
    "lobby.already_joined": "✅ «{chat}» sohbetindeki oyuna zaten kayıtlısınız.",
    "lobby.other_game": "❌ Başka bir oyuna kayıtlısınız ya da oynuyorsunuz.",
    "lobby.full": "❌ Oda dolu ({max} oyuncu).",
    "lobby.retry": "❌ Kayıt yapılamadı, lütfen tekrar deneyin.",
    "lobby.joined": "✅ <b>«{chat}» sohbetindeki oyuna katıldınız!</b> ({count}/{max})\nRolünüz bu sohbete gelecek.",
    "lobby.left": "👋 Kayıttan çıktınız.",
    "lobby.not_in_game": "Hiçbir oyunda değilsiniz.",
    "lobby.not_alive": "Bu oyunda hayattaki bir oyuncu değilsiniz.",
    "lobby.deserted": "🏃 Oyundan çıktınız. Bu oyun yenilgi sayılır.",
    "lobby.extended": "⏳ Kayıt <b>{seconds} saniye</b> uzatıldı.",
    "lobby.no_open": "Açık kayıt yok. Yeni oyun için /game yazın.",
    "lobby.need_min": "Oyunu başlatmak için en az {min} oyuncu gerekir (şu an {count}).",
    "lobby.reminder": "⏳ Kaydın bitmesine <b>{seconds} saniye</b> kaldı!",
    "lobby.not_enough": "😔 Yeterli oyuncu yok ({count}/{min}). Kayıt kapandı. Tekrar denemek için /game yazın.",
    "lobby.error": "⚠️ Oyun başlatılırken bir hata oluştu. Kayıt kapandı.",
    "lobby.closed": "🚫 Kayıt kapandı.",
    "lobby.done": "✅ Kayıt tamamlandı: <b>{count}</b> oyuncu. Oyun başladı!",
    "game.purchased_role": "💎 <b>Satın aldığınız rol size verildi!</b>",
    "game.unfulfilled": "🎭 Seçtiğiniz {role} rolü bu oyunda verilmedi ({count} oyuncu için uygun değil ya da başka bir oyuncu daha önce satın aldı).\nSeçiminiz bir sonraki oyun için saklandı. İsterseniz elmasınızı geri alabilirsiniz.",
    "game.refund_btn": "💎 Elması iade et",
    "game.started": "🎭 <b>Oyun başladı!</b> Oyuncular: <b>{count}</b>\nHerkese rolü özel sohbette gönderildi.",
    "game.composition": "🎭 <b>Rol dağılımı:</b> {roles}",
    "game.dm_failed": "⚠️ Bot şu oyunculara mesaj gönderemedi — botu açıp /start'a basın: {names}",
    "game.bot_btn": "🤖 Bota git",
    "game.night_over": "⌛ Gece sona erdi.",
    "game.vote_over": "⌛ Oylama sona erdi.",
    "game.stale": "⌛ Bu seçimin süresi geçti.",
    "game.stale_vote": "⌛ Bu oylamanın süresi geçti.",
    "game.stale_witch": "⌛ Bu kararın süresi geçti.",
    "game.unknown_action": "Bilinmeyen eylem.",
    "game.back": "⬅️ Geri",
    "game.mode": "{action}: <b>bir oyuncu seçin.</b>",
    "game.last_words_prompt": "💬 <b>Son sözlerinizi yazın</b> — grup sohbetine gönderilecek (tek mesaj).",
    "game.last_words_sent": "✅ Son sözleriniz gönderildi.",
    "game.last_words": "💬 <b>{name} son sözleri:</b>\n<blockquote>{text}</blockquote>",
    "game.team_msg": "💬 {role} {name}:\n{text}",
    "game.defender_note": "🛡 Baş koruyucu bu gece {target} adlı oyuncuyu korumayı seçti.",
    "game.win_dm": "🏆 <b>Oyun bitti — kazandınız!</b>{bonus}",
    "game.win_bonus": " Ödül: <b>+{reward} ₸</b>",
    "game.lose_dm": "🏁 Oyun bitti. Bu sefer kaybettiniz... <i>Bir dahaki sefere bol şans!</i>",
    "game.lose_dead_dm": "🏁 Oyun bitti. Tarafınız kazandı ama <b>siz hayatta kalamadınız</b> — zafer yalnızca hayattakilere verilir.",
    "game.stopped": "🛑 Oyun durduruldu.",
    "game.stopped_admin": "🛑 Oyunu bir yönetici durdurdu.",
    "game.error": "⚠️ Beklenmeyen bir hata oluştu, oyun durduruldu.",
    "game.shutdown": "⚠️ Bot durduruldu, oyun durduruldu.",
    "game.restarted": "⚠️ Bot yeniden başlatıldı, önceki oyun durduruldu. Yeni oyun: /game",
    "game.removed": "Bot gruptan çıkarıldı.",
    "game.migrated": "⚠️ Grup süper gruba dönüştü, oyunu yeniden başlatın: /game",

    # --- Ana menü ------------------------------------------------------------------------------
    "btn.join": "🎮 Oyuna katıl",
    "btn.room": "🏠 Oyun odası aç",
    "btn.profile": "👤 Profilim",
    "btn.shop": "🛍 Mağaza",
    "btn.diamonds": "💎 Elmas satın al",
    "btn.role": "🎭 Rol seç",
    "btn.rules": "📜 Kurallar",
    "btn.rating": "🏆 Sıralama",
    "btn.daily": "🎁 Günlük ödül",
    "btn.help": "❓ Yardım",
    "btn.lang": "🌐 Dil",
    "menu_hint": "Menüden bir bölüm seçin 👇",
    "welcome": (
        "🎭 <b>Mafya botuna hoş geldiniz!</b>\n\n"
        "Grup sohbetlerinde <b>4–50 kişilik</b> Mafya oyunu yönetirim:\n"
        "• rolleri rastgele dağıtır ve her oyuncuya rolünü <b>yalnızca özel sohbette</b> söylerim;\n"
        "• gece eylemleri ve oylama burada, özel sohbette yapılır;\n"
        "• her eylem ve her oy grupta ayrı bir mesajla duyurulur.\n\n"
        "<b>Başlamak için:</b> beni bir gruba ekleyin, yönetici yapın ve grupta /game yazın.\n"
        "Aşağıdaki menüyü kullanın 👇"
    ),
    "help": (
        "❓ <b>Yardım</b>\n\n"
        "<b>Grupta:</b>\n"
        "/game — yeni oyun için kaydı aç\n"
        "/startgame — kaydı bitirip oyunu hemen başlat\n"
        "/extend — kaydı 30 saniye uzat\n"
        "/leave — kayıttan ya da oyundan çık\n"
        "/stop — oyunu durdur <i>(yöneticiler)</i>\n"
        "/settingsmafiahiggs — kayıt süresi, kimin başlatabileceği, dil <i>(yöneticiler)</i>\n\n"
        "<b>Özel sohbette:</b>\n"
        "/profile — profil · /shop — mağaza · /daily — günlük ödül\n"
        "/rating — sıralama · /rules — kurallar · /language — dil\n"
        "/paysupport — ödeme desteği\n\n"
        "<b>Oyun nasıl işler:</b>\n"
        "1. Grupta /game yazılır, oyuncular «🎮 Oyuna katıl» düğmesine basar.\n"
        "2. En az 4 oyuncu toplanınca oyun başlar (en fazla 50).\n"
        "3. Rolünüz bu özel sohbete gelir — <b>kimseye göstermeyin!</b>\n"
        "4. Gece rolünüzün eylemini burada seçersiniz.\n"
        "5. Gündüz grupta tartışır, oyunuzu burada verirsiniz.\n\n"
        "<b>Oyun sırasında grup kuralları:</b>\n"
        "• oyunda olmayanların ve ölenlerin mesajları silinir, kendileri <b>2 dakika susturulur</b>;\n"
        "• gece tüm oyuncuların mesajları silinir;\n"
        "• yöneticilerin <code>!</code> ile başlayan mesajları silinmez."
    ),
    "need_admin": (
        "⚠️ <b>Oyunu yönetmek için yönetici yetkilerine ihtiyacım var:</b>\n"
        "• 🗑 mesajları silme;\n"
        "• 🚫 üyeleri kısıtlama (oyunda olmayanları ve ölenleri susturmak için);\n"
        "• 📌 mesaj sabitleme <i>(isteğe bağlı)</i>.\n\n"
        "Grup ayarlarından beni yönetici yapın, ardından /game yazın."
    ),
    "bot_added": (
        "👋 Merhaba! Ben <b>Mafya oyununun sunucusuyum</b>.\n\n"
        "⚠️ <b>Oyunu yönetmek için yönetici yetkilerine ihtiyacım var:</b>\n"
        "• 🗑 mesajları silme;\n"
        "• 🚫 üyeleri kısıtlama;\n"
        "• 📌 mesaj sabitleme <i>(isteğe bağlı)</i>.\n\n"
        "Grup ayarlarından beni yönetici yapın, ardından /game yazın."
    ),
    "bot_promoted": (
        "✅ <b>Teşekkürler! Yönetici yetkileri verildi.</b>\n"
        "Kaydı açmak için /game yazın. Ayarlar: /settingsmafiahiggs\n"
        "<i>Her oyuncu botla özel sohbet başlatmalıdır.</i>"
    ),
    "pay_support": (
        "💳 <b>Ödeme desteği</b>\n\n"
        "Elmaslar Telegram Stars (⭐) ile satılır, ödeme Telegram'ın içinde yapılır.\n"
        "Ödeme onaylandıktan sonra elmaslar bakiyenize hemen eklenir; bir ödeme için elmas yalnızca bir kez verilir.\n"
        "Sorun olursa bot yöneticisine Telegram'daki ödeme mesajını gönderin."
    ),
    "terms": (
        "📄 <b>Koşullar</b>\n\n"
        "• ₸ ücretsiz bir oyun içi para birimidir; gerçek para değildir ve takas edilemez.\n"
        "• 💎 elmas, Telegram Stars ile satın alınan dijital bir oyun ürünüdür.\n"
        "• Satın alınan elmaslar ve eşyalar yalnızca bu botun içinde kullanılır.\n"
        "• Elmasla satılan avantajlar oyun kurallarıyla sınırlıdır (oyun başına bir koruma, bir kurşun vb.).\n"
        "• Kural ihlali veya dolandırıcılık durumunda yönetici hesabı kısıtlayabilir."
    ),
    "lang.choose": "🌐 <b>Bir dil seçin:</b>",
    "lang.set": "✅ Dil değiştirildi: <b>Türkçe</b>.",
    "time.hm": "{h} sa {m} dk",
    "time.m": "{m} dk",

    # --- Kurallar ------------------------------------------------------------------------------
    "rules.tab.general": "📖 Genel",
    "rules.tab.roles": "🎭 Roller",
    "rules.tab.night": "🌙 Gece sırası",
    "rules.tab.items": "🎒 Eşyalar",
    "rules.tab.balance": "⚖️ Denge",
    "rules.general": (
        "📖 <b>Genel kurallar</b>\n\n"
        "• Oyuna <b>{min}–{max}</b> oyuncu katılır.\n"
        "• Roller rastgele dağıtılır ve yalnızca özel sohbette söylenir.\n"
        "• Oyun <b>geceyle</b> başlar: özel roller özel sohbette hareket eder, her eylem grupta ayrı bir mesajla duyurulur (hedef söylenmez).\n"
        "• Sabah kimin öldüğü ve rolü açıklanır.\n"
        "• Gündüz tartışma, ardından özel sohbette oylama yapılır. Her oy grupta duyurulur. En çok oyu alan asılır; eşitlikte kimse asılmaz.\n"
        "• Oyun sırasında oyunda olmayanların ve ölenlerin mesajları silinir, kendileri 2 dakika susturulur; gece tüm oyuncuların mesajları silinir. Yöneticiler mesajın başına <code>!</code> koyarak yazabilir.\n"
        "• Oyundan çıkan (/leave) oyuncu kaybeder.\n\n"
        "<b>Kazanma koşulları</b>\n"
        "🏘 Vatandaşlar — tüm Donlar, mafya üyeleri, Tetikçi ve Seri Katil yok edilince.\n"
        "🤵 Mafya — Don, mafya ve Tetikçi sayısı geri kalanlardan (Koruyucular hariç) az değilse ve Seri Katil hayatta değilse.\n"
        "🪓 Seri Katil — hayatta kalan son iki oyuncudan biri olursa.\n"
        "⚛️ Higgs-Man — oyunun sonunda hayattaysa (kim kazanırsa kazansın), ödül ×2.\n"
        "🤡 İntiharcı — asılırsa; 🔥 Piroman — bombaladıklarının hepsini patlatırsa.\n\n"
        "🏆 <b>Zaferi ve ₸ ödülünü yalnızca oyunun sonuna kadar hayatta kalanlar alır.</b> "
        "<i>İstisna: kendi ölümüyle kazanan İntiharcı ve Piroman.</i>"
    ),
    "rules.roles_title": "🎭 <b>Roller</b>",
    "rules.night": (
        "🌙 <b>Gece eylemlerinin hesaplanma sırası</b>\n\n"
        "1. Tüm gece seçimleri toplanır (aynı anda).\n"
        "2. 💻 Hacker'ın engellediği oyuncunun eylemi gerçekleşmez.\n"
        "3. 🛡 Baş koruyucunun hedefi belirlenir.\n"
        "4. 👨‍⚕️ Doktor iyileştirir — iyileştirilen kişi o gece ne saldırıdan ne de bombadan ölür.\n"
        "5. 🤵 Mafyanın ortak saldırısı (Don'un kararı, yoksa mafyanın oyu).\n"
        "6. 🔪 Tetikçi ve 7. 🪓 Seri Katil saldırır.\n"
        "8. 🕵️ Komiser kontrol eder ya da ateş eder.\n"
        "9. 🍾 Dilenci kimlerin geldiğini öğrenir.\n"
        "10. 🔥 Bombalar konur ya da patlatılır.\n"
        "11. 🧙‍♀️ Cadı saldırganı cezalandırır ya da affeder.\n"
        "12. 💣 Kamikaze katilini de yanında götürür (Doktordan güçlüdür).\n"
        "13. 🐺 Kurt Adamlar taraf değiştirir.\n"
        "14. Ölümler kesinleşir, 15. kazanma koşulları kontrol edilir, 16. sabah haberleri yayınlanır.\n\n"
        "<i>⚛️ Higgs-Man'in alanı ilk 3 saldırıyı üstlenir. Satın alınan 🛡 koruma yalnızca ilk ölümcül saldırıyı durdurur; bombayı, Kamikaze ve Cadının özel etkilerini durdurmaz.</i>"
    ),
    "rules.items_title": "🎒 <b>Eşyalar ve avantajlar</b>",
    "rules.item_line": "{emoji} <b>{name}</b> — {price}\n<i>{desc}</i>\n",
    "rules.role_pick": "🎭 <b>Rol seçimi</b> — {price} 💎\n<i>Bir sonraki oyun için rol seçersiniz. Rol oyuncu sayısına uygunsa verilir; değilse seçiminiz saklanır ya da elmasınızı geri alabilirsiniz.</i>\n",
    "rules.fairness": "⚖️ <b>Adalet:</b> bir oyunda en fazla bir koruma, bir oylama koruması ve bir kurşun kullanılır. Eşyalar yalnızca gerçekten gerektiğinde harcanır.",
    "rules.balance_title": "⚖️ <b>Oyuncu sayısına göre roller</b>\n<i>(kalan yerler — 👨 vatandaşlar)</i>",
    "rules.higgs_rare": "⚛️ <b>Higgs-Man</b> — {min}+ oyunculu oyunlarda her oyunda ≈%{chance} olasılıkla bir vatandaşın yerine çıkar.",
    "rules.rewards": "💰 <b>Zafer ödülü:</b> {rewards}. Aradaki değerler otomatik hesaplanır, ⚛️ Higgs-Man ×2 alır.",

    # --- Eşyalar -------------------------------------------------------------------------------
    "item.shields.name": "Koruma",
    "item.shields.desc": "Oyun başına bir kez ölümcül bir gece saldırısından korur (mafya, Tetikçi, Seri Katil, Komiserin kurşunu). Kullanıldığı kimseye duyurulmaz.",
    "item.fake_docs.name": "Sahte belge",
    "item.fake_docs.desc": "Don, mafya, Piroman ya da Seri Katil iseniz Komiserin ilk kontrolü sizi «Vatandaş» olarak gösterir. Yalnızca bir oyun için geçerlidir.",
    "item.vote_shields.name": "Oylama koruması",
    "item.vote_shields.desc": "Gündüz oylamasında asılmak için seçilirseniz bir kez hayatta kalırsınız. Gece saldırılarından korumaz.",
    "item.piercing_bullets.name": "Zırh delici kurşun",
    "item.piercing_bullets.desc": "Don (mafyanın ortak saldırısı), Tetikçi, Komiser (ateş) ya da Seri Katil iseniz saldırınız hedefin satın alınmış korumasını deler. Yalnızca koruma gerçekten delindiğinde harcanır.",

    # --- Profil, mağaza, sıralama, ödül --------------------------------------------------------
    "profile.title": "👤 <b>Oyuncu profili</b>",
    "profile.player": "🎮 Oyuncu: {name}",
    "profile.id": "🆔 ID: <code>{id}</code>",
    "profile.registered": "📅 Kayıt tarihi: {date}",
    "profile.stats": "📊 <b>İstatistik</b>",
    "profile.games": "Oyunlar: <b>{n}</b>",
    "profile.wins": "Galibiyetler: <b>{n}</b>",
    "profile.losses": "Yenilgiler: <b>{n}</b>",
    "profile.rate": "Kazanma oranı: <b>{rate}</b>",
    "profile.rank": "Sıralamadaki yeri: <b>{rank}</b>",
    "profile.recent": "🕹 <b>Son oyunlar</b>",
    "profile.recent_line": "{mark} {role} — {count} oyuncu{reward}",
    "profile.reward": ", <b>+{reward} ₸</b>",
    "profile.balance": "💰 <b>Bakiye</b>",
    "profile.tenge": "₸: <b>{n}</b>",
    "profile.diamonds": "💎 Elmas: <b>{n}</b>",
    "profile.items": "🎒 <b>Eşyalar</b>",
    "profile.shields": "🛡 Koruma: <b>{n}</b>",
    "profile.fake_docs": "📄 Sahte belge: <b>{n}</b>",
    "profile.premium": "💎 <b>Premium avantajlar</b>",
    "profile.vote_shields": "⚖️ Oylama koruması: <b>{n}</b>",
    "profile.bullets": "💥 Zırh delici kurşun: <b>{n}</b>",
    "profile.next_role": "🎭 Bir sonraki oyunun rolü: <b>{role}</b>{more}",
    "profile.queue_more": " <i>(sırada {n} tane daha)</i>",
    "profile.next_none": "🎭 Bir sonraki oyunun rolü: <i>seçilmedi</i>",
    "shop.title": "🛍 <b>Mağaza</b>",
    "shop.balance": "Bakiyeniz: <b>{tenge} ₸</b> · <b>{diamonds} 💎</b>",
    "shop.footer": "<i>Eşyalar profilinizde saklanır ve sonraki oyunlarda kendiliğinden kullanılır.</i>",
    "shop.bought": "✅ {emoji} <b>{name}</b> satın alındı! Sizde: <b>{count}</b>. Kalan bakiye: <b>{balance} {currency}</b>",
    "shop.no_funds": "Yetersiz bakiye: {price} gerekli, sizde {balance} {currency} var.",
    "shop.unknown": "Bilinmeyen eşya.",
    "shop.ok_alert": "✅ Satın alındı!",
    "dia.title": "💎 <b>Elmas satın al</b>",
    "dia.intro": "Paket büyüdükçe elmas başına fiyat düşer.\nÖdeme <b>Telegram Stars (⭐)</b> ile güvenle yapılır.",
    "dia.line": "• <b>{diamonds} 💎</b> — {price} ₸ <i>({per} ₸/💎)</i> · {stars} ⭐",
    "rp.title": "🎭 <b>Bir sonraki oyun için rol seç</b>",
    "rp.intro": "Fiyat: <b>{price} 💎</b>. Rol, oyuncu sayısı yeterli olan oyunda verilir. Bir oyunda bir seçim kullanılır, diğerleri sırada bekler.",
    "rp.line": "{role} — <i>{min}+ oyuncu</i>",
    "rp.higgs_note": "{role} — <i>satılmaz, oyunda nadiren ve rastgele çıkar.</i>",
    "rp.queue": "📋 <b>Sıranız:</b> {roles}",
    "rp.not_buyable": "Bu rol satın alınamaz.",
    "rp.no_funds": "Yeterli elmas yok (sizde {balance} 💎). «💎 Elmas satın al» bölümünü açın.",
    "rp.limit": "Sırada en fazla {limit} rol olabilir.",
    "rp.failed": "Satın alma başarısız oldu.",
    "rp.ok_alert": "✅ Rol sıraya eklendi!",
    "rp.saved": "✅ {role} rolü {position} kaydedildi. Kalan bakiye: <b>{balance} 💎</b>",
    "rp.next_game": "bir sonraki oyun için",
    "rp.position": "sırada {n}. olarak",
    "rq.button": "📋 Sıram",
    "rq.empty": "📋 Sıranız boş. Bir sonraki oyun için rol seçilmedi.",
    "rq.title": "📋 <b>Rol sırası</b> (ilki bir sonraki oyun için):",
    "rq.refund_btn": "❌ {role} — 💎 iade",
    "rr.in_game": "Oyun ya da kayıt sırasında rol iade edilemez.",
    "rr.gone": "Bu seçim zaten kullanıldı ya da iade edildi.",
    "rr.done": "💎 {n} elmas iade edildi.",
    "rating.title": "🏆 <b>En iyi oyuncular</b>",
    "rating.empty": "<i>Henüz kimse oynamadı.</i>",
    "rating.line": "{medal} {name} — <b>{wins}</b> galibiyet / {games} oyun (%{rate})",
    "rating.me": "Sizin yeriniz: <b>{rank}</b>",
    "daily.ok": "🎁 {day}. günün ödülü: <b>+{reward} ₸</b>!",
    "daily.balance": "Bakiyeniz: <b>{n} ₸</b>",
    "daily.tomorrow": "<i>Yarın yine gelin!</i>",
    "daily.wait": "⏳ Bugünkü ödülü zaten aldınız. Bir sonraki ödüle: <b>{time}</b>.",

    # --- Katılma, odalar, grup -----------------------------------------------------------------
    "join.list": "🎮 <b>Açık oyunlar:</b>",
    "join.none": "Şu an üye olduğunuz gruplarda açık kayıt yok.\nYeni oyun başlatmak için grupta /game yazın.",
    "join.not_member": "❌ Bu oyuna yalnızca o grubun üyeleri katılabilir.",
    "room.text": "🏠 <b>Oyun odası aç</b>\n\nOyun grup sohbetinde oynanır. Beni bir gruba ekleyin, yönetici yapın ve orada /game yazın — ya da aşağıdan botun bulunduğu bir grubu seçin.",
    "room.add_btn": "➕ Botu gruba ekle",
    "room.add_new_btn": "➕ Botu yeni bir gruba ekle",
    "room.not_member": "Bu grubun üyesi değilsiniz.",
    "room.no_rights": "Botun bu grupta yönetici yetkisi yok.",
    "room.opened_alert": "✅ Kayıt açıldı!",
    "room.opened": "✅ «{chat}» grubunda kayıt açıldı.",
    "group.admins_only": "⛔️ Bu sohbette oyunu yalnızca yöneticiler açıp başlatabilir.",
    "group.no_lobby": "Açık kayıt yok.",
    "group.stop_denied": "Oyunu yalnızca grup yöneticileri durdurabilir.",
    "group.no_game": "Bu sohbette oyun yok.",
    "group.not_in_game": "Bu sohbetteki oyuna katılmıyorsunuz.",
    "group.open_bot_btn": "🤖 Botu aç",

    # --- Sohbet ayarları -----------------------------------------------------------------------
    "settings.title": "⚙️ <b>Mafya ayarları</b> — «{chat}»",
    "settings.reg": "⏱ Kayıt süresi: <b>{seconds} sn</b>",
    "settings.start": "▶️ Oyunu açıp başlatabilenler: <b>{mode}</b>",
    "settings.start.all": "👥 Herkes",
    "settings.start.admins": "👑 Yalnızca yöneticiler",
    "settings.lang": "🌐 Dil: <b>{lang}</b>",
    "settings.note": "<i>Aşağıdaki düğmelerle değiştirin. Değişiklikler bir sonraki oyundan itibaren geçerlidir.</i>",
    "settings.admins_only": "Ayarları yalnızca sohbet yöneticileri değiştirebilir.",
    "settings.saved": "✅ Kaydedildi",
    "settings.close_btn": "✖️ Kapat",
    "settings.closed": "⚙️ Ayarlar kaydedildi.",
    "settings.sec": "{n} sn",

    # --- Ödeme ---------------------------------------------------------------------------------
    "pay.title": "{n} 💎 elmas",
    "pay.desc": "Mafya botunda {n} elmas (≈ {price} ₸). Ödeme onaylanınca hemen bakiyenize eklenir.",
    "pay.label": "{n} elmas",
    "pay.unknown_package": "Bilinmeyen paket.",
    "pay.bad_package": "Bu paket artık mevcut değil. Lütfen menüden yeniden seçin.",
    "pay.unknown": "⚠️ Ödeme alındı ama paket bulunamadı. /paysupport üzerinden bize yazın.",
    "pay.dup": "ℹ️ Bu ödeme zaten kaydedildi, elmaslar bakiyenizde.",
    "pay.ok": "✅ <b>Ödeme onaylandı! +{n} 💎</b>\nElmas bakiyeniz: <b>{balance} 💎</b>",

    # --- Komut açıklamaları --------------------------------------------------------------------
    "cmd.start": "Ana menü",
    "cmd.profile": "Profilim",
    "cmd.shop": "Mağaza",
    "cmd.daily": "Günlük ödül",
    "cmd.rating": "Sıralama",
    "cmd.rules": "Kurallar",
    "cmd.language": "Dili değiştir",
    "cmd.help": "Yardım",
    "cmd.paysupport": "Ödeme desteği",
    "cmd.terms": "Koşullar",
    "cmd.game": "Yeni oyun için kaydı aç",
    "cmd.startgame": "Oyunu hemen başlat",
    "cmd.extend": "Kaydı 30 saniye uzat",
    "cmd.leave": "Oyundan çık",
    "cmd.stop": "Oyunu durdur (yönetici)",
    "cmd.settingsmafiahiggs": "Bot ayarları (yönetici)",
}
