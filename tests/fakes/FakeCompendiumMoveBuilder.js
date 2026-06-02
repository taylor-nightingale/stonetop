import {toSlug} from "../../src/utils/slug.js";

export class FakeCompendiumMoveBuilder {
	_name = "Test Move";
	_rollType = null;
	_description = "";
	_isStartingMove = false;
	_requirement = null;
	_repeatMax = null;
	_resource = null;
	_choices = null;

	withName(name) {
		this._name = name;
		return this;
	}

	withPlaybook(playbookName) {
		this._playbook = playbookName;
		return this;
	}

	withRollType(rt) {
		this._rollType = rt;
		return this;
	}

	withDescription(desc) {
		this._description = desc;
		return this;
	}

	asStarting() {
		this._isStartingMove = true;
		return this;
	}

	withRequirement(req) {
		this._requirement = req;
		return this;
	}

	withRepeatMax(n) {
		this._repeatMax = n;
		return this;
	}

	withResource(res) {
		this._resource = res;
		return this;
	}

	withChoices(choices) {
		this._choices = choices;
		return this;
	}

	build() {
		const name = this._name;
		const system = {
			rollType: this._rollType,
			description: this._description,
			isStartingMove: this._isStartingMove,
			requirement: this._requirement,
			repeatMax: this._repeatMax,
			resource: this._resource,
			choices: this._choices,
			playbook: this._playbook,
		};
		return {
			_id: toSlug(name),
			name,
			system,
			toObject() {
				return {name, type: "move", system};
			},
		};
	}
}
