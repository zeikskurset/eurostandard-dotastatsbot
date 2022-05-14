const Discord = require('discord.js')
const axios = require('axios')
const fs = require('fs')
const keyObj = require('./secret_key.json')
const config = require('./config.json')
const cache = require('./cache.js')
const phrases = require('./text.json')

const client = new Discord.Client({intents: ["GUILDS", "GUILD_MESSAGES"]})

let queue = []

let commands = []

let aliases = {}

let discordAliases = {}

let leaderboard = []

let queueActive = false;

let queueInterval

//[Utility]

function playerWon(game) {
	return (game.radiant_win && game.player_slot < 128) || (!game.radiant_win && game.player_slot > 127) 
}


//has to be improved somehow
function dumpAliases(){
	console.log("Dumping aliases and discordAliases")
	fs.writeFile("aliases.json", JSON.stringify(aliases), (err) => {
		if (err)
			console.log(err)
	})
	fs.writeFile("discordAliases.json", JSON.stringify(discordAliases), (err) => {
		if (err)
			console.log(err)
	})
}

function loadAliases(){
	console.log("Loading aliases")
	fs.readFile("aliases.json", 'utf8', function (err,data) {
			if (err) {
				console.log("Failed to load aliases");
			}
			try {
				aliases = JSON.parse(data);
			} catch (err) {
				console.log("Failed to parse aliases")
				console.log(err)
			}
	});
	fs.readFile("discordAliases.json", 'utf8', function (err,data) {
			if (err) {
				console.log("Failed to load discordAliases");
			}
			try {
				discordAliases = JSON.parse(data);
			} catch (err) {
				console.log("Failed to parse discordAliases")
				console.log(err)
			}
	});
}


//художественный фильм спиздили
String.prototype.format = function () {
  var args = arguments;
  return this.replace(/{([0-9]+)}/g, function (match, index) {
    return typeof args[index] == 'undefined' ? match : args[index];
  });
};

function getUsersAlias(userId) {
	return discordAliases[userId] ? discordAliases[userId].alias : undefined
}

//shortcut for text
function getPhrase(code) {
	return phrases[code] && phrases[code][config.language] ? phrases[code][config.language] : phrases.phraseError.ru + " " + code
	
}

//checking if account id is valid
function validAccId(id) {
	return /^\d\d\d\d\d\d\d\d\d$/.test(id)
}

let criteriae = ["wins", "games", "winrate", "gpm", "xpm", "kills", "deaths", "kda", "lasthit", "leaver", "damage", "heal", "tower"]

function calcAvg(a, param) {
	let sum = a.reduce((a,b) => {
		let newObj = {}
		newObj[param] = a[param] + b[param] 		
		return newObj 
	})[param]
	return sum/a.length
}

//fns for getting the proper stat from WL info
let fns = {
	"wins" : (a) => {
		a.data = a.data.win
		return a
	},
	
	"games": (a) => {
		a.data = a.data.win + a.data.lose
		return a
	},
	
	"winrate": (a) => {
		a.data = a.data.win / (a.data.lose + a.data.win) * 100
		return a
	},

	"gpm": (a) => {
		a.data = calcAvg(a.data, "gold_per_min")
		return a
	},

	"xpm": (a) => {
		a.data = calcAvg(a.data, "xp_per_min")
		return a
	},

	"kills": (a) => {
		a.data = calcAvg(a.data, "kills")
		return a
	},

	"deaths": (a) => {
		a.data = calcAvg(a.data, "deaths")
		return a
	},

	"kda": (a) => {
		a.data = (calcAvg(a.data, "kills") + calcAvg(a.data, "assists")) / calcAvg(a.data, "deaths")
		return a
	},

	"lasthit": (a) => {
		a.data = calcAvg(a.data, "last_hits")
		return a
	}, 

	"leaver": (a) => {
		a.data = a.data.some((game) => {
			return game.leaver_status
		})
		return a
	},

	"damage": (a) => {
		a.data = calcAvg(a.data, "hero_damage")
		return a
	},

	"heal": (a) => {
		a.data = calcAvg(a.data, "hero_healing")
		return a
	}, 

	"tower": (a) => {
		a.data = calcAvg(a.data, "tower_damage")
		return a
	}
}

async function getLeaderboard(criteria, limit) {
	let urlexts = []

	const wlCrit = criteriae.slice(0,3).includes(criteria)

	const urlExtEnding = wlCrit ? "wl" : "recentMatches" 

	for(let alias of leaderboard) {
		urlexts.push({urlext: `players/${aliases[alias]}/${urlExtEnding}`, alias: alias})
	}

	results = await fetchMany(urlexts);

	results = results.map(fns[criteria]).sort((a,b) => { return b.data - a.data})

	if (limit!==0) {
		results = results.slice(0, limit)
	}

	return results
}

function stringifyLeaderboard(criteria, leaderboard) {
	if(leaderboard.length == 0)
		return getPhrase("noParticipants")
	let res = criteria + "\n"
	for(let pos of leaderboard) {
		res += (leaderboard.indexOf(pos) + 1) + " " + pos.alias + " " + pos.data + "\n"
	}
	return res
}

function stringifyStats(stats) {
	let res = "Stats for " + stats.alias + "\n"
	for (let crit in stats) {
		if (criteriae.includes(crit)) {
			res += crit + ": " + stats[crit].data + "\n"
		}
	} 
	return res
}


//[Cache]


// load cache on starting the bot if cacheFilename is provided earlier
if (config.cacheFilename)
	cache.loadLatest()

loadAliases()

// start dumping cache periodically after some time
setTimeout(() => {
	setInterval(() => {
		cache.dump();
	}, config.cacheDumpInterval)
}, config.cacheDumpInterval)



//[Calls to API and related stuff]

// gets a url extension to the API; checks for cache for such a request and either fetches a reques
// or gets it from memory. returns a promise

async function fetch(urlextension, forceupdate=false){
	console.log("Geting " + urlextension)
	console.log("Forced update: " + forceupdate)

	let noCache = cache.data[urlextension] == undefined

	if (noCache)
		console.log("No cache found")

	cacheExpired = false;

	if (!noCache) {
		cacheExpired =  !cache.data[urlextension].permanent && ((Date.now() - cache.data[urlextension].timestamp) > config.cacheLifetime)
		if (cacheExpired)
			console.log("Cache expired")
	}

	permanent = /^matches/.test(urlextension) || urlextension === "heroes"

	if (forceupdate || noCache || cacheExpired) {
		console.log("Requesting " + urlextension + "...")
		let result = await axios.get(config.APIURL + urlextension)
		console.log("Done " + urlextension)
		if (result.status != 200) {
			console.log("Fetch failed: " + result.status)
			throw new Error();
		}
		
  	let json =  result.data;
  	
  	if (permanent) 
  		console.log("Caching " + urlextension + " permanently")
  	
  	cache.data[urlextension] = {
  		timestamp: Date.now(),
  		data: json,
  		permanent: permanent
  	}
	}

	return cache.data[urlextension].data
}

async function fetchMany(urlexts) {
	if(urlexts.length >= config.maxSimultFetch){
		console.log("Attempted")
	}

	let promises = []
	let results = []

	console.log("Fetching " + urlexts.length	+ " urls")

	urlexts.forEach((req)=>{
		promises.push(fetch(req.urlext).then((res)=>{
			req.data = res
			results.push(req)
		}))
	})

	await Promise.all(promises).then((res) => {
		console.log("Collected " + urlexts.length	+ " urls")
	});

	return results
}

let info;

fs.readFile('./commands.txt', 'utf8', function (err,data) {
  if (err) {
  	return console.log(err);
  }
  info = data;
});

//[Message handling]

class Command {
	constructor(pseudos, handler, enabled) {
		this.pseudos = pseudos;

		this._handler = handler;

		this.enabled = enabled;

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

		commands.push(this)

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
		leaderboard.push(args[0])
		dumpAliases()
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

new Command(["leaderboard", "all"], async (args, userId) => {
	let criteria = args.length > 0 ? args[0] : criteriae[0]

	if (!criteriae.includes(criteria))
		return getPhrase("noSuchCriteria")

	let results = await getLeaderboard(criteria, 0)

	return stringifyLeaderboard(criteria, results)

}, true)

new Command(["leaders", "l"], async (args, userId) => {
	let criteria = args.length > 0 ? args[0] : criteriae[0]

	if (!criteriae.includes(criteria))
		return getPhrase("noSuchCriteria")

	let results = await getLeaderboard(criteria, 3)

	return stringifyLeaderboard(criteria, results)

}, true)

new Command(["best"], async (args, userId) => {
	let criteria = args.length > 0 ? args[0] : criteriae[0]

	if (!criteriae.includes(criteria))
		return getPhrase("noSuchCriteria")

	let results = await getLeaderboard(criteria, 1)

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

client.on("messageCreate", async function (message) {
  if (message.author.bot) return;
  if (!message.content.startsWith(config.prefix)) return;

  const commandBody = message.content.slice(config.prefix.length);
  const args = commandBody.split(' ');
  const command = args.shift().toLowerCase();

  try {
  	handle(command, args, message.member.user.id).then((res)=>{
			message.reply(res);
  	})
  } catch (err) {
  	message.reply(err.toString())
  }
});

client.login(keyObj.secret_key)