const config = require('./config.json')
const fs = require('fs')

exports.dump = function(data){
	console.log("Dumping cache")
	fs.writeFileSync(config.cacheFilename, JSON.stringify(data))
}

exports.loadLatest = function(){
	console.log("Loading cache")
	let res = {}
	try {
		res = JSON.parse(fs.readFileSync(config.cacheFilename, 'utf8'))
	} catch (err) {
		console.log(err)
	}
	return res
}


