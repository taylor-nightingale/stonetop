import { describe, it, expect, vi } from "vitest";
import { TypeDataModel } from "./FakeTypeDataModel.js";

function makeHealthModel(extraSchema = {}) {
	const f = foundry.data.fields;
	return class HealthData extends TypeDataModel {
		static defineSchema() {
			return {
				health: new f.SchemaField({
					value: new f.NumberField({ initial: 10 }),
					max:   new f.NumberField({ initial: 10 }),
				}),
				name: new f.StringField({ initial: "" }),
				...extraSchema,
			};
		}
	};
}

describe("TypeDataModel", () => {
	describe("initialization with defaults", () => {
		it("applies schema defaults when no data is provided", () => {
			const HealthData = makeHealthModel();
			const d = new HealthData();
			expect(d.health.value).toBe(10);
			expect(d.health.max).toBe(10);
			expect(d.name).toBe("");
		});

		it("applies provided data values", () => {
			const HealthData = makeHealthModel();
			const d = new HealthData({ health: { value: 5 }, name: "Brakken" });
			expect(d.health.value).toBe(5);
			expect(d.health.max).toBe(10);
			expect(d.name).toBe("Brakken");
		});

		it("stores initialized data in _source", () => {
			const HealthData = makeHealthModel();
			const d = new HealthData({ health: { value: 5 } });
			expect(d._source.health.value).toBe(5);
			expect(d._source.health.max).toBe(10);
		});

		it("schema fields are accessible as top-level properties", () => {
			const HealthData = makeHealthModel();
			const d = new HealthData({ health: { value: 3 } });
			expect(d.health).toEqual({ value: 3, max: 10 });
		});
	});

	describe("toObject()", () => {
		it("returns contents of _source as a plain object", () => {
			const HealthData = makeHealthModel();
			const d = new HealthData({ health: { value: 7, max: 10 }, name: "Fox" });
			expect(d.toObject()).toEqual({
				health: { value: 7, max: 10 },
				name: "Fox",
			});
		});

		it("returns a deep copy, not a reference to _source", () => {
			const HealthData = makeHealthModel();
			const d = new HealthData();
			const obj = d.toObject();
			obj.health.value = 999;
			expect(d._source.health.value).toBe(10);
		});
	});

	describe("migrateData()", () => {
		it("runs before initialization so schema sees migrated values", () => {
			const f = foundry.data.fields;
			class MigratingData extends TypeDataModel {
				static defineSchema() {
					return { hp: new f.NumberField({ initial: 0 }) };
				}
				static migrateData(data) {
					if ("oldHp" in data) {
						data.hp = data.oldHp;
						delete data.oldHp;
					}
					return data;
				}
			}
			const d = new MigratingData({ oldHp: 15 });
			expect(d.hp).toBe(15);
			expect(d._source).not.toHaveProperty("oldHp");
		});

		it("does not mutate the original data passed to the constructor", () => {
			const f = foundry.data.fields;
			class MigratingData extends TypeDataModel {
				static defineSchema() {
					return { hp: new f.NumberField({ initial: 0 }) };
				}
				static migrateData(data) {
					data.hp = (data.hp ?? 0) + 1;
					return data;
				}
			}
			const original = { hp: 5 };
			new MigratingData(original);
			expect(original.hp).toBe(5);
		});
	});

	describe("prepareDerivedData()", () => {
		it("is called after initialization", () => {
			const f = foundry.data.fields;
			class DerivedData extends TypeDataModel {
				static defineSchema() {
					return { level: new f.NumberField({ initial: 1 }) };
				}
				prepareDerivedData() {
					this.xpMax = 6 + this.level * 2;
				}
			}
			const d = new DerivedData({ level: 3 });
			expect(d.xpMax).toBe(12);
		});

		it("has access to initialized schema values when called", () => {
			const f = foundry.data.fields;
			const spy = vi.fn();
			class SpyData extends TypeDataModel {
				static defineSchema() {
					return { hp: new f.NumberField({ initial: 10 }) };
				}
				prepareDerivedData() { spy(this.hp); }
			}
			new SpyData({ hp: 7 });
			expect(spy).toHaveBeenCalledWith(7);
		});
	});

	describe("empty schema", () => {
		it("works with no schema fields defined", () => {
			const d = new TypeDataModel();
			expect(d._source).toEqual({});
			expect(d.toObject()).toEqual({});
		});
	});
});
