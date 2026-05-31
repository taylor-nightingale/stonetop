import {SteadingDefaults} from "../../model/data/steading/SteadingDefaults.js";
import {DebilitySnapshot} from "../../model/snapshot/steading/SteadingSnapshot.js";

export class SteadingDebilities {
	constructor(actor) {
		this._actor = actor;
	}

	get _state() {
		return this._actor.system.debilities ?? {};
	}

	async setDebility(slug, active) {
		await this._actor.update({"system.debilities": {...this._state, [slug]: active}});
	}

	buildSnapshot() {
		const state = this._state;
		return SteadingDefaults.debilities.map(def =>
			new DebilitySnapshot(def.slug, def.description, def.note, state[def.slug] ?? false),
		);
	}
}
