// Shared creature stat-block schema for the lightweight NPC actor (ported from
// taylor-nightingale/stonetop's creature.js, trimmed to the actor-only subset — no
// follower bookkeeping and no legacy migration, since this fork ships no NPC legacy data).
//
// A `selectionField` stores a Selection.toRaw() shape as an OPAQUE ObjectField with a
// PLAIN-OBJECT initial. The field MUST NOT be named `tags`/`keywords`: Foundry V13 reserves
// those exact item field names (core search indexes them) and wipes them on every update —
// so creature tags live under `tagList`.

/**
 * A "pick from a list (+ optional custom)" field, used for tagList (multi) and instinct (single).
 * Opaque ObjectField with a plain-object initial (a function initial is reset on update).
 */
export function selectionField({ multi = false, allowCustom = true } = {}) {
	const f = foundry.data.fields;
	return new f.ObjectField({ initial: { selected: [], options: [], multi, allowCustom } });
}

/** The stat block shared by NPCs (and, upstream, followers). */
export function creatureFields() {
	const f = foundry.data.fields;
	return {
		slug:           new f.StringField({ nullable: true, initial: null }),
		reference:      new f.StringField({ nullable: true, initial: null }), // lore-entry slug
		// NOT `tags`: Foundry reserves `system.tags` on items and wipes it on every update.
		tagList:        selectionField({ multi: true }),
		hp:             new f.SchemaField({
			value: new f.NumberField({ initial: 0, integer: true }),
			max:   new f.NumberField({ initial: 0, integer: true }),
		}),
		armor:          new f.StringField({ initial: "" }), // prose, e.g. "4 (resilience), 0 vs. bronze"
		damage:         new f.StringField({ initial: "" }), // prose; dice tokens are rolled inline
		specialQuality: new f.StringField({ initial: "" }),
		instinct:       selectionField({ multi: false }),   // pick one (+ custom)
		moves:          new f.StringField({ initial: "" }), // newline-separated; rendered as a bullet list
		description:    new f.StringField({ initial: "" }),
		notes:          new f.StringField({ initial: "" }),
	};
}
