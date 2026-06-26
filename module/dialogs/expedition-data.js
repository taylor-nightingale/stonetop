// ── Expedition walkthrough: Chart-a-Course / arriving-home checklists ───────────
// The authored requirement/challenge prompts (Chart a Course, Book I p.302–303) and
// the arriving-home questions (p.338). Kept free of Foundry globals so both
// ExpeditionDialog.js — which renders them as tickable checklists — and the
// Chronicle compiler (utils/chronicle-core.js), which resolves a ticked key back to
// its text for the expedition page, can import them. Mirrors introductions-data.js;
// keep this the single source so the dialog and the recorded journal agree.
//
// Item `text` is trusted authored HTML (entities, no tags); both consumers render it
// without escaping.

// Chart a Course requirements & challenges. The GM ticks the ones they present;
// keys persist the tick state under `chart.checks.<key>`.
export const CHART_GROUPS = [
	{
		label: "Requirements",
		items: [
			{ key: "firstTravel", text: "First travel to ___, and from there to your destination" },
			{ key: "waitUntil",   text: "Wait until ___ (season, daybreak, a sign)" },
			{ key: "guide",       text: "A knowledgeable guide / accurate map / detailed directions" },
			{ key: "days",        text: "It'll take at least ___ days (and a corresponding amount of supplies)" },
			{ key: "bring",       text: "You'll need to bring ___ (warm clothes, a cart, rope&hellip;)" },
		],
	},
	{
		label: "Challenges",
		items: [
			{ key: "watchOut",  text: "Watch out for ___" },
			{ key: "perilous",  text: "The way is perilous, plagued with danger" },
			{ key: "lost",      text: "You risk getting lost" },
			{ key: "surmount",  text: "You must surmount / cross / brave ___" },
			{ key: "terrain",   text: "The terrain is treacherous; you risk injury" },
			{ key: "grueling",  text: "The way is grueling; you risk exhausting yourselves / your resources" },
			{ key: "attention", text: "You risk drawing the attention of ___" },
		],
	},
];

// Arriving home — the questions to settle before the PCs walk back in.
export const HOME_GROUP = [
	{
		label: "Before they arrive, consider",
		items: [
			{ key: "absence",       text: "How long have they been gone, and how has their absence been felt?" },
			{ key: "casualties",    text: "If they suffered casualties, who back home is most affected or upset?" },
			{ key: "townDoings",    text: "What have folks back home been up to?" },
			{ key: "requisitioned", text: "If they Requisitioned assets, how has that impacted the village?" },
			{ key: "threats",       text: "Did any threats advance toward their dooms while they were away?" },
			{ key: "triumph",       text: "Are they Returning Triumphant &mdash; or could they, with some effort?" },
			{ key: "disaster",      text: "Could their return cause panic or reveal calamity (Meet With Disaster)?" },
		],
	},
];
