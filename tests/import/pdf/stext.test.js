import { describe, it, expect } from "vitest";
import { parseStext } from "../../../scripts/import/pdf/stext.js";

// Minimal stext in mutool's shape: a page, one line with two font runs (regular + bold).
const XML = `<?xml version="1.0"?>
<document filename="x.pdf">
<page id="page1" width="792" height="612">
<block bbox="36 80 200 92">
<line bbox="36 80 200 92" text="four &amp; five">
<font name="ACaslonPro-Regular" size="9">
<char x="36" c="f"/><char x="40" c="o"/><char x="44" c="u"/><char x="48" c="r"/><char x="52" c=" "/><char x="56" c="&amp;"/><char x="60" c=" "/>
</font>
<font name="ACaslonPro-Bold" size="9">
<char x="64" c="f"/><char x="68" c="i"/><char x="72" c="v"/><char x="76" c="e"/>
</font>
</line>
</block>
</page>
</document>`;

describe("parseStext", () => {
	const pages = parseStext(XML);

	it("returns one page with dimensions", () => {
		expect(pages).toHaveLength(1);
		expect(pages[0].width).toBe(792);
		expect(pages[0].height).toBe(612);
	});

	it("parses a line's bbox and decoded full text", () => {
		const line = pages[0].lines[0];
		expect(line.bbox).toEqual([36, 80, 200, 92]);
		expect(line.text).toBe("four & five");
	});

	it("preserves per-font spans (so inline bold survives)", () => {
		const { spans } = pages[0].lines[0];
		expect(spans).toEqual([
			{ font: "ACaslonPro-Regular", size: 9, text: "four & " },
			{ font: "ACaslonPro-Bold", size: 9, text: "five" },
		]);
	});

	it("reports the dominant run as the line font/size", () => {
		expect(pages[0].lines[0].font).toBe("ACaslonPro-Regular");
		expect(pages[0].lines[0].size).toBe(9);
	});

	it("skips blank lines", () => {
		const blank = parseStext(`<page width="1" height="1"><line bbox="0 0 0 0" text="   "></line></page>`);
		expect(blank[0].lines).toHaveLength(0);
	});
});
