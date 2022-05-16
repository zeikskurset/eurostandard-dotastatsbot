class Alias {
	constructor(name, accId){
		this.name = name
		this.accId = accId
		this.inLeaderboard = false

		this.hasDiscordIdBound = function() {
			return typeof this.discordId == 'undefined'
		}
		
		return this
	}
}

module.exports = {Alias}
