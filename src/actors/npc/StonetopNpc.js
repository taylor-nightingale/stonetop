import { NpcSnapshotBuilder } from "../../model/snapshot/NpcSnapshot.js";
import { Tags } from "../../model/data/Tags.js";
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
	get tags()           { return this.tagList.text; }
	/** The NPC's tags, with the choices its stat block prints as the picker's options. */
	get tagList()        { return Tags.creature(this._actor.system?.tagList, this._actor.system?.tagOptions ?? []); }
	get moves()          { return this._actor.system?.moves          ?? ""; }

	async setHp(value)             { await this._actor.update({ "system.hp.value": value }); }
	async setMaxHp(value)          { await this._actor.update({ "system.hp.max": value }); }
	async setArmor(value)          { await this._actor.update({ "system.armor": value }); }
	async setDamage(value)         { await this._actor.update({ "system.damage": value }); }
	async setSpecialQuality(value) { await this._actor.update({ "system.specialQuality": value }); }
	async setInstinct(value)       { await this._actor.update({ "system.instinct": Selection.fromStored(value, { multi: false, options: this._actor.system?.instinct?.options ?? [] }).toRaw() }); }
	async setDescription(value)    { await this._actor.update({ "system.description": value }); }
	async setTags(value)           { await this._actor.update({ "system.tagList": Tags.creature(value).toRaw() }); }
	/** Tags are a token list, not a Selection — they get their own method rather than the generic one. */
	async toggleTag(value)         { if (!value) return; await this._actor.update({ "system.tagList": this.tagList.toggle(value).toRaw() }); }
	async toggleSelection(field, value) { if (!field || !value) return; if (field === "tagList") return this.toggleTag(value); await this._actor.update({ [`system.${field}`]: Selection.fromStored(this._actor.system?.[field]).toggle(value).toRaw() }); }
	async setMoves(value)          { await this._actor.update({ "system.moves": value }); }

	async buildSnapshot() {
		// Game-text fields are RichText on the snapshot; the sheet's enrichRichTextTree pass enriches
		// them (one render path). No bespoke enrichHTML here.
		return new NpcSnapshotBuilder()
			.withHp(this.hp)
			.withHpMax(this.maxHp)
			.withArmor(this.armor)
			.withDamage(this.damage)
			// Pass the Tags / raw instinct Selection (not .text) so the snapshot can build the chip
			// pickers — same construction as the follower card, so NPC tags get the identical pill UI
			// (and instinct isn't comma-split as if it were multi-select).
			.withInstinct(this._actor.system?.instinct ?? "")
			.withSpecialQuality(this.specialQuality)
			.withDescription(this.description)
			.withTags(this.tagList)
			.withMoves(this.moves)
			.build();
	}
}
