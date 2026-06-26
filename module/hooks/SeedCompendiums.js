import { getSetting, setSetting } from "../settings.js";
import { info, error } from "../utils/logger.js";
import { invalidateLocationSummaryIndex } from "../locations/location-tooltips.js";
import { makeRewriter, remapPageData, managedHash, carryOverPageState } from "./journal-sync-core.js";

// On a fresh world, copy the system's "Stonetop" JournalEntry compendium (the
// gazetteer — Locations, Lore, the bundled Journals, and the bestiary codex) into
// the world's Journal sidebar so the GM has it ready to browse and edit without
// manually importing the pack. The bestiary codex (~160 `bestiary`-page reference
// entries) is seeded too, so monsters turn up in the world's journal search and the
// GM can edit their questions in place.
//
// Runs once per world, guarded by the `seedingComplete` world setting, GM-only.
// `importJournalPack` recreates the compendium's folder tree (Lore, Places,
// Bestiary, Reference) under a single top-level "The World" folder, so the seeded
// entries keep their organisation while staying grouped together in the sidebar.
//
// Cross-links between the imported journals are then rewritten from their
// `@UUID[Compendium…]` form to point at the freshly-created world copies, so a GM
// browsing the seeded journals stays inside the world. Links that target things we
// do NOT seed — the monster stat-block (Actor) and arcana (Item) compendiums —
// stay pointed at the compendium, where they live.

// The fresh-start orientation journal. Its compendium source is hidden from
// players (`ownership.default: 0`); once seeded we open up the world copy to
// OBSERVER so every player can read it — and `_openSettingOverviewOnce` (in
// hooks/Ready.js) pops it open for each user the first time they connect.
const SETTING_OVERVIEW_NAME = "Setting Overview";

// Top-level world folder the seeded gazetteer (Places, Lore, Bestiary, Reference)
// is grouped under, so a fresh install gets one tidy "The World" folder in the
// Journal sidebar rather than four loose category folders at the root.
const WORLD_FOLDER_NAME = "The World";

// JournalEntry packs to NOT seed into the world (GM browses them in the compendium
// sidebar instead). Taylor's "Wider World and Other Wonders" Book II reference is
// carried verbatim alongside the fork's own locations/lore; seeding it would
// duplicate Book II content in the play world.
const NON_SEEDED_JOURNAL_PACKS = new Set(["wider-world-and-other-wonders"]);

export async function seedCompendiumJournalsOnce() {
	if (!game.user?.isGM) return;
	if (getSetting("seedingComplete")) return;

	const packs = game.packs.filter(
		p => p.documentName === "JournalEntry"
			&& p.metadata?.packageName === "stonetop"
			&& !NON_SEEDED_JOURNAL_PACKS.has(p.metadata?.name)
	);

	// compendium entry uuid → freshly-imported world entry uuid. The generators'
	// cross-links all target whole entries, so an entry-level map is enough and we
	// don't depend on import preserving ids. Entry names are unique within a pack,
	// so name is a safe join key.
	const linkMap = new Map();
	const created = [];

	// Group everything we seed under one top-level "The World" folder.
	const worldRootId = await ensureWorldRootFolder();

	for (const pack of packs) {
		try {
			const docs = await importJournalPack(pack, worldRootId);
			if (!Array.isArray(docs)) continue;
			await pack.getIndex();
			const worldUuidByName = new Map(docs.map(d => [d.name, d.uuid]));
			for (const idx of pack.index) {
				const worldUuid = worldUuidByName.get(idx.name);
				if (worldUuid) linkMap.set(`Compendium.${pack.collection}.JournalEntry.${idx._id}`, worldUuid);
			}
			created.push(...docs);
		} catch (err) {
			error(`Failed to seed journals from ${pack.collection}:`, err);
		}
	}

	await remapCrossLinks(created, linkMap);
	// Record the baseline fingerprint of each seeded entry (after the link remap, so
	// it matches what's stored) plus the version it was seeded at. Future loads use
	// this to tell a pristine entry — safe to refresh to a newer shipped version —
	// from one the GM has edited. See updateSeededJournalsOnVersionChange.
	await stampJournalBaselines(created);
	await setSetting("journalSyncVersion", game.system.version);
	await openSettingOverviewToPlayers(created);

	// The seeded world journals carry the same `flags.stonetop.summary` as their
	// compendium source; drop the cached tooltip index so it rebuilds and the
	// rewritten (world-uuid) cross-links get their hover summaries.
	invalidateLocationSummaryIndex();

	// Set the flag regardless of partial failures: a retry would re-import the
	// packs that already succeeded and duplicate them, which is worse than a gap.
	await setSetting("seedingComplete", true);

	if (created.length) {
		info(`Seeded ${created.length} journal entries from compendiums into the world.`);
		ui.notifications?.info(`Stonetop: imported ${created.length} journal entries into your world.`);
	}
}

// Find (or create) the top-level "The World" JournalEntry folder the seed groups
// everything under. Reuses an existing root folder of that name (e.g. from an
// earlier partial seed) so re-running doesn't duplicate it. Returns its id, or
// null if creation fails — in which case the seed falls back to the world root.
async function ensureWorldRootFolder() {
	const existing = (game.folders ?? []).find(f =>
		f.type === "JournalEntry" && f.name === WORLD_FOLDER_NAME && !f.folder
	);
	if (existing) return existing.id;
	try {
		const created = await Folder.create({ name: WORLD_FOLDER_NAME, type: "JournalEntry" });
		return created?.id ?? null;
	} catch (err) {
		error(`Failed to create the "${WORLD_FOLDER_NAME}" folder:`, err);
		return null;
	}
}

// Import every entry in a journal pack into the world, recreating the folder
// subtree the entries use so the world mirrors the compendium's layout — but
// nested under `rootParentId` ("The World") rather than loose at the world root.
// Folder resolution is best-effort — anything it can't place falls back to that
// root parent rather than failing the whole seed. Returns the created entries.
async function importJournalPack(pack, rootParentId = null) {
	const seed = await pack.getDocuments();
	if (!seed.length) return [];

	const packFolders = new Map();
	for (const f of pack.folders ?? []) packFolders.set(f.id, f);

	// Recreate a compendium folder (and its ancestors) in the world, memoised.
	// A null parent (compendium top-level folder, or an entry filed loose) maps
	// to `rootParentId`, so the compendium's top level nests under "The World".
	const worldFolderId = new Map();
	async function resolveFolder(cf) {
		const id = cf?.id ?? null; // `cf` is a Folder doc (or null)
		if (!id) return rootParentId;
		if (worldFolderId.has(id)) return worldFolderId.get(id);
		const folder = packFolders.get(id);
		if (!folder) return rootParentId;
		const parentId = await resolveFolder(folder.folder);
		// Reuse an existing world folder of the same name/parent (e.g. from an
		// earlier partial seed) instead of creating a duplicate.
		const existing = (game.folders ?? []).find(f =>
			f.type === "JournalEntry" && f.name === folder.name && (f.folder?.id ?? null) === parentId
		);
		const wf = existing ?? await Folder.create({
			name: folder.name, type: "JournalEntry", folder: parentId,
			sort: folder.sort ?? 0, color: folder.color ?? null,
		});
		worldFolderId.set(id, wf.id);
		return wf.id;
	}

	// Skip entries already present in the world (matched on the compendium source
	// `fromCompendium` stamps), so the seed is idempotent: if an earlier run only
	// imported some packs/entries — e.g. a partial failure — re-running imports just
	// the missing ones rather than duplicating what's already there.
	const alreadySeeded = new Set(
		(game.journal ?? [])
			.map(j => j._stats?.compendiumSource ?? j.flags?.core?.sourceId)
			.filter(Boolean)
	);

	// fromCompendium prepares each doc for world creation (drops the id, stamps
	// `_stats.compendiumSource`) exactly as core's importAll does; we keep sort so
	// the seeded entries retain their authored order, and place them by folder.
	const data = [];
	for (const d of seed) {
		if (alreadySeeded.has(d.uuid)) continue;
		const obj = game.journal.fromCompendium(d, { clearSort: false });
		obj.folder = await resolveFolder(d.folder);
		data.push(obj);
	}
	return data.length ? JournalEntry.createDocuments(data) : [];
}

// Grant players read access to the seeded Setting Overview journal so the
// fresh-start auto-open (hooks/Ready.js) can show it to them. Edits the world
// copy only; the compendium source stays GM-only.
async function openSettingOverviewToPlayers(entries) {
	const overview = entries.find(e => e.name === SETTING_OVERVIEW_NAME);
	if (!overview) return;
	const observer = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
	if (overview.ownership?.default >= observer) return;
	try {
		await overview.update({ "ownership.default": observer });
	} catch (err) {
		error(`Failed to grant players access to "${SETTING_OVERVIEW_NAME}":`, err);
	}
}

// Rewrite @UUID links that target a seeded journal so they open the world copy.
// Links to documents we didn't import (bestiary, arcana) aren't in `linkMap`, so
// the replacer leaves them as compendium links.
async function remapCrossLinks(entries, linkMap) {
	if (!linkMap.size) return;
	const rewrite = makeRewriter(linkMap);
	for (const entry of entries) {
		const updates = [];
		for (const page of entry.pages ?? []) {
			// Structured "location" pages keep their cross-links in system.sections
			// (prose bodies, Q&A, and grouped Dangers), not text.content; text pages in
			// text.content. `remapPageData` rewrites both in place — clone first, then
			// only write back the pages it actually changed.
			const obj = page.toObject();
			const before = JSON.stringify(page.type === "location" ? obj.system : obj.text);
			remapPageData(obj, rewrite);
			const after = JSON.stringify(page.type === "location" ? obj.system : obj.text);
			if (after === before) continue;
			updates.push(page.type === "location"
				? { _id: page.id, "system.sections": obj.system.sections }
				: { _id: page.id, "text.content": obj.text.content });
		}
		if (updates.length) {
			try { await entry.updateEmbeddedDocuments("JournalEntryPage", updates); }
			catch (err) { error(`Failed to remap cross-links in "${entry.name}":`, err); }
		}
	}
}

// Stamp each seeded entry with the fingerprint + version of the content we wrote, so
// later loads can tell a pristine entry from a GM-edited one (see managedHash).
async function stampJournalBaselines(entries) {
	const version = game.system.version;
	for (const entry of entries) {
		try { await entry.setFlag("stonetop", "journalSync", { hash: managedHash(entry.toObject()), version }); }
		catch (err) { error(`Failed to fingerprint seeded journal "${entry.name}":`, err); }
	}
}

// compendium-entry uuid → world-entry uuid, drawn from journals already seeded into
// the world (each stamped with its `compendiumSource`). Mirrors the map the seed
// builds during import, so the update path rewrites new content's links the same way.
function buildWorldLinkMap() {
	const map = new Map();
	for (const j of game.journal ?? []) {
		const src = j._stats?.compendiumSource ?? j.flags?.core?.sourceId;
		if (src && src.startsWith("Compendium.stonetop.")) map.set(src, j.uuid);
	}
	return map;
}

// On a system-version bump, roll newly-shipped journal content into the world — but
// only for entries the GM hasn't touched. An entry is "pristine" when its current
// content fingerprint still equals the baseline we stamped when we last wrote it; a
// mismatch means the GM edited it, so we leave it and just point them at the
// compendium for the latest. Pristine entries whose shipped content actually changed
// are refreshed in place; the rest only have their version stamp bumped.
//
// Runs GM-only, once per version (guarded by the `journalSyncVersion` setting). Does
// nothing until the world has been seeded — fresh installs go through the seed path.
export async function updateSeededJournalsOnVersionChange() {
	if (!game.user?.isGM) return;
	if (!getSetting("seedingComplete")) return;
	const version = game.system.version;
	if (getSetting("journalSyncVersion") === version) return;

	const rewrite = makeRewriter(buildWorldLinkMap());
	const updated = [], skipped = [];

	for (const entry of game.journal ?? []) {
		const src = entry._stats?.compendiumSource ?? entry.flags?.core?.sourceId;
		if (!src || !src.startsWith("Compendium.stonetop.")) continue;
		const source = await fromUuid(src);
		if (!source) continue; // entry dropped from the pack this version — leave the world copy

		const worldHash = managedHash(entry.toObject());
		const baseline = entry.getFlag("stonetop", "journalSync");
		// GM-edited: fingerprint drifted from what we last wrote. Hands off.
		if (baseline?.hash && baseline.hash !== worldHash) { skipped.push(entry.name); continue; }

		// The newly-shipped content, with its links remapped to this world's copies.
		const srcData = source.toObject();
		const newPages = (srcData.pages ?? []).map(p => remapPageData(p, rewrite));
		const newHash = managedHash({ pages: newPages });

		// No baseline yet (seeded before this feature shipped): only adopt one if the
		// world copy still matches the shipped content — otherwise we can't tell an edit
		// from version drift, so we never risk clobbering it.
		if (!baseline?.hash) {
			if (worldHash === newHash) await entry.setFlag("stonetop", "journalSync", { hash: newHash, version });
			else skipped.push(entry.name);
			continue;
		}

		// Pristine. If the shipped content is unchanged, just bump the version stamp.
		if (newHash === worldHash) { await entry.setFlag("stonetop", "journalSync", { hash: newHash, version }); continue; }

		// Pristine and the shipped version differs → refresh the entry's pages in place,
		// carrying over reader state (checkbox ticks) the content hash doesn't track so
		// updating the content doesn't wipe a player's progress.
		try {
			const oldPageIds = entry.pages.map(p => p.id);
			const pagesToCreate = carryOverPageState(newPages, entry.toObject().pages)
				.map(({ _id, ...rest }) => rest);
			await entry.createEmbeddedDocuments("JournalEntryPage", pagesToCreate, { keepId: false });
			if (oldPageIds.length) await entry.deleteEmbeddedDocuments("JournalEntryPage", oldPageIds);
			if (entry.name !== srcData.name) await entry.update({ name: srcData.name });
			await entry.setFlag("stonetop", "journalSync", { hash: newHash, version });
			updated.push(entry.name);
		} catch (err) {
			error(`Failed to refresh seeded journal "${entry.name}":`, err);
			skipped.push(entry.name);
		}
	}

	await setSetting("journalSyncVersion", version);

	if (updated.length || skipped.length) {
		invalidateLocationSummaryIndex(); // links/summaries may have moved
		const parts = [];
		if (updated.length) parts.push(`updated ${updated.length} journal${updated.length === 1 ? "" : "s"}`);
		if (skipped.length) parts.push(`kept your edits in ${skipped.length} (latest is in the compendium)`);
		ui.notifications?.info(`Stonetop: ${parts.join("; ")}.`);
		info(`Journal sync → v${version}. Updated: [${updated.join(", ")}]. Skipped (edited): [${skipped.join(", ")}].`);
	}
}
