const SCOPE = "stonetop";

/** The flag every compiled pack document carries, naming the system version that built it. */
export const PACK_VERSION_FLAG = "packVersion";

const FIELD = `flags.${SCOPE}.${PACK_VERSION_FLAG}`;

/**
 * Answers whether the compendiums on disk belong to the system that is running.
 *
 * Foundry updates a system by extracting over the installed folder, and it holds every pack's LevelDB
 * open while a world is loaded — so an update can replace the code and leave the packs behind. The
 * result is a system that reads old content and believes it is current: the sheets render whatever the
 * stale pack says, and the migration faithfully copies it onto every character. Nothing else in the
 * system can notice this, because stale content is still perfectly well-formed content.
 */
export class PackVersionCheck {
	constructor(packs, systemVersion) {
		this._packs         = packs;
		this._systemVersion = systemVersion;
	}

	/** Every compendium this system ships — a world's or a module's packs are not ours to judge. */
	static systemPacks() {
		return [...(game.packs ?? [])].filter(pack =>
			pack?.metadata?.packageType === "system" && pack?.metadata?.packageName === SCOPE);
	}

	/** The labels of the packs built by a different version — empty when the install is coherent. */
	async stalePacks() {
		const stale = [];
		for (const pack of this._packs) {
			if (await this._isStale(pack)) stale.push(pack.metadata?.label ?? pack.collection);
		}
		return stale;
	}

	async _isStale(pack) {
		await pack.getIndex({ fields: [FIELD] });
		for (const entry of pack.index ?? []) {
			// Every document in a pack is stamped by the same build, so the first one answers for all. A
			// pack built before the stamp existed carries none, which reads as stale — and that is exactly
			// the install this was written to catch.
			return (foundry.utils.getProperty(entry, FIELD) ?? null) !== this._systemVersion;
		}
		return false;   // an empty pack has no content to be stale
	}
}
