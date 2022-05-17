const config = require('./config.json')
const cache = require('./cache.js')
const fs = require('fs')
const phrases = require('./text.json')

function getPhrase(code) {
	return phrases[code] && phrases[code][config.language] ? phrases[code][config.language] : phrases.phraseError.ru + " " + code
	
}

class App {
	constructor(){
		this.commands = []
		this.users = []
		this.cache = {}
		this.helpInfo = "commandsInfo failed to load"
		this.dotaconstants = {}

		if(config.cacheFilename)
			this.cache = cache.loadLatest()

		try {
			this.commandsInfo = JSON.parse(fs.readFileSync('./commands.json', 'utf8'))
		} catch (err) {
			console.log(err)
		}

		try {
			this.helpInfo = fs.readFileSync('./help.txt', 'utf8')
		} catch (err) {
			console.log(err)
		}

		try {
			this.users = JSON.parse(fs.readFileSync('./users.json', 'utf8'))
		} catch (err) {
			console.log(err)
		}

		try {
			this.dotaconstants.heroes = require('./dotaconstants/build/heroes.json')
			this.dotaconstants.items = require('./dotaconstants/build/items.json')
		} catch (err) {
			console.log(err)
		}

		this.dumpUsers = () => {
			try {
				fs.writeFileSync('./users.json', JSON.stringify(this.users))
			} catch (err) {
				console.log(err)
			}
		}

		this.addUser = (user) => {
			this.user = this.users.filter((u) => {
				return u.name !== user.name
			})
			this.users.push(user)
			this.dumpUsers()
		}

		this.getUserByAlias = (alias) => {
			return this.users.filter((user) => {
				return user.name === alias
			})[0]
		}

		this.getUserByDiscordId = (discordId) => {
			return this.users.filter((user) => {
				return user.discordId === discordId
			})[0]
		}

		this.getUserByAccId = (accId) => {
			return this.users.filter((user) => {
				return user.accId == accId
			})[0]
		}

		this.getLeaderboard = () => {
			return this.users.filter((user) => {
				return user.inLeaderboard
			})
		}

		this.handle = async function(commandText, args, userId) {
			let fitting = this.commands.filter((command) => {
				return command.fits(commandText)
			})
			if (fitting.length === 0) return getPhrase("commandNotFound")
			//multiple found?
			return await fitting[0].handle(args, userId)
		}

		this.addCommand = (command) => {
			this.commands.push(command)
		}
	}
}

class Command {
	constructor(pseudos, handler, enabled=true) {
		this.pseudos = pseudos;

		this._handler = handler;

		this.enabled = enabled;

		this.fits = function(command) {
			return this.pseudos.some((pseudo) => {
				return pseudo == command
			})
		}

		this.handle = function(args, userId) {
			try {
				if (!this.enabled) {
					return getPhrase("commandDisabled")
				}
				return this._handler(args, userId);
			} catch (err) {
				return err.toString().slice(0, 50)
			}
		}
	}
}

module.exports = {App, Command}