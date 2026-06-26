import { bringDialogToFront } from "../utils/front-on-open.js";

/**
 * Prompt for a one-off situational modifier to add to a 2d6 move/stat roll —
 * a held bonus, a GM-granted +1, a circumstantial penalty, etc. Resolves to the
 * chosen integer (0 when left blank), or `null` if the player cancels or dismisses
 * the dialog so the caller can abort the roll. The chosen value flows through the
 * roll engine as its existing "situational" modifier (it shows a Situational pill
 * on the result card).
 *
 * Gated by the "Prompt for Roll Modifier" client setting; callers skip it on a
 * Shift-click for a quick, unmodified roll.
 *
 * @param {object} [opts]
 * @param {string} [opts.title]  Dialog title — usually the move/stat name.
 * @returns {Promise<number|null>}
 */
export function promptRollModifier({ title = "Roll Modifier" } = {}) {
	return new Promise(resolve => {
		let settled = false;
		const settle = value => { if (!settled) { settled = true; resolve(value); } };

		const readMod = root => {
			const n = Math.trunc(Number(root?.querySelector?.('[name="modifier"]')?.value));
			return Number.isFinite(n) ? n : 0;
		};

		const dialog = new Dialog({
			title,
			content: `<form class="stonetop-roll-modifier-form">
				<p class="stonetop-roll-modifier-prompt">Add a one-off modifier to this roll (forward, a held bonus, a GM-granted +1, a penalty&hellip;).</p>
				<div class="stonetop-roll-modifier-stepper">
					<button type="button" class="stonetop-roll-modifier-step" data-step="-1" aria-label="Decrease">&minus;</button>
					<input type="number" name="modifier" value="0" step="1" inputmode="numeric" autocomplete="off">
					<button type="button" class="stonetop-roll-modifier-step" data-step="1" aria-label="Increase">+</button>
				</div>
			</form>`,
			// Affirmative on the left, cancel on the right (Foundry button order).
			buttons: {
				roll:   { label: "Roll",   callback: html => settle(readMod(html[0] ?? html)) },
				cancel: { label: "Cancel", callback: () => settle(null) },
			},
			default: "roll",
			close: () => settle(null),
			render: html => {
				bringDialogToFront(html);
				const root = html[0] ?? html;
				const input = root.querySelector('[name="modifier"]');
				root.querySelectorAll(".stonetop-roll-modifier-step").forEach(btn => {
					btn.addEventListener("click", () => {
						input.value = String((Math.trunc(Number(input.value)) || 0) + Number(btn.dataset.step));
						input.focus();
					});
				});
				input?.focus();
				input?.select?.();
			},
		}, { classes: ["dialog", "stonetop", "stonetop-roll-modifier-dialog"], width: 340 });

		dialog.render(true);
	});
}
