// Hover-revealed ▲▼ stepper for number inputs. Any `input.stonetop-step` is wrapped (once)
// in a positioning span with two buttons that increment/decrement the value, respecting
// min/max/step, and dispatch a native `change` event so the field's own handler saves.
// The buttons are absolutely positioned and only shown on hover, so they don't affect layout.
export function activateSteppers(root) {
	if (!root) return;
	for (const input of root.querySelectorAll("input.stonetop-step")) {
		if (input.parentElement?.classList.contains("stonetop-stepper")) continue; // already wrapped

		const wrap = document.createElement("span");
		wrap.className = "stonetop-stepper";
		input.replaceWith(wrap);
		wrap.appendChild(input);

		wrap.appendChild(_stepButton(input, +1, "▲", "up"));
		wrap.appendChild(_stepButton(input, -1, "▼", "down"));
	}
}

function _stepButton(input, dir, glyph, kind) {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.tabIndex = -1;
	btn.className = `stonetop-stepper-btn stonetop-stepper-btn--${kind}`;
	btn.textContent = glyph;
	btn.addEventListener("click", ev => {
		ev.preventDefault();
		ev.stopPropagation();
		const stepBy = Number(input.step) || 1;
		const hasMin = input.min !== "";
		const hasMax = input.max !== "";
		let next = (Number(input.value) || 0) + dir * stepBy;
		if (hasMin) next = Math.max(next, Number(input.min));
		if (hasMax) next = Math.min(next, Number(input.max));
		input.value = String(next);
		input.dispatchEvent(new Event("change", { bubbles: true }));
	});
	return btn;
}
