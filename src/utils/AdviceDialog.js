import { Advice, adviceLabel } from "../model/data/Advice.js";
import { AdviceSnapshot } from "../model/snapshot/AdviceSnapshot.js";
import { enrichRichTextTree } from "./enrichRichText.js";

const TEMPLATE = "systems/stonetop/templates/apps/advice.hbs";

/**
 * The window behind a sheet's ? button: what Book I says about getting more of the thing you just
 * asked about (see src/model/data/Advice.js).
 *
 * Read-only, so it is a plain prompt with nothing to collect — the point is that a player who
 * wonders "how do we get more Surplus?" can find the answer from the sheet itself rather than
 * hunting through the book. The moves and improvements the advice cites are content links, so the
 * window is also a way in to those rules.
 *
 * Collaborators are injected so the dialog is testable without Foundry; `advice` is read at show
 * time because the language file only lands at i18nInit.
 */
export class AdviceDialog {
	constructor({ advice, renderTemplate, prompt, localize, format, enrich } = {}) {
		this._advice = advice
			?? (() => Advice.current);
		this._renderTemplate = renderTemplate
			?? ((path, data) => foundry.applications.handlebars.renderTemplate(path, data));
		this._prompt = prompt
			?? (config => foundry.applications.api.DialogV2.prompt(config));
		this._localize = localize ?? (key => game.i18n.localize(key));
		this._format   = format   ?? ((key, data) => game.i18n.format(key, data));
		this._enrich   = enrich   ?? (snapshot => enrichRichTextTree(snapshot));
	}

	/**
	 * Show the advice for one topic key. Resolves false when the language file has nothing for that
	 * key — a sheet asking about a topic the book doesn't cover is a no-op, not an error.
	 */
	async show(key) {
		const topic = this._advice().lookup(key);
		if (!topic) return false;

		const snapshot = await this._enrich(AdviceSnapshot.of(topic));
		const content = await this._renderTemplate(TEMPLATE, { advice: snapshot });
		await this._prompt({
			// The same words the ? button carries — the window confirms what was clicked.
			window: { title: adviceLabel(topic, this._format) },
			classes: ["stonetop", "stonetop-advice-dialog"],
			position: { width: 480 },
			content,
			ok: { label: this._localize("stonetop.sheet.advice.close"), icon: "fas fa-check" },
			rejectClose: false,
		});
		return true;
	}
}
