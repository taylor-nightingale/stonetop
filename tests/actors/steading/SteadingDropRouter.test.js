import { describe, it, expect, vi } from "vitest";
import { SteadingDropRouter } from "../../../src/actors/steading/SteadingDropRouter.js";

describe("SteadingDropRouter", () => {
	it("hands the item to the handler registered for its type", async () => {
		const grant = vi.fn(async () => {});
		const router = new SteadingDropRouter().register("improvement", grant);
		const item = { type: "improvement", system: { slug: "palisade" } };

		expect(await router.handle(item)).toBe(true);
		expect(grant).toHaveBeenCalledWith(item);
	});

	// False is the caller's cue to fall back to core's default embed, so an unclaimed drop still
	// does the ordinary Foundry thing rather than vanishing.
	it("reports unhandled for a type nobody registered", async () => {
		const router = new SteadingDropRouter().register("move", vi.fn());
		expect(await router.handle({ type: "arcanum" })).toBe(false);
	});

	it("reports unhandled for a missing item, without throwing", async () => {
		const router = new SteadingDropRouter().register("move", vi.fn());
		expect(await router.handle(undefined)).toBe(false);
		expect(await router.handle({})).toBe(false);
	});

	it("routes each registered type to its own handler", async () => {
		const onMove = vi.fn(async () => {});
		const onSteadfast = vi.fn(async () => {});
		const router = new SteadingDropRouter().register("move", onMove).register("steadfast", onSteadfast);

		await router.handle({ type: "steadfast" });

		expect(onSteadfast).toHaveBeenCalled();
		expect(onMove).not.toHaveBeenCalled();
	});

	it("waits for the handler before reporting handled", async () => {
		let finished = false;
		const router = new SteadingDropRouter()
			.register("move", async () => { await Promise.resolve(); finished = true; });
		await router.handle({ type: "move" });
		expect(finished).toBe(true);
	});

	it("chains registrations", () => {
		const router = new SteadingDropRouter();
		expect(router.register("move", vi.fn())).toBe(router);
	});
});
