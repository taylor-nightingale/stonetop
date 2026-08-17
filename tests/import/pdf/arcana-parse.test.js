import { describe, it, expect } from "vitest";
import { parseTrack, stripMarkers, tagText, stripLoyalty, parseItemLine, unlockSlug, followerChoiceEntry, followerChoices, isFollowerGroup, foldBackChoices, followerSectionIndex, isArcanaFollower, matchFollowerIcons, titleCase, majorMoveName, runInName, parseRequires, parseMoveRoll, resourceTracks, frontMoveResources, parseResourceLine, attachItemResource, parseNameFirstItem, parseFront, parseBack, splitAssignRows, numberBlanks, statblockMoveTail } from "../../../scripts/import/pdf/arcana-parse.js";

// Synthetic block factories (markers are literal glyphs in the line text, as the load pipeline injects).
const _line = (text) => ({ text, bbox: [0, 0, 0, 0], spans: [{ font: "ACaslonPro-Regular", size: 9, text }] });
const _para = (...t) => ({ type: "para", lines: t.map(_line) });
const _list = (...items) => ({ type: "list", items: items.map((it) => it.map(_line)) });
const _heading = (t) => ({ type: "heading", line: _line(t) });
const _rule = () => ({ type: "rule" });
const _statblock = (...t) => ({ type: "statblock", lines: t.map(_line) });

describe("parseTrack", () => {
	it("counts a single leading box as a max-1 track and strips it", () => {
		expect(parseTrack("□ … you must restore the runes")).toEqual({ max: 1, text: "… you must restore the runes" });
	});
	it("counts leading + trailing boxes around an entry (embedded track)", () => {
		expect(parseTrack("◻◻◻ You lose yourself in a blood-rage. ◻")).toEqual({ max: 4, text: "You lose yourself in a blood-rage." });
	});
	it("treats a pure circle run (text-layer 'l' glyphs) as a track with empty text", () => {
		expect(parseTrack("l l l l l")).toEqual({ max: 5, text: "" });
	});
	it("treats a pure ○ run as a track with empty text", () => {
		expect(parseTrack("○ ○ ○")).toEqual({ max: 3, text: "" });
	});
	it("never miscounts 'l's inside real words", () => {
		expect(parseTrack("I will call the spirits")).toEqual({ max: 0, text: "I will call the spirits" });
	});
});

describe("stripMarkers", () => {
	it("removes box/circle/diamond glyphs from markdown text, keeping emphasis", () => {
		expect(stripMarkers("◻◻ **You** lose yourself ◻")).toBe("**You** lose yourself");
	});
});

describe("tagText (disguise tags for a diamond-less front)", () => {
	it("strips markers, emphasis, and a leading separator comma", () => {
		expect(tagText("*magical, terrifying*")).toBe("magical, terrifying");
		expect(tagText("◇ , warm, magical")).toBe("warm, magical");
	});
	it("returns null for an empty tag line", () => {
		expect(tagText("  ◇  ")).toBeNull();
	});
});

describe("stripLoyalty", () => {
	it("strips a trailing (Loyalty ◯◯◯) from a cost line (loyalty is always 3)", () => {
		expect(stripLoyalty("wonder, excitement, joy, discovery (Loyalty ◯◯◯)")).toBe("wonder, excitement, joy, discovery");
	});
	it("handles ○ glyphs / spaces and leaves a cost with no loyalty untouched", () => {
		expect(stripLoyalty("to be useful (Loyalty ○ ○)")).toBe("to be useful");
		expect(stripLoyalty("wonder and joy")).toBe("wonder and joy");
	});
	it("handles real book noise: trailing stray markers, a 'Loyalty:' colon, and a loyalty-only cost", () => {
		expect(stripLoyalty("souls feasted upon (Loyalty  ○ ○  ) ○")).toBe("souls feasted upon");
		expect(stripLoyalty("profuse gratitude (Loyalty:  ○ ○ ○ )")).toBe("profuse gratitude");
		expect(stripLoyalty("Loyalty ◯◯◯")).toBe("");
	});
});

describe("titleCase (major mystery-move names)", () => {
	it("title-cases an all-caps move name, lowercasing minor words (not the first)", () => {
		expect(titleCase("UNQUENCHED")).toBe("Unquenched");
		expect(titleCase("A FLICKERING FLAME")).toBe("A Flickering Flame");
		expect(titleCase("SPIRITS OF THE HERD")).toBe("Spirits of the Herd");
		expect(titleCase("PROMISE OF DOOM")).toBe("Promise of Doom");
	});
});

describe("majorMoveName", () => {
	it("splits a leading all-caps run (the move name) from any inline remainder", () => {
		expect(majorMoveName("UNQUENCHED")).toEqual({ name: "UNQUENCHED", rest: "" });
		expect(majorMoveName("A FLICKERING FLAME")).toEqual({ name: "A FLICKERING FLAME", rest: "" });
		expect(majorMoveName("WHISPERS When you grip the shaft")).toEqual({ name: "WHISPERS", rest: "When you grip the shaft" });
	});
	it("returns null name when the line is not an all-caps move header", () => {
		expect(majorMoveName("When you do the thing").name).toBe("");
	});
});

describe("frontMoveResources (a front move's Casting-penalty pips)", () => {
	it("reads the ○ pips + italic label off a bold ALL-CAPS front header baseline", () => {
		const lines = [
			{ font: "ACaslonPro-Bold",   text: "CAST A CODEX SPELL", bbox: [36, 359, 126, 0] },
			{ font: "ACaslonPro-Italic", text: "Casting penalty",    bbox: [277, 359, 327, 0] },
			{ font: "marker",            text: "○ ○ ○ ○ ○",          bbox: [330, 359, 362, 0] },
		];
		expect(frontMoveResources(lines)).toEqual([{ slug: "cast-a-codex-spell", max: 5, title: "Casting penalty" }]);
	});
	it("ignores a bold ALL-CAPS header with no pips beside it", () => {
		expect(frontMoveResources([{ font: "ACaslonPro-Bold", text: "CAST A CODEX SPELL", bbox: [36, 359, 126, 0] }])).toEqual([]);
	});
});

describe("runInName (leading bold run-in → slug source)", () => {
	it("pulls the bold run-in name without its trailing period", () => {
		expect(runInName("**Call Up the Dead.** Touch a corpse.")).toBe("Call Up the Dead");
		expect(runInName("**Serpentine.** Your soul slithers.")).toBe("Serpentine");
	});
	it("is null when there is no bold run-in", () => {
		expect(runInName("Touch a corpse and it answers.")).toBeNull();
		expect(runInName("")).toBeNull();
	});
});

describe("parseBack — major mysteries (moves + consequence tracks)", () => {
	const back = parseBack([
		_heading("Mysteries of the Test Blade"),
		_heading("Moves"),
		_list(["□ UNQUENCHED", "When you **Clash**, mark a consequence."]),
		_para("When you have marked 3 consequences, you gain A Flickering Flame."),
		_rule(),
		_list(["□ A FLICKERING FLAME", "Roll +CON: hold Speed; spend Speed to:"], ["ä Attack any number of foes"], ["ä Strike a weak point"]),
		_heading("Consequences"),
		_list(["□ □ You lose yourself in a blood-rage. □"]),
		_para("When you attack, advantage on damage."),
		_list(["□ Pick someone who survives."]),
	], { slug: "test-blade", name: "Test Blade", major: true });

	it("sets the major back scaffolding (itemSameAsFront, no item)", () => {
		expect(back.title).toBe("Mysteries of the Test Blade");
		expect(back.itemSameAsFront).toBe(true);
		expect(back.item).toBeNull();
	});
	it("parses □ ALL-CAPS moves (title-cased + id) and folds sub-bullets instead of splitting them", () => {
		expect(back.moves.map((m) => m.name)).toEqual(["Unquenched", "A Flickering Flame"]);
		expect(back.moves[0]).toEqual({ id: "unquenched", name: "Unquenched", text: "When you **Clash**, mark a consequence.\n\nWhen you have marked 3 consequences, you gain A Flickering Flame." });
		expect(back.moves[1].text).toContain("- Attack any number of foes");
		expect(back.moves[1].text).toContain("- Strike a weak point");
	});
	it("extracts each consequence's □ run into track:{max} and slugs them <abbr>-cN", () => {
		expect(back.consequences.slug).toBe("consequences");
		expect(back.consequences.list.map((r) => r.slug)).toEqual(["blade-c1", "blade-c2"]);
		expect(back.consequences.list[0].track).toEqual({ max: 3 });
		expect(back.consequences.list[0].content.text).toBe("You lose yourself in a blood-rage.\n\nWhen you attack, advantage on damage.");
		expect(back.consequences.list[1].track).toEqual({ max: 1 });
	});
	it("flags a consequence tabbed in ~13.5px right of a sibling with indent:true", () => {
		const lineAt = (x0, text) => ({ ..._line(text), bbox: [x0, 0, 0, 0] });
		const listAt = (...items) => ({ type: "list", items: items.map(([x0, text]) => [lineAt(x0, text)]) });
		const b = parseBack([
			_heading("Consequences"),
			listAt(
				[432.9, "□ Your skin becomes clammy and squamous."],
				[446.4, "□ You can breathe water through your skin."],
				[440.3, "□ demon flesh into it."],           // wrapped line misread as a row: <8px in, not an indent
			),
			_rule(), // an indented row can open its own list block (mindgem) — still measured against the section
			listAt([446.4, "□ It wanders off in pursuit of its purpose."]),
			listAt([350.4, "□ Your physical body withers."]), // another column's base, not an indent
		], { slug: "ring-of-daagon", name: "Ring of Daagon", major: true });
		expect(b.consequences.list.map((r) => r.indent ?? false)).toEqual([false, true, false, true, false]);
	});
	it("derives the 'Mysteries of the X' title when the back has no title heading", () => {
		const b = parseBack([
			_heading("Moves"),
			_list(["□ POWER When you bear the staff, choose one:"]),
			_heading("Consequences"),
			_list(["□ One of your eyes becomes strange."]),
		], { slug: "staff-of-the-lidless-orb", name: "Staff of the Lidless Orb", major: true, unlockAt: 3 });
		expect(b.title).toBe("Mysteries of the Staff of the Lidless Orb");
		expect(b.moves.map((m) => m.name)).toEqual(["Power"]);
	});
	it("folds '□ Word.' options (rule-separated, not ALL-CAPS) into the preceding move", () => {
		const b = parseBack([
			_heading("Moves"),
			_list(["□ SPEAK THE UNUTTERABLE When you speak a Word, roll +CON."]),
			_rule(),
			_para("MASTERED WORDS"),
			_rule(),
			_list(["□ Seal. Name a portal; it seals shut."]),
			_rule(),
			_list(["□ Purify. Name a corruption; it is cleansed."]),
		], { slug: "ineffable-words", name: "Ineffable Words", major: true });
		expect(b.moves).toHaveLength(1);
		expect(b.moves[0].name).toBe("Speak the Unutterable");
		expect(b.moves[0].text).toContain("- Seal. Name a portal");
		expect(b.moves[0].text).toContain("- Purify. Name a corruption");
	});
	it("starts a new consequence when a box follows stray leading circles, counting only boxes for the track", () => {
		const b = parseBack([
			_heading("Consequences"),
			_list(["□ First consequence."], ["○ ○ □ Your body withers—mark the weakened debility."]),
		], { slug: "norubas-ice-sphere", name: "Noruba's Ice Sphere", major: true });
		expect(b.consequences.list).toHaveLength(2);
		expect(b.consequences.list[1].content.text).toBe("Your body withers—mark the weakened debility.");
		expect(b.consequences.list[1].track).toEqual({ max: 1 });
	});
	it("extracts a move's leading (Requires: …) into requirement and strips it from the move text", () => {
		const b = parseBack([
			_heading("Moves"),
			_list(["□ RESONANCE (Requires: Battery, Eye of the Storm) When you unleash the storm, roll +CON."]),
		], { slug: "azure-hand", name: "Azure Hand", major: true });
		expect(b.moves[0].name).toBe("Resonance");
		expect(b.moves[0].requirement).toEqual({ moves: ["Battery", "Eye of the Storm"] });
		expect(b.moves[0].text).toBe("When you unleash the storm, roll +CON.");
	});
});

describe("parseBack — Hec'tumel Codex: 'Spells of the Codex' + a marker-glued Consequences heading", () => {
	// The column split (a) scatters the "Mysteries of…" title to the end of the stream, after the running
	// header, and (b) strands the front's Marks pips onto the "Consequences" heading, so it arrives as a
	// 1-item list ("○ ○ ○ ○ Consequences") rather than a bare heading — mirrors the real page 557 blocks.
	const lineAt = (x0, text) => ({ ..._line(text), bbox: [x0, 0, 0, 0] });
	const consAt = (...items) => ({ type: "list", items: items.map(([x0, text]) => [lineAt(x0, text)]) });
	const back = parseBack([
		_heading("Spells of the Codex"),
		_list(["□ **Call Up the Dead.** Touch a corpse; you conjure its shade."]),
		_list(["□ **Serpentine.** Your soul slithers from your mouth."]),
		_list(["□ **Snuff the Spirit.** Name a living victim."]),
		_list(["□ **Torpor.** Lock eyes with someone and whisper."]),
		_heading("Moves"),
		_list(["□ DARKSOME VESSEL", "When you cast a Codex spell, on a 12+ you can choose the Empowered effect."]),
		_list(["○ ○ ○ ○ Consequences"]), // the marker-glued heading that used to swallow the section
		consAt(
			[432.9, "□ Over a few days, you lose all body hair."],
			[446.4, "□ Over a few days, you lose all your remaining hair. Gain +1 armor."],
			[432.9, "□ Your body temperature drops and your skin becomes cool."],
		),
		_heading("appendix d : major arcana"),   // running header ends back content
		_heading("Mysteries of the Hec'tumel Codex"), // the real title, scrambled to the end of the stream
	], { slug: "hectumel-codex", name: "Hec'tumel Codex", major: true, unlockAt: 4 });

	it("takes the real 'Mysteries of…' title, not the 'Spells of the Codex' subheading", () => {
		expect(back.title).toBe("Mysteries of the Hec'tumel Codex");
	});
	it("parses the spells into a titled back choice group of learnable (max-1) picks", () => {
		expect(back.choices.slug).toBe("hectumel-codex"); // back.choices is namespaced by the arcanum slug
		expect(back.choices.title).toBe("Spells of the Codex");
		expect(back.choices.list.map((r) => r.slug)).toEqual(["call-up-the-dead", "serpentine", "snuff-the-spirit", "torpor"]);
		expect(back.choices.list.every((r) => r.track?.max === 1)).toBe(true);
		expect(back.choices.list[0].content.text).toBe("**Call Up the Dead.** Touch a corpse; you conjure its shade.");
	});
	it("still parses the mystery move", () => {
		expect(back.moves.map((m) => m.name)).toEqual(["Darksome Vessel"]);
	});
	it("recovers the Consequences section despite the marker-glued heading, with escalation indents", () => {
		expect(back.consequences.list).toHaveLength(3);
		expect(back.consequences.list.map((r) => r.indent ?? false)).toEqual([false, true, false]);
		expect(back.consequences.list[1].content.text).toBe("Over a few days, you lose all your remaining hair. Gain +1 armor.");
	});
});

describe("parseRequires", () => {
	it("pulls a leading (Requires: A, B) into requirement moves and strips it from the text", () => {
		expect(parseRequires("(Requires: Battery, Eye of the Storm) When you unleash the storm."))
			.toEqual({ moves: ["Battery", "Eye of the Storm"], text: "When you unleash the storm." });
	});
	it("returns null moves and the unchanged text when there is no requires prefix", () => {
		expect(parseRequires("When you grip the shaft, roll +CON.")).toEqual({ moves: null, text: "When you grip the shaft, roll +CON." });
	});
});

describe("parseMoveRoll", () => {
	const results = (s, p, f) => ({
		success: { label: "10+", value: s }, partial: { label: "7-9", value: p }, failure: { label: "6-", value: f },
	});

	it("maps a 'roll +CON' stat and pulls all three inline tiers (dust-to-dust shape)", () => {
		const text = "When you **_press the ring_**, mark a debility and then roll +CON: **on a 10+**, the artifice fails or is ruined (say how); **on a 7-9**, it is ruined but also mark a consequence; **on a 6-**, the GM says what happens.";
		expect(parseMoveRoll(text)).toEqual({
			rollStat: "con",
			moveResults: results("the artifice fails or is ruined (say how)", "it is ruined but also mark a consequence", "the GM says what happens."),
		});
	});

	it("tolerates split-bold headers and a missing 6- tier (eye-of-the-storm shape)", () => {
		const text = "When you **_impose your will_**, roll +CON: **on a** **10+**, the elements calm, and choose 2 from the list below; **on a 7-9**, the elements calm, and choose 1.\n- You suffer no consequence";
		expect(parseMoveRoll(text)).toEqual({
			rollStat: "con",
			moveResults: results("the elements calm, and choose 2 from the list below", "the elements calm, and choose 1.", ""),
		});
	});

	it("bounds the last tier at the newline, excluding trailing paragraphs (storms-fury shape)", () => {
		const text = "When you **_begin to roil_**, Roll +CON: **on a 10+**, hold 3 Fury; **on a 7-9**, hold 2 Fury; **on a 6-**, hold 2 Fury but also mark a consequence.\n\nYou may spend Fury 1-for-1 to manifest one of the following:";
		expect(parseMoveRoll(text).moveResults.failure.value).toBe("hold 2 Fury but also mark a consequence.");
	});

	it("stops a tier at the newline before its option bullets (siphon shape, comma-in-bold 6-)", () => {
		const text = "When you **_will the ring to consume_**, roll +CON: **on a 10+**, deal 1d10 damage (*grabby*, ignores armor); **on a 7-9**, deal 1d10 damage (ignores armor) but choose one:\n- The ring eats at your life-force\n- Mark a consequence\n\n**On a 6-**, the GM says what happens.";
		expect(parseMoveRoll(text).moveResults).toEqual(
			results("deal 1d10 damage (*grabby*, ignores armor)", "deal 1d10 damage (ignores armor) but choose one:", "the GM says what happens."),
		);
	});

	it("handles a comma inside the tier bold (suffering-unleashed shape)", () => {
		const text = "When you **_feed the effigy_**, pick one and roll +CON: **on a 10+**, your target suffers that harm fully; **on a 7-9,** your target suffers that harm but pick 1; **on a 6-**, they suffer that harm but all 3 are true:\n- half the harm";
		expect(parseMoveRoll(text).moveResults.partial.value).toBe("your target suffers that harm but pick 1");
	});

	it("ignores a tier named again as a back-reference inside a later outcome (call-up-the-deep-ones)", () => {
		const text = "When you **_send them back whence they came_**, roll +CHA: **on a 10+**, they go, now; **on a 7-9**, they go,"
			+ " but take their time and likely do some harm on their way; **on a 6-**, spend their Loyalty or mark a consequence"
			+ " and they’ll eventually go (as on a 7-9); otherwise, this batch breaks free of your control and are no longer followers.";
		expect(parseMoveRoll(text).moveResults).toEqual(results(
			"they go, now",
			"they go, but take their time and likely do some harm on their way",
			"spend their Loyalty or mark a consequence and they’ll eventually go (as on a 7-9); otherwise, this batch breaks free of your control and are no longer followers.",
		));
	});

	it("maps 'roll +nothing' to the prompt roll (the-flesh-remembers)", () => {
		const text = "When you **_search the Cloak_**, roll +nothing: **on a 10+**, you receive a vision; **on a** **7-9**, choose 1 from the list below.";
		expect(parseMoveRoll(text)).toEqual({ rollStat: "prompt", moveResults: results("you receive a vision", "choose 1 from the list below.", "") });
	});

	it("maps +INT case-insensitively", () => {
		expect(parseMoveRoll("Roll +INT: **on a 10+**, hold 3 Power.").rollStat).toBe("int");
	});

	it("leaves a passive move that merely mentions 'on a 10+' non-rollable (inescapable-pull)", () => {
		expect(parseMoveRoll("You can use Siphon at up to *near* range, and on a 10+ you can drag the victim closer.")).toEqual({ rollStat: null, moveResults: null });
	});

	it("returns nulls when there is no roll and no tiers", () => {
		expect(parseMoveRoll("You gain +1 armor while you wear the cloak.")).toEqual({ rollStat: null, moveResults: null });
	});
});

describe("resourceTracks — right-aligned ○ resource pips on a move header", () => {
	// Marker / text line factories with real geometry (the load pipeline injects each ○/□ as its own
	// far-right `marker` line; the body/header are ACaslon text lines).
	const mk  = (glyph, x, y) => ({ text: glyph, font: "marker", bbox: [x, y, x + 6, y + 8], spans: [{ font: "marker", size: 7, text: glyph }] });
	const txt = (text, x, y, x1 = 750) => ({ text, font: "ACaslonPro-Bold", bbox: [x, y, x1, y + 8], spans: [{ font: "ACaslonPro-Bold", size: 9, text }] });

	it("reads a single ○ short of the right edge as a max-1 track with a fill-in blank (Battery)", () => {
		expect(resourceTracks([
			mk("□", 433, 116), txt("  BATTERY ", 438, 116, 486),
			txt("When you gather elemental power about the Azure Hand, you can store it", 432, 126, 750),
			mk("○", 662, 122),
		])).toEqual([{ slug: "battery", max: 1, hasBlank: true }]);
	});

	it("reads a ○○○ run reaching the right edge as a max-3 pool with no blank (Mindwalking)", () => {
		expect(resourceTracks([
			mk("□", 433, 117), txt("  MINDWALKING ", 438, 117, 512),
			txt("When you use the Ice Sphere as a psychic anchor, roll +INT: hold 3 Power", 432, 127, 748),
			mk("○", 733, 123), mk("○", 740, 123), mk("○", 746, 123),
		])).toEqual([{ slug: "mindwalking", max: 3, hasBlank: false }]);
	});

	it("ignores a trailing □ mark box — only ○ pips count toward max (Storm's Fury)", () => {
		expect(resourceTracks([
			mk("□", 433, 116), txt("  STORM’S FURY ", 438, 116, 508),
			txt("your markings crackle with electricity and the air thrums with pressure", 432, 126, 745),
			mk("○", 733, 122), mk("○", 740, 122), mk("○", 746, 122), mk("□", 756, 119),
		])).toEqual([{ slug: "storms-fury", max: 3, hasBlank: false }]);
	});

	it("excludes a follower's (Loyalty ○○○) circles even when they land right of the pip threshold", () => {
		expect(resourceTracks([
			mk("□", 433, 116), txt("  CALL FORTH AND COMMAND", 438, 116, 560),
			txt("their ghosts manifest before you. Treat them as followers.", 432, 126, 740),
			txt("Cost proof of honor, nobility (Loyalty", 616, 150, 700),
			mk("○", 700, 150), mk("○", 707, 150), mk("○", 714, 150),
		])).toEqual([]);
	});

	it("returns nothing when a ○ run has no move header above it", () => {
		expect(resourceTracks([mk("○", 662, 122)])).toEqual([]);
	});

	it("returns nothing for a page with no right-aligned pips", () => {
		expect(resourceTracks([
			mk("□", 433, 116), txt("  INDOMITABLE", 438, 116, 507),
			txt("When you wear the Scales and stand fast, add 3 to the result.", 432, 126, 528),
		])).toEqual([]);
	});
});

describe("parseFront — major unlock (Marks track + trigger + trailing trim)", () => {
	const front = parseFront([
		_heading("Azure Hand"),
		_para("◇ , close, magical"),
		_para("A thick staff of gray metal."),
		_rule(),
		_para("When you **_bear the Azure Hand_**, you sense energy."),
		_list(["l l l l"]),
		_para("When you make the last mark, you unlock the mysteries."),
	], { name: "Azure Hand", slug: "azure-hand" });

	it("keeps the standalone Marks run as one track entry with its true max", () => {
		const marks = front.choices[0].list.find((e) => e.slug === "marks");
		expect(marks.track).toEqual({ max: 4 });
		expect(marks.content.text).toBe("Marks");
	});
	it("folds the description into a leading content entry, keeps the trigger, drops the trailing unlock line", () => {
		const list = front.choices[0].list;
		expect(list.at(-1).slug).toBe("marks");                  // trailing 'last mark … unlock' dropped
		expect(list[0].content.text).toContain("thick staff");   // description is the first entry now
		expect(list[1].content.text).toContain("bear the Azure Hand");
	});
	it("counts inline ◇ pips on the item line so a 2-pip item weighs 2", () => {
		const f = parseFront([
			_heading("Rune-laden Scales"),
			_list(["◇ ◇ , 2 armor, *magical*"]),
			_para("An ancient vest of bluish steel."),
		], { name: "Rune-laden Scales", slug: "rune-laden-scales" });
		expect(f.item).toMatchObject({ name: "Rune-laden Scales", weight: 2, tags: "magical", note: "2 armor" });
	});
	it("folds a trigger's option bullets into that trigger entry (not separate rows)", () => {
		const f = parseFront([
			_heading("Azure Hand"),
			_para("When you **_brandish the Hand_**, choose 1:"),
			_list(["ä Direct the energy"], ["ä Discharge the energy"]),
			_para("On a 6-, mark 1:"),
			_list(["l l l l"]),
		], { name: "Azure Hand", slug: "azure-hand" });
		expect(f.choices[0].list).toHaveLength(2); // the brandish trigger (+bullets+6-) and the Marks track
		expect(f.choices[0].list[0].content.text).toBe("When you **_brandish the Hand_**, choose 1:\n- Direct the energy\n- Discharge the energy\n\nOn a 6-, mark 1:");
		expect(f.choices[0].list[1].track).toEqual({ max: 4 });
	});
});

describe("parseFront — outfit item vs. disguise tags (the ◇ gate)", () => {
	// The book italicizes tags, so a realistic disguise line mixes a ◇ marker span, a plain comma, and an
	// italic tag run (parseItemLine keys off the italic runs). `tags: true` marks the layout-tagged para.
	const _span = (font, text) => ({ font, size: 9, text });
	const _mline = (text, spans) => ({ text, bbox: [0, 0, 0, 0], spans });
	const _tags = (t) => ({ ..._para(t), tags: true });
	const _italicTags = (text, t) => ({ type: "para", tags: true, lines: [_mline(text, [_span("ACaslonPro-Italic", t)])] });

	it("builds front.item when the disguise line leads with a ◇ load pip", () => {
		const f = parseFront([
			_heading("A cracked flute"),
			{ type: "para", lines: [_mline("◇ , crude, magical", [_span("marker", "◇"), _span("ACaslonPro-Regular", " , "), _span("ACaslonPro-Italic", "crude, magical")])] },
			_para("A long, thick flute carved of redwood."),
		], { name: "A cracked flute", slug: "cracked-flute" });
		expect(f.item).toMatchObject({ name: "A cracked flute", weight: 1, tags: "crude, magical" });
		expect(f.tags).toBeNull();
	});

	it("stores front.tags (no item) when the disguise line has no ◇ — it's just the arcanum's tags", () => {
		const f = parseFront([
			_heading("A... key?"),
			_tags("magical, terrifying"),
			_para("Secreted away in some Makers' trove is a gleaming white thing."),
		], { name: "A... key?", slug: "the-key" });
		expect(f.item).toBeNull();
		expect(f.tags).toBe("magical, terrifying");
		expect(f.choices[0].list[0].content.text).toContain("Makers'");   // description → leading content entry
	});

	it("counts a ◇ on its own line (pips-only block) so an item whose tags follow still weighs in", () => {
		const f = parseFront([
			_heading("A cloak, richly embroidered"),
			{ type: "para", lines: [_mline("◇", [_span("marker", "◇")])] },
			_italicTags("magical, warm", "magical, warm"),
			_para("Made of heavy wool."),
		], { name: "A cloak, richly embroidered", slug: "cloak-richly-embroidered" });
		expect(f.item).toMatchObject({ name: "A cloak, richly embroidered", weight: 1, tags: "magical, warm" });
		expect(f.tags).toBeNull();
	});

	it("leaves both item and tags null for a pure-narrative front (no tag line at all)", () => {
		const f = parseFront([
			_heading("A path in the woods"),
			_para("Deep in the Great Wood sits a stone, carved with crude pictograms."),
		], { name: "A path in the woods", slug: "path-in-the-woods" });
		expect(f.item).toBeNull();
		expect(f.tags).toBeNull();
		expect(f.choices[0].list[0].content.text).toContain("Great Wood");   // description → leading content entry
	});
});

describe("parseFront — the front-follower split is major-only", () => {
	// A stray heading before the card's own title (the appendix running header, which used to leak into
	// the top-left card of every grid page) makes a minor front look exactly like the Ring of Daagon's
	// front-resident follower: "second heading + tags para". Splitting it swallowed the entire front.
	const blocks = () => [
		_heading("appendix c : minor arcana"),
		_heading("A gold ring"),
		{ ..._para("magical"), tags: true },
		_para("This simple, golden band catches the light and shines, even in darkness."),
	];

	it("keeps a minor front intact instead of reading it as a follower stat block", () => {
		const f = parseFront(blocks(), { name: "A gold ring", slug: "gold-ring" });
		expect(f._frontFollower).toBeUndefined();
		expect(f.choices[0].list[0].content.text).toContain("golden band");
	});

	it("still splits the follower out of a major front", () => {
		const f = parseFront(blocks(), { name: "A gold ring", slug: "gold-ring", major: true });
		expect(f._frontFollower.lines[0].text).toBe("A gold ring");
		expect(f.choices ?? []).toHaveLength(0);
	});
});

describe("followerChoiceEntry", () => {
	it("builds a checkbox entry that grants the follower inline (and on the tab)", () => {
		expect(followerChoiceEntry("tulpa")).toEqual({
			type: "entry", slug: "tulpa", content: { title: null, text: "" },
			track: { max: 1 }, grants: [{ type: "follower", slug: "tulpa", locations: ["inline", "tab"] }],
		});
	});

	it("a card-resident follower is granted inline but off the tab, with no checkbox when owned", () => {
		expect(followerChoiceEntry("the-ring", { hideFromFollowersTab: true, owned: true })).toEqual({
			type: "entry", slug: "the-ring", content: { title: null, text: "" },
			grants: [{ type: "follower", slug: "the-ring", locations: ["inline"] }],
		});
	});
});

describe("followerChoices", () => {
	it("wraps an arcanum's follower(s) in a back choice group (major-style)", () => {
		expect(followerChoices("cracked-flute", ["andalau-of-the-flute"])).toEqual({
			slug: "cracked-flute",
			list: [followerChoiceEntry("andalau-of-the-flute")],
		});
	});
	it("returns null when the arcanum has no followers", () => {
		expect(followerChoices("beaded-satchel", [])).toBeNull();
		expect(followerChoices("beaded-satchel", undefined)).toBeNull();
	});
});

describe("parseResourceLine", () => {
	it("reads a titled pool with a colon (Label:  ○ ○ ○)", () => {
		expect(parseResourceLine("Authority:  ○ ○ ○")).toEqual({ max: 3, title: "Authority", labels: [] });
	});
	it("reads a titled pool without a colon (Label  ○ ○ …)", () => {
		expect(parseResourceLine("Ire  ○ ○ ○ ○ ○ ○ ○ ○ ○")).toEqual({ max: 9, title: "Ire", labels: [] });
	});
	it("reads a bare state list into labels (no title)", () => {
		expect(parseResourceLine("○  youthful,   ○  mature,    ○  elderly")).toEqual({ max: 3, title: null, labels: ["youthful", "mature", "elderly"] });
	});
	it("reads a state list with distributed pips (spanText has already dropped box dingbats upstream)", () => {
		expect(parseResourceLine("fresh,   ○ ○  fading,    ○  bare")).toEqual({ max: 3, title: null, labels: ["fresh", "fading", "bare"] });
	});
	it("rejects a lone consequence checkbox / a ○ embedded in prose", () => {
		expect(parseResourceLine("○   Part of your look changes, to be more like Aals Sannan.")).toBeNull();
	});
	it("returns null when there are no pips", () => {
		expect(parseResourceLine("just some flavour text")).toBeNull();
	});
});

describe("parseResourceLine — titled state track (both title + labels)", () => {
	it("keeps dice labels (digits) and a title together", () => {
		expect(parseResourceLine("Blaze:  nil,  ○ ○  1d4,  ○  1d6,  ○  1d8,  ○  1d10"))
			.toEqual({ max: 5, title: "Blaze", labels: ["nil", "1d4", "1d6", "1d8", "1d10"] });
	});
});

describe("attachItemResource", () => {
	// A stat line's spans: a ZapfDingbats box glyph ("4") must be dropped, ○ pips + dice digits kept.
	const span = (text, font = "ACaslonPro-Regular") => ({ font, size: 8, text });
	const line = (spans) => ({ text: spans.map((s) => s.text).join(""), bbox: [0, 0, 0, 0], spans });

	it("splits a trailing 'hours:  ○ ○ …' pool onto item.resource and clears it from the note", () => {
		const item = { name: "Moonstone", tags: "beautiful, magical", note: "hours:", weight: 1 };
		const l = line([span("◇", "marker"), span(" , beautiful, magical, "), span("hours:  "), span("○ ○ ○ ○ ○", "marker")]);
		attachItemResource(item, [l]);
		expect(item.resource).toEqual({ max: 5, title: "hours", labels: [] });
		expect(item.note).toBeNull();
	});
	it("prefers an Uppercase title (Blaze, not 'piercing Blaze'), drops the box dingbat, keeps dice labels", () => {
		const item = { name: "Flaming Sword", tags: "close, beautiful", note: "+1 damage, 1 piercing Blaze: nil, 1d4, 1d6, 1d8, 1d10" };
		const l = line([span("◇", "marker"), span(" , close, beautiful, +1 damage, 1 piercing Blaze: "), span("4", "ZapfDingbats"),
			span("nil,  "), span("○ ○", "marker"), span("  1d4,  "), span("○", "marker"), span("  1d6,  "),
			span("○", "marker"), span("  1d8,  "), span("○", "marker"), span("  1d10")]);
		attachItemResource(item, [l]);
		expect(item.resource).toEqual({ max: 5, title: "Blaze", labels: ["nil", "1d4", "1d6", "1d8", "1d10"] });
		expect(item.note).toBe("+1 damage, 1 piercing");
	});
});

describe("parseNameFirstItem", () => {
	it("parses '<name> ( ○ … <label>, Value N )' into an outfit item, counting a pip stranded past the ')'", () => {
		// Extraction can push one ○ past the closing paren; the uses pool is every pip on the line (here 3 + 1).
		expect(parseNameFirstItem("pouch of powdered cinnabar   ( ○ ○ ○  uses, Value 2) ○")).toEqual({
			name: "pouch of powdered cinnabar", weight: 1, tags: null, note: "Value 2", inventoryColumn: "regular",
			resource: { max: 4, title: "uses", labels: [] },
		});
	});
	it("returns null for a line with no parenthetical Value pool", () => {
		expect(parseNameFirstItem("A few feet long, laden with flowers.")).toBeNull();
	});
});

describe("parseBack — back resource track & back item", () => {
	it("routes a titled pool to back.resource on an item-less back (and clears it from the description)", () => {
		const b = parseBack([_heading("Sigil of Authority"), _para("Authority:  ○ ○ ○"), _para("When you Persuade your follower, you have advantage.")], { slug: "x", major: false });
		expect(b.resource).toEqual({ max: 3, title: "Authority", labels: [] });
		expect(b.item).toBeNull();
		expect(b.description).toContain("Persuade");
		expect(b.description).not.toContain("○");
	});
	it("attaches the state track to the back item when the back is an outfit item", () => {
		const b = parseBack([_heading("The Silver Branch"), _list(["◇  , magical, beautiful"], ["fresh,  ○ ○  fading,  ○  bare"]), _para("A few feet long, laden with flowers.")], { slug: "x", major: false });
		expect(b.item.name).toBe("The Silver Branch");
		expect(b.item.resource).toEqual({ max: 3, title: null, labels: ["fresh", "fading", "bare"] });
		expect(b.resource).toBeNull(); // an item-bearing back owns its track on the item, not back.resource
	});
	it("routes an item-less state list to back.resource", () => {
		const b = parseBack([_heading("Bittersweet Elixir"), _list(["○  youthful,  ○  mature,  ○  elderly"]), _para("When you fill the basin, it becomes a draught.")], { slug: "x", major: false });
		expect(b.resource).toEqual({ max: 3, title: null, labels: ["youthful", "mature", "elderly"] });
		expect(b.item).toBeNull();
	});
});

describe("isArcanaFollower", () => {
	const block = (icon, name = "Tulpa") => ({ icon, lines: [{ text: name, font: "Avara-Bold", size: 9, spans: [], bbox: [0, 0, 0, 0] }] });
	it("accepts a real follower stat block (small creature marker icon)", () => {
		expect(isArcanaFollower(block({ w: 18 }))).toBe(true);
	});
	it("rejects the card-border decoration (~42px) and an icon-less fragment", () => {
		expect(isArcanaFollower(block({ w: 42 }))).toBe(false);
		expect(isArcanaFollower(block(null))).toBe(false);
	});
	it("rejects a numeric/heading name even with a small icon", () => {
		expect(isArcanaFollower(block({ w: 18 }, "13"))).toBe(false);
	});
});

describe("parseItemLine", () => {
	it("splits italic *tags* from a plain note (book italicizes tags, leaves stats plain)", () => {
		expect(parseItemLine(", *close*, +1 damage, 1 piercing, *messy*, *magical*", { name: "Blood-quenched Sword", pips: 1 }))
			.toEqual({ name: "Blood-quenched Sword", weight: 1, tags: "close, messy, magical", note: "+1 damage, 1 piercing", inventoryColumn: "regular" });
	});
	it("collects a leading-comma italic run and multi-tag runs into tags (null note when all italic)", () => {
		expect(parseItemLine("*, close*, *magical*, *awkward*", { name: "Azure Hand", pips: 1 }))
			.toEqual({ name: "Azure Hand", weight: 1, tags: "close, magical, awkward", note: null, inventoryColumn: "regular" });
		expect(parseItemLine(", *beautiful, fragile*", { name: "Scroll", pips: 1 }))
			.toMatchObject({ tags: "beautiful, fragile", note: null });
	});
	it("uses ◇ pip count for weight and strips leading ◇", () => {
		expect(parseItemLine("◇◇ , *awkward*", { name: "Mindgem", pips: 2 }).weight).toBe(2);
	});
	it("returns null when there is no tags text, no note, and no pips", () => {
		expect(parseItemLine("", { name: "X", pips: 0 })).toBeNull();
	});
});

describe("unlockSlug", () => {
	it("is a deterministic kebab of the option's salient words", () => {
		const s = unlockSlug("… imbibe a prodigious, dangerous quantity of alcohol.");
		expect(s).toMatch(/^[a-z0-9-]+$/);
		expect(unlockSlug("… imbibe a prodigious, dangerous quantity of alcohol.")).toBe(s); // stable
	});
});

describe("parseBack — minor spell (description + table → @DrawTable, no moves)", () => {
	// Table-block factory matching layout.js's shape (roll cell + result cells).
	const _row = (roll, ...rest) => ({ roll: _line(roll), rest: rest.map(_line) });
	const _table = (...rows) => ({ type: "table", header: null, rows });
	const foodTable = _table(
		_row("1", "Actively unpleasant, needs cooking"),
		_row("2", "Bland but tolerable, needs cooking"),
		_row("3", "Delicious, needs cooking"),
		_row("4", "Actively unpleasant, ready to eat"),
		_row("5", "Bland but tolerable, ready to eat"),
		_row("6", "Delicious, ready to eat"),
	);

	const back = parseBack([
		_heading("Satchel of Plenty"),
		_para("When you feed the satchel, it provides 1 use of provisions each day."),
		_para("**1d6** today's food is..."),
		foodTable,
		_para("When you draw more than 1 use, it provides up to 10 uses."),
	], { slug: "beaded-satchel", name: "A beaded satchel", major: false });

	it("takes the first heading as the spell title and never emits moves/consequences", () => {
		expect(back.title).toBe("Satchel of Plenty");
		expect(back.moves).toEqual([]);
		expect(back.consequences).toBeNull();
	});
	it("promotes a clean 1..N table to a RollTable spec with all its rows", () => {
		expect(back.rollTables).toHaveLength(1);
		expect(back.rollTables[0].formula).toBe("1d6");
		expect(back.rollTables[0].results).toHaveLength(6);
		expect(back.rollTables[0].results[0].range).toEqual([1, 1]);
	});
	it("inlines a player-rollable @DrawTableInline block at the table's place in the description", () => {
		expect(back.description).toContain(`@DrawTableInline[${back.rollTables[0].uuid}]{1d6}`);
		// order preserved: caption before the link, trailing prose after
		expect(back.description.indexOf("today's food")).toBeLessThan(back.description.indexOf("@DrawTableInline"));
		expect(back.description.indexOf("@DrawTableInline")).toBeLessThan(back.description.indexOf("draw more than 1"));
	});
	it("drops a footer-strip false-positive (single-row) table instead of promoting it", () => {
		const b = parseBack([
			_heading("Truth Seeds"),
			_para("When you eat a truth seed, you must speak truth."),
			_table(_row("1", "back Truth Seeds")),
		], { slug: "a-folktale", name: "A folktale", major: false });
		expect(b.rollTables).toBeUndefined();
		expect(b.description).not.toContain("@DrawTable");
	});
});

// The 9 minor cards that print a follower lay it out the same way: spell text, a rule, the follower's
// name heading, its stat block, then an "HP / Starts at N" tracker. Only the stat block itself is a
// `statblock` block — the tracker, the tags line and the write-in picks come through as loose
// paras/lists, so the cutoff has to be the heading, not the stat block.
const cloakBack = () => [
	_heading("Flying Cloak"),
	_para("When you wear the cloak and speak the word of", "command, the storm-spirit in the cloak springs to",
		"life and obeys you as a follower. It never wants to", "land; you must spend its Loyalty or Persuade it."),
	_rule(),
	_heading("  The Spirit in the Cloak"),
	_statblock("     Spirit, magical, proud, mute", "HP 13; Armor 1 (amorphous)", "Instinct to “not hear” your commands"),
	_para("HP"),
	_para("Starts at 13"),
];

describe("followerSectionIndex (where a minor card's follower stat block starts)", () => {
	it("finds the follower's name heading — the card's second heading", () => {
		expect(followerSectionIndex(cloakBack())).toBe(3);
	});
	it("keeps spell content that sits between the spell text and the follower heading (the rusty cauldron)", () => {
		const blocks = [
			_heading("Unliving Chimera"),
			_para("When you boil the bones of beasts in the cauldron, mark up to 3 debilities."),
			_para("For each debility you marked, pick 1:"),
			_list(["It is stable (else, it falls apart in a day)"], ["It is not clumsy"]),
			_rule(),
			_heading("  Unliving chimera"),
			_statblock("     Undead, construct, terrifying, clumsy", "HP 3; Armor 4 (0 vs. bronze)"),
		];
		expect(followerSectionIndex(blocks)).toBe(5);
	});
	it("is -1 for a card with no follower", () => {
		expect(followerSectionIndex([_heading("Satchel of Plenty"), _para("It provides 1 use of provisions each day.")])).toBe(-1);
	});
	it("is -1 for a second heading with no stat block under it (a heading is not enough on its own)", () => {
		expect(followerSectionIndex([_heading("Sigil of Authority"), _para("When you Persuade, you have advantage."),
			_heading("Moves"), _list(["□ CALL UP THE DEEP ONES"])])).toBe(-1);
	});
	it("is -1 when there is no heading at all, and for empty/missing blocks", () => {
		expect(followerSectionIndex([_para("orphan text"), _statblock("HP 13")])).toBe(-1);
		expect(followerSectionIndex([])).toBe(-1);
		expect(followerSectionIndex(undefined)).toBe(-1);
	});
});

describe("parseBack — minor spell whose card prints a follower (the cloak)", () => {
	const back = parseBack(cloakBack(), { slug: "cloak-richly-embroidered", name: "Flying Cloak", major: false });

	it("keeps the spell text and stops at the follower heading", () => {
		expect(back.title).toBe("Flying Cloak");
		expect(back.description).toBe("When you wear the cloak and speak the word of command, the storm-spirit"
			+ " in the cloak springs to life and obeys you as a follower. It never wants to land; you must spend"
			+ " its Loyalty or Persuade it.");
	});
	it("drops the stat block's 'HP / Starts at N' tracker (the follower item owns its HP)", () => {
		expect(back.description).not.toContain("HP");
		expect(back.description).not.toContain("Starts at");
	});
	it("drops the follower's name and tags rather than reading them as the back's item", () => {
		expect(back.description).not.toContain("The Spirit in the Cloak");
		expect(back.item).toBeNull();
		expect(back.resource).toBeNull();
	});
	it("drops a group follower's tags line and per-member HP note (the mantle wraiths)", () => {
		const b = parseBack([
			_heading("Mantle Wraiths"),
			_para("When you let slip the wraiths tethered to the mantle, treat them as followers."),
			_rule(),
			_heading(" Mantle wraiths"),
			_para("    Group (3), spirit, undead, terrifying, vicious"),
			_statblock("HP 13; Armor 1 (amorphous)", "Instinct to run rampant"),
			{ type: "image" },
			_para("Starts at 13 each"),
		], { slug: "tattered-mantle", name: "Mantle Wraiths", major: false });
		expect(b.description).toBe("When you let slip the wraiths tethered to the mantle, treat them as followers.");
		expect(b.item).toBeNull();
	});
	it("drops a write-in stat block's tag line and pick list (the tulpa)", () => {
		const b = parseBack([
			_heading("Little Friend"),
			_para("You have created a tulpa, which you treat as a follower."),
			_rule(),
			_heading("  Tulpa"),
			_para("     Spirit, construct, tiny, naive,  eager  □"),
			_list(["□  fierce   kind   sly   timid   willful  □ □ □ □"]),
			_statblock("HP 8; Armor 0", "Damage 1d4 (if that)"),
			_para("HP"),
			_para("Starts at 8"),
		], { slug: "beautiful-scroll", name: "Little Friend", major: false });
		expect(b.description).toBe("You have created a tulpa, which you treat as a follower.");
	});
	it("keeps spell content that precedes the follower heading (the rusty cauldron's debility picks)", () => {
		const b = parseBack([
			_heading("Unliving Chimera"),
			_para("An unliving chimera rises from the cauldron."),
			_para("For each debility you marked, pick 1:"),
			_list(["It is stable (else, it falls apart in a day)"], ["It is not clumsy"]),
			_rule(),
			_heading("  Unliving chimera"),
			_statblock("     Undead, construct, terrifying, clumsy", "HP 3; Armor 4 (0 vs. bronze)"),
		], { slug: "rusty-cauldron", name: "Unliving Chimera", major: false });
		expect(b.description).toBe("An unliving chimera rises from the cauldron.\n\nFor each debility you marked, pick 1:"
			+ "\n\n- It is stable (else, it falls apart in a day)\n- It is not clumsy");
	});
});

describe("isFollowerGroup", () => {
	it("is true for a group whose row grants a follower", () => {
		expect(isFollowerGroup(followerChoices("cloak-richly-embroidered", ["spirit-in-the-cloak"]))).toBe(true);
	});
	it("is false for a spell-picks group, an empty group, and nothing", () => {
		expect(isFollowerGroup({ slug: "spells", list: [{ type: "entry", content: { title: null, text: "Pick 1" } }] })).toBe(false);
		expect(isFollowerGroup({ slug: "spells", list: [] })).toBe(false);
		expect(isFollowerGroup(null)).toBe(false);
	});
	it("is false for a group granting something other than a follower (a move)", () => {
		expect(isFollowerGroup({ slug: "moves", list: [{ type: "entry", grants: [{ type: "move", slug: "x" }] }] })).toBe(false);
	});
});

describe("foldBackChoices (back sections → one ordered choices array)", () => {
	const followerGroup = followerChoices("cloak-richly-embroidered", ["spirit-in-the-cloak"]);

	it("emits the follower group it is given — a minor back's whole reason to have choices", () => {
		const out = foldBackChoices({ title: "Flying Cloak", description: "When you wear the cloak…" }, followerGroup);
		expect(out.choices.map((g) => g.slug)).toEqual(["intro", "cloak-richly-embroidered"]);
		expect(out.choices[1]).toBe(followerGroup);
		expect(out.choices[1].list[0].grants).toEqual([{ type: "follower", slug: "spirit-in-the-cloak", locations: ["inline", "tab"] }]);
	});
	it("emits it with no description too (no intro group to lead with)", () => {
		expect(foldBackChoices({ title: "Flying Cloak" }, followerGroup).choices.map((g) => g.slug)).toEqual(["cloak-richly-embroidered"]);
	});
	it("never mistakes a follower group left on back.choices for the spell picks (it must come in as the argument)", () => {
		const out = foldBackChoices({ title: "Flying Cloak", choices: followerGroup });
		expect(out.choices).toEqual([]);
	});
	it("orders the sections intro → spells → moves → followers → consequences", () => {
		const spells = { slug: "spells", title: "Spells", list: [{ type: "entry", content: { title: null, text: "Pick 1" } }] };
		const out = foldBackChoices({
			title: "Mysteries", description: "The codex hungers.", choices: spells,
			moveSlugs: ["cast-a-codex-spell"],
			consequences: { slug: "consequences", list: [{ type: "entry", content: { title: null, text: "Your skin crawls." } }] },
		}, followerGroup);
		expect(out.choices.map((g) => g.slug)).toEqual(["intro", "spells", "moves", "cloak-richly-embroidered", "consequences"]);
	});
	it("turns each move slug into an inline move grant with an ornamental checkbox", () => {
		const [moves] = foldBackChoices({ moveSlugs: ["call-up-the-deep-ones"] }).choices;
		expect(moves).toEqual({ slug: "moves", title: "Moves", list: [{
			type: "entry", slug: "call-up-the-deep-ones", content: { title: null, text: null }, track: { max: 1 },
			grants: [{ type: "move", slug: "call-up-the-deep-ones", locations: ["inline"] }] }] });
	});
	it("titles an untitled consequences group", () => {
		const back = foldBackChoices({ consequences: { slug: "consequences", list: [] } });
		expect(back.choices[0].title).toBe("Consequences");
		const kept = foldBackChoices({ consequences: { slug: "consequences", title: "The Price", list: [] } });
		expect(kept.choices[0].title).toBe("The Price");
	});
	it("drops the folded-in sibling fields and keeps every other field", () => {
		const out = foldBackChoices({ title: "Flying Cloak", item: { name: "a cloak" }, resource: { max: 3 },
			description: "text", moves: [], moveSlugs: [], consequences: null, unlockAt: 2 }, null);
		expect(out).toEqual({ title: "Flying Cloak", item: { name: "a cloak" }, resource: { max: 3 },
			choices: [{ slug: "intro", list: [{ type: "entry", content: { title: null, text: "text" } }] }] });
	});
	it("yields an empty choices array for a back with no sections at all", () => {
		expect(foldBackChoices({ title: "Darkwalker Cloak" }).choices).toEqual([]);
	});
});

describe("splitAssignRows (an 'assign one die to each' para → one list item per fill-in row)", () => {
	it("splits a flattened multi-row line into markdown list items, one per blank-led row", () => {
		const t = "____ **Onset: 1** = next day. ____ **Intensity: 1** = dangerous. ____ **Reach: 1** = a mile.";
		expect(splitAssignRows(t)).toBe(
			"- ____ **Onset: 1** = next day.\n- ____ **Intensity: 1** = dangerous.\n- ____ **Reach: 1** = a mile.");
	});
	it("leaves a mid-sentence blank inline (a geas), needing ≥2 blank-then-bold rows to fire", () => {
		const geas = "You must never again ____. Henceforth, you must always seek to ____ when you can.";
		expect(splitAssignRows(geas)).toBe(geas);
		expect(splitAssignRows("Assign one d4 to each ____ **Onset** only.")).toBe("Assign one d4 to each ____ **Onset** only.");
	});
	it("passes empty/null through untouched", () => {
		expect(splitAssignRows("")).toBe("");
		expect(splitAssignRows(null)).toBeNull();
	});
});

describe("numberBlanks (stable @Blank[n] tokens across an arcanum's text, front→back reading order)", () => {
	// Both sides are one `choices` array of groups; blanks are numbered across every group's entry text.
	const sys = () => ({
		front: { choices: [{ slug: "f", list: [
			{ content: { text: "fill ____ here" } },
			{ content: { text: "Who benefits from __?" } },
		] }] },
		back: { choices: [{ slug: "consequences", list: [
			{ content: { text: "- ____ **Onset**\n- ____ **Intensity**" } },
			{ content: { text: "roll ____ dice" } },
		] }] },
	});
	it("numbers every blank in order and returns the count", () => {
		const system = sys();
		expect(numberBlanks(system)).toBe(5);
		expect(system.front.choices[0].list[0].content.text).toBe("fill @Blank[0] here");
		expect(system.front.choices[0].list[1].content.text).toBe("Who benefits from @Blank[1]?");
		expect(system.back.choices[0].list[0].content.text).toBe("- @Blank[2] **Onset**\n- @Blank[3] **Intensity**");
		expect(system.back.choices[0].list[1].content.text).toBe("roll @Blank[4] dice");
	});
	it("is idempotent — a tokenised text has no bare underscore runs left to number", () => {
		const system = sys();
		numberBlanks(system);
		const before = JSON.stringify(system);
		expect(numberBlanks(system)).toBe(0);
		expect(JSON.stringify(system)).toBe(before);
	});
	it("tolerates a missing system / empty sides", () => {
		expect(numberBlanks(null)).toBe(0);
		expect(numberBlanks({ front: null, back: null })).toBe(0);
	});
});

describe("parseBack — an assign-one-die para becomes a fill-in list (Horn of Storms)", () => {
	const _span = (font, text) => ({ font, size: 9, text });
	const _mline = (text, spans) => ({ text, bbox: [0, 0, 0, 0], spans });
	// The extractor flattens the four assign rows onto one line, with each label bolded.
	const assignPara = { type: "para", lines: [_mline(
		"____ Onset: 1 = next day. ____ Intensity: 1 = dangerous.",
		[
			_span("ACaslonPro-Regular", "____ "),
			_span("ACaslonPro-Bold", "Onset: 1"),
			_span("ACaslonPro-Regular", " = next day. ____ "),
			_span("ACaslonPro-Bold", "Intensity: 1"),
			_span("ACaslonPro-Regular", " = dangerous."),
		])] };
	const back = parseBack([_heading("Horn of Storms"), assignPara], { slug: "horn", name: "Horn", major: false });

	it("renders each blank-led row as its own list item (blanks still literal — numbered at build)", () => {
		expect(back.description).toBe("- ____ **Onset: 1** = next day.\n- ____ **Intensity: 1** = dangerous.");
	});
});

describe("matchFollowerIcons (marker icon beside a major follower's name heading)", () => {
	// Real geometry from the book: an 18px marker at x≈432 with the name heading starting at x≈450 on the
	// same baseline (the Mighty Servant on the Mindgem back p275; Astor/Halix on the Blackwood back p283).
	const line = (text, x, y) => ({ text, bbox: [x, y, x + 90, y + 12] });
	const marker = (x, y, file) => ({ file, x, y, w: 18, h: 18 });

	it("pairs a marker with the name heading just to its right on the same baseline", () => {
		const lines = [line("Astor", 450, 300), line("Halix", 450, 402)];
		const images = [marker(432, 300, "/tmp/astor.png"), marker(432, 402, "/tmp/halix.png")];
		expect(matchFollowerIcons(lines, images, ["Astor", "Halix"])).toEqual([
			{ name: "Astor", iconFile: "/tmp/astor.png" },
			{ name: "Halix", iconFile: "/tmp/halix.png" },
		]);
	});

	it("matches an ALL-CAPS heading to its title-case roster name (The Mighty Servant)", () => {
		const lines = [line("THE MIGHTY SERVANT", 461, 96)];
		const images = [marker(432, 96, "/tmp/servant.png")];
		expect(matchFollowerIcons(lines, images, ["The Mighty Servant"])).toEqual([
			{ name: "The Mighty Servant", iconFile: "/tmp/servant.png" },
		]);
	});

	it("ignores a marker that isn't adjacent (wrong baseline or too far left of the name)", () => {
		const lines = [line("Astor", 450, 300)];
		expect(matchFollowerIcons(lines, [marker(432, 340, "/tmp/x.png")], ["Astor"])).toEqual([]); // y-band off
		expect(matchFollowerIcons(lines, [marker(63, 300, "/tmp/x.png")], ["Astor"])).toEqual([]);  // far-left card art
	});

	it("ignores a large (non-marker) image and a name not in the target set", () => {
		const lines = [line("Astor", 450, 300), line("Not A Follower", 450, 402)];
		const big = { file: "/tmp/art.png", x: 432, y: 300, w: 270, h: 162 };
		expect(matchFollowerIcons(lines, [big], ["Astor"])).toEqual([]);                         // w ≥ 25 → not a marker
		expect(matchFollowerIcons(lines, [marker(432, 402, "/tmp/m.png")], ["Astor"])).toEqual([]); // heading not targeted
	});
});

describe("statblockMoveTail (a move trigger swallowed by an adjacent stat block)", () => {
	// The Ring of Daagon's back prints the Servant of Daagon stat block + its 5d4 builder BETWEEN the
	// CALL UP THE DEEP ONES move and that move's closing "send them back" trigger, so the layout parser
	// folds the trigger into the stat block. Spans/fonts are the book's real ones (p.562): a trigger line
	// mixes runs, and `line.font` reports the dominant one (BoldItalic) even though it opens Regular.
	const plain = (font, text) => ({ text, font, bbox: [432, 0, 700, 12], spans: [{ font, size: 9, text }] });
	const trigger = (...spans) => ({
		text: spans.map(([, t]) => t).join(""), font: "ACaslonPro-BoldItalic", bbox: [432, 0, 700, 12],
		spans: spans.map(([font, text]) => ({ font, size: 9, text })),
	});
	const SEND_BACK = trigger(
		["ACaslonPro-Regular", "When you "],
		["ACaslonPro-BoldItalic", "send them back whence they came"],
		["ACaslonPro-Regular", ", roll +CHA: "],
		["ACaslonPro-Bold", "on a 10+"],
		["ACaslonPro-Regular", ", they go, now; "],
		["ACaslonPro-Bold", "on a 7-9"],
		["ACaslonPro-Regular", ", they go, "],
	);
	const servantBlock = (...extra) => ({ type: "statblock", lines: [
		plain("ACaslonPro-Bold", "Instinct to devour"),
		plain("ACaslonPro-Regular", "Each time you Call Up the Deep Ones, roll five d4s and assign each to a different aspect:"),
		plain("ACaslonPro-Regular", "_____ Tags: 1 = +craven; 2 = +ravenous; 3 = +cunning; 4 = +exceptional"),
		...extra,
	] });

	it("returns the trigger and every line after it, as markdown", () => {
		const tail = statblockMoveTail(servantBlock(
			SEND_BACK,
			plain("ACaslonPro-Regular", "but take their time; on a 6-, spend their Loyalty."),
		));
		expect(tail).toBe("When you **_send them back whence they came_**, roll +CHA: **on a 10+**, they go, now;"
			+ " **on a 7-9**, they go, but take their time; on a 6-, spend their Loyalty.");
	});

	it("ignores a stat block with no trailing trigger at all", () => {
		expect(statblockMoveTail(servantBlock())).toBeNull();
		expect(statblockMoveTail(null)).toBeNull();
	});

	it("ignores a bold-italic run that isn't rollable (ordinary stat-block prose)", () => {
		expect(statblockMoveTail(servantBlock(
			trigger(["ACaslonPro-Regular", "When you "], ["ACaslonPro-BoldItalic", "look upon it"], ["ACaslonPro-Regular", ", you know it hungers."]),
		))).toBeNull();
	});
});

describe("parseBack — a stat block inside Moves gives its swallowed trigger back to the move", () => {
	const plain = (font, text) => ({ text, font, bbox: [432, 0, 700, 12], spans: [{ font, size: 9, text }] });
	const back = parseBack([
		_heading("Mysteries of the Ring of Daagon"),
		_heading("Moves"),
		_list(["□ CALL UP THE DEEP ONES", "When you stand in heavy fog, they appear."]),
		_rule(),
		_heading("Servant of Daagon"),
		{ type: "statblock", lines: [
			plain("ACaslonPro-Bold", "Instinct to devour"),
			{ text: "When you send them back whence they came, roll +CHA: on a 10+, they go, now; on a 7-9, they go,",
				font: "ACaslonPro-BoldItalic", bbox: [432, 0, 700, 12], spans: [
					{ font: "ACaslonPro-Regular", size: 9, text: "When you " },
					{ font: "ACaslonPro-BoldItalic", size: 9, text: "send them back whence they came" },
					{ font: "ACaslonPro-Regular", size: 9, text: ", roll +CHA: on a 10+, they go, now; on a 7-9, they go," },
				] },
			plain("ACaslonPro-Regular", "but take their time; on a 6-, they break free of your control."),
		] },
		_heading("Consequences"),
		_list(["□ Your skin becomes clammy."]),
	], { slug: "ring-of-daagon", name: "Ring of Daagon", major: true });

	it("re-attaches the trigger to the preceding move (the rule already flushed it)", () => {
		expect(back.moves).toHaveLength(1);
		expect(back.moves[0].text).toBe("When you stand in heavy fog, they appear."
			+ "\n\nWhen you **_send them back whence they came_**, roll +CHA: on a 10+, they go, now; on a 7-9, they go,"
			+ " but take their time; on a 6-, they break free of your control.");
	});

	it("makes the move rollable, with the tiers read off the re-attached trigger", () => {
		const { rollStat, moveResults } = parseMoveRoll(back.moves[0].text);
		expect(rollStat).toBe("cha");
		expect(moveResults.success.value).toBe("they go, now");
		expect(moveResults.partial.value).toBe("they go, but take their time");
		expect(moveResults.failure.value).toBe("they break free of your control.");
	});

	it("still drops the rest of the stat block, and the Consequences section is unaffected", () => {
		expect(back.moves[0].text).not.toContain("Instinct to devour");
		expect(back.consequences.list).toHaveLength(1);
	});
});
