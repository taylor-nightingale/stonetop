import { FakeWorldItemStore } from "./FakeWorldItemStore.js";

export class FakePlaybookRepository {
	_worldStore = new FakeWorldItemStore();

	constructor(playbook = null) {
		this._playbooks = {};
		if (playbook !== null) {
			this.add(playbook);
		}
	}

	addWorld(item) { this._worldStore.add(item); return this; }

	async findBySlug(slug) {
		return this._playbooks[slug]
		    ?? await this._worldStore.findEntry(e => e.system?.slug === slug)
		    ?? null;
	}

	add(playbook) {
		this._playbooks[playbook.slug] = playbook;
	}
}
