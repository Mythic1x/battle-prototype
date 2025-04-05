import * as command from "./commands"
import { commandType, Fighter, Player, skill } from "../types"
import fs from 'fs'
import { client } from ".."
import { Client } from "discord.js"
const skilsFile = fs.readFileSync('./data/skills.json', 'utf-8')
const skills: Record<string, skill> = JSON.parse(skilsFile)
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
        run: command.levelUp,
        disabled: true,
    },
    {
        name: "battle",
        run: command.battle
    },
    {
        name: "selectfighter",
        run: command.selectFighter
    },
    {
        name: "stats",
        run: command.displayStats
    },
    {
        name: "reset",
        run: command.reset
    }
]

export const intializePlayers = async (client: Client) => {
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
            //imported as an array but turned into an object here
            //@ts-ignore
            fighters[fighter].skills.reduce((acc: any, skill: any) => {
                acc[skill] = skills[skill];
                return acc;
            }, {})
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
                fighter.skills
            )
        })
        const user = await client.users.fetch(player)
        if (!user) throw new Error(`couldn't find user with id ${player}`)
        userData[player] = new Player(client, user, 0, [...userData[player].fighters], userData[player].maxSp ?? 100, userData[player].maxHp ?? 100, userData[player].xp ?? 0, userData[player].maxSp, userData[player].maxHp, userData[player].selectedFighter)
    }
}
export { fighters, userData }


