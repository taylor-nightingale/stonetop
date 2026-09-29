/**
 * A tab to switch to once it exists — the insert tab a drop is about to create. Only the sheet the
 * insert was dropped on switches (D12); every other open sheet leaves its reader where they are.
 */
export class PendingTab {
	#id = null;

	set(id) {
		this.#id = id;
	}

	/** After a render: switch once the tab is in the markup, then forget it. */
	applyTo(root, changeTab) {
		if (!this.#id || !root?.querySelector?.(`.tab[data-tab="${this.#id}"]`)) return;
		changeTab(this.#id);
		this.#id = null;
	}
}
