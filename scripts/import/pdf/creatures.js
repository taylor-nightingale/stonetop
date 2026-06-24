import { isAvara } from "./fonts.js";
import { deterministicId, documentKey } from "../ids.js";
import { toSlug } from "../../../src/utils/slug.js";

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
const isMoveBullet = (l) => /^ä\s/.test(l.text.trim());
const isFieldText  = (t) => /^(HP\b|Armor\b|Damage\b|Instinct\b|Special qualit)/i.test(t);

// Field label → schema key. "Special qualities" (plural in the book) → specialQuality.
const FIELDS = [[/^HP\b/i, "hp"], [/^Armor\b/i, "armor"], [/^Damage\b/i, "damage"], [/^Instinct\b/i, "instinct"], [/^Special qualit\w*/i, "specialQuality"]];

const splitTags = (t) => t.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
// A capitalised, multi-word line inside the moves is a transition sentence (e.g. the Crombil's "When
// someone's been swallowed…"), not a wrap of the previous move.
const looksTransition = (t) => /^[A-Z]/.test(t) && t.split(/\s+/).length > 4;

/** Parse a stat block's lines into structured creature data. */
export function parseStatBlock(lines) {
	const out = { name: "", tagList: [], hp: { value: 0, max: 0 }, armor: "", damage: "", specialQuality: "", instinct: "", moves: [], description: [] };
	const text = (l) => l.text.trim();

	// The name is the first name-font line; anything before it is an in-character intro → description.
	let nameIdx = lines.findIndex(isNameFont);
	if (nameIdx < 0) nameIdx = lines.findIndex((l) => text(l));
	if (nameIdx < 0) return { ...out, description: "" };
	out.name = text(lines[nameIdx]);
	for (let j = 0; j < nameIdx; j++) if (text(lines[j])) out.description.push(text(lines[j]));

	// Tags follow the name and may wrap across lines (the book's "Solitary, large, fae, …,/ corrupted")
	// until the first field or move.
	let k = nameIdx + 1;
	for (; k < lines.length; k++) {
		const t = text(lines[k]);
		if (!t) continue;
		if (isFieldText(t) || isMoveBullet(lines[k])) break;
		out.tagList.push(...splitTags(t));
	}

	const setField = (key, val) => {
		if (key === "hp") { const n = parseInt(val, 10); out.hp = { value: Number.isNaN(n) ? 0 : n, max: Number.isNaN(n) ? 0 : n }; }
		else out[key] = val;
	};
	const extendField = (key, val) => { if (key !== "hp") out[key] = out[key] ? `${out[key]} ${val}` : val; };

	let field = null;          // the field key currently being filled (so wrap lines extend it)
	let mode = "fields";       // fields → moves
	let movePer = "move";      // within moves: "move" (extend last) | "prose" (transition sentence)
	for (; k < lines.length; k++) {
		const t = text(lines[k]);
		if (!t) continue;

		if (isMoveBullet(lines[k])) { mode = "moves"; movePer = "move"; field = null; out.moves.push({ text: t.replace(/^ä\s*/, ""), prose: false }); continue; }

		if (isFieldText(t)) {
			mode = "fields"; field = null;
			// One printed line can carry several fields ("HP 26; Armor 3 (…)").
			for (const seg of t.split(/\s*;\s*/)) {
				const m = FIELDS.find(([re]) => re.test(seg));
				if (m) { setField(m[1], seg.replace(m[0], "").trim()); field = m[1]; }
				else if (field) extendField(field, seg);
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
		} else {
			out.description.push(t);
		}
	}
	out.description = out.description.join(" ").trim();
	return out;
}

// A pick-list (Selection) field's stored raw shape — see src/data/creature.js selectionField().
const selection = (selected, multi) => ({ selected, options: [], multi, allowCustom: true });

/**
 * Build a schema-correct `npc` Actor document (src/data/NpcData) from parsed creature data. GM-only
 * (`ownership.default: 0`), deterministic id, and a clickable back-link to its Book II journal entry
 * appended to the enriched `description`. `article` = { slug, title, page } of the source entry.
 */
export function toNpcDoc(creature, { article } = {}) {
	const slug = toSlug(creature.name);
	const id = deterministicId(MONSTER_PACK, slug);
	const backlink = article ? `Source: @UUID[${journalUuid(article.slug)}]{${article.title}}${article.page ? ` (Book p.${article.page})` : ""}` : "";
	const description = [creature.description, backlink].filter(Boolean).join("\n\n");
	return {
		_id: id,
		_key: documentKey("Actor", id),
		name: creature.name,
		type: "npc",
		img: "icons/svg/mystery-man.svg",
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
