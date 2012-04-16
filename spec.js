define({

	body: {
		getElement: document.body,
		classMap: {
			// preferred format
			foo: ['on:foo-on', 'off:foo-off'],
			bar: ['true:bar-on', 'false:bar-off'],
			// alternate format
			baz: 'one:lonely two:company three:crowd four:not-allowed',
			// non-mapped format
			simple: 'simple-one simple-two simple-three'
		}
	},

	controller: {
		prototype: {
			module: 'wire-oocss/controller'
		},
		properties: {
			body: { $ref: 'body' },
			oocss: { module: 'wire-oocss/oocss' }
		},
		init: 'init'
	},

//	debug: { module: 'wire/debug' },
	dom: { module: 'wire/dom' },
	css: { module: 'wire-oocss/oocss' }

});
