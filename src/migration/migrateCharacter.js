import { CharacterMoves } from "../actors/character/CharacterMoves.js";
import { info } from "../utils/logger.js";
import { toSlug } from "../utils/slug.js";
import { CharacterPossessions } from "../actors/character/CharacterPossessions.js";
import { CharacterArcana } from "../actors/character/CharacterArcana.js";
import { CharacterFollowers } from "../actors/character/CharacterFollowers.js";
import { ActorOutfitItems } from "../actors/character/ActorOutfitItems.js";
import { ResourceController } from "../actors/character/ResourceController.js";
import { migrateChoiceRow } from "./migrateChoices.js";
import { Selection } from "../model/data/Selection.js";

const SCOPE = "stonetop";

const VALID_ITEM_TYPES = new Set([
	// "npc" kept alongside "follower" so pre-rename follower items survive migrateStaleItemTypes long
	// enough for migrateFollowerItemType to convert them.
	"move", "playbook", "possession", "arcanum", "follower", "npc", "insert", "outfitItem", "equipment",
]);

// ── Public exports ────────────────────────────────────────────────────────────

export async function migrateStaleItemTypes(actor) {
	const stale = [...actor.items].filter(i => !VALID_ITEM_TYPES.has(i.type));
	if (stale.length) await actor.deleteEmbeddedDocuments("Item", stale.map(i => i._id));
}

// The follower Item type was renamed `npc` → `follower`. Foundry can't change a document's `type` in
// place, so recreate each legacy `npc` item as `follower` (preserving name/img/flags/system) and
// delete the original. Followers match by slug (not _id) and loyalty is slug-keyed in flags, so the
// new _ids are harmless. Same create-then-delete pattern as migrateWorldItems (equipment → arcanum).
export async function migrateFollowerItemType(actor) {
	const legacy = [...actor.items].filter(i => i.type === "npc");
	if (!legacy.length) return;
	const created = legacy.map(i => {
		const o = i.toObject?.() ?? i;
		return { name: o.name, img: o.img ?? null, type: "follower", system: o.system ?? {}, flags: o.flags ?? {} };
	});
	await actor.createEmbeddedDocuments("Item", created);
	await actor.deleteEmbeddedDocuments("Item", legacy.map(i => i._id));
}

function _logArcanumFlipped(actor, label) {
	const arcanums = [...actor.items].filter(i => i.type === "arcanum");
	for (const a of arcanums) info(`  [${label}] ${a.system?.slug}: flipped=${a.system?.flipped}`);
}

export async function migrateCharacter(actor, repos, insertRepo = null) {
	await migrateStaleItemTypes(actor);
	await migrateFollowerItemType(actor);
	await migrateCharacterFlags(actor);
	await migrateEmbeddedMoveSlugs(actor);
	await migrateCharacterMoves(actor, repos.moves, insertRepo);
	await migratePlaybookSpecialPossessions(actor);
	await migratePlaybookChoices(actor, repos.playbooks);
	await migratePlaybookIntroductions(actor, repos.playbooks);

	const outfitItems         = new ActorOutfitItems(actor);
	const resourceController  = new ResourceController(actor);

	await migrateArcana(actor, repos.arcana, repos.followers);
	_logArcanumFlipped(actor, "after migrateArcana");
	await migrateArcanumPackData(actor, repos.arcana);
	_logArcanumFlipped(actor, "after migrateArcanumPackData");
	await migrateArcanaMoves(actor, repos.arcana, repos.moves);
	_logArcanumFlipped(actor, "after migrateArcanaMoves");
	await migrateArcanumChoiceGroupSlugs(actor);
	await migrateFollowers(actor, repos.followers, resourceController);
	_logArcanumFlipped(actor, "after migrateFollowers");
	await migrateArcanaFollowerPackData(actor, repos.followers);

	const moves = new CharacterMoves(repos.moves, actor, null);
	await migratePossessions(actor, repos.possessions, moves, outfitItems);
	_logArcanumFlipped(actor, "after migratePossessions");

	if (insertRepo) await migrateInsert(actor, insertRepo, moves);
	await migrateInsertMoveCategories(actor);
	await migrateInsertChoiceValues(actor);
	await migrateEmbeddedEquipment(actor);
	_logArcanumFlipped(actor, "after migrateEmbeddedEquipment");
	await migrateChoiceValues(actor);
	await migratePlaybookChoiceValues(actor);
	_logArcanumFlipped(actor, "after migratePlaybookChoiceValues");
}

// ── A. Flag → system scalar copies ───────────────────────────────────────────

export async function migrateCharacterFlags(actor) {
	if (actor.getFlag(SCOPE, "vitals.maxHP") == null) return;

	const f = key => actor.getFlag(SCOPE, key);

	await actor.update({
		"system.attributes.hp.max":          Math.max(f("vitals.maxHP") ?? 0, actor.system?.attributes?.hp?.max ?? 0),
		"system.playbookSlug":               f("playbook.slug")             ?? "",
		"system.background.selected":        f("background.selected")       ?? "",
		"system.instinct.custom":            f("instinct.custom")           ?? "",
		"system.origin.selected":            f("origin.selected")           ?? "",
		"system.lore.values":                f("lore.values")               ?? {},
		"system.choices.values":             f("choices.values")            ?? {},
		"system.choices.groupDefs":          migrateGroupDefs(f("choices.groupDefs")),
		"system.resources.counts":           f("resources.counts")          ?? {},
		"system.moveResources.counts":       f("move-resources.counts")     ?? {},
		"system.inventory.checked":          f("inventory.checked")         ?? {},
		"system.inventory.loadLevel":        f("inventory.loadLevel")       ?? null,
		"system.inventory.regularPool":      f("inventory.regularPool")     ?? 0,
		"system.inventory.smallPool":        f("inventory.smallPool")       ?? 0,
		"system.inventory.otherItems":       f("inventory.otherItems")      ?? "",
	});
}

// ── E. groupDefs row type fixup (pure; called within A) ───────────────────────

export function migrateGroupDefs(defs) {
	if (!defs) return {};
	for (const def of Object.values(defs)) {
		for (const row of def.list ?? []) migrateChoiceRow(row);
	}
	return defs;
}

// ── B0. Stamp stable slugs onto embedded move items that lack one ───────────────

export async function migrateEmbeddedMoveSlugs(actor) {
	const updates = [...actor.items]
		.filter(i => i.type === "move" && !i.system?.slug)
		.map(i => ({ _id: i._id, system: { slug: toSlug(i.name) } }));
	if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

// ── B. Embedded move items ────────────────────────────────────────────────────

export async function migrateCharacterMoves(actor, moveRepo, insertRepo = null) {
	const existing = [...actor.items].filter(i => i.type === "move");
	if (existing.some(i => i.system?.categoryKey != null)) return;

	const categories = actor.getFlag(SCOPE, "moves.categories") ?? [];

	// Update "other" moves in place (deduplicate + add new fields)
	const otherCat = categories.find(c => c.key === "other");
	for (const flagMove of otherCat?.moves ?? []) {
		const ownedIds = flagMove.ownedIds ?? [];
		if (!ownedIds.length) continue;
		const [keepId, ...extraIds] = ownedIds;
		if (extraIds.length) await actor.deleteEmbeddedDocuments("Item", extraIds);
		await actor.updateEmbeddedDocuments("Item", [{
			_id: keepId,
			system: {
				categoryKey:   "other",
				acquired:      true,
				instanceCount: flagMove.selection?.value ?? 1,
				compendiumId:  flagMove.compendiumId ?? null,
				categoryLabel: null,
				categoryNote:  null,
			},
		}]);
	}

	// Delete old basic, playbook, and post-death items (to be re-created)
	const idsToDelete = categories
		.filter(c => c.key !== "other")
		.flatMap(c => (c.moves ?? []).flatMap(m => m.ownedIds ?? []));
	if (idsToDelete.length) await actor.deleteEmbeddedDocuments("Item", idsToDelete);

	// Re-create via domain methods
	const moves = new CharacterMoves(moveRepo, actor, null, null);
	await moves.initBasicMoves();

	const playbookItem = [...actor.items].find(i => i.type === "playbook");
	if (playbookItem?.system?.slug) {
		await moves.initPlaybookCategory({ ...playbookItem.system, name: playbookItem.name });
		await _migratePlaybookMoveAcquired(actor, categories, playbookItem.system.slug);
	}

	for (const cat of categories.filter(c => c.key.startsWith("post-death-"))) {
		const insertSlug = cat.key.replace("post-death-", "");
		const insertDoc  = insertRepo ? await insertRepo.findBySlug(insertSlug) : null;
		await moves.addCategory(`insert-${insertSlug}`, cat.label ?? insertSlug, insertDoc?.system?.moves ?? [], insertDoc?.system?.startingMoves ?? []);
	}
}

async function _migratePlaybookMoveAcquired(actor, categories, playbookSlug) {
	const catKey = `playbook-${playbookSlug}`;
	const flagCat = categories.find(c => c.key === catKey);
	if (!flagCat) return;
	const acquired = flagCat.moves.filter(m => !m.isStarting && m.selection?.value > 0 && m.compendiumId);
	if (!acquired.length) return;
	const updates = acquired.flatMap(flagMove => {
		const item = [...actor.items].find(
			i => i.type === "move" && i.system?.categoryKey === catKey && i.system?.compendiumId === flagMove.compendiumId,
		);
		if (!item) return [];
		return [{ _id: item._id, system: { acquired: true, instanceCount: flagMove.selection.value } }];
	});
	if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

// ── C. Playbook item specialPossessions format ────────────────────────────────

export async function migratePlaybookSpecialPossessions(actor) {
	const pbItem = [...actor.items].find(i => i.type === "playbook");
	if (!pbItem) return;
	const sp = pbItem.system?.specialPossessions;
	if (!sp || sp.slugs) return;  // already new format
	if (!sp.options) return;

	const slugs = (sp.options ?? []).map(o => o.slug).filter(Boolean);
	await actor.updateEmbeddedDocuments("Item", [{
		_id: pbItem._id,
		system: {
			specialPossessions: {
				slugs,
				pickCount:   sp.pickCount   ?? 0,
				pickNote:    sp.pickNote    ?? "",
				preselected: sp.preselected ?? [],
			},
		},
	}]);
}

// ── D. Possession items ───────────────────────────────────────────────────────

export async function migratePossessions(actor, possessionRepo, moves, outfitItems) {
	if ([...actor.items].some(i => i.type === "possession")) return;

	const pbItem = [...actor.items].find(i => i.type === "playbook");
	if (!pbItem) return;
	const sp = pbItem.system?.specialPossessions;
	if (!sp) return;

	const playbookSlug = pbItem.system?.slug ?? null;
	if (!playbookSlug) return;

	// Build the sp object in new format (slugs array) for addPossessionsFromPlaybook
	const options   = sp.options ?? [];
	const slugs     = sp.slugs ?? options.map(o => o.slug).filter(Boolean);
	const spNew = {
		slugs,
		pickCount:   sp.pickCount   ?? 0,
		pickNote:    sp.pickNote    ?? "",
		preselected: sp.preselected ?? [],
	};

	const possessions = new CharacterPossessions(actor, moves, outfitItems, possessionRepo);
	await possessions.addPossessionsFromPlaybook(spNew, playbookSlug);

	// Apply mutable state from flags
	const selectedSlugs = new Set(actor.getFlag(SCOPE, "possessions.selected") ?? []);
	const usesMap       = actor.getFlag(SCOPE, "possessions.uses")       ?? {};
	const pickValuesMap = actor.getFlag(SCOPE, "possessions.pickValues") ?? {};
	const choiceUsesMap = actor.getFlag(SCOPE, "possessions.choiceUses") ?? {};

	const updates = [...actor.items]
		.filter(i => i.type === "possession")
		.map(item => {
			const slug = item.system?.slug;
			return {
				_id:    item._id,
				system: {
					selected:    selectedSlugs.has(slug),
					uses:        usesMap[slug]       ?? 0,
					pickValues:  pickValuesMap[slug]  ?? {},
					choiceUses:  _extractChoiceUses(choiceUsesMap, slug),
				},
			};
		});
	if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

function _extractChoiceUses(choiceUsesMap, possessionSlug) {
	const prefix = `${possessionSlug}:`;
	const result = {};
	for (const [key, value] of Object.entries(choiceUsesMap)) {
		if (key.startsWith(prefix)) result[key.slice(prefix.length)] = value;
	}
	return result;
}

// ── F. Arcana items ───────────────────────────────────────────────────────────

export async function migrateArcana(actor, arcanaRepo, followerRepo) {
	if ([...actor.items].some(i => i.type === "arcanum")) return;

	const ownedSlugs  = actor.getFlag(SCOPE, "arcana.owned")       ?? [];
	const flippedList = actor.getFlag(SCOPE, "arcana.flipped")      ?? [];
	const unlockMap   = actor.getFlag(SCOPE, "arcana.unlock")       ?? {};
	const backMap     = actor.getFlag(SCOPE, "arcana.backChoices")  ?? {};
	const flippedSet  = new Set(flippedList);

	const resourceController = new ResourceController(actor);
	const followers = new CharacterFollowers(actor, followerRepo, resourceController);
	const arcana = new CharacterArcana(actor, arcanaRepo, null, null, followers);

	for (const slug of ownedSlugs) {
		await arcana.addArcanum(slug);
		const item = [...actor.items].find(i => i.type === "arcanum" && i.system?.slug === slug);
		info(`migrateArcana [${slug}]: item found=${!!item} id=${item?._id} currentFlipped=${item?.system?.flipped}`);
		if (!item) continue;
		// Unlock + back-choice groups are both namespaced by the arcanum slug, so they share the arcanum
		// slug as their key in the single `choiceValues` store.
		const update = {
			_id: item._id,
			system: {
				flipped:      flippedSet.has(slug),
				choiceValues: { [slug]: { ...(unlockMap[slug] ?? {}), ...(backMap[slug] ?? {}) } },
			},
		};
		info(`migrateArcana [${slug}]: sending update flipped=${update.system.flipped} choiceValues=${JSON.stringify(update.system.choiceValues)}`);
		await actor.updateEmbeddedDocuments("Item", [update]);
		const after = [...actor.items].find(i => i.type === "arcanum" && i.system?.slug === slug);
		info(`migrateArcana [${slug}]: after update flipped=${after?.system?.flipped} choiceValues=${JSON.stringify(after?.system?.choiceValues)}`);
	}
}

// ── F2. Arcana mystery moves → real move items ────────────────────────────────
// Major arcana now own their mystery moves as real `move` items in an `arcana-<slug>` category
// (mystery-moves-as-real-moves). Existing embedded major arcana carry the legacy inline back.moves and
// no category; refresh their `back` from the repo so they gain back.moveSlugs, then register the
// category. addCategory is idempotent (skips if the category already exists), so this is re-run safe.
export async function migrateArcanaMoves(actor, arcanaRepo, moveRepo) {
	const arcana = [...actor.items].filter(i => i.type === "arcanum");
	if (!arcana.length) return;

	const moves = new CharacterMoves(moveRepo, actor, null, null);
	for (const item of arcana) {
		const slug = item.system?.slug;
		if (!slug) continue;

		let back = item.system?.back ?? {};
		if (!(back.moveSlugs?.length)) {
			const raw = await arcanaRepo.findBySlug(slug);
			if (raw?.back?.moveSlugs?.length) {
				back = raw.back;
				await actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { back } }]);
			}
		}

		const moveSlugs = back.moveSlugs ?? [];
		if (moveSlugs.length) await moves.addCategory(`arcana-${slug}`, item.name ?? slug, moveSlugs, []);
	}
}

// Normalize each embedded arcanum's back-choices group slug to the arcanum's own slug. Two
// hand-authored arcana (blackwood-fetishes, mindgem) shipped with `back.choices.slug: "followers"`,
// but the group is namespaced by the arcanum slug everywhere else in the pipeline (write, read,
// side-effect def lookup). The mismatch made the choice-group side effect silently no-op, so ticking
// a follower box never embedded the follower. Idempotent; only touches items that actually differ.
export async function migrateArcanumChoiceGroupSlugs(actor) {
	const updates = [];
	for (const item of actor.items) {
		if (item.type !== "arcanum") continue;
		const slug      = item.system?.slug;
		const back      = item.system?.back;
		const groupSlug = back?.choices?.slug;
		if (!slug || groupSlug == null || groupSlug === slug) continue;
		updates.push({ _id: item._id, system: { back: { ...back, choices: { ...back.choices, slug } } } });
	}
	if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

// ── G. Follower items ─────────────────────────────────────────────────────────

export async function migrateFollowers(actor, followerRepo, resourceController) {
	if ([...actor.items].some(i => i.type === "follower" && i.system?.owned)) return;

	const ownedSlugs = actor.getFlag(SCOPE, "followers.owned") ?? [];
	const state      = actor.getFlag(SCOPE, "followers.state") ?? {};

	const followers = new CharacterFollowers(actor, followerRepo, resourceController);
	const [blank] = await followerRepo.findBySlugs(["blank"]);

	for (const slug of ownedSlugs) {
		if (slug.startsWith("custom-")) {
			const s = state[slug] ?? {};
			await actor.createEmbeddedDocuments("Item", [{
				name: s.name ?? "New Follower", type: "follower",
				system: {
					slug, arcanaSlug: null, tagList: s.tags ?? "",
					hp:     { value: s.hp ?? 0, max: s.hpMax ?? 0 },
					armor:  s.armor != null ? String(s.armor) : "",
					damage: s.damage ?? "",
					instinct: "", loyalty: { value: 0, max: 3 },
					choices: blank?.choices ?? null, specialQuality: "",
					choiceValues: { choices: s.values?.choices ?? {} },
					owned: true,
				},
			}]);
		} else {
			await followers.addFollower(slug);
		}
	}

	// Apply mutable state
	for (const [slug, s] of Object.entries(state)) {
		const item = [...actor.items].find(i => i.type === "follower" && i.system?.slug === slug);
		if (!item) continue;
		const update = { _id: item._id, system: {} };
		if (s.hp != null || s.hpMax != null)
			update.system.hp = { value: s.hp ?? 0, max: s.hpMax ?? 0 };
		if (s.armor != null) update.system.armor = String(s.armor);
		if (s.damage != null) update.system.damage = s.damage;
		if (s.name  != null) update.name = s.name;
		if (s.values?.choices) update.system.choiceValues = { choices: s.values.choices };
		await actor.updateEmbeddedDocuments("Item", [update]);
	}
}

// ── H. Insert item ────────────────────────────────────────────────────────────

export async function migrateInsert(actor, insertRepo, moves) {
	if ([...actor.items].some(i => i.type === "insert")) return;

	const slug = actor.getFlag(SCOPE, "postDeathInsert.slug");
	if (!slug) return;

	const doc = await insertRepo.findBySlug(slug);
	if (!doc) return;

	await actor.createEmbeddedDocuments("Item", [doc.toObject()]);
	await moves.addCategory(`insert-${slug}`, doc.name ?? slug, doc.system?.moves ?? [], doc.system?.startingMoves ?? []);
}

// ── I. Equipment → arcanum ────────────────────────────────────────────────────

export async function migrateEmbeddedEquipment(actor) {
	const equipmentItems = [...actor.items].filter(i => i.type === "equipment");
	for (const item of equipmentItems) {
		const sys = item.system ?? {};
		if (!sys.front && !sys.back) continue;
		await actor.createEmbeddedDocuments("Item", [{
			name:   item.name,
			img:    item.img ?? null,
			type:   "arcanum",
			system: {
				slug:         sys.slug   ?? null,
				major:        sys.major  ?? false,
				front:        sys.front,
				back:         sys.back,
				flipped:      false,
				choiceValues: {},
			},
		}]);
		await actor.deleteEmbeddedDocuments("Item", [item._id]);
	}
}

// ── K. Rename post-death-{slug} move categories → insert-{slug} ──────────────

export async function migrateInsertMoveCategories(actor) {
	const oldItems = [...actor.items].filter(
		i => i.type === "move" && i.system?.categoryKey?.startsWith("post-death-"),
	);
	if (!oldItems.length) return;
	await actor.updateEmbeddedDocuments("Item", oldItems.map(i => ({
		_id:    i._id,
		system: { categoryKey: i.system.categoryKey.replace("post-death-", "insert-") },
	})));
}

// ── L. Move postDeathChoices/postDeathLore values → insert item choiceValues ──

export async function migrateInsertChoiceValues(actor) {
	const insertItem = [...actor.items].find(i => i.type === "insert") ?? null;
	if (!insertItem) return;

	const existingValues = insertItem.system?.choiceValues ?? {};
	if (Object.keys(existingValues).length) return;

	const pdChoices = actor.getFlag(SCOPE, "postDeathChoices.values") ?? {};
	const pdLore    = actor.getFlag(SCOPE, "postDeathLore.values")    ?? {};
	const merged    = { ...pdLore, ...pdChoices };
	if (!Object.keys(merged).length) return;

	await actor.updateEmbeddedDocuments("Item", [{ _id: insertItem._id, system: { choiceValues: merged } }]);
}

// ── J. choice values → per-item ───────────────────────────────────────────────

export async function migrateChoiceValues(actor) {
	const values = actor.system.choices?.values ?? {};
	if (!Object.keys(values).length) return;

	const pbItem    = [...actor.items].find(i => i.type === "playbook") ?? null;
	const moveItems = [...actor.items].filter(i => i.type === "move" && i.system?.choices);

	if (pbItem) {
		const bgSlugs    = new Set((pbItem.system?.backgrounds ?? []).map(b => b.slug));
		const pbSystem   = {};
		const choiceValues = {};
		if (values.instinct)   choiceValues.instinct   = values.instinct;
		if (values.appearance) choiceValues.appearance = values.appearance;
		if (Object.keys(choiceValues).length) pbSystem.choiceValues = choiceValues;
		const bgValues = {};
		for (const [k, v] of Object.entries(values)) {
			if (bgSlugs.has(k)) bgValues[k] = v;
		}
		if (Object.keys(bgValues).length) pbSystem.backgroundValues = bgValues;
		if (Object.keys(pbSystem).length) {
			await actor.updateEmbeddedDocuments("Item", [{ _id: pbItem._id, system: pbSystem }]);
		}
	}

	for (const moveItem of moveItems) {
		const moveSlug = moveItem.system?.slug ?? toSlug(moveItem.name ?? "");
		if (!values[moveSlug]) continue;
		const choicesSlug = moveItem.system.choices.slug;
		await actor.updateEmbeddedDocuments("Item", [{
			_id:    moveItem._id,
			system: { pickValues: { [choicesSlug]: values[moveSlug] } },
		}]);
	}
}

// ── M. Playbook instinct / appearance / lore → choiceValues ───────────────────

export async function migratePlaybookChoiceValues(actor) {
	const pbItem = [...actor.items].find(i => i.type === "playbook") ?? null;
	if (!pbItem) return;

	const existing         = pbItem.system?.choiceValues ?? {};
	const instinctValues   = pbItem.system?.instinctValues   ?? {};
	const appearanceValues = pbItem.system?.appearanceValues ?? {};
	const loreValues       = actor.system?.lore?.values      ?? {};
	const customInstinct   = actor.system?.instinct?.custom  ?? "";

	const toMerge = {};

	if (!existing.instinct) {
		const instinctEntry = { ...instinctValues };
		if (customInstinct) instinctEntry.__custom = customInstinct;
		if (Object.keys(instinctEntry).length) toMerge.instinct = instinctEntry;
	}

	if (!existing.appearance && Object.keys(appearanceValues).length) {
		toMerge.appearance = appearanceValues;
	}

	for (const [slug, groupValues] of Object.entries(loreValues)) {
		if (!existing[slug] && Object.keys(groupValues).length) toMerge[slug] = groupValues;
	}

	if (!Object.keys(toMerge).length) return;

	await actor.updateEmbeddedDocuments("Item", [{
		_id:    pbItem._id,
		system: { choiceValues: { ...existing, ...toMerge } },
	}]);
}

// ── N. Playbook introductions (0.10.0 → 0.10.1) ──────────────────────────────

export async function migratePlaybookIntroductions(actor, playbookRepo) {
	const pbItem = [...actor.items].find(i => i.type === "playbook") ?? null;
	if (!pbItem) return;

	const intro = pbItem.system?.introductions;
	if (intro && !Array.isArray(intro) && intro.step4?.list?.[0]?.input !== undefined) return;

	const slug = pbItem.system?.slug;
	if (!slug) return;

	const compendium = await playbookRepo.findBySlug(slug);
	const newIntro = compendium?.introductions ?? null;
	if (!newIntro) return;

	await actor.updateEmbeddedDocuments("Item", [{ _id: pbItem._id, system: { introductions: newIntro } }]);
}

// ── O. Playbook choices refresh (0.10.0 → 0.10.1) ────────────────────────────

export async function migratePlaybookChoices(actor, playbookRepo) {
	const pbItem = [...actor.items].find(i => i.type === "playbook") ?? null;
	if (!pbItem) return;

	const slug = pbItem.system?.slug;
	if (!slug) return;

	const compendium = await playbookRepo.findBySlug(slug);
	const compendiumChoices = compendium?.choices ?? [];
	if (!compendiumChoices.length) return;

	const currentSlugs = new Set((pbItem.system?.choices ?? []).map(g => g.slug));
	const hasAll = compendiumChoices.every(g => currentSlugs.has(g.slug));
	if (hasAll) return;

	await actor.updateEmbeddedDocuments("Item", [{ _id: pbItem._id, system: { choices: compendiumChoices } }]);
}

// ── M. Refresh arcanum authored content (front/back) from the compendium ──────
// An embedded arcanum is an independent copy — regenerating the pack doesn't reach it. Refresh every
// arcanum's authored `front`/`back` from the repo (matched by slug) so pack fixes reach existing
// characters: cleaned front/back text, the inline @DrawTableInline dice table, and the re-added
// follower `back.choices`. Player state (`flipped` + `choiceValues`: marked circles, picks, follower
// selections) lives outside front/back, so a front/back-only merge update preserves it. Idempotent —
// runs once per world migration (also covers the old case of an item left with an empty front).
export async function migrateArcanumPackData(actor, arcanaRepo) {
	const items = [...actor.items].filter(i => i.type === "arcanum" && i.system?.slug);
	const updates = [];
	for (const item of items) {
		const raw = await arcanaRepo.findBySlug(item.system.slug);
		if (!raw?.front) continue;
		updates.push({ _id: item._id, system: { front: raw.front, back: raw.back } });
	}
	if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

// ── N. Refresh an acquired arcana follower's authored stat block from the pack ─
// An acquired arcana follower is an embedded copy, so regenerating the pack doesn't reach it. Refresh
// each embedded arcana follower's authored fields from the repo (matched by slug): the tag/instinct/
// cost pick-list options, the selectable-move choice group, moves, marker icon, and stats. Player state
// is preserved by omission — loyalty, current HP (hp.value), owned, choiceValues (which moves/picks are
// checked), inventory, members, companion all stay (Foundry merges the partial update). Scoped to arcana
// followers (arcanaSlug set); playbook/custom followers aren't parsed from the book. Idempotent.
export async function migrateArcanaFollowerPackData(actor, followerRepo) {
	const items = [...actor.items].filter(i => i.type === "follower" && i.system?.arcanaSlug && i.system?.slug);
	if (!items.length) return;
	const bySlug = new Map((await followerRepo.findBySlugs(items.map(i => i.system.slug))).map(f => [f.slug, f]));
	const updates = [];
	for (const item of items) {
		const f = bySlug.get(item.system.slug);
		if (!f) continue;
		updates.push({
			_id: item._id,
			...(f.img ? { img: f.img } : {}),
			system: {
				tagList:        Selection.fromStored(f.tags,     { multi: true  }).toRaw(),
				instinct:       Selection.fromStored(f.instinct, { multi: false }).toRaw(),
				cost:           Selection.fromStored(f.cost,     { multi: false }).toRaw(),
				moves:          f.moves ?? "",
				choices:        f.choices ?? [{ slug: "choices", list: [] }],
				armor:          f.armor ?? "",
				damage:         f.damage ?? "",
				specialQuality: f.specialQuality ?? "",
				description:    f.description ?? "",
				hp:             { value: item.system?.hp?.value ?? 0, max: f.hp?.max ?? 0 }, // keep current HP, refresh max
			},
		});
	}
	if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}
