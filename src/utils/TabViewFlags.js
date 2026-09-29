/**
 * A sheet's view-only flags — the Level Up checklist open or shut. They are per-window state, never
 * the actor's, and every one of them travels the same path: a button names its flag, this flips it,
 * and the sheet hands the flags to the next render.
 *
 * The flags a sheet declares up front render as `false` rather than absent, so a template can ask
 * about one before it has ever been toggled; one a button names on the fly is created the first
 * time it is toggled.
 */
export class TabViewFlags {
	#flags = new Map();

	constructor(names = []) {
		for (const name of names) this.#flags.set(name, false);
	}

	get(name) {
		return this.#flags.get(name) ?? false;
	}

	toggle(name) {
		const next = !this.get(name);
		this.#flags.set(name, next);
		return next;
	}

	/**
	 * Flip the flag a button names, and decorate the button with the result.
	 *
	 * @returns {boolean} whether the sheet has to re-render: it does whenever a flag changed, since a
	 * flag changes what the template emits.
	 */
	toggleFrom(target) {
		const { viewFlag } = target.dataset;
		if (!viewFlag) return false;
		target.classList.toggle("is-active", this.toggle(viewFlag));
		return true;
	}

	/** The flags as the render context sees them: `{{#if viewFlags.levelUpOpen}}`. */
	toContext() {
		return Object.fromEntries(this.#flags);
	}
}
