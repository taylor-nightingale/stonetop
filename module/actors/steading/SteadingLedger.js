import { isBlank, formatValue, valuesEqual, actionForField, coalesceEntries, prettifySlug } from "../character/CharacterLedger.js";
import { IMPROVEMENT_DEFINITIONS } from "./StonetopSteading.js";

const LEDGER_SCOPE = "stonetop";
const LEDGER_KEY = "ledger";
const LEDGER_MAX_ENTRIES = 300;

const IMPROVEMENTS_PATH = `flags.${LEDGER_SCOPE}.steading.improvements`;
const CUSTOM_IMPROVEMENTS_PATH = `flags.${LEDGER_SCOPE}.steading.customImprovements`;

const SYSTEM_PATH_LABELS = {
	"system.stats.fortunes.value":   "Fortunes",
	"system.stats.defenses.value":   "Defenses",
	"system.attributes.population.value": "Population",
	"system.attributes.prosperity.value": "Prosperity",
	"system.attributes.surplus.value":    "Surplus",
	"system.attributes.debilities.options.diminished.value":  "Diminished debility",
	"system.attributes.debilities.options.lacking.value":     "Lacking debility",
	"system.attributes.debilities.options.malcontent.value":  "Malcontent debility",
};

const FLAG_PATH_LABELS = {
	"flags.stonetop.steading.size":  "Size",
	"flags.stonetop.steading.notes": "Notes",
};

const FLAG_NAMESPACE_LABELS = {
	"flags.stonetop.steading.resources":      "Resources",
	"flags.stonetop.steading.fortifications": "Fortifications",
	"flags.stonetop.steading.assets":         "Assets",
	"flags.stonetop.steading.neighbors":      "Neighbors",
	"flags.stonetop.steading.players":        "Players",
	"flags.stonetop.steading.improvements":   "Improvements",
	"flags.stonetop.steading.places":         "Places of interest",
};

const SORTED_NAMESPACE_PREFIXES = Object.keys(FLAG_NAMESPACE_LABELS).sort((a, b) => b.length - a.length);

function normalizeFlagPath(path) {
	return String(path ?? "").replace(/^flags\.stonetop\./, `flags.${LEDGER_SCOPE}.`);
}

function getActorProperty(actor, path) {
	const value = foundry.utils.getProperty(actor, path);
	if (value !== undefined) return value;
	if (String(path).startsWith(`flags.${LEDGER_SCOPE}.`)) {
		return foundry.utils.getProperty(actor, path.replace(`flags.${LEDGER_SCOPE}.`, "flags.stonetop."));
	}
	return undefined;
}

function isSteadingActor(actor) {
	return actor?.type === "stonetop" || actor?.system?.customType === "stonetop";
}

function labelForPath(path) {
	if (SYSTEM_PATH_LABELS[path]) return SYSTEM_PATH_LABELS[path];
	if (FLAG_PATH_LABELS[path]) return FLAG_PATH_LABELS[path];
	const namespace = SORTED_NAMESPACE_PREFIXES.find(p => path === p || path.startsWith(`${p}.`));
	if (namespace) return FLAG_NAMESPACE_LABELS[namespace];
	return null;
}

function itemName(item) {
	return String(item?.name ?? "").trim();
}

function neighborLabel(item) {
	const name = itemName(item);
	const home = String(item?.home ?? "").trim();
	return home ? `${name} (from ${home})` : name;
}

function listEntries(label, oldValue, newValue) {
	if (!Array.isArray(oldValue) || !Array.isArray(newValue)) return null;
	const entries = [];
	const max = Math.max(oldValue.length, newValue.length);

	for (let i = 0; i < max; i++) {
		const oldItem = oldValue[i] ?? {};
		const newItem = newValue[i] ?? {};
		const oldName = itemName(oldItem);
		const newName = itemName(newItem);

		if (oldName !== newName) {
			if (!oldName && newName) entries.push({ action: `${label} added: ${newName}` });
			else if (oldName && !newName) entries.push({ action: `${label} removed: ${oldName}` });
			else entries.push({ action: `${label} renamed from ${oldName} to ${newName}` });
		}

		if (oldName || newName) {
			const name = newName || oldName;
			const oldChecked = !!oldItem.checked;
			const newChecked = !!newItem.checked;
			if (oldChecked !== newChecked) {
				entries.push({ action: `${name} ${newChecked ? "selected" : "deselected"}` });
			}
		}
	}

	return entries;
}

function placeEntries(oldValue, newValue) {
	if (!Array.isArray(oldValue) || !Array.isArray(newValue)) return null;
	const entries = [];
	const max = Math.max(oldValue.length, newValue.length);

	for (let i = 0; i < max; i++) {
		const oldPlace = oldValue[i] ?? {};
		const newPlace = newValue[i] ?? {};
		const letter = newPlace.letter ?? oldPlace.letter ?? "?";
		const oldName = itemName(oldPlace);
		const newName = itemName(newPlace);
		if (oldName === newName) continue;
		if (!oldName && newName) entries.push({ action: `Place ${letter} set to ${newName}` });
		else if (oldName && !newName) entries.push({ action: `Place ${letter} cleared (${oldName})` });
		else entries.push({ action: `Place ${letter} changed from ${oldName} to ${newName}` });
	}

	return entries;
}

function neighborEntries(oldValue, newValue) {
	if (!Array.isArray(oldValue) || !Array.isArray(newValue)) return null;
	const entries = [];
	const max = Math.max(oldValue.length, newValue.length);

	for (let i = 0; i < max; i++) {
		const oldItem = oldValue[i] ?? {};
		const newItem = newValue[i] ?? {};
		const oldName = itemName(oldItem);
		const newName = itemName(newItem);
		const oldLabel = neighborLabel(oldItem);
		const newLabel = neighborLabel(newItem);

		if (oldName !== newName) {
			if (!oldName && newName) entries.push({ action: `Neighbor added: ${newLabel}` });
			else if (oldName && !newName) entries.push({ action: `Neighbor removed: ${oldLabel}` });
			else entries.push({ action: `Neighbor renamed from ${oldLabel} to ${newLabel}` });
		} else if (oldName && oldLabel !== newLabel) {
			entries.push({ action: `Neighbor changed from ${oldLabel} to ${newLabel}` });
		}

		if (oldName || newName) {
			const name = newLabel || oldLabel;
			const oldTrait = String(oldItem?.traits ?? "").trim();
			const newTrait = String(newItem?.traits ?? "").trim();
			if (oldTrait !== newTrait) {
				if (!oldTrait && newTrait) entries.push({ action: `${name} trait set to ${newTrait}` });
				else if (oldTrait && !newTrait) entries.push({ action: `${name} trait cleared (${oldTrait})` });
				else entries.push({ action: `${name} trait changed from ${oldTrait} to ${newTrait}` });
			}

			const oldChecked = !!oldItem.checked;
			const newChecked = !!newItem.checked;
			if (oldChecked !== newChecked) {
				entries.push({ action: `${name} ${newChecked ? "selected" : "deselected"}` });
			}
		}
	}

	return entries;
}

function stripHtml(value) {
	return String(value ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Build a `slug → { label, steps }` lookup spanning the book improvements and any
 * journal-sourced custom ones tracked on this actor, so ledger entries can name an
 * improvement (and its requirement steps) instead of its raw slug. `steps` is the
 * requirement labels flattened across sections, matching the running index used by
 * the tracking array `r` (see StonetopSteading.buildSnapshot).
 */
function improvementDefs(actor) {
	const defs = new Map();
	const add = def => {
		if (!def?.slug) return;
		defs.set(def.slug, {
			label: def.label || prettifySlug(def.slug),
			steps: (def.sections ?? []).flatMap(s => s.items ?? []).map(stripHtml),
		});
	};
	IMPROVEMENT_DEFINITIONS.forEach(add);
	const custom = getActorProperty(actor, CUSTOM_IMPROVEMENTS_PATH);
	if (Array.isArray(custom)) custom.forEach(add);
	return defs;
}

/**
 * Reconstruct the post-update improvements map from the flattened changes. The
 * store is an object keyed by slug, so a single toggle arrives as leaf sub-paths
 * (`…improvements.<slug>.completed` / `.r`) rather than one whole-object key.
 */
function readChangedImprovements(flat) {
	const result = {};
	for (const [rawPath, value] of Object.entries(flat)) {
		const path = normalizeFlagPath(rawPath);
		if (path === IMPROVEMENTS_PATH) return value && typeof value === "object" ? value : {};
		if (!path.startsWith(`${IMPROVEMENTS_PATH}.`)) continue;
		const [slug, field] = path.slice(IMPROVEMENTS_PATH.length + 1).split(".");
		(result[slug] ??= {})[field] = value;
	}
	return result;
}

function improvementEntries(actor, oldImps, newImps) {
	const defs = improvementDefs(actor);
	const entries = [];
	for (const slug of new Set([...Object.keys(oldImps ?? {}), ...Object.keys(newImps ?? {})])) {
		const def = defs.get(slug);
		const label = def?.label ?? prettifySlug(slug);
		const before = oldImps?.[slug] ?? {};
		const after = newImps?.[slug] ?? {};

		const wasComplete = !!before.completed;
		const isComplete = !!after.completed;
		if (wasComplete !== isComplete) {
			entries.push({ action: isComplete ? `Improvement completed: ${label}` : `Improvement marked incomplete: ${label}` });
		}

		const beforeR = Array.isArray(before.r) ? before.r : [];
		const afterR = Array.isArray(after.r) ? after.r : [];
		const max = Math.max(beforeR.length, afterR.length);
		for (let i = 0; i < max; i++) {
			if (!!beforeR[i] === !!afterR[i]) continue;
			const step = def?.steps?.[i] || `requirement ${i + 1}`;
			entries.push({ action: `Improvement step ${afterR[i] ? "marked" : "unmarked"}: ${label} — ${step}` });
		}
	}
	return entries;
}

const _currencyEntry = (label, o, n) =>
	valuesEqual(o, n) ? [] : [{ action: actionForField(label, o, n) }];

const PATH_HANDLERS = {
	"flags.stonetop.steading.resources":            (o, n) => listEntries("Resource",      o, n),
	"flags.stonetop.steading.fortifications":       (o, n) => listEntries("Fortification", o, n),
	"flags.stonetop.steading.assets":               (o, n) => listEntries("Asset",         o, n),
	"flags.stonetop.steading.neighbors":            neighborEntries,
	"flags.stonetop.steading.players":              (o, n) => listEntries("Player",        o, n),
	"flags.stonetop.steading.places":               placeEntries,
	"flags.stonetop.steading.silver.purses":        (o, n) => _currencyEntry("Silver purses",    o, n),
	"flags.stonetop.steading.silver.handfuls":      (o, n) => _currencyEntry("Silver handfuls",  o, n),
	"flags.stonetop.steading.silver.coins":         (o, n) => _currencyEntry("Silver coins",     o, n),
	"flags.stonetop.steading.gold.purses":          (o, n) => _currencyEntry("Gold purses",      o, n),
	"flags.stonetop.steading.gold.handfuls":        (o, n) => _currencyEntry("Gold handfuls",    o, n),
	"flags.stonetop.steading.gold.coins":           (o, n) => _currencyEntry("Gold coins",       o, n),
};

function actorUpdateEntries(actor, changed) {
	const flat = foundry.utils.flattenObject(changed);
	const entries = [];
	let improvementsHandled = false;
	for (const [path, newValue] of Object.entries(flat)) {
		const normalizedPath = normalizeFlagPath(path);
		if (!normalizedPath || normalizedPath === `flags.${LEDGER_SCOPE}.${LEDGER_KEY}` || normalizedPath.startsWith(`flags.${LEDGER_SCOPE}.${LEDGER_KEY}.`)) continue;

		// Improvements are an object keyed by slug, so a toggle arrives as leaf
		// sub-paths; diff the whole map once rather than per sub-path.
		if (normalizedPath === IMPROVEMENTS_PATH || normalizedPath.startsWith(`${IMPROVEMENTS_PATH}.`)) {
			if (!improvementsHandled) {
				improvementsHandled = true;
				const oldImps = getActorProperty(actor, IMPROVEMENTS_PATH) ?? {};
				entries.push(...improvementEntries(actor, oldImps, readChangedImprovements(flat)));
			}
			continue;
		}

		const handler = PATH_HANDLERS[normalizedPath];
		if (handler) {
			const oldValue = getActorProperty(actor, normalizedPath);
			entries.push(...(handler(oldValue, newValue) ?? []));
			continue;
		}

		// Skip sub-paths of namespace prefixes — handlers above cover the
		// top-level path; sub-paths (e.g. resources.0.name) would produce noise.
		const isSubPath = SORTED_NAMESPACE_PREFIXES.some(p => normalizedPath !== p && normalizedPath.startsWith(`${p}.`));
		if (isSubPath) continue;

		const oldValue = getActorProperty(actor, normalizedPath);
		if (valuesEqual(oldValue, newValue)) continue;
		const label = labelForPath(normalizedPath);
		if (!label) continue;
		entries.push({ action: actionForField(label, oldValue, newValue) });
	}
	return coalesceEntries(entries);
}

export class SteadingLedger {
	static getEntries(actor) {
		return actor.getFlag?.(LEDGER_SCOPE, LEDGER_KEY) ?? [];
	}

	static async append(actor, entries, { userId = globalThis.game?.user?.id } = {}) {
		if (!isSteadingActor(actor) || !entries?.length) return;
		const current = this.getEntries(actor);
		const user = userId ? globalThis.game?.users?.get?.(userId) : null;
		const stamped = entries.map(entry => ({
			id: globalThis.foundry?.utils?.randomID?.() ?? `${Date.now()}-${Math.random()}`,
			timestamp: Date.now(),
			userId: userId ?? null,
			userName: user?.name ?? globalThis.game?.user?.name ?? "Unknown",
			action: entry.action,
			// Name of the move that caused this change (e.g. "Seasons Change"), or null
			// for a plain sheet edit.
			move: entry.move ?? null,
		}));
		await actor.update({
			[`flags.${LEDGER_SCOPE}.${LEDGER_KEY}`]: stamped.concat(current.slice(0, LEDGER_MAX_ENTRIES - stamped.length)),
		}, { stonetopLedger: true, render: false });
	}

	static async deleteEntries(actor, ids) {
		if (!isSteadingActor(actor) || !ids?.size) return;
		const current = this.getEntries(actor);
		await actor.update({
			[`flags.${LEDGER_SCOPE}.${LEDGER_KEY}`]: current.filter(e => !ids.has(e.id)),
		}, { stonetopLedger: true });
	}

	static entriesForActorUpdate(actor, changed) {
		return actorUpdateEntries(actor, changed);
	}
}
