import { FrontOnOpen } from "../../../utils/front-on-open.js";

// ── FollowerFateDialog ───────────────────────────────────────────────────────
// A follower has dropped to 0 HP. Two distinct cases:
//   • The Ranger's animal companion is the exception (Book I p.469 → Loyal to the
//     End, p.143): roll +0 — with advantage if it holds Loyalty — to learn its fate
//     (10+ fine once it heals; 7-9 takes the injured tag; 6- injured and dying unless
//     saved). This REPLACES the usual choice; it is the companion's move and no other
//     follower gets it.
//   • Every other follower (crew, initiates, beasts, custom — even loyal ones) uses
//     the standard p.469 fate, the GM's call: dead / Death's Door / dying (or just out
//     of the action if the blow wasn't lethal — close the dialog).
//
// Opened automatically when a named single follower (animal companion / initiate /
// beast / custom) crosses from alive to 0 HP. `ctx.isAnimalCompanion` selects which
// set of options to show. Emits the chosen outcome key; the sheet applies the effect
// (loyalty spend / XP / chat note) — see StonetopCharacterSheet._resolveFollowerFate.

export class FollowerFateDialog extends Application {
	/**
	 * @param {Actor}    actor
	 * @param {object}   ctx      - { name, loyalty, isAnimalCompanion }
	 * @param {Function} onChoose - (actionKey) => void
	 */
	constructor(actor, ctx, onChoose, options = {}) {
		super(options);
		this._actor       = actor;
		this._ctx         = ctx ?? {};
		this._onChoose    = onChoose;
		this._frontOnOpen = new FrontOnOpen(this);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-follower-fate",
			title:     "Follower Down",
			template:  "systems/stonetop/templates/dialogs/follower-fate.hbs",
			width:     460,
			height:    "auto",
			resizable: true,
			classes:   ["stonetop", "stonetop-spring-dialog", "stonetop-follower-fate-dialog"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
		this.setPosition({ height: "auto" });
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		return super.close(options);
	}

	getData() {
		const loyalty = Math.max(0, Number(this._ctx.loyalty) || 0);
		// Loyal to the End is the Ranger's animal-companion move and replaces the usual
		// fate choice for it; every other follower gets the standard p.469 options.
		const loyalToTheEnd = !!this._ctx.isAnimalCompanion;
		return {
			followerName: this._ctx.name || "Your follower",
			loyalToTheEnd,
			// The roll is +0 but gets advantage while the companion still holds Loyalty.
			hasLoyalty:   loyalToTheEnd && loyalty > 0,
			loyalty,
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();
		html.find(".stonetop-ff-option").on("click", ev => {
			const action = ev.currentTarget.dataset.action;
			this._onChoose?.(action);
			this.close();
		});
		html.find(".stonetop-ff-cancel").on("click", () => this.close());
	}
}
