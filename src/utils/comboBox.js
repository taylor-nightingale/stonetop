// Inline-expanding combobox for Selection fields (instinct, cost, tags, member tags/traits).
// You can TYPE a custom value directly in the input, and a ▾ drops the FULL option list — never
// filtered by what's typed. The list expands in normal document flow (it pushes content down),
// so unlike an absolutely-positioned dropdown it can't be clipped by the follower card's
// per-child stacking contexts / overflow — the bug that broke earlier dropdown attempts.
//
// Saving is delegated: picking an option (or pressing Enter) sets the input value and fires the
// input's `change`, so the field's own listener saves it (single-select replaces; the tag adder
// toggles/adds). This util only manages open/close + feeding the input.
export function activateComboBoxes(root) {
	const listIn  = el => el.closest(".stonetop-combo")?.querySelector(".stonetop-combo-list");
	const inputIn = el => el.closest(".stonetop-combo")?.querySelector(".stonetop-combo-input");
	const hideAll = except => root.querySelectorAll(".stonetop-combo-list").forEach(l => { if (l !== except) l.hidden = true; });

	// Open the list when its input gains focus (so typing shows the options).
	root.addEventListener("focusin", ev => {
		const input = ev.target.closest?.(".stonetop-combo-input");
		if (!input) return;
		const list = listIn(input);
		if (list) { hideAll(list); list.hidden = false; }
	});

	// Pressing an option must not blur-close the input before the click lands.
	root.addEventListener("mousedown", ev => {
		if (ev.target.closest(".stonetop-combo-option")) ev.preventDefault();
	});

	root.addEventListener("click", ev => {
		const toggle = ev.target.closest(".stonetop-combo-toggle");
		if (toggle) {
			ev.preventDefault();
			const list = listIn(toggle);
			if (!list) return;
			const open = list.hidden;
			hideAll();
			list.hidden = !open;
			if (!list.hidden) inputIn(toggle)?.focus();
			return;
		}
		const option = ev.target.closest(".stonetop-combo-option");
		if (option) {
			const input = inputIn(option);
			if (input) {
				input.value = option.dataset.value ?? option.textContent.trim();
				input.dispatchEvent(new Event("change", { bubbles: true }));
			}
			const list = listIn(option);
			if (list) list.hidden = true;
			return;
		}
		if (!ev.target.closest(".stonetop-combo")) hideAll();
	});

	root.addEventListener("keydown", ev => {
		const input = ev.target.closest?.(".stonetop-combo-input");
		if (!input) return;
		const list = listIn(input);
		if (ev.key === "Enter") {
			ev.preventDefault();
			input.dispatchEvent(new Event("change", { bubbles: true }));
			if (list) list.hidden = true;
		} else if (ev.key === "Escape") {
			if (list) list.hidden = true;
		}
	});

	// Close once focus has left the combo entirely (rAF lets focus settle on the new target).
	root.addEventListener("focusout", ev => {
		const combo = ev.target.closest?.(".stonetop-combo");
		if (!combo) return;
		requestAnimationFrame(() => {
			if (!combo.contains(document.activeElement)) {
				const list = combo.querySelector(".stonetop-combo-list");
				if (list) list.hidden = true;
			}
		});
	});
}
