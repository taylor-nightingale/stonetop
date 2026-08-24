/**
 * A first-class "pick from a list (+ optional custom)" field. Used for tagList (multi) and
 * instinct / cost (single) on creatures, and for tagList on gear — one stored shape wherever a
 * document holds tags. Mirrors Selection.toRaw().
 *
 * Stored as an OPAQUE ObjectField with a PLAIN-OBJECT initial, and the field MUST NOT be named
 * `tags`/`keywords`. Three Foundry V13 landmines, all confirmed in-app via Quench:
 *   1) The exact top-level item field names `tags` and `keywords` are reserved (core item search
 *      indexes them) and wiped on every update — use `tagList` etc. instead.
 *   2) A typed multi-select selection *SchemaField* (`selected` ArrayField + multi:true) is wiped
 *      on every update; the same data inside an ObjectField (e.g. member tags) is not.
 *   3) An ObjectField with a FUNCTION `initial` is RESET to that initial on update when the item
 *      has a non-empty sibling ArrayField (e.g. `members`); a PLAIN-OBJECT initial survives.
 * So: ObjectField + plain-object initial + a non-reserved name.
 */
export function selectionField({ multi = false, allowCustom = true } = {}) {
	const f = foundry.data.fields;
	return new f.ObjectField({ initial: { selected: [], options: [], multi, allowCustom } });
}
