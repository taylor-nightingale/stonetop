export class FakeVitals {
	_playbookData = null;

	async updateVitalsFromPlaybook(data) { this._playbookData = data; }

	playbookUpdatedWith() { return this._playbookData; }
}
