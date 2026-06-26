import { IMPROVEMENT_DEFINITIONS, STEADING_DEFAULTS, improvementRequirementsMet } from "./StonetopSteading.js";
import {rollStat, sign, postSeasonsRollPrompt} from "../../utils/roll-engine.js";
import {SteadingLedger} from "./SteadingLedger.js";
import {ledgerNounOptionsHtml, wireLedgerFilters} from "../../utils/ledger-filter.js";
import {escHtml} from "../../utils/strings.js";
import {postMoveToChat} from "../../utils/chat.js";
import {AddSteadingMemberDialog} from "../../dialogs/AddSteadingMemberDialog.js";
import {STONETOP_SCOPE, StonetopFlags} from "../character/StonetopFlags.js";
import {SpecialItemPickerDialog} from "../character/dialogs/SpecialItemPickerDialog.js";
import {CharacterInventory} from "../character/CharacterInventory.js";
import {SPECIAL_ITEM_CATALOG} from "../../data/special-items.js";
import {getHoverDescriptionSetting, getRollStatChipsSetting, getSidebarCollapsed, setSidebarCollapsed, getOpenSheetsInEditMode} from "../../settings.js";
import {applyLabelTooltips} from "../../utils/label-tooltips.js";
import {wrapStonetopGlyphsInEl} from "../../utils/glyphs.js";
import {StonetopAutocomplete} from "../../utils/autocomplete.js";
import {makeColumnsResizable} from "../../utils/resizable-columns.js";
import {withSectionEditing} from "../../utils/section-editing.js";
import {STEADING_IMPROVEMENT_DRAG_TYPE} from "../../journal/steading-improvement-cards.js";
import {getDragEventData} from "../../utils/foundry-compat.js";
import {postSeasonsChangeReminder, seasonIconSrc, seasonLabel, SEASON_IDS} from "../../seasons/seasons-change-reminders.js";
import {recordSeasonsChange, ordinalWord} from "../../seasons/seasons-chronicle.js";
import {SEASONAL_GAINS} from "../../dialogs/spring-burst-data.js";
import {addStonetopSteadingButton} from "../../utils/world.js";


function _normalizeSheetRollMode(rollMode) {
	return ["adv", "dis"].includes(rollMode) ? rollMode : "normal";
}

const _STEADING_MOVES_RAW = [
	{
		slug: "seasonsChange",
		label: "Seasons Change",
		stat: "fortunes",
		statLabel: "Fortunes",
		rollable: false,
		interactive: true,
		description: `<div class="stonetop-seasons-grid">
  <img src="systems/stonetop/assets/icons/seasons/spring_icon.svg" class="stonetop-season-row-icon" alt="Spring">
  <div><strong>Spring</strong> — The <em>most hopeful</em> rolls +Fortunes. <strong>10+:</strong> pick 1 seasonal gain. <strong>7–9:</strong> pick 1 gain, but a threat makes itself known. <strong>6−:</strong> threats abound; don't mark XP. Reset Fortunes to +1.</div>

  <img src="systems/stonetop/assets/icons/seasons/summer_icon.svg" class="stonetop-season-row-icon" alt="Summer">
  <div><strong>Summer</strong> — The <em>most content</em> rolls +Fortunes. <strong>10+:</strong> pick 2 seasonal gains. <strong>7–9:</strong> pick 1. <strong>6−:</strong> a threat makes itself known; don't mark XP. The steading generates 1d4−1 Surplus. Reset Fortunes to +1.</div>

  <img src="systems/stonetop/assets/icons/seasons/fall_icon.svg" class="stonetop-season-row-icon" alt="Autumn">
  <div><strong>Autumn</strong> — The <em>most determined</em> rolls +Fortunes. <strong>10+:</strong> pick 1 seasonal gain. <strong>7–9:</strong> pick 1 gain, but a threat makes itself known. <strong>6−:</strong> threats abound; don't mark XP. The steading generates 1d4 Surplus at harvest. Reset Fortunes to +1.</div>

  <img src="systems/stonetop/assets/icons/seasons/winter_icon.svg" class="stonetop-season-row-icon" alt="Winter">
  <div><strong>Winter</strong> — The <em>weariest</em> rolls 1d4+Population (min 0); the steading consumes that much Surplus. If there isn't enough: Surplus → 0, Fortunes −1, pick 1 consequence. Then roll +Fortunes. Reset Fortunes to +1.</div>
</div>
<p class="stonetop-seasons-cta">Click <i class="fas fa-dice-d6"></i> to walk through the current season step by step.</p>`,
	},
	{
		slug: "pullTogether",
		label: "Pull Together",
		stat: "population",
		statLabel: "Population",
		rollable: true,
		interactive: true,
		description: `<p>When you <strong>set a community to work on improvements, to secure new resources, or to make major repairs</strong>, spend whatever the GM says is required and roll <strong>+Population</strong>.</p>
<p><strong>On a 10+:</strong> the job gets done.</p>
<p><strong>On a 7-9:</strong> pick 1: other work does not get done; the work is shoddy or crude; there is a consequence; or there is an unforeseen cost, requirement, or challenge.</p>
<p><em>Diminished debility: disadvantage on this roll.</em></p>`,
	},
	{
		slug: "muster",
		label: "Muster",
		stat: "population",
		statLabel: "Population",
		rollable: true,
		interactive: true,
		description: `<p>When <strong>Stonetop needs mustering against a threat</strong>, reduce Fortunes by 1 and roll <strong>+Population</strong>.</p>
<p><strong>On a 7+:</strong> the steading is alert and ready for action until the threat passes, the Seasons Change, or you cease to oversee the muster. On a 10+, also pick 2; on a 7-9, also pick 1.</p>
<ul>
  <li>Increase Defenses by 1 as long as the muster holds</li>
  <li>Everyone's willing to pitch in; don't reduce Fortunes after all</li>
  <li>The muster holds together even without your presence</li>
  <li>1 or 2 individuals show real potential; ask the GM who and how</li>
</ul>
<p><em>Diminished debility: disadvantage on this roll.</em></p>`,
	},
	{
		slug: "deploy",
		label: "Deploy",
		stat: "defenses",
		statLabel: "Defenses",
		rollable: true,
		interactive: true,
		description: `<p>When <strong>Stonetop's militia goes into action</strong>, say what they're doing and roll <strong>+Defenses</strong>.</p>
<p><strong>On a 7+:</strong> it gets done. On a 10+, choose 2; on a 7-9, choose 1.</p>
<ul>
  <li>It's more effective than expected</li>
  <li>It's quick, over soon</li>
  <li>It causes little collateral damage, expense, or blowback</li>
  <li>Someone involved distinguishes themselves</li>
</ul>
<p><strong>On a 6-:</strong> don't mark XP, and the GM chooses 2: it's less effective than expected; injuries abound and the steading marks diminished; or a named NPC involved dies.</p>
<p><em>Diminished debility: disadvantage on this roll.</em></p>`,
	},
	{
		slug: "tradeBarter",
		label: "Trade & Barter",
		stat: "prosperity",
		statLabel: "Prosperity",
		rollable: true,
		interactive: true,
		description: `<p>When you <strong>wish to acquire or sell a commonly available item</strong>, you can. When you seek to acquire or sell a special item, roll <strong>+Prosperity</strong> and subtract the item's Value. In winter, you have disadvantage.</p>
<p><strong>On a 10+:</strong> you can get it or sell it for a fair price.</p>
<p><strong>On a 7-9 when buying:</strong> the GM picks 1 complication.</p>`,
	},
	{
		slug: "meetWithDisaster",
		label: "Meet with Disaster",
		stat: null,
		statLabel: null,
		rollable: false,
		interactive: true,
		description: `<p>When <strong><em>calamity befalls the steading or panic spreads</em></strong>, reduce Fortunes by 1 (min -1).</p><p>When <strong><em>Fortunes would drop below -1 for any reason</em></strong> (not just calamity or panic), then the GM picks 1 instead:</p><ul><li>The steading marks <em>diminished</em> from injuries/sickness/doubt (disadvantage to Deploy, Muster, Pull Together)</li><li>The steading marks <em>lacking</em> due to shortages/hoarding/distrust (treat Prosperity as 1 lower)</li><li>The steading marks <em>malcontent</em> from fear/anger/despair (Fortunes reset to +0 each season, not +1; folks need Persuading more often than usual)</li><li>Folks start to leave; reduce Population by 1</li></ul>`,
	},
	{
		slug: "requisition",
		label: "Requisition",
		stat: "fortunes",
		statLabel: "Fortunes",
		rollable: false,
		interactive: true,
		description: `<p>When you <strong>borrow some of the steading's assets for an expedition</strong> or otherwise put them at risk, roll <strong>+Fortunes</strong>.</p>
<p><strong>On a 10+:</strong> go ahead, but bring it back safely.</p>
<p><strong>On a 7-9:</strong> you'll need to do some convincing.</p>
<p><strong>On a 6-:</strong> don't mark XP; you can take the asset with you if you want, but if you do, reduce Fortunes by 1.</p>`,
	},
	{
		slug: "persuade",
		label: "Persuade",
		stat: "fortunes",
		statLabel: "Fortunes",
		rollable: true,
		interactive: true,
		description: `<p>When you need to <strong>convince the residents of Stonetop to do something costly, dangerous, or against their interests</strong>, roll <strong>+Fortunes</strong>.</p>
<p><strong>On a 10+:</strong> they go along with it, at least for now.</p>
<p><strong>On a 7–9:</strong> they need something in return, or they'll only go partway.</p>
<p><strong>On a miss:</strong> they refuse outright, and may resent being asked.</p>
<p><em>Malcontent debility: folks need Persuading more often than usual.</em></p>`,
	},
];
const STEADING_MOVES = [..._STEADING_MOVES_RAW].sort((a, b) => a.label.localeCompare(b.label));
const DIMINISHED_MOVES = new Set(["Deploy", "Muster", "Pull Together"]);
const STEADING_STAT_CHIP_LABELS = {
	Defenses: "DEF",
	Fortunes: "FOR",
	Population: "POP",
	Prosperity: "PRO",
};

// Hover tooltips for the steading stat labels, keyed by data-steading-stat
// (Book I "Homefront"). Gated by hoverDescriptionsSteadingStats.
const STEADING_STAT_TOOLTIPS = {
	surplus:    "Stores of food and trade goods. A resource you accumulate, spend, and consume — not rolled. Generated in summer and autumn, eaten through in winter.",
	fortunes:   "The steading's morale, social cohesion, and the favor of the gods — “how things are going.” Roll +Fortunes to Requisition and when the Seasons Change; resets to +1 each season.",
	size:       "How big the steading is (hamlet, village, town, city). Mostly descriptive, but it affects winter Surplus consumption and the Muster, Pull Together, and Trade & Barter moves.",
	population: "The number of able bodies living here, relative to its Size. Roll +Population to Muster or Pull Together; higher Population also eats more Surplus each winter.",
	prosperity: "The goods in circulation, the variety of tradesfolk, and merchant traffic. Roll +Prosperity to Trade & Barter; it also sets the value of “x piercing” and what gear is available.",
	defenses:   "The steading's martial readiness — trained, armed residents and veteran warriors. Roll +Defenses to Deploy its people against a threat.",
};
const _esc = escHtml;

function _formatResultLine(text) {
	// Bold the dice-range prefix and any qualifier up to the colon (e.g. "7-9 when buying:", "Miss:").
	return _esc(text).replace(/^(7\+|10\+|7-9|6-|Miss)([^:]*):/, "<strong>$1$2:</strong>");
}

const HOMESTEAD_MOVE_FLOWS = {
	pullTogether: {
		label: "Pull Together",
		stat: "population",
		statLabel: "Population",
		trigger: "When you set a community to work on improvements, to secure new resources, or to make major repairs, spend whatever the GM says is required and roll +Population.",
		fields: [
			{ name: "project", label: "Project", type: "text", placeholder: "What are you trying to build, repair, clear, or prepare?" },
			{ name: "approach", label: "Approach", type: "textarea", placeholder: "Who is helping, and how are you organizing the work?" },
			{ name: "cost", label: "Required cost", type: "textarea", placeholder: "Time, materiel, Surplus, coin, labor, or other requirements" },
		],
		picksLabel: "On a 7-9, pick 1:",
		picks: [
			"It gets done, but other work does not; reduce Fortunes by 1.",
			"It gets done, but the work is shoddy or crude.",
			"It gets done, but there is a consequence.",
			"There is an unforeseen cost, requirement, or challenge; address it and the job gets done.",
		],
		results: [
			"10+: the job gets done.",
			"7-9: the job gets done, but pick 1.",
			"6-: the GM says what happens; do not mark XP.",
		],
		note: "Diminished gives disadvantage on this roll.",
	},
	muster: {
		label: "Muster",
		stat: "population",
		statLabel: "Population",
		trigger: "When Stonetop needs mustering against a threat, reduce Fortunes by 1 and roll +Population.",
		beforeRoll: "musterCost",
		fields: [
			{ name: "threat", label: "Threat", type: "textarea", placeholder: "What is Stonetop mustering against?" },
			{ name: "overseer", label: "Who oversees the muster?", type: "text", placeholder: "A PC, NPC, council, or militia leader" },
			{ name: "orders", label: "Orders", type: "textarea", placeholder: "Where are they gathering, and what are they preparing to do?" },
		],
		picksLabel: "On a 10+, pick 2; on a 7-9, pick 1:",
		picks: [
			"Increase Defenses by 1 as long as the muster holds.",
			"Everyone is willing to pitch in; do not reduce Fortunes after all.",
			"The muster holds together even without your presence.",
			"1 or 2 individuals show real potential; ask the GM who and how.",
		],
		results: [
			"7+: the steading is alert and ready for action until the threat passes, the Seasons Change, or you cease to oversee the muster.",
			"10+: also pick 2.",
			"7-9: also pick 1.",
			"6-: the GM says what happens; do not mark XP.",
		],
		note: "Diminished gives disadvantage on this roll.",
	},
	deploy: {
		label: "Deploy",
		stat: "defenses",
		statLabel: "Defenses",
		trigger: "When Stonetop's militia goes into action, say what they're doing and roll +Defenses.",
		fields: [
			{ name: "action", label: "Action", type: "textarea", placeholder: "What is the militia doing?" },
			{ name: "objective", label: "Objective", type: "text", placeholder: "Drive them off, hold the ford, protect evacuees..." },
			{ name: "support", label: "Support", type: "textarea", placeholder: "Which force, fortification, tactic, or leader matters here?" },
		],
		picksLabel: "On a 10+, choose 2; on a 7-9, choose 1:",
		picks: [
			"It is more effective than expected.",
			"It is quick, over soon.",
			"It causes little collateral damage, expense, or blowback.",
			"Someone involved distinguishes themselves.",
		],
		consequencesLabel: "On a 6-, the GM chooses 2:",
		consequences: [
			"It is less effective than expected.",
			"Injuries abound; the steading marks diminished.",
			"The GM picks a named NPC involved in the action; they die.",
		],
		results: [
			"7+: it gets done.",
			"10+: choose 2.",
			"7-9: choose 1.",
			"6-: do not mark XP; the GM chooses 2 consequences.",
		],
		note: "Diminished gives disadvantage on this roll.",
	},
	tradeBarter: {
		label: "Trade & Barter",
		stat: "prosperity",
		statLabel: "Prosperity",
		trigger: "When you wish to acquire or sell a commonly available item, you can. When you seek to acquire or sell a special item, roll +Prosperity and subtract the item's Value. In winter, you have disadvantage.",
		fields: [
			{ name: "want", label: "What do you want to buy or sell?", type: "textarea", placeholder: "Item, service, animal, coin, Surplus, or trade goods" },
			{ name: "value", label: "Item Value", type: "number", placeholder: "0", min: 0 },
			{ name: "partner", label: "Trade partner", type: "text", placeholder: "Who are you dealing with?" },
			{ name: "offer", label: "Offer or price", type: "textarea", placeholder: "What is being offered, paid, or risked?" },
			{ name: "winter", label: "It is winter", type: "checkbox" },
		],
		results: [
			"Commonly available item: you can acquire or sell it without rolling.",
			"10+: you can get it or sell it for a fair price.",
			"7-9 when buying: the GM picks 1 (below).",
			"7-9 when selling: you can sell it now, but you won't get its full worth.",
			"6- either way: don't mark XP. If you still want to acquire/sell it, you'll need to travel elsewhere or wait until next season.",
		],
		picks: [
			"You can get it, but it'll cost more than usual",
			"Someone has it, but they aren't keen to give it up",
			"You can get something close, but not quite right",
		],
		picksLabel: "7-9 when buying — the GM picks 1:",
		note: "For unique or truly exceptional items, don't Trade & Barter — Make a Plan with the GM or wait for a trade opportunity when Seasons Change. Lacking treats Prosperity as 1 lower; subtract the item's Value as a modifier.",
	},
	persuade: {
		label: "Persuade",
		stat: "fortunes",
		statLabel: "Fortunes",
		trigger: "When you need to convince the residents of Stonetop to do something costly, dangerous, or against their interests, roll +Fortunes.",
		fields: [
			{ name: "audience", label: "Who needs convincing?", type: "text", placeholder: "A family, trade, faction, crowd, or named NPCs" },
			{ name: "request", label: "The ask", type: "textarea", placeholder: "What do you want them to do?" },
			{ name: "cost", label: "Why is it hard?", type: "textarea", placeholder: "What makes it costly, dangerous, or against their interests?" },
		],
		results: [
			"10+: they go along with it, at least for now.",
			"7-9: they need something in return, or they'll only go partway.",
			"Miss: they refuse outright, and may resent being asked.",
		],
		note: "Malcontent means folks need Persuading more often than usual.",
	},
};

// Every editable section carries its own hover edit pencil; each is read-only
// until its pencil (or the global header wrench) turns it on. Keys match the
// `data-section` attributes in the templates.
const STEADING_EDIT_SECTIONS = [
	"surplusFortunes", "sizePopulation", "defenses", "fortifications",
	"prosperity", "currency",
	"resources", "assets", "places",
	"players", "residents", "neighbors", "improvements",
];

export function createStonetopSteadingSheetClass(Base) {
	// Sections with their own heading pencil (Residents, Neighbors) track edit
	// state independently of the global header-wrench `_editMode` via the shared
	// section-editing mixin.
	return class StonetopSteadingSheet extends withSectionEditing(Base) {
		_stonetopSteading;
		_editMode = false;
		// Sections whose edit mode was just turned off: their "done" check lingers
		// for a beat, fades out, then reverts to the hover pencil. Each has a timer.
		_recentlyEditedSections = new Set();
		_recentlyEditedTimers = new Map();
		// Slugs of improvement cards the user has expanded. Tracked here (not in the
		// DOM) so a card stays open across the re-render that ticking a requirement
		// or completion checkbox triggers — it only collapses when its header/chevron
		// is clicked.
		_openImprovements = new Set();

		constructor(...args) {
			super(...args);
			this._stonetopSteading = this.actor.typedActor;
			// Honor the "Open Sheets in Edit Mode" client setting on first open.
			this._editMode = getOpenSheetsInEditMode();
		}

		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["pbta", "stonetop", "sheet", "actor", "steading"],
				width: 1080,
				minWidth: 800,
				height: 840,
				tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "overview" }],
			});
		}

		get template() {
			return "systems/stonetop/templates/actor/steading.hbs";
		}

		async _render(force, options) {
			await super._render(force, options);
			// Strip any PBTA-injected playbook controls and FoundryVTT chrome from the window header
			const header = this.element[0]?.querySelector(".window-header");
			if (header) {
				header.querySelectorAll(".pbta-playbook, .sheet-playbook, [class*='playbook']").forEach(el => el.remove());
				header.querySelectorAll("select, input[name*='playbook']").forEach(el => el.remove());
				header.querySelectorAll(".document-id-link").forEach(el => el.remove());
			}
			this._injectHeaderToggle();
		}

		_injectHeaderToggle() {
			const header = this.element[0]?.querySelector(".window-header");
			if (!header || !this.isEditable) return;

			header.querySelector(".stonetop-header-toggle")?.remove();

			const label = document.createElement("label");
			label.className = "stonetop-edit-toggle stonetop-header-toggle";
			// Master edit toggle: when on, every section is editable. Each section
			// also has its own hover pencil for editing it in isolation.
			label.title = this._editMode ? "Lock Steading" : "Edit Steading";

			const checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.checked = this._editMode;
			checkbox.addEventListener("change", () => {
				this._editMode = checkbox.checked;
				// Locking the sheet resets any per-section pencils back to read-only.
				if (!this._editMode) {
					this._editingSections.clear();
					this._clearAllSectionDoneTimers();
				}
				this.render(false);
			});

			const track = document.createElement("span");
			track.className = "stonetop-toggle-track";
			const thumb = document.createElement("span");
			thumb.className = "stonetop-toggle-thumb";
			const icon = document.createElement("i");
			icon.className = "fas fa-wrench";
			thumb.appendChild(icon);
			track.appendChild(thumb);

			label.appendChild(checkbox);
			label.appendChild(track);

			const title = header.querySelector(".window-title");
			header.insertBefore(label, title);
		}

		_getHeaderButtons() {
			const buttons = super._getHeaderButtons().filter(b => b.class !== "configure-sheet");
			const tokenIdx = buttons.findIndex(b => b.class?.includes("token"));
			buttons.splice(tokenIdx >= 0 ? tokenIdx : 0, 0, {
				label:   "Ledger",
				class:   "stonetop-ledger-button",
				icon:    "fas fa-scroll",
				onclick: () => this._openLedgerDialog(),
			});
			return buttons;
		}

		_openLedgerDialog() {
			const entries = SteadingLedger.getEntries(this.actor);
			const ledgerDate = (timestamp) => {
				const date = timestamp ? new Date(timestamp) : null;
				if (!date || Number.isNaN(date.getTime())) return { key: "unknown", label: "Unknown date" };
				const key = [
					date.getFullYear(),
					String(date.getMonth() + 1).padStart(2, "0"),
					String(date.getDate()).padStart(2, "0"),
				].join("-");
				return {
					key,
					label: date.toLocaleDateString(undefined, {
						weekday: "long",
						year:    "numeric",
						month:   "long",
						day:     "numeric",
					}),
				};
			};
			const buildRows = (items) => items.length
				? items.map((entry, index, list) => {
					const date = ledgerDate(entry.timestamp);
					const previous = index > 0 ? ledgerDate(list[index - 1].timestamp).key : null;
					const header = date.key !== previous
						? `<li class="stonetop-ledger-date-header" data-date-key="${_esc(date.key)}">${_esc(date.label)}</li>`
						: "";
					return `${header}<li class="stonetop-ledger-entry" data-id="${_esc(entry.id)}" data-timestamp="${entry.timestamp ?? 0}" data-date-key="${_esc(date.key)}" data-date-label="${_esc(date.label)}">
						<input type="checkbox" class="stonetop-ledger-row-check">
						<div class="stonetop-ledger-entry-content">
							<div class="stonetop-ledger-entry-main">${_esc(entry.action)}${entry.move ? ` <span class="stonetop-ledger-entry-move">via ${_esc(entry.move)}</span>` : ""}</div>
							<div class="stonetop-ledger-entry-user">Changed by ${_esc(entry.userName)}</div>
							<div class="stonetop-ledger-entry-meta">
								<span>${_esc(entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "")}</span>
							</div>
						</div>
					</li>`;
				}).join("")
				: `<li class="stonetop-ledger-empty">No ledger entries yet.</li>`;

			const nounOptions = ledgerNounOptionsHtml(entries);

			const content = `<div class="stonetop-ledger-container">
				<div class="stonetop-ledger-toolbar">
					<label class="stonetop-edit-toggle stonetop-ledger-edit-toggle" title="Edit entries">
						<input type="checkbox" class="stonetop-ledger-edit-check">
						<span class="stonetop-toggle-track">
							<span class="stonetop-toggle-thumb"><i class="fas fa-pen"></i></span>
						</span>
					</label>
					<label class="stonetop-ledger-select-all-label" title="Select all">
						<input type="checkbox" class="stonetop-ledger-select-all">
					</label>
					<button type="button" class="stonetop-ledger-delete-selected">
						<i class="fas fa-trash"></i> Delete
					</button>
					<input type="search" class="stonetop-ledger-search" placeholder="Filter entries…">
					<select class="stonetop-ledger-noun" title="Filter by subject">
						<option value="">All changes</option>
						${nounOptions}
					</select>
					<select class="stonetop-ledger-sort">
						<option value="desc">Newest first</option>
						<option value="asc">Oldest first</option>
					</select>
				</div>
				<section class="stonetop-ledger-dialog">
					<ol class="stonetop-ledger-list">${buildRows(entries)}</ol>
				</section>
			</div>`;

			new Dialog({
				title: `${this.actor.name}: Ledger`,
				content,
				buttons: {},
				render: (html) => {
					const container   = html.find(".stonetop-ledger-container")[0];
					const list = html.find(".stonetop-ledger-list")[0];
					const selectAllEl = html.find(".stonetop-ledger-select-all")[0];

					const createDateHeader = (dateKey, dateLabel) => {
						const header = document.createElement("li");
						header.className = "stonetop-ledger-date-header";
						header.dataset.dateKey = dateKey;
						header.textContent = dateLabel;
						return header;
					};

					const refreshDateHeaders = () => {
						list.querySelectorAll(".stonetop-ledger-date-header").forEach(el => el.remove());
						let previous = null;
						for (const entry of [...list.querySelectorAll(".stonetop-ledger-entry")]) {
							const dateKey = entry.dataset.dateKey ?? "unknown";
							if (dateKey === previous) continue;
							list.insertBefore(createDateHeader(dateKey, entry.dataset.dateLabel ?? "Unknown date"), entry);
							previous = dateKey;
						}
					};

					const syncDateHeaders = () => {
						for (const header of list.querySelectorAll(".stonetop-ledger-date-header")) {
							let sibling = header.nextElementSibling;
							let hasVisibleEntry = false;
							while (sibling && !sibling.classList.contains("stonetop-ledger-date-header")) {
								if (sibling.classList.contains("stonetop-ledger-entry") && !sibling.hidden) {
									hasVisibleEntry = true;
									break;
								}
								sibling = sibling.nextElementSibling;
							}
							header.hidden = !hasVisibleEntry;
						}
					};

					const syncSelectAll = () => {
						const visibleRows = html.find(".stonetop-ledger-entry:not([hidden]) .stonetop-ledger-row-check");
						const total   = visibleRows.length;
						const checked = visibleRows.filter(":checked").length;
						selectAllEl.checked       = checked === total && total > 0;
						selectAllEl.indeterminate = checked > 0 && checked < total;
					};

					html.find(".stonetop-ledger-edit-check").on("change", ev => {
						container.classList.toggle("stonetop-ledger-edit-mode", ev.currentTarget.checked);
						if (!ev.currentTarget.checked) {
							html.find(".stonetop-ledger-row-check").prop("checked", false);
							syncSelectAll();
						}
					});

					html.find(".stonetop-ledger-select-all").on("change", ev => {
						html.find(".stonetop-ledger-entry:not([hidden]) .stonetop-ledger-row-check")
							.prop("checked", ev.currentTarget.checked);
					});

					html[0].addEventListener("change", ev => {
						if (ev.target.closest(".stonetop-ledger-row-check")) syncSelectAll();
					});

					wireLedgerFilters(html, () => { syncDateHeaders(); syncSelectAll(); });

					html.find(".stonetop-ledger-sort").on("change", ev => {
						const asc  = ev.currentTarget.value === "asc";
						const tagged = [...list.querySelectorAll(".stonetop-ledger-entry")]
							.map(el => [el, Number(el.dataset.timestamp)]);
						tagged.sort(([, ta], [, tb]) => asc ? ta - tb : tb - ta);
						tagged.forEach(([el]) => list.appendChild(el));
						refreshDateHeaders();
						syncDateHeaders();
					});

					html.find(".stonetop-ledger-delete-selected").on("click", async () => {
						const checked = [...html.find(".stonetop-ledger-row-check:checked")];
						if (!checked.length) return;

						const doDelete = async () => {
							const ids = new Set(
								checked.map(el => el.closest(".stonetop-ledger-entry").dataset.id)
							);
							checked.forEach(el => el.closest(".stonetop-ledger-entry")?.remove());
							refreshDateHeaders();
							syncDateHeaders();
							syncSelectAll();
							await SteadingLedger.deleteEntries(this.actor, ids);
						};

						if (checked.length === 1) {
							await doDelete();
							return;
						}

						Dialog.confirm({
							title: "Delete Ledger Entries",
							content: `<p>You're about to delete ${checked.length} entries. Are you sure?</p>`,
							yes: doDelete,
						});
					});
				},
			}, {
				width: 560,
				height: 640,
				classes: ["dialog", "stonetop-ledger-window"],
			}).render(true);
		}

		// Section-editing hooks: entering edit cancels any lingering "done" check;
		// leaving edit starts the fade-out check (see _markSectionDone).
		_onSectionEditOpened(section) { this._clearSectionDone(section); }
		_onSectionEditClosed(section) { this._markSectionDone(section); }

		// Show a section's "done" check for a beat after leaving edit, then fade it
		// out (CSS) and re-render so the section reverts to its hover pencil.
		_markSectionDone(section) {
			this._clearSectionDone(section);
			this._recentlyEditedSections.add(section);
			const timer = setTimeout(() => {
				this._recentlyEditedSections.delete(section);
				this._recentlyEditedTimers.delete(section);
				if (this.rendered) this.render(false);
			}, 1000);
			this._recentlyEditedTimers.set(section, timer);
		}

		_clearSectionDone(section) {
			this._recentlyEditedSections.delete(section);
			const timer = this._recentlyEditedTimers.get(section);
			if (timer) {
				clearTimeout(timer);
				this._recentlyEditedTimers.delete(section);
			}
		}

		_clearAllSectionDoneTimers() {
			for (const timer of this._recentlyEditedTimers.values()) clearTimeout(timer);
			this._recentlyEditedTimers.clear();
			this._recentlyEditedSections.clear();
		}

		async close(options) {
			this._clearAllSectionDoneTimers();
			return super.close(options);
		}

		async getData() {
			const context = await super.getData();
			context.stonetop = await this._stonetopSteading.buildSnapshot();
			context.stonetop.moves = STEADING_MOVES.map(move => ({
				...move,
				statChipLabel: STEADING_STAT_CHIP_LABELS[move.statLabel] ?? move.statLabel,
			}));
			context.stonetop.rollMode = this._sheetRollMode();
			context.stonetop.showRollStatChips = getRollStatChipsSetting();
			// Whether the whole moves sidebar is collapsed (defaults to expanded),
			// persisted per-actor, per-user.
			context.stonetop.sidebarCollapsed = getSidebarCollapsed(this.actor?.id);
			context.stonetop.enrichedNotes = await foundry.applications.ux.TextEditor.enrichHTML(context.stonetop.notes ?? "");
			context.stonetop.editMode = this._editMode;
			context.stonetop.canEdit = this.isEditable;
			// Per-section edit flags: a section is editable when the global header
			// wrench is on OR its own pencil is toggled.
			const sectionEdit = section => this.isSectionEditable(section);
			context.stonetop.edit = Object.fromEntries(
				STEADING_EDIT_SECTIONS.map(section => [section, sectionEdit(section)])
			);
			context.stonetop.recentlyEdited = Object.fromEntries(
				STEADING_EDIT_SECTIONS.map(section => [section, this._recentlyEditedSections.has(section)])
			);
			context.stonetop.hideUnearnedImprovements = this.actor.getFlag("stonetop", "hideUnearnedImprovements") ?? false;
			// Re-apply the user's expanded cards so they survive re-renders.
			for (const imp of context.stonetop.improvements ?? []) {
				imp.isOpen = this._openImprovements.has(imp.slug);
			}
			return context;
		}

		activateListeners(html) {
			super.activateListeners(html);
			wrapStonetopGlyphsInEl(html[0]);

			// Swap the resident/neighbor fields' native <datalist> popups (occupation,
			// traits, home) for our scrollable one — Chromium's native popup has no
			// scrollbar for long lists. See utils/autocomplete.js.
			StonetopAutocomplete.upgradeAll(html);

			applyLabelTooltips(html, {
				selector: ".steading-stat-label[data-steading-stat]", datasetKey: "steadingStat",
				table: STEADING_STAT_TOOLTIPS, settingKey: "hoverDescriptionsSteadingStats", direction: "UP",
			});

			// Rollable move buttons (both editable and read-only)
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".steading-roll-btn");
				if (!btn) return;
				ev.stopPropagation();
				this._onSteadingRoll(btn.dataset.moveName, btn.dataset.stat);
			}, true);

			html.find(".stonetop-roll-mode-input").on("change", async (ev) => {
				await this.actor.setFlag(STONETOP_SCOPE, "rollMode", _normalizeSheetRollMode(ev.currentTarget.value));
				this.render(false);
			});

			// Collapse / expand the whole moves sidebar (Roll Modifier + Homefront Moves).
			// Toggling a class (rather than re-rendering) lets the tab content reclaim
			// the freed width without flicker; the state is persisted so the sidebar
			// reopens the same way.
			html.find(".stonetop-sidebar-toggle").on("click", ev => {
				const sidebar = ev.currentTarget.closest(".stonetop-moves-sidebar");
				if (!sidebar) return;
				const collapsed = sidebar.classList.toggle("is-collapsed");
				ev.currentTarget.setAttribute("aria-expanded", String(!collapsed));
				ev.currentTarget.setAttribute("aria-label", collapsed ? "Expand moves sidebar" : "Collapse moves sidebar");
				setSidebarCollapsed(this.actor?.id, collapsed);
			});

			// Clicking the move name or its "+STAT" chip rolls the same as tapping the dice icon beside it.
			html.find(".stonetop-steading-move-open, .stonetop-move-roll-chip").on("click", ev => {
				const li = ev.currentTarget.closest("li");
				const rollable = li?.querySelector(".steading-roll-btn, .steading-interactive-btn");
				if (rollable) rollable.click();
			});

			// Interactive move buttons (e.g. Meet with Disaster)
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".steading-interactive-btn");
				if (!btn) return;
				ev.stopPropagation();
				const { moveSlug } = btn.dataset;
				if (moveSlug === "meetWithDisaster") this._onMeetWithDisaster();
				else if (moveSlug === "requisition") this._onRequisitionWalkthrough();
				else if (moveSlug === "seasonsChange") this._onSeasonsChange();
				else if (HOMESTEAD_MOVE_FLOWS[moveSlug]) this._onHomesteadMove(moveSlug);
			}, true);

			this._movePanel?.remove();
			if (getHoverDescriptionSetting("hoverDescriptionsBasicMoves")) {
				const panel = document.createElement("div");
				this._movePanel = panel;
				panel.className = "stonetop-basic-move-panel";
				panel.hidden = true;
				document.body.appendChild(panel);

				html.find(".steading-move-row").on("mouseenter", ev => {
					const li = ev.currentTarget;
					const descEl = li.querySelector(".stonetop-basic-move-desc");
					if (!descEl) return;
					const nameText = li.querySelector(".stonetop-move-name")?.textContent?.trim() ?? "";
					const nameEl = document.createElement("strong");
					nameEl.className = "stonetop-basic-move-panel-name";
					nameEl.textContent = nameText;
					panel.replaceChildren(nameEl, ...Array.from(descEl.cloneNode(true).childNodes));
					panel.hidden = false;
					const rect = li.getBoundingClientRect();
					panel.style.top   = `${Math.max(4, Math.min(rect.top, window.innerHeight - panel.offsetHeight - 8))}px`;
					panel.style.right = `${window.innerWidth - rect.left + 8}px`;
				}).on("mouseleave", () => {
					panel.hidden = true;
				});
			}

			// Improvement card expand/collapse. The open state is mirrored into
			// _openImprovements so it persists across re-renders (see getData).
			html[0].addEventListener("click", ev => {
				const hdr = ev.target.closest(".steading-improvement-header");
				if (!hdr) return;
				if (ev.target.closest(".steading-improvement-complete-label")) return;
				if (ev.target.closest(".steading-improvement-remove")) return;
				const card = hdr.closest(".steading-improvement");
				if (!card) return;
				const open = card.classList.toggle("is-open");
				const slug = card.dataset.slug;
				if (slug) open ? this._openImprovements.add(slug) : this._openImprovements.delete(slug);
			}, true);

			html[0].addEventListener("change", ev => {
				const cb = ev.target.closest(".steading-hide-unearned-improvements-check");
				if (!cb) return;
				ev.stopPropagation();
				this.actor.setFlag("stonetop", "hideUnearnedImprovements", cb.checked);
			}, true);

			// Per-section edit toggle (pencil/check at each section's corner) flips
			// just that section's edit state, independent of the global wrench. The
			// fade-out "done" check is driven by the _onSectionEdit* hooks above.
			this._wireSectionEditToggle(html, ".steading-section-edit-toggle");

			// Add resident / neighbor — allowed even outside edit mode
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".steading-list-add");
				if (!btn) return;
				if (!["residents", "neighbors"].includes(btn.dataset.list)) return;
				ev.stopPropagation();
				this._onListItemAdd(btn.dataset.list);
			}, true);

			// Drag-resizable columns on the player/resident/neighbor tables — useful in both edit and read-only modes.
			html[0].querySelectorAll(".steading-residents-table[data-resize-key]").forEach(table => {
				makeColumnsResizable(table, table.dataset.resizeKey);
			});

			if (!this.isEditable) return;

			// Stat tracks use custom radio markup, so persist them explicitly.
			html[0].addEventListener("change", ev => {
				const input = ev.target;
				if (input.type !== "radio" || !input.name || !input.closest(".steading-track-option")) return;
				ev.stopPropagation();
				this._onSteadingTrackChange(input.name, Number(input.value));
			}, true);

			// Surplus is in the custom stat bar, so persist it explicitly.
			const onSurplusInput = ev => {
				const input = ev.target.closest(".steading-surplus-input");
				if (!input) return;
				ev.stopPropagation();
				this._onSteadingTrackChange(input.name, Math.max(0, parseInt(input.value) || 0));
			};
			html[0].addEventListener("input", onSurplusInput, true);
			html[0].addEventListener("change", onSurplusInput, true);

			// Debilities live in the same custom bar and need the same legacy-safe persistence.
			html[0].addEventListener("change", ev => {
				const input = ev.target.closest(".steading-debility-check");
				if (!input) return;
				ev.stopPropagation();
				this._onSteadingTrackChange(input.name, input.checked);
			}, true);

			// List item checked toggle (resources, fortifications, assets)
			html[0].addEventListener("change", ev => {
				const cb = ev.target.closest(".steading-list-check");
				if (!cb) return;
				ev.stopPropagation();
				const { list, index } = cb.dataset;
				this._onListItemCheck(list, parseInt(index), cb.checked);
			}, true);

			// Click a requisitioned ("taken") asset to return it to the steading.
			html[0].addEventListener("click", ev => {
				const taken = ev.target.closest(".steading-asset-taken");
				if (!taken) return;
				ev.stopPropagation();
				this._onReturnAsset(parseInt(taken.dataset.index));
			}, true);

			// Add list item (residents/neighbors are handled above, regardless of edit mode)
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".steading-list-add");
				if (!btn) return;
				if (["residents", "neighbors"].includes(btn.dataset.list)) return;
				ev.stopPropagation();
				this._onListItemAdd(btn.dataset.list);
			}, true);

			// Delete list item
			html[0].addEventListener("click", ev => {
				const btn = ev.target.closest(".steading-list-delete");
				if (!btn) return;
				ev.stopPropagation();
				const { list, index } = btn.dataset;
				this._onListItemDelete(btn.dataset.list, parseInt(index));
			}, true);

			// Places of interest names
			html[0].addEventListener("change", ev => {
				const inp = ev.target.closest(".steading-place-name");
				if (!inp) return;
				ev.stopPropagation();
				this._onPlaceChange(parseInt(inp.dataset.index), inp.value);
			}, true);

// Resident / neighbor / player details
		html[0].addEventListener("change", ev => {
			const inp = ev.target.closest(".steading-resident-input");
			if (!inp) return;
			ev.stopPropagation();
			const { index, field, list } = inp.dataset;
			if (list === "players") {
				this._onPlayerFieldChange(parseInt(index), field, inp.value);
			} else if (list === "neighbors") {
				this._onNeighborChange(parseInt(index), field, inp.value);
			} else {
				this._onResidentChange(parseInt(index), field, inp.value);
			}
			}, true);

			// Notes
			html[0].addEventListener("change", ev => {
				const pm = ev.target.closest("prose-mirror.steading-notes-editor");
				if (!pm) return;
				ev.stopPropagation();
				this._onNotesChange(pm.value);
			}, true);

			// Size radio
			html[0].addEventListener("change", ev => {
				const radio = ev.target.closest(".steading-size-radio");
				if (!radio) return;
				ev.stopPropagation();
				this._stonetopSteading.setFlags({ size: radio.value });
			}, true);

			// Currency
			html[0].addEventListener("change", ev => {
				const inp = ev.target.closest(".steading-currency-input");
				if (!inp) return;
				ev.stopPropagation();
				const { currency, field } = inp.dataset;
				this._onCurrencyChange(currency, field, parseInt(inp.value) || 0);
			}, true);

			// Improvement complete checkbox
			html[0].addEventListener("change", ev => {
				const cb = ev.target.closest(".steading-improvement-complete");
				if (!cb) return;
				ev.stopPropagation();
				this._onImprovementComplete(cb.dataset.slug, cb.checked);
			}, true);

			// Improvement requirement checkbox
			html[0].addEventListener("change", ev => {
				const cb = ev.target.closest(".steading-improvement-req");
				if (!cb) return;
				ev.stopPropagation();
				const { slug, index } = cb.dataset;
				this._onImprovementReq(slug, parseInt(index), cb.checked);
			}, true);

			// Drag-and-drop for adding player characters to the Neighbors tab.
			const neighborsTab = html[0].querySelector(".steading-neighbors-tab");
			const playersSection = html[0].querySelector(".steading-players-section");
			if (neighborsTab) {
				neighborsTab.addEventListener("dragover", (ev) => {
					ev.preventDefault();
					ev.stopPropagation();
					ev.dataTransfer.dropEffect = "copy";
					playersSection?.classList.add("drag-over");
				}, true);

				neighborsTab.addEventListener("dragleave", (ev) => {
					ev.preventDefault();
					ev.stopPropagation();
					if (!neighborsTab.contains(ev.relatedTarget)) playersSection?.classList.remove("drag-over");
				}, true);

				neighborsTab.addEventListener("drop", async (ev) => {
					ev.preventDefault();
					ev.stopPropagation();
					playersSection?.classList.remove("drag-over");
					const data = getDragEventData(ev);
					if (data?.type === "Actor" && data.uuid) {
						const actor = await fromUuid(data.uuid);
						if (actor && actor.type === "character") {
							await this._onDropPlayerCharacter(actor);
						}
					}
				}, true);
			}

			// Drop a "Steading Improvement" card (dragged from a journal) onto the
			// Improvements tab to add it as a tracked custom improvement.
			const improvementsTab = html[0].querySelector(".tab.improvements");
			if (improvementsTab) {
				const setDrag = on => improvementsTab.classList.toggle("steading-improvement-drag-over", on);
				improvementsTab.addEventListener("dragover", (ev) => {
					ev.preventDefault();
					ev.dataTransfer.dropEffect = "copy";
					setDrag(true);
				});
				improvementsTab.addEventListener("dragleave", (ev) => {
					if (!improvementsTab.contains(ev.relatedTarget)) setDrag(false);
				});
				improvementsTab.addEventListener("drop", async (ev) => {
					const data = getDragEventData(ev);
					if (data?.type !== STEADING_IMPROVEMENT_DRAG_TYPE) return;
					ev.preventDefault();
					ev.stopPropagation();
					setDrag(false);
					await this._onDropSteadingImprovement(data.improvement);
				});
			}

			// Remove a custom (journal-sourced) improvement.
			html[0].addEventListener("click", (ev) => {
				const btn = ev.target.closest(".steading-improvement-remove");
				if (!btn) return;
				ev.stopPropagation();
				this._onRemoveCustomImprovement(btn.dataset.slug);
			}, true);
		}

		_onHomesteadMove(moveSlug) {
			const flow = HOMESTEAD_MOVE_FLOWS[moveSlug];
			if (!flow) return;

			const fieldHtml = flow.fields.map(field => {
				if (field.type === "checkbox") {
					return `<label class="stonetop-homestead-field stonetop-homestead-field--check">
						<input type="checkbox" class="stonetop-check" name="${_esc(field.name)}" value="yes">
						<span>${_esc(field.label)}</span>
					</label>`;
				}
				const common = `name="${_esc(field.name)}" placeholder="${_esc(field.placeholder)}"`;
				const control = field.type === "textarea"
					? `<textarea ${common} rows="2"></textarea>`
					: field.type === "number"
						? `<input type="number" ${common} min="${field.min ?? 0}" value="${field.value ?? ""}">`
						: `<input type="text" ${common}>`;
				return `<label class="stonetop-homestead-field">
					<span>${_esc(field.label)}</span>
					${control}
				</label>`;
			}).join("");

			const picksHtml = flow.picks?.length
				? `<div class="stonetop-homestead-reference">
					<strong>${_esc(flow.picksLabel ?? "Choose from:")}</strong>
					<div class="stonetop-homestead-choice-list">
						${flow.picks.map((item, index) => `<label class="stonetop-homestead-choice">
							<input type="checkbox" class="stonetop-check" name="pick.${index}" value="${_esc(item)}">
							<span>${_esc(item)}</span>
						</label>`).join("")}
					</div>
				</div>`
				: "";

			const consequencesHtml = flow.consequences?.length
				? `<div class="stonetop-homestead-reference">
					<strong>${_esc(flow.consequencesLabel ?? "Consequences")}</strong>
					<div class="stonetop-homestead-choice-list">
						${flow.consequences.map((item, index) => `<label class="stonetop-homestead-choice">
							<input type="checkbox" class="stonetop-check" name="consequence.${index}" value="${_esc(item)}">
							<span>${_esc(item)}</span>
						</label>`).join("")}
					</div>
					${flow.label === "Deploy" ? `<button type="button" class="stonetop-season-btn" data-action="mark-diminished"><i class="fas fa-band-aid"></i> Mark diminished</button>` : ""}
				</div>`
				: "";

			const resultsHtml = `<div class="stonetop-homestead-reference">
				<strong>Results</strong>
				<ul>${flow.results.map(item => `<li>${_formatResultLine(item)}</li>`).join("")}</ul>
			</div>`;

			// Trade & Barter is how special items are acquired — let the player pick one
			// from the handout list (which fills the item + Value fields for the roll).
			const specialItemHtml = flow.label === "Trade & Barter"
				? `<button type="button" class="stonetop-tb-special-btn"><i class="fas fa-gem"></i> Choose a special item…</button>`
				: "";

			const dialog = new Dialog({
				title: flow.label,
				content: `<form class="stonetop-homestead-dialog">
					<p class="stonetop-homestead-trigger"><em>${_esc(flow.trigger)}</em></p>
					<div class="stonetop-homestead-fields">${fieldHtml}</div>
					${specialItemHtml}
					${resultsHtml}
					${picksHtml}
					${consequencesHtml}
					<p class="stonetop-homestead-note">${_esc(flow.note)}</p>
				</form>`,
				buttons: {
					cancel: { label: "Cancel" },
					post: {
						label: "Post",
						callback: html => this._postHomesteadMoveSummary(flow, html),
					},
					roll: {
						label: `Roll +${flow.statLabel}`,
						callback: async html => {
							await this._postHomesteadMoveSummary(flow, html);
							await this._applyHomesteadBeforeRoll(flow);
							await this._onSteadingRoll(flow.label, flow.stat, this._homesteadRollOptions(flow, html));
						},
					},
				},
				default: "roll",
				render: (html) => {
					html[0].querySelector("[data-action='mark-diminished']")?.addEventListener("click", async () => {
						await this._stonetopSteading.setSystemValue("attributes.debilities.options.diminished.value", true);
						this.render(false);
						ui.notifications.info("Stonetop marked diminished.");
					});
					html[0].querySelector(".stonetop-tb-special-btn")?.addEventListener("click", () => this._onPickSpecialItem(html));
				},
			}, {
				width: 520,
				classes: ["dialog", "stonetop", "stonetop-homestead-move-dialog"],
			});
			dialog.render(true);
		}

		// Trade & Barter: open the Special Items picker. Picking an item fills the move's
		// item + Value fields and adds it to a chosen character's inventory.
		_onPickSpecialItem(dialogHtml) {
			const picker = new SpecialItemPickerDialog(SPECIAL_ITEM_CATALOG, async (slug) => {
				const item = SPECIAL_ITEM_CATALOG.flatMap(g => g.items).find(i => i.slug === slug);
				if (!item) return;
				const wantField  = dialogHtml[0].querySelector('[name="want"]');
				const valueField = dialogHtml[0].querySelector('[name="value"]');
				if (wantField)  wantField.value  = item.traits ? `${item.name} (${item.traits})` : item.name;
				if (valueField) valueField.value = parseInt(item.value, 10) || 0;

				const character = await this._promptSpecialItemCharacter();
				if (character) {
					await new CharacterInventory(new StonetopFlags(character, "inventory")).addSpecial(slug);
					ui.notifications.info(`${item.name} added to ${character.name}.`);
				}
				picker.close();
			});
			picker.render(true);
		}

		_promptSpecialItemCharacter() {
			const chars = game.actors.filter(a => a.type === "character" && a.isOwner);
			if (!chars.length) {
				ui.notifications.warn("No editable character to add the item to.");
				return Promise.resolve(null);
			}
			return new Promise(resolve => {
				new Dialog({
					title: "Add to which character?",
					content: `<form class="stonetop-tb-char-pick"><label>Character
						<select name="char">${chars.map(c => `<option value="${c.id}">${_esc(c.name)}</option>`).join("")}</select></label></form>`,
					buttons: {
						cancel: { label: "Cancel", callback: () => resolve(null) },
						add:    { label: "Add", callback: html => resolve(game.actors.get(html[0].querySelector('[name="char"]').value)) },
					},
					default: "add",
					close: () => resolve(null),
				}, { classes: ["dialog", "stonetop", "stonetop-tb-char-pick-dialog"] }).render(true);
			});
		}

		_formDataFromDialog(html) {
			const form = html[0]?.querySelector(".stonetop-homestead-dialog");
			return form ? Object.fromEntries(new FormData(form)) : {};
		}

		async _applyHomesteadBeforeRoll(flow) {
			if (flow.beforeRoll !== "musterCost") return;
			const fortunes = this._stonetopSteading.getStatValue("fortunes");
			await this._stonetopSteading.setSystemValue("stats.fortunes.value", Math.max(fortunes - 1, -1));
			this.render(false);
			ui.notifications.info(`Muster cost applied: Fortunes ${ sign(fortunes) } -> ${ sign(Math.max(fortunes - 1, -1)) }.`);
		}

		_homesteadRollOptions(flow, html) {
			if (flow.label !== "Trade & Barter") return {};
			const data = this._formDataFromDialog(html);
			const value = Math.max(0, parseInt(data.value) || 0);
			return {
				modifier: value ? -value : 0,
				rollMode: data.winter ? "dis" : undefined,
			};
		}

		async _postHomesteadMoveSummary(flow, html) {
			const data = this._formDataFromDialog(html);
			const rows = flow.fields
				.map(field => {
					const raw   = data[field.name];
					const value = field.type === "checkbox"
						? (raw ? "yes" : "")
						: String(raw ?? "").trim();
					return value ? { label: field.label, value } : null;
				})
				.filter(Boolean);

			const selectedPicks = Object.entries(data)
				.filter(([key]) => key.startsWith("pick.") || key.startsWith("consequence."))
				.map(([, value]) => String(value ?? "").trim())
				.filter(Boolean);
			if (selectedPicks.length) rows.push({ label: "Selected", value: selectedPicks.join("\n") });

			postMoveToChat(this.actor, flow.label, rows);
		}

		async _onMeetWithDisaster() {
			const fortunes = this._stonetopSteading.getStatValue("fortunes");
			const wouldDropBelow = fortunes <= -1;

			if (!wouldDropBelow) {
				const newFortunes = fortunes - 1;
				new Dialog({
					title: "Meet with Disaster",
					content: `<div class="stonetop-disaster-dialog">
						<p><em>Calamity befalls the steading or panic spreads.</em></p>
						<p>Fortunes: <strong>${sign(fortunes)}</strong> → <strong>${sign(newFortunes)}</strong></p>
					</div>`,
					buttons: {
						cancel: { label: "Cancel" },
						apply: {
							label: "Apply",
							callback: async () => {
								await this._stonetopSteading.setSystemValue("stats.fortunes.value", newFortunes);
								this.render(false);
							},
						},
					},
					default: "apply",
				}, { classes: ["dialog", "stonetop", "stonetop-disaster-move-dialog"] }).render(true);
				return;
			}

			// Fortunes is at -1 — would drop further; GM picks a consequence instead.
			const choices = [
				{
					id: "diminished",
					label: "Diminished",
					detail: "from injuries/sickness/doubt — disadvantage to Deploy, Muster, Pull Together",
					action: () => this._stonetopSteading.setSystemValue("attributes.debilities.options.diminished.value", true),
				},
				{
					id: "lacking",
					label: "Lacking",
					detail: "due to shortages/hoarding/distrust — treat Prosperity as 1 lower",
					action: () => this._stonetopSteading.setSystemValue("attributes.debilities.options.lacking.value", true),
				},
				{
					id: "malcontent",
					label: "Malcontent",
					detail: "from fear/anger/despair — Fortunes reset to +0 each season; folks need Persuading more often",
					action: () => this._stonetopSteading.setSystemValue("attributes.debilities.options.malcontent.value", true),
				},
				{
					id: "population",
					label: "Folks start to leave",
					detail: "reduce Population by 1 (min −1)",
					action: () => {
						const pop = this._stonetopSteading.getStatValue("population");
						return this._stonetopSteading.setSystemValue("attributes.population.value", Math.max(pop - 1, -1));
					},
				},
			];

			const choicesHtml = choices.map(c => `
				<li class="stonetop-disaster-choice" data-choice="${c.id}">
					<span class="stonetop-disaster-choice-label">${c.label}</span>
					<span class="stonetop-disaster-choice-detail">${c.detail}</span>
				</li>`).join("");

			let dialog;
			dialog = new Dialog({
				title: "Meet with Disaster",
				content: `<div class="stonetop-disaster-dialog">
					<p><em>Fortunes cannot drop below −1.</em> The GM picks 1:</p>
					<ol class="stonetop-disaster-choices">${choicesHtml}</ol>
				</div>`,
				buttons: { cancel: { label: "Cancel" } },
				render: (html) => {
					html[0].querySelectorAll(".stonetop-disaster-choice").forEach(el => {
						el.addEventListener("click", async () => {
							const choice = choices.find(c => c.id === el.dataset.choice);
							if (!choice) return;
							await choice.action();
							this.render(false);
							dialog.close();
						});
					});
				},
			}, { classes: ["dialog", "stonetop", "stonetop-disaster-move-dialog"] });
			dialog.render(true);
		}

		async _onRequisitionWalkthrough() {
			const fortunes = this._stonetopSteading.getStatValue("fortunes");
			const newFortunes = Math.max(fortunes - 1, -1);
			const requisitionFlow = {
				label: "Requisition",
				fields: [
					{ name: "asset", label: "Asset" },
					{ name: "risk", label: "Risk" },
					{ name: "convincing", label: "Who needs convincing?" },
				],
			};

			const dialog = new Dialog({
				title: "Requisition",
				content: `<form class="stonetop-homestead-dialog">
					<p class="stonetop-homestead-trigger"><em>When you borrow some of the steading's assets for an expedition or otherwise put them at risk, roll +Fortunes.</em></p>
					<div class="stonetop-homestead-fields">
						<label class="stonetop-homestead-field">
							<span>Asset</span>
							<input type="text" name="asset" placeholder="Horse team, wagon, plow, common asset...">
						</label>
						<label class="stonetop-homestead-field">
							<span>Risk</span>
							<textarea name="risk" rows="2" placeholder="Where is it going, and how might it be lost or damaged?"></textarea>
						</label>
						<label class="stonetop-homestead-field">
							<span>Who needs convincing?</span>
							<input type="text" name="convincing" placeholder="Owner, family, council, militia, publican...">
						</label>
					</div>
					<div class="stonetop-homestead-reference">
						<strong>Results</strong>
						<ul>
							<li><strong>10+:</strong> go ahead, but bring it back safely.</li>
							<li><strong>7-9:</strong> you will need to do some convincing.</li>
							<li><strong>6-:</strong> do not mark XP; you can take the asset, but if you do, reduce Fortunes by 1.</li>
						</ul>
					</div>
					<div class="stonetop-season-actions">
						<button type="button" class="stonetop-season-btn" data-action="miss-cost">
							<i class="fas fa-arrow-down"></i> Take it on a miss: Fortunes ${sign(fortunes)} -> ${sign(newFortunes)}
						</button>
					</div>
				</form>`,
				buttons: {
					cancel: { label: "Cancel" },
					post: {
						label: "Post",
						callback: html => this._postHomesteadMoveSummary(requisitionFlow, html),
					},
					roll: {
						label: "Roll +Fortunes",
						callback: async html => {
							await this._postHomesteadMoveSummary(requisitionFlow, html);
							await this._onSteadingRoll("Requisition", "fortunes");
						},
					},
				},
				default: "roll",
				render: (html) => {
					html[0].querySelector("[data-action='miss-cost']")?.addEventListener("click", async () => {
						await this._stonetopSteading.setSystemValue("stats.fortunes.value", newFortunes);
						this.render(false);
						ui.notifications.info(`Fortunes reduced to ${sign(newFortunes)}.`);
					});
				},
			}, { width: 520, classes: ["dialog", "stonetop", "stonetop-homestead-move-dialog"] });
			dialog.render(true);
		}

		// The campaign year the Seasons Change flow is currently on (a steading flag,
		// starting at 1). Advanced by one each time a Winter is completed (see
		// _saveSeasonChange), so the season picker defaults to the latest year.
		_seasonsCurrentYear() {
			return Math.max(1, Math.trunc(Number(this.actor.getFlag(STONETOP_SCOPE, "seasonsCurrentYear")) || 1));
		}

		async _onSeasonsChange() {
			// Ids + labels come from the shared season source, not a local copy.
			const SEASONS = SEASON_IDS.map(id => ({ id, label: seasonLabel(id) }));
			// Year dropdown under the season cards: every year up to the current one
			// (Winter completion bumps it), defaulting to the latest so the journal page
			// matches by default. The chosen year rides through to recordSeasonsChange.
			const currentYear  = this._seasonsCurrentYear();
			const yearOptions  = Array.from({ length: currentYear }, (_, i) => i + 1)
				.map(y => `<option value="${y}"${y === currentYear ? " selected" : ""}>${ordinalWord(y)} Year</option>`)
				.join("");
			let dialog;
			dialog = new Dialog({
				title: "Seasons Change",
				content: `<div class="stonetop-season-picker">
					<p><em>Which season is beginning?</em></p>
					<div class="stonetop-season-cards">
						${SEASONS.map(s => `
							<div class="stonetop-season-card" data-season="${s.id}">
								<img src="${seasonIconSrc(s.id)}" alt="${s.label}" class="stonetop-season-icon">
								<span class="stonetop-season-label">${s.label}</span>
							</div>`).join("")}
					</div>
					<div class="stonetop-season-year">
						<label class="stonetop-season-year-label" for="stonetop-season-year-select">Year</label>
						<select id="stonetop-season-year-select" class="stonetop-season-year-select">${yearOptions}</select>
					</div>
				</div>`,
				buttons: {},
				render: (html) => {
					addStonetopSteadingButton(html);
					const yearSelect = html[0].querySelector(".stonetop-season-year-select");
					html[0].querySelectorAll(".stonetop-season-card").forEach(el => {
						el.addEventListener("click", () => {
							const year = Math.trunc(Number(yearSelect?.value)) || currentYear;
							dialog.close();
							this._showSeasonDialog(el.dataset.season, year);
						});
					});
				},
			}, { classes: ["dialog", "stonetop", "stonetop-season-picker-dialog"] });
			dialog.render(true);
		}

		// Read the season dialog's ticked gains + notes off the DOM (Done), apply the two
		// gains with a mechanical effect (Population boom, Unexpected bounty), reset Fortunes
		// for the new season, record this season into the chosen `year`'s page of the
		// "Seasons Change" Chronicle journal (with the net Surplus change since the dialog
		// opened), then open it. Completing a Winter advances the steading's current year so
		// the next picker defaults to the new one. GM-only.
		async _saveSeasonChange(seasonId, html, fortunes, resetFortunes = 1, initialSurplus = null, year = this._seasonsCurrentYear()) {
			const root = html?.jquery ? html[0] : (html?.[0] ?? html);
			if (!root) return;
			const checkedKeys = Array.from(root.querySelectorAll(".stonetop-season-gain-check:checked"))
				.map(el => el.dataset.gainKey);
			const gainNames = checkedKeys
				.map(key => SEASONAL_GAINS.find(g => g.key === key)?.name)
				.filter(Boolean);

			// Apply the mechanical gains the GM ticked (the others are narrative-only) and
			// reset Fortunes in one update — all effects of the Seasons Change homefront
			// move, so the ledger names it; batching keeps it to a single ledger append and
			// one combined stat-change card. Notices are queued so they still read in the
			// Population → Bounty → Fortunes order.
			const updates = {};
			const notices = [];
			if (checkedKeys.includes("population")) {
				const newPopulation = Math.min(this._stonetopSteading.getStatValue("population") + 1, 3);
				updates["attributes.population.value"] = newPopulation;
				notices.push(`Population boom: Population increased to ${sign(newPopulation)}.`);
			}

			// Net Surplus change over the whole season flow (the harvest/bounty, or winter
			// consumption): the live value already reflects the season's surplus/consumption
			// buttons, plus the bounty we're about to add. Computed locally so it doesn't
			// depend on reading the value back after the write.
			const finalSurplus = this._stonetopSteading.getStatValue("surplus") + (checkedKeys.includes("bounty") ? 1 : 0);
			if (checkedKeys.includes("bounty")) {
				updates["attributes.surplus.value"] = finalSurplus;
				notices.push(`Unexpected bounty: Surplus increased to ${finalSurplus}.`);
			}

			updates["stats.fortunes.value"] = resetFortunes;
			notices.push(`Fortunes reset to ${sign(resetFortunes)}.`);

			await this._stonetopSteading.setSystemValues(updates, { stonetopMove: "Seasons Change" });
			for (const notice of notices) ui.notifications.info(notice);

			const surplusChange = Number.isFinite(initialSurplus) ? finalSurplus - initialSurplus : 0;

			const notes   = root.querySelector(".stonetop-season-notes")?.value ?? "";
			const journal = await recordSeasonsChange({ seasonId, year, gainNames, fortunes, surplusChange, notes });

			// Winter closes out the year: advance the steading's current year so the next
			// season picker offers (and defaults to) the new one. max() guards against
			// recording an out-of-order older Winter regressing the count.
			if (seasonId === "winter") {
				await this.actor.setFlag(STONETOP_SCOPE, "seasonsCurrentYear", Math.max(this._seasonsCurrentYear(), year + 1));
			}

			journal?.sheet?.render(true);
		}

		async _showSeasonDialog(seasonId, year = this._seasonsCurrentYear()) {
			// The seasons have turned: post a chat card reminding the table of any
			// character's seasonal move/possession upkeep (Rites of the Land, Collected
			// offerings, etc.).
			postSeasonsChangeReminder(seasonId);

			const fortunes   = this._stonetopSteading.getStatValue("fortunes");
			const surplus    = this._stonetopSteading.getStatValue("surplus");
			const population = this._stonetopSteading.getStatValue("population");
			const malcontent = this._stonetopSteading.getSystemValue("attributes.debilities.options.malcontent.value", false);
			const resetFortunes = malcontent ? 0 : 1;

			const label   = seasonLabel(seasonId);
			const iconSrc = seasonIconSrc(seasonId);

			const header = `<div class="stonetop-season-flow-header">
				<img src="${iconSrc}" alt="${label}" class="stonetop-season-icon-sm">
				<h3>${label}</h3>
			</div>`;

			const statsNote = `<p class="stonetop-season-note">Fortunes: <strong>${sign(fortunes)}</strong> &nbsp;·&nbsp; Surplus: <strong>${surplus}</strong> &nbsp;·&nbsp; Population: <strong>${sign(population)}</strong></p>`;

			// Spring hands the roll to the table (the most hopeful PC rolls in chat), so it
			// shows "Ask the most hopeful…" where the other seasons show "Roll +Fortunes".
			// "Whatever the result, reset Fortunes to +1" is the close-out of every season,
			// so it's folded into Done (see _saveSeasonChange) rather than a separate button.
			const rollOrAskBtn = seasonId === "spring"
				? `<button class="stonetop-season-btn" data-action="ask-hopeful">
					<i class="fas fa-comment-dots"></i> Ask the most hopeful to roll (in chat)
				</button>`
				: `<button class="stonetop-season-btn" data-action="roll-fortunes">
					<i class="fas fa-dice-d6"></i> Roll +Fortunes (current: ${sign(fortunes)})
				</button>`;
			const fortunesBtns = `<div class="stonetop-season-actions">
				${rollOrAskBtn}
			</div>`;

			// Seasonal gains as a checklist the GM ticks (recorded into the Seasons Change
			// journal on Done). The two with a mechanical effect — Population boom (+1
			// Population) and Unexpected bounty (+1 Surplus) — are applied on Done when
			// ticked rather than via their own buttons; the Done button relabels to say so.
			// Gain copy comes from the shared SEASONAL_GAINS so the dialog and Chronicle
			// stay in lockstep.
			const gainsRef = `<div class="stonetop-season-gains">
				<p class="stonetop-season-gains-label">Seasonal gains <span class="stonetop-season-gains-hint">&mdash; tick what they pick</span></p>
				<ul class="stonetop-season-gains-list">
					${SEASONAL_GAINS.map(g => `<li class="stonetop-season-gain">
						<label class="stonetop-season-gain-label">
							<input type="checkbox" class="stonetop-season-gain-check" data-gain-key="${g.key}">
							<span class="stonetop-season-gain-body">
								<span class="stonetop-season-gain-name">${g.name}</span>
								<span class="stonetop-season-gain-text">${g.text}</span>
							</span>
						</label>
					</li>`).join("")}
				</ul>
			</div>`;

			// Free-text notes recorded onto the season's Chronicle page on Done (the omen,
			// the threat that surfaced, the hook it opens).
			const notesBlock = `<div class="stonetop-season-notes-wrap">
				<label class="stonetop-season-notes-label"><i class="fas fa-feather"></i> Notes for the Chronicle</label>
				<textarea class="stonetop-season-notes" rows="2" placeholder="The omen, threat, or hook this season opens…"></textarea>
			</div>`;

			let content;
			if (seasonId === "spring") {
				content = `<div class="stonetop-season-flow">
					${header}
					<p>Whoever is the <strong>most hopeful</strong> rolls +Fortunes:</p>
					<ul>
						<li><strong>10+:</strong> Pick 1 seasonal gain.</li>
						<li><strong>7–9:</strong> Pick 1 seasonal gain, but a threat makes itself known or gets worse.</li>
						<li><strong>6−:</strong> Threats abound. Don't mark XP.</li>
					</ul>
					<p class="stonetop-season-note">Whatever the result, reset Fortunes to +1.</p>
					${statsNote}${gainsRef}${fortunesBtns}${notesBlock}
				</div>`;
			} else if (seasonId === "summer") {
				content = `<div class="stonetop-season-flow">
					${header}
					<p>Whoever is the <strong>most content</strong> rolls +Fortunes:</p>
					<ul>
						<li><strong>10+:</strong> Pick 2 seasonal gains.</li>
						<li><strong>7–9:</strong> Pick 1 seasonal gain.</li>
						<li><strong>6−:</strong> A threat makes itself known or gets worse. Don't mark XP.</li>
					</ul>
					<p class="stonetop-season-note">Whatever the result, the steading generates 1d4−1 Surplus, then Fortunes resets to +1.</p>
					${statsNote}${gainsRef}${fortunesBtns}
					<div class="stonetop-season-actions">
						<button class="stonetop-season-btn" data-action="roll-surplus">
							<i class="fas fa-dice-d4"></i> Roll 1d4−1 Surplus (add to steading)
						</button>
					</div>
					${notesBlock}
				</div>`;
			} else if (seasonId === "autumn") {
				content = `<div class="stonetop-season-flow">
					${header}
					<p>Whoever is the <strong>most determined</strong> rolls +Fortunes:</p>
					<ul>
						<li><strong>10+:</strong> Pick 1 seasonal gain.</li>
						<li><strong>7–9:</strong> Pick 1 seasonal gain, but a threat makes itself known or gets worse.</li>
						<li><strong>6−:</strong> Threats abound. Don't mark XP.</li>
					</ul>
					<p class="stonetop-season-note">Whatever the result, reset Fortunes to +1. When harvest is complete, the steading generates 1d4 Surplus.</p>
					${statsNote}${gainsRef}${fortunesBtns}
					<div class="stonetop-season-actions">
						<button class="stonetop-season-btn" data-action="roll-surplus">
							<i class="fas fa-dice-d4"></i> Roll 1d4 Surplus (Harvest)
						</button>
					</div>
					${notesBlock}
				</div>`;
			} else {
				// Winter
				content = `<div class="stonetop-season-flow">
					${header}
					<p>Whoever is the <strong>weariest</strong> rolls 1d4+Population (min 0); the steading consumes that much Surplus.</p>
					${statsNote}
					<div id="stonetop-winter-step1" class="stonetop-season-actions">
						<button class="stonetop-season-btn" data-action="roll-consumption">
							<i class="fas fa-dice-d4"></i> Roll 1d4+Population for Surplus Consumption
						</button>
					</div>
					<div id="stonetop-winter-step2" hidden>
						<p id="stonetop-winter-result" class="stonetop-season-note"></p>
						<div id="stonetop-winter-ok" hidden>
							<div class="stonetop-season-actions">
								<button class="stonetop-season-btn" data-action="apply-consumption">Apply Surplus Consumption</button>
							</div>
						</div>
						<div id="stonetop-winter-shortfall" hidden>
							<p>⚠️ <strong>Not enough Surplus.</strong> Reduce Surplus to 0 and Fortunes by 1, then the GM picks 1:</p>
							<ol class="stonetop-disaster-choices">
								<li class="stonetop-disaster-choice" data-consequence="population">
									<span class="stonetop-disaster-choice-label">Population loss</span>
									<span class="stonetop-disaster-choice-detail">Reduce Population by 1 (min −1) due to death, decrepitude, and departure.</span>
								</li>
								<li class="stonetop-disaster-choice" data-consequence="resource">
									<span class="stonetop-disaster-choice-label">Important resource lost or damaged</span>
									<span class="stonetop-disaster-choice-detail">A horse, the cistern, etc. — lost or not maintained (narrative).</span>
								</li>
								<li class="stonetop-disaster-choice" data-consequence="npc">
									<span class="stonetop-disaster-choice-label">Important NPC dies</span>
									<span class="stonetop-disaster-choice-detail">Their role unfilled — a narrative consequence.</span>
								</li>
								<li class="stonetop-disaster-choice" data-consequence="pc">
									<span class="stonetop-disaster-choice-label">A PC dies, leaves, or retires</span>
									<span class="stonetop-disaster-choice-detail">A narrative consequence for the group to resolve.</span>
								</li>
							</ol>
						</div>
					</div>
					<div id="stonetop-winter-step3" hidden>
						<hr class="stonetop-season-divider">
						<p>Then, roll +Fortunes:</p>
						<ul>
							<li><strong>10+:</strong> Winter is relatively mild. Each player names a local NPC with whom their relationship improves.</li>
							<li><strong>7–9:</strong> The steading must consume 1d4+Population more Surplus before winter ends, or suffer the consequences again.</li>
							<li><strong>6−:</strong> As 7–9, plus threats abound. Don't mark XP.</li>
						</ul>
						<p class="stonetop-season-note">Whatever the result, reset Fortunes to +1.</p>
						${fortunesBtns}
					</div>
					${notesBlock}
				</div>`;
			}

			let dialog;
			dialog = new Dialog({
				title: `Seasons Change — ${label}`,
				content,
				// Done resets Fortunes (the season's close-out), applies any ticked mechanical
				// gains, then records this season into the year's "Seasons Change" Chronicle
				// page: the gains, the net Surplus change, the notes. `surplus` (captured at
				// open) is the baseline for that change.
				buttons: { done: { label: "Done", callback: (html) => this._saveSeasonChange(seasonId, html, fortunes, resetFortunes, surplus, year) } },
				render: (html) => {
					addStonetopSteadingButton(html);
					const root = html[0];
					// Every stat change in this walkthrough is an effect of the Seasons Change
					// homefront move, so the ledger attributes them to it.
					const seasonsMove = { stonetopMove: "Seasons Change" };

					root.querySelector("[data-action='roll-fortunes']")?.addEventListener("click", () => {
						this._onSteadingRoll("Seasons Change", "fortunes");
					});

					// Spring only: hand the roll to the table — post a chat card asking the
					// most hopeful character's player to roll +Fortunes, with a button to do it.
					root.querySelector("[data-action='ask-hopeful']")?.addEventListener("click", () => {
						postSeasonsRollPrompt({ alias: `Seasons Change — ${label}`, fortunes });
					});

					// Done resets Fortunes for the new season (the move's guaranteed close-out)
					// and applies any ticked mechanical gains — Population boom (+1 Population)
					// and Unexpected bounty (+1 Surplus) — instead of those having their own
					// buttons. Relabel Done so the GM knows what the click will write to the
					// steading. The Dialog's footer button lives in `.dialog-buttons`, a SIBLING
					// of `root` (`.dialog-content`), so it's looked up off the dialog's outer
					// element.
					const refreshDoneLabel = () => {
						const appEl = dialog.element?.jquery ? dialog.element[0] : dialog.element;
						const doneBtn = appEl?.querySelector("button[data-button='done']");
						if (!doneBtn) return;
						const willApply = !!root.querySelector(".stonetop-season-gain-check[data-gain-key='population']:checked")
							|| !!root.querySelector(".stonetop-season-gain-check[data-gain-key='bounty']:checked");
						doneBtn.textContent = willApply
							? `Apply those Gains, reset Fortunes to ${sign(resetFortunes)} & Close`
							: `Reset Fortunes to ${sign(resetFortunes)} & Close`;
					};
					root.querySelectorAll(".stonetop-season-gain-check").forEach(cb =>
						cb.addEventListener("change", refreshDoneLabel));
					refreshDoneLabel();

					root.querySelector("[data-action='roll-surplus']")?.addEventListener("click", async () => {
						const formula = seasonId === "summer" ? "1d4 - 1" : "1d4";
						const roll = await new Roll(formula).evaluate();
						const gain = Math.max(0, roll.total);
						await roll.toMessage({ flavor: `Surplus Generation (${label})` });
						await this._stonetopSteading.setSystemValue("attributes.surplus.value", surplus + gain, seasonsMove);
						this.render(false);
						ui.notifications.info(`Generated ${gain} Surplus. New total: ${surplus + gain}.`);
					});

					// Winter — consumption roll
					root.querySelector("[data-action='roll-consumption']")?.addEventListener("click", async () => {
						const popAbs = Math.abs(population);
						const formula = population >= 0 ? `1d4 + ${population}` : `1d4 - ${popAbs}`;
						const roll = await new Roll(formula).evaluate();
						const consumption = Math.max(0, roll.total);
						await roll.toMessage({ flavor: "Winter Surplus Consumption" });

						root.querySelector("#stonetop-winter-step1").hidden = true;
						root.querySelector("#stonetop-winter-step2").hidden = false;
						root.querySelector("#stonetop-winter-result").textContent =
							`Roll: ${consumption}. Surplus needed: ${consumption}, available: ${surplus}.`;

						if (surplus >= consumption) {
							root.querySelector("#stonetop-winter-ok").hidden = false;
							root.querySelector("[data-action='apply-consumption']").addEventListener("click", async () => {
								await this._stonetopSteading.setSystemValue("attributes.surplus.value", surplus - consumption, seasonsMove);
								this.render(false);
								root.querySelector("#stonetop-winter-ok").hidden = true;
								root.querySelector("#stonetop-winter-step3").hidden = false;
								ui.notifications.info(`Consumed ${consumption} Surplus. Remaining: ${surplus - consumption}.`);
							});
						} else {
							root.querySelector("#stonetop-winter-shortfall").hidden = false;
							root.querySelectorAll("[data-consequence]").forEach(el => {
								el.addEventListener("click", async () => {
									const newFortunes = Math.max(fortunes - 1, -1);
									await this._stonetopSteading.setSystemValue("attributes.surplus.value", 0, seasonsMove);
									await this._stonetopSteading.setSystemValue("stats.fortunes.value", newFortunes, seasonsMove);
									if (el.dataset.consequence === "population") {
										const newPop = Math.max(population - 1, -1);
										await this._stonetopSteading.setSystemValue("attributes.population.value", newPop, seasonsMove);
										ui.notifications.info(`Shortfall: Surplus → 0, Fortunes → ${sign(newFortunes)}, Population → ${sign(newPop)}.`);
									} else {
										ui.notifications.info(`Shortfall: Surplus → 0, Fortunes → ${sign(newFortunes)}. Apply the narrative consequence.`);
									}
									this.render(false);
									root.querySelector("#stonetop-winter-step2").hidden = true;
									root.querySelector("#stonetop-winter-step3").hidden = false;
								});
							});
						}
					});
				},
			}, { classes: ["dialog", "stonetop", "stonetop-season-flow-dialog"] });
			dialog.render(true);
		}

		async _onSteadingRoll(moveName, statKey, rollOptions = {}) {
			if (!statKey) return;
			const diminished = this._stonetopSteading.getSystemValue("attributes.debilities.options.diminished.value", false);
			const lacking = this._stonetopSteading.getSystemValue("attributes.debilities.options.lacking.value", false);
			const options = {
				...rollOptions,
				moveName,
				rollMode: _normalizeSheetRollMode(rollOptions.rollMode ?? this._sheetRollMode()),
				statValue: this._stonetopSteading.getStatValue(statKey),
			};
			if (rollOptions.statValue !== undefined) options.statValue = rollOptions.statValue;
			if (diminished && DIMINISHED_MOVES.has(moveName)) {
				options.rollMode = "dis";
				options.stonetopDebility = "Diminished";
				options.stonetopDebilityTooltip = "Disadvantage to Deploy, Muster, or Pull Together.";
			}
			if (lacking && statKey === "prosperity") {
				options.statValue -= 1;
				options.stonetopDebility = "Lacking";
				options.stonetopDebilityTooltip = "Treat Prosperity as 1 lower.";
			}
			await rollStat(statKey, this.actor, {
				...options,
			});
		}

		_sheetRollMode() {
			return _normalizeSheetRollMode(this.actor.getFlag(STONETOP_SCOPE, "rollMode"));
		}

		async _onSteadingTrackChange(path, value) {
			await this._stonetopSteading.setSystemValue(path.replace(/^system\./, ""), value);
		}

		async _onListItemCheck(list, index, checked) {
			const f = this._stonetopSteading._flags;
			const arr = foundry.utils.deepClone(f[list] ?? STEADING_DEFAULTS[list]);
			if (!arr[index]) return;
			arr[index].checked = checked;
			await this._stonetopSteading.setFlags({ [list]: arr });
		}

		async _onReturnAsset(index) {
			const name = this._stonetopSteading._flags.assets?.[index]?.name ?? "Asset";
			await this._stonetopSteading.returnAsset(index);
			this.render(false);
			ui.notifications.info(`${name} returned to ${this.actor.name}.`);
		}

		async _onListItemAdd(list) {
			if (list === "residents") {
				new AddSteadingMemberDialog("resident", async (data) => {
					const f = this._stonetopSteading._flags;
					const arr = foundry.utils.deepClone(f.residents ?? STEADING_DEFAULTS.residents);
					arr.push({ ...data, checked: false });
					await this._stonetopSteading.setFlags({ residents: arr });
					this.render(false);
				}).render(true);
				return;
			}
			if (list === "neighbors") {
				new AddSteadingMemberDialog("neighbor", async (data) => {
					const f = this._stonetopSteading._flags;
					const arr = foundry.utils.deepClone(f.neighbors ?? STEADING_DEFAULTS.neighbors);
					arr.push({ ...data, checked: false });
					await this._stonetopSteading.setFlags({ neighbors: arr });
					this.render(false);
				}).render(true);
				return;
			}
			const labels = { resources: "resource", fortifications: "fortification", assets: "asset" };
			const label = labels[list] ?? list;
			const input = `<div style="margin-bottom:4px"><input type="text" name="entry-name" placeholder="Name…" style="width:100%"></div>`;
			new Dialog({
				title: `Add ${label.charAt(0).toUpperCase() + label.slice(1)}`,
				content: input,
				buttons: {
					add: {
						label: "Add",
						callback: async (html) => {
							const name = html.find("[name=entry-name]").val()?.trim();
							if (!name) return;
							const f = this._stonetopSteading._flags;
							const arr = foundry.utils.deepClone(f[list] ?? STEADING_DEFAULTS[list]);
							arr.push({ name, checked: false });
							await this._stonetopSteading.setFlags({ [list]: arr });
							this.render(false);
						},
					},
					cancel: { label: "Cancel" },
				},
				default: "add",
				render: (html) => html.find("[name=entry-name]").focus(),
			}, { classes: ["dialog", "stonetop", "stonetop-steading-add-dialog"] }).render(true);
		}

		async _onListItemDelete(list, index) {
			const f = this._stonetopSteading._flags;
			const arr = foundry.utils.deepClone(f[list] ?? STEADING_DEFAULTS[list]);
			arr.splice(index, 1);
			await this._stonetopSteading.setFlags({ [list]: arr });
			this.render(false);
		}

		async _onPlaceChange(index, value) {
			const f = this._stonetopSteading._flags;
			const places = foundry.utils.deepClone(f.places ?? STEADING_DEFAULTS.places);
			places[index].name = value;
			await this._stonetopSteading.setFlags({ places });
		}

		async _onNeighborChange(index, field, value) {
			if (!["name", "home", "occupation", "traits", "relations", "notes"].includes(field)) return;
			const f = this._stonetopSteading._flags;
			const neighbors = foundry.utils.deepClone(f.neighbors ?? STEADING_DEFAULTS.neighbors);
			if (!neighbors[index]) neighbors[index] = { name: "", home: "", occupation: "", traits: "", relations: "", notes: "", checked: false };
			neighbors[index][field] = value;
			await this._stonetopSteading.setFlags({ neighbors });
		}

		async _onPlayerFieldChange(index, field, value) {
			if (!["occupation", "traits", "relations", "notes"].includes(field)) return;
			const f = this._stonetopSteading._flags;
			const players = foundry.utils.deepClone(f.players ?? STEADING_DEFAULTS.players);
			if (!players[index]) return;
			players[index][field] = value;
			await this._stonetopSteading.setFlags({ players });
		}

		async _onResidentChange(index, field, value) {
			if (!["name", "occupation", "traits", "relations", "notes"].includes(field)) return;
			const f = this._stonetopSteading._flags;
			const residents = foundry.utils.deepClone(f.residents ?? STEADING_DEFAULTS.residents);
			if (!residents[index]) residents[index] = { name: "", occupation: "", traits: "", relations: "", notes: "", checked: false };
			residents[index][field] = value;
			await this._stonetopSteading.setFlags({ residents });
		}

		async _onDropPlayerCharacter(actor) {
			const f = this._stonetopSteading._flags;
			const players = foundry.utils.deepClone(f.players ?? STEADING_DEFAULTS.players);
			const actorUuid = actor.uuid ?? "";
			const actorId = actor.id ?? actor._id ?? "";

			const existingIdx = players.findIndex(player =>
				(actorUuid && player.uuid === actorUuid) ||
				(actorId && player.id === actorId) ||
				player.name?.toLowerCase().trim() === actor.name?.toLowerCase().trim()
			);

			if (existingIdx >= 0) {
				ui.notifications?.info?.(`${actor.name} is already in the players list.`);
				this.render(false);
				return;
			}

			players.push({
				id: actorId,
				uuid: actorUuid,
				name: actor.name,
				img: actor.img ?? "",
				checked: true,
				traits: "",
				relations: "",
				notes: "",
			});

			await this._stonetopSteading.setFlags({ players });
			this.render(false);
			ui.notifications?.info?.(`Added ${actor.name} to players.`);
		}

		async _onNotesChange(value) {
			await this._stonetopSteading.setFlags({ notes: value });
		}

		async _onCurrencyChange(currency, field, value) {
			const f = this._stonetopSteading._flags;
			const cur = foundry.utils.deepClone(f[currency] ?? STEADING_DEFAULTS[currency]);
			cur[field] = value;
			await this._stonetopSteading.setFlags({ [currency]: cur });
		}

		async _onImprovementComplete(slug, checked) {
			const f = this._stonetopSteading._flags;
			const improvements = foundry.utils.deepClone(f.improvements ?? {});
			if (!improvements[slug]) improvements[slug] = { completed: false, r: [] };
			// Can't mark complete until the requirements are met (the checkbox is also
			// disabled in that state — this guards a stale-DOM race). Unchecking is
			// always allowed so a mistaken completion can be undone.
			if (checked) {
				const def = this._stonetopSteading.improvementDef(slug);
				if (def && !improvementRequirementsMet(def, improvements[slug].r ?? [])) {
					this.render(false);
					return;
				}
			}
			improvements[slug].completed = checked;
			await this._stonetopSteading.setFlags({ improvements });
		}

		async _onImprovementReq(slug, index, checked) {
			const f = this._stonetopSteading._flags;
			const improvements = foundry.utils.deepClone(f.improvements ?? {});
			if (!improvements[slug]) improvements[slug] = { completed: false, r: [] };
			if (!improvements[slug].r) improvements[slug].r = [];
			improvements[slug].r[index] = checked;
			await this._stonetopSteading.setFlags({ improvements });
		}

		async _onDropSteadingImprovement(improvement) {
			if (!improvement?.name) return;
			const result = await this._stonetopSteading.addCustomImprovement(improvement);
			if (result.ok) {
				globalThis.ui?.notifications?.info?.(`Added steading improvement: ${result.label}.`);
				this.render(false);
			} else if (result.reason === "duplicate") {
				globalThis.ui?.notifications?.warn?.(`${result.label} is already a steading improvement.`);
			}
		}

		async _onRemoveCustomImprovement(slug) {
			if (!slug) return;
			const removed = await this._stonetopSteading.removeCustomImprovement(slug);
			if (removed) this.render(false);
		}
	};
}
