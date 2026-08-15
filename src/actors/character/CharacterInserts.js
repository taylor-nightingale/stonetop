import { ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { buildChoiceGroup } from "../../model/snapshot/character/buildChoiceGroup.js";
import { InsertSnapshotBuilder } from "../../model/snapshot/character/InsertSnapshot.js";
import { InstinctController } from "./InstinctController.js";
import { rich } from "../../model/snapshot/RichText.js";
import { GrantedItems } from "../GrantedItems.js";
import { GrantSource, ItemGrant, ItemGrantSet } from "../../model/data/ItemGrant.js";

export class CharacterInserts {
	constructor(actor, factory, moves, insertRepo = null, grantedItems = new GrantedItems(actor)) {
		this._actor   = actor;
		this._factory = factory;
		this._moves   = moves;
		this._insertRepo  = insertRepo;
		this._grantedItems = grantedItems;
	}

	async onInsertDropped(item) {
		const slug = item.system?.slug ?? null;
		await this._moves.addCategory(`insert-${slug}`, item.name, item.system?.moves ?? [], item.system?.startingMoves ?? []);
	}

	// Every insert this playbook wants the character to own (follower-data-architecture §4), keyed by
	// slug. The insert items are the playbook's grant, so they arrive and leave with it; a granted
	// insert registers its own move category the same way a dropped one does — as a source in its own
	// right, once the item exists.
	async playbookGrants(playbookSlug, insertSlugs = []) {
		const source = GrantSource.playbook(playbookSlug);
		if (!playbookSlug || !insertSlugs?.length || !this._insertRepo) return ItemGrantSet.empty(source);
		const grants = [];
		for (const slug of insertSlugs) {
			const doc = await this._insertRepo.findBySlug(slug);
			if (!doc) continue;
			const data = typeof doc.toObject === "function"
				? doc.toObject()
				: { name: doc.name, type: "insert", img: doc.img ?? null, system: doc.system };
			delete data._id; delete data._key;
			data.type = "insert";
			grants.push(ItemGrant.forInsert(slug, data));
		}
		return new ItemGrantSet(source, grants);
	}

	async removeInsert(itemId) {
		const item = [...this._actor.items].find(i => i._id === itemId) ?? null;
		if (!item) return;
		await this._moves.removeCategory(`insert-${item.system?.slug}`);
		await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
	}

	async onInsertRemoved(slug) {
		if (slug) await this._moves.removeCategory(`insert-${slug}`);
	}

	// A stat a move rolls that is none of the character's six: an insert's own track, like the
	// Thrall's Favor (Dark Succor rolls +Favor). The insert names the move, the move owns the track,
	// so nothing here needs a second place to declare the stat. Null when no insert grants it.
	resolveBonus(stat) {
		for (const item of this._insertItems()) {
			if ((item.system?.moves ?? []).includes(stat)) return this._moves.resourceValue(stat);
		}
		return null;
	}

	_insertItems() {
		return [...this._actor.items].filter(i => i.type === "insert");
	}

	/** The controller for one insert's choice values. An insert's instinct group is exclusive with its
	 *  write-in box, so that group resolves to the controller that enforces it. */
	controllerFor(itemId, groupSlug) {
		const ctrl = this._factory.forDocument(itemId, "choiceValues");
		return groupSlug === "instinct" ? new InstinctController(ctrl) : ctrl;
	}

	async setCount(itemId, groupSlug, optionSlug, count) {
		await this._factory.forDocument(itemId, "choiceValues").setCount(groupSlug, optionSlug, count);
	}

	async selectOption(itemId, groupSlug, optionSlug, siblingSlugsCsv) {
		const ctrl = this._factory.forDocument(itemId, "choiceValues");
		if (groupSlug === "instinct")
			await new InstinctController(ctrl).selectOption(groupSlug, optionSlug, siblingSlugsCsv);
		else
			await ctrl.selectOption(groupSlug, optionSlug, siblingSlugsCsv);
	}

	async selectCustomInstinct(itemId, text) {
		const ctrl = this._factory.forDocument(itemId, "choiceValues");
		await new InstinctController(ctrl).selectCustom("instinct", text);
	}

	async setText(itemId, groupSlug, optionSlug, text) {
		await this._factory.forDocument(itemId, "choiceValues").setText(groupSlug, optionSlug, text);
	}

	async buildSnapshot() {
		return Promise.all(this._insertItems().map(item => this._buildOne(item)));
	}

	async _buildOne(item) {
		const slug             = item.system?.slug ?? null;
		const values           = new ChoiceValues(item.system?.choiceValues ?? {});
		const instinct         = item.system?.instinct ?? null;
		const instinctGroup    = instinct ? buildChoiceGroup(instinct, values) : null;
		const instinctSelected = InstinctController.computeSelected(instinctGroup, values);
		const choices          = (item.system?.choices ?? []).map(g => buildChoiceGroup(g, values));
		const moves            = await this._moves.getMoveSnapshotsForCategory(`insert-${slug}`);
		return new InsertSnapshotBuilder()
			.withId(item._id)
			.withSlug(slug)
			.withName(item.name)
			.withImg(item.img ?? null)
			.withDescription(rich(item.system?.description ?? null))
			.withInstinctGroup(instinctGroup)
			.withInstinctSelected(instinctSelected)
			.withChoices(choices)
			.withMoves(moves)
			.build();
	}
}
