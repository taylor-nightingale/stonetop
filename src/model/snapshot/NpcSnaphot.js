export class NpcSnapshot {
    /**
     * 
     * @param {number} hp 
     * @param {number} armor 
     * @param {string} damage 
     * @param {string} tags
     * @param {string} specialQualities 
     * @param {string} instinct 
     * @param {string[]} moves 
     * @param {string} description 
     * @param {string} cost
     * @param {number} loyalty  
     * @param {Boolean} isFollower 
     */
    constructor (hp, armor, damage, tags, specialQualities, instinct, moves, description, cost, loyalty, isFollower) {
        this.hp = hp;
        this.armor = armor;
        this.damage = damage;
        this.tags = tags;
        this.specialQualities = specialQualities;
        this.instinct = instinct;
        this.moves = moves;
        this.description = description;
        this.cost = cost;
        this.loyalty = loyalty;
        this.isFollower = isFollower;
    }
}