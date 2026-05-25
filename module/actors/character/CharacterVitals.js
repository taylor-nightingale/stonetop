import {ValueMax, VitalsSnapshotBuilder} from "../../model/snapshot/character/CharacterSnapshot.js";
import {StonetopFlags} from "./StonetopFlags.js";

export class CharacterVitals {
	constructor(actor, inventory) {
		this._actor = actor;
		this._flags = new StonetopFlags(actor, "vitals");
		this._inventory = inventory;
	}

	get level() {
		return this._actor.system?.attributes?.level?.value ?? 1;
	}

	async buildVitalsSnapshot() {
		const armorValue = await this._inventory.getArmor();
		const attrs  = this._actor.system?.attributes ?? {};
		const level  = attrs.level?.value ?? 1;
		const hpMax  = this._flags.getFlag("maxHP") ?? 0;
		const damage = this._flags.getFlag("damage") ?? null;
		return new VitalsSnapshotBuilder()
			.withHp(new ValueMax(attrs.hp?.value ?? 0, hpMax))
			.withDamage(damage)
			.withArmor(armorValue)
			.withLevel(level)
			.withXp(new ValueMax(attrs.xp?.value ?? 0, 6 + level * 2))
			.build();
	}

	async updateVitalsFromPlaybook(stonetopPlaybook) {
		const hp = stonetopPlaybook.hp;
		await Promise.all([
			this.setDamage(stonetopPlaybook.damage),
			this.setMaxHP(hp),
			this.setHP(hp)
		]);
	}

	async setDamage(damage) {
		await Promise.all([
			this._flags.setFlag("damage", damage),
			this._actor.update({ "system.attributes.damage.value": damage }),
		]);
	}

	async setMaxHP(maxHp) {
		await Promise.all([
			this._flags.setFlag("maxHP", maxHp),
			this._actor.update({ "system.attributes.maxHp.value": maxHp }),
		]);
	}

	async setHP(hp) {
		await this._actor.update({ "system.attributes.hp.value": hp });
	}
}
