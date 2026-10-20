"""English."""

MESSAGES: dict[str, str] = {
    # --- Roles ---------------------------------------------------------------------------------
    "role.civilian": "Civilian",
    "role.civilian.desc": "You have no night action. During the day, join the discussion, help find the mafia and vote for the right person.",
    "role.don": "Don",
    "role.don.desc": "The head of the mafia. At night you choose the mafia's shared victim: mafia members vote, but the final decision is yours.",
    "role.mafia": "Mafioso",
    "role.mafia.desc": "At night you choose a victim together with the Don. If the Don makes no choice, the mafia vote decides. If the Don dies, one of the mafiosi becomes the new Don.",
    "role.killer": "Killer",
    "role.killer.desc": "The mafia's hired assassin. You know the mafia and every night you can kill one player on your own, separately from the mafia.",
    "role.defender": "Defender",
    "role.defender.desc": "You are on the mafia's side but don't know the mafia. At night the head defender protects one player: if they are the Don or a mafioso, the Commissioner sees them as a «Civilian», and if they are lynched the next day, they survive.",
    "role.commissioner": "Commissioner",
    "role.commissioner.desc": "Every night you check one player (learn their role) or shoot. On the first night you can only check. Sergeants learn your check results.",
    "role.sergeant": "Sergeant",
    "role.sergeant.desc": "The Commissioner's assistant. You know the Commissioner and receive their check results. If the Commissioner dies, you become the new Commissioner.",
    "role.doctor": "Doctor",
    "role.doctor.desc": "Every night you heal one player — they won't die that night. You can't heal the same person two nights in a row, and you can heal yourself only once per game.",
    "role.hacker": "Hacker",
    "role.hacker.desc": "At night you hack one player's phone — their night action fails. You can't block the same person two nights in a row.",
    "role.beggar": "Beggar",
    "role.beggar.desc": "At night you visit one player's house asking for a bottle. In the morning you learn who visited that house during the night.",
    "role.kamikaze": "Kamikaze",
    "role.kamikaze.desc": "Your goal is not to survive. If you are shot at night, no protection helps: the shooter dies with you. If you are lynched, you pick one player and take them with you. You win if anyone but the Commissioner shoots you, or if you take a mafioso, the Don, the Killer, a Defender, the Maniac or the Pyro. You lose if the Commissioner shoots you, or if you take the Commissioner or a townsperson.",
    "role.suicide": "Jester",
    "role.suicide.desc": "You have a personal win condition: if you are lynched in the day vote — you win.",
    "role.witch": "Witch",
    "role.witch.desc": "You are on the town's side. The first time you are attacked at night, your magic saves you, and you choose to punish or forgive the attacker. The magic works once and is powerless against the Pyro's bomb.",
    "role.pyro": "Pyro (Bomber)",
    "role.pyro.desc": "Every night you plant a bomb at one player's house. When at least three living players have bombs, you can detonate them all (you die too). If all the bombed players die that night — you win.",
    "role.wolf": "Werewolf",
    "role.wolf.desc": "You start as a civilian. If the mafia or the Killer attacks you, you don't die but join the mafia. If the Commissioner shoots you, you don't die but become a Sergeant. Other attacks kill you as usual.",
    "role.maniac": "Maniac",
    "role.maniac.desc": "You are on nobody's side. Every night you kill one player. If you are one of the last two living players — you win.",
    "role.higgs": "Higgs-Man",
    "role.higgs.desc": "A very rare special character. The Higgs field protects you from 3 night shots — the 4th one kills. You also survive your first lynching. You decide whose side to take: if you are alive at the end of the game, you win no matter who wins, and get a double reward.",
    "role.sleepless": "Balym zhalep",
    "role.sleepless.desc": "Worse than a civilian. Your goal: stay awake at night and keep pressing «Suck» nonstop. Press it fewer than 10 times and you lose automatically.",
    "role.was": "{role} <i>(formerly {old})</i>",

    "faction.town": "Town",
    "faction.mafia": "Mafia",
    "faction.solo": "Independents",

    # --- Night action buttons ------------------------------------------------------------------
    "action.mk": "Choose victim",
    "action.kk": "Kill",
    "action.mn": "Kill",
    "action.ck": "Check",
    "action.sh": "Shoot",
    "action.hl": "Heal",
    "action.bl": "Block",
    "action.pr": "Protect",
    "action.vs": "Visit",
    "action.bm": "Plant bomb",
    "action.dt": "Detonate",
    "action.aw": "Suck",
    "action.sk": "Skip",

    # --- Causes of death -----------------------------------------------------------------------
    "cause.mafia": "killed by the mafia",
    "cause.killer": "killed by the Killer",
    "cause.maniac": "killed by the Maniac",
    "cause.commissioner": "shot by the Commissioner",
    "cause.bomb": "a bomb exploded",
    "cause.pyro_self": "blew up with their own bombs",
    "cause.witch": "cursed by the Witch",
    "cause.kamikaze": "taken down by the Kamikaze",
    "cause.lynch": "lynched",
    "cause.desert": "left the game",
    "cause.afk": "removed for inactivity",
    "cause.sleepless": "killed by the mafia",

    # --- Role message --------------------------------------------------------------------------
    "intro.role": "Your role - <b>{role}</b>",
    "intro.allies": "Your allies:",
    "intro.team_chat": "Your allies see what you write to the bot.",
    "intro.head_defender": "Head defender: {name}",
    "intro.higgs": "Higgs field: protects from {armor} night shots and from the gallows once.",
    "intro.items": "Your items: {items}",

    # --- Night ---------------------------------------------------------------------------------
    "night.title": "<b>Night {day}</b>",
    "night.body": "The town is asleep. Special roles act in private chat with the bot.",
    "night.alive": "Alive players:",
    "night.roles": "Among them: {roles}",
    "night.total": "Total: {count}",
    "prompt.don": "The mafia is voting:",
    "prompt.mafia": "The mafia is voting:",
    "prompt.killer": "Who will you kill?",
    "prompt.maniac": "Who will you kill?",
    "prompt.commissioner": "Check or shoot?",
    "prompt.commissioner_first": "Who will you check?",
    "prompt.doctor": "Who will you heal?",
    "prompt.hacker": "Whose phone will you hack?",
    "prompt.defender": "Who will you protect?",
    "prompt.beggar": "Who will you visit?",
    "prompt.pyro": "Where will you plant a bomb?",
    "prompt.pyro_bombed": "Bombed: {names}",
    "prompt.pyro_ready": "You can blow them all up now (you die too).",
    "prompt.none": "You have no action tonight.",
    "prompt.sleepless": "Press «Suck» at least {need} times, or you die.",
    "awake.progress": "Pressed: {count}/{need}",
    "awake.done": "Well done, you survived this night.",
    "submit.not_night": "It is not night now.",
    "submit.not_alive": "You are not an alive player in this game.",
    "submit.already": "You have already made your choice tonight.",
    "submit.unavailable": "This action is not available to you.",
    "submit.bad_target": "You can't choose this player.",
    "submit.skip": "You skip this night.",
    "submit.detonate": "The bombs will go off at dawn.",
    "submit.ok": "Your choice: {target}",

    "announce.don": "The Don chose a victim...",
    "announce.mafia": "A mafioso voted...",
    "announce.killer": "The Killer chose a target...",
    "announce.maniac": "The Maniac went out into the streets...",
    "announce.check": "The Commissioner is investigating...",
    "announce.shoot": "The Commissioner raised his pistol...",
    "announce.heal": "The Doctor went on duty...",
    "announce.block": "The Hacker is hacking someone's phone...",
    "announce.protect": "The Defenders took someone under protection...",
    "announce.visit": "The Beggar knocked on someone's door...",
    "announce.bomb": "The Pyro is planting a bomb...",
    "announce.detonate": "The Pyro picked up the detonator...",
    "announce.sleepless": "Balym zhalep is getting ready to suck...",

    "night.hacked": "A hacker broke into your phone tonight — <b>your action failed.</b>",
    "night.team_choice": "{name}: chose {target}",
    "night.check_result": "<b>Check result:</b> {target} — <b>{role}</b>",
    "night.sergeant_relay": "<b>Message from the Commissioner:</b>\n{text}",
    "night.bomb_planted": "A bomb was planted at {target}'s house.",
    "night.shield_saved": "You were attacked tonight, but <b>your shield saved you!</b>",
    "night.bullet_pierced": "<b>Your bullet pierced the target's shield!</b>",
    "night.higgs_absorbed": "You were hit, but <b>the Higgs field saved you!</b> Protection left: <b>{left}</b>",
    "night.witch_punished": "You punished the attacker with a curse.",
    "night.witch_forgave": "You forgave the attacker.",
    "night.you_died": "<b>You died</b> <i>({cause})</i>.",
    "night.beggar_nobody": "nobody came",
    "night.beggar_info": "Visitors at {target}'s house tonight: <b>{names}</b>.",
    "night.checked_you": "{role} <b>checked you</b> last night.",
    "night.healed_you": "{role} visited you last night and <b>treated you</b>.",
    "night.healed_saved": "You were attacked last night, but {role} <b>saved your life!</b>",
    "night.doctor_saved": "{target} was healed tonight! Guests: {roles}",
    "night.doctor_idle": "{target} didn't need healing.",
    "night.hacked_idle": "{role} <b>hacked your phone</b> last night.",
    "night.protected_you": "{role} <b>guarded you</b> last night.",
    "night.visited_you": "{role} knocked on your door last night and <b>asked for a bottle</b>.",
    "night.bombed_you": "{role} <b>planted a bomb at your door</b> last night!",
    "night.wolf_mafia": "The mafia attacked you. You are now <b>{role}</b>.\nYour allies: {team}",
    "night.wolf_sergeant": "The Commissioner shot you. You are now <b>{role}</b>.\nYour allies: {team}",
    "night.wolf_joined_mafia": "{name} has joined the mafia!",
    "night.wolf_joined_police": "{name} has joined as a sergeant!",
    "promo.new_don": "The Don is dead. <b>You are now the new Don!</b>",
    "promo.new_don_team": "New Don: {name}",
    "promo.new_com": "The Commissioner is dead. <b>You are now the new Commissioner!</b>",
    "promo.new_com_team": "New Commissioner: {name}",
    "promo.new_head": "The head defender is dead. <b>Starting next night, you choose the target.</b>",
    "witch.prompt": "{names} attacked you tonight! <b>Your magic saved you.</b>\nWhat will you do with the attacker?",
    "witch.punish": "Punish",
    "witch.forgive": "Forgive",
    "witch.timeout": "Time is up — you forgave.",
    "witch.ok_punish": "The attacker will be punished.",
    "witch.ok_forgive": "You forgave.",
    "kamikaze.prompt": "Who will you take with you?",
    "kamikaze.ok": "Your choice: {target}",
    "kamikaze.timeout": "Time is up.",
    "kamikaze.took": "The Kamikaze took {name} - {role} with him.",
    "kamikaze.none": "The Kamikaze took no one with him.",

    # --- Morning -------------------------------------------------------------------------------
    "morning.title": "<b>Day {day}</b>",
    "morning.dead": "Killed last night:",
    "morning.dead_line": "{name} — {role} ({cause})",
    "morning.nobody": "Nobody died last night.",
    "morning.saved": "The Doctor saved someone.",
    "morning.explosion": "There was an explosion in town last night.",
    "morning.witch": "Magic flashed in someone's house.",
    "morning.sleepless": "The mafia killed Balym zhalep for not sucking properly",
    "morning.wolf_mafia": "The Werewolf turned into a mafioso",
    "morning.wolf_sergeant": "The Werewolf turned into a sergeant",
    "morning.pyro_won": "The Pyro blew up all targets and won!",
    "morning.pyro_failed": "The Pyro failed to destroy all targets.",

    # --- Day and voting ------------------------------------------------------------------------
    "day.text": "Discussion time: {seconds} seconds.",
    "vote.start": "Time to find the guilty and punish them.\nVoting lasts {seconds} seconds.",
    "vote.prompt": "Who should be lynched?",
    "vote.abstain_btn": "Abstain",
    "vote.cast": "{voter} voted: {target}",
    "vote.cast_abstain": "{voter} abstained",
    "vote.not_now": "There is no vote right now.",
    "vote.not_alive": "Only alive players can vote.",
    "vote.already": "You have already voted.",
    "vote.bad_target": "You can't vote for this player.",
    "vote.ok_abstain": "You abstained.",
    "vote.ok": "You voted for {target}.",
    "vote.no_votes": "Nobody voted. Nobody is lynched today.",
    "vote.tie": "It's a tie. Nobody is lynched today.",
    "vote.saved": "{name} survived.",
    "vote.lynched": "{name} was lynched at the day meeting!\nThey were {role}.",
    "vote.suicide_won": "{name} was lynched at the day meeting!\nThey were {role}. They won!",
    "vote.higgs_saved": "The Higgs field saved you from the noose. This protection is gone.",
    "vote.vote_shield_used": "Your vote protection saved you.",
    "vote.you_lynched": "You were lynched.",
    "confirm.ask": "Lynch {name}?\nTime: {seconds} seconds.",
    "confirm.closed": "Voting results:\n{yes} 👍  |  {no} 👎",
    "confirm.stopped": "Confirmation stopped.",
    "confirm.not_now": "There is no confirmation vote right now.",
    "confirm.not_alive": "Only living players of this game can vote.",
    "confirm.self": "You can't vote on your own fate.",
    "confirm.ok_yes": "Your vote: 👍",
    "confirm.ok_no": "Your vote: 👎",
    "confirm.spared": "{name} survived.",
    "confirm.gone": "{name} left the game. Nobody is lynched today.",
    "desert.public": "{name} left the game. They were {role}.",
    "afk.public": "{name} was removed after {nights} nights without action. They were {role}.",
    "afk.dm": "You took no action for {nights} nights in a row, so you were removed from the game.",

    # --- End of game ---------------------------------------------------------------------------
    "result.nobody_alive": "Nobody survived. It's a draw.",
    "result.won": "{side} won.",
    "result.draw_long": "The game went on too long. It's a draw.",
    "final.title": "<b>Game over!</b> {label}",
    "final.winners": "Winners:",
    "final.losers": "Other players:",
    "final.line": "    {n}. {name} - {role}",
    "final.duration": "Game length: {minutes} min",

    # --- Lobby and game flow -------------------------------------------------------------------
    "lobby.title": "Mafia game registration is open in {chat}.",
    "lobby.time": "The game starts in {seconds} seconds.",
    "lobby.players": "Registered: {names}",
    "lobby.count": "Total: {count}",
    "lobby.join_btn": "Join",
    "lobby.busy": "A game or registration is already running in this chat.",
    "lobby.closed_join": "Registration for this game is closed.",
    "lobby.already_joined": "You are already registered for the game in «{chat}».",
    "lobby.other_game": "You are registered for or playing another game.",
    "lobby.full": "The room is full ({max} players).",
    "lobby.retry": "Registration failed, please try again.",
    "lobby.joined": "You joined the game in «{chat}» ({count}/{max}). Your role will arrive here.",
    "lobby.left": "You left the registration.",
    "lobby.not_in_game": "You are not in any game.",
    "lobby.not_alive": "You are not an alive player in this game.",
    "lobby.deserted": "You left the game. It counts as a loss.",
    "lobby.extended": "Registration extended by {seconds} seconds.",
    "lobby.no_open": "There is no open registration. Type /game to start a new game.",
    "lobby.need_min": "At least {min} players are needed to start (now {count}).",
    "lobby.reminder": "{seconds} seconds left to join!",
    "lobby.not_enough": "Not enough players ({count}/{min}). Registration closed.",
    "lobby.error": "An error occurred while starting the game. Registration closed.",
    "lobby.closed": "Registration closed.",
    "lobby.done": "Registration closed. Players: {count}.",
    "game.purchased_role": "<b>You got the role you bought!</b>",
    "game.unfulfilled": "The {role} role you chose was not assigned in this game (not available for {count} players or someone bought it earlier).\nYour choice is saved for the next game. You can get your diamond back if you like.",
    "game.refund_btn": "Refund diamond",
    "game.started": "<b>The game has started!</b> Roles were sent in private chat.",
    "game.higgs_arrived": "Higgs-Man is back, and he's about to tear everyone apart...",
    "game.dm_failed": "The bot couldn't message these players — press /start in the bot: {names}",
    "game.bot_btn": "Open the bot",
    "game.vote_btn": "Vote",
    "game.night_over": "The night is over.",
    "game.vote_over": "Voting is over.",
    "game.stale": "This choice has expired.",
    "game.stale_vote": "This vote has expired.",
    "game.stale_witch": "This decision has expired.",
    "game.unknown_action": "Unknown action.",
    "game.back": "Back",
    "game.mode": "{action}: <b>choose a player.</b>",
    "game.last_words_prompt": "Write your last words — they will be sent to the group.",
    "game.last_words_sent": "Your last words have been posted.",
    "game.last_words": "Last words of {name}:\n<blockquote>{text}</blockquote>",
    "game.team_msg": "{name}: {text}",
    "end.lose": "Game over!",
    "end.win": "You won!\nPrize 💵 {reward}, 💎 0 !",
    "end.card": "👤 {name}\n🆔 ID: <code>{id}</code>\n💵 Money: {tenge}\n💎 Diamonds: {diamonds}\n🎒 Items: 🛡 {shields} · ⚖️ {vote_shields} · 💥 {bullets} · 📄 {fake_docs}\n🎭 Next role: {next_role}\n🏆 Wins: {wins}\n🎲 All games: {games}",
    "game.stopped": "The game was stopped.",
    "game.stopped_admin": "An admin stopped the game.",
    "game.error": "An unexpected error occurred, the game was stopped.",
    "game.shutdown": "The bot was stopped, so the game was stopped.",
    "game.restarted": "The bot was restarted, the previous game was stopped. New game: /game",
    "game.removed": "The bot was removed from the group.",
    "game.migrated": "The group became a supergroup, please restart the game: /game",

    # --- Main menu -----------------------------------------------------------------------------
    "btn.join": "🎮 Join a game",
    "btn.room": "🏠 Open a game room",
    "btn.profile": "👤 My profile",
    "btn.shop": "🛍 Shop",
    "btn.diamonds": "💎 Buy diamonds",
    "btn.role": "🎭 Pick a role",
    "btn.rules": "📜 Rules",
    "btn.rating": "🏆 Rating",
    "btn.daily": "🎁 Daily bonus",
    "btn.help": "❓ Help",
    "btn.lang": "🌐 Language",
    "menu_hint": "Choose a section from the menu 👇",
    "welcome": (
        "🎭 <b>Welcome to the Mafia bot!</b>\n\n"
        "I host Mafia games for <b>4–50 people</b> in group chats:\n"
        "• I deal roles at random and tell each player their role <b>only in private chat</b>;\n"
        "• night actions and voting happen here, in private chat;\n"
        "• every action and vote is announced in the group as a separate message.\n\n"
        "<b>Getting started:</b> add me to a group, make me an admin and type /game in the group.\n"
        "Use the menu below 👇"
    ),
    "help": (
        "❓ <b>Help</b>\n\n"
        "<b>In the group:</b>\n"
        "/game — open registration for a new game\n"
        "/startgame — end registration and start right away\n"
        "/extend — extend registration by 30 seconds\n"
        "/leave — leave the registration or the game\n"
        "/give 5 — gift diamonds to a player (as a reply to their message)\n"
        "/give 3 — without a reply: 🎁 diamond giveaway, the first 3 people get 1 💎 each\n"
        "/stop — stop the game <i>(admins)</i>\n"
        "/settingsmafia — registration time, who can start, language <i>(admins)</i>\n"
        "/topmafia — best players of the week <i>(admins)</i>\n\n"
        "<b>In private chat:</b>\n"
        "/profile — profile · /shop — shop · /daily — daily bonus\n"
        "/rating — rating · /rules — rules · /language — language\n"
        "/exchange — exchange 💎 diamonds for ₸\n"
        "/paysupport — payment support\n\n"
        "<b>How it works:</b>\n"
        "1. Someone types /game in the group, players press «🎮 Join the game».\n"
        "2. Once at least 4 players join, the game starts (up to 50).\n"
        "3. Your role arrives in this private chat — <b>don't show it to anyone!</b>\n"
        "4. At night you choose your role's action here. <i>Skip 3 nights in a row and you are removed from the game.</i>\n"
        "5. During the day you discuss in the group and vote here, then the group confirms the verdict with 👍/👎.\n\n"
        "<b>Group rules during a game:</b>\n"
        "• messages from non-players and dead players are deleted and they are <b>muted for 2 minutes</b>;\n"
        "• at night all players' messages are deleted;\n"
        "• admins' messages starting with <code>!</code> are not deleted."
    ),
    "need_admin": (
        "⚠️ <b>To host the game I need admin rights:</b>\n"
        "• 🗑 delete messages;\n"
        "• 🚫 restrict members (to mute non-players and dead players);\n"
        "• 📌 pin messages <i>(optional)</i>.\n\n"
        "Make me an admin in the group settings, then type /game."
    ),
    "bot_added": (
        "👋 Hi! I am <b>the Mafia game host</b>.\n\n"
        "⚠️ <b>To host the game I need admin rights:</b>\n"
        "• 🗑 delete messages;\n"
        "• 🚫 restrict members;\n"
        "• 📌 pin messages <i>(optional)</i>.\n\n"
        "Make me an admin in the group settings, then type /game."
    ),
    "bot_promoted": (
        "✅ <b>Thanks! Admin rights granted.</b>\n"
        "Type /game to open registration. Settings: /settingsmafia\n"
        "<i>Every player must start a private chat with the bot.</i>"
    ),
    "pay_support": (
        "💳 <b>Payment support</b>\n\n"
        "Diamonds are sold for Telegram Stars (⭐), the payment happens inside Telegram.\n"
        "Once the payment is confirmed, diamonds are added to your balance immediately; each payment is credited only once.\n"
        "If something goes wrong, send the bot admin the payment message from Telegram."
    ),
    "terms": (
        "📄 <b>Terms</b>\n\n"
        "• ₸ is a free in-game currency; it is not real money and cannot be exchanged.\n"
        "• 💎 diamonds are a digital in-game item bought with Telegram Stars.\n"
        "• Purchased diamonds and items can only be used inside this bot.\n"
        "• Premium perks are limited by the game rules (one shield, one bullet per game, etc.).\n"
        "• In case of rule violations or fraud, the admin may restrict the account."
    ),
    "lang.choose": "🌐 <b>Choose a language:</b>",
    "lang.set": "✅ Language changed: <b>English</b>.",
    "time.hm": "{h} h {m} min",
    "time.m": "{m} min",

    # --- Rules ---------------------------------------------------------------------------------
    "rules.tab.general": "📖 General",
    "rules.tab.roles": "🎭 Roles",
    "rules.tab.night": "🌙 Night order",
    "rules.tab.items": "🎒 Items",
    "rules.tab.balance": "⚖️ Balance",
    "rules.general": (
        "📖 <b>General rules</b>\n\n"
        "• <b>{min}–{max}</b> players take part.\n"
        "• Roles are dealt at random and revealed only in private chat.\n"
        "• The game starts at <b>night</b>: special roles act in private chat, and each action is announced in the group as a separate message (without the target).\n"
        "• In the morning, the bot announces who died and their role.\n"
        "• During the day — discussion, then voting in private chat. Each vote is announced in the group. For the player with the most votes the group then confirms with 👍/👎: they are lynched only if 👍 outnumber 👎. In a tie nobody is lynched.\n"
        "• During a game, messages from non-players and dead players are deleted and they are muted for 2 minutes; at night all players' messages are deleted. Admins can write with <code>!</code> at the start.\n"
        "• A player who leaves the game (/leave) has their role revealed and loses. A player who takes no action for 3 nights in a row (AFK) is removed too.\n\n"
        "<b>Win conditions</b>\n"
        "🏘 Town — when every Don, mafioso, Killer and Maniac is eliminated.\n"
        "🤵 Mafia — when the Don, mafiosi and Killer are at least as many as everyone else (Defenders not counted) and the Maniac is dead.\n"
        "🪓 Maniac — being one of the last two living players.\n"
        "⚛️ Higgs-Man — being alive at the end (whoever wins), reward ×2.\n"
        "🤡 Jester — getting lynched; 🔥 Pyro — blowing up all the bombed players.\n\n"
        "🏆 <b>Only players who survive until the end of the game win and receive ₸.</b> "
        "<i>Exception: the Jester and the Pyro, who win through their own death.</i>"
    ),
    "rules.roles_title": "🎭 <b>Roles</b>",
    "rules.night": (
        "🌙 <b>Order of night actions</b>\n\n"
        "1. All night choices are collected (at the same time).\n"
        "2. 💻 A player blocked by the Hacker does not act.\n"
        "3. 🛡 The head defender's target is set.\n"
        "4. 👨‍⚕️ The Doctor heals — the healed player survives attacks and bombs that night.\n"
        "5. 🤵 The mafia's shared attack (the Don's decision, otherwise the mafia vote).\n"
        "6. 🔪 The Killer and 7. 🪓 the Maniac attack.\n"
        "8. 🕵️ The Commissioner checks or shoots.\n"
        "9. 🍾 The Beggar learns who visited.\n"
        "10. 🔥 Bombs are planted or detonated.\n"
        "11. 🧙‍♀️ The Witch punishes or forgives the attacker.\n"
        "12. 💣 The Kamikaze takes their killer along (stronger than the Doctor).\n"
        "13. 🐺 Werewolves switch sides.\n"
        "14. Deaths are confirmed, 15. win conditions are checked, 16. the morning news is posted.\n\n"
        "<i>⚛️ The Higgs-Man's field absorbs the first 3 attacks. A purchased 🛡 shield only stops the first lethal attack; it doesn't stop bombs or the special effects of the Kamikaze and the Witch.</i>"
    ),
    "rules.items_title": "🎒 <b>Items and perks</b>",
    "rules.item_line": "{emoji} <b>{name}</b> — {price}\n<i>{desc}</i>\n",
    "rules.role_pick": "🎭 <b>Pick a role</b> — {price} 💎, powerful roles ({roles}) — {premium} 💎\n<i>You choose a role for the next game. It is given if it fits the number of players; otherwise your choice is kept or you can get the diamonds back. ⚛️ Higgs-Man is not for sale.</i>\n",
    "rules.exchange": "💱 <b>Exchange</b> — 1 💎 = {rate} ₸ <i>(one way only, 💎 → ₸; /exchange)</i>\n",
    "rules.fairness": "⚖️ <b>Fairness:</b> at most one shield, one vote protection and one bullet are used per game. Items are spent only when they are really needed.",
    "rules.balance_title": "⚖️ <b>Roles by number of players</b>\n<i>(remaining seats — 👨 civilians)</i>",
    "rules.higgs_rare": "⚛️ <b>Higgs-Man</b> — with {min}+ players, appears in each game with a ≈{chance}% chance in place of one civilian.",
    "rules.sleepless_rare": "<b>Balym zhalep</b> — with {min}+ players, always takes one civilian's place in every game.",
    "rules.rewards": "💰 <b>Win reward:</b> {rewards}. Values in between are calculated automatically, ⚛️ Higgs-Man gets ×2.",

    # --- Items ---------------------------------------------------------------------------------
    "item.shields.name": "Shield",
    "item.shields.desc": "Once per game, saves you from a lethal night attack (mafia, Killer, Maniac, the Commissioner's shot). Nobody is told that it was used.",
    "item.fake_docs.name": "Fake document",
    "item.fake_docs.desc": "If you are the Don, a mafioso, the Pyro or the Maniac, the Commissioner's first check shows you as a «Civilian». Valid for one game only.",
    "item.vote_shields.name": "Vote protection",
    "item.vote_shields.desc": "If you are chosen to be lynched in the day vote, you survive once. Doesn't protect from night attacks.",
    "item.piercing_bullets.name": "Shield-piercing bullet",
    "item.piercing_bullets.desc": "If you are the Don (the mafia's shared attack), the Killer, the Commissioner (shooting) or the Maniac, your attack breaks through the target's purchased shield. Spent only when a shield is actually broken.",

    # --- Profile, shop, rating, bonus ----------------------------------------------------------
    "profile.title": "👤 <b>Player profile</b>",
    "profile.player": "🎮 Player: {name}",
    "profile.id": "🆔 ID: <code>{id}</code>",
    "profile.registered": "📅 Registered: {date}",
    "profile.stats": "📊 <b>Statistics</b>",
    "profile.games": "Games: <b>{n}</b>",
    "profile.wins": "Wins: <b>{n}</b>",
    "profile.losses": "Losses: <b>{n}</b>",
    "profile.rate": "Win rate: <b>{rate}</b>",
    "profile.rank": "Rating position: <b>{rank}</b>",
    "profile.recent": "🕹 <b>Recent games</b>",
    "profile.recent_line": "{mark} {role} — {count} players{reward}",
    "profile.reward": ", <b>+{reward} ₸</b>",
    "profile.balance": "💰 <b>Balance</b>",
    "profile.tenge": "₸: <b>{n}</b>",
    "profile.diamonds": "💎 Diamonds: <b>{n}</b>",
    "profile.items": "🎒 <b>Items</b>",
    "profile.shields": "🛡 Shields: <b>{n}</b>",
    "profile.fake_docs": "📄 Fake documents: <b>{n}</b>",
    "profile.premium": "💎 <b>Premium perks</b>",
    "profile.vote_shields": "⚖️ Vote protections: <b>{n}</b>",
    "profile.bullets": "💥 Shield-piercing bullets: <b>{n}</b>",
    "profile.next_role": "🎭 Role for the next game: <b>{role}</b>{more}",
    "profile.queue_more": " <i>({n} more in queue)</i>",
    "profile.next_none": "🎭 Role for the next game: <i>not chosen</i>",
    "shop.title": "🛍 <b>Shop</b>",
    "shop.balance": "Your balance: <b>{tenge} ₸</b> · <b>{diamonds} 💎</b>",
    "shop.footer": "<i>Items are stored in your profile and used automatically in your next games.</i>",
    "shop.bought": "✅ {emoji} <b>{name}</b> purchased! You have: <b>{count}</b>. Balance left: <b>{balance} {currency}</b>",
    "shop.no_funds": "Not enough funds: {price} needed, you have {balance} {currency}.",
    "shop.unknown": "Unknown item.",
    "shop.ok_alert": "✅ Purchased!",
    "dia.title": "💎 <b>Buy diamonds</b>",
    "dia.intro": "The bigger the pack, the cheaper each diamond.\nPayment is made securely via <b>Telegram Stars (⭐)</b>.",
    "dia.line": "• <b>{diamonds} 💎</b> — {price} ₸ <i>({per} ₸/💎)</i> · {stars} ⭐",
    "rp.title": "🎭 <b>Pick a role for the next game</b>",
    "rp.intro": "Price: <b>{price} 💎</b>; powerful roles ({roles}) — <b>{premium} 💎</b>. The role is given in a game with enough players. One choice is used per game, the rest wait in the queue.",
    "rp.line": "{role} — <b>{price} 💎</b> · <i>{min}+ players</i>",
    "rp.higgs_note": "{role} — <i>not for sale, appears rarely and at random.</i>",
    "rp.queue": "📋 <b>Your queue:</b> {roles}",
    "rp.not_buyable": "This role can't be bought.",
    "rp.no_funds": "Not enough diamonds: this role costs {price} 💎, you have {balance} 💎. Open «💎 Buy diamonds».",
    "rp.limit": "At most {limit} roles can be in the queue.",
    "rp.failed": "Purchase failed.",
    "rp.ok_alert": "✅ Role added to the queue!",
    "rp.saved": "✅ The {role} role is saved {position}. Balance left: <b>{balance} 💎</b>",
    "rp.next_game": "for the next game",
    "rp.position": "at position {n} in the queue",
    "rq.button": "📋 My queue",
    "rq.empty": "📋 Your queue is empty. No role chosen for the next game.",
    "rq.title": "📋 <b>Role queue</b> (the first one is for the next game):",
    "rq.refund_btn": "❌ {role} — 💎 refund",
    "rr.in_game": "You can't refund a role during a game or registration.",
    "rr.gone": "This choice has already been used or refunded.",
    "rr.done": "💎 {n} diamond(s) refunded.",
    "rating.title": "🏆 <b>Top players</b>",
    "rating.empty": "<i>Nobody has played yet.</i>",
    "rating.line": "{medal} {name} — <b>{wins}</b> wins / {games} games ({rate}%)",
    "rating.me": "Your position: <b>{rank}</b>",
    "top.title": "🏆 <b>Best of the week</b> · {chat}\n<i>Based on this chat's games in the last 7 days</i>",
    "top.line": "{medal} {name} — <b>{wins}</b> wins · {games} games · +{earned} ₸",
    "top.empty": "<i>No finished games in this chat in the last 7 days.</i>",
    "top.admins_only": "⛔️ /topmafia is for chat admins only.",
    "daily.ok": "🎁 Day {day} bonus: <b>+{reward} ₸</b>!",
    "daily.balance": "Your balance: <b>{n} ₸</b>",
    "daily.tomorrow": "<i>Come back tomorrow!</i>",
    "daily.wait": "⏳ You have already claimed today's bonus. Next bonus in: <b>{time}</b>.",

    # --- Joining, rooms, group -----------------------------------------------------------------
    "join.list": "🎮 <b>Open games:</b>",
    "join.none": "There is no open registration in your groups right now.\nType /game in a group to start a new game.",
    "join.not_member": "❌ Only members of that group can join this game.",
    "room.text": "🏠 <b>Open a game room</b>\n\nThe game is played in a group chat. Add me to a group, make me an admin and type /game there, or pick a group with the bot below.",
    "room.add_btn": "➕ Add the bot to a group",
    "room.add_new_btn": "➕ Add the bot to a new group",
    "room.not_member": "You are not a member of this group.",
    "room.no_rights": "The bot has no admin rights in this group.",
    "room.opened_alert": "✅ Registration opened!",
    "room.opened": "✅ Registration opened in «{chat}».",
    "group.admins_only": "⛔️ In this chat only admins can open and start a game.",
    "group.no_lobby": "There is no open registration.",
    "group.stop_denied": "Only group admins can stop the game.",
    "group.no_game": "There is no game in this chat.",
    "group.not_in_game": "You are not playing in this chat.",
    "group.open_bot_btn": "🤖 Open the bot",

    # --- Chat settings -------------------------------------------------------------------------
    "settings.title": "⚙️ <b>Mafia settings</b> — «{chat}»",
    "settings.reg": "⏱ Registration time: <b>{seconds} sec</b>",
    "settings.start": "▶️ Who can open and start a game: <b>{mode}</b>",
    "settings.start.all": "👥 Everyone",
    "settings.start.admins": "👑 Admins only",
    "settings.lang": "🌐 Language: <b>{lang}</b>",
    "settings.note": "<i>Change them with the buttons below. Changes apply from the next game.</i>",
    "settings.admins_only": "Only chat admins can change the settings.",
    "settings.saved": "✅ Saved",
    "settings.close_btn": "✖️ Close",
    "settings.closed": "⚙️ Settings saved.",
    "settings.sec": "{n} sec",

    # --- Payments ------------------------------------------------------------------------------
    "pay.title": "{n} 💎 diamonds",
    "pay.desc": "{n} diamonds in the Mafia bot (≈ {price} ₸). Added to your balance right after the payment is confirmed.",
    "pay.label": "{n} diamonds",
    "pay.unknown_package": "Unknown pack.",
    "pay.bad_package": "This pack is no longer available. Please choose again from the menu.",
    "pay.unknown": "⚠️ The payment was received, but the pack was not found. Contact us via /paysupport.",
    "pay.dup": "ℹ️ This payment was already registered; the diamonds are already on your balance.",
    "pay.ok": "✅ <b>Payment confirmed! +{n} 💎</b>\nYour diamond balance: <b>{balance} 💎</b>",

    # --- Command descriptions ------------------------------------------------------------------
    "give.usage": "💎 <b>Gift diamonds</b>\n• Reply to a player's message with <code>/give 5</code> or write <code>/give @username 5</code> — that player gets 5 💎.\n• In a group just write <code>/give 3</code> — 🎁 a giveaway: the first 3 people to press «Open the gift» get 1 💎 each.",
    "give.bad_amount": "❌ Enter a valid number of diamonds: from 1 to {max}.",
    "give.unknown": "❌ {name} was not found. They need to press /start in the bot first, or reply to their message instead.",
    "give.self": "❌ You can't gift diamonds to yourself.",
    "give.bot": "❌ You can't gift diamonds to a bot.",
    "give.no_funds": "❌ Not enough diamonds: you have <b>{balance} 💎</b>.",
    "give.ok": "💎 {giver} gifted <b>{n} diamonds</b> to {receiver}!",
    "give.left": "Your remaining balance: <b>{balance} 💎</b>",
    "give.dm": "🎁 {giver} gifted you <b>{n} 💎</b>! Your balance: <b>{balance} 💎</b>",
    "giveaway.open": "🎁 {giver} is giving away <b>{n} diamonds</b> — grab one fast!\nEveryone gets <b>1 💎</b> · Left: <b>{left}/{n}</b>",
    "giveaway.done": "🎁 All <b>{n} diamonds</b> from {giver} have been claimed!",
    "giveaway.expired": "⌛ The giveaway of {n} 💎 from {giver} has expired: <b>{left} 💎</b> unclaimed went back to the owner.",
    "giveaway.cancelled": "🎁 The giveaway of {n} 💎 from {giver} was closed — the admin reset all diamonds.",
    "giveaway.claimers": "✅ Claimed ({count}): {names}",
    "giveaway.btn": "🎁 Open the gift",
    "giveaway.ok": "🎉 You got 1 💎! Your balance: {balance} 💎",
    "giveaway.own": "You can't claim your own gift 🙂",
    "giveaway.again": "You have already claimed from this gift.",
    "giveaway.gone": "Sorry, the gift has run out.",
    "ex.title": "💱 <b>Exchange diamonds for ₸</b>\nRate: <b>1 💎 = {rate} ₸</b>\nYou have: <b>{diamonds} 💎</b> · <b>{tenge} ₸</b>\n\nHow many diamonds do you want to exchange? Press a button or write <code>/exchange 3</code>.\n<i>There is no reverse exchange (₸ → 💎).</i>",
    "ex.btn": "{n} 💎 → {tenge} ₸",
    "ex.all_btn": "All: {n} 💎 → {tenge} ₸",
    "ex.ok": "✅ Exchanged <b>{n} 💎</b> → <b>{tenge} ₸</b>.\nYour balance: <b>{diamonds} 💎</b> · <b>{balance} ₸</b>",
    "ex.no_funds": "Not enough diamonds: you have {diamonds} 💎.",
    "ex.usage": "Usage: <code>/exchange 3</code> — exchanges 3 💎 (1 💎 = {rate} ₸). Amount: from 1 to {max}.",
    "ex.shop_btn": "💱 Exchange diamonds for ₸ (1 💎 = {rate} ₸)",
    "cmd.start": "Main menu",
    "cmd.profile": "My profile",
    "cmd.shop": "Shop",
    "cmd.exchange": "Exchange diamonds for ₸",
    "cmd.daily": "Daily bonus",
    "cmd.rating": "Rating",
    "cmd.rules": "Rules",
    "cmd.language": "Change language",
    "cmd.help": "Help",
    "cmd.paysupport": "Payment support",
    "cmd.terms": "Terms",
    "cmd.game": "Open registration for a new game",
    "cmd.startgame": "Start the game right away",
    "cmd.extend": "Extend registration by 30 seconds",
    "cmd.leave": "Leave the game",
    "cmd.give": "Gift diamonds to a player",
    "cmd.stop": "Stop the game (admin)",
    "cmd.settingsmafia": "Bot settings (admin)",
    "cmd.topmafia": "Best players of the week (admin)",
}
