import {toSlug} from "../../src/utils/slug.js";

export class FakeCompendiumMoveBuilder {
	_name = "Test Move";
	_rollStat = null;
	_description = "";
	_requirement = null;
	_repeatMax = null;
	_resource = null;
	_choices = null;

	withName(name) {
		this._name = name;
		return this;
	}

	withRollStat(rt) {
		this._rollStat = rt;
		return this;
	}

	withRollType(rt) { return this.withRollStat(rt); }

	withDescription(desc) {
		this._description = desc;
		return this;
	}

	// Test-scenario marker (NOT a move field): "this move is one its container offers as starting".
	// The fake repo surfaces it via startingSlugs() so tests can build a playbook's startingMoves.
	asStarting() {
		this._starting = true;
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

	withMoveType(moveType) {
		this._moveType = moveType;
		return this;
	}

	withChoices(choices) {
		this._choices = choices;
		return this;
	}

	withMoveResults(moveResults) {
		this._moveResults = moveResults;
		return this;
	}

	build() {
		const name = this._name;
		const slug = toSlug(name);
		const system = {
			slug,
			rollStat: this._rollStat,
			description: this._description,
			requirement: this._requirement,
			repeatMax: this._repeatMax,
			resource: this._resource,
			choices: this._choices,
			moveType: this._moveType ?? null,
			moveResults: this._moveResults ?? null,
		};
		return {
			_id: slug,
			name,
			type: "move",   // real items carry a top-level type; WorldItemStore filters on it
			_starting: this._starting ?? false,   // test-only marker (see asStarting); not in system/toObject
			system,
			toObject() {
				// Real Foundry documents keep their _id in toObject(); WorldItemStore hands these
				// entries back as index rows, and callers look the document up again by that id.
				return {_id: slug, name, type: "move", system};
			},
		};
	}
}
