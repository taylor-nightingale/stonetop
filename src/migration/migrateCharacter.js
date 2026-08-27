import { CharacterMoveGrants } from "../actors/character/CharacterMoveGrants.js";
import { GrantedItems } from "../actors/GrantedItems.js";
import { info } from "../utils/logger.js";
import { toSlug } from "../utils/slug.js";
import { CharacterPossessions } from "../actors/character/CharacterPossessions.js";
import { ContainerOutfitSync } from "../actors/character/ContainerOutfitSync.js";
import { CharacterArcana } from "../actors/character/CharacterArcana.js";
import { CharacterFollowers } from "../actors/character/CharacterFollowers.js";
import { ActorOutfitItems } from "../actors/character/ActorOutfitItems.js";
import { ResourceController } from "../actors/character/ResourceController.js";
import { migrateChoiceRow } from "./migrateChoices.js";
import { ChoiceGroupDefs } from "../model/data/ChoiceGroupDefs.js";
import { Selection } from "../model/data/Selection.js";
import { richTextToHtml } from "./richTextToHtml.js";
import { migrateGrantStamps } from "./migrateGrantStamps.js";
import { Tags } from "../model/data/Tags.js";

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

// Flag-era follower state kept its choice values in a map keyed by group name. A group declares its
// own namespace, so re-key the stored map onto whatever group the item actually carries rather than
// naming it here. With no group to map onto, the legacy keys pass through untouched — the values are
// the player's, and dropping them would be worse than leaving them where they already were.
function _namespacedValues(groups, values) {
	if (!values || !Object.keys(values).length) return {};
	const namespace = groups?.[0]?.slug;
	if (!namespace) return { ...values };
	const [legacyKey] = Object.keys(values);
	return { [namespace]: values[legacyKey] };
}

export async function migrateCharacter(actor, repos, insertRepo = null) {
	await migrateStaleItemTypes(actor);
	await migrateFollowerItemType(actor);
	await migrateCharacterFlags(actor);
	await migrateEmbeddedMoveSlugs(actor);
	await migrateCharacterMoves(actor, repos.moves, insertRepo);
	await migrateReferenceMoveCategories(actor, repos.moves);
	await migrateAddedReferenceMoves(actor, repos.moves);
	await migrateMovePackData(actor, repos.moves);
	await migratePlaybookSpecialPossessions(actor);
	await migratePlaybookChoices(actor, repos.playbooks);
	await migratePlaybookIntroductions(actor, repos.playbooks);

	const outfitItems         = new ActorOutfitItems(actor);
	const resourceController  = new ResourceController(actor);
	// Refreshing a container from the pack changes what it grants, so each refresh below recomputes its
	// grant through this. Same registrations as the composition root, and idempotent either way.
	const outfitSync = new ContainerOutfitSync(outfitItems)
		.register("possession", CharacterPossessions.outfitGrantFor)
		.register("arcanum",    CharacterArcana.outfitGrantFor);

	// Before every arcana pass below: they all match on `type === "arcanum"` and a `system.slug`, so an
	// arcanum still stored the legacy way (an `equipment` item, or one that never got a slug) is invisible
	// to all of them — and stays invisible for good, since each pass only runs once per world migration.
	await migrateEmbeddedEquipment(actor);
	await migrateArcanumSlugs(actor);

	await migrateArcana(actor, repos.arcana, repos.followers);
	await migrateArcanumPackData(actor, repos.arcana, outfitSync);
	await migrateArcanaMoves(actor, repos.arcana, repos.moves);
	await migrateArcanumChoiceGroupSlugs(actor);
	await migrateFollowers(actor, repos.followers, resourceController);
	await migrateArcanaFollowerPackData(actor, repos.followers);
	await migrateArcanaOwnedFollowers(actor, repos.followers, resourceController);

	const moves = new CharacterMoveGrants(repos.moves, actor, new GrantedItems(actor));
	await migratePossessions(actor, repos.possessions, moves, outfitItems);
	// Refresh authored fields before stamping the group slug: the refresh replaces `choices` (slug
	// included), so the stamp has to run after it to correct a pack that ever drifts.
	await migratePossessionPackData(actor, repos.possessions, outfitSync);
	await migratePossessionChoiceSlugs(actor);

	if (insertRepo) await migrateInsert(actor, insertRepo, moves);
	await migrateInsertMoveCategories(actor);
	await migrateInsertChoiceValues(actor);
	await migrateChoiceValues(actor);
	await migratePlaybookChoiceValues(actor);
	await migrateCharacterNotes(actor);

	// Last: every pass above may still create items the old way, and the stamp has to describe what
	// the character actually ended up with. Pruning duplicates needs those stamps to recognise them.
	await migrateGrantStamps(actor);
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

// ── B0.5. Reference categories added after the character was made ─────────────

// Reference moves are seeded at creation, so a character made before a category existed never gets
// it (expedition, added in 0.15) — migrateCharacterMoves below bails for anyone already on embedded
// moves. Seeds only categories the character has NOTHING from: a GM who deleted a single reference
// move meant it, and a migration must not hand it back.
export async function migrateReferenceMoveCategories(actor, moveRepo) {
	const moves = new CharacterMoveGrants(moveRepo, actor, new GrantedItems(actor));
	for (const categoryKey of CharacterMoveGrants.REFERENCE_CATEGORIES) {
		const present = [...actor.items].some(i => i.type === "move" && i.system?.categoryKey === categoryKey);
		if (!present) await moves.seedReferenceCategory(categoryKey);
	}
}

// ── B0.6. Reference moves added to a category the character already has ───────

// Seek Insight was missed when the basic moves were first authored, so every character made before it
// joined the pack has the other nine and not it. migrateReferenceMoveCategories above can't reach it:
// basic moves ARE present, so the whole category is skipped. Listing the slug explicitly is what keeps
// this narrow — a blanket top-up of the basic category would also resurrect any basic move a GM
// deleted on purpose.
const ADDED_REFERENCE_SLUGS = { basic: ["seek-insight"] };

export async function migrateAddedReferenceMoves(actor, moveRepo) {
	const moves = new CharacterMoveGrants(moveRepo, actor, new GrantedItems(actor));
	for (const [categoryKey, slugs] of Object.entries(ADDED_REFERENCE_SLUGS)) {
		await moves.seedReferenceSlugs(categoryKey, slugs);
	}
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
	const moves = new CharacterMoveGrants(moveRepo, actor, new GrantedItems(actor));
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

	const possessions = new CharacterPossessions(actor, moves, possessionRepo);
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
	const arcana = new CharacterArcana(actor, arcanaRepo, null, followers);

	for (const slug of ownedSlugs) {
		await arcana.addArcanum(slug);
		const item = [...actor.items].find(i => i.type === "arcanum" && i.system?.slug === slug);
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
		await actor.updateEmbeddedDocuments("Item", [update]);
	}
}

// ── F2. Arcana mystery moves → real move items ────────────────────────────────
// Arcana own the moves they grant as real `move` items in an `arcana-<slug>` category. The moves are
// referenced by move-grant entries in the arcanum's choice groups (front + back); seed the category
// ACQUIRED (the "unlocked" checkbox is now the granting entry's ornamental choice track). Note:
// migrateArcanumPackData refreshes each arcanum's front/back from the pack first, so the grants are the
// current array shape by the time this runs. addCategory is idempotent, so this is re-run safe.
export async function migrateArcanaMoves(actor, arcanaRepo, moveRepo) {
	const arcana = [...actor.items].filter(i => i.type === "arcanum");
	if (!arcana.length) return;

	const moves = new CharacterMoveGrants(moveRepo, actor, new GrantedItems(actor));
	for (const item of arcana) {
		const slug = item.system?.slug;
		if (!slug) continue;
		const moveSlugs = ChoiceGroupDefs.grants(item.system ?? {}, "move").map(g => g.slug);
		if (moveSlugs.length) await moves.addCategory(`arcana-${slug}`, item.name ?? slug, moveSlugs, moveSlugs);
	}
}

// Normalize each embedded arcanum's back-choices group slug to the arcanum's own slug. Two
// hand-authored arcana (blackwood-fetishes, mindgem) shipped with `back.choices.slug: "followers"`,
// but the group is namespaced by the arcanum slug everywhere else in the pipeline (write, read,
// side-effect def lookup). The mismatch made the choice-group side effect silently no-op, so ticking
// a follower box never embedded the follower. Idempotent; only touches items that actually differ.
/**
 * A possession's granted gear is computed by reading each choice group's values under THAT group's own
 * slug, but both weapons-of-war possessions shipped `choices.slug: "weapons-of-war"` while their values
 * are stored under the possession's own slug. Left alone, an existing character silently stops granting
 * its picked weapons. Stored `pickValues` are untouched — they were already keyed by the possession
 * slug, which is what the group slug is being corrected to.
 */
export async function migratePossessionChoiceSlugs(actor) {
	const items = [...actor.items].filter(i =>
		i.type === "possession" && i.system?.choices?.slug && i.system?.slug &&
		i.system.choices.slug !== i.system.slug);
	if (!items.length) return;

	const updates = items.map(item => ({
		_id: item._id,
		system: { choices: { ...item.system.choices, slug: item.system.slug } },
	}));
	info(`Migrating ${updates.length} possession choice-group slug(s) to match their possession.`);
	await actor.updateEmbeddedDocuments("Item", updates);
}

export async function migrateArcanumChoiceGroupSlugs(actor) {
	const updates = [];
	for (const item of actor.items) {
		if (item.type !== "arcanum") continue;
		const slug = item.system?.slug;
		const back = item.system?.back;
		// Only the LEGACY single-group `back.choices` (a follower group that shipped with slug "followers")
		// needs correcting to the arcanum slug. The current shape is an array of groups with their own
		// stable slugs — leave it alone.
		const groupSlug = (back && !Array.isArray(back.choices)) ? back.choices?.slug : null;
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
					// Legacy flag state stored these under the key "choices"; they belong in whatever
					// namespace the follower's own group declares.
					choiceValues: _namespacedValues(blank?.choices, s.values),
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
		// Flag-era state stored these under the key "choices"; they belong in whatever namespace this
		// follower's own choice group declares.
		if (s.values && Object.keys(s.values).length)
			update.system.choiceValues = _namespacedValues(item.system?.choices, s.values);
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
			// The card the player was looking at and the circles they marked are theirs — the type rename
			// is not a reason to hand them back a pristine card.
			system: {
				slug:         sys.slug   ?? null,
				major:        sys.major  ?? false,
				front:        sys.front,
				back:         sys.back,
				flipped:      sys.flipped      ?? false,
				choiceValues: sys.choiceValues ?? {},
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

	const compendium = await playbookRepo.findSourceBySlug(slug);
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

	const compendium = await playbookRepo.findSourceBySlug(slug);
	const compendiumChoices = compendium?.choices ?? [];
	if (!compendiumChoices.length) return;

	const currentSlugs = new Set((pbItem.system?.choices ?? []).map(g => g.slug));
	const hasAll = compendiumChoices.every(g => currentSlugs.has(g.slug));
	if (hasAll) return;

	await actor.updateEmbeddedDocuments("Item", [{ _id: pbItem._id, system: { choices: compendiumChoices } }]);
}

// ── M0. Stamp stable slugs onto embedded arcanum items that lack one ─────────

// Every arcana pass matches on `system.slug`, so a slugless arcanum (one converted from a legacy
// `equipment` item that never carried one) is invisible to all of them — permanently, since each runs
// once per world migration. The name is what the slug was always derived from, so recover it there.
export async function migrateArcanumSlugs(actor) {
	const updates = [...actor.items]
		.filter(i => i.type === "arcanum" && !i.system?.slug && i.name)
		.map(i => ({ _id: i._id, system: { slug: toSlug(i.name) } }));
	if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}

// ── M. Refresh arcanum authored content (front/back) from the compendium ──────
// An embedded arcanum is an independent copy — regenerating the pack doesn't reach it. Refresh every
// arcanum's authored `front`/`back` from the repo (matched by slug) so pack fixes reach existing
// characters: cleaned front/back text, the inline @DrawTableInline dice table, and the re-added
// follower `back.choices`. Player state (`flipped` + `choiceValues`: marked circles, picks, follower
// selections) lives outside front/back, so a front/back-only update preserves it. Idempotent — runs
// once per world migration (also covers the old case of an item left with an empty front).
//
// Nulled first, then written, because Foundry MERGES an ObjectField update into what is stored rather
// than replacing it (ObjectField#_updateDiff). A merge would leave the legacy `front.description`,
// `front.unlock` and `back.consequences` sitting alongside the refreshed `choices` — and ArcanumData
// .migrateData folds each of those into `choices` on every load, so the description would render twice
// and the consequences would render as a second Consequences group, for good. Clearing the field first
// makes the second write a replacement (Foundry's `==` forced-replacement key does the same thing, but
// is deprecated in v14).
export async function migrateArcanumPackData(actor, arcanaRepo, outfitSync = null) {
	const items = [...actor.items].filter(i => i.type === "arcanum" && i.system?.slug);
	const updates = [];
	for (const item of items) {
		const raw = await arcanaRepo.findBySlug(item.system.slug);
		if (!raw?.front) continue;
		updates.push({ _id: item._id, system: { front: raw.front, back: raw.back } });
	}
	if (!updates.length) return;
	await actor.updateEmbeddedDocuments("Item", updates.map(u => ({ _id: u._id, system: { front: null, back: null } })));
	await actor.updateEmbeddedDocuments("Item", updates);

	// Refreshing the card is not enough: the gear it granted is a SEPARATE embedded document, written
	// when the card was flipped. A card item that gained a resource (or changed at all) in a later pack
	// regen keeps the old copy on the character until the grant is recomputed. Re-read each arcanum
	// AFTER the update so the grant comes from the refreshed card; the sync is idempotent.
	for (const { _id } of updates) {
		const item = [...actor.items].find(i => i._id === _id);
		if (item) await outfitSync?.syncItem(item);
	}
}

// ── O. Refresh an embedded possession's authored fields from the pack ─────────
// An embedded possession is a copy taken when the playbook granted it, so regenerating the pack never
// reaches it: a description added later never shows, and gear hung off a pick the player already ticked
// never appears. Authored fields come from the repo (matched by slug); player state is preserved by
// omission — selected, uses, pickValues, choiceUses, preselected and playbookSlug all survive Foundry's
// merge. `name` is deliberately left alone so a GM rename is not clobbered.
//
// Refreshing the data is not enough on its own: the grant has to be recomputed, or gear the pack just
// added to an already-ticked pick would sit there unmaterialised. The sync is idempotent, so re-running
// this cannot double-grant. Scoped to possessions the repo knows; drag-dropped custom ones are skipped.
export async function migratePossessionPackData(actor, possessionRepo, outfitSync = null) {
	const items = [...actor.items].filter(i => i.type === "possession" && i.system?.slug);
	if (!items.length) return;

	const bySlug = new Map((await possessionRepo.findBySlugs(items.map(i => i.system.slug))).map(p => [p.slug, p]));
	const updates = [];
	const refreshed = [];
	for (const item of items) {
		const p = bySlug.get(item.system.slug);
		if (!p) continue;
		updates.push({
			_id: item._id,
			system: {
				description: p.description ?? "",
				outfitItems: p.outfitItems ?? [],
				choices:     p.choices     ?? null,
				resource:    p.resource    ?? null,
				scaling:     p.scaling     ?? null,
				sortOrder:   p.sortOrder   ?? null,
			},
		});
		refreshed.push(item._id);
	}
	if (!updates.length) return;

	info(`Refreshing ${updates.length} embedded possession(s) from pack data.`);
	// Cleared first for the same reason the arcanum refresh does it: Foundry merges an object-field
	// update, so a key the pack has since dropped would survive a plain write and go on rendering.
	await actor.updateEmbeddedDocuments("Item", updates.map(u =>
		({ _id: u._id, system: { choices: null, resource: null, scaling: null } })));
	await actor.updateEmbeddedDocuments("Item", updates);

	// Re-read each item AFTER the update so the grant is computed from the refreshed definition.
	for (const id of refreshed) {
		const item = [...actor.items].find(i => i._id === id);
		if (item) await outfitSync?.syncItem(item);
	}
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
				tagList:        Tags.creature(f.tags).toRaw(),
				tagOptions:     f.tagOptions ?? [],
				instinct:       Selection.fromStored(f.instinct, { multi: false }).toRaw(),
				cost:           Selection.fromStored(f.cost,     { multi: false }).toRaw(),
				moves:          f.moves ?? "",
				choices:        f.choices ?? [],
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

// A card owns every follower it references (the Ring, the Cloak, choice followers); a mark only toggles
// the tab. Back-fill: embed any referenced follower an owned arcanum is missing, off the tab — leaving
// already-owned ones (and their marked tab placement) alone.
export async function migrateArcanaOwnedFollowers(actor, followerRepo, resourceController) {
	const arcana = [...actor.items].filter(i => i.type === "arcanum");
	if (!arcana.length) return;
	const followers = new CharacterFollowers(actor, followerRepo, resourceController);
	for (const arc of arcana) {
		for (const grant of ChoiceGroupDefs.grants(arc.system ?? {}, "follower")) {
			const slug = grant.slug;
			const item = [...actor.items].find(i => i.type === "follower" && i.system?.slug === slug);
			// Embed a missing follower off the tab; fix a card-bound one (no "tab" location) that an old
			// path left on the tab. A tab follower's marked placement is left alone (addFollower is idempotent).
			if (!item?.system?.owned) await followers.addFollower(slug, { showOnTab: false });
			else if (!grant.onTab && item.system?.showOnTab !== false) {
				await followers.addFollower(slug, { showOnTab: false });
			}
		}
	}
}

// ── Q. Refresh an embedded move's authored fields from the pack ───────────────
// An embedded move is a copy taken when it was seeded or granted, so regenerating the pack never
// reaches a character already in play: prose corrected later never shows, and links added to a move
// (Death's Door → the Revenant/Ghost/Thrall inserts) stay unclickable. Reference moves can't be
// re-added by hand — they seed once, at character creation — so refreshing in place is the only
// route open to an existing character.
//
// Authored fields come from the pack (matched by slug); player state is preserved by omission —
// acquired, instanceCount, categoryKey/Label/Note, sortOrder, compendiumId and pickValues all
// survive Foundry's merge. `name` is deliberately left alone so a GM rename is not clobbered.
// Scoped to moves the repo knows, so homebrew moves are skipped; a GM's hand-edits to a PACK move on
// a character are overwritten, the same trade the possession/arcana refreshes already make.
export async function migrateMovePackData(actor, moveRepo) {
	const items = [...actor.items].filter(i => i.type === "move" && i.system?.slug);
	if (!items.length) return;

	const bySlug = await moveRepo.buildSlugIndex();
	const updates = [];
	for (const item of items) {
		const move = bySlug.get(item.system.slug);
		if (!move) continue;
		// The index carries a subset of fields; the definition has to come from the document itself so
		// nothing authored (xpOnMiss, result tiers) is silently dropped on the way through.
		const doc = await moveRepo.getReferencedMoveDocument(move.id);
		const sys = doc?.toObject?.().system ?? doc?.system ?? null;
		if (!sys) continue;
		updates.push({
			_id: item._id,
			system: {
				description: sys.description ?? "",
				moveResults: sys.moveResults ?? null,
				rollStat:    sys.rollStat    ?? null,
				requirement: sys.requirement ?? null,
				resource:    sys.resource    ?? null,
				choices:     sys.choices     ?? null,
				repeatMax:   sys.repeatMax   ?? 1,
				// "Mark XP on a 6- unless the move says otherwise" — a move says otherwise with false.
				xpOnMiss:    sys.xpOnMiss !== false,
			},
		});
	}
	if (!updates.length) return;

	info(`Refreshing ${updates.length} embedded move(s) from pack data.`);
	await actor.updateEmbeddedDocuments("Item", updates);
}

// ── R. Notes tab bio/notes → ProseMirror HTML ─────────────────────────────────

// The notes tab's plain textareas became ProseMirror editors, which read and write HTML. Convert
// the text those textareas stored so its paragraphs and line breaks survive the switch; values a
// ProseMirror editor has already saved are left alone.
export async function migrateCharacterNotes(actor) {
	const updates = {};
	for (const field of ["description", "notes"]) {
		const stored = actor.system?.[field] ?? "";
		const html   = richTextToHtml(stored);
		if (html !== stored) updates[`system.${field}`] = html;
	}
	if (Object.keys(updates).length) await actor.update(updates);
}
