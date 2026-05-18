export class CharacterArcana {
	constructor(flags) {
		this._flags = flags;
	}

	get ownedSlugs()      { return new Set(this._flags.getFlag("owned") ?? []); }
	get flippedSlugs()    { return new Set(this._flags.getFlag("flipped") ?? []); }
	get unlockCounts()    { return this._flags.getFlag("unlock") ?? {}; }
	get backOptionCounts(){ return this._flags.getFlag("backOptions") ?? {}; }
	get resources()       { return this._flags.getFlag("resources") ?? {}; }

	async addArcanum(slug) {
		const s = this.ownedSlugs;
		s.add(slug);
		await this._flags.setFlag("owned", [...s]);
	}

	async removeArcanum(slug) {
		const s = this.ownedSlugs;
		s.delete(slug);
		await this._flags.setFlag("owned", [...s]);
	}

	async flipArcanum(slug) {
		const s = this.flippedSlugs;
		s.add(slug);
		await this._flags.setFlag("flipped", [...s]);
	}

	async unflipArcanum(slug) {
		const s = this.flippedSlugs;
		s.delete(slug);
		await this._flags.setFlag("flipped", [...s]);
	}

	async setUnlockCount(arcanumSlug, optionSlug, count) {
		const key = `${arcanumSlug}:${optionSlug}`;
		await this._flags.setFlag("unlock", { ...this.unlockCounts, [key]: count });
	}

	async setBackOptionCount(arcanumSlug, optionSlug, count) {
		const key = `${arcanumSlug}:${optionSlug}`;
		await this._flags.setFlag("backOptions", { ...this.backOptionCounts, [key]: count });
	}

	async setResource(slug, count) {
		await this._flags.setFlag("resources", { ...this.resources, [slug]: count });
	}
}
