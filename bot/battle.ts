import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, ColorResolvable, ComponentType, Embed, EmbedBuilder, GuildMember, Interaction, InteractionCollector, Message, StringSelectMenuInteraction, User } from "discord.js"
import { Fighter, Player, Battle, skill, Item } from "../types"
import { fighters, items, userData } from "./init"
import { promptUser, saveData, pagedEmbed, findUser, calculateDamage, calculateHeal } from "../util/helper-functions"
import { SelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "@discordjs/builders"
import { handleAttack, handleBuff, handleDebuff, handleHeal, handleItem } from "../util/battle-functions"
export const battles: Record<string, Battle> = {}
export const skillMappings: Record<Fighter['type'], string> = {
    fire: "magic",
    water: "magic",
    ice: "magic",
    lightning: "magic",
    strength: "strength",
    support: "magic"
}

const appendSkillButtons = (skills: Record<string, skill> | undefined, select: StringSelectMenuBuilder, fighter: Fighter, attackedPlayer: Player, attacker: Player) => {
    for (const skill in skills) {
        switch (skills[skill].method) {
            case "attack":
                const damage = calculateDamage(skills[skill].damage, skills[skill].type, fighter, attackedPlayer, attacker)
                select.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(skills[skill].name)
                        .setDescription(`${skills[skill].description} ${skills[skill].spCost}SP`)
                        .setValue(`attack|${damage}|${skills[skill].spCost}|${skills[skill].type}|${skills[skill].name}`)
                )
                break
            case "debuff":
            case "buff":
                const { amount, length } = skills[skill].buffValues!
                select.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(skills[skill].name)
                        .setDescription(`${skills[skill].description} ${skills[skill].spCost}SP`)
                        .setValue(`${skills[skill].method}|${amount}|${length}|${skills[skill].spCost}|${skills[skill].type}|${skills[skill].name}|${skills[skill].buffValues!.stat}`)
                )
                break
            case "heal":
                const healAmount = calculateHeal(skills[skill].damage, attacker)
                select.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(skills[skill].name)
                        .setDescription(`${skills[skill].description} ${skills[skill].spCost}SP`)
                        .setValue(`heal|${healAmount}|${skills[skill].spCost}|${skills[skill].type}|${skills[skill].name}`)
                )
                break
        }
    }
}

const appendFighterSelect = (player: Player, select: StringSelectMenuBuilder) => {
    for (const fighter of player.fighters) {
        if (fighter.name === player.selectedFighter!.name) continue
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(fighter.name)
                .setValue(fighter.name.toLowerCase())
        )
    }
}

const appendItemSelect = (player: Player, otherPlayer: Player, select: StringSelectMenuBuilder) => {
    if (player.inventory.length <= 0) {
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel("None")
                .setValue("No items")
        )
        select.data.disabled = true
        return
    }
    for (const item of player.inventory) {
        console.log(`${item.name}|${item.type}|${item.amount}${item.reflectType}`)
        const testString = item.reflectType
        console.log(testString)
        select.addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel(item.name)
                .setDescription(item.description)
                .setValue(`${item.name}|${item.type}|${item.amount}|${item.reflectType}`)
        )
    }
}

export const battleSetup = async (client: Client, msg: Message, args: string[]) => {
    if (!msg.channel.isSendable()) return
    if (battles[msg.channel.id]) return await msg.channel.send("battle already happening sorry") && false
    const otherPlayerM = await findUser(args, msg, true) as GuildMember
    if (!otherPlayerM) return msg.channel.send("no one found")
    const otherPlayer = otherPlayerM.user
    // if (!otherPlayer || otherPlayer.id === msg.author.id) return
    if (!userData[otherPlayer.id]) return await msg.channel.send("player does not have any fighters") && false
    if (!userData[otherPlayer.id].selectedFighter) return await msg.channel.send("other player has no fighter equipped") && false
    let answer = await promptUser(msg, args, `${otherPlayer.toString()} ${msg.member?.displayName} has challenged you to a duel! What do you say (y/n)`, otherPlayer)
    if (!answer) return
    answer = answer.toLowerCase()
    if (answer === "n" || answer === "no") return
    else if (answer === "y" || answer === "yes") {
        battles[msg.channel.id] = new Battle(userData[msg.author.id], userData[otherPlayer.id], 1)
        //set names in the ui to the proper display names 
        battles[msg.channel.id].player1.name = msg.member!.displayName
        battles[msg.channel.id].player2.name = otherPlayerM.displayName
        return true
    } else return false
}

export const makeBattleUI = async (client: Client, msg: Message, args: string[], battle: Battle, desc?: string) => {
    const profile = await battle.turnUser.fetch()
    const color = profile.accentColor ?? "Blurple"
    const otherPlayer = battle.turnUser.id === battle.player1.id ? battle.player2 : battle.player1
    if (!battles[msg.channel.id]) return
    const player1StatsString = `Health: ${battle.player1.health.toString()}\n\nSP: ${battle.player1.sp.toString()}\n\nFighter: ${battle.player1.selectedFighter!.name ?? "Unselected"}`
    const player2StatsString = `Health: ${battle.player2.health.toString()}\n\nSP: ${battle.player2.sp.toString()}\n\nFighter: ${battle.player2.selectedFighter!.name ?? "Unselected"}`
    const embed = new EmbedBuilder()
        .setTitle(`${battle.player1.name} Vs ${battle.player2.name}`)
        .setColor(color)
        .setDescription(desc ?? "Waiting...")
        .setThumbnail(battle.turnUser.avatarURL())
        .addFields({ name: battle.player1.name, value: player1StatsString, inline: true })
        .addFields({ name: battle.player2.name, value: player2StatsString, inline: true })
        .setFooter({ text: battle.turnString, iconURL: battle.turnUser.avatarURL() as string })
    const attackSelect = new StringSelectMenuBuilder()
        .setCustomId(`ability`)
        .setPlaceholder('Ability')
    appendSkillButtons(battle.turnUser.selectedFighter?.skills, attackSelect, battle.turnUser.selectedFighter!, otherPlayer, battle.turnUser)
    const defendButton = new ButtonBuilder()
        .setCustomId(`defend`)
        .setLabel("Defend")
        .setStyle(ButtonStyle.Secondary)
    const fighterSelect = new StringSelectMenuBuilder()
        .setCustomId(`change`)
        .setPlaceholder("Change Fighter")
    appendFighterSelect(battle.turnUser, fighterSelect)
    const itemSelect = new StringSelectMenuBuilder()
        .setCustomId("item")
        .setPlaceholder("Item")
    appendItemSelect(battle.turnUser, otherPlayer, itemSelect)
    return { embed, attackSelect, defendButton, fighterSelect, itemSelect }
}


export const battleGame = async (client: Client, msg: Message, args: string[], battle: Battle, embed: EmbedBuilder, attackSelect: StringSelectMenuBuilder, defenseButton: ButtonBuilder, fighterSelect: StringSelectMenuBuilder, itemSelect: StringSelectMenuBuilder) => {
    if (!msg.channel.isSendable()) return
    const attackRow = new ActionRowBuilder<SelectMenuBuilder>()
        .addComponents(attackSelect)
    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(defenseButton)
    const fighterRow = new ActionRowBuilder<SelectMenuBuilder>()
        .addComponents(fighterSelect)
    const itemRow = new ActionRowBuilder<SelectMenuBuilder>()
        .addComponents(itemSelect)
    const message = await msg.channel.send({ embeds: [embed], components: [attackRow, buttonRow, fighterRow, itemRow] })
    const menuCollector = message.createMessageComponentCollector({ componentType: ComponentType.StringSelect })
    const buttonCollector = message.createMessageComponentCollector({ componentType: ComponentType.Button })
    const timer = setTimeout(() => {
        if (!msg.channel.isSendable()) return
        msg.channel.send("Battle ending due to inactivity")
        menuCollector.stop()
        buttonCollector.stop()
        msg.edit({ embeds: [embed], components: [] })
        delete battles[msg.channel.id]
    }, 60000)
    menuCollector.on('collect', async i => {
        const action = i.customId
        const abilityType = i.values[0].split("|")[0]
        if (i.user.id === battle.turnUser.id) {
            const otherPlayer = battle.turnUser.id === battle.player1.id ? battle.player2 : battle.player1
            if (action === "ability") {
                if (abilityType === "attack") {
                    await handleAttack(i, battle, msg, otherPlayer, timer, args, client, menuCollector, attackRow, buttonRow, fighterRow, itemRow)
                }
                if (abilityType === "buff") {
                    await handleBuff(i, battle, msg, timer, args, client, attackRow, buttonRow, fighterRow, itemRow)
                }
                if (abilityType === "debuff") {
                    await handleDebuff(i, battle, msg, timer, otherPlayer, args, client, attackRow, buttonRow, fighterRow, itemRow)
                }
                if (abilityType === "heal") {
                    await handleHeal(i, battle, msg, timer, args, client, attackRow, buttonRow, fighterRow, itemRow)
                }
            }
            if (action === "item") {
                await handleItem(i, battle, msg, timer, otherPlayer, args, client, menuCollector, attackRow, buttonRow, fighterRow, itemRow)
            }
            if (action === "change") {
                const fighterName = i.values[0]
                const chosenFighter = battle.turnUser.fighters.find((e) => e.name.toLowerCase() === fighterName)
                if (!chosenFighter) return i.reply({ content: "Error occured picking fighter", ephemeral: true })
                let desc = `${battle.turnUser.name} switched to ${chosenFighter.name}`
                battle.turnUser.selectedFighter = chosenFighter
                const ui = await makeBattleUI(client, msg, args, battle, desc)
                attackRow.setComponents(ui!.attackSelect)
                fighterRow.setComponents(ui!.fighterSelect)
                i.update({ embeds: [ui!.embed], components: [attackRow, buttonRow, fighterRow] })
            }
        }
    })
    buttonCollector.on('collect', async i => {
        const idArgs = i.customId.split("|")
        const action = idArgs[0]
        if (i.user.id === battle.turnUser.id) {
            if (action === "defend") {
                battle.turnUser.defending = true
                let desc = `${battle.turnUser.name} chooses to defend`
                const info = battle.endTurn()
                if (info) desc += `\n${info}`
                const ui = await makeBattleUI(client, msg, args, battle, desc)
                attackRow.setComponents(ui!.attackSelect)
                fighterRow.setComponents(ui!.fighterSelect)
                i.update({ embeds: [ui!.embed], components: [attackRow, buttonRow, fighterRow] })
            }
        }
    })
}

