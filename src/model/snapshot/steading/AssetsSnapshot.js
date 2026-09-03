/**
 * The three asset lists a steading owns, as the Play tab draws them: the general `items` (each with
 * its requisitioned state), the resources backing Prosperity, the fortifications backing Defenses,
 * and coinage.
 *
 * `requisitionedCount` rides along because "2 out" belongs beside the militia when someone asks what
 * is left to defend the place with — and because it is a fact about the list, not about the markup.
 */
export class AssetsSnapshot {
	constructor({ items = [], resources = [], fortifications = [], coinage = [] } = {}) {
		this.items = items;
		this.resources = resources;
		this.fortifications = fortifications;
		this.coinage = coinage;
	}

	get requisitionedCount() {
		return this.items.filter(item => item.requisitioned).length;
	}

	/** "2 out", or "" when nothing is — a heading note that restates zero is noise. */
	get requisitionedNote() {
		const count = this.requisitionedCount;
		return count ? game.i18n.format("stonetop.steading.lists.assetsOut", { count }) : "";
	}
}
