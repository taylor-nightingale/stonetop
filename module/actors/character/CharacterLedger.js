const LEDGER_SCOPE = "stonetop";
const LEDGER_KEY = "ledger";
const LEDGER_MAX_ENTRIES = 300;

const SYSTEM_PATH_LABELS = {
	"name": "Name",
	"system.playbook.name": "Playbook",
	"system.attributes.damage.value": "Damage value",
	"system.attributes.hp.value": "HP",
	"system.attributes.hp.max": "Max HP",
	"system.attributes.xp.value": "XP",
	"system.attributes.xp.max": "XP max",
	"system.attributes.level.value": "Level",
	"system.attributes.armor.value": "Armor",
	"system.attributes.forward.value": "Forward",
	"system.attributes.ongoing.value": "Ongoing",
	"system.stats.str.value": "STR",
	"system.stats.dex.value": "DEX",
	"system.stats.int.value": "INT",
	"system.stats.wis.value": "WIS",
	"system.stats.con.value": "CON",
	"system.stats.cha.value": "CHA",
	"system.attributes.debilities.options.weakened.value": "Weakened",
	"system.attributes.debilities.options.dazed.value": "Dazed",
	"system.attributes.debilities.options.miserable.value": "Miserable",
};

const FLAG_PATH_LABELS = {
	"flags.stonetop.background.selected": "Background",
	"flags.stonetop.instinct.selected": "Instinct",
	"flags.stonetop.origin.selected": "Origin",
	"flags.stonetop.inventory.regularPool": "Items undefined ◇",
	"flags.stonetop.inventory.smallPool": "Small Items undefined □",
	"flags.stonetop.postDeathInsert.slug": "Post-death insert",
	"flags.stonetop.rollMode": "Roll mode",
	"flags.stonetop.steadingId": "Linked steading",
};

const FLAG_NAMESPACE_LABELS = {
	"flags.stonetop.animalCompanion": "Animal companion",
	"flags.stonetop.appearance": "Appearance",
	"flags.stonetop.arcana": "Arcana",
	"flags.stonetop.background.choices": "Background choices",
	"flags.stonetop.crew": "Crew",
	"flags.stonetop.initiatesLoyalty": "Initiates loyalty",
	"flags.stonetop.initiateDetails": "Initiate details",
	"flags.stonetop.inventory.checked": "Inventory",
	"flags.stonetop.inventory.custom": "Custom inventory",
	"flags.stonetop.inventory.resources": "Inventory resource",
	"flags.stonetop.invocations": "Invocations",
	"flags.stonetop.lore": "Lore",
	"flags.stonetop.moves": "Move resource",
	"flags.stonetop.possessions": "Possessions",
	"flags.stonetop.postDeathInstinct": "Post-death instinct",
	"flags.stonetop.postDeathLore": "Post-death lore",
};

const SORTED_NAMESPACE_PREFIXES = Object.keys(FLAG_NAMESPACE_LABELS).sort((a, b) => b.length - a.length);
const INVENTORY_CHECKED_PREFIX = "flags.stonetop.inventory.checked.";
const INVENTORY_RESOURCE_PREFIX = "flags.stonetop.inventory.resources.";
// Move resource tracks (e.g. the Blessed's "Rites of the Land" Favor) are keyed
// by move name under the misnamed "backgroundChoices" sub-flag (see MoveResources).
const MOVE_RESOURCE_PREFIX = "flags.stonetop.moves.backgroundChoices.";
// Per-option advancement marks (e.g. Potential for Greatness): keyed
// "<moveName>.<optionSlug>", each an array of { stat, level } entries.
const MOVE_MARKS_PREFIX = "flags.stonetop.moves.moveMarks.";
const BACKGROUND_CHOICES_PREFIX = "flags.stonetop.background.choices.";
const INITIATES_LOYALTY_PREFIX = "flags.stonetop.initiatesLoyalty.";
const ANIMAL_COMPANION_PREFIX = "flags.stonetop.animalCompanion.";
const CREW_PREFIX = "flags.stonetop.crew.";
const POSSESSION_USES_PREFIX = "flags.stonetop.possessions.uses.";
const POSSESSION_SUBCHOICES_PREFIX = "flags.stonetop.possessions.subChoices.";
const POSSESSION_CHOICE_USES_PREFIX = "flags.stonetop.possessions.choiceUses.";
const POSSESSION_SELECTED_PATH = `flags.${LEDGER_SCOPE}.possessions.selected`;
const POSSESSION_CUSTOM_PATH = `flags.${LEDGER_SCOPE}.possessions.custom`;

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

export function isBlank(v) {
	return v === undefined || v === null || v === "";
}

export function formatValue(value) {
	if (isBlank(value)) return "blank";
	if (typeof value === "boolean") return value ? "on" : "off";
	if (Array.isArray(value)) return value.length ? value.join(", ") : "none";
	if (typeof value === "object") return "changed";
	return String(value);
}

export function valuesEqual(a, b) {
	if (a === b) return true;
	if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
	return false;
}

export function actionForField(label, oldValue, newValue) {
	if (isBlank(oldValue)) return `${label} set to ${formatValue(newValue)}`;
	if (isBlank(newValue)) return `${label} cleared`;
	return `${label} changed from ${formatValue(oldValue)} to ${formatValue(newValue)}`;
}

export function coalesceEntries(entries) {
	const seen = new Set();
	return entries.filter(entry => {
		if (seen.has(entry.action)) return false;
		seen.add(entry.action);
		return true;
	});
}

// Verb phrases that separate a change's subject (noun) from its detail. Ordered
// longest/most-specific first isn't required — we take the earliest match.
const LEDGER_VERB_MARKERS = [
	" changed from ",
	" renamed from ",
	" set to ",
	" cleared",
	" selected",
	" deselected",
	" marked",
	" unmarked",
	" completed",
	" learned",
	" removed",
	" added",
];

/**
 * Derive the "noun" (subject) of a ledger action string — the phrase before its
 * verb — so entries can be grouped and filtered. e.g. "HP changed from 5 to 3"
 * → "HP", "Longsword selected" → "Longsword", "Asset added: Wagon" → "Asset".
 * Falls back to the whole (trimmed) action when no known verb is present.
 */
export function ledgerNoun(action) {
	const text = String(action ?? "").trim();
	if (!text) return "";
	let cut = text.length;
	for (const marker of LEDGER_VERB_MARKERS) {
		const idx = text.indexOf(marker);
		if (idx >= 0 && idx < cut) cut = idx;
	}
	return text.slice(0, cut).trim() || text;
}

/**
 * Distinct nouns present across ledger entries, with counts, sorted alphabetically.
 * @returns {{noun: string, count: number}[]}
 */
export function ledgerNounCounts(entries) {
	const counts = new Map();
	for (const entry of entries ?? []) {
		const noun = ledgerNoun(entry?.action);
		if (noun) counts.set(noun, (counts.get(noun) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([noun, count]) => ({ noun, count }))
		.sort((a, b) => a.noun.localeCompare(b.noun));
}

function labelForPath(path) {
	if (SYSTEM_PATH_LABELS[path]) return SYSTEM_PATH_LABELS[path];
	if (FLAG_PATH_LABELS[path]) return FLAG_PATH_LABELS[path];
	const namespace = SORTED_NAMESPACE_PREFIXES.find(prefix => path === prefix || path.startsWith(`${prefix}.`));
	if (namespace) return FLAG_NAMESPACE_LABELS[namespace];
	return null;
}

export function prettifySlug(slug) {
	return String(slug ?? "")
		.split(/[-_:]/)
		.filter(Boolean)
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ") || "Unknown";
}

function stripHtml(value) {
	const text = String(value ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
	return text || null;
}

function firstLabelPart(value) {
	return (stripHtml(value) ?? "").split(",")[0]?.trim() || null;
}

function getPlaybookFlags(actor, snapshot) {
	const snapshotPlaybook = snapshot?.playbook;
	if (snapshotPlaybook?.backgrounds || snapshotPlaybook?.crew || snapshotPlaybook?.animalCompanion) return snapshotPlaybook;

	const playbookItem = [...(actor.items ?? [])].find(item => item?.type === "playbook");
	return playbookItem?.flags?.stonetop ?? playbookItem?.flags?.[LEDGER_SCOPE] ?? null;
}

function addPossessionChoiceNames(names, possession) {
	for (const choice of possession.choices?.options ?? []) {
		names.possessionChoices.set(`${possession.slug}:${choice.slug}`, stripHtml(choice.label) ?? prettifySlug(choice.slug));
	}
	for (const group of possession.choiceGroups ?? []) {
		for (const choice of group.options ?? []) {
			names.possessionChoices.set(`${possession.slug}:${choice.slug}`, stripHtml(choice.label) ?? prettifySlug(choice.slug));
		}
	}
}

async function buildNameLookup(actor) {
	const names = {
		inventory: new Map(),
		inventoryResourceTitles: new Map(),
		possessions: new Map(),
		possessionChoices: new Map(),
		backgroundChoices: new Map(),
		moveResourceTitles: new Map(),
		moveMarkOptions: new Map(),
		followers: new Map(),
		crewIndividuals: new Map(),
		followerFields: new Map([
			["cost", "cost"],
			["instinct", "instinct"],
			["kind", "kind"],
			["loyalty", "loyalty"],
			["name", "name"],
			["supplies", "supplies"],
			["tag", "tag"],
			["tags", "tags"],
			["traits", "traits"],
			["type", "type"],
		]),
	};

	const addBackgroundChoice = choice => {
		if (choice?.slug) names.backgroundChoices.set(choice.slug, stripHtml(choice.label) ?? prettifySlug(choice.slug));
	};

	const addFollower = (key, label) => {
		const name = firstLabelPart(label);
		if (name) names.followers.set(key, name);
	};

	for (const item of actor.items ?? []) {
		if (item?._id && item.name) names.inventory.set(item._id, item.name);
	}

	try {
		const snapshot = await actor.typedActor?.buildSnapshot?.();
		const playbookFlags = getPlaybookFlags(actor, snapshot);
		const outfit = snapshot?.inventory?.outfit;
		for (const item of [
			...(outfit?.regularItems ?? []),
			...(outfit?.smallItems ?? []),
			...(outfit?.smallGridItems ?? []),
			...(outfit?.arcanaItems ?? []),
		]) {
			if (!item?.slug) continue;
			names.inventory.set(item.slug, stripHtml(item.name) ?? prettifySlug(item.slug));
			// Titled resource tracks (e.g. an arcanum's "Souls") name the track in the
			// ledger; untitled tracks (e.g. "Bow & arrows" ammo) just say "resource".
			if (item.resource?.title) names.inventoryResourceTitles.set(item.slug, stripHtml(item.resource.title));
		}
		for (const item of snapshot?.inventory?.other ?? []) {
			if (item?.ownedId) names.inventory.set(item.ownedId, stripHtml(item.name) ?? prettifySlug(item.ownedId));
		}
		for (const possession of snapshot?.inventory?.possessions?.items ?? []) {
			if (!possession?.slug) continue;
			names.possessions.set(possession.slug, stripHtml(possession.label) ?? prettifySlug(possession.slug));
			addPossessionChoiceNames(names, possession);
		}
		for (const background of playbookFlags?.backgrounds ?? []) {
			for (const choice of background.choices?.options ?? []) {
				addBackgroundChoice(choice);
				if (background.slug === "initiate") addFollower(`initiate:${choice.slug}`, choice.label);
			}
		}
		for (const category of snapshot?.moves ?? []) {
			for (const move of category?.moves ?? []) {
				if (!move?.name) continue;
				if (move.resource?.title) names.moveResourceTitles.set(move.name, stripHtml(move.resource.title));
				for (const opt of move.markOptions ?? []) {
					if (opt?.slug) names.moveMarkOptions.set(`${move.name}:${opt.slug}`, { label: stripHtml(opt.label) ?? prettifySlug(opt.slug), choice: opt.choice ?? null });
				}
			}
		}
		for (const follower of snapshot?.followers?.initiates ?? []) {
			addFollower(`initiate:${follower.slug}`, follower.label);
		}
		const companionName = getActorProperty(actor, `flags.${LEDGER_SCOPE}.animalCompanion.name`);
		if (companionName) names.followers.set("animalCompanion", companionName);
		const companionKind = getActorProperty(actor, `flags.${LEDGER_SCOPE}.animalCompanion.kind`);
		if (!names.followers.has("animalCompanion") && companionKind) names.followers.set("animalCompanion", companionKind);
		const companionType = getActorProperty(actor, `flags.${LEDGER_SCOPE}.animalCompanion.type`);
		const companionTypeLabel = (playbookFlags?.animalCompanion?.types ?? []).find(type => type.slug === companionType)?.label;
		if (!names.followers.has("animalCompanion")) addFollower("animalCompanion", companionTypeLabel ?? "Animal companion");
		const crewName = getActorProperty(actor, `flags.${LEDGER_SCOPE}.crew.name`);
		addFollower("crew", crewName || "Crew");
		for (const [index, individual] of Object.entries(getActorProperty(actor, `flags.${LEDGER_SCOPE}.crew.individuals`) ?? [])) {
			if (individual?.name) names.crewIndividuals.set(String(index), individual.name);
		}
	} catch (err) {
		console.warn("Stonetop | Could not build ledger name lookup", err);
	}

	return names;
}

function nameFrom(map, slug) {
	return map.get(slug) ?? prettifySlug(slug);
}

function inventorySelectionEntry(path, oldValue, newValue, names) {
	const slug = path.slice(INVENTORY_CHECKED_PREFIX.length);
	const itemName = nameFrom(names.inventory, slug);
	if (!!oldValue === !!newValue) return null;
	return { action: `${itemName} ${newValue ? "selected" : "deselected"}` };
}

// "<Name> - <Title>" for a titled track (an arcanum's "Souls", the Blessed's
// "Favor"), else "<Name> resource". Shared by inventory- and move-resource tracks.
function resourceEntry(name, title, oldValue, newValue) {
	const label = title ? `${name} - ${title}` : `${name} resource`;
	return { action: actionForField(label, oldValue, newValue) };
}

function inventoryResourceEntry(path, oldValue, newValue, names) {
	const slug = path.slice(INVENTORY_RESOURCE_PREFIX.length);
	return resourceEntry(nameFrom(names.inventory, slug), names.inventoryResourceTitles.get(slug), oldValue, newValue);
}

function moveResourceEntry(path, oldValue, newValue, names) {
	const moveName = path.slice(MOVE_RESOURCE_PREFIX.length);
	return resourceEntry(moveName, names.moveResourceTitles.get(moveName), oldValue, newValue);
}

function moveMarkEntries(path, oldValue, newValue, names) {
	const key        = path.slice(MOVE_MARKS_PREFIX.length);
	const dot        = key.lastIndexOf(".");
	const moveName   = dot >= 0 ? key.slice(0, dot) : key;
	const optionSlug = dot >= 0 ? key.slice(dot + 1) : key;
	const option     = names.moveMarkOptions.get(`${moveName}:${optionSlug}`);
	const subject    = `${moveName} - ${option?.label ?? prettifySlug(optionSlug)}`;
	const oldEntries = Array.isArray(oldValue) ? oldValue : [];
	const newEntries = Array.isArray(newValue) ? newValue : [];

	// Stat-choice marks (Potential for Greatness): each slot picks a stat. Report
	// every slot whose chosen stat changed. The +1/-1 to the stat itself rides the
	// same update and is logged separately, so this just attributes it to the move.
	if (option?.choice === "stat") {
		const slots = Math.max(oldEntries.length, newEntries.length);
		const entries = [];
		for (let i = 0; i < slots; i++) {
			const oldStat = oldEntries[i]?.stat ?? "";
			const newStat = newEntries[i]?.stat ?? "";
			if (oldStat === newStat) continue;
			if (oldStat) entries.push({ action: `${subject}: ${oldStat.toUpperCase()} unmarked` });
			if (newStat) entries.push({ action: `${subject}: ${newStat.toUpperCase()} marked` });
		}
		return entries;
	}

	// Count-style marks (a checkbox track): report the net direction of the change.
	if (oldEntries.length === newEntries.length) return [];
	return [{ action: `${subject} ${newEntries.length > oldEntries.length ? "marked" : "unmarked"}` }];
}

function backgroundChoiceEntry(path, oldValue, newValue, names) {
	const slug = path.slice(BACKGROUND_CHOICES_PREFIX.length);
	const choiceName = nameFrom(names.backgroundChoices, slug);
	if (!!oldValue === !!newValue) return null;
	return { action: `${choiceName} ${newValue ? "selected" : "deselected"}` };
}

function followerFieldEntry(followerName, field, oldValue, newValue) {
	const label = field ? `${followerName} ${field}` : followerName;
	return { action: actionForField(label, oldValue, newValue) };
}

function initiateLoyaltyEntry(path, oldValue, newValue, names) {
	const slug = path.slice(INITIATES_LOYALTY_PREFIX.length);
	const followerName = names.followers.get(`initiate:${slug}`) ?? prettifySlug(slug);
	return followerFieldEntry(followerName, "loyalty", oldValue, newValue);
}

function animalCompanionEntry(path, oldValue, newValue, names) {
	const field = path.slice(ANIMAL_COMPANION_PREFIX.length).split(".")[0];
	const followerName = names.followers.get("animalCompanion") ?? "Animal companion";
	return followerFieldEntry(followerName, names.followerFields.get(field), oldValue, newValue);
}

function crewEntry(path, oldValue, newValue, names) {
	const key = path.slice(CREW_PREFIX.length);
	if (key.startsWith("individuals.")) {
		const [, index, field] = key.split(".");
		const followerName = names.crewIndividuals.get(index);
		return followerFieldEntry(followerName || `Crew member ${Number(index) + 1}`, names.followerFields.get(field), oldValue, newValue);
	}
	const field = key.split(".")[0];
	const followerName = names.followers.get("crew") ?? "Crew";
	return followerFieldEntry(followerName, names.followerFields.get(field), oldValue, newValue);
}

function possessionSelectionEntries(oldValue, newValue, names) {
	const oldSet = new Set(Array.isArray(oldValue) ? oldValue : []);
	const newSet = new Set(Array.isArray(newValue) ? newValue : []);
	const entries = [];
	for (const slug of newSet) {
		if (!oldSet.has(slug)) entries.push({ action: `${nameFrom(names.possessions, slug)} selected` });
	}
	for (const slug of oldSet) {
		if (!newSet.has(slug)) entries.push({ action: `${nameFrom(names.possessions, slug)} deselected` });
	}
	return entries;
}

// Write-in possessions carry their own label, so diff the { slug, label } list
// directly rather than looking names up in the snapshot.
function possessionCustomEntries(oldValue, newValue) {
	const oldBySlug = new Map((Array.isArray(oldValue) ? oldValue : []).map(c => [c.slug, c.label]));
	const newBySlug = new Map((Array.isArray(newValue) ? newValue : []).map(c => [c.slug, c.label]));
	const entries = [];
	for (const [slug, label] of newBySlug) {
		if (!oldBySlug.has(slug)) entries.push({ action: `${label} added (write-in possession)` });
	}
	for (const [slug, label] of oldBySlug) {
		if (!newBySlug.has(slug)) entries.push({ action: `${label} removed (write-in possession)` });
	}
	return entries;
}

function possessionUsesEntry(path, oldValue, newValue, names) {
	const slug = path.slice(POSSESSION_USES_PREFIX.length);
	const itemName = nameFrom(names.possessions, slug);
	return { action: `${itemName} uses changed from ${formatValue(oldValue)} to ${formatValue(newValue)}` };
}

function possessionSubchoiceEntries(path, oldValue, newValue, names) {
	const possessionSlug = path.slice(POSSESSION_SUBCHOICES_PREFIX.length);
	const oldSet = new Set(Array.isArray(oldValue) ? oldValue : []);
	const newSet = new Set(Array.isArray(newValue) ? newValue : []);
	const possessionName = nameFrom(names.possessions, possessionSlug);
	const entries = [];
	for (const choiceSlug of newSet) {
		if (!oldSet.has(choiceSlug)) {
			const choiceName = nameFrom(names.possessionChoices, `${possessionSlug}:${choiceSlug}`);
			entries.push({ action: `${possessionName}: ${choiceName} selected` });
		}
	}
	for (const choiceSlug of oldSet) {
		if (!newSet.has(choiceSlug)) {
			const choiceName = nameFrom(names.possessionChoices, `${possessionSlug}:${choiceSlug}`);
			entries.push({ action: `${possessionName}: ${choiceName} deselected` });
		}
	}
	return entries;
}

function possessionChoiceUsesEntry(path, oldValue, newValue, names) {
	const key = path.slice(POSSESSION_CHOICE_USES_PREFIX.length);
	const [possessionSlug, choiceSlug] = key.split(":");
	const possessionName = nameFrom(names.possessions, possessionSlug);
	const choiceName = nameFrom(names.possessionChoices, key);
	return { action: `${possessionName}: ${choiceName} uses changed from ${formatValue(oldValue)} to ${formatValue(newValue)}` };
}

function granularEntriesForPath(path, oldValue, newValue, names) {
	if (path.startsWith(INVENTORY_CHECKED_PREFIX)) return [inventorySelectionEntry(path, oldValue, newValue, names)].filter(Boolean);
	if (path.startsWith(INVENTORY_RESOURCE_PREFIX)) return [inventoryResourceEntry(path, oldValue, newValue, names)];
	if (path.startsWith(MOVE_RESOURCE_PREFIX)) return [moveResourceEntry(path, oldValue, newValue, names)];
	if (path.startsWith(MOVE_MARKS_PREFIX)) return moveMarkEntries(path, oldValue, newValue, names);
	if (path.startsWith(BACKGROUND_CHOICES_PREFIX)) return [backgroundChoiceEntry(path, oldValue, newValue, names)].filter(Boolean);
	if (path.startsWith(INITIATES_LOYALTY_PREFIX)) return [initiateLoyaltyEntry(path, oldValue, newValue, names)];
	if (path.startsWith(ANIMAL_COMPANION_PREFIX)) return [animalCompanionEntry(path, oldValue, newValue, names)];
	if (path.startsWith(CREW_PREFIX)) return [crewEntry(path, oldValue, newValue, names)];
	if (path === POSSESSION_SELECTED_PATH) return possessionSelectionEntries(oldValue, newValue, names);
	if (path === POSSESSION_CUSTOM_PATH) return possessionCustomEntries(oldValue, newValue);
	if (path.startsWith(POSSESSION_USES_PREFIX)) return [possessionUsesEntry(path, oldValue, newValue, names)];
	if (path.startsWith(POSSESSION_SUBCHOICES_PREFIX)) return possessionSubchoiceEntries(path, oldValue, newValue, names);
	if (path.startsWith(POSSESSION_CHOICE_USES_PREFIX)) return [possessionChoiceUsesEntry(path, oldValue, newValue, names)];
	return null;
}

async function actorUpdateEntries(actor, changed) {
	const names = await buildNameLookup(actor);
	const entries = [];
	for (const [path, newValue] of Object.entries(foundry.utils.flattenObject(changed))) {
		const normalizedPath = normalizeFlagPath(path);
		if (!normalizedPath || normalizedPath === `flags.${LEDGER_SCOPE}.${LEDGER_KEY}` || normalizedPath.startsWith(`flags.${LEDGER_SCOPE}.${LEDGER_KEY}.`)) continue;

		if (normalizedPath === "system.playbook" || normalizedPath.startsWith("system.playbook.")) {
			const oldName = actor.system?.playbook?.name;
			const newName = normalizedPath === "system.playbook"
				? newValue?.name
				: normalizedPath === "system.playbook.name"
					? newValue
					: foundry.utils.getProperty(changed, "system.playbook.name");
			if (newName && oldName !== newName) {
				entries.push({
					action: oldName ? `Playbook changed from ${oldName} to ${newName}` : `Playbook added: ${newName}`,
				});
			}
			continue;
		}

		const oldValue = getActorProperty(actor, normalizedPath);
		if (valuesEqual(oldValue, newValue)) continue;

		const granularEntries = granularEntriesForPath(normalizedPath, oldValue, newValue, names);
		if (granularEntries) {
			entries.push(...granularEntries);
			continue;
		}

		const label = labelForPath(normalizedPath);
		if (!label) continue;

		entries.push({ action: actionForField(label, oldValue, newValue) });
	}
	return coalesceEntries(entries);
}

function itemTypeLabel(item) {
	const moveType = item.system?.moveType;
	if (item.type === "playbook") return "Playbook";
	if (item.type !== "move") return item.type ?? "Item";
	if (moveType === "arcanum") return "Arcanum";
	if (moveType === "inventory-custom") return "Inventory item";
	if (moveType === "post-death") return "Post-death move";
	return "Move";
}

function createdItemAction(item) {
	const label = itemTypeLabel(item);
	if (label === "Move" || label === "Post-death move") return `${item.name} learned`;
	if (label === "Playbook") return `Playbook added: ${item.name}`;
	return `${label} added: ${item.name}`;
}

function deletedItemAction(item) {
	const label = itemTypeLabel(item);
	if (label === "Move" || label === "Post-death move") return `${item.name} removed`;
	if (label === "Playbook") return `Playbook removed: ${item.name}`;
	return `${label} removed: ${item.name}`;
}

export class CharacterLedger {
	static getEntries(actor) {
		return actor.getFlag?.(LEDGER_SCOPE, LEDGER_KEY) ?? [];
	}

	static async append(actor, entries, { userId = globalThis.game?.user?.id } = {}) {
		if (!actor || actor.type !== "character" || !entries?.length) return;
		const current = this.getEntries(actor);
		const user = userId ? globalThis.game?.users?.get?.(userId) : null;
		const stamped = entries.map(entry => ({
			id: globalThis.foundry?.utils?.randomID?.() ?? `${Date.now()}-${Math.random()}`,
			timestamp: Date.now(),
			userId: userId ?? null,
			userName: user?.name ?? globalThis.game?.user?.name ?? "Unknown",
			action: entry.action,
			// Name of the move that caused this change, when the change was a move's
			// automated effect (e.g. "+1 XP on a miss" → the rolled move). null for
			// plain sheet edits.
			move: entry.move ?? null,
		}));
		await actor.update({
			[`flags.${LEDGER_SCOPE}.${LEDGER_KEY}`]: stamped.concat(current.slice(0, LEDGER_MAX_ENTRIES - stamped.length)),
		}, { stonetopLedger: true, render: false });
	}

	static entriesForActorUpdate(actor, changed) {
		return actorUpdateEntries(actor, changed);
	}

	static async deleteEntries(actor, ids) {
		if (!actor || actor.type !== "character" || !ids?.size) return;
		const current = this.getEntries(actor);
		await actor.update({
			[`flags.${LEDGER_SCOPE}.${LEDGER_KEY}`]: current.filter(e => !ids.has(e.id)),
		}, { stonetopLedger: true });
	}

	static entriesForCreatedItems(items) {
		return items.map(item => ({ action: createdItemAction(item) }));
	}

	static entriesForDeletedItems(items) {
		return items.map(item => ({ action: deletedItemAction(item) }));
	}
}
