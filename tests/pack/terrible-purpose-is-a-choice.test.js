import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// A Terrible Purpose is chosen like any other group on an insert: it rests on the purpose chosen, in
// full — which is how an Unliving character heals — with a Change door to the other two. The packs
// once marked it `restsOpen`, which showed all three every time and gave it no door.
const insert = slug => JSON.parse(readFileSync(path.resolve(`packs/src/inserts/${slug}.json`), "utf8"));

describe("the Unliving inserts' Terrible Purpose", () => {
	for (const slug of ["ghost", "revenant", "thrall"]) {
		it(`is an ordinary choice in the ${slug}: one box per purpose, and a blank to name who or what`, () => {
			const group = insert(slug).system.choices.find(g => g.slug === "terrible-purpose");
			const purposes = group.list.filter(row => row.slug);
			expect(purposes.map(row => row.slug)).toEqual(["longing", "vengeance", "duty"]);
			for (const row of purposes) expect([row.track?.max, row.input?.type]).toEqual([1, "inline"]);
		});

		// Reported: the blank sat under every trigger. It follows the sentence it answers, which is
		// each purpose's first paragraph.
		it(`sets the ${slug}'s blanks after the "Name…" sentence each one answers`, () => {
			const group = insert(slug).system.choices.find(g => g.slug === "terrible-purpose");
			for (const row of group.list.filter(r => r.slug)) {
				expect(row.input.follows, row.slug).toBe("lead");
				expect(row.content.text.split(/\n\s*\n/)[0], row.slug).toMatch(/— Name the [^.]+\.$/);
			}
		});
	}

	it("carries no word that any group rests open", () => {
		for (const slug of ["ghost", "revenant", "thrall", "invocations"])
			for (const group of insert(slug).system.choices ?? [])
				expect(group, `${slug}/${group.slug}`).not.toHaveProperty("restsOpen");
	});
});
