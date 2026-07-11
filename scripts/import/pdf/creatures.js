import { isAvara, isItalic } from "./fonts.js";
import { deterministicId, documentKey } from "../ids.js";
import { toSlug } from "../../../src/utils/slug.js";
import { stripLoyalty } from "./arcana-parse.js";

// The GM-locked journal pack the monsters link back to (built later, with deterministic ids).
export const JOURNAL_PACK = "wider-world-and-other-wonders";
export const MONSTER_PACK = "wider-world-npcs";
const SYSTEM = "stonetop";

/** UUID of an article's JournalEntry in the (forthcoming) journal pack — deterministic, so the
 *  back-link resolves once that pack is built. */
export function journalUuid(articleSlug) {
	return `Compendium.${SYSTEM}.${JOURNAL_PACK}.JournalEntry.${deterministicId(JOURNAL_PACK, articleSlug)}`;
}

// Parse a monster stat block (the `statblock` block from layout.js) into our shared creature schema
// (src/data/creature.js): name, tagList, hp, armor, damage, specialQuality, instinct, moves, and any
// leftover prose as description. Pure data — the Foundry Actor doc is built by `toNpcDoc`.

// A stat-block name is set in the small Avara display face, or — for the book's "in-character"
// write-ups (e.g. Thornthumb) — the handwritten FeltTip-Heavy face.
const isNameFont = (l) => (isAvara(l.font) && l.size < 11) || /FeltTip\w*-Heavy/i.test(l.font);
// The arcana load pipeline injects □/◻/○/◯/◇ vector markers (pick boxes, loyalty/track pips, item
// load) into follower stat-block lines; they carry no creature-stat meaning here, so strip them
// (monster stat blocks have none, so this is a no-op for them).
const stripMk = (s) => s.replace(/[□◻○◯◇]/g, " ");
const isMoveBullet = (l) => /^ä\s/.test(stripMk(l.text).trim());
// A field label must be followed by whitespace or end-of-string — not punctuation — so a wrapped value
// line that happens to start with a label word (e.g. damage wrapping to "armor, disadvantage)") is not
// mistaken for a new field.
const isFieldText  = (t) => /^(HP|Armor|Damage|Instinct|Special qualit\w*|Cost)(?=\s|$)/i.test(t);

// Field label → schema key. "Special qualities" (plural in the book) → specialQuality. `Cost` is
// follower-only (monsters never have it); its trailing "(Loyalty ◯◯◯)" is stripped by toFollowerDoc.
const FIELDS = [[/^HP(?=\s|$)/i, "hp"], [/^Armor(?=\s|$)/i, "armor"], [/^Damage(?=\s|$)/i, "damage"], [/^Instinct(?=\s|$)/i, "instinct"], [/^Special qualit\w*/i, "specialQuality"], [/^Cost(?=\s|$)/i, "cost"]];

// Build markdown from a line's spans, wrapping italic runs in _…_ (the book sets weapon/damage tags —
// hand, close, reach — in italics; the npc sheet renders markdown). Adjacent same-emphasis runs merge.
const spansItalicMd = (spans) => {
	const toks = [];
	for (const s of spans || []) {
		const t = stripMk(s.text);
		if (!t) continue;
		const it = isItalic(s.font);
		const last = toks[toks.length - 1];
		if (last && last.it === it) last.text += t; else toks.push({ it, text: t });
	}
	let out = "";
	for (const t of toks) {
		if (!t.it) { out += t.text; continue; }
		const m = t.text.match(/^(\s*)(.*?)(\s*)$/s);
		out += m[2] ? `${m[1]}_${m[2]}_${m[3]}` : t.text;
	}
	return out;
};

const splitTags = (t) => t.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
// The □/◻/○/◯/◇ pick-box + pip markers the load pipeline injects into follower lines.
const MARKERS = /[□◻○◯◇]/g;                 // for .replace() (global)
const hasMarker = (s) => /[□◻○◯◇]/.test(s); // for tests — a fresh, non-global regex (no lastIndex state)
// Split a stat block's tag lines into base tags (the comma list — always on) and pickable options (the
// □-box-marked words the book lists as "pick some", separated by 2+ spaces, e.g. tulpa's "eager fierce
// kind sly timid willful"). With no □ boxes every tag is a base tag (monsters + most followers), so the
// behaviour is unchanged. Returns { tags, options }; options is base + picks (mirrors the Marshal crew).
export function splitTagChoices(rawLines) {
	if (!rawLines.some(hasMarker)) {
		// No pick boxes: comma-delimited base tags wrapping across lines. A comma-less multi-word
		// continuation is a personality line the book only ever offers with boxes — skip it (keeps a
		// one-word wrap like "corrupted"). Matches the pre-choices behaviour.
		const tags = [];
		let first = true;
		for (const raw of rawLines) {
			const t = raw.replace(MARKERS, " ").replace(/\s{2,}/g, " ").trim();
			if (!t) continue;
			if (!first && !t.includes(",") && t.split(/\s+/).length > 2) continue;
			tags.push(...splitTags(t));
			first = false;
		}
		return { tags, options: [] };
	}
	// Boxed pick-list: comma segments are base tags (selected); the □-marked, 2+-space-separated words
	// are the pickable options. options = base + picks (so the sheet's menu holds the full vocabulary).
	const tags = [], picks = [];
	for (const seg of rawLines.join("  ").replace(MARKERS, " ").split(/\s{2,}/).map((s) => s.trim()).filter(Boolean))
		(seg.includes(",") ? tags : picks).push(...splitTags(seg));
	return { tags, options: [...tags, ...picks] };
}
// A capitalised, multi-word line inside the moves is a transition sentence (e.g. the Crombil's "When
// someone's been swallowed…"), not a wrap of the previous move.
const looksTransition = (t) => /^[A-Z]/.test(t) && t.split(/\s+/).length > 4;

/** Parse a stat block's lines into structured creature data. */
export function parseStatBlock(lines) {
	const out = { name: "", tagList: [], tagOptions: [], hp: { value: 0, max: 0 }, armor: "", damage: "", specialQuality: "", instinct: "", instinctOptions: [], cost: "", costOptions: [], moves: [], description: [] };
	const text = (l) => stripMk(l.text).replace(/\s{2,}/g, " ").trim();

	// The name is the first name-font line; anything before it is an in-character intro → description.
	let nameIdx = lines.findIndex(isNameFont);
	if (nameIdx < 0) nameIdx = lines.findIndex((l) => text(l));
	if (nameIdx < 0) return { ...out, description: "" };
	out.name = text(lines[nameIdx]);
	for (let j = 0; j < nameIdx; j++) if (text(lines[j])) out.description.push(text(lines[j]));

	// Tags follow the name and may wrap across lines (the book's "Solitary, large, fae, …,/ corrupted")
	// until the first field or move. Real tag lines/wraps are comma-delimited or a single word; a
	// comma-less, multi-word continuation is a personality/options line (e.g. tulpa's "fierce kind sly
	// timid willful"), not tags — skip it.
	let k = nameIdx + 1;
	const tagRaw = []; // raw (marker-preserving) tag lines, so □ pick-boxes survive for splitTagChoices
	for (; k < lines.length; k++) {
		if (!text(lines[k])) continue;
		if (isFieldText(text(lines[k])) || isMoveBullet(lines[k])) break;
		tagRaw.push(lines[k].text);
	}
	{ const { tags, options } = splitTagChoices(tagRaw); out.tagList = tags; out.tagOptions = options; }

	const setField = (key, val) => {
		// A bare "HP" (e.g. the "HP / Starts at N" sidebar) carries no number — don't clobber the real HP.
		if (key === "hp") { const n = parseInt(val, 10); if (!Number.isNaN(n)) out.hp = { value: n, max: n }; }
		else out[key] = val;
	};
	const extendField = (key, val, sep = " ") => { if (key !== "hp") out[key] = out[key] ? `${out[key]}${sep}${val}` : val; };

	let field = null;          // the field key currently being filled (so wrap lines extend it)
	const pickRaw = { instinct: "", cost: "" }; // raw (marker-preserving) instinct/cost text → pick options
	let mode = "fields";       // fields → moves
	let movePer = "move";      // within moves: "move" (extend last) | "prose" (transition sentence)
	let damageStart = -1;      // line index of the "Damage …" line + its wraps (for italic markdown)
	const damageWrap = [];
	for (; k < lines.length; k++) {
		const t = text(lines[k]);
		if (!t) continue;
		// A bare page-number line or a "front"/"back" side-label is card furniture (not stat content);
		// skip it so it can't bleed into the last field (e.g. cost "… (Loyalty) 34 back").
		if (/^\d+$/.test(t) || /^(front|back)$/i.test(t)) continue;

		// A □ box before the ä bullet marks a *pickable* move (the follower picks some, e.g. tulpa); a
		// box-less bullet is a fixed move it always has. build-arcana routes pickable moves to a choice group.
		if (isMoveBullet(lines[k])) { mode = "moves"; movePer = "move"; field = null; out.moves.push({ text: t.replace(/^ä\s*/, ""), prose: false, selectable: /□/.test(lines[k].text) }); continue; }

		if (isFieldText(t)) {
			mode = "fields"; field = null;
			// One printed line can carry several fields ("HP 26; Armor 3 (…)"). A ";" segment that is not
			// itself a new field belongs to the current field's value (keep the "; ", e.g. "Special
			// qualities fireproof; holds …").
			for (const seg of t.split(/\s*;\s*/)) {
				const m = FIELDS.find(([re]) => re.test(seg));
				if (m) { setField(m[1], seg.replace(m[0], "").trim()); field = m[1]; if (m[1] === "damage") damageStart = k; if (m[1] in pickRaw) pickRaw[m[1]] = lines[k].text; }
				else if (field) extendField(field, seg, "; ");
			}
			continue;
		}

		// A non-field, non-bullet line: extend the current field, continue/transition a move, or prose.
		if (mode === "moves") {
			const last = out.moves[out.moves.length - 1];
			if (movePer === "move" && !looksTransition(t) && last && !last.prose) last.text += ` ${t}`;     // wrap of the current move
			else if (movePer === "prose" && last?.prose) last.text += ` ${t}`;                              // wrap of the transition
			else { out.moves.push({ text: t, prose: true }); movePer = "prose"; }                           // a transition sentence between move groups
		} else if (field) {
			extendField(field, t);
			if (field === "damage") damageWrap.push(k);
			if (field in pickRaw) pickRaw[field] += "  " + lines[k].text;
		} else {
			out.description.push(t);
		}
	}
	// Instinct / Cost pick-lists: an arcana follower may offer several □-boxed choices (2+-space
	// separated, e.g. tulpa's "to play / to learn / to flaunt"). When the raw carries □ boxes, split
	// them into options (the sheet lets the player pick one); a single value has no boxes → no options.
	for (const key of ["instinct", "cost"]) {
		const raw = pickRaw[key];
		if (!raw || !hasMarker(raw)) continue;
		// Keep the 2+-space option separators (stripLoyalty would collapse them): drop pick boxes/pips,
		// the "(Loyalty …)" annotation, and the field label directly, then split the options apart.
		const v = raw.replace(MARKERS, " ").replace(/\(\s*loyalty[^)]*\)/ig, " ").replace(/^\s*(instinct|cost)\b/i, "");
		const opts = v.split(/\s{2,}/).map((s) => s.replace(/[“”]/g, '"').trim()).filter(Boolean);
		if (opts.length > 1) out[`${key}Options`] = opts;
	}
	// Rebuild the damage value from spans so the book's italic weapon tags (hand, close, reach) survive
	// as markdown. Drop everything up to the "Damage" label, then append wrap lines.
	if (damageStart >= 0) {
		let md = spansItalicMd(lines[damageStart].spans).replace(/^.*?\bdamage\b[:\s]*/i, "");
		for (const wi of damageWrap) md += " " + spansItalicMd(lines[wi].spans);
		out.damage = md;
	}
	out.description = out.description.join(" ").trim();
	// Collapse column-gap whitespace artifacts and straighten curly double-quotes in every string field.
	for (const key of ["armor", "damage", "specialQuality", "instinct", "cost", "description"])
		out[key] = out[key].replace(/[“”]/g, '"').replace(/\s{2,}/g, " ").trim();
	for (const m of out.moves) m.text = m.text.replace(/[“”]/g, '"').replace(/\s{2,}/g, " ").trim();
	return out;
}

// Make a follower's damage dice rollable on the sheet: "d6", "1d8", "d12+7" → "[[/r d6]]" etc.
const rollableDice = (s) => (s || "").replace(/\b(\d*d\d+(?:\s*[+-]\s*\d+)?)\b/gi, (m) => `[[/r ${m.replace(/\s+/g, "")}]]`);

// A pick-list (Selection) field's stored raw shape — see src/data/creature.js selectionField().
const selection = (selected, multi, options = []) => ({ selected, options, multi, allowCustom: true });

/**
 * Build a schema-correct `npc` Actor document (src/data/NpcData) from parsed creature data. GM-only
 * (`ownership.default: 0`), deterministic id, and a clickable back-link to its Book II journal entry
 * appended to the enriched `description`. `article` = { slug, title, page } of the source entry.
 * `img` is the creature's marker icon (resolved by build-npcs via markers.js); defaults to the npc icon.
 */
export function toNpcDoc(creature, { article, img = "systems/stonetop/assets/content/icons/npc.png" } = {}) {
	const slug = toSlug(creature.name);
	const id = deterministicId(MONSTER_PACK, slug);
	const backlink = article ? `Source: @UUID[${journalUuid(article.slug)}]{${article.title}}${article.page ? ` (Book p.${article.page})` : ""}` : "";
	const description = [creature.description, backlink].filter(Boolean).join("\n\n");
	return {
		_id: id,
		_key: documentKey("Actor", id),
		name: creature.name,
		type: "npc",
		img,
		system: {
			slug,
			reference: article?.slug ?? null,
			tagList: selection(creature.tagList, true),
			hp: creature.hp,
			armor: creature.armor,
			damage: creature.damage,
			specialQuality: creature.specialQuality,
			instinct: selection(creature.instinct ? [creature.instinct] : [], false),
			// Bullets as markdown list items; an inter-group transition sentence stays inline as prose,
			// blank-line-separated so the bullet groups above/below render as distinct lists.
			moves: creature.moves.map((m) => (m.prose ? `\n${m.text}\n` : `- ${m.text}`)).join("\n").replace(/\n{3,}/g, "\n\n").trim(),
			description,
			notes: "",
		},
		ownership: { default: 0 },
		flags: {},
		folder: null,
	};
}

/** Build an arcanum-follower Item doc (src/data/creature.js schema) from a parsed stat block. Cost is
 *  the key follower field; its "(Loyalty ◯◯◯)" is dropped (loyalty is always max 3). `_id`/`_key`/
 *  `img`/`folder` come from the existing follower (preserved by build-arcana) when present. */
export function toFollowerDoc(creature, { arcanaSlug = null, slug, id, key, img = "icons/svg/item-bag.svg", folder = null } = {}) {
	// The canonical slug (filename + arcana back-ref) is passed in; it can differ from toSlug(name)
	// when the book name carries a leading "The" the slug drops (e.g. "The Andalau of the Flute").
	const followerSlug = slug ?? toSlug(creature.name);
	const cost = stripLoyalty(creature.cost || "");
	// A follower stores current HP 0 (the sheet fills it); only the book max matters. parseStatBlock
	// sets value === max (the printed number), so take the max explicitly.
	const hp = { value: 0, max: creature.hp?.max || creature.hp?.value || 0 };
	// Fixed moves stay in the markdown list; □-boxed *pickable* moves become entries in the follower
	// choice group (choices[0]) so the player checks the ones this follower has — they are NOT also added
	// to the moves list. A single checkbox each (track.max 1); state lives in choiceValues["choices"].
	const movesMd = (list) => list.map((m) => (m.prose ? `\n${m.text}\n` : `- ${m.text}`)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
	const fixedMoves = (creature.moves || []).filter((m) => !m.selectable);
	const moveChoices = (creature.moves || []).filter((m) => m.selectable && !m.prose)
		.map((m) => ({ type: "entry", slug: toSlug(m.text), content: { title: null, text: m.text }, track: { max: 1 } }));
	return {
		_id: id ?? deterministicId("followers", followerSlug),
		_key: key ?? documentKey("Item", id ?? deterministicId("followers", followerSlug)),
		name: creature.name,
		type: "follower",
		img,
		system: {
			slug: followerSlug,
			reference: null,
			arcanaSlug,
			tagList: selection(creature.tagList, true, creature.tagOptions ?? []),
			hp,
			armor: creature.armor,
			damage: rollableDice(creature.damage),
			specialQuality: creature.specialQuality ?? "",
			// A pick-list follower (□-boxed choices) stores its options with nothing pre-selected — the
			// player picks on the sheet; a single fixed value stays selected (options empty).
			instinct: creature.instinctOptions?.length
				? selection([], false, creature.instinctOptions)
				: selection(creature.instinct ? [creature.instinct] : [], false),
			cost: creature.costOptions?.length
				? selection([], false, creature.costOptions)
				: selection(cost ? [cost] : [], false),
			loyalty: { value: 0, max: 3 },
			choices: [{ slug: "choices", list: moveChoices }],
			moves: movesMd(fixedMoves),
			description: creature.description,
			notes: "",
		},
		flags: {},
		folder,
	};
}
