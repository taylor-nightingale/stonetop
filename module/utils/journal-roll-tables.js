import { resolveEntry, isStonetopJournalEntry } from "./journal-spiral-bullets.js";
import { stonetopChatCard, rollFormulaChip, rollResultNumber } from "./chat.js";
import { multiDieFaces } from "./roll-engine.js";

// Add a rollable die control to the left of the "Roll" header of the random
// tables baked into this system's journals (the gazetteer generator's
// `renderDiceTable` — a <table> whose first header cell is "Roll"). Clicking it
// rolls the table's die, matches the result row, and posts a chat card. No edit
// mode and no actor needed, so — like applyJournalCheckboxes / spiral bullets —
// it runs read-only for every viewer on every journal render. Idempotent.
//
// The die is taken from the bold caption the generator emits directly above the
// table ("1d6 encounter"); when a table has no such caption it falls back to a
// flat 1dN over the table's highest row number.

/** Parse a Roll-cell ("1", "3-4", "11–12") into {lo, hi}, or null if not a range. */
export function parseRange(text) {
	const m = String(text).trim().match(/^(\d+)\s*[-–—]\s*(\d+)$|^(\d+)$/);
	if (!m) return null;
	if (m[3] !== undefined) { const n = +m[3]; return { lo: n, hi: n }; }
	return { lo: +m[1], hi: +m[2] };
}

/**
 * Decide a table's dice formula and chat label from its caption + rows. The
 * caption ("1d6 encounter") supplies both; absent a dice formula there, fall
 * back to a flat 1dN over the highest row number, and to the heading for a label.
 */
export function planTableRoll({ captionText = "", headingText = "", rows }) {
	const m = captionText.match(/(\d+d\d+)/i);
	const formula = m ? m[1].toLowerCase() : `1d${rows.reduce((x, r) => Math.max(x, r.hi), 0)}`;
	const label = captionText.replace(/^\s*\d+d\d+\s*/i, "").trim() || headingText.trim() || "Random table";
	return { formula, label };
}

/** The result HTML for a rolled total, or null when no row covers it. */
export function outcomeFor(rows, total) {
	return rows.find(r => total >= r.lo && total <= r.hi)?.html ?? null;
}

/** Snapshot a Roll/Result table's data rows as [{lo, hi, html}], or null if unparseable. */
function tableRows(table) {
	const rows = [];
	for (const tr of table.querySelectorAll("tbody tr")) {
		const cells = tr.children;
		if (cells.length < 2) continue;
		const range = parseRange(cells[0].textContent);
		if (!range) return null;            // a stray number/text cell → not a clean roll table
		rows.push({ ...range, html: cells[1].innerHTML });
	}
	return rows.length >= 2 ? rows : null;
}

/** Plain text of the bold caption (or paragraph) directly above a table. */
function captionText(table) {
	const prev = table.previousElementSibling;
	return (prev?.querySelector?.("strong")?.textContent
		?? (prev?.tagName === "P" ? prev.textContent : "") ?? "").trim();
}

/** Nearest preceding heading text, used as the table label when there's no caption. */
function nearestHeading(table) {
	for (let el = table.previousElementSibling; el; el = el.previousElementSibling) {
		if (/^H[1-6]$/.test(el.tagName)) return el.textContent.trim();
	}
	return "";
}

/** Roll the table's die, match the result row, and post a Stonetop chat card. */
async function rollTable({ formula, label, rows }) {
	let roll;
	try {
		roll = await new Roll(formula).evaluate();
	} catch (err) {
		console.error("Stonetop | bad journal table roll formula", formula, err);
		return;
	}
	const outcome = outcomeFor(rows, roll.total) ?? `<em>No result for ${roll.total}.</em>`;
	const dieFaces = multiDieFaces(roll);
	const flavor = stonetopChatCard(label, `<div class="card-content">
			${rollFormulaChip(roll.formula, dieFaces)}
			<div class="stonetop-roll-result">
				${rollResultNumber(roll.total, dieFaces)}
				<div class="stonetop-roll-result-body stonetop-roll-card-description">${outcome}</div>
			</div>
		</div>`);
	await roll.toMessage({
		speaker: ChatMessage.getSpeaker(),
		flavor,
		rollMode: game.settings.get("core", "rollMode"),
	});
}

/**
 * Enhance every random table in a rendered Stonetop journal with a rollable die
 * control in its "Roll" header. Idempotent — already-enhanced tables are skipped.
 * @param {Application} app          The journal- or page-sheet application.
 * @param {HTMLElement|jQuery} html  Its rendered root.
 */
export function applyJournalRollTables(app, html) {
	const root = html?.jquery ? html[0] : html;
	if (!root?.querySelectorAll) return;
	if (!isStonetopJournalEntry(resolveEntry(app))) return;

	for (const table of root.querySelectorAll("table")) {
		if (table.dataset.stRollable) continue;
		const th = table.querySelector("thead th");
		if (!th || th.textContent.trim().toLowerCase() !== "roll") continue;
		const rows = tableRows(table);
		if (!rows) continue;

		const { formula, label } = planTableRoll({
			captionText: captionText(table),
			headingText: nearestHeading(table),
			rows,
		});

		table.dataset.stRollable = "1";
		const btn = document.createElement("a");
		btn.className = "stonetop-roll-table-btn";
		btn.setAttribute("role", "button");
		btn.setAttribute("tabindex", "0");
		btn.title = `Roll ${formula} on this table`;
		btn.innerHTML = '<i class="fas fa-dice-d20"></i>';
		th.prepend(btn);

		const fire = () => rollTable({ formula, label, rows });
		btn.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); fire(); });
		btn.addEventListener("keydown", ev => {
			if (ev.key === " " || ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); fire(); }
		});
	}
}
