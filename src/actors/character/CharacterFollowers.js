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
	async syncPlaybookFollowers(playbookSlug) {
		for (const item of [...this._actor.items]) {
			if (item.type !== "npc") continue;
			const ps = item.system?.playbookSlug;
			if (ps && ps !== playbookSlug) {
				await this._actor.deleteEmbeddedDocuments("Item", [item._id]);
			}
		}
		if (!playbookSlug) return;
		const followers = await this._followerRepo.findByPlaybook(playbookSlug);
		for (const follower of followers) {
			if (_findFollowerItem(this._actor, follower.slug)) continue;
			await this._actor.createEmbeddedDocuments("Item", [{
				name: follower.name, type: "npc",
				system: { ..._followerToSystemFields(follower), owned: true },
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
				slug, arcanaSlug: null, tags: Selection.fromStored(blank?.tags).toRaw(), owned: true, choiceValues: {},
				hp:      { value: blank?.hp?.max ?? 6, max: blank?.hp?.max ?? 6 },
				armor:   blank?.armor ?? "",
				damage:  "",
				instinct: "", moves: "", cost: "", notes: "",
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
				tags:           Selection.fromStored(sys.tags).toRaw(),
				hp:             { value: sys.hp?.value ?? 0, max: (sys.hp?.max || sys.hp?.value) ?? 0 },
				armor:          sys.armor ?? "",
				damage:         sys.damage ?? "",
				specialQuality: sys.specialQuality ?? "",
				instinct:       sys.instinct ?? "",
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
		const stored = Selection.fromStored(tags, { options: item.system?.tags?.options ?? [] }).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { tags: stored } }]);
	}

	async toggleTag(slug, tag) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item || !tag) return;
		const stored = Selection.fromStored(item.system?.tags).toggle(tag).toRaw();
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { tags: stored } }]);
	}

	async setLoyalty(slug, loyalty) {
		await this._resourceController.set("followers", slug, loyalty);
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
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { instinct } }]);
	}

	async setMoves(slug, moves) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { moves } }]);
	}

	async setCost(slug, cost) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { cost } }]);
	}

	async setNotes(slug, notes) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { notes } }]);
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
			.withTags(sys.tags ?? null)
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
			.build();
	}
}

function _findFollowerItem(actor, slug) {
	return [...actor.items].find(i => i.type === "npc" && i.system?.slug === slug) ?? null;
}

function _followerToSystemFields(follower) {
	return {
		slug:           follower.slug,
		arcanaSlug:     follower.arcanaSlug ?? null,
		playbookSlug:   follower.playbookSlug ?? null,
		tags:           Selection.fromStored(follower.tags).toRaw(),
		hp:             { value: follower.hp?.value ?? 0, max: follower.hp?.max ?? 0 },
		armor:          follower.armor ?? "",
		damage:         follower.damage ?? "",
		instinct:       follower.instinct ?? "",
		moves:          follower.moves ?? "",
		cost:           follower.cost ?? "",
		loyalty:        { value: 0, max: follower.loyalty?.max ?? 3 },
		choices:        follower.choices ?? null,
		specialQuality: follower.specialQuality ?? "",
		description:    follower.description ?? "",
		notes:          follower.notes ?? "",
		choiceValues:   {},
	};
}
