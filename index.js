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

  let sender = app.getUserByDiscordId(message.member.user.id)

  console.log("Got command: " + message.content + " from " + (sender ? sender.name : `??? (discord id: ${message.member.user.id})`))

  try {
  	app.handle(command, args, message.member.user.id).then((res)=>{
      console.log(`Answering to ${command}: ${res.slice(0, 40)}`)
			message.reply(res);
  	})
  } catch (err) {
  	message.reply(err.toString())
  }
});

client.login(keyObj.secret_key)