/**
 * What a playbook is called on the front page.
 *
 * Usually its own name. The Would-be Hero is the exception the book writes into a move: Big Damn Hero
 * "crosses off 'Would-be' on the front page", so a character who has taken it plays The Hero. The move
 * that does it and the name it leaves behind are the playbook's own data (`system.renameOnMove`), not
 * a slug this file knows.
 */
export class PlaybookTitle {
	static from(playbookData) {
		return new PlaybookTitle(playbookData?.name ?? null, playbookData?.renameOnMove ?? null);
	}

	constructor(name, renameOnMove) {
		this._name   = name ?? null;
		this._rename = renameOnMove ?? null;
	}

	/** @param {Set<string>} acquiredSlugs - the moves this character has actually taken. */
	titleFor(acquiredSlugs) {
		return this._isRenamedBy(acquiredSlugs) ? this._rename.name : this._name;
	}

	_isRenamedBy(acquiredSlugs) {
		const { moveSlug, name } = this._rename ?? {};
		return Boolean(moveSlug && name && acquiredSlugs?.has(moveSlug));
	}
}
