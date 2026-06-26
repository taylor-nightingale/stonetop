import { escHtml } from "../utils/strings.js";
import { sign } from "../utils/roll-engine.js";
import { ensureChronicleFolder, ensureChronicleJournal } from "../utils/chronicle.js";
import { seasonLabel } from "./seasons-change-reminders.js";

// ── Seasons Change chronicle ───────────────────────────────────────────────────
// Records each Seasons Change move (the steading flow's "Done") into a "Seasons Change"
// journal inside the shared "The Chronicle" folder. There's one page per year — "First
// Year", "Second Year", … — chosen in the season picker's year dropdown (which advances
// when a Winter is completed). Each season folds into its year's page, under a heading,
// so a year reads top to bottom: Spring, Summer, Autumn, Winter.

const SEASONS_JOURNAL_NAME = "Seasons Change";

// English ordinal for a positive integer: 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th".
export function ordinal(n) {
	const v = n % 100;
	if (v >= 11 && v <= 13) return `${n}th`;
	return `${n}${({ 1: "st", 2: "nd", 3: "rd" })[n % 10] ?? "th"}`;
}

const _ORDINAL_WORDS = [
	"", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth",
	"Ninth", "Tenth", "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth",
	"Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth", "Twentieth",
];

// Word ordinal for a small positive integer: 1 → "First", 2 → "Second", … up to 20,
// then falls back to the numeric ordinal ("21st") for longer-running campaigns.
export function ordinalWord(n) {
	return _ORDINAL_WORDS[n] ?? ordinal(n);
}

// Find (or create) the "Seasons Change" journal in the Chronicle folder, reusing the
// shared folder/journal find-or-create so all of the Chronicle journals are built the
// same way. Player-readable (OBSERVER) like the introductions journal.
async function ensureSeasonsJournal() {
	const folder = await ensureChronicleFolder();
	if (!folder) return null;
	return ensureChronicleJournal(SEASONS_JOURNAL_NAME, folder.id, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
}

// Canonical season order within a year page, so a year always reads Spring → Winter
// regardless of the order the GM happened to record the seasons in.
const _SEASON_ORDER = ["spring", "summer", "autumn", "winter"];

// One season's block within a year page: a heading for the season — carrying the
// matching season glyph, the same as the location journals (see .stonetop-season-entry
// in stonetop.css) — then the seasonal gains chosen, the Fortunes rolled against, any
// net Surplus change (the harvest/bounty or winter consumption), and any notes. Wrapped
// in a `<section data-season>` marker so re-recording a season can find and replace its
// block rather than appending a duplicate (see mergeSeasonBlock).
function _seasonBlock(seasonId, gainNames, fortunes, surplusChange, notes) {
	// CSS modifier matches the location pages' season classes ("autumn" art is "fall").
	const seasonClass = `stonetop-season--${seasonId === "autumn" ? "fall" : seasonId}`;
	const gainsHtml = gainNames.length
		? `<p><strong>Seasonal gain${gainNames.length > 1 ? "s" : ""}:</strong> ${gainNames.map(escHtml).join(", ")}</p>`
		: `<p><em>No seasonal gain.</em></p>`;
	const fortunesHtml = Number.isFinite(fortunes) ? `<p><strong>Rolled:</strong> +Fortunes (${sign(fortunes)})</p>` : "";
	const surplusHtml = Number.isFinite(surplusChange) && surplusChange !== 0
		? `<p><strong>Surplus change:</strong> ${sign(surplusChange)}</p>`
		: "";
	const notesHtml = notes?.trim() ? `<div>${escHtml(notes.trim()).replace(/\n/g, "<br>")}</div>` : "";
	return `<section class="stonetop-season-block" data-season="${seasonId}">`
		+ `<h2 class="stonetop-season-entry ${seasonClass}">${escHtml(seasonLabel(seasonId))}</h2>`
		+ `${gainsHtml}${fortunesHtml}${surplusHtml}${notesHtml}</section>`;
}

// Merge one season's block into a year page's existing HTML: if that season was already
// recorded, replace its block (so re-running a season overwrites rather than duplicates
// it); otherwise add it. Either way the result is re-emitted in canonical season order.
// Each block is a `<section data-season>` with no nested </section>, so the non-greedy
// match below pulls out one whole block at a time. Pure, so the tests can drive it.
export function mergeSeasonBlock(existingHtml = "", seasonId, block) {
	const blocks = {};
	const re = /<section class="stonetop-season-block"[\s\S]*?<\/section>/g;
	for (const m of (existingHtml.match(re) ?? [])) {
		const season = (m.match(/data-season="([^"]+)"/) ?? [])[1];
		if (season) blocks[season] = m;
	}
	blocks[seasonId] = block;
	return _SEASON_ORDER.map(s => blocks[s]).filter(Boolean).join("");
}

/**
 * Record one Seasons Change into the "Seasons Change" journal and return the journal
 * (so the caller can open it). One page per year — "First Year", "Second Year", … —
 * tagged with a `chronicleYear` flag. The caller picks the `year` (from the season
 * picker's year dropdown, which advances when a Winter is completed); the season's
 * block is merged into that year's page (replacing an earlier block for the same
 * season rather than duplicating it), creating the page the first time. Records the seasonal
 * gains chosen, the Fortunes rolled against, the net Surplus change, and any notes the
 * GM jotted. GM-only.
 * @param {object}        opts
 * @param {string}        opts.seasonId       A SEASON_IDS key (spring/summer/autumn/winter).
 * @param {number}        [opts.year]         The campaign year this season belongs to (1+).
 * @param {string[]}      [opts.gainNames]    The seasonal gains chosen, by display name.
 * @param {number|null}   [opts.fortunes]     The +Fortunes value at the time (for context).
 * @param {number}        [opts.surplusChange] Net Surplus change over the season (0 = omit).
 * @param {string}        [opts.notes]        Free-text notes (the omen, threat, or hook).
 * @returns {Promise<JournalEntry|null>}
 */
export async function recordSeasonsChange({ seasonId, year = 1, gainNames = [], fortunes = null, surplusChange = 0, notes = "" } = {}) {
	if (!game.user?.isGM) {
		ui.notifications?.warn?.("Only the GM can record a Seasons Change.");
		return null;
	}
	const journal = await ensureSeasonsJournal();
	if (!journal) return null;

	const yr       = Number.isInteger(year) && year >= 1 ? year : 1;
	const yearName = `${ordinalWord(yr)} Year`;
	const block    = _seasonBlock(seasonId, gainNames, fortunes, surplusChange, notes);

	const page = (journal.pages ?? []).find(p => Number(p.getFlag?.("stonetop", "chronicleYear")) === yr) ?? null;
	if (page) {
		await page.update({ "text.content": mergeSeasonBlock(page.text?.content ?? "", seasonId, block) });
	} else {
		const maxSort = (journal.pages ?? []).reduce((m, p) => Math.max(m, Number(p.sort) || 0), 0);
		await journal.createEmbeddedDocuments("JournalEntryPage", [{
			name:  yearName,
			type:  "text",
			sort:  maxSort + 10,
			text:  { content: block, format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML },
			flags: { stonetop: { chronicleYear: yr } },
		}]);
	}

	ui.notifications?.info?.(`Recorded ${seasonLabel(seasonId)} in “${yearName}” of the Seasons Change journal.`);
	return journal;
}
