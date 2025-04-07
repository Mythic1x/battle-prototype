import * as command from "./commands"
import { commandType, Fighter, Player, skill, Item } from "../types"
import fs from 'fs'
import { Client } from "discord.js"
const skilsFile = fs.readFileSync('./data/skills.json', 'utf-8')
const skills: Record<string, skill> = JSON.parse(skilsFile)
const itemsFile = fs.readFileSync('./data/items.json', 'utf-8')
const items: Record<string, Item> = JSON.parse(itemsFile)
const fightersFile = fs.readFileSync('./data/fighter.json', 'utf-8')
const fighters: Record<string, Fighter> = JSON.parse(fightersFile)
const userDataFile = fs.readFileSync('./data/user-data.json', 'utf8')
const userData: Record<string, Player> = JSON.parse(userDataFile)

export const commandArray: commandType[] = [
    {
        name: "test",
        run: command.test
    },
    {
        name: "seefighters",
        run: command.seeFighters
    },
    {
        name: "signup",
        run: command.signUp
    },
    {
        name: "fighters",
        run: command.displayFighters
    },
    {
        name: "levelup",
        run: command.playerLevelUp,
    },
    {
        name: "flevelup",
        run: command.levelUp
    },
    {
        name: "battle",
        run: command.battle
    },
    {
        name: "select",
        run: command.selectFighter
    },
    {
        name: "stats",
        run: command.displayStats
    },
    {
        name: "reset",
        run: command.reset
    },
    {
        name: "shop",
        run: command.shop
    },
    {
        name: "inventory",
        run: command.inventory
    },
    {
        name: "buy",
        run: command.buyItem
    }
]

export const intialize = async (client: Client) => {
    for (const fighter in fighters) {
        fighters[fighter] = new Fighter(
            fighters[fighter].name,
            fighters[fighter].type,
            fighters[fighter].level,
            fighters[fighter].strength,
            fighters[fighter].magic,
            fighters[fighter].luck,
            fighters[fighter].dexterity,
            fighters[fighter].xp,
            fighters[fighter].xpForLevelUp ?? 50,
            //imported as an array but turned into an object here
            //@ts-ignore
            fighters[fighter].skills.reduce((acc: Record<string, skill>, skill: string) => {
                acc[skill] = skills[skill];
                return acc;
            }, {}),
            fighters[fighter].learnNewSkillsAt,
            fighters[fighter].learnableSkills,
        )
    }
    for (const item in items) {
        const itemInfo = items[item]
        items[item] = new Item(
            itemInfo.name,
            itemInfo.description,
            itemInfo.price,
            itemInfo.type,
            itemInfo.maxAmount,
            itemInfo.amount ?? undefined,
            itemInfo.reflectType ?? undefined
        )
    }
    for (const player in userData) {
        if (!client.isReady()) throw new Error("client not ready")
        userData[player].fighters = userData[player].fighters.map((fighter) => {
            return new Fighter(
                fighter.name,
                fighter.type,
                fighter.level,
                fighter.strength,
                fighter.magic,
                fighter.luck,
                fighter.dexterity,
                fighter.xp,
                fighter.xpForLevelUp ?? 50,
                fighter.skills,
                fighter.learnNewSkillsAt ?? [10, 15, 20],
                fighter.learnableSkills ?? [],
            )
        })
        const user = await client.users.fetch(player)
        if (!user) throw new Error(`couldn't find user with id ${player}`)
        userData[player] = new Player(
            client,
            user,
            0,
            [...userData[player].fighters],
            userData[player].maxSp ?? 100,
            userData[player].maxHp ?? 100,
            userData[player].xp ?? 0,
            userData[player].maxSp,
            userData[player].maxHp,
            userData[player].inventory ?? [],
            userData[player].money ?? 0,
            userData[player].xpForLevelUp ?? 50,
            userData[player].selectedFighter
        )
    }
}
export { fighters, userData, items, skills }


