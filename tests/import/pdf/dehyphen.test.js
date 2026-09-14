import { describe, it, expect } from "vitest";
import { explainWrap, healWrap, joinWrapped, WrapLog, KEEP_HYPHEN, MD_CLOSERS, HTML_CLOSERS } from "../../../scripts/import/pdf/dehyphen.js";

describe("explainWrap", () => {
	it("heals an ordinary word broken across lines", () => {
		const d = explainWrap("rolls d10 w/advan-", "tage (close, forceful)");
		expect(d).toMatchObject({ heal: true, tight: true, reason: "word-break" });
		expect(d.pair).toBe("advan-tage");
	});

	it("reports nothing to decide when the line does not end in a hyphen", () => {
		expect(explainWrap("a form of bone and grave", "dirt")).toMatchObject({ heal: false, tight: false, reason: "no-hyphen" });
	});

	it("leaves a hyphen alone when the next line starts with a capital (a new sentence, not a continuation)", () => {
		expect(explainWrap("the Nine-", "Fingered Stranger").reason).toBe("no-hyphen");
	});

	it("keeps a suspended hyphen — and the space the book prints after it", () => {
		expect(explainWrap("or a fettered soul long-", "and cruelly-bound, now set free"))
			.toMatchObject({ heal: false, tight: false, reason: "suspended" });
	});

	it("still heals a word whose continuation merely starts with a conjunction", () => {
		// "col-" + "or" is one word; only a hyphenated word after the conjunction marks a suspension.
		expect(explainWrap("painted in every col-", "or of the rainbow").heal).toBe(true);
		expect(explainWrap("dem-", "and tribute of them").heal).toBe(true);
	});

	it("reads a hyphenated continuation whole, so a listed compound matches across it", () => {
		const d = explainWrap("making a stone-", "on-stone grinding noise");
		expect(d).toMatchObject({ heal: false, tight: true, reason: "known-compound" });
		expect(d.pair).toBe("stone-on-stone");
	});

	it("still heals a word break that merely lands in front of a compound", () => {
		// The luglfsk's "ma-" + "ny-legged" is "many-legged" — a hyphenated continuation is no evidence.
		const d = explainWrap("stories of larger, ma-", "ny-legged terrors");
		expect(d).toMatchObject({ heal: true, reason: "word-break" });
	});

	it("keeps a compound the book spells with a hyphen", () => {
		expect(explainWrap("they become rage-", "filled specters"))
			.toMatchObject({ heal: false, tight: true, reason: "known-compound" });
		expect(explainWrap("cloven hooves, birch-", "white fur").heal).toBe(false);
	});

	it("matches the keep list without regard to case", () => {
		expect(explainWrap("Bug-", "like intellect").reason).toBe("known-compound");
	});

	it("lists every keep-list entry as the lowercase word the break spells", () => {
		for (const w of KEEP_HYPHEN) expect(w).toMatch(/^[a-z]+(?:-[a-z]+)+$/);
	});
});

describe("healWrap", () => {
	it("drops a trailing hyphen from plain text", () => {
		expect(healWrap("w/advan-")).toBe("w/advan");
	});

	it("reaches back through closing tags so the hyphen inside an emphasis run goes too", () => {
		expect(healWrap("<strong>Dan-</strong>", HTML_CLOSERS)).toBe("<strong>Dan</strong>");
	});

	it("reaches back through markdown emphasis markers", () => {
		expect(healWrap("_close, forceful, aethe-_", MD_CLOSERS)).toBe("_close, forceful, aethe_");
	});
});

describe("joinWrapped", () => {
	it("takes the continuation whole when there is nothing to append to", () => {
		expect(joinWrapped("", "tage")).toBe("tage");
	});

	it("fuses a healed word, closes up a kept compound, and spaces a suspended hyphen", () => {
		expect(joinWrapped("w/advan-", "tage (close)")).toBe("w/advantage (close)");
		expect(joinWrapped("made of star-", "filled night")).toBe("made of star-filled night");
		expect(joinWrapped("a soul long-", "and cruelly-bound")).toBe("a soul long- and cruelly-bound");
	});

	it("separates ordinary lines with a space", () => {
		expect(joinWrapped("a horned statue", "with an ever-burning flame")).toBe("a horned statue with an ever-burning flame");
	});

	it("decides on the raw lines while healing a buffer that carries markup", () => {
		const out = joinWrapped("<em>aethe-</em>", "<em>rium</em> arc", { prevRaw: "aethe-", nextRaw: "rium arc", closers: HTML_CLOSERS });
		expect(out).toBe("<em>aethe</em><em>rium</em> arc");
	});

	it("records its decisions in a log when given one", () => {
		const log = new WrapLog();
		joinWrapped("w/advan-", "tage", { log });
		joinWrapped("made of star-", "filled night", { log });
		expect(log.decisions).toHaveLength(2);
	});
});

describe("WrapLog", () => {
	it("reports the judgement calls and stays quiet about ordinary word breaks", () => {
		const log = new WrapLog();
		for (const [a, b] of [["w/advan-", "tage"], ["rage-", "filled specters"], ["a stone-", "on-stone noise"]])
			log.record(explainWrap(a, b));
		expect(log.report()).toEqual([
			"rage-filled — kept (known-compound)",
			"stone-on-stone — kept (known-compound)",
		]);
	});

	it("collapses a pair it was told about more than once", () => {
		const log = new WrapLog();
		log.record(explainWrap("rage-", "filled"));
		log.record(explainWrap("rage-", "filled"));
		expect(log.report()).toEqual(["rage-filled — kept (known-compound)"]);
	});
});
