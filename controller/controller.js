define({

	init: function () {
		this.css.states(this.body, {
			mode: ['foo:foo-mode', 'bar:bar-mode']
		});
		this.css.set(this.body, 'mode.foo');
	}

});
