/**
 * Which inventory a shared outfit row belongs to: the character's own, or one follower's.
 *
 * The same outfit-items partial renders both the character's inventory tab and the catalog inside
 * a follower card, so a row's owner is decided by whether it sits inside a
 * `.stonetop-follower-inventory` wrapper. This names that answer instead of passing a bare
 * `string | null` around, where `null` silently meant "the character".
 */
export class InventoryOwner {
	static #character = null;

	/** The character's own inventory. */
	static character() {
		return this.#character ??= new InventoryOwner(null);
	}

	/** One follower's inventory. */
	static follower(slug) {
		return new InventoryOwner(slug);
	}

	/** Read the owner off any element inside a rendered inventory row. */
	static fromElement(el) {
		const slug = el?.closest?.(".stonetop-follower-inventory")?.dataset.slug ?? null;
		return slug ? this.follower(slug) : this.character();
	}

	constructor(followerSlug) {
		this.followerSlug = followerSlug;
	}

	get isFollower() {
		return this.followerSlug !== null;
	}
}
