import { describe, it, expect } from "vitest";
import {
	WELL_VERSED_TOPIC_SUMMARIES,
	wellVersedTopicSummary,
} from "../../../module/actors/character/dialogs/well-versed-topics.js";

// The Seeker onboarding Background step shows each "Well Versed in …" topic's
// player-safe "known by most in Stonetop" summary on hover. Guard the lookup's
// normalisation and that the Background choices all resolve to a summary.

const BACKGROUND_TOPICS = [
	"the Things Below",            // Patriot / Witch Hunter
	"the Makers and their arts",   // Antiquarian
	"the Fae",                     // Witch Hunter
	"the Last Door and what lies beyond", // Witch Hunter
];

describe("wellVersedTopicSummary", () => {
	it("returns a non-empty summary for every Background choice topic", () => {
		for (const topic of BACKGROUND_TOPICS) {
			const summary = wellVersedTopicSummary(topic);
			expect(summary, `no summary for "${topic}"`).toBeTruthy();
			expect(summary.length).toBeGreaterThan(20);
		}
	});

	it("matches case- and whitespace-insensitively", () => {
		expect(wellVersedTopicSummary("  THE FAE  ")).toBe(WELL_VERSED_TOPIC_SUMMARIES["the fae"]);
	});

	it("returns null for topics we don't summarise", () => {
		expect(wellVersedTopicSummary("the civilizations of humanity")).toBeNull();
		expect(wellVersedTopicSummary("")).toBeNull();
		expect(wellVersedTopicSummary(undefined)).toBeNull();
	});
});
