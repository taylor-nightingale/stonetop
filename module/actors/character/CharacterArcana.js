import {
	ArcanaBackOptionSnapshotBuilder, ArcanaSnapshot, ArcanaSectionSnapshot,
	ArcanaUnlockOptionSnapshotBuilder, ArcanaUnlockTextItem,
	ArcanumBackMoveSnapshot, ArcanumUnlockSection,
	MinorArcanumBackSnapshotBuilder, MinorArcanumFrontSnapshotBuilder,
	MinorArcanumSnapshotBuilder,
	ResourceBuilder,
} from "../../model/CharacterSnapshot.js";

export class CharacterArcana {
	constructor(flags, arcanaRepo) {
		this._flags = flags;
		this._arcanaRepo = arcanaRepo;
	}

	get ownedSlugs()      { return new Set(this._flags.getFlag("owned") ?? []); }
	get flippedSlugs()    { return new Set(this._flags.getFlag("flipped") ?? []); }
	get unlockCounts()    { return this._flags.getFlag("unlock") ?? {}; }
	get backOptionCounts(){ return this._flags.getFlag("backOptions") ?? {}; }
	get resources()       { return this._flags.getFlag("resources") ?? {}; }

	async buildSnapshot() {
		const ownedSlugs       = this.ownedSlugs;
		const flippedSlugs     = this.flippedSlugs;
		const unlockCounts     = this.unlockCounts;
		const backOptionCounts = this.backOptionCounts;
		const resourceCounts   = this.resources;

		const fetchedItems = await this._arcanaRepo.findBySlugs([...ownedSlugs]);

		const minorItems = fetchedItems.map(item => {
			const flipped = flippedSlugs.has(item.slug);

			const unlockItems = item.front.unlock.requirements.map(li => {
				if (li.type === "text") return new ArcanaUnlockTextItem(li.content);
				const count = unlockCounts[`${item.slug}:${li.slug}`] ?? 0;
				return new ArcanaUnlockOptionSnapshotBuilder()
					.withSlug(li.slug)
					.withDescription(li.description)
					.withCount(count)
					.withMax(li.max ?? 1)
					.withSelected(count > 0)
					.build();
			});

			const front = new MinorArcanumFrontSnapshotBuilder()
				.withTitle(item.front.title)
				.withWeight(item.front.weight ?? null)
				.withNote(item.front.note ?? null)
				.withDescription(item.front.description)
				.withUnlock(new ArcanumUnlockSection(item.front.unlock.description, unlockItems))
				.build();

			const backOpts = (item.back.options ?? []).map(o => {
				const count = backOptionCounts[`${item.slug}:${o.slug}`] ?? 0;
				return new ArcanaBackOptionSnapshotBuilder()
					.withSlug(o.slug)
					.withDescription(o.description)
					.withCount(count)
					.withMax(o.max ?? 1)
					.withSelected(count > 0)
					.build();
			});

			const backResource = item.back.resource
				? new ResourceBuilder()
					.withCurrent(resourceCounts[item.slug] ?? 0)
					.withMax(item.back.resource.max ?? null)
					.withMaxStat(item.back.resource.maxStat ?? null)
					.withTitle(item.back.resource.title ?? null)
					.withLabels(item.back.resource.labels ?? [])
					.build()
				: null;

			const backMove = item.back.move
				? new ArcanumBackMoveSnapshot(
					item.back.move.name,
					item.back.move.rollType ?? null,
					item.back.move.description)
				: null;

			const back = new MinorArcanumBackSnapshotBuilder()
				.withTitle(item.back.title)
				.withWeight(item.back.weight ?? null)
				.withNote(item.back.note ?? null)
				.withDescription(item.back.description)
				.withResource(backResource)
				.withMove(backMove)
				.withOptions(backOpts)
				.build();

			return new MinorArcanumSnapshotBuilder()
				.withSlug(item.slug)
				.withFront(front)
				.withBack(back)
				.withOwned(true)
				.withFlipped(flipped)
				.build();
		});

		const minor = new ArcanaSectionSnapshot("Minor Arcana", minorItems);
		const major = new ArcanaSectionSnapshot("Major Arcana", []);
		return new ArcanaSnapshot(minor, major);
	}

	async addArcanum(slug) {
		const slugsWeHae = this.ownedSlugs;
		slugsWeHae.add(slug);
		await this._flags.setFlag("owned", [...slugsWeHae]);
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
