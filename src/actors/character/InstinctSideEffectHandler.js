import { buildChoiceGroup } from "../../model/snapshot/character/buildChoiceGroup.js";
import { InstinctController } from "./InstinctController.js";

/**
 * A character has ONE instinct, but more than one document offers it: the playbook, and any insert
 * that replaces it (the Revenant's Denial, the Thrall's Fascination). Whatever an insert's instinct
 * becomes — an option picked there or a line written in — becomes the character's, so the playbook's
 * write-in box always reads back what the character is actually driven by.
 *
 * Subscribes to choice writes and decides relevance itself: instinct writes only, and only from an
 * insert. That last part is also what stops the echo — mirroring writes to the playbook, whose own
 * publish comes straight back through here.
 */
export class InstinctSideEffectHandler {
	constructor(playbook) {
		this._playbook = playbook;
	}

	async handle(change) {
		if (change.namespace !== "instinct" || change.item?.type !== "insert") return;
		const group = change.groupDef ? buildChoiceGroup(change.groupDef, change.values) : null;
		await this._playbook.selectCustomInstinct(InstinctController.computeSelected(group, change.values) ?? "");
	}
}
