// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TagWrap, TAG_CHIP_ACTIONS, tagChipChangeHandlers } from "../../src/actors/tagChips.js";

function mount(html) {
	document.body.innerHTML = html;
	return document.body.firstElementChild;
}

// The character and the NPC render the SAME selection-chips partial and differ only in the domain
// call at the end, so a sheet here is just "something that answers toggleTag".
function sheet({ editable = true } = {}) {
	return { isEditable: editable, toggleTag: vi.fn() };
}

const CHIPS = `
	<div class="stonetop-tags" data-slug="enfys" data-field="tagList">
		<button class="stonetop-tag-chip" data-action="toggleTag" data-tag="loyal"></button>
		<input class="stonetop-tag-add" data-change-action="tagAdd" value="  sneaky  ">
	</div>`;

beforeEach(() => { document.body.innerHTML = ""; });

describe("TagWrap", () => {
	it("reads the slug and field off the wrap", () => {
		const wrap = TagWrap.fromElement(mount(CHIPS).querySelector(".stonetop-tag-chip"));
		expect(wrap).toMatchObject({ slug: "enfys", field: "tagList", memberIndex: null });
		expect(wrap.isMember).toBe(false);
	});

	it("carries the member index when the chips belong to one group member", () => {
		const root = mount(`
			<div class="stonetop-tags" data-slug="crew" data-field="tags" data-member-index="2">
				<button class="stonetop-tag-chip" data-tag="wary"></button>
			</div>`);
		const wrap = TagWrap.fromElement(root.querySelector(".stonetop-tag-chip"));
		expect(wrap.memberIndex).toBe("2");
		expect(wrap.isMember).toBe(true);
	});

	// An NPC card has no follower to address, so only the field is stamped.
	it("answers with a null slug when only a field is stamped", () => {
		const root = mount(`<div class="stonetop-tags" data-field="tagList"><span class="stonetop-tag-chip"></span></div>`);
		expect(TagWrap.fromElement(root.querySelector("span"))).toMatchObject({ slug: null, field: "tagList" });
	});

	it("answers null off any element with no wrap around it", () => {
		expect(TagWrap.fromElement(mount(`<span></span>`))).toBeNull();
		expect(TagWrap.fromElement(null)).toBeNull();
	});
});

describe("TAG_CHIP_ACTIONS.toggleTag", () => {
	it("hands the sheet the wrap and the chip's tag", () => {
		const s = sheet();
		const chip = mount(CHIPS).querySelector(".stonetop-tag-chip");

		TAG_CHIP_ACTIONS.toggleTag.call(s, { type: "click" }, chip);

		const [wrap, value] = s.toggleTag.mock.calls[0];
		expect(wrap.field).toBe("tagList");
		expect(value).toBe("loyal");
	});

	it("does nothing on a locked sheet", () => {
		const s = sheet({ editable: false });
		TAG_CHIP_ACTIONS.toggleTag.call(s, { type: "click" }, mount(CHIPS).querySelector(".stonetop-tag-chip"));
		expect(s.toggleTag).not.toHaveBeenCalled();
	});
});

describe("tagChipChangeHandlers.tagAdd", () => {
	it("trims the typed value and hands it to the sheet with its wrap", () => {
		const s = sheet();
		const input = mount(CHIPS).querySelector(".stonetop-tag-add");

		tagChipChangeHandlers(s).tagAdd(input);

		expect(s.toggleTag.mock.calls[0][1]).toBe("sneaky");
	});

	// Pressing Enter fires TWO change events (native commit + comboBox's synthetic one). Since the
	// domain call TOGGLES, a second firing would remove what the first added — the box is blanked
	// on the first read so the second is guarded out.
	it("commits a typed tag exactly once across the paired change events", () => {
		const s = sheet();
		const handlers = tagChipChangeHandlers(s);
		const input = mount(CHIPS).querySelector(".stonetop-tag-add");

		handlers.tagAdd(input);
		handlers.tagAdd(input);

		expect(s.toggleTag).toHaveBeenCalledTimes(1);
		expect(input.value).toBe("");
	});

	it("ignores a blank box", () => {
		const s = sheet();
		const input = mount(CHIPS).querySelector(".stonetop-tag-add");
		input.value = "   ";

		tagChipChangeHandlers(s).tagAdd(input);

		expect(s.toggleTag).not.toHaveBeenCalled();
	});
});
