// Which roster rows an edit actually touched.
//
// It exists because the people arrays are written whole: an update carries all twenty residents even
// when one name changed, so "what changed" can only be answered while the pre-edit document is still
// in hand. Acting on the delta rather than sweeping the list is what keeps a single typo fix in an
// established game from conjuring twenty actors at once.
const WATCHED = ["name", "occupation", "traits", "home"];

// Foundry expands a flattened update ({"system.folk": […]}) before the hooks see it, but
// both shapes are read here: the failure mode of guessing wrong is a sync that silently never runs.
function section(changed, key) {
	return changed?.system?.[key] ?? changed?.[`system.${key}`];
}

export class SteadingPeopleDelta {
	constructor(people = []) {
		this.people = people;
	}

	get isEmpty() {
		return this.people.length === 0;
	}

	/** `before` is the pre-edit `system`, `changed` the update diff; a roster absent from it is untouched. */
	static between(before, changed) {
		return new SteadingPeopleDelta(
			SteadingPeopleDelta._changedIds(before?.folk, section(changed, "folk")),
		);
	}

	static fromRaw(raw) {
		return new SteadingPeopleDelta(raw?.people ?? []);
	}

	toRaw() {
		return { people: this.people };
	}

	// Only the fields an actor mirrors count. A row whose `linkUuid` alone changed is our own
	// write-back landing, and treating that as a change would have the sync re-trigger itself.
	static _changedIds(before, after) {
		if (!Array.isArray(after)) return [];
		const prior = new Map((before ?? []).map(p => [p.id, p]));
		return after
			.filter(person => {
				const was = prior.get(person.id);
				return !was || WATCHED.some(field => (was[field] ?? "") !== (person[field] ?? ""));
			})
			.map(person => person.id);
	}
}
