import { buildFollowerSnapshot } from "../../model/snapshot/character/buildFollowerSnapshot.js";
import { ResourceController } from "./ResourceController.js";
import { Selection } from "../../model/data/Selection.js";
import { normalizeGroupTags } from "../../model/data/groupTag.js";
import { newMember } from "../../utils/followerMemberEdit.js";
import { blankCompanion } from "../../utils/followerCompanionEdit.js";
import { buildOutfitColumn, loadBand } from "../../model/snapshot/character/outfitSections.js";

export class CharacterFollowers {
	constructor(actor, followerRepo, resourceController, factory = null, inventoryRepo = null) {
		this._actor              = actor;
		this._followerRepo       = followerRepo;
		this._resourceController = resourceController;
		this._factory            = factory;
		this._inventoryRepo      = inventoryRepo; // shared outfit-item catalog (same as the character)
		this._openInventories    = new Set();     // follower slugs whose inventory catalog is expanded
	}

	// Which followers have their inventory catalog open (transient sheet state, set before each
	// build). Only an open follower renders the full catalog — otherwise every card would carry the
	// whole outfit list, making tag/item edits re-render slowly.
	setOpenInventories(slugs) {
		this._openInventories = slugs instanceof Set ? slugs : new Set(slugs ?? []);
	}

	// Read-modify-write the WHOLE inventory object atomically (opaque ObjectField — the partial diff
	// must carry it intact, or Foundry's migrate-on-diff would clobber it).
	async _updateInventory(followerSlug, mutate) {
		const item = _findFollowerItem(this._actor, followerSlug);
		if (!item) return;
		const inv  = item.system?.inventory ?? {};
		const next = {
			checked:     { ...(inv.checked ?? {}) },
			customItems: [...(inv.customItems ?? [])],
			resources:   { ...(inv.resources ?? {}) },
		};
		mutate(next);
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { inventory: next } }]);
	}

	// Take/drop an item for one follower. No cap — checking is unrestricted (load is guidance).
	async setInvItemChecked(followerSlug, itemSlug, on) {
		await this._updateInventory(followerSlug, inv => { inv.checked[itemSlug] = !!on; });
	}

	// Add a custom gear item to a follower (followers can't embed Items, so it lives inline). Auto-held.
	async addInvCustomItem(followerSlug, name, weight) {
		const slug = `custom-${foundry.utils.randomID(8)}`;
		await this._updateInventory(followerSlug, inv => {
			inv.customItems.push({
				slug, name: name || "Item", weight: Math.max(1, Number(weight) || 1),
				tags: "", note: null, inventoryColumn: "regular", twoCol: false,
			});
			inv.checked[slug] = true;
		});
	}

	async removeInvCustomItem(followerSlug, itemSlug) {
		await this._updateInventory(followerSlug, inv => {
			inv.customItems = inv.customItems.filter(c => c.slug !== itemSlug);
			delete inv.checked[itemSlug];
			delete inv.resources[itemSlug];
		});
	}

	async setInvResource(followerSlug, itemSlug, count) {
		await this._updateInventory(followerSlug, inv => { inv.resources[itemSlug] = count; });
	}

	get ownedSlugs() {
		return [...this._actor.items]
			.filter(i => i.type === "follower" && (i.system?.owned ?? false))
			.map(i => i.system?.slug)
			.filter(Boolean);
	}

	async addFollower(slug) {
		const existing = _findFollowerItem(this._actor, slug);
		if (existing?.system?.owned) return;
		if (existing) {
			await this._actor.updateEmbeddedDocuments("Item", [{ _id: existing._id, system: { owned: true } }]);
			return;
		}
		const [follower] = await this._followerRepo.findBySlugs([slug]);
		if (!follower) return;
		await this._actor.createEmbeddedDocuments("Item", [{
			name: follower.name, type: "follower",
			...(follower.img ? { img: follower.img } : {}),
			system: { ..._followerToSystemFields(follower), owned: true },
		}]);
	}

	// Embed the followers tied to the active playbook (owned), and drop any left over from a
	// previously-selected playbook. Called when the playbook is chosen/changed.
	async syncPlaybookFollowers(playbookSlug, followerSlugs = []) {
		// Remove the previous playbook's granted followers. The grant marker is the item flag
		// `stonetop.grantedByPlaybook`; fall back to the legacy `system.playbookSlug` so followers
		// embedded before Phase 4 are still cleaned up on swap.
		for (const item of [...this._actor.items]) {
			if (item.type !== "follower") continue;
			const grantedBy = item.flags?.stonetop?.grantedByPlaybook ?? item.system?.playbookSlug;
			if (grantedBy && grantedBy !== playbookSlug) {
				await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
			}
		}
		if (!playbookSlug || !followerSlugs?.length) return;
		// The playbook lists its follower slugs; embed each (owned), stamped with the grant flag.
		const followers = await this._followerRepo.findBySlugs(followerSlugs);
		for (const follower of followers) {
			if (_findFollowerItem(this._actor, follower.slug)) continue;
			await this._actor.createEmbeddedDocuments("Item", [{
				name: follower.name, type: "follower",
				...(follower.img ? { img: follower.img } : {}),
				system: { ..._followerToSystemFields(follower), owned: true },
				flags: { stonetop: { grantedByPlaybook: playbookSlug } },
			}]);
		}
	}

	async removeFollower(slug) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
	}

	// Remove every follower an arcanum embedded. Arcana followers carry `system.arcanaSlug` (their
	// source arcanum, from pack data); playbook/custom/independent followers have it null, so they
	// never match. Mirrors the outfit-item `deleteBySource("arcana:" + slug)` provenance cleanup.
	async removeByArcanum(arcanumSlug) {
		const ids = [...this._actor.items]
			.filter(i => i.type === "follower" && i.system?.arcanaSlug === arcanumSlug)
			.map(i => i._id);
		if (ids.length) await this._actor.deleteEmbeddedDocuments("Item", ids);
	}

	async addCustomFollower() {
		const slug = `custom-${Date.now()}`;
		const [blank] = await this._followerRepo.findBySlugs(["blank"]);
		await this._actor.createEmbeddedDocuments("Item", [{
			name: blank?.name ?? "New Follower", type: "follower",
			...(blank?.img ? { img: blank.img } : {}),
			system: {
				slug, arcanaSlug: null, tagList: Selection.fromStored(blank?.tags).toRaw(), owned: true, choiceValues: {},
				hp:      { value: blank?.hp?.max ?? 6, max: blank?.hp?.max ?? 6 },
				armor:   blank?.armor ?? "",
				damage:  "",
				instinct: Selection.fromStored("").toRaw(), moves: "", cost: Selection.fromStored("").toRaw(), notes: "",
				loyalty: { value: 0, max: 3 },
				choices: blank?.choices ?? null, specialQuality: "",
			},
		}]);
	}

	async addFromNpcActor(npcActor) {
		const sys     = npcActor.system ?? {};
		const slug    = `custom-${Date.now()}`;
		const [blank] = await this._followerRepo.findBySlugs(["blank"]);
		// Canonicalize the copied group tag ("Group (3)" -> "group") so isGroup detects it, and seed
		// the crew from the "(N)" count — each member at the group's shared max HP (as addMember does).
		const tags    = Selection.fromStored(sys.tagList);
		const { tags: selected, count } = normalizeGroupTags(tags.values);
		const hpMax   = (sys.hp?.max || sys.hp?.value) ?? 0;
		const members = count ? Array.from({ length: count }, () => newMember(hpMax)) : [];
		await this._actor.createEmbeddedDocuments("Item", [{
			name: npcActor.name, type: "follower",
			...(npcActor.img ? { img: npcActor.img } : {}),
			system: {
				// creature core copied from the NPC (shared schema → direct copy)
				tagList:   Selection.multi(selected, { options: tags.options }).toRaw(),
				members,
				hp:             { value: sys.hp?.value ?? 0, max: hpMax },
				armor:          sys.armor ?? "",
				damage:         sys.damage ?? "",
				specialQuality: sys.specialQuality ?? "",
				instinct:       Selection.fromStored(sys.instinct).toRaw(),
				moves:          sys.moves ?? "",
				description:    sys.description ?? "",
				notes:          sys.notes ?? "",
				reference:      sys.reference ?? null,
				// follower bookkeeping
				slug, arcanaSlug: null, owned: true,
				loyalty:        { value: 0, max: 3 },
				choices:        blank?.choices ?? [],
				choiceValues:   {},
			},
		}]);
	}

	async setHp(slug, hp) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { hp: { value: hp } } }]);
	}

	async setHpMax(slug, hpMax) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { hp: { max: hpMax } } }]);
	}

	async setName(slug, name) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, name }]);
	}

	async setTags(slug, tags) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const stored = Selection.fromStored(tags, { options: item.system?.tagList?.options ?? [] }).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { tagList: stored } }]);
	}

	// Toggle a value in any Selection field (tags, instinct, cost). Single-select fields
	// replace; multi-select add/remove (handled by Selection.toggle).
	async toggleSelection(slug, field, value) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item || !field || !value) return;
		const stored = Selection.fromStored(item.system?.[field]).toggle(value).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { [field]: stored } }]);
	}

	async setLoyalty(slug, loyalty) {
		await this._resourceController.set("followers", slug, loyalty);
	}

	// --- Group members: each owns its HP; the new member starts at the group's shared max. ---
	async addMember(slug) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const max = item.system?.hp?.max ?? 0;
		const blank = { name: "", hp: { value: max, max }, tags: Selection.multi([]).toRaw(), traits: Selection.multi([]).toRaw() };
		const members = [..._members(item), blank];
		// Adding a member makes this a group follower — ensure the "group" tag is set (FollowerSnapshot.isGroup).
		const tagList = Selection.fromStored(item.system?.tagList, { multi: true }).select("group").toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { members, tagList } }]);
	}

	async removeMember(slug, index) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const members = _members(item);
		if (index < 0 || index >= members.length) return;
		members.splice(index, 1);
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { members } }]);
	}

	async setMemberName(slug, index, name)  { await this._updateMember(slug, index, m => ({ ...m, name })); }
	async setMemberHp(slug, index, value)   { await this._updateMember(slug, index, m => ({ ...m, hp: { ...m.hp, value: Number(value) } })); }
	async setMemberHpMax(slug, index, max)  { await this._updateMember(slug, index, m => ({ ...m, hp: { ...m.hp, max: Number(max) } })); }

	// Toggle a per-member tag or trait (field = "tags" | "traits").
	async toggleMemberSelection(slug, index, field, value) {
		if (!value || (field !== "tags" && field !== "traits")) return;
		await this._updateMember(slug, index, m => ({
			...m, [field]: Selection.fromStored(m[field], { multi: true }).toggle(value).toRaw(),
		}));
	}

	async _updateMember(slug, index, fn) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const members = _members(item);
		if (index < 0 || index >= members.length) return;
		members[index] = fn(members[index]);
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { members } }]);
	}

	async setArmor(slug, armor) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { armor } }]);
	}

	async setDamage(slug, damage) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { damage } }]);
	}

	async setInstinct(slug, instinct) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const stored = Selection.fromStored(instinct, { multi: false, options: item.system?.instinct?.options ?? [] }).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { instinct: stored } }]);
	}

	async setMoves(slug, moves) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { moves } }]);
	}

	async setCost(slug, cost) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const stored = Selection.fromStored(cost, { multi: false, options: item.system?.cost?.options ?? [] }).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { cost: stored } }]);
	}

	async setNotes(slug, notes) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { notes } }]);
	}

	async setSpecialQuality(slug, specialQuality) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { specialQuality } }]);
	}

	async setDescription(slug, description) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { description } }]);
	}

	// Animal companion: `system.companion` is atomic (one opaque object), so every writer
	// read-modify-writes the WHOLE object — a partial path would drop sibling keys.

	// Pick a Type: pre-fill the editable hp/armor/damage from its template, set the chosen type,
	// and reset the options pool + pre-checked defaults to that type's. (Pre-fill, not computed —
	// the user can type over hp/armor/damage afterwards.)
	async setCompanionType(slug, typeSlug) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const companion = _companion(item);
		const t = (companion.catalog ?? []).find(x => x.slug === typeSlug || x.name === typeSlug);
		if (!t) return;
		companion.type    = { selected: [t.name], options: (companion.catalog ?? []).map(x => x.name), multi: false, allowCustom: true };
		companion.options = { selected: [...(t.defaults ?? [])], options: [...(t.options ?? [])], multi: true, allowCustom: true };
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: {
			companion,
			hp:     { value: t.hp?.value ?? t.hp?.max ?? 0, max: t.hp?.max ?? t.hp?.value ?? 0 },
			armor:  t.armor ?? "",
			damage: t.damage ?? "",
		} }]);
	}

	// Toggle one entry in the companion options pool (the nested multi-select; the generic
	// toggleSelection can't reach `companion.options`).
	async toggleCompanionOption(slug, value) {
		if (!value) return;
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		const companion = _companion(item);
		companion.options = Selection.fromStored(companion.options, { multi: true }).toggle(value).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { companion } }]);
	}

	async setChoiceValue(slug, groupSlug, choiceSlug, siblingSlugsCsv) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._factory.forItem(item._id, "choiceValues")
			.selectOption(groupSlug, choiceSlug, siblingSlugsCsv ?? null);
	}

	async setChoiceText(followerSlug, optionSlug, text) {
		const item = _findFollowerItem(this._actor, followerSlug);
		if (!item) return;
		await this._factory.forItem(item._id, "choiceValues")
			.setText("choices", optionSlug, text);
	}

	async buildSnapshot(extraSlugs = []) {
		const npcItems      = [...this._actor.items].filter(i => i.type === "follower");
		const ownedItems    = npcItems.filter(i => i.system?.owned === true);
		const ownedSlugsSet = new Set(ownedItems.map(i => i.system?.slug).filter(Boolean));
		const embeddedSlugs = new Set(npcItems.map(i => i.system?.slug).filter(Boolean));
		const staticSlugs   = extraSlugs.filter(s => !ownedSlugsSet.has(s));
		const staticItems   = npcItems.filter(i => staticSlugs.includes(i.system?.slug));
		// A linked slug (extraSlugs) with no embedded item at all → a read-only card preview sourced from
		// the follower repo. This lets an arcanum card show its follower stat block before the player
		// checks the box (which is what actually embeds the follower as owned).
		const previewSlugs  = staticSlugs.filter(s => !embeddedSlugs.has(s));

		if (!ownedItems.length && !staticItems.length && !previewSlugs.length) return [];

		// Fetch the shared outfit-item catalog once (async) and pass it into each follower's snapshot.
		const repoItems = this._inventoryRepo ? await this._inventoryRepo.getAll() : [];

		const result = ownedItems.map(item => this._buildFollowerSnapshotFromItem(item, repoItems));
		for (const item of staticItems) result.push(this._buildFollowerSnapshotFromItem(item, repoItems));
		if (previewSlugs.length) {
			const previews = await this._followerRepo.findBySlugs(previewSlugs);
			for (const follower of previews) {
				const item = { name: follower.name, img: follower.img ?? null, system: { ..._followerToSystemFields(follower), owned: false } };
				result.push(this._buildFollowerSnapshotFromItem(item, repoItems));
			}
		}

		// Game-text fields are RichText on the snapshot; the character sheet's enrichRichTextTree pass
		// enriches the whole tree (these followers included) — one render path, no bespoke enrichHTML.
		return result;
	}

	_buildFollowerSnapshotFromItem(item, repoItems = []) {
		const sys            = item.system;
		const loyaltyCurrent = this._resourceController.getCurrent("followers", sys.slug);
		const inventory      = this._buildFollowerInventory(sys.slug, sys.inventory ?? {}, repoItems);
		return buildFollowerSnapshot(item, { loyaltyCurrent, inventory });
	}

	// Build the follower's inventory snapshot — parity with the character (twoCol grids, resources,
	// custom items), via the shared buildOutfitColumn. Regular column only. Load is computed from total
	// checked weight and is informational (highlighted band, never a cap — guide-don't-enforce).
	// Returns null when there is nothing to show (no catalog loaded and no custom items).
	//
	// The full `sections` (catalog) is built ONLY when this follower's inventory is open — building it
	// for every follower on every render is what makes tag/item edits sluggish. `ownedSections`
	// (checked items only) drives the compact view.
	_buildFollowerInventory(slug, inv, repoItems) {
		const regular     = repoItems.filter(i => i.inventoryColumn === "regular");
		const customItems = (inv.customItems ?? []).map(c => ({ ...c, inventoryColumn: "regular", ownedId: c.slug }));
		if (!regular.length && !customItems.length) return null;

		const checked    = inv.checked ?? {};
		const resources  = inv.resources ?? {};
		const editing    = this._openInventories.has(slug);
		const resourceFn = oi => oi.resource ? ResourceController.build(oi.resource, resources[oi.slug] ?? 0) : null;

		const owned       = [...regular, ...customItems].filter(i => checked[i.slug]);
		const totalWeight = owned.reduce((s, i) => s + (i.weight ?? 0), 0);
		const band        = loadBand(totalWeight);
		const hasAny      = owned.length > 0;

		return {
			editing,
			hasAny,
			showDetails:   editing || hasAny, // hide load band + list for an empty, collapsed follower
			ownedSections: buildOutfitColumn(regular.filter(i => checked[i.slug]), customItems.filter(i => checked[i.slug]), checked, "regular", resourceFn),
			sections:      editing ? buildOutfitColumn(repoItems, customItems, checked, "regular", resourceFn) : [],
			totalWeight,
			band,
			loadLight:     band === "light",
			loadNormal:    band === "normal",
			loadHeavy:     band === "heavy",
		};
	}
}

function _findFollowerItem(actor, slug) {
	return [...actor.items].find(i => i.type === "follower" && i.system?.slug === slug) ?? null;
}

// Plain-object clone of a follower's members (Foundry replaces arrays wholesale on update).
function _members(item) {
	return (item.system?.members ?? []).map(m => ({
		name: m.name ?? "",
		hp:   { value: m.hp?.value ?? 0, max: m.hp?.max ?? 0 },
		tags:   Selection.fromStored(m.tags,   { multi: true }).toRaw(),
		traits: Selection.fromStored(m.traits, { multi: true }).toRaw(),
	}));
}

// Deep-ish clone of a follower's atomic `companion` object (Foundry replaces ObjectFields
// wholesale on update, so writers must hand back the full object).
function _companion(item) {
	const c = item.system?.companion ?? {};
	return {
		enabled: !!c.enabled,
		type:    { ...(c.type    ?? { selected: [], options: [], multi: false, allowCustom: true }) },
		options: { ...(c.options ?? { selected: [], options: [], multi: true,  allowCustom: true }) },
		catalog: Array.isArray(c.catalog) ? c.catalog.map(t => ({ ...t })) : [],
	};
}

function _followerToSystemFields(follower) {
	return {
		slug:           follower.slug,
		arcanaSlug:     follower.arcanaSlug ?? null,
		tagList:   Selection.fromStored(follower.tags).toRaw(),
		// New followers start at full HP (pack data stores value 0 as a template default).
		hp:             { value: follower.hp?.max ?? 0, max: follower.hp?.max ?? 0 },
		armor:          follower.armor ?? "",
		damage:         follower.damage ?? "",
		instinct:       Selection.fromStored(follower.instinct).toRaw(),
		moves:          follower.moves ?? "",
		cost:           Selection.fromStored(follower.cost).toRaw(),
		loyalty:        { value: 0, max: follower.loyalty?.max ?? 3 },
		choices:        follower.choices ?? null,
		specialQuality: follower.specialQuality ?? "",
		description:    follower.description ?? "",
		notes:          follower.notes ?? "",
		choiceValues:   {},
		// Group members embed at full HP too (their stored value mirrors max on creation).
		members:        (follower.members ?? []).map(m => ({
			name: m.name ?? "",
			hp:   { value: m.hp?.max ?? 0, max: m.hp?.max ?? 0 },
			tags:   Selection.fromStored(m.tags,   { multi: true }).toRaw(),
			traits: Selection.fromStored(m.traits, { multi: true }).toRaw(),
		})),
		memberSuggestions: follower.memberSuggestions ?? { names: [], tags: [], traits: [] },
		membersNote:    follower.membersNote ?? "",
		companion:      follower.companion ?? blankCompanion(),
	};
}
