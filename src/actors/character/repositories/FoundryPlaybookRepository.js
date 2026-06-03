import { FoundryPackStore } from "./FoundryPackStore.js";

export class FoundryPlaybookRepository {
	constructor() {
		this._store = new FoundryPackStore("stonetop.playbooks", ["system.slug"]);
		this._cache = new Map();
	}

	async findBySlug(slug) {
		if (this._cache.has(slug)) return this._cache.get(slug);
		const entry = await this._store.findEntry(e => e.system?.slug === slug);
		if (entry) {
			const doc = await this._store.getDocument(entry._id);
			const pb  = doc.asPlaybook();
			this._cache.set(slug, pb);
			return pb;
		}
		// Fall back to world items — call asPlaybook() directly on the live document
		const worldDoc = (game.items?.contents ?? []).find(
			i => i.type === "playbook" && i.system?.slug === slug
		);
		if (!worldDoc) return null;
		const pb = worldDoc.asPlaybook();
		this._cache.set(slug, pb);
		return pb;
	}
}
