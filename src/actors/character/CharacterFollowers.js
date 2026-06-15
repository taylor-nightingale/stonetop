import { FollowerSnapshotBuilder } from "../../model/snapshot/character/FollowerSnapshot.js";
import { enrichGameText } from "../../utils/enrichGameText.js";
import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { ResourceController } from "./ResourceController.js";
import { Selection } from "../../model/data/Selection.js";

export class CharacterFollowers {
	constructor(actor, followerRepo, resourceController, factory = null) {
		this._actor              = actor;
		this._followerRepo       = followerRepo;
		this._resourceController = resourceController;
		this._factory            = factory;
	}

	get ownedSlugs() {
		return [...this._actor.items]
			.filter(i => i.type === "npc" && (i.system?.owned ?? false))
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
			name: follower.name, type: "npc",
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
			if (item.type !== "npc") continue;
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
				name: follower.name, type: "npc",
				system: { ..._followerToSystemFields(follower), owned: true },
				flags: { stonetop: { grantedByPlaybook: playbookSlug } },
			}]);
		}
	}

	async embedLinkedFollowers(slugs) {
		for (const slug of slugs) {
			if (_findFollowerItem(this._actor, slug)) continue;
			const [follower] = await this._followerRepo.findBySlugs([slug]);
			if (!follower) continue;
			await this._actor.createEmbeddedDocuments("Item", [{
				name: follower.name, type: "npc",
				system: { ..._followerToSystemFields(follower), owned: false },
			}]);
		}
	}

	async removeFollower(slug) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
	}

	async removeLinkedFollower(slug) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item || item.system?.owned) return;
		await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
	}

	async addCustomFollower() {
		const slug = `custom-${Date.now()}`;
		const [blank] = await this._followerRepo.findBySlugs(["blank"]);
		await this._actor.createEmbeddedDocuments("Item", [{
			name: blank?.name ?? "New Follower", type: "npc",
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
		await this._actor.createEmbeddedDocuments("Item", [{
			name: npcActor.name, type: "npc",
			system: {
				// creature core copied from the NPC (shared schema → direct copy)
				tagList:   Selection.fromStored(sys.tagList).toRaw(),
				hp:             { value: sys.hp?.value ?? 0, max: (sys.hp?.max || sys.hp?.value) ?? 0 },
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
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { members } }]);
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
		const npcItems      = [...this._actor.items].filter(i => i.type === "npc");
		const ownedItems    = npcItems.filter(i => i.system?.owned === true);
		const ownedSlugsSet = new Set(ownedItems.map(i => i.system?.slug).filter(Boolean));
		const staticSlugs   = extraSlugs.filter(s => !ownedSlugsSet.has(s));
		const staticItems   = npcItems.filter(i => staticSlugs.includes(i.system?.slug));

		if (!ownedItems.length && !staticItems.length) return [];

		const result = ownedItems.map(item => this._buildFollowerSnapshotFromItem(item));
		for (const item of staticItems) result.push(this._buildFollowerSnapshotFromItem(item));

		const rollData = this._actor.getRollData?.() ?? {};
		await Promise.all(result.map(async snap => {
			snap.damageHtml   = await enrichGameText(snap.damage, { rollData });
			snap.armorHtml    = await enrichGameText(snap.armor, { rollData });
			snap.instinctHtml = await enrichGameText(snap.instinct, { rollData });
			snap.movesHtml    = await enrichGameText(snap.moves, { rollData });
			snap.costHtml     = await enrichGameText(snap.cost, { rollData });
			snap.notesHtml    = await enrichGameText(snap.notes, { rollData });
		}));
		return result;
	}

	_buildFollowerSnapshotFromItem(item) {
		const sys      = item.system;
		const values   = new ChoiceValues(sys?.choiceValues ?? {});
		const loyalty  = this._resourceController.getCurrent("followers", sys.slug);
		return new FollowerSnapshotBuilder()
			.withSlug(sys.slug)
			.withName(item.name)
			.withTags(sys.tagList ?? null)
			.withHp(sys.hp?.value ?? 0)
			.withHpMax(sys.hp?.max ?? 0)
			.withArmor(sys.armor ?? "")
			.withDamage(sys.damage ?? "")
			.withInstinct(sys.instinct ?? "")
			.withMoves(sys.moves ?? "")
			.withCost(sys.cost ?? "")
			.withLoyalty(ResourceController.build({ max: sys.loyalty?.max ?? 3, title: null, labels: [] }, loyalty))
			.withDescription(sys.description ?? "")
			.withNotes(sys.notes ?? "")
			.withChoices(sys.choices?.length ? ChoiceGroup.fromPackData(sys.choices[0], values) : null)
			.withArcanaSlug(sys.arcanaSlug ?? null)
			.withMembers(sys.members ?? [])
			.withMemberSuggestions(sys.memberSuggestions ?? { names: [], tags: [], traits: [] })
			.withMembersNote(sys.membersNote ?? "")
			.withCompanion(sys.companion ?? {})
			.build();
	}
}

function _findFollowerItem(actor, slug) {
	return [...actor.items].find(i => i.type === "npc" && i.system?.slug === slug) ?? null;
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
		companion:      follower.companion ?? { enabled: false, type: { selected: [], options: [], multi: false, allowCustom: true }, options: { selected: [], options: [], multi: true, allowCustom: true }, catalog: [] },
	};
}
