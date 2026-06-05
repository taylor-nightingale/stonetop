import { PostDeathInsertSnapshotBuilder } from "../../model/snapshot/character/PostDeathInsertSnapshot.js";

export class CharacterPostDeath {
	constructor(actor, instinct, lore, moves) {
		this._actor    = actor;
		this._instinct = instinct;
		this._lore     = lore;
		this._moves    = moves;
	}

	get instinct() { return this._instinct; }
	get lore()     { return this._lore; }

	async onInsertDropped(item) {
		const existing = [...this._actor.items]
			.filter(i => i.type === "insert" && i._id !== item._id);
		for (const old of existing) {
			await this._moves.removeCategory(`post-death-${old.system?.slug}`);
			await this._actor.deleteEmbeddedDocuments("Item", [old._id]);
		}
		const slug = item.system?.slug ?? null;
		await this._moves.addCategory(`post-death-${slug}`, item.name, slug);
	}

	async removeInsert() {
		const item = [...this._actor.items].find(i => i.type === "insert") ?? null;
		if (!item) return;
		await this._moves.removeCategory(`post-death-${item.system?.slug}`);
		await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
	}

	async onInsertRemoved(slug) {
		if (slug) await this._moves.removeCategory(`post-death-${slug}`);
	}

	async buildSnapshot() {
		const item = [...this._actor.items].find(i => i.type === "insert") ?? null;
		if (!item) return null;
		const slug = item.system?.slug ?? null;
		return new PostDeathInsertSnapshotBuilder()
			.withSlug(slug)
			.withName(item.name)
			.withImg(item.img ?? null)
			.withDescription(item.system?.description ?? null)
			.withInstinct(await this._instinct.buildSnapshot(item.system?.instinct ?? null))
			.withLore(this._lore.buildSnapshot(item.system?.choices ?? []))
			.withMoves(await this._moves.getMoveSnapshotsForCategory(`post-death-${slug}`))
			.build();
	}
}
