import { StringSelectMenuInteraction, Message, Client, InteractionCollector, ActionRowBuilder, SelectMenuBuilder, ButtonBuilder } from "discord.js"
import { makeBattleUI, battles, skillMappings } from "../bot/battle"
import { Battle, Player, Fighter, Item } from "../types"
import { saveData } from "./helper-functions"

export const handleAttack = async (
    i: StringSelectMenuInteraction,
    battle: Battle,
    msg: Message,
    otherPlayer: Player,
    timer: NodeJS.Timeout,
    args: string[],
    client: Client,
    menuCollector: InteractionCollector<StringSelectMenuInteraction> | InteractionCollector<StringSelectMenuInteraction<"cached">>,
    attackRow: ActionRowBuilder<SelectMenuBuilder>,
    buttonRow: ActionRowBuilder<ButtonBuilder>,
    fighterRow: ActionRowBuilder<SelectMenuBuilder>,
    itemRow: ActionRowBuilder<SelectMenuBuilder>
) => {
    const values = i.values[0].split("|").slice(1)
    const damage = Number(values[0])
    const spCost = Number(values[1])
    const type = values[2] as Fighter['type']
    const name = values[3]
    const dodgeChance = otherPlayer.selectedFighter!.dexterity * 0.5
    const critChance = battle.turnUser.selectedFighter!.luck * 0.3
    if (battle.turnUser.sp - spCost < 0) {
        return i.reply({ content: "You do not have enough SP", ephemeral: true })
    }
    let desc = ""
    battle.turnUser.sp -= spCost
    if ((skillMappings[type] === "magic" && otherPlayer.reflectingMagic === true) || skillMappings[type] === "strength" && otherPlayer.reflectingPhysical === true) {
        battle.turnUser.health -= damage
        desc = `${otherPlayer.name} reflected ${name} back at ${battle.turnUser.name}`
        //set whichever one reflected to false
        otherPlayer.reflectingMagic === true ? otherPlayer.reflectingMagic = false : otherPlayer.reflectingPhysical = false
    } else if (Math.random() * 100 <= dodgeChance) {
        desc = `${otherPlayer.name} dodged ${battle.turnUser.name}'s attack!`
    } else if (Math.random() * 100 <= critChance) {
        otherPlayer.health -= damage * 2
        desc = `Critical hit! ${battle.turnUser.name} hit ${otherPlayer.name} with ${name} for ${damage * 2}`
    } else {
        otherPlayer.health -= damage
        desc = `${battle.turnUser.name} hit ${otherPlayer.name} with ${name} for ${damage}`
    }
    if (otherPlayer.defending) otherPlayer.defending = false
    const endCheck = battle.checkForEnd()
    if (endCheck !== false && msg.channel.isSendable()) {
        msg.channel.send(endCheck)
        const ui = await makeBattleUI(client, msg, args, battle, desc)
        if (!ui) return
        i.update({ embeds: [ui.embed], components: [] })
        menuCollector.stop()
        delete battles[msg.channel.id]
        saveData()
        clearTimeout(timer)
        return
    }
    await handleEndTurn(i, battle, msg, args, timer, client, attackRow, buttonRow, fighterRow, itemRow, desc)
}

export const handleBuff = async (
    i: StringSelectMenuInteraction,
    battle: Battle,
    msg: Message,
    timer: NodeJS.Timeout,
    args: string[],
    client: Client,
    attackRow: ActionRowBuilder<SelectMenuBuilder>,
    buttonRow: ActionRowBuilder<ButtonBuilder>,
    fighterRow: ActionRowBuilder<SelectMenuBuilder>,
    itemRow: ActionRowBuilder<SelectMenuBuilder>
) => {
    const values = i.values[0].split("|").slice(1)
    const amount = Number(values[0])
    const length = Number(values[1])
    const spCost = Number(values[2])
    const type = values[3]
    const name = values[4]
    const toBuff = values[5] as "attack" | "defense" | "dexterity"
    let desc = ""
    if (battle.turnUser.sp - spCost < 0) {
        return i.reply({ content: "You do not have enough SP", ephemeral: true })
    }
    battle.turnUser.sp -= spCost
    if (battle.turnUser.buffs.buffed === true && battle.turnUser.buffs[toBuff].amount) {
        console.log(battle.turnUser.buffs[toBuff])
        return i.reply({ content: `your ${toBuff} is already buffed`, ephemeral: true })
    }
    desc = `${battle.turnUser.name} has buffed their ${toBuff}`
    battle.turnUser.buffs.buffed = true
    battle.turnUser.buffs[toBuff].amount = amount
    battle.turnUser.buffs[toBuff].length = length
    await handleEndTurn(i, battle, msg, args, timer, client, attackRow, buttonRow, fighterRow, itemRow, desc)
}

export const handleDebuff = async (
    i: StringSelectMenuInteraction,
    battle: Battle,
    msg: Message,
    timer: NodeJS.Timeout,
    otherPlayer: Player,
    args: string[],
    client: Client,
    attackRow: ActionRowBuilder<SelectMenuBuilder>,
    buttonRow: ActionRowBuilder<ButtonBuilder>,
    fighterRow: ActionRowBuilder<SelectMenuBuilder>,
    itemRow: ActionRowBuilder<SelectMenuBuilder>
) => {
    const values = i.values[0].split("|").slice(1)
    const amount = Number(values[0])
    const length = Number(values[1])
    const spCost = Number(values[2])
    const type = values[3]
    const name = values[4]
    const toDebuff = values[5] as "attack" | "defense" | "dexterity"
    let desc = ""
    if (battle.turnUser.sp - spCost < 0) {
        return i.reply({ content: "You do not have enough SP", ephemeral: true })
    }
    battle.turnUser.sp -= spCost
    if (otherPlayer.debuffs.debuffed === true && otherPlayer.debuffs[toDebuff].amount) {
        return i.reply({ content: `other player's ${toDebuff} is already debuffed`, ephemeral: true })
    }
    desc = `${battle.turnUser.name} has debuffed ${otherPlayer.name}'s ${toDebuff}`
    otherPlayer.debuffs.debuffed = true
    otherPlayer.debuffs[toDebuff].amount = amount
    otherPlayer.debuffs[toDebuff].length = length
    await handleEndTurn(i, battle, msg, args, timer, client, attackRow, buttonRow, fighterRow, itemRow, desc)
}

export const handleHeal = async (
    i: StringSelectMenuInteraction,
    battle: Battle,
    msg: Message,
    timer: NodeJS.Timeout,
    args: string[],
    client: Client,
    attackRow: ActionRowBuilder<SelectMenuBuilder>,
    buttonRow: ActionRowBuilder<ButtonBuilder>,
    fighterRow: ActionRowBuilder<SelectMenuBuilder>,
    itemRow: ActionRowBuilder<SelectMenuBuilder>
) => {
    const values = i.values[0].split("|").slice(1)
    const toHeal = Number(values[0])
    const spCost = Number(values[1])
    const type = values[2] as Fighter['type']
    const name = values[3]
    if (battle.turnUser.sp - spCost < 0) {
        return i.reply({ content: "You do not have enough SP", ephemeral: true })
    }
    let desc = `${battle.turnUser.name} used ${name} and healed for ${toHeal}`
    battle.turnUser.sp -= spCost
    if (battle.turnUser.health + toHeal > battle.turnUser.maxHp) {
        battle.turnUser.health = battle.turnUser.maxHp
    } else battle.turnUser.health += toHeal
    await handleEndTurn(i, battle, msg, args, timer, client, attackRow, buttonRow, fighterRow, itemRow, desc)
}

export const handleItem = async (
    i: StringSelectMenuInteraction,
    battle: Battle,
    msg: Message,
    timer: NodeJS.Timeout,
    otherPlayer: Player,
    args: string[],
    client: Client,
    menuCollector: InteractionCollector<StringSelectMenuInteraction> | InteractionCollector<StringSelectMenuInteraction<"cached">>,
    attackRow: ActionRowBuilder<SelectMenuBuilder>,
    buttonRow: ActionRowBuilder<ButtonBuilder>,
    fighterRow: ActionRowBuilder<SelectMenuBuilder>,
    itemRow: ActionRowBuilder<SelectMenuBuilder>
) => {
    const values = i.values[0].split("|")
    const itemType = values[1] as Item['type']
    const itemName = values[0]
    //check if there's an amount
    let amount = Number(values[2]) || undefined
    //check if the item has a reflect type
    const reflectType = (values[3].toString() || undefined) as Item['reflectType']
    const item = battle.turnUser.inventory.find(v => v.name === itemName)
    if (!item) return i.reply("something went wrong")
    let desc = ""
    switch (itemType) {
        case "healing":
            if (amount) {
                if (battle.turnUser.health + amount > battle.turnUser.maxHp) {
                    const remaining = battle.turnUser.maxHp - battle.turnUser.health
                    amount = remaining
                }
                battle.turnUser.health += amount
                desc += `${battle.turnUser.displayName} used ${itemName} and healed for ${amount}`
            } else return i.reply("something went wrong")
            break
        case "SP":
            if (amount) {
                if (battle.turnUser.sp + amount > battle.turnUser.maxSp) {
                    const remaining = battle.turnUser.maxSp - battle.turnUser.sp
                    amount = remaining
                }
                battle.turnUser.sp += amount
                desc += `${battle.turnUser.displayName} used ${itemName} and regained ${amount}SP`
            } else return i.reply("something went wrong")
            break
        case "reflect":
            if (reflectType) {
                if (battle.turnUser.reflectingMagic || battle.turnUser.reflectingPhysical) return i.reply("you cannot reflect more than 1 attack type at once")
                //set the relevant reflecting variable to true
                reflectType === "magic" ? battle.turnUser.reflectingMagic = true : battle.turnUser.reflectingPhysical = true
                desc += `${battle.turnUser.displayName} is now reflecting ${reflectType} attacks`
            } else return i.reply("something went wrong")
            break
        case "damage":
            if (amount) {
                otherPlayer.health -= amount
                desc += `${battle.turnUser.displayName} damaged ${otherPlayer.displayName} with ${itemName} for ${amount}`
                const endCheck = battle.checkForEnd()
                if (endCheck !== false && msg.channel.isSendable()) {
                    msg.channel.send(endCheck)
                    const ui = await makeBattleUI(client, msg, args, battle, desc)
                    if (!ui) return
                    i.update({ embeds: [ui.embed], components: [] })
                    menuCollector.stop()
                    delete battles[msg.channel.id]
                    saveData()
                    clearTimeout(timer)
                    return
                }
            } else return i.reply("something went wrong")
    }
   
    battle.turnUser.removeFromInventory(item)
    await handleEndTurn(i, battle, msg, args, timer, client, attackRow, buttonRow, fighterRow, itemRow, desc)
}

export const handleEndTurn = async (
    i: StringSelectMenuInteraction,
    battle: Battle,
    msg: Message,
    args: string[],
    timer: NodeJS.Timeout,
    client: Client,
    attackRow: ActionRowBuilder<SelectMenuBuilder>,
    buttonRow: ActionRowBuilder<ButtonBuilder>,
    fighterRow: ActionRowBuilder<SelectMenuBuilder>,
    itemRow: ActionRowBuilder<SelectMenuBuilder>,
    desc: string,
) => {
    const info = battle.endTurn()
    if (info) desc += `\n${info}`
    const ui = await makeBattleUI(client, msg, args, battle, desc)
    if (!ui) return console.log('error making ui')
    const { embed, attackSelect, defendButton, fighterSelect, itemSelect } = ui
    attackRow.setComponents(attackSelect)
    fighterRow.setComponents(fighterSelect)
    itemRow.setComponents(itemSelect)
    i.update({ embeds: [embed], components: [attackRow, buttonRow, fighterRow, itemRow] })
    timer.refresh()
}