/**
 * @property {string} key    - "weakened" | "dazed" | "miserable"
 * @property {string} name   - "Weakened" | "Dazed" | "Miserable"
 * @property {boolean} active
 * @property {string[]} stats - stat keys affected, e.g. ["str","dex"]
 * @property {string} description - what the debility means and which rolls it hinders (book p. 53)
 */
export class DebilitySnapshot {
	constructor(b) {
		this.key         = b._key;
		this.name        = b._name;
		this.active      = b._active;
		this.stats       = b._stats;
		this.description = b._description ?? "";
	}

	/**
	 * The description's first sentence — what the debility IS, without the clause saying which rolls
	 * it hinders.
	 *
	 * The book writes each of these as two sentences: "Out of it, befuddled, not thinking clearly.
	 * Take disadvantage when rolling +INT or +WIS." The second is already on the sheet twice over —
	 * the two stats it names are the two whose numbers turn red — so where the room is a line rather
	 * than a column, the first sentence is the half that says something new.
	 *
	 * Asked of the snapshot rather than cut in a template: where a sentence ends is a fact about the
	 * text, and a template that knew it would be the second place to fix when a translation writes
	 * one sentence, or three.
	 */
	get summary() {
		const end = this.description.indexOf(". ");
		return end === -1 ? this.description : this.description.slice(0, end + 1);
	}
}

export class DebilitySnapshotBuilder {
	withKey(v)         { this._key         = v; return this; }
	withName(v)        { this._name        = v; return this; }
	withActive(v)      { this._active      = v; return this; }
	withStats(v)       { this._stats       = v; return this; }
	withDescription(v) { this._description = v; return this; }
	build()            { return new DebilitySnapshot(this); }
}
