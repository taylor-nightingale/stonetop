/**
 * STANDS IN FOR DATA THAT DOES NOT EXIST YET.
 *
 * Well Versed's seven topics are something a Seeker marks and keeps, the way the printed playbook has
 * a box beside each. In the packs they are only bullets in the move's description
 * (`packs/src/moves/playbook/the-seeker/well-versed.json`), so nothing records which are marked and
 * the sheet cannot draw them as marks. Potential for Greatness is the one move that already carries
 * its list as a choice group, and this is Well Versed in that shape: the bullets move out of the
 * description into `choices`, one entry per topic, each with a one-box track. Every word is the
 * book's; nothing is reworded.
 *
 * Written in the SNAPSHOT's shape (`buildChoiceGroup`'s output, as the capture serialises it), so the
 * deck reads it through the same MoveView as everything else. The real change is to the pack file,
 * after which a fresh capture carries it and this file is deleted. See NOTES.md → Mock issues.
 *
 * Maelen's marks: only the Makers and their arts, because her background says so — the Antiquarian is
 * "Well Versed in the Makers and their arts". Having taken the move once she should hold one more,
 * but which one is hers to choose and the capture does not say, so it is left unmarked rather than
 * made up.
 */

const rich = html => ({ raw: html, autoRoll: false, html });

const topic = (slug, text, marked = false) => ({
	type: "entry",
	slug,
	content: { title: rich(""), titleNote: rich(""), subtitle: rich(""), subtitleNote: rich(""), text: rich(text) },
	track: { slug, checks: [marked], requires: null },
	input: null,
	followers: null,
	moves: null,
	outfitItems: [],
	indent: false,
});

export const WELL_VERSED = {
	slug: "well-versed",
	description: rich("Mark 1 topic, in addition to the one noted in your Background. Each additional time "
		+ "you take this move, mark 2 more topics.<br><br>When you <strong><em>Know Things about one of your "
		+ "topics</em></strong>, you can ask the GM a follow-up question of your choice (even <strong>on a "
		+ "6-</strong>)."),
	choices: {
		slug: "choices",
		title: null,
		condensed: [],
		list: [
			topic("the-last-door", "The Last Door, death, and the undead"),
			topic("civilizations", "The civilizations of humanity"),
			topic("the-fae", "The Fae and their strange ways"),
			topic("the-makers", "The Makers and their arts", true),
			topic("primordial-powers", "The primordial powers"),
			topic("things-below", "The Things Below"),
			topic("wild-world", "The wild world and its spirits"),
		],
	},
};

/**
 * STANDS IN FOR DATA THAT DOES NOT EXIST YET: which part of an expedition each expedition move is for.
 *
 * `reference-moves.md` splits the ten into three, and D8 has the rail draw them that way — setting
 * out is a checklist worked once before leaving, the road is where the rest fire, and getting home is
 * the end of one. Nothing in `packs/src/moves/expedition/` says which is which, so the sheet cannot
 * group them. The real fix is a `phase` field on each of those ten pack files, which a fresh capture
 * then carries on every move; the snapshot already reads it from there (`MoveView#phase`), so when the
 * packs have it this map is deleted and nothing else changes.
 *
 * Keyed by slug, since the slug is the identity. A move this does not name is not lost: it lands after
 * the three phases, under no heading.
 */
export const EXPEDITION_PHASES = {
	"outfit": "setting-out",
	"chart-a-course": "setting-out",
	"requisition": "setting-out",
	"have-what-you-need": "on-the-road",
	"keep-company": "on-the-road",
	"recover": "on-the-road",
	"make-camp": "on-the-road",
	"forage": "on-the-road",
	"struggle-as-one": "on-the-road",
	"return-triumphant": "getting-home",
};

/**
 * STANDS IN FOR DATA THAT DOES NOT EXIST YET: which moves are made INSTEAD of Death's Door.
 *
 * Each insert gained by dying brings its own move for zero hit points. Tethered: *when you are reduced
 * to 0 HP*, mark a consequence and disperse until sunset. Undying: *when you are reduced to 0 HP*, roll
 * +CON. Dark Succor: *when you are dying or killed outright*, your master intercedes, and you roll
 * +Favor. A character holding one does not glimpse the Last Door again, so at zero hit points the rail
 * draws that move where Death's Door would be (D9).
 *
 * Nothing in `packs/src/moves/post-death/` says so. The real fix is a `replaces` field on those three
 * pack files, naming the move each is made instead of; the snapshot already reads it from there
 * (`MoveView#replaces`), so a fresh capture retires this map.
 */
export const MOVE_REPLACES = {
	"tethered": "deaths-door",
	"undying": "deaths-door",
	"dark-succor": "deaths-door",
};

/**
 * STANDS IN FOR DATA THAT DOES NOT EXIST YET: somewhere to write who a Terrible Purpose is about.
 *
 * Each of the three opens with an instruction — *Name the person or persons you refuse to let go of*,
 * *Name the person or persons who must pay*, *Name the task you refuse to leave undone* — and every
 * trigger after it is about whoever was named. The packs give each purpose a box and no blank, so the
 * name the book asks for has nowhere to go. The Thrall's master already has the shape this wants: an
 * inline input on the entry (`packs/src/inserts/thrall.json`, `your-master`).
 *
 * The real fix is an `input: { "type": "inline" }` on those three entries in each of `ghost.json`,
 * `revenant.json` and `thrall.json`. Tethered's *Choose something to which you are bound* is the same
 * gap on a move, and has no stand-in here because no capture holds a Ghost.
 */
export const TERRIBLE_PURPOSE_INPUTS = {
	group: "terrible-purpose",
	entries: ["longing", "vengeance", "duty"],
};
