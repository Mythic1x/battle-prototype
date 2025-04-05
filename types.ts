import { Message, Client, User } from "discord.js"
import { calculateDamage, saveData } from "./util/helper-functions"
type FighterType = "strength" | "fire" | "water" | "ice" | "lightning" | "support"
interface Buffs {
    buffed: boolean
    attack: {
        amount: number
        length: number
    }
    defense: {
        amount: number
        length: number
    }
    dexterity: {
        amount: number
        length: number
    }
}

interface Debuffs {
    debuffed: boolean
    attack: {
        amount: number
        length: number
    }
    defense: {
        amount: number
        length: number
    }
    dexterity: {
        amount: number
        length: number
    }
}
export class Fighter {
    name: string
    type: FighterType
    level: number
    strength: number
    magic: number
    luck: number
    dexterity: number
    xp: number
    skills: Record<string, skill>
    constructor(name: string, type: FighterType, level: number, strength: number, magic: number, luck: number, dexterity: number, xp: number, skills: Record<string, skill>) {
        this.name = name
        this.type = type
        this.level = level
        this.strength = strength
        this.magic = magic
        this.luck = luck
        this.dexterity = dexterity
        this.xp = xp
        this.skills = skills
    }
    levelUp() {
        if (this.type !== "strength") {
            this.magic += 3
            this.strength += 1
        } else {
            this.strength += 3
            this.magic += 1
        }
        this.luck += 3
        this.dexterity += 3
        this.level += 1
        saveData()
    }
}

export class Player extends User {
    level: number
    fighters: Fighter[]
    health: number
    sp: number
    xp: number
    maxSp: number
    maxHp: number
    selectedFighter?: Fighter
    defending: boolean
    name: string
    reflectingMagic: boolean
    reflectingPhysical: boolean
    buffs: Buffs
    debuffs: Debuffs
    constructor(client: Client<true>, data: User, level: number, fighters: Fighter[], health: number, sp: number, xp: number, maxSp: number, maxHp: number, selectedFighter?: Fighter) {
        //@ts-ignore not dealing with discordjs's bs
        super(client, data)
        this.level = level
        this.fighters = fighters
        this.health = health
        this.sp = sp
        this.xp = xp
        this.maxSp = maxSp
        this.maxHp = maxHp
        this.selectedFighter = selectedFighter
        //placeholder incase the name doesn't get set properly in battleSetup
        this.name = this.displayName
        this.defending = false
        this.reflectingMagic = false
        this.reflectingPhysical = false
        this.buffs = {
            buffed: false,
            attack: { amount: 0, length: 0, },
            defense: { amount: 0, length: 0, },
            dexterity: { amount: 0, length: 0, },
        }
        this.debuffs = {
            debuffed: false,
            attack: { amount: 0, length: 0, },
            defense: { amount: 0, length: 0, },
            dexterity: { amount: 0, length: 0, },
        }
    }
    levelUp() {
        if (!this.maxHp) {
            this.maxHp = 100
            this.maxSp = 100
        }
        this.maxSp += 20
        this.maxHp += 20
        this.level += 1
        saveData()
    }
}

export class Battle {
    player1: Player
    player2: Player
    round: number
    constructor(player1: Player, player2: Player, round: number) {
        this.player1 = player1
        this.player2 = player2
        this.round = round

    }
    get turnString() {
        return this.round % 2 === 0 ? `${this.player2.name}'s turn` : `${this.player1.name}'s turn`
    }
    get turnUser() {
        return this.round % 2 === 0 ? this.player2 : this.player1
    }
    endTurn() {
        let info = ""
        const buffInfo = this.dealwithBuffs(this.turnUser, "buffs")
        const debuffInfo = this.dealwithBuffs(this.turnUser, "debuffs")
        const infoToAdd = `${buffInfo}\n${debuffInfo}`
        info += infoToAdd
        this.round++
        if (info !== "") return info    
    }
    private dealwithBuffs(player: Player, support: "buffs" | "debuffs") {
        let info = ""
        if (support === "buffs" && player.buffs.buffed === true) {
            for (const buff in player.buffs) {
                if (typeof player.buffs[buff as keyof Buffs] === "boolean") continue
                //@ts-ignore
                if (player.buffs[buff as keyof Buffs].amount) {
                    //@ts-ignore
                    player.buffs[buff as keyof Buffs].length--
                    //@ts-ignore
                    if (player.buffs[buff as keyof Buffs].length < 0) {
                        info += `${player.name}'s ${buff} buff ended\n`
                        //@ts-ignore
                        player.buffs[buff as keyof Buffs].amount = 0
                    }
                }
            }
            const buffed = Object.values(player.buffs).filter(v => typeof v === 'object').some(v => v.amount <= 0)
            if (!buffed) player.buffs.buffed = false
        }
        if (support === "debuffs" && player.debuffs.debuffed === true) {
            for (const debuff in player.debuffs) {
                if (typeof player.debuffs[debuff as keyof Debuffs] === "boolean") continue
                //@ts-ignore
                if (player.debuffs[debuff as keyof Debuffs].amount) {
                    //@ts-ignore
                    player.debuffs[debuff as keyof Debuffs].length--
                    //@ts-ignore
                    if (player.debuffs[debuff as keyof Debuff].length < 0) {
                        info += `${player.name}'s ${debuff} debuff ended\n`
                        //@ts-ignore
                        player.debuffs[debuff as keyof Debuffs].amount = 0
                    }
                }
            }
            const buffed = Object.values(player.debuffs).filter(v => typeof v === 'object').some(v => v.amount <= 0)
            if (!buffed) player.debuffs.debuffed = false
        }
        return info
    }
    checkForEnd() {
        if (this.player1.health <= 0) {
            this.player2.xp += 50
            this.player2.selectedFighter!.xp += 100
            return `${this.player2.name} has won!`
        } else if (this.player2.health <= 0) {
            this.player1.xp += 50
            this.player1.selectedFighter!.xp += 100
            return `${this.player1.name} has won!`
        } else return false
    }
}

export interface skill {
    damage: "light" | "medium" | "heavy" | "extreme"
    spCost: number
    type: FighterType
    method: "attack" | "heal" | "buff" | "debuff"
    buffValues?: { amount: number, length: number, stat: string }
    description: string
    name: string
}

export interface commandType {
    name: string
    run: (client: Client, msg: Message, args: string[]) => void
    disabled?: boolean
}