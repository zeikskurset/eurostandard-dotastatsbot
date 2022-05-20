const Discord = require('discord.js')
const keyObj = require('./secret_key.json')
const config = require('./config.json')
const app = require('./app.js')
const client = new Discord.Client({intents: ["GUILDS", "GUILD_MESSAGES"]})

client.on("messageCreate", async function (message) {
  if (message.author.bot) return;
  if (!message.content.startsWith(config.prefix)) return;

  const commandBody = message.content.slice(config.prefix.length);
  const args = commandBody.split(' ').filter((arg) => {
    return arg != ""
  });
  const command = args.shift().toLowerCase();

  try {
  	app.handle(command, args, message.member.user.id).then((res)=>{
			message.reply(res);
  	})
  } catch (err) {
  	message.reply(err.toString())
  }
});

client.login(keyObj.secret_key)