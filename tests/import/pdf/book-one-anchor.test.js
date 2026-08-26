import { describe, it, expect } from "vitest";
import { topicAnchor, withHeadingId, splitTopicPages } from "../../../scripts/import/pdf/book-one.js";

// A ? button jumps to a topic by the anchor Foundry gives its heading in the page's table of
// contents. Foundry builds that as `heading.id || slugifyHeading(heading)`, so stamping an id
// settles it — and avoids predicting the slug, which is a trap: slugify runs the text through a
// CHAR_MAP that rewrites "…" to "...", so "… improve Prosperity" would be "...-improve-prosperity",
// three literal dots. Getting that wrong fails silently, because scrolling to a missing anchor is a
// no-op.

describe("topicAnchor", () => {
	it("names an anchor from the topic key the ? button carries", () => {
		expect(topicAnchor("coin")).toBe("topic-coin");
	});
});

describe("withHeadingId", () => {
	it("stamps the id on the heading, keeping its content", () => {
		expect(withHeadingId("<h2>… get some coin</h2>", "topic-coin"))
			.toBe('<h2 id="topic-coin">… get some coin</h2>');
	});

	it("keeps whatever level the heading is", () => {
		expect(withHeadingId("<h3>x</h3>", "a")).toBe('<h3 id="a">x</h3>');
	});
});

describe("splitTopicPages", () => {
	const TOPICS = [{ key: "coin", match: /^get some coin$/i }, { key: "fortunes", match: /^increase Fortunes$/i }];
	const html = "<h2>… increase Fortunes</h2><p>a</p><h2>… get some coin</h2><p>b</p>";

	it("gives each topic its anchor and stamps the heading to match", () => {
		const [first, second] = splitTopicPages(html, TOPICS);
		expect(first.anchor).toBe("topic-fortunes");
		expect(first.html).toContain('id="topic-fortunes"');
		expect(second.anchor).toBe("topic-coin");
		expect(second.html).toContain('id="topic-coin"');
	});

	// A heading the book prints that no topic claims is reported, not silently anchored.
	it("leaves a heading no topic matches unstamped", () => {
		const [only] = splitTopicPages("<h2>… do something else</h2><p>x</p>", TOPICS);
		expect(only.key).toBeNull();
		expect(only.anchor).toBeNull();
		expect(only.html).not.toContain("id=");
	});
});
