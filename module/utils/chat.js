import {escHtml} from "./strings.js";

/** Core stat paths (in a flattened update) mapped to their chat labels. */
export const STAT_CHAT_LABELS = {
	"system.stats.str.value": "STR",
	"system.stats.dex.value": "DEX",
	"system.stats.int.value": "INT",
	"system.stats.wis.value": "WIS",
	"system.stats.con.value": "CON",
	"system.stats.cha.value": "CHA",
};

/** Steading ("stonetop") stat paths (in a flattened update) mapped to their chat labels. */
export const STEADING_STAT_CHAT_LABELS = {
	"system.stats.fortunes.value": "Fortunes",
	"system.stats.defenses.value": "Defenses",
	"system.attributes.population.value": "Population",
	"system.attributes.prosperity.value": "Prosperity",
	"system.attributes.surplus.value": "Surplus",
};

/** Format a stat value for chat: numbers get a leading sign (+1, -1, 0); blanks show as a dash. */
function formatStatValue(value) {
	if (value === undefined || value === null || value === "") return "—";
	const num = Number(value);
	return Number.isFinite(num) ? (num >= 0 ? `+${num}` : `${num}`) : String(value);
}

/**
 * Wrap body markup in the bare Stonetop chat-card shell (section / cell), with no
 * title row. Centralizes the load-bearing pbta/stonetop class names so a CSS
 * rename only has to happen here.
 * @param {string} innerHtml       Body markup placed inside the cell.
 * @param {string} [sectionClass]  Extra class(es) for the <section>.
 */
export function stonetopCardShell(innerHtml, sectionClass = "") {
	return `<section class="pbta-chat-card stonetop-roll-card${sectionClass ? ` ${sectionClass}` : ""}">
		<div class="cell cell--chat">
			${innerHtml}
		</div>
	</section>`;
}

/** The ` data-tooltip="2 4"` attribute (with leading space) for a die-faces hover
 *  readout, or "" when there are no faces to show. */
function _dieFacesTip(dieFaces) {
	return dieFaces ? ` data-tooltip="${escHtml(dieFaces)}"` : "";
}

/**
 * The roll-formula chip ("2d6+@stat") shown above a result, with the individual
 * die faces ("2 4") baked in as a hover tooltip when given. Every Stonetop roll
 * card (moves, damage, the oracle, weather, the seasonal rolls) emits its formula
 * through here, so the chip — and its faces readout — live in exactly one place.
 */
export function rollFormulaChip(formula, dieFaces = "") {
	return `<div class="stonetop-roll-formula"${_dieFacesTip(dieFaces)}>${formula}</div>`;
}

/**
 * The rolled-total badge for a `stonetop-roll-result` block, carrying the same
 * die-faces readout as the formula chip. Shared by the cards built on the
 * `stonetop-roll-result-*` markup (moves, Death's Door, journal tables).
 */
export function rollResultNumber(total, dieFaces = "") {
	return `<span class="stonetop-roll-result-number"${_dieFacesTip(dieFaces)}>${total}</span>`;
}

/**
 * Body markup for a "Seasons Change"-style 2d6 result card: a formula chip plus the
 * shared roll-result block — the total (with its die-faces tooltip), the tier label,
 * and the result line — coloured down the left edge by tier, exactly like a move roll
 * card. Shared by the steading/Spring Burst Seasons Change roll and the Expedition
 * Requisition roll so the two cards stay in lockstep.
 * @param {number} total    The 2d6 (+Fortunes) total.
 * @param {string} tier     Result tier key (success/partial/failure) — colours the block.
 * @param {string} label    Tier label shown beside the total (e.g. "10+").
 * @param {string} line     Result line markup (raw HTML) shown below the label.
 * @param {string} formula  Roll formula text for the chip.
 * @param {string} [dieFaces] Individual die faces ("3 5") for the total/chip hover tooltip.
 */
export function springRollCardBody(total, tier, label, line, formula, dieFaces = "") {
	return `<div class="card-content">
		${rollFormulaChip(formula, dieFaces)}
		<div class="stonetop-roll-result ${tier}">
			${rollResultNumber(total, dieFaces)}
			<div class="stonetop-roll-result-body">
				<span class="stonetop-roll-result-label">${label}</span>
				<span class="stonetop-roll-result-details">${line}</span>
			</div>
		</div>
	</div>`;
}

/**
 * The card shell with a title row. Most cards want this; use {@link stonetopCardShell}
 * directly when the message's speaker alias already names the card.
 * @param {string} title       Card header text (escaped here).
 * @param {string} innerHtml   Body markup placed inside the cell, after the title.
 * @param {string} [sectionClass]  Extra class(es) for the <section>.
 */
export function stonetopChatCard(title, innerHtml, sectionClass = "") {
	return stonetopCardShell(
		`<div class="chat-title row flexrow"><h2 class="cell__title">${escHtml(title)}</h2></div>${innerHtml}`,
		sectionClass,
	);
}

/**
 * Post a card whose body is the shared "card-content → homestead list" shape: a
 * <ul> of pre-built <li> rows under the stonetop chat-card shell, spoken by the
 * actor. Centralizes the list wrapper + speaker boilerplate so the move/stat/
 * armor notes don't each re-type it (the markup the comment on {@link stonetopCardShell}
 * promises lives in one place).
 * @param {Actor}  actor
 * @param {string} title     Card header text (escaped by the shell).
 * @param {string} rowsHtml  Pre-built, already-escaped <li>…</li> rows.
 */
export function postListCard(actor, title, rowsHtml) {
	if (!globalThis.ChatMessage || !rowsHtml) return;
	const content = stonetopChatCard(title,
		`<div class="card-content"><ul class="stonetop-homestead-chat-list">${rowsHtml}</ul></div>`,
		"stonetop-homestead-chat-card");
	ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}

/**
 * Post a guided-move summary card to chat.
 * @param {Actor} actor
 * @param {string} title   Move name shown in the card header.
 * @param {{label: string, value: string}[]} rows  Non-empty rows to display.
 */
export function postMoveToChat(actor, title, rows) {
	if (!rows.length) return;
	postListCard(actor, title,
		rows.map(r => `<li><strong>${escHtml(r.label)}:</strong> ${escHtml(r.value)}</li>`).join(""));
}

/**
 * Post a card to chat announcing one or more core-stat changes.
 * @param {Actor} actor
 * @param {{label: string, oldValue: *, newValue: *}[]} changes
 */
export function postStatChangesToChat(actor, changes) {
	if (!changes?.length) return;
	const rows = changes.map(c =>
		`<li><strong>${escHtml(c.label)}:</strong> ${escHtml(formatStatValue(c.oldValue))} &rarr; ${escHtml(formatStatValue(c.newValue))}</li>`
	).join("");
	const title = changes.length > 1 ? "Stats changed" : "Stat changed";
	postListCard(actor, title, rows);
}
