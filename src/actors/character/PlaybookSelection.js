/**
 * Which playbook this character has chosen.
 *
 * One fact, owned in one place. `CharacterPlaybook` is the behaviour — selecting, granting moves,
 * wiring backgrounds — and holding all of that just to read a slug is what put a cycle through the
 * subsystem graph. Anything that needs only the identity depends on this instead: it holds nothing
 * but the actor, so it can close no cycle.
 *
 * It is also the only writer of `system.playbookSlug`.
 */
export class PlaybookSelection {
	constructor(actor) {
		this._actor = actor;
	}

	get slug() {
		return this._actor?.system?.playbookSlug || null;
	}

	get isChosen() {
		return this.slug !== null;
	}

	async select(slug) {
		await this._actor.update({ "system.playbookSlug": slug ?? null });
	}
}
