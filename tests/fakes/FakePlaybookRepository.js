import { FakeWorldItemStore } from "./FakeWorldItemStore.js";
import { PlaybookSummary } from "../../src/actors/character/repositories/PlaybookSummary.js";

export class FakePlaybookRepository {
	_worldStore = new FakeWorldItemStore();

	constructor(playbook = null) {
		this._playbooks = {};
		if (playbook !== null) {
			this.add(playbook);
		}
	}

	addWorld(item) { this._worldStore.add(item); return this; }

	// Raw playbook item data keyed by slug, mirroring FoundryPlaybookRepository.findItemDataBySlug.
	addItemData(itemData) {
		this._itemData ??= {};
		this._itemData[itemData.system?.slug] = itemData;
		return this;
	}

	async findItemDataBySlug(slug) {
		return this._itemData?.[slug] ?? null;
	}

	async findBySlug(slug) {
		return this._playbooks[slug]
		    ?? await this._worldStore.findEntry(e => e.system?.slug === slug)
		    ?? null;
	}

	add(playbook) {
		this._playbooks[playbook.slug] = playbook;
	}

	async getAllPlaybooks() {
		const packSlugs = new Set(Object.keys(this._playbooks));
		const packEntries = Object.values(this._playbooks)
			.map(pb => new PlaybookSummary(pb.name, pb.slug));
		const worldItems = await this._worldStore.filterEntries(
			i => i.type === "playbook" && !packSlugs.has(i.system?.slug)
		);
		const worldEntries = worldItems.map(i => new PlaybookSummary(i.name, i.system.slug));
		return [...packEntries, ...worldEntries].sort((a, b) => a.name.localeCompare(b.name));
	}
}
