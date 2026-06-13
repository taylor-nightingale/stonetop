// Shared creature stat-block schema, composed (not inherited) by NpcData (Actor) and
// NpcItemData (follower Item). See follower-npc-model.md.

import { migrateChoicesField } from "../migration/migrateChoices.js";
import { Selection } from "../model/data/Selection.js";

/**
 * A first-class "pick from a list (+ optional custom)" field, used for tags (multi) and —
 * later — instinct / cost (single). Stored shape mirrors Selection.toRaw().
 * See follower-data-architecture.md.
 */
export function selectionField({ multi = false, allowCustom = true } = {}) {
	const f = foundry.data.fields;
	return new f.SchemaField({
		selected:    new f.ArrayField(new f.StringField()),
		options:     new f.ArrayField(new f.StringField()),
		multi:       new f.BooleanField({ initial: multi }),
		allowCustom: new f.BooleanField({ initial: allowCustom }),
	});
}

/** The stat block shared by NPCs and followers. Copied wholesale when dragging an NPC. */
export function creatureFields() {
	const f = foundry.data.fields;
	return {
		slug:           new f.StringField({ nullable: true, initial: null }),
		reference:      new f.StringField({ nullable: true, initial: null }), // lore-entry slug
		tags:           selectionField({ multi: true }),
		hp:             new f.SchemaField({
			value: new f.NumberField({ initial: 0, integer: true }),
			max:   new f.NumberField({ initial: 0, integer: true }),
		}),
		armor:          new f.StringField({ initial: "" }), // prose, e.g. "4 (resilience), 0 vs. bronze"
		damage:         new f.StringField({ initial: "" }), // prose; dice tokens are rolled inline
		specialQuality: new f.StringField({ initial: "" }),
		instinct:       new f.StringField({ initial: "" }),
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
		cost:         new f.StringField({ initial: "" }),
		loyalty:      new f.SchemaField({
			value: new f.NumberField({ initial: 0, integer: true }),
			max:   new f.NumberField({ initial: 3, integer: true }),
		}),
		choices:      new f.ArrayField(new f.ObjectField(), { initial: [] }),
		choiceValues: new f.ObjectField({ initial: {} }),
	};
}

/**
 * Normalize legacy creature data into the shared shapes. Runs for both Actor and Item:
 * NPC actors get the real shape upgrades; followers are mostly no-ops.
 * Mutates and returns `source`.
 */
export function migrateCreatureData(source) {
	// tags: legacy free string "a, b, c" -> structured multi-selection
	if (source.tags === undefined || typeof source.tags === "string") {
		source.tags = Selection.fromStored(source.tags ?? "", { multi: true }).toRaw();
	}

	// hp: flat NPC number (+ maxHp) OR legacy {value,min,max} -> {value, max}
	if (source.hp !== undefined || source.maxHp !== undefined) {
		const hp    = source.hp;
		const value = typeof hp === "number" ? hp : (hp?.value ?? 0);
		const max   = (typeof hp === "object" ? hp?.max : undefined) ?? source.maxHp ?? value;
		source.hp = { value, max };
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

	// Normalize the remaining choice rows (heading/follower → entry, content renames, input.type).
	migrateChoicesField(source.choices);

	return source;
}
