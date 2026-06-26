// ── CharacterCreationDialog ──────────────────────────────────────────────────
// The player-facing first step of character creation. When the GM mints a fresh
// character from the Welcome guide, the owning client greets the player with this
// modal instead of dropping them onto a blank sheet (see _maybeOpenCharacterCreation
// in hooks/Ready.js). Its single "Create Character" button hands off to the sheet's
// guided flow — the playbook picker, then onboarding — and asks that flow to open
// the finished sheet once the player is done (see _onNewCharacter's
// `openSheetWhenDone`). Until then, the player never sees an empty sheet.

export class CharacterCreationDialog extends Application {
	constructor(actor, options = {}) {
		super(options);
		this._actor = actor;
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:       "stonetop-character-creation",
			template: "systems/stonetop/templates/dialogs/character-creation.hbs",
			title:    "Create Your Character",
			width:    480,
			height:   "auto",
			resizable: true,
			classes:  ["stonetop", "stonetop-charintro-dialog"],
		});
	}

	getData() {
		return {
			playerName:    game.user?.name ?? "",
			characterName: this._actor?.name ?? "",
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".stonetop-charintro-create").on("click", () => this._onCreate());
	}

	// Kick off the sheet's guided creation flow (picker → onboarding), asking it to
	// pop the sheet open when the player finishes, then close this intro so the
	// picker has the screen to itself. The sheet instance exists even though it has
	// never been rendered — `actor.sheet` instantiates it lazily.
	_onCreate() {
		this._actor?.sheet?._onNewCharacter?.({ openSheetWhenDone: true });
		this.close();
	}
}
