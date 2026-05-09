global.game = {
	i18n: { localize: (key) => key },
};

global.Hooks = {
	once: () => {},
	on: () => {},
};

global.CONFIG = {};

global.foundry = {
	utils: {
		mergeObject: (a, b) => ({ ...a, ...b }),
	},
};

Math.clamp = (value, min, max) => Math.min(Math.max(value, min), max);
