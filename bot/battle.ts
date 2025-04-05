import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, ColorResolvable, ComponentType, Embed, EmbedBuilder, GuildMember, Interaction, InteractionCollector, Message, StringSelectMenuInteraction, User } from "discord.js"
import { Fighter, Player, Battle, skill } from "../types"
import { fighters, userData } from "./init"
import { promptUser, saveData, pagedEmbed, findUser, calculateDamage, calculateHeal } from "../util/helper-functions"
import { SelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "@discordjs/builders"
export const battles: Record<string, Battle> = {}

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
                        .setValue(`${skills[skill].method}|${amount}|${length}|${skills.spCost}|${skills[skill].type}|${skills[skill].name}|${skills[skill].buffValues!.stat}`)
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

export const battleSetup = async (client: Client, msg: Message, args: string[]) => {
    if (!msg.channel.isSendable()) return
    if (battles[msg.channel.id]) return await msg.channel.send("battle already happening sorry") && false
    const otherPlayerM = await findUser(args, msg, true) as GuildMember
    if (!otherPlayerM) return msg.channel.send("no one found")
    const otherPlayer = otherPlayerM.user
    if (!otherPlayer || otherPlayer.id === msg.author.id) return
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
        .setCustomId(`${battle.turnUser.id} | ability`)
        .setPlaceholder('Ability')
    appendSkillButtons(battle.turnUser.selectedFighter?.skills, attackSelect, battle.turnUser.selectedFighter!, otherPlayer, battle.turnUser)
    const defendButton = new ButtonBuilder()
        .setCustomId(`defend`)
        .setLabel("defend")
        .setStyle(ButtonStyle.Secondary)
    const fighterSelect = new StringSelectMenuBuilder()
        .setCustomId(`${battle.turnUser.id} | change`)
        .setPlaceholder("Change Fighter")
    appendFighterSelect(battle.turnUser, fighterSelect)
    return { embed, attackSelect, defendButton, fighterSelect }
}


export const battleGame = async (client: Client, msg: Message, args: string[], battle: Battle, embed: EmbedBuilder, attackSelect: StringSelectMenuBuilder, defenseButton: ButtonBuilder, fighterSelect: StringSelectMenuBuilder) => {
    if (!msg.channel.isSendable()) return
    const timer = setTimeout(() => {
        if (!msg.channel.isSendable()) return
        msg.channel.send("Battle ending due to inactivity")
        delete battles[msg.channel.id]
    }, 60000)
    const attackRow = new ActionRowBuilder<SelectMenuBuilder>()
        .addComponents(attackSelect)
    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(defenseButton)
    const fighterRow = new ActionRowBuilder<SelectMenuBuilder>()
        .addComponents(fighterSelect)
    const message = await msg.channel.send({ embeds: [embed], components: [attackRow, buttonRow, fighterRow] })
    const menuCollector = message.createMessageComponentCollector({ componentType: ComponentType.StringSelect })
    const buttonCollector = message.createMessageComponentCollector({ componentType: ComponentType.Button })
    menuCollector.on('collect', async i => {
        const idArgs = i.customId.split("|")
        const action = idArgs[1].trim()
        const abilityType = i.values[0].split("|")[0]
        if (i.user.id === battle.turnUser.id) {
            const otherPlayer = battle.turnUser.id === battle.player1.id ? battle.player2 : battle.player1
            if (action === "ability") {
                if (abilityType === "attack") {
                    await handleAttack(i, battle, msg, otherPlayer, timer, args, client, menuCollector, attackRow, buttonRow, fighterRow)
                }
                if (abilityType === "buff") {
                    await handleBuff(i, battle, msg, timer, args, client, attackRow, buttonRow, fighterRow)
                }
                if (abilityType === "debuff") {
                    await handleDebuff(i, battle, msg, timer, otherPlayer, args, client, attackRow, buttonRow, fighterRow)
                }
                if (abilityType === "heal") {
                    await handleHeal(i, battle, msg, timer, args, client, attackRow, buttonRow, fighterRow)
                }
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

const handleAttack = async (
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
    fighterRow: ActionRowBuilder<SelectMenuBuilder>
) => {
    const values = i.values[0].split("|").slice(1)
    const damage = Number(values[0])
    const spCost = Number(values[1])
    const type = values[2] as Fighter['type']
    const name = values[3]
    const dodgeChance = otherPlayer.selectedFighter!.dexterity * 0.5
    const critChance = battle.turnUser.selectedFighter!.luck * 0.3
    const skillMappings: Record<Fighter['type'], string> = {
        fire: "magic",
        water: "magic",
        ice: "magic",
        lightning: "magic",
        strength: "strength",
        support: "magic"
    }
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
    const info = battle.endTurn()
    if (info) desc += `\n${info}`
    const ui = await makeBattleUI(client, msg, args, battle, desc)
    attackRow.setComponents(ui?.attackSelect as SelectMenuBuilder)
    fighterRow.setComponents(ui!.fighterSelect)
    i.update({ embeds: [ui!.embed], components: [attackRow, buttonRow, fighterRow] })
    timer.refresh()
}

const handleBuff = async (
    i: StringSelectMenuInteraction,
    battle: Battle,
    msg: Message,
    timer: NodeJS.Timeout,
    args: string[],
    client: Client,
    attackRow: ActionRowBuilder<SelectMenuBuilder>,
    buttonRow: ActionRowBuilder<ButtonBuilder>,
    fighterRow: ActionRowBuilder<SelectMenuBuilder>
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
    if (battle.turnUser.buffs.buffed === true && battle.turnUser.buffs[toBuff].amount) {
        console.log(battle.turnUser.buffs[toBuff])
       return  i.reply({ content: `your ${toBuff} is already buffed`, ephemeral: true })
    }
    desc = `${battle.turnUser.name} has buffed their ${toBuff}`
    battle.turnUser.buffs.buffed = true
    battle.turnUser.buffs[toBuff].amount = amount
    battle.turnUser.buffs[toBuff].length = length
    const info = battle.endTurn()
    if (info) desc += `\n${info}`
    const ui = await makeBattleUI(client, msg, args, battle, desc)
    if (!ui) return console.log('error making ui')
    const { embed, attackSelect, defendButton, fighterSelect } = ui
    attackRow.setComponents(attackSelect)
    fighterRow.setComponents(fighterSelect)
    i.update({ embeds: [embed], components: [attackRow, buttonRow, fighterRow] })
    timer.refresh()
}

const handleDebuff = async (
    i: StringSelectMenuInteraction,
    battle: Battle,
    msg: Message,
    timer: NodeJS.Timeout,
    otherPlayer: Player,
    args: string[],
    client: Client,
    attackRow: ActionRowBuilder<SelectMenuBuilder>,
    buttonRow: ActionRowBuilder<ButtonBuilder>,
    fighterRow: ActionRowBuilder<SelectMenuBuilder>
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
    if (otherPlayer.debuffs.debuffed === true && otherPlayer.debuffs[toDebuff].amount) {
        return i.reply({ content: `other player's ${toDebuff} is already debuffed`, ephemeral: true })
    }
    desc = `${battle.turnUser.name} has debuffed ${otherPlayer.name}'s ${toDebuff}`
    otherPlayer.debuffs.debuffed = true
    otherPlayer.debuffs[toDebuff].amount = amount
    otherPlayer.debuffs[toDebuff].length = length
    const info = battle.endTurn()
    if (info) desc += `\n${info}`
    const ui = await makeBattleUI(client, msg, args, battle, desc)
    if (!ui) return console.log('error making ui')
    const { embed, attackSelect, defendButton, fighterSelect } = ui
    attackRow.setComponents(attackSelect)
    fighterRow.setComponents(fighterSelect)
    i.update({ embeds: [embed], components: [attackRow, buttonRow, fighterRow] })
    timer.refresh()
}

const handleHeal = async (
    i: StringSelectMenuInteraction,
    battle: Battle,
    msg: Message,
    timer: NodeJS.Timeout,
    args: string[],
    client: Client,
    attackRow: ActionRowBuilder<SelectMenuBuilder>,
    buttonRow: ActionRowBuilder<ButtonBuilder>,
    fighterRow: ActionRowBuilder<SelectMenuBuilder>

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
    const info = battle.endTurn()
    if (info) desc += `\n${info}`
    const ui = await makeBattleUI(client, msg, args, battle, desc)
    if (!ui) return console.log('error making ui')
    const { embed, attackSelect, defendButton, fighterSelect } = ui
    attackRow.setComponents(attackSelect)
    fighterRow.setComponents(fighterSelect)
    i.update({ embeds: [embed], components: [attackRow, buttonRow, fighterRow] })
    timer.refresh()
}