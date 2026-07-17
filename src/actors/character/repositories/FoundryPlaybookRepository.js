import { FoundryPackStore } from "./FoundryPackStore.js";
import { PlaybookSummary } from "./PlaybookSummary.js";

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

	// Raw item data for embedding on an actor (findBySlug returns the parsed PlaybookData instead).
	// Pack first, then world items — the same precedence as findBySlug.
	async findItemDataBySlug(slug) {
		const entry = await this._store.findEntry(e => e.system?.slug === slug);
		if (entry) {
			const doc = await this._store.getDocument(entry._id);
			return doc.toObject();
		}
		const worldDoc = (game.items?.contents ?? []).find(
			i => i.type === "playbook" && i.system?.slug === slug
		);
		return worldDoc ? worldDoc.toObject() : null;
	}

	async getAllPlaybooks() {
		const packEntries = await this._store.getAll();
		const packSlugs   = new Set(packEntries.map(e => e.system?.slug).filter(Boolean));

		const packSummaries = packEntries
			.filter(e => e.system?.slug)
			.map(e => new PlaybookSummary(e.name, e.system.slug));

		const worldSummaries = (game.items?.contents ?? [])
			.filter(i => i.type === "playbook" && i.system?.slug && !packSlugs.has(i.system.slug))
			.map(i => new PlaybookSummary(i.name, i.system.slug));

		return [...packSummaries, ...worldSummaries]
			.sort((a, b) => a.name.localeCompare(b.name));
	}
}
