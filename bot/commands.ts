import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, ColorResolvable, ComponentType, Embed, EmbedBuilder, Message } from "discord.js"
import { Item, Player } from "../types"
import { fighters, userData, items } from "./init"
import { promptUser, saveData, pagedEmbed, executeChecks } from "../util/helper-functions"
import { battleGame, battles, battleSetup, makeBattleUI } from "./battle"
import { StringSelectMenuBuilder } from "@discordjs/builders"


export const test = (client: Client, msg: Message, args: string[]) => {
    if (msg.channel.isSendable()) {
        msg.channel.send("working")
    }
}

export const seeFighters = (client: Client, msg: Message, args: string[]) => {
    if (msg.channel.isSendable()) {
        msg.channel.send(JSON.stringify(fighters.fireGuy.skills))
    }
}

export const signUp = async (client: Client, msg: Message, args: string[]) => {
    if (!client.isReady()) return
    if (msg.channel.isSendable()) {
        if (userData[msg.author.id]) return msg.channel.send("already signed up")
        const answer = await promptUser(msg, args, "do you want to create a data profile? you will be given 5 fighters to start (y/n)", msg.author)
        console.log(answer)
        if (!answer) return
        if (answer === "no" || answer === "n") {
            msg.channel.send("too bad! creating a date profile with trash guy instead")
            userData[msg.author.id] = new Player(client, msg.author, 1, [fighters.trashGuy], 100, 100, 0, 100, 100, [], 0, 50)
            saveData()
        } else if (answer === "yes" || answer === "y") {
            userData[msg.author.id] = new Player(client, msg.author, 1, [fighters.fireGuy, fighters.waterGuy, fighters.iceGuy, fighters.physicalGuy, fighters.lightningGuy, fighters.supportGuy], 100, 100, 1, 100, 100, [], 0, 50)
            saveData()
            msg.channel.send("profile created")
        } else msg.channel.send("not an answer")
    }
}

export const reset = async (client: Client, msg: Message, args: string[]) => {
    if (!msg.channel.isSendable()) return
    if (!userData[msg.author.id]) return msg.channel.send("no data")
    delete userData[msg.author.id]
    saveData()
    msg.channel.send("data deleted")
}


export const displayFighters = async (client: Client, msg: Message, args: string[]) => {
    if (!msg.channel.isSendable()) return
    const embeds: EmbedBuilder[] = []
    const length = Object.keys(userData[msg.author.id].fighters).length
    const icon = msg.author.avatarURL() ?? undefined
    for (let i = 0; i < length; i++) {
        const fighter = userData[msg.author.id].fighters[i]
        let levelUpText = `${fighter.xpForLevelUp.toString()}XP until level up`
        if (fighter.xp >= fighter.xpForLevelUp) levelUpText = `${fighter.name} can level up!`
        const embed = new EmbedBuilder()
            .setColor("Blurple")
            .setTitle(fighter.name)
            .setAuthor({ iconURL: icon, name: msg.author.displayName })
            .setThumbnail(msg.author.avatarURL())
            .setDescription(`Level: ${fighter.level.toString()}, XP: ${fighter.xp.toString()}, ${levelUpText}`)
            .addFields({ name: "Strength", value: fighter.strength.toString() })
            .addFields({ name: "Magic", value: fighter.magic.toString() })
            .addFields({ name: "Dexterity", value: fighter.dexterity.toString() })
            .addFields({ name: "Luck", value: fighter.luck.toString() })
            .addFields({ name: "Skills", value: Object.keys(fighter.skills).map(skill => fighter.skills[skill].name).join(", ") })
            .setFooter({ text: `${i + 1}/${length}` })
        embeds.push(embed)
    }
    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("back")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
                .setLabel("◀"),
            new ButtonBuilder()
                .setCustomId("forward")
                .setStyle(ButtonStyle.Primary)
                .setLabel("▶")
        )

    pagedEmbed(msg, embeds, row)
}

export const displayStats = async (client: Client, msg: Message, args: string[]) => {
    if (!msg.channel.isSendable()) return
    if (!userData[msg.author.id]) return
    const player = userData[msg.author.id]
    const fetched = await msg.author.fetch()
    const icon = msg.author.avatarURL() ?? undefined
    const color: ColorResolvable = fetched.accentColor ?? "Blurple"
    let levelUpText = player.toLevelUp
    if (typeof levelUpText === 'number') {
        levelUpText = `${player.toLevelUp.toString()}XP until level up`
    }
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle("Stats")
        .setAuthor({ iconURL: icon, name: msg.member!.displayName })
        .setThumbnail(msg.author.avatarURL())
        .setDescription(`Level: ${player.level}, XP: ${player.xp}`)
        .addFields({ name: "HP", value: player.health.toString() })
        .addFields({ name: "SP", value: player.sp.toString() })
        .addFields({ name: "Fighters", value: player.fighters.length.toString() })
        .setFooter({ text: levelUpText })
    msg.channel.send({ embeds: [embed] })
}

export const levelUp = async (client: Client, msg: Message, args: string[]) => {
    if (!msg.channel.isSendable()) return
    if (!executeChecks(msg)) return
    const ownedFighterNames: string[] = []
    for (const fighter of userData[msg.author.id].fighters) {
        ownedFighterNames.push(fighter.name.toLowerCase())
    }
    let answer = await promptUser(msg, args, "which fighter would you like to level up?", msg.author)
    if (!answer) return
    answer = answer.toLowerCase()
    if (!ownedFighterNames.includes(answer)) return msg.channel.send("you do not own that")
    const selected = userData[msg.author.id].fighters.find(e => e.name.toLowerCase() === answer)
    if (!selected) return msg.channel.send("error occured")
    const currentSkills = Object.keys(selected.skills).length
    const leveledUp = selected.levelUp()
    if (!leveledUp) return msg.channel.send("Not enough XP")
    msg.channel.send(`${answer} has leveled up!`)
    if (Object.keys(selected.skills).length > currentSkills) {
        msg.channel.send(`${answer} learned a new skill!`)
    }
    saveData()
}

export const playerLevelUp = async (client: Client, msg: Message, args: string[]) => {
    if (!userData[msg.author.id] || !msg.channel.isSendable()) return
    const leveledUp = userData[msg.author.id].levelUp()
    if (!leveledUp) return msg.channel.send("not enough xp to level up")
    msg.channel.send("leveled up!")
}

export const selectFighter = async (client: Client, msg: Message, args: string[]) => {
    if (!msg.channel.isSendable()) return
    if (!userData[msg.author.id]) return msg.channel.send("you are not signed up")
    const ownedFighterNames: string[] = []
    const chosen = args.slice(1).join(" ").toLowerCase()
    for (const fighter of userData[msg.author.id].fighters) {
        ownedFighterNames.push(fighter.name.toLowerCase())
    }
    if (!ownedFighterNames.includes(chosen)) return msg.channel.send("you do not own that")
    const selected = userData[msg.author.id].fighters.find(e => e.name.toLowerCase() === chosen)
    userData[msg.author.id].selectedFighter = selected
    if (!selected) return msg.channel.send("could not equip fighter")
    msg.channel.send(`${selected.name} is now equipped!`)
    saveData()
}
export const shop = async (client: Client, msg: Message, args: string[]) => {
    if (!userData[msg.author.id] || !msg.channel.isSendable()) return
    const embeds: EmbedBuilder[] = []
    let embedPage = 1
    let currentEmbed = new EmbedBuilder()
        .setTitle("Item Shop")
        .setAuthor({ name: "🛒" })
        .setColor("Blurple")
    for (const item in items) {
        const itemInfo = items[item]
        if (currentEmbed.data.fields?.length === 25) {
            embeds.push(currentEmbed)
            currentEmbed = new EmbedBuilder()
            embedPage++
        }
        currentEmbed.addFields(
            { name: `${itemInfo.name}: $${itemInfo.price.toString()} `, value: itemInfo.description }
        )
            .setFooter({ text: `Page: ${embedPage.toString()}/${embeds.length + 1}` })
    }
    embeds.push(currentEmbed)
    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("back")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
                .setLabel("◀"),
            new ButtonBuilder()
                .setCustomId("forward")
                .setStyle(ButtonStyle.Primary)
                .setLabel("▶")
        )
    await pagedEmbed(msg, embeds, row)
}

export const inventory = async (client: Client, msg: Message, args: string[]) => {
    if (!userData[msg.author.id] || !msg.channel.isSendable() || !msg.member) return
    if (userData[msg.author.id].inventory.length <= 0) return msg.channel.send("nothing")
    const color: ColorResolvable = (await msg.author.fetch()).accentColor ?? "Blurple"
    const icon = msg.author.avatarURL() ?? undefined
    const inventory = userData[msg.author.id].inventory
    const embeds: EmbedBuilder[] = []
    let embedPage = 1
    let currentEmbed = new EmbedBuilder()
        .setTitle(`${msg.member.displayName}'s Inventory`)
        .setAuthor({ name: msg.member?.displayName, iconURL: icon })
        .setColor(color)
        .setThumbnail(msg.author.avatarURL())
    for (const item of inventory) {
        if (currentEmbed.data.fields?.length === 25) {
            embeds.push(currentEmbed)
            currentEmbed = new EmbedBuilder()
            embedPage++
        }
        currentEmbed.addFields(
            { name: item.name, value: item.owned.toString() }
        )
            .setFooter({ text: `Page: ${embedPage.toString()}/${embeds.length + 1}` })
    }
    embeds.push(currentEmbed)
    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("back")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true)
                .setLabel("◀"),
            new ButtonBuilder()
                .setCustomId("forward")
                .setStyle(ButtonStyle.Primary)
                .setLabel("▶")
        )
    await pagedEmbed(msg, embeds, row)
}

export const buyItem = async (client: Client, msg: Message, args: string[]) => {
    if (!userData[msg.author.id] || !msg.channel.isSendable()) return
    const wantedItem = args.slice(1).join(" ").toLowerCase()
    const item = Object.values(items).find(v => v.name.toLowerCase() === wantedItem)
    if (!item) return msg.channel.send("no item found")
    if (item.price > userData[msg.author.id].money) return msg.channel.send("you can't afford that")
    if ((userData[msg.author.id].ownsItem(item)?.owned ?? 0) > item.maxAmount) {
        return msg.channel.send("you have the max of that item")
    }
    userData[msg.author.id].addToInventory(item)
    msg.channel.send(`Purchased ${item.name}`)
}

export const battle = async (client: Client, msg: Message, args: string[]) => {
    if (!msg.channel.isSendable()) return
    if (!userData[msg.author.id]) return msg.channel.send("you are not signed up")
    if (!userData[msg.author.id].selectedFighter) return msg.channel.send("you need to select a fighter first")
    const setup = await battleSetup(client, msg, args)
    if (setup !== true) return msg.channel.send("battle not happening")
    await msg.channel.send("setting up battle")
    const ui = await makeBattleUI(client, msg, args, battles[msg.channel.id])
    if (!ui) return msg.channel.send("error making battle")
    battleGame(client, msg, args, battles[msg.channel.id], ui.embed, ui.attackSelect, ui.defendButton, ui.fighterSelect, ui.itemSelect)
}