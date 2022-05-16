const Discord = require('discord.js')


const keyObj = require('./secret_key.json')
const config = require('./config.json')

const {Alias} = require('./alias.js')
const fns = require('./fns.js')
const utility = require('./utility.js')

//brainlet.jpg
String.prototype.format = function () {
  var args = arguments;
  return this.replace(/{([0-9]+)}/g, function (match, index) {
    return typeof args[index] == 'undefined' ? match : args[index];
  });
};

const client = new Discord.Client({intents: ["GUILDS", "GUILD_MESSAGES"]})




// load cache on starting the bot if cacheFilename is provided earlier
if (config.cacheFilename)
	cache.loadLatest()

//[Message handling]



client.on("messageCreate", async function (message) {
  if (message.author.bot) return;
  if (!message.content.startsWith(config.prefix)) return;

  const commandBody = message.content.slice(config.prefix.length);
  const args = commandBody.split(' ');
  const command = args.shift().toLowerCase();

  try {
  	handle(command, args, message.member.user.id).then((res)=>{
			message.reply(res);
  	})
  } catch (err) {
  	message.reply(err.toString())
  }
});

client.login(keyObj.secret_key)