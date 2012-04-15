(function (define) {
define(['wire/dom/base', 'when'], function (base, when) {
"use strict";

	/*
	TODO: forgot to allow mapping within the classMap arrays:
	classMap: {
		group1: 'state1:css-value1 state2:css-value2',
		group2: 'stateA:css-value3 stateB:css-value4'
	}
	 */


	var groupAttr,
		splitAtSpacesRx, replaceColonsOrStartRx,
		oocss, undef;

	groupAttr = 'data-wire-oocss-master';

	splitAtSpacesRx = /\s*/;
	replaceColonsOrStartRx = /^|:/g;

	oocss = {

		set: function (node, tokens) {
			var groups;
			groups = node.classMap || groupsFromString(node.getAttribute(groupAttr));
			tokens = normalizeStates(tokens, groups);
			tokens = computeCssState(groups, node.className, tokens);
			return node.className = tokens;
		},

		get: function (node) {
			var groups, tokens;
			// if node was cloned, the js property will be lost, so grab the node attribute
			groups = node.classMap || groupsFromString(node.getAttribute(groupAttr));
			// returns the normalized group with a toString() that converts to stringified version
			return statesFromString(node.className, groups);
		},

		setClassMap: function (node, groups) {
			groups = normalizeStates(groups);
			node.classMap = groups;
			node.setAttribute(groupAttr, groups.toString());
			return groups;
		},

		wire$plugin: function (ready, destroyed, options) {
			base.nodeProxy = extendNodeProxy(base.nodeProxy);
			return {
				facets: {
					// TODO: is this convenient as a facet or should we just let devs use the classMap pseudo-property?
					classMap: {
						configure: configureStates
					}
				}/*,
				proxies: [ cssProxy ]*/
			};
		}

	};

	/**
	 * Convert from "group:state1 group:state2" format or "state1 state2"
	 * @param string
	 * @param master {Object} a group that names the master set of groups
	 * @return {Object}
	 */
	function groupsFromString (string, master) {
		var groups, pairs, pair, gname;
		groups = {};
		pairs = string.split(splitAtSpacesRx);
		while ((pair = pairs.shift())) {
			pair = pair.split(':');
			gname = pair[1] ? pair[0] : '$';
			if (!master || gname in master) {
				if (!groups[gname]) groups[gname] = [];
				groups[gname].push(pair[1] || pair[0]);
			}
		}
		groups.toString = function () { return groupsToString(this); }
		return groups;
	}

	function groupsToString (groups) {
		var strings, gname;
		strings = [];
		for (gname in groups) {
			// convert to "group:state1 group:state2"
			groups[gname].join(':').replace(replaceColonsOrStartRx, ' ' + gname + ':');
		}
		return strings.join(' ');
	}

	/**
	 * Converts a string of classNames to an object whose property names
	 * are group names and whose values are arrays of strings representing
	 * the states selected in each group.  The object represents the
	 * partial set of states selected out of all states in all groups.
	 * @param string
	 */
	function statesFromString (string, master) {
		var groups, array, gname;
		groups = {};
		array = string.split(/\s*/);
		// for each group name, find values in string
		for (gname in master) {
			groups[gname] = subsetOfArray(master[gname], array);
		}
		groups.toString = function () { return groupsToString(this); }
		return groups;
	}

	/**
	 * Convert from tokenized string or an object of arrays or strings.
	 * The tokens in the string could be prefixed with tokens or not.
	 */
	function normalizeStates (states, master) {
		var groups, gname, group;
		if (isObject(states)) {
			groups = {};
			for (gname in states) {
				if (!master || gname in master) {
					group = states[gname];
					groups[gname] = isArray(group) ? group : group.split(' ');
					if (master) {
						groups[gname] = subsetOfArray(groups[gname], groups[name]);
					}
				}
			}
			return groups;
		}
		else {
			return groupsFromString(states, master);
		}
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
		var getter, setter, master;

		getter = proxy.get;
		setter = proxy.set;

		master = {};

		proxy.get = function getCssState (name) {
			if ('classState' == name) {
				return statesFromString(getter('className'), master);
			}
			else if ('classMap' == name) {
				// Note: master has been normalized
				return master;
			}
			return getter(name);
		};

		proxy.set = function setCssState (name, value) {
			if ('classState' == name) {
				value = normalizeStates(value, master);
				value = computeCssState(master, proxy.get('className'), value);
				name = 'className';
			}
			else if ('classMap' == name) {
				master = normalizeStates(value);
				return master;
			}
			return setter(name, value);
		};

		return proxy;

	}

	function computeCssState (groups, currTokens, newTokens) {
		var foundGroups, name, adds, removes;

		// TODO: do something if groups is undefined

		foundGroups = {};

		// normalize newTokens to an array of transformed oocss states
		// and collect groups at the same time
		if (isObject(newTokens)) {
			for (name in newTokens) {
				adds = translateTokens(newTokens[name], groups, newTokens[name], addGroup);
				addGroup(name);
			}
		} else {
			adds = translateTokens(newTokens, groups, undef, addGroup);
		}

		// iterate over group to create list of items to remove
		removes = [];
		for (name in foundGroups) {
			removes = removes.concat(translateTokens(groups[name], groups, groups[name], function () {}));
		}

		return spliceClassNames(currTokens, removes, adds);

		function addGroup (name) {
			foundGroups[name] = groups[name];
		}
	}

	function translateTokens (string, groups, defaultGroup, foundGroup) {
		var tokens, i, token, pair, result;

		i = 0;
		result = [];

		if (isArray(string)) {
			// process all strings in array
			tokens = string.slice(0);
			while ((token = tokens.pop())) {
				result = result.concat(translateTokens(token, groups, foundGroup));
			}
		}
		else {
			// split string and send back groups, returning array of tokens
			tokens = string.toString().split(/\s+/);
			while ((token = tokens.pop())) {
				pair = token.split(/\s*\.\s*/);
				if (pair[1] && pair[0] in groups) {
					// announce we found a group
					foundGroup(pair[0]);
					result.push(groups[pair[1]])
				}
				else if (pair[0] in defaultGroup) {
					// unprefixed token in default group
					result.push(defaultGroup[token]);
				}
				else {
					// assume untranslated class name
					result.push(token);
				}
			}
		}

		return result;
	}

	function configureStates (resolver, facet, wire) {
		when(wire(facet.options), function (master) {

			return facet.target.set('classMap', master);

		}).then(resolver.resolve, resolver.reject);
	}

	var isArray, isObject;
	isArray = Array.isArray || (function (toString) {
		return function (obj) { return toString.call(obj) == '[object Array]'; }
	}(Object.prototype.toString));
	isObject = (function (toString) {
		return function (obj) { return toString.call(obj) == '[object Object]'; }
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
		removes = removes.concat(adds).join('|');
		rx = new RegExp(removeRxParts.join(removes), 'g');
		// remove and clean up whitespace
		leftovers = className.replace(rx, '').replace(trimLeadingRx, '');
		// put the adds back in
		return (leftovers ? [leftovers].concat(adds) : adds).join(' ');
	}

	/**
	 *
	 * @param master {String}
	 * @param subset {String}
	 */
	function subsetOfArray (master, subset) {
		var wholestring, removes;
		wholestring = master.join(' ');
		removes = spliceClassNames(wholestring, subset, []);
		// TODO: this could be more efficient if spliceClassNames returned an array
		return spliceClassNames(wholestring, removes.split(/\s*/) , []);
	}

	return oocss;

});
}(
	typeof define == 'function' && define.amd
		? define
		: function (deps, factory) { module.exports = factory(deps.map(require)); }
));
