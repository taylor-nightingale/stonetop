// Shared creature stat-block schema, composed (not inherited) by NpcData (Actor) and
// FollowerData (the `follower` Item). See follower-npc-model.md.

import { migrateChoicesField } from "../migration/migrateChoices.js";
import { Selection } from "../model/data/Selection.js";
import { normalizeGroupTags } from "../model/data/groupTag.js";

/**
 * A first-class "pick from a list (+ optional custom)" field, used for tagList (multi) and
 * instinct / cost (single). Stored shape mirrors Selection.toRaw().
 *
 * Stored as an OPAQUE ObjectField with a PLAIN-OBJECT initial, and the field MUST NOT be named
 * `tags`/`keywords`. Three Foundry V13 landmines, all confirmed in-app via Quench:
 *   1) The exact top-level item field names `tags` and `keywords` are reserved (core item search
 *      indexes them) and wiped on every update — use `tagList` etc. instead.
 *   2) A typed multi-select selection *SchemaField* (`selected` ArrayField + multi:true) is wiped
 *      on every update; the same data inside an ObjectField (e.g. member tags) is not.
 *   3) An ObjectField with a FUNCTION `initial` is RESET to that initial on update when the item
 *      has a non-empty sibling ArrayField (e.g. `members`); a PLAIN-OBJECT initial survives.
 * So: ObjectField + plain-object initial + a non-reserved name. See follower-data-architecture.md.
 */
export function selectionField({ multi = false, allowCustom = true } = {}) {
	const f = foundry.data.fields;
	return new f.ObjectField({ initial: { selected: [], options: [], multi, allowCustom } });
}

/** The stat block shared by NPCs and followers. Copied wholesale when dragging an NPC. */
export function creatureFields() {
	const f = foundry.data.fields;
	return {
		slug:           new f.StringField({ nullable: true, initial: null }),
		reference:      new f.StringField({ nullable: true, initial: null }), // lore-entry slug
		// NOT `tags`: Foundry reserves `system.tags` on items and wipes it on every update.
		// Confirmed in-app (Quench) — see migrateCreatureData + follower-data-architecture.md.
		tagList:   selectionField({ multi: true }),
		hp:             new f.SchemaField({
			value: new f.NumberField({ initial: 0, integer: true }),
			max:   new f.NumberField({ initial: 0, integer: true }),
		}),
		armor:          new f.StringField({ initial: "" }), // prose, e.g. "4 (resilience), 0 vs. bronze"
		damage:         new f.StringField({ initial: "" }), // prose; dice tokens are rolled inline
		specialQuality: new f.StringField({ initial: "" }),
		instinct:       selectionField({ multi: false }), // pick one (+ custom); see follower-data-architecture.md
		moves:          new f.StringField({ initial: "" }), // newline-separated; rendered as a bullet list
		description:    new f.StringField({ initial: "" }),
		notes:          new f.StringField({ initial: "" }),
	};
}

/** Follower-only bookkeeping layered on top of the creature core. */
export function followerFields() {
	const f = foundry.data.fields;
	return {
		arcanaSlug:   new f.StringField({ nullable: true, initial: null }),
		playbookSlug: new f.StringField({ nullable: true, initial: null }),
		owned:        new f.BooleanField({ initial: false }),
		cost:         selectionField({ multi: false }), // pick one (+ custom)
		loyalty:      new f.SchemaField({
			value: new f.NumberField({ initial: 0, integer: true }),
			max:   new f.NumberField({ initial: 3, integer: true }),
		}),
		choices:      new f.ArrayField(new f.ObjectField(), { initial: [] }),
		choiceValues: new f.ObjectField({ initial: {} }),
		// Group followers (tags include "group"): each member = { name, hp:{value,max}, tags:[],
		// traits:[] }. Stored as opaque ObjectFields, NOT typed SchemaFields — a member subfield
		// named the same as a top-level field (e.g. `tags`, `hp`) makes Foundry clobber the
		// top-level field when `system.members` is updated (deleting a member silently wiped the
		// follower's `group` tag). Encapsulating in an ObjectField means members have no schema
		// subfields, so nothing can collide. Member tags/traits store only the selected strings;
		// their options come from `memberSuggestions` at snapshot time. (Same reasoning as
		// `choices`, which is also ArrayField(ObjectField).) See follower-data-architecture.md.
		members:           new f.ArrayField(new f.ObjectField(), { initial: [] }),
		// Suggested names / tags / traits for individual members (reference + dropdown options).
		// Opaque object for the same anti-collision reason (its `tags` key must not shadow the
		// top-level `tags` field).
		memberSuggestions: new f.ObjectField({ initial: { names: [], tags: [], traits: [] } }),
		// Guidance shown above the members list (e.g. the Crew's "when one stands out…" note).
		membersNote: new f.StringField({ initial: "" }),
		// Animal companion (Ranger). ALL companion state in one opaque ObjectField, mirroring
		// `members`: a single grouped object can't collide with sibling fields and is never reached
		// by migrateCreatureData (so it can't be default-injected on a partial update — the
		// migrate-on-diff landmine). PLAIN-object initial (a function initial is reset on update).
		// Atomic: writers read-modify-write the WHOLE object (see CharacterFollowers.setCompanionType
		// / toggleCompanionOption). `catalog` = the selectable types (each a stat template + its own
		// "pick N more" pool). See follower-data-architecture.md §3.
		companion: new f.ObjectField({ initial: {
			enabled: false,
			type:    { selected: [], options: [], multi: false, allowCustom: true },
			options: { selected: [], options: [], multi: true,  allowCustom: true },
			catalog: [],
		} }),
		// Follower inventory — parity with the character inventory, but stored inline (a follower is an
		// embedded Item and can't own embedded Items). Opaque ObjectField (atomic read-modify-write
		// like `companion`/`members`; never default-injected by migrateCreatureData — the
		// migrate-on-diff landmine). `checked`: which items (shared-catalog + custom) are held;
		// `customItems`: the follower's own gear defs {slug,name,weight,tags,note,inventoryColumn,twoCol};
		// `resources`: per-item resource counts (ammo etc.). Load is computed + informational (never a
		// cap). PLAIN-object initial. See follower-data-architecture.md.
		inventory: new f.ObjectField({ initial: { checked: {}, customItems: [], resources: {} } }),
	};
}

// Legacy "Inventory" choice picks (Crew) → shared outfit-item slugs for `inventory.checked`.
const CREW_INV_SLUG = {
	"inv-hatchet":  "hatchet",
	"inv-spear":    "spear",
	"inv-bow":      "bow-arrows",
	"inv-shield":   "shield",
	"inv-hides":    "thick-hides",
	"inv-cloak":    "cloak",
	"inv-supplies": "supplies",
};

/**
 * Normalize legacy creature data into the shared shapes. Runs for both Actor and Item:
 * NPC actors get the real shape upgrades; followers are mostly no-ops.
 * Mutates and returns `source`.
 */
export function migrateCreatureData(source) {
	// tags/keywords -> tagList: Foundry reserves the exact item field names `system.tags` and
	// `system.keywords` and wipes them on every update, so creatures store tags under `tagList`.
	// Move a legacy field across (also the interim `keywords`/`creatureTags` names) ONLY when it
	// is actually present, and normalize a legacy free string "a, b, c" -> structured selection
	// ONLY when tagList is a string.
	//
	// CRITICAL: never inject a default for an *absent* tagList. Foundry re-runs migrateData on
	// the partial {changed-keys-only} diff of EVERY update, where tagList is absent; defaulting it
	// to an empty Selection there clobbers the stored tags on every edit. The schema field's
	// `initial` supplies the default for full construction. (Same applies to instinct below.)
	const legacyTags = source.keywords ?? source.creatureTags ?? source.tags;
	if (source.tagList === undefined && legacyTags !== undefined) {
		source.tagList = legacyTags;
	}
	delete source.tags;
	delete source.keywords;
	delete source.creatureTags;
	if (typeof source.tagList === "string") {
		source.tagList = Selection.fromStored(source.tagList, { multi: true }).toRaw();
	}
	// Normalize the group tag to its canonical lowercase token ("Group"/"Group (3)" -> "group") so
	// isGroup detection works regardless of the source's casing (book NPCs print "Group"; a follower
	// dragged from one inherits it). Tag-only: never seeds members here (this runs on partial update
	// diffs — see the tagList caveat above; member seeding happens at creation, not migration). Only
	// touches tagList when it is already present, so an absent tagList stays absent.
	if (source.tagList && typeof source.tagList === "object" && !Array.isArray(source.tagList)) {
		if (Array.isArray(source.tagList.selected)) source.tagList.selected = normalizeGroupTags(source.tagList.selected).tags;
		if (Array.isArray(source.tagList.options))  source.tagList.options  = normalizeGroupTags(source.tagList.options).tags;
	}

	// hp: flat NPC number (+ maxHp) OR legacy {value,min,max} -> {value, max}.
	// CRITICAL (migrate-on-diff): a partial update carries only the changed key, e.g. {hp:{value:4}}
	// when you step current HP. NEVER inject the absent sibling (max here) — doing so clobbered the
	// stored max with the current value (the "stepping HP resets max" bug). Only transform genuinely
	// legacy shapes (a number, a `min` field, or a split `maxHp`); leave a partial {value}/{max}
	// object as-is so Foundry's SchemaField merge preserves the unchanged sibling.
	if (typeof source.hp === "number") {
		source.hp = { value: source.hp, max: source.maxHp ?? source.hp };
		delete source.maxHp;
	} else if (source.hp && typeof source.hp === "object") {
		if ("min" in source.hp) delete source.hp.min;
		if (source.maxHp !== undefined && source.hp.max === undefined) source.hp.max = source.maxHp;
		delete source.maxHp;
	} else if (source.maxHp !== undefined) {
		source.hp = { max: source.maxHp };
		delete source.maxHp;
	}

	// armor: legacy number or { value, note } -> one prose string
	if (typeof source.armor === "number") {
		source.armor = String(source.armor);
	} else if (source.armor && typeof source.armor === "object") {
		const note = source.armor.note ?? "";
		source.armor = `${source.armor.value ?? ""} ${note}`.trim();
	}

	// damage: structured {value|die, label, tags} -> one prose string (NPC strings pass through)
	if (source.damage != null && typeof source.damage === "object") {
		const die   = source.damage.value ?? source.damage.die ?? "";
		const label = source.damage.label ?? "";
		const tags  = source.damage.tags ?? "";
		const core  = [label, die].filter(Boolean).join(" ");
		source.damage = tags ? (core ? `${core} (${tags})` : `(${tags})`) : core;
	}

	// specialQualities -> specialQuality
	if (source.specialQualities !== undefined && source.specialQuality === undefined) {
		source.specialQuality = source.specialQualities;
		delete source.specialQualities;
	}

	// Legacy: instinct moves were bullet lines inside the instinct string. Split them out
	// into a dedicated `moves` field (first line stays the instinct).
	if (source.moves === undefined && typeof source.instinct === "string" && source.instinct.includes("\n")) {
		const lines = source.instinct.split("\n");
		source.instinct = lines[0].trim();
		source.moves = lines.slice(1)
			.map(l => l.replace(/^\s*[-ä>•]\s*/, "").trim())
			.filter(Boolean)
			.map(l => `- ${l}`)               // markdown bullets → rendered as a standard <ul>
			.join("\n");
	}

	// Legacy follower damage/cost/notes lived as free-text `choices` entries. Promote the
	// cost/notes values to fields, then drop those entries (and weapon/damage) so `choices`
	// holds only pick rows.
	const group = Array.isArray(source.choices) ? source.choices[0] : null;
	if (group?.list?.length) {
		const cv = source.choiceValues?.choices;
		const entryDefault = slug => group.list.find(e => e.slug === slug)?.input?.default;
		for (const [slug, field] of [["cost", "cost"], ["notes", "notes"]]) {
			const val = cv?.[`${slug}-input`] ?? entryDefault(slug);
			if (val && !source[field]) source[field] = val;
		}
		group.list = group.list.filter(e => !["weapon", "damage", "cost", "notes"].includes(e.slug));
	}

	// Legacy follower inventory: the "Inventory" entry + a `pick` of inv-* options (the Crew) becomes
	// `inventory.checked` against the shared outfit-item slugs; then those rows are dropped from
	// `choices`. Only when those rows are actually present — never default-inject `inventory` (the
	// migrate-on-diff landmine: a partial update diff has no `choices`, so this block is skipped).
	if (group?.list?.length) {
		const hasInvRows = group.list.some(e =>
			e.content?.title === "Inventory" ||
			(e.options ?? []).some(o => o.slug?.startsWith?.("inv-")));
		if (hasInvRows) {
			const cv = source.choiceValues?.choices ?? {};
			if (source.inventory === undefined) source.inventory = { checked: {} };
			for (const [legacy, slug] of Object.entries(CREW_INV_SLUG)) {
				if ((cv[legacy] ?? 0) > 0) source.inventory.checked[slug] = true;
			}
			group.list = group.list.filter(e =>
				e.content?.title !== "Inventory" &&
				!(e.options ?? []).some(o => o.slug?.startsWith?.("inv-")));
		}
	}

	// instinct & cost: legacy free string -> single-select Selection (run after the instinct
	// moves-split and the cost promotion above, which both need the raw strings). Only normalize
	// when the value is a string — never inject a default for an absent field (see the tagList
	// note: that would clobber the stored value on every partial update).
	if (typeof source.instinct === "string") {
		source.instinct = Selection.fromStored(source.instinct, { multi: false }).toRaw();
	}
	if (typeof source.cost === "string") {
		source.cost = Selection.fromStored(source.cost, { multi: false }).toRaw();
	}

	// Normalize the remaining choice rows (heading/follower → entry, content renames, input.type).
	migrateChoicesField(source.choices);

	return source;
}
