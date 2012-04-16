define({

	init: function () {
		this.oocss.states(this.body, {
			mode: ['foo:foo-mode', 'bar:bar-mode']
		});
		this.oocss.set(this.body, 'mode.foo');
	}

});
