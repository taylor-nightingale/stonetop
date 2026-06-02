import { ChoiceGroup, ChoiceValues } from "../../model/snapshot/character/ChoiceGroup.js";

export class ChoiceGroupController {
	constructor(flags, followers) {
		this._flags     = flags;
		this._followers = followers;
	}

	get _values() {
		return new ChoiceValues(this._flags.getFlag("values") ?? {});
	}

	async addGroup(namespace, groupData) {
		const seen = new Set();
		for (const item of groupData.list) {
			if (!item.slug) continue;
			if (seen.has(item.slug)) throw new Error(`Duplicate slug "${item.slug}" in group "${namespace}"`);
			seen.add(item.slug);
		}
		await this._flags.setFlag("groupDefs", { ...(this._flags.getFlag("groupDefs") ?? {}), [namespace]: groupData });
	}

	buildGroupSnapshot(namespace) {
		const groupData = (this._flags.getFlag("groupDefs") ?? {})[namespace];
		if (!groupData) return null;
		return ChoiceGroup.fromPackData({ slug: namespace, list: groupData.list }, this._values);
	}

	async selectOption(namespace, slug, siblingSlugsCsv) {
		let values = this._values;
		if (siblingSlugsCsv) {
			for (const sib of siblingSlugsCsv.split(",")) values = values.set(namespace, sib, 0);
		}
		await this._flags.setFlag("values", values.set(namespace, slug, 1).toRaw());
	}

	async setCount(namespace, optionSlug, count) {
		await this._flags.setFlag("values", this._values.set(namespace, optionSlug, count).toRaw());
	}

	async setFollowerCount(namespace, optionSlug, count) {
		await this.setCount(namespace, optionSlug, count);
		if (count > 0) await this._followers.addFollower(optionSlug);
		else           await this._followers.removeFollower(optionSlug);
	}

	async setText(namespace, optionSlug, text) {
		await this._flags.setFlag("values", this._values.set(namespace, optionSlug, text).toRaw());
	}

	async clearValues(namespace) {
		const raw = { ...this._values.toRaw() };
		delete raw[namespace];
		await this._flags.setFlag("values", raw);
	}
}
