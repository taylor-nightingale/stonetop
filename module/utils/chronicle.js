// ── Chronicle journal writer (Foundry wrapper) ─────────────────────────────────
// Gathers the recorded Introductions + Spring Burst answers (and the expedition
// log), compiles them with the pure core (chronicle-core.js), and SEEDS a "The
// Chronicle" journal FOLDER holding two journals:
//   • "Player Introductions" — a page per character + the party "Let Spring Burst
//     Forth" page. OBSERVER, so players can read it.
//   • "Expeditions"          — a page per logged expedition. GM-only, since trips
//     carry GM prep alongside the record.
// (Foundry folders hold journal entries, not pages, so grouping the record into
// folders means splitting it across two entries.) Pages use the structured
// "chronicle" JournalEntryPage subtype (LocationPageModel), so their Bonds / Asked-
// of-the-others Q&A is inline-editable like a location's "In Play" questions.
//
// Seed-once: the journals are the source of truth. A page is created the first time
// its key appears; thereafter it's left alone, so inline edits stick across re-saves
// (we never update or prune an existing page). New PCs / expeditions get new pages on
// the next save.

import { getSetting } from "../settings.js";
import { getPlayerCharacters, playbookSlug, orderByCombatTurns } from "./playbook-actors.js";
import {
	buildChroniclePages,
	mergeChronicleSections,
	CHRONICLE_FOLDER_NAME,
	CHRONICLE_FOLDER_COLOR,
	INTRODUCTIONS_JOURNAL_NAME,
	EXPEDITIONS_JOURNAL_NAME,
	EXPEDITION_PAGE_KEY_PREFIX,
} from "./chronicle-core.js";

// Player characters in the introductions' turn order when a combat is set up
// (honouring how the GM arranged the table), else the world roster. Any PC not in
// the tracker is appended in roster order.
function orderedPlayerCharacters() {
	const all     = getPlayerCharacters();
	const ordered = orderByCombatTurns(all);
	if (!ordered.length) return all;
	// Any PC not on the tracker is appended in roster order, so every PC gets a page.
	const seen = new Set(ordered.map(a => a.id));
	for (const actor of all) if (!seen.has(actor.id)) ordered.push(actor);
	return ordered;
}

// Shape the roster for the compiler.
function chroniclePcs() {
	return orderedPlayerCharacters().map(a => ({
		id:           a.id,
		name:         a.name,
		playbookName: a.system?.playbook?.name ?? "",
		slug:         playbookSlug(a),
	}));
}

/**
 * Shared "Save the Chronicle" button handler for the session-zero dialogs:
 * disable the button while compiling, surface failures, then re-enable it.
 * `context` labels the error log line; `beforeSave` lets a dialog flush a pending
 * draft to its setting first (the compiler reads the persisted values).
 * Returns `true` if the save completed without error, `false` if it threw — so a
 * caller can decide whether to proceed (e.g. close its dialog).
 */
export async function saveChronicleFromButton(button, { context = "Chronicle", beforeSave } = {}) {
	if (button) button.disabled = true;
	try {
		await beforeSave?.();
		await game.stonetop?.saveChronicle?.();
		return true;
	} catch (err) {
		console.error(`Stonetop | ${context}: failed to save the Chronicle`, err);
		ui.notifications.error("Couldn't save the Chronicle.");
		return false;
	} finally {
		if (button) button.disabled = false;
	}
}

// Find (or create) the "The Chronicle" journal folder that holds the introductions,
// expeditions, and Seasons Change journals. Shared so each journal builder finds the
// one folder instead of re-implementing the lookup (see seasons/seasons-chronicle.js).
export async function ensureChronicleFolder() {
	const existing = (game.folders?.contents ?? []).find(f => f.type === "JournalEntry" && f.name === CHRONICLE_FOLDER_NAME);
	return existing ?? await Folder.create({ name: CHRONICLE_FOLDER_NAME, type: "JournalEntry", color: CHRONICLE_FOLDER_COLOR }) ?? null;
}

// Find (or create) a journal named `name` inside `folder`. `ensureObserver` opens a
// pre-existing GM-only entry to players (for the introductions journal); the
// expeditions journal is left at whatever ownership the GM set.
export async function ensureChronicleJournal(name, folderId, defaultOwnership, { ensureObserver = false } = {}) {
	const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
	let entry = (game.journal?.contents ?? []).find(j => j.folder?.id === folderId && j.name === name) ?? null;
	if (!entry) {
		entry = await JournalEntry.create({ name, folder: folderId, ownership: { default: defaultOwnership } });
	} else if (ensureObserver && (entry.ownership?.default ?? 0) < OBSERVER) {
		await entry.update({ "ownership.default": OBSERVER });
	}
	return entry;
}

// Seed + top up: create the pages whose key isn't present yet (appended after the
// journal's current pages), and for an already-seeded page fold in only content recorded
// since — new sections, and new Q&A pairs (see mergeChronicleSections) — so a part-way or
// later-session save isn't silently dropped. Existing/edited sections are preserved, so
// inline edits still survive re-saves. Returns { created, updated } counts.
async function seedChroniclePages(entry, pages) {
	if (!entry || !pages.length) return { created: 0, updated: 0 };
	const existingByKey = new Map();
	let maxSort = 0;
	for (const page of entry.pages ?? []) {
		const key = page.getFlag?.("stonetop", "chronicleKey");
		if (key) existingByKey.set(key, page);
		maxSort = Math.max(maxSort, Number(page.sort) || 0);
	}
	const toCreate = [];
	const toUpdate = [];
	let sort = maxSort;
	for (const page of pages) {
		const existing = existingByKey.get(page.key);
		if (existing) {
			// Already seeded — merge in any sections/pairs recorded since (toObject() gives
			// plain data the merge can spread and the update can store back).
			const current = existing.toObject().system?.sections ?? [];
			const { sections, added } = mergeChronicleSections(current, page.sections);
			if (added) toUpdate.push({ _id: existing.id, "system.sections": sections });
			continue;
		}
		sort += 10;
		toCreate.push({
			name:   page.name,
			type:   "chronicle",
			sort,
			system: { sections: page.sections },
			flags:  { stonetop: { chronicleKey: page.key } },
		});
	}
	if (toCreate.length) await entry.createEmbeddedDocuments("JournalEntryPage", toCreate);
	if (toUpdate.length) await entry.updateEmbeddedDocuments("JournalEntryPage", toUpdate);
	return { created: toCreate.length, updated: toUpdate.length };
}

/**
 * Compile the recorded answers into the "The Chronicle" folder's two journals,
 * seeding any pages that don't exist yet (creating the folder/journals the first
 * time). Existing pages are left untouched — the journals are the source of truth, so
 * inline edits survive re-saves (see file header). Returns the Player Introductions
 * journal (so the API can open it). GM-only; returns null when there's nothing recorded
 * yet, or on a non-GM call.
 */
export async function writeChronicle() {
	if (!game.user?.isGM) {
		ui.notifications?.warn?.("Only the GM can save the Chronicle.");
		return null;
	}

	const expeditionLog = getSetting("expeditionAnswers") ?? {};
	const pages = buildChroniclePages({
		pcs:           chroniclePcs(),
		introAnswers:  getSetting("introductionsAnswers") ?? {},
		springAnswers: getSetting("springBurstAnswers") ?? {},
		expeditions:   Array.isArray(expeditionLog.list) ? expeditionLog.list : [],
	});
	if (!pages.length) {
		ui.notifications?.info?.("Nothing has been recorded for the Chronicle yet.");
		return null;
	}

	const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
	const NONE     = CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;

	// Split the flat page list by destination journal: PC + Spring pages go to the
	// player-readable introductions journal; expedition pages to the GM-only one.
	const introPages = pages.filter(p => !p.key.startsWith(EXPEDITION_PAGE_KEY_PREFIX));
	const expePages  = pages.filter(p =>  p.key.startsWith(EXPEDITION_PAGE_KEY_PREFIX));

	// "The Chronicle" journal folder, holding the two journals.
	const folder = await ensureChronicleFolder();
	if (!folder) return null;

	const intro = await ensureChronicleJournal(INTRODUCTIONS_JOURNAL_NAME, folder.id, OBSERVER, { ensureObserver: true });
	const expe  = expePages.length
		? await ensureChronicleJournal(EXPEDITIONS_JOURNAL_NAME, folder.id, NONE)
		: null;

	let created = 0, updated = 0;
	for (const [target, list] of [[intro, introPages], [expe, expePages]]) {
		const { created: c, updated: u } = await seedChroniclePages(target, list);
		created += c;
		updated += u;
	}

	const parts = [];
	if (created) parts.push(`added ${created} ${created === 1 ? "page" : "pages"}`);
	if (updated) parts.push(`updated ${updated} ${updated === 1 ? "page" : "pages"}`);
	ui.notifications?.info?.(parts.length
		? `Chronicle: ${parts.join(", ")}.`
		: "The Chronicle is already up to date — edit its pages there directly.");
	return intro;
}
