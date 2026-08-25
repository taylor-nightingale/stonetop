import { ReferenceTopics } from "../model/data/ReferenceTopics.js";

/**
 * The one sheet action behind every ? button: open Book I's advice for the topic the button names.
 *
 * On the actor sheet base, because the ? buttons sit on the surfaces a table plays from — the
 * steading and the character. Not edit-gated: it opens a read-only journal page and writes nothing,
 * and a player looking at a sheet they can't edit is exactly who asks how to get more of something.
 *
 * The advice is a journal page in the `reference` pack rather than a dialog built from strings, so
 * the window resizes, remembers its size, and offers the other topics in its sidebar — and the
 * moves and improvements the advice cites stay content links, as they were.
 */
const topics = new ReferenceTopics();

export const ADVICE_ACTIONS = {
	showAdvice(ev, target) {
		return topics.open(target.dataset.topic);
	},
};
