const config = require('./config.json')
const fs = require('fs')

exports.dump = function(data){
	console.log("Dumping cache")
	fs.writeFile(config.cacheFilename, JSON.stringify(data), (err) => {
		if (err)
			console.log(err)
	})
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


