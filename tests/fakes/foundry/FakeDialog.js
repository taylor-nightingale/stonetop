export class FakeDialog {
	static _instance = null;

	constructor(config, options) {
		this._config = config;
		this._options = options;
		FakeDialog._instance = this;
	}

	render() { /* no-op */ }
	close() { /* no-op */ }

	static reset() { FakeDialog._instance = null; }
	static get lastConfig() { return FakeDialog._instance?._config ?? null; }
	static get lastOptions() { return FakeDialog._instance?._options ?? null; }

	static clickButton(statKey, rollMode = "normal") {
		const html = { find: () => ({ val: () => rollMode }) };
		FakeDialog._instance._config.buttons[statKey].callback(html);
	}

	static close() { FakeDialog._instance?._config.close?.(); }
}
