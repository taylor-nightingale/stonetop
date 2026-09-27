import { describe, it, expect } from "vitest";
import {
	SectionKey, ChoiceItem, PickRow, ChoiceSection, LoreSection, InstinctSection, OriginSection, BackgroundSection,
	IntroductionsSection, PlaybookSections, InsertView, markInGroup, answerInGroup, instinctLabelOf,
} from "../../scripts/development/redesign-mock/sections.js";

/**
 * The sections a playbook and an insert are drawn from. D11: a section rests on what was chosen and
 * is open while nothing has been — so every class here answers what was chosen, what else is on
 * offer, and whether anything has been chosen at all. Each fixture is a row shape the packs carry,
 * in the shape `buildChoiceGroup` hands it to the sheet.
 */

const rich = raw => ({ raw, autoRoll: false, html: raw });
const content = ({ title = "", text = "", subtitle = "", subtitleNote = "" } = {}) => ({
	title: rich(title), titleNote: rich(""), subtitle: rich(subtitle), subtitleNote: rich(subtitleNote), text: rich(text),
});
const heading = (title, text = "") => ({ type: "entry", slug: null, content: content({ title, text }), track: null, input: null });
const boxed = (slug, text, marked = false, extra = {}) => ({ type: "entry", slug, content: content({ text, ...extra }),
	track: { slug, checks: [marked], requires: null }, input: null });
const question = (slug, text, value = "", tracked = false) => ({ type: "entry", slug, content: content({ text }),
	track: tracked ? { slug, checks: [false], requires: null } : null,
	input: { slug: `${slug}-input`, placeholder: null, value, type: "inline" } });
const option = (slug, text, checked = false, description = "") => ({ slug, text: rich(text), description: rich(description), checked });
const pickRow = (options, { radio = true, rowKey = "row-0" } = {}) => ({ type: "choice", radio, rowKey, options });

describe("SectionKey", () => {
	it("round-trips a playbook section and a nested one", () => {
		expect(SectionKey.playbook("lore", "arcana-major").toString()).toBe("playbook/lore/arcana-major");
		expect(SectionKey.parse("playbook/background/antiquarian")).toMatchObject({ owner: "playbook",
			part: "background", sub: "antiquarian" });
	});

	it("addresses an insert's section by its tab", () => {
		const key = SectionKey.insert("insert-thrall", "consequences");
		expect(key.toString()).toBe("insert-thrall/consequences");
		expect(SectionKey.parse(key.toString()).isPlaybook).toBe(false);
	});

	it("knows an instinct section wherever it lives", () => {
		expect(SectionKey.parse("playbook/instinct").isInstinct).toBe(true);
		expect(SectionKey.parse("insert-thrall/instinct").isInstinct).toBe(true);
		expect(SectionKey.parse("insert-thrall/marks").isInstinct).toBe(false);
	});
});

describe("ChoiceItem", () => {
	it("reads an option of a pick row, exclusive when the row is a radio", () => {
		const item = ChoiceItem.fromOption(option("curiosity", "Curiosity", true, "To seek answers"), pickRow([]));
		expect(item).toMatchObject({ slug: "curiosity", kind: "option", labelHtml: "Curiosity",
			detailHtml: "To seek answers", marked: true, exclusive: true, rowKey: "row-0" });
		expect(item.isChosen).toBe(true);
	});

	it("reads a line with a box — a consequence", () => {
		const item = ChoiceItem.fromEntry(boxed("breakdown", "**BREAKDOWN** — rage", true));
		expect(item).toMatchObject({ kind: "entry", marked: true, hasBox: true, hasAnswer: false });
	});

	// An invocation carries its name as the entry's subtitle, and "(ongoing)" as the subtitle's note.
	it("keeps a named entry's name and note apart from its text", () => {
		const item = ChoiceItem.fromEntry(boxed("blinding-light", "Your light blazes.", false,
			{ subtitle: "Blinding Light", subtitleNote: "(ongoing)" }));
		expect(item).toMatchObject({ nameHtml: "Blinding Light", noteHtml: "(ongoing)", labelHtml: "Your light blazes." });
		expect(item.hasName).toBe(true);
		expect(item.name).toBe("Blinding Light");
	});

	it("counts a question as chosen once it is answered, and not before", () => {
		expect(ChoiceItem.fromEntry(question("where", "Where did you acquire it?")).isChosen).toBe(false);
		const answered = ChoiceItem.fromEntry(question("where", "Where did you acquire it?", "A barrow"));
		expect(answered).toMatchObject({ kind: "answer", answer: "A barrow", hasBox: false });
		expect(answered.isChosen).toBe(true);
	});

	// An introduction question has a box AND a blank. Writing the name in is choosing it.
	it("counts a boxed question as chosen when either half is filled", () => {
		const item = ChoiceItem.fromEntry(question("closest-kin", "Who is your closest kin?", "Aunt Hesk", true));
		expect(item).toMatchObject({ kind: "entry", marked: false, hasAnswer: true });
		expect(item.isChosen).toBe(true);
	});

	// What the shipped row draws from an entry: its own title, its box count, and what kind of blank.
	it("carries an entry's title, how many boxes it has, and what kind of blank", () => {
		const row = { ...question("closest-kin", "Who is your closest kin?", "", true),
			content: content({ title: "Kin", text: "Who is your closest kin?" }) };
		row.track.checks = [false, false];
		const item = ChoiceItem.fromEntry(row);
		expect(item).toMatchObject({ titleHtml: "Kin", checkCount: 2, inputType: "inline" });
	});

	it("names an option in plain words, for the control's label", () => {
		expect(ChoiceItem.fromOption(option("young", "<em>young</em>"), pickRow([])).labelText).toBe("<em>young</em>");
	});

	it("treats prose as neither offered nor chosen", () => {
		const item = ChoiceItem.fromEntry(heading("", "Just words."));
		expect(item.kind).toBe("prose");
		expect(item.isOffered).toBe(false);
		expect(item.isChosen).toBe(false);
	});
});

describe("ChoiceSection", () => {
	const consequences = new ChoiceSection({ slug: "consequences", list: [
		heading("Consequences", "When you first take this insert, choose 1."),
		boxed("breakdown", "BREAKDOWN", false),
		boxed("carrion-stench", "CARRION STENCH", true),
		boxed("quarry", "QUARRY", false),
	] }, "insert-thrall/consequences");

	// The group's own leading entry is its heading: the book prints the name and the instruction
	// there, so the bar takes the one and the open section the other. Nothing is renamed.
	it("lifts the leading titled entry into the title and the instruction", () => {
		expect(consequences.title).toBe("Consequences");
		expect(consequences.leadHtml).toBe("When you first take this insert, choose 1.");
		expect(consequences.items.map(i => i.slug)).toEqual(["breakdown", "carrion-stench", "quarry"]);
	});

	it("says what was chosen, out of what is on offer", () => {
		expect(consequences.chosen.map(i => i.slug)).toEqual(["carrion-stench"]);
		expect(consequences.offered).toHaveLength(3);
		expect(consequences.isChosen).toBe(true);
		expect(consequences.key).toBe("insert-thrall/consequences");
	});

	// Invocations: ten boxes and no heading entry at all.
	it("has no title of its own when the group prints none", () => {
		const s = new ChoiceSection({ slug: "invocations", title: null, list: [boxed("a", "A"), boxed("b", "B")] }, "k");
		expect(s.title).toBeNull();
		expect(s.leadHtml).toBe("");
		expect(s.isChosen).toBe(false);
	});

	// Appearance: four pick-one rows. Every word on offer counts, not every row.
	it("offers the options of pick rows, not the rows", () => {
		const s = new ChoiceSection({ slug: "appearance", list: [
			pickRow([option("young", "young", true), option("old", "old")], { rowKey: "row-0" }),
			pickRow([option("soft", "soft hands"), option("rough", "rough hands", true), option("scarred", "scarred")],
				{ rowKey: "row-1" }),
		] }, "playbook/appearance");
		expect(s.offered).toHaveLength(5);
		expect(s.chosen.map(i => i.labelHtml)).toEqual(["young", "rough hands"]);
	});

	// The Seeker's "Collection" is a heading and a paragraph — nothing to choose, so nothing to rest on.
	it("is prose when it offers nothing", () => {
		const s = new ChoiceSection({ slug: "collection", list: [heading("Collection", "You have acquired arcana.")] }, "k");
		expect(s.isProse).toBe(true);
		expect(s.title).toBe("Collection");
		expect(s.leadHtml).toBe("You have acquired arcana.");
	});

	it("is empty rather than broken for a missing group", () => {
		const s = new ChoiceSection(null, "k");
		expect(s.items).toEqual([]);
		expect(s.isChosen).toBe(false);
	});

	// The rows the shipped choice-row partial draws, in the pack's order, heading included: an entry
	// row is one item, a pick row stays one row of options.
	it("keeps the group's rows as the shipped row draws them", () => {
		const s = new ChoiceSection({ slug: "appearance", list: [
			heading("Appearance", "Choose 1 on each line."),
			{ ...pickRow([option("young", "young"), option("old", "old")], { rowKey: "row-0" }), inline: true },
			boxed("a", "A"),
		] }, "k");
		expect(s.rows.map(r => r.constructor.name)).toEqual(["ChoiceItem", "PickRow", "ChoiceItem"]);
		expect(s.rows[1]).toMatchObject({ inline: true, radio: true, rowKey: "row-0" });
		expect(s.rows[1].options.map(o => o.slug)).toEqual(["young", "old"]);
	});

	/* Resting is the shipped locked view — `condenseChoiceGroup`, the condenser itself, not a copy of
	   it. One line per thing chosen, in the shape the editor drew it. */
	it("condenses through the shipped condenser", () => {
		const s = new ChoiceSection({ slug: "consequences", list: [
			heading("Consequences", "Choose 1."), boxed("breakdown", "BREAKDOWN"), boxed("quarry", "QUARRY", true),
		] }, "k");
		const [block] = s.condensed;
		expect(block.title.raw).toBe("Consequences");
		expect(block.lines.map(l => [l.form, l.text.raw])).toEqual([["row", "QUARRY"]]);
	});

	// Consecutive inline pick rows read as one line of words — the shipped condenser's rule.
	it("condenses a run of picked words into one line", () => {
		const row = (key, ...opts) => ({ ...pickRow(opts, { rowKey: key }), inline: true });
		const s = new ChoiceSection({ slug: "appearance", list: [
			row("row-0", option("young", "young", true)), row("row-1", option("soft", "soft hands", true)),
		] }, "k");
		expect(s.condensed[0].lines.map(l => l.text.raw)).toEqual(["young · soft hands"]);
	});

	it("condenses to nothing when nothing is chosen", () => {
		expect(new ChoiceSection({ slug: "g", list: [heading("G"), boxed("a", "A")] }, "k").condensed).toEqual([]);
	});
});

/* A group with nothing to choose is the heading of the ones after it. The Seeker's "Collection" is the
   book's heading over Major Arcanum and Minor Arcana; the pack stores it as a group of its own. */
describe("LoreSection", () => {
	const collection = new ChoiceSection({ slug: "collection", list: [heading("Collection", "You have acquired arcana.")] },
		"playbook/lore/collection");
	const major = new ChoiceSection({ slug: "arcana-major", list: [heading("Major Arcanum"),
		question("where", "Where?", "A barrow"), question("who", "Who else?")] }, "playbook/lore/arcana-major");
	const minor = new ChoiceSection({ slug: "arcana-minor", list: [heading("Minor Arcana"),
		question("what", "What is it?")] }, "playbook/lore/arcana-minor");
	const fame = new ChoiceSection({ slug: "violence-fame", list: [heading("Folks Talk About…"),
		boxed("drake", "the drake"), boxed("hagr", "the hagr")] }, "playbook/lore/violence-fame");

	it("puts the groups after a heading group under it", () => {
		const [section] = LoreSection.fromGroups([collection, major, minor]);
		expect(section.title).toBe("Collection");
		expect(section.leadHtml).toBe("You have acquired arcana.");
		expect(section.groups.map(g => g.slug)).toEqual(["arcana-major", "arcana-minor"]);
		expect(section.key).toBe("playbook/lore/collection");
	});

	it("is chosen when anything in the groups it holds is", () => {
		const [section] = LoreSection.fromGroups([collection, major, minor]);
		expect(section.chosen.map(i => i.answer)).toEqual(["A barrow"]);
		expect(section.offered).toHaveLength(3);
		expect(section.isChosen).toBe(true);
	});

	// The Heavy's three have no heading group: each is a section of its own, as before.
	it("leaves groups with no heading before them as sections of their own", () => {
		const sections = LoreSection.fromGroups([fame, major]);
		expect(sections.map(s => [s.title, s.groups.map(g => g.slug)])).toEqual([
			["Folks Talk About…", ["violence-fame"]], ["Major Arcanum", ["arcana-major"]]]);
		expect(sections[0].heading).toBeNull();
		expect(sections[0].key).toBe("playbook/lore/violence-fame");
	});
});

describe("InstinctSection", () => {
	const group = checked => ({ slug: "instinct", list: [pickRow([
		option("fascination", "Fascination", checked === "fascination", "To explore"),
		option("shame", "Shame", checked === "shame", "To hide"),
	])] });

	it("rests on the computed label", () => {
		const s = new InstinctSection(group("shame"), "Shame — To hide", "insert-thrall/instinct");
		expect(s.label).toBe("Shame — To hide");
		expect(s.isChosen).toBe(true);
		expect(s.isWrittenIn).toBe(false);
		expect(s.options).toHaveLength(2);
	});

	// A pick and a write-in are mutually exclusive: a label with no option ticked was written in.
	it("knows a written-in instinct from a picked one", () => {
		const s = new InstinctSection(group(null), "To keep the old ways", "playbook/instinct");
		expect(s.isWrittenIn).toBe(true);
	});

	it("is unchosen before anything is picked or written", () => {
		expect(new InstinctSection(group(null), null, "k").isChosen).toBe(false);
	});
});

describe("OriginSection", () => {
	const origin = new OriginSection({ selected: "Gordin's Delve", options: [
		{ region: "Stonetop", names: ["Ania", "Dylan"], selected: false },
		{ region: "Gordin's Delve", names: [], selected: true },
	] }, "playbook/origin");

	it("reads the region picked, from the option that says so", () => {
		expect(origin.chosen.region).toBe("Gordin's Delve");
		expect(origin.isChosen).toBe(true);
	});

	// The book prints no names for Gordin's Delve and says to borrow one. An empty list is an
	// instruction, not a failure to load.
	it("knows a region with no names of its own", () => {
		expect(origin.regions.map(r => r.hasNames)).toEqual([true, false]);
	});
});

describe("BackgroundSection", () => {
	const section = new BackgroundSection({ selected: "antiquarian", options: [
		{ slug: "patriot", label: rich("Patriot"), description: rich("For the village."), selected: false, choices: null, resource: null },
		{ slug: "antiquarian", label: rich("Antiquarian"), description: rich("The past."), selected: true,
			choices: { slug: "antiquarian", list: [boxed("azure-hand", "The Azure Hand", true), boxed("mindgem", "The Mindgem")] },
			resource: null },
	] }, "playbook/background");

	it("reads the chosen background, and what else was on offer", () => {
		expect(section.chosen.slug).toBe("antiquarian");
		expect(section.isChosen).toBe(true);
	});

	// A background's own picks are a section of their own, addressed under the background.
	it("gives a background's own picks their own key", () => {
		expect(section.chosen.choices.key).toBe("playbook/background/antiquarian");
		expect(section.chosen.choices.chosen.map(i => i.slug)).toEqual(["azure-hand"]);
		expect(section.options[0].choices).toBeNull();
	});
});

describe("IntroductionsSection", () => {
	const intro = answer => new IntroductionsSection({
		step3: rich("On your third turn, **describe your major arcana**."),
		npcGroup: { slug: "intro-npc", list: [question("closest-kin", "Who is your closest kin?", answer, true),
			question("trust-more", "Whom do you trust?", "", true)] },
		pcGroup: { slug: "intro-pc", list: [question("key-discovery", "Which one of you made a discovery?", "", true)] },
	}, "playbook/introductions");

	it("keeps the two sets of questions under their own keys", () => {
		expect(intro("").npc.key).toBe("playbook/introductions/npc");
		expect(intro("").pc.key).toBe("playbook/introductions/pc");
	});

	// What is worth keeping once the procedure is over is who got named.
	it("collects the answers from both sets", () => {
		expect(intro("").hasAnswers).toBe(false);
		expect(intro("Aunt Hesk").answered.map(i => i.answer)).toEqual(["Aunt Hesk"]);
	});
});

describe("PlaybookSections", () => {
	const p = new PlaybookSections({
		description: rich("Look at us."),
		instinctGroup: { slug: "instinct", list: [pickRow([option("curiosity", "Curiosity", true, "To seek")])] },
		instinctSelected: "Curiosity — To seek",
		appearanceGroup: { slug: "appearance", list: [] },
		loreGroups: [{ slug: "collection", list: [heading("Collection", "Arcana.")] },
			{ slug: "arcana-major", list: [heading("Major Arcanum"), question("where", "Where?")] }],
		origin: { options: [] }, background: { options: [] }, introductions: null,
	});

	it("gives every section its address on the playbook", () => {
		expect(p.instinct.key).toBe("playbook/instinct");
		expect(p.appearance.key).toBe("playbook/appearance");
		expect(p.lore.map(s => [s.key, s.groups.map(g => g.key)])).toEqual([
			["playbook/lore/collection", ["playbook/lore/arcana-major"]]]);
	});

	it("carries the blurb, and no introductions where the playbook has none", () => {
		expect(p.blurbHtml).toBe("Look at us.");
		expect(p.introductions).toBeNull();
	});
});

describe("InsertView", () => {
	const toMove = (raw, key, label) => ({ slug: raw.slug, key, label });
	const thrall = new InsertView({
		slug: "thrall", name: "Thrall", description: rich("When you *die*…"),
		moves: [{ slug: "favor" }, { slug: "dark-succor" }],
		instinctGroup: { slug: "instinct", list: [pickRow([option("fascination", "Fascination", true, "To explore")])] },
		instinctSelected: "Fascination — To explore",
		choices: [{ slug: "consequences", list: [heading("Consequences"), boxed("quarry", "QUARRY")] }],
	}, toMove);

	it("is a tab of its own, named the shipped way", () => {
		expect(thrall.tabId).toBe("insert-thrall");
	});

	// The shipped header draws the insert's icon; the capture stores it relative to Foundry's root.
	it("reads its icon as a path the page can load, and none when it has none", () => {
		const icon = new InsertView({ slug: "thrall", name: "Thrall", img: "systems/stonetop/assets/content/inserts/Thrall.png" }, toMove);
		expect(icon.img).toBe("/systems/stonetop/assets/content/inserts/Thrall.png");
		expect(thrall.img).toBeNull();
	});

	// The whole insert on one surface: its moves come with it, filed under the insert.
	it("builds its moves through the factory it was given", () => {
		expect(thrall.moves).toEqual([{ slug: "favor", key: "insert-thrall", label: "Thrall" },
			{ slug: "dark-succor", key: "insert-thrall", label: "Thrall" }]);
	});

	it("addresses its instinct and its sections under its tab", () => {
		expect(thrall.instinct.key).toBe("insert-thrall/instinct");
		expect(thrall.sections.map(s => s.key)).toEqual(["insert-thrall/consequences"]);
		expect(thrall.carriesInstinct).toBe(true);
		expect(thrall.instinctLabel).toBe("Fascination — To explore");
	});

	// Invocations carry no instinct and no moves.
	it("has no instinct section when it carries none", () => {
		const invocations = new InsertView({ slug: "invocations", name: "Invocations", moves: [], choices: [],
			instinctGroup: null, instinctSelected: null }, toMove);
		expect(invocations.instinct).toBeNull();
		expect(invocations.carriesInstinct).toBe(false);
		expect(invocations.moves).toEqual([]);
	});
});

describe("PickRow", () => {
	it("keeps a row's shape and reads its options", () => {
		const row = new PickRow({ ...pickRow([option("a", "A", true)], { radio: false, rowKey: "r" }), inline: true });
		expect(row).toMatchObject({ inline: true, radio: false, rowKey: "r" });
		expect(row.options[0]).toMatchObject({ slug: "a", marked: true, exclusive: false });
	});
});

describe("markInGroup", () => {
	it("ticks and clears a line with a box", () => {
		const group = { slug: "g", list: [boxed("a", "A"), boxed("b", "B")] };
		const marked = markInGroup(group, "b", true);
		expect(marked.list[1].track.checks).toEqual([true]);
		expect(markInGroup(marked, "b", false).list[1].track.checks).toEqual([false]);
		expect(group.list[1].track.checks).toEqual([false]);
	});

	// A radio row keeps one: picking a word clears its neighbours on the same line only.
	it("clears the other options of a radio row, and only that row", () => {
		const group = { slug: "g", list: [
			pickRow([option("young", "young", true), option("old", "old")], { rowKey: "row-0" }),
			pickRow([option("soft", "soft", true), option("rough", "rough")], { rowKey: "row-1" }),
		] };
		const next = markInGroup(group, "old", true);
		expect(next.list[0].options.map(o => o.checked)).toEqual([false, true]);
		expect(next.list[1].options.map(o => o.checked)).toEqual([true, false]);
	});

	it("leaves the other options of a checkbox row alone", () => {
		const group = { slug: "g", list: [pickRow([option("a", "a", true), option("b", "b")], { radio: false })] };
		expect(markInGroup(group, "b", true).list[0].options.map(o => o.checked)).toEqual([true, true]);
	});
});

describe("answerInGroup", () => {
	it("writes into the one question named, and nothing else", () => {
		const group = { slug: "g", list: [question("a", "A?"), question("b", "B?")] };
		const next = answerInGroup(group, "b", "Aunt Hesk");
		expect(next.list.map(r => r.input.value)).toEqual(["", "Aunt Hesk"]);
	});
});

// Mirrors `InstinctController.computeSelected`: the picked option's name and description, joined by
// an em dash — or nothing, when nothing is picked.
describe("instinctLabelOf", () => {
	it("joins the picked option's name and description", () => {
		const group = { list: [pickRow([option("shame", "Shame", true, "To hide and deny your true nature.")])] };
		expect(instinctLabelOf(group)).toBe("Shame — To hide and deny your true nature.");
	});

	it("is null when nothing is picked", () => {
		expect(instinctLabelOf({ list: [pickRow([option("shame", "Shame")])] })).toBeNull();
	});
});
