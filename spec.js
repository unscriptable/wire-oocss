define({

	foo: document,

	bar: { $ref: 'foo' },

	myFunc: {
		expr: {
			body: 'alert(e.target.textContent);',
			params: ['e']
		}
	},

	body: {
		getElement: document.body,
		states: {
			foo: ['on:foo-on', 'off:foo-off'],
			bar: ['true:bar-on', 'false:bar-off']
		},
//		init: {
//			addEventListener: [
//				'mouseover',
//				{ $ref: 'expr!this.style.color="red";' },
//				false
//			]
//		},
//		ready: {
//			addEventListener: [
//				'click',
//				{ $ref: 'myFunc' },
//				false
//			]
//		},
//		insert: {
//			at: document
//		}
	},

	controller: {
		prototype: {
			module: 'wire-css/controller/controller'
		},
		properties: {
			body: { $ref: 'body' },
			css: { module: 'wire-css/css' }
		},
		init: 'init'
	},

	expr: { module: 'wire-expr/expr' },
	css: { module: 'wire-css/oocss' },
	dom: { module: 'wire/dom' },
	connect: { module: 'wire/on' },
	debug: { module: 'wire/debug' }

});
