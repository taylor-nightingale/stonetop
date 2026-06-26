// Path B — convert a Taylor-origin character (his `system.*` schema + embedded item-type
// docs) into this fork's representation (flags + a playbook ref). This INVERTS his
// `src/migration/migrateCharacter.js`: his §A maps old flags → system fields, so we map his
// system fields back to (the evolved) flags.
//
// IMPORTANT: the fork's CharacterModel strips unknown `system.*` keys when his actor loads,
// so callers must read his data from `actor._source.system` (raw stored source), NOT the
// cleaned `actor.system`. The pure builders below take that raw system object.
//
// SCOPE BOUNDARY: these inverters assume his §A migration has ALREADY folded his pre-DataModel
// `flags.stonetop.*` (resources.counts / lore.values / background.selected / …) into `system.*`.
// A character exported BEFORE his §A ran still carries that data only on `flags.stonetop.*`, so the
// actor-level builders (scalar/lore/resources) would read empty `_source.system` and silently skip
// it. Out of scope here; the future MigrationRunner/detector should assert `_source.system` carries
// the expected fields and warn/skip a pre-§A character rather than migrating it lossily.
//
// STATUS: incremental. Scalars (§A inverse) + detection are done and tested. Embedded items
// (arcanum/possession/follower/outfit/insert), the actor-level lore split, the instinct + appearance
// fan-out, and the inventory resource counts are mapped; the rest of the choices fan-out (current-form
// lore groups, builders → possessions, background nested choices — all needing the per-playbook slug
// crosswalk) and the background/move resource counts are the remaining increments — see the TODOs in
// buildCharacterMigration. NOT wired into MigrationRunner yet: a partial Path B that stamped
// dataVersion would strand the rest.

import { buildCustomFollower } from "../data/follower-build.js";
import { composeInstinct } from "../utils/strings.js";
import { translateLoreKey, translateInsertLoreKey, playbookLoreGroups } from "./crosswalk.js";

const TAYLOR_ITEM_TYPES = new Set(["arcanum", "possession", "insert", "outfitItem", "improvement"]);

/**
 * Is this actor a Taylor-origin character (his schema), as opposed to a fork-origin one?
 * Detected from the RAW source (his fields are stripped from the cleaned model). Telltales:
 * his character-only system fields, or any of his embedded item-type docs.
 */
export function isTaylorOriginCharacter(actor) {
	if (actor?.type !== "character") return false;
	const sys = actor?._source?.system ?? {};
	const hasField =
		typeof sys.playbookSlug === "string" && sys.playbookSlug !== "" ||
		!!sys.background?.selected ||
		!!sys.origin?.selected ||
		!!sys.instinct?.custom ||
		(sys.inventory && Object.keys(sys.inventory.checked ?? {}).length > 0) ||
		Object.keys(sys.choices?.values ?? {}).length > 0 ||
		Object.keys(sys.lore?.values ?? {}).length > 0;
	if (hasField) return true;
	return [...(actor?.items ?? [])].some(i => TAYLOR_ITEM_TYPES.has(i.type));
}

const _isNonEmptyObject = v => v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0;

/**
 * Remap his bundled playbook-portrait image to the fork's vendored equivalent. His characters use the
 * playbook portrait PNG as the actor/token image (`systems/stonetop/assets/playbooks/<slug>.png`); the
 * fork ships that same art under `assets/classic/playbooks/`, so his path 404s on a migrated sheet/token.
 * Mirrors StonetopSingleton's legacy-steading-image remap. Returns null for any OTHER path (fork-native
 * or core icons are left untouched). `scope` is the active system id (== flag scope), so the result is
 * correct both before and after the stonetop_pwd → stonetop rename.
 * @returns {string|null} the remapped fork path, or null if `path` isn't one of his playbook portraits.
 */
export function remapTaylorPortrait(path, scope) {
	const m = typeof path === "string" && path.match(/^\/?systems\/stonetop\/assets\/playbooks\/(.+)$/);
	return m ? `systems/${scope}/assets/classic/playbooks/${m[1]}` : null;
}

/**
 * Build the flag/system update for the scalar fields of a Taylor character (his §A, inverted).
 * Pure — pass his raw system object (from `actor._source.system`) and the active flag scope.
 * Stats/attributes/HP/XP/level already share the fork's shape, so they're left untouched.
 * @returns {object} a flat `actor.update()` payload (dot-path keys).
 */
export function buildCharacterScalarMigration(rawSystem, scope) {
	const sys = rawSystem ?? {};
	const u = {};
	const flag = (ns, key, val) => { u[`flags.${scope}.${ns}.${key}`] = val; };

	if (sys.background?.selected) flag("background", "selected", sys.background.selected);
	if (sys.origin?.selected)     flag("origin", "selected", sys.origin.selected);
	// His free-text instinct lives at instinct.custom; the fork stores it at instinct.selected.
	if (sys.instinct?.custom)     flag("instinct", "selected", sys.instinct.custom);

	const inv = sys.inventory ?? {};
	if (_isNonEmptyObject(inv.checked))            flag("inventory", "checked", inv.checked);
	if (Number.isFinite(inv.regularPool))          flag("inventory", "regularPool", inv.regularPool);
	if (Number.isFinite(inv.smallPool))            flag("inventory", "smallPool", inv.smallPool);
	// His free-text "other items" scratch line (parity gap) → preserved as a flag (no UI yet).
	if (typeof inv.otherItems === "string" && inv.otherItems.trim()) flag("inventory", "otherItems", inv.otherItems);

	// Playbook: his characters embed a playbook item + carry system.playbookSlug; the fork
	// references the playbook by slug and loads it from the compendium (no embedded item).
	if (sys.playbookSlug) u["system.playbook.slug"] = sys.playbookSlug;

	return u;
}

const _has = obj => obj && Object.keys(obj).length > 0;

// His free-text choice keys can carry a `-input` (entry-row) or `-fill` (pick-input) suffix; the
// fork keys lore text plainly by option slug, so strip a trailing one. Assumes no real lore option
// slug literally ends in `-input`/`-fill` (holds for shipped content); a track-count entry and its
// `-input` text deliberately collapse to the same base key, to be reconciled together by the remap.
const _stripTextSuffix = (opt) => String(opt).replace(/-(input|fill)$/, "");

/**
 * His actor-level playbook lore store `system.lore.values` → the fork's playbook-lore
 * flags `flags.<scope>.lore.counts` + `lore.texts` (flat `group:option` keys, same shape as
 * arcana/postDeathLore). His value is `{ group: { option: scalar } }` (number=count / string=text),
 * routed by type — numeric marks → counts (0 is a deselected sibling, dropped), free text → texts
 * (blanks dropped, `-input`/`-fill` suffix stripped to the fork's plain key).
 *
 * SCOPE: owns the actor-level `system.lore.values` blob ONLY. On a CURRENT-form Taylor export his
 * live playbook lore has moved onto the embedded PLAYBOOK ITEM's `system.choiceValues` (his §M folds
 * this actor-level field into it); that unified choices store — which blends lore with instinct/appearance/
 * other groups — is the choices-fan-out pass's domain (it must route lore-type groups here). So a
 * current character can have an empty `system.lore.values`, and that's expected, not a miss.
 *
 * REMAP DEFERRED: his lore group/option slugs are bespoke and diverge from the fork's independently
 * authored content (e.g. fixture `the-makers` isn't a fork the-blessed group). Keys are copied
 * verbatim — lossless + inert (the fork ignores option slugs it lacks at render) — until a dedicated
 * per-playbook slug-crosswalk pass (shared with the post-death insert lore remap) translates them.
 */
export function buildLoreMigration(rawSystem, scope) {
	const vals = rawSystem?.lore?.values ?? {};
	const pb = rawSystem?.playbookSlug; // for the slug crosswalk (group/option renames)
	const counts = {}, texts = {};
	for (const [group, opts] of Object.entries(vals)) {
		if (!_isNonEmptyObject(opts)) continue;
		for (const [opt, v] of Object.entries(opts)) {
			if (typeof v === "number") {
				if (v > 0) counts[translateLoreKey(pb, `${group}:${opt}`)] = v;
			} else if (typeof v === "string") {
				if (v.trim()) texts[translateLoreKey(pb, `${group}:${_stripTextSuffix(opt)}`)] = v;
			}
		}
	}
	const u = {};
	if (_has(counts)) u[`flags.${scope}.lore.counts`] = counts;
	if (_has(texts)) u[`flags.${scope}.lore.texts`] = texts;
	return u;
}

/**
 * His CURRENT-form playbook lore — the embedded playbook ITEM's `choiceValues` lore groups — → the
 * fork's `flags.<scope>.lore.counts`/`.texts`. This is the MAIN lore path for a current export (his §M
 * folds the actor-level `system.lore.values` onto the item, leaving it empty). Routes only the
 * groups the crosswalk marks as LORE for the playbook (instinct/appearance are reserved; builder +
 * background groups have their own passes), translating each `group:option` key through the crosswalk
 * (e.g. the-blessed splits his merged `the-earth-mother` offerings into the fork's `danu-offerings`).
 * Numeric marks → counts (drop 0), free text → texts (strip his -input/-fill suffix). A playbook with
 * no crosswalk lore-group mapping contributes nothing (pending its per-playbook crosswalk entry).
 */
export function buildPlaybookLoreMigration(items, scope) {
	const pb = _playbookSource(items);
	const cv = pb.choiceValues;
	const slug = pb.slug;
	if (!_isNonEmptyObject(cv) || !slug) return {};
	const counts = {}, texts = {};
	for (const group of playbookLoreGroups(slug)) {
		const opts = cv[group];
		if (!_isNonEmptyObject(opts)) continue;
		for (const [opt, v] of Object.entries(opts)) {
			if (typeof v === "number") {
				if (v > 0) counts[translateLoreKey(slug, `${group}:${opt}`)] = v;
			} else if (typeof v === "string") {
				if (v.trim()) texts[translateLoreKey(slug, `${group}:${_stripTextSuffix(opt)}`)] = v;
			}
		}
	}
	const u = {};
	if (_has(counts)) u[`flags.${scope}.lore.counts`] = counts;
	if (_has(texts)) u[`flags.${scope}.lore.texts`] = texts;
	return u;
}

/**
 * His actor-level inventory RESOURCE counts (`system.resources.counts.inventory`, a flat {slug:count}
 * of per-item current track values — ammo/consumables, and the arcana back-resources he folds into the
 * inventory namespace keyed by arcanum item slug) → the fork's `flags.<scope>.inventory.resources` (the
 * same flat {slug:count} store; CharacterInventory.setResource). Item/arcana slugs align with the
 * already-mapped inventory/arcana spaces, so counts copy verbatim. A SEPARATE store from possessions.uses
 * (buildPossessionsMigration) — no double-handling. Counts are kept verbatim including 0 (a deliberately
 * emptied track, per his model). Reads `_source.system` (the fork strips system.resources from `.system`).
 *
 * SCOPE: the inventory namespace ONLY. His `resources.counts.backgrounds` (→ fork background.setupResources)
 * and `moveResources.counts` (→ fork moves.backgroundChoices) are DEFERRED: the background-setup resource
 * keys are bespoke per-background, and his move counts are slug-keyed 2-level while the fork keys by move
 * NAME — both need the per-playbook crosswalk + a target-shape decision, so copying them now would misfile.
 */
export function buildResourcesMigration(rawSystem, scope) {
	const inv = rawSystem?.resources?.counts?.inventory;
	if (!_isNonEmptyObject(inv)) return {};
	const out = {};
	for (const [slug, count] of Object.entries(inv)) {
		if (Number.isFinite(count)) out[slug] = count;
	}
	return _has(out) ? { [`flags.${scope}.inventory.resources`]: out } : {};
}

// His playbook DEFS + the character's current-form selections live on the embedded playbook ITEM's
// RAW source — the fork's PlaybookModel schema drops these fields from the cleaned `.system`, so read
// `_source.system` (falls back to `.system` for plain test fixtures).
const _playbookSource = (items) => {
	const pb = (items ?? []).find(i => i.type === "playbook");
	return pb?._source?.system ?? pb?.system ?? {};
};

/**
 * His CURRENT-form instinct selection (embedded playbook ITEM's `choiceValues.instinct`) → the fork's
 * `flags.<scope>.instinct.selected`, a single resolved string. His selection is a `{slug:1}` pick (or
 * free-text under `__custom`); the fork stores `composeInstinct(word, description)` ("Word — Description",
 * em-dash) and a custom instinct verbatim. Resolved from his OWN embedded def (`instinct.list[0].options`,
 * slug→{text,description}), which is SRD-canonical and byte-identical to the fork's, so a preset
 * re-hydrates as selected. `__custom` is passed through verbatim (NOT via composeInstinct, whose
 * oneWord() would truncate multi-word free text).
 *
 * Crosswalk-INDEPENDENT (instinct is a universal reserved group; option text matches the fork).
 * Complements buildCharacterScalarMigration (which maps the actor-level `system.instinct.custom`);
 * placed AFTER it in the parts list so a current-form selection wins via last-write merge.
 */
export function buildInstinctMigration(items, scope) {
	const pb = _playbookSource(items);
	const cv = pb.choiceValues?.instinct;
	if (!_isNonEmptyObject(cv)) return {};
	// Free-text custom wins (his InstinctController clears presets when custom is set).
	const custom = typeof cv.__custom === "string" ? cv.__custom.trim() : "";
	if (custom) return { [`flags.${scope}.instinct.selected`]: custom };
	const options = pb.instinct?.list?.[0]?.options ?? [];
	for (const [slug, val] of Object.entries(cv)) {
		if (slug === "__custom" || typeof val !== "number" || val <= 0) continue;
		const opt = options.find(o => o.slug === slug);
		const composed = opt && composeInstinct(opt.text, opt.description);
		if (composed) return { [`flags.${scope}.instinct.selected`]: composed };
	}
	return {};
}

/**
 * His CURRENT-form appearance selections (embedded playbook ITEM's `choiceValues.appearance`, a flat
 * `{slug:1}` map across all lines) → the fork's `flags.<scope>.appearance.selected` = `{ lineIndex:
 * displayText }`. The fork keys appearance by LINE INDEX and stores the option's display TEXT (no
 * slugs). Resolved from his OWN embedded def (`appearance.list` = ordered lines of `{slug,text}`):
 * each line contributes its first selected (count>0) option's index + display text. His def is
 * SRD-canonical (line order + text byte-identical to the fork's), so values re-hydrate as selected.
 *
 * Resolves from his embedded def, so it needs no group/slug crosswalk; his option TEXT is SRD-canonical
 * and byte-matches the fork's for the common case, so values re-hydrate as selected. RARE cosmetic text
 * divergences between the two content sets exist (e.g. the Fox's "like a whippin' stick" vs the fork's
 * apostrophe-less spelling) — those are copied losslessly but won't render selected until the deferred
 * normalization/crosswalk reconciles them (same lossless-inert treatment as the lore option slugs).
 * Reads the playbook item's `_source.system` (these def/choiceValues fields are stripped from `.system`).
 */
export function buildAppearanceMigration(items, scope) {
	const pb = _playbookSource(items);
	const cv = pb.choiceValues?.appearance;
	const lines = pb.appearance?.list ?? [];
	if (!_isNonEmptyObject(cv) || !lines.length) return {};
	const selected = {};
	lines.forEach((line, idx) => {
		for (const opt of line.options ?? []) {
			if ((cv[opt.slug] ?? 0) > 0) { selected[idx] = opt.text; break; } // pickCount 1 → first hit per line
		}
	});
	return _has(selected) ? { [`flags.${scope}.appearance.selected`]: selected } : {};
}

/**
 * His embedded `arcanum` items → fork `flags.<scope>.arcana.*` (inverts his §F).
 * owned/flipped are slug arrays; major is a single slug; unlock/backOptions are flat
 * `${slug}:${optionSlug}` count maps (his nested `unlockValues[slug]`/`backChoiceValues[slug]`
 * flatten to that — the fork's evolved shape, see CharacterArcana.setUnlockCount/setBackOptionCount).
 * @param {Array} items  actor.items (his embedded docs)
 */
export function buildArcanaMigration(items, scope) {
	const arcana = (items ?? []).filter(i => i.type === "arcanum");
	if (!arcana.length) return {};
	const owned = [], flipped = [];
	const unlock = {}, backOptions = {};
	let major = null;
	for (const it of arcana) {
		const s = it.system ?? {};
		const slug = s.slug;
		if (!slug) continue;
		owned.push(slug);
		if (s.flipped) flipped.push(slug);
		if (s.major) major = slug;
		for (const [opt, count] of Object.entries(s.unlockValues?.[slug] ?? {})) unlock[`${slug}:${opt}`] = count;
		for (const [opt, count] of Object.entries(s.backChoiceValues?.[slug] ?? {})) backOptions[`${slug}:${opt}`] = count;
	}
	const u = {};
	if (owned.length) u[`flags.${scope}.arcana.owned`] = owned;
	if (flipped.length) u[`flags.${scope}.arcana.flipped`] = flipped;
	if (major) u[`flags.${scope}.arcana.major`] = major;
	if (_has(unlock)) u[`flags.${scope}.arcana.unlock`] = unlock;
	if (_has(backOptions)) u[`flags.${scope}.arcana.backOptions`] = backOptions;
	return u;
}

/**
 * His embedded `possession` items → fork `flags.<scope>.possessions.*` (inverts his §D).
 * selected = slugs of selected possessions; uses = {slug:count}; choiceUses re-prefixes his
 * per-item `{choiceSlug:count}` back to the fork's flat `${slug}:${choiceSlug}` key.
 * NOTE: his `pickValues` ↔ the fork's `subChoices` is a separate reconciliation (different
 * concepts) — left for the dedicated possessions pass, not guessed here.
 */
export function buildPossessionsMigration(items, scope) {
	const poss = (items ?? []).filter(i => i.type === "possession");
	if (!poss.length) return {};
	const selected = [], uses = {}, choiceUses = {};
	for (const it of poss) {
		const s = it.system ?? {};
		const slug = s.slug;
		if (!slug) continue;
		if (s.selected) selected.push(slug);
		if (Number.isFinite(s.uses) && s.uses > 0) uses[slug] = s.uses;
		for (const [choiceSlug, count] of Object.entries(s.choiceUses ?? {})) choiceUses[`${slug}:${choiceSlug}`] = count;
	}
	const u = {};
	if (selected.length) u[`flags.${scope}.possessions.selected`] = selected;
	if (_has(uses)) u[`flags.${scope}.possessions.uses`] = uses;
	if (_has(choiceUses)) u[`flags.${scope}.possessions.choiceUses`] = choiceUses;
	return u;
}

/**
 * His embedded `outfitItem` docs → fork `flags.<scope>.inventory.checked` (the character holds
 * these items). Inverts his §I-adjacent outfit handling: the fork records held inventory items
 * as a {slug:true} map keyed by the shared outfit-item slug.
 */
export function buildOutfitMigration(items, scope) {
	const outfit = (items ?? []).filter(i => i.type === "outfitItem");
	if (!outfit.length) return {};
	const checked = {};
	for (const it of outfit) {
		const slug = it.system?.slug;
		if (slug) checked[slug] = true;
	}
	return _has(checked) ? { [`flags.${scope}.inventory.checked`]: checked } : {};
}

// Flatten one of his Selection-raw fields ({selected,options,multi,allowCustom}) to the value(s)
// the fork stores. Tolerates a legacy free string ("a, b, c") that hasn't been normalized yet.
const _selValues = (raw) => {
	if (Array.isArray(raw)) return raw;
	if (typeof raw === "string") return raw.split(",").map(s => s.trim()).filter(Boolean);
	if (raw && typeof raw === "object" && Array.isArray(raw.selected)) return [...raw.selected];
	return [];
};
const _selText = (raw) => {
	if (typeof raw === "string") return raw.trim();
	return String(_selValues(raw)[0] ?? "").trim();
};

/**
 * His embedded `npc` follower items → fork `flags.<scope>.customFollowers.<id>` (inverts his §G).
 * The fork's universal follower representation is a self-contained "custom follower" card (see
 * follower-build.buildCustomFollower / _FOLLOWER_FLAGS["custom"]); reusing that builder keeps the
 * stored shape identical to what the sheet writes. Keyed by his follower slug so the mapping is
 * stable + idempotent; `order` (sequential) preserves the embedded item order on the Followers tab.
 *
 * His tagList/instinct/cost are Selection-raw objects, so they're flattened to the array/string the
 * fork stores; armor prose ("2 (shield)") is parsed to an int by buildCustomFollower. Only OWNED
 * followers migrate (his §G guard keys on `system.owned`); a non-owned `npc` item is a stat-block
 * reference, not a recruited follower.
 *
 * DEFERRED — no clean 1:1, each its own reconciliation pass (not guessed here): GROUP `members`
 * (the fork has no member roster on a custom card), follower `inventory` gear (his {slug:true}
 * checked map vs the fork's free-text gear labels), and the Ranger `companion` (the fork models the
 * animal companion as its own follower TYPE, not a custom card). The card's core stats still migrate.
 */
export function buildFollowersMigration(items, scope) {
	const followers = (items ?? []).filter(i => i.type === "npc" && i.system?.owned);
	if (!followers.length) return {};
	const map = {};
	let order = 0;
	for (const it of followers) {
		const s = it.system ?? {};
		const id = s.slug || `follower-${order}`;
		map[id] = {
			...buildCustomFollower({
				name:      it.name ?? "",
				tags:      _selValues(s.tagList),
				hp:        s.hp?.max ?? s.hp?.value ?? 0,
				hpCurrent: s.hp?.value,
				armor:     s.armor,
				damage:    s.damage,
				instinct:  _selText(s.instinct),
				cost:      _selText(s.cost),
				moves:     s.moves,
				notes:     s.notes,
				loyalty:   s.loyalty?.value,
			}),
			order: order++,
		};
	}
	return { [`flags.${scope}.customFollowers`]: map };
}

// His built-in post-death insert slugs (Ghost/Revenant/Thrall) — identical on both sides. A
// character has at most one active post-death insert (the fork stores a single slug); if multiple
// somehow coexist, the pointer AND its fanned lore both take the last one (kept consistent — the
// lore comes from the winning insert only). Custom inserts (`custom-insert-<hex>`) have no fork eq.
const _POST_DEATH_INSERT_SLUGS = new Set(["ghost", "revenant", "thrall"]);
// His invocation selections live in this choiceValues GROUP on the invocations insert (the fork
// has no invocations insert — it stores selected invocation OPTION slugs on a playbook-level flag).
// The 10 option slugs are identical across both systems, so the selected set transfers directly.
const _INVOCATIONS_GROUP = "lightbearer-invocations";

/**
 * His embedded `insert` items → the fork's insert stores (inverts his §H/§K/§L). He models
 * post-death inserts AND the invocations insert as ONE `insert` item type, told apart by slug;
 * his per-character selections live in `item.system.choiceValues` ({ group: { option: scalar } },
 * number=count / string=text — NOT a {selected:[]} wrapper). The fork splits this across stores:
 *   • post-death pointer → `flags.<scope>.postDeathInsert.slug` (ghost/revenant/thrall)
 *   • post-death lore marks → `flags.<scope>.postDeathLore.counts` (flat `group:option` keys, same
 *     shape as arcana/lore), from the winning post-death insert only. Copied VERBATIM by design —
 *     this losslessly preserves the player's raw marks rather than dropping unmappable ones. Only
 *     `terrible-purpose`'s option slugs align across the two content sets; the other groups
 *     (`consequences`, and on revenant/thrall `impulse`/`marks`/`your-master`) have diverged option
 *     slugs, so those keys ride along inertly (the fork ignores option slugs it lacks at render)
 *     until a dedicated content-reconciliation/remap pass — bundled with the lore split — maps them.
 *   • invocations → `flags.<scope>.invocations.selected` (array of option slugs with count>0).
 *
 * Reads ONLY `item.system.choiceValues` (per-item) — the still-pending choices-fan-out / lore-split
 * passes own the actor-level `system.choices`/`system.lore` blobs, so there's no double-handling.
 *
 * DEFERRED, each its own pass (the pointer + lore/invocations still migrate): the post-death
 * INSTINCT (his `instinct` group {slug:1}/`__custom` → the fork's composed "word: description"
 * string; needs the fork's exact composeInstinct + verified cross-content text equality, else it
 * silently won't re-hydrate), free-TEXT lore (his `${slug}-input`/`-fill` keys vs the fork's plain
 * `group:option` keys), the granted post-death MOVE items (a runtime side-effect — the apply step
 * must call StonetopCharacter.setPostDeathInsert, which a pure flag builder can't do), and CUSTOM
 * inserts (`custom-insert-*`, no fork target).
 */
export function buildInsertMigration(items, scope) {
	const inserts = (items ?? []).filter(i => i.type === "insert");
	if (!inserts.length) return {};
	let postDeathSlug = null;
	let postDeathCv = null; // choiceValues of the winning post-death insert (last wins)
	const invocations = new Set();
	for (const it of inserts) {
		const s = it.system ?? {};
		const cv = s.choiceValues ?? {};
		// Invocations insert: pull the selected (count>0) option slugs from its group.
		for (const [opt, val] of Object.entries(cv[_INVOCATIONS_GROUP] ?? {})) {
			if (typeof val === "number" && val > 0) invocations.add(opt);
		}
		// Post-death insert: remember the pointer + its choiceValues (lore fanned below, from the
		// winning insert only, so the pointer and its marks stay consistent if several coexist).
		if (_POST_DEATH_INSERT_SLUGS.has(s.slug)) { postDeathSlug = s.slug; postDeathCv = cv; }
	}
	// Fan the winning post-death insert's lore-mark counts (skip the special instinct + invocations
	// groups; instinct + free-text are deferred — counts only).
	const loreCounts = {};
	for (const [group, opts] of Object.entries(postDeathCv ?? {})) {
		if (group === "instinct" || group === _INVOCATIONS_GROUP) continue;
		if (!_isNonEmptyObject(opts)) continue;
		for (const [opt, val] of Object.entries(opts)) {
			if (typeof val === "number" && val > 0) loreCounts[translateInsertLoreKey(postDeathSlug, `${group}:${opt}`)] = val;
		}
	}
	const u = {};
	if (postDeathSlug) u[`flags.${scope}.postDeathInsert.slug`] = postDeathSlug;
	if (_has(loreCounts)) u[`flags.${scope}.postDeathLore.counts`] = loreCounts;
	if (invocations.size) u[`flags.${scope}.invocations.selected`] = [...invocations];
	return u;
}

/**
 * Combine the COMPLETE Path B character mappers into one `actor.update()` payload. Reads his
 * raw data from `actor._source.system` + `actor.items`. Deep-merges per-namespace so the
 * inventory.checked from outfit items merges with any checked from scalars.
 *
 * WIRED + e2e-validated: this runs via MigrationRunner.runPathB (rename-gated, per-actor
 * `pathBMigrated` marker = PATH_B_VERSION, so it re-migrates when the mapping improves). Covered:
 * scalars, actor-level + current-form lore (with the crosswalk.js slug table), resources (inventory),
 * instinct, appearance, arcana, possessions, outfit, followers, inserts.
 *
 * STILL INCOMPLETE (will bump PATH_B_VERSION when they land): the rest of the choices fan-out —
 * builders → possessions + background nested choices; the background/move resource counts (see
 * buildResourcesMigration); the documented sub-reconciliations (possession sub-choices; follower
 * group members / gear / companion; insert instinct / free-text); and EXTENDING the per-playbook
 * slug crosswalk beyond the-blessed (the other playbooks' lore-group splits — crosswalk.js). These
 * are lossless/inert today (unmapped keys ride along verbatim), so the partial wiring strands
 * nothing; it just doesn't yet hydrate those few divergent selections.
 */
export function buildCharacterMigration(actor, scope) {
	const rawSystem = actor?._source?.system ?? {};
	const items = [...(actor?.items ?? [])];
	const parts = [
		buildCharacterScalarMigration(rawSystem, scope),
		buildLoreMigration(rawSystem, scope),          // actor-level lore
		buildPlaybookLoreMigration(items, scope),      // current-form lore (playbook item choiceValues)
		buildResourcesMigration(rawSystem, scope),
		buildInstinctMigration(items, scope),
		buildAppearanceMigration(items, scope),
		buildArcanaMigration(items, scope),
		buildPossessionsMigration(items, scope),
		buildOutfitMigration(items, scope),
		buildFollowersMigration(items, scope),
		buildInsertMigration(items, scope),
	];
	const out = {};
	for (const part of parts) {
		for (const [key, val] of Object.entries(part)) {
			// Merge when two mappers target the same flag object (e.g. inventory.checked).
			if (out[key] && val && typeof val === "object" && !Array.isArray(val) &&
				typeof out[key] === "object" && !Array.isArray(out[key])) {
				out[key] = { ...out[key], ...val };
			} else {
				out[key] = val;
			}
		}
	}

	// Asset paths — his characters point actor.img + the prototype token at his bundled playbook
	// portrait, which doesn't exist in the fork; remap to the fork's vendored classic art so the
	// migrated sheet portrait + scene token don't 404. Only his playbook-portrait paths are touched.
	const portrait = remapTaylorPortrait(actor?.img, scope);
	if (portrait) out.img = portrait;
	const tokenImg = remapTaylorPortrait(actor?.prototypeToken?.texture?.src, scope);
	if (tokenImg) out["prototypeToken.texture.src"] = tokenImg;

	return out;
}
