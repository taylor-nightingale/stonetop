import { NpcSnapshotBuilder } from "../../model/snapshot/NpcSnapshot.js";
import { enrichGameText } from "../../utils/enrichGameText.js";
import { Selection } from "../../model/data/Selection.js";

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
	get instinct()       { return Selection.fromStored(this._actor.system?.instinct).text; }
	get description()    { return this._actor.system?.description    ?? ""; }
	get tags()           { return Selection.fromStored(this._actor.system?.tagList).text; }
	get moves()          { return this._actor.system?.moves          ?? ""; }

	async setHp(value)             { await this._actor.update({ "system.hp.value": value }); }
	async setMaxHp(value)          { await this._actor.update({ "system.hp.max": value }); }
	async setArmor(value)          { await this._actor.update({ "system.armor": value }); }
	async setDamage(value)         { await this._actor.update({ "system.damage": value }); }
	async setSpecialQuality(value) { await this._actor.update({ "system.specialQuality": value }); }
	async setInstinct(value)       { await this._actor.update({ "system.instinct": Selection.fromStored(value, { multi: false, options: this._actor.system?.instinct?.options ?? [] }).toRaw() }); }
	async setDescription(value)    { await this._actor.update({ "system.description": value }); }
	async setTags(value)           { await this._actor.update({ "system.tagList": Selection.fromStored(value, { options: this._actor.system?.tagList?.options ?? [] }).toRaw() }); }
	async toggleSelection(field, value) { if (!field || !value) return; await this._actor.update({ [`system.${field}`]: Selection.fromStored(this._actor.system?.[field]).toggle(value).toRaw() }); }
	async setMoves(value)          { await this._actor.update({ "system.moves": value }); }

	async buildSnapshot() {
		const snap = new NpcSnapshotBuilder()
			.withHp(this.hp)
			.withHpMax(this.maxHp)
			.withArmor(this.armor)
			.withDamage(this.damage)
			.withInstinct(this.instinct)
			.withSpecialQuality(this.specialQuality)
			.withDescription(this.description)
			.withTags(this.tags)
			.withMoves(this.moves)
			.build();
		const rollData = this._actor.getRollData?.() ?? {};
		const enrich = raw => enrichGameText(raw, { rollData });
		[snap.damageHtml, snap.armorHtml, snap.specialQualityHtml, snap.instinctHtml, snap.descriptionHtml, snap.movesHtml] =
			await Promise.all([this.damage, this.armor, this.specialQuality, this.instinct, this.description, this.moves].map(enrich));
		return snap;
	}
}
