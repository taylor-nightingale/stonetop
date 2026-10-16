/**
 * Stands in for RollModeDialog: records every prompt it is shown and answers what the test told it to
 * — a RollChoice, or null for a dismissed dialog.
 */
export class FakeRollModeDialog {
	prompts = [];
	options = null;
	_answer = null;

	answer(choice) {
		this._answer = choice;
		return this;
	}

	get lastPrompt() {
		return this.prompts.at(-1) ?? null;
	}

	async pick(prompt, options = {}) {
		this.prompts.push(prompt);
		this.options = options;
		return this._answer;
	}
}
