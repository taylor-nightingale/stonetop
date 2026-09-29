import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";
import { renderLocalized } from "./localizedPartial.js";
import { FakeGameBuilder } from "../fakes/FakeGameBuilder.js";
import { OutfitItemAdder, AdderPlace } from "../../src/actors/character/OutfitItemAdder.js";
import { InventoryOwner } from "../../src/actors/character/InventoryOwner.js";
import { OutfitItemBuilder } from "../../src/model/data/character/OutfitItem.js";
import { toOutfitItemSnapshot } from "../../src/model/snapshot/character/outfitSections.js";
import { ResourceController } from "../../src/actors/character/ResourceController.js";

/**
 * The outfit adder, measured: it hangs from the "+ add item" that opened it, the column's width, over
 * what is below rather than pushing it down; and its preview is the column's own row, laid out as
 * the column lays it out. The real outfit-items partial, in German, where the words are longest.
 */
const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const NAPHTHA = { name: "Naphtha", weight: 1, tags: ["thrown", "area", "dangerous"], note: "burns hot & sticky",
	resource: { max: 3, title: null, labels: ["", "", "uses"] } };

let HTML;
beforeAll(() => {
	new FakeGameBuilder().build();
	const adder = new OutfitItemAdder();
	adder.open(new AdderPlace(InventoryOwner.character(), true));
	adder.update(d => d.withName(NAPHTHA.name).withUses(3).withUsesWord("uses").withNote(NAPHTHA.note)
		.withTagToggled("thrown").withTagToggled("area").withTagToggled("dangerous"));
	// The same item as the column would draw it, under the adder: the preview must match it.
	const real = toOutfitItemSnapshot({ slug: "naphtha", ...NAPHTHA }, false, ResourceController.build(NAPHTHA.resource, 0));
	const section = { runs: [{ isGrid: false, items: [real] }], note: null };
	const column = renderLocalized("stonetop.outfit-items", {
		sections: [section], addColumn: "regular", addKey: "character:regular",
		outfitAdder: adder.view(), sheetIdPrefix: "s1", editable: true,
	});
	HTML = `
<div class="application stonetop sheet actor character themed theme-light" style="width: 900px; height: 900px">
 <div class="window-content"><section class="sheet-body" style="height: 860px">
  <div class="stonetop-inventory-regular" style="width: 420px">${column}<p class="below">what the adder lies over</p></div>
 </section></div>
</div>`;
});

describe.skipIf(!canProbe())("the outfit adder", () => {
	let m;
	beforeAll(() => {
		m = probe.measure({
			bodyHtml: HTML, bodyClass: "game themed theme-light", rootAttrs: 'style="font-size: 16px"',
			chromeFlags: ["--window-size=960,960"],
			targets: {
				column: ".stonetop-inventory-regular", button: ".stonetop-inv-add-btn", adder: ".stonetop-outfit-adder",
				below: ".below", real: ".stonetop-inventory-regular > .stonetop-inv-item",
				preview: ".stonetop-outfit-adder-preview > .stonetop-inv-item",
				realTrack: ".stonetop-inventory-regular > .stonetop-inv-item .stonetop-inv-resources",
				previewTrack: ".stonetop-outfit-adder-preview .stonetop-inv-resources",
				name: '[data-draft-field="name"]', note: '[data-draft-field="note"]', add: ".stonetop-outfit-adder-add",
			},
		});
	});
	const el = name => m.get(name).values;
	const bottom = v => v.boxTop + v.boxHeight;
	const right = v => v.boxLeft + v.boxWidth;

	it("renders every part", () => {
		for (const [name, probed] of m) expect(probed.missing, `${name} did not render`).toBe(false);
	});

	it("hangs from the button that opened it, the button's width", () => {
		expect(el("adder").boxTop).toBeCloseTo(bottom(el("button")), 0);
		expect(el("adder").boxLeft).toBeCloseTo(el("button").boxLeft, 0);
		expect(right(el("adder"))).toBeCloseTo(right(el("button")), 0);
	});

	it("lies over what is under the button rather than pushing it down", () => {
		expect(el("below").boxTop).toBeLessThan(el("adder").boxTop + 30);
	});

	// The preview is the real row: the same height, the track at the same place from the right.
	it("previews the row as the column draws it", () => {
		expect(el("preview").boxHeight).toBeCloseTo(el("real").boxHeight, 0);
		expect(right(el("preview")) - right(el("previewTrack"))).toBeCloseTo(right(el("real")) - right(el("realTrack")), 0);
	});

	it("keeps its fields and Add inside it", () => {
		for (const name of ["name", "note", "add"]) {
			expect(el(name).boxLeft, name).toBeGreaterThanOrEqual(el("adder").boxLeft);
			expect(right(el(name)), name).toBeLessThanOrEqual(right(el("adder")) + 0.5);
		}
		expect(el("name").boxHeight).toBeLessThan(1.7 * 16);
	});
});
