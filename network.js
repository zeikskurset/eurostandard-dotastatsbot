const axios = require('axios')
const config = require('./config.json')
const cachemodule = require('./cache.js')
const fns = require('./fns.js')

const criteriae = config.criteriae

let fetchLeaderboard = async function(cache, leaderboard, criteria, playerlimit, gameslimit) {
	let urlexts = []

	const wlCrit = criteriae.slice(0,3).includes(criteria)

	const urlExtEnding = wlCrit ? "wl" : "recentMatches" 

	const urlParam = gameslimit == 0 ? "" : "?limit=" + gameslimit

	for(let user of leaderboard) {
		urlexts.push({urlext: `players/${user.accId}/${urlExtEnding}${urlParam}`, alias: user.name})
	}

	results = await fetchMany(cache, urlexts);

	results = results.map(fns[criteria]).sort((a,b) => { return b.data - a.data})

	if (playerlimit!==0) {
		results = results.slice(0, playerlimit)
	}

	return results
}

let fetch = async function(urlextension, cache){
	console.log("Geting " + urlextension)

	let noCache = cache[urlextension] == undefined

	if (noCache)
		console.log("No cache found")

	cacheExpired = false;

	if (!noCache) {
		cacheExpired =  !cache[urlextension].permanent && ((Date.now() - cache[urlextension].timestamp) > config.cacheLifetime)
		if (cacheExpired)
			console.log("Cache expired")
	}

	permanent = /^matches/.test(urlextension) || urlextension === "heroes"

	if (noCache || cacheExpired) {
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
	  	
	  	cache[urlextension] = {
	  		timestamp: Date.now(),
	  		data: json,
	  		permanent: permanent
	  	}

	  	cachemodule.dump(cache)
	}

	return cache[urlextension].data
}

let fetchMany = async function(cache, urlexts) {
	if(urlexts.length >= config.maxSimultFetch){
		console.log("Attempted fetching " + urlexts.length + " urls")
	}

	let promises = []
	let results = []

	console.log("Fetching " + urlexts.length	+ " urls")

	urlexts.forEach((req)=>{
		promises.push(fetch(req.urlext, cache).then((res)=>{
			req.data = res
			results.push(req)
		}))
	})

	await Promise.all(promises).then((res) => {
		console.log("Collected " + urlexts.length	+ " urls")
	});

	return results
}

module.exports = {fetch, fetchMany, fetchLeaderboard}