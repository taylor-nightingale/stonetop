// Typed wrapper for the "npc" Actor subtype. Owns the read/write accessors over
// `actor.system.*` and builds the render-ready NpcSnapshot for the sheet. Ported/adapted
// from taylor-nightingale/stonetop; enrichment uses this fork's enrichHTML helper.
import { NpcSnapshotBuilder } from "../../model/NpcSnapshot.js";
import { Selection } from "../../model/Selection.js";
import { enrichHTML } from "../../utils/foundry-compat.js";

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
	get instinct()       { return Selection.fromStored(this._actor.system?.instinct, { multi: false }).text; }
	get description()    { return this._actor.system?.description    ?? ""; }
	get tags()           { return Selection.fromStored(this._actor.system?.tagList).text; }
	get moves()          { return this._actor.system?.moves          ?? ""; }

	async setHp(value)             { await this._actor.update({ "system.hp.value": Number(value) || 0 }); }
	async setMaxHp(value)          { await this._actor.update({ "system.hp.max": Number(value) || 0 }); }
	async setArmor(value)          { await this._actor.update({ "system.armor": value }); }
	async setDamage(value)         { await this._actor.update({ "system.damage": value }); }
	async setSpecialQuality(value) { await this._actor.update({ "system.specialQuality": value }); }
	async setInstinct(value)       { await this._actor.update({ "system.instinct": Selection.fromStored(value, { multi: false, options: this._actor.system?.instinct?.options ?? [] }).toRaw() }); }
	async setDescription(value)    { await this._actor.update({ "system.description": value }); }
	async setTags(value)           { await this._actor.update({ "system.tagList": Selection.fromStored(value, { options: this._actor.system?.tagList?.options ?? [] }).toRaw() }); }
	async setMoves(value)          { await this._actor.update({ "system.moves": value }); }

	async toggleSelection(field, value) {
		if (!field || !value) return;
		const current = Selection.fromStored(this._actor.system?.[field], { multi: field === "tagList" });
		await this._actor.update({ [`system.${field}`]: current.toggle(value).toRaw() });
	}

	// Newline-separated move lines (with optional leading "- ") → an enriched <ul>.
	_movesToList(raw) {
		const items = String(raw ?? "")
			.split("\n")
			.map(l => l.replace(/^\s*[-*•]\s*/, "").trim())
			.filter(Boolean)
			.map(l => `<li>${l}</li>`)
			.join("");
		return items ? `<ul>${items}</ul>` : "";
	}

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
		[snap.damageHtml, snap.armorHtml, snap.specialQualityHtml, snap.instinctHtml, snap.descriptionHtml, snap.movesHtml] =
			await Promise.all([
				enrichHTML(this.damage),
				enrichHTML(this.armor),
				enrichHTML(this.specialQuality),
				enrichHTML(this.instinct),
				enrichHTML(this.description),
				enrichHTML(this._movesToList(this.moves)),
			]);
		return snap;
	}
}
