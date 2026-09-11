import {StonetopCharacter} from "./character/StonetopCharacter.js";
import {StonetopSteading} from "./steading/StonetopSteading.js";
import {StonetopNpc} from "./npc/StonetopNpc.js";
import {ActorRolling} from "./ActorRolling.js";
import {RollRequest} from "./RollRequest.js";

export function createStonetopActorClass(BaseActor) {
	return class StonetopActor extends BaseActor {
		_typedActor;

		constructor(...args) {
			super(...args);
		}

		get typedActor() {
			if (this._typedActor) return this._typedActor;

			switch (this.type) {
				case "character":
					this._typedActor = StonetopCharacter.create(this);
					break;
				case "npc":
					this._typedActor = StonetopNpc.create(this);
					break;
				case "steading":
					this._typedActor = new StonetopSteading(this);
					break;
			}

			return this._typedActor;
		}

		get _rolling() {
			return this.__rolling ??= new ActorRolling(this);
		}

		// -- Lifecycle ---------------------------------------------

		async _onRoll(event) {
			const die         = event.target.closest("[data-roll]");
			const rollStat    = die?.dataset.roll || null;
			const itemId      = event.target.closest(".item")?.dataset.itemId;
			const item        = itemId ? this.items.get(itemId) : null;

			// A row can name its move by SLUG instead — the moves an improvement confers are resolved
			// from the pack rather than seeded, so they have no owned id. Without this the die would
			// fall through to a bare stat roll: the right bonus, none of the move's result tiers.
			if (!item && die?.dataset.moveSlug) return this.typedActor.rollMoveBySlug(die.dataset.moveSlug);

			if (itemId && !item) return false;
			if (!rollStat && !item) return false;

			const rollMode = this.typedActor.rollMode;

			const request = item
				? RollRequest.fromItem(item, rollStat, rollMode)
				: RollRequest.fromStat(rollStat, rollMode);

			await this._rolling.execute(request);
			return true;
		}

		// Roll an owned item the way a click on its die would, for a caller that has the item rather
		// than an event — the seasonal turn, which rolls Seasons Change on the steading's behalf. The
		// same RollRequest and the same execute as _onRoll, so the chat card is identical.
		async rollItem(item, rollStat = null) {
			await this._rolling.execute(RollRequest.fromItem(item, rollStat, this.typedActor.rollMode));
		}

		// Roll stated dice with no result tiers — a season step that asks for 1d4+Population, not for
		// a move. Returns the evaluated roll WITHOUT posting: a season step moves Surplus by what its
		// dice came to, and its card says what that did, so the applying happens between the two.
		async evaluateFormula(formula) {
			return this._rolling.evaluateFormula(formula);
		}

		// Report one of those rolls — a FormulaRollCard. Same chat pipeline as every other card.
		async postFormulaCard(card) {
			return this._rolling.postFormulaCard(card);
		}

		// Post an owned item's full text (description + all result tiers) to chat, without rolling.
		async sendItemToChat(item) {
			await this._rolling.execute(RollRequest.fromItem(item, null, "normal"), {descriptionOnly: true});
		}

		// Post bare text to chat as this actor — for content with no item behind it (inline arcanum moves).
		async sendDescriptionToChat(label, description) {
			await this._rolling.postDescription(label, description);
		}

		// Foundry runs these on EVERY connected client. The typed dispatch below grants (playbook
		// moves, followers, inserts, possessions) and revokes — all writes — so it belongs to the
		// client that made the change alone, same as the CreateActor hook. Unguarded, a GM and a
		// player both grant the dropped playbook and its moves land once per client. `super` still
		// runs everywhere: that's core's own bookkeeping, not ours.
		//
		// A migration writes the state it has already decided on, so it opts out entirely: letting a
		// pruned duplicate re-enter revoke would take the surviving copy's grants with it.
		async _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
			await super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);
			if (game.user?.id !== userId || options?.stonetopMigration) return;
			if (this.typedActor.type === "character" && collection === "items") {
				await this.typedActor._onCreateDescendantDocuments(documents);
			}
		}

		async _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
			await super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);
			if (game.user?.id !== userId || options?.stonetopMigration) return;
			if (this.typedActor.type === "character" && collection === "items") {
				await this.typedActor._onDeleteDescendantDocuments(documents);
			}
		}
	};
}
