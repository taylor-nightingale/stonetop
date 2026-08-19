// Hover-revealed ▲▼ stepper for number inputs.
//
// The markup — a `.stonetop-stepper` wrapper holding the `.stonetop-step` input and the two buttons
// — is emitted by the templates (see templates/actor/partials/stepper-buttons.hbs). This wires ONE
// delegated listener for the whole sheet.
//
// It used to build that markup in JS after every render. Core replaces part content wholesale, so
// the "already wrapped" guard never hit: every stepper on the sheet was torn down and rebuilt —
// nodes, listeners and all — on every single render.

const BUTTON = ".stonetop-stepper-btn";

/** Wire the delegated stepper handler onto a sheet root. Call once, on first render. */
export function activateSteppers(root) {
	if (!root) return;
	root.addEventListener("click", ev => {
		const btn = ev.target.closest?.(BUTTON);
		if (!btn) return;
		// The buttons sit inside rows that carry their own click handling.
		ev.preventDefault();
		ev.stopPropagation();
		step(btn);
	}, true);
}

function step(btn) {
	const input = btn.closest(".stonetop-stepper")?.querySelector("input.stonetop-step");
	if (!input || input.disabled) return;

	const dir     = Number(btn.dataset.stepDir) || 0;
	const stepBy  = Number(input.step) || 1;
	const hasMin  = input.min !== "";
	const hasMax  = input.max !== "";

	let next = (Number(input.value) || 0) + dir * stepBy;
	if (hasMin) next = Math.max(next, Number(input.min));
	if (hasMax) next = Math.min(next, Number(input.max));

	input.value = String(next);
	// The value is what the sheet persists, so stepping has to look like typing.
	input.dispatchEvent(new Event("change", { bubbles: true }));
}
