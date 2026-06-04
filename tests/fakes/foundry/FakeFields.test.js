import { describe, it, expect } from "vitest";
import {
	NumberField, StringField, BooleanField,
	ArrayField, ObjectField, SchemaField,
} from "./FakeFields.js";

describe("NumberField", () => {
	it("returns 0 when value is undefined and no initial set", () => {
		expect(new NumberField().initialize(undefined)).toBe(0);
	});
	it("returns initial when value is undefined", () => {
		expect(new NumberField({ initial: 5 }).initialize(undefined)).toBe(5);
	});
	it("returns initial from a function when value is undefined", () => {
		expect(new NumberField({ initial: () => 99 }).initialize(undefined)).toBe(99);
	});
	it("returns initial when value is null", () => {
		expect(new NumberField({ initial: 3 }).initialize(null)).toBe(3);
	});
	it("casts a string to number", () => {
		expect(new NumberField().initialize("42")).toBe(42);
	});
	it("passes a number through unchanged", () => {
		expect(new NumberField().initialize(7)).toBe(7);
	});
	it("clamps to min", () => {
		expect(new NumberField({ min: 0 }).initialize(-5)).toBe(0);
	});
	it("clamps to max", () => {
		expect(new NumberField({ max: 10 }).initialize(20)).toBe(10);
	});
	it("truncates to integer when integer: true", () => {
		expect(new NumberField({ integer: true }).initialize(3.7)).toBe(3);
	});
	it("does not truncate when integer: false", () => {
		expect(new NumberField({ integer: false }).initialize(3.7)).toBe(3.7);
	});
	it("returns null for null when nullable: true", () => {
		expect(new NumberField({ nullable: true }).initialize(null)).toBeNull();
	});
	it("returns null for undefined when nullable: true and initial: null", () => {
		expect(new NumberField({ nullable: true, initial: null }).initialize(undefined)).toBeNull();
	});
});

describe("StringField", () => {
	it("returns empty string when value is undefined and no initial set", () => {
		expect(new StringField().initialize(undefined)).toBe("");
	});
	it("returns initial when value is undefined", () => {
		expect(new StringField({ initial: "hello" }).initialize(undefined)).toBe("hello");
	});
	it("returns initial from a function when value is undefined", () => {
		expect(new StringField({ initial: () => "world" }).initialize(undefined)).toBe("world");
	});
	it("returns empty string when value is null and not nullable", () => {
		expect(new StringField().initialize(null)).toBe("");
	});
	it("casts number to string", () => {
		expect(new StringField().initialize(42)).toBe("42");
	});
	it("passes a string through unchanged", () => {
		expect(new StringField().initialize("ranger")).toBe("ranger");
	});
	it("returns null for null when nullable: true", () => {
		expect(new StringField({ nullable: true }).initialize(null)).toBeNull();
	});
	it("returns null for undefined when nullable: true and initial: null", () => {
		expect(new StringField({ nullable: true, initial: null }).initialize(undefined)).toBeNull();
	});
	it("returns empty string for null when not nullable", () => {
		expect(new StringField().initialize(null)).toBe("");
	});
});

describe("BooleanField", () => {
	it("returns false when value is undefined and no initial set", () => {
		expect(new BooleanField().initialize(undefined)).toBe(false);
	});
	it("returns initial when value is undefined", () => {
		expect(new BooleanField({ initial: true }).initialize(undefined)).toBe(true);
	});
	it("casts truthy value to true", () => {
		expect(new BooleanField().initialize(1)).toBe(true);
	});
	it("casts falsy value to false", () => {
		expect(new BooleanField().initialize(0)).toBe(false);
	});
	it("passes true through", () => {
		expect(new BooleanField().initialize(true)).toBe(true);
	});
	it("returns false for null", () => {
		expect(new BooleanField().initialize(null)).toBe(false);
	});
});

describe("ObjectField", () => {
	it("returns empty object when value is undefined and no initial set", () => {
		expect(new ObjectField().initialize(undefined)).toEqual({});
	});
	it("returns initial when value is undefined", () => {
		expect(new ObjectField({ initial: { a: 1 } }).initialize(undefined)).toEqual({ a: 1 });
	});
	it("returns null when value is null and nullable: true", () => {
		expect(new ObjectField({ nullable: true }).initialize(null)).toBeNull();
	});
	it("returns empty object when value is null and not nullable", () => {
		expect(new ObjectField().initialize(null)).toEqual({});
	});
	it("passes object through unchanged", () => {
		const obj = { x: 1, y: 2 };
		expect(new ObjectField().initialize(obj)).toEqual(obj);
	});
	it("returns null for undefined when nullable: true and initial: null", () => {
		expect(new ObjectField({ nullable: true, initial: null }).initialize(undefined)).toBeNull();
	});
});

describe("ArrayField", () => {
	it("returns empty array when value is undefined", () => {
		expect(new ArrayField(new NumberField()).initialize(undefined)).toEqual([]);
	});
	it("returns empty array when value is null", () => {
		expect(new ArrayField(new NumberField()).initialize(null)).toEqual([]);
	});
	it("applies element field to each item", () => {
		expect(new ArrayField(new NumberField()).initialize(["1", "2", "3"])).toEqual([1, 2, 3]);
	});
	it("returns empty array for empty input", () => {
		expect(new ArrayField(new StringField()).initialize([])).toEqual([]);
	});
	it("applies StringField to each element", () => {
		expect(new ArrayField(new StringField()).initialize([1, 2])).toEqual(["1", "2"]);
	});
});

describe("SchemaField", () => {
	it("returns defaults when value is undefined", () => {
		const field = new SchemaField({
			hp: new NumberField({ initial: 10 }),
			name: new StringField({ initial: "Unnamed" }),
		});
		expect(field.initialize(undefined)).toEqual({ hp: 10, name: "Unnamed" });
	});
	it("applies data values to each key", () => {
		const field = new SchemaField({
			hp: new NumberField({ initial: 10 }),
			name: new StringField({ initial: "Unnamed" }),
		});
		expect(field.initialize({ hp: 5, name: "Brakken" })).toEqual({ hp: 5, name: "Brakken" });
	});
	it("uses field defaults for missing keys in partial data", () => {
		const field = new SchemaField({
			hp: new NumberField({ initial: 10 }),
			armor: new NumberField({ initial: 0 }),
		});
		expect(field.initialize({ hp: 7 })).toEqual({ hp: 7, armor: 0 });
	});
	it("can nest SchemaFields", () => {
		const field = new SchemaField({
			health: new SchemaField({
				value: new NumberField({ initial: 10 }),
				max: new NumberField({ initial: 10 }),
			}),
		});
		expect(field.initialize({ health: { value: 5 } })).toEqual({
			health: { value: 5, max: 10 },
		});
	});
	it("can contain an ArrayField", () => {
		const field = new SchemaField({
			tags: new ArrayField(new StringField()),
		});
		expect(field.initialize({ tags: ["tough", "quick"] })).toEqual({
			tags: ["tough", "quick"],
		});
	});
});
