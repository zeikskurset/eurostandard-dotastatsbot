const phrases = require('./text.json')
const fs = require('fs')
const network = require('./network.js')
const utility = require('./utility.js')
const {Alias} = require('./alias.js')
const {App, Command} = require('./core.js')
const config = require('./config.json')
const cache = require('./cache.js')

//shortcuts

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

const criteriae = config.criteriae

//initializing

let app = new App();

//commands

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
		let user = app.getUserByDiscordId(userId)

		if (user) {
			return getPhrase("yourAliasIs").format(user.name)
		} else {
			return getPhrase("youHaveNoAlias")
		}
	} else {
		let user = app.getUserByAlias(args[0])

		if(!user) 
			return getPhrase("noSuchAlias")

		user.discordId = userId
		app.dumpUsers()

		return getPhrase("yourAliasNowIs").format(args[0])
	}
}))

app.addCommand(new Command(["alias", "a"], (args, userId)=> {
	if (args.length < 2) 
		return getPhrase("seeUsage")

	if (utility.validAccId(args[0])) 
		return getPhrase("invalidAlias")

	if (!utility.validAccId(args[1])) 
		return getPhrase("invalidAccId")

	let newUser = new Alias(args[0], args[1])

	app.addUser(newUser)

	if(args.length == 2) {
		return getPhrase("aliasAdded").format(args[0], args[1])
	}
 
	if(args.length == 3 && args[2] === "iam") {
		newUser.discordId = userId
		app.dumpUsers()
		return getPhrase("aliasAddedWithDiscord").format(args[0], args[1])
	}

	if(args.length >= 4 && args[2] === "iam" && args[3] === "enter") {
		newUser.discordId = userId
		newUser.inLeaderboard = true
		app.dumpUsers()
		return getPhrase("aliasAddedWithDiscordAndLeaderboard").format(args[0], args[1])
	} 
}))

app.addCommand(new Command(["enterleaderboard", "enter"], (args, userId) => {
	let user = args.length > 0 ? app.getUserByAlias(args[0]) : app.getUserByDiscordId(userId)
	if(typeof user == "undefined")
		return getPhrase("noAlias")
	if(user.inLeaderboard)
		return getPhrase("alreadyInLeaderboard")
	user.inLeaderboard = true
	return getPhrase("leaderboardSuccess")
}))

app.addCommand(new Command(["leaveleaderboard", "leave"], (args, userId) => {
	let user = args.length > 0 ? app.getUserByAlias(args[0]) : app.getUserByDiscordId(userId)
	if(typeof user == "undefined")
		return getPhrase("noAlias")
	if(!user.inLeaderboard)
		return getPhrase("notInLeaderboard")
	user.inLeaderboard = false
	return getPhrase("leaderboardLeaveSuccess")
}))

app.addCommand(new Command(["leaderboard", "all"], async (args, userId) => {
	let criteria = args.length > 0 ? args[0] : criteriae[0]

	let gameslimit = args.length > 1 ? args[1] : 0

	if (!criteriae.includes(criteria))
		return getPhrase("noSuchCriteria")

	let results = await network.fetchLeaderboard(app.cache, app.getLeaderboard(), criteria, 0, gameslimit)

	return utility.stringifyLeaderboard(criteria, results)

}))

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