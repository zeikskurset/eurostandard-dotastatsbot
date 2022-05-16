module.exports.playerWon = function(game) {
	return (game.radiant_win && game.player_slot < 128) || (!game.radiant_win && game.player_slot > 127) 
}

module.exports.validAccId = function(id) {
	return /^\d\d\d\d\d\d\d\d\d$/.test(id)
}

module.exports.stringifyLeaderboard = function(criteria, leaderboard) {
	if(leaderboard.length == 0)
		return getPhrase("noParticipants")
	let res = criteria + "\n"
	for(let pos of leaderboard) {
		res += (leaderboard.indexOf(pos) + 1) + " " + pos.alias + " " + pos.data + "\n"
	}
	return res
}

module.exports.stringifyStats = function(stats) {
	let res = "Stats for " + stats.alias + "\n"
	for (let crit in stats) {
		if (criteriae.includes(crit)) {
			res += crit + ": " + stats[crit].data + "\n"
		}
	} 
	return res
}