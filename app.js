const phrases = require('./text.json')
const fs = require('fs')
const network = require('./network.js')
const utility = require('./utility.js')
const {Alias} = require('./alias.js')
const {App, Command} = require('./core.js')
const config = require('./config.json')
const cache = require('./cache.js')

//brainlet.jpg
String.prototype.format = function () {
  var args = arguments;
  return this.replace(/{([0-9]+)}/g, function (match, index) {
    return typeof args[index] == 'undefined' ? match : args[index];
  });
};

//shortcut for text
function getPhrase(code) {
	return phrases[code] && phrases[code][config.language] ? phrases[code][config.language] : phrases.phraseError.ru + " " + code
	
}

//initializing

let app = new App();

//actual commands

app.addCommand(new Command(["commands", "help"], (args, userId)=>{
	return app.helpInfo;
}))


app.addCommand(new Command(["deletecache"], (args, userId)=>{
	for(urlext in app.cache) {
		if(!app.cache[urlext].permanent)
			delete app.cache[urlext]
	}
	return getPhrase("cacheCleared")
}))


app.addCommand(new Command(["iam"], (args, userId)=>{
	if (args.length === 0) {
		if (getUsersAlias(userId)) {
			return getPhrase("yourAliasIs").format(app.getUserByDiscordId(userId).alias)
		} else {
			return getPhrase("youHaveNoAlias")
		}
	} else {
		if(!aliases[args[0]]) 
			return getPhrase("noSuchAlias")
		discordAliases[userId] = {alias: args[0]}
		dumpAliases()
		return getPhrase("yourAliasNowIs").format(args[0])
	}
}))

new Command(["alias", "a"], (args, userId)=> {
	if (args.length < 2) 
		return getPhrase("seeUsage")
	if (validAccId(args[0])) 
		return getPhrase("invalidAlias")
	if (!validAccId(args[1])) 
		return getPhrase("invalidAccId")

	aliases[args[0]] = args[1];

	if(args.length == 2) {
		dumpAliases()
		return getPhrase("aliasAdded").format(args[0], args[1])
	}
 
	if(args.length == 3 && args[2] === "iam") {
		discordAliases[userId] = {alias: args[0]}
		dumpAliases()
		return getPhrase("aliasAddedWithDiscord").format(args[0], args[1])
	}

	if(args.length >= 4 && args[2] === "iam" && args[3] === "enter") {
		discordAliases[userId] = {alias: args[0]}
		dumpAliases()
		if(leaderboard.includes(alias))
			return getPhrase("aliasAddedWithDiscord").format(args[0], args[1]) + getPhrase("alreadyInLeaderboard")
		leaderboard.push(args[0])
		return getPhrase("aliasAddedWithDiscordAndLeaderboard").format(args[0], args[1])
	} 
}, true)

new Command(["enterleaderboard", "enter"], (args, userId) => {
	let alias = args.length > 0 ? args[0] : getUsersAlias(userId)
	if(typeof aliases[alias] == "undefined")
		return getPhrase("noAlias")
	if(leaderboard.includes(alias))
		return getPhrase("alreadyInLeaderboard")
	leaderboard.push(alias)
	return getPhrase("leaderboardSuccess")
}, true)

new Command(["leaveleaderboard", "leave"], (args, userId) => {
	let alias = args.length > 0 ? args[0] : getUsersAlias(userId)
	if(typeof aliases[alias] == "undefined")
		return getPhrase("noAlias")
	if(!leaderboard.includes(alias))
		return getPhrase("notInLeaderboard")
	leaderboard = leaderboard.filter((participant) => {
		return participant !== alias
	})
	return getPhrase("leaderboardLeaveSuccess")
}, true)

new Command(["leaderboard", "all"], async (args, userId) => {
	let criteria = args.length > 0 ? args[0] : criteriae[0]

	let gameslimit = args.length > 1 ? args[1] : 0

	if (!criteriae.includes(criteria))
		return getPhrase("noSuchCriteria")

	let results = await getLeaderboard(criteria, 0, gameslimit)

	return stringifyLeaderboard(criteria, results)

}, true)

new Command(["leaders", "l"], async (args, userId) => {
	let criteria = args.length > 0 ? args[0] : criteriae[0]

	let limit = args.length > 1 ? args[1] : 3

	let gameslimit = args.length > 2 ? args[2] : 0

	if (!criteriae.includes(criteria))
		return getPhrase("noSuchCriteria")

	let results = await getLeaderboard(criteria, limit, gameslimit)

	return stringifyLeaderboard(criteria, results)

}, true)

new Command(["best"], async (args, userId) => {
	let criteria = args.length > 0 ? args[0] : criteriae[0]

	let gameslimit = args.length > 1 ? args[1] : 0

	if (!criteriae.includes(criteria))
		return getPhrase("noSuchCriteria")

	let results = await getLeaderboard(criteria, 1, gameslimit)

	return stringifyLeaderboard(criteria, results)

}, true)

new Command(["stats", "s"], async (args, userId) => {
	let alias = args.length > 0 ? args[0] : getUsersAlias(userId)
	if(typeof aliases[alias] == "undefined")
		return getPhrase("noSuchAlias")
	let data = await fetch(`players/${aliases[alias]}/recentMatches`)
	let results = {alias:alias, data:data}
	for(let crit of criteriae.slice(3)) {
		results[crit] = {criteria: crit, data: data}
		fns[crit](results[crit])
	}
	let wins = data.filter((game) => {
		return playerWon(game)
	}).length
	results["wins"] = {
		data: wins,
		criteria: "wins"
	}
	results["data"] = undefined
	return stringifyStats(results)
}, true)

new Command(["last"], async (args, userId) => {
	let alias = args.length > 0 ? args[0] : getUsersAlias(userId)
	if(typeof aliases[alias] == "undefined")
		return getPhrase("noSuchAlias")
	let data = await fetch(`players/${aliases[alias]}/recentMatches`)
	data = data.slice(0, 1)
	console.log(data)
	let results = {alias:alias, data:data}
	for(let crit of criteriae.slice(3)) {
		results[crit] = {criteria: crit, data: data}
		fns[crit](results[crit])
	}
	let wins = data.filter((game) => {
		return playerWon(game)
	}).length
	results["wins"] = {
		data: wins,
		criteria: "wins"
	}
	results["data"] = undefined
	return stringifyStats(results)
}, true)

module.exports = app