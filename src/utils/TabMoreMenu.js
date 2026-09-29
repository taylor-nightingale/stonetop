/**
 * A tab strip's "More" menu, which lists the tabs the strip has no room for (see TabStripFit).
 *
 * Its button opens and shuts it and says which through `aria-expanded`; ArrowDown on the button opens
 * it onto its first entry. Choosing a tab from it shuts it — the entry is a real tab button, so core
 * switches the tab — as do Escape, which gives the focus back to the button, and a click anywhere
 * else. A render rebuilds it shut.
 *
 * Delegated from a root that outlives re-renders, so it is wired once.
 */
export class TabMoreMenu {
	static BUTTON = ".stonetop-tab-more-btn";
	static MENU   = ".stonetop-tab-more-menu";
	static ENTRY  = ".stonetop-tab-more-item";

	attach(root) {
		root.addEventListener("click", event => {
			const button = event.target.closest?.(TabMoreMenu.BUTTON);
			if (button) return this.#toggle(button);
			if (event.target.closest?.(TabMoreMenu.ENTRY)) return this.#shutAll(root);
			this.#shutAll(root);
		});
		root.addEventListener("keydown", event => {
			const button = event.target.closest?.(TabMoreMenu.BUTTON);
			if (button && event.key === "ArrowDown") {
				event.preventDefault();
				this.#set(button, true);
				menuOf(button)?.querySelector(`${TabMoreMenu.ENTRY}:not([hidden])`)?.focus();
				return;
			}
			const menu = event.target.closest?.(TabMoreMenu.MENU);
			if (!menu || event.key !== "Escape") return;
			event.stopPropagation();
			const owner = buttonOf(menu);
			if (owner) {
				this.#set(owner, false);
				owner.focus();
			}
		});
	}

	#toggle(button) {
		this.#set(button, button.getAttribute("aria-expanded") !== "true");
	}

	#shutAll(root) {
		for (const button of root.querySelectorAll(`${TabMoreMenu.BUTTON}[aria-expanded="true"]`)) this.#set(button, false);
	}

	#set(button, open) {
		button.setAttribute("aria-expanded", String(open));
		const menu = menuOf(button);
		if (menu) menu.hidden = !open;
	}
}

const menuOf = button => button.ownerDocument.getElementById(button.getAttribute("aria-controls"));
const buttonOf = menu => menu.ownerDocument.querySelector(`${TabMoreMenu.BUTTON}[aria-controls="${menu.id}"]`);
