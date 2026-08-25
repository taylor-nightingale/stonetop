import { AdviceDialog } from "./AdviceDialog.js";

/**
 * The one sheet action behind every ? button: open Book I's advice for the topic the button names.
 *
 * On the actor sheet base, because the ? buttons sit on the surfaces a table plays from — the
 * steading and the character. Not edit-gated: it opens a read-only window and writes nothing, and a
 * player looking at a sheet they can't edit is exactly who asks how to get more of something.
 */
export const ADVICE_ACTIONS = {
	showAdvice(ev, target) {
		return new AdviceDialog().show(target.dataset.topic);
	},
};
