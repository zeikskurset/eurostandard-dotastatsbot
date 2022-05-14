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
let wlfns = {
	
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

//I'll probably have to rework this later
async function getLeaderboard(cInd, tInd) {
  let urlext;

	let results = []
	let promises = []

	leaderboard.forEach((user) => {
		if (cInd < 3) {
			urlext = "players/" + aliases[user] + "/wl"
		} 
		if (cInd > 2) {
			urlext = "players/" + aliases[user] + "/matches"
		}
		if (tInd == 1) {
			urlext += "?limit=20"
		}
		if (tInd ==2) {
			urltext += "?date=1"
		}
		let newEntry = {alias: user}
		results.push(newEntry)
		promises.push(fetch(urlext).then((res)=>{
			newEntry.json = res
		}))
	})

	if (cInd < 3){
		await Promise.all(promises).then(() => {
			console.log("Applying functions for WL stats...")
			results.every(wlfns[cInd]);
		});
	}

	console.log("exiting getLeaderboard")
	console.log(results)
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

	this.handle = function(args) {
		if (!this.enabled) {
			return getPhrase('commandDisabled')
		} else return this._handler(args);
	}

	commands.push(this)
}

let handle = function(commandText, args) {
	let fitting = commands.filter((command) => {
		command.fits(commandText)
	})
	if (fitting.length === 0) return getPhrase("commandNotFound")
	//multiple found?
	return fitting[0].handle(args)
}

client.on("messageCreate", async function (message) {

  function getUsersAlias() {
  	return discordAliases[message.member.user.id] ? discordAliases[message.member.user.id].alias : undefined
  }

  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const commandBody = message.content.slice(prefix.length);
  const args = commandBody.split(' ');
  const command = args.shift().toLowerCase();

  if (command === "commands" || command === "help") {
  	message.reply(info)
  }

  if (command === "deletecache" || command === "dc") {
  	cache = {}
  	message.reply("Кэш очищен");
  }

  if (command === "cachelifetime") {
  	cacheLifetime = args.length > 0 ? args[0] : cacheLifetime
  	message.reply("Кэш хранится " + cacheLifetime + "мс")
  }

  if (command === "iam"){
  	if (args.length === 0) {
  		if (discordAliases[message.member.user.id] != undefined) {
  			message.reply("Вы - " + discordAliases[message.member.user.id].alias)
  		} else {
  			message.reply("У вас не привязан алиас")
  		}
  	} else {
  		if(aliases[args[0]] == undefined) {
  			message.reply("Такого алиаса нет")
  			return
  		}
  		discordAliases[message.member.user.id] = {alias: args[0], name: message.member.user.username}
  		message.reply("Вы теперь - " + args[0])
  	}
  }

  if (command === "whois") {
  	if (args.length === 0) {
  		message.reply("Нужно указать алиас")
  		return
  	}

	let found = false;
	let res;

  	Object.entries(discordAliases).forEach(([userid, data]) => {
  		if(data.alias === args[0]) {
  			found = true;
  			res = data.name;
  		}
  	})

  	if (!found) {
  		message.reply("Этот алиас не привязан")
  		return
  	}

  	message.reply(args[0] + " это " + res)
  }

  if (command === "forgetme") {
  	discordAliases[message.member.user.id] = undefined;
  	message.reply("От вашего аккаунта отвязан алиас");
  }


  if (command === "alias" || command === "a") {
  	if (args.length > 1) {

  		if (validAccId(args[0])) {
  			message.reply("Не удалось создать алиас " + args[0] + ", он может быть айди аккаунта")
  			return
  		} 
  		if (!validAccId(args[1])) {
  			message.reply(args[1] + " не является айди аккаунта")
  			return
  		}
  		
  		aliases[args[0]] = args[1];

  		let msgtext = args[0] + " теперь алиас для айди " + args[1];

  		if (args.length > 2 && (args[2] === "me")) {
  			discordAliases[message.member.user.id] = {alias: args[0], name: message.member.user.username}
  			msgtext += " привязанного к вашему аккаунту"
  		}

  		if (args.length > 3 && (args[3] === "enter")) {
  			leaderboard.push(args[0])
  			msgtext += " и участвующий в лидерборде"
  		}

  		message.reply(msgtext)
  		
  	} else message.reply("Нужно указать алиас и айди")
  }

  if (command === "aliases") {
  	message.reply(JSON.stringify(discordAliases))
  }

  //[Network-related commands]

  try {

  	if (command === "cachegames") {
  		let alias = args.length > 0 ? args[0] : getUsersAlias();
  		if (aliases[alias] == undefined) {
  			message.reply("Такого алиаса нет")
  			return
  		}
  		fetch("players/"+aliases[alias]+"/matches").then((res)=>{
  			queue.push(...res);
  			if (!queueActive) {
  				queueInterval = setInterval(fetchBatchFromQueue, 60000);
  				fetchBatchFromQueue();
  				queueActive = true;
  			}
  			message.reply("Начали сохранять данные о " + res.length + "играх");
  		})
  	}

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