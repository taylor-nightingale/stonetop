import { applyGearTermTooltips } from "../utils/gear-term-tooltips.js";
import { markProseSpiralBullets } from "../utils/journal-spiral-bullets.js";
import { enrichHTML } from "../utils/foundry-compat.js";
import { settingOverviewPages } from "../utils/seeded-journals.js";
import { applyLocationTooltips } from "../locations/location-tooltips.js";
import { restrictContentLinks } from "../journal/restrict-content-links.js";

// This popup is now a *renderer* over the seeded "Setting Overview" journal — the
// single source of truth. The journal's pages become the popup's tabs, so there's
// only one copy of the content to maintain (it also ships, seeds, and is the same
// thing the auto-open and Welcome guide show).

export class SettingOverviewDialog extends Application {
	constructor(options = {}) {
		super(options);
		this._activeEntry = null;
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:       "stonetop-setting-overview",
			title:    "Setting Overview",
			template: "systems/stonetop/templates/dialogs/setting-overview.hbs",
			width:    760,
			height:   600,
			resizable: true,
			classes:  ["stonetop", "stonetop-setting-overview"],
		});
	}

	async getData() {
		const pages = settingOverviewPages();
		if (!pages.length) {
			return {
				entries:    [],
				entryTitle: "Setting Overview",
				content:    "<p>The Setting Overview hasn’t been set up in this world yet.</p>",
			};
		}

		// Keep the active tab on a page that still exists; default to the first.
		if (!pages.some(p => p.id === this._activeEntry)) this._activeEntry = pages[0].id;
		const active = pages.find(p => p.id === this._activeEntry);

		return {
			entries:    pages.map(p => ({ id: p.id, title: p.name, active: p.id === this._activeEntry })),
			entryTitle: active.name,
			content:    await enrichHTML(active.text?.content ?? ""),
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		const entryBody = html.find(".stonetop-so-entry-body")[0];
		if (entryBody) {
			// Spiral / question-spiral / checkbox bullets + glyph SVGs, matching the journals.
			markProseSpiralBullets(entryBody);
			applyGearTermTooltips(entryBody);
			// Cross-link hover summaries, then de-link the ones a player can't open —
			// this is a dialog, not a journal render, so it isn't covered by the
			// journal render hooks in stonetop.js. Order matches that hook: tooltips
			// first so restrictContentLinks can carry the summary onto the de-linked
			// span (Locations & Lore keep their hover description; the GM-only
			// bestiary codex flattens to plain text). No-op for GMs.
			applyLocationTooltips(entryBody).then(() => restrictContentLinks(entryBody));
		}
		// X button should always close, bypassing the z-index guard
		this.element?.find('[data-action="close"]').off("click").on("click", () => this.close({force: true}));
		html.find(".stonetop-so-nav-entry").on("click", ev => {
			this._activeEntry = ev.currentTarget.dataset.entry;
			this.render(false);
		});
	}

	async close(options = {}) {
		// If a window opened on top of this one (e.g. an image popout) is still
		// rendered, don't close yet — let that window handle Escape first.
		if (!options.force) {
			const myZ = parseInt(this.element?.[0]?.style?.zIndex || 0);
			const hasWindowAbove = Object.values(ui.windows).some(w =>
				w !== this && parseInt(w.element?.[0]?.style?.zIndex || 0) > myZ
			);
			if (hasWindowAbove) return this;
		}
		return super.close(options);
	}
}
