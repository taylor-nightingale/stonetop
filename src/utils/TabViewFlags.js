/**
 * A sheet's view-only flags — "selected moves only", "playbook locked", "this insert locked". They
 * are per-window state, never the actor's, and every one of them travels the same path: a toolbar
 * button names its flag, this flips it, and the sheet hands the flags to the next render.
 *
 * The flags a sheet declares up front render as `false` rather than absent, so a template can ask
 * about one before it has ever been toggled. Flags a button names on the fly (one per insert tab,
 * whose slugs aren't known until the actor is read) are created the first time they are toggled.
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
	 * Flip the flag a toolbar button names, and decorate the button with the result.
	 *
	 * @returns {boolean} whether the sheet has to re-render. A button that names a css class is
	 * asking for the cheap path — the class goes straight onto the live tab, which is what lets the
	 * moves filter hide rows without rebuilding the largest tab on the sheet. Anything else changes
	 * what the template emits, so it re-renders.
	 */
	toggleFrom(target) {
		const { viewFlag, viewClass } = target.dataset;
		if (!viewFlag) return false;
		const on = this.toggle(viewFlag);
		target.classList.toggle("is-active", on);
		if (!viewClass) return true;
		target.closest(".tab")?.classList.toggle(viewClass, on);
		return false;
	}

	/** The flags as the render context sees them: `{{#if viewFlags.playbookLocked}}`. */
	toContext() {
		return Object.fromEntries(this.#flags);
	}
}
