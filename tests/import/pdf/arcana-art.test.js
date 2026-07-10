import { describe, it, expect } from "vitest";
import { norm, arcanumOnPage, pickPageIllustration } from "../../../scripts/import/pdf/arcana-art.js";

const roster = new Map([["mindgem", "mindgem"], ["norubasicesphere", "norubas-ice-sphere"]]);

// Synthetic stext lines / extracted-image objects matching the load pipeline's shapes.
const avara = (text, y = 100, size = 20) => ({ text, font: "Avara-Bold", size, bbox: [50, y, 300, y + size] });
const body = (text, y = 200) => ({ text, font: "ACaslonPro-Regular", size: 9, bbox: [50, y, 300, y + 9] });
const page = (...lines) => ({ lines, width: 600, height: 800 });
const img = ({ w = 270, h = 162, box = false, file = "x.png" } = {}) => ({ file, x: 60, y: 120, w, h, box });

describe("norm", () => {
	it("lowercases and strips non-alphanumerics", () => {
		expect(norm("Noruba's Ice Sphere")).toBe("norubasicesphere");
	});
});

describe("arcanumOnPage", () => {
	it("matches a card's front-title heading to its slug", () => {
		expect(arcanumOnPage(page(avara("Mindgem")), roster)).toBe("mindgem");
	});
	it("matches a name that wraps across heading lines", () => {
		expect(arcanumOnPage(page(avara("Noruba's", 100), avara("Ice Sphere", 130)), roster)).toBe("norubas-ice-sphere");
	});
	it("ignores non-Avara body text and small running headers", () => {
		const p = page(body("Mindgem"), avara("appendix d : major arcana", 20, 10));
		expect(arcanumOnPage(p, roster)).toBeNull();
	});
	it("ignores a back-side 'Mysteries of X' heading that isn't a roster name", () => {
		expect(arcanumOnPage(page(avara("Mysteries of the Mindgem")), roster)).toBeNull();
	});
});

describe("pickPageIllustration", () => {
	it("returns the largest illustration by area", () => {
		const badge = img({ w: 85, h: 27, file: "badge.png" });
		const art = img({ w: 270, h: 162, file: "art.png" });
		expect(pickPageIllustration([badge, art])).toBe(art);
	});
	it("includes box-flagged sparse illustrations (mis-flagged frames)", () => {
		const art = img({ box: true, file: "sparse.png" });
		expect(pickPageIllustration([art])).toBe(art);
	});
	it("excludes sub-threshold marker glyphs", () => {
		expect(pickPageIllustration([img({ w: 18, h: 18 })])).toBeNull();
	});
	it("returns null for a page with no images", () => {
		expect(pickPageIllustration([])).toBeNull();
		expect(pickPageIllustration(undefined)).toBeNull();
	});
});
