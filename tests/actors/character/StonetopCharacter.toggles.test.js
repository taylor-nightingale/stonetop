import { describe, expect, it, vi } from "vitest";
import { TestCharacterBuilder } from "../../fakes/TestCharacterBuilder.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";

function makeChar() {
	return new TestCharacterBuilder(new FakeCharacterActorBuilder().build()).build();
}

// Pips: clicking the checked pip at `index` empties back to it (count = index); clicking an
// unchecked one fills through it (count = index + 1). Dataset indexes arrive as strings.

describe("StonetopCharacter pip toggles", () => {
	it("toggleMoveResourcePip on an unchecked pip fills through it", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setMoveResourceCurrent").mockResolvedValue();
		await char.toggleMoveResourcePip("mystic", "2", false);
		expect(spy).toHaveBeenCalledWith("mystic", 3);
	});

	it("toggleMoveResourcePip on the checked pip empties back to it", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setMoveResourceCurrent").mockResolvedValue();
		await char.toggleMoveResourcePip("mystic", "2", true);
		expect(spy).toHaveBeenCalledWith("mystic", 2);
	});

	it("toggleArcanumResourcePip routes to setArcanumResource", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setArcanumResource").mockResolvedValue();
		await char.toggleArcanumResourcePip("eye", "0", false);
		expect(spy).toHaveBeenCalledWith("eye", 1);
	});

	it("toggleBackgroundResourcePip routes to setBackgroundResource", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setBackgroundResource").mockResolvedValue();
		await char.toggleBackgroundResourcePip("initiate", "1", true);
		expect(spy).toHaveBeenCalledWith("initiate", 1);
	});

	it("toggleFollowerLoyaltyPip routes to setFollowerLoyalty", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setFollowerLoyalty").mockResolvedValue();
		await char.toggleFollowerLoyaltyPip("enfys", "1", false);
		expect(spy).toHaveBeenCalledWith("enfys", 2);
	});

	it("togglePossessionUsePip without a choice routes to setPossessionUses", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setPossessionUses").mockResolvedValue();
		await char.togglePossessionUsePip("charm", null, "1", false);
		expect(spy).toHaveBeenCalledWith("charm", 2);
	});

	it("togglePossessionUsePip with a choice routes to setSubChoiceUses", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setSubChoiceUses").mockResolvedValue();
		await char.togglePossessionUsePip("charm", "blessing", "1", true);
		expect(spy).toHaveBeenCalledWith("charm", "blessing", 1);
	});
});

// Pools and checks are checkbox tracks: the event delivers the NEW checked state, so checking box
// `index` fills through index+1 and unchecking empties back to index.

describe("StonetopCharacter pool toggles", () => {
	it("toggleInventoryRegularPool fills through the checked box", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setInventoryRegularPool").mockResolvedValue();
		await char.toggleInventoryRegularPool("3", true);
		expect(spy).toHaveBeenCalledWith(4);
	});

	it("toggleInventorySmallPool empties back to the unchecked box", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "setInventorySmallPool").mockResolvedValue();
		await char.toggleInventorySmallPool("3", false);
		expect(spy).toHaveBeenCalledWith(3);
	});
});

describe("StonetopCharacter checked-state setters", () => {
	it("setMoveChecked(true) increments the move", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "incrementMove").mockResolvedValue();
		await char.setMoveChecked("playbook", "spirit-tongue", true);
		expect(spy).toHaveBeenCalledWith("playbook", "spirit-tongue");
	});

	it("setMoveChecked(false) decrements the move", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "decrementMove").mockResolvedValue();
		await char.setMoveChecked("playbook", "spirit-tongue", false);
		expect(spy).toHaveBeenCalledWith("playbook", "spirit-tongue");
	});

	it("setPossessionSelected toggles between select and deselect", async () => {
		const char = makeChar();
		const select = vi.spyOn(char, "selectPossession").mockResolvedValue();
		const deselect = vi.spyOn(char, "deselectPossession").mockResolvedValue();
		await char.setPossessionSelected("charm", true);
		await char.setPossessionSelected("charm", false);
		expect(select).toHaveBeenCalledWith("charm");
		expect(deselect).toHaveBeenCalledWith("charm");
	});

	it("setSubChoiceSelected toggles between select and deselect", async () => {
		const char = makeChar();
		const select = vi.spyOn(char, "selectSubChoice").mockResolvedValue();
		const deselect = vi.spyOn(char, "deselectSubChoice").mockResolvedValue();
		await char.setSubChoiceSelected("charm", "blessing", true);
		await char.setSubChoiceSelected("charm", "blessing", false);
		expect(select).toHaveBeenCalledWith("charm", "blessing");
		expect(deselect).toHaveBeenCalledWith("charm", "blessing");
	});

	it("toggleArcanumFlip unflips a flipped card and flips an unflipped one", async () => {
		const char = makeChar();
		const flip = vi.spyOn(char, "flipArcanum").mockResolvedValue();
		const unflip = vi.spyOn(char, "unflipArcanum").mockResolvedValue();
		await char.toggleArcanumFlip("eye", true);
		await char.toggleArcanumFlip("eye", false);
		expect(unflip).toHaveBeenCalledWith("eye");
		expect(flip).toHaveBeenCalledWith("eye");
	});
});

describe("StonetopCharacter.selectCustomInstinct", () => {
	it("routes to the playbook's custom-instinct selection", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char._playbook, "selectCustomInstinct").mockResolvedValue();
		await char.selectCustomInstinct("Protect the grove");
		expect(spy).toHaveBeenCalledWith("Protect the grove");
	});
});

describe("StonetopCharacter.toggleFollowerTag", () => {
	it("routes to the member selection when a member index is given", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "toggleFollowerMemberSelection").mockResolvedValue();
		await char.toggleFollowerTag("enfys", "traits", "2", "brave");
		expect(spy).toHaveBeenCalledWith("enfys", 2, "traits", "brave");
	});

	it("routes companionOptions to the companion toggle", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "toggleFollowerCompanionOption").mockResolvedValue();
		await char.toggleFollowerTag("shadow", "companionOptions", null, "keen nose");
		expect(spy).toHaveBeenCalledWith("shadow", "keen nose");
	});

	it("routes plain fields to the follower selection toggle", async () => {
		const char = makeChar();
		const spy = vi.spyOn(char, "toggleFollowerSelection").mockResolvedValue();
		await char.toggleFollowerTag("enfys", "tagList", null, "sturdy");
		expect(spy).toHaveBeenCalledWith("enfys", "tagList", "sturdy");
	});
});

// Shared-inventory routing: followerSlug null = the character's own inventory.

describe("StonetopCharacter shared-inventory routing", () => {
	it("setInventoryItemCheckedFor routes to the follower when a slug is given", async () => {
		const char = makeChar();
		const follower = vi.spyOn(char, "setFollowerInvItemChecked").mockResolvedValue();
		await char.setInventoryItemCheckedFor("enfys", "rope", true);
		expect(follower).toHaveBeenCalledWith("enfys", "rope", true);
	});

	it("setInventoryItemCheckedFor routes to the character without a slug", async () => {
		const char = makeChar();
		const own = vi.spyOn(char, "setInventoryItemChecked").mockResolvedValue();
		await char.setInventoryItemCheckedFor(null, "rope", false);
		expect(own).toHaveBeenCalledWith("rope", false);
	});

	it("toggleInventoryResourcePipFor applies pip math on both routes", async () => {
		const char = makeChar();
		const follower = vi.spyOn(char, "setFollowerInvResource").mockResolvedValue();
		const own = vi.spyOn(char, "setInventoryResource").mockResolvedValue();
		await char.toggleInventoryResourcePipFor("enfys", "rations", "1", false);
		await char.toggleInventoryResourcePipFor(null, "rations", "1", true);
		expect(follower).toHaveBeenCalledWith("enfys", "rations", 2);
		expect(own).toHaveBeenCalledWith("rations", 1);
	});

	it("addCustomInventoryItemFor routes follower, regular, and small item adds", async () => {
		const char = makeChar();
		const follower = vi.spyOn(char, "addFollowerInvCustomItem").mockResolvedValue();
		const regular = vi.spyOn(char, "addCustomInventoryItem").mockResolvedValue();
		const small = vi.spyOn(char, "addCustomSmallItem").mockResolvedValue();
		await char.addCustomInventoryItemFor("enfys", "Rope", 1, true);
		await char.addCustomInventoryItemFor(null, "Tent", 2, true);
		await char.addCustomInventoryItemFor(null, "Flint", 1, false);
		expect(follower).toHaveBeenCalledWith("enfys", "Rope", 1);
		expect(regular).toHaveBeenCalledWith("Tent", 2);
		expect(small).toHaveBeenCalledWith("Flint");
	});

	it("removeCustomInventoryItemFor routes both ways", async () => {
		const char = makeChar();
		const follower = vi.spyOn(char, "removeFollowerInvCustomItem").mockResolvedValue();
		const own = vi.spyOn(char, "removeCustomInventoryItem").mockResolvedValue();
		await char.removeCustomInventoryItemFor("enfys", "id1");
		await char.removeCustomInventoryItemFor(null, "id2");
		expect(follower).toHaveBeenCalledWith("enfys", "id1");
		expect(own).toHaveBeenCalledWith("id2");
	});
});

describe("StonetopCharacter.setFollowerHp clamping", () => {
	function charWithFollowerSpy() {
		const char = makeChar();
		const spy = vi.spyOn(char._followers, "setHp").mockResolvedValue();
		return { char, spy };
	}

	it("clamps above the given max", async () => {
		const { char, spy } = charWithFollowerSpy();
		await char.setFollowerHp("enfys", "12", "10");
		expect(spy).toHaveBeenCalledWith("enfys", 10);
	});

	it("clamps below zero", async () => {
		const { char, spy } = charWithFollowerSpy();
		await char.setFollowerHp("enfys", "-3", "10");
		expect(spy).toHaveBeenCalledWith("enfys", 0);
	});

	it("passes an in-range value through", async () => {
		const { char, spy } = charWithFollowerSpy();
		await char.setFollowerHp("enfys", "4", "10");
		expect(spy).toHaveBeenCalledWith("enfys", 4);
	});

	it("skips the upper clamp when the max does not parse", async () => {
		const { char, spy } = charWithFollowerSpy();
		await char.setFollowerHp("enfys", "12", "");
		expect(spy).toHaveBeenCalledWith("enfys", 12);
	});

	it("skips the upper clamp when no max is given", async () => {
		const { char, spy } = charWithFollowerSpy();
		await char.setFollowerHp("enfys", 12);
		expect(spy).toHaveBeenCalledWith("enfys", 12);
	});
});
