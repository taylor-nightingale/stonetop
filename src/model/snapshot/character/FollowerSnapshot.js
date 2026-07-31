/**
 * Snapshot of a single owned follower card.
 *
 * @property {string}                   slug
 * @property {string}                   name
 * @property {string|null}              tags        — DW-style tags string
 * @property {number}                   hp
 * @property {number}                   hpMax
 * @property {string}                   armor       — prose; dice tokens rolled inline
 * @property {string}                   damage      — prose; dice tokens rolled inline
 * @property {string}                   instinct
 * @property {RichText}                  specialQuality
 * @property {ResourceSnapshot|null}    loyalty
 * @property {RichText}                  description
 * @property {ChoiceGroup|null}         choices
 */
import { Selection } from "../../data/Selection.js";
import { hasGroupTag } from "../../data/groupTag.js";
import { rich } from "../RichText.js";

export class FollowerSnapshot {
	constructor(b) {
		this.slug           = b._slug;
		this.name           = b._name;
		this.img            = b._img ?? null;
		// "creature" (full combat stats + inventory) vs "object" (the Ring: no HP/armor/damage/special
		// quality/inventory). The follower-card partial branches on `isObject`.
		this.kind           = b._kind ?? "creature";
		this.isObject       = this.kind === "object";
		this.tagSelection   = Selection.fromStored(b._tags);
		this.tags           = this.tagSelection.text;   // display string (back-compat)
		this.isGroup        = hasGroupTag(this.tagSelection);
		this.hp             = b._hp;
		this.hpMax          = b._hpMax;
		// Rendered game text → RichText (enriched by the character sheet's enrichRichTextTree pass).
		// damage carries dice → roll:true. instinct/cost render as pills (Selection), not rich text.
		this.armor          = rich(b._armor);
		this.damage         = rich(b._damage, { roll: true });
		this.instinctSelection = Selection.fromStored(b._instinct);
		this.instinct       = this.instinctSelection.text;  // display string (back-compat)
		this.moves          = rich(b._moves ?? "");
		this.specialQuality = rich(b._specialQuality ?? "");
		this.costSelection  = Selection.fromStored(b._cost);
		this.cost           = this.costSelection.text;
		this.loyalty        = b._loyalty;
		this.description    = rich(b._description ?? "");
		this.notes          = rich(b._notes ?? "");
		this.choices        = b._choices;
		// Group members (only meaningful when isGroup): each owns its HP + name/tags/traits.
		// Member tags/traits store only `selected`; options come from the group's suggestions.
		const sugg = b._memberSuggestions ?? { names: [], tags: [], traits: [] };
		this.memberSuggestions = { names: sugg.names ?? [], tags: sugg.tags ?? [], traits: sugg.traits ?? [] };
		this.membersNote    = rich(b._membersNote ?? "");
		const memberSel = (stored, options) =>
			Selection.multi(Selection.fromStored(stored, { multi: true }).values, { options });
		this.members        = (b._members ?? []).map((m, index) => ({
			index,
			name: m.name ?? "",
			hp:   { value: m.hp?.value ?? 0, max: m.hp?.max ?? 0 },
			tagSelection:   memberSel(m.tags,   this.memberSuggestions.tags),
			traitSelection: memberSel(m.traits, this.memberSuggestions.traits),
		}));
		// Animal companion (only meaningful when isCompanion). One grouped object holds the chosen
		// type + options (raw Selections) and the catalog of selectable types. The Type dropdown's
		// options are the catalog names; the options-pool's options ride on the stored selection.
		const c = b._companion ?? {};
		this.isCompanion    = !!c.enabled;
		const catalog       = Array.isArray(c.catalog) ? c.catalog : [];
		// The Type dropdown's options are ALWAYS the catalog names — not whatever is stored on the
		// `type` selection (which is empty until a type is first picked). fromStored ignores its
		// `options` arg for an object value, so set it explicitly.
		this.companionTypeSelection = Selection.fromStored(c.type, { multi: false });
		this.companionTypeSelection.options = catalog.map(t => t.name);
		this.companionOptionsSelection = Selection.fromStored(c.options, { multi: true });
		const chosen        = catalog.find(t => this.companionTypeSelection.values.includes(t.name)
			|| this.companionTypeSelection.values.includes(t.slug));
		this.companionPickCount   = chosen?.pickCount ?? 0;
		this.companionStartOptions = chosen?.defaults ?? []; // the pre-checked "(start with …)" picks
		// Inventory (shared outfit catalog + this follower's checked map). null when the catalog
		// isn't loaded. `ownedItems` = the display view; `sections` = the full catalog (edit view).
		this.inventory      = b._inventory ?? null;
		this.hasInventory   = !!this.inventory;
	}
}

/**
 * The character's followers, normalized: `bySlug` holds each follower's data exactly once (the
 * entities), and `tab` is the slug list the granting authorities placed on the Followers tab. Every
 * place a follower renders — the tab, an arcanum card — references it by slug and resolves against
 * `bySlug`, so no follower data is duplicated. Built by CharacterFollowers.
 */
export class FollowersSnapshot {
	constructor(bySlug = {}, tab = []) {
		this.bySlug = bySlug;   // { [slug]: FollowerSnapshot }
		this.tab    = tab;      // [slug, ...] — ordered slugs shown on the Followers tab
	}

	/** The tab's cards in order — references into `bySlug`, not copies (template convenience). */
	get tabCards() { return this.tab.map(s => this.bySlug[s]).filter(Boolean); }

	/** Resolve one slug to its card (or null) — used for inline references on cards. */
	get(slug) { return this.bySlug[slug] ?? null; }
}

export class FollowerSnapshotBuilder {
	withSlug(v)            { this._slug            = v; return this; }
	withName(v)            { this._name            = v; return this; }
	withImg(v)             { this._img             = v; return this; }
	withKind(v)            { this._kind            = v; return this; }
	withTags(v)            { this._tags            = v; return this; }
	withHp(v)              { this._hp              = v; return this; }
	withHpMax(v)           { this._hpMax           = v; return this; }
	withArmor(v)           { this._armor           = v; return this; }
	withDamage(v)          { this._damage          = v; return this; }
	withInstinct(v)        { this._instinct        = v; return this; }
	withMoves(v)           { this._moves           = v; return this; }
	withSpecialQuality(v)  { this._specialQuality  = v; return this; }
	withCost(v)            { this._cost            = v; return this; }
	withLoyalty(v)         { this._loyalty         = v; return this; }
	withDescription(v)     { this._description     = v; return this; }
	withNotes(v)           { this._notes           = v; return this; }
	withChoices(v)         { this._choices         = v; return this; }
	withMembers(v)         { this._members         = v; return this; }
	withMemberSuggestions(v) { this._memberSuggestions = v; return this; }
	withMembersNote(v)     { this._membersNote      = v; return this; }
	withCompanion(v)       { this._companion        = v; return this; }
	withInventory(v)       { this._inventory        = v; return this; }
	build()                { return new FollowerSnapshot(this); }
}
