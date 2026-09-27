import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { CharacterSnapshot, MoveView, ConditionView, PossessionView, PickView }
	from "../../scripts/development/redesign-mock/CharacterSnapshot.js";
import { WELL_VERSED, EXPEDITION_PHASES, MOVE_REPLACES, TERRIBLE_PURPOSE_INPUTS }
	from "../../scripts/development/redesign-mock/standIns.js";
import { PlaybookSections } from "../../scripts/development/redesign-mock/sections.js";

/**
 * The redesign deck asks these two classes every question it draws from, so a wrong answer here is
 * a mockup that shows something the data does not say — which is the exact failure the first deck
 * was built on. Each case below is a shape that actually appears in the packs.
 */

const rich = raw => ({ raw, autoRoll: false, html: raw });

const move = over => ({
	slug: "a-move", name: "A Move", description: rich("<p>text</p>"),
	gloss: "", rollStat: null, selection: { value: 0, max: 1 }, resource: null,
	requirement: null, requiresLabel: null, moveResults: null, ...over,
});

describe("MoveView", () => {
	it("prints the stat a move rolls", () => {
		expect(new MoveView(move({ rollStat: "int" })).rollLabel).toBe("+INT");
	});

	// Requisition rolls the steading's Fortunes. Spelled out, "+FORTUNES" was the widest thing in the
	// rail and its column broke "Requisition" mid-word; the shipped sheet's short form is the fix.
	it("prints a steading rating by the shipped sheet's short form", () => {
		expect(new MoveView(move({ rollStat: "fortunes" })).rollLabel).toBe("+FORT");
		expect(new MoveView(move({ rollStat: "population" })).rollLabel).toBe("+POP");
	});

	// The player chooses the stat, so any of the six can be added.
	it("prints an ask move as +ANY", () => {
		expect(new MoveView(move({ rollStat: "ask" })).rollLabel).toBe("+ANY");
	});

	// Two tests, not one `it.each`, because they are two different things and one test is how they
	// got merged: a prompt move rolls plain 2d6, and giving it ask's label told a dying player to add
	// a stat.
	it("gives a prompt move no modifier to print", () => {
		expect(new MoveView(move({ rollStat: "prompt" })).rollLabel).toBeNull();
	});

	it("still counts a prompt move as rolling, although it adds nothing", () => {
		expect(new MoveView(move({ rollStat: "prompt" })).rollsDice).toBe(true);
	});

	it("has no roll label when the move does not roll", () => {
		const m = new MoveView(move());
		expect(m.rollsDice).toBe(false);
		expect(m.rollLabel).toBeNull();
	});

	it("reads a resource as a uses fraction, and nothing when there is none", () => {
		expect(new MoveView(move({ resource: { current: 1, max: 3 } })).usesLabel).toBe("1/3");
		expect(new MoveView(move()).usesLabel).toBeNull();
	});

	it("counts a move as taken only once its selection has a value", () => {
		expect(new MoveView(move({ selection: { value: 1, max: 1 } })).isTaken).toBe(true);
		expect(new MoveView(move()).isTaken).toBe(false);
	});

	it("reads the tiers a move actually states", () => {
		const m = new MoveView(move({ moveResults: {
			success: { label: "10+", value: rich("ask 3 questions") },
			partial: { label: "7-9", value: rich("ask 1 question") },
			failure: { label: "6-", value: rich("") },
		} }));
		expect(m.tiers.map(t => t.label)).toEqual(["10+", "7-9"]);
	});

	// Logbook carries all three labels with every value empty. Testing `moveResults` for presence
	// drew a tier block of three blank rows in the preview card.
	it("has no tiers when every stated value is empty", () => {
		const m = new MoveView(move({ moveResults: {
			success: { label: "10+", value: rich("") },
			partial: { label: "7-9", value: rich("") },
			failure: { label: "6-", value: rich("") },
		} }));
		expect(m.tiers).toEqual([]);
	});

	// The snapshot's requirement is a RequirementSnapshot — a label and whether it is met, nothing
	// else. This used to be tested against a `playbook` field the snapshot never carries, which is
	// how a check that could never fire stayed green.
	it("prints the requirement as the shipped label states it", () => {
		expect(new MoveView(move({ requirement: { label: "The Seeker, Level 2", met: true },
			requiresLabel: "The Seeker, Level 2" })).requirement).toBe("The Seeker, Level 2");
		expect(new MoveView(move()).requirement).toBeNull();
	});

	it("says whether a requirement is met, and counts no requirement as met", () => {
		expect(new MoveView(move({ requirement: { label: "Level 6", met: false } })).requirementMet).toBe(false);
		expect(new MoveView(move({ requirement: { label: "Level 2", met: true } })).requirementMet).toBe(true);
		expect(new MoveView(move()).requirementMet).toBe(true);
	});

	it("counts how many times a move is taken, out of how many the book allows", () => {
		const m = new MoveView(move({ selection: { value: 1, max: 3 } }));
		expect(m.timesTaken).toBe(1);
		expect(m.maxTakes).toBe(3);
		expect(m.isRepeatable).toBe(true);
		expect(new MoveView(move()).isRepeatable).toBe(false);
	});

	const entry = (slug, text, checks) => ({ type: "entry", slug, content: { text: rich(text) },
		track: checks ? { slug, checks } : null });

	it("reads what a move lets you mark, and which are marked", () => {
		const m = new MoveView(move({ choices: { slug: "choices", list: [
			entry("fae", "The Fae and their strange ways", [false]),
			entry("makers", "The Makers and their arts", [true]),
		] } }));
		expect(m.picks.map(p => p.label)).toEqual(["The Fae and their strange ways", "The Makers and their arts"]);
		expect(m.markedPicks.map(p => p.slug)).toEqual(["makers"]);
	});

	// A choice group can hold prose rows as well as markable ones; only a row with a track is a pick.
	it("takes only the rows that carry a mark", () => {
		const m = new MoveView(move({ choices: { slug: "choices", list: [
			entry(null, "A heading", null),
			entry("makers", "The Makers and their arts", [false]),
		] } }));
		expect(m.picks.map(p => p.slug)).toEqual(["makers"]);
	});

	// Work With What You've Got says "pick 2" and stores nothing: the list is in its text, and it is
	// not something the character keeps.
	it("has no picks when the move carries no choice group", () => {
		expect(new MoveView(move()).picks).toEqual([]);
	});

	it("reads the phase of the expedition an expedition move belongs to", () => {
		expect(new MoveView(move({ phase: "on-the-road" })).phase).toBe("on-the-road");
	});

	it("has no phase when the move carries none", () => {
		expect(new MoveView(move()).phase).toBeNull();
	});
});

/** A possession as the snapshot hands it over — `CharacterPossessions#buildSnapshot`'s item shape. */
const possession = over => ({
	slug: "books-and-scrolls", label: rich("Books & scrolls"), description: rich("expend a use…"),
	selected: false, checked: false, disabled: false, preselected: false, preselectedSource: null,
	resource: null, usesLabel: null, choices: null, removable: false, ...over,
});

/** A pick row as `buildPickRow` makes it: options, and whether only one may be picked. */
const pickRow = (options, radio = false) => ({ type: "choice", radio,
	options: options.map(([slug, text, checked = false, description = null]) =>
		({ slug, text: rich(text), description: rich(description ?? ""), checked })) });

describe("PickView", () => {
	it("reads a one-box entry row — Well Versed's topic", () => {
		const p = PickView.fromEntry({ slug: "fae", content: { text: rich("The Fae") }, track: { checks: [true] } });
		expect(p).toMatchObject({ slug: "fae", label: "The Fae", marked: true, exclusive: false });
	});

	it("reads an option of a pick row — a Heavy's weapon", () => {
		const row = pickRow([["sword", "◇ Sword, iron", true]]);
		const p = PickView.fromOption(row.options[0], row);
		expect(p).toMatchObject({ slug: "sword", label: "◇ Sword, iron", marked: true, exclusive: false });
	});

	// Symbol of authority's options carry a description beside the text; nothing else does.
	it("keeps an option's description apart from its label", () => {
		const row = pickRow([["maul", "Black iron maul", false, "utterly immune to all magic"]], true);
		const p = PickView.fromOption(row.options[0], row);
		expect(p.label).toBe("Black iron maul");
		expect(p.detail).toBe("utterly immune to all magic");
		expect(p.exclusive).toBe(true);
	});
});

describe("PossessionView", () => {
	it("reads the name, the description and whether it is taken", () => {
		const p = new PossessionView(possession({ checked: true }));
		expect(p.name).toBe("Books & scrolls");
		expect(p.descriptionHtml).toBe("expend a use…");
		expect(p.isTaken).toBe(true);
		expect(new PossessionView(possession()).isTaken).toBe(false);
	});

	// Scribe's tools: the playbook's, ticked and not the player's to untick.
	it("knows a possession the playbook hands over, and what handed it", () => {
		const p = new PossessionView(possession({ checked: true, preselected: true,
			preselectedSource: "Starting", disabled: true }));
		expect(p.isGranted).toBe(true);
		expect(p.grantedBy).toBe("Starting");
		expect(p.isLocked).toBe(true);
	});

	it("carries its resource as the move row's track reads one", () => {
		const r = { current: 0, max: 2, title: "Skins of fine whisky" };
		expect(new PossessionView(possession({ resource: r })).resource).toBe(r);
		expect(new PossessionView(possession()).resource).toBeNull();
	});

	it("reads its options, and which are picked", () => {
		const p = new PossessionView(possession({ choices: { slug: "weapons-of-war-heavy", list: [
			pickRow([["sword", "◇ Sword, iron", true], ["battleaxe", "◇ Battleaxe, iron"], ["crossbow", "◇ Crossbow", true]]),
		] } }));
		expect(p.picks.map(o => o.slug)).toEqual(["sword", "battleaxe", "crossbow"]);
		expect(p.markedPicks.map(o => o.slug)).toEqual(["sword", "crossbow"]);
	});

	it("has no picks without a choice group", () => {
		expect(new PossessionView(possession()).picks).toEqual([]);
	});

	it("can be removed only when the sheet says so", () => {
		expect(new PossessionView(possession({ removable: true })).isRemovable).toBe(true);
		expect(new PossessionView(possession()).isRemovable).toBe(false);
	});
});

describe("CharacterSnapshot", () => {
	const build = over => new CharacterSnapshot({ stonetop: {
		name: "Test", playbook: { slug: "p", name: "P", img: "a.png", statsNote: "", description: rich("") },
		debilities: [], stats: {}, rollMode: "normal",
		vitals: { hp: { value: 10, max: 20 }, xp: { value: 0, max: 16 }, level: 1, armor: 0, damage: { value: "d6" } },
		moves: { categories: [] },
		possessions: { pickCount: 2, pickNote: "", items: [] },
		levelUp: { rows: [] },
		...over,
	} });

	it("reports how full HP is, and calls it low only near the bottom", () => {
		expect(build().hp).toMatchObject({ value: 10, max: 20, pct: 50, low: false });
		expect(build({ vitals: { hp: { value: 4, max: 20 }, xp: { value: 0, max: 16 }, level: 1,
			armor: 0, damage: { value: "d6" } } }).hp.low).toBe(true);
	});

	it("marks XP full once it has reached the cost of the next level", () => {
		expect(build({ vitals: { hp: { value: 1, max: 1 }, xp: { value: 16, max: 16 }, level: 1,
			armor: 0, damage: { value: "d6" } } }).xp.full).toBe(true);
	});

	const xpAt = value => build({ vitals: { hp: { value: 1, max: 1 }, xp: { value, max: 16 },
		level: 1, armor: 0, damage: { value: "d6" } } }).xp;

	// Below the threshold the mark is the end of the run, which is the bar as it has always read.
	it("puts the threshold at the end of the track while experience is short of it", () => {
		expect(xpAt(8)).toMatchObject({ pct: 50, thresholdPct: 100, over: 0, scale: 16 });
	});

	/**
	 * Experience does not stop where it is satisfied. Burn Brightly triggers on *having enough to
	 * Level Up*, not once — so every 2 points above the line is another roll that can be pushed
	 * before the level is out of reach again, and the surplus is the size of that decision.
	 *
	 * Before this, `pct` was value/max, so 21 computed to 131%, the fill clipped, and 21 and 16 drew
	 * identically at exactly the point the difference starts mattering.
	 */
	it("rescales past the threshold and marks where the level is paid for", () => {
		expect(xpAt(21)).toMatchObject({ pct: 100, thresholdPct: 76, over: 5, scale: 21 });
	});

	it("never reports a fill past the end of the track", () => {
		for (const v of [0, 1, 15, 16, 17, 40]) expect(xpAt(v).pct).toBeLessThanOrEqual(100);
	});

	it("has no surplus at exactly the threshold", () => {
		expect(xpAt(16)).toMatchObject({ pct: 100, thresholdPct: 100, over: 0, full: true });
	});

	// A playbook grant is not a pick. Counting it reports "2 of 2 picked" while one is still owed.
	it("keeps a playbook grant out of the pick budget", () => {
		const p = build({ possessions: { pickCount: 2, pickNote: "", items: [
			possession({ slug: "tools", checked: true, preselected: true }),
			possession({ slug: "books", checked: true }),
			possession({ slug: "still" }),
		] } }).possessions;
		expect(p.granted).toHaveLength(1);
		expect(p.chosen).toHaveLength(1);
		expect(p.owed).toBe(1);
	});

	// Guide, don't enforce: a third pick is allowed, and nothing is owed back as a negative.
	it("owes nothing once the budget is met or passed", () => {
		const over = build({ possessions: { pickCount: 1, pickNote: "", items: [
			possession({ slug: "a", checked: true }), possession({ slug: "b", checked: true }),
		] } }).possessions;
		expect(over.owed).toBe(0);
	});

	it("hands its possessions over as views, with the playbook's note and budget", () => {
		const p = build({ possessions: { pickCount: 2, pickNote: "Pick 2", items: [possession()] } }).possessions;
		expect(p.items[0]).toBeInstanceOf(PossessionView);
		expect(p.note).toBe("Pick 2");
		expect(p.budget).toBe(2);
	});

	const withList = items => build({ possessions: { pickCount: 2, pickNote: "", items } });
	const find = (S, slug) => S.possessions.items.find(i => i.slug === slug);

	it("takes and gives back a possession, as a new snapshot", () => {
		const S = withList([possession({ slug: "distillery" })]);
		expect(find(S.withPossessionTaken("distillery", true), "distillery").isTaken).toBe(true);
		expect(find(S.withPossessionTaken("distillery", true).withPossessionTaken("distillery", false),
			"distillery").isTaken).toBe(false);
		expect(find(S, "distillery").isTaken).toBe(false);
	});

	it("picks and clears a possession's option, as a new snapshot", () => {
		const S = withList([possession({ slug: "weapons", choices: { slug: "weapons", list: [
			pickRow([["sword", "Sword", true], ["axe", "Axe"]])] } })]);
		const both = S.withPossessionPick("weapons", "axe", true);
		expect(find(both, "weapons").markedPicks.map(o => o.slug)).toEqual(["sword", "axe"]);
		expect(find(both.withPossessionPick("weapons", "sword", false), "weapons").markedPicks.map(o => o.slug))
			.toEqual(["axe"]);
		expect(find(S, "weapons").markedPicks.map(o => o.slug)).toEqual(["sword"]);
	});

	// A pick-1 row is a radio: picking one is un-picking the other.
	it("clears the other options of a row that allows only one", () => {
		const S = withList([possession({ slug: "symbol", choices: { slug: "symbol", list: [
			pickRow([["maul", "Maul", true], ["crown", "Crown"]], true)] } })]);
		expect(find(S.withPossessionPick("symbol", "crown", true), "symbol").markedPicks.map(o => o.slug))
			.toEqual(["crown"]);
	});

	it("borrows another character's possessions and nothing else", () => {
		const other = withList([possession({ slug: "smithy", checked: true })]);
		const S = withList([possession({ slug: "books-and-scrolls" })]);
		const swapped = S.withPossessionsOf(other);
		expect(swapped.possessions.items.map(i => i.slug)).toEqual(["smithy"]);
		expect(swapped.hp).toEqual(S.hp);
		expect(S.possessions.items.map(i => i.slug)).toEqual(["books-and-scrolls"]);
	});

	const withStats = (note, values) => build({
		playbook: { slug: "p", name: "P", img: "a.png", statsNote: note, description: rich("") },
		stats: Object.fromEntries(["str", "dex", "int", "wis", "con", "cha"]
			.map((k, i) => [k, { key: k, abbr: k.toUpperCase(), name: k, value: values[i] }])),
	});

	it("reads the offered scores out of the playbook's sentence", () => {
		expect(withStats("Assign these scores to your stats: +2, +1, +1, +0, +0, -1", [0, 0, 0, 0, 0, 0])
			.startingStats).toEqual([2, 1, 1, 0, 0, -1]);
	});

	// The array has duplicates. Placing one +1 must leave the other still offered — a set difference
	// would retire both, and the chip row would lie about what is left.
	it("retires assigned scores one at a time, not by value", () => {
		expect(withStats("+2, +1, +1, +0, +0, -1", [1, 1, 0, 0, 0, 0])
			.unassignedStartingStats).toEqual([2, -1]);
	});

	/**
	 * The limitation this affordance has, written down rather than discovered later.
	 *
	 * There is no "unassigned" state for a stat — an untouched stat is 0, and 0 is also a score the
	 * playbook offers. So a brand-new character with six zeroes already looks like someone who has
	 * placed both +0s. The chips under-report by exactly the number of zeroes in the array.
	 *
	 * Harmless here (it still shows +2, +1, +1 and -1 outstanding, which is the useful part) but it
	 * is the second reason this wants a real `startingStats` field and an explicit assigned state
	 * rather than a value comparison.
	 */
	it("cannot tell an untouched stat from a deliberately assigned +0", () => {
		expect(withStats("+2, +1, +1, +0, +0, -1", [0, 0, 0, 0, 0, 0])
			.unassignedStartingStats).toEqual([2, 1, 1, -1]);
	});

	it("offers nothing once every score is placed", () => {
		expect(withStats("+2, +1, +1, +0, +0, -1", [2, 1, 1, 0, 0, -1])
			.unassignedStartingStats).toEqual([]);
	});

	// The Would-Be Hero's array is different from the other eight.
	it("reads a playbook with its own array", () => {
		expect(withStats("Assign these scores to your stats: +1, +0, +0, +0, +0, -1", [0, 0, 0, 0, 0, 0])
			.startingStats).toEqual([1, 0, 0, 0, 0, -1]);
	});

	it("offers nothing when the playbook states no array", () => {
		expect(withStats("", [0, 0, 0, 0, 0, 0]).startingStats).toEqual([]);
	});

	const chooseMove = over => ({ step: { tab: "moves", text: rich("Choose a new move from your playbook.") },
		chosen: 2, expected: 2, done: true, ...over });

	// Moves, not rows: the step is one row however far behind it is.
	it("counts the moves the level-up is still waiting on", () => {
		const owing = build({ levelUp: { rows: [
			chooseMove({ chosen: 1, expected: 3, done: false }),
			{ done: false, step: { tab: "playbook" } },
		] } });
		expect(owing.owedMoves).toBe(2);
		expect(build({ levelUp: { rows: [chooseMove()] } }).owedMoves).toBe(0);
		expect(build().owedMoves).toBe(0);
	});

	it("reads the step in the Level Up move's own words", () => {
		expect(build({ levelUp: { rows: [chooseMove()] } }).chooseMoveText)
			.toBe("Choose a new move from your playbook.");
	});

	it("makes a new snapshot owing moves, and one owing none", () => {
		const S = build({ levelUp: { rows: [chooseMove()] } });
		expect(S.withLevelUpOwing(1).owedMoves).toBe(1);
		expect(S.withLevelUpOwing(1).withLevelUpOwing(0).owedMoves).toBe(0);
		expect(S.owedMoves).toBe(0);
	});

	const withPlaybookMoves = moves => build({ moves: { categories: [
		{ key: "basic", label: "Basic", renderStyle: "side-bar", moves: [move({ slug: "clash" })] },
		{ key: "playbook-p", label: "P", renderStyle: "standard", moves },
	] } });
	const pbMove = (S, slug) => S.playbookCategory.moves.find(m => m.slug === slug);

	it("takes a move again, as a new snapshot", () => {
		const S = withPlaybookMoves([move({ slug: "well-versed", selection: { value: 1, max: 3 } })]);
		const again = S.withTimesTaken("well-versed", 2);
		expect(pbMove(again, "well-versed").timesTaken).toBe(2);
		expect(pbMove(again, "well-versed").raw.selectable).toBe(true);
		expect(pbMove(S, "well-versed").timesTaken).toBe(1);
	});

	// `incrementMove` stops at the book's limit and `decrementMove` at zero; so does this.
	it("holds the count to what the book allows", () => {
		const S = withPlaybookMoves([move({ slug: "well-versed", selection: { value: 1, max: 3 } })]);
		expect(pbMove(S.withTimesTaken("well-versed", 5), "well-versed").timesTaken).toBe(3);
		expect(pbMove(S.withTimesTaken("well-versed", 3), "well-versed").raw.selectable).toBe(false);
		expect(pbMove(S.withTimesTaken("well-versed", -1), "well-versed").timesTaken).toBe(0);
	});

	it("leaves the reference moves alone when a playbook move changes", () => {
		const S = withPlaybookMoves([move({ slug: "clash", selection: { value: 0, max: 1 } })]);
		expect(S.withTimesTaken("clash", 1).basicMoves[0].timesTaken).toBe(0);
	});

	it("marks and clears one pick, as a new snapshot", () => {
		const S = withPlaybookMoves([move({ slug: "well-versed", choices: { slug: "choices", list: [
			{ slug: "fae", content: { text: rich("The Fae") }, track: { slug: "fae", checks: [false] } },
			{ slug: "makers", content: { text: rich("The Makers") }, track: { slug: "makers", checks: [true] } },
		] } })]);
		const marked = S.withPickMarked("well-versed", "fae", true);
		expect(pbMove(marked, "well-versed").markedPicks.map(p => p.slug)).toEqual(["fae", "makers"]);
		expect(pbMove(marked.withPickMarked("well-versed", "makers", false), "well-versed")
			.markedPicks.map(p => p.slug)).toEqual(["fae"]);
		expect(pbMove(S, "well-versed").markedPicks.map(p => p.slug)).toEqual(["makers"]);
	});

	it("replaces a move's text and choice group", () => {
		const S = withPlaybookMoves([move({ slug: "well-versed" })]);
		const choices = { slug: "choices", list: [
			{ slug: "fae", content: { text: rich("The Fae") }, track: { slug: "fae", checks: [false] } }] };
		const replaced = pbMove(S.withMoveChoices("well-versed", rich("Mark 1 topic."), choices), "well-versed");
		expect(replaced.descriptionHtml).toBe("Mark 1 topic.");
		expect(replaced.picks.map(p => p.slug)).toEqual(["fae"]);
	});

	it("draws the basic moves from the basic group alone", () => {
		const cats = [
			{ key: "basic", label: "Basic", renderStyle: "side-bar", moves: [move({ slug: "clash" })] },
			{ key: "expedition", label: "Expedition", renderStyle: "side-bar", moves: [move({ slug: "forage" })] },
			{ key: "pb", label: "PB", renderStyle: "standard", moves: [move({ slug: "logbook" })] },
		];
		expect(build({ moves: { categories: cats } }).basicMoves.map(m => m.slug)).toEqual(["clash"]);
	});

	it("has no move list at all before a playbook fills one in", () => {
		expect(build().basicMoves).toEqual([]);
	});

	// The four special moves never render as a group: each appears on its own condition in its own
	// place, so the rail asks for one at a time and must get nothing for anything else.
	it("finds one special move by slug, and nothing for a slug that is not one", () => {
		const cats = [{ key: "special", label: "Special", renderStyle: "side-bar",
			moves: [move({ slug: "burn-brightly" }), move({ slug: "deaths-door" })] }];
		const S = build({ moves: { categories: cats } });
		expect(S.specialMove("deaths-door").slug).toBe("deaths-door");
		expect(S.specialMove("clash")).toBeNull();
	});

	const playbook = over => ({ slug: "p", name: "The Seeker", img: "a.png", statsNote: "",
		description: rich(""), ...over });

	const withInstinct = (instinctSelected, inserts = []) =>
		build({ playbook: playbook({ instinctSelected }), inserts });

	it("shows the playbook's instinct, and says where it is edited", () => {
		const i = withInstinct("Curiosity — to seek answers").instinct;
		expect(i.label).toBe("Curiosity — to seek answers");
		expect(i.source).toBe("The Seeker");
		expect(i.tab).toBe("playbook");
		expect(i.isFromInsert).toBe(false);
	});

	// An insert's instinct REPLACES the playbook's — the one grant in the game that overwrites a
	// choice rather than adding to it. What shows is one label, never two.
	it("lets an insert's instinct replace the playbook's, and sends the reader to that insert's tab", () => {
		const i = withInstinct("Curiosity", [{ slug: "revenant", name: "Revenant", instinctSelected: "Denial" }]).instinct;
		expect(i.label).toBe("Denial");
		expect(i.source).toBe("Revenant");
		expect(i.tab).toBe("insert-revenant");
		expect(i.isFromInsert).toBe(true);
	});

	// One of the four carries no instinct, and a character can hold more than one insert at once.
	it("ignores an insert that carries no instinct of its own", () => {
		const i = withInstinct("Curiosity", [{ name: "Invocations", instinctSelected: null }]).instinct;
		expect(i.label).toBe("Curiosity");
		expect(i.tab).toBe("playbook");
	});

	it("is empty rather than broken before an instinct is chosen", () => {
		expect(withInstinct(null).instinct.isEmpty).toBe(true);
	});

	const word = (slug, checked = false) => ({ slug, text: rich(slug), description: rich(""), checked });
	const appearanceRow = (rowKey, ...words) => ({ type: "choice", radio: true, inline: true, rowKey, options: words });
	const withAppearance = list => build({ playbook: playbook({ appearanceGroup: { slug: "appearance", list } }) });

	// The masthead's line and the Playbook tab's resting line are one value, so they are one derivation:
	// the picked word of each line, in the book's order.
	it("reads appearance as the picked words of each line, in order", () => {
		expect(withAppearance([
			appearanceRow("row-0", word("world-weary", true), word("fresh-faced")),
			appearanceRow("row-1", word("booming"), word("whispery", true)),
		]).appearance).toBe("world-weary · whispery");
	});

	// A new character has no appearance line, rather than a row of blanks waiting to be filled.
	it("says nothing when nothing has been picked", () => {
		expect(withAppearance([appearanceRow("row-0", word("world-weary"))]).appearance).toBe("");
		expect(build().appearance).toBe("");
	});

	it("follows a pick made on the sheet", () => {
		const S = withAppearance([appearanceRow("row-0", word("world-weary", true), word("fresh-faced"))]);
		expect(S.withMarked("playbook/appearance", "fresh-faced", true).appearance).toBe("fresh-faced");
	});

	const vitals = over => ({ hp: { value: 10, max: 20 }, xp: { value: 0, max: 16 }, level: 1,
		armor: 0, damage: { value: "d6" }, ...over });

	it("is ready to level at the threshold and not before", () => {
		expect(build({ vitals: vitals({ xp: { value: 15, max: 16 } }) }).readyToLevel).toBe(false);
		expect(build({ vitals: vitals({ xp: { value: 16, max: 16 } }) }).readyToLevel).toBe(true);
	});

	it("is dying at zero hit points", () => {
		expect(build().isDying).toBe(false);
		expect(build({ vitals: vitals({ hp: { value: 0, max: 20 } }) }).isDying).toBe(true);
	});

	// The deck has to be able to reach the states the rail's conditional rows fire on, and every one
	// of those conditions is a vital. Patching in place would leave the earlier frames showing the
	// later frame's numbers.
	it("makes a new snapshot with different numbers and leaves the original alone", () => {
		const S = build();
		const dying = S.withVitals({ hp: { value: 0 } });
		expect(dying.isDying).toBe(true);
		expect(dying.hp.max).toBe(20);
		expect(S.isDying).toBe(false);
	});

	it("replaces a plain vital outright rather than merging into it", () => {
		expect(build().withVitals({ armor: 3 }).armor).toBe(3);
	});

	const expedition = slugs => ({ key: "expedition", label: "Expedition", renderStyle: "side-bar",
		moves: slugs.map(slug => move({ slug })) });

	it("stamps each expedition move with its phase, as a new snapshot", () => {
		const S = build({ moves: { categories: [expedition(["forage", "outfit"])] } });
		const phased = S.withExpeditionPhases({ forage: "on-the-road", outfit: "setting-out" });
		expect(phased.expeditionPhases.flatMap(p => p.moves).map(m => m.phase))
			.toEqual(["setting-out", "on-the-road"]);
		expect(S.expeditionPhases.flatMap(p => p.moves).map(m => m.phase)).toEqual([null, null]);
	});

	// The journey's order, not the capture's: the capture lists Outfit eighth of ten.
	it("groups the expedition moves by phase, in the order a journey runs", () => {
		const S = build({ moves: { categories: [expedition(["return-triumphant", "forage", "outfit"])] } })
			.withExpeditionPhases({ "return-triumphant": "getting-home", forage: "on-the-road", outfit: "setting-out" });
		expect(S.expeditionPhases.map(p => [p.key, p.moves.map(m => m.slug)])).toEqual([
			["setting-out", ["outfit"]],
			["on-the-road", ["forage"]],
			["getting-home", ["return-triumphant"]],
		]);
	});

	// A move the phase data does not name is still a move a character has. It goes after the phases,
	// under no heading, rather than off the sheet.
	it("keeps a move with no phase, after the phased ones, rather than dropping it", () => {
		const S = build({ moves: { categories: [expedition(["forage", "a-new-one"])] } })
			.withExpeditionPhases({ forage: "on-the-road" });
		expect(S.expeditionPhases.map(p => [p.key, p.moves.map(m => m.slug)]))
			.toEqual([["on-the-road", ["forage"]], [null, ["a-new-one"]]]);
	});

	it("has no expedition phases without an expedition group", () => {
		expect(build().expeditionPhases).toEqual([]);
	});

	it("draws the follower moves from the follower group alone", () => {
		const cats = [
			{ key: "basic", label: "Basic", renderStyle: "side-bar", moves: [move({ slug: "clash" })] },
			{ key: "follower", label: "Follower", renderStyle: "side-bar",
				moves: [move({ slug: "strengthen-your-bond" }), move({ slug: "order-followers" })] },
		];
		expect(build({ moves: { categories: cats } }).followerMoves.map(m => m.slug))
			.toEqual(["strengthen-your-bond", "order-followers"]);
		expect(build().followerMoves).toEqual([]);
	});

	it("has followers only while the followers tab lists one", () => {
		expect(build().hasFollowers).toBe(false);
		expect(build({ followers: { tab: [] } }).hasFollowers).toBe(false);
		expect(build({ followers: { tab: ["crew"] } }).hasFollowers).toBe(true);
	});

	it("takes a character's followers away, as a new snapshot", () => {
		const S = build({ followers: { tab: ["crew"], bySlug: {} } });
		expect(S.withFollowers([]).hasFollowers).toBe(false);
		expect(S.hasFollowers).toBe(true);
	});

	// "At home" is the Level Up move's own condition, so the sheet says it in the move's words.
	it("reads the Level Up move's own trigger", () => {
		expect(build({ levelUp: { rows: [], gloss: "have a quiet stretch of time at home" } }).levelUpTrigger)
			.toBe("have a quiet stretch of time at home");
		expect(build().levelUpTrigger).toBe("");
	});

	/* ── The playbook's sections, and the inserts ─────────────────────────── */

	const pick = (slug, text, checked = false, description = "") =>
		({ slug, text: rich(text), description: rich(description), checked });
	const instinctGroup = (...options) => ({ slug: "instinct", list: [{ type: "choice", radio: true,
		rowKey: "instinct-row-0", options }] });
	const boxed = (slug, text, marked = false) => ({ type: "entry", slug,
		content: { title: rich(""), subtitle: rich(""), subtitleNote: rich(""), text: rich(text) },
		track: { slug, checks: [marked], requires: null }, input: null });
	const thrall = over => ({
		id: "t1", slug: "thrall", name: "Thrall", description: rich("When you *die*…"),
		moves: [move({ slug: "favor" }), move({ slug: "dark-succor", rollStat: "favor" })],
		instinctGroup: instinctGroup(pick("fascination", "Fascination", false, "To explore"),
			pick("shame", "Shame", false, "To hide")),
		instinctSelected: null,
		choices: [{ slug: "terrible-purpose", list: [boxed("longing", "LONGING"), boxed("duty", "DUTY")] },
			{ slug: "consequences", list: [boxed("breakdown", "BREAKDOWN"), boxed("quarry", "QUARRY")] }],
		...over,
	});
	const invocations = () => ({ id: "i1", slug: "lightbearer-invocations-insert", name: "Invocations",
		description: rich("You start knowing 2."), moves: [], instinctGroup: null, instinctSelected: null,
		choices: [{ slug: "lightbearer-invocations", list: [boxed("blinding-light", "Your light blazes.")] }] });

	it("reads the playbook's sections as named sections", () => {
		expect(build().playbookSections).toBeInstanceOf(PlaybookSections);
	});

	it("lists each insert, and finds one by its tab", () => {
		const S = build({ inserts: [invocations(), thrall()] });
		expect(S.inserts.map(i => i.tabId)).toEqual(["insert-lightbearer-invocations-insert", "insert-thrall"]);
		expect(S.insertByTab("insert-thrall").name).toBe("Thrall");
		expect(S.insertByTab("insert-ghost")).toBeNull();
		expect(build().inserts).toEqual([]);
	});

	// An insert's moves are MoveViews like any other, filed under the insert — the whole card on its tab.
	it("gives an insert's moves the insert as their category", () => {
		const moves = build({ inserts: [thrall()] }).insertByTab("insert-thrall").moves;
		expect(moves.map(m => [m.slug, m.categoryKey, m.categoryLabel])).toEqual([
			["favor", "insert-thrall", "Thrall"], ["dark-succor", "insert-thrall", "Thrall"]]);
		expect(moves[1].rollLabel).toBe("+FAVOR");
	});

	// The playbook's instinct is kept while an insert's replaces it, so the Playbook tab can say so.
	it("names the insert whose instinct is in force, and none when the playbook's is", () => {
		const S = build({ playbook: playbook({ instinctSelected: "Curiosity" }),
			inserts: [invocations(), thrall({ instinctSelected: "Shame — To hide" })] });
		expect(S.instinctInsert.slug).toBe("thrall");
		expect(build({ inserts: [invocations(), thrall()] }).instinctInsert).toBeNull();
	});

	it("borrows another character's inserts, as a new snapshot", () => {
		const other = build({ inserts: [thrall()] });
		const S = build();
		expect(S.withInsertsOf(other).inserts.map(i => i.slug)).toEqual(["thrall"]);
		expect(S.inserts).toEqual([]);
	});

	it("gives an insert up, as a new snapshot", () => {
		const S = build({ inserts: [invocations(), thrall()] });
		expect(S.withoutInsert("thrall").inserts.map(i => i.slug)).toEqual(["lightbearer-invocations-insert"]);
		expect(S.inserts).toHaveLength(2);
	});

	/* D9, amended: a character holding a move that takes Death's Door's place makes that move at zero
	   hit points instead. Undying rolls +CON, Dark Succor +Favor, Tethered rolls nothing. */
	const dying = inserts => build({ inserts, moves: { categories: [{ key: "special", label: "Special",
		renderStyle: "side-bar", moves: [move({ slug: "deaths-door", rollStat: "prompt" })] }] } });

	it("makes Death's Door the dying move when nothing replaces it", () => {
		expect(dying([invocations()]).dyingMove.slug).toBe("deaths-door");
	});

	it("makes an insert's move the dying move when it replaces Death's Door", () => {
		const S = dying([thrall()]).withMoveReplacements({ "dark-succor": "deaths-door" });
		expect(S.dyingMove.slug).toBe("dark-succor");
		expect(S.dyingMove.replaces).toBe("deaths-door");
		expect(dying([thrall()]).dyingMove.slug).toBe("deaths-door");
	});

	// A Terrible Purpose says "Name the person or persons…" and the pack gives the name nowhere to go.
	it("gives the named entries of an insert's group somewhere to write, where they have none", () => {
		const S = build({ inserts: [thrall()] }).withEntryInputs("terrible-purpose", ["duty"]);
		const purpose = S.insertByTab("insert-thrall").sections[0];
		expect(purpose.items.map(i => i.hasAnswer)).toEqual([false, true]);
		expect(purpose.items[1].answer).toBe("");
	});

	it("marks an insert's line and leaves the snapshot it came from alone", () => {
		const S = build({ inserts: [thrall()] });
		const marked = S.withMarked("insert-thrall/consequences", "quarry", true);
		expect(marked.insertByTab("insert-thrall").sections[1].chosen.map(i => i.slug)).toEqual(["quarry"]);
		expect(S.insertByTab("insert-thrall").sections[1].isChosen).toBe(false);
	});

	// Picking an insert's instinct is picking the character's: the masthead follows.
	it("recomputes the instinct label when an instinct option is picked", () => {
		const S = build({ playbook: playbook({ instinctSelected: "Curiosity" }), inserts: [thrall()] })
			.withMarked("insert-thrall/instinct", "shame", true);
		expect(S.instinct.label).toBe("Shame — To hide");
		expect(S.instinct.tab).toBe("insert-thrall");
	});

	it("writes an instinct in, clearing the pick", () => {
		const S = build({ playbook: playbook({ instinctSelected: "Curiosity — To seek",
			instinctGroup: instinctGroup(pick("curiosity", "Curiosity", true, "To seek")) }) })
			.withInstinctWritten("playbook/instinct", "To keep the old ways");
		expect(S.instinct.label).toBe("To keep the old ways");
		expect(S.playbookSections.instinct.isWrittenIn).toBe(true);
	});

	const question = (slug, value = "") => ({ type: "entry", slug,
		content: { title: rich(""), subtitle: rich(""), subtitleNote: rich(""), text: rich(`${slug}?`) },
		track: null, input: { slug: `${slug}-input`, placeholder: null, value, type: "inline" } });

	it("answers a playbook question", () => {
		const S = build({ playbook: playbook({ loreGroups: [{ slug: "arcana-major", list: [question("where")] }] }) })
			.withAnswer("playbook/lore/arcana-major", "where", "A barrow in the Flats");
		expect(S.playbookSections.lore[0].chosen.map(i => i.answer)).toEqual(["A barrow in the Flats"]);
	});

	it("marks a background's own pick under that background", () => {
		const bg = { selected: "antiquarian", options: [{ slug: "antiquarian", label: rich("Antiquarian"),
			description: rich(""), selected: true, resource: null,
			choices: { slug: "antiquarian", list: [boxed("azure-hand", "The Azure Hand"), boxed("mindgem", "The Mindgem")] } }] };
		const S = build({ playbook: playbook({ background: bg }) })
			.withMarked("playbook/background/antiquarian", "mindgem", true);
		expect(S.playbookSections.background.chosen.choices.chosen.map(i => i.slug)).toEqual(["mindgem"]);
	});

	it("answers an introduction question", () => {
		const intro = { step3: rich(""), npcGroup: { slug: "intro-npc", list: [question("closest-kin")] },
			pcGroup: { slug: "intro-pc", list: [] } };
		const S = build({ playbook: playbook({ introductions: intro }) })
			.withAnswer("playbook/introductions/npc", "closest-kin", "Aunt Hesk");
		expect(S.playbookSections.introductions.answered.map(i => i.answer)).toEqual(["Aunt Hesk"]);
	});

	it("picks another background and another region, one of each", () => {
		const opt = (slug, selected) => ({ slug, label: rich(slug), description: rich(""), selected, choices: null, resource: null });
		const S = build({ playbook: playbook({
			background: { selected: "patriot", options: [opt("patriot", true), opt("antiquarian", false)] },
			origin: { selected: "Stonetop", options: [{ region: "Stonetop", names: [], selected: true },
				{ region: "Marshedge", names: ["Aiden"], selected: false }] },
		}) });
		const next = S.withBackground("antiquarian").withOrigin("Marshedge");
		expect(next.playbookSections.background.chosen.slug).toBe("antiquarian");
		expect(next.playbookSections.origin.chosen.region).toBe("Marshedge");
		expect(next.playbookSections.background.options.filter(o => o.selected)).toHaveLength(1);
	});

	// An origin's name list names the character when a name is pressed, as the shipped sheet does.
	it("renames the character", () => {
		expect(build().withName("Ania").name).toBe("Ania");
	});
});

describe("against Maelen's real capture", () => {
	const S = new CharacterSnapshot(JSON.parse(
		readFileSync("scripts/development/mockup/maelen.json", "utf8")));

	it("reads the six stats in sheet order", () => {
		expect(S.stats.map(s => s.abbr)).toEqual(["STR", "DEX", "INT", "WIS", "CON", "CHA"]);
	});

	it("separates the playbook's own moves from the reference groups", () => {
		expect(S.playbookCategory.moves).toHaveLength(25);
		expect(S.referenceCategories.map(c => c.key)).toEqual(["basic", "expedition", "special", "follower"]);
	});

	// The rail's list, and the two properties that make one-line rows safe for it: they almost all
	// roll, so the roll column earns its width, and one of them holds a track that must survive.
	it("carries the ten basic moves, nine of which roll", () => {
		expect(S.basicMoves).toHaveLength(10);
		expect(S.basicMoves.filter(m => m.rollsDice)).toHaveLength(9);
		expect(S.basicMoves.filter(m => m.resource).map(m => m.usesLabel)).toEqual(["0/4"]);
	});

	it("finds each of the four special moves one at a time", () => {
		const slugs = ["burn-brightly", "end-of-session", "advantage-disadvantage", "deaths-door"];
		expect(slugs.map(slug => S.specialMove(slug)?.slug)).toEqual(slugs);
	});

	it("reads Maelen's instinct and appearance as single lines", () => {
		expect(S.instinct.label).toBe("Curiosity — To seek answers that maybe you oughtn't.");
		expect(S.instinct.tab).toBe("playbook");
		expect(S.appearance).toBe("curiously young · rich voice · soft hands · thick-set");
	});

	it("states the possession budget the playbook states", () => {
		expect(S.possessions.budget).toBe(2);
		expect(S.possessions.granted.map(g => g.slug)).toEqual(["scribes-tools"]);
		expect(S.possessions.owed).toBe(1);
	});


	// The property the folded density draws a pair as a unit to show: three pairs, contiguous in the
	// canonical order, covering all six exactly once. If a capture ever stops satisfying this, the
	// layout that relies on it is wrong rather than merely ugly.
	it("groups the six stats into three condition pairs that cover them exactly once", () => {
		expect(S.statPairs.map(p => p.abbrs)).toEqual([["STR", "DEX"], ["INT", "WIS"], ["CON", "CHA"]]);
		expect(S.statPairs.map(p => p.condition.name)).toEqual(["weakened", "dazed", "miserable"]);
	});

	it("knows which of Maelen's moves can be taken more than once", () => {
		expect(S.playbookCategory.moves.filter(m => m.isRepeatable).map(m => [m.slug, m.timesTaken, m.maxTakes]))
			.toEqual([["improved-stat", 1, 3], ["well-versed", 1, 3], ["initiate-of-the-secret-arts", 0, 3]]);
	});

	// The stand-in is the book's words in the shape the pack would carry them, so the only mark on it
	// is the one Maelen's background names.
	it("draws Well Versed's topics from the stand-in, with the background's topic marked", () => {
		const wv = S.withMoveChoices(WELL_VERSED.slug, WELL_VERSED.description, WELL_VERSED.choices)
			.playbookCategory.moves.find(m => m.slug === "well-versed");
		expect(wv.picks).toHaveLength(7);
		expect(wv.markedPicks.map(p => p.label)).toEqual(["The Makers and their arts"]);
		expect(wv.descriptionHtml).not.toContain("<li>");
	});

	it("owes no move at level 5, having already taken more than it gives", () => {
		expect(S.owedMoves).toBe(0);
	});

	// The stand-in names every one of the ten, so nothing lands in the unphased tail.
	it("splits the ten expedition moves into the journey's three phases", () => {
		const phases = S.withExpeditionPhases(EXPEDITION_PHASES).expeditionPhases;
		expect(phases.map(p => [p.key, p.moves.length]))
			.toEqual([["setting-out", 3], ["on-the-road", 6], ["getting-home", 1]]);
		expect(phases.flatMap(p => p.moves).filter(m => m.rollsDice).map(m => m.slug))
			.toEqual(["requisition", "forage", "struggle-as-one"]);
	});

	it("carries both follower moves, and four followers to use them on", () => {
		expect(S.followerMoves.map(m => m.slug)).toEqual(["strengthen-your-bond", "order-followers"]);
		expect(S.hasFollowers).toBe(true);
	});

	it("reads the Level Up trigger that says it happens at home", () => {
		expect(S.levelUpTrigger).toContain("at home");
	});

	it("knows which pair Maelen is actually under", () => {
		expect(S.statPairs.map(p => p.isActive)).toEqual([false, true, false]);
		expect(S.activeConditions.map(c => c.name)).toEqual(["dazed"]);
	});
});

describe("ConditionView", () => {
	const dazed = () => new ConditionView({
		key: "dazed", name: "dazed", active: true, stats: ["int", "wis"],
		description: "Out of it, befuddled, not thinking clearly. Take disadvantage when rolling +INT or +WIS.",
	});

	// The masthead prints what the condition IS and drops the clause naming the rolls — that clause is
	// already on the sheet as the two red numbers.
	it("summarises to what the condition is, without the rolls it costs", () => {
		expect(dazed().summary).toBe("Out of it, befuddled, not thinking clearly.");
	});

	// A one-sentence description has no ". " to split on, and must come back whole rather than empty.
	it("keeps a single-sentence description intact", () => {
		expect(new ConditionView({ description: "Out of it." }).summary).toBe("Out of it.");
		expect(new ConditionView({}).summary).toBe("");
	});

	it("says which stats it hinders", () => {
		expect(dazed().hinders("int")).toBe(true);
		expect(dazed().hinders("str")).toBe(false);
	});
});

describe("against the Heavy's real capture", () => {
	const H = new CharacterSnapshot(JSON.parse(
		readFileSync("scripts/development/mockup/heavy.json", "utf8")));
	const weapons = () => H.possessions.items.find(i => i.slug === "weapons-of-war-heavy");

	it("picks two of six, and owes nothing", () => {
		expect(H.possessions.items).toHaveLength(6);
		expect(H.possessions.chosen.map(p => p.slug)).toEqual(["smithy", "weapons-of-war-heavy"]);
		expect(H.possessions.owed).toBe(0);
	});

	// "choose up to 3 (now or later)": two chosen, the third left for later.
	it("reads Weapons of war's five options with Sword and Crossbow picked", () => {
		expect(weapons().picks).toHaveLength(5);
		expect(weapons().markedPicks.map(p => p.slug)).toEqual(["sword", "crossbow"]);
		expect(weapons().picks[0].exclusive).toBe(false);
	});
});

/**
 * A Lightbearer made in the dev world for this — the playbook grants the Invocations insert, and the
 * Thrall was dropped on it the way a sheet drop adds one. Two captures of the same character: the
 * moment the Thrall arrived, with nothing chosen, and after its choices were made through the sheet.
 */
describe("against the Lightbearer's real captures", () => {
	const load = file => new CharacterSnapshot(JSON.parse(
		readFileSync(`scripts/development/mockup/${file}`, "utf8")))
		.withMoveReplacements(MOVE_REPLACES)
		.withEntryInputs(TERRIBLE_PURPOSE_INPUTS.group, TERRIBLE_PURPOSE_INPUTS.entries);
	const arrived = load("lightbearer-arrived.json");
	const settled = load("lightbearer.json");
	const thrallOf = S => S.insertByTab("insert-thrall");

	it("carries the playbook's insert and the one gained by dying, in that order", () => {
		expect(settled.inserts.map(i => [i.tabId, i.name])).toEqual([
			["insert-lightbearer-invocations-insert", "Invocations"], ["insert-thrall", "Thrall"]]);
	});

	it("brings the Thrall's four moves with it, Favor holding its track", () => {
		const moves = thrallOf(settled).moves;
		expect(moves.map(m => m.slug).sort()).toEqual(["dark-succor", "favor", "unholy-vessel", "urges"]);
		expect(moves.find(m => m.slug === "favor").usesLabel).toBe("1/3");
		expect(moves.find(m => m.slug === "dark-succor").rollLabel).toBe("+FAVOR");
	});

	// Arrival is a small creation: nothing on the insert is chosen yet.
	it("arrives with nothing on it chosen", () => {
		const thrall = thrallOf(arrived);
		expect(thrall.instinct.isChosen).toBe(false);
		expect(thrall.sections.map(s => s.isChosen)).toEqual([false, false, false, false, false]);
	});

	it("reads the settled Thrall's choices, one in each section", () => {
		const thrall = thrallOf(settled);
		expect(thrall.instinct.label).toBe("Fascination — To explore your powers, your master, your new existence.");
		expect(thrall.sections.map(s => [s.title, s.chosen.map(i => i.slug)])).toEqual([
			["Your Master", ["name"]],
			["Impulse", ["hide-bury"]],
			["Terrible Purpose", ["duty"]],
			["Consequences", ["carrion-stench"]],
			["Marks", ["death-mask"]],
		]);
	});

	it("offers every entry the book prints on each ledger", () => {
		const [, impulse, purpose, consequences, marks] = thrallOf(settled).sections;
		expect([impulse, purpose, consequences, marks].map(s => s.offered.length)).toEqual([7, 3, 10, 9]);
	});

	// The Thrall's instinct replaces the Lightbearer's, and the masthead sends the reader to the Thrall.
	it("puts the Thrall's instinct in force once it is picked", () => {
		expect(settled.instinct.tab).toBe("insert-thrall");
		expect(settled.instinctInsert.slug).toBe("thrall");
		expect(arrived.instinct.tab).toBe("playbook");
	});

	it("knows the two invocations the Lightbearer starts with, by name", () => {
		const [section] = settled.insertByTab("insert-lightbearer-invocations-insert").sections;
		expect(section.title).toBeNull();
		expect(section.chosen.map(i => i.name)).toEqual(["Bath of Healing Light", "Blinding Light"]);
		expect(section.chosen[1].noteHtml).toBe("(ongoing)");
		expect(section.offered).toHaveLength(10);
	});

	it("makes Dark Succor the move at zero hit points", () => {
		expect(settled.withVitals({ hp: { value: 0 } }).dyingMove.slug).toBe("dark-succor");
	});

	it("gives each Terrible Purpose a place for the name it asks for", () => {
		expect(thrallOf(settled).sections[2].items.map(i => i.hasAnswer)).toEqual([true, true, true]);
	});
});
