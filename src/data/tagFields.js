/**
 * Tags are stored as what they are: an ordered list of tokens. Nothing else about a tag list is
 * data — `multi` and `allowCustom` are constants of the field, and the options a picker offers come
 * from its context (the book's glossary for gear, `tagOptions` for a creature that prints its own
 * choices, `memberSuggestions` for a group member). See src/model/data/Tags.js.
 *
 * Two Foundry V13 landmines apply, both confirmed in-app via Quench (see src/dev/quenchTests.js):
 *   1) The exact top-level item field names `tags` and `keywords` are reserved — core's item search
 *      indexes them and wipes them on every update. Hence `tagList`, never `tags`. Nested `tags`
 *      (inside an ObjectField) is safe, but one name everywhere beats one name per depth.
 *   2) A multi-select stored as a SchemaField (`selected` ArrayField + `multi`) is wiped on every
 *      update. A bare top-level ArrayField is not — `members` on a group follower has always been
 *      one and survives.
 */
export function tagListField() {
	const f = foundry.data.fields;
	return new f.ArrayField(new f.StringField({ blank: false }));
}

/**
 * The tag choices a stat block prints for itself ("Group, exceptional, [pick 1 more]"). Authored
 * data, unlike the suggestions a context supplies — so it is stored, and stored apart from the value
 * rather than smuggled inside it. `memberSuggestions` is the same idea for group members.
 */
export function tagOptionsField() {
	const f = foundry.data.fields;
	return new f.ArrayField(new f.StringField({ blank: false }));
}
