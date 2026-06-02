export class FakePlaybookRepository {
	constructor(playbook = null) {
		this._playbooks = {};
		if (playbook !== null) {
			this.add(playbook);
		}
	}

	async findBySlug(slug) {
		return this._playbooks[slug] ?? null;
	}

	add(playbook) {
		this._playbooks[playbook.slug] = playbook;
	}
}
