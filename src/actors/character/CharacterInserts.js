import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { InsertSnapshotBuilder } from "../../model/snapshot/character/InsertSnapshot.js";
import { InstinctController } from "./InstinctController.js";
import { rich } from "../../model/snapshot/RichText.js";

export class CharacterInserts {
	constructor(actor, factory, moves, insertRepo = null) {
		this._actor   = actor;
		this._factory = factory;
		this._moves   = moves;
		this._insertRepo = insertRepo;
	}

	async onInsertDropped(item) {
		const slug = item.system?.slug ?? null;
		await this._moves.addCategory(`insert-${slug}`, item.name, item.system?.moves ?? [], item.system?.startingMoves ?? []);
	}

	// Grant the inserts a playbook declares (follower-data-architecture §4): remove the previous
	// playbook's granted inserts, embed the listed ones (stamped with the grant flag) + register
	// their move category. `addCategory` is idempotent, so the create-descendant hook re-firing for
	// the new insert item (which also calls onInsertDropped) is a harmless no-op.
	async syncPlaybookInserts(playbookSlug, insertSlugs = []) {
		for (const item of [...this._actor.items]) {
			if (item.type !== "insert") continue;
			const grantedBy = item.flags?.stonetop?.grantedByPlaybook;
			if (grantedBy && grantedBy !== playbookSlug) await this.removeInsert(item._id);
		}
		if (!playbookSlug || !insertSlugs?.length || !this._insertRepo) return;
		for (const slug of insertSlugs) {
			if ([...this._actor.items].some(i => i.type === "insert" && i.system?.slug === slug)) continue;
			const doc = await this._insertRepo.findBySlug(slug);
			if (!doc) continue;
			const data = typeof doc.toObject === "function"
				? doc.toObject()
				: { name: doc.name, type: "insert", img: doc.img ?? null, system: doc.system };
			delete data._id; delete data._key;
			data.type  = "insert";
			data.flags = { ...(data.flags ?? {}), stonetop: { ...(data.flags?.stonetop ?? {}), grantedByPlaybook: playbookSlug } };
			await this._actor.createEmbeddedDocuments("Item", [data]);
			await this._moves.addCategory(`insert-${slug}`, data.name, data.system?.moves ?? [], data.system?.startingMoves ?? []);
		}
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
			.withDescription(rich(item.system?.description ?? null))
			.withInstinctGroup(instinctGroup)
			.withInstinctSelected(instinctSelected)
			.withChoices(choices)
			.withMoves(moves)
			.build();
	}
}
