import { NpcSnapshotBuilder } from "../../model/snapshot/NpcSnapshot.js";

export class StonetopNpc {
	constructor(actor) {
		this._actor = actor;
	}

	static create(actor) {
		return new StonetopNpc(actor);
	}

	get hp()             { return this._actor.system?.hp             ?? 0; }
	get maxHp()          { return this._actor.system?.maxHp          ?? 0; }
	get armor()          { return this._actor.system?.armor          ?? 0; }
	get damage()         { return this._actor.system?.damage         ?? "d6"; }
	get specialQuality() { return this._actor.system?.specialQuality ?? ""; }
	get instinct()       { return this._actor.system?.instinct       ?? ""; }
	get description()    { return this._actor.system?.description    ?? ""; }

	async setHp(value)             { await this._actor.update({ "system.hp": value }); }
	async setMaxHp(value)          { await this._actor.update({ "system.maxHp": value }); }
	async setArmor(value)          { await this._actor.update({ "system.armor": value }); }
	async setDamage(value)         { await this._actor.update({ "system.damage": value }); }
	async setSpecialQuality(value) { await this._actor.update({ "system.specialQuality": value }); }
	async setInstinct(value)       { await this._actor.update({ "system.instinct": value }); }
	async setDescription(value)    { await this._actor.update({ "system.description": value }); }

	async buildSnapshot() {
		return new NpcSnapshotBuilder()
			.withHp(this.hp)
			.withHpMax(this.maxHp)
			.withArmor(this.armor)
			.withDamage(this.damage)
			.withInstinct(this.instinct)
			.withSpecialQualities(this.specialQuality)
			.withDescription(this.description)
			.build();
	}
}
