import { describe, it, expect } from "vitest";
import { HpMeter, XpTrack } from "../../../../src/model/snapshot/character/VitalMeters.js";
import { ValueMax, VitalsSnapshotBuilder } from "../../../../src/model/snapshot/character/VitalsSnapshot.js";

describe("HpMeter", () => {
	it("fills to the share of maximum hit points left", () => {
		const hp = new HpMeter(new ValueMax(13, 18));
		expect([hp.value, hp.max, hp.pct]).toEqual([13, 18, 72]);
	});

	// "How bad is it" beats "how much is it" once a quarter or less is left.
	it("is low at a quarter or less", () => {
		expect(new HpMeter(new ValueMax(4, 16)).isLow).toBe(true);
		expect(new HpMeter(new ValueMax(5, 16)).isLow).toBe(false);
	});

	it("is dying at zero", () => {
		expect(new HpMeter(new ValueMax(0, 16)).isDying).toBe(true);
		expect(new HpMeter(new ValueMax(1, 16)).isDying).toBe(false);
	});

	it("fills nothing when there is no maximum yet", () => {
		expect(new HpMeter(new ValueMax(0, 0)).pct).toBe(0);
	});

	it("never fills past full when current is set above maximum", () => {
		expect(new HpMeter(new ValueMax(20, 16)).pct).toBe(100);
	});
});

describe("XpTrack", () => {
	it("reads as it always did below the threshold", () => {
		const xp = new XpTrack(new ValueMax(7, 16));
		expect([xp.value, xp.max, xp.scale, xp.pct]).toEqual([7, 16, 16, 44]);
		expect(xp.isReady).toBe(false);
		expect(xp.surplus).toBe(0);
		expect(xp.hasThresholdMark).toBe(false);
	});

	it("is ready at the threshold, with nothing to mark", () => {
		const xp = new XpTrack(new ValueMax(16, 16));
		expect(xp.isReady).toBe(true);
		expect(xp.pct).toBe(100);
		expect(xp.hasThresholdMark).toBe(false);
	});

	// It does not stop at the threshold: Burn Brightly spends what is past it, so the track rescales and
	// the threshold becomes a mark on it.
	it("keeps filling past the threshold, which becomes a mark", () => {
		const xp = new XpTrack(new ValueMax(21, 16));
		expect(xp.scale).toBe(21);
		expect(xp.pct).toBe(100);
		expect(xp.thresholdPct).toBe(76);
		expect(xp.hasThresholdMark).toBe(true);
		expect(xp.surplus).toBe(5);
	});

	it("never divides by nothing", () => {
		expect(new XpTrack(new ValueMax(0, 0)).pct).toBe(0);
	});
});

describe("VitalsSnapshot", () => {
	const vitals = (hp, xp) => new VitalsSnapshotBuilder()
		.withHp(hp).withXp(xp).withLevel(5).withArmor(0).withDamage(null).build();

	// Plain fields: templates read these through partials called with hash params.
	it("derives its two bars from its hit points and experience", () => {
		const v = vitals(new ValueMax(0, 16), new ValueMax(21, 16));
		expect(v.hpMeter).toBeInstanceOf(HpMeter);
		expect(v.hpMeter.isDying).toBe(true);
		expect(v.xpTrack).toBeInstanceOf(XpTrack);
		expect(v.xpTrack.surplus).toBe(5);
		expect(Object.keys(v)).toEqual(expect.arrayContaining(["hpMeter", "xpTrack"]));
	});
});
