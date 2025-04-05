import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ComponentType, User } from "discord.js"
import { userData } from "../bot/init"
import fs from 'fs'
import { Fighter, Player, skill } from "../types"
export const promptUser = async (msg: Message, args: string[], prompt: string, prompted: User) => {
    let m
    if (msg.channel.isSendable()) {
        await msg.channel.send(prompt)
        try {
            const response = await msg.channel.awaitMessages({ filter: m => m.author.id === prompted.id, time: 10000, errors: ['time'], max: 1 })
            m = response.at(0)
        } catch (err: any) {
            msg.channel.send("you're slow")
        }
        if (!m) return
        return m.content
    }
}

export async function pagedEmbed(msg: Message, embeds: EmbedBuilder[], row: ActionRowBuilder<ButtonBuilder>) {
    if (!msg.channel.isSendable()) return
    let pageNumber = 0
    const maxPageNumber = embeds.length - 1
    if (pageNumber === maxPageNumber) row.components[1].setDisabled(true)
    const message = await msg.channel.send({ embeds: [embeds[0]], components: [row] })
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button })
    collector.on('collect', i => {
        if (i.user.id !== msg.author.id) return i.reply({ content: "not your embed", ephemeral: true })
        if (i.customId === "back" && pageNumber !== 0) {
            pageNumber--
            row.components[1].setDisabled(false)
            if (pageNumber === 0) row.components[0].setDisabled(true)
            i.update({ embeds: [embeds[pageNumber]], components: [row] })
        }
        else if (i.customId === "forward") {
            pageNumber++
            row.components[0].setDisabled(false)
            if (pageNumber === maxPageNumber) row.components[1].setDisabled(true)
            i.update({ embeds: [embeds[pageNumber]], components: [row] })
        }
    })
}


export const saveData = () => {
    fs.writeFileSync('./data/user-data.json', JSON.stringify(userData))
}

export const executeChecks = (msg: Message) => {
    if (!userData[msg.author.id]) return false
    return true
}
//old function from old bot that's why it's bad
export const findUser = async function (args: string[], msg: Message, member: boolean) {
    if (!msg.channel.isSendable()) return
    if (!args[1]) return;
    if (args[1].toLowerCase() === "random!") return member ? msg.guild?.members.cache.random() : msg.guild?.members.cache.random()?.user
    let x = args[1].toLowerCase()
    let sentmatches = []
    let matches = []
    let user;
    if ((msg.mentions.members?.size ?? 0) > 0) {
        if (member === true) {
            user = msg.mentions.members?.first()
            return user
        }
        else {
            return user = msg.mentions.members?.first()?.user
        }
    }
    if (!msg.guild) return
    for (let i = 0; i < msg.guild.members.cache.size; i++) {
        if (msg.guild.members.cache.at(i)?.nickname?.toLowerCase().startsWith(x) || msg.guild.members.cache.at(i)?.user.username?.toLowerCase().startsWith(x) || msg.guild.members.cache.at(i)?.user.globalName?.toLowerCase().startsWith(x)) {
            sentmatches.push(msg.guild.members.cache.at(i)?.user);
            let number = sentmatches.length;
            matches.push(`${number}. ${msg.guild.members.cache.at(i)?.displayName}`);
            user = msg.guild.members.cache.at(i)?.user;
        }
    }

    if (!user) return

    let newmatches = matches.join("\n\n")
    if (matches.length > 1) {
        await msg.channel.send(`More than one user found. Type the NUMBER of the user you want.     
${newmatches}`)
        let a = await msg.channel.awaitMessages({ filter: m => m.author.id === msg.author.id, max: 1 })
        let m = a.at(0)
        if (!m) return
        let number = Number(m.content) - 1
        if (isNaN(number) || number > sentmatches.length || number < 0) {
            await msg.channel.send("invalid")
            return
        }
        user = sentmatches[number]
    }
    else {
        user = user
    }
    if (member === undefined || member !== true) {
        return user
    }
    if (!user) return
    else {
        return msg.guild.members.cache.get(user.id)
    }
}

export const range = (lowest: number, highest: number) => {
    return Math.floor(Math.random() * (lowest - highest + 1)) + highest
}

const calculateToAdd = (damageType: skill['type'], fighter: Fighter, attacker: Player) => {
    let toAdd = 0
    const skillMappings: Record<Fighter['type'], string> = {
        fire: "magic",
        water: "magic",
        ice: "magic",
        lightning: "magic",
        strength: "strength",
        support: "magic"
    }
    if (attacker.buffs.buffed && attacker.buffs.attack) {
        toAdd += Math.round(attacker.buffs.attack.amount * 0.5)
    }
    if (skillMappings[fighter.type] === "magic" && skillMappings[damageType] === "magic") {
        toAdd += Math.round(fighter.magic * 0.3)
    } else if (skillMappings[fighter.type] === "strength" && skillMappings[damageType] === "strength") {
        toAdd += Math.round(fighter.strength * 0.3)
    }
    if (attacker.debuffs.debuffed === true && attacker.debuffs.attack) {
        toAdd -= Math.round(attacker.debuffs.attack.amount * 0.5)
    }
    return toAdd
}

const calculateToReduce = (attacked: Player, damage: number) => {
    let toReduce = 0
    if (attacked.buffs.buffed && attacked.buffs.defense) {
        toReduce += Math.round(attacked.buffs.defense.amount)
    }
    if (attacked.defending) {
        toReduce += Math.round(damage * 0.25)
    }
    if (attacked.debuffs.debuffed === true && attacked.debuffs.defense) {
        toReduce -= Math.round(attacked.debuffs.defense.amount * 0.5)
    }
    return toReduce
}

export const calculateDamage = (damage: skill['damage'], damageType: skill['type'], fighter: Fighter, attacked: Player, attacker: Player) => {
    const damageMappings = {
        light: range(3, 10),
        medium: range(10, 25),
        heavy: range(25, 50),
        extreme: range(50, 100)
    }
    let damagetoDo = damageMappings[damage]
    const toAdd = calculateToAdd(damageType, fighter, attacker)
    damagetoDo += toAdd
    const toReduce = calculateToReduce(attacked, damagetoDo)
    damagetoDo -= toReduce
    return damagetoDo
}

export const calculateHeal = (heal: skill['damage'], player: Player) => {
    const healMappings = {
        light: range(10, 25),
        medium: range(25, 50),
        heavy: range(50, 100),
        extreme: range(100, 200)
    }
    return healMappings[heal]
}
