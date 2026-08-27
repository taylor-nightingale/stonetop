import { FoundryPackStore } from "./FoundryPackStore.js";
import { PlaybookSummary } from "./PlaybookSummary.js";
import { StonetopPlaybook } from "../../../item/StonetopPlaybook.js";

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

	// The playbook as the pack ships it, untranslated. `findBySlug` reads a prepared document, whose
	// prose is in the world's language — copy that onto an actor and the character is stuck with
	// whatever language the copy happened in. Anything writing compendium data to an actor uses this.
	async findSourceBySlug(slug) {
		const data = await this.findItemDataBySlug(slug);
		return data ? new StonetopPlaybook(data) : null;
	}

	// Slug → name for every playbook, mirroring FoundryMoveRepository#namesBySlug. Read off the
	// compendium index, so a translated pack names them as the player sees them.
	async namesBySlug() {
		return new Map((await this.getAllPlaybooks())
			.map(p => [p.slug, p.name])
			.filter(([slug, name]) => slug && name));
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
