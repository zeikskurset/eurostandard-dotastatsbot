module.exports = class Alias {
	constructor(app, name, accId, discordId, enterLeaderboard=false){
		this.name = name
		this.accId = accId
		this.discordId = discordId
		this.inLeaderboard = enterLeaderboard

		this.hasDiscordIdBound = function() {
			return typeof this.discordId == 'undefined'
		}

		app.users = app.users.filter((user) => {
			return user.name !== name
		})

		app.users.push(this)
		app.dumpUsers()

		return this
	}
}
