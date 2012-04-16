(function (define) {
define(['wire/dom/base', 'when'], function (base, when) {
"use strict";

	/*
	The perfect processing formats (default formats) are:
	ok: {
		group1: "css-state1 css-state2 css-state3",
		group2: "css-stateA css-stateB css-stateC"
	},
	best: {
		group1: [ "state1", "state2", "state3" ],
		group2: [ "stateA", "stateB", "stateC" ]
	}
	 */

	/*
	Translate to css classes
	maybe: {
		"group1:state1": "css-state1",
		"group1:state2": "css-state2"
	}
	or: {
		group1: { state1: "css-state1", state2: "css-state2" }
	}
	 */


	var splitAtSpacesOrCommasRx, splitAtColonRx,
		undef;

	// TODO: this regexp captures the blanks before commas
	splitAtSpacesOrCommasRx = /\s*,\s*|\s+/;
	splitAtColonRx = /\s*:\s*/;

	/**
	 *
	 * @param stateMap {Object} requires, but can be an empty object
	 * @param [options] {Object}
	 *   a potential option: to store the group info as an attribute on the node
	 */
	function oocssScope (stateMap, options) {
		var master;

		if (!options) options = {};

		master = normalizeMaster(stateMap);

		return {

			/**
			 *
			 * @param node {HTMLElement}
			 * @param tokens {String|Array|Object} a space-delimited* set of
			 *   oocss states or an array of oocss states or an object whose
			 *   keys are group anmes and whose values are a space-delimited
			 *   set of states or an array of states. Each state can be a
			 *   group.state pair or simply a non-prefixed state.  In the latter
			 *   case, the group will be found automatically (but this requires
			 *   some processing and so is less efficient).
			 *   *Note: commas are also acceptable as delimiters.
			 *
			 * @example 1
			 * The following are all equivalent if the "disabled" and "admin"
			 * state groups have been properly configured (and have unique keys):
			 *   var set = oocss.set;
			 *   set(mynode, { disabled: "false", rights: "edit view" });
			 *   set(mynode, { disabled: "false", rights: ["edit", "view"] });
			 *   set(mynode, [ "disabled.false", "rights.edit", "rights.view" ]);
			 *   set(mynode, "disabled.false rights.edit rights.view");
			 *   set(mynode, [ "false", "edit", "view" ]);
			 *   set(mynode, "false edit view");
			 */
			set: function (node, tokens) {
				var classNames;
				tokens = normalizeStates(tokens);
				classNames = parseClassNames(tokens, master);
				return node.className = spliceClassNames(node.className, classNames.removes, classNames.adds);
			},

			/**
			 * TODO: allow dev to specify return type in options?
			 * @param node
			 * @return {Object}
			 */
			get: function (node) {
				return statesFromString(node.className, master);
			},

			setStateMap: function (newMaster) {
				master = normalizeMaster(newMaster);
				return master;
			},

			getStateMap: function () {
				return master;
			}

		};
	}

	oocssScope.wire$plugin = function (ready, destroyed, options) {
		base.nodeProxy = extendNodeProxy(base.nodeProxy);
		return {
			facets: {
				// TODO: is this convenient as a facet or should we just let devs use the classMap pseudo-property?
				classMap: {
					configure: configureClassMap
				}
			}
		};
	};

	/**
	 * Converts a string of classNames to an object whose property names
	 * are group names and whose values are strings representing
	 * the states selected in each group.  The object represents the
	 * partial set of states selected out of all states in all groups.
	 * @param string
	 */
	function statesFromString (string, master) {
		var groups, array, gname;
		groups = {};
		for (gname in master) {
			groups[gname] = master[gname].fromClassNames(string);
		}
		return groups;
	}

	/**
	 * Convert from tokenized string or an object of arrays or strings.
	 * The tokens in the string could be prefixed with tokens or not.
	 * @param states {Object|Array|String}
	 *   { disabled: "false", rights: "edit view" }
	 *   { disabled: "false", rights: ["edit", "view"] }
	 *   [ "disabled.false", "rights.edit", "rights.view" ]
	 *   "disabled.false rights.edit rights.view"
	 *   [ "false", "edit", "view" ]
	 *   "false edit view"
	 * @return {Object}
	 *   { disabled: "false", rights: "edit view" }
	 */
	function normalizeStates (states) {
		var groups, gname, i, pair, group;

		groups = {};

		if (isObject(states)) {
			groups = states;
		}
		else {
			if (isString(states)) {
				// convert to array
				states = states.split(splitAtSpacesOrCommasRx);
			}
			for (i = 0; i < states.length; i++) {
				pair = states[i].split(/\s*\.\s*/); // TODO: hoist regexp
				// TODO: lookup group name (gname) if it is omitted
				gname = pair[0];
				if (!groups[gname]) groups[gname] = [];
				groups[gname].push(pair[1]);
			}
		}

		for (gname in groups) {
			group = groups[gname];
			// convert to string
			groups[gname] = isArray(group) ? group.join(' ') : group;
		}

		return groups;
	}

	/**
	 * Converts to the most efficient internal format and splits the
	 * mappings (of javascript-friendly state names to css classNames)
	 * into a separate object.
	 * @param master
	 *	{
	 *   	disabled: "false:css-enabled true:css-disabled",
	 *   	rights: "edit:edit-mode view:view-mode"
	 *	}
	 *	{
	 *   	disabled: [ "false:css-enabled", "true:css-disabled" ],
	 *   	rights: [ "edit:edit-mode", "view:view-mode" ]
	 *	}
	 *	{
	 *   	disabled: { "false": "css-enabled", "true": "css-disabled" },
	 *   	rights: { "edit": "edit-mode", "view": "view-mode" }
	 *	}
	 *@return {Object} each value is an array of the states that also has
	 *   an additional string property and a classMap property
	 *	{
	 *   	disabled: [ "false", "true" ],
	 *   	rights: [ "edit", "view" ]
	 *	}
	 */
	function normalizeMaster (master) {
		var normalized, gname;

		normalized = {};

		for (gname in master) {
			// wire 0.8 requires hasOwnProperty
			if (master.hasOwnProperty(gname)) {
				normalized[gname] = normalizeGroup(master[gname]);
			}
		}

		return normalized;
	}

	function normalizeGroup (group) {
		var isArr, map, imap, sname, pair, states, string;

		isArr = isArray(group);
		map = {};
		imap = {};
		states = [];

		if (isString(group)) {
			group = group.split(splitAtSpacesOrCommasRx);
		}

		// could be an array or object at this point
		for (sname in group) {
			// get key-value pair (map of state name to css value)
			if (isArr) {
				pair = group[sname].split(splitAtColonRx);
				states.push(pair.length > 1 ? pair[0] : pair[1]);
				if (pair.length > 1) {
					map[pair[0]] = pair[1];
					imap[pair[1]] = pair[0];
				}
			}
			else {
				states.push(sname);
				map[sname] = group[sname];
				imap[group[sname]] = sname;
			}
		}

		// pre-processing and convenience functions
		string = states.join(' ');
		states.toString = function () { return string; };
		states.toClassNames = function (names) {
			return translateTokens(names, map);
		};
		states.fromClassNames = function (classNames) {
			return translateTokens(classNames, imap);
		};
		states.allClassNames = function () {
			var classNames = states.toClassNames(string);
			// only compute once!
			states.allClassNames = function () { return classNames; };
			return classNames;
		};

		return states;

		function translateTokens (tokens, map) {
			if (!tokens) tokens = '';
			return tokens.replace(/(^|\s+)([^\s]+)/, function (m, s, word) { // TODO: hoist regexp
				var trans = map[word];
				return trans ? s + trans : '';
			});
		}
	}

	function parseClassNames (normalized, master) {
		var adds, removes, gname;

		adds = [];
		removes = [];

		for (gname in normalized) {
			if (gname in master) {
				adds.push(master[gname].toClassNames(normalized[gname]));
				removes.push(master[gname].allClassNames());
			}
			else {
				// TODO: does this even work?
				// should we allow dev to include non-translated classNames?
				adds.push(normalized[gname]);
			}
		}

		return { adds: adds, removes: removes };
	}


	function extendNodeProxy (baseNodeProxy) {
		return function nodeProxyWithclassMap (node) {
			var proxy = baseNodeProxy(node);

			if (proxy) {
				proxy = addCssStateHandlingToProxy(proxy);
			}

			return proxy;
		};
	}

	function addCssStateHandlingToProxy (proxy) {
		var getter, setter, scope, master;

		getter = proxy.get;
		setter = proxy.set;

		scope = oocssScope({}, {});
		master = scope.getStateMap();

		proxy.get = function getCssState (name) {
			if ('classState' == name) {
				return statesFromString(getter('className'), scope);
			}
			else if ('classMap' == name) {
				// Note: scope has been normalized
				return scope.getStateMap();
			}
			return getter(name);
		};

		proxy.set = function setCssState (name, value) {
			if ('classState' == name) {
				var tokens, classNames;
				tokens = normalizeStates(value);
				classNames = parseClassNames(tokens, master);
				value = spliceClassNames(getter('className'), classNames.removes, classNames.adds);
			}
			else if ('classMap' == name) {
				scope = normalizeMaster(value);
				return scope;
			}
			return setter(name, value);
		};

		return proxy;

	}

	function configureClassMap (resolver, facet, wire) {
		when(wire(facet.options), function (master) {

			return facet.set('classMap', master);

		}).then(resolver.resolve, resolver.reject);
	}

	var isArray, isObject, isString;
	(function (toString) {
		isArray = Array.isArray || function (obj) { return toString.call(obj) == '[object Array]'; };
		isObject = function (obj) { return toString.call(obj) == '[object Object]'; };
		isString = function (obj) { return toString.call(obj) == '[object String]'; };
	}(Object.prototype.toString));

	/***** borrowed from and improved upon cola/classList *****/

	var removeRxParts, trimLeadingRx;

	removeRxParts = /(\\s+|^)(XX)(\\b(?![\\-_])|$)/.toString().split('XX');
	trimLeadingRx = /^\s+/;

	/**
	 * Adds and removes class names to a tokenized, space-delimited string.
	 * @private
	 * @param className {String} current className
	 * @param removes {Array} class names to remove
	 * @param adds {Array} class names to add (note: required!)
	 * @returns {String} modified className
	 */
	function spliceClassNames (className, removes, adds) {
		var rx, strip, leftovers;
		// create regex to find all removes *and adds* since we're going to
		// remove them all to prevent duplicates.
		removes = removes.join('|');
		rx = new RegExp(removeRxParts.join(removes), 'g');
		// remove and clean up whitespace
		leftovers = className.replace(rx, '').replace(trimLeadingRx, '');
		// put the adds back in
		return (leftovers ? [leftovers].concat(adds) : adds).join(' ');
	}

	return oocssScope;

});
}(
	typeof define == 'function' && define.amd
		? define
		: function (deps, factory) { module.exports = factory(deps.map(require)); }
));
