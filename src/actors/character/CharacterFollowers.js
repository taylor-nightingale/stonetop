import { FollowerSnapshotBuilder } from "../../model/snapshot/character/FollowerSnapshot.js";
import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";
import { ResourceController } from "./ResourceController.js";

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
				slug, arcanaSlug: null, tags: "", owned: true, choiceValues: {},
				hp:      { value: blank?.hp?.max ?? 6, min: 0, max: blank?.hp?.max ?? 6 },
				armor:   { value: blank?.armor?.value ?? 0, note: "" },
				damage:  { die: null, label: "", tags: "" },
				instinct: "", loyalty: { value: 0, max: 3 },
				choices: blank?.choices ?? null, specialQualities: "",
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
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { tags } }]);
	}

	async setLoyalty(slug, loyalty) {
		await this._resourceController.set("followers", slug, loyalty);
	}

	async setArmor(slug, armor) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { armor: { value: armor } } }]);
	}

	async setDamage(slug, damage) {
		const item = _findFollowerItem(this._actor, slug);
		if (!item) return;
		await this._actor.updateEmbeddedDocuments("Item", [{ _id: item._id, system: { damage: { die: damage } } }]);
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
		return result;
	}

	_buildFollowerSnapshotFromItem(item) {
		const sys      = item.system;
		const values   = new ChoiceValues(sys?.choiceValues ?? {});
		const loyalty  = this._resourceController.getCurrent("followers", sys.slug);
		const damageDie = sys.damage?.die ?? null;
		return new FollowerSnapshotBuilder()
			.withSlug(sys.slug)
			.withName(item.name)
			.withTags(sys.tags ?? null)
			.withHp(sys.hp?.value ?? 0)
			.withHpMax(sys.hp?.max ?? 0)
			.withArmor({ value: sys.armor?.value ?? 0, note: sys.armor?.note ?? "" })
			.withDamage(damageDie ? { value: damageDie, label: sys.damage?.label ?? "", tags: sys.damage?.tags ?? "" } : null)
			.withInstinct(sys.instinct ?? "")
			.withLoyalty(ResourceController.build({ max: sys.loyalty?.max ?? 3, title: null, labels: [] }, loyalty))
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
		slug:             follower.slug,
		arcanaSlug:       follower.arcanaSlug ?? null,
		tags:             follower.tags ?? "",
		hp:               { value: follower.hp?.value ?? 0, min: 0, max: follower.hp?.max ?? 0 },
		armor:            { value: follower.armor?.value ?? 0, note: follower.armor?.note ?? "" },
		damage:           follower.damage
			? { die: follower.damage.value ?? follower.damage.die ?? null, label: follower.damage.label ?? "", tags: follower.damage.tags ?? "" }
			: { die: null, label: "", tags: "" },
		instinct:         follower.instinct ?? "",
		loyalty:          { value: 0, max: follower.loyalty?.max ?? 3 },
		choices:          follower.choices ?? null,
		specialQualities: follower.specialQualities ?? "",
		choiceValues:     {},
	};
}
