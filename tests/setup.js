import {
	NumberField, StringField, BooleanField,
	ArrayField, ObjectField, SchemaField,
} from "./fakes/foundry/FakeFields.js";
import { TypeDataModel } from "./fakes/foundry/FakeTypeDataModel.js";
import { setPath, getPath, deletePath } from "./fakes/foundry/FakeUtils.js";
import { fakeI18n } from "./fakes/foundry/FakeI18n.js";

global.game = {
	i18n: fakeI18n(),
};

global.Hooks = {
	once: () => {},
	on: () => {},
};

global.CONFIG = {};

global.foundry = {
	abstract: {
		TypeDataModel,
		Document: {
			_addDataFieldMigration(source, fromPath, toPath) {
				const value = getPath(source, fromPath);
				if (value !== undefined) {
					setPath(source, toPath, value);
					deletePath(source, fromPath);
				}
			},
		},
	},
	data: {
		fields: { NumberField, StringField, BooleanField, ArrayField, ObjectField, SchemaField },
	},
	utils: {
		mergeObject: (a, b) => ({ ...a, ...b }),
		deepClone: (obj) => JSON.parse(JSON.stringify(obj)),
		setProperty: (obj, path, value) => setPath(obj, path, value),
		randomID: (len = 16) => Array.from({ length: len }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join(""),
		debounce: (fn, delay) => {
			let timeout;
			return (...args) => {
				clearTimeout(timeout);
				timeout = setTimeout(() => fn(...args), delay);
			};
		},
	},
	// Pass-through stub for Foundry text enrichment; real [[/r]] / @UUID rendering is
	// Foundry's job and verified manually.
	applications: {
		ux: {
			TextEditor: {
				implementation: {
					enrichHTML: async (html) => html,
				},
			},
		},
		// Stub template renderer; tests that assert chat-card content override this with a card-aware
		// stub. Default returns "" so non-asserting paths don't crash.
		handlebars: {
			renderTemplate: async () => "",
		},
	},
};

Math.clamp = (value, min, max) => Math.min(Math.max(value, min), max);
