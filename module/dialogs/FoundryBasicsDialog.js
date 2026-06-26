import { attachFrontOnOpen } from "../utils/front-on-open.js";
import { openOrFocus } from "../utils/open-or-focus.js";

// ── FoundryBasicsDialog ──────────────────────────────────────────────────────
// A GM-only, plain-language primer on how Foundry VTT works for someone who has
// never run a game in it — framed around how *this* world is set up. It answers
// the questions a first-time GM trips over: why the compendium can't be edited,
// why the Stonetop journals are already in their world, and how to get a monster
// onto the table (import it; the copy is theirs to edit and track). The content
// is static, so this is just a reader — opened from the "New to Foundry?" link on
// the Welcome guide (see templates/dialogs/welcome.hbs / WelcomeDialog).

export class FoundryBasicsDialog extends Application {
	constructor(options = {}) {
		super(options);
		// Spawned from the Welcome guide (itself a floating window) — keep this reader
		// above it the same way SpringBurstDialog does, so clicking back to the guide
		// doesn't bury the primer. attachFrontOnOpen wraps render/activate/close for us.
		attachFrontOnOpen(this);
	}

	static open() {
		return openOrFocus("stonetop-foundry-basics", () => new FoundryBasicsDialog().render(true));
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-foundry-basics",
			title:     "New to Foundry?",
			template:  "systems/stonetop/templates/dialogs/foundry-basics.hbs",
			width:     560,
			height:    640,
			resizable: true,
			classes:   ["stonetop", "stonetop-foundry-basics-dialog"],
			scrollY:   [".stonetop-foundry-basics-scroll"],
		});
	}
}
