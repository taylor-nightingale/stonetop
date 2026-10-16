import { describe, it, expect, beforeAll } from "vitest";
import path from "path";
import { RenderProbe, canProbe } from "./RenderProbe.js";

// The book's line art in a directory or compendium list. Core crops every thumbnail to fill its square
// (`object-fit: cover`), and Chromium scales a cropped image down that far with coarse sampling: the
// arcana drew as speckled two-tone blocks, and cropped into the drawing besides. Shown whole, the same
// image scales down smooth. Every other thumbnail keeps core's crop — a portrait is meant to fill.

const STYLES = path.resolve(process.cwd(), "styles");
const probe = new RenderProbe(["themes/palette.css", "themes/parchment-light.css", "themes/parchment-dark.css", "tokens.css", "stonetop.css"]
	.map(f => path.join(STYLES, f)));

const FIXTURE = `
<section class="application sidebar-tab directory compendium-directory theme-dark">
	<ol class="directory-list">
		<li class="directory-item entry document item flexrow"><img class="thumbnail" id="book-art" src="stonetop-art/arcana/mindgem.png" alt=""></li>
		<li class="directory-item entry document item flexrow"><img class="thumbnail" id="portrait" src="icons/svg/mystery-man.svg" alt=""></li>
	</ol>
</section>`;

describe.skipIf(!canProbe())("a book-art thumbnail in a directory", () => {
	let probed;
	beforeAll(() => {
		probed = probe.render({
			bodyHtml: FIXTURE, bodyClass: "game theme-dark", rootAttrs: 'style="font-size: 16px"',
			probes: {
				bookArt:  { selector: "#book-art", properties: ["object-fit"] },
				portrait: { selector: "#portrait", properties: ["object-fit"] },
			},
		});
	});

	it("shows the whole drawing rather than cropping it to the square", () => {
		expect(probed.get("bookArt").get("object-fit")).toBe("contain");
	});

	it("leaves every other thumbnail cropped to fill, as core draws it", () => {
		expect(probed.get("portrait").get("object-fit")).toBe("cover");
	});
});
