// Follower-building data & helpers (Book I, "NPCs & Followers" — Creating
// followers, pp.474–479). This is the rules content behind the Create-a-Follower
// walkthrough and the monster→follower conversion. It's deliberately
// framework-free (no Foundry globals) so the derivations can be unit-tested and
// reused by both dialogs and the character sheet.

import { creatureTypeFaIcon } from "../bestiary/creature-types.js";

// ── Step 3: hit points (p.476–477) ───────────────────────────────────────────
// "How resilient are they? (pick 1)" then "What else applies? (pick all)".
export const FOLLOWER_HP_BASE = [
	{ key: "weak",  label: "Weak / frail / soft", hp: 3 },
	{ key: "able",  label: "Able-bodied",         hp: 6 },
	{ key: "tough", label: "Tough / strong / hard", hp: 9 },
];
export const FOLLOWER_HP_MODS = [
	{ key: "tiny",  label: "They are tiny",         hp: -2 },
	{ key: "large", label: "They are large",        hp: 4 },
	{ key: "fates", label: "The fates smile on them", hp: 2 },
];

// ── Step 4: armor (p.477) ────────────────────────────────────────────────────
export const FOLLOWER_ARMOR_BASE = [
	{ key: "cloth",   label: "Naught but cloth and flesh", armor: 0 },
	{ key: "leather", label: "Leathers or thick hide",     armor: 1 },
	{ key: "mail",    label: "Mail, scale, or similar",    armor: 2 },
	{ key: "steel",   label: "Steel, boney plates, carapace", armor: 3 },
	{ key: "magical", label: "Potent magical wards or supernatural resilience", armor: 4 },
];
export const FOLLOWER_ARMOR_MODS = [
	{ key: "tiny",    label: "They are tiny",          armor: 1 },
	{ key: "shield",  label: "They bear a shield or similar", armor: 1 },
	{ key: "skilled", label: "They are skilled in defense", armor: 1 },
	{ key: "organs",  label: "They lack vital organs", armor: 1 },
];

// ── Step 5: damage (p.477) ───────────────────────────────────────────────────
// "How dangerous are they? (pick 1)". Range and other tags come from gear, so
// the player appends a free-text form ("hand", "near, low ammo") themselves.
export const FOLLOWER_DAMAGE_OPTIONS = [
	{ key: "weak",    label: "Not very",                  die: "d4" },
	{ key: "defends", label: "Can defend themselves",     die: "d6" },
	{ key: "veteran", label: "Veteran fighter or predator", die: "d8" },
];

// ── Step 2: tags (p.476) ─────────────────────────────────────────────────────
// "Give followers a mix of tags that are useful, problematic, and mixed
// blessings." Offered as suggestions; the walkthrough also takes free-text tags.
export const FOLLOWER_TAG_GROUPS = [
	{ label: "Useful", tags: [
		"agile", "archer", "athletic", "beautiful", "brave", "cunning", "fast",
		"fierce", "hardy", "healer", "intimidating", "magical", "observant",
		"organized", "patient", "respected", "self-sufficient", "sharp-eyed",
		"stealthy", "tireless", "tracker", "warrior",
	] },
	{ label: "Problematic", tags: [
		"bigoted", "drunk", "greedy", "gullible", "lecherous", "naive", "proud",
		"rookie", "reckless", "short-fused", "stubborn", "frail",
	] },
	{ label: "Mixed blessing", tags: [
		"animal-lover", "annoying", "big", "bully", "callous", "cautious",
		"devious", "eager", "thieving", "gossipy", "honest", "kind", "little",
		"shameless", "terrifying",
	] },
];

// ── Step 6: instinct prompts for a follower (p.478) ──────────────────────────
// A follower's instinct "should cause trouble for the PC who leads them."
export const FOLLOWER_INSTINCT_EXAMPLES = [
	"To take things too far",
	"To question leadership and authority",
	"To cling tightly to tradition",
	"To act impulsively",
	"To give in to temptation",
	"To not take things seriously",
	"To freeze up in the face of danger",
];

// ── Step 8: cost (p.479) ─────────────────────────────────────────────────────
export const FOLLOWER_COST_EXAMPLES = [
	"Coin, payment, treasure",
	"Renown, public recognition",
	"Affection, respect (from you)",
	"Knowledge (about what?)",
	"Wrongs righted, good deeds done",
	"Amusement, entertainment",
	"Progress (towards a particular goal)",
];

// Sum a base option's value with the chosen modifiers' values, never below the
// floor (HP can't fall below 1; armor not below 0).
function _sum(base, mods, picks, field, floor) {
	const baseVal = base.find(o => o.key === picks?.base)?.[field] ?? 0;
	const set = new Set(Array.isArray(picks?.mods) ? picks.mods : []);
	const modVal = mods.reduce((t, o) => t + (set.has(o.key) ? o[field] : 0), 0);
	return Math.max(floor, baseVal + modVal);
}

/** Derived max HP from a {base, mods} pick. Floors at 1. */
export function deriveHp(picks) {
	return _sum(FOLLOWER_HP_BASE, FOLLOWER_HP_MODS, picks, "hp", 1);
}

/** Derived armor from a {base, mods} pick. Floors at 0. */
export function deriveArmor(picks) {
	return _sum(FOLLOWER_ARMOR_BASE, FOLLOWER_ARMOR_MODS, picks, "armor", 0);
}

/** The damage die for a chosen "how dangerous" key (e.g. "defends" → "d6"). */
export function deriveDamageDie(key) {
	return FOLLOWER_DAMAGE_OPTIONS.find(o => o.key === key)?.die ?? "d6";
}

// Join a damage die with an optional parenthetical form, e.g. ("d6", "hand") →
// "d6 (hand)". A form already wrapped in parens is left as-is.
export function formatDamage(die, form) {
	const d = String(die ?? "").trim();
	const f = String(form ?? "").trim().replace(/^\(|\)$/g, "").trim();
	if (!d) return f ? `(${f})` : "";
	return f ? `${d} (${f})` : d;
}

// Extract a follower's numeric armor from a value that may already be a number,
// a plain string ("2"), the book's conditional form ("2 (0 vs. iron)"), or a
// placeholder ("—"). Returns the leading non-negative integer, or 0 when there's
// no number. Followers don't model conditional armor, so the "(0 vs. iron)"
// remainder is dropped here — keep it in a notes field if it matters.
export function parseFollowerArmor(raw) {
	if (typeof raw === "number") return Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0;
	const m = String(raw ?? "").match(/-?\d+/);
	return m ? Math.max(0, parseInt(m[0], 10)) : 0;
}

// Normalize a free-text or array tag list into a clean, de-duplicated array of
// trimmed strings (case-insensitive de-dupe, first spelling wins).
export function normalizeTags(tags) {
	const out = [];
	const seen = new Set();
	const push = (t) => {
		const s = String(t ?? "").trim();
		if (!s) return;
		const k = s.toLowerCase();
		if (seen.has(k)) return;
		seen.add(k);
		out.push(s);
	};
	if (Array.isArray(tags)) tags.forEach(push);
	else String(tags ?? "").split(",").forEach(push);
	return out;
}

/**
 * Build the stored shape for a custom follower (the object kept at
 * flags.stonetop.customFollowers.<id>). Pure: the caller assigns the id and
 * an `order` for stable sorting. hpCurrent defaults to full unless given.
 */
export function buildCustomFollower(input = {}) {
	const hpMax = Math.max(0, Math.trunc(Number(input.hp) || 0));
	const hpCurrent = input.hpCurrent == null
		? hpMax
		: Math.min(hpMax, Math.max(0, Math.trunc(Number(input.hpCurrent) || 0)));
	const gear = (Array.isArray(input.gear) ? input.gear : [])
		.map(g => (typeof g === "string"
			? { label: g.trim(), checked: false }
			: { label: String(g?.label ?? "").trim(), checked: !!g?.checked }))
		.filter(g => g.label);
	return {
		name:         String(input.name ?? "").trim(),
		pronoun:      String(input.pronoun ?? "").trim(),
		typeLabel:    String(input.typeLabel ?? "").trim() || "follower",
		portraitIcon: String(input.portraitIcon ?? "").trim() || "fas fa-user",
		tags:         normalizeTags(input.tags),
		hpMax,
		hpCurrent,
		armor:        parseFollowerArmor(input.armor),
		damage:       String(input.damage ?? "").trim(),
		instinct:     String(input.instinct ?? "").trim(),
		moves:        String(input.moves ?? "").trim(),
		cost:         String(input.cost ?? "").trim(),
		notes:        String(input.notes ?? "").trim(),
		gear,
		butcher:      input.butcher ? String(input.butcher).trim() : null,
		loyalty:      Math.max(0, Math.trunc(Number(input.loyalty) || 0)),
		sourceUuid:   input.sourceUuid ? String(input.sourceUuid) : null,
	};
}

// ── Order Followers roll math (p.462) ────────────────────────────────────────
// "Instead of rolling +STAT, roll and… +1 if they have at least one appropriate
// tag or move, or +2 if they're also exceptional; +0 if no relevant tag or move;
// roll with disadvantage if any of their tags would get in the way." Which tags
// help or hinder is a table judgment call, so the caller passes the counts the
// player resolved rather than this guessing from tag text.
//
// `helps`/`hinders` are how many of the follower's tags/moves the player marked as
// applicable / in-the-way; `advantage` is an optional manual toggle (e.g. a group
// focusing fire). Returns { bonus, rollMode } ready for rollStat. Note the
// rulebook edge case: an exceptional follower with no other applicable tag is
// still +0 — only helps > 0 earns the +1/+2.
export function orderFollowersBonus({ helps = 0, hinders = 0, exceptional = false, advantage = false } = {}) {
	const h = Math.max(0, Math.trunc(Number(helps)   || 0));
	const x = Math.max(0, Math.trunc(Number(hinders) || 0));
	const bonus = h <= 0 ? 0 : (exceptional ? 2 : 1);
	// A hindering tag means disadvantage; it overrides the optional advantage
	// toggle (the book says such a follower "rolls with disadvantage").
	const rollMode = x > 0 ? "dis" : (advantage ? "adv" : "normal");
	return { bonus, rollMode };
}

// ── Readiness cap (Defend, p.216 / followers p.469) ──────────────────────────
// A follower (or crew) holds up to 3 Readiness on a 10+ Defend, 1 on a 7–9; a
// borne shield adds +1 to either, raising the cap to 4. Centralized so the pip
// builders and the on-sheet tooltips read the same numbers.
export const READINESS_BASE_CAP = 3;
export const READINESS_SHIELD_BONUS = 1;
export function readinessCap(hasShield = false) {
	return READINESS_BASE_CAP + (hasShield ? READINESS_SHIELD_BONUS : 0);
}

// A monster's flavor tags are its tag string minus the organization and size,
// which the follower card surfaces differently (mirrors the monster sheet's
// display-tag split, NPCs & Followers vs. Dangers).
export function monsterFollowerTags(system = {}) {
	const org  = String(system.organization ?? "").trim().toLowerCase();
	const size = String(system.size ?? "").trim().toLowerCase();
	return normalizeTags(system.tags).filter(t => {
		const k = t.toLowerCase();
		return k !== org && k !== size;
	});
}

/**
 * Convert a monster's stats into custom-follower data (NPCs & Followers p.475:
 * "use its stats as-is", plus added tags, a chosen cost, and a Loyalty track).
 * `monster` carries { name, system, moves } (moves = array of move names); opts
 * supplies the player's added tags, cost, and pronoun.
 */
export function followerFromMonster(monster = {}, opts = {}) {
	const system = monster.system ?? {};
	const attrs  = system.attributes ?? {};
	const tags   = [...monsterFollowerTags(system), ...normalizeTags(opts.tags)];
	const hpMax  = Number(attrs.hp?.max ?? attrs.hp?.value) || 0;
	const damage = String(attrs.damage?.value ?? attrs.damage?.rollFormula ?? "").trim();
	return buildCustomFollower({
		name:         monster.name ?? "",
		pronoun:      opts.pronoun ?? "",
		typeLabel:    "follower",
		// Match the conversion dialog's banner: a follower keeps its monster's
		// creature-type glyph (an Adept is human → fa-user, not the generic paw).
		portraitIcon: `fas ${creatureTypeFaIcon(system.creatureType)}`,
		tags,
		hp:           hpMax,
		// Carry current HP as-is (buildCustomFollower clamps/normalizes); `?? hpMax`
		// only fills in when the monster has no current value. A `||` here would wrongly
		// promote a monster sitting at 0 HP to full.
		hpCurrent:    attrs.hp?.value ?? hpMax,
		armor:        parseFollowerArmor(attrs.armor?.value),
		damage,
		instinct:     String(attrs.instinct?.value ?? "").trim(),
		moves:        (Array.isArray(monster.moves) ? monster.moves : []).join("\n"),
		cost:         opts.cost ?? "",
		sourceUuid:   monster.uuid ?? null,
	});
}
