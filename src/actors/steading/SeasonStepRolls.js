import { AppliedStepRoll } from "../../model/data/steading/AppliedStepRoll.js";
import { SeasonStepAddress } from "../../model/data/steading/SeasonStepAddress.js";

/**
 * What this season's dice-rolling steps have already done to Surplus, addressed by where in the
 * move's own procedure each roll was made.
 *
 * Its own class because it is its own store: `system.seasonStepsApplied`, season-scoped and cleared
 * when the wheel turns, exactly as `turnoverApplied` is. A step has no id of its own and needs none —
 * the procedure it belongs to is the move of the season the record is scoped to, so the two can never
 * be read against each other — so a SeasonStepAddress is the key: the step's index, and the tier of
 * its own results where the roll belongs to one of those instead.
 */
export class SeasonStepRolls {
	constructor(actor) {
		this._actor = actor;
	}

	get _raw() { return this._actor.system?.seasonStepsApplied ?? {}; }

	/** What the roll at this address did, or null — the whole of "has this already been rolled?". */
	get(address) {
		const key = SeasonStepAddress.parse(address)?.key;
		return key ? AppliedStepRoll.fromRaw(this._raw[key]) : null;
	}

	/** Every record, by address key — what the sheet reads to pair each roll with what it did. */
	all() {
		return Object.fromEntries(Object.entries(this._raw)
			.map(([key, raw]) => [key, AppliedStepRoll.fromRaw(raw)])
			.filter(([, applied]) => applied));
	}

	async record(address, applied) {
		const key = SeasonStepAddress.parse(address)?.key;
		if (!key) return;
		await this._actor.update({ [`system.seasonStepsApplied.${key}`]: applied.toObject() });
	}

	/**
	 * Foundry MERGES an object-field update rather than replacing it, so a key is removed by name
	 * with `-=` — assigning null or {} would leave the record in place and the step would still read
	 * as rolled.
	 */
	async forget(address) {
		const key = SeasonStepAddress.parse(address)?.key;
		if (!key) return;
		await this._actor.update({ [`system.seasonStepsApplied.-=${key}`]: null });
	}
}
