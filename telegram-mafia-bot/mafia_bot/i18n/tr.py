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
    "role.kamikaze.desc": "Amacınız hayatta kalmak değil. Gece vurulursanız hiçbir koruma işe yaramaz: sizi vuran sizinle birlikte ölür. Asılırsanız bir oyuncu seçip yanınızda götürürsünüz. Kazanırsınız: Komiser dışında biri sizi vurursa ya da bir mafyayı, Don'u, Tetikçiyi, Koruyucuyu, Manyağı veya Piromanı götürürseniz. Kaybedersiniz: Komiser sizi vurursa ya da Komiseri veya bir vatandaşı götürürseniz.",
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
    "role.sleepless": "Balım jalep",
    "role.sleepless.desc": "Vatandaştan bile kötü. Amaç: gece uyumadan «Em» düğmesine durmadan basmak. 10 kezden az basarsanız otomatik olarak kaybedersiniz.",
    "role.was": "{role} <i>(önceden {old})</i>",

    "faction.town": "Vatandaşlar",
    "faction.mafia": "Mafya",
    "faction.solo": "Bağımsızlar",

    # --- Gece eylem düğmeleri ------------------------------------------------------------------
    "action.mk": "Kurban seç",
    "action.kk": "Öldür",
    "action.mn": "Öldür",
    "action.ck": "Kontrol et",
    "action.sh": "Ateş et",
    "action.hl": "İyileştir",
    "action.bl": "Engelle",
    "action.pr": "Koru",
    "action.vs": "Ziyaret et",
    "action.bm": "Bomba koy",
    "action.dt": "Patlat",
    "action.aw": "Em",
    "action.sk": "Geç",

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
    "cause.desert": "kendi isteğiyle oyundan çıktı",
    "cause.afk": "hareketsizlik nedeniyle çıkarıldı",
    "cause.sleepless": "mafya öldürdü",

    # --- Rol mesajı ----------------------------------------------------------------------------
    "intro.role": "Rolünüz - <b>{role}</b>",
    "intro.allies": "Müttefikleriniz:",
    "intro.team_chat": "Bota yazdıklarınızı müttefikleriniz görür.",
    "intro.head_defender": "Baş koruyucu: {name}",
    "intro.higgs": "Higgs alanı: {armor} gece kurşunundan ve bir kez darağacından korur.",
    "intro.items": "Eşyalarınız: {items}",

    # --- Gece ----------------------------------------------------------------------------------
    "night.title": "<b>{day}. gece</b>",
    "night.body": "Kasaba uyudu. Özel roller botla özel sohbette hareket eder.",
    "night.alive": "Hayattaki oyuncular:",
    "night.roles": "Aralarında: {roles}",
    "night.total": "Toplam: {count}",
    "prompt.don": "Mafya oy veriyor:",
    "prompt.mafia": "Mafya oy veriyor:",
    "prompt.killer": "Kimi öldüreceksiniz?",
    "prompt.maniac": "Kimi öldüreceksiniz?",
    "prompt.commissioner": "Kontrol mü, ateş mi?",
    "prompt.commissioner_first": "Kimi kontrol edeceksiniz?",
    "prompt.doctor": "Kimi iyileştireceksiniz?",
    "prompt.hacker": "Kimin telefonunu hackleyeceksiniz?",
    "prompt.defender": "Kimi koruyacaksınız?",
    "prompt.beggar": "Kime gideceksiniz?",
    "prompt.pyro": "Kime bomba koyacaksınız?",
    "prompt.pyro_bombed": "Bomba konulanlar: {names}",
    "prompt.pyro_ready": "Artık hepsini patlatabilirsiniz (siz de ölürsünüz).",
    "prompt.none": "Bu gece hamleniz yok.",
    "prompt.sleepless": "«Emmek» düğmesine en az {need} kez basın, yoksa ölürsünüz.",
    "awake.progress": "Basıldı: {count}/{need}",
    "awake.done": "Aferin, bu gece hayatta kaldınız.",
    "submit.not_night": "Şu an gece değil.",
    "submit.not_alive": "Bu oyunda hayattaki bir oyuncu değilsiniz.",
    "submit.already": "Bu gece seçiminizi zaten yaptınız.",
    "submit.unavailable": "Bu eylem size açık değil.",
    "submit.bad_target": "Bu oyuncuyu seçemezsiniz.",
    "submit.skip": "Bu gece bir şey yapmıyorsunuz.",
    "submit.detonate": "Şafakta bombalar patlayacak.",
    "submit.ok": "Seçiminiz: {target}",

    "announce.don": "Don kurbanını seçti...",
    "announce.mafia": "Bir mafya üyesi oy verdi...",
    "announce.killer": "Tetikçi hedefini seçti...",
    "announce.maniac": "Seri Katil sokağa çıktı...",
    "announce.check": "Komiser soruşturma yürütüyor...",
    "announce.shoot": "Komiser silahını kaldırdı...",
    "announce.heal": "Doktor nöbete çıktı...",
    "announce.block": "Hacker birinin telefonunu hackliyor...",
    "announce.protect": "Koruyucular birini korumaya aldı...",
    "announce.visit": "Dilenci birinin kapısını çaldı...",
    "announce.bomb": "Piroman bomba yerleştiriyor...",
    "announce.detonate": "Piroman fünyeyi eline aldı...",
    "announce.sleepless": "Balım jalep emmeye hazırlanıyor...",

    "night.hacked": "Gece bir hacker telefonunuzu hackledi — <b>eyleminiz gerçekleşmedi.</b>",
    "night.team_choice": "{name}: seçti {target}",
    "night.check_result": "<b>Kontrol sonucu:</b> {target} — <b>{role}</b>",
    "night.sergeant_relay": "<b>Komiserden mesaj:</b>\n{text}",
    "night.bomb_planted": "{target} adlı oyuncunun evine bomba konuldu.",
    "night.shield_saved": "Gece size saldırıldı ama <b>korumanız sizi kurtardı!</b>",
    "night.bullet_pierced": "<b>Kurşununuz hedefin korumasını deldi!</b>",
    "night.higgs_absorbed": "Vuruldunuz ama <b>Higgs alanı sizi kurtardı!</b> Kalan koruma: <b>{left}</b>",
    "night.witch_punished": "Saldırganı lanetle cezalandırdınız.",
    "night.witch_forgave": "Saldırganı affettiniz.",
    "night.you_died": "<b>Öldünüz</b> <i>({cause})</i>.",
    "night.beggar_nobody": "kimse gelmedi",
    "night.beggar_info": "Gece {target} adlı oyuncunun evine gelenler: <b>{names}</b>.",
    "night.checked_you": "{role} gece <b>sizi sorguladı</b>.",
    "night.healed_you": "{role} gece size uğrayıp <b>sizi tedavi etti</b>.",
    "night.healed_saved": "Gece size saldırıldı ama {role} <b>hayatınızı kurtardı!</b>",
    "night.doctor_saved": "{target} bu gece iyileştirildi! Misafirler: {roles}",
    "night.doctor_idle": "{target} iyileştirmeye ihtiyaç duymadı.",
    "night.hacked_idle": "{role} gece <b>telefonunuzu hackledi</b>.",
    "night.protected_you": "{role} gece <b>sizi korudu</b>.",
    "night.visited_you": "{role} gece kapınızı çalıp <b>bir şişe istedi</b>.",
    "night.bombed_you": "{role} gece <b>kapınızın önüne bomba koydu!</b>",
    "night.wolf_mafia": "Mafya size saldırdı. Artık siz <b>{role}</b> oldunuz.\nMüttefikler: {team}",
    "night.wolf_sergeant": "Komiser sizi vurdu. Artık siz <b>{role}</b> oldunuz.\nMüttefikler: {team}",
    "night.wolf_joined_mafia": "{name} mafyaya katıldı!",
    "night.wolf_joined_police": "{name} çavuş olarak katıldı!",
    "promo.new_don": "Don öldü. <b>Artık yeni Don sizsiniz!</b>",
    "promo.new_don_team": "Yeni Don: {name}",
    "promo.new_com": "Komiser öldü. <b>Artık yeni Komiser sizsiniz!</b>",
    "promo.new_com_team": "Yeni Komiser: {name}",
    "promo.new_head": "Baş koruyucu öldü. <b>Bir sonraki geceden itibaren hedefi siz seçeceksiniz.</b>",
    "witch.prompt": "Gece size {names} saldırdı! <b>Büyünüz sizi kurtardı.</b>\nSaldırganı ne yapacaksınız?",
    "witch.punish": "Cezalandır",
    "witch.forgive": "Affet",
    "witch.timeout": "Süre doldu — affettiniz.",
    "witch.ok_punish": "Saldırgan cezalandırılacak.",
    "witch.ok_forgive": "Affettiniz.",
    "kamikaze.prompt": "Yanınızda kimi götüreceksiniz?",
    "kamikaze.ok": "Seçiminiz: {target}",
    "kamikaze.timeout": "Süre doldu.",
    "kamikaze.took": "Kamikaze yanında {name} - {role} götürdü.",
    "kamikaze.none": "Kamikaze kimseyi götürmedi.",

    # --- Sabah ---------------------------------------------------------------------------------
    "morning.title": "<b>{day}. gün</b>",
    "morning.dead": "Gece öldürülenler:",
    "morning.dead_line": "{name} — {role} ({cause})",
    "morning.nobody": "Gece kimse ölmedi.",
    "morning.saved": "Doktor birini kurtardı.",
    "morning.explosion": "Gece kasabada bir patlama oldu.",
    "morning.witch": "Birinin evinde büyü parladı.",
    "morning.sleepless": "Mafya Balım jalep'i düzgün emmediği için öldürdü",
    "morning.wolf_mafia": "Kurt Adam mafyaya dönüştü",
    "morning.wolf_sergeant": "Kurt Adam çavuşa dönüştü",
    "morning.pyro_won": "Piroman tüm hedeflerini patlattı ve kazandı!",
    "morning.pyro_failed": "Piroman tüm hedeflerini yok edemedi.",

    # --- Gündüz ve oylama ----------------------------------------------------------------------
    "day.text": "Tartışma süresi: {seconds} saniye.",
    "vote.start": "Suçluları bulup cezalandırma vakti geldi.\nOylama {seconds} saniye sürecek.",
    "vote.prompt": "Kim asılsın?",
    "vote.abstain_btn": "Çekimser kal",
    "vote.cast": "{voter} oy verdi: {target}",
    "vote.cast_abstain": "{voter} çekimser kaldı",
    "vote.not_now": "Şu an oylama yapılmıyor.",
    "vote.not_alive": "Yalnızca hayattaki oyuncular oy verebilir.",
    "vote.already": "Zaten oy verdiniz.",
    "vote.bad_target": "Bu oyuncuya oy veremezsiniz.",
    "vote.ok_abstain": "Çekimser kaldınız.",
    "vote.ok": "{target} için oy verdiniz.",
    "vote.no_votes": "Kimse oy vermedi. Bugün kimse asılmayacak.",
    "vote.tie": "Oylar eşit. Bugün kimse asılmayacak.",
    "vote.saved": "{name} hayatta kaldı.",
    "vote.lynched": "{name} gündüz toplantısında asıldı!\nRolü {role} idi.",
    "vote.suicide_won": "{name} gündüz toplantısında asıldı!\nRolü {role} idi. Kazandı!",
    "vote.higgs_saved": "Higgs alanı sizi idamdan kurtardı. Bu koruma artık yok.",
    "vote.vote_shield_used": "Oylama korumanız sizi kurtardı.",
    "vote.you_lynched": "Asıldınız.",
    "confirm.ask": "{name} asılsın mı?\nSüre: {seconds} saniye.",
    "confirm.closed": "Oylama sonuçları:\n{yes} 👍  |  {no} 👎",
    "confirm.stopped": "Onay durduruldu.",
    "confirm.not_now": "Şu anda onay oylaması yok.",
    "confirm.not_alive": "Yalnızca bu oyunda hayatta olan oyuncular oy verebilir.",
    "confirm.self": "Kendi kaderin için oy veremezsin.",
    "confirm.ok_yes": "Oyunuz: 👍",
    "confirm.ok_no": "Oyunuz: 👎",
    "confirm.spared": "{name} hayatta kaldı.",
    "confirm.gone": "{name} oyundan çıktı. Bugün kimse asılmayacak.",
    "desert.public": "{name} oyundan çıktı. Rolü {role} idi.",
    "afk.public": "{name}, {nights} gece hareketsiz kaldığı için oyundan çıkarıldı. Rolü {role} idi.",
    "afk.dm": "Art arda {nights} gece hiçbir şey yapmadınız, bu yüzden oyundan çıkarıldınız.",

    # --- Oyun sonu -----------------------------------------------------------------------------
    "result.nobody_alive": "Kimse hayatta kalmadı. Berabere.",
    "result.won": "{side} kazandı.",
    "result.draw_long": "Oyun çok uzadı. Berabere.",
    "final.title": "<b>Oyun bitti!</b> {label}",
    "final.winners": "Kazananlar:",
    "final.losers": "Diğer oyuncular:",
    "final.line": "    {n}. {name} - {role}",
    "final.duration": "Oyun süresi: {minutes} dakika",

    # --- Kayıt ve oyun akışı -------------------------------------------------------------------
    "lobby.title": "{chat} sohbetinde mafya oyunu kaydı açık.",
    "lobby.time": "Oyunun başlamasına {seconds} saniye kaldı.",
    "lobby.players": "Kayıtlılar: {names}",
    "lobby.count": "Toplam: {count}",
    "lobby.join_btn": "Katıl",
    "lobby.busy": "Bu sohbette zaten bir oyun ya da kayıt sürüyor.",
    "lobby.closed_join": "Bu oyunun kaydı kapandı.",
    "lobby.already_joined": "«{chat}» sohbetindeki oyuna zaten kayıtlısınız.",
    "lobby.other_game": "Başka bir oyuna kayıtlısınız ya da oynuyorsunuz.",
    "lobby.full": "Oda dolu ({max} oyuncu).",
    "lobby.retry": "Kayıt yapılamadı, lütfen tekrar deneyin.",
    "lobby.joined": "«{chat}» sohbetindeki oyuna kaydoldunuz ({count}/{max}). Rolünüz buraya gelecek.",
    "lobby.left": "Kayıttan çıktınız.",
    "lobby.not_in_game": "Hiçbir oyunda değilsiniz.",
    "lobby.not_alive": "Bu oyunda hayattaki bir oyuncu değilsiniz.",
    "lobby.deserted": "Oyundan çıktınız. Bu oyun yenilgi sayılır.",
    "lobby.extended": "Kayıt {seconds} saniye uzatıldı.",
    "lobby.no_open": "Açık kayıt yok. Yeni oyun için /game yazın.",
    "lobby.need_min": "Oyunu başlatmak için en az {min} oyuncu gerekir (şu an {count}).",
    "lobby.reminder": "Kayda {seconds} saniye kaldı!",
    "lobby.not_enough": "Yeterli oyuncu yok ({count}/{min}). Kayıt kapandı.",
    "lobby.error": "Oyun başlatılırken bir hata oluştu. Kayıt kapandı.",
    "lobby.closed": "Kayıt kapandı.",
    "lobby.done": "Kayıt bitti. Oyuncular: {count}.",
    "game.purchased_role": "<b>Satın aldığınız rol size verildi!</b>",
    "game.unfulfilled": "Seçtiğiniz {role} rolü bu oyunda verilmedi ({count} oyuncu için uygun değil ya da başka bir oyuncu daha önce satın aldı).\nSeçiminiz bir sonraki oyun için saklandı. İsterseniz elmasınızı geri alabilirsiniz.",
    "game.refund_btn": "Elması iade et",
    "game.started": "<b>Oyun başladı!</b> Roller özel sohbetten gönderildi.",
    "game.higgs_arrived": "Higgs-Man geri döndü, şimdi herkesi parçalayacak...",
    "game.dm_failed": "Bot bu oyunculara yazamadı — botta /start'a basın: {names}",
    "game.bot_btn": "Bota git",
    "game.vote_btn": "Oy ver",
    "game.night_over": "Gece bitti.",
    "game.vote_over": "Oylama bitti.",
    "game.stale": "Bu seçimin süresi geçti.",
    "game.stale_vote": "Bu oylamanın süresi geçti.",
    "game.stale_witch": "Bu kararın süresi geçti.",
    "game.unknown_action": "Bilinmeyen eylem.",
    "game.back": "Geri",
    "game.mode": "{action}: <b>bir oyuncu seçin.</b>",
    "game.last_words_prompt": "Son sözünüzü yazın — gruba gönderilecek.",
    "game.last_words_sent": "Son sözleriniz gönderildi.",
    "game.last_words": "Son söz — {name}:\n<blockquote>{text}</blockquote>",
    "game.team_msg": "{name}: {text}",
    "end.lose": "Oyun bitti!",
    "end.win": "Kazandınız!\nÖdül 💵 {reward}, 💎 0 !",
    "end.card": "👤 {name}\n🆔 ID: <code>{id}</code>\n💵 Para: {tenge}\n💎 Elmas: {diamonds}\n🎒 Eşyalar: 🛡 {shields} · ⚖️ {vote_shields} · 💥 {bullets} · 📄 {fake_docs}\n🎭 Sonraki rol: {next_role}\n🏆 Galibiyetler: {wins}\n🎲 Tüm oyunlar: {games}",
    "game.stopped": "Oyun durduruldu.",
    "game.stopped_admin": "Oyunu bir yönetici durdurdu.",
    "game.error": "Beklenmeyen bir hata oluştu, oyun durduruldu.",
    "game.shutdown": "Bot durduruldu, oyun durduruldu.",
    "game.restarted": "Bot yeniden başlatıldı, önceki oyun durduruldu. Yeni oyun: /game",
    "game.removed": "Bot gruptan çıkarıldı.",
    "game.migrated": "Grup süper gruba dönüştü, oyunu yeniden başlatın: /game",

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
        "/give 5 — bir oyuncuya elmas hediye et (mesajına yanıt olarak)\n"
        "/give 3 — yanıtsız yazarsanız: 🎁 elmas dağıtımı, ilk 3 kişi 1'er 💎 alır\n"
        "/stop — oyunu durdur <i>(yöneticiler)</i>\n"
        "/settingsmafia — kayıt süresi, kimin başlatabileceği, dil <i>(yöneticiler)</i>\n"
        "/topmafia — haftanın en iyi oyuncuları <i>(yöneticiler)</i>\n\n"
        "<b>Özel sohbette:</b>\n"
        "/profile — profil · /shop — mağaza · /daily — günlük ödül\n"
        "/rating — sıralama · /rules — kurallar · /language — dil\n"
        "/exchange — 💎 elmasları ₸ ile değiştir\n"
        "/paysupport — ödeme desteği\n\n"
        "<b>Oyun nasıl işler:</b>\n"
        "1. Grupta /game yazılır, oyuncular «🎮 Oyuna katıl» düğmesine basar.\n"
        "2. En az 4 oyuncu toplanınca oyun başlar (en fazla 50).\n"
        "3. Rolünüz bu özel sohbete gelir — <b>kimseye göstermeyin!</b>\n"
        "4. Gece rolünüzün eylemini burada seçersiniz. <i>Art arda 3 gece hiçbir şeye basmazsanız oyundan çıkarılırsınız.</i>\n"
        "5. Gündüz grupta tartışır, oyunuzu burada verirsiniz; ardından grup kararı 👍/👎 ile onaylar.\n\n"
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
        "Kaydı açmak için /game yazın. Ayarlar: /settingsmafia\n"
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
        "• Gündüz tartışma, ardından özel sohbette oylama yapılır. Her oy grupta duyurulur. En çok oyu alan oyuncu için grupta 👍/👎 onayı yapılır: yalnızca 👍 sayısı 👎 sayısından fazlaysa asılır. Eşitlikte kimse asılmaz.\n"
        "• Oyun sırasında oyunda olmayanların ve ölenlerin mesajları silinir, kendileri 2 dakika susturulur; gece tüm oyuncuların mesajları silinir. Yöneticiler mesajın başına <code>!</code> koyarak yazabilir.\n"
        "• Oyundan çıkan (/leave) oyuncunun rolü açıklanır ve kaybeder. Art arda 3 gece hiçbir eylem yapmayan oyuncu (AFK) da oyundan çıkarılır.\n\n"
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
    "rules.role_pick": "🎭 <b>Rol seçimi</b> — {price} 💎, güçlü roller ({roles}) — {premium} 💎\n<i>Bir sonraki oyun için rol seçersiniz. Rol oyuncu sayısına uygunsa verilir; değilse seçiminiz saklanır ya da elmaslarınızı geri alabilirsiniz. ⚛️ Higgs-Man satılmaz.</i>\n",
    "rules.exchange": "💱 <b>Değişim</b> — 1 💎 = {rate} ₸ <i>(yalnızca 💎 → ₸; /exchange)</i>\n",
    "rules.fairness": "⚖️ <b>Adalet:</b> bir oyunda en fazla bir koruma, bir oylama koruması ve bir kurşun kullanılır. Eşyalar yalnızca gerçekten gerektiğinde harcanır.",
    "rules.balance_title": "⚖️ <b>Oyuncu sayısına göre roller</b>\n<i>(kalan yerler — 👨 vatandaşlar)</i>",
    "rules.higgs_rare": "⚛️ <b>Higgs-Man</b> — {min}+ oyunculu oyunlarda her oyunda ≈%{chance} olasılıkla bir vatandaşın yerine çıkar.",
    "rules.sleepless_rare": "<b>Balım jalep</b> — {min}+ oyunculu her oyunda mutlaka bir vatandaşın yerine çıkar.",
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
    "rp.intro": "Fiyat: <b>{price} 💎</b>; güçlü roller ({roles}) — <b>{premium} 💎</b>. Rol, oyuncu sayısı yeterli olan oyunda verilir. Bir oyunda bir seçim kullanılır, diğerleri sırada bekler.",
    "rp.line": "{role} — <b>{price} 💎</b> · <i>{min}+ oyuncu</i>",
    "rp.higgs_note": "{role} — <i>satılmaz, oyunda nadiren ve rastgele çıkar.</i>",
    "rp.higgs_admin": "{role} — <b>{price} 💎</b> · <i>sadece bot yöneticisine: sonraki oyunda bir vatandaşın (yoksa {beggar} rolünün) yerine çıkar.</i>",
    "rp.queue": "📋 <b>Sıranız:</b> {roles}",
    "rp.not_buyable": "Bu rol satın alınamaz.",
    "rp.no_funds": "Yeterli elmas yok: bu rol {price} 💎, sizde {balance} 💎. «💎 Elmas satın al» bölümünü açın.",
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
    "top.title": "🏆 <b>Haftanın en iyileri</b> · {chat}\n<i>Bu sohbetin son 7 gündeki oyunlarına göre</i>",
    "top.line": "{medal} {name} — <b>{wins}</b> galibiyet · {games} oyun · +{earned} ₸",
    "top.empty": "<i>Son 7 günde bu sohbette biten oyun olmadı.</i>",
    "top.admins_only": "⛔️ /topmafia komutu yalnızca sohbet yöneticileri içindir.",
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
    "give.usage": "💎 <b>Elmas hediye et</b>\n• Bir oyuncunun mesajına <code>/give 5</code> ile yanıt verin ya da <code>/give @username 5</code> yazın — o oyuncu 5 💎 alır.\n• Grupta sadece <code>/give 3</code> yazın — 🎁 elmas dağıtımı: «Hediyeyi aç» düğmesine ilk basan 3 kişi 1'er 💎 alır.",
    "give.bad_amount": "❌ Geçerli bir elmas sayısı yazın: 1 ile {max} arası.",
    "give.unknown": "❌ {name} bulunamadı. Önce botta /start komutuna basması gerekir ya da mesajına yanıt olarak yazın.",
    "give.self": "❌ Kendinize elmas veremezsiniz.",
    "give.bot": "❌ Bir bota elmas verilemez.",
    "give.no_funds": "❌ Yeterli elmas yok: sizde <b>{balance} 💎</b> var.",
    "give.ok": "💎 {giver}, {receiver} adlı oyuncuya <b>{n} elmas</b> hediye etti!",
    "give.left": "Kalan bakiyeniz: <b>{balance} 💎</b>",
    "give.dm": "🎁 {giver} size <b>{n} 💎</b> hediye etti! Bakiyeniz: <b>{balance} 💎</b>",
    "giveaway.open": "🎁 {giver} <b>{n} elmas</b> dağıtıyor — kapan alır!\nHerkes <b>1 💎</b> alır · Kalan: <b>{left}/{n}</b>",
    "giveaway.done": "🎁 {giver} tarafından dağıtılan <b>{n} elmasın</b> hepsi alındı!",
    "giveaway.expired": "⌛ {giver} tarafından dağıtılan {n} 💎 süresi doldu: alınmayan <b>{left} 💎</b> sahibine iade edildi.",
    "giveaway.cancelled": "🎁 {giver} tarafından dağıtılan {n} 💎 kapatıldı — yönetici tüm elmasları sıfırladı.",
    "giveaway.claimers": "✅ Alanlar ({count}): {names}",
    "giveaway.btn": "🎁 Hediyeyi aç",
    "giveaway.ok": "🎉 1 💎 aldınız! Bakiyeniz: {balance} 💎",
    "giveaway.own": "Kendi hediyenizi alamazsınız 🙂",
    "giveaway.again": "Bu hediyeden zaten aldınız.",
    "giveaway.gone": "Üzgünüz, hediye bitti.",
    "ex.title": "💱 <b>Elmasları ₸ ile değiştir</b>\nKur: <b>1 💎 = {rate} ₸</b>\nSizde: <b>{diamonds} 💎</b> · <b>{tenge} ₸</b>\n\nKaç elmas değiştirmek istiyorsunuz? Bir düğmeye basın ya da <code>/exchange 3</code> yazın.\n<i>Ters yönde değişim (₸ → 💎) yoktur.</i>",
    "ex.btn": "{n} 💎 → {tenge} ₸",
    "ex.all_btn": "Tümü: {n} 💎 → {tenge} ₸",
    "ex.ok": "✅ <b>{n} 💎</b> → <b>{tenge} ₸</b> değiştirildi.\nBakiyeniz: <b>{diamonds} 💎</b> · <b>{balance} ₸</b>",
    "ex.no_funds": "Yeterli elmas yok: sizde {diamonds} 💎 var.",
    "ex.usage": "Kullanım: <code>/exchange 3</code> — 3 💎 değiştirir (1 💎 = {rate} ₸). Miktar: 1 ile {max} arası.",
    "ex.shop_btn": "💱 Elmasları ₸ ile değiştir (1 💎 = {rate} ₸)",
    "cmd.start": "Ana menü",
    "cmd.profile": "Profilim",
    "cmd.shop": "Mağaza",
    "cmd.exchange": "Elmasları ₸ ile değiştir",
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
    "cmd.give": "Bir oyuncuya elmas hediye et",
    "cmd.stop": "Oyunu durdur (yönetici)",
    "cmd.settingsmafia": "Bot ayarları (yönetici)",
    "cmd.topmafia": "Haftanın en iyi oyuncuları (yönetici)",
}
