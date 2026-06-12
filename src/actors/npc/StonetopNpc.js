import { NpcSnapshotBuilder } from "../../model/snapshot/NpcSnapshot.js";
import { enrichGameText } from "../../utils/enrichGameText.js";

export class StonetopNpc {
	constructor(actor) {
		this._actor = actor;
	}

	static create(actor) {
		return new StonetopNpc(actor);
	}

	get hp()             { return this._actor.system?.hp?.value     ?? 0; }
	get maxHp()          { return this._actor.system?.hp?.max       ?? 0; }
	get armor()          { return this._actor.system?.armor          ?? ""; }
	get damage()         { return this._actor.system?.damage         ?? ""; }
	get specialQuality() { return this._actor.system?.specialQuality ?? ""; }
	get instinct()       { return this._actor.system?.instinct       ?? ""; }
	get description()    { return this._actor.system?.description    ?? ""; }

	async setHp(value)             { await this._actor.update({ "system.hp.value": value }); }
	async setMaxHp(value)          { await this._actor.update({ "system.hp.max": value }); }
	async setArmor(value)          { await this._actor.update({ "system.armor": value }); }
	async setDamage(value)         { await this._actor.update({ "system.damage": value }); }
	async setSpecialQuality(value) { await this._actor.update({ "system.specialQuality": value }); }
	async setInstinct(value)       { await this._actor.update({ "system.instinct": value }); }
	async setDescription(value)    { await this._actor.update({ "system.description": value }); }

	async buildSnapshot() {
		const snap = new NpcSnapshotBuilder()
			.withHp(this.hp)
			.withHpMax(this.maxHp)
			.withArmor(this.armor)
			.withDamage(this.damage)
			.withInstinct(this.instinct)
			.withSpecialQuality(this.specialQuality)
			.withDescription(this.description)
			.build();
		const rollData = this._actor.getRollData?.() ?? {};
		const enrich = raw => enrichGameText(raw, { rollData });
		[snap.damageHtml, snap.armorHtml, snap.specialQualityHtml, snap.instinctHtml, snap.descriptionHtml] =
			await Promise.all([this.damage, this.armor, this.specialQuality, this.instinct, this.description].map(enrich));
		return snap;
	}
}
