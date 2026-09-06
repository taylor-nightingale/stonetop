import { AppliedEffect } from "../model/data/steading/AppliedEffect.js";
import { TurnoverLine } from "../model/snapshot/steading/TurnoverStatement.js";

// Applying an improvement's results used to be a one-way door recorded per IMPROVEMENT:
//
//     system.improvementsApplied = { mill: true }
//     system.turnoverExcluded    = { "mill:0": true }
//
// which says THAT something happened and nothing about WHAT, so nothing could be taken back. The
// record is now per LINE and carries the write itself, so each applied result is independently
// revertable — see AppliedEffect.
//
// Two things this has to get right, and one it deliberately gets wrong:
//
//   * `improvementsApplied.<slug>` becomes a record on each of that improvement's COMPLETION lines.
//     A steading that has taken its +1 Fortunes must not be offered it a second time by the new
//     storage finding no record.
//   * `turnoverExcluded` is dropped. Opting out before committing is gone: you either apply a line
//     or you do not.
//   * A migrated record is marked `legacy`, so it reads as applied and offers no Revert. That is the
//     deliberate loss: the old storage cannot say what was written — an improvement's requirements
//     may have moved since, and its ratings been edited by hand — so an inverse computed now would
//     be a guess wearing the clothes of a fact.
//
// Idempotent: a slug key is consumed and removed, and a line key is already in the new shape and is
// left alone. `-=` is how a key is actually dropped; assigning null would leave it in place, because
// Foundry MERGES an object-field update rather than replacing it.
export async function migrateSteadingApplied(actor, repository) {
	const stored = actor.system?.improvementsApplied ?? {};
	const update = {};

	if (actor.system?.turnoverExcluded !== undefined) update["system.-=turnoverExcluded"] = null;

	for (const key of Object.keys(stored)) {
		// Already per-line: either this migration has run, or the steading was applied since.
		if (TurnoverLine.parseId(key)) continue;

		update[`system.improvementsApplied.-=${key}`] = null;

		const improvement = await repository?.getBySlug?.(key);
		for (const { effect, index } of improvement?.effects?.entries?.() ?? []) {
			if (!effect.trigger.isCompletion || !effect.isAutomatic) continue;
			update[`system.improvementsApplied.${TurnoverLine.idFor(key, index)}`] =
				new AppliedEffect({ legacy: true }).toRaw();
		}
	}

	if (Object.keys(update).length) await actor.update(update);
}
