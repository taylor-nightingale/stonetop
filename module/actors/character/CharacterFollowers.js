import { FollowerSnapshotBuilder } from "../../model/snapshot/character/FollowerSnapshot.js";
import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";

export class CharacterFollowers {
	constructor(flags, followerRepo) {
		this._flags       = flags;
		this._followerRepo = followerRepo;
	}

	get ownedSlugs() { return this._flags.getFlag("owned") ?? []; }
	get _state()     { return this._flags.getFlag("state") ?? {}; }

	_stateFor(slug) {
		return this._state[slug] ?? { hp: null, loyalty: null, values: {}, instinctCustom: "" };
	}

	async addFollower(slug) {
		const slugs = this.ownedSlugs;
		if (slugs.includes(slug)) return;
		await this._flags.setFlag("owned", [...slugs, slug]);
	}

	async removeFollower(slug) {
		await this._flags.setFlag("owned", this.ownedSlugs.filter(s => s !== slug));
		const state = { ...this._state };
		delete state[slug];
		await this._flags.setFlag("state", state);
	}

	async setHp(slug, hp) {
		await this._flags.setFlag("state", { ...this._state, [slug]: { ...this._stateFor(slug), hp } });
	}

	async setLoyalty(slug, loyalty) {
		await this._flags.setFlag("state", { ...this._state, [slug]: { ...this._stateFor(slug), loyalty } });
	}

	async setArmor(slug, armor) {
		await this._flags.setFlag("state", { ...this._state, [slug]: { ...this._stateFor(slug), armor } });
	}

	async setDamage(slug, damage) {
		await this._flags.setFlag("state", { ...this._state, [slug]: { ...this._stateFor(slug), damage } });
	}

	async setChoiceValue(slug, groupSlug, choiceSlug, siblingSlugsCsv) {
		const state = this._stateFor(slug);
		let values = new ChoiceValues(state.values ?? {});
		if (siblingSlugsCsv) {
			for (const sibSlug of siblingSlugsCsv.split(",")) {
				values = values.set(groupSlug, sibSlug, 0);
			}
		}
		values = values.set(groupSlug, choiceSlug, 1);
		await this._flags.setFlag("state", { ...this._state, [slug]: { ...state, values: values.toRaw() } });
	}

	async setInstinctCustom(slug, value) {
		await this._flags.setFlag("state", { ...this._state, [slug]: { ...this._stateFor(slug), instinctCustom: value } });
	}

	async setInstinctText(slug, text) {
		const state = this._stateFor(slug);
		let values = new ChoiceValues(state.values ?? {});
		values = values.set("instinct", "value", text);
		await this._flags.setFlag("state", { ...this._state, [slug]: { ...state, values: values.toRaw() } });
	}

	async buildSnapshot() {
		const slugs = this.ownedSlugs;
		if (!slugs.length) return [];
		const followers = await this._followerRepo.findBySlugs(slugs);
		return followers.map(f => this._buildFollowerSnapshot(f));
	}

	_buildFollowerSnapshot(follower) {
		const state   = this._stateFor(follower.slug);
		const values  = new ChoiceValues(state.values ?? {});
		const hp      = state.hp      ?? follower.hp.max;
		const loyalty = state.loyalty ?? 0;
		const armor   = state.armor   ?? follower.armor;
		const damage  = state.damage  ?? follower.damage;

		return new FollowerSnapshotBuilder()
			.withSlug(follower.slug)
			.withName(follower.name)
			.withNote(follower.note)
			.withHp(hp)
			.withHpMax(follower.hp.max)
			.withArmor(armor)
			.withDamage(damage)
			.withInstinct(this._buildInstinctSnapshot(follower, values))
			.withCost(follower.cost)
			.withLoyalty(loyalty)
			.withLoyaltyMax(follower.loyalty.max)
			.withOptions(follower.options ? ChoiceGroup.fromPackData(follower.options, values) : null)
			.withInstinctCustom(state.instinctCustom ?? "")
			.build();
	}

	_buildInstinctSnapshot(follower, values) {
		const raw = follower.instinct;
		if (!raw) return { type: "custom" };
		if (raw.slug && raw.list) {
			const group = ChoiceGroup.fromPackData(raw, values);
			return raw.list[0]?.type === "text"
				? { type: "text", group }
				: { type: "choices", group };
		}
		return { type: "custom" };
	}
}
