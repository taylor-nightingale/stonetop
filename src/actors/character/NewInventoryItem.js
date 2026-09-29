/**
 * An item the player is adding to an inventory: a name, the ◇ it weighs (a small item has none — it
 * carries a □ and no load), a track of uses with an optional word under its last box, its tags and a
 * note. `resource` is that track in the shape the pack's own gear stores it (Naphtha:
 * `{ max: 3, title: null, labels: ["", "", "uses"] }`).
 */
export class NewInventoryItem {
	constructor(name, { isRegular = true, weight = 1, uses = 0, usesWord = "", tags = [], note = null } = {}) {
		this.name      = name;
		this.isRegular = isRegular;
		this.weight    = isRegular ? weight : 0;
		this.uses      = uses;
		this.usesWord  = usesWord;
		this.tags      = [...tags];
		this.note      = note;
	}

	static regular(name, weight = 1, extras = {}) {
		return new NewInventoryItem(name, { ...extras, isRegular: true, weight });
	}

	static small(name, extras = {}) {
		return new NewInventoryItem(name, { ...extras, isRegular: false });
	}

	get resource() {
		if (!(this.uses > 0)) return null;
		const labels = this.usesWord ? [...Array(this.uses - 1).fill(""), this.usesWord] : [];
		return { max: this.uses, title: null, labels };
	}
}
