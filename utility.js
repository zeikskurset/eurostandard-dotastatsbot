const config = require('./config.json')
const phrases = require('./text.json')

function getPhrase(code) {
	return phrases[code] && phrases[code][config.language] ? phrases[code][config.language] : phrases.phraseError.ru + " " + code	
}

module.exports.playerWon = function(game) {
	return (game.radiant_win && game.player_slot < 128) || (!game.radiant_win && game.player_slot > 127) 
}

module.exports.validAccId = function(id) {
	return /^\d{8,10}$/.test(id)
}

module.exports.stringifyLeaderboard = function(criteria, leaderboard) {
	if(leaderboard.length == 0)
		return getPhrase("noParticipants")
	let res = "**__" + criteria + "__**\n"
	for(let pos of leaderboard) {
		res += "_" + (leaderboard.indexOf(pos) + 1) + "_ **" + pos.alias + "** " + pos.data.toLocaleString(undefined, {
			maximumFractionDigits: 2
		}) + "\n"
	}
	return res
}

module.exports.stringifyStats = function(stats) {
	let res = "__**" + getPhrase("statsFor") + stats.alias + "**__\n"
	for (let crit in stats) {
		if (config.criteriae.includes(crit)) {
			res += "_" + crit + ":_ " + stats[crit].data.toLocaleString(undefined, {maxFractionDigits: 2}) + "\n"
		}
	} 
	return res
}

function hasItem(player, id) {
	return player.item_0 == id || player.item_1 == id || player.item_3 == id || player.item_4 == id || player.item_5 == id
}

function fineprint(win, data, title) {
	data = data.reduce((a, b) => {
		return a + b
	})
	data = `${win ? "__**" : ""}${title}${win ? "**__" : ""}\n${data}`
	return data
}

module.exports.stringifyGame = function(game, app) {
	let players = game.players.map((player) => {
		return {
			hero: app.dotaconstants.heroes[player.hero_id].localized_name,
			player: app.getUserByAccId(player.account_id) ? app.getUserByAccId(player.account_id).name : undefined,
			kills: player.kills,
			deaths:player.deaths,
			assists:player.assists,
			net_worth: player.net_worth,
			level: player.level,
			hand_of_midas: hasItem(player, 65),
			gpm: player.gold_per_min,
			xpm: player.xp_per_min,
			hd: player.hero_damage,
			creepstat: `${player.last_hits}/${player.denies}`
		}
	}).map((player) => {
		let playername = `${player.player ? player.player : getPhrase("random")}`.padEnd(10)
		let heroandlvl = ` _${player.hero} ${player.level}lvl_ `.padEnd(25)
		let kda = `**${player.kills}  ${player.deaths}  ${player.assists}**`.padEnd(15)
		let stats =  `${player.net_worth}🪙, ${player.gpm}  gpm, ${player.creepstat}  lh/d, ${player.hd}  damage, midas:${player.hand_of_midas ? "☑" : "☒"} \n`

		return playername + heroandlvl + kda + stats
	})

	let radiant = fineprint(game.radiant_win, players.slice(0,5), "Radiant")
	let dire = fineprint(!game.radiant_win, players.slice(5), "Dire")

	return radiant + dire
}