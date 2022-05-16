function calcAvg(a, param) {
	let sum = a.reduce((a,b) => {
		let newObj = {}
		newObj[param] = a[param] + b[param] 		
		return newObj 
	})[param]
	return sum/a.length
}

//transform json into needed parameter
module.exports = {
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