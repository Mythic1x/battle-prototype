import { Client, GatewayIntentBits, Partials, Message } from 'discord.js'
import { commandArray, intialize } from "./bot/init"
import { commandType } from './types'
import { saveData } from './util/helper-functions'
require('dotenv').config()
const prefix = process.env.PREFIX as string
const commands: Map<string, commandType> = new Map()

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences


    ], partials: [Partials.Message, Partials.Channel, Partials.Reaction],
})

client.on('ready', async () => {
    console.log("bot on yay")
    client.guilds.cache.forEach(guild => {
        guild.channels.fetch()
        guild.members.fetch()
    })
    for (const command of commandArray) {
        commands.set(command.name, command)
    }
    await intialize(client)
})

client.on('messageCreate', async (msg: Message) => {
    const args = msg.content.slice(prefix.length).trim().split(" ")
    try {
        if (commands.has(args[0]) && msg.content.startsWith(prefix)) {
            const command = commands.get(args[0]) as commandType
            if (command.disabled === true) {
                if (msg.channel.isSendable()) return msg.channel.send("disabled")
            }
            command.run(client, msg, args)
        }
    } catch (err: any) {
        if (msg.channel.isSendable()) {
            msg.channel.send(err.toString())
        }
        console.log(err)
        return
    }
})

setInterval(() => saveData(), 300000)

client.login(process.env.TOKEN)