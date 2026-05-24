import {
	PostDeathInsertSnapshotBuilder,
	PostDeathSectionSnapshotBuilder,
} from "../../model/snapshot/character/PostDeathInsertSnapshot.js";

export class CharacterPostDeath {
	constructor(insertFlags, instinct, lore, insertRepo, moves) {
		this._insertFlags = insertFlags;
		this._instinct = instinct;
		this._lore = lore;
		this._insertRepo = insertRepo;
		this._moves = moves;
	}

	get activeSlug() {
		return this._insertFlags.getFlag("slug") ?? null;
	}

	async setActiveSlug(s) {
		await this._insertFlags.setFlag("slug", s);
	}

	get instinct() {
		return this._instinct;
	}

	get lore() {
		return this._lore;
	}

	async setInsert(slug) {
		const previousSlug = this.activeSlug;
		if (previousSlug) {
			await this._moves.removeCategory(`post-death-${previousSlug}`);
		}
		await this.setActiveSlug(slug);
		if (slug) {
			const insert = await this._insertRepo.findBySlug(slug);
			const moveType = `post-death-${slug}`;
			await this._moves.addCategory(moveType, insert?.name ?? slug, slug);
		}
	}

	async buildSnapshot() {
		const slug = this.activeSlug;
		const allEntries = await this._insertRepo.getAll();

		let activeInsert = null;
		if (slug) {
			const data = await this._insertRepo.findBySlug(slug);
			if (data) {
				const moveType = `post-death-${slug}`;
				activeInsert = new PostDeathInsertSnapshotBuilder()
					.withSlug(data.slug)
					.withName(data.name)
					.withImg(data.img)
					.withDescription(data.description)
					.withInstinct(this._instinct.buildSnapshot(data.instinct))
					.withLore(this._lore.buildSnapshot(data.lore))
					.withMoves(this._moves.getMoveSnapshotsForCategory(moveType))
					.build();
			}
		}
		return new PostDeathSectionSnapshotBuilder()
			.withActiveSlug(slug)
			.withActiveInsert(activeInsert)
			.withAvailableInserts(allEntries)
			.build();
	}
}

