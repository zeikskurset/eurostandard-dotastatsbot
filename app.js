const phrases = require('./text.json')
const fs = require('fs')
const network = require('./network.js')
const utility = require('./utility.js')
const {Alias} = require('./alias.js')
const {App, Command} = require('./core.js')
const config = require('./config.json')
const cache = require('./cache.js')
const fns = require('./fns.js')

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

app.addCommand(new Command(["commands"], (args, userId)=>{
	return app.commandsInfo;
}))

app.addCommand(new Command(["help"], (args, userId)=>{
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

app.addCommand(new Command(["alias", "a"], async (args, userId)=> {
	if (args.length < 2) 
		return getPhrase("seeUsage")

	if (utility.validAccId(args[0])) 
		return getPhrase("invalidAlias")

	if (!utility.validAccId(args[1])) 
		return getPhrase("invalidAccId")

	let newUser = new Alias(args[0], args[1])

	try{

		let checkingData = await network.fetch(`players/${newUser.accId}/matches`)

		if(checkingData.length == 0)
			return getPhrase("invalidAccId")

	} catch (err) {
		return getPhrase("invalidAccId")
	}

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

async function handleLeaderboard(args, limit) {
	let criteria = args.length > 0 ? args[0] : criteriae[0]

	let gameslimit = args.length > 1 ? args[1] : 0

	if (!criteriae.includes(criteria))
		return getPhrase("noSuchCriteria")

	let results = await network.fetchLeaderboard(app.cache, app.getLeaderboard(), criteria, limit, gameslimit)

	return utility.stringifyLeaderboard(criteria, results)
}

app.addCommand(new Command(["leaderboard", "all"], async (args, userId) => {
	return await handleLeaderboard(args, 0)
}))

app.addCommand(new Command(["leaders", "l"], async (args, userId) => {
	let limit = args.length > 2 ? args[2] : 3
	return await handleLeaderboard(args, limit)
}))

app.addCommand(new Command(["best"], async (args, userId) => {
	return await handleLeaderboard(args, 1)
}))

app.addCommand(new Command(["stats", "s"], async (args, userId) => {
	let user = args.length > 0 ? app.getUserByAlias(args[0]) : app.getUserByDiscordId(userId)
	if(typeof user == "undefined")
		return getPhrase("noAlias")

	let data = await network.fetch(`players/${user.accId}/recentMatches`, app.cache)

	let results = {alias:user.name}

	for(let crit of criteriae.slice(3)) {
		results[crit] = {criteria: crit, data: data}
		fns[crit](results[crit])
	}

	let wins = data.filter((game) => {
		return utility.playerWon(game)
	}).length

	results["wins"] = {
		data: wins,
		criteria: "wins"
	}

	return utility.stringifyStats(results)
}))

async function handleGame(user, offset, stat) {
	let games = await network.fetch(`players/${user.accId}/matches`, app.cache)
	if (games.length == 0)
		return getPhrase("noGames")
	let gameId = games[offset - 1].match_id

	let game = await network.fetch(`matches/${gameId}`, app.cache)

	if (stat){
		let res = JSON.stringify(game.players.filter(player => player.account_id==user.accId)[0][stat])
		if (!res) {
			return getPhrase("noData")
		} 
		return res
	}

	return utility.stringifyGame(game, app)
}

app.addCommand(new Command(["last"], async (args, userId) => {
	let user = args.length > 0 ? app.getUserByAlias(args[0]) : app.getUserByDiscordId(userId)
	if(typeof user == "undefined")
		return getPhrase("noAlias")

	return await handleGame(user, 1, args[1])
}))

app.addCommand(new Command(["game", "g"], async (args, userId) => {
	let user = args.length > 0 ? app.getUserByAlias(args[0]) : app.getUserByDiscordId(userId)
	if(typeof user == "undefined")
		return getPhrase("noAlias")

	let offset = isNaN(args[1]) ? 1 : args[1]

	return await handleGame(user, offset, args[2])
}))

app.addCommand(new Command(["wordcloud", "w"], async (args, userId) => {
	let user = args.length > 0 ? app.getUserByAlias(args[0]) : app.getUserByDiscordId(userId)
	if(typeof user == "undefined")
		return getPhrase("noAlias")

	let wordcloud = await network.fetch(`players/${user.accId}/wordcloud`, app.cache)
	wordcloud = wordcloud["my_word_counts"]

	let keys = Object.keys(wordcloud)
	let word = args.length > 1 ? args[1] : keys[ keys.length * Math.random() << 0]

	return getPhrase("wordcloud").format(user.name, word, wordcloud[word] ? wordcloud[word] : 0)
}))

app.addCommand(new Command(["hero", "h"], async (args, userId) => {
	if(args.length < 2)
		return getPhrase("seeUsage")

	let user = app.getUserByAlias(args[0])
	if(typeof user == "undefined")
		return getPhrase("noAlias")

	let heroname = args.slice(1).join(' ').toLowerCase()
	let hero = Object.values(app.dotaconstants.heroes).filter((hero) =>{
		return hero.localized_name.toLowerCase().startsWith(heroname)
	})

	if(hero.length == 0)
		return getPhrase("heroNotFound")

	let heroId = hero[0].id

	let wl = await network.fetch(`players/${user.accId}/wl?hero_id=${heroId}`, app.cache)

	return getPhrase("heroWinrate").format(user.name, hero[0].localized_name, (wl.win/(wl.lose+wl.win)*100).toLocaleString(undefined, {maxFractionDigits:2}))
}))

app.addCommand(new Command(["aliases"], (args, userId) => {
	return app.users.map((user) => {
		return user.name
	}).join(' ')
}))


module.exports = app