import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { InsertSnapshotBuilder } from "../../model/snapshot/character/InsertSnapshot.js";
import { InstinctController } from "./InstinctController.js";

export class CharacterInserts {
	constructor(actor, factory, moves) {
		this._actor   = actor;
		this._factory = factory;
		this._moves   = moves;
	}

	async onInsertDropped(item) {
		const slug = item.system?.slug ?? null;
		await this._moves.addCategory(`insert-${slug}`, item.name, slug);
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

	async setCount(itemId, groupSlug, optionSlug, count) {
		await this._factory.forItem(itemId, "choiceValues").setCount(groupSlug, optionSlug, count);
	}

	async selectOption(itemId, groupSlug, optionSlug, siblingSlugsCsv) {
		const ctrl = this._factory.forItem(itemId, "choiceValues");
		if (groupSlug === "instinct")
			await new InstinctController(ctrl).selectOption(optionSlug, siblingSlugsCsv);
		else
			await ctrl.selectOption(groupSlug, optionSlug, siblingSlugsCsv);
	}

	async selectCustomInstinct(itemId, text) {
		const ctrl = this._factory.forItem(itemId, "choiceValues");
		await new InstinctController(ctrl).selectCustom(text);
	}

	async setText(itemId, groupSlug, optionSlug, text) {
		await this._factory.forItem(itemId, "choiceValues").setText(groupSlug, optionSlug, text);
	}

	async buildSnapshot() {
		const insertItems = [...this._actor.items].filter(i => i.type === "insert");
		return Promise.all(insertItems.map(item => this._buildOne(item)));
	}

	async _buildOne(item) {
		const slug             = item.system?.slug ?? null;
		const values           = new ChoiceValues(item.system?.choiceValues ?? {});
		const instinct         = item.system?.instinct ?? null;
		const instinctGroup    = instinct ? ChoiceGroup.fromPackData(instinct, values) : null;
		const instinctSelected = InstinctController.computeSelected(instinctGroup, values);
		const choices          = (item.system?.choices ?? []).map(g => ChoiceGroup.fromPackData(g, values));
		const moves            = await this._moves.getMoveSnapshotsForCategory(`insert-${slug}`);
		return new InsertSnapshotBuilder()
			.withId(item._id)
			.withSlug(slug)
			.withName(item.name)
			.withImg(item.img ?? null)
			.withDescription(item.system?.description ?? null)
			.withInstinctGroup(instinctGroup)
			.withInstinctSelected(instinctSelected)
			.withChoices(choices)
			.withMoves(moves)
			.build();
	}
}
