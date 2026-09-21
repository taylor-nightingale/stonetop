import { describe, it, expect } from "vitest";
import { PlaybookTitle } from "../../src/model/data/character/PlaybookTitle.js";

const wouldBeHero = {
	name: "The Would-Be Hero",
	renameOnMove: { moveSlug: "big-damn-hero", name: "The Hero" },
};

describe("PlaybookTitle", () => {
	it("is the playbook's own name when the renaming move is not taken", () => {
		const title = PlaybookTitle.from(wouldBeHero);
		expect(title.titleFor(new Set(["anger-is-a-gift"]))).toBe("The Would-Be Hero");
	});

	it("is the renamed title once the move is taken", () => {
		const title = PlaybookTitle.from(wouldBeHero);
		expect(title.titleFor(new Set(["anger-is-a-gift", "big-damn-hero"]))).toBe("The Hero");
	});

	it("is the playbook's name for a playbook with no renaming move", () => {
		const title = PlaybookTitle.from({ name: "The Blessed", renameOnMove: null });
		expect(title.titleFor(new Set(["big-damn-hero"]))).toBe("The Blessed");
	});

	it("ignores a half-filled rename definition", () => {
		const noName = PlaybookTitle.from({ name: "The Fox", renameOnMove: { moveSlug: "big-damn-hero", name: null } });
		const noSlug = PlaybookTitle.from({ name: "The Fox", renameOnMove: { moveSlug: null, name: "The Hero" } });
		expect(noName.titleFor(new Set(["big-damn-hero"]))).toBe("The Fox");
		expect(noSlug.titleFor(new Set(["big-damn-hero"]))).toBe("The Fox");
	});

	it("survives a missing playbook, a missing set and an empty set", () => {
		expect(PlaybookTitle.from(null).titleFor(new Set())).toBeNull();
		expect(PlaybookTitle.from(wouldBeHero).titleFor(undefined)).toBe("The Would-Be Hero");
		expect(PlaybookTitle.from(wouldBeHero).titleFor(new Set())).toBe("The Would-Be Hero");
	});
});
