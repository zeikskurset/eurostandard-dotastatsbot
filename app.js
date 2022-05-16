const phrases = require('./text.json')
const fs = require('fs')
const network = require('./network.js')

//shortcut for text
function getPhrase(code) {
	return phrases[code] && phrases[code][config.language] ? phrases[code][config.language] : phrases.phraseError.ru + " " + code
	
}


let appData = {
	commands: [],
	users: [],

	getUserByAlias: (alias) => {
		return this.users.filter((user) => {
			return user.name === alias
		})[0]
	},

	getUserByDiscordId: (discordId) => {
		return this.users.filter((user) => {
			return user.discordId === discordId
		})[0]
	},

	getLeaderboard: () => {
		return this.users.filter((user) => {
			return user.inLeaderboard
		})
	}
}

fs.readFile('./commands.txt', 'utf8', function (err,data) {
  if (err) {
  	return console.log(err);
  }
  appData.helpInfo = data;
});

class Command {
	constructor(pseudos, handler, enabled, app) {
		this.pseudos = pseudos;

		this._handler = handler;

		this.enabled = enabled;

		this.appData = app

		this.fits = function(command) {
			return this.pseudos.some((pseudo) => {
				return pseudo == command
			})
		}

		this.handle = function(args, userId) {
			if (!this.enabled) {
				return getPhrase('commandDisabled')
			} else return this._handler(args, userId);
		}

		app.commands.push(this)

		return this
	}
}

let handle = async function(commandText, args, userId) {
	let fitting = commands.filter((command) => {
		return command.fits(commandText)
	})
	if (fitting.length === 0) return getPhrase("commandNotFound")
	//multiple found?
	return await fitting[0].handle(args, userId)
}

//actual commands

new Command(["commands", "help"], (args, userId)=>{
	return info;
}, true)

new Command(["deletecache"], (args, userId)=>{
	for(urlext in cache.data) {
		if(!cache.data[urlext].permanent)
			cache.data[urlext] = undefined
	}
	console.log(cache.data)
	return getPhrase("cacheCleared")
}, true)

new Command(["iam"], (args, userId)=>{
	if (args.length === 0) {
		if (getUsersAlias(userId)) {
			return getPhrase("yourAliasIs").format(getUsersAlias(userId))
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
}, true)

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

module.exports = appData