import { FakeCoreActorSheetBase } from "./FakeCoreActorSheetBase.js";
import { createStonetopActorSheetV2Class } from "../../../src/actors/StonetopActorSheetV2.js";

/**
 * The REAL StonetopActorSheetV2 built on top of the core stand-in, for tests of a concrete actor
 * sheet.
 *
 * Concrete sheets lean on what the shared base contributes — the snapshot build, the one
 * enrichRichTextTree pass, `actor`/`editable` on the context. Re-describing that in a per-test fake
 * would be a second description of our own code, which is exactly the drift FakeCoreActorSheetBase
 * exists to avoid; so only CORE is faked here, and the base itself is the real thing.
 */
export function stonetopActorSheetBase() {
	foundry.applications ??= {};
	foundry.applications.api = { ...foundry.applications.api, HandlebarsApplicationMixin: Base => Base };
	foundry.applications.sheets = { ...foundry.applications.sheets, ActorSheetV2: FakeCoreActorSheetBase };
	return createStonetopActorSheetV2Class();
}
