define({

	init: function () {
		var scope = this.oocss({
			mode: ['foo:foo-mode', 'bar:bar-mode'],
			rights: 'edit:edit-rights view:view-rights delete:delete-rights'
		});
		scope.set(this.body, 'mode.foo');
		scope.set(this.body, 'rights.view, rights.edit');
	}

});
