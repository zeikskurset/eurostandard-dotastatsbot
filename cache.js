const config = require('./config.json')
const fs = require('fs')


exports.data = {}

exports.dump = function(){
	console.log("Dumping cache")
	fs.writeFile(config.cacheFilename, JSON.stringify(this.data), (err) => {
		if (err)
			console.log(err)
	})
}

exports.loadLatest = function(){
	console.log("Loading cache")
	fs.readFile(config.cacheFilename, 'utf8', function (err,data) {
			if (err) {
				console.log(err);
			}
			try {
				this.data = JSON.parse(data);
			} catch (err) {
				console.log("Failed to parse cache")
				console.log(err)
			}
	});
}


