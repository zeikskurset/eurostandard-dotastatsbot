const cache = require('./cache.js')
const axios = require('axios')

module.exports.criteriae = ["wins", "games", "winrate", "gpm", "xpm", "kills", "deaths", "kda", "lasthit", "leaver", "damage", "heal", "tower"]

module.exports.fetchLeaderboard = async function(leaderboard, criteria, playerlimit, gameslimit) {
	let urlexts = []

	const wlCrit = criteriae.slice(0,3).includes(criteria)

	const urlExtEnding = wlCrit ? "wl" : "recentMatches" 

	const urlParam = gameslimit == 0 ? "" : "?limit=" + gameslimit

	for(let alias of leaderboard) {
		urlexts.push({urlext: `players/${aliases[alias]}/${urlExtEnding}${urlParam}`, alias: alias})
	}

	results = await fetchMany(urlexts);

	results = results.map(fns[criteria]).sort((a,b) => { return b.data - a.data})

	if (playerlimit!==0) {
		results = results.slice(0, playerlimit)
	}

	return results
}

module.exports.fetch = async function(urlextension, forceupdate=false){
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

  	cache.dump()
	}

	return cache.data[urlextension].data
}

module.exports.fetchMany = async function(urlexts) {
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