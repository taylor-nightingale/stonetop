import { describe, it, expect, vi, afterEach } from "vitest";
import { FoundryPlaybookRepository } from "../../../../src/actors/character/repositories/FoundryPlaybookRepository.js";
import { PlaybookSummary } from "../../../../src/actors/character/repositories/PlaybookSummary.js";
import { FakeGameBuilder } from "../../../fakes/FakeGameBuilder.js";
import { FakePackBuilder } from "../../../fakes/foundry/FakePackBuilder.js";
import { TestPlaybookItemBuilder } from "../../../fakes/TestPlaybookItemBuilder.js";

afterEach(() => vi.unstubAllGlobals());

const BLESSED = new TestPlaybookItemBuilder().build();
const FOX     = new TestPlaybookItemBuilder().withSlug("the-fox").withName("The Fox").build();

describe("FoundryPlaybookRepository", () => {
	describe("findItemDataBySlug", () => {
		function withToObject(item) {
			return { ...item, toObject: () => ({ name: item.name, type: item.type, system: item.system }) };
		}

		it("returns the pack document's raw data", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbooksPack().withItem(withToObject(BLESSED)))
				.build();
			const data = await new FoundryPlaybookRepository().findItemDataBySlug("the-blessed");
			expect(data.system.slug).toBe("the-blessed");
			expect(data.type).toBe("playbook");
		});

		it("falls back to a world playbook when the pack has no match", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbooksPack().withItem(withToObject(BLESSED)))
				.withWorldItem(withToObject(FOX))
				.build();
			const data = await new FoundryPlaybookRepository().findItemDataBySlug("the-fox");
			expect(data.system.slug).toBe("the-fox");
		});

		it("returns null when the slug is nowhere", async () => {
			new FakeGameBuilder().build();
			expect(await new FoundryPlaybookRepository().findItemDataBySlug("nope")).toBeNull();
		});
	});

	describe("findSourceBySlug", () => {
		// The pack document is English; its prepared form is whatever the world's language made of it.
		// Anything copied onto an actor has to come from the former.
		function withTranslatedPreparedData(item) {
			return {
				...item,
				name: "Der Gesegnete",
				system: { ...item.system, description: "Danu, die Große Mutter, sorgt für uns." },
				toObject: () => ({ name: item.name, type: item.type, system: item.system }),
			};
		}

		it("returns the untranslated pack source, not the prepared document", async () => {
			const english = new TestPlaybookItemBuilder().withDescription("Danu, the Great Mother, provides.").build();
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbooksPack().withItem(withTranslatedPreparedData(english)))
				.build();

			const playbook = await new FoundryPlaybookRepository().findSourceBySlug("the-blessed");
			expect(playbook.name).toBe(english.name);
			expect(playbook.description).toBe("Danu, the Great Mother, provides.");
		});

		it("returns null when the slug is nowhere", async () => {
			new FakeGameBuilder().build();
			expect(await new FoundryPlaybookRepository().findSourceBySlug("nope")).toBeNull();
		});
	});

	describe("getAllPlaybooks", () => {
		it("returns [] when no pack and no world items", async () => {
			new FakeGameBuilder().build();
			expect(await new FoundryPlaybookRepository().getAllPlaybooks()).toEqual([]);
		});

		it("returns PlaybookSummary objects from pack entries", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbooksPack().withItem(BLESSED))
				.build();
			const [result] = await new FoundryPlaybookRepository().getAllPlaybooks();
			expect(result).toBeInstanceOf(PlaybookSummary);
			expect(result.name).toBe("The Blessed");
			expect(result.slug).toBe("the-blessed");
		});

		it("sorts results by name", async () => {
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbooksPack().withItem(FOX).withItem(BLESSED))
				.build();
			const names = (await new FoundryPlaybookRepository().getAllPlaybooks()).map(r => r.name);
			expect(names).toEqual(["The Blessed", "The Fox"]);
		});

		it("includes world playbooks not already in pack", async () => {
			const seeker = new TestPlaybookItemBuilder().withSlug("the-seeker").withName("The Seeker").build();
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbooksPack().withItem(BLESSED))
				.withWorldItem(seeker)
				.build();
			const slugs = (await new FoundryPlaybookRepository().getAllPlaybooks()).map(r => r.slug);
			expect(slugs).toContain("the-seeker");
			expect(slugs).toHaveLength(2);
		});

		it("excludes world playbooks whose slug is already in pack", async () => {
			const duplicate = new TestPlaybookItemBuilder().withName("The Blessed (Custom)").build();
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbooksPack().withItem(BLESSED))
				.withWorldItem(duplicate)
				.build();
			const result = await new FoundryPlaybookRepository().getAllPlaybooks();
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("The Blessed");
		});

		it("excludes world items that are not type playbook", async () => {
			const nonPlaybook = { type: "move", name: "Hack & Slash", system: { slug: "hack-and-slash" } };
			new FakeGameBuilder()
				.withPack(FakePackBuilder.playbooksPack().withItem(BLESSED))
				.withWorldItem(nonPlaybook)
				.build();
			expect(await new FoundryPlaybookRepository().getAllPlaybooks()).toHaveLength(1);
		});
	});
});

describe("namesBySlug", () => {
	it("maps every playbook's slug to its name", async () => {
		new FakeGameBuilder()
			.withPack(FakePackBuilder.playbooksPack().withItem(BLESSED).withItem(FOX))
			.build();
		const names = await new FoundryPlaybookRepository().namesBySlug();
		expect(names.get("the-blessed")).toBe(BLESSED.name);
		expect(names.get("the-fox")).toBe("The Fox");
	});

	it("is empty when there is no pack", async () => {
		new FakeGameBuilder().build();
		expect((await new FoundryPlaybookRepository().namesBySlug()).size).toBe(0);
	});
});
