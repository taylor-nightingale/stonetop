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
		return this._state[slug] ?? { hp: null, loyalty: null, values: {} };
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

	async setHpMax(slug, hpMax) {
		await this._flags.setFlag("state", { ...this._state, [slug]: { ...this._stateFor(slug), hpMax } });
	}

	async setName(slug, name) {
		await this._flags.setFlag("state", { ...this._state, [slug]: { ...this._stateFor(slug), name } });
	}

	async setNote(slug, note) {
		await this._flags.setFlag("state", { ...this._state, [slug]: { ...this._stateFor(slug), note } });
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

	async setChoiceText(followerSlug, optionSlug, text) {
		const state = this._stateFor(followerSlug);
		let values = new ChoiceValues(state.values ?? {});
		values = values.set("choices", optionSlug, text);
		await this._flags.setFlag("state", { ...this._state, [followerSlug]: { ...state, values: values.toRaw() } });
	}

	async addCustomFollower() {
		const [blank] = await this._followerRepo.findBySlugs(["blank"]);
		if (!blank) throw new Error("Blank follower not found in compendium");
		const slug = `custom-${Date.now()}`;
		await this._flags.setFlag("state", {
			...this._state,
			[slug]: {
				name:     blank.name,
				note:     blank.note,
				hp:       blank.hp.max,
				hpMax:    blank.hp.max,
				armor:    blank.armor,
				damage:   blank.damage,
				loyalty:  0,
				values:   {},
			},
		});
		await this.addFollower(slug);
	}

	async buildSnapshot(extraSlugs = []) {
		const ownedSet = new Set(this.ownedSlugs);
		const slugs = this.ownedSlugs;
		const staticSlugs = extraSlugs.filter(s => !ownedSet.has(s));

		if (!slugs.length && !staticSlugs.length) return [];

		const found  = await this._followerRepo.findBySlugs([...new Set([...slugs, ...staticSlugs])]);
		const bySlug = Object.fromEntries(found.map(f => [f.slug, f]));

		const hasCustom = slugs.some(s => !bySlug[s]);
		const blank     = hasCustom ? (await this._followerRepo.findBySlugs(["blank"]))[0] ?? null : null;

		const result = slugs.map(slug => {
			const follower = bySlug[slug];
			return follower
				? this._buildFollowerSnapshot(follower)
				: this._buildCustomFollowerSnapshot(slug, blank);
		});

		for (const slug of staticSlugs) {
			const follower = bySlug[slug];
			if (follower) result.push(this._buildFollowerSnapshot(follower));
		}

		return result;
	}

	_buildFollowerSnapshot(follower) {
		const state   = this._stateFor(follower.slug);
		const values  = new ChoiceValues(state.values ?? {});
		const hp      = state.hp      ?? follower.hp.max;
		const hpMax   = state.hpMax   ?? follower.hp.max;
		const name    = state.name    ?? follower.name;
		const note    = state.note    ?? follower.note;
		const loyalty = state.loyalty ?? 0;
		const armor   = state.armor   ?? follower.armor;
		const damage  = state.damage  ?? follower.damage;

		return new FollowerSnapshotBuilder()
			.withSlug(follower.slug)
			.withName(name)
			.withNote(note)
			.withHp(hp)
			.withHpMax(hpMax)
			.withArmor(armor)
			.withDamage(damage)
			.withLoyalty(loyalty)
			.withLoyaltyMax(3)
			.withChoices(follower.choices ? ChoiceGroup.fromPackData(follower.choices, values) : null)
			.withArcanaSlug(follower.arcanaSlug)
			.build();
	}

	_buildCustomFollowerSnapshot(slug, blank) {
		const state   = this._stateFor(slug);
		const values  = new ChoiceValues(state.values ?? {});
		return new FollowerSnapshotBuilder()
			.withSlug(slug)
			.withName(state.name     ?? "New Follower")
			.withNote(state.note     ?? null)
			.withHp(state.hp         ?? 6)
			.withHpMax(state.hpMax   ?? 6)
			.withArmor(state.armor   ?? 0)
			.withDamage(state.damage ?? "d6")
			.withLoyalty(state.loyalty ?? 0)
			.withLoyaltyMax(3)
			.withChoices(blank?.choices ? ChoiceGroup.fromPackData(blank.choices, values) : null)
			.build();
	}
}
