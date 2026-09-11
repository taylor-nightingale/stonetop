import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// The two-column statement row, settled in a browser.
//
// The claim is that the improvement and what it does are COLUMNS: the part that differs between rows
// starts at the same x on every line, so the eye lands on it instead of reading each row to find it.
// That is a layout fact, and a stylesheet read as text cannot answer it — `grid-template-columns`
// being present says nothing about where the second column actually lands once the longest name in
// the list has sized it.
//
// The other half is that this must NOT happen where there is no source: an improvement's own card is
// the source, so its rows carry no source cell, and a grid reserving a column there would indent
// every line against nothing.

const STYLES = path.resolve("styles");
const sheet = f => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
]);

const row = (id, source, clause, { delta = null } = {}) => `
	<li class="steading-statement-line" id="${id}">
		${source ? `<span class="steading-statement-source">${source}</span>` : ""}
		<span class="steading-statement-clause" id="${id}-clause">${clause}</span>
		${delta ? `<span class="steading-statement-delta">${delta}</span>` : ""}
		<button type="button" class="steading-statement-line-btn" id="${id}-btn">Apply</button>
	</li>`;

const FIXTURE = `
<div class="application app stonetop sheet actor steading" style="width: 700px">
  <div class="window-content">
    <ul class="steading-statement-lines steading-statement-lines--sourced stonetop-unmarked">
      ${row("short", "Mill", "the steading generates +1 Surplus", { delta: "+1 Surplus" })}
      ${row("long", "Trade with Barrier Pass", "Stonetop gains +1 Surplus from trade")}
    </ul>
    <div class="steading-payoff">
      <ul class="steading-statement-lines stonetop-unmarked">
        ${row("card", "", "increase Fortunes by 1")}
      </ul>
    </div>
  </div>
</div>`;

describe.skipIf(!canProbe())("the statement's two columns", () => {
	const box = new Map();

	beforeAll(() => {
		for (const [k, v] of probe.measure({
			bodyHtml: FIXTURE, bodyClass: "game vtt theme-light",
			targets: {
				shortClause: "#short-clause", longClause: "#long-clause", cardClause: "#card-clause",
				shortRow: "#short", shortBtn: "#short-btn", longBtn: "#long-btn",
			},
		})) box.set(k, v);
	}, 120000);

	// The whole point: what each improvement DOES starts at the same place on every row, however
	// long the improvement's name is.
	it("starts every result at the same x, whatever the source is called", () => {
		expect(box.get("shortClause").textLeft).toBe(box.get("longClause").textLeft);
	});

	// Sized to the longest name and no wider — a fixed column would either clip "Trade with Barrier
	// Pass" or leave a gutter after "Mill".
	it("leaves the result the rest of the row", () => {
		const clauseLeft = box.get("shortClause").textLeft;
		const rowLeft    = box.get("shortRow").values.boxLeft;
		expect(clauseLeft).toBeGreaterThan(rowLeft);
		expect(clauseLeft - rowLeft).toBeLessThan(220);
	});

	// Both trailing columns are optional, and auto-placement would slide a row with no delta's Apply
	// into the delta's column — the same misalignment the source column was fixed for, one over.
	it("lines the controls up whether or not a row states a delta", () => {
		expect(box.get("shortBtn").values.boxLeft).toBe(box.get("longBtn").values.boxLeft);
	});

	// No source, no column: the card IS the source, and a reserved column would indent every line
	// against nothing.
	it("reserves no source column on a card that has no sources", () => {
		const cardRow = box.get("cardClause");
		expect(cardRow.missing).toBe(false);
		expect(cardRow.textLeft).toBeLessThan(box.get("shortClause").textLeft);
	});
});

// The two columns are one SENTENCE — "Mill — the steading generates +1 Surplus" — and the dash is
// what says so. It is drawn by the source's own ::after, which has no node to query: the computed
// style of the pseudo-element is the only way to ask whether the mark is there at all.
//
// The rule used to be scoped to `.steading-turn-step`, so the three lists that are NOT steps — the
// upkeep, the season's own list, a moment's panel — read as a name and then an unrelated clause with
// a gap between them. This fixture is deliberately none of those things: a bare sourced list, which
// is the shape every one of them takes.
describe.skipIf(!canProbe())("the dash between a source and its result", () => {
	let dash;

	beforeAll(() => {
		dash = probe.render({
			bodyHtml: FIXTURE, bodyClass: "game vtt theme-light",
			probes: {
				after: { selector: "#short .steading-statement-source", pseudo: "::after", properties: ["content"] },
			},
		}).get("after");
	}, 120000);

	it("joins them outside a numbered step, not only inside one", () => {
		expect(dash.missing).toBe(false);
		expect(dash.get("content")).toContain("—");
	});
});
