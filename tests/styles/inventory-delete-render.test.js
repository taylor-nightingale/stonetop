import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe, pseudoAsClass } from "./RenderProbe.js";

// What the custom-item ✕ on an inventory row must NOT do: move the row it appears in.
//
// It used to be laid out in the flex row and revealed with `display: none` → `inline`, wearing
// core's unlayered button chrome (border, background, fixed height). Measured against core's own
// stylesheet, hovering a custom row grew it from 18.19px to 25.59px and slid its resource pips 22px
// LEFT — under a cursor that was aiming at a pip, onto the ✕. Pointing at a resource and deleting
// the item instead is the bug; the text and diamonds stepping down 3.7px inside the taller row is
// the same fault seen from the side.
//
// Every assertion here is the same claim in a different place: the row's geometry is identical
// hovered and not. Headless Chrome cannot enter :hover, so the stylesheets — core's included — are
// rewritten with `:hover` → `.is-hover`; a class and a pseudo-class have identical specificity and
// every rule stays in its own @layer, so the cascade under test is the real one.

const STYLES = path.resolve("styles");
const sheet = (f) => path.join(STYLES, f);

const probe = new RenderProbe([
	sheet("themes/palette.css"), sheet("themes/parchment-light.css"),
	sheet("themes/parchment-dark.css"), sheet("tokens.css"), sheet("stonetop.css"),
], { transformCss: pseudoAsClass("hover") });

// A custom load row: weight in diamonds, a name, a resource track, and the ✕ only a custom item has.
// `hovered` is the state the cursor would put it in.
const customRow = (id, hovered) => `
<div class="stonetop-inv-item${hovered ? " is-hover" : ""}" id="${id}">
	<span class="stonetop-inv-diamonds">
		<input type="checkbox" class="stonetop-inventory-item-check stonetop-inv-diamond">
		<input type="checkbox" class="stonetop-inventory-item-check stonetop-inv-diamond">
	</span>
	<span class="stonetop-inv-label"><strong class="stonetop-inv-name">Rations</strong><span class="stonetop-inv-qualifier">, dried</span></span>
	<span class="stonetop-inv-resources" id="${id}-res">
		<button type="button" class="stonetop-inv-resource-btn stonetop-inventory-resource-btn"></button>
		<button type="button" class="stonetop-inv-resource-btn stonetop-inventory-resource-btn"></button>
		<button type="button" class="stonetop-inv-resource-btn stonetop-inventory-resource-btn"></button>
	</span>
	<button type="button" class="stonetop-inv-delete" id="${id}-del"><i class="fas fa-times"></i></button>
</div>`;

// A book row — no ✕ at all. Its pips are the line a custom row's pips have to agree with, which is
// why the gutter is reserved on every row rather than only on the ones that can be deleted.
const bookRow = (id) => `
<div class="stonetop-inv-item" id="${id}">
	<span class="stonetop-inv-diamonds">
		<input type="checkbox" class="stonetop-inventory-item-check stonetop-inv-diamond">
		<input type="checkbox" class="stonetop-inventory-item-check stonetop-inv-diamond">
	</span>
	<span class="stonetop-inv-label"><strong class="stonetop-inv-name">Rope</strong><span class="stonetop-inv-qualifier">, ~25 ft</span></span>
	<span class="stonetop-inv-resources" id="${id}-res">
		<button type="button" class="stonetop-inv-resource-btn stonetop-inventory-resource-btn"></button>
		<button type="button" class="stonetop-inv-resource-btn stonetop-inventory-resource-btn"></button>
		<button type="button" class="stonetop-inv-resource-btn stonetop-inventory-resource-btn"></button>
	</span>
</div>`;

const FIXTURE = `
<div class="application app stonetop sheet actor character" style="width: 400px"><div class="window-content">
	<section class="stonetop-inventory"><div class="stonetop-inventory-regular">
		${customRow("cold", false)}
		${customRow("hot", true)}
		${bookRow("book")}
	</div></section>
</div></div>`;

describe.skipIf(!canProbe())("the inventory row's delete control", () => {
	const boxes = new Map();
	const styles = new Map();

	beforeAll(() => {
		for (const [k, v] of probe.measure({
			bodyHtml: FIXTURE, bodyClass: "game theme-light",
			targets: {
				coldRow: "#cold", hotRow: "#hot",
				coldRes: "#cold-res", hotRes: "#hot-res", bookRes: "#book-res",
				coldLabel: "#cold .stonetop-inv-label", hotLabel: "#hot .stonetop-inv-label",
				coldDia: "#cold .stonetop-inv-diamonds", hotDia: "#hot .stonetop-inv-diamonds",
				hotDel: "#hot-del",
			},
		})) boxes.set(k, v);

		for (const [k, v] of probe.render({
			bodyHtml: FIXTURE, bodyClass: "game theme-light",
			probes: {
				cold: { selector: "#cold-del", properties: ["visibility", "border-top-width", "background-color", "position"] },
				hot:  { selector: "#hot-del",  properties: ["visibility", "border-top-width", "background-color"] },
			},
		})) styles.set(k, v);
	}, 120000);

	// Sub-pixel layout noise is not a shift; every difference this test was written against was 3.7px
	// or more.
	const same = (a, b) => Math.abs(a - b) < 0.5;

	it("does not grow the row it appears in", () => {
		expect(same(boxes.get("hotRow").values.boxHeight, boxes.get("coldRow").values.boxHeight)).toBe(true);
	});

	it("does not move the resource pips the cursor is aiming at", () => {
		expect(same(boxes.get("hotRes").values.boxLeft, boxes.get("coldRes").values.boxLeft)).toBe(true);
	});

	// The gutter is reserved whether or not a row can be deleted, so a custom row's pips sit on the
	// same line as a book row's.
	it("leaves a custom row's pips level with a book row's", () => {
		expect(same(boxes.get("coldRes").values.boxLeft, boxes.get("bookRes").values.boxLeft)).toBe(true);
	});

	// Measured as the offset of the first line WITHIN its own row, so the rows' own stacking does not
	// enter into it.
	it("does not step the name or the diamonds down inside the row", () => {
		const offset = (line, row) => boxes.get(line).values.firstLineTop - boxes.get(row).values.boxTop;
		expect(same(offset("hotLabel", "hotRow"), offset("coldLabel", "coldRow"))).toBe(true);
		expect(same(offset("hotDia", "hotRow"), offset("coldDia", "coldRow"))).toBe(true);
	});

	it("sits clear of the pips rather than over them", () => {
		const pipsRight = boxes.get("hotRes").values.boxLeft + boxes.get("hotRes").values.boxWidth;
		expect(boxes.get("hotDel").values.boxLeft).toBeGreaterThanOrEqual(pipsRight);
	});

	// `visibility`, never `opacity: 0` — an invisible control that still takes the click is a delete
	// waiting to happen.
	it("is hidden until the row is hovered, and untakeable while hidden", () => {
		expect(styles.get("cold").get("visibility")).toBe("hidden");
		expect(styles.get("hot").get("visibility")).toBe("visible");
	});

	// Core styles every <button> unlayered, which is why this rule lives outside @layer system: in
	// the layer the ✕ kept core's border and background and rendered as a grey box, unlike every
	// other icon control on the sheet.
	it("wears none of core's button chrome", () => {
		expect(styles.get("hot").get("border-top-width")).toBe("0px");
		expect(styles.get("hot").get("background-color")).toBe("rgba(0, 0, 0, 0)");
		expect(styles.get("cold").get("position")).toBe("absolute");
	});
});
