import { NpcSnapshotBuilder } from "../../model/snapshot/NpcSnapshot.js";
import { Selection } from "../../model/data/Selection.js";

const NPC_DEFAULT_IMG = "systems/stonetop/assets/content/icons/npc.png";
const FOUNDRY_DEFAULT_IMG = "icons/svg/mystery-man.svg";

export class StonetopNpc {
	constructor(actor) {
		this._actor = actor;
	}

	static create(actor) {
		return new StonetopNpc(actor);
	}

	// Pre-create, before the document persists (updateSource, not update). New NPCs (the type used
	// for standalone NPCs and followers) get the house icon instead of Foundry's generic
	// mystery-man — but only when no specific image was provided (a blank NPC from the sidebar), so
	// dropping a compendium follower keeps its own icon (crew, companion, …).
	onPreCreate(data) {
		if (data.img && data.img !== FOUNDRY_DEFAULT_IMG) return;
		this._actor.updateSource({ img: NPC_DEFAULT_IMG, "prototypeToken.texture.src": NPC_DEFAULT_IMG });
	}

	// Post-create, on the creating client. NPCs have no create-time seeding; the hook dispatches
	// here uniformly.
	async onCreate() {}

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
		// Game-text fields are RichText on the snapshot; the sheet's enrichRichTextTree pass enriches
		// them (one render path). No bespoke enrichHTML here.
		return new NpcSnapshotBuilder()
			.withHp(this.hp)
			.withHpMax(this.maxHp)
			.withArmor(this.armor)
			.withDamage(this.damage)
			// Pass the raw stored Selections (not .text) so tagSelection / instinctSelection keep
			// their options/multi/allowCustom — same construction as the follower card, so NPC tags
			// get the identical pill UI (and instinct isn't comma-split as if it were multi-select).
			.withInstinct(this._actor.system?.instinct ?? "")
			.withSpecialQuality(this.specialQuality)
			.withDescription(this.description)
			.withTags(this._actor.system?.tagList ?? null)
			.withMoves(this.moves)
			.build();
	}
}
