import { findVisibleJournal, SETTING_OVERVIEW_JOURNAL } from "../../../utils/seeded-journals.js";
import { FrontOnOpen, openJournalSheetAsChild } from "../../../utils/front-on-open.js";
import { playbookIconPath } from "../../../utils/playbook-actors.js";

const PLAYBOOK_DESCRIPTIONS = {
	"the-blessed":       { complexity: "Medium",       desc: "Nature priest. Speaks to spirits and beasts. Works subtle magics via sacred markings and materials." },
	"the-fox":           { complexity: "Low",          desc: "Clever, quick, and skillful. Not above bending the rules or fighting dirty. Can be quite the charmer, too." },
	"the-heavy":         { complexity: "Low / Medium", desc: "Not just a violent individual—our violent individual. A champion, yes, but a bit of a liability, too." },
	"the-judge":         { complexity: "Low",          desc: "Settler of disputes, chronicler, and divine bulwark against chaos. Insightful, tough, not necessarily persuasive." },
	"the-lightbearer":   { complexity: "High",         desc: "Invokes divine power via flame and candle. Beacon of hope, charity, and mercy. Fiery foe of the dark." },
	"the-marshal":       { complexity: "High",         desc: "Leads the town's militia, plus a crew of followers. Makes choices about who lives and who dies." },
	"the-ranger":        { complexity: "Low",          desc: "At home in the wild, the one you want with you when you travel. A resourceful guide and deadly hunter." },
	"the-seeker":        { complexity: "High",         desc: "Collector of lost lore and power, with potent artifacts that might well lead to their ruin." },
	"the-would-be-hero": { complexity: "Medium",       desc: "They're in over their head and full of fear and anger, but they just might outshine us all." },
};

export class PlaybookPickerDialog extends Application {
	constructor(onPick, options = {}) {
		const { onClose, ...appOptions } = options;
		super(appOptions);
		this._onPick   = onPick;
		// Optional callback fired once the picker closes — picking a playbook closes
		// it too, so callers that care (the first-session flow) track that themselves.
		this._onClose  = onClose ?? null;
		this._playbooks = [];
		// FrontOnOpen floats the picker to the front when it appears, via Foundry's
		// native window stacking (it no longer forces itself above other windows).
		this._frontOnOpen = new FrontOnOpen(this);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id:        "stonetop-playbook-picker",
			template:  "systems/stonetop/templates/dialogs/playbook-picker.hbs",
			title:     game.i18n.localize("stonetop.newCharacter.pickerTitle"),
			width:     640,
			height:    "auto",
			resizable: true,
			classes:   ["stonetop", "stonetop-playbook-picker"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		const result = await super.close(options);
		this._onClose?.();
		return result;
	}

	async getData() {
		if (!this._playbooks.length) {
			const pack = game.packs.get("stonetop.stonetop-items");
			if (pack) {
				await pack.getIndex({ fields: ["type", "system.slug", "img"] });
				const entries = [...pack.index].filter(e =>
					e.type === "playbook" && !!PLAYBOOK_DESCRIPTIONS[e.system?.slug ?? ""]
				);
				const docs = await Promise.all(entries.map(e => pack.getDocument(e._id)));
				this._playbooks = docs
					.filter(Boolean)
					.sort((a, b) => a.name.localeCompare(b.name))
					.map(d => {
						const slug = d.system?.slug ?? "";
						const info = PLAYBOOK_DESCRIPTIONS[slug] ?? {};
						// Use the same avatar art applied to a character on pick
						// (assets/icons/playbooks/<slug>_icon.webp), not the flat
						// playbook item icon.
						const avatar = playbookIconPath(slug);
						return {
							uuid:        d.uuid,
							name:        d.name,
							img:         avatar ?? d.img,
							slug,
							complexity:  info.complexity ?? "",
							description: info.desc       ?? "",
						};
					});
			}
		}
		return { playbooks: this._playbooks };
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();
		html.find(".stonetop-playbook-picker-setting-overview").on("click", () => this._openSettingOverview());
		html.find(".stonetop-playbook-picker-card")
			.on("click", async ev => {
				const { uuid } = ev.currentTarget.dataset;
				if (!uuid) return;
				const doc = await fromUuid(uuid);
				if (!doc) return;
				await this._onPick(doc);
				this.close();
			})
			.on("mouseenter", ev => this._showPickerTooltip(ev.currentTarget))
			.on("mouseleave", () => this._removePickerTooltip());
	}

	// Open the real seeded Setting Overview journal (the single source of truth),
	// brought to the front on top of the picker. The journal is player-readable;
	// if it isn't seeded/visible yet, say so rather than opening an empty window.
	_openSettingOverview() {
		const journal = findVisibleJournal(SETTING_OVERVIEW_JOURNAL);
		if (!journal) {
			ui.notifications.warn("The Setting Overview journal isn't set up in this world yet.");
			return;
		}
		openJournalSheetAsChild(journal.sheet, {
			childClass: "stonetop-picker-child",
		});
	}

	_removePickerTooltip() {
		document.querySelector(".stonetop-playbook-picker-tooltip")?.remove();
	}

	_showPickerTooltip(card) {
		this._removePickerTooltip();
		const { complexity, description } = card.dataset;
		if (!description) return;

		const tip = document.createElement("div");
		tip.className = "stonetop-playbook-picker-tooltip";
		tip.innerHTML =
			(complexity ? `<span class="stonetop-playbook-picker-tooltip-complexity">${complexity} complexity</span>` : "") +
			`<p class="stonetop-playbook-picker-tooltip-desc">${description}</p>`;
		// Append inside the dialog, not <body>, so the tooltip shares the picker's
		// stacking context and stays above its content. (The window has no
		// transform, so the tooltip's fixed positioning still tracks the viewport.)
		(this.element?.[0] ?? document.body).appendChild(tip);

		const ar  = card.getBoundingClientRect();
		const tr  = tip.getBoundingClientRect();
		let top   = ar.top - tr.height - 8;
		let left  = ar.left + (ar.width - tr.width) / 2;
		if (top < 8) top = ar.bottom + 8;
		const maxLeft = window.innerWidth - tr.width - 8;
		if (left > maxLeft) left = maxLeft;
		if (left < 8)       left = 8;
		tip.style.top  = `${top}px`;
		tip.style.left = `${left}px`;
	}
}
