import { CharacterMoves } from "../actors/character/CharacterMoves.js";
import { CharacterPossessions } from "../actors/character/CharacterPossessions.js";
import { CharacterArcana } from "../actors/character/CharacterArcana.js";
import { CharacterFollowers } from "../actors/character/CharacterFollowers.js";
import { ActorOutfitItems } from "../actors/character/ActorOutfitItems.js";
import { ResourceController } from "../actors/character/ResourceController.js";

const SCOPE = "stonetop";

// ── Public exports ────────────────────────────────────────────────────────────

export async function migrateCharacter(actor, repos, insertRepo = null) {
	await migrateCharacterFlags(actor);
	await migrateCharacterMoves(actor, repos.moves);
	await migratePlaybookSpecialPossessions(actor);

	const outfitItems         = new ActorOutfitItems(actor);
	const resourceController  = new ResourceController(actor);

	await migrateArcana(actor, repos.arcana, repos.followers);
	await migrateFollowers(actor, repos.followers, resourceController);

	const moves = new CharacterMoves(repos.moves, actor, null, null);
	await migratePossessions(actor, repos.possessions, moves, outfitItems);

	if (insertRepo) await migrateInsert(actor, insertRepo, moves);
	await migrateEmbeddedEquipment(actor);
}

// ── A. Flag → system scalar copies ───────────────────────────────────────────

export async function migrateCharacterFlags(actor) {
	if (actor.getFlag(SCOPE, "vitals.maxHP") == null) return;

	const f = key => actor.getFlag(SCOPE, key);

	await actor.update({
		"system.attributes.hp.max":          f("vitals.maxHP")              ?? 0,
		"system.playbookSlug":               f("playbook.slug")             ?? "",
		"system.background.selected":        f("background.selected")       ?? "",
		"system.instinct.custom":            f("instinct.custom")           ?? "",
		"system.origin.selected":            f("origin.selected")           ?? "",
		"system.lore.values":                f("lore.values")               ?? {},
		"system.postDeathInstinct.custom":   f("postDeathInstinct.custom")  ?? "",
		"system.postDeathLore.values":       f("postDeathLore.values")      ?? {},
		"system.choices.values":             f("choices.values")            ?? {},
		"system.choices.groupDefs":          migrateGroupDefs(f("choices.groupDefs")),
		"system.postDeathChoices.values":    f("postDeathChoices.values")   ?? {},
		"system.postDeathChoices.groupDefs": migrateGroupDefs(f("postDeathChoices.groupDefs")),
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
		def.list = (def.list ?? []).map(row => {
			if (row.type === "follower")
				return { ...row, type: "entry", followers: [row.slug],
					content: { title: null, text: row.title ?? "" } };
			if (row.type === "heading")
				return { ...row, type: "entry" };
			return row;
		});
	}
	return defs;
}

// ── B. Embedded move items ────────────────────────────────────────────────────

export async function migrateCharacterMoves(actor, moveRepo) {
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
		await moves.initPlaybookCategory(playbookItem.system);
	}

	for (const cat of categories.filter(c => c.key.startsWith("post-death-"))) {
		const insertSlug = cat.key.replace("post-death-", "");
		await moves.addCategory(cat.key, cat.label ?? insertSlug, insertSlug);
	}
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
		if (!item) continue;
		await actor.updateEmbeddedDocuments("Item", [{
			_id: item._id,
			system: {
				flipped:          flippedSet.has(slug),
				unlockValues:     unlockMap[slug]  ?? {},
				backChoiceValues: backMap[slug]    ?? {},
			},
		}]);
	}
}

// ── G. Follower items ─────────────────────────────────────────────────────────

export async function migrateFollowers(actor, followerRepo, resourceController) {
	if ([...actor.items].some(i => i.type === "npc" && i.system?.owned)) return;

	const ownedSlugs = actor.getFlag(SCOPE, "followers.owned") ?? [];
	const state      = actor.getFlag(SCOPE, "followers.state") ?? {};

	const followers = new CharacterFollowers(actor, followerRepo, resourceController);

	for (const slug of ownedSlugs) {
		await followers.addFollower(slug);
	}

	// Apply mutable state
	for (const [slug, s] of Object.entries(state)) {
		const item = [...actor.items].find(i => i.type === "npc" && i.system?.slug === slug);
		if (!item) continue;
		const update = { _id: item._id, system: {} };
		if (s.hp    != null) update.system.hp    = { value: s.hp };
		if (s.hpMax != null) update.system.hp    = { ...(update.system.hp ?? {}), max: s.hpMax };
		if (s.armor != null) update.system.armor = { value: s.armor };
		if (s.damage != null) update.system.damage = { die: s.damage };
		if (s.name  != null) update.name = s.name;
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
	await moves.addCategory(`post-death-${slug}`, doc.name ?? slug, slug);
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
				slug:             sys.slug   ?? null,
				major:            sys.major  ?? false,
				front:            sys.front,
				back:             sys.back,
				flipped:          false,
				unlockValues:     {},
				backChoiceValues: {},
			},
		}]);
		await actor.deleteEmbeddedDocuments("Item", [item._id]);
	}
}
