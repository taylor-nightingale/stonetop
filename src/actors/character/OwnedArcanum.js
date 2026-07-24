import {Arcanum} from "../../model/data/character/Arcanum.js";
import {ChoiceValues} from "../../model/snapshot/character/ChoiceGroup.js";
import {ChoiceGroupDefs} from "../../model/data/ChoiceGroupDefs.js";
import {OutfitGrant} from "../../model/data/character/OutfitGrant.js";

/**
 * One arcanum a character owns — the Foundry item wrapped so the rest of the code asks it questions and
 * tells it to change, instead of reaching into `item.system`. This is the only place that touches an
 * arcanum item's raw data.
 */
export class OwnedArcanum {
	constructor(item, actor = null) {
		this._item = item;   // the Foundry arcanum item
		this._actor = actor;  // needed only for writes
	}

	static bySlug(actor, slug) {
		const item = [...actor.items].find(i => i.type === "arcanum" && i.system?.slug === slug);
		return item ? new OwnedArcanum(item, actor) : null;
	}

	static all(actor) {
		return [...actor.items].filter(i => i.type === "arcanum").map(i => new OwnedArcanum(i, actor));
	}

	get id() {
		return this._item._id;
	}

	get slug() {
		return this._item.system?.slug ?? null;
	}

	get name() {
		return this._item.name ?? null;
	}

	get major() {
		return this._item.system?.major ?? false;
	}

	get flipped() {
		return this._item.system?.flipped ?? false;
	}

	get choiceValues() {
		return new ChoiceValues(this._item.system?.choiceValues ?? {});
	}

	get blanks() {
		return this._item.system?.choiceValues?.blanks ?? {};
	}

	get moveSlugs() {
		return this._item.system?.back?.moveSlugs ?? [];
	}

	/** The rich definition (slug/major/name/img/front/back) the snapshot builders consume. */
	definition() {
		const sys = this._item.system ?? {};
		return new Arcanum({
			slug: sys.slug,
			major: sys.major,
			name: this._item.name,
			img: this._item.img,
			front: sys.front,
			back: sys.back
		});
	}

	/** Followers this arcanum grants owned-by-default (a follower row with no checkbox). */
	ownedFollowerGrants() {
		return ChoiceGroupDefs.ownedFollowerGrants(this._item.system ?? {});
	}

	/** An inline mystery move ({id,name,text}) by id, or null. */
	mysteryMove(id) {
		return (this._item.system?.back?.moves ?? []).find(m => m.id === id) ?? null;
	}

	/** What the card grants to the outfit right now: the facing side's ◇ item + whatever its ticked
	 *  choices grant. Recomputed each sync, so a flip is just another sync. */
	outfitGrant() {
		const sys = this._item.system ?? {};
		const source = "arcana:" + sys.slug;
		const sideItem = sys.flipped ? sys.back?.item : sys.front?.item;
		const base = sideItem?.inventoryColumn ? [{...sideItem, slug: sys.slug}] : [];
		return OutfitGrant.forContainer(source, base, sys, sys.choiceValues ?? {});
	}

	/** The choice-value controller for this arcanum's document — every group shares the one store. */
	choiceController(factory) {
		return factory.forDocument(this.id, "choiceValues");
	}

	async syncOutfit(outfitSync) {
		await outfitSync?.syncItem(this._item);
	}

	async flip() {
		await this._writeSystem({flipped: true});
	}

	async unflip() {
		await this._writeSystem({flipped: false});
	}

	async delete() {
		await this._actor.deleteEmbeddedDocuments("Item", [this.id]);
	}

	async _writeSystem(system) {
		await this._actor.updateEmbeddedDocuments("Item", [{_id: this.id, system}]);
	}
}
