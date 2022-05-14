const config = require('./config.json')
const fs = require('fs')


exports.data = {}

exports.dump = function(){
	fs.writeFile(config.cacheFilename, JSON.stringify(this.data), (err) => {
		if (err)
			console.log(err)
	})

	console.log("Dumping cache")
}

exports.loadLatest = function(){
	fs.readFile(config.cacheFilename, 'utf8', function (err,data) {
			if (err) {
				console.log(err);
			}
			this.data = JSON.parse(data);
	});
	console.log("Loading cache")
}


