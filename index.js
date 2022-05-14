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

let criteriae = ["wins", "games", "winrate", "net", "gpm", "xpm", "kills", "deaths", "kda", "leaver", "damage"]
let timelimits = ["alltime", "recent", "today"]

//fns for getting the proper stat from WL info
let fns = {
	"wins" : (a) => {
		a.mainCrit = a.json.win
	},
	
	"games": (a) => {
		a.mainCrit = a.json.win + a.json.lose
	},
	
	"winrate" : (a) => {
		a.mainCrit = a.json.win / (a.json.lose + a.json.win) * 100
	}
}


//[Cache]


// load cache on starting the bot if cacheFilename is provided earlier
if (config.cacheFilename)
	cache.loadLatest()

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
		cacheExpired =  !cache.data[urlextension].permanent && ((Date.now() - cache.data[urlextension].timestamp) > cacheLifetime)
		if (cacheExpired)
			console.log("Cache expired")
	}

	permanent = /^matches/.test(urlextension) || urlextension === "heroes"

	if (forceupdate || noCache || cacheExpired) {
		console.log("Requesting " + urlextension + "...")
		let result = await axios.get(APIURL + urlextension)
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

	return cache[urlextension].data
}


//kinda deprecated or smth
async function fetchMany(urlexts) {
	let promises = []
	let results = []

	console.log("Fetching ")

	urlexts.forEach((urlext)=>{
		promises.push(fetch(urlext).then((res)=>{
			results.push(res)
		}))
	})

	await Promise.all(promises).then((res) => {
		console.log("Collected " + urlexts.length	+ " urls")
	});

	return results
}

// grabs a part of game caching queue and requests it for caching. !!! Doesnt check
// whether a game is already cached, so that should be fixed

/*
function fetchBatchFromQueue(){
	let batch = queue.length > maxCallsPerMinute ? queue.slice(0, maxCallsPerMinute) : queue

	queue = queue.slice(batch.length)

	if(queue.length === 0) {
		setTimeout(() => {
			queueActive = false;
			clearInterval(queueInterval);
		}, 60000)
	}

	console.log("Fetching " + batch.length + " games")

	batch.forEach((game) => {
		fetch("matches/"+game.match_id)
	})
}

*/

//[Getting info in advance]

let heroes = fetch("heroes");

let info;

fs.readFile('./commands.txt', 'utf8', function (err,data) {
  if (err) {
  	return console.log(err);
  }
  info = data;
});


//[Message handling]

function Command(pseudos, handler, enabled) {
	this.pseudos = pseudos;

	this._handler = handler;

	this.enabled = enabled;

	this.fits = function(command) {
		return this.pseudos.any((pseudo) => {
			return pseudo == command
		})
	}

	this.handle = function(args, userId) {
		if (!this.enabled) {
			return getPhrase('commandDisabled')
		} else return this._handler(args, userId);
	}

	commands.push(this)
}

let handle = function(commandText, args, userId) {
	let fitting = commands.filter((command) => {
		command.fits(commandText)
	})
	if (fitting.length === 0) return getPhrase("commandNotFound")
	//multiple found?
	return fitting[0].handle(args)
}

//actual commands

Command(["commands", "help"], (args, userId)=>{
	return info;
}, true)

Command(["deletecache"], (args, userId)=>{
	Object.entries(cache.data).forEach((urlext, data) => {
		if(!data.permanent) {
			cache[urlext] = undefined
		}
	})
	return getPhrase("cacheCleared")
}, true)

Command(["iam"], (args, userId)=>{
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
		return getPhrase("yourAliasNowIs").format(args[0])
	}
}, true)

Command(["alias", "a"], (args, userId)=> {
	if (args.length < 2) 
		return getPhrase("seeUsage")
	if (validAccId(args[0])) 
		return getPhrase("invalidAlias")
	if (!validAccId(args[1])) 
		return getPhrase("invalidAccId")

	aliases[args[0]] = args[1];

	if(args.length == 2) 
		return getPhrase("aliasAdded").format(args[0], args[1])

	if(args.length === 3) {
		discordAliases[userId] = {alias: args[0], name: message.member.user.username}
		return getPhrase("aliasAddedWithDiscord").format(args[0], args[1])
	}

	if(args.length >= 4) {
		leaderboard.push(args[0])
		return getPhrase("aliasAddedWithDiscordAndLeaderboard").format(args[0], args[1])
	}
}, true)

Command(["enterleaderboard", "enter"])

client.on("messageCreate", async function (message) {

  

  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const commandBody = message.content.slice(prefix.length);
  const args = commandBody.split(' ');
  const command = args.shift().toLowerCase();

  message.reply(handle(command, args, message.member.user.id));

  //[Network-related commands]

  try {


  	if (queue.length === 0) {
	  	if (command === "leaderboard" || command === "all") {
	 	  	let paramIndices = getParamIndices(args[0], args[1])
	 			getLeaderboard(paramIndices.cInd, paramIndices.tInd).then((results) => {
	 				console.log("Replying")
	 				console.log(results)
	 				message.reply(JSON.stringify(results))	
	 			}); 	  	
	  	}
  	}	else {
  		message.reply("В данный момент бот прогружает игры и не может выполнять ряд команд.");
  	}
	} catch (error) {
		console.log(error)
		message.reply("Упс, что-то пошло не так. Вероятно превышено число запросов к API")
	}

  if(command === "enterleaderboard" || command === "enter") {
  	let alias = args.length > 0 ? args[0] : getUsersAlias();
  	if (alias == undefined) {
  		message.reply("Привяжите алиас или укажите его в команде")
  		return
  	}
  	leaderboard.push(alias)
  	message.reply("Вы теперь участник лидерборда")
  }




});

client.login(keyObj.secret_key)