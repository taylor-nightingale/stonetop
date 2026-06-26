// World data migration runner. GM-gated, version-gated (the `dataVersion` world setting),
// idempotent, per-document try/catch, and NON-DESTRUCTIVE (source data is left in place).
//
// SCHEMA_VERSION 1 → 2 — "fork-self" path (Path A): after the system id is renamed
//   stonetop_pwd → stonetop, an existing FORK world's actor flags + world settings still
//   live under the old "stonetop_pwd" scope. Consolidate them into the active "stonetop"
//   scope so the renamed system reads them. v2 also remaps persisted asset paths in world
//   DOCUMENTS (actor portraits/tokens, baked-in chat-card icons, …) from
//   `systems/stonetop_pwd/…` → `systems/stonetop/…`, which otherwise 404 after the rename.
//
// Path B — "Taylor-origin" actor migration: convert a character/steading authored under his
//   system.* schema into the fork's flags (the pure builders in migrate-character.js /
//   migrate-steading.js + the apply-layer below). Like Path A it runs only AFTER the rename (so the
//   current live world is never touched until then), but its idempotency is a
//   PER-ACTOR `pathBMigrated` marker rather than the global dataVersion — so each actor is tracked
//   individually and re-migrates only when PATH_B_VERSION bumps (e.g. once the slug crosswalk lands).
import { buildFlagScopeConsolidation } from "./flag-scope.js";
import { buildOwnFieldRemap } from "./asset-paths.js";
import { pathAPassesFor } from "./gating.js";
import { STONETOP_SCOPE } from "../actors/character/StonetopFlags.js";
import { isTaylorOriginCharacter, buildCharacterMigration } from "./migrate-character.js";
import { isTaylorOriginSteading, buildSteadingMigration, steadingClassicSource } from "./migrate-steading.js";
import { getSetting, setSetting } from "../settings.js";
import { info, warn, error } from "../utils/logger.js";

export const SCHEMA_VERSION = 2;

// Per-actor Path B marker version. Bump when the Path B mapping changes meaningfully so already-
// migrated actors re-migrate on next load. v2: added the lore/insert slug crosswalk + the current-form
// playbook-item lore fan-out (crosswalk.js + buildPlaybookLoreMigration).
export const PATH_B_VERSION = 2;

// This system's ORIGINAL id, before it is renamed to the shared "stonetop" id.
// PROTECTED LITERAL — must NOT be touched by the stonetop_pwd→stonetop rename sweep; it is
// the fixed historical scope the migration reads legacy data from. The whole runner is a
// no-op until the system has actually been renamed away from it (so a pre-rename load can't
// prematurely stamp dataVersion and block the real consolidation).
const ORIGINAL_FORK_SCOPE = "stonetop_pwd";

export async function runMigrations() {
	if (!game.user?.isGM) return;

	// Pre-rename (the current "stonetop_pwd" fork): run NOTHING — neither Path A nor Path B — so the
	// user's live world is never touched by migration until the rename to "stonetop". Both paths
	// only make sense in the renamed "stonetop" system (Path A consolidates the old scope; Path B
	// migrates his actors, which only appear when the renamed system opens his world). The verifier
	// harness drives runPathB() directly to validate it pre-rename.
	if (STONETOP_SCOPE === ORIGINAL_FORK_SCOPE) return;

	// Path B (Taylor-origin actor migration) — per-actor `pathBMigrated` marker, independent of Path
	// A's global dataVersion, so it tracks each actor and re-runs on a PATH_B_VERSION bump.
	await runPathB(STONETOP_SCOPE);

	// Path A (fork-self consolidation) — version-gated by dataVersion. Each pass runs ONLY at the
	// version that introduced it (pathAPassesFor), so a future bump never re-applies an already-run
	// pass — A1 is non-destructive, so re-running it would resurrect flags a GM deleted post-migration.
	const current = Number(getSetting("dataVersion") ?? 0);
	if (current >= SCHEMA_VERSION) return;
	info(`Stonetop data migration ${current} → ${SCHEMA_VERSION}…`);
	const passes = pathAPassesFor(current);
	try {
		if (passes.consolidate) {              // v1 — flag-scope + settings consolidation
			await _consolidateLegacyFlagScope();
			await _consolidateLegacySettings();
		}
		if (passes.remapAssets) {              // v2 — world-document asset-path remap
			await _remapLegacyAssetPaths();
		}
		await setSetting("dataVersion", SCHEMA_VERSION);
		info("Stonetop data migration complete.");
	} catch (e) {
		error(`Stonetop data migration failed: ${e?.message ?? e}`);
	}
}

// ── Path B: Taylor-origin actor migration ─────────────────────────────────────
// Iterates world actors; migrates each un-migrated Taylor-origin character/steading into the fork's
// flags, then stamps a per-actor marker. GM-gated (via the caller), per-actor try/catch, idempotent.
// Exported so the verifier harness can drive it directly. NPC actors are skipped — the fork's
// NpcModel is a byte-identical port of his creature stat block, so his NPC actors load as-is.
export async function runPathB(scope = STONETOP_SCOPE) {
	if (!game.user?.isGM) return;
	for (const actor of [...(game.actors ?? [])]) {
		try {
			if (Number(actor.getFlag(scope, "pathBMigrated") ?? 0) >= PATH_B_VERSION) continue;
			let migrated = false;
			if (actor.type === "character" && isTaylorOriginCharacter(actor)) {
				_warnIfPreSA(actor, "character");
				await _applyCharacterMigration(actor, scope);
				migrated = true;
			} else if ((actor.type === "stonetop" || actor.system?.customType === "stonetop") && isTaylorOriginSteading(actor)) {
				await _applySteadingMigration(actor, scope);
				migrated = true;
			}
			if (migrated) {
				await actor.setFlag(scope, "pathBMigrated", PATH_B_VERSION);
				info(`Path B: migrated ${actor.type} "${actor.name}".`);
			}
		} catch (e) {
			error(`Path B migration failed for "${actor?.name}": ${e?.message ?? e}`);
		}
	}
}

// Apply the character flag payload, then the runtime side-effect a pure builder can't do: granting
// the post-death insert's embedded move items (setPostDeathInsert deletes old + sets the slug +
// creates the move docs). `stonetopLedger:true` suppresses ledger/chat side-effects during migration.
async function _applyCharacterMigration(actor, scope) {
	const payload = buildCharacterMigration(actor, scope);
	if (Object.keys(payload).length) await actor.update(payload, { stonetopLedger: true });
	const slug = payload[`flags.${scope}.postDeathInsert.slug`];
	if (slug) await actor.typedActor?.setPostDeathInsert?.(slug);
}

async function _applySteadingMigration(actor, scope) {
	const payload = buildSteadingMigration(steadingClassicSource(actor), scope);
	if (Object.keys(payload).length) await actor.update(payload, { stonetopLedger: true });
}

// Best-effort heads-up: a character exported BEFORE his §A migration carries data on his
// flags.stonetop.* scope, not system.*, so the builders (which read system.*) would migrate it
// only partially. We can't reconstruct that here; warn the GM rather than silently half-migrate.
function _warnIfPreSA(actor, kind) {
	const legacy = actor?._source?.flags?.stonetop;
	if (legacy && typeof legacy === "object" && (legacy.lore || legacy.resources || legacy.background || legacy.choices)) {
		warn(`Path B: ${kind} "${actor.name}" looks like a PRE-§A export (data on flags.stonetop.*); some fields may not migrate. Open it in his system once to upgrade, then re-import.`);
	}
}

// A1 — actor flags: flags.stonetop_pwd → flags.<active>, deep-merged (active wins).
async function _consolidateLegacyFlagScope() {
	for (const actor of [...(game.actors ?? [])]) {
		try {
			const update = buildFlagScopeConsolidation(actor.flags, ORIGINAL_FORK_SCOPE, STONETOP_SCOPE);
			if (update) await actor.update(update, { stonetopLedger: true }); // skip ledger side-effects
		} catch (e) {
			error(`flag-scope migration failed for actor "${actor.name}": ${e?.message ?? e}`);
		}
	}
}

// A2 — world settings: stonetop_pwd.<key> → <active>.<key>. Settings store user data
// (seeding flags, chronicle/expedition/introductions answers), so preserve them when the
// registration namespace changes. Only copies when the new key is still unset.
async function _consolidateLegacySettings() {
	const worldStore = game.settings?.storage?.get?.("world");
	if (!worldStore) return;
	const rawByKey = key => {
		try { return worldStore.find?.(s => s.key === key); } catch { return null; }
	};
	for (const def of game.settings.settings.values()) {
		if (def.namespace !== STONETOP_SCOPE) continue;
		const legacyDoc = rawByKey(`${ORIGINAL_FORK_SCOPE}.${def.key}`);
		if (!legacyDoc) continue;
		if (rawByKey(`${STONETOP_SCOPE}.${def.key}`)) continue; // new key already has a stored value
		try {
			let value = legacyDoc.value;
			if (typeof value === "string") { try { value = JSON.parse(value); } catch { /* keep string */ } }
			await game.settings.set(STONETOP_SCOPE, def.key, value);
		} catch (e) {
			error(`setting migration failed for "${def.key}": ${e?.message ?? e}`);
		}
	}
}

// A3 — asset paths: rewrite persisted `systems/<old-id>/…` references in world documents to
// `systems/<active-id>/…` so portraits/tokens/baked-in icons stop 404-ing after the rename.
// Sweeps every world-document collection, recursing into embedded documents (an Actor's items
// + effects, a JournalEntry's pages, a Scene's tokens/tiles/…) which can't be set through a
// parent update. Idempotent: once rewritten, the legacy substring is gone, so re-runs no-op.
async function _remapLegacyAssetPaths() {
	if (STONETOP_SCOPE === ORIGINAL_FORK_SCOPE) return;
	const collections = [
		game.actors, game.items, game.journal, game.scenes, game.macros,
		game.playlists, game.tables, game.cards, game.messages,
	].filter(Boolean);
	let remapped = 0;
	for (const coll of collections) {
		for (const doc of [...coll]) {
			try { remapped += await _remapDocAssetPaths(doc); }
			catch (e) { error(`asset-path remap failed for ${doc?.documentName} "${doc?.name ?? doc?.id}": ${e?.message ?? e}`); }
		}
	}
	if (remapped) info(`Stonetop asset-path remap: updated ${remapped} document(s).`);
}

// Remap one document's own fields, then recurse into each of its embedded collections.
// Returns the number of documents actually updated (this one + descendants).
async function _remapDocAssetPaths(doc) {
	let count = 0;
	const embeddedKeys = Object.keys(doc.constructor?.hierarchy ?? {});
	const update = buildOwnFieldRemap(doc.toObject(), ORIGINAL_FORK_SCOPE, STONETOP_SCOPE, embeddedKeys);
	if (Object.keys(update).length) {
		await doc.update(update, { stonetopLedger: true, render: false });
		count++;
	}
	for (const key of embeddedKeys) {
		const collection = doc[key];
		if (!collection?.size) continue;
		for (const child of [...collection]) count += await _remapDocAssetPaths(child);
	}
	return count;
}
