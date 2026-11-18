#!/usr/bin/env node
import { createRequire } from "node:module";
import { execFileSync, spawn } from "node:child_process";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import * as path from "node:path";
import { basename, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import zlib, { constants, zstdCompressSync, zstdDecompressSync } from "node:zlib";
import { createHash } from "node:crypto";
import { totalmem } from "node:os";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/cosmokit/lib/index.js
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
/** Define a non-enumerable writable property and return the object. */
function defineProperty(object, key, value) {
	return Object.defineProperty(object, key, {
		writable: true,
		value,
		enumerable: false
	});
}
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value) => is(type, value);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
/** Binary source detection and base64/hex conversion helpers. */
var Binary;
(function(Binary) {
	Binary.is = isArrayBufferLike;
	Binary.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	Binary.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	Binary.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	Binary.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	Binary.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
Binary.fromBase64;
Binary.toBase64;
Binary.fromHex;
Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result = [];
		refs.set(source, result);
		source.forEach((value, index) => {
			result[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
function deepEqual(a, b, strict) {
	if (a === b) return true;
	if (!strict && isNullable(a) && isNullable(b)) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;
	if (!a || !b) return false;
	function check(test, then) {
		return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
	}
	return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
		if (a.byteLength !== b.byteLength) return false;
		const viewA = new Uint8Array(a);
		const viewB = new Uint8Array(b);
		for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
		return true;
	}) ?? Object.keys({
		...a,
		...b
	}).every((key) => deepEqual(a[key], b[key], strict));
}
function tokenize(source, delimiters, delimiter) {
	const output = [];
	let state = 0;
	for (let i = 0; i < source.length; i++) {
		const code = source.charCodeAt(i);
		if (code >= 65 && code <= 90) {
			if (state === 1) {
				const next = source.charCodeAt(i + 1);
				if (next >= 97 && next <= 122) output.push(delimiter);
				output.push(code + 32);
			} else {
				if (state !== 0) output.push(delimiter);
				output.push(code + 32);
			}
			state = 1;
		} else if (code >= 97 && code <= 122) {
			output.push(code);
			state = 2;
		} else if (delimiters.includes(code)) {
			if (state !== 0) output.push(delimiter);
			state = 0;
		} else output.push(code);
	}
	return String.fromCharCode(...output);
}
/** Convert text to dash-delimited parameter case. */
function paramCase(source) {
	return tokenize(source, [45, 95], 45);
}
/** Runtime alias for `paramCase`. */
const hyphenate = paramCase;
/** Time constants plus parsing and formatting helpers. */
var Time;
(function(Time) {
	Time.millisecond = 1;
	Time.second = 1e3;
	Time.minute = Time.second * 60;
	Time.hour = Time.minute * 60;
	Time.day = Time.hour * 24;
	Time.week = Time.day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	Time.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	Time.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / Time.minute - offset) / 1440);
	}
	Time.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * Time.day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * Time.minute);
	}
	Time.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * Time.week || 0) + (parseFloat(capture[2]) * Time.day || 0) + (parseFloat(capture[3]) * Time.hour || 0) + (parseFloat(capture[4]) * Time.minute || 0) + (parseFloat(capture[5]) * Time.second || 0);
	}
	Time.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	Time.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= Time.day - Time.hour / 2) return Math.round(ms / Time.day) + "d";
		else if (abs >= Time.hour - Time.minute / 2) return Math.round(ms / Time.hour) + "h";
		else if (abs >= Time.minute - Time.second / 2) return Math.round(ms / Time.minute) + "m";
		else if (abs >= Time.second) return Math.round(ms / Time.second) + "s";
		return ms + "ms";
	}
	Time.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	Time.toDigits = toDigits;
	function template(template, time = /* @__PURE__ */ new Date()) {
		return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	Time.template = template;
})(Time || (Time = {}));
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/cordis/lib/index.js
/** Ordered collection of disposable values with O(1) deletion by value. */
var DisposableList = class {
	sn = 0;
	map = /* @__PURE__ */ new Map();
	weak = /* @__PURE__ */ new WeakMap();
	get length() {
		return this.map.size;
	}
	push(value) {
		const sn = ++this.sn;
		this.map.set(sn, value);
		this.weak.set(value, sn);
		return () => this.map.delete(sn);
	}
	delete(value) {
		const sn = this.weak.get(value);
		if (!sn) return false;
		return this.map.delete(sn);
	}
	clear() {
		const values = [...this.map.values()];
		this.map.clear();
		return values.reverse();
	}
	[Symbol.iterator]() {
		return this.map.values();
	}
	[Symbol.for("nodejs.util.inspect.custom")]() {
		return [...this];
	}
};
/** Shared symbols used to avoid public property-name collisions. */
const symbols = {
	shadow: Symbol.for("cordis.shadow"),
	receiver: Symbol.for("cordis.receiver"),
	original: Symbol.for("cordis.original"),
	metadata: Symbol.for("cordis.metadata"),
	initHooks: Symbol.for("cordis.initHooks"),
	checkProto: Symbol.for("cordis.checkProto"),
	effect: Symbol.for("cordis.effect"),
	filter: Symbol.for("cordis.filter"),
	isolate: Symbol.for("cordis.isolate"),
	intercept: Symbol.for("cordis.intercept"),
	init: Symbol.for("cordis.init"),
	check: Symbol.for("cordis.check"),
	config: Symbol.for("cordis.config"),
	invoke: Symbol.for("cordis.invoke"),
	extend: Symbol.for("cordis.extend"),
	tracker: Symbol.for("cordis.tracker"),
	resolveConfig: Symbol.for("cordis.resolveConfig")
};
const GeneratorFunction = function* () {}.constructor;
const AsyncGeneratorFunction = async function* () {}.constructor;
/** Return true when a plugin callback should be constructed with `new`. */
function isConstructor(func) {
	if (!func.prototype) return false;
	if (func instanceof GeneratorFunction) return false;
	if (AsyncGeneratorFunction !== Function && func instanceof AsyncGeneratorFunction) return false;
	return true;
}
/** Merge two prototype chains while preserving descriptors from `proto1`. */
function joinPrototype(proto1, proto2) {
	if (proto1 === Object.prototype) return proto2;
	const result = Object.create(joinPrototype(Object.getPrototypeOf(proto1), proto2));
	for (const key of Reflect.ownKeys(proto1)) Object.defineProperty(result, key, Object.getOwnPropertyDescriptor(proto1, key));
	return result;
}
/** Return true for non-null objects and functions. */
function isObject(value) {
	return value && (typeof value === "object" || typeof value === "function");
}
/** Find a property descriptor by walking an object's prototype chain. */
function getPropertyDescriptor(target, prop) {
	let proto = target;
	while (proto) {
		const desc = Reflect.getOwnPropertyDescriptor(proto, prop);
		if (desc) return desc;
		proto = Object.getPrototypeOf(proto);
	}
}
/** Wrap services/functions so method calls see the caller's active context. */
function getTraceable(ctx, value) {
	if (!isObject(value)) return value;
	if (Object.hasOwn(value, symbols.shadow)) return Object.getPrototypeOf(value);
	const tracker = value[symbols.tracker];
	if (!tracker) return value;
	return createTraceable(ctx, value, tracker);
}
/** Return a proxy that overlays readonly or writable properties onto a target. */
function withProps(target, props) {
	if (!props) return target;
	return new Proxy(target, {
		get: (target, prop, receiver) => {
			if (prop in props && prop !== "constructor") return Reflect.get(props, prop, receiver);
			return Reflect.get(target, prop, receiver);
		},
		set: (target, prop, value, receiver) => {
			if (prop in props && prop !== "constructor") return Reflect.set(props, prop, value, receiver);
			return Reflect.set(target, prop, value, receiver);
		}
	});
}
function withProp(target, prop, value) {
	return withProps(target, Object.defineProperty(Object.create(null), prop, {
		value,
		writable: false
	}));
}
function createShadow(ctx, target, property, receiver) {
	if (!property) return receiver;
	const origin = Reflect.getOwnPropertyDescriptor(target, property)?.value;
	if (!origin) return receiver;
	return withProp(receiver, property, ctx.extend({ [symbols.shadow]: origin }));
}
function createShadowMethod(ctx, value, outer, shadow) {
	return new Proxy(value, { apply: (target, thisArg, args) => {
		if (thisArg === outer) thisArg = shadow;
		return getTraceable(ctx, Reflect.apply(target, thisArg, args));
	} });
}
function createTraceable(ctx, value, tracker) {
	if (ctx[symbols.shadow] && !tracker.noShadow) ctx = Object.getPrototypeOf(ctx);
	const proxy = new Proxy(value, {
		get: (target, prop, receiver) => {
			if (prop === symbols.original) return target;
			if (prop === tracker.property) return ctx;
			if (typeof prop === "symbol") return Reflect.get(target, prop, receiver);
			if (tracker.associate && ctx.reflect.props[`${tracker.associate}.${prop}`]) return Reflect.get(ctx, `${tracker.associate}.${prop}`, withProp(ctx, symbols.receiver, receiver));
			let shadow, innerValue;
			const desc = getPropertyDescriptor(target, prop);
			if (desc && "value" in desc) innerValue = desc.value;
			else {
				shadow = createShadow(ctx, target, tracker.property, receiver);
				innerValue = Reflect.get(target, prop, shadow);
			}
			const innerTracker = innerValue?.[symbols.tracker];
			if (innerTracker) return createTraceable(ctx, innerValue, innerTracker);
			else if (!tracker.noShadow && typeof innerValue === "function") {
				shadow ??= createShadow(ctx, target, tracker.property, receiver);
				return createShadowMethod(ctx, innerValue, receiver, shadow);
			} else return innerValue;
		},
		set: (target, prop, value, receiver) => {
			if (prop === symbols.original) return false;
			if (prop === tracker.property) return false;
			if (typeof prop === "symbol") return Reflect.set(target, prop, value, receiver);
			if (tracker.associate && ctx.reflect.props[`${tracker.associate}.${prop}`]) return Reflect.set(ctx, `${tracker.associate}.${prop}`, value, withProp(ctx, symbols.receiver, receiver));
			const shadow = createShadow(ctx, target, tracker.property, receiver);
			return Reflect.set(target, prop, value, shadow);
		},
		apply: (target, thisArg, args) => {
			return applyTraceable(proxy, target, thisArg, args);
		}
	});
	return proxy;
}
function applyTraceable(proxy, value, thisArg, args) {
	if (!value[symbols.invoke]) return Reflect.apply(value, thisArg, args);
	return value[symbols.invoke].apply(proxy, args);
}
/** Create a callable service object that dispatches through `symbols.invoke`. */
function createCallable(name, proto, tracker) {
	const self = function(...args) {
		return applyTraceable(createTraceable(self["ctx"], self, tracker), self, this, args);
	};
	defineProperty(self, "name", name);
	return Object.setPrototypeOf(self, proto);
}
function handleError(info, reason, getOuterStack) {
	const innerLines = info.error.stack.split("\n");
	if (typeof reason?.stack !== "string") {
		const outerError = new Error(reason);
		const lines = outerError.stack.split("\n");
		lines.splice(1, Infinity, ...getOuterStack());
		outerError.stack = lines.join("\n");
		throw outerError;
	}
	const lines = reason.stack.split("\n");
	let index = lines.indexOf(innerLines[2]);
	if (index === -1) throw reason;
	index -= info.offset;
	while (index > 0) {
		if (!lines[index - 1].endsWith(" (<anonymous>)")) break;
		index -= 1;
	}
	lines.splice(index, Infinity, ...getOuterStack());
	reason.stack = lines.join("\n");
	throw reason;
}
/** Run a callback and splice outer call-site frames into thrown async errors. */
function composeError(callback, getOuterStack = buildOuterStack()) {
	const info = {
		offset: 1,
		error: /* @__PURE__ */ new Error()
	};
	try {
		const result = callback(info);
		if (isObject(result) && "then" in result) return result.then(void 0, (reason) => handleError(info, reason, getOuterStack));
		else return result;
	} catch (reason) {
		handleError(info, reason, getOuterStack);
	}
}
/** Capture a lazy stack-frame supplier for later error composition. */
function buildOuterStack(offset = 0) {
	const outerError = /* @__PURE__ */ new Error();
	return () => outerError.stack.split("\n").slice(3 + offset);
}
/**
* Return whether an event result should stop a bail-style dispatch.
*
* @param value — a listener's return value.
* @returns `true` unless `value` is `null`, `false`, or `undefined`.
*/
function isBailed(value) {
	return value !== null && value !== false && value !== void 0;
}
/**
* Event bus installed as `ctx.events` and mixed into every context.
*
* The service supports concurrent, synchronous, serial, bail, and waterfall
* dispatch and automatically disposes listeners with their owning fiber.
*/
var EventsService = class {
	ctx;
	_hooks = {};
	constructor(ctx) {
		this.ctx = ctx;
		defineProperty(this, symbols.tracker, {
			property: "ctx",
			noShadow: true
		});
		this.on("internal/listener", function(name, listener, options) {
			if (name === "internal/update" && !options.global) return (this.fiber._hooks["internal/update"] ??= new DisposableList())[options.prepend ? "unshift" : "push"](listener);
		});
		this.on("internal/update", function(config, noSave, next) {
			const cbs = [...this._hooks["internal/update"] || []];
			const _next = () => {
				return (cbs.shift() ?? next).call(this, config, noSave, _next);
			};
			return _next();
		}, {
			global: true,
			prepend: true
		});
	}
	/**
	* Resolve listeners for one dispatch and apply context filtering.
	*
	* @param type — the dispatch mode, reported on `internal/dispatch`.
	* @param args — the raw dispatch arguments; consumed up to the event name.
	* @returns the matching listener callbacks, bound to the dispatch `this`.
	*/
	dispatch(type, args) {
		const thisArg = typeof args[0] === "object" || typeof args[0] === "function" ? args.shift() : null;
		const name = args.shift();
		if (!name.startsWith("internal/")) this.emit("internal/dispatch", type, name, args, thisArg);
		const filter = thisArg?.[Context.filter];
		return (this._hooks[name] || []).filter((hook) => hook.global || !filter || filter.call(thisArg, hook.ctx)).map((hook) => hook.callback.bind(thisArg));
	}
	/**
	* Run listeners concurrently and wait for all of them.
	*
	* @param args — optional `this`, the event name, then listener arguments.
	* @returns a promise resolving once every listener has settled.
	*/
	async parallel(...args) {
		const errors = (await Promise.allSettled(this.dispatch("emit", args).map(async (cb) => cb(...args)))).filter((result) => result.status === "rejected");
		if (errors.length) throw new AggregateError(errors.map((error) => error.reason));
	}
	/**
	* Run listeners synchronously without waiting for returned promises.
	*
	* @param args — optional `this`, the event name, then listener arguments.
	*/
	emit(...args) {
		this.dispatch("emit", args).map((cb) => cb(...args));
	}
	/**
	* Run listeners in order, awaiting each, until one returns a bail value.
	*
	* @param args — optional `this`, the event name, then listener arguments.
	* @returns the first bail value (see {@link isBailed}), if any.
	*/
	async serial(...args) {
		for (const cb of this.dispatch("serial", args)) {
			const result = await cb(...args);
			if (isBailed(result)) return result;
		}
	}
	/**
	* Run listeners synchronously until one returns a bail value.
	*
	* @param args — optional `this`, the event name, then listener arguments.
	* @returns the first bail value (see {@link isBailed}), if any.
	*/
	bail(...args) {
		for (const cb of this.dispatch("bail", args)) {
			const result = cb(...args);
			if (isBailed(result)) return result;
		}
	}
	/**
	* Compose listeners around the final `next` callback.
	*
	* The last dispatch argument is treated as the innermost `next`. Listeners
	* run outermost-first; a listener that does not call `next()` vetoes the
	* rest of the chain, including the built-in behavior.
	*
	* @param args — optional `this`, the event name, listener arguments, then `next`.
	* @returns the outermost listener's return value.
	*/
	waterfall(...args) {
		const cbs = this.dispatch("waterfall", args);
		const inner = args.pop();
		const next = () => {
			return (cbs.shift() ?? inner)(...args);
		};
		args.push(next);
		return next();
	}
	/**
	* Store a listener record as an effect on the current fiber.
	*
	* @param label — effect label shown in fiber diagnostics.
	* @param hooks — the listener list for one event.
	* @param callback — the listener to store.
	* @param options — placement and filtering options.
	* @returns a disposer that unregisters the listener.
	*/
	register(label, hooks, callback, options) {
		const method = options.prepend ? "unshift" : "push";
		return this.ctx.fiber.effect(() => {
			hooks[method]({
				ctx: this.ctx,
				callback,
				...options
			});
			return () => this.unregister(hooks, callback);
		}, label);
	}
	/**
	* Remove a stored listener record.
	*
	* @param hooks — the listener list for one event.
	* @param callback — the listener to remove.
	* @returns `true` if the listener was found and removed.
	*/
	unregister(hooks, callback) {
		const index = hooks.findIndex((hook) => hook.callback === callback);
		if (index >= 0) {
			hooks.splice(index, 1);
			return true;
		}
	}
	/**
	* Register an event listener owned by the current fiber.
	*
	* The listener is removed automatically when the fiber unloads. Throws
	* `CordisError('INACTIVE_EFFECT')` if the fiber is already disposed.
	*
	* @param name — the event name to listen for.
	* @param listener — called with the dispatch arguments.
	* @param options — listener options; a boolean is shorthand for `prepend`.
	* @returns a disposer removing the listener; `true` if it was still registered.
	*/
	on(name, listener, options) {
		if (typeof options !== "object") options = { prepend: options };
		this.ctx.fiber.assertActive();
		listener = this.ctx.reflect.bind(listener);
		const result = this.bail(this.ctx, "internal/listener", name, listener, options);
		if (result) return result;
		const hooks = this._hooks[name] ||= [];
		const label = `ctx.on(${typeof name === "string" ? JSON.stringify(name) : name.toString()})`;
		return this.register(label, hooks, listener, options);
	}
	/**
	* Register an event listener that disposes itself after the first call.
	*
	* @param name — the event name to listen for.
	* @param listener — called at most once with the dispatch arguments.
	* @param options — listener options; a boolean is shorthand for `prepend`.
	* @returns a disposer removing the listener; `true` if it was still registered.
	*/
	once(name, listener, options) {
		const dispose = this.on(name, function(...args) {
			dispose();
			return listener.apply(this, args);
		}, options);
		return dispose;
	}
};
/** Built-in placeholder formatters used by `Logger.format()`. */
const defaultFormatters = {
	s: (value) => String(value),
	d: (value) => Math.trunc(Number(value)),
	i: (value) => Math.trunc(Number(value)),
	f: (value) => Number(value),
	o: (value) => JSON.stringify(value),
	O: (value) => JSON.stringify(value),
	c: () => "",
	C: (value, exporter, message) => {
		return Logger.color(exporter, Logger.code(message.name, exporter.colors), value);
	}
};
function isAggregateError(error) {
	return error instanceof Error && Array.isArray(error["errors"]);
}
/** Logger facade for one named subsystem. */
var Logger = class {
	service;
	static color(exporter, code, value, decoration = "") {
		if (!exporter.colors) return "" + value;
		return `\u001b[3${code < 8 ? code : "8;5;" + code}${exporter.colors >= 2 ? decoration : ""}m${value}\u001b[0m`;
	}
	static code(name, level) {
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = (hash << 3) - hash + name.charCodeAt(i) + 13;
			hash |= 0;
		}
		const colors = !level ? [] : level >= 2 ? c256 : c16;
		return colors[Math.abs(hash) % colors.length];
	}
	static format(exporter, message) {
		const args = message.args.slice();
		if (args[0] instanceof Error) {
			args[0] = args[0].stack || args[0].message;
			args.unshift("%s");
		} else if (typeof args[0] !== "string") args.unshift("%o");
		let format = args.shift();
		format = format.replace(/%([a-zA-Z%])/g, (match, char) => {
			if (match === "%%") return "%";
			const formatter = exporter.formatters?.[char] ?? defaultFormatters[char];
			if (typeof formatter === "function") return formatter(args.shift(), exporter, message);
			return match;
		});
		const oFormatter = exporter.formatters?.o ?? defaultFormatters.o;
		for (let arg of args) {
			if (typeof arg === "object" && arg) arg = oFormatter(arg, exporter, message);
			format += " " + arg;
		}
		const { maxLength = 10240 } = exporter;
		return format.split(/\r?\n/g).map((line) => {
			return line.slice(0, maxLength) + (line.length > maxLength ? "..." : "");
		}).join("\n");
	}
	constructor(options, service) {
		this.service = service;
		Object.assign(this, options);
		this.error = this._method("error", 0);
		this.info = this._method("info", 1);
		this.warn = this._method("warn", 2);
		this.debug = this._method("debug", 3);
	}
	_method(type, level) {
		return (...args) => {
			if (args.length === 1 && args[0] instanceof Error) {
				if (args[0].cause) this[type](args[0].cause);
				else if (isAggregateError(args[0])) {
					args[0].errors.forEach((error) => this[type](error));
					return;
				}
			}
			const sn = ++this.service._snMessage;
			const ts = Date.now();
			for (const exporter of this.service.exporters.values()) {
				if ((exporter.levels?.[this.name] ?? exporter.levels?.default ?? this.level ?? 1) < level) continue;
				const message = {
					sn,
					ts,
					type,
					level,
					name: this.name,
					...this.meta,
					args
				};
				exporter.export(message);
			}
		};
	}
};
/** ANSI 16-color palette indexes used for logger name coloring. */
const c16 = [
	6,
	2,
	3,
	4,
	5,
	1
];
/** ANSI 256-color palette indexes used for logger name coloring. */
const c256 = [
	20,
	21,
	26,
	27,
	32,
	33,
	38,
	39,
	40,
	41,
	42,
	43,
	44,
	45,
	56,
	57,
	62,
	63,
	68,
	69,
	74,
	75,
	76,
	77,
	78,
	79,
	80,
	81,
	92,
	93,
	98,
	99,
	112,
	113,
	129,
	134,
	135,
	148,
	149,
	160,
	161,
	162,
	163,
	164,
	165,
	166,
	167,
	168,
	169,
	170,
	171,
	172,
	173,
	178,
	179,
	184,
	185,
	196,
	197,
	198,
	199,
	200,
	201,
	202,
	203,
	204,
	205,
	206,
	207,
	208,
	209,
	214,
	215,
	220,
	221
];
/**
* Built-in logging service.
*
* Call `ctx.logger()` to create a named logger, or call `ctx.logger.info()`
* directly to log with the current fiber-derived name.
*/
var LoggerService = class LoggerService {
	bufferSize = 1e3;
	buffer = [];
	ctx;
	_snMessage = 0;
	_snExporter = 0;
	exporters = /* @__PURE__ */ new Map();
	constructor(ctx) {
		const tracker = {
			property: "ctx",
			noShadow: true
		};
		const self = createCallable("logger", joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker);
		Object.assign(self, this);
		self.ctx = ctx;
		defineProperty(self, symbols.tracker, tracker);
		self.exporter({
			colors: 3,
			export: (message) => {
				self.buffer.push(message);
				if (self.buffer.length > self.bufferSize) self.buffer = self.buffer.slice(-self.bufferSize);
			}
		});
		return self;
	}
	/**
	* Register an exporter and dispose it with the current fiber.
	*
	* @param exporter — the sink that receives structured log messages.
	* @returns a disposer that removes the exporter.
	*/
	exporter(exporter) {
		return this.ctx.effect(() => {
			this.exporters.set(++this._snExporter, exporter);
			return () => this.exporters.delete(this._snExporter);
		}, "ctx.logger.exporter()");
	}
	_resolveConfig() {
		let intercept = this.ctx[symbols.intercept];
		const configs = [];
		while ("logger" in intercept) {
			if (Object.hasOwn(intercept, "logger")) configs.unshift(intercept["logger"]);
			intercept = Object.getPrototypeOf(intercept);
		}
		return Object.assign({}, ...configs);
	}
	[symbols.invoke](name) {
		const config = this._resolveConfig();
		const fiber = (this.ctx[symbols.shadow] ?? this.ctx).fiber;
		name ??= config.name;
		name ??= hyphenate(fiber.name);
		return new Logger({
			name,
			level: config.level,
			meta: { fiber: new WeakRef(fiber) }
		}, this);
	}
	static {
		for (const type of [
			"error",
			"info",
			"warn",
			"debug"
		]) LoggerService.prototype[type] = function(...args) {
			return this()[type](...args);
		};
	}
};
function enhanceError(error) {
	const lines = error.stack.split("\n");
	lines.splice(0, 2, `Error: ${error.message}`);
	error.stack = lines.join("\n");
	return error;
}
const RESERVED_WORDS = ["prototype", "then"];
function isSpecialProperty(prop) {
	return typeof prop === "symbol" || RESERVED_WORDS.includes(prop) || parseInt(prop).toString() === prop || prop.startsWith("_");
}
/**
* Reflection and service-resolution layer installed as `ctx.reflect`.
*
* This service powers the context proxy, service registration, accessors, and
* the mixins that expose core service methods directly on `ctx`.
*/
var ReflectService = class {
	ctx;
	/** Proxy traps implementing service resolution for every context object. */
	static handler = {
		get: (target, prop, ctx) => {
			if (isSpecialProperty(prop)) return Reflect.get(target, prop, ctx);
			if (Reflect.has(target, prop)) return getTraceable(ctx, Reflect.get(target, prop, ctx));
			const error = /* @__PURE__ */ new Error(`cannot get property "${prop}" without inject`);
			try {
				const def = target.reflect.props[prop];
				if (def?.type === "accessor") return def.get.call(ctx, ctx[symbols.receiver], error);
				if (!ctx.fiber.runtime) return ctx.reflect.get(prop, false);
				return ctx.events.waterfall("internal/get", ctx, prop, error, () => {
					const key = target[symbols.isolate][prop];
					let fiber = (ctx[symbols.shadow] ?? ctx).fiber;
					while (true) {
						const impl = fiber.store?.[prop];
						if (impl) return getTraceable(ctx, impl.value);
						if (prop in fiber.inject) {
							error.message = `cannot get required service "${prop}" in inactive context`;
							throw error;
						}
						if (!fiber.runtime) throw error;
						if (fiber.parent[symbols.isolate][prop] !== key) throw error;
						fiber = fiber.parent.fiber;
					}
				});
			} catch (e) {
				throw e === error ? enhanceError(e) : e;
			}
		},
		set: (target, prop, value, ctx) => {
			if (isSpecialProperty(prop)) return Reflect.set(target, prop, value, ctx);
			const error = /* @__PURE__ */ new Error(`cannot set property "${prop}" without provide`);
			const def = target.reflect.props[prop];
			if (!def) {
				if (!ctx.fiber.runtime) return Reflect.set(target, prop, value, ctx);
				throw enhanceError(error);
			}
			try {
				if (def.type === "accessor") {
					if (!def.set) return false;
					return def.set.call(ctx, value, ctx[symbols.receiver], error);
				}
				return ctx.events.waterfall("internal/set", ctx, prop, value, error, () => {
					return ctx.reflect.set(prop, value, error);
				});
			} catch (e) {
				throw e === error ? enhanceError(e) : e;
			}
		},
		has: (target, prop) => {
			if (isSpecialProperty(prop)) return Reflect.has(target, prop);
			if (Reflect.has(target, prop)) return true;
			return !!target.reflect.props[prop];
		}
	};
	/** Service implementations, keyed by isolation label. */
	store = Object.create(null);
	/** Declared context properties (services and accessors), by name. */
	props = Object.create(null);
	constructor(ctx) {
		this.ctx = ctx;
		defineProperty(this, symbols.tracker, {
			property: "ctx",
			noShadow: true
		});
		this.mixin("reflect", [
			"get",
			"set",
			"provide",
			"accessor",
			"mixin"
		]);
		this.mixin("fiber", ["runtime", "effect"]);
		this.mixin("registry", ["inject", "plugin"]);
		this.mixin("events", [
			"on",
			"once",
			"parallel",
			"emit",
			"serial",
			"bail",
			"waterfall"
		]);
	}
	/**
	* Read a service from the store without the inject requirement.
	*
	* @param name — the service name.
	* @param strict — when `true`, only return implementations whose providing
	* fiber is currently active.
	* @returns the service value, or `undefined` when not (yet) provided.
	*/
	get(name, strict = true) {
		return getTraceable(this.ctx, this._getImpl(name, strict)?.value);
	}
	_getImpl(name, strict = true) {
		const key = this.ctx[symbols.isolate][name];
		const impl = key && this.store[key];
		if (!impl) return;
		if (strict && impl.fiber.state !== 2) return;
		return impl;
	}
	/**
	* Overwrite a provided service's value.
	*
	* @param name — the service name.
	* @param value — the new service value.
	* @param error — carrier for the caller stack in diagnostics.
	* @returns `true` on success.
	* @throws when `name` was never provided, or was provided by another fiber.
	*/
	set(name, value, error) {
		const key = this.ctx[symbols.isolate][name];
		const impl = this.store[key];
		if (!impl) throw new Error(`cannot set property "${name}" without provide`);
		if (impl.fiber !== this.ctx.fiber) throw new Error(`cannot set property "${name}" in multiple fibers`);
		impl.value = value;
		return true;
	}
	/**
	* Register a service implementation owned by the current fiber.
	*
	* See the `ctx.provide()` overload above for the full contract.
	*
	* @param name — the service name.
	* @param value — the service value.
	* @param check — optional availability predicate for dependents.
	* @returns a disposer that unregisters the service.
	*/
	provide(name, value, check) {
		return this.ctx.fiber.effect(() => {
			if (!this.props[name]) this.props[name] ??= { type: "service" };
			else if (this.props[name].type !== "service") throw new Error(`property "${name}" is already declared as ${this.props[name].type}`);
			this.props[name] = { type: "service" };
			this.ctx.root[symbols.isolate][name] ??= Symbol(name);
			const key = this.ctx[symbols.isolate][name];
			const impl = {
				name,
				value,
				fiber: this.ctx.fiber,
				check
			};
			if (this.store[key]) throw new Error(`service "${name}" has been registered at <${this.store[key].fiber.name}>`);
			this.store[key] = impl;
			this.ctx.fiber.store[name] = impl;
			if (this.ctx.fiber.state === 2) this.notify([name]);
			return async () => {
				delete this.store[key];
				const fibers = this.notify([name]);
				await Promise.allSettled(fibers.map((fiber) => fiber.await()));
				delete this.ctx.fiber.store[name];
			};
		}, `ctx.provide(${JSON.stringify(name)})`);
	}
	/**
	* Re-evaluate every fiber that requires one of the given services.
	*
	* @param names — the service names that changed.
	* @param filter — restricts notification to matching isolation scopes.
	* @returns the fibers whose dependency state was refreshed.
	*/
	notify(names, filter = (ctx, name) => ctx[symbols.isolate][name] === this.ctx[symbols.isolate][name]) {
		const fibers = [];
		for (const runtime of this.ctx.registry.values()) for (const fiber of runtime.fibers) {
			let hasUpdate = false;
			for (const name of names) {
				if (!(name in fiber.inject)) continue;
				if (!filter(fiber.ctx, name)) continue;
				hasUpdate = true;
				fiber._checkImpl(name);
			}
			if (!hasUpdate) continue;
			fiber._refresh();
			fibers.push(fiber);
		}
		for (const name of names) {
			const self = Object.create(this.ctx);
			self[symbols.filter] = (target) => filter(target, name);
			this.ctx.events.emit(self, "internal/service", name, this._getImpl(name, false)?.value);
		}
		return fibers;
	}
	/**
	* Define a computed context property backed by get/set hooks.
	*
	* @param name — the context property name.
	* @param options — the `get` hook and optional `set` hook.
	* @returns a disposer that removes the accessor.
	*/
	accessor(name, options) {
		return this.ctx.fiber.effect(() => {
			if (name in this.props) throw new Error(`property "${name}" is already declared as ${this.props[name].type}`);
			this.props[name] = {
				type: "accessor",
				...options
			};
			return () => delete this.props[name];
		}, `ctx.accessor(${JSON.stringify(name)})`);
	}
	/**
	* Expose selected members of a service directly on `ctx`.
	*
	* See the `ctx.mixin()` overload above for the full contract.
	*
	* @param source — a context property name or a source object.
	* @param mixins — keys to forward, or a source-key → ctx-key map.
	* @returns a disposer that removes all created accessors.
	*/
	mixin(source, mixins) {
		const self = this;
		return this.ctx.fiber.effect(function* () {
			const entries = Array.isArray(mixins) ? mixins.map((key) => [key, key]) : Object.entries(mixins);
			const getTarget = (ctx, error) => {
				return ctx[source];
			};
			for (const [key, value] of entries) yield self.accessor(value, {
				get(receiver, error) {
					const service = getTarget(this, error);
					if (isNullable(service)) return service;
					const mixin = receiver ? withProps(receiver, service) : service;
					const value = Reflect.get(service, key, mixin);
					if (typeof value !== "function") return value;
					return value.bind(mixin ?? service);
				},
				set(value, receiver, error) {
					const service = getTarget(this, error);
					const mixin = receiver ? withProps(receiver, service) : service;
					return Reflect.set(service, key, value, mixin);
				}
			});
		}, `ctx.mixin(${JSON.stringify(source)})`);
	}
	/**
	* Attach this context's tracing wrapper to a value.
	*
	* @param value — the value to wrap.
	* @returns the traceable wrapper (or the value itself when not applicable).
	*/
	trace(value) {
		return getTraceable(this.ctx, value);
	}
	/**
	* Wrap a callback so calls trace `this` and arguments to this context.
	*
	* @param callback — the function to wrap.
	* @returns a proxy delegating to `callback` with traced values.
	*/
	bind(callback) {
		return new Proxy(callback, {
			apply: (target, thisArg, args) => {
				return Reflect.apply(target, this.trace(thisArg), args.map((arg) => this.trace(arg)));
			},
			construct: (target, args, newTarget) => {
				return Reflect.construct(target, args.map((arg) => this.trace(arg)), newTarget);
			}
		});
	}
};
const kValidationError$1 = Symbol.for("ValidationError");
/** Error raised when plugin configuration fails standard-schema validation. */
var ValidationError$1 = class extends TypeError {
	name = "ValidationError";
	/**
	* Build the aggregated message from schema issues.
	*
	* @param issues — the standard-schema issues, one message line each.
	*/
	constructor(issues) {
		super(`invalid config:\n` + issues.map((issue) => {
			if (issue.path) return `  - ${issue.message} (at ${issue.path.join(".")})`;
			else return `  - ${issue.message}`;
		}).join("\n"));
	}
};
Object.defineProperty(ValidationError$1.prototype, kValidationError$1, { value: true });
/**
* Validate and normalize config for a plugin runtime before it starts.
*
* @param runtime — the plugin runtime whose `Config` schema to apply.
* @param config — the raw user config.
* @returns the validated config, or `config` unchanged if the runtime has no schema.
* @throws {ValidationError} when validation reports issues.
*/
function resolveConfig(runtime, config) {
	if (!runtime.Config) return config;
	const result = runtime.Config["~standard"].validate(config);
	if ("then" in result) throw new TypeError("Async config validation is not supported");
	if (result.issues) throw new ValidationError$1(result.issues);
	else return result.value;
}
const effectInertia = /* @__PURE__ */ new WeakMap();
function runDisposable(dispose) {
	const result = dispose();
	return effectInertia.get(dispose)?.() ?? result;
}
/** Notify plugin teardown without allowing one observer to break ownership cleanup. */
function emitPluginDisposed(context, fiber) {
	const args = ["internal/plugin", fiber];
	let callbacks;
	try {
		callbacks = context.events.dispatch("emit", args);
	} catch (error) {
		context.logger.error(error);
		return;
	}
	for (const callback of callbacks) try {
		const returned = callback(...args);
		Promise.resolve(returned).catch((error) => context.logger.error(error));
	} catch (error) {
		context.logger.error(error);
	}
}
/** Framework error with a stable machine-readable code. */
var CordisError = class CordisError extends Error {
	code;
	/**
	* @param code — the stable error code; also the default message.
	* @param message — optional human-readable override.
	*/
	constructor(code, message) {
		super(message ?? CordisError.Code[code]);
		this.code = code;
	}
};
/** Cordis error code definitions. */
(function(CordisError) {
	CordisError.Code = { INACTIVE_EFFECT: "cannot create effect on inactive context" };
})(CordisError || (CordisError = {}));
const INACTIVE = "__INACTIVE__";
/**
* Runtime instance of one plugin application.
*
* A fiber tracks dependency state, validated config, lifecycle effects, and
* cleanup for the plugin context returned by `ctx.plugin()`.
*/
var Fiber = class {
	parent;
	inject;
	runtime;
	/** Unique id within the registry; 0 for the root fiber, `null` once disposed. */
	uid;
	/** The context this fiber's plugin runs in (extends the parent context). */
	ctx;
	/** The validated plugin config (updated by `update()`). */
	config;
	/** The raw plugin config, re-resolved before each activation. */
	_config;
	/** Current lifecycle state; transitions emit `internal/status`. */
	state = 0;
	/** Dispose this fiber: unload the plugin, then settle once cleanup finished. */
	dispose;
	/** Snapshot of required service implementations while loaded; `undefined` otherwise. */
	store;
	/** The in-flight load/unload transition, if one is currently running. */
	inertia;
	_hooks = Object.create(null);
	_disposables = new DisposableList();
	context;
	_error;
	_runner;
	_store = Object.create(null);
	/**
	* Create a fiber. Plugin authors normally obtain fibers from `ctx.plugin()`
	* rather than constructing them directly.
	*
	* @param parent — the context the plugin was loaded from.
	* @param config — raw config, validated against the runtime's schema.
	* @param inject — resolved dependency map (service name → intercept config).
	* @param runtime — the shared plugin runtime, or `null` for the root fiber.
	* @param getOuterStack — captures the caller stack for effect diagnostics.
	*/
	constructor(parent, config, inject, runtime, getOuterStack) {
		this.parent = parent;
		this.inject = inject;
		this.runtime = runtime;
		this._config = config;
		const collect = (dispose) => {
			this._disposables.push(dispose);
		};
		if (runtime) {
			this.uid = parent.registry.counter;
			this.ctx = this.context = parent.extend({ fiber: this });
			const injectEntries = Object.entries(this.inject);
			if (injectEntries.length) {
				this.ctx[Context.intercept] = Object.create(parent[Context.intercept]);
				for (const [name, config] of injectEntries) {
					if (isNullable(config)) continue;
					this.ctx[Context.intercept][name] = config;
				}
			}
			this._runner = {
				epoch: INACTIVE,
				getOuterStack,
				execute: function() {
					if (isConstructor(runtime.callback)) {
						const instance = new runtime.callback(this.ctx, this.config);
						for (const hook of instance?.[symbols.initHooks] ?? []) hook();
						return instance?.[symbols.init]?.();
					} else return runtime.callback(this.ctx, this.config);
				},
				collect
			};
			this.dispose = parent.fiber.effect(() => {
				const remove = runtime.fibers.push(this);
				return async () => {
					this.uid = null;
					emitPluginDisposed(this.context, this);
					if (this.ctx.registry.has(runtime.callback)) {
						remove();
						if (!runtime.fibers.length) this.ctx.registry.delete(runtime.callback);
					}
					this._setEpoch(INACTIVE);
					if (!this.inertia) this._updateState(() => {
						this.inertia = this._unload();
						return 5;
					});
					while (this.inertia) await this.inertia;
				};
			}, "ctx.plugin()");
			try {
				this.context.emit("internal/plugin", this);
			} catch (error) {
				Promise.resolve(this.dispose()).catch((reason) => this.ctx.logger.error(reason));
				throw error;
			}
			if (this.uid !== null && parent.fiber.state !== 5) {
				for (const name of Object.keys(this.inject)) this._checkImpl(name);
				this._refresh();
			}
		} else {
			this.uid = 0;
			this.ctx = this.context = parent;
			this.state = 2;
			this.store = Object.create(null);
			this._runner = {
				epoch: "",
				getOuterStack,
				execute: () => {},
				collect
			};
			this.dispose = () => this.restart();
		}
	}
	/** The plugin's display name, inherited from the nearest named ancestor, else `'root'`. */
	get name() {
		let fiber = this;
		do {
			if (fiber.runtime?.name) return fiber.runtime.name;
			fiber = fiber.parent.fiber;
		} while (fiber !== fiber.parent.fiber);
		return "root";
	}
	/**
	* Throw if the fiber has already been disposed.
	*
	* @returns nothing when the fiber is still active.
	* @throws {CordisError} `INACTIVE_EFFECT` when the fiber's uid has been cleared.
	*/
	assertActive() {
		if (this.uid !== null) return;
		throw new CordisError("INACTIVE_EFFECT");
	}
	_execute(runner) {
		const oldEpoch = runner.epoch;
		return composeError((info) => {
			const safeCollect = (dispose) => {
				if (typeof dispose === "function") runner.collect(dispose);
				else if (!isNullable(dispose)) throw new TypeError("Invalid effect");
			};
			const effect = runner.execute.call(this);
			if (typeof effect === "function") return runner.collect(effect);
			else if (isNullable(effect)) {} else if (!isObject(effect)) throw new TypeError("Invalid effect");
			else if ("then" in effect) return effect.then(safeCollect);
			else if (Symbol.iterator in effect) {
				info.error = /* @__PURE__ */ new Error();
				const iter = effect[Symbol.iterator]();
				while (true) {
					const result = iter.next();
					safeCollect(result.value);
					if (result.done) return;
				}
			} else if (Symbol.asyncIterator in effect) {
				const iter = effect[Symbol.asyncIterator]();
				return (async () => {
					await Promise.resolve();
					info.error = /* @__PURE__ */ new Error();
					while (true) {
						if (runner.epoch !== oldEpoch) return;
						const result = await iter.next();
						safeCollect(result.value);
						if (result.done) return;
					}
				})();
			} else throw new TypeError("Invalid effect");
		}, runner.getOuterStack);
	}
	effect(execute, label = "anonymous") {
		this.assertActive();
		if (this.state === 5) throw new CordisError("INACTIVE_EFFECT");
		const disposables = [];
		let disposing = false;
		let disposalTask;
		const dispose = () => {
			if (disposing) return disposalTask;
			disposing = true;
			let task;
			for (const disposable of disposables.splice(0).reverse()) if (task) task = task.then(() => runDisposable(disposable));
			else {
				const result = runDisposable(disposable);
				if (isObject(result) && "then" in result) task = result;
			}
			return disposalTask = task;
		};
		const meta = {
			label,
			children: []
		};
		const runner = {
			execute,
			epoch: true,
			collect: (dispose) => {
				disposables.push(dispose);
				this._disposables.delete(dispose);
				if (dispose[symbols.effect]) meta.children.push(dispose[symbols.effect]);
			},
			getOuterStack: buildOuterStack()
		};
		let task;
		let executing = true;
		let resolveSetup;
		let rejectSetup;
		let setupBarrier;
		let setupFailed = false;
		let inFlight;
		let removeWrapper = () => false;
		const waitForSetup = () => {
			setupBarrier ??= new Promise((resolve, reject) => {
				resolveSetup = resolve;
				rejectSetup = reject;
			});
			return setupBarrier;
		};
		const disposeAfter = (setup) => {
			return Promise.resolve(setup).then(() => dispose(), async (reason) => {
				await dispose();
				throw reason;
			});
		};
		const finalizeDisposal = (callback) => {
			let result;
			try {
				result = callback();
			} catch (error) {
				removeWrapper();
				throw error;
			}
			if (isObject(result) && "then" in result) {
				const pending = Promise.resolve(result).finally(() => {
					removeWrapper();
					if (inFlight === pending) inFlight = void 0;
				});
				return inFlight = pending;
			}
			removeWrapper();
			return result;
		};
		const wrapper = defineProperty(() => {
			if (!runner.epoch) return setupFailed ? inFlight : void 0;
			runner.epoch = false;
			return finalizeDisposal(() => {
				if (executing) return disposeAfter(waitForSetup());
				return task ? disposeAfter(task) : dispose();
			});
		}, symbols.effect, meta);
		effectInertia.set(wrapper, () => inFlight);
		removeWrapper = this._disposables.push(wrapper);
		try {
			task = this._execute(runner);
		} catch (reason) {
			executing = false;
			setupFailed = true;
			runner.epoch = false;
			let cleanup;
			try {
				cleanup = finalizeDisposal(dispose);
			} finally {
				rejectSetup?.(reason);
			}
			if (isObject(cleanup) && "then" in cleanup) cleanup.catch((error) => this.ctx.logger.error(error));
			throw reason;
		}
		executing = false;
		if (setupBarrier) Promise.resolve(task).then(resolveSetup, rejectSetup);
		task?.catch(() => {
			if (!runner.epoch) return dispose();
			return finalizeDisposal(dispose);
		}).catch((error) => this.ctx.logger.error(error));
		const disposeAsync = () => {
			if (!runner.epoch) return;
			runner.epoch = false;
			return finalizeDisposal(dispose);
		};
		wrapper.then = async (onFulfilled, onRejected) => {
			return Promise.resolve(task).then(() => disposeAsync).then(onFulfilled, onRejected);
		};
		return wrapper;
	}
	/**
	* Return metadata for currently registered effects.
	*
	* @returns one {@link EffectMeta} tree per labeled live effect.
	*/
	getEffects() {
		return [...this._disposables].map((dispose) => dispose[symbols.effect]).filter(Boolean);
	}
	_getState() {
		if (this.uid === null) return 4;
		if (this._error) return 3;
		if (this._runner.epoch !== INACTIVE) return 2;
		return 0;
	}
	_updateState(callback) {
		const oldState = this.state;
		this.state = callback() ?? this._getState();
		if (oldState === this.state) return;
		this.context.emit("internal/status", this, oldState);
		if (oldState !== 2 && this.state !== 2) return;
		for (const key of Reflect.ownKeys(this.ctx.reflect.store)) {
			const impl = this.ctx.reflect.store[key];
			if (impl.fiber !== this) continue;
			this.ctx.reflect.notify([impl.name]);
		}
	}
	_checkImpl(name) {
		const impl = this.ctx.reflect._getImpl(name, true);
		if (!impl) return delete this._store[name];
		try {
			if (impl.check && !impl.check.call(getTraceable(this.ctx, impl.value))) return delete this._store[name];
		} catch (error) {
			impl.fiber.ctx.logger.error(error);
			return delete this._store[name];
		}
		this._store[name] = impl;
	}
	_refresh() {
		let epoch = false;
		epoch = "";
		for (const name of Object.keys(this.inject)) {
			const impl = this._store[name];
			if (!impl) {
				epoch = INACTIVE;
				break;
			}
			epoch += ":" + impl.fiber.uid;
		}
		this._setEpoch(epoch);
	}
	_setEpoch(epoch) {
		const oldEpoch = this._runner.epoch;
		if (epoch === oldEpoch) return;
		this._runner.epoch = epoch;
		if (this.inertia) return;
		this._updateState(() => {
			if (epoch !== INACTIVE && oldEpoch === INACTIVE) {
				this.inertia = this._reload();
				return 1;
			} else {
				this.inertia = this._unload();
				return 5;
			}
		});
	}
	_resolveConfig(config) {
		config = this.context.waterfall(this, "internal/config", config, () => config);
		return this.runtime ? resolveConfig(this.runtime, config) : config;
	}
	async _reload() {
		this.store = { ...this._store };
		const oldEpoch = this._runner.epoch;
		try {
			await Promise.resolve();
			if (this._runner.epoch === oldEpoch) {
				this.config = this._resolveConfig(this._config);
				await this._execute(this._runner);
				this._error = void 0;
			}
		} catch (reason) {
			this.ctx.logger.error(reason);
			this._error = reason;
			this._runner.epoch = INACTIVE;
		}
		this._updateState(() => {
			if (this._runner.epoch === oldEpoch) this.inertia = void 0;
			else {
				this.inertia = this._unload();
				return 5;
			}
		});
	}
	async _unload() {
		await Promise.all(this._disposables.clear().map(async (dispose) => {
			try {
				await composeError(async (info) => {
					await Promise.resolve();
					info.error = /* @__PURE__ */ new Error();
					await runDisposable(dispose);
				}, this._runner.getOuterStack);
			} catch (reason) {
				this.ctx.logger.error(reason);
			}
		}));
		this.store = void 0;
		this._updateState(() => {
			if (this._runner.epoch === INACTIVE) this.inertia = void 0;
			else {
				this.inertia = this._reload();
				return 1;
			}
		});
	}
	/**
	* Wait for current lifecycle work and rethrow startup errors.
	*
	* @returns this fiber, once it has settled into a stable state.
	* @throws the config-validation or plugin-startup error, if any.
	*/
	async await() {
		while (this.inertia) await this.inertia;
		if (this._error) throw this._error;
		return this;
	}
	/**
	* Dispose and immediately reload this plugin with its current config.
	*
	* @returns a promise resolving once the reload settled.
	* @throws {CordisError} `INACTIVE_EFFECT` when the fiber is already disposed.
	*/
	async restart() {
		this.assertActive();
		this._setEpoch(INACTIVE);
		this._refresh();
		await this.await();
	}
	/**
	* Validate and apply new config, then restart the plugin.
	*
	* Runs the `internal/update` waterfall first, so update hooks (and HMR)
	* can veto or replace the restart.
	*
	* @param config — the new raw config; validated before anything restarts.
	* @param noSave — hint for persistence hooks not to write the change back.
	* @returns the update waterfall result; the default restart returns a promise.
	* @throws when validation, an update listener, or the restarted plugin fails.
	*/
	update(config, noSave = false) {
		this.assertActive();
		this._config = config;
		if (this.state !== 2) {
			this._error = void 0;
			this._setEpoch(INACTIVE);
			this._refresh();
			return;
		}
		config = this._resolveConfig(config);
		return this.context.waterfall(this, "internal/update", config, noSave, () => {
			this.config = config;
			this._error = void 0;
			return this.restart();
		});
	}
};
function isApplicable(object) {
	return object && typeof object === "object" && typeof object.apply === "function";
}
/**
* Decorator for declaring service dependencies on classes or class methods.
*
* On classes it contributes to the plugin's static `inject` map. On methods it
* delays the method call until the declared services are available.
*/
/**
* @param name — the required service name.
* @param config — optional intercept config applied for that service.
* @returns the class or method decorator.
*/
function Inject(name, config) {
	return function(value, decorator) {
		if (decorator.kind === "class") {
			if (!Object.hasOwn(value, "inject")) {
				defineProperty(value, "inject", Object.create(Object.getPrototypeOf(value).inject ?? null));
				defineProperty(value.inject, symbols.checkProto, true);
			}
			value.inject[name] = config;
		} else if (decorator.kind === "method") {
			const inject = (value[symbols.metadata] ??= {}).inject ??= Object.create(null);
			inject[name] = config;
			decorator.addInitializer(function() {
				const property = this[symbols.tracker]?.property;
				(this[symbols.initHooks] ??= []).push(() => {
					this.ctx.inject(inject, (ctx) => {
						return value.call(property ? withProps(this, { [property]: ctx }) : this);
					});
				});
			});
		} else throw new Error("@Inject() can only be used on class or class methods");
	};
}
/** Utilities for normalizing plugin dependency declarations. */
(function(Inject) {
	/**
	* Convert array/object/class-inherited inject metadata into a plain map.
	*
	* @param inject — the declaration to normalize; `null`/`undefined` add nothing.
	* @param result — the map to fill (service name → intercept config or `null`).
	* @returns `result`.
	*/
	function resolve(inject, result = Object.create(null)) {
		if (!inject) return result;
		if (Array.isArray(inject)) for (const name of inject) result[name] = null;
		else if (Reflect.has(inject, symbols.checkProto)) {
			Object.assign(result, resolve(Object.getPrototypeOf(inject)));
			for (const name of Object.keys(inject)) result[name] = inject[name] ?? null;
		} else for (const name of Object.keys(inject)) result[name] = inject[name] ?? null;
		return result;
	}
	Inject.resolve = resolve;
})(Inject || (Inject = {}));
/**
* Plugin registry installed as `ctx.registry` and mixed into every context.
*
* It normalizes plugin shapes, tracks plugin runtimes, starts fibers, and
* exposes map-like inspection over active plugin callbacks.
*/
var RegistryService = class {
	ctx;
	_counter = 0;
	_internal = /* @__PURE__ */ new Map();
	constructor(ctx) {
		this.ctx = ctx;
		defineProperty(this, symbols.tracker, {
			property: "ctx",
			noShadow: true
		});
	}
	/** Allocate the next fiber uid (increments on every read). */
	get counter() {
		return ++this._counter;
	}
	/** Number of registered plugin runtimes. */
	get size() {
		return this._internal.size;
	}
	/**
	* Resolve a supported plugin shape to its executable callback.
	*
	* @param plugin — a function, class, or `{ apply }` object plugin.
	* @returns the callback identifying the plugin, or `undefined` if invalid.
	*/
	resolve(plugin) {
		try {
			if (typeof plugin === "function") return plugin;
			if (isApplicable(plugin)) return plugin.apply;
		} catch {}
	}
	/**
	* Look up the runtime record for a plugin.
	*
	* @param plugin — any supported plugin shape.
	* @returns the runtime, or `undefined` when the plugin is not registered.
	*/
	get(plugin) {
		const key = this.resolve(plugin);
		return key && this._internal.get(key);
	}
	/**
	* Check whether a plugin has a registered runtime.
	*
	* @param plugin — any supported plugin shape.
	* @returns `true` when at least one fiber of the plugin exists.
	*/
	has(plugin) {
		const key = this.resolve(plugin);
		return !!key && this._internal.has(key);
	}
	/**
	* Dispose every running fiber for a plugin and remove its runtime record.
	*
	* @param plugin — any supported plugin shape.
	* @returns the removed runtime, or `undefined` when none was registered.
	*/
	delete(plugin) {
		const key = this.resolve(plugin);
		const runtime = key && this._internal.get(key);
		if (!runtime) return;
		this._internal.delete(key);
		for (const fiber of runtime.fibers) fiber.dispose();
		return runtime;
	}
	/** Iterate the registered plugin callbacks. */
	keys() {
		return this._internal.keys();
	}
	/** Iterate the registered plugin runtimes. */
	values() {
		return this._internal.values();
	}
	/** Iterate `[callback, runtime]` pairs. */
	entries() {
		return this._internal.entries();
	}
	/**
	* Visit every registered runtime.
	*
	* @param callback — receives each runtime and its identifying callback.
	*/
	forEach(callback) {
		return this._internal.forEach(callback);
	}
	/**
	* Start a callback once the requested dependencies are available.
	*
	* @param inject — required services, as an array or a name → config map.
	* @param callback — plugin body called with `(ctx, config)`.
	* @returns the fiber; awaiting it settles once loading finished.
	*/
	inject(inject, callback) {
		return this.plugin({
			inject,
			apply: callback,
			name: callback.name
		});
	}
	/**
	* Start a plugin in the current context and return its fiber.
	*
	* Creates (or reuses) the plugin's runtime record, then starts a new fiber
	* under the current context. Throws if `plugin` is not a supported shape or
	* if the current fiber is already disposed.
	*
	* @param plugin — a function, class, or `{ apply }` object plugin.
	* @param config — the plugin config, validated against its `Config` schema.
	* @param getOuterStack — captures the caller stack for effect diagnostics.
	* @returns the fiber; awaiting it settles once loading finished.
	*/
	plugin(plugin, config, getOuterStack = buildOuterStack()) {
		const callback = this.resolve(plugin);
		if (!callback) throw new Error("invalid plugin, expect function or object with an \"apply\" method, received " + typeof plugin);
		this.ctx.fiber.assertActive();
		let runtime = this._internal.get(callback);
		if (!runtime) {
			let name = plugin.name;
			if (name === "apply") name = void 0;
			runtime = {
				name,
				callback,
				fibers: new DisposableList(),
				Config: plugin.Config
			};
			this._internal.set(callback, runtime);
		}
		const fiber = new Fiber(this.ctx, config, Inject.resolve(plugin.inject), runtime, getOuterStack);
		const wrapped = Object.create(fiber);
		wrapped.then = (onFulfilled, onRejected) => {
			return fiber.await().then(onFulfilled, onRejected);
		};
		return wrapped;
	}
};
/**
* Root and child dependency containers for Cordis plugins.
*
* A context is a proxy: normal property reads go through the service resolver,
* while `extend()`, `isolate()`, and `intercept()` create scoped child
* contexts without mutating their parent.
*/
var Context = class Context {
	/** Symbol key under which a disposer exposes its {@link EffectMeta} diagnostics tree. */
	static effect = symbols.effect;
	/** Symbol key for a context's listener filter, consulted on every event dispatch. */
	static filter = symbols.filter;
	/** Symbol key of the isolation map (see the `Context[symbols.isolate]` property). */
	static isolate = symbols.isolate;
	/** Symbol key of the intercept map (see the `Context[symbols.intercept]` property). */
	static intercept = symbols.intercept;
	/**
	* Returns true for Cordis context proxies and context prototypes.
	*
	* Works across realms and across multiple copies of cordis, because the
	* brand is keyed by a global symbol rather than by `instanceof`.
	*
	* @param value — the value to test.
	* @returns `true` if `value` is a Cordis context, narrowing its type.
	*/
	static is(value) {
		return !!value?.[Context.is];
	}
	static {
		Context.is[Symbol.toPrimitive] = () => Symbol.for("cordis.is");
		Context.prototype[Context.is] = true;
	}
	/** Create the root context and install the built-in services. */
	constructor() {
		this[symbols.isolate] = Object.create(null);
		this[symbols.intercept] = Object.create(null);
		const self = new Proxy(this, ReflectService.handler);
		this.root = self;
		this.baseUrl = void 0;
		this.fiber = new Fiber(self, {}, Object.create(null), null, () => []);
		this.reflect = new ReflectService(self);
		this.registry = new RegistryService(self);
		this.events = new EventsService(self);
		this.logger = new LoggerService(self);
		this.fiber._disposables.clear();
		return self;
	}
	[Symbol.for("nodejs.util.inspect.custom")]() {
		return `Context <${this.fiber.name}>`;
	}
	/**
	* Create a child context with extra metadata on top of the current scope.
	*
	* The child prototypally inherits every property of this context; own
	* properties of `meta` shadow the inherited ones. The parent is not mutated.
	*
	* @param meta — own properties (including symbol keys) to define on the child.
	* @returns a child context inheriting from this one.
	*/
	extend(meta = {}) {
		const shadow = Reflect.getOwnPropertyDescriptor(this, symbols.shadow)?.value;
		const self = Object.create(getTraceable(this, this));
		for (const prop of Reflect.ownKeys(meta)) Object.defineProperty(self, prop, Reflect.getOwnPropertyDescriptor(meta, prop));
		if (!shadow) return self;
		return Object.assign(Object.create(self), { [symbols.shadow]: shadow });
	}
	/**
	* Create a child context with an independent service scope for `name`.
	*
	* Below the returned context, reads and writes of the service `name`
	* resolve against the new label instead of the parent's, so a different
	* implementation can be provided without affecting the parent scope.
	* Passing the same `label` to two `isolate()` calls joins their scopes.
	*
	* @param name — the service name to isolate.
	* @param label — scope label to join; defaults to a fresh unique symbol.
	* @returns a child context whose `name` service resolves in the new scope.
	*/
	isolate(name, label) {
		const shadow = Object.create(this[symbols.isolate]);
		shadow[name] = label ?? Symbol(name);
		return this.extend({ [symbols.isolate]: shadow });
	}
	intercept(name, config) {
		const intercept = Object.create(this[symbols.intercept]);
		intercept[name] = config;
		return this.extend({ [symbols.intercept]: intercept });
	}
};
/**
* Base class for services that expose a named API on `ctx`.
*
* Subclasses call `super(ctx, name)` from their constructor. The service is
* registered immediately and is automatically removed with the owning fiber.
*/
var Service = class Service {
	ctx;
	/** Symbol key of an instance method run after construction (class plugins). */
	static init = symbols.init;
	/** Symbol key of the availability predicate passed to `ctx.provide()`. */
	static check = symbols.check;
	/** Symbol key of the phantom intercept-config type parameter. */
	static config = symbols.config;
	/** Symbol key of the call body making a service callable (e.g. `ctx.logger()`). */
	static invoke = symbols.invoke;
	/** Symbol key of the helper deriving an extended service instance. */
	static extend = symbols.extend;
	/** Symbol key of the tracker metadata used for context tracing. */
	static tracker = symbols.tracker;
	/** Symbol key of the intercept-config resolution helper below. */
	static resolveConfig = symbols.resolveConfig;
	/** The service name this instance is registered under. */
	name;
	/**
	* Register this instance as `name` in the current context.
	*
	* Calls `ctx.reflect.provide(name, this, this[Service.check])`, so the
	* service is unregistered automatically when the owning fiber unloads.
	* Services with a `[Service.invoke]` body return a callable instance.
	*
	* @param ctx — the context to register in (stored as `this.ctx`).
	* @param name — the service name; defaults to the static `provide` field.
	*/
	constructor(ctx, name) {
		this.ctx = ctx;
		name ??= this.constructor["provide"];
		let self = this;
		const tracker = {
			associate: name,
			property: "ctx"
		};
		if (self[symbols.invoke]) self = createCallable(name, joinPrototype(Object.getPrototypeOf(this), Function.prototype), tracker);
		self.ctx = ctx;
		self.name = name;
		defineProperty(self, symbols.tracker, tracker);
		self.ctx.reflect.provide(name, self, this[symbols.check]);
		return self;
	}
	[symbols.filter](ctx) {
		return ctx[symbols.isolate][this.name] === this.ctx[symbols.isolate][this.name];
	}
	[symbols.extend](props) {
		let self;
		if (this[Service.invoke]) self = createCallable(this.name, this, this[symbols.tracker]);
		else self = Object.create(this);
		return Object.assign(self, props);
	}
	/**
	* Merge intercept config from ancestors with optional base and head values.
	*
	* Entries added closer to the root apply first; `base` is prepended and
	* `head` appended. Uses `Config.merge` when the service declares one,
	* otherwise a shallow `Object.assign`.
	*
	* @param base — lowest-precedence config merged before all intercepts.
	* @param head — highest-precedence config merged after all intercepts.
	* @returns the merged config.
	*/
	[symbols.resolveConfig](base, head) {
		let intercept = this.ctx[Context.intercept];
		const configs = [];
		while (this.name in intercept) {
			if (Object.hasOwn(intercept, this.name)) configs.unshift(intercept[this.name]);
			intercept = Object.getPrototypeOf(intercept);
		}
		if (base) configs.unshift(base);
		if (head) configs.push(head);
		if (this["Config"]?.merge) return this["Config"].merge(...configs);
		else return Object.assign({}, ...configs);
	}
	static [Symbol.hasInstance](instance) {
		if (!instance) return false;
		let constructor = instance.constructor;
		while (constructor) {
			constructor = constructor.prototype?.constructor;
			if (constructor === this) return true;
			constructor &&= Object.getPrototypeOf(constructor);
		}
		return false;
	}
};
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-brand/lib/index.js
/**
* Duplicate-install-safe nominal primitive helpers.
*
* A brand makes structurally identical strings or numbers non-interchangeable
* at the type level: a `SessionId` cannot be passed where a `ToolCallId` is
* expected, and an event sequence cannot be passed as a log offset. Comparison,
* logging, and serialization retain the underlying primitive behavior.
*
* This package owns no concrete domain value and keeps no runtime identity or mutable
* state, so independently installed copies produce interchangeable values.
*
* @module @deepseek-ai/dsh-brand
*/
/**
* Apply a compile-time string brand without changing the value.
* @param value - string admitted by the domain that owns the target brand.
* @returns the same string with the requested compile-time brand.
*/
function brandString(value) {
	return value;
}
/**
* Apply a compile-time number brand without changing the value.
* @param value - number admitted by the domain that owns the target brand.
* @returns the same number with the requested compile-time brand.
*/
function brandNumber(value) {
	return value;
}
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-util-values/lib/index.js
/** Duplicate-install-safe JSON and immutable-value helpers. @module @deepseek-ai/dsh-util-values */
/**
* Mark an unreachable closed-union branch.
* @param value - impossible value; an unhandled typed variant fails at the call site.
* @param context - optional switch-site label included in the failure message.
* @returns never; a runtime value that escaped its type always throws.
*/
function assertNever(value, context) {
	const rendered = JSON.stringify(value) ?? String(value);
	throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}
/** Whether a realm-owned intrinsic prototype is backed by its native constructor. */
function hasIntrinsicConstructor(prototype, name) {
	const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
	if (typeof constructor !== "function") return false;
	try {
		return constructor.name === name && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === `function ${name}() { [native code] }`;
	} catch {
		return false;
	}
}
/** Whether a candidate is one realm's intrinsic `Object.prototype`. */
function isIntrinsicObjectPrototype(value) {
	return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor(value, "Object");
}
/** Whether an array uses one realm's intrinsic `Array.prototype`, not a subclass or forged prototype. */
function hasPlainArrayPrototype(value) {
	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(prototype) || !hasIntrinsicConstructor(prototype, "Array")) return false;
	const objectPrototype = Object.getPrototypeOf(prototype);
	return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype(objectPrototype);
}
/** Whether an object is a plain or null-prototype record from any JavaScript realm. */
function hasPlainObjectPrototype(value) {
	const prototype = Object.getPrototypeOf(value);
	return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype(prototype);
}
/** Return every JSON-visible object key, or reject own data JSON would discard. */
function enumerableStringKeys(value) {
	const keys = Reflect.ownKeys(value);
	if (keys.some((key) => typeof key !== "string" || !Object.prototype.propertyIsEnumerable.call(value, key))) return void 0;
	return keys;
}
/** Validate lossless JSON iteratively, optionally materializing a detached snapshot. */
function walkJsonValue(value, detach) {
	const ancestors = /* @__PURE__ */ new Set();
	let root;
	const assign = (destination, item) => {
		if (destination === void 0) return;
		if (destination.kind === "root") root = item;
		else if (destination.kind === "array") destination.target[destination.index] = item;
		else Object.defineProperty(destination.target, destination.key, {
			value: item,
			enumerable: true,
			configurable: true,
			writable: true
		});
	};
	const tasks = [{
		kind: "visit",
		value,
		...detach ? { destination: { kind: "root" } } : {}
	}];
	for (let task = tasks.pop(); task !== void 0; task = tasks.pop()) {
		if (task.kind === "leave") {
			ancestors.delete(task.source);
			continue;
		}
		if (task.kind === "array-item") {
			if (!Object.prototype.hasOwnProperty.call(task.source, task.index)) return void 0;
			tasks.push({
				kind: "visit",
				value: task.source[task.index],
				...task.target === void 0 ? {} : { destination: {
					kind: "array",
					target: task.target,
					index: task.index
				} }
			});
			continue;
		}
		if (task.kind === "object-property") {
			tasks.push({
				kind: "visit",
				value: task.source[task.key],
				...task.target === void 0 ? {} : { destination: {
					kind: "object",
					target: task.target,
					key: task.key
				} }
			});
			continue;
		}
		const current = task.value;
		if (current === null) {
			assign(task.destination, null);
			continue;
		}
		if (typeof current === "boolean" || typeof current === "string") {
			assign(task.destination, current);
			continue;
		}
		if (typeof current === "number") {
			if (!Number.isFinite(current) || Object.is(current, -0)) return void 0;
			assign(task.destination, current);
			continue;
		}
		if (typeof current !== "object") return void 0;
		if (ancestors.has(current)) return void 0;
		if (Array.isArray(current)) {
			if (!hasPlainArrayPrototype(current)) return void 0;
			const length = current.length;
			if (Reflect.ownKeys(current).length !== length + 1) return void 0;
			const target = detach ? [] : void 0;
			if (target !== void 0) assign(task.destination, target);
			ancestors.add(current);
			tasks.push({
				kind: "leave",
				source: current
			});
			for (let index = length - 1; index >= 0; index--) tasks.push({
				kind: "array-item",
				source: current,
				index,
				...target === void 0 ? {} : { target }
			});
			continue;
		}
		if (!hasPlainObjectPrototype(current)) return void 0;
		const keys = enumerableStringKeys(current);
		if (keys === void 0) return void 0;
		const target = detach ? {} : void 0;
		if (target !== void 0) assign(task.destination, target);
		ancestors.add(current);
		tasks.push({
			kind: "leave",
			source: current
		});
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) return void 0;
			tasks.push({
				kind: "object-property",
				source: current,
				key,
				...target === void 0 ? {} : { target }
			});
		}
	}
	return detach ? root : true;
}
/**
* Validate and detach lossless JSON in one read per property.
* @param value - candidate value to validate and detach.
* @returns the detached snapshot, or `undefined` when the value is not losslessly JSON-serializable.
*/
function snapshotJsonValue(value) {
	return walkJsonValue(value, true);
}
/**
* Test the same lossless JSON rules as {@link snapshotJsonValue} without detaching the value.
* @param value - candidate value to test.
* @returns whether the value survives a JSON round trip without loss.
*/
function isJsonValue(value) {
	return walkJsonValue(value, false) === true;
}
/**
* Compare JSON-compatible values structurally.
* @param a - one JSON-compatible value.
* @param b - the other JSON-compatible value.
* @returns whether both values contain the same JSON data.
*/
function deepEqualJson(a, b) {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((entry, index) => deepEqualJson(entry, b[index]));
	}
	const left = a;
	const right = b;
	const keys = Object.keys(left);
	if (keys.length !== Object.keys(right).length) return false;
	return keys.every((key) => key in right && deepEqualJson(left[key], right[key]));
}
/**
* Deep-freeze an object graph in place while leaving live AbortSignal objects mutable.
* @param value - value to freeze.
* @returns the same value after every reachable enumerable child is frozen.
*/
function deepFreeze(value) {
	const seen = /* @__PURE__ */ new WeakSet();
	const pending = [{
		kind: "visit",
		node: value
	}];
	while (pending.length > 0) {
		const task = pending.pop();
		/* v8 ignore next -- the loop condition guarantees one pending task. */
		if (task === void 0) continue;
		if (task.kind === "property") {
			pending.push({
				kind: "visit",
				node: task.source[task.key]
			});
			continue;
		}
		const node = task.node;
		if (node === null || typeof node !== "object") continue;
		if (node instanceof AbortSignal) continue;
		if (seen.has(node)) continue;
		seen.add(node);
		Object.freeze(node);
		const keys = Object.keys(node);
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) continue;
			pending.push({
				kind: "property",
				source: node,
				key
			});
		}
	}
	return value;
}
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-typert-protocol/lib/index.js
/** The one Remote failure class shared by owners, the Gateway, and consumers. */
/**
* One Remote call failure: a real Error carrying its stable code and typed
* details. Owners throw it at the failure point; the Host Gateway encodes it
* onto the wire unchanged; the Client face rebuilds an instance for the
* `RemoteResult` error branch, so `throw result.error` keeps throw semantics.
* Discrimination is always by `code`, never by instanceof.
*/
var RemoteError = class extends Error {
	code;
	details;
	/** Structural marker: cross-realm/bundle identification never uses instanceof. */
	isDSHRemoteError = true;
	/**
	* @param code - stable failure code declared in {@link RemoteErrorDetailsMap}.
	* @param message - human diagnostic carried across the wire.
	* @param details - structured payload typed by the code.
	* @param options - standard Error options (`cause` survives in-process only).
	*/
	constructor(code, message, details, options) {
		super(message, options);
		this.code = code;
		this.details = details;
		this.name = "RemoteError";
	}
};
/**
* Remote decorators and explicit Gateway bindings backed by versioned
* descriptors carried on decorated class prototypes. Strict reflection
* remains a Typert compiler responsibility.
* @module @deepseek-ai/dsh-typert-protocol
*/
const TYPERT_REMOTE_SEGMENT_PATTERN = /^[A-Za-z0-9_$.-]+$/;
/**
* Test one generated Remote name against the Connection endpoint grammar.
* @param value - namespace, method, lookup, or Context segment.
* @returns whether the value can cross the shared RPC carrier unchanged.
*/
function isTypertRemoteSegment(value) {
	return value !== "." && value !== ".." && TYPERT_REMOTE_SEGMENT_PATTERN.test(value);
}
const REMOTE_METHOD_DESCRIPTOR = "@deepseek-ai/dsh-typert-protocol/remote-methods";
/**
* Bind one visible Service field to a Cordis key and Remote namespace.
* @param service - owning Service instance, normally `this`.
* @param serviceKey - exact Cordis service key.
* @param options - optional distinct wire namespace.
* @returns a frozen, inspectable binding with no compiler-injected metadata.
*/
function bindTypertRemote(service, serviceKey, options = {}) {
	validateName("service key", serviceKey);
	const namespace = options.namespace ?? serviceKey;
	validateName("namespace", namespace);
	return Object.freeze({
		service,
		serviceKey,
		namespace
	});
}
/** Cordis Service base that exposes its registered name through Typert Gateway. */
var TypertRemoteService = class extends Service {
	/** Visible binding consumed by the Gateway's source-mode discovery. */
	typertRemote;
	/**
	* Register the Service and bind the same key to Typert Gateway.
	* @param ctx - owning Cordis Context.
	* @param serviceKey - exact Cordis service key and default wire namespace.
	* @param options - optional distinct wire namespace.
	*/
	constructor(ctx, serviceKey, options = {}) {
		super(ctx, serviceKey);
		this.typertRemote = bindTypertRemote(this, this.name, options);
	}
};
function Remote(methodExportOrOptions, context) {
	if (typeof methodExportOrOptions === "string") {
		validateName("Remote export name", methodExportOrOptions);
		return remoteDecorator({ kind: "direct" }, void 0, methodExportOrOptions);
	}
	if (typeof methodExportOrOptions === "object") {
		if (remoteOptionMode(methodExportOrOptions) !== "stream" || Reflect.ownKeys(methodExportOrOptions).length !== 1) throw new TypeError("typert-protocol: Remote options must contain exactly mode: \"stream\"");
		return remoteDecorator({ kind: "direct" }, "stream");
	}
	if (context === void 0) throw new TypeError("typert-protocol: Remote decorator context is missing");
	addMarkerInitializer(context, { kind: "direct" });
}
function remoteOptionMode(options) {
	return Reflect.get(options, "mode");
}
function remoteDecorator(invocation, mode, exportName) {
	return function(_method, context) {
		addMarkerInitializer(context, invocation, mode, exportName);
	};
}
function readRemoteMethodDescriptor(prototype) {
	const property = Object.getOwnPropertyDescriptor(prototype, REMOTE_METHOD_DESCRIPTOR);
	if (property === void 0) return void 0;
	const descriptor = property.value;
	if (descriptor === null || typeof descriptor !== "object") throw new TypeError("typert-protocol: Remote method descriptor must be an object");
	const version = Reflect.get(descriptor, "version");
	if (version !== 1) throw new TypeError(`typert-protocol: unsupported Remote method descriptor version ${String(version)}`);
	const methods = Reflect.get(descriptor, "methods");
	if (!Array.isArray(methods)) throw new TypeError("typert-protocol: Remote method descriptor methods must be an array");
	return descriptor;
}
function addMarkerInitializer(context, invocation, mode, exportName) {
	if (context.private || context.static || typeof context.name !== "string") throw new TypeError("typert-protocol: Remote decorators require a public instance method with a string name");
	const method = context.name;
	context.addInitializer(function() {
		const prototype = Object.getPrototypeOf(this);
		if (prototype === null) throw new TypeError(`typert-protocol: cannot mark Remote method "${method}" on an object without a prototype`);
		mark(prototype, method, invocation, mode, exportName);
	});
}
function mark(prototype, method, invocation, mode, exportName) {
	const descriptor = readRemoteMethodDescriptor(prototype);
	const marker = Object.freeze({
		method,
		...exportName === void 0 || exportName === method ? {} : { exportName },
		...mode === void 0 ? {} : { mode },
		invocation: Object.freeze(invocation)
	});
	const current = descriptor?.methods.find((candidate) => candidate.method === method);
	if (current !== void 0) {
		if (current.exportName === marker.exportName && current.mode === marker.mode && sameInvocation(current.invocation, invocation)) return;
		throw new Error(`typert-protocol: Remote method "${method}" has conflicting invocation markers`);
	}
	Object.defineProperty(prototype, REMOTE_METHOD_DESCRIPTOR, {
		configurable: true,
		value: Object.freeze({
			version: 1,
			methods: Object.freeze([...descriptor?.methods ?? [], marker])
		})
	});
}
function sameInvocation(left, right) {
	if (left.kind === "direct") return right.kind === "direct";
	if (right.kind === "direct") return false;
	return left.context === right.context;
}
function validateName(subject, value) {
	if (!isTypertRemoteSegment(value)) throw new TypeError(`typert-protocol: ${subject} must contain only RPC endpoint segment characters`);
}
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/schemastery/lib/index.mjs
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options = {}) {
		return Schema.resolve(data, schema, options)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options) => new Schema(options));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options = refs[key];
			options.sKey = getRef(options.sKey);
			options.inner = getRef(options.inner);
			options.list = options.list && options.list.map(getRef);
			options.dict = options.dict && mapValues(options.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value) : value;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
const resolvers = {};
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date = new Date(value);
		if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
		return date;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name, keys, format) {
	formatters[name] = format;
	Object.assign(Schema, { [name](...args) {
		const schema = new Schema({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key in args[index]) {
						if (typeof args[index][key] !== "number") continue;
						schema.bits[key] = args[index][key];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-timeout/lib/index.js
/** Largest delay Node schedules without clamping it to one millisecond. */
const MAX_TIMER_DELAY_MS = 2147483647;
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-llm/lib/index.js
/**
* Detach and deep-freeze a message whose identity already exists.
* @param message - complete message, including its stable identity.
* @returns an immutable snapshot that preserves the identity.
*/
function freezeMessage(message) {
	return deepFreeze(structuredClone(message));
}
/**
* Harness error base with a stable machine-routable code and chained cause.
* Package errors extend it so tool results and replay can retain failure class.
* @module @deepseek-ai/dsh-llm/error
*/
/**
* Base class for all harness errors. Carries a `code` (stable, programmatic —
* e.g. `NO_ADAPTER`, `INVALID_ARGS`, `INVARIANT`) distinct from the
* human-readable `message`, and supports `cause` chaining via the standard
* `ErrorOptions`. `name` defaults to the subclass constructor name.
*/
var HarnessError = class extends Error {
	/** Stable machine-routable failure class (e.g. `RATE_LIMIT`); route on this, never by parsing `message`. */
	code;
	constructor(message, code, options) {
		super(message, options);
		this.code = code;
		this.name = new.target.name;
	}
};
/**
* Canonical provider-neutral code for a response that completed normally but
* carried no content blocks at all. Providers occasionally emit a degenerate
* completion (a terminal stop with zero output); adapters classify it as this
* failure instead of yielding an empty assistant message, because an empty
* message silently ends the turn with nothing for the user or the loop to act
* on. The attempt produced nothing durable, so retry policy treats it as safe
* to repeat.
*/
const EMPTY_RESPONSE_CODE = "EMPTY_RESPONSE";
new RegExp(String.raw`(?:^|[^a-z0-9])context[\s_-](?:length|window)[\s_-]` + String.raw`(?:exceed(?:ed|s)?|overflow(?:ed)?|limit[\s_-]exceeded)(?:$|[^a-z0-9])`, "i");
new RegExp(String.raw`\b(?:request|prompt|input|messages?)\s+(?:is\s+|are\s+)?` + String.raw`too\s+(?:large|long)\s+for\s+(?:(?:this|the)\s+)?` + String.raw`(?:model(?:'s)?\s+)?context(?:\s+window)?\b`, "i");
new RegExp(String.raw`\b(?:input|prompt|request|messages?)\b.{0,40}` + String.raw`\b(?:exceed(?:s|ed)?|overflows?|is\s+larger\s+than)\b.{0,40}` + String.raw`\b(?:the\s+)?(?:model(?:'s)?\s+)?context(?:\s+(?:length|window))?\b`, "i");
/**
* Provider-owned request-retry policy configuration and resolution.
*
* Adapters expose one resolved policy per registered provider route; the
* optional dsh-llm-retry plugin executes it on the agent's failed-step extension point.
*
* @module @deepseek-ai/dsh-llm/retry-policy
*/
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 1e4;
const DEFAULT_JITTER_RATIO = .1;
const DEFAULT_RETRYABLE_CODES = Object.freeze([
	EMPTY_RESPONSE_CODE,
	"RATE_LIMIT",
	"SERVER",
	"TIMEOUT",
	"TRANSPORT"
]);
const backoffSchema = Schema.object({
	initialDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_INITIAL_DELAY_MS),
	maxDelayMs: Schema.number().max(MAX_TIMER_DELAY_MS).default(DEFAULT_MAX_DELAY_MS),
	jitterRatio: Schema.number().min(0).max(1).default(DEFAULT_JITTER_RATIO)
});
const normalPolicySchema = Schema.object({
	mode: Schema.const("normal").required(),
	maxRetries: Schema.number().step(1).min(0).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_RETRIES),
	retryableCodes: Schema.array(Schema.string()).default([...DEFAULT_RETRYABLE_CODES]),
	backoff: backoffSchema
});
const alwaysPolicySchema = Schema.object({
	mode: Schema.const("always").required(),
	backoff: backoffSchema
});
Schema.union([normalPolicySchema, alwaysPolicySchema]);
const NORMAL_POLICY_KEYS = /* @__PURE__ */ new Set([
	"mode",
	"maxRetries",
	"retryableCodes",
	"backoff"
]);
const ALWAYS_POLICY_KEYS = /* @__PURE__ */ new Set([
	"mode",
	"maxRetries",
	"retryableCodes",
	"backoff"
]);
const BACKOFF_KEYS = /* @__PURE__ */ new Set([
	"initialDelayMs",
	"maxDelayMs",
	"jitterRatio"
]);
function validateKeys(value, allowed, path) {
	for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${path}: unknown key "${key}"`);
}
function resolveBackoff(config, path) {
	if (config !== void 0) validateKeys(config, BACKOFF_KEYS, path);
	const initialDelayMs = config?.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
	const maxDelayMs = config?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
	const jitterRatio = config?.jitterRatio ?? DEFAULT_JITTER_RATIO;
	if (!Number.isFinite(initialDelayMs) || initialDelayMs <= 0 || initialDelayMs > 2147483647) throw new Error(`${path}.initialDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
	if (!Number.isFinite(maxDelayMs) || maxDelayMs <= 0 || maxDelayMs > 2147483647) throw new Error(`${path}.maxDelayMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`);
	if (initialDelayMs > maxDelayMs) throw new Error(`${path}.initialDelayMs must be less than or equal to maxDelayMs`);
	if (!Number.isFinite(jitterRatio) || jitterRatio < 0 || jitterRatio > 1) throw new Error(`${path}.jitterRatio must be between 0 and 1`);
	return Object.freeze({
		initialDelayMs,
		maxDelayMs,
		jitterRatio
	});
}
/**
* Validate, default, and detach one provider-owned retry policy.
* @param config - optional provider configuration; omission selects normal defaults.
* @param path - diagnostic path naming the provider config that owns the value.
* @returns an immutable policy safe to capture in provider registration state.
*/
function resolveRetryPolicy(config, path) {
	if (config === void 0) return Object.freeze({
		mode: "normal",
		maxRetries: DEFAULT_MAX_RETRIES,
		retryableCodes: DEFAULT_RETRYABLE_CODES,
		...resolveBackoff(void 0, `${path}.backoff`)
	});
	switch (config.mode) {
		case "normal": {
			validateKeys(config, NORMAL_POLICY_KEYS, path);
			const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
			const retryableCodes = config.retryableCodes ?? [...DEFAULT_RETRYABLE_CODES];
			if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) throw new Error(`${path}.maxRetries must be a non-negative safe integer`);
			if (retryableCodes.length === 0) throw new Error(`${path}.retryableCodes must not be empty`);
			if (retryableCodes.some((code) => typeof code !== "string" || code.length === 0)) throw new Error(`${path}.retryableCodes must contain only non-empty strings`);
			if (new Set(retryableCodes).size !== retryableCodes.length) throw new Error(`${path}.retryableCodes must not contain duplicates`);
			return Object.freeze({
				mode: "normal",
				maxRetries,
				retryableCodes: Object.freeze([...retryableCodes]),
				...resolveBackoff(config.backoff, `${path}.backoff`)
			});
		}
		case "always":
			validateKeys(config, ALWAYS_POLICY_KEYS, path);
			return Object.freeze({
				mode: "always",
				...resolveBackoff(config.backoff, `${path}.backoff`)
			});
		default: throw new Error(`${path}.mode must be "normal" or "always"`);
	}
}
/**
* Field-wise equality over {@link LlmCallConfig} — the comparison a caller
* runs to decide whether a proposed configuration is a real change (worth a
* logged header snapshot) or the held one restated.
* @param a - one configuration.
* @param b - the other.
* @returns whether every field (including the `stop` list, element-wise) matches.
*/
function callConfigEquals(a, b) {
	if (a.provider !== b.provider || a.model !== b.model || a.reasoningEffort !== b.reasoningEffort || a.temperature !== b.temperature || a.maxTokens !== b.maxTokens) return false;
	if (a.stop === void 0 || b.stop === void 0) return a.stop === b.stop;
	return a.stop.length === b.stop.length && a.stop.every((s, i) => s === b.stop?.[i]);
}
/**
* Normalization for values thrown by a final LLM adapter boundary.
*
* @module @deepseek-ai/dsh-llm/adapter-failure
*/
/**
* Detach serializable provider facts from a value thrown by an adapter.
* @param value - arbitrary value thrown during adapter dispatch or iteration.
* @returns immutable provider-neutral facts suitable for a terminal finish chunk.
* @internal
*/
function normalizeLlmFailure(value) {
	const error = value instanceof Error ? value : new HarnessError(thrownMessage(value), "UNKNOWN", { cause: value });
	const carried = ownFailureSnapshot(error);
	if (carried !== void 0 && carried.code === ownErrorCode(error)) return carried;
	return Object.freeze({
		message: errorMessage(error),
		code: harnessErrorCode(error)
	});
}
/** Render a non-Error throw without letting hostile coercion escape normalization. */
function thrownMessage(value) {
	try {
		const message = String(value);
		return message.length > 0 ? message : "LLM adapter failed";
	} catch (_hostileThrownValue) {
		return "LLM adapter failed";
	}
}
/** Read a foreign error's own data-backed `code` without invoking accessors. */
function ownErrorCode(error) {
	try {
		const descriptor = Object.getOwnPropertyDescriptor(error, "code");
		return descriptor !== void 0 && "value" in descriptor ? descriptor.value : void 0;
	} catch (_sdkPropertyTrap) {
		return;
	}
}
/** Snapshot an own data property without invoking an SDK-defined accessor. */
function ownFailureSnapshot(error) {
	try {
		const descriptor = Object.getOwnPropertyDescriptor(error, "failure");
		return descriptor !== void 0 && "value" in descriptor ? failureSnapshot(descriptor.value) : void 0;
	} catch (_sdkPropertyTrap) {
		return;
	}
}
/** Validate and detach an arbitrary serializable failure payload. */
function failureSnapshot(value) {
	if (typeof value !== "object" || value === null) return void 0;
	try {
		const candidate = value;
		const message = candidate.message;
		const code = candidate.code;
		const status = candidate.status;
		const providerRetryAfterMs = candidate.providerRetryAfterMs;
		const requestId = candidate.requestId;
		if (typeof message !== "string" || message.length === 0 || typeof code !== "string" || code.length === 0 || status !== void 0 && (!Number.isInteger(status) || status < 100 || status > 599) || providerRetryAfterMs !== void 0 && (!Number.isFinite(providerRetryAfterMs) || providerRetryAfterMs <= 0) || requestId !== void 0 && (typeof requestId !== "string" || requestId.length === 0)) return void 0;
		return Object.freeze({
			message,
			code,
			...status === void 0 ? {} : { status },
			...providerRetryAfterMs === void 0 ? {} : { providerRetryAfterMs },
			...requestId === void 0 ? {} : { requestId }
		});
	} catch (_sdkFailureGetter) {
		return;
	}
}
/** Read an SDK error message without letting an accessor replace the primary failure. */
function errorMessage(error) {
	try {
		const message = error.message;
		if (typeof message === "string" && message.length > 0) return message;
	} catch (_sdkMessageGetter) {}
	return "LLM adapter failed";
}
/** Trust only Harness-owned codes; third-party SDK codes are not our taxonomy. */
function harnessErrorCode(error) {
	return error instanceof HarnessError ? error.code : "UNKNOWN";
}
function quoted(value) {
	return JSON.stringify(value);
}
/**
* Stable text shown to a model that cannot accept one durable image reference.
* @param ref - durable normalized attachment omitted from the request.
* @returns deterministic text-only placeholder.
*/
function textOnlyImageText(ref) {
	return `[image omitted because this model accepts text only; attachment sha256:${String(ref.attachmentId).slice(7, 15)}]`;
}
/**
* True when typed model content contains an image block, walking nested
* tool-result content. This is the one recursive image walk shared by every
* image policy (capability gating, text-only serialization, compaction
* survey), so a consumer cannot silently diverge on nesting depth.
* @param content - typed model content blocks.
* @returns whether any nested block is an image.
*/
function contentHasImage(content) {
	return content.some((block) => block.type === "image" || block.type === "tool-result" && contentHasImage(block.content));
}
/**
* True when typed model content contains a file block, walking nested
* tool-result content on the same recursion every file policy shares.
* Reads current content on every call without retaining scan results.
* @param content - typed model content blocks.
* @returns whether any nested block is a file.
*/
function contentHasFile(content) {
	for (const block of content) if (block.type === "file" || block.type === "tool-result" && contentHasFile(block.content)) return true;
	return false;
}
/**
* Stable model-facing handle for one durable file reference: the address of
* the verbatim stored copy and the instruction to read it on demand. This is
* the only representation a provider ever receives for a file.
* @param ref - durable verbatim file reference.
* @param readonlyPath - execution-world path of the stored copy, when resolvable.
* @returns deterministic handle text naming the file, its size, and its address.
*/
function fileHandleText(ref, readonlyPath) {
	const digest = String(ref.attachmentId).slice(7, 15);
	const identity = `File ${quoted(ref.name)} (${ref.bytes} bytes, sha256:${digest})`;
	if (readonlyPath === void 0) return `[${identity} was uploaded, but the current execution environment cannot access a readable path. Report that limitation if its contents are needed; do not claim to have read it.]`;
	return `[${identity}: verbatim read-only copy saved at ${quoted(readonlyPath)}. Read that path with your file tools when its contents are needed; copy it to a writable location before modifying it. When delegating file work, include this saved path in the delegation prompt; only subagents sharing this execution environment can read it.]`;
}
/** Replace every file occurrence, including nested tool results, with handle text. */
function replaceFilesWithHandles(blocks, resolvePath) {
	let next;
	for (const [index, block] of blocks.entries()) {
		if (block.type === "file") {
			next ??= blocks.slice(0, index);
			next.push({
				type: "text",
				text: fileHandleText(block.attachment, resolvePath(block.attachment))
			});
			continue;
		}
		if (block.type === "tool-result") {
			const content = replaceFilesWithHandles(block.content, resolvePath);
			if (content !== block.content) {
				next ??= blocks.slice(0, index);
				next.push({
					...block,
					content
				});
				continue;
			}
		}
		next?.push(block);
	}
	return next ?? blocks;
}
/**
* Project durable file history into deterministic handle text for every model
* route. Unlike images, no provider receives file blocks natively, so this
* projection is unconditional in request assembly.
* @param messages - complete request history.
* @param resolvePath - resolve one reference's current execution-world read path.
* @returns the original list without files, otherwise shallow message copies with handle text.
*/
function projectFilesToText(messages, resolvePath) {
	if (!messages.some((message) => contentHasFile(message.content))) return messages;
	return messages.map((message) => {
		const content = replaceFilesWithHandles(message.content, resolvePath);
		return content === message.content ? message : {
			...message,
			content
		};
	});
}
/** Replace every image occurrence, including nested tool results, for a text-only model. */
function replaceImagesForTextModel(blocks) {
	let next;
	for (const [index, block] of blocks.entries()) {
		if (block.type === "image") {
			next ??= blocks.slice(0, index);
			next.push({
				type: "text",
				text: textOnlyImageText(block.attachment)
			});
			continue;
		}
		if (block.type === "tool-result") {
			const content = replaceImagesForTextModel(block.content);
			if (content !== block.content) {
				next ??= blocks.slice(0, index);
				next.push({
					...block,
					content
				});
				continue;
			}
		}
		next?.push(block);
	}
	return next ?? blocks;
}
/**
* Project durable image history into deterministic text for an exact text-only model.
* @param messages - complete request history.
* @returns the original list without images, otherwise shallow message copies with stable placeholders.
*/
function projectImagesForTextModel(messages) {
	if (!messages.some((message) => contentHasImage(message.content))) return messages;
	return messages.map((message) => {
		const content = replaceImagesForTextModel(message.content);
		return content === message.content ? message : {
			...message,
			content
		};
	});
}
/**
* Centralize the non-secret product identity every provider request sends as `User-Agent`, keeping
* adapters from drifting. See
* `.agents/notes/implemented/architecture/2026-06-21-mandatory-app-attribution-headers.md`.
*
* App-attribution vocabulary for provider requests.
* @module @deepseek-ai/dsh-llm/attribution
*/
const { version } = createRequire(import.meta.url)("../package.json");
/**
* Lossless compact representation of one model-stream attempt, plus record-level
* readers that answer common consumer questions without materializing members.
* Readers trust the static record type; expandAssistantStream is the validating
* path for records read at a durable boundary.
*/
function safeTime(value) {
	if (!Number.isSafeInteger(value)) throw new TypeError(`Assistant stream time must be a safe integer, got ${String(value)}`);
	return value;
}
function safeIndex(value, label) {
	if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new TypeError(`${label} index must be a non-negative safe integer`);
	return value;
}
function snapshotChunk(chunk) {
	const snapshot = snapshotJsonValue(chunk);
	if (snapshot === void 0) throw new TypeError("Assistant stream chunk must be losslessly JSON-serializable");
	return snapshot;
}
function safeGap(previous, next) {
	const gap = next - previous;
	return Number.isSafeInteger(gap) && previous + gap === next ? gap : void 0;
}
/** Incrementally compacts one attempt without retaining a second raw-chunk list. */
var AssistantStreamAccumulator = class {
	records = [];
	/**
	* Add one timed chunk to the compact attempt stream.
	* @param value - model chunk and its original Session timestamp.
	* @returns a detached immutable copy for assembly and live publication.
	*/
	push(value) {
		const time = safeTime(value.time);
		const chunk = snapshotChunk(value.chunk);
		const timed = deepFreeze({
			time,
			chunk
		});
		const previous = this.records.at(-1);
		switch (chunk.type) {
			case "text-delta":
			case "reasoning-delta": {
				safeIndex(chunk.index, chunk.type);
				if (typeof chunk.text !== "string") throw new TypeError(`${chunk.type} text must be a string`);
				const type = chunk.type === "text-delta" ? "text-chunks" : "reasoning-chunks";
				const gap = previous !== void 0 && previous.type === type ? safeGap(previous.lastTime, time) : void 0;
				if (previous !== void 0 && previous.type === type && previous.index === chunk.index && gap !== void 0) {
					previous.dt.push(gap);
					previous.texts.push(chunk.text);
					previous.lastTime = time;
				} else this.records.push({
					type,
					time0: time,
					index: chunk.index,
					dt: [],
					texts: [chunk.text],
					lastTime: time
				});
				return timed;
			}
			case "tool-call-delta": {
				safeIndex(chunk.index, chunk.type);
				if (typeof chunk.id !== "string") throw new TypeError("tool-call-delta id must be a string");
				if (Object.hasOwn(chunk, "name") && typeof chunk.name !== "string") throw new TypeError("tool-call-delta name must be a string");
				if (typeof chunk.argumentsDelta !== "string") throw new TypeError("tool-call-delta argumentsDelta must be a string");
				if (chunk.id.length === 0 || chunk.name === "") {
					this.records.push({
						type: "chunk",
						time,
						chunk
					});
					return timed;
				}
				const gap = previous?.type === "tool-call-chunks" ? safeGap(previous.lastTime, time) : void 0;
				const sameName = previous?.type === "tool-call-chunks" && Object.hasOwn(previous, "name") === Object.hasOwn(chunk, "name") && previous.name === chunk.name;
				if (previous?.type === "tool-call-chunks" && previous.index === chunk.index && previous.id === chunk.id && sameName && gap !== void 0) {
					previous.dt.push(gap);
					previous.args.push(chunk.argumentsDelta);
					previous.lastTime = time;
				} else this.records.push({
					type: "tool-call-chunks",
					time0: time,
					index: chunk.index,
					dt: [],
					id: chunk.id,
					...Object.hasOwn(chunk, "name") ? { name: chunk.name } : {},
					args: [chunk.argumentsDelta],
					lastTime: time
				});
				return timed;
			}
			case "block-start":
			case "block-end":
			case "usage":
			case "finish":
				this.records.push({
					type: "chunk",
					time,
					chunk
				});
				return timed;
			default: return assertNever(chunk, "AssistantStreamAccumulator.push");
		}
	}
	/**
	* Return the current compact attempt stream.
	* @returns a detached immutable record list suitable for a durable event.
	*/
	snapshot() {
		return deepFreeze(this.records.map((record) => {
			if (record.type === "chunk") return { ...record };
			const { lastTime: _lastTime, ...durable } = record;
			if (durable.type === "tool-call-chunks") return {
				...durable,
				dt: [...durable.dt],
				args: [...durable.args]
			};
			return {
				...durable,
				dt: [...durable.dt],
				texts: [...durable.texts]
			};
		}));
	}
};
/**
* LLM service: adapter registry with a waterfall-interceptable streaming call
* API. Exports the `LlmRuntime` default, the abstract `LlmAdapter` for
* provider backends, and `BlockAssembler` for chunk assembly.
*
* @module @deepseek-ai/dsh-llm
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/**
* Typed error for LLM-related failures. Extends {@link HarnessError}, so the
* `code` string (e.g. `AUTH`, `RATE_LIMIT`, `NO_ADAPTER`) is shared taxonomy.
*/
var LlmError = class extends HarnessError {
	/** Serializable facts retained beside this live Error. */
	failure;
	/**
	* @param message - non-empty human-readable failure summary.
	* @param code - non-empty stable provider-neutral machine code.
	* @param options - optional cause and validated serializable provider facts.
	*/
	constructor(message, code, options) {
		if (typeof message !== "string" || message.length === 0) throw new Error("LlmError message must be a non-empty string");
		if (typeof code !== "string" || code.length === 0) throw new Error("LlmError code must be a non-empty string");
		if (options?.status !== void 0 && (!Number.isInteger(options.status) || options.status < 100 || options.status > 599)) throw new Error("LlmError status must be an integer from 100 through 599");
		if (options?.providerRetryAfterMs !== void 0 && (!Number.isFinite(options.providerRetryAfterMs) || options.providerRetryAfterMs <= 0)) throw new Error("LlmError providerRetryAfterMs must be a positive finite number");
		if (options?.requestId !== void 0 && (typeof options.requestId !== "string" || options.requestId.length === 0)) throw new Error("LlmError requestId must be a non-empty string");
		super(message, code, options);
		this.name = "LlmError";
		this.failure = Object.freeze({
			message,
			code,
			...options?.status === void 0 ? {} : { status: options.status },
			...options?.providerRetryAfterMs === void 0 ? {} : { providerRetryAfterMs: options.providerRetryAfterMs },
			...options?.requestId === void 0 ? {} : { requestId: options.requestId }
		});
	}
};
(() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _listProviders_decorators;
	let _listConfigurableProviders_decorators;
	let _remoteDiscoverModels_decorators;
	return class LlmRuntime extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_listProviders_decorators = [Remote];
			_listConfigurableProviders_decorators = [Remote];
			_remoteDiscoverModels_decorators = [Remote("discoverModels")];
			__esDecorate(this, null, _listProviders_decorators, {
				kind: "method",
				name: "listProviders",
				static: false,
				private: false,
				access: {
					has: (obj) => "listProviders" in obj,
					get: (obj) => obj.listProviders
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _listConfigurableProviders_decorators, {
				kind: "method",
				name: "listConfigurableProviders",
				static: false,
				private: false,
				access: {
					has: (obj) => "listConfigurableProviders" in obj,
					get: (obj) => obj.listConfigurableProviders
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _remoteDiscoverModels_decorators, {
				kind: "method",
				name: "remoteDiscoverModels",
				static: false,
				private: false,
				access: {
					has: (obj) => "remoteDiscoverModels" in obj,
					get: (obj) => obj.remoteDiscoverModels
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		adapters = (__runInitializers(this, _instanceExtraInitializers), /* @__PURE__ */ new Map());
		directory = /* @__PURE__ */ new Map();
		discoveries = /* @__PURE__ */ new Map();
		constructor(ctx) {
			super(ctx, "llm");
		}
		/** Notify topology observers without letting one broken listener veto the commit. */
		emitAdaptersUpdated() {
			let invariantFailure;
			for (const listener of this.ctx.events.dispatch("emit", ["llm/adapters-updated"])) try {
				const returned = listener();
				if (returned != null && typeof returned.then === "function") Promise.resolve(returned).then(void 0, (error) => {
					this.warnAdaptersListenerFailure(error);
				});
			} catch (error) {
				if (error?.code === "INVARIANT") {
					invariantFailure ??= error;
					continue;
				}
				this.warnAdaptersListenerFailure(error);
			}
			if (invariantFailure !== void 0) throw invariantFailure;
		}
		/** Contained-listener diagnostic shared by the sync and async failure paths. */
		warnAdaptersListenerFailure(error) {
			this.ctx.logger.warn("llm: an llm/adapters-updated listener failed");
			this.ctx.logger.warn(error);
		}
		/**
		* Register an adapter for the given provider routes. Throws `LlmError` with code
		* `DUPLICATE_ADAPTER` if any provider already has an adapter (all-or-nothing).
		* Disposed with the fiber.
		* @param providers - every provider route this adapter should serve.
		* @param adapter - the adapter that streams calls for those providers.
		* @returns the disposer, carrying {@link AdapterRegistrationHandle.replace}.
		*/
		registerAdapter(providers, adapter) {
			const owned = /* @__PURE__ */ new Set();
			let released = false;
			const dispose = this.ctx.effect(function* () {
				if (providers.length === 0) throw new LlmError("an adapter must register at least one provider", "INVALID_ADAPTER");
				this.commitRoutes(owned, this.prepareRoutes(providers, adapter, owned));
				yield () => {
					released = true;
					for (const provider of owned) this.adapters.delete(provider);
					owned.clear();
					this.emitAdaptersUpdated();
				};
			}.bind(this), "llm.registerAdapter()");
			const handle = (() => void dispose());
			handle.replace = (next) => {
				if (released) throw new LlmError("a disposed adapter registration cannot replace its routes", "REGISTRATION_DISPOSED");
				this.commitRoutes(owned, this.prepareRoutes(next, adapter, owned));
			};
			return handle;
		}
		/**
		* Validate one candidate route set for `adapter`, treating routes this
		* registration already holds as available. Nothing is mutated: a rejected
		* candidate leaves the registry exactly as it was.
		*/
		prepareRoutes(providers, adapter, owned) {
			const unique = /* @__PURE__ */ new Set();
			const registrations = [];
			for (const provider of providers) {
				if (provider.length === 0) throw new LlmError("adapter provider names must be non-empty", "INVALID_ADAPTER");
				if (unique.has(provider) || this.adapters.has(provider) && !owned.has(provider)) throw new LlmError(`an adapter for provider "${provider}" is already registered`, "DUPLICATE_ADAPTER");
				const info = adapter.providerInfo(provider);
				if (typeof info.id !== "string" || info.id !== provider || typeof info.name !== "string" || info.name.length === 0) throw new LlmError(`adapter metadata for provider "${provider}" must preserve its id and have a non-empty name`, "INVALID_ADAPTER");
				unique.add(provider);
				const retryPolicy = adapter.providerRetryPolicy(provider) ?? resolveRetryPolicy(void 0, `llm: provider "${provider}" retryPolicy`);
				registrations.push({
					adapter,
					provider: {
						id: info.id,
						name: info.name
					},
					retryPolicy
				});
			}
			return registrations;
		}
		/**
		* Swap this registration's routes for the prepared ones in one synchronous
		* section, so no observer can see the registry between the release and the
		* re-registration. The route set's one mutation point is also where
		* `llm/adapters-updated` is published, so a `replace` announces itself
		* exactly like a first registration.
		*/
		commitRoutes(owned, registrations) {
			for (const provider of owned) this.adapters.delete(provider);
			owned.clear();
			for (const registration of registrations) {
				this.adapters.set(registration.provider.id, registration);
				owned.add(registration.provider.id);
			}
			this.emitAdaptersUpdated();
		}
		/**
		* Describe provider routes with a registered adapter.
		* @returns detached provider metadata in registration order.
		*/
		listProviders() {
			return [...this.adapters.values()].map(({ provider }) => ({ ...provider }));
		}
		/**
		* Declare provider routes an adapter plugin can activate through
		* configuration. Registration is all-or-nothing: an empty list, invalid
		* entry, or a provider already declared by any registration throws
		* `LlmError` without registering the rest. Disposed with the fiber.
		* @param entries - every configurable provider this plugin owns.
		* @returns a handle that withdraws all of them, and can atomically replace them.
		*/
		registerConfigurableProviders(entries) {
			let held = [];
			let disposed = false;
			/**
			* Validate a candidate set in full against everything this registration
			* does not already hold, then publish it. Nothing is written until the
			* whole set passes, so a refused candidate leaves the current entries in
			* place — the property that makes `replace` a swap rather than a
			* delete-then-add that can strand the directory empty.
			*/
			const commit = (candidates) => {
				const detached = [];
				const own = new Set(held.map((entry) => entry.provider));
				for (const entry of candidates) {
					if (entry.provider.length === 0 || entry.displayName.length === 0 || entry.settingsNs.length === 0) throw new LlmError("configurable providers need a non-empty provider, displayName, and settingsNs", "INVALID_DIRECTORY");
					if (entry.settingsPath.some((segment) => segment.length === 0)) throw new LlmError(`configurable provider "${entry.provider}" has an empty settingsPath segment`, "INVALID_DIRECTORY");
					if (this.directory.has(entry.provider) && !own.has(entry.provider) || detached.some((seen) => seen.provider === entry.provider)) throw new LlmError(`configurable provider "${entry.provider}" is already declared`, "DUPLICATE_DIRECTORY");
					detached.push({
						...entry,
						settingsPath: [...entry.settingsPath]
					});
				}
				for (const entry of held) this.directory.delete(entry.provider);
				for (const entry of detached) this.directory.set(entry.provider, entry);
				held = detached;
				this.emitAdaptersUpdated();
			};
			const dispose = this.ctx.effect(function* () {
				if (entries.length === 0) throw new LlmError("a configurable-provider registration must declare at least one provider", "INVALID_DIRECTORY");
				commit(entries);
				yield () => {
					disposed = true;
					for (const entry of held) this.directory.delete(entry.provider);
					held = [];
					this.emitAdaptersUpdated();
				};
			}.bind(this), "llm.registerConfigurableProviders()");
			const handle = (() => void dispose());
			handle.replace = (next) => {
				if (disposed) throw new LlmError("this configurable-provider registration was disposed", "REGISTRATION_DISPOSED");
				commit(next);
			};
			return handle;
		}
		/**
		* List every declared configurable provider, registered or dormant.
		* @returns detached directory entries in declaration order.
		*/
		listConfigurableProviders() {
			return [...this.directory.values()].map((entry) => ({
				...entry,
				settingsPath: [...entry.settingsPath]
			}));
		}
		/**
		* Offer to interrogate provider endpoints on behalf of the settings
		* namespace this plugin owns. The namespace is the key because that is what
		* a configuration surface already holds from the configurable-provider
		* directory, and because a provider being *added* has no route to name yet.
		* Disposed with the fiber.
		* @param settingsNs - the namespace whose profiles this discovery serves.
		* @param discover - interrogates one endpoint and must honor the supplied signal.
		* @returns the disposer that withdraws the offer.
		*/
		registerModelDiscovery(settingsNs, discover) {
			const dispose = this.ctx.effect(function* () {
				if (settingsNs.length === 0) throw new LlmError("model discovery needs a non-empty settings namespace", "INVALID_DISCOVERY");
				if (this.discoveries.has(settingsNs)) throw new LlmError(`model discovery for "${settingsNs}" is already registered`, "DUPLICATE_DISCOVERY");
				this.discoveries.set(settingsNs, discover);
				yield () => {
					this.discoveries.delete(settingsNs);
				};
			}.bind(this), "llm.registerModelDiscovery()");
			return () => void dispose();
		}
		/**
		* Interrogate one provider endpoint for the models it advertises. The
		* request describes a draft, not a stored route, so nothing here reads or
		* writes settings or credentials — the caller owns both, and the reply is
		* candidate metadata a surface may offer for adoption.
		* @param settingsNs - namespace whose registered discovery serves this draft.
		* @param request - the endpoint, protocol, and one-shot credential to use.
		* @param signal - caller cancellation.
		* @returns the advertised models, deduplicated in endpoint order.
		*/
		async discoverModels(settingsNs, request, signal) {
			const discover = this.discoveries.get(settingsNs);
			if (discover === void 0) throw new LlmError(`no model discovery is registered for "${settingsNs}"`, "NO_DISCOVERY");
			if ((request.provider ?? "").length === 0 && (request.baseURL ?? "").length === 0) throw new LlmError("model discovery needs a provider route or a baseURL", "INVALID_DISCOVERY");
			const discovered = signal === void 0 ? await discover(request) : await discover(request, signal);
			const seen = /* @__PURE__ */ new Set();
			const models = [];
			for (const model of discovered) {
				if (typeof model.id !== "string" || model.id.length === 0 || seen.has(model.id)) continue;
				seen.add(model.id);
				models.push({
					id: model.id,
					...model.name === void 0 ? {} : { name: model.name },
					...model.contextWindow === void 0 ? {} : { contextWindow: model.contextWindow },
					...model.maxTokens === void 0 ? {} : { maxTokens: model.maxTokens }
				});
			}
			return models;
		}
		/**
		* Remote adapter for one draft provider interrogation.
		* @param settingsNs - namespace whose registered discovery serves this draft.
		* @param request - endpoint, protocol, and one-shot credential to use.
		* @param signal - caller cancellation supplied by the Remote carrier.
		* @returns advertised models in endpoint order.
		* @throws RemoteError with `llm/model-discovery-rejected` when discovery refuses or fails.
		*/
		async remoteDiscoverModels(settingsNs, request, signal) {
			try {
				return await this.discoverModels(settingsNs, request, signal);
			} catch (error) {
				throw new RemoteError("llm/model-discovery-rejected", error instanceof Error ? error.message : String(error), {
					settingsNs,
					...request.baseURL === void 0 ? {} : { baseURL: request.baseURL }
				}, { cause: error });
			}
		}
		/**
		* Resolve the retry policy captured when one provider route was registered.
		* @param provider - registered provider route to inspect.
		* @returns the provider-owned policy, with normal defaults already resolved.
		*/
		providerRetryPolicy(provider) {
			return this.registration(provider).retryPolicy;
		}
		/**
		* Resolve provider-side request-image pricing for one exact route, or
		* `undefined` when the provider is unregistered or declares none. Unknown
		* providers degrade to `undefined` rather than throwing because callers
		* price durable history whose route may no longer be mounted.
		* @param provider - provider route named by a request header.
		* @param model - exact model id named by the same header.
		* @returns the owning adapter's image pricing for the route, when declared.
		*/
		imageRequestPricing(provider, model) {
			return this.adapters.get(provider)?.adapter.imageRequestPricing(provider, model);
		}
		/**
		* Resolve the exact text one durable file occurrence contributes to every
		* provider request in the current execution environment.
		* @param ref - durable verbatim file reference from model history.
		* @returns the same deterministic handle text used at adapter dispatch.
		*/
		fileRequestText(ref) {
			return fileHandleText(ref, this.fileReadPath(ref));
		}
		/** Detach typed adapter-owned modality metadata. */
		detachedModalities(modalities) {
			return modalities === void 0 ? void 0 : [...modalities];
		}
		/**
		* Discover models advertised by one registered provider. Catalog membership
		* is advisory and never changes routing or request validation.
		* @param provider - registered provider route to inspect.
		* @returns detached model metadata in adapter-preferred order.
		*/
		async listModels(provider) {
			const models = await this.registration(provider).adapter.listModels(provider);
			const seen = /* @__PURE__ */ new Set();
			return models.map((model) => {
				if (typeof model.provider !== "string" || model.provider !== provider || typeof model.id !== "string" || model.id.length === 0 || typeof model.name !== "string" || model.name.length === 0 || model.description !== void 0 && typeof model.description !== "string" || seen.has(model.id)) throw new LlmError(`adapter returned invalid or duplicate model metadata for provider "${provider}"`, "INVALID_CATALOG");
				seen.add(model.id);
				const inputModalities = this.detachedModalities(model.inputModalities);
				return {
					provider: model.provider,
					id: model.id,
					name: model.name,
					...model.description === void 0 ? {} : { description: model.description },
					...inputModalities === void 0 ? {} : { inputModalities }
				};
			});
		}
		/**
		* Resolve and validate all metadata from the adapter that owns one exact
		* route. The result is detached from adapter-owned objects; catalog
		* membership remains advisory and does not control request routing.
		* @param provider - registered provider route to inspect.
		* @param model - exact model id passed to the adapter.
		* @param signal - optional cancellation for adapter-owned asynchronous lookup.
		* @returns exact model identity plus available context and reasoning metadata.
		*/
		async resolveModelInfo(provider, model, signal) {
			return this.resolveModelInfoFor(this.registration(provider), model, signal);
		}
		async resolveModelInfoFor(registration, model, signal) {
			const resolved = await registration.adapter.resolveModel(registration.provider.id, model, signal);
			return this.normalizeModelInfo(registration, model, resolved);
		}
		/** Validate and detach one adapter-returned exact model result. */
		normalizeModelInfo(registration, model, resolved) {
			const provider = registration.provider.id;
			if (typeof resolved.provider !== "string" || resolved.provider !== provider || typeof resolved.id !== "string" || resolved.id !== model || typeof resolved.name !== "string" || resolved.name.length === 0 || resolved.description !== void 0 && typeof resolved.description !== "string") throw new LlmError(`adapter returned invalid exact model metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_INFO");
			const context = resolved.context;
			if (context !== void 0 && (!Number.isInteger(context.contextWindow) || context.contextWindow <= 0)) throw new LlmError(`adapter returned invalid context metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_CONTEXT");
			const inputModalities = this.detachedModalities(resolved.inputModalities);
			const systemPromptUpdate = resolved.systemPromptUpdate;
			if (systemPromptUpdate !== void 0 && systemPromptUpdate !== "in-history") throw new LlmError(`adapter returned invalid system prompt update mode for provider "${provider}" model "${model}"`, "INVALID_MODEL_INFO");
			const defaultMaxTokens = resolved.defaultMaxTokens;
			if (defaultMaxTokens !== void 0 && (!Number.isSafeInteger(defaultMaxTokens) || defaultMaxTokens <= 0)) throw new LlmError(`adapter returned invalid default maxTokens for provider "${provider}" model "${model}"`, "INVALID_MODEL_MAX_TOKENS");
			const info = {
				provider,
				id: model,
				name: resolved.name,
				...resolved.description === void 0 ? {} : { description: resolved.description },
				...inputModalities === void 0 ? {} : { inputModalities },
				...context === void 0 ? {} : { context: { contextWindow: context.contextWindow } },
				...defaultMaxTokens === void 0 ? {} : { defaultMaxTokens },
				...resolved.systemPromptUpdate === void 0 ? {} : { systemPromptUpdate: resolved.systemPromptUpdate }
			};
			const reasoning = resolved.reasoning;
			if (reasoning === void 0) return info;
			if (reasoning.efforts.length === 0) throw new LlmError(`adapter returned invalid reasoning metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
			const seen = /* @__PURE__ */ new Set();
			const efforts = reasoning.efforts.map((effort) => {
				if (typeof effort.id !== "string" || effort.id.length === 0 || typeof effort.name !== "string" || effort.name.length === 0 || effort.description !== void 0 && typeof effort.description !== "string" || seen.has(effort.id)) throw new LlmError(`adapter returned invalid or duplicate reasoning effort metadata for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
				seen.add(effort.id);
				return {
					id: effort.id,
					name: effort.name,
					...effort.description === void 0 ? {} : { description: effort.description }
				};
			});
			if (reasoning.defaultEffort !== void 0 && !seen.has(reasoning.defaultEffort)) throw new LlmError(`adapter returned an unknown default reasoning effort for provider "${provider}" model "${model}"`, "INVALID_MODEL_REASONING");
			return {
				...info,
				reasoning: {
					efforts,
					...reasoning.defaultEffort === void 0 ? {} : { defaultEffort: reasoning.defaultEffort }
				}
			};
		}
		/**
		* Validate a conversation call config against its exact model capability and
		* materialize adapter-configured defaults. Unsupported explicit efforts
		* reject before provider I/O; no clamping or aliasing is performed. This
		* standalone query does not bind a later dispatch; use {@link prepareCall}
		* when logging and streaming must share one adapter registration.
		* @param config - provider/model route and optional request controls.
		* @param signal - optional cancellation for adapter-owned capability lookup.
		* @returns a detached config only when a default must be materialized.
		*/
		async resolveCallConfig(config, signal) {
			return (await this.resolveCallFor(this.registration(config.provider), config, signal)).config;
		}
		async resolveCallFor(registration, config, signal) {
			const info = await this.resolveModelInfoFor(registration, config.model, signal);
			return this.resolveCallWithInfo(config, info);
		}
		/** Validate request controls against one already-bound exact model result. */
		resolveCallWithInfo(config, info) {
			const defaulted = config.maxTokens === void 0 && info.defaultMaxTokens !== void 0 ? {
				...config,
				maxTokens: info.defaultMaxTokens
			} : config;
			const reasoning = info.reasoning;
			const requested = defaulted.reasoningEffort;
			let resolvedConfig = defaulted;
			if (reasoning === void 0) {
				if (requested !== void 0) throw new LlmError(`provider "${config.provider}" model "${config.model}" does not support reasoning effort "${requested}"`, "UNSUPPORTED_REASONING_EFFORT");
			} else {
				const effective = requested ?? reasoning.defaultEffort;
				if (effective !== void 0) {
					if (!reasoning.efforts.some((effort) => effort.id === effective)) throw new LlmError(`provider "${config.provider}" model "${config.model}" does not support reasoning effort "${effective}"`, "UNSUPPORTED_REASONING_EFFORT");
					if (requested !== effective) resolvedConfig = {
						...defaulted,
						reasoningEffort: effective
					};
				}
			}
			return {
				config: resolvedConfig,
				...info.context === void 0 ? {} : { context: info.context },
				modelInfo: info
			};
		}
		/**
		* Resolve one call under its current adapter registration. The returned
		* one-shot handle keeps that registration across header logging and dispatch,
		* so HMR cannot combine one adapter's capability result with another adapter.
		* @param config - provider/model route and optional request controls.
		* @param signal - optional cancellation for adapter-owned capability lookup.
		* @returns a prepared config and its registration-bound stream entry point.
		*/
		async prepareCall(config, signal) {
			const registration = this.registration(config.provider);
			const adapterCall = await registration.adapter.prepareCall(config.provider, config.model, signal);
			const modelInfo = this.normalizeModelInfo(registration, config.model, adapterCall.model);
			const resolved = this.resolveCallWithInfo(config, modelInfo);
			const resolvedConfig = deepFreeze(structuredClone(resolved.config));
			const context = resolved.context === void 0 ? void 0 : deepFreeze(structuredClone(resolved.context));
			const adapterDefaults = deepFreeze({
				...config.reasoningEffort === void 0 && resolvedConfig.reasoningEffort !== void 0 ? { reasoningEffort: true } : {},
				...config.maxTokens === void 0 && resolvedConfig.maxTokens !== void 0 ? { maxTokens: true } : {}
			});
			let dispatched = false;
			return Object.freeze({
				config: resolvedConfig,
				retryPolicy: registration.retryPolicy,
				adapterDefaults,
				...context === void 0 ? {} : { context },
				...modelInfo.inputModalities === void 0 ? {} : { inputModalities: Object.freeze([...modelInfo.inputModalities]) },
				...modelInfo.systemPromptUpdate === void 0 ? {} : { systemPromptUpdate: modelInfo.systemPromptUpdate },
				stream: (options) => {
					if (dispatched) throw new LlmError("a prepared LLM call can only be dispatched once", "INVALID_PREPARED_CALL");
					if (!callConfigEquals(options, resolvedConfig)) throw new LlmError("prepared LLM call config changed before adapter dispatch", "INVALID_PREPARED_CALL");
					dispatched = true;
					return this.streamWithRegistration(options, {
						registration,
						config: resolvedConfig,
						modelInfo,
						dispatch: (options) => adapterCall.stream(options)
					});
				}
			});
		}
		registration(provider) {
			const registration = this.adapters.get(provider);
			if (!registration) throw new LlmError(`no adapter registered for provider "${provider}"`, "NO_ADAPTER");
			return registration;
		}
		/** Remove replay state whose historical route is owned by another adapter. */
		forAdapter(options, adapter) {
			const messages = options.messages.map((message) => {
				const source = message.source;
				if (message.role !== "assistant" || source.kind !== "model" || source.replayState === void 0) return message;
				if (this.adapters.get(source.provider)?.adapter === adapter) return message;
				return freezeMessage({
					...message,
					source: {
						kind: "model",
						provider: source.provider,
						model: source.model
					}
				});
			});
			if (messages.every((message, index) => message === options.messages[index])) return options;
			const filtered = {
				...options,
				messages
			};
			return Object.isFrozen(options) ? deepFreeze(filtered) : filtered;
		}
		/**
		* Resolve the current execution-world read path of one durable file
		* reference through the mounted attachment and filesystem providers.
		*/
		fileReadPath(ref) {
			let hostPath;
			try {
				hostPath = this.ctx.get("attachments")?.fileHostPath(ref);
			} catch {
				return;
			}
			if (hostPath === void 0) return void 0;
			return this.ctx.get("fs")?.processPathFromHostPath(hostPath);
		}
		/**
		* Final adapter boundary. Adapter selection, dispatch, iterator construction,
		* and iteration failures become one terminal failure chunk. Middleware and
		* downstream consumer failures remain thrown plugin or consumer errors.
		*/
		async *adapterStream(options, prepared) {
			let iterator;
			try {
				const registration = prepared?.registration ?? this.registration(options.provider);
				const adapter = registration.adapter;
				let modelInfo;
				let resolvedConfig;
				let dispatch;
				if (prepared === void 0) {
					const adapterCall = await adapter.prepareCall(options.provider, options.model, options.signal);
					modelInfo = this.normalizeModelInfo(registration, options.model, adapterCall.model);
					resolvedConfig = this.resolveCallWithInfo(options, modelInfo).config;
					dispatch = (options) => adapterCall.stream(options);
				} else {
					modelInfo = prepared.modelInfo;
					resolvedConfig = prepared.config;
					dispatch = prepared.dispatch;
				}
				if (prepared !== void 0 && !callConfigEquals(options, resolvedConfig)) throw new LlmError("prepared LLM call config changed before adapter dispatch", "INVALID_PREPARED_CALL");
				const resolvedOptions = callConfigEquals(options, resolvedConfig) ? options : Object.isFrozen(options) ? deepFreeze({
					...options,
					...resolvedConfig
				}) : {
					...options,
					...resolvedConfig
				};
				let projectedMessages = resolvedOptions.messages;
				if (projectedMessages.some((message) => contentHasFile(message.content))) projectedMessages = projectFilesToText(projectedMessages, (ref) => this.fileReadPath(ref));
				if (modelInfo.inputModalities !== void 0 && !modelInfo.inputModalities.includes("image") && projectedMessages.some((message) => contentHasImage(message.content))) projectedMessages = projectImagesForTextModel(projectedMessages);
				const projectedOptions = projectedMessages === resolvedOptions.messages ? resolvedOptions : Object.isFrozen(resolvedOptions) ? deepFreeze({
					...resolvedOptions,
					messages: projectedMessages
				}) : {
					...resolvedOptions,
					messages: projectedMessages
				};
				iterator = dispatch(this.forAdapter(projectedOptions, adapter))[Symbol.asyncIterator]();
			} catch (error) {
				yield adapterFailureChunk(error, options.signal);
				return;
			}
			let completed = false;
			try {
				while (true) {
					let item;
					try {
						const next = await iterator.next();
						item = next.done ? { done: true } : {
							done: false,
							value: next.value
						};
					} catch (error) {
						completed = true;
						yield adapterFailureChunk(error, options.signal);
						return;
					}
					if (item.done) {
						completed = true;
						return;
					}
					yield item.value;
				}
			} finally {
				if (!completed) {
					const close = iterator.return?.bind(iterator);
					if (close) await close();
				}
			}
		}
		/**
		* Stream one model call as raw chunks (token-level deltas). Replay state is
		* retained only when the same adapter instance owns its historical provider
		* and the target provider. Final adapter selection remains fixed through
		* asynchronous exact-model resolution and dispatch. Adapter selection,
		* dispatch, and iteration failures become terminal `error` or `aborted`
		* finish chunks; middleware, nested-call, cleanup, and consumer failures
		* remain thrown.
		* @param options - the full request; `options.provider` selects the adapter.
		* @returns the chunk stream, possibly wrapped by `llm/stream` listeners.
		*/
		stream(options) {
			return this.streamWithRegistration(options);
		}
		streamWithRegistration(options, prepared) {
			return this.ctx.waterfall(this, "llm/stream", options, () => this.adapterStream(options, prepared));
		}
	};
})();
/** Convert one adapter throw into the stream protocol's terminal outcome. */
function adapterFailureChunk(error, signal) {
	const failure = normalizeLlmFailure(error);
	return {
		type: "finish",
		reason: signal?.aborted || failure.code === "ABORTED" ? {
			kind: "aborted",
			failure
		} : {
			kind: "error",
			failure
		}
	};
}
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-session/lib/index.js
/**
* Brand a string as a {@link SessionId}.
* @param id - the raw session id string.
* @returns the same string with the session-id brand.
*/
function SessionId(id) {
	return brandString(id);
}
/**
* Admit a numeric value as an existing Session event position.
* @param value - non-negative safe integer admitted by the owning log operation.
* @returns the same number with the Session-sequence brand.
*/
function SessionSeq(value) {
	if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new TypeError(`SessionSeq must be a non-negative safe integer, got ${String(value)}`);
	return brandNumber(value);
}
/**
* Admit a numeric value as a Session log offset.
* @param value - non-negative safe integer used as a gap or prefix length.
* @returns the same number with the Session-log-offset brand.
*/
function SessionLogOffset(value) {
	if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new TypeError(`SessionLogOffset must be a non-negative safe integer, got ${String(value)}`);
	return brandNumber(value);
}
/**
* GENERATED by `scripts/gen-persistence-catalog.ts` — do not edit by hand; run
* `pnpm run gen-persistence-catalog` to regenerate (verified fresh by
* `pnpm run verify-persistence-catalog`, part of `doc-sync`).
* @module @deepseek-ai/dsh-session/known-event-types
*/
/**
* Every `SessionEventMap` member declared in this repository — the event
* vocabulary this build understands. The persistence read path refuses to
* interpret a log containing a type outside this set unless the event
* carries the envelope's `ignorable` marker (see `SessionEvent.ignorable`
* in `./types.ts`): such a log was likely written by a newer harness, and
* silently skipping a required event would reconstruct a wrong session.
* Downstream (out-of-repo) plugin events are outside this list by
* construction. The persisted `SessionEvent.ignorable` marker is the
* compatibility mechanism; event-name registration was rejected because
* it does not classify omission safety and would make reads
* composition-dependent. The rationale is in
* `.agents/notes/implemented/architecture/2026-08-30-retain-ignorable-external-session-events.md`.
*/
const KNOWN_SESSION_EVENT_TYPES = /* @__PURE__ */ new Set([
	"agent-preset/selected",
	"agent/inbox/spliced",
	"approval/asked",
	"approval/decided",
	"approval/policy",
	"assistant/attempt",
	"assistant/message",
	"command/done",
	"command/run",
	"compaction/end",
	"compaction/prune",
	"compaction/start",
	"compaction/summary",
	"deliverables/presented",
	"feedback/message-delete",
	"feedback/message-put",
	"feedback/record",
	"goal/change",
	"hook/invoked",
	"hook/result",
	"llm/retry",
	"llm/retry-started",
	"model/selection",
	"permission/preset",
	"plan/mode",
	"request/context",
	"request/header",
	"sandbox/mode",
	"schedule/change",
	"session-log-deepseek/delivery-accepted",
	"session/end-seed",
	"session/title",
	"session/title-llm-request",
	"step/end",
	"step/start",
	"subagent/catalog",
	"subagent/descriptor",
	"subagent/model-selection-policy",
	"system/message",
	"team/member",
	"team/message/delivered",
	"team/message/queued",
	"team/task",
	"todo/write",
	"tool-workflow/agent-end",
	"tool-workflow/agent-start",
	"tool-workflow/run-end",
	"tool-workflow/run-start",
	"tool/call",
	"tool/ptc-dispatch",
	"tool/ptc-dispatch-start",
	"tool/result",
	"turn/end",
	"turn/start",
	"user/message",
	"web/deepseek-search-llm-request"
]);
/**
* Surface layer on top of the session event log: an ordered view of events
* that produce LLM messages. The append-only log remains the source of truth.
*
* Browser-safe: web clients consume this subpath export, so it must stay free
* of `node:` imports (they break the vite bundle).
*
* @module @deepseek-ai/dsh-session/surface
*/
/** Runtime counterpart of the message-producing event union. */
const SURFACE_EVENT_TYPES = /* @__PURE__ */ new Set([
	"system/message",
	"user/message",
	"assistant/message",
	"tool/result"
]);
/**
* Whether an event type can join the model-visible surface.
* @param type - event type to test.
* @returns true for one of the four message-producing event types.
*/
function isSurfaceEligibleType(type) {
	return SURFACE_EVENT_TYPES.has(type);
}
/**
* Project a single event into the LLM message it derives to, or null when it
* produces none — a non-surface event (attempt, boundary, log-only record) or an
* empty-content assistant/message (which exists only to host usage). This is
* THE per-node projection rule: `Session.deriveMessages` folds it over the
* live surface, external reconstructors and pure projections fold the same
* function over a log prefix's surface to rebuild the exact messages any
* request was built from. The returned message is the already frozen message
* nested in the event wrapper and shared by delivery, durable history, and
* model requests.
* @param event - the event to project.
* @returns the derived message, or null when the event produces none.
*/
function deriveEventMessage(event) {
	switch (event.type) {
		case "user/message": return event.data;
		case "system/message":
		case "assistant/message":
			if (event.data.message.content.length === 0) return null;
			return event.data.message;
		case "tool/result": return event.data.message;
		default: return null;
	}
}
/** Whether a payload field is a JSON object rather than an array or scalar. */
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Reject noncanonical request-header fields and contradictory tool failure metadata.
* This does not validate complete event payloads or embedded provider streams.
* @param event - event whose locally related payload fields are inspected.
* @param subject - event location to include in validation errors.
* @throws when request data/header is not an object, optional header fields are empty, or tool failure metadata contradicts its message.
*/
function validateSessionEventData(event, subject) {
	const data = event.data;
	if (event.type === "request/header") {
		if (!isRecord(data)) throw new Error(`${subject} data must be an object`);
		const header = data["header"];
		if (!isRecord(header)) throw new Error(`${subject} header must be an object`);
		if (Object.hasOwn(header, "system")) throw new Error(`${subject} must omit header.system; use system/message`);
		if (Array.isArray(header["tools"]) && header["tools"].length === 0) throw new Error(`${subject} must omit empty tools`);
		const defaults = header["adapterDefaults"];
		if (isRecord(defaults) && Object.keys(defaults).length === 0) throw new Error(`${subject} must omit empty adapterDefaults`);
	} else if (event.type === "tool/result") {
		if (!isRecord(data)) throw new Error(`${subject} data must be an object`);
		if (data["error"] === void 0) return;
		const message = data["message"];
		const content = isRecord(message) ? message["content"] : void 0;
		const block = Array.isArray(content) ? content[0] : void 0;
		if (!isRecord(block) || block["isError"] !== true) throw new Error(`${subject} error requires message content[0].isError === true`);
	}
}
/** Create an empty surface fold state. */
function createFoldState() {
	return {
		nodes: [],
		replaceGeneration: 0
	};
}
/** Whether a runtime value is a non-negative safe event sequence. */
function isEventSeq(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}
/** Whether a runtime value is the exact positional-replacement shape. */
function isReplaceOp(value) {
	const op = value;
	return Object.keys(op).length === 3 && Object.hasOwn(op, "op") && Object.hasOwn(op, "startSeq") && Object.hasOwn(op, "endSeq") && op["op"] === "replace" && isEventSeq(op["startSeq"]) && isEventSeq(op["endSeq"]);
}
/** Validate event-local surface eligibility and return its operation. */
function surfaceOpOf(event) {
	const raw = event;
	if (!isSurfaceEligibleType(event.type)) {
		if (!KNOWN_SESSION_EVENT_TYPES.has(event.type) && event.ignorable === true) return;
		if (raw.surfaceOp !== void 0) throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry surfaceOp`);
		if (raw.sourceEventSeqs !== void 0) throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry sourceEventSeqs`);
		return;
	}
	const op = raw.surfaceOp;
	if (op === void 0) throw new Error(`session event "${event.type}" is surface-eligible and requires a surfaceOp marker`);
	if (op === "append") return op;
	if (op === null || typeof op !== "object" || Array.isArray(op)) throw new Error(`session event "${event.type}" carries an invalid surfaceOp`);
	if (!isReplaceOp(op)) throw new Error(`session event "${event.type}" carries an invalid replace surfaceOp`);
	return op;
}
/** Validate cited source-event seqs against prior log entries and the replacement range. */
function assertProvenance(event, shadowedSeqs) {
	const raw = event.sourceEventSeqs;
	if (event.type === "assistant/message" && raw !== void 0) throw new Error("assistant/message embeds its source stream and cannot carry sourceEventSeqs");
	const sources = /* @__PURE__ */ new Set();
	if (raw !== void 0) {
		if (!Array.isArray(raw)) throw new Error(`sourceEventSeqs on event at seq ${event.seq} must be an array when present`);
		if (raw.length === 0) throw new Error("sourceEventSeqs must not be empty");
		let nonEarlierSource;
		for (const source of raw) {
			if (!isEventSeq(source)) throw new Error(`session event "${event.type}" sourceEventSeqs must densely contain non-negative safe integers`);
			sources.add(source);
			if (nonEarlierSource === void 0 && source >= event.seq) nonEarlierSource = source;
		}
		if (sources.size !== raw.length) throw new Error("sourceEventSeqs must not contain duplicates");
		if (nonEarlierSource !== void 0) throw new Error(`sourceEventSeqs must reference earlier events: ${nonEarlierSource} >= current seq ${event.seq}`);
	}
	const missing = shadowedSeqs.filter((seq) => !sources.has(seq));
	if (missing.length > 0) throw new Error(`surface replace: sourceEventSeqs must include every shadowed surface node; missing ${missing.join(", ")}`);
}
/**
* Validate one event's surface metadata without checking membership in a log or surface.
* @param event - event whose marker and source sequence values are inspected.
* Unknown ignorable records retain opaque metadata and never change the surface.
* @returns the validated operation, or undefined for a log-only or unknown ignorable event.
* @throws when metadata violates event-local eligibility, marker, or source-sequence rules.
*/
function validateSurfaceMetadata(event) {
	const op = surfaceOpOf(event);
	if (op !== void 0 && op !== "append" && (op.startSeq >= event.seq || op.endSeq >= event.seq)) throw new Error(`surface replace at seq ${event.seq}: startSeq and endSeq must reference earlier events`);
	if (op !== void 0) assertProvenance(event, []);
	return op;
}
/** Locate one replacement range without mutating the current fold state. */
function replacementRange(state, op) {
	const startIdx = state.nodes.indexOf(op.startSeq);
	if (startIdx === -1) throw new Error(`surface replace: start seq ${op.startSeq} not found in surface`);
	const endIdx = state.nodes.indexOf(op.endSeq);
	if (endIdx === -1) throw new Error(`surface replace: end seq ${op.endSeq} not found in surface`);
	if (startIdx > endIdx) throw new Error(`surface replace: start seq ${op.startSeq} (index ${startIdx}) is after end seq ${op.endSeq} (index ${endIdx})`);
	return {
		startIdx,
		endIdx,
		shadowedSeqs: state.nodes.slice(startIdx, endIdx + 1)
	};
}
/**
* Deep structural equality over the session-event JSON value domain
* (null/boolean/number/string, arrays, plain objects). Replaces
* `node:util`'s isDeepStrictEqual to keep this module browser-safe.
*/
function isDeepEqualJson$1(a, b) {
	if (a === b) return true;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((item, i) => isDeepEqualJson$1(item, b[i]));
	}
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	const aKeys = Object.keys(a);
	const bRecord = b;
	if (aKeys.length !== Object.keys(b).length) return false;
	return aKeys.every((key) => Object.hasOwn(b, key) && isDeepEqualJson$1(a[key], bRecord[key]));
}
/** Restrict a tool-result replacement to one current result's content. */
function assertToolResultRewrite(event, shadowedSeqs, events, baseSeq) {
	if (event.type !== "tool/result") return;
	if (shadowedSeqs.length !== 1) throw new Error("tool/result surface replacement must rewrite exactly one current node");
	for (const originalSeq of shadowedSeqs) {
		const original = events[originalSeq - baseSeq];
		if (original?.type !== "tool/result") throw new Error("tool/result surface replacement must target a current tool/result");
		const originalRest = { ...original.data };
		const replacementRest = { ...event.data };
		const originalResult = original.data.message.content[0];
		const replacementResult = event.data.message.content[0];
		originalRest["message"] = {
			...original.data.message,
			content: [{
				...originalResult,
				content: null
			}]
		};
		replacementRest["message"] = {
			...event.data.message,
			content: [{
				...replacementResult,
				content: null
			}]
		};
		if (!isDeepEqualJson$1(originalRest, replacementRest)) throw new Error("tool/result surface replacement may change only content");
	}
}
/**
* Protect the system prompt at surface node 0. A replacement covering node 0
* while that node is a `system/message` must itself be a `system/message` over
* exactly that node; later system nodes carry no protection and a compaction
* range may shadow them.
*/
function assertSystemHeadRewrite(event, state, startIdx, shadowedSeqs, events, baseSeq) {
	if (startIdx !== 0) return;
	if (events[state.nodes[0] - baseSeq]?.type !== "system/message") return;
	if (event.type !== "system/message" || shadowedSeqs.length !== 1) throw new Error("surface replace: node 0 holds the system prompt and may be rewritten only by a system/message over exactly that node");
}
/** Validate one event at its replay boundary and prepare its atomic fold transition. */
function planSurfaceEvent(state, event, expectedSeq, events, baseSeq) {
	if (event.seq !== expectedSeq) throw new Error(`session event seq ${event.seq} is not contiguous; expected ${expectedSeq}`);
	const surfaceOp = validateSurfaceMetadata(event);
	if (surfaceOp === void 0) return;
	if (surfaceOp === "append") return {
		kind: "append",
		seq: event.seq
	};
	const range = replacementRange(state, surfaceOp);
	assertProvenance(event, range.shadowedSeqs);
	assertToolResultRewrite(event, range.shadowedSeqs, events, baseSeq);
	assertSystemHeadRewrite(event, state, range.startIdx, range.shadowedSeqs, events, baseSeq);
	return {
		kind: "replace",
		seq: event.seq,
		start: surfaceOp.startSeq,
		end: surfaceOp.endSeq,
		...range
	};
}
/** Apply one event and return replacement metadata only when one occurred. */
function applySurfaceEvent(state, event, expectedSeq, events, baseSeq) {
	return applySurfacePlan(state, planSurfaceEvent(state, event, expectedSeq, events, baseSeq));
}
/** Commit one previously validated surface transition. */
function applySurfacePlan(state, plan) {
	if (plan?.kind === "append") state.nodes.push(plan.seq);
	else if (plan?.kind === "replace") {
		state.nodes.splice(plan.startIdx, plan.endIdx - plan.startIdx + 1, plan.seq);
		state.replaceGeneration += 1;
	}
	if (plan?.kind !== "replace") return;
	return {
		seq: plan.seq,
		start: plan.start,
		end: plan.end,
		shadowedSeqs: plan.shadowedSeqs
	};
}
/**
* Replay a complete session log through the canonical surface fold.
* @param events - session events in contiguous seq order.
* @returns detached current sequences and replacement history.
* @throws when an event violates surface metadata, source-event references, range, or tool-result rewrite rules.
*/
function foldSurface(events) {
	const state = createFoldState();
	const replacements = [];
	for (const [index, event] of events.entries()) {
		const replacement = applySurfaceEvent(state, event, SessionSeq(index), events, SessionLogOffset(0));
		if (replacement !== void 0) replacements.push(replacement);
	}
	return {
		nodes: [...state.nodes],
		replacements
	};
}
/** Incremental ordered surface view and append-boundary validator. */
var SurfaceManager = class {
	log;
	baseSeq;
	/** Shared transition state; replacement history is not retained. */
	_state = createFoldState();
	/** Last processed absolute seq. */
	_lastProcessedSeq;
	/** Candidate already validated by `validateNext`, pending exact log admission. */
	_pendingPlan;
	/**
	* @param log - Contiguous complete log or loaded event window.
	* @param baseSeq - Absolute sequence of the window's first event.
	*/
	constructor(log, baseSeq = SessionLogOffset(0)) {
		this.log = log;
		this.baseSeq = baseSeq;
		this._lastProcessedSeq = baseSeq === 0 ? -1 : SessionSeq(baseSeq - 1);
	}
	/**
	* Validate the next candidate without mutating the committed surface.
	* @param event - candidate event that has not entered the log yet.
	*/
	validateNext(event) {
		if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1) this._processDelta();
		const expectedSeq = SessionSeq(this.baseSeq + this.log.length);
		this._pendingPlan = {
			event,
			expectedSeq,
			plan: planSurfaceEvent(this._state, event, expectedSeq, this.log, this.baseSeq)
		};
	}
	/** Monotonic count of folded positional replacements. */
	get replaceGeneration() {
		if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1) this._processDelta();
		return this._state.replaceGeneration;
	}
	/** Surface event sequences in model-visible order. */
	get nodes() {
		if (this._lastProcessedSeq < this.baseSeq + this.log.length - 1) this._processDelta();
		return this._state.nodes;
	}
	/** Fold events appended since the previous access. */
	_processDelta() {
		const tailSeq = this.baseSeq + this.log.length - 1;
		for (let seq = this._lastProcessedSeq + 1; seq <= tailSeq; seq++) {
			const index = seq - this.baseSeq;
			const event = this.log[index];
			const pending = this._pendingPlan;
			if (pending?.event === event && pending.expectedSeq === seq) applySurfacePlan(this._state, pending.plan);
			else applySurfaceEvent(this._state, event, SessionSeq(seq), this.log, this.baseSeq);
			if (pending !== void 0 && pending.expectedSeq <= seq) this._pendingPlan = void 0;
			this._lastProcessedSeq = SessionSeq(seq);
		}
	}
};
/**
* Request-header reconstruction utilities over full `request/header` session
* events. Anyone holding a session log reconstructs the {@link EpochHeader}
* any request was built under by taking the latest canonical snapshot; the
* loop uses the same equality helper to avoid logging unchanged headers.
*
* @module dsh-session/request-header
*/
/**
* Normalize a header to canonical form: an empty tool list becomes an absent
* field, matching how requests are built. Logging, folding, and comparison use
* this one representation.
* @param header - the header to normalize (not mutated).
* @returns the canonical header.
*/
function canonicalHeader(header) {
	const adapterDefaults = header.adapterDefaults;
	return {
		config: header.config,
		...adapterDefaults?.reasoningEffort === true || adapterDefaults?.maxTokens === true ? { adapterDefaults } : {},
		...header.tools !== void 0 && header.tools.length > 0 ? { tools: header.tools } : {}
	};
}
/**
* Fold the header events of a log (or any prefix) into the
* {@link EpochHeader} in force after the last snapshot. Non-header events are
* skipped. This is the pure offline reconstruction path; the live session
* tracks the same fold incrementally.
* @param events - session events in log order.
* @param from - a previously folded state to continue from.
* @returns the latest canonical header, or undefined when none exists yet.
*/
function foldRequestHeader(events, from) {
	let state = from;
	for (const event of events) if (event.type === "request/header") state = canonicalHeader(event.data.header);
	return state;
}
/**
* Event-sourced session service: append-only session log, in-memory store, and
* the derived LLM message history. Persistence is a plugin concern (subscribe
* to `session/event`, drain on `session/flush`).
*
* @module @deepseek-ai/dsh-session
*/
/** Validate and freeze one detached creation header in place. */
function validateSessionHeader(id, input) {
	if (input === null || typeof input !== "object" || Array.isArray(input)) throw new Error("session header is not a plain JSON record");
	const record = input;
	if (Object.hasOwn(record, "seedLength")) throw new Error("session header has invalid field \"seedLength\"");
	if (record.version !== 3) throw new Error(`session header version must be 3, got ${String(record.version)}`);
	if (record.id !== id) throw new Error(`session header id "${String(record.id)}" does not match session id "${id}"`);
	if (typeof record.createdAt !== "number" || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0) throw new Error("session header createdAt must be a non-negative safe integer");
	if (record.cwd !== void 0) {
		if (typeof record.cwd !== "string") throw new Error("session header cwd must be a string");
		if (!isAbsolute(record.cwd)) throw new Error(`session header cwd must be an absolute path, got "${record.cwd}"`);
	}
	if (record.parentSession !== void 0 && typeof record.parentSession !== "string") throw new Error("session header parentSession must be a string");
	if (typeof record.isSeeded !== "boolean") throw new Error("session header isSeeded must be a boolean");
	if (record.origin !== void 0 && record.origin !== "subagent") throw new Error("session header origin must be \"subagent\"");
	if (record.delegationDepth !== void 0 && (typeof record.delegationDepth !== "number" || !Number.isSafeInteger(record.delegationDepth) || record.delegationDepth < 0)) throw new Error("session header delegationDepth must be a non-negative safe integer");
	if (record.agentPreset !== void 0 && typeof record.agentPreset !== "string") throw new Error("session header agentPreset must be a string");
	return deepFreeze(record);
}
/** Validate and freeze one exclusively owned persistence header in place. */
function validateRestoredSessionHeader(id, input) {
	if (input !== null && typeof input === "object" && !Array.isArray(input)) {
		const prototype = Reflect.getPrototypeOf(input);
		if (prototype !== Object.prototype && prototype !== null) throw new Error("session header is not a plain JSON record");
	}
	return validateSessionHeader(id, input);
}
/** Detach, validate, and freeze the creation metadata published by a session. */
function snapshotSessionHeader(id, source) {
	const snapshot = snapshotJsonValue(source === void 0 ? {
		version: 3,
		id,
		createdAt: Date.now(),
		isSeeded: false
	} : source);
	if (snapshot === void 0) throw new Error("session header is not losslessly JSON-serializable");
	return validateSessionHeader(id, snapshot);
}
/**
* Validate an exclusively owned event and deeply freeze its identified message
* without copying the event. The caller transfers an object graph that no
* producer retains and that shares no mutable children with another event.
* Use {@link snapshotSessionEvent} when exclusive ownership is not guaranteed.
* @param event - exclusively owned event imported across a trusted boundary.
* @returns the same event object with a validated, deeply frozen message.
* @throws when event-local surface metadata, request-header fields, or message invariants are invalid; history relations are not checked.
*/
function adoptSessionEvent(event) {
	validateSessionEventData(event, `session event at seq ${event.seq}`);
	validateSurfaceMetadata(event);
	assertMessageEventShape(event, `session event at seq ${event.seq}`);
	switch (event.type) {
		case "user/message":
			deepFreeze(event.data);
			break;
		case "system/message":
		case "assistant/message":
		case "tool/result":
			deepFreeze(event.data.message);
			break;
		default: break;
	}
	return event;
}
/** Validate the fixed event envelope after one-pass JSON materialization. */
function assertSessionEventEnvelope(value, index) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`seed event at index ${index} has an invalid event envelope`);
	const event = value;
	for (const key in event) switch (key) {
		case "type":
		case "seq":
		case "time":
		case "data":
		case "surfaceOp":
		case "sourceEventSeqs":
		case "ignorable": break;
		default: throw new Error(`seed event at index ${index} has an invalid event envelope`);
	}
	const type = event["type"];
	const seq = event["seq"];
	const time = event["time"];
	if (typeof type !== "string" || typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0 || Object.is(seq, -0) || typeof time !== "number" || !Number.isSafeInteger(time) || event["data"] === void 0 || event["ignorable"] !== void 0 && event["ignorable"] !== true) throw new Error(`seed event at index ${index} has an invalid event envelope`);
	validateSessionEventData(event, `seed ${type} at index ${index}`);
	switch (type) {
		case "request/header":
		case "system/message":
		case "user/message":
		case "assistant/attempt":
		case "assistant/message":
		case "tool/result":
			assertCurrentLlmShape(event, index);
			break;
	}
}
/** Reject obsolete request headers and malformed messages at the seed/load boundary. */
function assertCurrentLlmShape(event, index) {
	const data = event["data"];
	const record = typeof data === "object" && data !== null ? data : void 0;
	if (event["type"] === "request/header") {
		const headerRecord = record?.["header"];
		const config = headerRecord["config"];
		if (!hasProviderModel(config)) throw new Error(`seed request/header at index ${index} lacks provider/model`);
		const configRecord = config;
		const reasoningEffort = configRecord["reasoningEffort"];
		if (reasoningEffort !== void 0 && (typeof reasoningEffort !== "string" || reasoningEffort.length === 0)) throw new Error(`seed request/header at index ${index} has an invalid reasoningEffort`);
		assertAdapterDefaults(headerRecord["adapterDefaults"], configRecord, index);
		const reason = record?.["reason"];
		if (reason !== "initial" && reason !== "resume" && reason !== "change" && reason !== "series") throw new Error(`seed request/header at index ${index} has an invalid reason`);
		if (record?.["startsSeries"] !== void 0 && record["startsSeries"] !== true) throw new Error(`seed request/header at index ${index} has an invalid startsSeries marker`);
	}
	const type = event["type"];
	if (type === "assistant/attempt") {
		assertAssistantSettlementShape(record, type, index);
		return;
	}
	if (!isMessageEventType(type)) return;
	assertMessageEventShape(event, `seed ${type} at index ${index}`);
	if (type === "assistant/message") assertAssistantSettlementShape(record, type, index);
}
/** Validate fields used directly by restored Session lifecycle logic without replaying the embedded stream. */
function assertAssistantSettlementShape(data, type, index) {
	const turn = data?.["turn"];
	const step = data?.["step"];
	if (typeof turn !== "number" || !Number.isSafeInteger(turn) || turn < 0 || Object.is(turn, -0) || typeof step !== "number" || !Number.isSafeInteger(step) || step < 0 || Object.is(step, -0) || !Array.isArray(data?.["stream"])) throw new Error(`seed ${type} at index ${index} has invalid settlement fields`);
}
const allowedAdapterKeys = /* @__PURE__ */ new Set(["reasoningEffort", "maxTokens"]);
/** Validate adapter-default markers imported from a durable request header. */
function assertAdapterDefaults(value, config, index) {
	if (value === void 0) return;
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`seed request/header at index ${index} has invalid adapterDefaults`);
	const defaults = value;
	if (Object.keys(defaults).some((key) => !allowedAdapterKeys.has(key)) || Object.values(defaults).some((marker) => marker !== true) || defaults["reasoningEffort"] === true && config["reasoningEffort"] === void 0 || defaults["maxTokens"] === true && config["maxTokens"] === void 0) throw new Error(`seed request/header at index ${index} has invalid adapterDefaults`);
}
/** The four surface event types whose payload carries an identified message. */
function isMessageEventType(type) {
	return type === "system/message" || type === "user/message" || type === "assistant/message" || type === "tool/result";
}
const MESSAGE_ROLE_BY_TYPE = {
	"system/message": "system",
	"user/message": "user",
	"assistant/message": "assistant",
	"tool/result": "user"
};
/** Validate only the event-specific invariants needed to safely replay a message. */
function assertMessageEventShape(event, subject) {
	const type = event["type"];
	if (!isMessageEventType(type)) return;
	const data = event["data"];
	const record = typeof data === "object" && data !== null ? data : void 0;
	const message = type === "user/message" ? record : record?.["message"];
	if (typeof message !== "object" || message === null || typeof message["id"] !== "string" || message["id"] === "") throw new Error(`${subject} lacks an identified message`);
	const messageRecord = message;
	const expectedRole = MESSAGE_ROLE_BY_TYPE[type];
	if (messageRecord["role"] !== expectedRole) throw new Error(`${subject} message must have role "${expectedRole}"`);
	const source = messageRecord["source"];
	if (typeof source !== "object" || source === null || typeof source["kind"] !== "string" || source["kind"] === "") throw new Error(`${subject} message has invalid source`);
	if (!Array.isArray(messageRecord["content"])) throw new Error(`${subject} message has invalid content`);
	const sourceRecord = source;
	if (type === "system/message") {
		if (sourceRecord["kind"] !== "plugin" || typeof sourceRecord["plugin"] !== "string" || sourceRecord["plugin"] === "") throw new Error(`${subject} message must have plugin source`);
		return;
	}
	if (type === "assistant/message") {
		if (sourceRecord["kind"] !== "model" || !hasProviderModel(sourceRecord)) throw new Error(`${subject} message must have model source`);
		return;
	}
	if (type !== "tool/result") return;
	if (sourceRecord["kind"] !== "tool" || typeof sourceRecord["callId"] !== "string" || sourceRecord["callId"] === "") throw new Error(`${subject} message must have tool source`);
	const content = messageRecord["content"];
	const block = content[0];
	if (content.length !== 1 || typeof block !== "object" || block === null || block["type"] !== "tool-result" || !Array.isArray(block["content"])) throw new Error(`${subject} message must contain one tool-result block`);
	if (block["toolCallId"] !== sourceRecord["callId"]) throw new Error(`${subject} message has mismatched tool call ids`);
}
/** Whether an unknown value carries the current provider/model pair. */
function hasProviderModel(value) {
	if (typeof value !== "object" || value === null) return false;
	const pair = value;
	return typeof pair["provider"] === "string" && pair["provider"].length > 0 && typeof pair["model"] === "string" && pair["model"].length > 0;
}
/** Resolve one listener snapshot, including Cordis's internal dispatch checks. */
function collectSessionCallbacks(ctx, args) {
	return [...ctx.events.dispatch("emit", args)];
}
/** Invoke one resolved observe-only listener snapshot with per-listener containment. */
function invokeContainedSessionObservers(ctx, name, id, args, callbacks) {
	for (const callback of callbacks) try {
		const returned = callback(...args);
		Promise.resolve(returned).catch((error) => {
			ctx.logger.warn(`session "${id}": ${name} listener rejected: ${String(error)}`);
		});
	} catch (error) {
		ctx.logger.warn(`session "${id}": ${name} listener threw: ${String(error)}`);
	}
}
/** Store attachment for the append path; module-private to keep Session store-agnostic publicly. */
const attachments = /* @__PURE__ */ new WeakMap();
/**
* An event-sourced session: an append-only log of {@link SessionEvent}s.
*
* Plain class (not a Service) — create live instances via
* `ctx.sessions.create()` and detached instances via {@link create}.
* Seeding with an existing event log replays/forks a session.
* @typert object
*/
var Session = class Session {
	log = [];
	/** Single incremental owner of surface acceptance and projection state. */
	surfaceManager = new SurfaceManager(this.log);
	/** The ordered surface over this session's event log. */
	get surface() {
		return this.surfaceManager;
	}
	/**
	* Detached, deep-frozen creation metadata (format version, cwd, lineage,
	* and whether fork history exists). Supplied by the store via `ctx.sessions.create()`. When a
	* `Session` is created without a store-owned header, a minimal header is
	* synthesized (stamped with the current {@link SESSION_FORMAT_VERSION}) so
	* `session.header` is always present. Kept out of the event log — it is a
	* storage concern, not replayable conversation state.
	*/
	header;
	/** Number of leading events inherited from this Session's fork parent. */
	inheritedEventCount;
	/** The session identity, derived from its durable header's single copy. */
	get id() {
		return this.header.id;
	}
	/**
	* The first seq appended IN THIS PROCESS: the length of the constructor
	* seed (0 without one). Events with smaller seq values entered through
	* construction — replay, fork, or resume — and were never published on the
	* `session/event` firehose (constructor seeds do not emit). This offset marks
	* the constructor-input boundary for lifecycle ownership and persistence
	* adoption; consumers that need complete canonical history still start at
	* seq 0. Distinct from {@link inheritedEventCount}, the DURABLE
	* fork-lineage cut: a resumed session's constructor seed is its full stored
	* log, while the inherited count keeps the original fork value — this field is the
	* in-process construction fact.
	*
	* Not persisted itself: a seeded session projects it into the log as the
	* `session/end-seed` event, which is what a consumer reading STORED history
	* reads. Locate the LAST such event, not necessarily one at this seq — a
	* seed already ending in one is not re-marked, so reopening an untouched
	* session leaves that event at a smaller seq than `firstLiveSeq`. Prefer
	* this field in-process: it is exact before the marker reaches storage.
	*
	* When this lifecycle appends the marker, it occupies this seq before the
	* store attaches and therefore does not publish either. Otherwise this seq
	* holds an ordinary published write.
	*/
	firstLiveSeq;
	/**
	* Create a detached session by validating and snapshotting borrowed seed
	* events and storage metadata.
	* @param id - session identity.
	* @param seed - optional borrowed replay or fork events.
	* @param header - optional borrowed storage metadata.
	* @param inheritedEventCount - exact fork-inherited prefix length for a seeded header.
	* @returns a detached session.
	*/
	static create(id, seed, header, inheritedEventCount) {
		return new Session(id, seed, header, "snapshot", inheritedEventCount);
	}
	/**
	* Restore a detached session by adopting an independently owned or deeply frozen seed.
	* Runtime-required event fields, event envelopes, sequence continuity, surface
	* transitions, and header fields are validated without copying or freezing events.
	* Embedded Assistant streams remain opaque until a stream consumer or storage
	* verifier reads them.
	* @param id - restored session identity.
	* @param seed - independently owned or deeply frozen events.
	* @param header - independently owned storage metadata.
	* @param inheritedEventCount - exact fork-inherited prefix length decoded from storage.
	* @param eventState - aliasing state carried from the operation that produced the seed.
	* @returns a restored detached session.
	*/
	static fromRestore(id, seed, header, inheritedEventCount, eventState) {
		return new Session(id, seed, header, eventState, inheritedEventCount);
	}
	constructor(id, seed, header, mode = "snapshot", suppliedInheritedEventCount) {
		const restoredHeader = mode === "snapshot" ? void 0 : validateRestoredSessionHeader(id, header);
		if (seed !== void 0) for (const [index, source] of seed.entries()) {
			const snapshot = mode === "snapshot" ? snapshotJsonValue(source) : source;
			if (snapshot === void 0) throw new Error(`seed event at index ${index} is not losslessly JSON-serializable`);
			assertSessionEventEnvelope(snapshot, index);
			if (snapshot.seq !== index) throw new Error(`seed event at index ${index} has seq ${snapshot.seq} (expected ${index}); seed must be contiguous from 0`);
			try {
				this.surfaceManager.validateNext(snapshot);
			} catch (error) {
				throw new Error(`invalid seed event at index ${index}: ${error instanceof Error ? error.message : "invalid surface metadata"}`);
			}
			this.log.push(mode === "snapshot" ? deepFreeze(snapshot) : snapshot);
		}
		this.firstLiveSeq = SessionLogOffset(this.log.length);
		this.header = restoredHeader ?? snapshotSessionHeader(id, header);
		if (this.header.isSeeded && seed === void 0) throw new Error("seeded session requires an explicit constructor seed");
		if (this.header.isSeeded && suppliedInheritedEventCount === void 0) throw new Error("seeded session requires an inherited event count");
		const inheritedEventCount = SessionLogOffset(suppliedInheritedEventCount ?? 0);
		if (!this.header.isSeeded && inheritedEventCount !== 0) throw new Error("unseeded session inherited event count must be 0");
		if (inheritedEventCount > this.log.length) throw new Error("session inherited event count exceeds its event log");
		if (mode === "snapshot" && this.header.isSeeded && inheritedEventCount !== this.log.length) throw new Error("seeded session constructor seed must equal its inherited prefix");
		this.inheritedEventCount = inheritedEventCount;
		if (seed !== void 0 && mode === "snapshot" && this.header.isSeeded) this.append("session/end-seed", { inherited: true });
		else if (seed !== void 0 && this.log.at(-1)?.type !== "session/end-seed") this.append("session/end-seed", {});
	}
	/** Cached immutable full snapshot of the private append-only log. */
	eventsSnapshot;
	/**
	* Return the immutable event stored at one exact sequence number.
	* @param seq - event sequence number.
	* @returns the accepted event, or undefined when the log does not contain it.
	*/
	eventAt(seq) {
		return this.log[seq];
	}
	/**
	* Materialize an immutable snapshot of a half-open event sequence range.
	* A full current snapshot is reused until the next append; every previously
	* returned snapshot remains stable after later appends.
	* @param fromSeq - non-negative inclusive sequence number; defaults to the log start.
	* @param toSeqExclusive - non-negative exclusive sequence number; defaults to the current end.
	* @returns a frozen array of the selected deeply frozen events.
	*/
	snapshotEvents(fromSeq = SessionLogOffset(0), toSeqExclusive = this.seq) {
		if (fromSeq === 0 && toSeqExclusive === this.log.length) {
			this.eventsSnapshot ??= Object.freeze([...this.log]);
			return this.eventsSnapshot;
		}
		return Object.freeze(this.log.slice(fromSeq, toSeqExclusive));
	}
	/**
	* Return this Session's events after its fork-inherited prefix.
	* @returns a fresh array containing child-owned events in log order.
	*/
	ownEvents() {
		return this.snapshotEvents(this.inheritedEventCount);
	}
	/**
	* Whether one existing event position is outside the fork-inherited prefix.
	* @param seq - event position in this Session.
	* @returns true when the event belongs to this Session rather than its parent.
	*/
	isOwnSeq(seq) {
		return seq >= this.inheritedEventCount && seq < this.seq;
	}
	/** The next event's sequence number — always the log length (the `seq = log.length` contiguity contract). */
	get seq() {
		return SessionLogOffset(this.log.length);
	}
	/**
	* Append one typed event to the log and synchronously notify observers via
	* the store-owned, module-private publication hooks. The hot path never blocks
	* on I/O — persistence plugins buffer asynchronously. Once the event enters
	* the log, the append is committed: observer failures are logged and
	* contained per listener, so they do not change the return value or prevent
	* later listeners from observing the same accepted event.
	*
	* @param type - The event type (key of {@link SessionEventMap}).
	* @param data - The event payload; must be JSON-serializable.
	* @param opts - Surface metadata: `surfaceOp` controls how the event enters
	*   the ordered surface; `sourceEventSeqs` lists the seq numbers of earlier
	*   events this one derives from. REQUIRED for
	*   {@link SurfaceEventType} events (every message-producing event must
	*   declare how it joins the surface, the sole source of derived model
	*   history) and
	*   rejected by the compiler for non-surface types like `turn/start` or
	*   `assistant/attempt`. Assistant messages embed their exact provider
	*   stream and cannot cite top-level source events.
	* @returns the logged event — its assigned `seq`/`time` plus the SNAPSHOT of
	*   `data` that entered the log, so reading `event.data` back sees the logged
	*   value, never the caller's still-mutable input.
	* @throws if `data` or surface metadata is not losslessly JSON-serializable
	*   (BigInt, function, symbol, undefined, negative zero, non-finite number,
	*   circular reference, sparse array, or an exotic object such as
	*   Map/Set/Date/class instance), or when the candidate violates the
	*   request-header empty-field or tool-error consistency rules, or the
	*   canonical surface contract (marker shape and eligibility, unique
	*   earlier source-event references, positional replacement validity, and complete
	*   shadowed-node coverage). One iterative pass reads, validates, and
	*   copies each nested value once, so a stateful getter cannot supply one value
	*   to validation and another to storage. The event log is the durable source
	*   of truth, so a bad event fails at the append site rather than later during
	*   a backend flush. A synchronous internal dispatch validation failure or an
	*   append reentered while this acceptance/publication boundary is open also
	*   rejects before the log changes.
	*/
	append(type, data, ...opts) {
		const surfaceOpts = opts[0];
		const surfaceMetadata = {
			...surfaceOpts?.sourceEventSeqs === void 0 ? {} : { sourceEventSeqs: surfaceOpts.sourceEventSeqs },
			...surfaceOpts?.surfaceOp === void 0 ? {} : { surfaceOp: surfaceOpts.surfaceOp }
		};
		const dataSnapshot = snapshotJsonValue(data);
		if (dataSnapshot === void 0) throw new Error(`session event "${type}" carries non-JSON-serializable data`);
		const surfaceMetadataSnapshot = snapshotJsonValue(surfaceMetadata);
		if (surfaceMetadataSnapshot === void 0) throw new Error(`session event "${type}" carries non-JSON-serializable surface metadata`);
		const entry = attachments.get(this);
		if (entry?.appending) throw new Error("session append cannot reenter while another append is being published");
		const event = deepFreeze({
			type,
			seq: SessionSeq(this.log.length),
			time: Date.now(),
			data: dataSnapshot,
			...surfaceMetadataSnapshot
		});
		validateSessionEventData(event, `session event "${type}" at seq ${event.seq}`);
		this.surfaceManager.validateNext(event);
		if (entry !== void 0) entry.appending = true;
		try {
			let callbacks;
			const callbackArgs = [this, event];
			if (entry !== void 0) callbacks = collectSessionCallbacks(entry.emitCtx, [
				entry.carrier,
				"session/event",
				...callbackArgs
			]);
			this.log.push(event);
			this.eventsSnapshot = void 0;
			if (callbacks !== void 0 && entry !== void 0) invokeContainedSessionObservers(entry.emitCtx, "session/event", entry.id, callbackArgs, callbacks);
			return event;
		} finally {
			if (entry !== void 0) {
				entry.appending = false;
				if (entry.detachRequested && !entry.announcing) entry.detach();
			}
		}
	}
	/** Cached fold of the request-header events — see {@link requestHeader}. */
	headerFold;
	/** Log position (events consumed) the header fold has reached. */
	headerFoldSeq = 0;
	/**
	* The {@link EpochHeader} in force after the log's last header event — the
	* header the NEXT request will be compared against — or undefined before
	* the first `request/header` snapshot. The live, incrementally-maintained
	* form of `foldRequestHeader(session.snapshotEvents())`: each header event is folded
	* once, when first seen, so a per-step read costs O(new events).
	* @returns the folded header, or undefined when no header event exists yet.
	*/
	requestHeader() {
		if (this.headerFoldSeq < this.log.length) {
			this.headerFold = deepFreeze(foldRequestHeader(this.log.slice(this.headerFoldSeq), this.headerFold));
			this.headerFoldSeq = this.log.length;
		}
		return this.headerFold;
	}
	/** Cached fold of `request/context` events. */
	contextFold;
	contextFoldSeq = 0;
	/**
	* Return the latest resolved route metadata, or `undefined` before the first
	* `request/context` event. Each event is folded once.
	* @returns the latest immutable route metadata.
	*/
	requestContext() {
		if (this.contextFoldSeq < this.log.length) {
			for (const event of this.log.slice(this.contextFoldSeq)) if (event.type === "request/context") this.contextFold = deepFreeze({ ...event.data });
			this.contextFoldSeq = this.log.length;
		}
		return this.contextFold;
	}
	/** The derived-message cache: frozen projections, extended per unseen node. */
	derived = [];
	/** Surface position (nodes projected) the cache has reached. */
	derivedNodes = 0;
	/** {@link SurfaceManager.replaceGeneration} the cache was built under. */
	derivedGeneration = 0;
	/**
	* Derive the LLM message history by walking the ordered sequences of
	* message-producing events maintained by `surfaceOp` markers. The
	* surface is the single source of derived history: every message-producing
	* append records its `surfaceOp`, so a raw event with no marker (a chunk, a
	* turn boundary) is correctly absent, and a compaction `replace` deletes the
	* shadowed nodes from the derivation. The projection rules are
	* {@link deriveEventMessage}, folded per node.
	*
	* CACHED: each surface node is projected exactly once, when first seen — a
	* call costs O(new nodes), and a surface rewrite (a `replace`;
	* {@link SessionSurface.replaceGeneration}) rebuilds. The returned array is
	* a fresh snapshot per call (later appends never grow an array a caller
	* already holds); the `Message` objects in it are SHARED and **deep-frozen**.
	* Their content reuses the already frozen durable event data, so the cache
	* needs no second deep clone and consumers still cannot mutate the log.
	* @returns a fresh array of the shared, frozen derived history.
	*/
	deriveMessages() {
		const surface = this.surface;
		const nodes = surface.nodes;
		const generation = surface.replaceGeneration;
		if (generation !== this.derivedGeneration) {
			this.derived = [];
			this.derivedNodes = 0;
			this.derivedGeneration = generation;
		}
		for (const seq of nodes.slice(this.derivedNodes)) {
			const msg = this.deriveEventMessage(this.log[seq]);
			if (msg) this.derived.push(msg);
		}
		this.derivedNodes = nodes.length;
		return [...this.derived];
	}
	/**
	* Instance face of the pure per-node `deriveEventMessage` export from
	* `surface.ts`.
	* @param event - the event to project.
	* @returns the derived message, or null when the event produces none.
	*/
	deriveEventMessage(event) {
		return deriveEventMessage(event);
	}
};
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-session-persistence/lib/index.js
/** Durable session contents failed validation after a successful backend read. */
var SessionPersistenceCorruptionError = class extends Error {
	/**
	* @param message - stable corruption context.
	* @param options - original validation failure.
	*/
	constructor(message, options) {
		super(message, options);
		this.name = "SessionPersistenceCorruptionError";
	}
};
/**
* The stored log is intact but this runtime cannot faithfully interpret it:
* the header carries an unsupported format version, or an event's type is
* unknown to this build. Distinct from {@link SessionPersistenceCorruptionError}
* — nothing is damaged; the raw log remains readable at {@link location} when
* the backend keeps one artifact per session.
*/
var SessionFormatUnsupportedError = class extends Error {
	location;
	/**
	* @param message - stable reason the log cannot be interpreted, already
	*   including the raw-log path when one exists.
	* @param location - the backend's artifact location, when one exists.
	*/
	constructor(message, location) {
		super(message);
		this.location = location;
		this.name = "SessionFormatUnsupportedError";
	}
};
/**
* Backend-shared storage validation: the version gate, the fail-closed event
* vocabulary, append-batch materialization, and contiguity — one place so
* every backend refuses the same inputs identically.
* @module @deepseek-ai/dsh-session-persistence/storage-contract
*/
/** Build a format refusal that points at the raw artifact when the backend has one. */
function unsupported(reason, location) {
	return new SessionFormatUnsupportedError(location === void 0 ? reason : `${reason} (raw log: ${location.path})`, location);
}
/**
* Validate one exclusively owned stored event array in place: adopt each
* record (validating and freezing it) and refuse any event type this build
* does not know, unless its writer marked it `ignorable: true` — silently
* skipping an unknown required event could reconstruct a wrong session (the
* envelope contract on `SessionEvent.ignorable`). Unknown required types and
* retired pre-release shapes refuse here; this validator performs no migration.
* @param meta - the stored header the events belong to.
* @param events - exclusively owned decoded events; validated in place.
* @param location - the backend's artifact location for refusals, when one exists.
* @returns the same array, validated and frozen.
* @throws {SessionFormatUnsupportedError} for unknown event types.
* @throws {SessionPersistenceCorruptionError} for records that fail validation.
*/
function validateStoredEvents(meta, events, location) {
	for (const event of events) {
		if (!KNOWN_SESSION_EVENT_TYPES.has(event.type) && event.ignorable !== true) throw unsupported(`session "${meta.id}" contains event type "${event.type}" (seq ${event.seq}) unknown to this harness and not marked ignorable; refusing to interpret the log — it was likely written by a newer harness`, location);
		if (event.type === "request/header") {
			const data = event.data;
			if (typeof data === "object" && data !== null && data["reason"] === "fallback") throw unsupported(`session "${meta.id}" contains a request/header event (seq ${event.seq}) with the unsupported legacy reason "fallback"; refusing to interpret the log — it was written by a retired pre-release harness`, location);
		}
	}
	try {
		for (const [index, event] of events.entries()) events[index] = adoptSessionEvent(event);
	} catch (error) {
		if (error instanceof SessionFormatUnsupportedError) throw error;
		throw new SessionPersistenceCorruptionError(`stored session "${meta.id}" failed validation: ${String(error)}`, { cause: error });
	}
	return events;
}
/**
* Refuse a batch that does not contiguously continue the stored log.
* @param id - the session the batch belongs to.
* @param events - the batch, in seq order.
* @param cursor - the stored next-seq.
*/
function assertContiguous(id, events, cursor) {
	for (const [index, event] of events.entries()) if (event.seq !== cursor + index) throw new Error(`append seq mismatch for "${id}": expected ${cursor + index} at index ${index}, got ${event.seq}`);
}
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-session-format/lib/index.js
/** Error raised when a durable Session artifact cannot be restored or migrated losslessly. */
var SessionFormatError = class extends Error {
	name = "SessionFormatError";
};
/** A readable artifact whose released source policy has no supported migration. */
var SessionFormatUnsupportedMigrationError = class extends SessionFormatError {
	name = "SessionFormatUnsupportedMigrationError";
};
/**
* Test whether a value is a non-null, non-array object.
* @param value - candidate value.
* @returns whether the value is an object record.
*/
function isSessionFormatJsonObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
/**
* Require a non-negative safe integer without the JSON-unstable negative zero.
* @param value - candidate count.
* @param label - diagnostic subject.
* @returns validated count.
*/
function sessionFormatCount(value, label) {
	if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new SessionFormatError(`${label} must be a non-negative safe integer`);
	return value;
}
/**
* Require a safe integer without the JSON-unstable negative zero.
* @param value - candidate integer.
* @param label - diagnostic subject.
* @returns validated integer.
*/
function sessionFormatSafeInteger(value, label) {
	if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new SessionFormatError(`${label} must be a safe integer`);
	return value;
}
/**
* Require a non-negative integral format version.
* @param value - candidate version.
* @param label - diagnostic subject.
* @returns validated version.
*/
function sessionFormatVersion(value, label = "Session format version") {
	return sessionFormatCount(value, label);
}
/**
* Read only the version required for directional dispatch.
* @param headerValue - untrusted physical header value.
* @returns validated stored version.
*/
function inspectSessionFormatVersion(headerValue) {
	if (!isSessionFormatJsonObject(headerValue)) throw new SessionFormatError("Session header must be a JSON object");
	return sessionFormatVersion(headerValue["version"]);
}
/**
* Detach and deeply freeze a caller-supplied lossless JSON value.
* @param value - borrowed candidate.
* @param label - diagnostic subject.
* @returns an immutable detached JSON snapshot.
*/
function snapshotSessionFormatJson(value, label = "Session value") {
	const snapshot = snapshotJsonValue(value);
	if (snapshot === void 0) throw new SessionFormatError(`${label} is not lossless JSON`);
	return deepFreeze(snapshot);
}
/**
* Snapshot one logical header without inspecting an event body.
* @param header - borrowed logical header.
* @param label - diagnostic subject.
* @returns immutable detached header.
*/
function snapshotSessionFormatHeader(header, label = "Session header") {
	const snapshot = snapshotSessionFormatJson(header, label);
	if (!isSessionFormatJsonObject(snapshot)) throw new SessionFormatError(`${label} must be a JSON object`);
	inspectSessionFormatVersion(snapshot);
	if (typeof snapshot["id"] !== "string") throw new SessionFormatError(`${label} id must be a string`);
	sessionFormatCount(snapshot["createdAt"], `${label} createdAt`);
	if (typeof snapshot["isSeeded"] !== "boolean") throw new SessionFormatError(`${label} isSeeded must be a boolean`);
	sessionFormatCount(snapshot["delegationDepth"], `${label} delegationDepth`);
	return snapshot;
}
/**
* Validate and freeze one adjacent migration declaration.
* @param migration - named exact adjacent conversion.
* @returns immutable validated declaration.
*/
function defineSessionFormatMigration(migration) {
	if (typeof migration.name !== "string" || migration.name.length === 0) throw new SessionFormatError("Session migration name must be a non-empty string");
	const from = sessionFormatVersion(migration.fromVersion, `${migration.name} fromVersion`);
	if (sessionFormatVersion(migration.toVersion, `${migration.name} toVersion`) !== from + 1) throw new SessionFormatError(`${migration.name} must declare adjacent v${from}->v${from + 1}`);
	return Object.freeze({ ...migration });
}
/**
* Compile a unique, complete adjacent migration chain.
* @param options - current version, adjacent declarations, and current restorer.
* @returns immutable planner and streaming migration compiler.
*/
function createSessionFormatChain(options) {
	return new CompiledSessionFormatChain(options);
}
var CompiledSessionFormatChain = class {
	currentVersion;
	migrations;
	restoreCurrentHeader;
	constructor(options) {
		this.currentVersion = sessionFormatVersion(options.currentVersion, "current Session format version");
		this.restoreCurrentHeader = options.restoreCurrentHeader;
		const byFrom = /* @__PURE__ */ new Map();
		const names = /* @__PURE__ */ new Set();
		for (const candidate of options.migrations) {
			const migration = defineSessionFormatMigration(candidate);
			if (byFrom.has(migration.fromVersion)) throw new SessionFormatError(`Session migration v${migration.fromVersion}->v${migration.toVersion} is duplicated`);
			if (names.has(migration.name)) throw new SessionFormatError(`Session migration name ${JSON.stringify(migration.name)} is duplicated`);
			byFrom.set(migration.fromVersion, migration);
			names.add(migration.name);
		}
		const ordered = [];
		for (let version = 0; version < this.currentVersion; version += 1) {
			const migration = byFrom.get(version);
			if (migration === void 0) throw new SessionFormatUnsupportedMigrationError(`Session migration v${version}->v${version + 1} is missing`);
			ordered.push(migration);
		}
		if (byFrom.size !== ordered.length) throw new SessionFormatError(`Session migration from v${[...byFrom.keys()].find((version) => version >= this.currentVersion)} does not lead to current v${this.currentVersion}`);
		this.migrations = Object.freeze(ordered);
	}
	plan(fromVersion) {
		const from = sessionFormatVersion(fromVersion, "stored Session format version");
		if (from > this.currentVersion) throw new SessionFormatUnsupportedMigrationError(`stored Session uses newer format v${from}; this build writes v${this.currentVersion}`);
		return Object.freeze(this.migrations.slice(from));
	}
	createStream(sourceHeader, sourceCut, output) {
		let header = sourceHeader;
		const validatedSourceCut = sourceCut === void 0 ? void 0 : sessionFormatCount(sourceCut, "Session inherited event count");
		let inheritedEventCount = validatedSourceCut;
		const stages = [];
		const plan = this.plan(header.version);
		for (const [index, migration] of plan.entries()) {
			const targetHeader = this.advanceHeader(migration, header);
			let stage;
			try {
				stage = migration.createStage({
					sourceHeader: header,
					targetHeader,
					sourceInheritedEventCount: inheritedEventCount,
					sourceKind: index === 0 ? "decoded" : "transformed"
				});
			} catch (error) {
				throwUnsupportedRefusal(migration, error);
			}
			header = targetHeader;
			stages.push({
				migration,
				stage
			});
			inheritedEventCount = stage.headerInheritedEventCount;
		}
		return new CompiledSessionFormatMigrationStream(header, validatedSourceCut, stages, output);
	}
	migrateHeader(source) {
		let current = snapshotSessionFormatHeader(source, "stored Session header");
		for (const migration of this.plan(current.version)) current = this.advanceHeader(migration, current);
		current = snapshotSessionFormatHeader(this.restoreCurrentHeader(current), "current Session header restoration");
		if (current.version !== this.currentVersion) throw new SessionFormatError(`current Session header restorer returned v${current.version}; expected v${this.currentVersion}`);
		return current;
	}
	advanceHeader(migration, source) {
		let target;
		try {
			target = migration.migrateHeader(snapshotSessionFormatHeader(source, `${migration.name} header input`));
		} catch (error) {
			throwUnsupportedRefusal(migration, error, "Session header");
		}
		const current = snapshotSessionFormatHeader(target, `${migration.name} header output`);
		if (current.version !== migration.toVersion) throw new SessionFormatError(`${migration.name} header returned v${current.version}; expected v${migration.toVersion}`);
		try {
			migration.validateTargetHeader(current);
		} catch (error) {
			throwUnsupportedRefusal(migration, error, "Session header");
		}
		return current;
	}
};
var ChainedMigrationContext = class {
	entry;
	output;
	constructor(entry, output) {
		this.entry = entry;
		this.output = output;
	}
	emitEvent(event) {
		try {
			this.entry.stage.transformEvent(event, this.output);
		} catch (error) {
			throwUnsupportedRefusal(this.entry.migration, error);
		}
	}
	emitRun(run) {
		try {
			this.entry.stage.transformRun(run, this.output);
		} catch (error) {
			throwUnsupportedRefusal(this.entry.migration, error);
		}
	}
	finish() {
		let targetCut;
		try {
			targetCut = this.entry.stage.finish(this.output);
		} catch (error) {
			throwUnsupportedRefusal(this.entry.migration, error);
		}
		if (this.entry.stage.headerInheritedEventCount !== void 0 && this.entry.stage.headerInheritedEventCount !== targetCut) throw new SessionFormatError(`${this.entry.migration.name} changed its predeclared inherited cut`);
		return targetCut;
	}
};
var CompiledSessionFormatMigrationStream = class {
	header;
	sourceInheritedEventCount;
	input;
	stages;
	constructor(header, sourceInheritedEventCount, entries, output) {
		this.header = header;
		this.sourceInheritedEventCount = sourceInheritedEventCount;
		const stages = new Array(entries.length);
		let downstream = output;
		for (const [offset, entry] of entries.toReversed().entries()) {
			const context = new ChainedMigrationContext(entry, downstream);
			stages[entries.length - offset - 1] = context;
			downstream = context;
		}
		this.input = downstream;
		this.stages = stages;
	}
	emitEvent(event) {
		this.input.emitEvent(event);
	}
	emitRun(run) {
		this.input.emitRun(run);
	}
	finish() {
		let inheritedEventCount = this.sourceInheritedEventCount;
		for (const stage of this.stages) inheritedEventCount = stage.finish();
		return sessionFormatCount(inheritedEventCount, "finished Session inherited event count");
	}
};
function throwUnsupportedRefusal(migration, error, subject = "Session") {
	if (error instanceof SessionFormatUnsupportedMigrationError) throw error;
	const detail = error instanceof Error ? error.message : String(error);
	throw new SessionFormatUnsupportedMigrationError(`${migration.name} refuses this format v${migration.fromVersion} ${subject}: ${detail}`, { cause: error });
}
/** Migration output context that expands compact runs into retained events. */
var SessionFormatEventCollector = class {
	/** Events retained by this collector in source order. */
	values = [];
	/**
	* Retain one settled event.
	* @param event - settled event emitted by the upstream stage.
	*/
	emitEvent(event) {
		this.values.push(event);
	}
	/**
	* Expand one compact run directly into retained events.
	* @param run - compact event run emitted by the upstream stage.
	*/
	emitRun(run) {
		for (const event of run.expand()) this.values.push(event);
	}
};
/**
* Compile a build-static physical codec and adjacent migration catalog.
* @param options - complete codecs, migrations, current version, and restorer.
* @returns immutable physical dispatch and migration operations.
*/
function createSessionFormatCatalog(options) {
	const chain = createSessionFormatChain(options);
	const codecs = /* @__PURE__ */ new Map();
	for (const codec of options.codecs) {
		const version = sessionFormatVersion(codec.version, "Session format codec version");
		if (codecs.has(version)) throw new SessionFormatError(`Session format codec v${version} is duplicated`);
		codecs.set(version, Object.freeze({ ...codec }));
	}
	for (let version = 0; version <= chain.currentVersion; version += 1) if (!codecs.has(version)) throw new SessionFormatError(`Session format codec v${version} is missing`);
	if (codecs.size !== chain.currentVersion + 1) throw new SessionFormatError(`Session format codec v${[...codecs.keys()].find((version) => version > chain.currentVersion)} is newer than current v${chain.currentVersion}`);
	function readHeader(headerValue) {
		let storedVersion;
		try {
			storedVersion = inspectSessionFormatVersion(headerValue);
		} catch (error) {
			return malformed(chain.currentVersion, error);
		}
		if (storedVersion > chain.currentVersion) return Object.freeze({
			status: "unsupported",
			storedVersion,
			targetVersion: chain.currentVersion,
			reason: `stored Session uses newer format v${storedVersion}; this build writes v${chain.currentVersion}`
		});
		const codec = codecs.get(storedVersion);
		/* v8 ignore next -- construction proves every supported version has exactly one codec. */
		if (codec === void 0) return Object.freeze({
			status: "unsupported",
			storedVersion,
			targetVersion: chain.currentVersion,
			reason: `this build has no Session format codec for v${storedVersion}`
		});
		try {
			const decoded = snapshotSessionFormatHeader(codec.decodeHeader(headerValue), `format v${storedVersion} header`);
			const header = chain.migrateHeader(decoded);
			return Object.freeze({
				status: storedVersion === chain.currentVersion ? "current" : "migration-required",
				storedVersion,
				targetVersion: chain.currentVersion,
				header
			});
		} catch (error) {
			if (error instanceof SessionFormatUnsupportedMigrationError) return Object.freeze({
				status: "unsupported",
				storedVersion,
				targetVersion: chain.currentVersion,
				reason: error.message
			});
			return malformed(chain.currentVersion, error, storedVersion);
		}
	}
	function artifactCodec(headerValue) {
		const storedVersion = inspectSessionFormatVersion(headerValue);
		if (storedVersion > chain.currentVersion) throw new SessionFormatUnsupportedMigrationError(`stored Session uses newer format v${storedVersion}; this build writes v${chain.currentVersion}`);
		const codec = codecs.get(storedVersion);
		/* v8 ignore next -- construction proves every supported version has exactly one codec. */
		if (codec === void 0) throw new SessionFormatUnsupportedMigrationError(`this build has no Session format codec for v${storedVersion}`);
		return {
			storedVersion,
			codec
		};
	}
	function encodeCurrentHeader(header, inheritedEventCount) {
		if (inspectSessionFormatVersion(header) !== chain.currentVersion) throw new SessionFormatError(`encodeCurrent requires Session format v${chain.currentVersion}`);
		const encoded = options.currentEncoder.encodeHeader(header, inheritedEventCount);
		if (inspectSessionFormatVersion(encoded) !== chain.currentVersion) throw new SessionFormatError("current Session codec returned a non-current header");
		return encoded;
	}
	function createRestore(headerValue, restoreOptions) {
		const { storedVersion, codec } = artifactCodec(headerValue);
		const decoder = codec.createDecoder(headerValue, restoreOptions.recovery);
		const sourceCut = decoder.headerInheritedEventCount;
		if (storedVersion === chain.currentVersion) return new CurrentSessionFormatRestore(decoder, sourceCut, restoreOptions.validation === "current" ? options.restoreCurrent : identityArtifact, chain.currentVersion);
		const collector = new SessionFormatEventCollector();
		return new MigratingSessionFormatRestore(decoder, sourceCut, chain.createStream(decoder.header, sourceCut, collector), collector, restoreOptions.validation === "current" ? options.restoreCurrent : options.restoreTransformedCurrent, restoreOptions.validation, storedVersion, chain.currentVersion);
	}
	return Object.freeze({
		currentVersion: chain.currentVersion,
		readHeader,
		createRestore,
		encodeCurrentHeader,
		encodeCurrentEvent: options.currentEncoder.encodeEvent.bind(options.currentEncoder)
	});
}
var CurrentSessionFormatRestore = class {
	decoder;
	sourceInheritedEventCount;
	restoreArtifact;
	currentVersion;
	header;
	collector = new SessionFormatEventCollector();
	constructor(decoder, sourceInheritedEventCount, restoreArtifact, currentVersion) {
		this.decoder = decoder;
		this.sourceInheritedEventCount = sourceInheritedEventCount;
		this.restoreArtifact = restoreArtifact;
		this.currentVersion = currentVersion;
		this.header = decoder.header;
	}
	decodeRow(rowValue) {
		this.decoder.decodeRow(rowValue, this.collector);
	}
	finish() {
		const inheritedEventCount = finishDecoder(this.decoder, this.collector, this.sourceInheritedEventCount);
		return restoreCurrentVersion(this.restoreArtifact({
			header: this.header,
			inheritedEventCount,
			events: this.collector.values
		}), this.currentVersion);
	}
};
var MigratingSessionFormatRestore = class {
	decoder;
	sourceInheritedEventCount;
	migration;
	collector;
	restoreArtifact;
	validation;
	sourceVersion;
	currentVersion;
	header;
	constructor(decoder, sourceInheritedEventCount, migration, collector, restoreArtifact, validation, sourceVersion, currentVersion) {
		this.decoder = decoder;
		this.sourceInheritedEventCount = sourceInheritedEventCount;
		this.migration = migration;
		this.collector = collector;
		this.restoreArtifact = restoreArtifact;
		this.validation = validation;
		this.sourceVersion = sourceVersion;
		this.currentVersion = currentVersion;
		this.header = migration.header;
	}
	decodeRow(rowValue) {
		this.decoder.decodeRow(rowValue, this);
	}
	emitEvent(event) {
		this.migration.emitEvent(event);
	}
	emitRun(run) {
		this.migration.emitRun(run);
	}
	finish() {
		finishDecoder(this.decoder, this, this.sourceInheritedEventCount);
		const artifact = {
			header: this.header,
			inheritedEventCount: this.migration.finish(),
			events: this.collector.values
		};
		let restored;
		try {
			restored = this.restoreArtifact(artifact);
		} catch (error) {
			if (this.validation === "current" || error instanceof SessionFormatUnsupportedMigrationError) throw error;
			const detail = error instanceof Error ? error.message : String(error);
			throw new SessionFormatUnsupportedMigrationError(`Session migration from v${this.sourceVersion} to v${this.currentVersion} refuses the transformed artifact: ${detail}`, { cause: error });
		}
		return restoreCurrentVersion(restored, this.currentVersion);
	}
};
function finishDecoder(decoder, context, sourceInheritedEventCount) {
	const inheritedEventCount = decoder.finish(context);
	if (sourceInheritedEventCount !== void 0 && inheritedEventCount !== sourceInheritedEventCount) throw new SessionFormatError("streaming decoder changed its predeclared inherited cut");
	return inheritedEventCount;
}
function restoreCurrentVersion(artifact, currentVersion) {
	if (artifact.header.version !== currentVersion) throw new SessionFormatError(`current Session restorer returned v${artifact.header.version}; expected v${currentVersion}`);
	return artifact;
}
function identityArtifact(artifact) {
	return artifact;
}
function malformed(targetVersion, error, storedVersion) {
	return Object.freeze({
		status: "malformed",
		...storedVersion === void 0 ? {} : { storedVersion },
		targetVersion,
		reason: error instanceof Error ? error.message : String(error)
	});
}
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-session-format-v0-to-v1/lib/index.js
/**
* Freeze one exact released payload-member disposition for adjacent format validators.
* @param required - members that must be present.
* @param optional - additional admitted members.
* @param opaque - members retained as lossless JSON without nested semantic inspection.
* @returns the detached frozen disposition.
*/
function defineReleasedPayloadDisposition(required, optional = [], opaque = []) {
	return Object.freeze({
		required: Object.freeze([...required]),
		optional: Object.freeze([...optional]),
		opaque: Object.freeze([...opaque])
	});
}
const disposition = defineReleasedPayloadDisposition;
/**
* Frozen released-v0 event and payload-member inventory.
* Every listed member is preserved by the identity edge. Members in `opaque`
* remain lossless JSON without nested Session-sequence interpretation. Nested
* merge-extensible discriminants validate known variants and preserve
* unknown variants as owner-opaque JSON.
*/
const RELEASED_V0_EVENT_DISPOSITIONS = Object.freeze({
	"agent-preset/selected": disposition(["agentPreset"]),
	"agent/inbox/spliced": disposition([
		"target",
		"start",
		"inserted"
	], ["removedCount", "outcome"]),
	"approval/asked": disposition(["id", "toolName"], ["callId", "reason"]),
	"approval/decided": disposition(["id", "outcome"]),
	"approval/policy": disposition(["policy"], ["source"]),
	"assistant/chunk": disposition([
		"turn",
		"step",
		"chunk"
	]),
	"assistant/message": disposition([
		"turn",
		"step",
		"message"
	], ["usage", "interrupted"]),
	"command/done": disposition(["commandId", "kind"], ["text", "sourceEventSeq"]),
	"command/run": disposition([
		"commandId",
		"name",
		"source"
	], ["args"]),
	"compaction/end": disposition(["compactionId", "turn"], ["sourceCommandId", "error"]),
	"compaction/prune": disposition([
		"shadowedRange",
		"shadowedSeqs",
		"shadowedTokenCount"
	]),
	"compaction/start": disposition(["compactionId", "turn"], ["sourceCommandId"]),
	"compaction/summary": disposition([
		"compactionId",
		"summary",
		"shadowedRange",
		"shadowedSeqs",
		"shadowedTokenCount",
		"provider",
		"model"
	], [
		"sourceCommandId",
		"maxTokens",
		"usage",
		"rawOutput",
		"llmStreamCall"
	]),
	"feedback/record": disposition(["text"]),
	"goal/change": disposition([
		"kind",
		"version",
		"operation"
	], [
		"goal",
		"roundsStarted",
		"createdAt",
		"updatedAt",
		"cleared",
		"clearedAt"
	]),
	"hook/invoked": disposition([
		"turn",
		"point",
		"dialect",
		"handlerId"
	], ["matcher"]),
	"hook/result": disposition([
		"turn",
		"point",
		"handlerId",
		"decision",
		"durationMs"
	], ["exitCode", "stderrSummary"]),
	"llm/retry": disposition([
		"retryId",
		"turn",
		"step",
		"provider",
		"mode",
		"policyKey",
		"retry",
		"delayMs",
		"failure"
	], ["maxRetries"]),
	"llm/retry-started": disposition([
		"retryId",
		"turn",
		"step",
		"retry"
	]),
	"model/selection": disposition(["provider", "model"], ["reasoningEffort"]),
	"permission/preset": disposition(["preset"]),
	"plan/mode": disposition(["active"]),
	"request/context": disposition(["provider", "model"], ["contextWindow"]),
	"request/header": disposition(["header", "reason"], ["startsSeries"]),
	"sandbox/mode": disposition(["mode"], ["source"]),
	"schedule/change": disposition(["version", "operation"], [
		"schedule",
		"id",
		"acceptedAt"
	]),
	"session-log-deepseek/delivery-accepted": disposition(["sessionId", "throughSeq"]),
	"session/end-seed": disposition([]),
	"session/title": disposition([
		"title",
		"messageSeqs",
		"source"
	]),
	"session/title-llm-request": disposition([
		"titleProvider",
		"messageSeqs",
		"route",
		"system",
		"messages",
		"maxTokens"
	]),
	"step/end": disposition(["turn", "step"]),
	"step/start": disposition(["turn", "step"]),
	"subagent/descriptor": disposition([
		"mode",
		"version",
		"provider"
	], [
		"label",
		"agentProvider",
		"agentModel",
		"agentReasoningEffort",
		"persona",
		"toolFilter"
	]),
	"subagent/model-selection-policy": disposition(["allowedModels"]),
	"team/member": disposition([
		"version",
		"teamId",
		"member"
	]),
	"team/message/delivered": disposition([
		"version",
		"teamId",
		"messageId",
		"targetId"
	]),
	"team/message/queued": disposition([
		"version",
		"teamId",
		"message"
	]),
	"team/task": disposition([
		"version",
		"teamId",
		"task"
	]),
	"todo/write": disposition(["todos"]),
	"tool-workflow/agent-end": disposition([
		"runId",
		"seq",
		"outcome"
	]),
	"tool-workflow/agent-start": disposition([
		"runId",
		"seq",
		"label",
		"childId"
	], ["phase"]),
	"tool-workflow/run-end": disposition(["runId", "stopReason"]),
	"tool-workflow/run-start": disposition(["runId", "name"]),
	"tool/call": disposition([
		"turn",
		"step",
		"callId",
		"name",
		"arguments"
	]),
	"tool/code-dispatch": disposition([
		"rootCallId",
		"parentCallId",
		"subCallId",
		"name",
		"arguments",
		"isError",
		"content"
	], [], ["arguments"]),
	"tool/code-dispatch-start": disposition([
		"rootCallId",
		"parentCallId",
		"subCallId",
		"name",
		"arguments"
	], [], ["arguments"]),
	"tool/result": disposition([
		"turn",
		"step",
		"message"
	], ["error", "meta"], ["meta"]),
	"turn/end": disposition(["turn", "reason"]),
	"turn/start": disposition(["turn"]),
	"user/message": disposition([
		"role",
		"id",
		"content",
		"source"
	]),
	"web/deepseek-search-llm-request": disposition([
		"endpoint",
		"apiVersion",
		"body"
	])
});
Object.freeze(Object.keys(RELEASED_V0_EVENT_DISPOSITIONS).sort((left, right) => left.localeCompare(right, "en")));
/**
* Require one plain JSON object.
* @param value - candidate JSON value.
* @param label - diagnostic subject.
* @returns validated object record.
*/
function releasedV0Record(value, label) {
	if (!isSessionFormatJsonObject(value)) throw new SessionFormatError(`${label} must be a JSON object`);
	return value;
}
/**
* Require every named member and no member outside the optional list.
* @param record - candidate object.
* @param required - members that must exist.
* @param optional - additional admitted members.
* @param label - diagnostic subject.
*/
function assertReleasedV0Keys(record, required, optional = [], label) {
	const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
	const unexpected = Object.keys(record).find((key) => !allowed.has(key));
	if (unexpected !== void 0) throw new SessionFormatError(`${label} has unexpected member ${JSON.stringify(unexpected)}`);
	const missing = required.find((key) => !Object.hasOwn(record, key));
	if (missing !== void 0) throw new SessionFormatError(`${label} lacks required member ${JSON.stringify(missing)}`);
}
/**
* Validate nested released payload semantics for one known event.
* @param event - known event with exact top-level members.
* @param version - source or current payload generation.
*/
function assertReleasedPayloadSemantics(event, version) {
	const data = releasedV0Record(event.data, `${event.type} ${event.seq} data`);
	const label = `${event.type} ${event.seq}`;
	switch (event.type) {
		case "agent-preset/selected":
			stringValue(data["agentPreset"], `${label} agentPreset`);
			return;
		case "agent/inbox/spliced":
			literalValue(data["target"], ["next-turn", "next-step"], `${label} target`);
			countValue(data["start"], `${label} start`);
			if (data["removedCount"] !== void 0) countValue(data["removedCount"], `${label} removedCount`);
			arrayValue(data["inserted"], `${label} inserted`, (value) => {
				messageValue(value, `${label} inserted message`, version, "user");
			});
			if (data["outcome"] !== void 0) literalValue(data["outcome"], ["canceled"], `${label} outcome`);
			return;
		case "approval/asked":
			nonEmptyString(data["id"], `${label} id`);
			nonEmptyString(data["toolName"], `${label} toolName`);
			if (data["callId"] !== void 0) nonEmptyString(data["callId"], `${label} callId`);
			if (data["reason"] !== void 0) stringValue(data["reason"], `${label} reason`);
			return;
		case "approval/decided":
			nonEmptyString(data["id"], `${label} id`);
			literalValue(data["outcome"], [
				"allowed-once",
				"rejected",
				"cancelled",
				"unavailable"
			], `${label} outcome`);
			return;
		case "approval/policy":
			literalValue(data["policy"], ["ask", "never"], `${label} policy`);
			if (data["source"] !== void 0) literalValue(data["source"], ["delegation"], `${label} source`);
			return;
		case "assistant/chunk":
			coordinatePair(data, label);
			streamChunkValue(data["chunk"], `${label} chunk`);
			return;
		case "assistant/message":
			coordinatePair(data, label);
			messageValue(data["message"], `${label} message`, version, "assistant");
			if (data["usage"] !== void 0) tokenUsageValue(data["usage"], `${label} usage`);
			if (data["interrupted"] !== void 0) literalValue(data["interrupted"], [true], `${label} interrupted`);
			return;
		case "command/done":
			nonEmptyString(data["commandId"], `${label} commandId`);
			literalValue(data["kind"], ["success", "error"], `${label} kind`);
			if (data["text"] !== void 0) stringValue(data["text"], `${label} text`);
			if (data["sourceEventSeq"] !== void 0) earlierSeq(data["sourceEventSeq"], event.seq, `${label} sourceEventSeq`);
			return;
		case "command/run":
			nonEmptyString(data["commandId"], `${label} commandId`);
			nonEmptyString(data["name"], `${label} name`);
			if (data["args"] !== void 0) stringValue(data["args"], `${label} args`);
			literalValue(exactRecord(data["source"], `${label} source`, ["kind"])["kind"], ["user"], `${label} source kind`);
			return;
		case "compaction/start":
		case "compaction/end":
			nonEmptyString(data["compactionId"], `${label} compactionId`);
			if (data["sourceCommandId"] !== void 0) nonEmptyString(data["sourceCommandId"], `${label} sourceCommandId`);
			nullableValue(data["turn"], `${label} turn`, countValue);
			if (data["error"] !== void 0) stringValue(data["error"], `${label} error`);
			return;
		case "compaction/prune":
			shadowedValue(data, event.seq, label);
			return;
		case "compaction/summary":
			if (data["llmStreamCall"] === true && data["rawOutput"] === void 0) throw new SessionFormatError(`${label} llmStreamCall requires rawOutput`);
			nonEmptyString(data["compactionId"], `${label} compactionId`);
			if (data["sourceCommandId"] !== void 0) nonEmptyString(data["sourceCommandId"], `${label} sourceCommandId`);
			contentBlocksValue(data["summary"], `${label} summary`, version);
			shadowedValue(data, event.seq, label);
			nonEmptyString(data["provider"], `${label} provider`);
			nonEmptyString(data["model"], `${label} model`);
			if (data["maxTokens"] !== void 0) countValue(data["maxTokens"], `${label} maxTokens`);
			if (data["usage"] !== void 0) tokenUsageValue(data["usage"], `${label} usage`);
			if (data["rawOutput"] !== void 0) contentBlocksValue(data["rawOutput"], `${label} rawOutput`, version);
			if (data["llmStreamCall"] !== void 0) literalValue(data["llmStreamCall"], [true], `${label} llmStreamCall`);
			return;
		case "feedback/record":
			nonEmptyString(data["text"], `${label} text`);
			return;
		case "goal/change":
			goalChangeValue(data, label);
			return;
		case "hook/invoked":
			countValue(data["turn"], `${label} turn`);
			nonEmptyString(data["point"], `${label} point`);
			literalValue(data["dialect"], ["claude-code", "codex"], `${label} dialect`);
			if (data["matcher"] !== void 0) stringValue(data["matcher"], `${label} matcher`);
			nonEmptyString(data["handlerId"], `${label} handlerId`);
			return;
		case "hook/result":
			countValue(data["turn"], `${label} turn`);
			nonEmptyString(data["point"], `${label} point`);
			nonEmptyString(data["handlerId"], `${label} handlerId`);
			nonEmptyString(data["decision"], `${label} decision`);
			if (data["exitCode"] !== void 0) safeIntegerValue(data["exitCode"], `${label} exitCode`);
			if (data["stderrSummary"] !== void 0) stringValue(data["stderrSummary"], `${label} stderrSummary`);
			if (finiteNumberValue(data["durationMs"], `${label} durationMs`) < 0) throw new SessionFormatError(`${label} durationMs must be non-negative`);
			return;
		case "llm/retry":
			nonEmptyString(data["retryId"], `${label} retryId`);
			coordinatePair(data, label);
			nonEmptyString(data["provider"], `${label} provider`);
			literalValue(data["mode"], ["normal", "always"], `${label} mode`);
			nonEmptyString(data["policyKey"], `${label} policyKey`);
			positiveIntegerValue(data["retry"], `${label} retry`);
			if (data["mode"] === "normal") {
				const maxRetries = positiveIntegerValue(data["maxRetries"], `${label} maxRetries`);
				if (data["retry"] > maxRetries) throw new SessionFormatError(`${label} retry exceeds maxRetries`);
			} else if (data["maxRetries"] !== void 0) throw new SessionFormatError(`${label} always mode must omit maxRetries`);
			const delayMs = finiteNumberValue(data["delayMs"], `${label} delayMs`);
			if (delayMs < 0) throw new SessionFormatError(`${label} delayMs must be non-negative`);
			if (delayMs > 2147483647) throw new SessionFormatError(`${label} delayMs exceeds the timer range`);
			llmFailureValue(data["failure"], `${label} failure`);
			return;
		case "llm/retry-started":
			nonEmptyString(data["retryId"], `${label} retryId`);
			coordinatePair(data, label);
			positiveIntegerValue(data["retry"], `${label} retry`);
			return;
		case "model/selection":
			nonEmptyString(data["provider"], `${label} provider`);
			nonEmptyString(data["model"], `${label} model`);
			if (data["reasoningEffort"] !== void 0) nonEmptyString(data["reasoningEffort"], `${label} reasoningEffort`);
			return;
		case "permission/preset":
			nonEmptyString(data["preset"], `${label} preset`);
			return;
		case "plan/mode":
			booleanValue(data["active"], `${label} active`);
			return;
		case "request/context":
			nonEmptyString(data["provider"], `${label} provider`);
			nonEmptyString(data["model"], `${label} model`);
			if (data["contextWindow"] !== void 0) positiveIntegerValue(data["contextWindow"], `${label} contextWindow`);
			return;
		case "request/header":
			requestHeaderValue(data["header"], `${label} header`);
			literalValue(data["reason"], [
				"initial",
				"resume",
				"change",
				"series"
			], `${label} reason`);
			if (data["startsSeries"] !== void 0) literalValue(data["startsSeries"], [true], `${label} startsSeries`);
			return;
		case "sandbox/mode":
			literalValue(data["mode"], [
				"read-only",
				"workspace-write",
				"danger-full-access"
			], `${label} mode`);
			if (data["source"] !== void 0) literalValue(data["source"], ["delegation"], `${label} source`);
			return;
		case "schedule/change":
			scheduleChangeValue(data, label);
			return;
		case "session-log-deepseek/delivery-accepted":
			if ((data["sessionFormatVersion"] === void 0 ? 0 : countValue(data["sessionFormatVersion"], `${label} sessionFormatVersion`)) !== version) return;
			nonEmptyString(data["sessionId"], `${label} sessionId`);
			earlierSeq(data["throughSeq"], event.seq, `${label} throughSeq`);
			return;
		case "session/end-seed": return;
		case "session/title":
			nonEmptyString(data["title"], `${label} title`);
			seqArray(data["messageSeqs"], event.seq, `${label} messageSeqs`, false);
			titleSourceValue(data["source"], `${label} source`);
			return;
		case "session/title-llm-request":
			nonEmptyString(data["titleProvider"], `${label} titleProvider`);
			seqArray(data["messageSeqs"], event.seq, `${label} messageSeqs`, true);
			modelRouteValue(data["route"], `${label} route`);
			stringValue(data["system"], `${label} system`);
			arrayValue(data["messages"], `${label} messages`, (value) => {
				messageValue(value, `${label} message`, version);
			});
			positiveIntegerValue(data["maxTokens"], `${label} maxTokens`);
			return;
		case "step/end":
		case "step/start":
			coordinatePair(data, label);
			return;
		case "subagent/descriptor":
			subagentDescriptorValue(data, label);
			return;
		case "subagent/model-selection-policy":
			allowedModelsValue(data["allowedModels"], `${label} allowedModels`);
			return;
		case "team/member":
			teamSelector(data, label);
			teamMemberValue(data["member"], `${label} member`);
			return;
		case "team/message/delivered":
			teamSelector(data, label);
			nonEmptyString(data["messageId"], `${label} messageId`);
			nonEmptyString(data["targetId"], `${label} targetId`);
			return;
		case "team/message/queued":
			teamSelector(data, label);
			teamMessageValue(data["message"], `${label} message`, version);
			return;
		case "team/task":
			teamSelector(data, label);
			teamTaskValue(data["task"], `${label} task`);
			return;
		case "todo/write":
			arrayValue(data["todos"], `${label} todos`, (value, itemLabel) => {
				const item = exactRecord(value, itemLabel, ["content", "status"]);
				stringValue(item["content"], `${itemLabel} content`);
				literalValue(item["status"], [
					"pending",
					"in_progress",
					"completed"
				], `${itemLabel} status`);
			});
			return;
		case "tool-workflow/agent-end":
			workflowIdentity(data, label);
			literalValue(data["outcome"], [
				"completed",
				"failed",
				"cancelled"
			], `${label} outcome`);
			return;
		case "tool-workflow/agent-start":
			workflowIdentity(data, label);
			stringValue(data["label"], `${label} label`);
			if (data["phase"] !== void 0) stringValue(data["phase"], `${label} phase`);
			nonEmptyString(data["childId"], `${label} childId`);
			return;
		case "tool-workflow/run-end":
			nonEmptyString(data["runId"], `${label} runId`);
			literalValue(data["stopReason"], [
				"completed",
				"cancelled",
				"error"
			], `${label} stopReason`);
			return;
		case "tool-workflow/run-start":
			nonEmptyString(data["runId"], `${label} runId`);
			nonEmptyString(data["name"], `${label} name`);
			return;
		case "tool/call":
			coordinatePair(data, label);
			nonEmptyString(data["callId"], `${label} callId`);
			nonEmptyString(data["name"], `${label} name`);
			stringValue(data["arguments"], `${label} arguments`);
			return;
		case "tool/code-dispatch":
		case "tool/code-dispatch-start":
			nonEmptyString(data["rootCallId"], `${label} rootCallId`);
			nonEmptyString(data["parentCallId"], `${label} parentCallId`);
			nonEmptyString(data["subCallId"], `${label} subCallId`);
			nonEmptyString(data["name"], `${label} name`);
			if (event.type === "tool/code-dispatch") {
				booleanValue(data["isError"], `${label} isError`);
				contentBlocksValue(data["content"], `${label} content`, version);
			}
			return;
		case "tool/result":
			coordinatePair(data, label);
			messageValue(data["message"], `${label} message`, version, "tool");
			if (data["error"] !== void 0) {
				const error = exactRecord(data["error"], `${label} error`, ["name", "code"]);
				nonEmptyString(error["name"], `${label} error name`);
				nonEmptyString(error["code"], `${label} error code`);
			}
			return;
		case "turn/end":
			countValue(data["turn"], `${label} turn`);
			turnEndReasonValue(data["reason"], `${label} reason`);
			return;
		case "turn/start":
			countValue(data["turn"], `${label} turn`);
			return;
		case "user/message":
			messageValue(data, label, version, "user");
			return;
		case "web/deepseek-search-llm-request":
			nonEmptyString(data["endpoint"], `${label} endpoint`);
			nonEmptyString(data["apiVersion"], `${label} apiVersion`);
			deepSeekSearchBodyValue(data["body"], `${label} body`);
			return;
		/* v8 ignore next -- the frozen disposition rejects unknown types before semantic dispatch. */
		default: throw new SessionFormatError(`released payload validator is missing event ${JSON.stringify(event.type)}`);
	}
}
function exactRecord(value, label, required, optional = []) {
	const record = releasedV0Record(value, label);
	assertReleasedV0Keys(record, required, optional, label);
	return record;
}
function stringValue(value, label) {
	if (typeof value !== "string") throw new SessionFormatError(`${label} must be a string`);
}
function nonEmptyString(value, label) {
	if (typeof value !== "string" || value.length === 0) throw new SessionFormatError(`${label} must be a non-empty string`);
}
function booleanValue(value, label) {
	if (typeof value !== "boolean") throw new SessionFormatError(`${label} must be a boolean`);
}
function safeIntegerValue(value, label) {
	return sessionFormatSafeInteger(value, label);
}
function countValue(value, label) {
	return sessionFormatCount(value, label);
}
function positiveIntegerValue(value, label) {
	const result = countValue(value, label);
	if (result === 0) throw new SessionFormatError(`${label} must be positive`);
	return result;
}
function finiteNumberValue(value, label) {
	if (typeof value !== "number" || !Number.isFinite(value) || Object.is(value, -0)) throw new SessionFormatError(`${label} must be a finite number`);
	return value;
}
function literalValue(value, allowed, label) {
	if (!allowed.some((candidate) => candidate === value)) throw new SessionFormatError(`${label} must be one of ${allowed.map(String).join(", ")}`);
}
function nullableValue(value, label, validate) {
	if (value !== null) validate(value, label);
}
function arrayValue(value, label, validate) {
	if (!Array.isArray(value)) throw new SessionFormatError(`${label} must be an array`);
	const members = value;
	members.forEach((member, index) => {
		validate(member, `${label}[${index}]`);
	});
	return members;
}
function coordinatePair(data, label) {
	countValue(data["turn"], `${label} turn`);
	countValue(data["step"], `${label} step`);
}
function earlierSeq(value, eventSeq, label) {
	const seq = countValue(value, label);
	if (seq >= eventSeq) throw new SessionFormatError(`${label} must identify an earlier event`);
	return seq;
}
function seqArray(value, eventSeq, label, requireNonEmpty) {
	const seen = /* @__PURE__ */ new Set();
	const values = arrayValue(value, label, (member, memberLabel) => {
		const seq = earlierSeq(member, eventSeq, memberLabel);
		if (seen.has(seq)) throw new SessionFormatError(`${label} repeats seq ${seq}`);
		seen.add(seq);
	});
	if (requireNonEmpty && values.length === 0) throw new SessionFormatError(`${label} must be non-empty`);
	return values;
}
function llmFailureValue(value, label) {
	const failure = exactRecord(value, label, ["message", "code"], [
		"status",
		"providerRetryAfterMs",
		"requestId"
	]);
	nonEmptyString(failure["message"], `${label} message`);
	nonEmptyString(failure["code"], `${label} code`);
	if (failure["status"] !== void 0) {
		const status = safeIntegerValue(failure["status"], `${label} status`);
		if (status < 100 || status > 599) throw new SessionFormatError(`${label} status must be 100 through 599`);
	}
	if (failure["providerRetryAfterMs"] !== void 0 && finiteNumberValue(failure["providerRetryAfterMs"], `${label} providerRetryAfterMs`) <= 0) throw new SessionFormatError(`${label} providerRetryAfterMs must be positive`);
	if (failure["requestId"] !== void 0) nonEmptyString(failure["requestId"], `${label} requestId`);
}
function tokenUsageValue(value, label) {
	const usage = exactRecord(value, label, ["inputTokens", "outputTokens"], [
		"totalTokens",
		"cacheReadTokens",
		"cacheWriteTokens",
		"reasoningTokens"
	]);
	for (const key of Object.keys(usage)) countValue(usage[key], `${label} ${key}`);
}
function contentBlocksValue(value, label, version) {
	arrayValue(value, label, (member, memberLabel) => {
		contentBlockValue(member, memberLabel, version);
	});
}
function contentBlockValue(value, label, version) {
	const block = releasedV0Record(value, label);
	switch (block["type"]) {
		case "text":
		case "reasoning":
			assertReleasedV0Keys(block, ["type", "text"], [], label);
			stringValue(block["text"], `${label} text`);
			return;
		case "image":
			assertReleasedV0Keys(block, ["type", "attachment"], [], label);
			imageAttachmentValue(block["attachment"], `${label} attachment`);
			return;
		case "tool-call":
			assertReleasedV0Keys(block, [
				"type",
				"id",
				"name",
				"arguments"
			], [], label);
			nonEmptyString(block["id"], `${label} id`);
			nonEmptyString(block["name"], `${label} name`);
			stringValue(block["arguments"], `${label} arguments`);
			return;
		case "tool-result":
			assertReleasedV0Keys(block, [
				"type",
				"toolCallId",
				"content"
			], ["isError"], label);
			nonEmptyString(block["toolCallId"], `${label} toolCallId`);
			contentBlocksValue(block["content"], `${label} content`, version);
			if (block["isError"] !== void 0) booleanValue(block["isError"], `${label} isError`);
			return;
		default:
			nonEmptyString(block["type"], `${label} type`);
			return;
	}
}
function imageAttachmentValue(value, label) {
	const attachment = exactRecord(value, label, [
		"attachmentId",
		"mediaType",
		"bytes",
		"width",
		"height"
	], ["name", "originalDimensions"]);
	nonEmptyString(attachment["attachmentId"], `${label} attachmentId`);
	literalValue(attachment["mediaType"], [
		"image/png",
		"image/jpeg",
		"image/webp",
		"image/gif"
	], `${label} mediaType`);
	countValue(attachment["bytes"], `${label} bytes`);
	positiveIntegerValue(attachment["width"], `${label} width`);
	positiveIntegerValue(attachment["height"], `${label} height`);
	if (attachment["name"] !== void 0) stringValue(attachment["name"], `${label} name`);
	if (attachment["originalDimensions"] !== void 0) {
		const dimensions = exactRecord(attachment["originalDimensions"], `${label} originalDimensions`, ["width", "height"]);
		positiveIntegerValue(dimensions["width"], `${label} original width`);
		positiveIntegerValue(dimensions["height"], `${label} original height`);
	}
}
function messageValue(value, label, version, expected) {
	const message = exactRecord(value, label, [
		"id",
		"role",
		"content",
		"source"
	]);
	nonEmptyString(message["id"], `${label} id`);
	const role = expected === "assistant" ? "assistant" : expected === "user" || expected === "tool" ? "user" : void 0;
	if (role === void 0) literalValue(message["role"], [
		"system",
		"user",
		"assistant"
	], `${label} role`);
	else literalValue(message["role"], [role], `${label} role`);
	contentBlocksValue(message["content"], `${label} content`, version);
	const source = releasedV0Record(message["source"], `${label} source`);
	if (version < 2 && expected === "user" && source["kind"] === "goal" && source["change"] !== void 0) legacyGoalMessageValue(message, source, label);
	else messageSourceValue(source, `${label} source`, version, expected);
	if (expected === "tool") {
		const content = message["content"];
		const block = Array.isArray(content) && content.length === 1 ? releasedV0Record(content[0], `${label} tool result`) : void 0;
		const source = releasedV0Record(message["source"], `${label} source`);
		if (block?.["type"] !== "tool-result" || block["toolCallId"] !== source["callId"]) throw new SessionFormatError(`${label} must contain exactly one tool-result block`);
	}
}
function legacyGoalMessageValue(message, source, label) {
	assertReleasedV0Keys(source, [
		"kind",
		"goalId",
		"revision",
		"round",
		"change"
	], [], `${label} source`);
	nonEmptyString(source["goalId"], `${label} source goalId`);
	positiveIntegerValue(source["revision"], `${label} source revision`);
	if (source["round"] !== 0) throw new SessionFormatError(`${label} legacy goal source round must be 0`);
	const change = releasedV0Record(source["change"], `${label} source change`);
	goalChangeValue(change, `${label} source change`);
	const ref = releasedV0Record(change["operation"] === "clear" ? change["cleared"] : change["goal"], `${label} source change ref`);
	if (source["goalId"] !== ref["id"] || source["revision"] !== ref["revision"]) throw new SessionFormatError(`${label} legacy goal source does not match its change`);
	const payload = change["operation"] === "clear" ? {
		cleared: change["cleared"],
		clearedAt: change["clearedAt"]
	} : {
		goal: change["goal"],
		roundsStarted: change["roundsStarted"],
		createdAt: change["createdAt"],
		updatedAt: change["updatedAt"]
	};
	const expected = [{
		type: "text",
		text: `<goal_state>${JSON.stringify(payload)}</goal_state>`
	}];
	if (!deepEqualJson(message["content"], expected)) throw new SessionFormatError(`${label} legacy goal content does not match its change`);
}
function messageSourceValue(value, label, version, expected) {
	const source = releasedV0Record(value, label);
	if (expected === "assistant" && source["kind"] !== "model") throw new SessionFormatError(`${label} must be model source`);
	if (expected === "tool" && source["kind"] !== "tool") throw new SessionFormatError(`${label} must be tool source`);
	switch (source["kind"]) {
		case "user":
			assertReleasedV0Keys(source, ["kind"], ["rpcId", "clientTimeZone"], label);
			if (source["rpcId"] !== void 0) nonEmptyString(source["rpcId"], `${label} rpcId`);
			if (source["clientTimeZone"] !== void 0) nonEmptyString(source["clientTimeZone"], `${label} clientTimeZone`);
			return;
		case "plugin":
			pluginSourceValue(source, label);
			return;
		case "model":
			assertReleasedV0Keys(source, [
				"kind",
				"provider",
				"model"
			], ["replayState"], label);
			nonEmptyString(source["provider"], `${label} provider`);
			nonEmptyString(source["model"], `${label} model`);
			return;
		case "tool":
			assertReleasedV0Keys(source, ["kind", "callId"], [], label);
			nonEmptyString(source["callId"], `${label} callId`);
			return;
		case "agent-instructions":
			assertReleasedV0Keys(source, [
				"kind",
				"form",
				"changes"
			], ["baseline", "baselineIdentity"], label);
			literalValue(source["form"], ["instructions"], `${label} form`);
			if (source["baseline"] !== void 0) literalValue(source["baseline"], [true], `${label} baseline`);
			if (source["baselineIdentity"] !== void 0) nonEmptyString(source["baselineIdentity"], `${label} baselineIdentity`);
			arrayValue(source["changes"], `${label} changes`, (member, memberLabel) => {
				const change = exactRecord(member, memberLabel, [
					"action",
					"scope",
					"path"
				], ["digest"]);
				literalValue(change["action"], [
					"set",
					"replace",
					"remove"
				], `${memberLabel} action`);
				stringValue(change["scope"], `${memberLabel} scope`);
				stringValue(change["path"], `${memberLabel} path`);
				if (change["digest"] !== void 0) stringValue(change["digest"], `${memberLabel} digest`);
			});
			return;
		case "session-reference":
			sessionReferenceSourceValue(source, label, version);
			return;
		case "team-message":
			assertReleasedV0Keys(source, [
				"kind",
				"teamId",
				"messageId",
				"senderId",
				"senderName"
			], [], label);
			for (const key of [
				"teamId",
				"messageId",
				"senderId"
			]) nonEmptyString(source[key], `${label} ${key}`);
			stringValue(source["senderName"], `${label} senderName`);
			return;
		case "goal":
			assertReleasedV0Keys(source, [
				"kind",
				"goalId",
				"revision",
				"round"
			], [], label);
			nonEmptyString(source["goalId"], `${label} goalId`);
			positiveIntegerValue(source["revision"], `${label} revision`);
			positiveIntegerValue(source["round"], `${label} round`);
			return;
		case "skill-invocation":
			assertReleasedV0Keys(source, [
				"kind",
				"name",
				"form"
			], [], label);
			nonEmptyString(source["name"], `${label} name`);
			literalValue(source["form"], ["instructions"], `${label} form`);
			return;
		case "skill-catalog":
			assertReleasedV0Keys(source, [
				"kind",
				"form",
				"entries"
			], ["update"], label);
			literalValue(source["form"], ["catalog"], `${label} form`);
			if (source["update"] !== void 0) literalValue(source["update"], [true], `${label} update`);
			arrayValue(source["entries"], `${label} entries`, (member, memberLabel) => {
				const entry = exactRecord(member, memberLabel, ["name", "description"]);
				nonEmptyString(entry["name"], `${memberLabel} name`);
				stringValue(entry["description"], `${memberLabel} description`);
			});
			return;
		case "coordinator":
		case "subagent-report":
			assertReleasedV0Keys(source, [
				"kind",
				"form",
				"senderSessionId"
			], [], label);
			literalValue(source["form"], ["relay"], `${label} form`);
			nonEmptyString(source["senderSessionId"], `${label} senderSessionId`);
			return;
		case "subagent-settled":
			assertReleasedV0Keys(source, [
				"kind",
				"form",
				"summary",
				"senderSessionId"
			], [], label);
			literalValue(source["form"], ["notice"], `${label} form`);
			stringValue(source["summary"], `${label} summary`);
			nonEmptyString(source["senderSessionId"], `${label} senderSessionId`);
			return;
		case "webhook":
			assertReleasedV0Keys(source, [
				"kind",
				"provider",
				"source",
				"deliveryId",
				"ruleId",
				"form",
				"summary"
			], [], label);
			for (const key of [
				"provider",
				"source",
				"deliveryId",
				"ruleId"
			]) nonEmptyString(source[key], `${label} ${key}`);
			literalValue(source["form"], ["notice"], `${label} form`);
			stringValue(source["summary"], `${label} summary`);
			return;
		default:
			nonEmptyString(source["kind"], `${label} kind`);
			return;
	}
}
function pluginSourceValue(source, label) {
	const optional = [
		"form",
		"sections",
		"summary"
	];
	if (source["plugin"] === "compact") optional.push("compactionId", "sourceCommandId");
	assertReleasedV0Keys(source, ["kind", "plugin"], optional, label);
	nonEmptyString(source["plugin"], `${label} plugin`);
	if (source["plugin"] === "compact") {
		nonEmptyString(source["compactionId"], `${label} compactionId`);
		if (source["sourceCommandId"] !== void 0) nonEmptyString(source["sourceCommandId"], `${label} sourceCommandId`);
	}
	const form = source["form"];
	if (form === void 0) return;
	literalValue(form, [
		"instructions",
		"catalog",
		"snapshot",
		"notice",
		"relay",
		"recall"
	], `${label} form`);
	if (form === "snapshot") arrayValue(source["sections"], `${label} sections`, (member, memberLabel) => {
		const section = exactRecord(member, memberLabel, ["name", "text"]);
		nonEmptyString(section["name"], `${memberLabel} name`);
		stringValue(section["text"], `${memberLabel} text`);
	});
	else if (source["sections"] !== void 0) throw new SessionFormatError(`${label} sections require snapshot form`);
	if (form === "notice") stringValue(source["summary"], `${label} summary`);
	else if (source["summary"] !== void 0) throw new SessionFormatError(`${label} summary requires notice form`);
}
function sessionReferenceSourceValue(source, label, version) {
	assertReleasedV0Keys(source, [
		"kind",
		"form",
		"version",
		"references"
	], [], label);
	literalValue(source["form"], ["recall"], `${label} form`);
	literalValue(source["version"], [1], `${label} version`);
	let expectedInputIndex = 0;
	const sessionIds = /* @__PURE__ */ new Set();
	if (arrayValue(source["references"], `${label} references`, (member, memberLabel) => {
		const reference = exactRecord(member, memberLabel, [
			"sessionId",
			"label",
			"capturedThroughSeq",
			"compacted",
			"originalMessages",
			"retainedMessages",
			"omittedMessages",
			"omittedBytes",
			"truncated",
			"inputIndex"
		], version >= 1 ? ["capturedFormatVersion"] : []);
		nonEmptyString(reference["sessionId"], `${memberLabel} sessionId`);
		stringValue(reference["label"], `${memberLabel} label`);
		if (reference["capturedThroughSeq"] !== null) countValue(reference["capturedThroughSeq"], `${memberLabel} capturedThroughSeq`);
		if (reference["capturedFormatVersion"] !== void 0) {
			const capturedVersion = countValue(reference["capturedFormatVersion"], `${memberLabel} capturedFormatVersion`);
			if (capturedVersion < 1 || capturedVersion > version) throw new SessionFormatError(`${memberLabel} capturedFormatVersion must be between 1 and ${version}`);
		}
		booleanValue(reference["compacted"], `${memberLabel} compacted`);
		const original = countValue(reference["originalMessages"], `${memberLabel} originalMessages`);
		const retained = countValue(reference["retainedMessages"], `${memberLabel} retainedMessages`);
		const omitted = countValue(reference["omittedMessages"], `${memberLabel} omittedMessages`);
		const omittedBytes = countValue(reference["omittedBytes"], `${memberLabel} omittedBytes`);
		const inputIndex = countValue(reference["inputIndex"], `${memberLabel} inputIndex`);
		const truncated = reference["truncated"];
		booleanValue(truncated, `${memberLabel} truncated`);
		if (retained > original || omitted !== original - retained) throw new SessionFormatError(`${memberLabel} message counts are inconsistent`);
		if (truncated !== (omitted > 0 || omittedBytes > 0)) throw new SessionFormatError(`${memberLabel} truncated disagrees with omitted content`);
		if (inputIndex !== expectedInputIndex) throw new SessionFormatError(`${label} inputIndex must match reference position`);
		expectedInputIndex += 1;
		const sessionId = reference["sessionId"];
		if (sessionIds.has(sessionId)) throw new SessionFormatError(`${label} repeats sessionId ${sessionId}`);
		sessionIds.add(sessionId);
	}).length === 0) throw new SessionFormatError(`${label} references must be non-empty`);
}
function streamChunkValue(value, label) {
	const chunk = releasedV0Record(value, label);
	switch (chunk["type"]) {
		case "block-start":
			assertReleasedV0Keys(chunk, [
				"type",
				"index",
				"blockType"
			], [], label);
			countValue(chunk["index"], `${label} index`);
			nonEmptyString(chunk["blockType"], `${label} blockType`);
			return;
		case "text-delta":
		case "reasoning-delta":
			assertReleasedV0Keys(chunk, [
				"type",
				"index",
				"text"
			], [], label);
			countValue(chunk["index"], `${label} index`);
			stringValue(chunk["text"], `${label} text`);
			return;
		case "tool-call-delta":
			assertReleasedV0Keys(chunk, [
				"type",
				"index",
				"id",
				"argumentsDelta"
			], ["name"], label);
			countValue(chunk["index"], `${label} index`);
			nonEmptyString(chunk["id"], `${label} id`);
			if (chunk["name"] !== void 0) stringValue(chunk["name"], `${label} name`);
			stringValue(chunk["argumentsDelta"], `${label} argumentsDelta`);
			return;
		case "block-end":
			assertReleasedV0Keys(chunk, [
				"type",
				"index",
				"block"
			], [], label);
			countValue(chunk["index"], `${label} index`);
			contentBlockValue(chunk["block"], `${label} block`, 1);
			return;
		case "usage":
			assertReleasedV0Keys(chunk, ["type", "usage"], [], label);
			tokenUsageValue(chunk["usage"], `${label} usage`);
			return;
		case "finish":
			assertReleasedV0Keys(chunk, ["type", "reason"], ["replayState"], label);
			finishReasonValue(chunk["reason"], `${label} reason`);
			if (chunk["replayState"] !== void 0) replayEnvelopeValue(chunk["replayState"], `${label} replayState`);
			return;
		default: throw new SessionFormatError(`${label} has unknown stream chunk type ${JSON.stringify(chunk["type"])}`);
	}
}
function finishReasonValue(value, label) {
	const reason = releasedV0Record(value, label);
	if (reason["kind"] === "aborted" || reason["kind"] === "error") {
		assertReleasedV0Keys(reason, ["kind", "failure"], [], label);
		llmFailureValue(reason["failure"], `${label} failure`);
		return;
	}
	if (reason["kind"] === "stop" || reason["kind"] === "tool-calls" || reason["kind"] === "max-tokens") assertReleasedV0Keys(reason, ["kind"], [], label);
	nonEmptyString(reason["kind"], `${label} kind`);
}
function replayEnvelopeValue(value, label) {
	const replay = exactRecord(value, label, ["response"], ["blocks"]);
	if (replay["blocks"] !== void 0 && !Array.isArray(replay["blocks"])) throw new SessionFormatError(`${label} blocks must be an array`);
}
function turnEndReasonValue(value, label) {
	const reason = releasedV0Record(value, label);
	switch (reason["kind"]) {
		case "completed":
		case "blocked":
		case "max-tokens":
		case "interrupted":
			assertReleasedV0Keys(reason, ["kind"], [], label);
			return;
		case "aborted": {
			assertReleasedV0Keys(reason, ["kind", "reason"], [], label);
			const cause = releasedV0Record(reason["reason"], `${label} abort cause`);
			if (cause["kind"] === "hook") {
				assertReleasedV0Keys(cause, ["kind", "reason"], [], `${label} abort cause`);
				stringValue(cause["reason"], `${label} abort reason`);
			} else {
				assertReleasedV0Keys(cause, ["kind"], [], `${label} abort cause`);
				literalValue(cause["kind"], [
					"user",
					"parent",
					"disposed",
					"legacy"
				], `${label} abort kind`);
			}
			return;
		}
		case "error":
			assertReleasedV0Keys(reason, ["kind", "error"], [], label);
			llmFailureValue(reason["error"], `${label} error`);
			return;
		default:
			nonEmptyString(reason["kind"], `${label} kind`);
			return;
	}
}
function requestHeaderValue(value, label) {
	const header = exactRecord(value, label, ["config"], [
		"adapterDefaults",
		"system",
		"tools"
	]);
	const config = exactRecord(header["config"], `${label} config`, ["provider", "model"], [
		"reasoningEffort",
		"temperature",
		"maxTokens",
		"stop"
	]);
	nonEmptyString(config["provider"], `${label} provider`);
	nonEmptyString(config["model"], `${label} model`);
	if (config["reasoningEffort"] !== void 0) nonEmptyString(config["reasoningEffort"], `${label} reasoningEffort`);
	if (config["temperature"] !== void 0) finiteNumberValue(config["temperature"], `${label} temperature`);
	if (config["maxTokens"] !== void 0) positiveIntegerValue(config["maxTokens"], `${label} maxTokens`);
	if (config["stop"] !== void 0) arrayValue(config["stop"], `${label} stop`, stringValue);
	if (header["adapterDefaults"] !== void 0) {
		const defaults = exactRecord(header["adapterDefaults"], `${label} adapterDefaults`, [], ["reasoningEffort", "maxTokens"]);
		for (const [key, marker] of Object.entries(defaults)) {
			literalValue(marker, [true], `${label} adapterDefaults ${key}`);
			if (!Object.hasOwn(config, key)) throw new SessionFormatError(`${label} adapter default ${key} lacks config value`);
		}
	}
	if (header["system"] !== void 0) stringValue(header["system"], `${label} system`);
	if (header["tools"] !== void 0) arrayValue(header["tools"], `${label} tools`, toolSchemaValue);
}
function toolSchemaValue(value, label) {
	const schema = exactRecord(value, label, [
		"name",
		"description",
		"parameters"
	]);
	nonEmptyString(schema["name"], `${label} name`);
	stringValue(schema["description"], `${label} description`);
	releasedV0Record(schema["parameters"], `${label} parameters`);
}
function shadowedValue(data, eventSeq, label) {
	const range = exactRecord(data["shadowedRange"], `${label} shadowedRange`, ["start", "end"]);
	const start = earlierSeq(range["start"], eventSeq, `${label} shadowedRange start`);
	const end = earlierSeq(range["end"], eventSeq, `${label} shadowedRange end`);
	const seqs = seqArray(data["shadowedSeqs"], eventSeq, `${label} shadowedSeqs`, true);
	if (seqs[0] !== start || seqs.at(-1) !== end) throw new SessionFormatError(`${label} shadowedRange must match shadowedSeqs endpoints`);
	countValue(data["shadowedTokenCount"], `${label} shadowedTokenCount`);
}
function goalChangeValue(data, label) {
	literalValue(data["kind"], ["goal/change"], `${label} kind`);
	literalValue(data["version"], [1], `${label} version`);
	if (data["operation"] === "clear") {
		assertReleasedV0Keys(data, [
			"kind",
			"version",
			"operation",
			"cleared",
			"clearedAt"
		], [], `${label} data`);
		goalRefValue(data["cleared"], `${label} cleared`);
		countValue(data["clearedAt"], `${label} clearedAt`);
		return;
	}
	assertReleasedV0Keys(data, [
		"kind",
		"version",
		"operation",
		"goal",
		"roundsStarted",
		"createdAt",
		"updatedAt"
	], [], `${label} data`);
	literalValue(data["operation"], [
		"create",
		"edit",
		"pause",
		"resume",
		"complete",
		"block"
	], `${label} operation`);
	goalSnapshotValue(data["goal"], `${label} goal`);
	countValue(data["roundsStarted"], `${label} roundsStarted`);
	countValue(data["createdAt"], `${label} createdAt`);
	countValue(data["updatedAt"], `${label} updatedAt`);
}
function goalRefValue(value, label) {
	const ref = exactRecord(value, label, ["id", "revision"]);
	nonEmptyString(ref["id"], `${label} id`);
	positiveIntegerValue(ref["revision"], `${label} revision`);
}
function goalSnapshotValue(value, label) {
	const goal = exactRecord(value, label, [
		"id",
		"revision",
		"objective",
		"phase",
		"maxGoalRounds"
	], ["blockedReason"]);
	nonEmptyString(goal["id"], `${label} id`);
	positiveIntegerValue(goal["revision"], `${label} revision`);
	nonEmptyString(goal["objective"], `${label} objective`);
	literalValue(goal["phase"], [
		"active",
		"paused",
		"blocked",
		"complete"
	], `${label} phase`);
	positiveIntegerValue(goal["maxGoalRounds"], `${label} maxGoalRounds`);
	if (goal["phase"] === "blocked") {
		const reason = exactRecord(goal["blockedReason"], `${label} blockedReason`, ["code", "message"]);
		nonEmptyString(reason["code"], `${label} blocked code`);
		nonEmptyString(reason["message"], `${label} blocked message`);
	} else if (goal["blockedReason"] !== void 0) throw new SessionFormatError(`${label} blockedReason requires blocked phase`);
}
function scheduleChangeValue(data, label) {
	literalValue(data["version"], [1], `${label} version`);
	if (data["operation"] === "create") {
		assertReleasedV0Keys(data, [
			"version",
			"operation",
			"schedule"
		], [], `${label} data`);
		scheduleRecordValue(data["schedule"], `${label} schedule`);
		return;
	}
	assertReleasedV0Keys(data, [
		"version",
		"operation",
		"id"
	], data["operation"] === "dispatch" ? ["acceptedAt"] : [], `${label} data`);
	literalValue(data["operation"], ["delete", "dispatch"], `${label} operation`);
	scheduleIdValue(data["id"], `${label} id`);
	if (data["acceptedAt"] !== void 0) instantValue(data["acceptedAt"], `${label} acceptedAt`);
}
function scheduleRecordValue(value, label) {
	const record = releasedV0Record(value, label);
	if (record["kind"] === "after") {
		assertReleasedV0Keys(record, [
			"id",
			"kind",
			"prompt",
			"afterSeconds",
			"scheduledAt"
		], [], label);
		positiveIntegerValue(record["afterSeconds"], `${label} afterSeconds`);
	} else if (record["kind"] === "at") assertReleasedV0Keys(record, [
		"id",
		"kind",
		"prompt",
		"scheduledAt"
	], [], label);
	else if (record["kind"] === "every") {
		assertReleasedV0Keys(record, [
			"id",
			"kind",
			"prompt",
			"everySeconds",
			"scheduledAt"
		], [], label);
		if (positiveIntegerValue(record["everySeconds"], `${label} everySeconds`) < 300) throw new SessionFormatError(`${label} everySeconds must be at least 300`);
	} else throw new SessionFormatError(`${label} has unknown schedule kind`);
	scheduleIdValue(record["id"], `${label} id`);
	nonEmptyString(record["prompt"], `${label} prompt`);
	instantValue(record["scheduledAt"], `${label} scheduledAt`);
}
function scheduleIdValue(value, label) {
	nonEmptyString(value, label);
	if (value.trim() !== value) throw new SessionFormatError(`${label} must not have surrounding whitespace`);
}
function instantValue(value, label) {
	if (typeof value !== "string" || !/^(?!0000)\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3}Z$/u.test(value) || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new SessionFormatError(`${label} must be a canonical UTC instant`);
}
function titleSourceValue(value, label) {
	const source = releasedV0Record(value, label);
	if (source["kind"] === "provider") {
		assertReleasedV0Keys(source, ["kind", "provider"], ["model"], label);
		nonEmptyString(source["provider"], `${label} provider`);
		if (source["model"] !== void 0) modelRouteValue(source["model"], `${label} model`);
		return;
	}
	assertReleasedV0Keys(source, ["kind"], [], label);
	literalValue(source["kind"], ["fallback", "user"], `${label} kind`);
}
function modelRouteValue(value, label) {
	const route = exactRecord(value, label, ["provider", "model"]);
	nonEmptyString(route["provider"], `${label} provider`);
	nonEmptyString(route["model"], `${label} model`);
}
function subagentDescriptorValue(data, label) {
	literalValue(data["version"], [3], `${label} version`);
	nonEmptyString(data["provider"], `${label} provider`);
	if (data["mode"] === "one-shot") {
		assertReleasedV0Keys(data, [
			"mode",
			"version",
			"provider"
		], ["label"], `${label} data`);
		if (data["label"] !== void 0) stringValue(data["label"], `${label} label`);
		return;
	}
	literalValue(data["mode"], ["continuable"], `${label} mode`);
	nonEmptyString(data["label"], `${label} label`);
	for (const key of [
		"agentProvider",
		"agentModel",
		"agentReasoningEffort",
		"persona"
	]) if (data[key] !== void 0) nonEmptyString(data[key], `${label} ${key}`);
	if (data["agentProvider"] === void 0 !== (data["agentModel"] === void 0)) throw new SessionFormatError(`${label} agentProvider and agentModel must be paired`);
	if (data["toolFilter"] !== void 0) {
		const filter = exactRecord(data["toolFilter"], `${label} toolFilter`, [], ["allow", "deny"]);
		if (filter["allow"] === void 0 && filter["deny"] === void 0) throw new SessionFormatError(`${label} toolFilter requires allow or deny`);
		if (filter["allow"] !== void 0) arrayValue(filter["allow"], `${label} allow`, nonEmptyString);
		if (filter["deny"] !== void 0) arrayValue(filter["deny"], `${label} deny`, nonEmptyString);
	}
}
function allowedModelsValue(value, label) {
	const seen = /* @__PURE__ */ new Set();
	if (arrayValue(value, label, (member, memberLabel) => {
		const route = exactRecord(member, memberLabel, ["provider", "model"]);
		nonEmptyString(route["provider"], `${memberLabel} provider`);
		nonEmptyString(route["model"], `${memberLabel} model`);
		const key = `${route["provider"]}\0${route["model"]}`;
		if (seen.has(key)) throw new SessionFormatError(`${label} repeats route ${key}`);
		seen.add(key);
	}).length === 0) throw new SessionFormatError(`${label} must be non-empty`);
}
function teamSelector(data, label) {
	literalValue(data["version"], [1], `${label} version`);
	nonEmptyString(data["teamId"], `${label} teamId`);
}
function teamMemberValue(value, label) {
	const member = exactRecord(value, label, [
		"id",
		"name",
		"description",
		"provider",
		"context",
		"phase"
	], ["error"]);
	nonEmptyString(member["id"], `${label} id`);
	stringValue(member["name"], `${label} name`);
	stringValue(member["description"], `${label} description`);
	stringValue(member["provider"], `${label} provider`);
	literalValue(member["context"], ["fresh", "fork"], `${label} context`);
	literalValue(member["phase"], [
		"provisioning",
		"active",
		"failed"
	], `${label} phase`);
	if (member["error"] !== void 0) stringValue(member["error"], `${label} error`);
}
function teamTaskValue(value, label) {
	const task = exactRecord(value, label, [
		"id",
		"revision",
		"subject",
		"description",
		"status",
		"blockedBy",
		"writeScopes"
	], ["ownerId"]);
	nonEmptyString(task["id"], `${label} id`);
	positiveIntegerValue(task["revision"], `${label} revision`);
	stringValue(task["subject"], `${label} subject`);
	stringValue(task["description"], `${label} description`);
	literalValue(task["status"], [
		"pending",
		"in_progress",
		"completed",
		"deleted"
	], `${label} status`);
	if (task["ownerId"] !== void 0) nonEmptyString(task["ownerId"], `${label} ownerId`);
	arrayValue(task["blockedBy"], `${label} blockedBy`, nonEmptyString);
	arrayValue(task["writeScopes"], `${label} writeScopes`, stringValue);
}
function teamMessageValue(value, label, version) {
	const message = exactRecord(value, label, [
		"id",
		"senderId",
		"senderName",
		"targetId",
		"delivery",
		"content"
	]);
	for (const key of [
		"id",
		"senderId",
		"targetId"
	]) nonEmptyString(message[key], `${label} ${key}`);
	stringValue(message["senderName"], `${label} senderName`);
	literalValue(message["delivery"], ["quiet", "wakeup"], `${label} delivery`);
	contentBlocksValue(message["content"], `${label} content`, version);
}
function workflowIdentity(data, label) {
	nonEmptyString(data["runId"], `${label} runId`);
	positiveIntegerValue(data["seq"], `${label} seq`);
}
function deepSeekSearchBodyValue(value, label) {
	const body = exactRecord(value, label, [
		"model",
		"max_tokens",
		"messages",
		"tools"
	]);
	nonEmptyString(body["model"], `${label} model`);
	positiveIntegerValue(body["max_tokens"], `${label} max_tokens`);
	if (arrayValue(body["messages"], `${label} messages`, (member, memberLabel) => {
		const message = exactRecord(member, memberLabel, ["role", "content"]);
		literalValue(message["role"], ["user"], `${memberLabel} role`);
		if (arrayValue(message["content"], `${memberLabel} content`, (block, blockLabel) => {
			const text = exactRecord(block, blockLabel, ["type", "text"]);
			literalValue(text["type"], ["text"], `${blockLabel} type`);
			stringValue(text["text"], `${blockLabel} text`);
		}).length !== 1) throw new SessionFormatError(`${memberLabel} content must contain one text block`);
	}).length !== 1) throw new SessionFormatError(`${label} messages must contain one user message`);
	if (arrayValue(body["tools"], `${label} tools`, (member, memberLabel) => {
		const tool = exactRecord(member, memberLabel, [
			"type",
			"name",
			"max_uses"
		]);
		literalValue(tool["type"], ["web_search_20250305"], `${memberLabel} type`);
		literalValue(tool["name"], ["web_search"], `${memberLabel} name`);
		positiveIntegerValue(tool["max_uses"], `${memberLabel} max_uses`);
	}).length !== 1) throw new SessionFormatError(`${label} tools must contain one web search tool`);
}
const HEADER_REQUIRED$2 = [
	"version",
	"id",
	"createdAt",
	"isSeeded",
	"delegationDepth"
];
const HEADER_OPTIONAL$2 = [
	"cwd",
	"parentSession",
	"origin",
	"agentPreset"
];
/**
* Validate the logical header shared by released v0 and v1.
* @param header - detached logical header.
* @param version - exact expected generation.
*/
function assertReleasedSessionFormatHeader(header, version) {
	const record = releasedV0Record(header, `format v${version} header`);
	assertReleasedV0Keys(record, HEADER_REQUIRED$2, HEADER_OPTIONAL$2, `format v${version} header`);
	if (record["version"] !== version) throw new SessionFormatError(`expected format v${version} header`);
	if (typeof record["id"] !== "string") throw new SessionFormatError(`format v${version} header id must be a string`);
	sessionFormatCount(record["createdAt"], `format v${version} header createdAt`);
	if (typeof record["isSeeded"] !== "boolean") throw new SessionFormatError(`format v${version} header isSeeded must be a boolean`);
	sessionFormatCount(record["delegationDepth"], `format v${version} header delegationDepth`);
	for (const key of [
		"cwd",
		"parentSession",
		"agentPreset"
	]) if (record[key] !== void 0 && typeof record[key] !== "string") throw new SessionFormatError(`format v${version} header ${key} must be a string`);
	if (typeof record["cwd"] === "string" && !isAbsolute(record["cwd"])) throw new SessionFormatError(`format v${version} header cwd must be absolute`);
	if (record["origin"] !== void 0 && record["origin"] !== "subagent") throw new SessionFormatError(`format v${version} header origin must be "subagent"`);
}
/**
* Validate one released-v1 logical header.
* @param header - detached logical header.
*/
function assertReleasedV1Header(header) {
	assertReleasedSessionFormatHeader(header, 1);
}
/**
* Validate shared-layout surface references for one released generation.
* @param record - exact event envelope.
* @param seq - event position used for earlier-reference checks.
* @param type - surface event type used in diagnostics.
* @param assistantSources - whether this generation admits empty Assistant chunk provenance.
*/
function assertReleasedSurfaceMetadata(record, seq, type, assistantSources) {
	const sources = record["sourceEventSeqs"];
	if (type === "assistant/message" && sources !== void 0 && assistantSources === "forbid-assistant") throw new SessionFormatError(`assistant/message ${seq} retains obsolete chunk provenance`);
	if (sources !== void 0) {
		if (!Array.isArray(sources)) throw new SessionFormatError(`${type} ${seq} sourceEventSeqs must be an array`);
		const seen = /* @__PURE__ */ new Set();
		for (const source of sources) {
			const current = sessionFormatCount(source, `${type} ${seq} sourceEventSeqs member`);
			if (current >= seq || seen.has(current)) throw new SessionFormatError(`${type} ${seq} sourceEventSeqs must be unique earlier seqs`);
			seen.add(current);
		}
		if (sources.length === 0 && type !== "assistant/message") throw new SessionFormatError(`${type} ${seq} sourceEventSeqs must be non-empty`);
	}
	const operation = record["surfaceOp"];
	if (operation === void 0 || operation === "append") return;
	const replacement = releasedV0Record(operation, `${type} ${seq} surfaceOp`);
	assertReleasedV0Keys(replacement, [
		"op",
		"start",
		"end"
	], [], `${type} ${seq} surfaceOp`);
	if (replacement["op"] !== "replace") throw new SessionFormatError(`${type} ${seq} surfaceOp must replace`);
	const start = sessionFormatCount(replacement["start"], `${type} ${seq} surface start`);
	const end = sessionFormatCount(replacement["end"], `${type} ${seq} surface end`);
	if (start >= seq || end >= seq) throw new SessionFormatError(`${type} ${seq} has an invalid surface replacement`);
}
/**
* Validate one exact known payload after legacy normalization.
* @param event - known event to validate.
* @param version - payload generation controlling versioned members.
*/
function assertReleasedEventPayload(event, version) {
	const disposition = RELEASED_V0_EVENT_DISPOSITIONS[event.type];
	/* v8 ignore next -- artifact coordinate validation admits only the frozen inventory before payload validation. */
	if (disposition === void 0) throw new SessionFormatUnsupportedMigrationError(`format v0 contains unknown historical event type ${JSON.stringify(event.type)} at seq ${event.seq}; migration refuses unknown historical events even when ignorable`);
	const data = releasedV0Record(event.data, `${event.type} ${event.seq} data`);
	if (event.type === "subagent/descriptor" && data["version"] !== 3) {
		const descriptorVersion = sessionFormatCount(data["version"], `${event.type} ${event.seq} version`);
		if (version === 0) throw new SessionFormatUnsupportedMigrationError(`${event.type} ${event.seq} uses unsupported descriptor version ${descriptorVersion}`);
		return;
	}
	const versionOptional = version === 1 && event.type === "session-log-deepseek/delivery-accepted" ? [...disposition.optional, "sessionFormatVersion"] : disposition.optional;
	assertReleasedV0Keys(data, disposition.required, versionOptional, `${event.type} ${event.seq} data`);
	for (const key of disposition.opaque) if (Object.hasOwn(data, key) && !isJsonValue(data[key])) throw new SessionFormatError(`${event.type} ${event.seq} opaque ${key} is not lossless JSON`);
	assertReleasedPayloadSemantics(event, version);
}
const PHYSICAL_HEADER_REQUIRED = [
	"type",
	"version",
	"id",
	"createdAt",
	"delegationDepth"
];
const PHYSICAL_HEADER_OPTIONAL = [
	"cwd",
	"parentSession",
	"seedLength",
	"origin",
	"agentPreset"
];
const PACKED_TAGS = /* @__PURE__ */ new Set([
	"text-chunks",
	"reasoning-chunks",
	"tool-call-chunks"
]);
/**
* Test whether a compact migration item is a released packed Assistant row.
* @param run - compact migration item to classify.
* @returns whether the item carries the released Assistant chunk representation.
*/
function isReleasedAssistantChunkRun(run) {
	return run.runType === "released-assistant-chunks";
}
/** Frozen physical JSON codec for the released v0 layout. */
const releasedV0SessionFormatCodec = createReleasedCodec(0);
/** Frozen physical JSON codec for the shared-layout released v1 format. */
const releasedV1SessionFormatCodec = createReleasedCodec(1);
function createReleasedCodec(version) {
	return Object.freeze({
		version,
		decodeHeader: (value) => decodeHeader(value, version),
		createDecoder(headerValue, recovery) {
			const physical = decodePhysicalHeader$1(headerValue, version);
			const scanner = scanRows(recovery === "recoverable");
			return {
				header: physical.header,
				headerInheritedEventCount: physical.inheritedEventCount,
				decodeRow: (rowValue, context) => {
					scanner.decodeRow(rowValue, context);
				},
				finish(_context) {
					scanner.finish(physical.inheritedEventCount);
					return physical.inheritedEventCount;
				}
			};
		}
	});
}
function scanRows(recoverable) {
	let rowIndex = 0;
	let eventCount = 0;
	let issue;
	return {
		decodeRow(rowValue, context) {
			const currentRow = rowIndex;
			rowIndex += 1;
			let packed = false;
			let decoded;
			try {
				const record = releasedV0Record(rowValue, `released Session row ${currentRow}`);
				const type = record["type"];
				if (typeof type === "string" && PACKED_TAGS.has(type)) {
					packed = true;
					decoded = decodePackedRun(record, type, currentRow);
				} else decoded = decodeEvent$1(record, currentRow);
			} catch (error) {
				const current = error instanceof SessionFormatError ? error : new SessionFormatError(`released Session row ${currentRow} is malformed`, { cause: error });
				if (!recoverable) throw current;
				issue ??= current;
				return;
			}
			if (issue !== void 0) {
				if (!packed && decoded.type === "turn/end") throw issue;
				return;
			}
			const seq = packed ? decoded.firstSeq : decoded.seq;
			if (seq !== eventCount) {
				const gap = new SessionFormatError(`released Session row ${currentRow} has seq gap (expected ${eventCount}, got ${seq})`);
				if (!recoverable) throw gap;
				issue = gap;
				if (!packed && decoded.type === "turn/end") throw gap;
				return;
			}
			if (packed) {
				const run = decoded;
				eventCount += run.eventCount;
				context.emitRun(run);
			} else {
				eventCount += 1;
				context.emitEvent(decoded);
			}
		},
		finish(inheritedEventCount) {
			if (inheritedEventCount > eventCount) throw new SessionFormatError("Session inheritedEventCount exceeds its event count");
		}
	};
}
function decodeHeader(value, version) {
	return decodePhysicalHeader$1(value, version).header;
}
function decodePhysicalHeader$1(value, version) {
	const record = releasedV0Record(snapshotSessionFormatJson(value, `released v${version} physical header`), `released v${version} physical header`);
	assertReleasedV0Keys(record, PHYSICAL_HEADER_REQUIRED, PHYSICAL_HEADER_OPTIONAL, `released v${version} physical header`);
	if (record["type"] !== "session" || record["version"] !== version) throw new SessionFormatError(`expected released v${version} physical Session header`);
	if (typeof record["id"] !== "string") throw new SessionFormatError(`released v${version} header id must be a string`);
	const createdAt = sessionFormatCount(record["createdAt"], `released v${version} header createdAt`);
	const delegationDepth = sessionFormatCount(record["delegationDepth"], `released v${version} header delegationDepth`);
	const seedLength = record["seedLength"] === void 0 ? 0 : sessionFormatCount(record["seedLength"], `released v${version} header seedLength`);
	for (const key of [
		"cwd",
		"parentSession",
		"agentPreset"
	]) if (record[key] !== void 0 && typeof record[key] !== "string") throw new SessionFormatError(`released v${version} header ${key} must be a string`);
	if (record["origin"] !== void 0 && record["origin"] !== "subagent") throw new SessionFormatError(`released v${version} header origin must be "subagent"`);
	const header = {
		version,
		id: record["id"],
		createdAt,
		...record["cwd"] === void 0 ? {} : { cwd: record["cwd"] },
		...record["parentSession"] === void 0 ? {} : { parentSession: record["parentSession"] },
		isSeeded: record["seedLength"] !== void 0,
		...record["origin"] === void 0 ? {} : { origin: record["origin"] },
		delegationDepth,
		...record["agentPreset"] === void 0 ? {} : { agentPreset: record["agentPreset"] }
	};
	assertReleasedSessionFormatHeader(header, version);
	return {
		header,
		inheritedEventCount: seedLength
	};
}
function decodeEvent$1(record, rowIndex) {
	if (record["sourceEventSeqs"] !== void 0) {
		const seq = sessionFormatCount(record["seq"], `released Session row ${rowIndex} seq`);
		return {
			...record,
			sourceEventSeqs: decodeSeqRanges$1(record["sourceEventSeqs"], seq)
		};
	}
	return record;
}
function decodePackedRun(row, type, rowIndex) {
	const label = `released ${type} row ${rowIndex}`;
	assertReleasedV0Keys(row, [
		"type",
		"seq0",
		"time0",
		"data"
	], [], label);
	const seq0 = sessionFormatCount(row["seq0"], `${label} seq0`);
	const time0 = sessionFormatSafeInteger(row["time0"], `${label} time0`);
	const data = releasedV0Record(row["data"], `${label} data`);
	const isTool = type === "tool-call-chunks";
	assertReleasedV0Keys(data, isTool ? [
		"turn",
		"step",
		"index",
		"id",
		"dt",
		"args"
	] : [
		"turn",
		"step",
		"index",
		"dt",
		"texts"
	], isTool ? ["name"] : [], `${label} data`);
	const payload = data[isTool ? "args" : "texts"];
	if (!Array.isArray(payload) || payload.length === 0 || payload.some((member) => typeof member !== "string")) throw new SessionFormatError(`${label} payload must be a non-empty string array`);
	const gaps = data["dt"];
	if (!Array.isArray(gaps) || gaps.length !== payload.length - 1) throw new SessionFormatError(`${label} dt length must match its payload`);
	let lastTime = time0;
	for (const gap of gaps) {
		const validGap = sessionFormatSafeInteger(gap, `${label} dt member`);
		lastTime = sessionFormatSafeInteger(lastTime + validGap, `${label} member time`);
	}
	const turn = sessionFormatCount(data["turn"], `${label} turn`);
	const step = sessionFormatCount(data["step"], `${label} step`);
	const chunkIndex = sessionFormatCount(data["index"], `${label} index`);
	if (isTool && (typeof data["id"] !== "string" || data["id"].length === 0 || data["name"] !== void 0 && typeof data["name"] !== "string")) throw new SessionFormatError(`${label} id and optional name must be strings`);
	const lastSeq = sessionFormatCount(seq0 + payload.length - 1, `${label} final seq`);
	const stream = type === "tool-call-chunks" ? {
		type,
		time0,
		index: chunkIndex,
		dt: gaps,
		id: data["id"],
		...data["name"] === void 0 ? {} : { name: data["name"] },
		args: payload
	} : {
		type,
		time0,
		index: chunkIndex,
		dt: gaps,
		texts: payload
	};
	const run = {
		runType: "released-assistant-chunks",
		firstSeq: seq0,
		eventCount: payload.length,
		turn,
		step,
		lastSeq,
		lastTime,
		stream,
		expand: () => expandAssistantChunkRun(run)
	};
	return run;
}
function* expandAssistantChunkRun(run) {
	const stream = run.stream;
	const gaps = stream["dt"];
	const members = stream["type"] === "tool-call-chunks" ? stream["args"] : stream["texts"];
	let time = run.stream["time0"];
	for (let index = 0; index < members.length; index += 1) {
		if (index > 0) time += gaps[index - 1];
		const member = members[index];
		const chunk = stream["type"] === "text-chunks" ? {
			type: "text-delta",
			index: stream["index"],
			text: member
		} : stream["type"] === "reasoning-chunks" ? {
			type: "reasoning-delta",
			index: stream["index"],
			text: member
		} : {
			type: "tool-call-delta",
			index: stream["index"],
			id: stream["id"],
			...stream["name"] === void 0 ? {} : { name: stream["name"] },
			argumentsDelta: member
		};
		yield {
			type: "assistant/chunk",
			seq: run.firstSeq + index,
			time,
			data: {
				turn: run.turn,
				step: run.step,
				chunk
			}
		};
	}
}
function decodeSeqRanges$1(value, maxEntries) {
	if (!Array.isArray(value)) throw new SessionFormatError("sourceEventSeqs must be an array");
	const output = [];
	let hasRange = false;
	for (const entry of value) {
		if (typeof entry === "number") {
			if (output.length >= maxEntries) throw new SessionFormatError("sourceEventSeqs exceeds its event seq");
			output.push(sessionFormatCount(entry, "sourceEventSeqs member"));
			continue;
		}
		if (!Array.isArray(entry) || entry.length !== 2) throw new SessionFormatError("sourceEventSeqs range must be a [start, end] pair");
		const start = sessionFormatCount(entry[0], "sourceEventSeqs range start");
		const end = sessionFormatCount(entry[1], "sourceEventSeqs range end");
		if (end < start || end - start + 1 > maxEntries - output.length) throw new SessionFormatError("sourceEventSeqs range exceeds its event seq");
		for (let seq = start; seq <= end; seq += 1) output.push(seq);
		hasRange = true;
	}
	if (hasRange && output.some((member, index) => index > 0 && member <= output[index - 1])) throw new SessionFormatError("sourceEventSeqs ranges must be strictly increasing");
	return output;
}
/** Identity format edge that promotes released v0 into released v1. */
const sessionFormatV0ToV1 = defineSessionFormatMigration({
	name: "@deepseek-ai/dsh-session-format-v0-to-v1",
	fromVersion: 0,
	toVersion: 1,
	migrateHeader(header) {
		assertHeaderVersion(header, 0);
		return {
			...header,
			version: 1
		};
	},
	createStage(input) {
		return new ReleasedV0ToV1Stage(input);
	},
	validateTargetHeader: assertReleasedV1Header
});
var ReleasedV0ToV1Stage = class {
	input;
	headerInheritedEventCount;
	state = {
		messageIds: /* @__PURE__ */ new Map(),
		retryIds: /* @__PURE__ */ new Map()
	};
	constructor(input) {
		this.input = input;
		assertHeaderVersion(input.sourceHeader, 0);
		this.headerInheritedEventCount = sessionFormatCount(input.sourceInheritedEventCount, "format v0 inherited event count");
	}
	transformEvent(event, context) {
		const normalized = normalizeReleasedV0Event(event, this.input.sourceHeader.id, this.state);
		assertSourceDeliveryMarker$1(normalized, this.input);
		context.emitEvent(normalized);
	}
	transformRun(run, context) {
		if (isReleasedAssistantChunkRun(run)) {
			context.emitRun(run);
			return;
		}
		for (const event of run.expand()) this.transformEvent(event, context);
	}
	finish(_context) {
		return this.headerInheritedEventCount;
	}
};
function assertHeaderVersion(header, version) {
	if (header.version !== version) throw new SessionFormatError(`expected format v${version} header`);
}
function normalizeReleasedV0Event(event, sessionId, state) {
	const named = normalizeLegacyCompactionType(event);
	assertSupportedLegacyType(named, sessionId);
	const message = normalizeLegacyMessage(normalizeLegacyCompaction(normalizeLegacyRetry(normalizeLegacySteering(normalizeLegacyRequestHeader(normalizeLegacyTurnEnd(normalizeLegacyTurnStart(named, sessionId), sessionId), sessionId), sessionId), sessionId, state.retryIds), sessionId, state), sessionId, state.messageIds);
	if (message.type !== "assistant/chunk") assertReleasedEventPayload(message, 0);
	const messageId = eventMessageId(message);
	if (messageId !== void 0) state.messageIds.set(message.seq, messageId);
	return message;
}
function normalizeLegacyCompactionType(event) {
	switch (event.type) {
		case "compact/start": return {
			...event,
			type: "compaction/start"
		};
		case "compact/summary": return {
			...event,
			type: "compaction/summary"
		};
		case "compact/end": return {
			...event,
			type: "compaction/end"
		};
		case "compact/prune": return {
			...event,
			type: "compaction/prune"
		};
		default: return event;
	}
}
function assertSourceDeliveryMarker$1(event, input) {
	if (event.type !== "session-log-deepseek/delivery-accepted") return;
	const data = releasedV0Record(event.data, `${event.type} ${event.seq} data`);
	const acceptedVersion = data["sessionFormatVersion"] ?? 0;
	const inherited = input.sourceHeader.parentSession !== void 0 && event.seq < sessionFormatCount(input.sourceInheritedEventCount, "format v0 inherited event count");
	if (acceptedVersion === 0 && !inherited && data["sessionId"] !== input.sourceHeader.id) throw new SessionFormatError("current-generation delivery marker names the wrong Session");
}
function normalizeLegacyRetry(event, sessionId, retryIds) {
	if (event.type !== "llm/retry") return event;
	const data = releasedV0Record(event.data, `llm/retry ${event.seq} data`);
	const chain = [
		data["turn"],
		data["step"],
		data["provider"],
		data["policyKey"]
	].map((value) => JSON.stringify(value)).join("\0");
	const retryId = data["retryId"];
	if (typeof retryId === "string" && retryId.length > 0) {
		retryIds.set(chain, retryId);
		return event;
	}
	if (Object.hasOwn(data, "retryId")) return event;
	const migratedRetryId = retryIds.get(chain) ?? `legacy-retry:${sessionId}:${event.seq}`;
	retryIds.set(chain, migratedRetryId);
	return {
		...event,
		data: {
			...data,
			retryId: migratedRetryId
		}
	};
}
function normalizeLegacyCompaction(event, sessionId, state) {
	if (event.type === "session/end-seed") {
		delete state.compactionId;
		return event;
	}
	if (event.type === "compaction/start") {
		const data = releasedV0Record(event.data, `compaction/start ${event.seq} data`);
		const existing = data["compactionId"];
		if (typeof existing === "string" && existing.length > 0) {
			state.compactionId = existing;
			return event;
		}
		if (Object.hasOwn(data, "compactionId")) return event;
		const id = `legacy-compaction:${sessionId}:${event.seq}`;
		state.compactionId = id;
		return {
			...event,
			data: {
				...data,
				compactionId: id
			}
		};
	}
	const compactionId = state.compactionId;
	if (compactionId === void 0) return event;
	if (event.type === "compaction/summary" || event.type === "compaction/end") {
		const normalized = addLegacyCompactionId(event, compactionId);
		if (event.type === "compaction/end") delete state.compactionId;
		return normalized;
	}
	if (event.type !== "user/message") return event;
	const data = releasedV0Record(event.data, `user/message ${event.seq} data`);
	const source = data["source"];
	if (!releasedIsRecord(source) || source["kind"] !== "plugin" || source["plugin"] !== "compact" || Object.hasOwn(source, "compactionId")) return event;
	return {
		...event,
		data: {
			...data,
			source: {
				...source,
				compactionId
			}
		}
	};
}
function addLegacyCompactionId(event, compactionId) {
	const data = releasedV0Record(event.data, `${event.type} ${event.seq} data`);
	if (Object.hasOwn(data, "compactionId")) return event;
	return {
		...event,
		data: {
			...data,
			compactionId
		}
	};
}
function normalizeLegacyRequestHeader(event, sessionId) {
	if (event.type !== "request/header") return event;
	const data = releasedV0Record(event.data, `request/header ${event.seq} data`);
	const header = releasedV0Record(data["header"], `request/header ${event.seq} header`);
	if (!Object.hasOwn(header, "messagePrefix")) return event;
	if (!Array.isArray(header["messagePrefix"])) throw new SessionFormatError(`session ${JSON.stringify(sessionId)} contains malformed request/header messagePrefix at seq ${event.seq}`);
	const { messagePrefix: _messagePrefix, ...currentHeader } = header;
	return {
		...event,
		data: {
			...data,
			header: currentHeader
		}
	};
}
function assertSupportedLegacyType(event, sessionId) {
	if (event.type === "request/header-delta" || event.type === "mode/set") throw new SessionFormatUnsupportedMigrationError(`session ${JSON.stringify(sessionId)} contains unsupported legacy ${event.type} event at seq ${event.seq}`);
	if (event.type === "request/header") {
		if (releasedV0Record(event.data, `request/header ${event.seq} data`)["reason"] === "fallback") throw new SessionFormatUnsupportedMigrationError(`session ${JSON.stringify(sessionId)} contains unsupported request/header reason "fallback" at seq ${event.seq}`);
	}
}
function normalizeLegacySteering(event, sessionId) {
	if (event.type !== "steering/message") return event;
	const data = releasedV0Record(event.data, `steering/message ${event.seq} data`);
	const wrapped = data["message"];
	if (wrapped !== void 0) {
		assertReleasedV0Keys(data, ["turn", "message"], [], `steering/message ${event.seq} data`);
		sessionFormatCount(data["turn"], `steering/message ${event.seq} turn`);
		return {
			...event,
			type: "user/message",
			data: wrapped
		};
	}
	assertReleasedV0Keys(data, [
		"turn",
		"content",
		"source"
	], [], `steering/message ${event.seq} data`);
	sessionFormatCount(data["turn"], `steering/message ${event.seq} turn`);
	const { turn: _turn, ...message } = data;
	return {
		...event,
		type: "user/message",
		data: {
			...message,
			id: legacyMessageId(sessionId, event.seq),
			role: "user"
		}
	};
}
function normalizeLegacyTurnStart(event, sessionId) {
	if (event.type !== "turn/start") return event;
	const data = releasedV0Record(event.data, `turn/start ${event.seq} data`);
	if (!Object.hasOwn(data, "trigger")) return event;
	assertReleasedV0Keys(data, ["turn", "trigger"], [], `turn/start ${event.seq} data`);
	const turn = sessionFormatCount(data["turn"], `turn/start ${event.seq} turn`);
	const trigger = releasedV0Record(data["trigger"], `turn/start ${event.seq} trigger`);
	if (turn < 1 || typeof trigger["kind"] !== "string" || trigger["kind"].length === 0) throw malformedLegacy(sessionId, "turn/start", event.seq);
	return {
		...event,
		data: { turn }
	};
}
function normalizeLegacyTurnEnd(event, sessionId) {
	if (event.type !== "turn/end") return event;
	const data = releasedV0Record(event.data, `turn/end ${event.seq} data`);
	assertReleasedV0Keys(data, ["turn", "reason"], [], `turn/end ${event.seq} data`);
	if (sessionFormatCount(data["turn"], `turn/end ${event.seq} turn`) < 1) throw malformedLegacy(sessionId, "turn/end", event.seq);
	const reason = releasedV0Record(data["reason"], `turn/end ${event.seq} reason`);
	if (typeof reason["kind"] !== "string") throw malformedLegacy(sessionId, "turn/end", event.seq);
	let current;
	switch (reason["kind"]) {
		case "completed":
		case "blocked":
		case "max-tokens":
		case "interrupted":
			assertReleasedV0Keys(reason, ["kind"], [], `turn/end ${event.seq} reason`);
			return event;
		case "aborted":
			if (Object.hasOwn(reason, "reason")) return event;
			assertReleasedV0Keys(reason, ["kind"], [], `turn/end ${event.seq} reason`);
			current = {
				kind: "aborted",
				reason: { kind: "legacy" }
			};
			break;
		case "disposed":
			assertReleasedV0Keys(reason, ["kind"], [], `turn/end ${event.seq} reason`);
			current = {
				kind: "aborted",
				reason: { kind: "disposed" }
			};
			break;
		case "error":
			if (Object.hasOwn(reason, "error")) return event;
			current = normalizeLegacyErrorReason(reason, event.seq, sessionId);
			break;
		default: return event;
	}
	return {
		...event,
		data: {
			...data,
			reason: current
		}
	};
}
function normalizeLegacyErrorReason(reason, seq, sessionId) {
	sessionFormatCount(reason["step"], `turn/end ${seq} error step`);
	const failure = reason["failure"];
	if (failure !== void 0) {
		assertReleasedV0Keys(reason, [
			"kind",
			"step",
			"failure"
		], [], `turn/end ${seq} reason`);
		const record = releasedV0Record(failure, `turn/end ${seq} failure`);
		assertReleasedV0Keys(record, ["message", "code"], [
			"status",
			"providerRetryAfterMs",
			"requestId"
		], `turn/end ${seq} failure`);
		if (typeof record["message"] !== "string" || typeof record["code"] !== "string") throw malformedLegacy(sessionId, "turn/end", seq);
		return {
			kind: "error",
			error: record
		};
	}
	assertReleasedV0Keys(reason, [
		"kind",
		"step",
		"message"
	], ["code"], `turn/end ${seq} reason`);
	if (typeof reason["message"] !== "string" || reason["code"] !== void 0 && typeof reason["code"] !== "string") throw malformedLegacy(sessionId, "turn/end", seq);
	return {
		kind: "error",
		error: {
			message: reason["message"],
			code: typeof reason["code"] === "string" ? reason["code"] : "UNKNOWN"
		}
	};
}
function normalizeLegacyMessage(event, sessionId, messageIds) {
	const data = releasedV0Record(event.data, `${event.type} ${event.seq} data`);
	switch (event.type) {
		case "user/message":
			if (Object.hasOwn(data, "id") || Object.hasOwn(data, "role") || Object.hasOwn(data, "message") || !Object.hasOwn(data, "content") || !Object.hasOwn(data, "source")) return event;
			return {
				...event,
				data: {
					...data,
					id: legacyMessageId(sessionId, event.seq),
					role: "user"
				}
			};
		case "assistant/message": {
			if (Object.hasOwn(data, "message") || !Object.hasOwn(data, "content") || !Object.hasOwn(data, "provenance")) return event;
			const { content, provenance, ...eventData } = data;
			const source = releasedV0Record(provenance, `assistant/message ${event.seq} provenance`);
			return {
				...event,
				data: {
					...eventData,
					message: {
						id: legacyMessageId(sessionId, event.seq),
						role: "assistant",
						content,
						source: {
							...source,
							kind: "model"
						}
					}
				}
			};
		}
		case "tool/result": {
			if (Object.hasOwn(data, "message") || !Object.hasOwn(data, "callId") || !Object.hasOwn(data, "content") || !Object.hasOwn(data, "isError")) return event;
			const { callId, content, isError, ...eventData } = data;
			if (typeof callId !== "string" || typeof isError !== "boolean" || content === void 0) return event;
			const inheritedId = replacementStart(event);
			const messageId = inheritedId === void 0 ? legacyMessageId(sessionId, event.seq) : messageIds.get(inheritedId);
			if (messageId === void 0) throw new SessionFormatError(`tool/result ${event.seq} replacement cites a message without identity`);
			return {
				...event,
				data: {
					...eventData,
					message: {
						id: messageId,
						role: "user",
						content: [{
							type: "tool-result",
							toolCallId: callId,
							content,
							isError
						}],
						source: {
							kind: "tool",
							callId
						}
					}
				}
			};
		}
		default: return event;
	}
}
function replacementStart(event) {
	const operation = event["surfaceOp"];
	if (operation === void 0 || !releasedIsRecord(operation) || operation["op"] !== "replace") return void 0;
	return operation["start"];
}
function eventMessageId(event) {
	const data = releasedV0Record(event.data, `${event.type} ${event.seq} data`);
	const message = event.type === "user/message" ? data : releasedIsRecord(data["message"]) ? data["message"] : void 0;
	return typeof message?.["id"] === "string" ? message["id"] : void 0;
}
function releasedIsRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function legacyMessageId(sessionId, seq) {
	return `legacy-message:${sessionId}:${seq}`;
}
function malformedLegacy(sessionId, type, seq) {
	return new SessionFormatError(`session ${JSON.stringify(sessionId)} contains malformed pre-react-loop ${type} at seq ${seq}`);
}
const SURFACE_TYPES$2 = /* @__PURE__ */ new Set([
	"user/message",
	"assistant/message",
	"tool/result"
]);
/**
* Validate cross-event relationships required to construct one current Session safely.
* @param artifact - complete normalized v0 or exact current v1 artifact.
* @param extensions - later-generation event roles interpreted by the calling format owner.
*/
function assertReleasedArtifactRelationships(artifact, extensions = {}) {
	let openTurn = null;
	let openStep = null;
	let openStepProvider;
	let nextTurn = 1;
	let nextStep = 1;
	let surface = [];
	let openCompaction;
	const staleCompactionStarts = inheritedOrphanCompactionStarts(artifact.events);
	const retries = [];
	const retryStarts = /* @__PURE__ */ new Set();
	const ptcRoots = /* @__PURE__ */ new Map();
	const ptcStarts = /* @__PURE__ */ new Map();
	const toolLifecycles = /* @__PURE__ */ new Map();
	const commandRuns = /* @__PURE__ */ new Set();
	for (const event of artifact.events) {
		const extensionStepEvent = extensions.stepEvents?.has(event.type) === true;
		if (RELEASED_V0_EVENT_DISPOSITIONS[event.type] === void 0 && !extensionStepEvent) continue;
		const data = releasedV0Record(event.data, `${event.type} ${event.seq} data`);
		if (SURFACE_TYPES$2.has(event.type)) surface = applySurface(surface, event);
		if ((event.type === "turn/start" || event.type === "turn/end") && openCompaction !== void 0 && !staleCompactionStarts.has(openCompaction.startSeq)) throw new SessionFormatError(`${event.type} crosses an open compaction`);
		if (extensionStepEvent) {
			requireOpenStep(event, data, openTurn, openStep);
			continue;
		}
		switch (event.type) {
			case "turn/start": {
				const previous = artifact.events[event.seq - 1];
				if (extensions.legacyInterruptedTurnRestart === true && openTurn !== null && openStep === null && data["turn"] === openTurn + 1 && nextTurn === openTurn && previous?.type === "agent/inbox/spliced") {
					const splice = releasedV0Record(previous.data, `agent/inbox/spliced ${previous.seq} data`);
					if (splice["target"] === "next-turn" && Array.isArray(splice["inserted"]) && splice["inserted"].length > 0) {
						openTurn = null;
						nextTurn += 1;
					}
				}
				if (openTurn !== null || data["turn"] !== nextTurn) throw new SessionFormatError(`turn/start ${JSON.stringify(data["turn"])} does not open expected turn ${nextTurn}`);
				openTurn = data["turn"];
				openStep = null;
				toolLifecycles.clear();
				nextStep = 1;
				break;
			}
			case "turn/end":
				if (openTurn !== data["turn"]) throw new SessionFormatError(`turn/end ${JSON.stringify(data["turn"])} has no matching open turn`);
				assertNoUnresolvedTools(toolLifecycles, "turn/end");
				if (openStep !== null) throw new SessionFormatError(`turn/end ${JSON.stringify(data["turn"])} crosses an open step`);
				openTurn = null;
				nextTurn += 1;
				break;
			case "step/start":
				if (openTurn !== data["turn"] || openStep !== null || data["step"] !== nextStep) throw new SessionFormatError(`${event.type} does not match the open turn and next step`);
				openStep = data["step"];
				break;
			case "step/end":
				requireOpenStep(event, data, openTurn, openStep);
				assertNoUnresolvedTools(toolLifecycles, "step/end");
				toolLifecycles.clear();
				openStep = null;
				nextStep += 1;
				break;
			case "assistant/chunk":
				requireOpenStep(event, data, openTurn, openStep);
				break;
			case "assistant/message": {
				requireOpenStep(event, data, openTurn, openStep);
				const content = releasedV0Record(data["message"], `assistant/message ${event.seq} message`)["content"];
				for (const block of content) {
					if (block["type"] !== "tool-call") continue;
					const callId = block["id"];
					if (toolLifecycles.has(callId)) throw new SessionFormatError(`assistant/message repeats advertised tool call ${callId}`);
					toolLifecycles.set(callId, {
						name: block["name"],
						arguments: block["arguments"],
						state: "advertised"
					});
				}
				break;
			}
			case "tool/call": {
				requireOpenStep(event, data, openTurn, openStep);
				const callId = data["callId"];
				const lifecycle = toolLifecycles.get(callId);
				if (lifecycle === void 0 || lifecycle.state !== "advertised" || lifecycle.name !== data["name"] || lifecycle.arguments !== data["arguments"]) throw new SessionFormatError(`tool/call ${callId} does not match one advertised tool call`);
				lifecycle.state = "started";
				break;
			}
			case "tool/result":
				if (event["surfaceOp"] === "append") {
					requireOpenStep(event, data, openTurn, openStep);
					const message = releasedV0Record(data["message"], `tool/result ${event.seq} message`);
					const callId = releasedV0Record(message["source"], `tool/result ${event.seq} source`)["callId"];
					const content = message["content"];
					const error = data["error"] === void 0 ? void 0 : releasedV0Record(data["error"], `tool/result ${event.seq} error`);
					const lifecycle = toolLifecycles.get(callId);
					if (lifecycle === void 0) throw new SessionFormatError(`tool/result ${callId} has no advertised tool lifecycle`);
					if (lifecycle.state === "advertised" && !isExactToolNotStartedRepair(event, content, error)) throw new SessionFormatError(`tool/result ${callId} is not the exact TOOL_NOT_STARTED repair`);
					toolLifecycles.delete(callId);
				} else if (openTurn === null) throw new SessionFormatError("tool/result replacement is outside an open turn");
				break;
			case "request/header":
				if (openTurn === null) throw new SessionFormatError(`${event.type} is outside an open turn`);
				openStepProvider = data["header"]["config"]["provider"];
				break;
			case "request/context":
				if (openTurn === null) throw new SessionFormatError(`${event.type} is outside an open turn`);
				break;
			case "tool/code-dispatch-start":
			case "tool/code-dispatch": {
				if (openTurn === null) throw new SessionFormatError(`${event.type} is outside an open turn`);
				const root = data["rootCallId"];
				const parent = data["parentCallId"];
				const child = data["subCallId"];
				const known = ptcRoots.get(child);
				if (known !== void 0 && known !== root) throw new SessionFormatError(`${event.type} changes its rootCallId`);
				if (parent !== root && ptcRoots.get(parent) !== root) throw new SessionFormatError(`${event.type} parentCallId does not belong to rootCallId`);
				if (event.type === "tool/code-dispatch-start") {
					if (ptcStarts.has(child)) throw new SessionFormatError("tool/code-dispatch-start repeats subCallId");
					ptcStarts.set(child, {
						root,
						parent,
						name: data["name"],
						arguments: data["arguments"],
						settled: false
					});
				} else {
					const start = ptcStarts.get(child);
					if (start === void 0 || start.settled) throw new SessionFormatError("tool/code-dispatch has no unique start");
					if (start.root !== root || start.parent !== parent || start.name !== data["name"] || !deepEqualJson(start.arguments, data["arguments"])) throw new SessionFormatError("tool/code-dispatch does not match its start");
					start.settled = true;
				}
				ptcRoots.set(child, root);
				break;
			}
			case "llm/retry":
				if (openTurn !== data["turn"] || data["step"] !== (openStep ?? nextStep - 1) || openTurn === null) throw new SessionFormatError("llm/retry does not match the current turn and step");
				if (data["provider"] !== openStepProvider) throw new SessionFormatError("llm/retry provider does not match the open request/header");
				assertRetryChain(retries, data);
				retries.push(event);
				break;
			case "llm/retry-started": {
				const scheduled = retries.find((candidate) => {
					const prior = candidate.data;
					return prior["retryId"] === data["retryId"] && prior["retry"] === data["retry"];
				});
				if (scheduled === void 0) throw new SessionFormatError("llm/retry-started pairs no prior scheduled attempt");
				const prior = scheduled.data;
				if (prior["turn"] !== data["turn"] || prior["step"] !== data["step"]) throw new SessionFormatError("llm/retry-started does not match its scheduled turn and step");
				const key = `${JSON.stringify(data["retryId"])}\0${JSON.stringify(data["retry"])}`;
				if (retryStarts.has(key)) throw new SessionFormatError("llm/retry-started repeats one scheduled attempt");
				retryStarts.add(key);
				break;
			}
			case "session/title":
			case "session/title-llm-request":
				assertTitleSources(artifact.events, event, data, extensions.preservedSourceTitleRequestText !== true);
				break;
			case "command/run": {
				const id = data["commandId"];
				if (commandRuns.has(id)) throw new SessionFormatError(`command/run repeats commandId ${id}`);
				commandRuns.add(id);
				break;
			}
			case "command/done": {
				const id = data["commandId"];
				if (!commandRuns.has(id)) throw new SessionFormatError(`command/done ${id} has no prior command/run`);
				const sourceSeq = data["sourceEventSeq"];
				if (sourceSeq !== void 0) {
					const source = artifact.events[sourceSeq];
					if (data["kind"] !== "success" || source?.type === "command/run" || source?.type === "command/done") throw new SessionFormatError(`command/done ${id} has invalid sourceEventSeq`);
				}
				break;
			}
			case "session-log-deepseek/delivery-accepted":
				if ((data["sessionFormatVersion"] ?? 0) === artifact.header.version) {
					if (!(artifact.header.parentSession !== void 0 && event.seq < artifact.inheritedEventCount) && data["sessionId"] !== artifact.header.id) throw new SessionFormatError("current-generation delivery marker names the wrong Session");
				}
				break;
			case "compaction/start":
				if (openCompaction !== void 0) throw new SessionFormatError("compaction/start overlaps an open compaction");
				assertCompactionTurn(data["turn"], openTurn, "compaction/start");
				openCompaction = {
					id: data["compactionId"],
					...data["sourceCommandId"] === void 0 ? {} : { sourceCommandId: data["sourceCommandId"] },
					turn: data["turn"],
					startSeq: event.seq,
					summarized: false
				};
				break;
			case "compaction/summary":
				assertCompactionOwner(openCompaction, data, "compaction/summary");
				assertCompactionTurn(openCompaction?.turn, openTurn, "compaction/summary");
				if (openCompaction?.summarized === true) throw new SessionFormatError("compaction/summary repeats");
				assertCurrentSurfaceSpan(surface, data, "compaction/summary");
				openCompaction = {
					...openCompaction,
					summarized: true
				};
				break;
			case "compaction/end":
				assertCompactionOwner(openCompaction, data, "compaction/end");
				if (data["turn"] !== openCompaction?.turn) throw new SessionFormatError("compaction/end changes its owner turn");
				assertCompactionTurn(openCompaction?.turn, openTurn, "compaction/end");
				if (data["error"] === void 0 && openCompaction?.summarized !== true) throw new SessionFormatError("successful compaction/end requires one summary");
				openCompaction = void 0;
				break;
			case "compaction/prune":
				assertCurrentSurfaceSpan(surface, data, "compaction/prune");
				break;
			case "user/message": {
				const source = releasedV0Record(data["source"], `user/message ${event.seq} source`);
				if (event["surfaceOp"] !== "append" && source["kind"] === "plugin" && source["plugin"] === "compact") assertCompactionOwner(openCompaction, source, `compaction checkpoint at seq ${event.seq}`);
				break;
			}
			case "session/end-seed":
				openCompaction = void 0;
				break;
		}
	}
}
function inheritedOrphanCompactionStarts(events) {
	const stale = /* @__PURE__ */ new Set();
	let open;
	for (const event of events) if (event.type === "compaction/start") open = event.seq;
	else if (event.type === "compaction/end") open = void 0;
	else if (event.type === "session/end-seed") {
		if (open !== void 0) stale.add(open);
		open = void 0;
	}
	return stale;
}
function assertRetryChain(retries, data) {
	const prior = [...retries].reverse().find((candidate) => {
		const value = candidate.data;
		return value["turn"] === data["turn"] && value["step"] === data["step"] && value["provider"] === data["provider"] && value["policyKey"] === data["policyKey"];
	});
	const expected = (prior?.data?.["retry"] ?? 0) + 1;
	if (data["retry"] !== expected) throw new SessionFormatError(`llm/retry must use retry ${expected}`);
	if (prior !== void 0 && prior.data["retryId"] !== data["retryId"]) throw new SessionFormatError("llm/retry must preserve retryId across one policy chain");
	if (prior === void 0 && retries.some((candidate) => candidate.data["retryId"] === data["retryId"])) throw new SessionFormatError(`llm/retry reuses retryId ${JSON.stringify(data["retryId"])} across policy chains`);
}
function requireOpenStep(event, data, openTurn, openStep) {
	if (data["turn"] !== openTurn || data["step"] !== openStep || openTurn === null || openStep === null) throw new SessionFormatError(`${event.type} does not match an open turn and step`);
}
function assertNoUnresolvedTools(lifecycles, boundary) {
	const unresolved = lifecycles.keys().next().value;
	if (unresolved !== void 0) throw new SessionFormatError(`${boundary} leaves unresolved tool call ${unresolved}`);
}
function isExactToolNotStartedRepair(event, content, error) {
	const message = event.data["message"];
	const callId = message["source"]["callId"];
	const block = content[0];
	const repairContent = block?.["content"];
	return error?.["name"] === "ToolNotStartedError" && error["code"] === "TOOL_NOT_STARTED" && event["sourceEventSeqs"] === void 0 && message["id"] === `interrupted-tool-result-${callId}-${event.seq}` && block?.["isError"] === true && repairContent?.length === 1 && repairContent[0]?.["type"] === "text" && repairContent[0]["text"] === "The tool call was interrupted before the Harness recorded it as started. Retry it if it is still needed.";
}
function applySurface(surface, event) {
	const operation = event["surfaceOp"];
	if (operation === void 0) throw new SessionFormatError(`${event.type} requires a surfaceOp marker`);
	if (operation === "append") return [...surface, event.seq];
	const replace = operation;
	const start = surface.indexOf(replace.start);
	const end = surface.indexOf(replace.end);
	if (start < 0 || end < start) throw new SessionFormatError(`${event.type} replacement range is not on the current surface`);
	const shadowed = surface.slice(start, end + 1);
	const sources = new Set(Array.isArray(event["sourceEventSeqs"]) ? event["sourceEventSeqs"] : []);
	if (shadowed.some((seq) => !sources.has(seq))) throw new SessionFormatError(`${event.type} replacement sourceEventSeqs omit a shadowed surface node`);
	return [
		...surface.slice(0, start),
		event.seq,
		...surface.slice(end + 1)
	];
}
function assertTitleSources(events, event, data, validateFramedText) {
	const seqs = data["messageSeqs"];
	if (event.type === "session/title") {
		const titleSource = releasedV0Record(data["source"], `session/title ${event.seq} source`);
		if (seqs.length === 0 !== (titleSource["kind"] === "user")) throw new SessionFormatError(`session/title ${event.seq} messageSeqs must be empty exactly for a user title`);
	}
	const selected = [];
	for (const seq of seqs) {
		const source = events[seq];
		if (source?.type !== "user/message") throw new SessionFormatError(`${event.type} ${event.seq} messageSeqs must cite earlier human user/message events`);
		const sourceData = releasedV0Record(source.data, `${source.type} ${seq} data`);
		if (releasedV0Record(sourceData["source"], `${source.type} ${seq} source`)["kind"] !== "user") throw new SessionFormatError(`${event.type} ${event.seq} messageSeqs must cite earlier human user/message events`);
		const content = sourceData["content"];
		selected.push({
			seq,
			text: content.flatMap((block) => block["type"] === "text" && typeof block["text"] === "string" ? [block["text"]] : []).join("\n")
		});
	}
	if (event.type === "session/title-llm-request") {
		const messages = data["messages"];
		const expected = `Generate the session title from this JSON array of human messages:\n${JSON.stringify(selected)}`;
		const message = messages[0];
		const content = message?.["content"];
		const source = message === void 0 ? void 0 : releasedV0Record(message["source"], "session/title-llm-request message source");
		if (messages.length !== 1 || message?.["role"] !== "user" || content?.length !== 1 || source?.["kind"] !== "plugin" || source["plugin"] !== "dsh-session-title-llm") throw new SessionFormatError("session/title-llm-request messages do not represent messageSeqs");
		const framed = content[0];
		if (framed === void 0 || framed["type"] !== "text" || validateFramedText && framed["text"] !== expected) throw new SessionFormatError("session/title-llm-request messages do not represent messageSeqs");
	}
}
function assertCompactionOwner(open, data, type) {
	if (open === void 0 || data["compactionId"] !== open.id || data["sourceCommandId"] !== open.sourceCommandId) throw new SessionFormatError(`${type} has no matching compaction/start`);
}
function assertCompactionTurn(owner, openTurn, type) {
	if (owner === null ? openTurn !== null : owner !== openTurn) throw new SessionFormatError(`${type} does not match the open turn`);
}
function assertCurrentSurfaceSpan(surface, data, type) {
	const range = data["shadowedRange"];
	const seqs = data["shadowedSeqs"];
	const start = surface.indexOf(range.start);
	const end = surface.indexOf(range.end);
	const expected = start < 0 || end < start ? [] : surface.slice(start, end + 1);
	if (expected.length !== seqs.length || expected.some((seq, index) => seq !== seqs[index])) throw new SessionFormatError(`${type} shadowedSeqs do not name an exact current surface span`);
}
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-session-format-v1-to-v2/lib/index.js
const retained = Object.fromEntries(Object.entries(RELEASED_V0_EVENT_DISPOSITIONS).filter(([type]) => type !== "assistant/chunk" && type !== "assistant/message" && type !== "session-log-deepseek/delivery-accepted" && type !== "session/end-seed"));
/** Exact top-level event and payload-member inventory frozen for released v2. */
const RELEASED_V2_EVENT_DISPOSITIONS = Object.freeze({
	...retained,
	"assistant/attempt": defineReleasedPayloadDisposition([
		"turn",
		"step",
		"stream"
	]),
	"assistant/message": defineReleasedPayloadDisposition([
		"turn",
		"step",
		"message",
		"stream"
	], ["usage", "interrupted"]),
	"session-log-deepseek/delivery-accepted": defineReleasedPayloadDisposition(["sessionId", "throughSeq"], ["sessionFormatVersion"]),
	"session/end-seed": defineReleasedPayloadDisposition([], ["inherited"])
});
Object.freeze(Object.keys(RELEASED_V2_EVENT_DISPOSITIONS).sort((left, right) => left.localeCompare(right, "en")));
const HEADER_REQUIRED$1 = [
	"version",
	"id",
	"createdAt",
	"isSeeded",
	"delegationDepth"
];
const HEADER_OPTIONAL$1 = [
	"cwd",
	"parentSession",
	"origin",
	"agentPreset"
];
const EVENT_REQUIRED$1 = [
	"type",
	"seq",
	"time",
	"data"
];
const SURFACE_TYPES$1 = /* @__PURE__ */ new Set([
	"user/message",
	"assistant/message",
	"tool/result"
]);
const SURFACE_OPTIONAL = [
	"ignorable",
	"sourceEventSeqs",
	"surfaceOp"
];
const LOG_OPTIONAL = ["ignorable"];
const RELEASED_V2_RELATIONSHIP_EXTENSIONS = {
	stepEvents: /* @__PURE__ */ new Set(["assistant/attempt"]),
	preservedSourceTitleRequestText: true
};
/**
* Validate the exact logical header written by released v2.
* @param header - decoded released-v2 Session header.
* @throws {SessionFormatError} when the header is not an exact released-v2 value.
*/
function assertReleasedV2Header(header) {
	const record = releasedV2Record(header, "format v2 header");
	assertReleasedV2Keys(record, HEADER_REQUIRED$1, HEADER_OPTIONAL$1, "format v2 header");
	if (record["version"] !== 2) throw new SessionFormatError("expected format v2 header");
	if (typeof record["id"] !== "string") throw new SessionFormatError("format v2 header id must be a string");
	sessionFormatCount(record["createdAt"], "format v2 header createdAt");
	sessionFormatCount(record["delegationDepth"], "format v2 header delegationDepth");
	if (typeof record["isSeeded"] !== "boolean") throw new SessionFormatError("format v2 header isSeeded must be boolean");
	if (record["cwd"] !== void 0 && (typeof record["cwd"] !== "string" || !isAbsolute(record["cwd"]))) throw new SessionFormatError("format v2 header cwd must be absolute");
	for (const key of ["parentSession", "agentPreset"]) if (record[key] !== void 0 && typeof record[key] !== "string") throw new SessionFormatError(`format v2 header ${key} must be a string`);
	if (record["origin"] !== void 0 && record["origin"] !== "subagent") throw new SessionFormatError("format v2 header origin must be \"subagent\"");
}
function validateReleasedV2Artifact(artifact, mode, knownEventTypes, relationshipHeaderVersion = artifact.header.version) {
	assertReleasedV2Header(artifact.header);
	const cut = sessionFormatCount(artifact.inheritedEventCount, "format v2 inherited event count");
	if (cut > artifact.events.length) throw new SessionFormatError("format v2 inherited event count exceeds its events");
	if (!artifact.header.isSeeded && cut !== 0) throw new SessionFormatError("unseeded format v2 Session has inherited events");
	let lastInheritedMarker;
	for (const [index, event] of artifact.events.entries()) {
		const record = releasedV2Record(event, `format v2 event ${index}`);
		const type = record["type"];
		if (typeof type !== "string") throw new SessionFormatError(`format v2 event ${index} type must be a string`);
		const disposition = RELEASED_V2_EVENT_DISPOSITIONS[type];
		const installed = knownEventTypes?.has(type) === true;
		const ignorableUnknown = disposition === void 0 && record["ignorable"] === true;
		if (mode === "current" && disposition === void 0 && !installed && !ignorableUnknown) throw new SessionFormatUnsupportedMigrationError(`format v2 contains unknown event type ${JSON.stringify(type)} at seq ${index}`);
		const surface = disposition !== void 0 && SURFACE_TYPES$1.has(type);
		assertReleasedV2Keys(record, EVENT_REQUIRED$1, mode === "physical" || disposition === void 0 ? SURFACE_OPTIONAL : surface ? SURFACE_OPTIONAL : LOG_OPTIONAL, `format v2 event ${index}`);
		if (record["seq"] !== index) throw new SessionFormatError(`format v2 event ${index} is not dense`);
		sessionFormatSafeInteger(record["time"], `format v2 event ${index} time`);
		if (record["ignorable"] !== void 0 && record["ignorable"] !== true) throw new SessionFormatError(`format v2 event ${index} ignorable must be true when present`);
		if (type === "session/end-seed") {
			if (releasedV2Record(event.data, `session/end-seed ${index} data`)["inherited"] === true) lastInheritedMarker = index;
		}
	}
	if (artifact.header.isSeeded && lastInheritedMarker !== cut) throw new SessionFormatError("format v2 seeded header disagrees with its last inherited end-seed marker");
	if (!artifact.header.isSeeded && lastInheritedMarker !== void 0) throw new SessionFormatError("format v2 unseeded Session contains an inherited end-seed marker");
	if (mode === "current") assertReleasedArtifactRelationships({
		...artifact,
		header: {
			...artifact.header,
			version: relationshipHeaderVersion
		}
	}, RELEASED_V2_RELATIONSHIP_EXTENSIONS);
}
/**
* Require one released-v2 value to be a JSON object.
* @param value - value to narrow.
* @param label - diagnostic subject.
* @returns the narrowed object.
*/
function releasedV2Record(value, label) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new SessionFormatError(`${label} must be an object`);
	return value;
}
/**
* Require one released-v2 object to contain exactly the admitted keys.
* @param value - object to inspect.
* @param required - keys that must be present.
* @param optional - additional keys that may be present.
* @param label - diagnostic subject.
*/
function assertReleasedV2Keys(value, required, optional, label) {
	const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
	const missing = required.find((key) => !Object.hasOwn(value, key));
	if (missing !== void 0) throw new SessionFormatError(`${label} lacks required field ${missing}`);
	const unexpected = Object.keys(value).find((key) => !allowed.has(key));
	if (unexpected !== void 0) throw new SessionFormatError(`${label} has unexpected field ${unexpected}`);
}
/**
* Restore and validate one decoded released-v2 artifact.
* @param artifact - detached vocabulary-restored artifact.
* @param knownEventTypes - event types understood by the installed current Session package.
* @param relationshipHeaderVersion - logical generation whose version-sensitive relationships are checked.
* @returns the same validated artifact.
*/
function restoreReleasedV2Artifact(artifact, knownEventTypes, relationshipHeaderVersion = artifact.header.version) {
	validateReleasedV2Artifact(artifact, "current", knownEventTypes, relationshipHeaderVersion);
	return artifact;
}
const HEADER_REQUIRED = [
	"type",
	"version",
	"id",
	"createdAt",
	"isSeeded",
	"delegationDepth"
];
const HEADER_OPTIONAL = [
	"cwd",
	"parentSession",
	"origin",
	"agentPreset"
];
const EVENT_REQUIRED = [
	"type",
	"seq",
	"time",
	"data"
];
const EVENT_OPTIONAL = [
	"ignorable",
	"sourceEventSeqs",
	"surfaceOp"
];
const EVENT_KEYS = /* @__PURE__ */ new Set([...EVENT_REQUIRED, ...EVENT_OPTIONAL]);
/** Frozen physical JSON codec for released v2. */
const releasedV2SessionFormatCodec = Object.freeze({
	version: 2,
	decodeHeader(value) {
		return decodePhysicalHeader(value);
	},
	createDecoder(headerValue, recovery) {
		return createDecoder(headerValue, recovery);
	},
	encodeHeader(header, inheritedEventCount) {
		return encodeHeader(header, inheritedEventCount);
	},
	encodeEvent(event) {
		return encodeProvenance(event);
	}
});
function decodePhysicalHeader(value) {
	const record = jsonRecord(snapshotSessionFormatJson(value, "released v2 physical header"), "released v2 physical header");
	exactKeys(record, HEADER_REQUIRED, HEADER_OPTIONAL, "released v2 physical header");
	if (record["type"] !== "session" || record["version"] !== 2) throw new SessionFormatError("expected released v2 physical Session header");
	if (typeof record["id"] !== "string") throw new SessionFormatError("released v2 header id must be a string");
	const createdAt = sessionFormatCount(record["createdAt"], "released v2 header createdAt");
	const delegationDepth = sessionFormatCount(record["delegationDepth"], "released v2 header delegationDepth");
	if (typeof record["isSeeded"] !== "boolean") throw new SessionFormatError("released v2 header isSeeded must be boolean");
	for (const key of [
		"cwd",
		"parentSession",
		"agentPreset"
	]) if (record[key] !== void 0 && typeof record[key] !== "string") throw new SessionFormatError(`released v2 header ${key} must be a string`);
	if (record["origin"] !== void 0 && record["origin"] !== "subagent") throw new SessionFormatError("released v2 header origin must be \"subagent\"");
	const header = snapshotSessionFormatJson({
		version: 2,
		id: record["id"],
		createdAt,
		...record["cwd"] === void 0 ? {} : { cwd: record["cwd"] },
		...record["parentSession"] === void 0 ? {} : { parentSession: record["parentSession"] },
		isSeeded: record["isSeeded"],
		...record["origin"] === void 0 ? {} : { origin: record["origin"] },
		delegationDepth,
		...record["agentPreset"] === void 0 ? {} : { agentPreset: record["agentPreset"] }
	}, "released v2 logical header");
	assertReleasedV2Header(header);
	return header;
}
function createDecoder(headerValue, recovery) {
	const header = decodePhysicalHeader(headerValue);
	let rowIndex = 0;
	let eventCount = 0;
	let inheritedEventCount;
	let issue;
	return {
		header,
		decodeRow(value, context) {
			const currentRow = rowIndex;
			rowIndex += 1;
			let event;
			try {
				event = decodeEvent(value, currentRow);
			} catch (error) {
				const current = error instanceof SessionFormatError ? error : new SessionFormatError(`released v2 row ${currentRow} is malformed`, { cause: error });
				if (recovery === "strict") throw current;
				issue ??= current;
				return;
			}
			if (issue !== void 0) {
				if (event.type === "turn/end") throw issue;
				return;
			}
			if (event.seq !== eventCount) {
				const gap = new SessionFormatError(`released v2 row ${currentRow} has seq gap (expected ${eventCount}, got ${event.seq})`);
				if (recovery === "strict") throw gap;
				issue = gap;
				if (event.type === "turn/end") throw issue;
				return;
			}
			eventCount += 1;
			if (event.type === "session/end-seed") {
				if (jsonRecord(event.data, `session/end-seed ${event.seq} data`)["inherited"] === true) inheritedEventCount = event.seq;
			}
			context.emitEvent(event);
		},
		finish(_context) {
			if (header.isSeeded && inheritedEventCount === void 0) throw new SessionFormatError("released v2 seeded Session lacks an inherited end-seed marker");
			if (!header.isSeeded && inheritedEventCount !== void 0) throw new SessionFormatError("released v2 unseeded Session contains an inherited end-seed marker");
			return inheritedEventCount ?? 0;
		}
	};
}
function decodeEvent(value, rowIndex) {
	const record = jsonRecord(value, `released v2 row ${rowIndex}`);
	const missing = EVENT_REQUIRED.find((key) => !Object.hasOwn(record, key));
	if (missing !== void 0) throw new SessionFormatError(`released v2 row ${rowIndex} lacks required field ${missing}`);
	const unexpected = Object.keys(record).find((key) => !EVENT_KEYS.has(key));
	if (unexpected !== void 0) throw new SessionFormatError(`released v2 row ${rowIndex} has unexpected field ${unexpected}`);
	if (typeof record["type"] !== "string") throw new SessionFormatError(`released v2 row ${rowIndex} type must be a string`);
	sessionFormatSafeInteger(record["time"], `released v2 row ${rowIndex} time`);
	if (record["ignorable"] !== void 0 && record["ignorable"] !== true) throw new SessionFormatError(`released v2 row ${rowIndex} ignorable must be true when present`);
	if (record["sourceEventSeqs"] === void 0) return record;
	const seq = sessionFormatCount(record["seq"], `released v2 row ${rowIndex} seq`);
	return {
		...record,
		sourceEventSeqs: decodeSeqRanges(record["sourceEventSeqs"], seq)
	};
}
function encodeHeader(header, inheritedEventCount) {
	assertReleasedV2Header(header);
	const cut = sessionFormatCount(inheritedEventCount, "format v2 inherited event count");
	if (!header.isSeeded && cut !== 0) throw new SessionFormatError("unseeded format v2 Session has inherited events");
	return {
		type: "session",
		version: 2,
		id: header.id,
		createdAt: header.createdAt,
		...header.cwd === void 0 ? {} : { cwd: header.cwd },
		...header.parentSession === void 0 ? {} : { parentSession: header.parentSession },
		isSeeded: header.isSeeded,
		...header.origin === void 0 ? {} : { origin: header.origin },
		delegationDepth: header.delegationDepth,
		...header.agentPreset === void 0 ? {} : { agentPreset: header.agentPreset }
	};
}
function encodeProvenance(event) {
	if (event.sourceEventSeqs === void 0) return event;
	return {
		...event,
		sourceEventSeqs: encodeSeqRanges(event.sourceEventSeqs)
	};
}
function decodeSeqRanges(value, maxEntries) {
	if (!Array.isArray(value)) throw new SessionFormatError("sourceEventSeqs must be an array");
	const output = [];
	let hasRange = false;
	for (const entry of value) {
		if (!Array.isArray(entry)) {
			output.push(sessionFormatCount(entry, "sourceEventSeqs member"));
			continue;
		}
		if (entry.length !== 2) throw new SessionFormatError("sourceEventSeqs range must be a [start, end] pair");
		const start = sessionFormatCount(entry[0], "sourceEventSeqs range start");
		const end = sessionFormatCount(entry[1], "sourceEventSeqs range end");
		if (start > end || end >= maxEntries || end - start + 1 > maxEntries - output.length) throw new SessionFormatError("sourceEventSeqs range exceeds its event seq");
		for (let current = start; current <= end; current += 1) output.push(current);
		hasRange = true;
	}
	const seen = /* @__PURE__ */ new Set();
	for (const source of output) {
		if (source >= maxEntries || seen.has(source)) throw new SessionFormatError("sourceEventSeqs ranges must contain unique earlier seqs");
		seen.add(source);
	}
	if (hasRange && output.some((source, index) => index > 0 && source <= output[index - 1])) throw new SessionFormatError("sourceEventSeqs ranges must be strictly increasing");
	return output;
}
function encodeSeqRanges(values) {
	if (values.some((value, index) => index > 0 && value <= values[index - 1])) return [...values];
	const output = [];
	for (let index = 0; index < values.length;) {
		const start = values[index];
		let end = start;
		while (index + 1 < values.length && values[index + 1] === end + 1) {
			index += 1;
			end += 1;
		}
		output.push(end - start >= 2 ? [start, end] : start);
		if (end - start === 1) output.push(end);
		index += 1;
	}
	return output;
}
function jsonRecord(value, label) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new SessionFormatError(`${label} must be an object`);
	return value;
}
function exactKeys(record, required, optional, label) {
	const allowed = /* @__PURE__ */ new Set([...required, ...optional]);
	const missing = required.find((key) => !Object.hasOwn(record, key));
	if (missing !== void 0) throw new SessionFormatError(`${label} lacks ${missing}`);
	const unexpected = Object.keys(record).find((key) => !allowed.has(key));
	if (unexpected !== void 0) throw new SessionFormatError(`${label} has unexpected field ${unexpected}`);
}
const CHUNK_EVENT_REQUIRED = [
	"type",
	"seq",
	"time",
	"data"
];
const CHUNK_EVENT_OPTIONAL = [
	"ignorable",
	"sourceEventSeqs",
	"surfaceOp"
];
const CHUNK_EVENT_KEYS = /* @__PURE__ */ new Set([...CHUNK_EVENT_REQUIRED, ...CHUNK_EVENT_OPTIONAL]);
/** Adjacent migration that embeds released-v1 top-level Assistant chunks into v2 attempt events. */
const sessionFormatV1ToV2 = defineSessionFormatMigration({
	name: "@deepseek-ai/dsh-session-format-v1-to-v2",
	fromVersion: 1,
	toVersion: 2,
	migrateHeader(header) {
		assertReleasedV1Header(header);
		return {
			...header,
			version: 2
		};
	},
	createStage(input) {
		return input.sourceKind === "decoded" ? new DecodedReleasedV1ToV2Stage(input) : new TransformedReleasedV1ToV2Stage(input);
	},
	validateTargetHeader: assertReleasedV2Header
});
var TransformedReleasedV1ToV2Stage = class {
	state;
	constructor(input) {
		assertReleasedV1Header(input.sourceHeader);
		this.state = {
			sourceHeader: input.sourceHeader,
			sourceCut: sessionFormatCount(input.sourceInheritedEventCount, "format v1 inherited event count"),
			mapping: /* @__PURE__ */ new Map(),
			legacyTurns: legacyTurnState(),
			pending: void 0,
			targetSeq: 0,
			targetCut: input.sourceHeader.isSeeded ? void 0 : 0,
			lastTime: input.sourceHeader.createdAt
		};
	}
	transformEvent(event, context) {
		transformReleasedEvent(this.state, event, context);
	}
	transformRun(run, context) {
		transformReleasedRun(this.state, run, context);
	}
	finish(context) {
		return finishMigration(this.state, context);
	}
};
var DecodedReleasedV1ToV2Stage = class extends TransformedReleasedV1ToV2Stage {
	transformEvent(event, context) {
		if (event.type !== "assistant/chunk" && RELEASED_V0_EVENT_DISPOSITIONS[event.type] !== void 0) assertReleasedEventPayload(event, 1);
		super.transformEvent(event, context);
	}
};
function transformReleasedEvent(state, event, context) {
	if (event.type === "assistant/chunk") assertChunkEnvelope(event);
	if (RELEASED_V0_EVENT_DISPOSITIONS[event.type] === void 0) throw refusal(`format v1 contains unknown event type ${JSON.stringify(event.type)} at seq ${event.seq}`);
	const interrupted = legacyInterruptedTurn(state.legacyTurns, event);
	if (event.type === "turn/start" && state.legacyTurns.openTurn !== null && interrupted === void 0) throw refusal(`turn/start ${JSON.stringify(record$1(event.data)["turn"])} does not close the prior turn`);
	assertSourceDeliveryMarker(state, event);
	observeLegacyTurn(state.legacyTurns, event);
	state.lastTime = event.time;
	if (interrupted !== void 0) {
		finishAttempt(state, context);
		emitGenerated(state, event.seq, interrupted, context);
	}
	const legacyGoal = splitLegacyGoalChange(event);
	if (legacyGoal !== void 0) {
		emitGenerated(state, event.seq, legacyGoal.change, context);
		emitSource(state, legacyGoal.message, context);
		return;
	}
	if (event.type === "assistant/chunk") {
		transformChunk(state, event, context);
		return;
	}
	if (event.type === "assistant/message") {
		transformMessage(state, event, context);
		return;
	}
	if (closesAttempt(event)) {
		finishAttempt(state, context);
		emitSource(state, event, context);
		return;
	}
	if (state.pending !== void 0) {
		state.pending.afterLastChunk.push(event);
		return;
	}
	emitSource(state, event, context);
}
function assertChunkEnvelope(event) {
	const unexpected = Object.keys(event).find((key) => !CHUNK_EVENT_KEYS.has(key));
	if (unexpected !== void 0) throw refusal(`assistant/chunk ${event.seq} has unexpected member ${unexpected}`);
	const missing = CHUNK_EVENT_REQUIRED.find((key) => !Object.hasOwn(event, key));
	if (missing !== void 0) throw refusal(`assistant/chunk ${event.seq} lacks required member ${missing}`);
	if (event.ignorable !== void 0 && event.ignorable !== true) throw refusal(`assistant/chunk ${event.seq} ignorable must be true when present`);
}
function assertSourceDeliveryMarker(state, event) {
	if (event.type !== "session-log-deepseek/delivery-accepted") return;
	const data = record$1(event.data);
	const inherited = state.sourceHeader.parentSession !== void 0 && event.seq < state.sourceCut;
	if (data["sessionFormatVersion"] === 1 && !inherited && data["sessionId"] !== state.sourceHeader.id) throw refusal("current-generation delivery marker names the wrong Session");
}
function transformReleasedRun(state, run, context) {
	if (!isReleasedAssistantChunkRun(run)) {
		for (const event of run.expand()) transformReleasedEvent(state, event, context);
		return;
	}
	state.legacyTurns.previous = void 0;
	state.lastTime = run.lastTime;
	if (state.pending !== void 0 && (state.pending.group.terminal || state.pending.group.turn !== run.turn || state.pending.group.step !== run.step)) finishAttempt(state, context);
	else if (state.pending !== void 0) flushBuffered(state, state.pending, context);
	state.pending ??= {
		group: attemptGroup(run.turn, run.step),
		afterLastChunk: []
	};
	assertAttemptRange(state, run.firstSeq, run.lastSeq);
	flushAccumulator(state.pending.group);
	appendStreamRecord(state.pending.group, run.stream, run.lastTime);
	recordChunkSpan(state.pending.group, run.firstSeq, run.eventCount, run.lastTime);
}
function finishMigration(state, context) {
	finishAttempt(state, context);
	if (state.sourceHeader.isSeeded && state.targetCut === void 0) {
		state.targetCut = state.targetSeq;
		context.emitEvent({
			type: "session/end-seed",
			seq: state.targetSeq,
			time: state.lastTime,
			data: { inherited: true }
		});
		state.targetSeq += 1;
	}
	return state.targetCut;
}
function transformChunk(state, event, context) {
	const data = record$1(event.data);
	const turn = coordinate(data["turn"]);
	const step = coordinate(data["step"]);
	const chunk = record$1(data["chunk"]);
	if (state.pending !== void 0 && (state.pending.group.terminal || state.pending.group.turn !== turn || state.pending.group.step !== step)) finishAttempt(state, context);
	else if (state.pending !== void 0) flushBuffered(state, state.pending, context);
	state.pending ??= {
		group: attemptGroup(turn, step),
		afterLastChunk: []
	};
	assertAttemptCut(state, state.pending.group, event.seq);
	state.pending.group.accumulator ??= new AssistantStreamAccumulator();
	state.pending.group.accumulator.push({
		time: event.time,
		chunk: data["chunk"]
	});
	recordChunkSpan(state.pending.group, event.seq, 1, event.time);
	if (chunk["type"] === "finish") state.pending.group.terminal = true;
}
function transformMessage(state, event, context) {
	const data = record$1(event.data);
	const turn = coordinate(data["turn"]);
	const step = coordinate(data["step"]);
	const sources = event.sourceEventSeqs;
	const pending = state.pending;
	if (pending !== void 0 && (pending.group.turn !== turn || pending.group.step !== step)) {
		finishAttempt(state, context);
		emitSource(state, messageEvent(event, attemptGroup(turn, step)), context);
		return;
	}
	if (!Array.isArray(sources)) {
		if (pending !== void 0) throw refusal(`assistant/message ${event.seq} does not cite its complete v1 chunk attempt`);
		emitSource(state, messageEvent(event, attemptGroup(turn, step)), context);
		return;
	}
	if (sources.length === 0) {
		finishAttempt(state, context);
		emitSource(state, messageEvent(event, attemptGroup(turn, step)), context);
		return;
	}
	if (pending === void 0 || !matchesChunkSources(pending.group, sources)) throw refusal(`assistant/message ${event.seq} chunk provenance is not one complete ordered attempt`);
	assertAttemptCut(state, pending.group, event.seq);
	pending.group.terminal = true;
	flushBuffered(state, pending, context);
	emitSource(state, messageEvent(event, pending.group), context);
	state.pending = void 0;
}
function finishAttempt(state, context) {
	const pending = state.pending;
	if (pending === void 0) return;
	emitGenerated(state, pending.group.lastChunkSeq, attemptEvent(pending.group), context);
	flushBuffered(state, pending, context);
	state.pending = void 0;
}
function flushBuffered(state, pending, context) {
	for (const event of pending.afterLastChunk) emitSource(state, event, context);
	pending.afterLastChunk.length = 0;
}
function emitSource(state, event, context) {
	let source = event;
	if (state.sourceHeader.isSeeded && event.seq === state.sourceCut && event.type === "session/end-seed") source = {
		...event,
		data: { inherited: true }
	};
	ensureTargetCut(state, event.seq, event.time, source.type, context);
	state.mapping.set(event.seq, state.targetSeq);
	context.emitEvent(remapReferences(source, state.targetSeq, state.mapping));
	state.targetSeq += 1;
}
function emitGenerated(state, origin, event, context) {
	ensureTargetCut(state, origin, event.time, event.type, context);
	context.emitEvent(remapReferences(event, state.targetSeq, state.mapping));
	state.targetSeq += 1;
}
function ensureTargetCut(state, origin, time, type, context) {
	if (!state.sourceHeader.isSeeded || state.targetCut !== void 0 || origin < state.sourceCut) return;
	state.targetCut = state.targetSeq;
	if (origin === state.sourceCut && type === "session/end-seed") return;
	context.emitEvent({
		type: "session/end-seed",
		seq: state.targetSeq,
		time,
		data: { inherited: true }
	});
	state.targetSeq += 1;
}
function assertAttemptCut(state, group, member) {
	if ((group.spans[0]?.firstSeq ?? member) < state.sourceCut !== member < state.sourceCut) throw refusal(`inherited Session cut ${state.sourceCut} splits one Assistant attempt`);
}
function assertAttemptRange(state, first, last) {
	if (first < state.sourceCut !== last < state.sourceCut) throw refusal(`inherited Session cut ${state.sourceCut} splits one Assistant attempt`);
}
function legacyTurnState() {
	return {
		openTurn: null,
		openStep: null,
		previous: void 0
	};
}
function legacyInterruptedTurn(state, event) {
	if (event.type !== "turn/start" || state.openTurn === null || state.openStep !== null || coordinate(record$1(event.data)["turn"]) !== state.openTurn + 1 || state.previous?.type !== "agent/inbox/spliced") return void 0;
	const splice = record$1(state.previous.data);
	if (splice["target"] !== "next-turn" || !Array.isArray(splice["inserted"]) || splice["inserted"].length === 0) return;
	return {
		type: "turn/end",
		seq: event.seq,
		time: event.time,
		data: {
			turn: state.openTurn,
			reason: { kind: "interrupted" }
		}
	};
}
function observeLegacyTurn(state, event) {
	const data = record$1(event.data);
	if (event.type === "turn/start") {
		state.openTurn = coordinate(data["turn"]);
		state.openStep = null;
	} else if (event.type === "turn/end") {
		state.openTurn = null;
		state.openStep = null;
	} else if (event.type === "step/start") state.openStep = coordinate(data["step"]);
	else if (event.type === "step/end") state.openStep = null;
	state.previous = event;
}
function splitLegacyGoalChange(event) {
	if (event.type !== "user/message") return void 0;
	const data = record$1(event.data);
	const source = record$1(data["source"]);
	if (source["kind"] !== "goal" || source["change"] === void 0) return void 0;
	return {
		change: {
			type: "goal/change",
			seq: event.seq,
			time: event.time,
			data: source["change"]
		},
		message: {
			...event,
			data: {
				...data,
				source: {
					kind: "plugin",
					plugin: "goal"
				}
			}
		}
	};
}
function closesAttempt(event) {
	return event.type === "turn/end" || event.type === "step/end" || event.type === "llm/retry" || event.type === "llm/retry-started";
}
function attemptGroup(turn, step) {
	return {
		turn,
		step,
		spans: [],
		stream: [],
		chunkCount: 0,
		terminal: false
	};
}
function recordChunkSpan(group, firstSeq, eventCount, lastTime) {
	const previous = group.spans.at(-1);
	if (previous !== void 0 && previous.firstSeq + previous.eventCount === firstSeq) previous.eventCount += eventCount;
	else group.spans.push({
		firstSeq,
		eventCount
	});
	group.chunkCount += eventCount;
	group.lastChunkSeq = firstSeq + eventCount - 1;
	group.lastChunkTime = lastTime;
}
function matchesChunkSources(group, sources) {
	if (sources.length !== group.chunkCount) return false;
	let index = 0;
	for (const span of group.spans) for (let offset = 0; offset < span.eventCount; offset += 1) {
		if (sources[index] !== span.firstSeq + offset) return false;
		index += 1;
	}
	return true;
}
function recordLastTime(record) {
	if (record.type === "chunk") return record.time;
	return record.dt.reduce((time, gap) => time + gap, record.time0);
}
function mutableRecord(record) {
	if (record.type === "chunk") return record;
	if (record.type === "tool-call-chunks") return {
		...record,
		dt: [...record.dt],
		args: [...record.args]
	};
	return {
		...record,
		dt: [...record.dt],
		texts: [...record.texts]
	};
}
function appendStreamRecord(group, source, lastTime, owned = true) {
	const previous = group.stream.at(-1);
	if (previous === void 0 || source.type === "chunk" || previous.record.type !== source.type) {
		group.stream.push({
			record: owned ? source : mutableRecord(source),
			lastTime
		});
		return;
	}
	const gap = source.time0 - previous.lastTime;
	if (previous.record.index !== source.index || !Number.isSafeInteger(gap)) {
		group.stream.push({
			record: owned ? source : mutableRecord(source),
			lastTime
		});
		return;
	}
	if (source.type === "tool-call-chunks") {
		const target = previous.record;
		if (target.id !== source.id || target.name !== source.name) {
			group.stream.push({
				record: owned ? source : mutableRecord(source),
				lastTime
			});
			return;
		}
		target.dt.push(gap);
		for (const value of source.dt) target.dt.push(value);
		for (const value of source.args) target.args.push(value);
	} else {
		const target = previous.record;
		target.dt.push(gap);
		for (const value of source.dt) target.dt.push(value);
		for (const value of source.texts) target.texts.push(value);
	}
	previous.lastTime = lastTime;
}
function flushAccumulator(group) {
	const accumulator = group.accumulator;
	if (accumulator === void 0) return;
	for (const record of accumulator.snapshot()) appendStreamRecord(group, record, recordLastTime(record), false);
	delete group.accumulator;
}
function streamOf(group) {
	flushAccumulator(group);
	return group.stream.map(({ record }) => record);
}
function messageEvent(source, group) {
	const data = record$1(source.data);
	const { sourceEventSeqs: _sourceEventSeqs, ...event } = source;
	return {
		...event,
		data: {
			...data,
			stream: streamOf(group)
		}
	};
}
function attemptEvent(group) {
	return {
		type: "assistant/attempt",
		seq: group.lastChunkSeq,
		time: group.lastChunkTime,
		data: {
			turn: group.turn,
			step: group.step,
			stream: streamOf(group)
		}
	};
}
function remapReferences(source, targetSeq, mapping) {
	const { sourceEventSeqs, surfaceOp, ...event } = source;
	const sources = sourceEventSeqs === void 0 ? {} : { sourceEventSeqs: mapList(numberArray(sourceEventSeqs), mapping, `${source.type} ${source.seq} sources`) };
	let operation = surfaceOp;
	if (surfaceOp !== void 0 && surfaceOp !== "append") {
		const replacement = record$1(surfaceOp);
		operation = {
			op: "replace",
			start: mapOne(coordinate(replacement["start"]), mapping, `${source.type} ${source.seq} surface start`),
			end: mapOne(coordinate(replacement["end"]), mapping, `${source.type} ${source.seq} surface end`)
		};
	}
	return {
		...event,
		seq: targetSeq,
		data: remapPayloadReferences(source, mapping),
		...sources,
		...operation === void 0 ? {} : { surfaceOp: operation }
	};
}
function remapPayloadReferences(event, mapping) {
	const data = record$1(event.data);
	switch (event.type) {
		case "command/done": return data["sourceEventSeq"] === void 0 ? data : {
			...data,
			sourceEventSeq: mapOne(coordinate(data["sourceEventSeq"]), mapping, `command/done ${event.seq} sourceEventSeq`)
		};
		case "compaction/prune":
		case "compaction/summary": {
			const range = record$1(data["shadowedRange"]);
			return {
				...data,
				shadowedRange: {
					start: mapOne(coordinate(range["start"]), mapping, `${event.type} ${event.seq} shadowedRange start`),
					end: mapOne(coordinate(range["end"]), mapping, `${event.type} ${event.seq} shadowedRange end`)
				},
				shadowedSeqs: mapList(numberArray(data["shadowedSeqs"]), mapping, `${event.type} ${event.seq} shadowedSeqs`)
			};
		}
		case "session/title":
		case "session/title-llm-request": return {
			...data,
			messageSeqs: mapList(numberArray(data["messageSeqs"]), mapping, `${event.type} ${event.seq} messageSeqs`)
		};
		default: return data;
	}
}
function mapList(values, mapping, label) {
	return values.map((value) => mapOne(value, mapping, label));
}
function mapOne(value, mapping, label) {
	const mapped = mapping.get(value);
	if (mapped === void 0) throw refusal(`${label} targets consumed assistant/chunk ${value}`);
	return mapped;
}
function record$1(value) {
	return value;
}
function numberArray(value) {
	return value;
}
function coordinate(value) {
	return value;
}
function refusal(message) {
	return new SessionFormatUnsupportedMigrationError(message);
}
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-session-format-v2-to-v3/lib/index.js
/** Audited V2 migration admission and V3 payload validation, independent of installed core Session types. */
/** Audited surface event names; all other admitted events are log-only. */
const SURFACE_TYPES = /* @__PURE__ */ new Set([
	"system/message",
	"user/message",
	"assistant/message",
	"tool/result"
]);
const SOURCE_KINDS = /* @__PURE__ */ new Set([
	"user",
	"plugin",
	"model",
	"tool",
	"agent-instructions",
	"session-reference",
	"team-message",
	"goal",
	"skill-invocation",
	"skill-catalog",
	"coordinator",
	"subagent-report",
	"subagent-settled",
	"webhook",
	"agent-message"
]);
/**
* Require a JSON object at the durable input boundary.
* @param value - decoded value.
* @param label - diagnostic subject.
* @returns the narrowed object.
*/
function record(value, label) {
	if (!isSessionFormatJsonObject(value)) throw new SessionFormatError(label + " must be an object");
	return value;
}
/**
* Reject missing and unaudited members rather than guessing whether they contain coordinates.
* @param value - decoded record.
* @param required - required member names.
* @param optional - additional admitted names.
* @param label - diagnostic subject.
*/
function keys(value, required, optional, label) {
	const missing = required.find((key) => !Object.hasOwn(value, key));
	const unexpected = Object.keys(value).find((key) => !required.includes(key) && !optional.includes(key));
	if (missing !== void 0) throw new SessionFormatError(label + " lacks required field " + missing);
	if (unexpected !== void 0) throw new SessionFormatError(label + " has unexpected field " + unexpected);
}
/**
* Validate classified payloads before migration, or native V3 system/header payloads.
* @param event - decoded logical event.
* @param version - source or target generation.
*/
function assertEvent(event, version) {
	if (version === 3) {
		assertV3Event(event);
		return;
	}
	const disposition = RELEASED_V2_EVENT_DISPOSITIONS[event.type];
	const feedback = event.type === "feedback/message-put" || event.type === "feedback/message-delete";
	if (disposition === void 0 && !feedback) throw new SessionFormatUnsupportedMigrationError("format v2 to v3 cannot safely transform unclassified event " + event.type);
	const surface = SURFACE_TYPES.has(event.type);
	keys(event, [
		"type",
		"seq",
		"time",
		"data"
	], surface ? [
		"ignorable",
		"sourceEventSeqs",
		"surfaceOp"
	] : ["ignorable"], event.type);
	sessionFormatCount(event.seq, "event seq");
	sessionFormatSafeInteger(event.time, "event time");
	if (event["ignorable"] !== void 0 && event["ignorable"] !== true) throw new SessionFormatError("ignorable must be true");
	if (surface) {
		assertReleasedSurfaceMetadata(event, event.seq, event.type, "forbid-assistant");
		if (event["surfaceOp"] === void 0) throw new SessionFormatError(event.type + " requires surfaceOp");
	}
	const data = record(event.data, event.type + " data");
	if (feedback) {
		assertFeedback(event.type, data);
		return;
	}
	const admitted = disposition;
	keys(data, admitted.required, admitted.optional, event.type + " data");
	assertOwnedContent(event, data);
	if (event.type !== "assistant/attempt") assertReleasedPayloadSemantics(event, version);
	if (event.type === "assistant/message" || event.type === "assistant/attempt") {
		for (const coordinate of ["turn", "step"]) if (sessionFormatCount(data[coordinate], coordinate) === 0) throw new SessionFormatError(coordinate + " must be positive");
	}
	if (event.type === "session/end-seed" && data["inherited"] !== void 0 && data["inherited"] !== true) throw new SessionFormatError("session/end-seed inherited must be true");
	if (event.type === "user/message") assertSource(data);
	if (event.type === "assistant/message" || event.type === "tool/result") assertSource(record(data["message"], "message"));
	if (event.type === "tool/result" && isSessionFormatJsonObject(data["error"]) && data["error"]["code"] === "TOOL_NOT_STARTED") {
		const message = record(data["message"], "tool result message");
		const source = record(message["source"], "tool result source");
		if (!isRepairIdentity(message["id"], source["callId"])) throw new SessionFormatError("TOOL_NOT_STARTED repair requires its canonical historical message id");
	}
	if (event.type === "agent/inbox/spliced" || event.type === "session/title-llm-request") {
		const messages = data[event.type === "agent/inbox/spliced" ? "inserted" : "messages"];
		for (const message of messages) assertSource(message);
	}
}
/**
* Recognize stable generated repair IDs without interpreting their historical suffix as a current coordinate.
* @param id - durable message identity.
* @param callId - advertised tool identity.
* @returns whether the identity has the canonical historical repair form.
*/
function isRepairIdentity(id, callId) {
	if (typeof callId !== "string") return false;
	const prefix = "interrupted-tool-result-" + callId + "-";
	if (typeof id !== "string" || !id.startsWith(prefix)) return false;
	const suffix = id.slice(prefix.length);
	return /^(0|[1-9]\d*)$/.test(suffix) && Number.isSafeInteger(Number(suffix));
}
function assertSource(message) {
	const source = record(message["source"], "message source");
	if (typeof source["kind"] !== "string" || !SOURCE_KINDS.has(source["kind"])) throw new SessionFormatUnsupportedMigrationError("cannot safely transform unclassified message source");
	if (source["kind"] === "agent-message") {
		keys(source, [
			"kind",
			"form",
			"senderSessionId"
		], [], "agent-message source");
		if (source["form"] !== "relay" || typeof source["senderSessionId"] !== "string" || source["senderSessionId"].length === 0) throw new SessionFormatError("agent-message source requires relay form and senderSessionId");
	}
}
const CONTENT_KINDS = /* @__PURE__ */ new Set([
	"text",
	"reasoning",
	"image",
	"file",
	"tool-call",
	"tool-result"
]);
function contentArray(value, label) {
	if (!Array.isArray(value)) throw new SessionFormatError(label + ": content must be an array");
	return value;
}
function assertOwnedContent(event, data) {
	const label = "format v2 " + event.type + " at seq " + String(event.seq) + " data";
	switch (event.type) {
		case "user/message":
		case "tool/code-dispatch":
			assertContentKinds(data["content"], label + ".content");
			break;
		case "assistant/message":
		case "tool/result":
		case "team/message/queued":
			assertContentKinds(record(data["message"], label + ".message")["content"], label + ".message.content");
			break;
		case "agent/inbox/spliced":
		case "session/title-llm-request": {
			const field = event.type === "agent/inbox/spliced" ? "inserted" : "messages";
			for (const [index, value] of contentArray(data[field], label + "." + field).entries()) {
				const path = label + "." + field + "[" + String(index) + "]";
				assertContentKinds(record(value, path)["content"], path + ".content");
			}
			break;
		}
		case "compaction/summary":
			assertContentKinds(data["summary"], label + ".summary");
			if (data["rawOutput"] !== void 0) assertContentKinds(data["rawOutput"], label + ".rawOutput");
			break;
	}
	if (event.type === "assistant/message" || event.type === "assistant/attempt") for (const [index, value] of contentArray(data["stream"], label + ".stream").entries()) {
		const path = label + ".stream[" + String(index) + "]";
		const entry = record(value, path);
		if (entry["type"] !== "chunk") continue;
		const chunk = record(entry["chunk"], path + ".chunk");
		if (chunk["type"] === "block-end") assertContentBlock(chunk["block"], path + ".chunk.block");
		if (chunk["type"] === "block-start") assertContentKind(chunk["blockType"], path + ".chunk.blockType");
	}
}
function assertContentKind(kind, label) {
	if (typeof kind !== "string" || !CONTENT_KINDS.has(kind)) throw new SessionFormatUnsupportedMigrationError(label + ": cannot safely transform unclassified message content kind " + JSON.stringify(kind));
}
function assertContentKinds(content, label) {
	for (const [index, value] of contentArray(content, label).entries()) assertContentBlock(value, label + "[" + String(index) + "]");
}
function assertContentBlock(value, label) {
	const block = record(value, label);
	assertContentKind(block["type"], label);
	if (block["type"] === "tool-result") {
		if (!Array.isArray(block["content"])) throw new SessionFormatError(label + ".content: invalid message content kind \"tool-result\": content must be an array");
		assertContentKinds(block["content"], label + ".content");
	}
	if (block["type"] === "file") {
		keys(block, ["type", "attachment"], [], label + " kind \"file\"");
		const attachment = record(block["attachment"], label + " kind \"file\" attachment");
		keys(attachment, [
			"attachmentId",
			"name",
			"bytes"
		], [], label + " kind \"file\" attachment");
		if (typeof attachment["attachmentId"] !== "string" || attachment["attachmentId"].length === 0 || typeof attachment["name"] !== "string") throw new SessionFormatError(label + " kind \"file\": file attachment requires attachmentId and name");
		sessionFormatCount(attachment["bytes"], label + " kind \"file\" attachment bytes");
		return;
	}
	const probe = {
		type: "user/message",
		seq: 0,
		time: 0,
		data: {
			id: "content-admission",
			role: "user",
			source: { kind: "user" },
			content: [block["type"] === "tool-result" ? {
				...block,
				content: []
			} : block]
		}
	};
	try {
		assertReleasedPayloadSemantics(probe, 2);
	} catch (error) {
		throw new SessionFormatError(label + ": invalid message content kind " + JSON.stringify(block["type"]) + ": " + String(error));
	}
}
/**
* Reject V3 structural payload violations even beyond a recoverable physical-row failure.
* @param value - raw physical row; ordinary rows retain the frozen decoder's recovery policy.
*/
function assertV3StructuralRow(value) {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return;
	const row = value;
	if (row["type"] === "request/header") {
		const data = record(row["data"], "request/header data");
		if (Object.hasOwn(record(data["header"], "request header"), "system")) throw new SessionFormatUnsupportedMigrationError("format v3 request/header rejects retired header.system");
	} else if (row["type"] === "system/message") {
		const data = record(row["data"], "system/message data");
		assertSystem({
			type: "system/message",
			seq: 0,
			time: 0,
			data
		}, data);
	}
}
function assertSystem(event, data) {
	keys(data, [
		"turn",
		"step",
		"message"
	], [], "system/message data");
	for (const coordinate of ["turn", "step"]) if (sessionFormatCount(data[coordinate], coordinate) === 0) throw new SessionFormatError(coordinate + " must be positive");
	const message = record(data["message"], "system message");
	keys(message, [
		"id",
		"role",
		"source",
		"content"
	], [], "system message");
	if (typeof message["id"] !== "string" || message["id"].length === 0 || message["role"] !== "system") throw new SessionFormatError("system message requires an id and system role");
	const source = record(message["source"], "system source");
	if (source["kind"] !== "plugin" || typeof source["plugin"] !== "string" || source["plugin"].length === 0) throw new SessionFormatError("system message requires plugin source");
	assertReleasedPayloadSemantics({
		...event,
		type: "user/message",
		data: {
			...message,
			role: "user"
		}
	}, 3);
}
function assertFeedback(type, data) {
	keys(data, type === "feedback/message-put" ? ["sessionId", "item"] : ["sessionId", "messageId"], [], type);
	if (typeof data["sessionId"] !== "string") throw new SessionFormatError("feedback sessionId must be a string");
	if (type === "feedback/message-delete") {
		if (typeof data["messageId"] !== "string") throw new SessionFormatError("feedback messageId must be a string");
		return;
	}
	const item = record(data["item"], "feedback item");
	keys(item, [
		"messageId",
		"rating",
		"version",
		"createdAt",
		"updatedAt"
	], ["note"], "feedback item");
	for (const key of ["messageId", "version"]) if (typeof item[key] !== "string") throw new SessionFormatError("feedback " + key + " must be a string");
	if (item["rating"] !== "positive" && item["rating"] !== "negative") throw new SessionFormatError("invalid feedback rating");
	if (item["note"] !== void 0 && typeof item["note"] !== "string") throw new SessionFormatError("feedback note must be a string");
	sessionFormatCount(item["createdAt"], "feedback createdAt");
	sessionFormatCount(item["updatedAt"], "feedback updatedAt");
}
/**
* Validate one canonical V3 event without interpreting plugin-owned payloads or log relationships.
* Unclassified metadata is deferred to vocabulary-aware restoration; unknown required types must not become recoverable corruption.
* @param event - decoded logical event.
* @param knownEventTypes - additional installed event types whose envelopes are interpreted.
*/
function assertV3Event(event, knownEventTypes) {
	const value = record(event, "format v3 event");
	const subject = `format v3 ${event.type} at seq ${event.seq}`;
	const opaque = !(!(event.type === "tool/code-dispatch-start" || event.type === "tool/code-dispatch") && (SURFACE_TYPES.has(event.type) || RELEASED_V2_EVENT_DISPOSITIONS[event.type] !== void 0 || event.type === "tool/ptc-dispatch-start" || event.type === "tool/ptc-dispatch" || event.type === "feedback/message-put" || event.type === "feedback/message-delete" || knownEventTypes?.has(event.type) === true));
	keys(value, [
		"type",
		"seq",
		"time",
		"data"
	], SURFACE_TYPES.has(event.type) || opaque ? [
		"ignorable",
		"surfaceOp",
		"sourceEventSeqs"
	] : ["ignorable"], subject);
	if (typeof event.type !== "string") throw new SessionFormatError(`${subject} type must be a string`);
	sessionFormatCount(event.seq, `${subject} seq`);
	sessionFormatSafeInteger(event.time, `${subject} time`);
	if (Object.hasOwn(value, "ignorable") && value["ignorable"] !== true) throw new SessionFormatError(`${subject} ignorable must be true when present`);
	if (SURFACE_TYPES.has(event.type)) {
		const operation = value["surfaceOp"];
		if (operation === void 0) throw new SessionFormatError(`${subject} requires a surfaceOp marker`);
		if (operation !== "append") {
			const replace = record(operation, `${subject} surfaceOp`);
			if (Object.keys(replace).length !== 3 || replace["op"] !== "replace" || !Object.hasOwn(replace, "startSeq") || !Object.hasOwn(replace, "endSeq")) throw new SessionFormatError(`${subject} requires exact replace fields op/startSeq/endSeq`);
			for (const key of ["startSeq", "endSeq"]) if (sessionFormatCount(replace[key], `${subject} surfaceOp ${key}`) >= event.seq) throw new SessionFormatError(`${subject} replacement endpoints must reference earlier events`);
		}
		const sources = value["sourceEventSeqs"];
		if (event.type === "assistant/message" && sources !== void 0) throw new SessionFormatError(`${subject} embeds its stream and cannot carry sourceEventSeqs`);
		if (sources !== void 0) {
			if (!Array.isArray(sources) || sources.length === 0) throw new SessionFormatError(`${subject} sourceEventSeqs must be a non-empty array`);
			const seen = /* @__PURE__ */ new Set();
			for (const source of sources) {
				const seq = sessionFormatCount(source, `${subject} sourceEventSeqs member`);
				if (seq >= event.seq || seen.has(seq)) throw new SessionFormatError(`${subject} sourceEventSeqs must be unique earlier seqs`);
				seen.add(seq);
			}
		}
	}
	assertV3StructuralRow(event);
	assertCanonicalPayload(event);
}
function assertCanonicalPayload(event) {
	const subject = `format v3 ${event.type} at seq ${event.seq}`;
	if (event.type === "request/header") {
		const header = record(record(event.data, `${subject} data`)["header"], `${subject} header`);
		if (Array.isArray(header["tools"]) && header["tools"].length === 0 || isSessionFormatJsonObject(header["adapterDefaults"]) && Object.keys(header["adapterDefaults"]).length === 0) throw new SessionFormatError(`${subject} empty optional header fields must be omitted`);
	}
	if (event.type !== "tool/result") return;
	const data = record(event.data, `${subject} data`);
	if (data["error"] === void 0) return;
	const content = record(data["message"], `${subject} message`)["content"];
	if (!Array.isArray(content) || content.length !== 1 || !isSessionFormatJsonObject(content[0]) || content[0]["type"] !== "tool-result" || content[0]["isError"] !== true) throw new SessionFormatError(`${subject} carries error metadata for a non-error tool result`);
}
/**
* Canonicalize structurally transformed events without changing their target coordinates.
* @param event - transformed event using released replacement names and target coordinates.
* @returns a V3 event sharing all unchanged payloads and reference values.
*/
function canonicalizeTransformedEvent(event) {
	let target = event;
	const operation = event["surfaceOp"];
	if (operation !== void 0 && operation !== "append") {
		const replace = record(operation, `format v2 ${event.type} at seq ${event.seq} surfaceOp`);
		if (Object.keys(replace).length !== 3 || replace["op"] !== "replace" || !Object.hasOwn(replace, "start") || !Object.hasOwn(replace, "end")) throw new SessionFormatError(`format v2 ${event.type} at seq ${event.seq} requires exact replace fields op/start/end`);
		target = {
			...event,
			surfaceOp: {
				op: "replace",
				startSeq: sessionFormatCount(replace["start"], `format v2 ${event.type} at seq ${event.seq} replace start`),
				endSeq: sessionFormatCount(replace["end"], `format v2 ${event.type} at seq ${event.seq} replace end`)
			}
		};
	}
	if (event.type === "request/header") {
		const data = record(event.data, `format v2 request/header at seq ${event.seq} data`);
		const header = record(data["header"], `format v2 request/header at seq ${event.seq} header`);
		const empty = Object.keys(header).filter((key) => key === "tools" && Array.isArray(header[key]) && header[key].length === 0 || key === "adapterDefaults" && isSessionFormatJsonObject(header[key]) && Object.keys(header[key]).length === 0);
		if (empty.length > 0) {
			const canonical = Object.fromEntries(Object.entries(header).filter(([key]) => !empty.includes(key)));
			target = {
				...target,
				data: {
					...data,
					header: canonical
				}
			};
		}
	}
	assertV3Event(target);
	return target;
}
/** Native V3 system-head validation with a private view for frozen non-system relationships. */
/**
* Validate v3 logical metadata with the released-v2 fields.
* @param header - decoded v3 Session header.
*/
function assertReleasedV3Header(header) {
	if (header.version !== 3) throw new SessionFormatError("expected format v3 header");
	assertReleasedV2Header({
		...header,
		version: 2
	});
}
/**
* Validate system ownership, protected-head operations, ordinary relationships, and inherited cut.
* The private relationship view never escapes; the returned artifact and its messages are unchanged.
* @param artifact - detached v3 artifact.
* @param knownEventTypes - event types understood by the installed Session package.
* @returns the same validated artifact.
*/
function restoreReleasedV3Artifact(artifact, knownEventTypes) {
	assertReleasedV3Header(artifact.header);
	let step;
	let head;
	let hasSurface = false;
	const events = artifact.events.map((event) => {
		assertV3EventAdmission(event);
		assertV3Event(event, knownEventTypes);
		const system = event.type === "system/message";
		if (event.type === "step/start") {
			const data = record(event.data, event.type);
			step = {
				turn: data["turn"],
				step: data["step"]
			};
		} else if (event.type === "step/end" || event.type === "turn/end") step = void 0;
		if (system) {
			const data = record(event.data, "system/message");
			if (step === void 0 || step.turn !== data["turn"] || step.step !== data["step"]) throw new SessionFormatError("system/message does not match an open step");
			const operation = event["surfaceOp"];
			if (hasSurface && head === void 0) throw new SessionFormatError("system/message requires a protected first surface head");
			if (operation === "append") {
				if (!hasSurface) head = event.seq;
			} else {
				const replace = record(operation, "system replacement");
				if (replace["startSeq"] === head || replace["endSeq"] === head) {
					if (replace["startSeq"] !== head || replace["endSeq"] !== head) throw new SessionFormatError("system/message must replace exactly the current system head");
					head = event.seq;
				}
			}
		} else if (SURFACE_TYPES.has(event.type) && event["surfaceOp"] !== "append") {
			const replace = record(event["surfaceOp"], "surface replacement");
			if (replace["startSeq"] === head || replace["endSeq"] === head) throw new SessionFormatError("surface replacement cannot shadow the protected system head");
		}
		if (event.type === "compaction/prune" || event.type === "compaction/summary") {
			const seqs = record(event.data, event.type)["shadowedSeqs"];
			if (Array.isArray(seqs) && seqs.some((seq) => seq === head)) throw new SessionFormatError("compaction cannot shadow the protected system head");
		}
		if (SURFACE_TYPES.has(event.type)) hasSurface = true;
		const projected = relationshipEvent(event);
		if (!SURFACE_TYPES.has(event.type) || event["surfaceOp"] === "append") return projected;
		const replacement = event["surfaceOp"];
		return {
			...projected,
			surfaceOp: {
				op: "replace",
				start: replacement.startSeq,
				end: replacement.endSeq
			}
		};
	});
	restoreReleasedV2Artifact({
		...artifact,
		header: {
			...artifact.header,
			version: 2
		},
		events
	}, knownEventTypes, 3);
	return artifact;
}
/**
* Refuse required predecessor PTC tags without interpreting native extension payloads.
* @param event - event envelope whose type and ignorable admission markers are available.
*/
function assertV3EventAdmission(event) {
	if ((event.type === "tool/code-dispatch-start" || event.type === "tool/code-dispatch") && event["ignorable"] !== true) throw new SessionFormatUnsupportedMigrationError("format v3 contains unknown event type " + JSON.stringify(event.type) + " at seq " + String(event.seq));
}
function relationshipEvent(event) {
	switch (event.type) {
		case "tool/ptc-dispatch-start": return {
			...event,
			type: "tool/code-dispatch-start"
		};
		case "tool/ptc-dispatch": return {
			...event,
			type: "tool/code-dispatch"
		};
		case "tool/code-dispatch-start":
		case "tool/code-dispatch":
			assertV3EventAdmission(event);
			return {
				...event,
				type: "v3/opaque-released-event"
			};
	}
	if (event.type === "system/message") {
		const message = record(record(event.data, "system data")["message"], "system message");
		return {
			...event,
			type: "user/message",
			data: {
				...message,
				role: "user"
			}
		};
	}
	if (event.type !== "tool/result") return event;
	const data = record(event.data, "tool result");
	if (data["error"] === void 0) return event;
	if (record(data["error"], "tool error")["code"] !== "TOOL_NOT_STARTED") return event;
	const message = record(data["message"], "tool message");
	const callId = record(message["source"], "tool source")["callId"];
	const id = message["id"];
	if (!isRepairIdentity(id, callId)) return event;
	const prefix = "interrupted-tool-result-" + callId + "-";
	return {
		...event,
		data: {
			...data,
			message: {
				...message,
				id: `${prefix}${event.seq}`
			}
		}
	};
}
/** V3 framing with hard structural admission and recoverable canonical event validation. */
/** V3 codec validates structural rows before recovery and logical envelopes after provenance decoding. */
const releasedV3SessionFormatCodec = Object.freeze({
	version: 3,
	decodeHeader(value) {
		return {
			...releasedV2SessionFormatCodec.decodeHeader(v2PhysicalHeader(value)),
			version: 3
		};
	},
	createDecoder(value, recovery) {
		const decoder = releasedV2SessionFormatCodec.createDecoder(v2PhysicalHeader(value), recovery);
		let issue;
		let acceptedInheritedCut;
		return {
			header: {
				...decoder.header,
				version: 3
			},
			decodeRow(row, context) {
				assertV3RowAdmission(row);
				decoder.decodeRow(row, {
					emitRun: context.emitRun.bind(context),
					emitEvent(event) {
						assertV3EventAdmission(event);
						if (issue === void 0) try {
							assertV3Event(event);
						} catch (error) {
							const invalid = error;
							if (recovery === "strict") throw invalid;
							issue = invalid;
						}
						if (issue !== void 0) {
							if (event.type === "turn/end") throw issue;
							return;
						}
						if (event.type === "session/end-seed" && isSessionFormatJsonObject(event.data) && event.data["inherited"] === true) acceptedInheritedCut = event.seq;
						context.emitEvent(event);
					}
				});
			},
			finish(context) {
				if (issue === void 0) return decoder.finish(context);
				if (decoder.header.isSeeded && acceptedInheritedCut === void 0) throw new SessionFormatError("format v3 seeded Session lacks an accepted inherited end-seed marker");
				if (!decoder.header.isSeeded && acceptedInheritedCut !== void 0) throw new SessionFormatError("format v3 unseeded Session contains an inherited end-seed marker");
				return acceptedInheritedCut ?? 0;
			}
		};
	},
	encodeHeader(header, inheritedEventCount) {
		assertReleasedV3Header(header);
		return {
			...releasedV2SessionFormatCodec.encodeHeader({
				...header,
				version: 2
			}, inheritedEventCount),
			version: 3
		};
	},
	encodeEvent(event) {
		assertV3EventAdmission(event);
		assertV3Event(event);
		return releasedV2SessionFormatCodec.encodeEvent(event);
	}
});
/**
* Validate owned V3 admission rules before a scanner or codec can discard a recoverable tail.
* This checks only identified structural payloads; physical provenance still belongs to decoding.
* @param row - parsed physical row, before envelope or compressed-range decoding.
*/
function assertV3RowAdmission(row) {
	assertV3StructuralRow(row);
	if (typeof row === "object" && row !== null && !Array.isArray(row)) assertV3EventAdmission(row);
}
function v2PhysicalHeader(value) {
	const header = snapshotSessionFormatJson(value, "format v3 physical header");
	if (!isSessionFormatJsonObject(header) || header["version"] !== 3) throw new SessionFormatError("expected format v3 physical Session header");
	return {
		...header,
		version: 2
	};
}
/** Explicit local-coordinate remapping; captured generations and owner-local counters remain opaque. */
/**
* Remap only audited same-artifact references, preserving IDs and embedded model input.
* @param event - validated source event.
* @param seq - output event position.
* @param mapping - earlier source positions mapped to output positions.
* @returns the event in target coordinates.
*/
function remapEvent(event, seq, mapping) {
	const one = (value) => {
		const source = sessionFormatCount(value, "source event reference");
		const target = mapping[source];
		if (source >= event.seq || target === void 0) throw new SessionFormatError("reference must name an earlier source event");
		return target;
	};
	const list = (value) => {
		if (!Array.isArray(value)) throw new SessionFormatError("sequence references must be an array");
		return value.map(one);
	};
	const range = (value) => {
		const source = record(value, "sequence range");
		return {
			...source,
			start: one(source["start"]),
			end: one(source["end"])
		};
	};
	let data = record(event.data, event.type);
	switch (event.type) {
		case "command/done":
			if (data["sourceEventSeq"] !== void 0) data = {
				...data,
				sourceEventSeq: one(data["sourceEventSeq"])
			};
			break;
		case "compaction/summary":
		case "compaction/prune":
			data = {
				...data,
				shadowedRange: range(data["shadowedRange"]),
				shadowedSeqs: list(data["shadowedSeqs"])
			};
			break;
		case "session/title":
		case "session/title-llm-request":
			data = {
				...data,
				messageSeqs: list(data["messageSeqs"])
			};
			break;
	}
	return {
		...event,
		seq,
		data,
		...event["sourceEventSeqs"] === void 0 ? {} : { sourceEventSeqs: list(event["sourceEventSeqs"]) },
		...event["surfaceOp"] === void 0 || event["surfaceOp"] === "append" ? {} : { surfaceOp: range(event["surfaceOp"]) }
	};
}
/** Streaming system-prompt promotion followed by canonical V3 envelope conversion. */
/** Promote system prompts, remap audited references, and canonicalize envelopes and PTC vocabulary. */
const sessionFormatV2ToV3 = defineSessionFormatMigration({
	name: "@deepseek-ai/dsh-session-format-v2-to-v3",
	fromVersion: 2,
	toVersion: 3,
	migrateHeader(header) {
		assertReleasedV2Header(header);
		return {
			...header,
			version: 3,
			...header.agentPreset === "code" ? { agentPreset: "ptc" } : {}
		};
	},
	createStage(input) {
		return new ReleasedV2ToV3Stage(input);
	},
	validateTargetHeader: assertReleasedV3Header
});
var ReleasedV2ToV3Stage = class {
	input;
	headerInheritedEventCount;
	mapping = [];
	originalIds = /* @__PURE__ */ new Set();
	generatedIds = /* @__PURE__ */ new Set();
	targetSeq = 0;
	sourceCut;
	targetCut;
	lastForeignDeliverySeq;
	step;
	head;
	prompt = "";
	constructor(input) {
		this.input = input;
		assertReleasedV2Header(input.sourceHeader);
		this.sourceCut = input.sourceHeader.isSeeded ? void 0 : 0;
		this.targetCut = input.sourceHeader.isSeeded ? void 0 : 0;
		if (!input.sourceHeader.isSeeded) this.headerInheritedEventCount = 0;
	}
	transformEvent(event, context) {
		if (event.seq !== this.mapping.length) throw new SessionFormatError("format v2 source events must be dense");
		assertEvent(event, 2);
		this.observeMessageIds(event);
		let source = event;
		const data = record(event.data, event.type);
		if (event.type === "request/header") {
			const { system, ...header } = record(data["header"], "request header");
			const prompt = typeof system === "string" ? system : "";
			if (prompt !== this.prompt) this.emitSystem(prompt, event, context);
			source = {
				...event,
				data: {
					...data,
					header
				}
			};
		}
		if (SURFACE_TYPES.has(event.type) && this.head === void 0) throw new SessionFormatUnsupportedMigrationError("format v2 surface before first step cannot acquire a system head without changing chronology");
		if (event.type === "session/end-seed" && data["inherited"] === true) {
			if (!this.input.sourceHeader.isSeeded) throw new SessionFormatError("format v2 unseeded Session contains an inherited end-seed marker");
			this.sourceCut = event.seq;
			this.targetCut = this.targetSeq;
		}
		if (event.type === "session-log-deepseek/delivery-accepted") {
			if (data["sessionFormatVersion"] === 3) throw new SessionFormatError("format v2 delivery marker claims target format v3");
			if (data["sessionFormatVersion"] === 2 && data["sessionId"] !== this.input.sourceHeader.id) this.lastForeignDeliverySeq = event.seq;
		}
		const target = remapEvent(source, this.targetSeq, this.mapping);
		this.mapping.push(this.targetSeq++);
		context.emitEvent(canonicalizeTransformedEvent(renamePtcEvent(target)));
		if (event.type === "step/start") {
			this.step = {
				turn: data["turn"],
				step: data["step"]
			};
			if (this.head === void 0) this.emitSystem("", event, context);
		} else if (event.type === "step/end" || event.type === "turn/end") this.step = void 0;
	}
	transformRun(run, context) {
		for (const event of run.expand()) this.transformEvent(event, context);
	}
	finish(_context) {
		const cut = sessionFormatCount(this.sourceCut, "format v2 inherited end-seed marker");
		if (this.input.sourceInheritedEventCount !== void 0 && this.input.sourceInheritedEventCount !== cut) throw new SessionFormatError("format v2 inherited end-seed marker disagrees with its source cut");
		if (this.lastForeignDeliverySeq !== void 0 && (this.input.sourceHeader.parentSession === void 0 || this.lastForeignDeliverySeq >= cut)) throw new SessionFormatError("current-generation delivery marker names the wrong Session");
		return sessionFormatCount(this.targetCut, "format v3 inherited event count");
	}
	observeMessageIds(event) {
		const data = record(event.data, event.type);
		const messages = event.type === "user/message" ? [data] : event.type === "assistant/message" || event.type === "tool/result" ? [record(data["message"], "message")] : event.type === "agent/inbox/spliced" ? data["inserted"] : event.type === "session/title-llm-request" ? data["messages"] : [];
		for (const message of messages) {
			const id = message["id"];
			if (this.generatedIds.has(id)) throw new SessionFormatUnsupportedMigrationError("source message id collides with a generated system message id");
			this.originalIds.add(id);
		}
	}
	emitSystem(prompt, anchor, context) {
		if (this.step === void 0) throw new SessionFormatUnsupportedMigrationError("format v2 changed request prompt outside an open step cannot retain source chronology");
		const identity = JSON.stringify([
			"session-format-v2-to-v3",
			this.input.sourceHeader.id,
			anchor.seq,
			anchor.type
		]);
		const id = "v2-to-v3-system-" + createHash("sha256").update(identity).digest("hex");
		if (this.originalIds.has(id) || this.generatedIds.has(id)) throw new SessionFormatUnsupportedMigrationError("generated system message id collides with an existing message id");
		this.generatedIds.add(id);
		const seq = this.targetSeq++;
		context.emitEvent(canonicalizeTransformedEvent({
			type: "system/message",
			seq,
			time: anchor.time,
			data: {
				...this.step,
				message: {
					id,
					role: "system",
					source: {
						kind: "plugin",
						plugin: "@deepseek-ai/dsh-system-prompt"
					},
					content: prompt === "" ? [] : [{
						type: "text",
						text: prompt
					}]
				}
			},
			...this.head === void 0 ? { surfaceOp: "append" } : {
				surfaceOp: {
					op: "replace",
					start: this.head,
					end: this.head
				},
				sourceEventSeqs: [this.head]
			}
		}));
		this.head = seq;
		this.prompt = prompt;
	}
};
/** Source admission precedes renaming, so these payloads have exact audited fields. */
function renamePtcEvent(event) {
	switch (event.type) {
		case "agent-preset/selected": return event.data["agentPreset"] === "code" ? {
			...event,
			data: {
				...event.data,
				agentPreset: "ptc"
			}
		} : event;
		case "tool/code-dispatch-start": return {
			...event,
			type: "tool/ptc-dispatch-start"
		};
		case "tool/code-dispatch": return {
			...event,
			type: "tool/ptc-dispatch"
		};
		case "user/message": {
			const data = renameMessageSource(event.data);
			return data === event.data ? event : {
				...event,
				data
			};
		}
		case "agent/inbox/spliced":
		case "session/title-llm-request": {
			const data = event.data;
			const key = event.type === "agent/inbox/spliced" ? "inserted" : "messages";
			const messages = data[key];
			const renamed = messages.map(renameMessageSource);
			return renamed.every((message, index) => message === messages[index]) ? event : {
				...event,
				data: {
					...data,
					[key]: renamed
				}
			};
		}
		default: return event;
	}
}
function renameMessageSource(message) {
	const source = message["source"];
	if (source["kind"] !== "plugin" || source["plugin"] !== "tools-code-mode") return message;
	return {
		...message,
		source: {
			...source,
			plugin: "tools-ptc"
		}
	};
}
//#endregion
//#region ../../.runtime/dsh-0.1.5-rc.2/node_modules/@deepseek-ai/dsh-session-format-catalog/lib/index.js
var lib_exports = /* @__PURE__ */ __exportAll({
	SessionFormatUnsupportedMigrationError: () => SessionFormatUnsupportedMigrationError,
	sessionFormatCatalog: () => sessionFormatCatalog
});
/** Current installed Session validation used after vocabulary-aware format restoration. */
/**
* Validate current logical metadata through the installed Session package.
* @param header - detached current logical header.
* @returns nothing after successful validation.
*/
function validateInstalledCurrentSessionHeader(header) {
	if (header.version !== 3) throw new Error(`installed Session format is v3, got v${header.version}`);
	Session.fromRestore(SessionId(header.id), [], header, SessionLogOffset(0), "detached");
}
/**
* Validate current header, event envelopes, messages, surface operations, and seed cut through the installed Session package.
* @param artifact - vocabulary-restored current logical artifact.
* @returns nothing after successful validation.
*/
function validateInstalledCurrentSessionArtifact(artifact) {
	if (artifact.header.version !== 3) throw new Error(`installed Session format is v3, got v${artifact.header.version}`);
	Session.fromRestore(SessionId(artifact.header.id), artifact.events, artifact.header, SessionLogOffset(artifact.inheritedEventCount), "detached");
}
/**
* GENERATED by `scripts/gen-session-format-catalog.ts` — do not edit by hand.
* The direct imports make historical readability independent of mounted plugins.
*/
/** Physical codec dispatch and complete adjacent chain, independent of mounted plugins. */
const sessionFormatCatalog = createSessionFormatCatalog({
	currentVersion: 3,
	codecs: [
		releasedV0SessionFormatCodec,
		releasedV1SessionFormatCodec,
		releasedV2SessionFormatCodec,
		releasedV3SessionFormatCodec
	],
	currentEncoder: releasedV3SessionFormatCodec,
	migrations: [
		sessionFormatV0ToV1,
		sessionFormatV1ToV2,
		sessionFormatV2ToV3
	],
	restoreCurrent(artifact) {
		const restored = restoreReleasedV3Artifact(artifact, KNOWN_SESSION_EVENT_TYPES);
		validateInstalledCurrentSessionArtifact(restored);
		return restored;
	},
	restoreTransformedCurrent(artifact) {
		return restoreReleasedV3Artifact(artifact, KNOWN_SESSION_EVENT_TYPES);
	},
	restoreCurrentHeader(header) {
		assertReleasedV3Header(header);
		validateInstalledCurrentSessionHeader(header);
		return header;
	}
});
//#endregion
//#region lib/types/session-format-catalog-compat.js
/**
* 会话格式 catalog 双版本兼容层 —— engine 侧接触 DSH 存储格式的统一入口。
*
* ── 为什么需要（2026-09-26 App 版适配）─────────────────────────────────────
* 引擎同时要活在两个宿主里：
*   · CLI 0.1.5（`~/.dsh`）        → catalog 当前版本 = **v3**（`session.v3.jsonl`）
*   · App 0.1.7（`~/dsh-desktop-trial`）→ catalog 当前版本 = **v4**（`session.v4.jsonl`）
* 两边 catalog 包的 **API 形状不同**（2026-09-26 逐行比对两包 lib/index.js 实测）：
*
*   ┌──────────────────────┬──────────────────────┬────────────────────────────┐
*   │                      │ 0.1.5 catalog        │ 0.1.7 catalog              │
*   ├──────────────────────┼──────────────────────┼────────────────────────────┤
*   │ sessionFormatCatalog │ currentVersion = 3   │ currentVersion = 4         │
*   │ 读 v3 日志           │ ✅ current           │ ⚠️ migration-required，但  │
*   │                      │                      │    v3→v4 迁移要 children    │
*   │                      │                      │    证据（缺 → unsupported） │
*   │ historicalSession…   │ ❌ 无此导出          │ ✅ 读 v3 = current（完整）  │
*   │ 读 v4 日志           │ ❌ unsupported       │ ✅ current                 │
*   └──────────────────────┴──────────────────────┴────────────────────────────┘
*
* ── 取用策略：探测 + 兜底（零硬失败）──────────────────────────────────────
* 构建期 catalog 被 **内联** 进 bundle（tsdown 只 external 化 peerDependencies，
* 而 catalog 不在其中——实测 lib/index.js 无该 import）。内联副本 = 构建时
* 引擎 node_modules 里那份（CLI 场景 = 0.1.5）。
*
* 因此本层在**运行时探测宿主**是否有更新的 catalog（App 场景 pnpm 会把它装到
* 插件自己的 node_modules 下，因为 2026-09-26 起它进了 peerDependencies）：
*   · 探测成功且版本更高 → 用它（App：拿到 v4 能力）
*   · 探测失败/版本不高   → 用内联那份（CLI：行为与改动前完全一致）
* ⟹ **任何情况下都有可用 catalog，不存在「探测失败 → 引擎起不来」**。
*
* ── 读侧选法（按目标文件头）──────────────────────────────────────────────
*  1. `historicalSessionFormatCatalog`（0.1.7 独有）——current = v3，读 v3 是
*     「原生」路径，不需要 children 证据；
*  2. 宿主 catalog——0.1.5 下它就是 v3 原生；0.1.7 下是 v4（读 v4 靠它）。
*  判定用 `readHeader` 的 status：`current` / `migration-required` 都算可读
*  （与旧 `openLogReader` 同判据）；其余（unsupported / malformed）→ 换下一个。
*
* ── 写侧选法（按宿主 current，与读侧不同）────────────────────────────────
* 写侧产物要被**宿主**读回，所以必须跟宿主 currentVersion 走，而不是跟输入
* 文件版本走。0.1.5 宿主 → v3 行；0.1.7 宿主 → v4 行。
*
* ── 保守性（安全第一）────────────────────────────────────────────────────
* 探测失败/API 形状不认识 → 一律 null（调用方按「不可读/不可写」处理——跳过该
* 文件，绝不猜、绝不写坏）。读口 `decodeAll` 任一行失败 → null。
*/
function isCatalogLike(v) {
	if (v === null || typeof v !== "object") return false;
	const o = v;
	return typeof o["readHeader"] === "function" && typeof o["createRestore"] === "function" && typeof o["encodeCurrentHeader"] === "function" && typeof o["encodeCurrentEvent"] === "function" && typeof o["currentVersion"] === "number";
}
function asCatalog(v) {
	return isCatalogLike(v) ? v : null;
}
/**
* 探测基准列表：引擎自身 + **宿主进程 argv 里的路径**。
*
* ── 为什么不能只用 import.meta.url（2026-09-29 重启清理零产出根因）────────
* App 场景下引擎被装进 profile：`~/.dsh/profiles/desktop/node_modules/
* mbsf-compaction/`。`createRequire(import.meta.url)` 从那里
* 向上找 `@deepseek-ai/dsh-session-format-catalog`，会命中
* `~/.dsh/profiles/node_modules/` 下那份 —— 那是 **CLI 时代 0.1.5 的 v3-only
* 副本**。于是探测「成功」但拿到 v3，池里永远没有 v4 → App 自带的 v4 日志
* （最大的那批文件）一律读不出，重启清理 187 个文件全 skipped、释放 0 字节。
* 实测：`catalogProbeReport()` = { bundled: 3, probed: 3, effective: 3 }。
*
* 宿主的真身在 `process.argv` 里（App：`…/app.asar/dsh` 是 dsh root，
* `…/dsh-desktop-host/lib/index.js` 是宿主入口），从那解析才能拿到 App 自带的
* 0.1.7 / v4 catalog。逐个基准试，取 currentVersion **最大**的那份。
*/
function probeBases() {
	const out = [import.meta.url];
	const args = [...process.argv];
	const inherited = process.env.MBSF_HOST_ARGV;
	if (inherited !== void 0 && inherited !== "") try {
		const parsed = JSON.parse(inherited);
		if (Array.isArray(parsed)) {
			for (const a of parsed) if (typeof a === "string") args.push(a);
		}
	} catch {}
	for (const arg of args) {
		if (typeof arg !== "string" || !arg.startsWith("/")) continue;
		const isFile = /\.(m?js|cjs)$/.test(arg);
		out.push(isFile ? arg : `${arg.replace(/\/+$/, "")}/index.js`);
	}
	return out;
}
/**
* 运行时探测宿主 catalog 包（App 场景拿到 0.1.7 / v4）。
* 多基准逐个试，取 currentVersion 最大者；全部失败/形状不认识 → null。
*/
function probeHostCatalogPkg() {
	let best = null;
	let bestVersion = -1;
	for (const base of probeBases()) try {
		const mod = createRequire(base)("@deepseek-ai/dsh-session-format-catalog");
		if (mod === null || typeof mod !== "object") continue;
		const v = asCatalog(mod["sessionFormatCatalog"])?.currentVersion ?? -1;
		if (v > bestVersion) {
			best = mod;
			bestVersion = v;
		}
	} catch {}
	return best;
}
const bundledPkg = lib_exports;
const probedPkg = probeHostCatalogPkg();
/** 内联（构建期）catalog 包。 */
const bundledHostCatalog = asCatalog(bundledPkg["sessionFormatCatalog"]);
/** 运行时探测到的 catalog 包（可能为 null）。 */
const probedHostCatalog = probedPkg === null ? null : asCatalog(probedPkg["sessionFormatCatalog"]);
/**
* 全部可用 catalog（读侧候选池）——**按 currentVersion 降序**。
*
* 为什么要池化而不是「只选一个」：pnpm 可能把 peer 依赖装成**任意版本**
* （`>=0.1.0-rc.5` 是宽区间，registry 上 `latest` 标签停在 0.1.3-alpha.2）。
* 若只看「探测到的那份」会漏掉内联那份的能力，反之亦然。池化后由读口逐个试
* （能读的头才算数），能力最大化且不会误判。
*/
const catalogPool = (() => {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	const add = (cat, via) => {
		if (cat === null || seen.has(cat)) return;
		seen.add(cat);
		out.push({
			cat,
			via
		});
	};
	if (probedPkg !== null) add(asCatalog(probedPkg["historicalSessionFormatCatalog"]), "historical");
	add(probedHostCatalog, "host-probed");
	add(bundledHostCatalog, "host-bundled");
	return out.sort((a, b) => b.cat.currentVersion - a.cat.currentVersion);
})();
catalogPool[0]?.cat;
probedPkg === null || asCatalog(probedPkg["historicalSessionFormatCatalog"]);
/** 读口选项（与旧 openLogReader 一致——strict + transformed）。 */
const RESTORE_OPTS = {
	recovery: "strict",
	validation: "transformed"
};
/**
* 按**目标文件头**选 catalog 开读口。
*
* ⚠️ 关键：`readHeader` 接受 ≠ 真能读完。0.1.7 的 v4 catalog 对 v3 头返回
* `migration-required`（看似可读），但 `createRestore` 走 v3→v4 迁移时需要
* **children 证据**，缺证据直接抛 → 解码失败。所以本实现**不**在 readHeader
* 通过时就定下 catalog，而是把候选池整个带进 `decodeAll`：逐个真读，谁读出
* 来算谁的（首读失败 → 换下一个）。这样「能读」是实测结论，不是静态推测。
*
* @returns 读口；池里所有 catalog 都读不出 → decodeAll 返回 null（调用方按
*   不可读处理）。
*/
function openCompatLogReader(headerObj) {
	if (catalogPool.length === 0) return null;
	const accepting = catalogPool.filter(({ cat }) => {
		try {
			const status = cat.readHeader(headerObj).status;
			return status === "current" || status === "migration-required";
		} catch {
			return false;
		}
	});
	if (accepting.length === 0) return null;
	const state = { via: "none" };
	return {
		get via() {
			return state.via;
		},
		decodeAll(rows) {
			for (const { cat, via } of accepting) try {
				const restore = cat.createRestore(headerObj, RESTORE_OPTS);
				for (const row of rows) restore.decodeRow(row);
				const artifact = restore.finish();
				state.via = via;
				return {
					header: artifact.header,
					inheritedEventCount: artifact.inheritedEventCount,
					events: [...artifact.events]
				};
			} catch {
				continue;
			}
			state.via = "none";
			return null;
		}
	};
}
function isVerifierLike(v) {
	if (v === null || typeof v !== "object") return false;
	const o = v;
	return typeof o["validateStoredEvents"] === "function" && typeof o["assertContiguous"] === "function";
}
function isSessionLibLike(v) {
	if (v === null || typeof v !== "object") return false;
	const o = v;
	return typeof o["foldSurface"] === "function" && typeof o["SessionId"] === "function";
}
/** 从宿主探测基准里 require 一个包，取**能力最强**的那份。
*
*  ⚠️ 判据是 `score`（越大越强），**不是基准顺序**（2026-10-02 实测教训）：
*  `process.argv[0]` 是 Electron 可执行文件路径，它被当成目录补 `/index.js`
*  后向上解析，会**再次命中引擎自己的 0.1.5 副本**；而「第一个宿主基准」
*  与「引擎自身基准」解析到同一个文件时，按顺序取首个就取错了那份。
*  改用能力评分后，无论 argv 怎么排、有几个基准，都取到真正知道新事件类型的
*  那一份（这正是 catalog 池「取 currentVersion 最大」的同一策略）。 */
function probePkg(name, accept, score) {
	let best = null;
	for (const base of probeBases()) try {
		const req = createRequire(base);
		const mod = req(name);
		if (!accept(mod)) continue;
		const s = score(mod, base);
		const from = base === import.meta.url ? "engine" : "host";
		let path = "";
		try {
			path = req.resolve(name);
		} catch {}
		if (best === null || s > best.score) best = {
			mod,
			from,
			score: s,
			path
		};
	} catch {}
	return best;
}
/** `@deepseek-ai/dsh-session` 的已知事件类型数——能力评分。
*
*  App 0.2.0 = 59（含 developer/message、workspace/changes），
*  CLI 0.1.5 = 56（都不含）。**越大越新**，故取最大者。 */
function sessionCapability(v) {
	const k = v.KNOWN_SESSION_EVENT_TYPES;
	return typeof k?.size === "number" ? k.size : 0;
}
/** 从某个基准解析 `@deepseek-ai/dsh-session` 的能力分（解析不到 → -1）。
*
*  ⚠️ 这是给 **persistence** 打分的代理：persistence 内部 `import` 的
*  `KNOWN_SESSION_EVENT_TYPES` 来自**与它同一 node_modules 树**的
*  `dsh-session`（它自己不 re-export 该常量，无法直接问）。从同一基准解析
*  `dsh-session`，得到的正是 persistence 实际会用的那份 ⟹ 评分可靠。 */
function sessionCapabilityAt(base) {
	try {
		return sessionCapability(createRequire(base)("@deepseek-ai/dsh-session"));
	} catch {
		return -1;
	}
}
/** 官方存储验证器（取**配套 session 能力最强**的那份；解析不到 → null，
*  调用方退回静态 import）。
*
*  评分用「同一基准下 `dsh-session` 的已知类型数」——这样 persistence 与
*  session 必然取自**同一棵树**，不会出现「验证器是新的、类型表是旧的」那种
*  自相矛盾的组合（2026-10-02 实测：单看 persistence 形状两版都合格，
*  按基准顺序取首个会拿到 0.1.5 那份 ⟹ 仍拒新事件类型）。 */
function resolveOfficialVerifier() {
	const hit = probePkg("@deepseek-ai/dsh-session-persistence", isVerifierLike, (_mod, base) => sessionCapabilityAt(base));
	return hit === null ? null : {
		mod: hit.mod,
		from: hit.from,
		path: hit.path
	};
}
/** 会话库（`foldSurface` / `SessionId`；取已知类型最多的那份）。
*
*  ⚠️ 必须与 `resolveOfficialVerifier` **配套**：persistence 的
*  `validateStoredEvents` 内部 `import` 的是它自己那份 `dsh-session` 的
*  `KNOWN_SESSION_EVENT_TYPES`。两份各自取到「最强」时才是自洽的一对。 */
function resolveSessionLib() {
	const hit = probePkg("@deepseek-ai/dsh-session", isSessionLibLike, sessionCapability);
	return hit === null ? null : {
		mod: hit.mod,
		from: hit.from,
		path: hit.path
	};
}
function isRelationshipsAssertLike(v) {
	return v !== null && typeof v === "object" && typeof v["assertReleasedV4Relationships"] === "function";
}
/**
* 关系断言器（`@deepseek-ai/dsh-session-format-v3-to-v4`）。
*
* **为什么需要单独解析**（2026-10-03 事故）：剪裁产物通过了闸一（结构）、
* 逐行 `decodeRow`、以及 `verifyWithOfficial`，却在 App 打开时报
* `system/message does not match an open turn and step` ⟹ 会话打不开。
* 三道检查**都不重放 turn/step 状态**，而这个断言器重放。
*
* **配套要求**：调用时必须传**与它同一棵树**的 `KNOWN_SESSION_EVENT_TYPES`。
* 实测（2026-10-03）：用 58 类的 `RELEASED_V3_EVENT_TYPES` 会把**健康文件**
* 也判死（`compaction/summary shadowedSeqs do not name an exact current
* surface span`）；换 59 类的 `KNOWN_SESSION_EVENT_TYPES` 后健康文件 ✅、
* 变体 ❌ ⟹ 判定有效。故此处与 `resolveSessionLib()` 配套使用。
*/
function resolveRelationshipsAssert() {
	const hit = probePkg("@deepseek-ai/dsh-session-format-v3-to-v4", isRelationshipsAssertLike, () => 0);
	return hit === null ? null : {
		mod: hit.mod,
		from: hit.from,
		path: hit.path
	};
}
//#endregion
//#region lib/types/session-format-v3.js
/**
* 0.1.5 会话日志格式适配层（v3）——**薄壳**，实现已迁至 `session-format-catalog-compat.ts`。
*
* 保留本模块是为了不动调用方（session-prune / session-health / tests 的 import 面），
* 语义与旧实现一致；差异只有一处：catalog 从「写死内联的 0.1.5」改为
* 「运行时探测宿主版本，取能力更强的那份」（详见 compat 模块头注释）。
*
* ── 历史背景（旧实现原文，保留作档案）──────────────────────────────────
* DSH-0.1.1 的 `decodeStorageRecord` / `packChunkRuns`（`@deepseek-ai/dsh-session`）
* 在 0.1.5 全树消失，存储格式整体换代到 v3（文件名 `session.v3.jsonl`）。
* 0.1.5 的公开口是 `sessionFormatCatalog`：
*
*   读：readHeader(头对象)                        // 状态机；v0 返回 migration-required
*        → createRestore(头对象, {recovery,validation})   // 不能跳步（物理头须过 codec 校验）
*        → decodeRow(row) × N                      // ⚠️ 返回 void —— 单趟收集器，不产出事件
*        → finish()                                // → { header, inheritedEventCount, events }
*
*   写：encodeEvent(event) × N                     // 逐事件产行
*        + encodeHeader(header, inheritedEventCount)
*
* 实测（2026-09-13，真日志 session.jsonl.zstd）：v0 头经 readHeader 返回
* `migration-required`，回传 header 已是迁好的 v3 头 ⟹ 历史日志自动迁移。
* 实测（2026-09-26，App 0.1.7）：同一份代码在 0.1.7 宿主下经探测拿到 v4 catalog，
* v3/v4 两种日志都能读（见 compat 模块头的两版本对照表）。
*
* @module mbsf-compaction/session-format-v3
*/
/** 头对象是否被（宿主/历史）catalog 接受（current / migration-required 都算可读）。 */
function openLogReader(headerObj) {
	return openCompatLogReader(headerObj);
}
/** 把任意输入钳到合法 tail 窗口（8–256，整数）。 */
function clampTailMessages(value) {
	return Math.min(256, Math.max(8, typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 64));
}
/** DSH 堆上限默认值（MB）——16GB 机器的一半（与 dsh-web 启动器的
*  DEFAULT_HEAP_MB 同值——两条启动路径的默认必须一致）。 */
/** [OBS] 物理资源参照（本机 16GB 的一半）——**外部约束值不是内容常数**：必须与
*  dsh-web 启动器的 `DEFAULT_HEAP_MB` 一致（两条启动路径默认不同 = 用户换个入口
*  就崩，2026-11-01 事故即此类）。不进判定层。 */
const DSH_HEAP_DEFAULT_MB = 8192;
/** 堆上限的合法下界（MB）——低于 node 默认（本机实测 4288）无意义。
*  [OBS] 物理资源护栏——V8 老生代下限，低于它设了也等于没设。 */
const DSH_HEAP_MIN_MB = 4096;
/** 系统保留内存（MB）——算上限时从物理内存里扣掉（macOS 系统 + 浏览器
*  + 其他应用）。
*  [OBS] 物理资源参照（6GB 经验值）——16GB 机器 → 上限 16−6 = 10GB，
*  再向下取整到 GB。外部约束值，不进判定层。 */
const DSH_HEAP_RESERVE_MB = 6144;
/** 本机允许的最大堆上限（MB）——物理内存 − 系统保留，向下取整到 GB，
*  下界 4096。
*
*  **为什么用 totalmem 而非 freemem**：macOS 把空闲内存尽量用作文件缓存，
*  freemem 实测只有 88MB（用它算上限会得到 0）。物理总量才是真边界。 */
function resolveDshHeapMaxMb() {
	const totalMb = totalmem() / 1048576;
	const maxMb = Math.floor((totalMb - DSH_HEAP_RESERVE_MB) / 1024) * 1024;
	return Math.max(DSH_HEAP_MIN_MB, maxMb);
}
/** 堆上限默认值——不超过本机允许的最大值（小内存机器自动降档）。 */
function defaultDshHeapMb() {
	return Math.min(DSH_HEAP_DEFAULT_MB, resolveDshHeapMaxMb());
}
/** 堆上限合法域钳制：0（不注入）或 ≥ 4096（取整到 1024）。
*  同 normalizeCleanupPruneTurns 的「0 或 ≥N」形态（UI 滑块拖进空洞时用）。 */
function normalizeDshHeapMb(value) {
	if (!Number.isFinite(value) || value <= 0) return 0;
	if (value < 4096) return DSH_HEAP_MIN_MB;
	return Math.floor(value / 1024) * 1024;
}
const CONFIG_FILE = "config.json";
let _runtimeConfig = null;
/** 脑数据目录（与 mbsfSummarize 同一解析：env 覆盖，默认 ~/.mbsf）。 */
function resolveMbsfDataDir() {
	return process.env.MBSF_DATA ?? join(process.env.HOME || "/tmp", ".mbsf");
}
function defaults() {
	return {
		injectEnabled: process.env.MBSF_INJECT_DISABLED === "0",
		dateAnchorEnabled: process.env.MBSF_DATE_ANCHOR_DISABLED !== "1",
		autoCompact: true,
		restartCleanupEnabled: false,
		cleanupPruneTurns: 0,
		backupKeepCount: 3,
		restartButtonVisible: false,
		activityIndicatorEnabled: true,
		activityLabelEnabled: true,
		sessionStreamKeepCount: 200,
		dshHeapMb: defaultDshHeapMb(),
		autoReclaimEnabled: false,
		autoReclaimThresholdPct: 60,
		compactTailMessages: 64
	};
}
/** 加载（首次）或返回缓存的运行时配置；config.json 覆盖 env 默认。 */
function loadRuntimeConfig() {
	if (_runtimeConfig) return _runtimeConfig;
	const value = defaults();
	const p = join(resolveMbsfDataDir(), CONFIG_FILE);
	try {
		if (existsSync(p)) {
			const raw = JSON.parse(readFileSync(p, "utf8"));
			if (typeof raw.injectEnabled === "boolean") value.injectEnabled = raw.injectEnabled;
			if (typeof raw.dateAnchorEnabled === "boolean") value.dateAnchorEnabled = raw.dateAnchorEnabled;
			if (typeof raw.autoCompact === "boolean") value.autoCompact = raw.autoCompact;
			if (typeof raw.restartCleanupEnabled === "boolean") value.restartCleanupEnabled = raw.restartCleanupEnabled;
			if (typeof raw.cleanupPruneTurns === "number" && Number.isFinite(raw.cleanupPruneTurns) && (raw.cleanupPruneTurns === 0 || raw.cleanupPruneTurns >= 3)) value.cleanupPruneTurns = Math.floor(raw.cleanupPruneTurns);
			if (typeof raw.backupKeepCount === "number" && Number.isFinite(raw.backupKeepCount) && raw.backupKeepCount >= 0) value.backupKeepCount = Math.floor(raw.backupKeepCount);
			if (typeof raw.restartButtonVisible === "boolean") value.restartButtonVisible = raw.restartButtonVisible;
			if (typeof raw.activityIndicatorEnabled === "boolean") value.activityIndicatorEnabled = raw.activityIndicatorEnabled;
			if (typeof raw.activityLabelEnabled === "boolean") value.activityLabelEnabled = raw.activityLabelEnabled;
			if (typeof raw.sessionStreamKeepCount === "number" && Number.isFinite(raw.sessionStreamKeepCount) && raw.sessionStreamKeepCount >= 0) value.sessionStreamKeepCount = Math.floor(raw.sessionStreamKeepCount);
			if (typeof raw.dshHeapMb === "number" && Number.isFinite(raw.dshHeapMb) && (raw.dshHeapMb === 0 || raw.dshHeapMb >= 4096)) value.dshHeapMb = normalizeDshHeapMb(raw.dshHeapMb);
			if (typeof raw.autoReclaimEnabled === "boolean") value.autoReclaimEnabled = raw.autoReclaimEnabled;
			if (typeof raw.autoReclaimThresholdPct === "number" && Number.isFinite(raw.autoReclaimThresholdPct) && raw.autoReclaimThresholdPct >= 20 && raw.autoReclaimThresholdPct <= 95) value.autoReclaimThresholdPct = Math.round(raw.autoReclaimThresholdPct);
			if (typeof raw.compactTailMessages === "number" && Number.isFinite(raw.compactTailMessages)) value.compactTailMessages = clampTailMessages(raw.compactTailMessages);
		}
	} catch {}
	_runtimeConfig = value;
	return _runtimeConfig;
}
/** 当前运行时配置（惰性加载）。 */
function getRuntimeConfig() {
	return loadRuntimeConfig();
}
//#endregion
//#region lib/types/session-prune.js
/**
* 会话日志瘦身（γ-prune）——方案 B'：尾部帧提取 + 内联修复 + CLEAN 验证
*
* DSH 的会话日志（`~/.dsh/sessions/<workspace>/session-<id>/session.jsonl` 或
* `.jsonl.zstd`）是纯追加的：compaction 每折叠一段历史，就把被折叠的
* 原文永远留在文件里。日志无限增长（实测一条长会话可到 116MB+ / 数百万
* 事件），而 checkpoint 已经完整代表了被折叠历史——被 shadow 的原文对
* 恢复毫无用处。
*
* 本模块在**行级**裁剪：把文件重写为「最后一个完整 compaction 段及其后
* 的全部事件」（checkpoint 代表历史，后续事件照旧），被 shadow 的旧帧
* 全部丢弃。裁剪后重放的会话面与裁剪前完全一致（checkpoint 归一为
* append 语义，代表消息不变），文件物理变小，DSH 读侧是 layout-blind
* 的（逐帧解压 + 逐行解析），无需任何改动。
*
* 为什么是 B' 而不是旧 A 方案（findLastCheckpointFrameIndex 全量解码 +
* foldSurface 验证，2026-08-28 审视淘汰）：
*  - **内存**：旧方案全量解码，116MB zstd 日志解码峰值 844MB；B' 从后
*    往前逐帧反向扫描，找到锚点即停，峰值 ~12MB（只保留尾部增量）。
*  - **锚点可达**：旧方案要求「同帧 start/end 配对 + 帧内含 summary +
*    replace checkpoint」——真实日志里 compaction start/end 几乎总跨帧
*    （写入批次边界），同帧配对要求导致锚点回退到极早帧（tail≈全文件）；
*    B' 锚点 = 最后一个无 error 的 compaction/start（其后跨帧累积已见
*    无 error 的 compaction/end），行级切分（从 start 事件行起），不要求
*    summary/checkpoint 在场。
*  - **验证哲学**：旧方案「有 violation 即拒绝」——9ffe 尾部天然带 2 个
*    step 配对缺口（跨锚点 step/start 被剪），大文件永远剪不了；B'
*    裁剪后**内联修复**（补插 step/start）再验证 CLEAN，不拒绝。
*  - **chunk 行保护**：repairStepStarts 的 `event.seq = index` 无条件重
*    编号会破坏 chunk 打包行的语义（text-chunks 等物理行 envelope 只有
*    seq0/time0/data，没有 seq 字段——加了 seq 字段即破坏 DSH 打包格式）；
*    B' 内联修复只重编号消息级 seq + 平移 chunk 行 seq0，chunk 行不加
*    seq 字段。
*
* 裁剪安全设计（对齐 session-health）：
*  - 三重验证全部通过才写盘：① step 配对 CLEAN（detectStepViolations）；
*    ② v3 decodeRow 展开 + seq 连续 + foldSurface 重放（与 DSH
*    读侧 SessionLogScanner 的加载校验同构）；③ 编码读回一致性（产物
*    重读逐事件深比较）。
*  - 备份原日志（默认开）到 `prune-backups/`（脑数据目录内，不参与再扫描）；
*  - 临时文件 + fsync + 原子 rename（POSIX），绝不写坏原文件；
*  - 扫描层 mtime 防线：只处理 mtime 早于 minAgeMs 的日志（排除活跃
*    会话——活跃会话可能正在写尾部，裁剪会丢事件），由调用方传入
*    （引擎启动扫描传 1 小时）。
*  - **状态类事件保留**（2026-09-10 一帆「裁的时候保留状态类事件，
*    否则 resume 后 goal 会丢」）：裁剪只丢「被 checkpoint 代表的材料」，
*    不丢「当前状态」——状态不是历史，是当前值。goal/change ·
*    todo/write · plan/mode · permission/preset · sandbox/mode ·
*    approval/policy · session/title 全量保留并插入锚点段之后（先于尾部
*    较新的同类型事件，fold 顺序正确）。新增状态类事件类型必须登记进
*    STATE_EVENT_TYPES，否则裁剪会静默丢状态。
*
* @module mbsf-compaction/session-prune
*/
const ZSTD_MAGIC$1 = 4247762216;
/** 与 DSH 写入侧一致的 zstd 参数：开启 content checksum（读侧校验依赖它）。 */
const ZSTD_CHECKSUM_PARAMS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } };
/** 结构不完整的末帧恢复参数：解到当前 flush 点为止（与 DSH torn-tail 恢复一致）。 */
const ZSTD_INCOMPLETE_PARAMS = { finishFlush: constants.ZSTD_e_flush };
/**
* 结构扫描拼接 zstd 流：读帧头描述符 + 逐块块头定位完整帧，不依赖魔数
* 搜索（压缩内容里出现的魔数序列不会误切帧），与 DSH 写入侧的
* scanZstdFrames 同构。EOF 落在某帧内部时返回该帧起点作为 tornStart。
*/
function scanZstdFrames(buffer) {
	const frames = [];
	let offset = 0;
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) return {
			frames,
			tornStart: start
		};
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC$1) throw new Error(`corrupt Zstandard session log: invalid frame magic at byte ${offset}`);
		offset += 4;
		if (offset === buffer.length) return {
			frames,
			tornStart: start
		};
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) throw new Error(`corrupt Zstandard session log: reserved frame-header bit at byte ${offset - 1}`);
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) return {
			frames,
			tornStart: start
		};
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) return {
				frames,
				tornStart: start
			};
			const blockHeader = buffer.readUIntLE(offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) throw new Error(`corrupt Zstandard session log: reserved block type at byte ${offset - 3}`);
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) return {
				frames,
				tornStart: start
			};
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) return {
				frames,
				tornStart: start
			};
			offset += 4;
		}
		frames.push({
			start,
			end: offset
		});
	}
	return { frames };
}
/**
* 解码完整日志：zstd 模式按结构扫描逐帧解压拼接后按行解析；plaintext
* 模式直接按行解析。完整帧内的记录必须以换行收尾（写侧保证），否则视为
* 半个 JSONL 记录抛错；结构不完整的末帧只恢复以换行收尾的完整行（半行
* 丢弃——与 DSH torn-tail 语义一致），不可恢复则跳过。解析失败抛错
* （调用方捕获后跳过）。
*/
function decodeSessionLog(buffer, zstd) {
	const events = [];
	let header;
	const consume = (lines) => {
		for (const line of lines) {
			if (line.trim() === "") continue;
			const parsed = JSON.parse(line);
			if (header === void 0 && parsed.type === "session") header = parsed;
			else events.push(parsed);
		}
	};
	if (zstd) {
		const { frames, tornStart } = scanZstdFrames(buffer);
		if (frames.length === 0) throw new Error("no complete zstd frame found");
		for (const frame of frames) {
			const decoded = zstdDecompressSync(buffer.subarray(frame.start, frame.end)).toString("utf8");
			if (decoded.length > 0 && !decoded.endsWith("\n")) throw new Error("corrupt Zstandard session log: complete frame contains a torn JSONL record");
			consume(decoded.split("\n"));
		}
		if (tornStart !== void 0) try {
			const decoded = zstdDecompressSync(buffer.subarray(tornStart), ZSTD_INCOMPLETE_PARAMS).toString("utf8");
			const lastNewline = decoded.lastIndexOf("\n");
			if (lastNewline !== -1) consume(decoded.slice(0, lastNewline + 1).split("\n"));
		} catch {}
	} else consume(buffer.toString("utf8").split("\n"));
	if (header === void 0) throw new Error("log has no session header line");
	return {
		header,
		events,
		zstd
	};
}
/**
* 编码裁剪后的日志为 DSH 兼容字节：**header 一帧 + 每行一帧**。
*
* ## ⚠️ 分帧方式是与 App 读侧的**物理契约**（2026-10-02 事故根因）
*
* 曾经这里把**整个 body 压成 1 帧**（header 帧 + body 帧 = 共 2 帧）。注释当时
* 写的是「header 帧 + 单事件帧」，**代码与注释不符**，而后果直到用户打开会话
* 才暴露：2026-10-02 21:55 那次清理把 9 个会话剪成 2 帧产物，
* App 侧**读不出内容**（会话列表点开是空的），而 `cleanup-stats.json` 里
* `failed: 0, restored: 0` —— **零报错**。
*
* 为什么 2 帧会坏：App 的 `readZstdPrefix` / `decodeCurrentGeneration` 按
* **帧边界**做增量读取（append-only 语义——每帧是一个可独立解出的物理块），
* 并把**首帧**当作独立 header 校验（`assertIndependentHeaderFrame`）。
* 单帧大块破坏了「帧 = 增量单位」这一前提。
*
* **实测对照**（2026-10-02）：
*  · 健康原件：13,147 帧（一行一帧）；
*  · 剪坏产物：**2 帧** ⟹ 会话打不开。
*
* 故此处**必须逐行成帧**。压缩比会略降（每帧有约 9 字节帧头），
* 但这是正确性代价，不可省。
*/
function encodeSessionLog(header, events, zstd) {
	const headerLine = JSON.stringify(header) + "\n";
	if (!zstd) {
		const body = events.map((event) => JSON.stringify(event)).join("\n") + "\n";
		return Buffer.from(headerLine + body, "utf8");
	}
	const frames = [zstdCompressSync(Buffer.from(headerLine, "utf8"), ZSTD_CHECKSUM_PARAMS)];
	for (const event of events) frames.push(zstdCompressSync(Buffer.from(`${JSON.stringify(event)}\n`, "utf8"), ZSTD_CHECKSUM_PARAMS));
	return Buffer.concat(frames);
}
/**
* token meter 规则的 step 配对检测：返回违规事件 seq 列表。
*
* 规则（与 token meter `_foldEvent` 逐条对齐，2026-09-26 补 START_WHILE_OPEN）：
*  - assistant/message 与 step/end 必须落在「当前打开的 step/start 的同
*    turn/step」内；step/end 闭合后 open 清空；
*  - **step/start 到达时 open 必须为空**——未闭合就开下一个 = 违规
*    （token meter 抛 "step/start ... arrived before turn X/step Y ended"）。
*    2026-09-26 修复：旧实现直接覆盖 open，漏检此形态；剪裁管线产出的
*    孤儿 step/start（6b6d48c3/a287c0b1/7a66a93c 三例）因此通过三重验证
*    写盘，token meter 重放抛错 → 会话压缩全面停摆 → 上下文爆表 400。
*  - chunk 打包行（text-chunks 等物理行）不参与配对。
* 只读检测——B' 裁剪后先 repair 再验证 CLEAN。
*/
function detectStepViolations(events) {
	const bad = [];
	let open = null;
	for (const event of events) {
		const data = event.data;
		if (event.type === "step/start") {
			if (open !== null) bad.push(event.seq);
			open = {
				turn: data?.turn ?? -1,
				step: data?.step ?? -1
			};
		} else if (event.type === "assistant/message" || event.type === "step/end" || event.type === "system/message" || event.type === "developer/message" || event.type === "assistant/attempt") {
			const need = {
				turn: data?.turn ?? -1,
				step: data?.step ?? -1
			};
			if (!(open !== null && open.turn === need.turn && open.step === need.step)) bad.push(event.seq);
			if (event.type === "step/end") open = null;
		}
	}
	return bad;
}
/** 轮次边界事件类型（锚点底线计数口径 = **回合数**，2026-09-10 一帆澄清
*  「10 条」= 10 轮：一个回合通常只有 2 条消息 + 若干工具结果，按消息数
*  会低估历史深度）。 */
const TURN_BOUNDARY_TYPES = /* @__PURE__ */ new Set(["turn/end"]);
/**
* 裁剪**补造** `turn/end` 时写入的 reason。
*
* ── 为什么必须写（2026-11-13 一帆「剪裁隐患」定案）────────────────────
* DSH 的类型声明把 `reason` 定为 `turn/end` 的**必填**字段：
*
*     'turn/end': { turn: number; reason: TurnEndReason }
*
* 而 0.2.2-rc.2 的多条读取路径直接取 `event.data.reason.kind` **不带 `?.`**
* （`dsh-session-query:turnEndText`、`dsh-api-session-controller` 的
* continuation fold、`dsh-session-telemetry`、`dsh-subagent.epochStopReason`、
* `dsh-goal-round-driver`）——`reason` 缺席即抛
* `Cannot read properties of undefined (reading 'kind')`，整会话「历史
* 加载失败」。本文件原先 4 处补造只写 `{ turn }`，**违反该契约**：被本工具
* 裁剪过的会话一旦进新宿主就崩。
*
* ── 为什么是 `interrupted` 而不是 `aborted`（2026-11-13 二轮修正）──────
* 曾先选 `aborted`，**是错的**：`TurnEndReasonMap` 里
*
*     aborted: { kind: 'aborted'; reason: TurnEndCancelCause }   ← 子字段必填
*
* 而 `dsh-goal-round-driver` 读的是 `event.data.reason.reason.kind`——
* 只补 `{kind:'aborted'}` 会在**下一层**再抛同一个错（实测 `019281e6` 补
* aborted 后仍加载失败）。`interrupted` 无任何必填子字段，且官方注释写明
* 它的语义就是「crash-orphaned turn 被事后关闭」（agent-loop resume /
* session-query 冷读都会合成它）——与本工具「turn 开了但没关、结尾被裁掉」
* 的场景**完全同义**。`completed` 会谎报正常结束，`error` 要造失败事实。
*/
const PRUNED_TURN_END_REASON = { kind: "interrupted" };
/**
* `turn/end.reason` 是否满足**变体自身的必填字段**（不只是 kind 存在）。
*
* 各变体必填（`TurnEndReasonMap`）：
*   · `completed` / `blocked` / `max-tokens` / `interrupted` —— 仅 kind
*   · `aborted` —— **必须**有 `reason: TurnEndCancelCause`
*   · `error`   —— **必须**有 `error: LlmFailure`
*
* 只检查 kind 存在是不够的：`{kind:'aborted'}` 能骗过第一层读取，却会在
* 读 `reason.reason.kind` 的地方崩（2026-11-13 实测先例）。
*/
function isTurnEndReasonComplete(reason) {
	if (reason === void 0 || typeof reason.kind !== "string") return false;
	if (reason.kind === "aborted") return reason.reason !== void 0 && reason.reason !== null;
	if (reason.kind === "error") return reason.error !== void 0 && reason.error !== null;
	return true;
}
/**
* 给不合规的 `turn/end` 补上收口语义（合规归一化）。
*
* 与 {@link PRUNED_TURN_END_REASON} 的区别：那是**补造**新事件，这里是
* **修复已存在的**不合规事件。触发场景：2026-09-27 ~ 11-01 之间的 DSH
* 写入的 `turn/end` 普遍不带 `reason`（实测 `session-85e550b6` 120/135、
* `session-f6ffb7bc` 604/3888、`session-019281e6` 3/17），这些会话在
* 0.2.2-rc.2 上「历史加载失败」。
*
* 剪裁本来就在重写整个会话文件 ⟹ 这里是唯一的修复点。只补 `reason`，
* **不动任何其他字段**；已合规的事件原样返回（同引用）。
*
* @param event - 待检查的 `turn/end` 事件（其他类型不应传入）。
* @returns 原事件（合规）或带 `reason` 的浅拷贝（不合规）。
*/
function withTurnEndReason(event) {
	const data = event.data;
	if (isTurnEndReasonComplete(data?.reason)) return event;
	return {
		...event,
		data: {
			...data,
			reason: { ...PRUNED_TURN_END_REASON }
		}
	};
}
/**
* 从后往前扫一个帧的行数组：遇无 error compaction/end 置 endSeen；遇
* compaction/start 且 endSeen（其后已见无 error end）= 锚点候选。**锚点
* 底线**（2026-09-10）：候选锚点之后已见的**完整回合数** ≥ minTurns 才
* 采用（保证重置后会话里仍看得到最近若干轮对话）；未达底线则把该行按
* 普通行收集并记作兜底，继续往前找更早的锚点——全程未达底线就用最早的
* 兜底锚点（宁可多留历史，不可裁空）。minTurns = 0 时行为与旧版一致
* （第一个候选即采用）。提取该行（含）之后的全部行并返回锚点 seq；整帧
* 未命中则把全部行收集进 collected（锚点在更早帧）。返回 undefined 表示
* 本帧未命中。
*/
function scanBackward(lines, state, minTurns) {
	for (let j = lines.length - 1; j >= 0; j--) {
		const line = lines[j];
		if (line === void 0 || line.trim() === "") continue;
		let ev;
		try {
			ev = JSON.parse(line);
		} catch {
			continue;
		}
		if (ev.type === "compaction/end") {
			const error = ev.data?.error;
			if (error === void 0 || error === null || error === "") state.endSeen = true;
			continue;
		}
		if (ev.type === "compaction/start" && state.endSeen) {
			const error = ev.data?.error;
			if (error === void 0 || error === null || error === "") {
				const anchor = JSON.parse(line);
				if (state.turns < minTurns) {
					state.fallback = {
						anchorSeq: anchor.seq,
						rows: [...normalizeAnchorRow(lines.slice(j)).rows, ...state.collected]
					};
					continue;
				}
				const kept = normalizeAnchorRow(lines.slice(j)).rows;
				for (let k = kept.length - 1; k >= 0; k--) {
					const keep = kept[k];
					if (keep !== void 0 && keep.trim() !== "") state.collected.unshift(keep);
				}
				return { anchorSeq: anchor.seq };
			}
		}
		if (typeof ev.type === "string" && TURN_BOUNDARY_TYPES.has(ev.type)) state.turns += 1;
	}
	for (let k = lines.length - 1; k >= 0; k--) {
		const keep = lines[k];
		if (keep === void 0 || keep.trim() === "") continue;
		state.collected.unshift(keep);
		try {
			const ev = JSON.parse(keep);
			if (typeof ev.type === "string" && TURN_BOUNDARY_TYPES.has(ev.type)) state.turns += 1;
		} catch {}
	}
}
/** 从明文行数组（事件行，不含 header）反向找锚点并提取尾部。 */
function extractTailFromLines(eventLines, header, minTurns = 0) {
	const state = {
		endSeen: false,
		collected: [],
		turns: 0,
		fallback: void 0
	};
	const hit = scanBackward(eventLines, state, minTurns);
	if (hit !== void 0) return {
		header,
		rows: state.collected,
		anchorSeq: hit.anchorSeq
	};
	if (state.fallback !== void 0) return {
		header,
		rows: state.fallback.rows,
		anchorSeq: state.fallback.anchorSeq
	};
}
/**
* B' 锚点提取：从日志字节中提取「最后一个完整 compaction 段及其后全部
* 事件」的原始行，不全量解码（zstd 模式逐帧从后往前解压，找到锚点即停，
* 只保留尾部增量行——大文件内存峰值 ~12MB vs 全量解码 844MB）。
*
* 锚点定义：最后一个无 error 的 compaction/start，且其后（跨帧累积）已
* 见无 error 的 compaction/end。不要求 start/end 同帧（跨帧配对），不
* 要求帧内含 summary/checkpoint（行级切分避免孤儿 summary 进产物）。
* 找不到锚点（无完整 compaction 段）返回 undefined。
*
* **锚点底线 minTurns**（2026-09-10）：若最近锚点之后的**完整回合数**不足
* 这个数，就回退到更早的锚点（多留历史），保证重置/裁剪后会话里仍看得到
* 最近若干轮对话——「不管上限调多小，都显示最近 N 轮」的落地。
*/
/** 剪裁产物必须自带的 turn 骨架事件（DSH 新校验：system/message 需要 protected head）。 */
const HEAD_EVENT_TYPES = /* @__PURE__ */ new Set([
	"turn/start",
	"step/start",
	"system/message",
	"step/end",
	"turn/end"
]);
/**
* 收集原日志开头的完整 turn 骨架（turn/start → step/start → system/message → step/end → turn/end）。
*
* 剪裁只保留尾部时这段会被丢掉，产物再无 system/message ⟹ DSH 新版读侧报
* `system/message requires a protected first surface head` / `step/start does not match
* the open turn and next step`（2026-11-17 事故：两个会话打不开）。这里把它捞回来，
* 作为产物的 turn 1。
*/
function collectHeadRows(buffer, zstd) {
	const lines = [];
	if (!zstd) {
		for (const l of buffer.toString("utf8").split("\n")) if (l.trim() !== "") lines.push(l);
	} else {
		const { frames } = scanZstdFrames(buffer);
		for (let i = 0; i < Math.min(frames.length, 20); i++) {
			try {
				const plain = zstdDecompressSync(buffer.subarray(frames[i].start, frames[i].end)).toString("utf8");
				for (const l of plain.split("\n")) if (l.trim() !== "") lines.push(l);
			} catch {
				break;
			}
			if (lines.length > 800) break;
		}
	}
	const head = [];
	let started = false;
	let closed = false;
	for (const line of lines) {
		let e;
		try {
			e = JSON.parse(line);
		} catch {
			continue;
		}
		if (e.type === "session") continue;
		if (!started) {
			if (e.type !== "turn/start") continue;
			started = true;
		}
		if (HEAD_EVENT_TYPES.has(e.type)) head.push(line);
		if (e.type === "turn/end") {
			closed = true;
			break;
		}
	}
	return closed ? head : [];
}
/**
* 把尾部行的 turn 编号整体重排为从 `startTurn` 起的连续编号（按首次出现顺序）。
*
* 剪裁产物里 head 占 turn 1，尾部必须从 turn 2 开始且连续——否则 DSH 的
* `turn/start does not open the expected turn` 立刻拒绝。
*/
function renumberTurns(rows, startTurn) {
	const parsed = [];
	for (const line of rows) try {
		parsed.push(JSON.parse(line));
	} catch {
		parsed.push(void 0);
	}
	const order = [];
	for (const e of parsed) {
		const t = e?.data?.turn;
		if (typeof t === "number" && !order.includes(t)) order.push(t);
	}
	if (order.length === 0) return [...rows];
	const map = new Map(order.map((t, i) => [t, startTurn + i]));
	return parsed.map((e, i) => {
		const d = e?.data;
		if (e === void 0 || typeof d?.turn !== "number" || !map.has(d.turn)) return rows[i];
		d.turn = map.get(d.turn);
		return JSON.stringify(e);
	});
}
function extractTailRows(buffer, zstd, minTurns = 0) {
	if (!zstd) {
		const lines = buffer.toString("utf8").split("\n");
		let header;
		const eventLines = [];
		for (const line of lines) {
			if (line.trim() === "") continue;
			if (header === void 0) try {
				const parsed = JSON.parse(line);
				if (parsed.type === "session") {
					header = parsed;
					continue;
				}
			} catch {
				return;
			}
			eventLines.push(line);
		}
		if (header === void 0) return void 0;
		return extractTailFromLines(eventLines, header, minTurns);
	}
	const { frames, tornStart } = scanZstdFrames(buffer);
	if (frames.length === 0) return void 0;
	let header;
	try {
		const firstPlain = zstdDecompressSync(buffer.subarray(frames[0].start, frames[0].end)).toString("utf8");
		for (const line of firstPlain.split("\n")) {
			if (line.trim() === "") continue;
			try {
				const parsed = JSON.parse(line);
				if (parsed.type === "session") {
					header = parsed;
					break;
				}
			} catch {
				return;
			}
		}
	} catch {
		return;
	}
	if (header === void 0) return void 0;
	const state = {
		endSeen: false,
		collected: [],
		turns: 0,
		fallback: void 0
	};
	if (tornStart !== void 0) try {
		const plain = zstdDecompressSync(buffer.subarray(tornStart), ZSTD_INCOMPLETE_PARAMS).toString("utf8");
		const lastNewline = plain.lastIndexOf("\n");
		if (lastNewline !== -1) {
			const hit = scanBackward(plain.slice(0, lastNewline + 1).split("\n"), state, minTurns);
			if (hit !== void 0) return {
				header,
				rows: state.collected,
				anchorSeq: hit.anchorSeq
			};
		}
	} catch {}
	for (let i = frames.length - 1; i >= 0; i--) {
		let plain;
		try {
			plain = zstdDecompressSync(buffer.subarray(frames[i].start, frames[i].end)).toString("utf8");
		} catch {
			continue;
		}
		const hit = scanBackward(plain.split("\n"), state, minTurns);
		if (hit !== void 0) return {
			header,
			rows: state.collected,
			anchorSeq: hit.anchorSeq
		};
	}
	if (state.fallback !== void 0) return {
		header,
		rows: state.fallback.rows,
		anchorSeq: state.fallback.anchorSeq
	};
}
/** chunk 打包行类型（DSH schema-17 物理行——envelope 只有 seq0/time0/data）。 */
const CHUNK_ROW_TYPES = /* @__PURE__ */ new Set([
	"text-chunks",
	"reasoning-chunks",
	"tool-call-chunks"
]);
/** chunk 行的逻辑成员数（texts/args 数组长度）。 */
function chunkMemberCount(event) {
	const data = event.data;
	if (Array.isArray(data?.texts)) return data.texts.length;
	if (Array.isArray(data?.args)) return data.args.length;
	return 0;
}
/**
* 固定密度启发式定价——与 `@deepseek-ai/dsh-token-meter` 的 `estimate.ts`
* **逐字同式**（CHARS_PER_TOKEN=4 · BLOCK_OVERHEAD=4 · ROLE_OVERHEAD=4）。
*
* **为什么本地复刻而不 import**：`dsh-token-meter` 的 package exports 只开放
* 包根（`TokenMeter` 类，需 cordis ctx 注入），深层 `lib/types/estimate.js`
* 被 exports map 拒绝（`ERR_PACKAGE_PATH_NOT_EXPORTED`——2026-09-26 实测）。
* 本模块是纯函数（无 ctx）——复刻公式 + 交叉核对测试（对同一批真实消息与
* 官方输出逐值比对，见 session-prune.spec.ts）是可行路径。**公式若在上游
* 变更，交叉核对测试会失败**（fail-loud 而非静默漂移）。
*/
/** token 估算启发式（复刻官方 `estimateContent` 口径——见上方注释）。
*  [OBS] 估算常数（**不是内容常数**）：4 chars/token + 每块 4 + 每 role 4。
*  来自官方实现（本包无法 import——exports map 拒绝），靠
*  `session-prune.spec.ts` 与官方输出逐值比对交叉核对；上游变更时测试会红。 */
const HEURISTIC_CHARS_PER_TOKEN = 4;
const HEURISTIC_BLOCK_OVERHEAD = 4;
const HEURISTIC_ROLE_OVERHEAD = 4;
/** 单块启发式定价（对应官方 `estimateStructuralBlock` / `estimateContent` 分支）。 */
function estimateHeuristicBlock(block) {
	const b = block;
	switch (b.type) {
		case "text":
		case "reasoning": return Math.ceil(String(b.text ?? "").length / HEURISTIC_CHARS_PER_TOKEN) + HEURISTIC_BLOCK_OVERHEAD;
		case "tool-call": return Math.ceil(String(b.name ?? "").length / HEURISTIC_CHARS_PER_TOKEN) + Math.ceil(String(b.arguments ?? "").length / HEURISTIC_CHARS_PER_TOKEN) + HEURISTIC_BLOCK_OVERHEAD;
		case "tool-result": return estimateHeuristicContent(Array.isArray(b.content) ? b.content : []) + HEURISTIC_BLOCK_OVERHEAD;
		default: return HEURISTIC_BLOCK_OVERHEAD + Math.ceil(JSON.stringify(block).length / HEURISTIC_CHARS_PER_TOKEN);
	}
}
/** 内容块列表定价（对应官方 `estimateContent`）。 */
function estimateHeuristicContent(blocks) {
	let tokens = 0;
	for (const block of blocks) tokens += estimateHeuristicBlock(block);
	return tokens;
}
/** 单条消息定价（对应官方 `estimateMessage`——system 走独立分支）。 */
function estimateHeuristicMessage(message) {
	const content = Array.isArray(message.content) ? message.content : [];
	if (message.role === "system") {
		if (content.length === 0) return 0;
		let characters = 0;
		for (const block of content) {
			const b = block;
			characters += b.type === "text" ? String(b.text ?? "").length : JSON.stringify(block).length;
		}
		return Math.ceil(characters / HEURISTIC_CHARS_PER_TOKEN) + HEURISTIC_ROLE_OVERHEAD;
	}
	return estimateHeuristicContent(content) + HEURISTIC_ROLE_OVERHEAD;
}
/** 从 checkpoint 事件取 `data.source.compactionId`（无则 undefined）。 */
function checkpointCompactionId(event) {
	const source = event.data?.source;
	return typeof source?.compactionId === "string" ? source.compactionId : void 0;
}
/**
* 判「该事件是否为 compaction 检查点帧」——**兼容 v3/v4 两代结构**（单一真源）。
*
* 【2026-09-29 立 · 判据统一】两代会话格式对检查点的标记方式不同：
*   · **v3**（`session.v3.jsonl.zstd`）：`data.source.plugin === 'compact'`
*   · **v4**（`session.v4.jsonl.zstd`）：`data.source.kind === 'compact-checkpoint'`
*
* **实测（2026-09-29，会话库全扫）**：两形态**零交集**——同一会话文件里只有其中一种。
*   v3 样本：`plugin==compact` 28/1/1 命中 · `kind==compact-checkpoint` **0**
*   v4 样本：`kind==compact-checkpoint` 56/1/1 命中 · `plugin==compact` **0**
*
* **为什么立这个函数**（而不是在两处各写一遍判据）：
*   本文件原本有**两份**同类判据——`normalizeCompactArtifact` 只认 v4（`src?.kind`），
*   后置覆盖 pass 只认 v3（`source?.plugin`）。**两份判据各漏一代** ⟹
*   后置覆盖 pass 在 v4 会话上完全不触发（救援 goal 行泄漏到表面 · resume 后旧轮次
*   提示混进当前对话；实测 5 个 v4 会话泄漏 436 条）。**同族：R103「判据只允许一份」。**
*
* **边界（诚实声明）**：本函数判「是不是检查点帧」，不判「该帧是否悬空/是否应转 append」
*   ——后者由调用方按各自纪律决定（见 `normalizeCompactArtifact` 第 2+3 步注释）。
*/
function isCompactCheckpoint(event) {
	const source = event.data?.source;
	if (source === void 0 || source === null || typeof source !== "object") return false;
	return source.plugin === "compact" || source.kind === "compact-checkpoint";
}
/**
* 同步 compaction 影子价格：把 checkpoint 重算后的 replace 区间回写到其
* `compactionId` 对应 summary 的 `shadowedRange` / `shadowedSeqs` /
* `shadowedTokenCount`。
*
* **为什么必须同步**（2026-09-26 定位——token-meter 影子价格契约）：
* `@deepseek-ai/dsh-token-meter` 的 `foldSurfaceProjection` 把
* `compaction/summary` 当作「影子价格宣告」（claim），要求**紧邻的下一个
* replace** 的区间与之**逐值相等**——不等即抛
* `has no adjacent shadow price (armed claim covers …)`，整个会话在 GUI
* 读侧不可加载（实测 a287c0b1 事故：summary 保留旧值 3534-4087，checkpoint
* 被后置覆盖 pass 重算为 119-863）。
*
* 剪裁管线里两个 pass 会重算 checkpoint 的 replace 区间（收窄 / 后置覆盖），
* 但 summary 的 range 走的是**另一条路**（引用重映射）——当 summary 的
* `shadowedSeqs` 全部落在裁剪线外（remap 失败）时，它按「两字段永不删」
* 纪律**保留原值（旧 seq）**，而 checkpoint 的 replace 已被重算为新 seq ⟹
* 两者不一致。本函数把重算结果回写，消除该不一致。
*
* 回写内容：
*  - `shadowedRange` = 新 replace 区间端点（与 `shadowedSeqs` 首尾一致——官方判据①）；
*  - `shadowedSeqs` = 跨度内全部节点（升序，与 checkpoint 的 sourceEventSeqs 同集合）；
*  - `shadowedTokenCount` = 跨度内节点的启发式估值之和（本地复刻公式——见上方注释）。
*
* 找不到对应 summary（无 compactionId / 非 summary 载体）→ 静默跳过。
*
* @param out - 产物事件数组（原地回写）。
* @param eventBySeq - 新 seq → 事件（估值用）。
* @param compactionId - checkpoint 的 `data.source.compactionId`。
* @param span - 重算后的表面跨度（新 seq，升序）。
*/
function syncSummaryShadowPrice(out, eventBySeq, compactionId, span) {
	if (compactionId === void 0 || span.length === 0) return;
	for (const event of out) {
		if (event.type !== "compaction/summary") continue;
		const data = event.data;
		if (data?.compactionId !== compactionId) continue;
		const seqs = [...span];
		let tokens = 0;
		for (const seq of seqs) {
			const node = eventBySeq.get(seq);
			if (node === void 0) continue;
			const message = deriveEventMessage(node);
			if (message !== null) tokens += estimateHeuristicMessage(message);
		}
		data.shadowedSeqs = flatSeqs(seqs);
		data.shadowedRange = {
			start: seqs[0],
			end: seqs[seqs.length - 1]
		};
		data.shadowedTokenCount = tokens;
		return;
	}
}
/**
* B' 内联修复：对提取尾部行执行
*  1. step 配对修复——在违规的 assistant/message 或 step/end 前补插
*     step/end（闭合旧 step）+ step/start（打开新 step）；
*  2. 逻辑 seq 重编号 0 起连续——消息级 seq = 计数器++；chunk 行
*     seq0 = 计数器（成员按 texts/args 长度推进计数器）。**chunk 行不
*     添加 seq 字段**（DSH 打包格式 envelope 只有 seq0/time0/data，加
*     seq 字段即破坏 validateRow 的 hasExactKeys 校验）；
*  3. 引用重映射——sourceEventSeqs / data.shadowedSeqs / data.shadowedRange
*     按旧→新 seq 映射表平移；映射不到（引用被裁历史）= 坏引用保留原值
*     （两字段永不删——见下注释），空则删字段；
*  3b. **影子价格同步**（2026-09-26 新增）：收窄 / 后置覆盖 pass 重算
*     checkpoint 的 replace 区间后，把结果回写到其 `compactionId` 对应
*     summary 的 `shadowedRange`/`shadowedSeqs`/`shadowedTokenCount`——
*     否则 token-meter 的 `foldSurfaceProjection` 契约（claim 区间必须 =
*     紧邻 replace 区间）被违反，整条日志在 GUI 读侧抛错不可加载；
*  4. surfaceOp replace **收窄**（2026-09-25 修订——取代旧「无条件归一
*     append」）：被折叠区间随裁剪消失后，checkpoint 的 replace 区间按
*     「存活阴影节点的表面跨度」重算——存活非空 → 保留 replace（区间 =
*     表面位置上首末存活节点；`sourceEventSeqs` 同步 = 跨度内全部节点，
*     满足宿主 `assertProvenance` 的「必须含每个阴影节点」）；存活为空 →
*     归一 append。**障碍保护**：跨度内若含「原文可见」节点（旧 seq ∈
*     finalSurface）→ 收缩到不含可见节点的单侧连续段，绝不吞可见内容。
*  5. **后置覆盖 pass**（2026-09-25 新增）：主 pass 结束后，表面上仍残留
*     「原文不可见」（旧 seq ∉ finalSurface）的节点（典型 = 救援注入的
*     goal 轮次行——阴影它们的 op 在锚点之前、已随裁剪消失）→ 由锚点段
*     checkpoint 承担覆盖（区间 = 残留节点的连续跨度；约束 = 跨度内不得
*     含可见节点，否则收缩到安全子段）。
*
* 不修改调用方行数组（新分配事件对象）。返回修复后事件与补插数。
*/
/**
* 把「seq 引用列表」打平成**扁平的非负整数数组**（2026-10-03 补）。
*
* **为什么必须做**：DSH 的 `assertSourceEventReferences` 要求
* `sourceEventSeqs` 是扁平的非负安全整数数组：
*   `session event "<type>" sourceEventSeqs must densely contain
*    non-negative safe integers`
* 嵌套元素（如 `[587, [589, 591], 592]`）直接判非法 ⟹ `foldSurface` 抛错
* ⟹ **会话投影不出任何消息** ⟹ 界面「有列表、点开是空的」。
*
* 历史产物里确有此类嵌套（实测 -232c-49 19 处 / 293c2740 1 处）——它经
* `shadowedSeqs` → `summaryShadow` → `span` → `sourceEventSeqs` 自我
* 强化传播。本函数是**兜底打平**，与 `shadowCandidates` 源头打平配套。
*
* 打平语义：递归展开、只保留非负安全整数、去重、升序（升序是 DSH 的
* `densely` 契约所要求的形态）。
*/
function flatSeqs(value) {
	const out = [];
	const take = (v) => {
		if (Array.isArray(v)) {
			for (const item of v) take(item);
			return;
		}
		if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) out.push(v);
	};
	take(value);
	return [...new Set(out)].sort((a, b) => a - b);
}
function repairPrunedTail(rows, options = {}) {
	const parsed = rows.filter((line) => line.trim() !== "").map((line) => JSON.parse(line));
	const events = [];
	{
		const kindOf = (event) => event.data?.source?.kind;
		let humanSeen = false;
		for (const event of parsed) {
			if (event.type === "session-log-deepseek/delivery-accepted") continue;
			if ((event.type === "session/title" || event.type === "session/title-llm-request") && !humanSeen && kindOf(event) !== "user") continue;
			events.push(event);
			if (event.type === "user/message" && kindOf(event) === "user") humanSeen = true;
		}
	}
	const out = [];
	/** 旧逻辑 seq → 新逻辑 seq（含 chunk 成员：seq0+i → 新 seq）。 */
	const seqMap = /* @__PURE__ */ new Map();
	/**
	* 新逻辑 seq → 事件元信息（type/turn/step），供引用重映射做同 turn/step
	* 校验。2026-09-10 加固：旧实现只查「映射得到吗」，拼接产物里残留的跨
	* turn/step 引用会被放行——ddc848bc 的 2 条 message 就是这么漏过的
	* （memory/2026-09-10.md E.364）。
	*/
	const seqMeta = /* @__PURE__ */ new Map();
	/** 带引用字段的事件：遍历后统一重映射（引用只指向更早事件，遍历完映射已完整）。 */
	const pendingRefs = [];
	let open = null;
	let inserted = 0;
	let next = 0;
	/** 为事件分配新逻辑 seq（消息级 seq / chunk 行 seq0），并登记旧→新映射。 */
	const assignSeq = (event) => {
		const meta = event.data;
		if (CHUNK_ROW_TYPES.has(event.type)) {
			const members = chunkMemberCount(event);
			const seq0 = event.seq0;
			if (typeof seq0 === "number") {
				for (let i = 0; i < members; i++) {
					seqMap.set(seq0 + i, next + i);
					seqMeta.set(next + i, {
						type: "assistant/chunk",
						...meta?.turn !== void 0 ? { turn: meta.turn } : {},
						...meta?.step !== void 0 ? { step: meta.step } : {}
					});
				}
				event.seq0 = next;
			}
			next += members;
			return;
		}
		if (typeof event.seq === "number") {
			const old = event.seq;
			event.seq = next;
			seqMap.set(old, next);
			seqMeta.set(next, {
				type: event.type,
				...meta?.turn !== void 0 ? { turn: meta.turn } : {},
				...meta?.step !== void 0 ? { step: meta.step } : {}
			});
			next += 1;
		}
	};
	/** 事件是否带引用字段（需要遍历后重映射）。 */
	const hasRefs = (event) => {
		if (Array.isArray(event.sourceEventSeqs)) return true;
		const data = event.data;
		if (data !== void 0 && (Array.isArray(data.shadowedSeqs) || data.shadowedRange !== void 0)) return true;
		if (data !== void 0 && Array.isArray(data.messageSeqs)) return true;
		return false;
	};
	for (const event of events) {
		const data = event.data;
		if (event.type === "step/start") {
			if (open !== null) {
				const t = typeof event.time === "number" ? event.time : Date.now();
				out.push({
					type: "step/end",
					seq: next,
					time: t - 2,
					data: {
						turn: open.turn,
						step: open.step
					}
				});
				next += 1;
				inserted++;
				open = null;
			}
			open = {
				turn: data?.turn ?? -1,
				step: data?.step ?? -1
			};
			assignSeq(event);
			out.push(event);
			continue;
		}
		if (event.type === "assistant/message" || event.type === "step/end" || event.type === "system/message" || event.type === "developer/message" || event.type === "assistant/attempt") {
			const need = {
				turn: data?.turn ?? -1,
				step: data?.step ?? -1
			};
			if (!(open !== null && open.turn === need.turn && open.step === need.step)) {
				const t = typeof event.time === "number" ? event.time : Date.now();
				if (open !== null) {
					out.push({
						type: "step/end",
						seq: next,
						time: t - 2,
						data: {
							turn: open.turn,
							step: open.step
						}
					});
					next += 1;
				}
				out.push({
					type: "step/start",
					seq: next,
					time: t - 1,
					data: {
						turn: need.turn,
						step: need.step
					}
				});
				next += 1;
				inserted++;
				open = need;
			}
			assignSeq(event);
			out.push(event);
			if (event.type === "step/end") open = null;
			if (hasRefs(event)) pendingRefs.push(event);
			continue;
		}
		assignSeq(event);
		out.push(event);
		if (hasRefs(event)) pendingRefs.push(event);
	}
	const summaryShadow = /* @__PURE__ */ new Map();
	for (const event of out) {
		if (event.type !== "compaction/summary") continue;
		const data = event.data;
		if (typeof data?.compactionId !== "string" || !Array.isArray(data.shadowedSeqs)) continue;
		summaryShadow.set(data.compactionId, flatSeqs(data.shadowedSeqs));
	}
	for (const event of pendingRefs) {
		const remap = (value) => seqMap.get(value);
		if (Array.isArray(event.sourceEventSeqs)) {
			const mapped = [];
			const owner = event.type === "assistant/message" ? event.data : void 0;
			for (const source of flatSeqs(event.sourceEventSeqs)) {
				const mappedSeq = remap(source);
				if (mappedSeq === void 0 || mappedSeq >= event.seq || mapped.includes(mappedSeq)) continue;
				if (owner !== void 0) {
					const meta = seqMeta.get(mappedSeq);
					if (meta !== void 0 && meta.turn !== void 0 && meta.step !== void 0 && (meta.turn !== owner.turn || meta.step !== owner.step)) continue;
				}
				mapped.push(mappedSeq);
			}
			if (mapped.length > 0) event.sourceEventSeqs = mapped;
			else delete event.sourceEventSeqs;
		}
		const refData = event.data;
		if (refData !== void 0) {
			if (Array.isArray(refData.messageSeqs)) {
				const mapped = [];
				for (const source of refData.messageSeqs) {
					const mappedSeq = remap(source);
					if (mappedSeq === void 0 || mappedSeq >= event.seq || mapped.includes(mappedSeq)) continue;
					const target = out[mappedSeq];
					if (target === void 0 || target.type !== "user/message") continue;
					if (target.data?.source?.kind !== "user") continue;
					mapped.push(mappedSeq);
				}
				refData.messageSeqs = refData.source?.kind === "user" ? [] : mapped;
			}
			const range = refData.shadowedRange;
			const hasRange = range !== void 0 && typeof range.start === "number" && typeof range.end === "number";
			if (Array.isArray(refData.shadowedSeqs)) {
				const mapped = [];
				for (const source of refData.shadowedSeqs) {
					const mappedSeq = remap(source);
					if (mappedSeq !== void 0 && mappedSeq < event.seq && !mapped.includes(mappedSeq)) mapped.push(mappedSeq);
				}
				if (mapped.length > 0) {
					refData.shadowedSeqs = mapped;
					if (hasRange) {
						range.start = mapped[0];
						range.end = mapped[mapped.length - 1];
					}
				}
			}
		}
	}
	const finalSurface = options.finalSurface;
	const surfaceNodes = [];
	/** 新 seq → 旧 seq（判「原文可见性」用）。 */
	const reverseSeq = /* @__PURE__ */ new Map();
	for (const [oldSeq, newSeq] of seqMap) reverseSeq.set(newSeq, oldSeq);
	/** 原文可见性：旧 seq ∈ finalSurface ⟹ 原文里可见（不可阴影）。 */
	const isVisibleNode = (nodeSeq) => {
		if (finalSurface === void 0) return true;
		const old = reverseSeq.get(nodeSeq);
		return old !== void 0 && finalSurface.has(old);
	};
	/** 取 op 的阴影候选（旧 seq 列表）：checkpoint → summary sh；否则 range 展开。 */
	const shadowCandidates = (event) => {
		const op = event.surfaceOp;
		const source = event.data?.source;
		const cid = typeof source?.compactionId === "string" ? source.compactionId : void 0;
		const fromSummary = cid === void 0 ? void 0 : summaryShadow.get(cid);
		if (fromSummary !== void 0) return flatSeqs(fromSummary);
		const start = typeof op?.startSeq === "number" ? op.startSeq : void 0;
		const end = typeof op?.endSeq === "number" ? op.endSeq : void 0;
		if (start === void 0 || end === void 0) return [];
		const lo = Math.min(start, end);
		const hi = Math.max(start, end);
		const list = [];
		for (let x = lo; x <= hi && x < lo + 2e5; x += 1) list.push(x);
		return list;
	};
	const eventBySeq = /* @__PURE__ */ new Map();
	for (const event of out) if (typeof event.seq === "number") eventBySeq.set(event.seq, event);
	for (const event of out) {
		const op = event.surfaceOp;
		if (op === void 0 || op === null) continue;
		if (op === "append") {
			if (typeof event.seq === "number") surfaceNodes.push(event.seq);
			continue;
		}
		if (typeof op !== "object") continue;
		const mapped = /* @__PURE__ */ new Set();
		for (const old of shadowCandidates(event)) {
			const newSeq = seqMap.get(old);
			if (newSeq !== void 0 && newSeq < event.seq) mapped.add(newSeq);
		}
		const candidates = [...mapped].sort((a, b) => a - b);
		const candidateSet = new Set(candidates);
		const hits = [];
		for (let i = 0; i < surfaceNodes.length; i += 1) if (candidateSet.has(surfaceNodes[i])) hits.push(i);
		if (hits.length === 0) {
			event.surfaceOp = "append";
			if (typeof event.seq === "number") surfaceNodes.push(event.seq);
			continue;
		}
		let lo = hits[0];
		let hi = hits[hits.length - 1];
		const obstacles = [];
		if (lo === 0 && surfaceNodes.length > 0) {
			const head = out.find((candidate) => candidate.seq === surfaceNodes[0]);
			if (head !== void 0 && head.type === "system/message") obstacles.push(0);
		}
		for (let i = lo; i <= hi; i += 1) if (isVisibleNode(surfaceNodes[i])) obstacles.push(i);
		obstacles.sort((a, b) => a - b);
		if (obstacles.length > 0) {
			const first = obstacles[0];
			const rightLo = obstacles[obstacles.length - 1] + 1;
			const leftHi = first - 1;
			const rightOk = rightLo <= hi && hits.some((i) => i >= rightLo);
			const leftOk = leftHi >= lo && hits.some((i) => i <= leftHi);
			if (rightOk) lo = rightLo;
			else if (leftOk) hi = leftHi;
			else {
				event.surfaceOp = "append";
				if (typeof event.seq === "number") surfaceNodes.push(event.seq);
				continue;
			}
		}
		const span = surfaceNodes.slice(lo, hi + 1);
		event.surfaceOp = {
			op: "replace",
			startSeq: span[0],
			endSeq: span[span.length - 1]
		};
		event.sourceEventSeqs = flatSeqs(span);
		syncSummaryShadowPrice(out, eventBySeq, checkpointCompactionId(event), span);
		surfaceNodes.splice(lo, hi - lo + 1, event.seq);
	}
	{
		const uncovered = [];
		for (let i = 0; i < surfaceNodes.length; i += 1) {
			const nodeSeq = surfaceNodes[i];
			if (isVisibleNode(nodeSeq)) continue;
			const nodeEvent = out.find((candidate) => candidate.seq === nodeSeq);
			if (nodeEvent !== void 0 && SURFACE_MESSAGE_TYPES.has(nodeEvent.type)) uncovered.push(i);
		}
		if (uncovered.length > 0) {
			const checkpoint = out.find((candidate) => candidate.type === "user/message" && isCompactCheckpoint(candidate) && typeof candidate.seq === "number");
			if (checkpoint !== void 0 && typeof checkpoint.seq === "number") {
				const isBlocked = (index) => {
					const nodeSeq = surfaceNodes[index];
					if (nodeSeq === checkpoint.seq) return true;
					if (index === 0) {
						const headEvent = out.find((candidate) => candidate.seq === nodeSeq);
						if (headEvent !== void 0 && headEvent.type === "system/message") return true;
					}
					if (!isVisibleNode(nodeSeq)) return false;
					const nodeEvent = out.find((candidate) => candidate.seq === nodeSeq);
					return nodeEvent !== void 0 && SURFACE_MESSAGE_TYPES.has(nodeEvent.type);
				};
				let bestLo = -1;
				let bestHi = -1;
				let bestLen = 0;
				let runLo = -1;
				const limit = surfaceNodes.length;
				for (let i = 0; i <= limit; i += 1) {
					if (!(i < limit ? isBlocked(i) : true)) {
						if (runLo === -1) runLo = i;
						continue;
					}
					if (runLo !== -1) {
						const len = i - runLo;
						if (uncovered.some((u) => u >= runLo && u < i) && len > bestLen) {
							bestLen = len;
							bestLo = runLo;
							bestHi = i - 1;
						}
						runLo = -1;
					}
				}
				if (bestLen > 0) {
					const span = surfaceNodes.slice(bestLo, bestHi + 1);
					checkpoint.surfaceOp = {
						op: "replace",
						startSeq: span[0],
						endSeq: span[span.length - 1]
					};
					checkpoint.sourceEventSeqs = flatSeqs(span);
					syncSummaryShadowPrice(out, eventBySeq, checkpointCompactionId(checkpoint), span);
					const checkpointInSpan = span.includes(checkpoint.seq);
					const rebuilt = [];
					for (let i = 0; i < surfaceNodes.length; i += 1) {
						if (i === bestLo) {
							rebuilt.push(checkpoint.seq);
							continue;
						}
						if (i > bestLo && i <= bestHi) continue;
						if (!checkpointInSpan && surfaceNodes[i] === checkpoint.seq) continue;
						rebuilt.push(surfaceNodes[i]);
					}
					surfaceNodes.length = 0;
					for (const seq of rebuilt) surfaceNodes.push(seq);
				}
			}
		}
	}
	return {
		events: out,
		inserted
	};
}
/** 消息级事件类型（后置覆盖 pass 的可见性约束用）。 */
const SURFACE_MESSAGE_TYPES = /* @__PURE__ */ new Set([
	"system/message",
	"user/message",
	"assistant/message",
	"tool/result"
]);
/** JSON 值域深比较（与 foldSurface 内部 isDeepEqualJson 同构）。 */
function isDeepEqualJson(a, b) {
	if (a === b) return true;
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
		return a.every((item, i) => isDeepEqualJson(item, b[i]));
	}
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	const aKeys = Object.keys(a);
	const bRecord = b;
	if (aKeys.length !== Object.keys(b).length) return false;
	return aKeys.every((key) => Object.hasOwn(b, key) && isDeepEqualJson(a[key], bRecord[key]));
}
/**
* 锚点行归一化：把**成为产物首行**的 `compaction/start` 的 `turn` 置 `null`。
*
* **为什么必须做**（2026-09-27 实测事故）：B' 裁剪把日志重写为以
* `compaction/start` 开头（本文件 `verifyPrunedTail` 第 0 条强制此形态）。
* 而 DSH 的 **v3→v4 迁移**有一条校验
* （`dsh-session-format-v3-to-v4/lib/index.js:707`）：
*
* ```js
* const owner = data.turn === null ? null : sessionFormatCount(data.turn, ...)
* if (owner !== this.turn) throw new SessionFormatError(
*   "compaction/start does not match the open turn")
* ```
*
* 产物开头**没有** `turn/start` ⟹ 迁移器的 `this.turn` 还是初值 `null`；
* 而锚点行带着原本的 `turn: 20` ⟹ `20 !== null` ⟹ **迁移直接拒绝**，
* 错误原文：`Session migration from v3 to v4 refuses the transformed artifact:
* compaction/start does not match the open turn`。用户侧表现为**会话打不开**
* （「历史加载失败」）。
*
* **为什么置 null 是正确语义**（不是权宜）：该 `compaction/start` 所属的
* `turn/start` 已经被裁掉、不在产物里了，`turn` 号因此**失去所指**——它既不
* 能被任何在册事件对上，也不再参与 surface 计算。`null` 恰好就是 v3→v4 在
* 「无 open turn」情形下期望的取值，故归一化后**语义更准**，不只是「骗过校验」。
*
* **⚠️ 只改「成为首行」的那一条**：后续 `compaction/start` 位于各自
* `turn/start` 之内，`turn` 号仍有效且必须保留（改错会让它们也通不过校验）。
* 本函数只处理 `rows[0]`（= 锚点行本身）。
*
* @param rows - 从锚点行起的原始物理行（顺序不变）。
* @returns 同样的行，但首行若是 `compaction/start` 则其 `turn` 已归一为 `null`。
*/
function normalizeAnchorRow(rows) {
	if (rows.length === 0) return { rows: [] };
	const first = rows[0];
	if (first === void 0) return { rows: [...rows] };
	try {
		const ev = JSON.parse(first);
		if (ev.type !== "compaction/start") return { rows: [...rows] };
		const data = ev.data;
		if (data === void 0 || data === null) return { rows: [...rows] };
		if (data.turn === null) return { rows: [...rows] };
		const next = {
			...ev,
			data: {
				...data,
				turn: null
			}
		};
		return { rows: [JSON.stringify(next), ...rows.slice(1)] };
	} catch {
		return { rows: [...rows] };
	}
}
/**
* B' 裁剪结果三重验证（全部通过才写盘）：
*  0. 产物形态：必须以 compaction/start 开头（锚点行——提取顺序正确性；
*     顺序反转会被 repair 伪修复成表面合法，此检查兜底）；
*  0.1 锚点行 `turn` 已归一为 `null`（2026-09-27 加——**跨版本不变量**：
*     v3→v4 迁移要求「compaction/start 的 turn == 当时 open 的 turn」，
*     而首行之前没有 turn/start ⟹ 当时 = null。此前本函数不查这条 ⟹ 裁剪
*     当时"验证通过"、问题留到 DSH 迁移才炸（实测 65 个 v3 中 7 个中招、
*     用户侧会话打不开）。现在同类产物**当场被拦**，不再延后暴露）；
*  1. step 配对 CLEAN（detectStepViolations 为空）；
*  2. v3 decodeRow 展开 + seq 连续 + foldSurface 重放——与 DSH 读侧
*     SessionLogScanner 的加载校验同构（展开后 seq 必须 0 起连续，surface
*     op/provenance/replace 区间全部合法），防产物被 DSH 读侧拒绝；
*  3. 编码读回一致性——encodeSessionLog 产物经 decodeSessionLog 重读，
*     逐事件深比较（防 stringify 丢字段/改值）。
*/
/**
* 引用前向性检查（2026-09-27 加）：全部引用必须**严格早于**自身 seq。
*
* 对齐 DSH v3→v4 的 `earlier(value, seq, subject)`：
* `if (coordinate >= seq) throw "… must name an earlier event"`。
* 覆盖三类引用：
*  - `sourceEventSeqs`（消息溯源）
*  - `data.shadowedRange` 端点 / `data.shadowedSeqs`（压缩遮蔽区间）
*  - `data.messageSeqs`（`session/title` 引用的 human user/message）
*
* @param events - 裁剪产物事件（seq 应为 0 起连续）。
* @returns 全部引用均严格早于自身 → true；存在前向/自引用 → false。
*/
function hasForwardRefs(events) {
	for (const event of events) {
		const seq = event.seq;
		if (typeof seq !== "number") continue;
		if (Array.isArray(event.sourceEventSeqs)) {
			for (const ref of event.sourceEventSeqs) if (typeof ref === "number" && ref >= seq) return false;
		}
		const data = event.data;
		if (data === void 0) continue;
		if (Array.isArray(data.shadowedSeqs)) {
			for (const ref of data.shadowedSeqs) if (typeof ref === "number" && ref >= seq) return false;
		}
		const range = data.shadowedRange;
		if (range !== void 0 && range !== null && typeof range === "object") {
			for (const ref of [range.start, range.end]) if (typeof ref === "number" && ref >= seq) return false;
		}
		if (Array.isArray(data.messageSeqs)) {
			for (const ref of data.messageSeqs) if (typeof ref === "number" && ref >= seq) return false;
		}
		const headerSeq = data.headerSeq;
		if (typeof headerSeq === "number" && headerSeq >= seq) return false;
	}
	return true;
}
/**
* 【0.3 · 2026-09-27】系统提示头保护检查（与 DSH `assertSystemHeadRewrite` 对齐）。
*
* DSH 读侧（app.asar `planSurfaceEvent` → `assertSystemHeadRewrite`）规则：
* 表面第 0 个节点若是 `system/message`，则任何 replace 若**以该节点为起点**
* 且不是「一个 `system/message` 只覆盖该单节点」→ 抛
* `surface replace: node 0 holds the system prompt ...`。
*
* 返回 true = 无违规（可落盘）；返回 false = 存在违规（拒绝该产物）。
* （⚠️ 名字沿 `hasForwardRefs` 的语义——「检查通过」返回 true，非「有违规」。）
*
* 与 `hasForwardRefs` 同为「验证判据必须覆盖读侧判据」的落地——历史教训：
* 判据落后于读侧 ⟹ 本地三重验证通过、DSH 侧炸（本文件 1886-1940 注释）。
*
* 导出仅供单测直接打靶（判据本体不该只能通过整条管线间接测）。
*/
function hasSystemHeadViolation(events) {
	const surface = [];
	const bySeq = /* @__PURE__ */ new Map();
	for (const event of events) if (typeof event.seq === "number") bySeq.set(event.seq, event);
	for (const event of events) {
		if (!SURFACE_MESSAGE_TYPES.has(event.type)) continue;
		const op = event.surfaceOp;
		if (op === void 0 || op === "append") {
			surface.push(event.seq);
			continue;
		}
		const range = op;
		const first = typeof range.startSeq === "number" ? surface.indexOf(range.startSeq) : -1;
		const last = typeof range.endSeq === "number" ? surface.indexOf(range.endSeq) : -1;
		if (first < 0 || last < first) continue;
		const headSeq = surface[0];
		const headEvent = headSeq === void 0 ? void 0 : bySeq.get(headSeq);
		if (first === 0 && headEvent?.type === "system/message") {
			const alone = last - first + 1 === 1;
			if (!(event.type === "system/message" && alone)) return false;
		}
		surface.splice(first, last - first + 1, event.seq);
	}
	return true;
}
/**
* 【产物形态 C · 2026-09-27】把裁剪产物改造成「合法独立会话」。
*
* **为什么必须做**：B′ 产物强制以 `compaction/start` 开头（见 `verifyPrunedTail`
* 第 0 条），但 DSH v3→v4 的 `span()` 要求 `shadowedRange` 端点**严格早于**
* summary 自身 seq 且在**当前 surface** 上。锚点帧的 summary 位于 seq=1，
* 之前没有任何 surface 事件 ⟹ **结构上永远非法**
* （实测报 `compaction range start must name an earlier event`；
* 全库 28 个裁剪产物 **0 个**通过迁移）。
*
* **两条契约互斥，只能改产物形态**。做法：
*  1. 删除全部 `compaction/start|summary|end`——**摘要正文不丢**：实测每个
*     summary 的文本都已完整内嵌在同帧 checkpoint 的 `<compacted-summary>`
*     块里（逐帧核对 8/8 命中）；
*  2. checkpoint 的 replace 区间随阴影节点消失 → 归一 `append`；
*  3. 删掉悬空的 `source.compactionId`（`plugin` 必须保留——它是生产者身份，
*     `rewritePluginSource` 要求其为 string）；
*  4. 删掉孤立的 `turn/end`（其 `turn/start` 落在被裁前缀里）；
*  5. turn 编号重排为 `1..N`（DSH 要求首个 `turn/start` 的 turn === nextTurn(1)）；
*  6. 预筛删除「无法合法引用 human user/message」的非 user `session/title`；
*  7. seq 重编号 + 全引用重映射（含 surfaceOp 端点）。
*
* @param events - `repairPrunedTail` 的输出（seq 已 0 起连续）。
* @returns 改造后的事件（可被 DSH v3→v4 迁移接受）。
*/
function normalizeCompactArtifact(events) {
	const SURFACE_TYPES_LOCAL = /* @__PURE__ */ new Set([
		"system/message",
		"user/message",
		"assistant/message",
		"tool/result"
	]);
	const COMPACT_TYPES = /* @__PURE__ */ new Set([
		"compaction/start",
		"compaction/summary",
		"compaction/end"
	]);
	/** 取事件 data（多处复用；此前在个别 block 内局部定义，导致跨块引用失败）。 */
	const dataOf = (event) => event.data;
	let work = events.map((event) => {
		return JSON.parse(JSON.stringify(event));
	});
	const pruneFrames = work.filter((e) => e.type === "compaction/prune");
	if (pruneFrames.length > 0) {
		/** seq → 事件（用于按 seq 找回被影子掉的原文）。 */
		const bySeq = /* @__PURE__ */ new Map();
		for (const e of work) if (typeof e.seq === "number") bySeq.set(e.seq, e);
		/** 待归位：原 seq → 事件（内容取自影子范围内的那条）。 */
		const restoreTo = /* @__PURE__ */ new Map();
		/** 需要删掉的「重复插入」：内容与影子事件相同、但位于别处的那些。 */
		const duplicates = /* @__PURE__ */ new Set();
		for (const frame of pruneFrames) {
			const range = frame.data?.shadowedRange;
			const start = range?.start;
			const end = range?.end;
			if (typeof start !== "number" || typeof end !== "number" || start !== end) continue;
			const shadowed = bySeq.get(start);
			if (shadowed === void 0) continue;
			const key = (e) => {
				const d = e.data;
				if (d === void 0) return void 0;
				const callId = d["message"]?.source?.callId;
				if (typeof callId === "string") return `${e.type}|${callId}`;
				const id = d["message"]?.id;
				if (typeof id === "string") return `${e.type}|${id}`;
			};
			const sk = key(shadowed);
			if (sk === void 0) continue;
			const later = work.find((e) => e !== shadowed && (e.seq ?? -1) > start && key(e) === sk);
			if (later === void 0) continue;
			restoreTo.set(start, shadowed);
			duplicates.add(later);
		}
		if (restoreTo.size > 0) {
			const restored = work.filter((e) => !duplicates.has(e)).map((e) => restoreTo.get(e.seq ?? -1) ?? e);
			const present = new Set(restored.map((e) => e.seq));
			for (const [seq, ev] of restoreTo) if (!present.has(seq)) restored.push(ev);
			restored.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
			work = restored;
		}
	}
	const removedIds = /* @__PURE__ */ new Set();
	for (const event of work) if (COMPACT_TYPES.has(event.type)) {
		const id = event.data?.compactionId;
		if (typeof id === "string") removedIds.add(id);
	}
	work = work.filter((event) => !COMPACT_TYPES.has(event.type));
	if (work.length === 0) return [];
	const surviving = /* @__PURE__ */ new Set();
	for (const event of work) if (typeof event.seq === "number") surviving.add(event.seq);
	for (const event of work) {
		const src = event.data?.source;
		if (src !== void 0 && typeof src.compactionId === "string" && removedIds.has(src.compactionId)) delete src.compactionId;
		const op = event.surfaceOp;
		if (op === void 0 || op === "append") continue;
		if (src?.kind === "compact-checkpoint") {
			event.surfaceOp = "append";
			continue;
		}
		const range = op;
		const startAlive = typeof range.startSeq === "number" && surviving.has(range.startSeq);
		const endAlive = typeof range.endSeq === "number" && surviving.has(range.endSeq);
		if (!startAlive || !endAlive) event.surfaceOp = "append";
	}
	{
		let seenStart = false;
		work = work.filter((event) => {
			if (event.type === "turn/start") {
				seenStart = true;
				return true;
			}
			if (event.type === "turn/end" && !seenStart) return false;
			return true;
		});
	}
	{
		const dataOf = (event) => event.data;
		const present = /* @__PURE__ */ new Set();
		for (const event of work) {
			const turn = dataOf(event)?.["turn"];
			if (typeof turn === "number") present.add(turn);
		}
		const opened = /* @__PURE__ */ new Set();
		for (const event of work) {
			if (event.type !== "turn/start") continue;
			const turn = dataOf(event)?.["turn"];
			if (typeof turn === "number") opened.add(turn);
		}
		const closed = /* @__PURE__ */ new Set();
		for (const event of work) {
			if (event.type !== "turn/end") continue;
			const turn = dataOf(event)?.["turn"];
			if (typeof turn === "number") closed.add(turn);
		}
		const contentTurns = /* @__PURE__ */ new Set();
		for (const event of work) {
			const turn = dataOf(event)?.["turn"];
			if (typeof turn !== "number") continue;
			if (event.type === "step/start" || event.type === "assistant/message") contentTurns.add(turn);
			else if (event.type === "user/message") {
				const source = dataOf(event)?.["source"];
				if (!(source !== null && typeof source === "object" && source.kind === "goal")) contentTurns.add(turn);
			}
		}
		const needStart = [...present].filter((turn) => !opened.has(turn) && !closed.has(turn) && contentTurns.has(turn)).sort((a, b) => a - b);
		if (needStart.length > 0) {
			const rebuilt = [];
			const inserted = /* @__PURE__ */ new Set();
			for (const event of work) {
				const turn = dataOf(event)?.["turn"];
				if (typeof turn === "number" && needStart.includes(turn) && !inserted.has(turn)) {
					inserted.add(turn);
					rebuilt.push({
						type: "turn/start",
						seq: -1,
						time: event.time,
						data: { turn }
					});
				}
				rebuilt.push(event);
			}
			work = rebuilt;
		}
		{
			const turnMap = /* @__PURE__ */ new Map();
			let next = 1;
			for (const event of work) {
				if (event.type !== "turn/start") continue;
				const turn = dataOf(event)?.["turn"];
				if (typeof turn === "number" && !turnMap.has(turn)) {
					turnMap.set(turn, next);
					next += 1;
				}
			}
			for (const event of work) {
				const data = dataOf(event);
				if (data !== void 0 && typeof data.turn === "number" && turnMap.has(data.turn)) data.turn = turnMap.get(data.turn);
			}
		}
		{
			const stepMap = /* @__PURE__ */ new Map();
			const counters = /* @__PURE__ */ new Map();
			for (const event of work) {
				const data = dataOf(event);
				const turn = typeof data?.["turn"] === "number" ? data["turn"] : void 0;
				if (event.type === "turn/start") {
					if (turn !== void 0) counters.set(turn, 1);
					continue;
				}
				if (event.type === "turn/end") continue;
				if (turn === void 0 || data === void 0) continue;
				if (event.type === "step/start") {
					const oldStep = typeof data["step"] === "number" ? data["step"] : void 0;
					const next = counters.get(turn) ?? 1;
					counters.set(turn, next + 1);
					if (oldStep !== void 0) stepMap.set(`${turn}:${oldStep}`, next);
					stepMap.set(`${turn}:${oldStep}@${event.seq}`, next);
					data["step"] = next;
				} else if (typeof data["step"] === "number") {
					const mapped = stepMap.get(`${turn}:${data["step"]}`);
					if (mapped !== void 0) data["step"] = mapped;
					else {
						const cur = counters.get(turn);
						if (cur !== void 0 && cur > 1) data["step"] = cur - 1;
					}
				}
			}
		}
		{
			const firstStart = work.findIndex((event) => event.type === "turn/start");
			if (firstStart > 0) work = work.filter((event, index) => !(index < firstStart && event.type === "turn/end"));
		}
		{
			const rebuilt = [];
			let openTurn;
			for (const event of work) {
				const data = dataOf(event);
				const turn = typeof data?.["turn"] === "number" ? data["turn"] : void 0;
				if (event.type === "turn/start") openTurn = turn;
				else if (event.type === "turn/end") openTurn = void 0;
				else if (event.type === "step/end") {
					if (openTurn === void 0 || turn !== openTurn) continue;
				}
				rebuilt.push(event);
			}
			work = rebuilt;
		}
		{
			const rebuilt = [];
			let openTurn;
			let openStep;
			const closeStep = (time) => {
				if (openTurn === void 0 || openStep === void 0) return;
				rebuilt.push({
					type: "step/end",
					seq: -1,
					time,
					data: {
						turn: openTurn,
						step: openStep
					}
				});
				openStep = void 0;
			};
			for (const event of work) {
				const data = dataOf(event);
				const turn = typeof data?.["turn"] === "number" ? data["turn"] : void 0;
				const eventTime = typeof event.time === "number" ? event.time : 0;
				if (event.type === "turn/start") {
					if (openTurn !== void 0 && openTurn !== turn) {
						closeStep(eventTime);
						rebuilt.push({
							type: "turn/end",
							seq: -1,
							time: event.time,
							data: {
								turn: openTurn,
								reason: { ...PRUNED_TURN_END_REASON }
							}
						});
					}
					openTurn = turn;
					openStep = void 0;
				} else if (event.type === "turn/end") {
					closeStep(eventTime);
					openTurn = void 0;
					openStep = void 0;
					const normalized = withTurnEndReason(event);
					if (normalized !== event) {
						rebuilt.push(normalized);
						continue;
					}
				} else if (event.type === "step/start") openStep = typeof data?.["step"] === "number" ? data["step"] : void 0;
				else if (event.type === "step/end") openStep = void 0;
				rebuilt.push(event);
			}
			if (openTurn !== void 0) {
				const last = rebuilt[rebuilt.length - 1];
				closeStep(typeof last?.time === "number" ? last.time : 0);
				rebuilt.push({
					type: "turn/end",
					seq: -1,
					time: typeof last?.time === "number" ? last.time : 0,
					data: {
						turn: openTurn,
						reason: { ...PRUNED_TURN_END_REASON }
					}
				});
			}
			work = rebuilt;
		}
	}
	{
		const advertised = /* @__PURE__ */ new Set();
		for (const event of work) {
			if (event.type !== "tool/call") continue;
			const callId = event.data?.callId;
			if (typeof callId === "string") advertised.add(callId);
		}
		const resultIds = /* @__PURE__ */ new Set();
		for (const event of work) {
			if (event.type !== "tool/result") continue;
			const data = event.data;
			const id = (typeof data?.message?.toolCallId === "string" ? data.message.toolCallId : void 0) ?? (typeof data?.message?.source?.callId === "string" ? data.message.source.callId : void 0) ?? (typeof data?.callId === "string" ? data.callId : void 0);
			if (id !== void 0) resultIds.add(id);
		}
		const survivingCalls = /* @__PURE__ */ new Set();
		for (const id of advertised) if (resultIds.has(id)) survivingCalls.add(id);
		for (const event of work) {
			if (event.type !== "assistant/message") continue;
			const message = event.data?.message;
			if (message === void 0 || !Array.isArray(message.content)) continue;
			const kept = message.content.filter((block) => {
				if (typeof block !== "object" || block === null) return true;
				const item = block;
				if (item.type !== "tool-call" || typeof item.id !== "string") return true;
				return survivingCalls.has(item.id);
			});
			if (kept.length !== message.content.length) message.content = kept;
		}
		work = work.filter((event) => {
			if (event.type === "tool/result") {
				const data = event.data;
				const id = (typeof data?.message?.toolCallId === "string" ? data.message.toolCallId : void 0) ?? (typeof data?.message?.source?.callId === "string" ? data.message.source.callId : void 0) ?? (typeof data?.callId === "string" ? data.callId : void 0);
				return id !== void 0 && advertised.has(id);
			}
			if (event.type === "tool/call") {
				const id = event.data?.callId;
				return typeof id === "string" && resultIds.has(id);
			}
			return true;
		});
	}
	{
		const firstSurfaceIdx = work.findIndex((e) => SURFACE_TYPES_LOCAL.has(e.type));
		if (firstSurfaceIdx >= 0) {
			if (work[firstSurfaceIdx]?.type !== "system/message") {
				const template = work.find((e) => e.type === "system/message");
				if (template !== void 0) {
					const clone = JSON.parse(JSON.stringify(template));
					clone.seq = -1;
					clone.surfaceOp = "append";
					typeof dataOf(template)?.["step"] === "number" && dataOf(template)?.["step"];
					for (const event of work) {
						const data = dataOf(event);
						if (data === void 0) continue;
						if (typeof data["turn"] === "number") data["turn"] = data["turn"] + 1;
					}
					const head = [{
						type: "turn/start",
						seq: -1,
						time: template.time,
						data: { turn: 1 }
					}, {
						type: "step/start",
						seq: -1,
						time: template.time,
						data: {
							turn: 1,
							step: 1
						}
					}];
					const tIdx = work.indexOf(template);
					if (tIdx >= 0) work.splice(tIdx, 1);
					const cloneData = dataOf(clone);
					if (cloneData !== void 0) {
						cloneData["turn"] = 1;
						cloneData["step"] = 1;
					}
					work.unshift(...head, clone);
				}
			}
		}
		const sysIdx = work.findIndex((e) => e.type === "system/message");
		if (sysIdx >= 0) {
			const sys = work[sysIdx];
			if (sys !== void 0) sys.surfaceOp = "append";
		}
	}
	{
		const rebuilt = [];
		let openTurn;
		let openStep;
		const closeStep = (time) => {
			if (openTurn === void 0 || openStep === void 0) return;
			rebuilt.push({
				type: "step/end",
				seq: -1,
				time,
				data: {
					turn: openTurn,
					step: openStep
				}
			});
			openStep = void 0;
		};
		for (const event of work) {
			const data = dataOf(event);
			const turn = typeof data?.["turn"] === "number" ? data["turn"] : void 0;
			const eventTime = typeof event.time === "number" ? event.time : 0;
			if (event.type === "turn/start") {
				if (openTurn !== void 0 && openTurn !== turn) {
					closeStep(eventTime);
					rebuilt.push({
						type: "turn/end",
						seq: -1,
						time: eventTime,
						data: {
							turn: openTurn,
							reason: { ...PRUNED_TURN_END_REASON }
						}
					});
				}
				openTurn = turn;
				openStep = void 0;
			} else if (event.type === "turn/end") {
				closeStep(eventTime);
				openTurn = void 0;
				openStep = void 0;
				const normalized = withTurnEndReason(event);
				if (normalized !== event) {
					rebuilt.push(normalized);
					continue;
				}
			} else if (event.type === "step/start") openStep = typeof data?.["step"] === "number" ? data["step"] : void 0;
			else if (event.type === "step/end") openStep = void 0;
			rebuilt.push(event);
		}
		if (openTurn !== void 0) {
			const last = rebuilt[rebuilt.length - 1];
			closeStep(typeof last?.time === "number" ? last.time : 0);
			rebuilt.push({
				type: "turn/end",
				seq: -1,
				time: typeof last?.time === "number" ? last.time : 0,
				data: {
					turn: openTurn,
					reason: { ...PRUNED_TURN_END_REASON }
				}
			});
		}
		work = rebuilt;
	}
	for (const event of work) {
		if (event.type !== "tool/result") continue;
		const data = event.data;
		const message = data?.message;
		if (message === void 0) continue;
		if (typeof message.toolCallId === "string") continue;
		const from = typeof message.source?.callId === "string" ? message.source.callId : typeof data?.callId === "string" ? data.callId : void 0;
		if (from !== void 0) message.toolCallId = from;
	}
	{
		const kindOf = (event) => event.data?.source?.kind;
		const kept = [];
		let humanSeen = false;
		for (const event of work) {
			if ((event.type === "session/title" || event.type === "session/title-llm-request") && !humanSeen && kindOf(event) !== "user") continue;
			kept.push(event);
			if (event.type === "user/message" && kindOf(event) === "user") humanSeen = true;
		}
		work = kept;
	}
	const seqMap = /* @__PURE__ */ new Map();
	work.forEach((event, index) => {
		seqMap.set(event.seq, index);
		event.seq = index;
	});
	const remap = (value) => seqMap.get(value);
	for (const event of work) {
		if (Array.isArray(event.sourceEventSeqs)) {
			const mapped = [...new Set(event.sourceEventSeqs.map(remap).filter((v) => v !== void 0 && v < event.seq))];
			if (mapped.length > 0) event.sourceEventSeqs = mapped;
			else delete event.sourceEventSeqs;
		}
		if (event.surfaceOp !== void 0 && event.surfaceOp !== "append") {
			const op = event.surfaceOp;
			const mappedStart = typeof op.startSeq === "number" ? remap(op.startSeq) : void 0;
			const mappedEnd = typeof op.endSeq === "number" ? remap(op.endSeq) : void 0;
			if (mappedStart === void 0 || mappedEnd === void 0 || mappedStart >= event.seq) event.surfaceOp = "append";
			else {
				op.startSeq = mappedStart;
				op.endSeq = mappedEnd;
			}
		}
		const data = event.data;
		if (data === void 0) continue;
		if (Array.isArray(data.shadowedSeqs)) {
			const mapped = data.shadowedSeqs.map(remap).filter((v) => v !== void 0 && v < event.seq);
			if (mapped.length > 0) {
				data.shadowedSeqs = mapped;
				data.shadowedRange = {
					start: mapped[0],
					end: mapped[mapped.length - 1]
				};
			} else {
				delete data.shadowedSeqs;
				delete data.shadowedRange;
				delete data.shadowedTokenCount;
			}
		}
		if (event.type === "session/title" || event.type === "session/title-llm-request") {
			const isUser = data.source?.kind === "user";
			const refs = Array.isArray(data.messageSeqs) ? data.messageSeqs : [];
			data.messageSeqs = isUser ? [] : [...new Set(refs.map(remap).filter((v) => v !== void 0 && v < event.seq && work[v]?.type === "user/message" && work[v]?.data?.source?.kind === "user"))];
		}
		if (typeof data.headerSeq === "number") {
			const mapped = remap(data.headerSeq);
			if (mapped !== void 0 && mapped < event.seq) data.headerSeq = mapped;
			else {
				let fallback;
				for (let index = event.seq - 1; index >= 0; index -= 1) if (work[index]?.type === "request/header") {
					fallback = index;
					break;
				}
				if (fallback !== void 0) data.headerSeq = fallback;
			}
		}
		if (typeof data.sourceEventSeq === "number") {
			const mapped = remap(data.sourceEventSeq);
			const target = mapped === void 0 ? void 0 : work[mapped];
			if (mapped === void 0 || mapped >= event.seq || target?.type === "command/run" || target?.type === "command/done") delete data.sourceEventSeq;
			else data.sourceEventSeq = mapped;
		}
	}
	{
		const surface = [];
		for (const event of work) {
			if (!SURFACE_TYPES_LOCAL.has(event.type)) continue;
			const op = event.surfaceOp;
			if (op === void 0 || op === "append") {
				surface.push(event.seq);
				continue;
			}
			const range = op;
			const first = typeof range.startSeq === "number" ? surface.indexOf(range.startSeq) : -1;
			const last = typeof range.endSeq === "number" ? surface.indexOf(range.endSeq) : -1;
			if (first >= 0 && last >= first) surface.splice(first, last - first + 1, event.seq);
			else {
				event.surfaceOp = "append";
				surface.push(event.seq);
			}
		}
	}
	{
		const surface = [];
		for (const event of work) {
			if (!SURFACE_TYPES_LOCAL.has(event.type)) continue;
			const op = event.surfaceOp;
			if (op === void 0 || op === "append") {
				surface.push(event.seq);
				continue;
			}
			const range = op;
			const first = typeof range.startSeq === "number" ? surface.indexOf(range.startSeq) : -1;
			const last = typeof range.endSeq === "number" ? surface.indexOf(range.endSeq) : -1;
			if (first >= 0 && last >= first) {
				const head = surface[0];
				const headIsSystem = (head === void 0 ? void 0 : work.find((e) => e.seq === head))?.type === "system/message";
				const coversHead = first === 0 && headIsSystem;
				const legalHeadRewrite = event.type === "system/message" && last - first + 1 === 1;
				if (coversHead && !legalHeadRewrite) {
					event.surfaceOp = "append";
					surface.push(event.seq);
					continue;
				}
				surface.splice(first, last - first + 1, event.seq);
			} else {
				event.surfaceOp = "append";
				surface.push(event.seq);
			}
		}
	}
	return work;
}
function verifyPrunedTail(header, events, zstd) {
	if (events.length === 0) return false;
	if (events[0]?.type === "compaction/start") return false;
	if (!hasForwardRefs(events)) return false;
	if (detectStepViolations(events).length > 0) return false;
	if (!hasSystemHeadViolation(events)) return false;
	{
		let surfaceSeen = false;
		for (const event of events) {
			if (event.type === "user/message" || event.type === "assistant/message" || event.type === "tool/result") surfaceSeen = true;
			if (event.type === "system/message") {
				if (surfaceSeen) return false;
				break;
			}
		}
	}
	try {
		const decoded = decodeSessionLog(encodeSessionLog(header, events, zstd), zstd);
		if (decoded.events.length !== events.length) return false;
		for (let i = 0; i < events.length; i++) if (!isDeepEqualJson(decoded.events[i], events[i])) return false;
	} catch {
		return false;
	}
	return true;
}
/**
* 扫描全文收集 {@link PreAnchorRows}。逐帧解压（峰值 = 单帧明文），与
* `extractStateRows` 同一内存纪律。
*
* @param buffer - 日志物理字节。
* @param zstd - 是否 zstd 压缩。
* @param anchorSeq - 裁剪锚点（compaction/start 的原始 seq）——只收集
*                    **锚点之前**的行。
*/
function collectPreAnchorRows(buffer, zstd, anchorSeq) {
	const finalSurface = /* @__PURE__ */ new Set();
	const surfaceNodes = [];
	const shadowedSeqs = /* @__PURE__ */ new Set();
	const candidates = /* @__PURE__ */ new Map();
	const visit = (lines) => {
		for (const line of lines) {
			if (line.trim() === "") continue;
			let event;
			try {
				event = JSON.parse(line);
			} catch {
				continue;
			}
			if (typeof event.seq !== "number") continue;
			if (event.type === "compaction/prune") {
				const range = event.data?.shadowedRange;
				const start = range?.start;
				const end = range?.end;
				if (typeof start === "number") {
					const stop = typeof end === "number" ? end : start;
					for (let s = start; s <= stop; s += 1) shadowedSeqs.add(s);
				}
			}
			const op = event.surfaceOp;
			if (op === "append") {
				surfaceNodes.push(event.seq);
				finalSurface.add(event.seq);
			} else if (op !== void 0 && op !== null && typeof op === "object") {
				const range = op;
				const rawStart = typeof range.startSeq === "number" ? range.startSeq : typeof range.start === "number" ? range.start : void 0;
				const rawEnd = typeof range.endSeq === "number" ? range.endSeq : typeof range.end === "number" ? range.end : void 0;
				if (rawStart !== void 0 && rawEnd !== void 0) {
					const startIdx = surfaceNodes.indexOf(rawStart);
					const endIdx = surfaceNodes.indexOf(rawEnd);
					if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
						for (let i = startIdx; i <= endIdx; i += 1) finalSurface.delete(surfaceNodes[i]);
						surfaceNodes.splice(startIdx, endIdx - startIdx + 1, event.seq);
						finalSurface.add(event.seq);
					}
				}
			}
			if (event.seq >= anchorSeq) continue;
			if (isFoldStateRow(event.type, event.data) || STATE_EVENT_TYPES.has(event.type) || SURFACE_MESSAGE_TYPES.has(event.type) || event.type === "tool/call") candidates.set(event.seq, line);
		}
	};
	if (!zstd) visit(buffer.toString("utf8").split("\n"));
	else {
		const { frames, tornStart } = scanZstdFrames(buffer);
		for (const frame of frames) try {
			visit(zstdDecompressSync(buffer.subarray(frame.start, frame.end)).toString("utf8").split("\n"));
		} catch {}
		if (tornStart !== void 0) try {
			visit(zstdDecompressSync(buffer.subarray(tornStart), ZSTD_INCOMPLETE_PARAMS).toString("utf8").split("\n"));
		} catch {}
	}
	/** 被影子掉的 tool call id（这些的整条生命周期必须完整救回）。 */
	const shadowedCallIds = /* @__PURE__ */ new Set();
	for (const line of candidates.values()) try {
		const event = JSON.parse(line);
		if (typeof event.seq !== "number" || !shadowedSeqs.has(event.seq)) continue;
		if (event.type === "tool/call") {
			const id = event.data?.callId;
			if (typeof id === "string") shadowedCallIds.add(id);
		} else if (event.type === "tool/result") {
			const id = event.data?.message?.source?.callId;
			if (typeof id === "string") shadowedCallIds.add(id);
		}
	} catch {}
	/** 某条 `assistant/message` 是否宣告了「被影子的」tool call。 */
	const advertisesShadowedCall = (event) => {
		if (event.type !== "assistant/message") return false;
		const content = event.data?.message?.content;
		if (!Array.isArray(content)) return false;
		return content.some((block) => {
			if (block === null || typeof block !== "object") return false;
			const b = block;
			return b.type === "tool-call" && typeof b.id === "string" && shadowedCallIds.has(b.id);
		});
	};
	const insertRows = [];
	for (const [seq, line] of candidates) {
		if (finalSurface.has(seq)) {
			let keep = false;
			try {
				const event = JSON.parse(line);
				keep = isFoldStateRow(event.type, event.data) || STATE_EVENT_TYPES.has(event.type) || event.type === "tool/call";
			} catch {
				keep = false;
			}
			if (keep) insertRows.push({
				seq,
				line
			});
			continue;
		}
		try {
			const event = JSON.parse(line);
			if (isFoldStateRow(event.type, event.data) || STATE_EVENT_TYPES.has(event.type) || event.type === "tool/call") {
				insertRows.push({
					seq,
					line
				});
				continue;
			}
			if (event.type === "tool/result") {
				const id = event.data?.message?.source?.callId;
				if (typeof id === "string" && shadowedCallIds.has(id)) insertRows.push({
					seq,
					line
				});
				continue;
			}
			if (advertisesShadowedCall(event)) insertRows.push({
				seq,
				line
			});
		} catch {}
	}
	insertRows.sort((a, b) => a.seq - b.seq);
	return {
		finalSurface,
		insertRows
	};
}
/**
* 状态类事件类型——裁剪必须保留。这些事件的语义是「当前状态的一次变更」，
* 由 DSH 各插件在 resume 时**按序 fold** 重建状态（goal/todo/plan/权限/
* 标题）；被裁掉不等于被 checkpoint 代表（checkpoint 只代表对话材料），
* 丢了它们 resume 后状态直接消失。
*
* 维护契约：新增状态类事件类型（任何「fold 出当前值」的事件）必须登记
* 到这里，否则瘦身会静默丢状态；**类型白名单之外还有按字段判定的状态载体**
* （`isFoldStateRow`），两者合起来才是完整的「裁剪必须保留」集合。
*/
const STATE_EVENT_TYPES = /* @__PURE__ */ new Set([
	"goal/change",
	"todo/write",
	"plan/mode",
	"permission/preset",
	"sandbox/mode",
	"approval/policy",
	"session/title"
]);
/**
* 非白名单状态载体——事件类型本身不是「状态快照」，但被 DSH 的 fold / 重放
* 按序消费，丢了同样破坏 resume 后的重建：
*  - `user/message`（`source.kind === 'goal'`）：goal fold 用它推进
*    `roundsStarted`（packages/goal/goal/src/fold.ts 的 `applyGoalEvent`）。
*    丢了它，保留下来的 `goal/change` 携带的 roundsStarted 与 fold 累计值
*    不符 → resume 后 goal 投影抛
*    "goal pause does not preserve the current counters and timestamps"
*    （2026-09-10「当场重置」实测暴露：裁后 get_goal 报错、裁前正常）。
*  - `agent/inbox/spliced`：Inbox 构造时按序重放并对投影做边界校验
*    （packages/core/agent/src/inbox.ts 的 `apply` / `validate`）。丢了前缀，
*    尾部 splice 的 start/removedCount 可能越界 → 构造抛
*    "invalid persisted inbox splice"。
*/
function isFoldStateRow(type, data) {
	if (type === "agent/inbox/spliced") return true;
	if (type !== "user/message") return false;
	if (data === null || typeof data !== "object") return false;
	const source = data.source;
	return source !== null && typeof source === "object" && source.kind === "goal";
}
/** 把行数组中属于状态类事件类型的原始行收集进 out（坏行跳过，与锚点扫描同口径）。 */
function collectStateLines(lines, out) {
	for (const line of lines) {
		if (line.trim() === "") continue;
		try {
			const parsed = JSON.parse(line);
			if (typeof parsed.type !== "string") continue;
			if (STATE_EVENT_TYPES.has(parsed.type) || isFoldStateRow(parsed.type, parsed.data)) out.push(line);
		} catch {}
	}
}
/**
* 收集**整份日志**里的状态类事件原始行（裁剪会把它们所在的前缀丢掉，所以
* 必须从全文捞回来）。逐帧解压，峰值 = 单帧明文（不整线驻留——与锚点提取
* 同一条内存纪律）。torn 尾帧按 DSH 口径恢复完整行后一并收集。
*/
function extractStateRows(buffer, zstd) {
	const out = [];
	if (!zstd) {
		collectStateLines(buffer.toString("utf8").split("\n"), out);
		return out;
	}
	const { frames, tornStart } = scanZstdFrames(buffer);
	for (const frame of frames) try {
		collectStateLines(zstdDecompressSync(buffer.subarray(frame.start, frame.end)).toString("utf8").split("\n"), out);
	} catch {}
	if (tornStart !== void 0) try {
		collectStateLines(zstdDecompressSync(buffer.subarray(tornStart), ZSTD_INCOMPLETE_PARAMS).toString("utf8").split("\n"), out);
	} catch {}
	return out;
}
/**
* 瘦身单个会话日志文件（B' 路径：尾部帧提取 + 内联修复 + 三重验证）。
* 安全前置：原文件不动，直到裁剪结果通过 verifyPrunedTail；验证后临时
* 文件 + fsync + 原子 rename。
* @returns 成功时返回结果；文件小于阈值 / 无完整 compaction 段 / 验证
*          失败时返回 undefined（原文件保持原样）。
*/
function pruneSessionFile(path, options) {
	const { thresholdBytes } = options;
	if (thresholdBytes <= 0) return void 0;
	let before;
	try {
		before = statSync(path);
	} catch {
		return;
	}
	if (before.size < thresholdBytes) return void 0;
	try {
		const zstd = path.endsWith(".zstd");
		const buffer = readFileSync(path);
		const tail = extractTailRows(buffer, zstd, options.minTurns ?? 0);
		if (tail === void 0) return void 0;
		const { header, rows, anchorSeq } = tail;
		const wantOfficial = options.officialVerify === true;
		if (wantOfficial) {
			let original;
			try {
				original = decodeSessionLog(buffer, zstd);
			} catch {
				original = void 0;
			}
			if (original === void 0 || !isOfficiallyReadable(original.header, original.events).readable) {
				if (options.officialReport !== void 0) markUnsupported(options.officialReport, path);
				return;
			}
		}
		const { finalSurface, insertRows } = collectPreAnchorRows(buffer, zstd, anchorSeq);
		const headRows = collectHeadRows(buffer, zstd);
		let firstTurn;
		let firstTime = Date.now();
		for (const line of rows.slice(1)) try {
			const e = JSON.parse(line);
			if (typeof e.data?.turn === "number") {
				firstTurn = e.data.turn;
				firstTime = e.time ?? Date.now();
				break;
			}
		} catch {}
		const synthetic = firstTurn !== void 0 && headRows.length > 0 ? JSON.stringify({
			type: "turn/start",
			seq: 0,
			time: firstTime - 1,
			data: { turn: firstTurn }
		}) : void 0;
		const stateRows = extractStateRows(buffer, zstd);
		const tailRows = rows.length > 0 ? renumberTurns(rows.slice(1), headRows.length > 0 ? 2 : 1) : [];
		const tailSeqs = /* @__PURE__ */ new Set();
		for (const line of tailRows) try {
			const e = JSON.parse(line);
			if (typeof e.seq === "number") tailSeqs.add(String(e.seq));
		} catch {}
		const stateRowsDeduped = stateRows.filter((line) => {
			try {
				const e = JSON.parse(line);
				return typeof e.seq !== "number" || !tailSeqs.has(String(e.seq));
			} catch {
				return false;
			}
		});
		const { events: repairedRaw, inserted } = repairPrunedTail([
			...headRows,
			...synthetic ? [synthetic] : [],
			...stateRowsDeduped,
			...tailRows
		], { finalSurface });
		if (repairedRaw.length === 0) return void 0;
		const repaired = normalizeCompactArtifact(repairedRaw);
		if (repaired.length === 0) return void 0;
		if (options.requireHead !== false && !repaired.some((event) => event.type === "system/message")) return void 0;
		if (!verifyPrunedTail(header, repaired, zstd)) return void 0;
		if (wantOfficial) {
			if (!verifyWithOfficial(header, repaired, "").ok) {
				if (options.officialReport !== void 0) {
					options.officialReport.checked += 1;
					options.officialReport.failed += 1;
				}
				return;
			}
		}
		let backupPath;
		if (options.backup !== false) {
			const backupDir = options.backupDir ?? join(resolveMbsfDataDir(), "prune-backups");
			const backupName = `${basename(dirname(path))}.${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.${zstd ? "jsonl.zstd" : "jsonl"}`;
			try {
				mkdirSync(backupDir, { recursive: true });
				backupPath = join(backupDir, backupName);
				writeFileSync(backupPath, buffer);
			} catch {
				backupPath = void 0;
			}
		}
		const content = encodeSessionLog(header, repaired, zstd);
		const directory = dirname(path);
		const tmp = join(directory, `.mbsf-prune-${process.pid}-${Date.now()}.tmp`);
		try {
			writeFileSync(tmp, content);
			const fd = openSync(tmp, "r+");
			try {
				fsyncSync(fd);
			} finally {
				closeSync(fd);
			}
			renameSync(tmp, path);
			try {
				const dirFd = openSync(directory, "r");
				try {
					fsyncSync(dirFd);
				} finally {
					closeSync(dirFd);
				}
			} catch {}
		} finally {
			rmSync(tmp, { force: true });
		}
		if (wantOfficial) {
			if (options.officialReport !== void 0) options.officialReport.checked += 1;
			let landed;
			try {
				landed = decodeSessionLog(readFileSync(path), zstd);
			} catch {
				landed = void 0;
			}
			if (!(landed === void 0 ? {
				ok: false,
				reason: "落盘文件解码失败"
			} : verifyWithOfficial(landed.header, landed.events, "")).ok) {
				if (options.officialReport !== void 0) options.officialReport.failed += 1;
				if (backupPath !== void 0) {
					const restored = restoreFromBackup(backupPath, path);
					if (options.officialReport !== void 0) if (restored.ok) options.officialReport.restored += 1;
					else options.officialReport.skippedNoBackup += 1;
				} else if (options.officialReport !== void 0) options.officialReport.skippedNoBackup += 1;
				return;
			}
		}
		return {
			path,
			beforeBytes: before.size,
			afterBytes: content.length,
			keptEvents: repaired.length,
			tailRows: rows.length,
			keptStateRows: insertRows.length,
			insertedSteps: inserted,
			checkpointStartSeq: anchorSeq
		};
	} catch (error) {
		if (options.quiet !== false) return void 0;
		throw error;
	}
}
/** 让行（见 SCAN_YIELD_BUDGET_MS）。budget 由调用方持有、跨文件累计。 */
async function yieldToEventLoop(budget) {
	if (Date.now() - budget.last < 20) return;
	budget.last = Date.now();
	await new Promise((resolve) => {
		setImmediate(resolve);
	});
}
async function scanAndPruneSessions(dshHome, options) {
	const result = {
		pruned: [],
		skipped: 0,
		freedBytes: 0
	};
	const yieldBudget = { last: Date.now() };
	const sessionsRoot = join(dshHome, "sessions");
	let workspaceDirs;
	try {
		workspaceDirs = readdirSync(sessionsRoot);
	} catch {
		return result;
	}
	const cutoff = options.minAgeMs !== void 0 && options.minAgeMs > 0 ? Date.now() - options.minAgeMs : 0;
	for (const workspace of workspaceDirs) {
		let sessionDirs;
		try {
			sessionDirs = readdirSync(join(sessionsRoot, workspace));
		} catch {
			continue;
		}
		for (const session of sessionDirs) {
			if (options.sessionFilter !== void 0 && !options.sessionFilter(session, workspace)) continue;
			const directory = join(sessionsRoot, workspace, session);
			for (const name of [
				"session.v4.jsonl.zstd",
				"session.v3.jsonl.zstd",
				"session.jsonl.zstd",
				"session.v4.jsonl",
				"session.v3.jsonl",
				"session.jsonl"
			]) {
				const path = join(directory, name);
				if (!existsSync(path)) continue;
				if (cutoff > 0) try {
					if (statSync(path).mtimeMs > cutoff) {
						result.skipped += 1;
						continue;
					}
				} catch {
					continue;
				}
				await yieldToEventLoop(yieldBudget);
				const outcome = pruneSessionFile(path, {
					thresholdBytes: options.thresholdBytes,
					...options.backup === void 0 ? {} : { backup: options.backup },
					...options.backupDir === void 0 ? {} : { backupDir: options.backupDir },
					...options.minTurns === void 0 ? {} : { minTurns: options.minTurns },
					...options.officialVerify === void 0 ? {} : { officialVerify: options.officialVerify },
					...options.officialReport === void 0 ? {} : { officialReport: options.officialReport },
					...options.requireHead === void 0 ? {} : { requireHead: options.requireHead }
				});
				if (outcome === void 0) result.skipped += 1;
				else {
					result.pruned.push(outcome);
					result.freedBytes += outcome.beforeBytes - outcome.afterBytes;
				}
			}
		}
	}
	return result;
}
/** 新建一个官方验证计数（调用侧持有、跨文件共享）。 */
function newOfficialVerifyReport() {
	return {
		checked: 0,
		unsupported: 0,
		failed: 0,
		restored: 0,
		skippedNoBackup: 0,
		unsupportedPaths: /* @__PURE__ */ new Set()
	};
}
/** 记一个「官方不可读」文件——**按路径去重**（同一文件 strip/prune 各扫一次）。 */
function markUnsupported(report, path) {
	if (report.unsupportedPaths.has(path)) return;
	report.unsupportedPaths.add(path);
	report.unsupported += 1;
}
/** 会带 `stream` 字段的事件类型（DSH 侧只有这两个）。 */
const STREAM_EVENT_TYPES = /* @__PURE__ */ new Set(["assistant/message", "assistant/attempt"]);
/**
* 剥离单个会话日志里的 assistant stream。
*
* **剥离语义**：把 `data.stream` 换成 `[]`——**不能删字段**。DSH 读侧
* `assertAssistantSettlementShape`（packages/core/session/src/index.ts:288）
* 要求 `Array.isArray(data.stream)`，缺字段直接抛
* `seed assistant/message at index N has invalid settlement fields`；空数组合法，
* 且 `expandAssistantStream([])` 返回 `[]` → `assertCurrentAssistantStreams`
* 里 `timed.length === 0` 直接 `continue`（跳过 message.content 一致性校验）。
* 2026-09-20 实测：11.5MB 会话剥离后 3.4MB（−70%），经 DSH 官方
* `verifyJsonlCurrentGeneration` 校验通过。
*
* **为什么安全**：stream 是模型逐字打字录像（每个 delta + 到达时间），只服务
* TTFT 这类诊断指标。模型可见历史取自 `message.content`（另一字段，不动），
* 图片块也在 `content` 里（不在 stream）——剥离对对话内容、模型上下文、
* 计费全部无损。
*
* **保留策略**：从**后往前**数，最近 `keepCount` 条带 stream 的事件保留，
* 更早的剥离。0 = 全剥。
*
* 安全前置：原文件不动，直到新产物写完并通过 seq 连续性门禁；验证后临时
* 文件 + fsync + 原子 rename。
*
* @returns 成功时返回结果；文件不存在 / 无 stream 可剥 / 验证失败时返回
*          undefined（原文件保持原样）。
*/
function stripSessionStreams(path, options) {
	let before;
	try {
		before = statSync(path);
	} catch {
		return;
	}
	if (before.size === 0) return void 0;
	try {
		const zstd = path.endsWith(".zstd");
		const buffer = readFileSync(path);
		const { header, events } = decodeSessionLog(buffer, zstd);
		const wantOfficial = options.officialVerify === true;
		if (wantOfficial) {
			if (!isOfficiallyReadable(header, events).readable) {
				if (options.officialReport !== void 0) markUnsupported(options.officialReport, path);
				return;
			}
		}
		const keepCount = Math.max(0, Math.floor(options.keepCount));
		const keepIdx = /* @__PURE__ */ new Set();
		if (keepCount > 0) {
			let seen = 0;
			for (let i = events.length - 1; i >= 0; i -= 1) {
				const event = events[i];
				if (!STREAM_EVENT_TYPES.has(event.type)) continue;
				const stream = event.data?.stream;
				if (!Array.isArray(stream) || stream.length === 0) continue;
				if (seen < keepCount) {
					keepIdx.add(i);
					seen += 1;
				}
			}
		}
		let stripped = 0;
		const out = events.map((event, i) => {
			if (!STREAM_EVENT_TYPES.has(event.type)) return event;
			const data = event.data;
			if (data === void 0 || !Array.isArray(data.stream) || data.stream.length === 0) return event;
			if (keepIdx.has(i)) return event;
			stripped += 1;
			return {
				...event,
				data: {
					...data,
					stream: []
				}
			};
		});
		if (stripped === 0) return void 0;
		const content = encodeSessionLog(header, out, zstd);
		const back = decodeSessionLog(content, zstd);
		if (back.events.length !== out.length) return void 0;
		for (let i = 0; i < back.events.length; i += 1) if (back.events[i].seq !== i) return void 0;
		if (wantOfficial) {
			if (!verifyWithOfficial(header, out, "").ok) {
				if (options.officialReport !== void 0) {
					options.officialReport.checked += 1;
					options.officialReport.failed += 1;
				}
				return;
			}
		}
		let backupPath;
		if (options.backup !== false) {
			const backupDir = options.backupDir ?? join(resolveMbsfDataDir(), "strip-backups");
			const backupName = `${basename(dirname(path))}.${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.${zstd ? "jsonl.zstd" : "jsonl"}`;
			try {
				mkdirSync(backupDir, { recursive: true });
				backupPath = join(backupDir, backupName);
				writeFileSync(backupPath, buffer);
			} catch {
				backupPath = void 0;
			}
		}
		const directory = dirname(path);
		const tmp = join(directory, `.mbsf-strip-${process.pid}-${Date.now()}.tmp`);
		try {
			writeFileSync(tmp, content);
			const fd = openSync(tmp, "r+");
			try {
				fsyncSync(fd);
			} finally {
				closeSync(fd);
			}
			renameSync(tmp, path);
			try {
				const dirFd = openSync(directory, "r");
				try {
					fsyncSync(dirFd);
				} finally {
					closeSync(dirFd);
				}
			} catch {}
		} finally {
			rmSync(tmp, { force: true });
		}
		if (wantOfficial) {
			if (options.officialReport !== void 0) options.officialReport.checked += 1;
			let landed;
			try {
				landed = decodeSessionLog(readFileSync(path), zstd);
			} catch {
				landed = void 0;
			}
			if (!(landed === void 0 ? {
				ok: false,
				reason: "落盘文件解码失败"
			} : verifyWithOfficial(landed.header, landed.events, "")).ok) {
				if (options.officialReport !== void 0) options.officialReport.failed += 1;
				if (backupPath !== void 0) {
					const restored = restoreFromBackup(backupPath, path);
					if (options.officialReport !== void 0) if (restored.ok) options.officialReport.restored += 1;
					else options.officialReport.skippedNoBackup += 1;
				} else if (options.officialReport !== void 0) options.officialReport.skippedNoBackup += 1;
				return;
			}
		}
		return {
			path,
			beforeBytes: before.size,
			afterBytes: content.length,
			stripped,
			kept: keepIdx.size
		};
	} catch {
		return;
	}
}
/**
* 扫描一个 DSH 会话根目录下的全部会话日志，逐个剥离 stream。
*
* **文件名形态**（2026-09-26 实测全库）：`session.v4.jsonl.zstd`（0.1.7 现行，App 版）
* / `session.v3.jsonl.zstd`（0.1.5）/ `session.jsonl.zstd`（0.1.4 及更早）。
* 三者都要处理——**这是既有 `scanAndPruneSessions` 的缺口**（它只认最旧形态，
* 漏掉 v3 文件 264MB；v4 于 2026-09-26 同缺口补齐）。
*
* **归档会话不区分**：一帆 2026-09-20 定「剥离工作区有的全部会话——已归档的
* 不会被加载进内存不用管」。归档与否不改变「文件在磁盘上占空间」这一事实，
* 全扫即可。
*/
async function scanAndStripStreams(dshHome, options) {
	const result = {
		stripped: [],
		skipped: 0,
		freedBytes: 0
	};
	const yieldBudget = { last: Date.now() };
	const sessionsRoot = join(dshHome, "sessions");
	let workspaceDirs;
	try {
		workspaceDirs = readdirSync(sessionsRoot);
	} catch {
		return result;
	}
	const cutoff = options.minAgeMs !== void 0 && options.minAgeMs > 0 ? Date.now() - options.minAgeMs : 0;
	const threshold = options.thresholdBytes ?? 0;
	const CANDIDATE_NAMES = [
		"session.v4.jsonl.zstd",
		"session.v3.jsonl.zstd",
		"session.jsonl.zstd",
		"session.v4.jsonl",
		"session.v3.jsonl",
		"session.jsonl"
	];
	for (const workspace of workspaceDirs) {
		let sessionDirs;
		try {
			sessionDirs = readdirSync(join(sessionsRoot, workspace));
		} catch {
			continue;
		}
		for (const session of sessionDirs) {
			if (options.sessionFilter !== void 0 && !options.sessionFilter(session, workspace)) continue;
			const directory = join(sessionsRoot, workspace, session);
			for (const name of CANDIDATE_NAMES) {
				const path = join(directory, name);
				if (!existsSync(path)) continue;
				if (threshold > 0) try {
					if (statSync(path).size < threshold) {
						result.skipped += 1;
						continue;
					}
				} catch {
					continue;
				}
				if (cutoff > 0) try {
					if (statSync(path).mtimeMs > cutoff) {
						result.skipped += 1;
						continue;
					}
				} catch {
					continue;
				}
				await yieldToEventLoop(yieldBudget);
				const outcome = stripSessionStreams(path, {
					keepCount: options.keepCount,
					...options.backup === void 0 ? {} : { backup: options.backup },
					...options.backupDir === void 0 ? {} : { backupDir: options.backupDir },
					...options.officialVerify === void 0 ? {} : { officialVerify: options.officialVerify },
					...options.officialReport === void 0 ? {} : { officialReport: options.officialReport }
				});
				if (outcome === void 0) result.skipped += 1;
				else {
					result.stripped.push(outcome);
					result.freedBytes += outcome.beforeBytes - outcome.afterBytes;
				}
			}
		}
	}
	return result;
}
/**
* 用 **DSH 官方存储契约验证器**校验产物（与宿主读侧同一处、同一拒绝行为）。
*
* 为什么用官方验证器而不是自研校验：`storage-contract` 的设计目标原文是
* *"Backend-shared storage validation … one place so every backend refuses the
* same inputs identically"*——它就是 DSH 读侧的门。自研三重验证（step 配对 +
* seq 连续 + 编码读回）只覆盖我们知道的失效模式；官方验证器覆盖**我们不知道
* 的**（未知事件类型、新版 harness 写的格式、`request/header` 的 legacy
* `fallback` reason 等），失败即拒绝，正是我们想要的 fail-closed 行为。
*
* **⚠️ 必须先展开物理行 → 逻辑事件**（2026-09-20 实测发现）：`validateStoredEvents`
* 吃的是**逻辑事件**，而 `decodeSessionLog` 产出的是**物理行**——v3 打包行
* （`assistant/chunk` 等）在逻辑层根本不存在。直接喂物理行会被判
* `contains event type "assistant/chunk" … unknown to this harness` 而误拒
* （实测 12 个真实日志里 7 个这样挂掉——它们本身完全健康）。
* 展开走与 `verifyPrunedTail` 同一个口：`openLogReader(header).decodeAll(rows)`。
*
* 三层各自的作用（互补，不重复）：
*  ① `validateStoredEvents` — 逐事件校验 + 冻结：未知必需事件类型 / legacy
*     格式即抛（**会原地改写 events 数组**——`adoptSessionEvent` 归一化，
*     所以传入前先拷贝）。
*  ② `assertContiguous` — seq 从 0 起连续（DSH 读侧强制不变式）。
*  ③ `foldSurface` — surface op / provenance / replace 区间可重放。
*
* @param header - 日志首行（`type: 'session'` 的 header 对象）。
* @param events - **物理行**列表（`decodeSessionLog` 的产物；内部先展开成逻辑事件）。
* @param sessionId - 会话 id（`assertContiguous` 的错误信息用；空串也可）。
* @returns 通过 `{ ok: true }`；失败 `{ ok: false, reason }`。
*/
function verifyWithOfficial(header, events, sessionId) {
	try {
		const reader = openLogReader(header);
		if (reader === null) return {
			ok: false,
			reason: "官方格式口拒绝该头（openLogReader → null）"
		};
		const artifact = reader.decodeAll(events);
		if (artifact === null) return {
			ok: false,
			reason: "物理行展开失败（decodeAll → null）"
		};
		const hostVerifier = resolveOfficialVerifier();
		const hostSession = resolveSessionLib();
		const validateStoredEvents$1 = hostVerifier?.mod.validateStoredEvents ?? validateStoredEvents;
		const assertContiguous$1 = hostVerifier?.mod.assertContiguous ?? assertContiguous;
		const foldSurface$1 = hostSession?.mod.foldSurface ?? foldSurface;
		const SessionId$1 = hostSession?.mod.SessionId ?? SessionId;
		const copy = artifact.events.map((event) => ({ ...event }));
		const meta = header;
		const validated = validateStoredEvents$1(meta, copy, void 0);
		assertContiguous$1(SessionId$1(sessionId === "" ? String(meta.id ?? "") : sessionId), validated, 0);
		foldSurface$1(validated);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			reason: String(error)
		};
	}
}
/**
* 从备份文件名解析会话键。
*
* 备份命名（`session-prune.ts` 写入侧）：
*   `<会话目录名>.<ISO时间戳>.jsonl[.zstd]`
* 会话目录名形如 `session-<UUID>`（0.1.5）或 `<UUID>`（更早）——两种前缀
* **归一化为同一个 `<UUID>`**（现有 `bin/session-reset.ts` 的双前缀匹配同式）。
*
* 无法反查会话的旧格式（`mbsf-prune-<随机>` 等）→ `__legacy__` 单桶，
* 按同一 keep-N 规则处理（不跳过——否则旧备份永远清不掉）。
*/
function backupSessionKey(name) {
	const stem = name.replace(/\.jsonl(\.zstd)?$/, "");
	const m = /^(.*)\.(\d{4}-\d{2}-\d{2}T[\d-]+Z)$/.exec(stem);
	const key = m === null ? stem : m[1];
	const stripped = key.startsWith("session-") ? key.slice(8) : key;
	if (!/^[0-9a-fA-F-]{8,}$/.test(stripped)) return "__legacy__";
	return stripped;
}
/**
* 清理备份目录：**每会话保留最近 N 份**（按文件名排序 + mtime 兜底）。
*
* 为什么是「每会话 N 份」而不是「总共 N 份」：按总份数截断可能删光某个会话的
* 全部备份 ⟹ 那个会话就失去回滚能力了。每会话 N 份保证**每个会话都可回滚**。
*
* @param dir - 备份目录（`prune-backups/` 或 `strip-backups/`）。
* @param keepPerSession - 每会话保留份数；**0 = 不设上限**（保留全部，不删）。
* @returns 删除份数 / 释放字节 / 剩余现状。
*/
function pruneBackupDir(dir, keepPerSession) {
	const result = {
		removed: 0,
		freedBytes: 0,
		total: 0,
		totalBytes: 0
	};
	let names;
	try {
		names = readdirSync(dir);
	} catch {
		return result;
	}
	const groups = /* @__PURE__ */ new Map();
	for (const name of names) {
		const path = join(dir, name);
		let st;
		try {
			st = statSync(path);
		} catch {
			continue;
		}
		if (!st.isFile()) continue;
		const entry = {
			name,
			path,
			sessionKey: backupSessionKey(name),
			mtimeMs: st.mtimeMs,
			bytes: st.size
		};
		result.total += 1;
		result.totalBytes += entry.bytes;
		const bucket = groups.get(entry.sessionKey);
		if (bucket === void 0) groups.set(entry.sessionKey, [entry]);
		else bucket.push(entry);
	}
	if (keepPerSession <= 0) return result;
	for (const bucket of groups.values()) {
		bucket.sort((a, b) => a.name === b.name ? b.mtimeMs - a.mtimeMs : b.name.localeCompare(a.name));
		for (const entry of bucket.slice(keepPerSession)) try {
			rmSync(entry.path, { force: true });
			result.removed += 1;
			result.freedBytes += entry.bytes;
			result.total -= 1;
			result.totalBytes -= entry.bytes;
		} catch {}
	}
	return result;
}
/** 备份目录现状（份数 + 占用），用于设置页显示。 */
function backupDirStats(dir) {
	const out = {
		count: 0,
		bytes: 0
	};
	let names;
	try {
		names = readdirSync(dir);
	} catch {
		return out;
	}
	for (const name of names) try {
		const st = statSync(join(dir, name));
		if (!st.isFile()) continue;
		out.count += 1;
		out.bytes += st.size;
	} catch {}
	return out;
}
/** 两个备份目录的默认路径（脑数据目录内）。 */
function pruneBackupDirPath() {
	return join(resolveMbsfDataDir(), "prune-backups");
}
/** 剥离备份目录的默认路径。 */
function stripBackupDirPath() {
	return join(resolveMbsfDataDir(), "strip-backups");
}
/**
* 从备份还原原文件（`rename` 原子替换）。
*
* 为什么 rename 而不是 copy：备份已含完整原文，rename 既原子又省一次全量写。
* 备份被移走后即消失——这正是想要的（还原成功后不该留着同一份内容两份）。
*
* @param backupPath - 备份文件路径。
* @param targetPath - 原日志路径。
*/
function restoreFromBackup(backupPath, targetPath) {
	try {
		if (!existsSync(backupPath)) return {
			ok: false,
			reason: "备份文件不存在"
		};
		renameSync(backupPath, targetPath);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			reason: String(error)
		};
	}
}
/**
* 文件原文是否**官方可读**（改前预检——决定该文件能否进入清理流程）。
*
* **为什么需要**（2026-09-20 全库实测）：159 个日志里 **38 个 / 80.7MB
* （占全库 39.8% 体积）是 v0 旧格式**，DSH 官方迁移链自己就拒绝：
* `format-v0-to-v1 refuses … compaction/summary data lacks required member`
* （37 个）与 `format-v2-to-v3 refuses … turn must be positive`（1 个）。
* **DSH 读侧用的就是同一个 `recovery: 'strict'`**（`dsh-session-persistence-jsonl`
* `/lib/index.js:983`）⟹ 这些文件 **DSH 自己现在也打不开**。
*
* 官方验证器对它们**恒失败**（与我们改没改无关）。若不预检就直接「验证失败
* 即还原」，strip 会对这 80.7MB 白做一轮（改 → 验证失败 → 还原 → 回原样），
* 纯浪费且报告里全是假故障。
*
* **语义**：验证的目的是「证明**我们的改动**没弄坏文件」。对本来就打不开的
* 文件，验证失败不构成「我们弄坏了」的证据 ⟹ 原文验不过 = **跳过该文件**
* （不修改、不还原），报告标「官方格式不支持」——诚实降级，不假装成功。
*
* @returns 可读 `true`；不可读 / 读不了 `false`（含 reason）。
*/
function isOfficiallyReadable(header, events, sessionId = "") {
	const result = verifyWithOfficial(header, events, sessionId);
	return result.ok ? { readable: true } : {
		readable: false,
		...result.reason === void 0 ? {} : { reason: result.reason }
	};
}
//#endregion
//#region lib/types/cleanup-gates.js
/**
* 清理双闸（2026-10-02 立）——「剪裁完所有会话都看不到」的结构性防线。
*
* ## 为什么需要（事故复盘）
*
* 2026-10-02 21:55 那次清理把 9 个会话剪成了**读不出内容**的产物：
* 剪裁把 `compaction/start` + `compaction/summary` 全部丢弃（原件 4 个 → 产物 0 个），
* App 读侧因此拿不到任何可渲染的表面。**整个过程零报错**——
* `cleanup-stats.json` 里 `failed: 0, restored: 0`，看起来一切正常。
*
* 三个教训：
*  1. **同一个验证器不能既当运动员又当裁判**。当时的 `officialVerify` 用的是
*     `verifyWithOfficial`，它与剪裁共享同一套「什么算可读」的假设 ⟹ 剪裁漏掉的
*     东西它也不检查。**自检必须用独立判据**（本模块的 `auditSessionFile`）。
*  2. **「没报错」≠「没坏」**。丢事件是**静默**的，只在用户打开会话时暴露。
*     ⟹ 必须主动比对**清理前 / 清理后**的可读性基线。
*  3. **体积不是成功指标**。释放 138MB 那次恰恰是坏得最狠的一次。
*     ⟹ 判据必须是**内容完整性**（关键事件类型是否还在），不是字节数。
*
* ## 闸一：剪裁后自检（`auditSessionFile`）
*
* 对**被改动过的每个文件**跑独立判据：
*  · 结构：zstd 帧可逐帧解、首帧是独立 header（一行）、无 torn tail；
*  · 内容：关键事件类型（`compaction/start`、`compaction/summary`）若**改前有**
*    则**改后必须仍有**——这条直接命中本次事故；
*  · seq：连续无断口。
*
* ## 闸二：健康基线（`captureBaseline` / `compareBaseline`）
*
* 清理**前**记录全库每个会话的可读性 + 关键事件计数；清理**后**再测一遍，
* 逐个对比。任何文件从「可读」变「不可读」、或关键事件数下降 ⟹
* **报警 + 自动从备份还原**（备份恒开，还原路径已存在）。
*
* 两道闸都**不依赖** `verifyWithOfficial`：本模块自带解析，避免与剪裁共享盲区。
*/
/**
* 关键事件类型——**丢了就读不出内容**的那些。
*
* `compaction/start` + `compaction/summary`：本次事故的元凶。App 的表面折叠
* 依赖它们；全丢 ⟹ 会话列表里点开是空的。剪裁**应当保留锚点**（设计如此），
* 所以「改前有、改后无」一定是缺陷，不是有意为之。
*/
const CRITICAL_TYPES = ["compaction/start", "compaction/summary"];
/** zstd 帧魔数（`0xFD2FB528`）——**外部格式定值，不是可调参数**。
*  [OBS] 用于识别日志文件是否 zstd 压缩（App 版 0.1.7 起 `session.v4.jsonl.zstd`）；
*  值来自 zstd 帧格式规范（RFC 8878 §3.1.1.1），改它 = 认错格式，非标定项。 */
const ZSTD_MAGIC = 4247762216;
/**
* 扫描 zstd 帧边界（**本模块自带**，不复用剪裁的 `scanZstdFrames`）。
*
* 刻意独立实现：如果自检复用剪裁的扫描器，剪裁的分帧 bug 会同时骗过自检。
* 判据与 App 读侧一致——逐帧独立、首帧必须是单独一行 header。
*/
function scanFrames(buffer) {
	const frames = [];
	let offset = 0;
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) return {
			frames,
			tornStart: start
		};
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`invalid frame magic at byte ${offset}`);
		offset += 4;
		if (offset === buffer.length) return {
			frames,
			tornStart: start
		};
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) throw new Error(`reserved frame-header bit at byte ${offset - 1}`);
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? singleSegment ? 1 : 0 : 1 << contentSizeFlag;
		const remaining = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remaining) return {
			frames,
			tornStart: start
		};
		offset += remaining;
		for (;;) {
			if (buffer.length - offset < 3) return {
				frames,
				tornStart: start
			};
			const blockHeader = buffer.readUIntLE(offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = blockHeader >>> 1 & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) throw new Error(`reserved block type at byte ${offset - 3}`);
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) return {
				frames,
				tornStart: start
			};
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) return {
				frames,
				tornStart: start
			};
			offset += 4;
		}
		frames.push({
			start,
			end: offset
		});
	}
	return { frames };
}
/**
* 审计一个会话文件（**独立判据**——不经过 `verifyWithOfficial`）。
*
* 永不抛错：任何异常都折成 `ok: false` + `reasons`，便于基线比对时逐个报告。
*/
function auditSessionFile(path) {
	const reasons = [];
	const warnings = [];
	const empty = {
		path,
		ok: false,
		reasons,
		events: 0,
		frames: 0,
		critical: {},
		types: {},
		turns: {
			total: 0,
			empty: 0,
			assistantMessages: 0
		}
	};
	let buffer;
	try {
		buffer = readFileSync(path);
	} catch (error) {
		reasons.push(`读取失败：${String(error)}`);
		return empty;
	}
	if (buffer.length === 0) {
		reasons.push("文件为空（0 字节）");
		return empty;
	}
	let frames = [];
	let tornStart;
	try {
		const scan = scanFrames(buffer);
		frames = scan.frames;
		tornStart = scan.tornStart;
	} catch (error) {
		reasons.push(`帧结构损坏：${String(error)}`);
		return empty;
	}
	if (frames.length === 0) {
		reasons.push("无完整 zstd 帧");
		return empty;
	}
	if (tornStart !== void 0) reasons.push(`末帧不完整（torn tail at byte ${tornStart}）`);
	const types = {};
	let prevSeq;
	let events = 0;
	/** compaction checkpoint 计数（`user/message` 且 source.kind === 'compact-checkpoint'）。 */
	let checkpoints = 0;
	/**
	* 回合饱满度累计（2026-11-02 立——见 `TurnCoverage`）。
	*
	* 逐事件维护「当前回合有没有见过 assistant/message」，遇 `turn/start`
	* 结算上一回合。O(1) 状态，不额外驻留任何行 ⟹ 与流式处理纪律一致。
	*/
	const coverage = {
		total: 0,
		empty: 0,
		assistantMessages: 0
	};
	/** 当前回合是否已见 `assistant/message`（`undefined` = 尚未进入任何回合）。 */
	let curTurnHasAssistant;
	let lineCount = 0;
	let firstFrameLines = [];
	/**
	* 关系重放需要的原始行——**仅在总体量低于预算时保留**。
	*
	* 关系重放（`assertReleasedV4Relationships`）要求一次性拿到全部事件对象，
	* 天然是 O(全文) 内存。大文件（如那个 614MB 的）无论如何都喂不进去，故设
	* 预算：超预算就**跳过关系重放**并记 warning——诚实降级好过假装审过。
	* 结构检查（帧/header/seq/类型）仍然全覆盖，那是本模块的主判据。
	*
	* [OBS] 64MB = 资源护栏（E.26 登记）——**非判定阈值**：它只决定「这条增强
	* 检查跑不跑」，不改变任何「什么算可读」的判据。取值依据 = 关系重放天然
	* O(全文) 内存，而本模块的常规目标是全库会话逐个审；单个 614MB 明文的文件
	* 无论如何喂不进去（见 `auditSessionFile` 头注），故只需覆盖「正常会话」。
	*/
	let replayLines = [];
	let replayBytes = 0;
	/** [OBS] 关系重放保留行预算（资源护栏非判定阈值——超预算跳过重放并记 warning，
	*  依据见上方注释；E.26 登记）。
	*
	*  ⚠️ 用块注释而非 `//`：`check-constants.py` 只把块注释累加进「上一注释单元」，
	*  独立 `//` 行注释不被吸收 ⟹ 用 `//` 写会让本常量被判「裸奔」（E.102 同款踩坑）。 */
	const RELATION_REPLAY_BUDGET = 64 * 1024 * 1024;
	for (let frameIdx = 0; frameIdx < frames.length; frameIdx += 1) {
		const frame = frames[frameIdx];
		let plain;
		try {
			plain = zstdDecompressSync(buffer.subarray(frame.start, frame.end));
		} catch (error) {
			reasons.push(`帧 @${frame.start} 解码失败：${String(error)}`);
			return {
				...empty,
				frames: frames.length
			};
		}
		const frameLines = plain.toString("utf8").split("\n").filter((l) => l.trim() !== "");
		if (frameIdx === 0) firstFrameLines = frameLines;
		if (replayLines !== void 0) if (replayBytes + plain.length <= RELATION_REPLAY_BUDGET) {
			for (const line of frameLines) replayLines.push(line);
			replayBytes += plain.length;
		} else replayLines = void 0;
		for (const line of frameLines) {
			lineCount += 1;
			if (lineCount === 1) continue;
			let parsed;
			try {
				parsed = JSON.parse(line);
			} catch {
				reasons.push("存在非法 JSON 行");
				break;
			}
			if (parsed.type === "session") continue;
			events += 1;
			const t = typeof parsed.type === "string" ? parsed.type : "(无类型)";
			types[t] = (types[t] ?? 0) + 1;
			if (t === "turn/start") {
				if (curTurnHasAssistant !== void 0) {
					coverage.total += 1;
					if (!curTurnHasAssistant) coverage.empty += 1;
				}
				curTurnHasAssistant = false;
			} else if (t === "assistant/message") {
				coverage.assistantMessages += 1;
				if (curTurnHasAssistant !== void 0) curTurnHasAssistant = true;
			}
			if (t === "user/message") {
				if ((parsed.data?.source)?.kind === "compact-checkpoint") checkpoints += 1;
			}
			if (typeof parsed.seq === "number") {
				if (prevSeq !== void 0 && parsed.seq !== prevSeq + 1) reasons.push(`seq 断口：${prevSeq} → ${parsed.seq}`);
				prevSeq = parsed.seq;
			}
		}
		if (reasons.includes("存在非法 JSON 行")) break;
	}
	if (lineCount === 0) {
		reasons.push("无任何行");
		return {
			...empty,
			frames: frames.length
		};
	}
	if (curTurnHasAssistant !== void 0) {
		coverage.total += 1;
		if (!curTurnHasAssistant) coverage.empty += 1;
	}
	if (firstFrameLines.length !== 1) reasons.push(`首帧含 ${firstFrameLines.length} 行（App 要求独立 header 帧）`);
	try {
		if (JSON.parse(firstFrameLines[0] ?? "").type !== "session") reasons.push("首帧不是 session header");
	} catch {
		reasons.push("首帧不是合法 JSON");
	}
	const critical = {};
	for (const t of CRITICAL_TYPES) critical[t] = types[t] ?? 0;
	const relAssert = resolveRelationshipsAssert();
	const knownTypes = resolveSessionLib()?.mod?.KNOWN_SESSION_EVENT_TYPES;
	if (relAssert !== null && knownTypes !== void 0 && replayLines === void 0) warnings.push(`文件过大（明文 > ${(RELATION_REPLAY_BUDGET / 1048576).toFixed(0)}MB）——关系重放跳过，仅结构检查生效`);
	if (relAssert !== null && knownTypes !== void 0 && replayLines !== void 0) try {
		const events = replayLines.map((line) => {
			try {
				return JSON.parse(line);
			} catch {
				return null;
			}
		}).filter((e) => e !== null && e["type"] !== "session");
		const { type: _t, ...headerRest } = JSON.parse(replayLines[0]);
		relAssert.mod.assertReleasedV4Relationships({
			header: headerRest,
			events,
			inheritedEventCount: 0
		}, knownTypes);
	} catch (error) {
		reasons.push(`关系重放失败：${error instanceof Error ? error.message : String(error)}`);
	}
	const hasCompactionFrames = CRITICAL_TYPES.some((t) => (types[t] ?? 0) > 0);
	if (checkpoints > 0 && !hasCompactionFrames) warnings.push(`含 ${checkpoints} 个 compaction checkpoint 但无 compaction/start|summary（可能是有意剪裁，需基线比对确认）`);
	return {
		path,
		ok: reasons.length === 0,
		reasons,
		events,
		frames: frames.length,
		critical,
		types,
		warnings,
		turns: coverage
	};
}
/** 全库会话文件枚举（只找 `session.v4.jsonl.zstd`）。 */
function listSessionFiles(dshHome) {
	const out = [];
	const sessionsDir = join(dshHome, "sessions");
	let workspaces;
	try {
		workspaces = readdirSync(sessionsDir);
	} catch {
		return out;
	}
	for (const ws of workspaces) {
		const wsDir = join(sessionsDir, ws);
		let ids;
		try {
			if (!statSync(wsDir).isDirectory()) continue;
			ids = readdirSync(wsDir);
		} catch {
			continue;
		}
		for (const id of ids) {
			const p = join(wsDir, id, "session.v4.jsonl.zstd");
			try {
				if (statSync(p).isFile()) out.push(p);
			} catch {}
		}
	}
	return out;
}
/** 捕获基线（**清理前**调用）。 */
function captureBaseline(dshHome) {
	const files = {};
	for (const p of listSessionFiles(dshHome)) try {
		files[p] = auditSessionFile(p);
	} catch (error) {
		files[p] = {
			path: p,
			ok: false,
			events: 0,
			frames: 0,
			critical: {},
			types: {},
			reasons: [`审计异常：${error instanceof Error ? error.message : String(error)}`],
			turns: {
				total: 0,
				empty: 0,
				assistantMessages: 0
			}
		};
	}
	return {
		at: (/* @__PURE__ */ new Date()).toISOString(),
		files
	};
}
/**
* 基线比对（**清理后**调用）——闸二的核心。
*
* 只报**退化**（改前好、改后坏）。改前就坏的文件不报（不是我们弄坏的，
* 与 `isOfficiallyReadable` 预检的「不白做」语义一致）。
*/
function compareBaseline(baseline, _dshHome) {
	const out = [];
	for (const [path, before] of Object.entries(baseline.files)) {
		if (!before.ok) continue;
		let after;
		try {
			after = auditSessionFile(path);
		} catch (error) {
			out.push({
				path,
				kind: "vanished",
				detail: String(error)
			});
			continue;
		}
		if (!after.ok) {
			out.push({
				path,
				kind: "unreadable",
				detail: after.reasons.join("；")
			});
			continue;
		}
		if (before.frames >= 100 && after.frames <= 2) out.push({
			path,
			kind: "frame-collapse",
			detail: `帧数由 ${before.frames} 塌陷至 ${after.frames}（应按行分帧——App 按帧增量读取）`
		});
		for (const [type, count] of Object.entries(before.critical)) {
			if (CRITICAL_TYPES.includes(type)) continue;
			if (count > 0 && (after.critical[type] ?? 0) === 0) out.push({
				path,
				kind: "critical-lost",
				detail: `${type} 由 ${count} 条变为 0 条`
			});
		}
		const beforeTurns = before.turns;
		const afterTurns = after.turns;
		if (beforeTurns.total > 0 && afterTurns.total > 0) {
			const beforeRate = beforeTurns.empty / beforeTurns.total;
			const afterRate = afterTurns.empty / afterTurns.total;
			if (afterRate >= .5 && afterRate > beforeRate + .2) out.push({
				path,
				kind: "turns-emptied",
				detail: `空回合（无助手回复）由 ${beforeTurns.empty}/${beforeTurns.total} 升至 ${afterTurns.empty}/${afterTurns.total}（助手消息 ${beforeTurns.assistantMessages} → ${afterTurns.assistantMessages} 条）`
			});
			else if (beforeTurns.assistantMessages >= 10 && afterTurns.assistantMessages < beforeTurns.assistantMessages * .1) out.push({
				path,
				kind: "turns-emptied",
				detail: `助手消息由 ${beforeTurns.assistantMessages} 条塌陷至 ${afterTurns.assistantMessages} 条（不足 10%）`
			});
		}
	}
	return out;
}
//#endregion
//#region lib/types/cleanup.js
/**
* 重启清理统一入口（2026-09-20）
*
* **唯一触发点 = 重启间隙**（一帆 2026-09-20 定「不要启动剪的功能，只能重启
* 剪……最终都是重启后剪的效果才到内存里」）。本模块在 **runner 内、停 dsh
* 之后**执行，此时是唯一全局静默窗口：
*
*  - 没有会话在写 ⟹ 无需 mtime 门 / 租约锁探测（那些是「启动清理」在 dsh
*    进程内跑时才需要的活跃判据——随启动清理一并退役）
*  - 清理后 dsh 从小日志重载 ⟹ **磁盘收益与内存收益在此合一**（启动清理剪的
*    是磁盘，内存里的 `Session.events` 一份没少——对内存恒无效）
*
* 流程：剥离 stream → 剪裁日志（全库）→ 清理备份 → 官方验证（内联在剥离/
* 剪裁里）→ 统计落盘。每一步都逐文件独立——一个文件失败不影响其它文件。
*
* @module mbsf-compaction/cleanup
*/
/** 清理统计文件路径（只记最近一次，新覆盖旧）。 */
function cleanupStatsPath() {
	return join(resolveMbsfDataDir(), "cleanup-stats.json");
}
/** 写清理统计（失败静默——统计是诊断产物，不阻断重启）。 */
function writeCleanupStats(result) {
	const p = cleanupStatsPath();
	try {
		mkdirSync(dirname(p), { recursive: true });
		writeFileSync(p, `${JSON.stringify(result, null, 2)}\n`);
	} catch {}
}
/**
* 执行一次完整清理（剥离 + 剪裁 + 备份清理 + 官方验证 + 统计）。
*
* **轮数 0 的语义**（关键）：`turns === 0` ⟹ **显式跳过剪裁**，只做剥离。
* **不得传 `minTurns: 0` 给剪裁核心**——那是「无底线」，照样剪（见
* `session-prune.ts` 的 `minTurns` 语义：0 = 第一个候选即采用）。
*
* 逐文件独立：任一文件失败只记进统计，不影响其它文件，也不阻断重启。
*/
async function runCleanup(options) {
	const started = Date.now();
	const report = newOfficialVerifyReport();
	const progress = options.onProgress ?? (() => {});
	const scope = options.sessionIds === void 0 ? "all" : "selected";
	const wanted = options.sessionIds === void 0 ? void 0 : new Set(options.sessionIds);
	const sessionFilter = wanted === void 0 ? void 0 : (sessionId) => wanted.has(sessionId);
	const baseline = captureBaseline(options.dshHome);
	progress("strip", 0, 0);
	const stripOutcome = await scanAndStripStreams(options.dshHome, {
		...sessionFilter === void 0 ? {} : { sessionFilter },
		keepCount: options.streamKeepCount,
		backup: true,
		officialVerify: true,
		officialReport: report
	});
	let pruneOutcome = {
		pruned: [],
		skipped: 0,
		freedBytes: 0
	};
	if (options.turns > 0) {
		progress("prune", 0, 0);
		pruneOutcome = await scanAndPruneSessions(options.dshHome, {
			...sessionFilter === void 0 ? {} : { sessionFilter },
			thresholdBytes: 1,
			minTurns: options.turns,
			minAgeMs: 0,
			backup: true,
			officialVerify: true,
			officialReport: report
		});
	}
	const changed = /* @__PURE__ */ new Set();
	for (const entry of stripOutcome.stripped) {
		const p = changedPathOf(entry);
		if (p !== void 0) changed.add(p);
	}
	for (const entry of pruneOutcome.pruned) {
		const p = changedPathOf(entry);
		if (p !== void 0) changed.add(p);
	}
	const failures = [];
	for (const p of changed) {
		const audit = auditSessionFile(p);
		if (!audit.ok) failures.push({
			path: p,
			reasons: audit.reasons
		});
	}
	const regressions = compareBaseline(baseline, options.dshHome);
	let gateRestored = 0;
	let gateRestoreFailed = 0;
	/** 被基线闸还原回去的文件——它们的「释放量」是假的，统计时扣掉。 */
	const restoredPaths = /* @__PURE__ */ new Set();
	for (const r of regressions) {
		const backup = latestBackupFor(r.path);
		if (backup === void 0) {
			gateRestoreFailed += 1;
			continue;
		}
		if (restoreFromBackup(backup, r.path).ok) {
			gateRestored += 1;
			restoredPaths.add(r.path);
		} else gateRestoreFailed += 1;
	}
	const freedAfterRestore = (entries, total) => {
		let freed = total;
		for (const entry of entries) {
			if (!restoredPaths.has(entry.path)) continue;
			freed -= entry.beforeBytes - entry.afterBytes;
		}
		return Math.max(0, freed);
	};
	const stripFreed = freedAfterRestore(stripOutcome.stripped, stripOutcome.freedBytes);
	const pruneFreed = freedAfterRestore(pruneOutcome.pruned, pruneOutcome.freedBytes);
	progress("backup", 0, 0);
	const pruneBk = pruneBackupDir(pruneBackupDirPath(), options.backupKeep);
	const stripBk = pruneBackupDir(stripBackupDirPath(), options.backupKeep);
	const pruneNow = backupDirStats(pruneBackupDirPath());
	const stripNow = backupDirStats(stripBackupDirPath());
	const result = {
		at: (/* @__PURE__ */ new Date()).toISOString(),
		trigger: "restart",
		seconds: Number(((Date.now() - started) / 1e3).toFixed(1)),
		strip: {
			files: stripOutcome.stripped.length,
			freedBytes: stripFreed,
			skipped: stripOutcome.skipped
		},
		prune: {
			files: pruneOutcome.pruned.length,
			freedBytes: pruneFreed,
			skipped: pruneOutcome.skipped
		},
		verify: {
			checked: report.checked,
			unsupported: report.unsupported,
			failed: report.failed,
			restored: report.restored,
			skippedNoBackup: report.skippedNoBackup
		},
		backups: {
			removed: pruneBk.removed + stripBk.removed,
			freedBytes: pruneBk.freedBytes + stripBk.freedBytes,
			remaining: pruneNow.count + stripNow.count,
			remainingBytes: pruneNow.bytes + stripNow.bytes
		},
		audit: {
			audited: changed.size,
			failed: failures.length,
			failures: failures.slice(0, 10)
		},
		trim: {
			scope,
			sessions: []
		},
		baseline: {
			before: Object.keys(baseline.files).length,
			after: listSessionFiles(options.dshHome).length,
			regressions: regressions.slice(0, 10),
			restored: gateRestored,
			restoreFailed: gateRestoreFailed
		}
	};
	result.trim = summarizeTrim(scope, options.sessionIds ?? [], stripOutcome.stripped, pruneOutcome.pruned);
	progress("done", 1, 1);
	writeCleanupStats(result);
	return result;
}
/** 会话日志路径 → 会话 id（`…/sessions/<workspace>/<session>/<file>`）。 */
function sessionIdOfPath(path) {
	const parts = path.split("/");
	return parts.length >= 2 ? parts[parts.length - 2] : void 0;
}
/**
* 逐会话汇总剥离/剪裁结果（供设置页「上次剪裁」显示）。
*
* 两个口径的差别是刻意的：`all` 只列**真被改动的**会话（全库跑一遍，列几百个
* 没变的会话音频噪声）；`selected` 把勾中的**每个**会话都列出来，哪怕 0 改动
* ——"勾了却没变化"正是要看的东西（比如格式不支持时全是 skipped）。
*/
function summarizeTrim(scope, requested, stripRows, pruneRows) {
	const acc = /* @__PURE__ */ new Map();
	const bump = (id, field, freed) => {
		const row = acc.get(id) ?? {
			stripFiles: 0,
			pruneFiles: 0,
			freedBytes: 0
		};
		row[field] += 1;
		row.freedBytes += Math.max(0, freed);
		acc.set(id, row);
	};
	for (const entry of stripRows) {
		const p = changedPathOf(entry);
		const id = p === void 0 ? void 0 : sessionIdOfPath(p);
		if (id === void 0) continue;
		bump(id, "stripFiles", (entry.beforeBytes ?? 0) - (entry.afterBytes ?? 0));
	}
	for (const entry of pruneRows) {
		const p = changedPathOf(entry);
		const id = p === void 0 ? void 0 : sessionIdOfPath(p);
		if (id === void 0) continue;
		bump(id, "pruneFiles", (entry.beforeBytes ?? 0) - (entry.afterBytes ?? 0));
	}
	return {
		scope,
		sessions: (scope === "selected" ? [...new Set(requested)].sort() : [...acc.keys()].sort()).map((id) => ({
			id,
			stripFiles: acc.get(id)?.stripFiles ?? 0,
			pruneFiles: acc.get(id)?.pruneFiles ?? 0,
			freedBytes: acc.get(id)?.freedBytes ?? 0
		}))
	};
}
/** 从 strip/prune 的返回条目里取被改动文件的路径（形状容错）。 */
function changedPathOf(entry) {
	if (entry === null || typeof entry !== "object") return void 0;
	const p = entry.path;
	return typeof p === "string" && p !== "" ? p : void 0;
}
/**
* 找某个会话文件**最新**的一份备份（剪裁 + 剥离两个目录都找）。
*
* 备份名形如 `<session-id>.<ISO 时刻>.jsonl.zstd`——同一会话可有多份，
* 取 mtime 最新者（还原到最近一次已知良好状态）。
*/
function latestBackupFor(sessionPath) {
	const id = sessionPath.split("/").slice(-2)[0] ?? "";
	if (id === "") return void 0;
	let best;
	for (const dir of [pruneBackupDirPath(), stripBackupDirPath()]) {
		let names;
		try {
			names = readdirSync(dir);
		} catch {
			continue;
		}
		for (const name of names) {
			if (!name.startsWith(`${id}.`)) continue;
			const p = join(dir, name);
			try {
				const st = statSync(p);
				if (best === void 0 || st.mtimeMs > best.mtime) best = {
					path: p,
					mtime: st.mtimeMs
				};
			} catch {}
		}
	}
	return best?.path;
}
//#endregion
//#region lib/types/progress-copy.js
/**
* 清理进度页的多语言文案（2026-11-07）
*
* 为什么单独一份而不是复用 `client/locales.ts`：进度页跑在 **runner 进程**里
* （DSH 已经停了，没有任何客户端运行时可用），它拿不到 `ctx.locale`。所以这里
* 是一份独立的、只含进度页所需十来个键的小字典，语言由两处决定：
*   1. 设置页开窗时带的 `?lang=`（用户当时的界面语言，最准）；
*   2. 手输 URL 时退到浏览器的 `Accept-Language`（至少不硬性中文）。
* 都没有 → 中文。
*
* **品牌与版权不翻译**：标题里的产品名两种语言都是 `未必科幻MBSF`。
*
* @module mbsf-compaction/progress-copy
*/
const zh = {
	title: "未必科幻MBSF · 重启清理",
	wordmark: "未必科幻MBSF",
	stopping: "正在停止 DSH…",
	strip: "正在删除助手的旧输出…",
	prune: "正在裁掉较早的对话…",
	backup: "正在清理备份…",
	starting: "正在启动 DSH…",
	done: "正在收尾…",
	ready: "清理完成，DSH 已就绪",
	failed: "启动失败——请手动打开 DSH",
	doneOk: "✓ 清理完成，DSH 已就绪（3 秒后自动关闭本页）",
	back: "本页未自动关闭？点此回到 DSH →",
	retry: "重试前请先点此确认 DSH 状态 →"
};
/** 语言 id → 文案。 */
const TABLE = {
	zh,
	en: {
		title: "未必科幻MBSF · Restart cleanup",
		wordmark: "未必科幻MBSF",
		stopping: "Stopping DSH…",
		strip: "Removing the assistant’s old output…",
		prune: "Trimming older conversation…",
		backup: "Cleaning up backups…",
		starting: "Starting DSH…",
		done: "Finishing up…",
		ready: "Cleanup done, DSH is ready",
		failed: "Could not start — please open DSH by hand",
		doneOk: "✓ Cleanup done, DSH is ready (this page closes in 3 s)",
		back: "Still open? Click here to go back to DSH →",
		retry: "Click here to check DSH before retrying →"
	},
	"zh-TW": {
		title: "未必科幻MBSF · 重新啟動清理",
		wordmark: "未必科幻MBSF",
		stopping: "正在停止 DSH…",
		strip: "正在刪除助理的舊輸出…",
		prune: "正在裁掉較早的對話…",
		backup: "正在清理備份…",
		starting: "正在啟動 DSH…",
		done: "正在收尾…",
		ready: "清理完成，DSH 已就緒",
		failed: "啟動失敗——請手動開啟 DSH",
		doneOk: "✓ 清理完成，DSH 已就緒（3 秒後自動關閉本頁）",
		back: "本頁沒有自動關閉？點此回到 DSH →",
		retry: "重試前請先點此確認 DSH 狀態 →"
	},
	ja: {
		title: "未必科幻MBSF · 再起動時の整理",
		wordmark: "未必科幻MBSF",
		stopping: "DSH を停止しています…",
		strip: "アシスタントの古い出力を削除しています…",
		prune: "古い会話を削っています…",
		backup: "バックアップを整理しています…",
		starting: "DSH を起動しています…",
		done: "仕上げています…",
		ready: "整理が完了し、DSH の準備ができました",
		failed: "起動できませんでした——DSH を手動で開いてください",
		doneOk: "✓ 整理が完了し、DSH の準備ができました（3 秒後にこのページを閉じます）",
		back: "ページが閉じない場合はこちら →",
		retry: "再試行の前にこちらで DSH の状態を確認 →"
	},
	ko: {
		title: "未必科幻MBSF · 재시작 정리",
		wordmark: "未必科幻MBSF",
		stopping: "DSH를 중지하는 중…",
		strip: "어시스턴트의 오래된 출력을 지우는 중…",
		prune: "오래된 대화를 잘라내는 중…",
		backup: "백업을 정리하는 중…",
		starting: "DSH를 시작하는 중…",
		done: "마무리하는 중…",
		ready: "정리가 끝났고 DSH가 준비되었습니다",
		failed: "시작하지 못했습니다 — DSH를 직접 열어 주세요",
		doneOk: "✓ 정리가 끝났고 DSH가 준비되었습니다 (3초 뒤 이 페이지를 닫습니다)",
		back: "페이지가 닫히지 않으면 여기를 누르세요 →",
		retry: "다시 시도하기 전에 여기서 DSH 상태를 확인하세요 →"
	},
	de: {
		title: "未必科幻MBSF · Aufräumen beim Neustart",
		wordmark: "未必科幻MBSF",
		stopping: "DSH wird beendet…",
		strip: "Alte Ausgaben des Assistenten werden entfernt…",
		prune: "Ältere Gespräche werden gekürzt…",
		backup: "Sicherungen werden aufgeräumt…",
		starting: "DSH wird gestartet…",
		done: "Wird abgeschlossen…",
		ready: "Aufgeräumt, DSH ist bereit",
		failed: "Start fehlgeschlagen — bitte DSH von Hand öffnen",
		doneOk: "✓ Aufgeräumt, DSH ist bereit (diese Seite schließt in 3 s)",
		back: "Seite noch offen? Hier zurück zu DSH →",
		retry: "Vor einem neuen Versuch hier den DSH-Status prüfen →"
	},
	fr: {
		title: "未必科幻MBSF · Nettoyage au redémarrage",
		wordmark: "未必科幻MBSF",
		stopping: "Arrêt de DSH…",
		strip: "Suppression des anciennes réponses de l’assistant…",
		prune: "Raccourcissement des conversations anciennes…",
		backup: "Nettoyage des sauvegardes…",
		starting: "Démarrage de DSH…",
		done: "Finalisation…",
		ready: "Nettoyage terminé, DSH est prêt",
		failed: "Échec du démarrage — ouvrez DSH manuellement",
		doneOk: "✓ Nettoyage terminé, DSH est prêt (cette page se ferme dans 3 s)",
		back: "La page reste ouverte ? Cliquez ici pour revenir à DSH →",
		retry: "Vérifiez l’état de DSH ici avant de réessayer →"
	},
	es: {
		title: "未必科幻MBSF · Limpieza al reiniciar",
		wordmark: "未必科幻MBSF",
		stopping: "Deteniendo DSH…",
		strip: "Eliminando respuestas antiguas del asistente…",
		prune: "Recortando conversaciones antiguas…",
		backup: "Limpiando copias de seguridad…",
		starting: "Iniciando DSH…",
		done: "Terminando…",
		ready: "Limpieza terminada, DSH está listo",
		failed: "No se pudo iniciar — abre DSH manualmente",
		doneOk: "✓ Limpieza terminada, DSH está listo (esta página se cierra en 3 s)",
		back: "¿Sigue abierta? Haz clic aquí para volver a DSH →",
		retry: "Comprueba aquí el estado de DSH antes de reintentar →"
	},
	ru: {
		title: "未必科幻MBSF · Очистка при перезапуске",
		wordmark: "未必科幻MBSF",
		stopping: "Останавливаем DSH…",
		strip: "Удаляем старые ответы ассистента…",
		prune: "Сокращаем старые диалоги…",
		backup: "Разбираем резервные копии…",
		starting: "Запускаем DSH…",
		done: "Завершаем…",
		ready: "Очистка завершена, DSH готов",
		failed: "Не удалось запустить — откройте DSH вручную",
		doneOk: "✓ Очистка завершена, DSH готов (страница закроется через 3 с)",
		back: "Страница не закрылась? Нажмите здесь, чтобы вернуться в DSH →",
		retry: "Перед повтором проверьте состояние DSH здесь →"
	},
	pt: {
		title: "未必科幻MBSF · Limpeza ao reiniciar",
		wordmark: "未必科幻MBSF",
		stopping: "Parando o DSH…",
		strip: "Removendo respostas antigas do assistente…",
		prune: "Cortando conversas antigas…",
		backup: "Limpando backups…",
		starting: "Iniciando o DSH…",
		done: "Finalizando…",
		ready: "Limpeza concluída, o DSH está pronto",
		failed: "Não foi possível iniciar — abra o DSH manualmente",
		doneOk: "✓ Limpeza concluída, o DSH está pronto (esta página fecha em 3 s)",
		back: "A página continua aberta? Clique aqui para voltar ao DSH →",
		retry: "Verifique o estado do DSH aqui antes de tentar de novo →"
	}
};
/**
* 解析要用哪种语言：显式 `lang` 参数 > `Accept-Language` 首个命中 > 中文。
*
* `zh-CN` / `zh-Hans` 这类带地区的标签回落到 `zh`；无法识别的一律回中文
* （进度页只有几行字，读不懂母语时中文/英文都得看得懂至少一个）。
*/
function progressCopyFor(lang, acceptLanguage) {
	const pick = (raw) => {
		if (raw === void 0 || raw === "") return void 0;
		const tag = raw.trim().toLowerCase();
		const exact = Object.keys(TABLE).find((key) => key.toLowerCase() === tag);
		if (exact !== void 0) return TABLE[exact];
		const base = tag.split("-")[0] ?? "";
		return TABLE[base];
	};
	const explicit = pick(lang);
	if (explicit !== void 0) return explicit;
	for (const part of (acceptLanguage ?? "").split(",")) {
		const hit = pick(part.split(";")[0]);
		if (hit !== void 0) return hit;
	}
	return zh;
}
process.env.MBSF_SESSIONS_ROOT ?? path.join(process.env.HOME || "/tmp", ".dsh", "sessions");
//#endregion
//#region lib/types/trim-targets.js
/**
* 会话历史剪裁目标（`~/.mbsf/trim-targets.json`）+ 候选清单（2026-11-07）
*
* **语义（一帆 2026-11-07 定）**：
*  - 重启清理的粒度有两档：**全库**（设置页那个开关，管所有会话）和
*    **勾选集合**（本模块，只剪勾中的会话）。
*  - 两档冲突时**全库优先**——全局开关开着时勾选不生效（UI 会明确说这句）。
*    理由：一个开关必须只有一个意思，开关开着却"只剪一部分"会让人以为漏了。
*
* **为什么不复用 `sessions.json`（会话级配置覆盖）**：那张表是**继承链**语义
* （子会话没覆盖就继承父会话）。剪裁是**破坏性且不可恢复**的动作，绝不能
* 因为父会话被勾了就顺带把子会话剪掉——所以用独立文件、字面 id 精确匹配、
* 零继承。
*
* 文件形状（append 语义无关，整表覆盖写；损坏即视为空表，不阻断重启）：
* ```json
* { "version": 1, "targets": { "<sessionId>": { "selected": true, "updatedAt": "…" } } }
* ```
*
* @module mbsf-compaction/trim-targets
*/
/** 勾选表路径（脑数据目录下）。 */
function trimTargetsPath() {
	return join(resolveMbsfDataDir(), "trim-targets.json");
}
/** 读整张勾选表；文件缺失/损坏 → 空表（**不抛**——坏文件不该挡住重启）。 */
function loadTrimTargets() {
	try {
		const targets = JSON.parse(readFileSync(trimTargetsPath(), "utf8")).targets;
		if (targets === null || typeof targets !== "object") return {};
		const out = {};
		for (const [id, value] of Object.entries(targets)) {
			if (value === null || typeof value !== "object") continue;
			const selected = value.selected;
			if (typeof selected !== "boolean") continue;
			const updatedAt = value.updatedAt;
			out[id] = {
				selected,
				updatedAt: typeof updatedAt === "string" ? updatedAt : ""
			};
		}
		return out;
	} catch {
		return {};
	}
}
/** 勾中的会话 id 列表（**按字面匹配**，不做任何继承/前缀推断）。 */
function selectedTrimSessionIds() {
	const targets = loadTrimTargets();
	return Object.entries(targets).filter(([, state]) => state.selected).map(([id]) => id).sort();
}
//#endregion
//#region lib/types/session-reset.js
/**
* 会话重启调度（手动触发侧）
*
* 2026-09-20 一帆定「自动重启删掉」——**自动重置链已退役**（内存上限 + 回合末
* 自检 + 静默门 + 冷却 + 增长门槛 + goal 恢复注入全部删除）。本模块现在只剩
* **面板「重启 DSH」按钮**这一条触发路径：
*
*  - 本模块（进程内）：写一份请求文件并派一个**独立会话**的 runner
*    （`lib/bin/session-reset.js`）。
*  - runner（独立进程，DSH 关停不波及）：停 dsh → 清理（剥离 + 全库剪裁 +
*    备份清理 + 官方验证兜底还原）→ 起 dsh。
*
* 为什么退役自动重置：内存问题由**重启清理**解决——重启间隙是唯一全局静默
* 窗口，也是唯一能把磁盘收益转成内存收益的窗口（清理后 dsh 从小日志重载）。
* 自动重置的复杂度（多会话静默门、冷却、增长门槛、goal 恢复注入）换来的只是
* 「无人值守时也能瘦身」，而用户本来就要手动重启才看得到效果。
*
* @module mbsf-compaction/session-reset
*/
function resetRequestPath() {
	return join(resolveMbsfDataDir(), "session-reset-request.json");
}
/** 读请求文件；不存在/坏 JSON 返回 undefined。 */
function readResetRequest() {
	const path = resetRequestPath();
	if (!existsSync(path)) return void 0;
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return;
	}
}
/** 清请求文件（幂等）。 */
function clearResetRequest() {
	try {
		rmSync(resetRequestPath(), { force: true });
	} catch {}
}
/** 陈旧阈值：请求写出后超过此时长仍未被 runner 消费，即视为陈旧。 */
/** [OBS] 请求文件陈旧阈值（30 分钟）——超过即视为 runner 没消费（崩溃/被杀），
*  清理掉防堆积。纯资源护栏，不参与剪裁判定。 */
const RESET_REQUEST_TTL_MS = 30 * 6e4;
/**
* 请求是否陈旧（写出后超过 TTL 仍未被消费）。
*
* 2026-09-14 加固（一帆「两条加固都做」）：陈旧请求是**静默死锁**——
* 两个调度入口（`shouldResetSessionLog` / `maybeScheduleRestart`）都以
* 「已有挂起请求 ⟹ 直接返回」为守卫，于是任何一次写成功但没跑起来的请求
* （09-10 副本缺 runner、09-14 stale 副本缺 runner）都会**永久堵死后续所有
* 重启与自动重置**，且毫无痕迹。TTL 让这种情况自愈。
*/
function isResetRequestStale(request, now = Date.now()) {
	return now - request.at > RESET_REQUEST_TTL_MS;
}
//#endregion
//#region lib/types/bin/session-reset.js
/**
* 会话当场重置 runner（独立会话执行；DSH 关停不波及本进程）
*
* 由 `src/session-reset.ts` 在回合收尾超上限时派发（detached + setsid）。
* 流程：读请求 → 挂兜底守卫 → 给回合收尾 → 等日志静默 → 停 dsh → 裁剪
* （含锚点底线）→ seq 连续性门禁 → 起 dsh → 就绪 → （重置前 goal active
* 时）注入「继续」→ 写报告 + 记历史 + 清请求。
*
* **为什么住在 lib/bin 而不是 scripts/**（2026-09-10 实测事故）：DSH 通过
* profile 的 node_modules 副本加载本引擎（`file:` 依赖复制），副本里只有
* 包内构建产物——`scripts/` 不进副本 ⟹ 派生路径指向不存在的文件 ⟹ 静默失败
* （请求写了、runner 没跑）。放进 `src/bin/` 后随构建落 `lib/bin/`，副本必然
* 有它。
*
* 设计纪律：**任何绕过 DSH 直接写会话日志的动作，落盘前必须验证 seq 连续**
* （DSH 读侧强制 `event.seq === events.length`，断裂会被判
* 「complete frame contains a torn JSONL record」）。本 runner 只走
* `pruneSessionFile`（出口经 repairPrunedTail 重编号），仍加一道独立门禁兜底。
*
* @module mbsf-compaction/bin/session-reset
*/
const DATA_DIR = process.env.MBSF_DATA ?? join(process.env.HOME ?? "/tmp", ".mbsf");
const REPORT = join(DATA_DIR, `session-reset-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.log`);
/** 追加一行报告（写不进去也不影响主流程）。 */
function note(message) {
	const now = /* @__PURE__ */ new Date();
	const pad = (value) => String(value).padStart(2, "0");
	const line = `[${`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`}] ${message}\n`;
	try {
		writeFileSync(REPORT, line, { flag: "a" });
	} catch {}
}
const sleep = (ms) => new Promise((resolve) => {
	setTimeout(resolve, ms);
});
/**
* 候选监听端口（按优先级）。
*
* **2026-09-27 修（面板按钮「重启 DSH」看起来没生效）**：这里原先硬编码 3080
* ——那是 `dsh web` CLI 的端口；桌面 app 的 host 绑的是 **19387**。于是：
*   · `lsof -iTCP:3080` 查不到进程 ⟹ 旧 host **根本没被杀**；
*   · 新 host 起在仍被占用的 19387 上 ⟹ `EADDRINUSE` 当场死
*     （`~/.mbsf/dsh-web-*.log` 里 `webserver (required) … listen EADDRINUSE`）；
*   · 就绪探测又去 poll 3080 ⟹ 报 `web 就绪：false`，进度页静默关闭。
* 三症状叠加 = 「点了不知道管用了没」。
*
* 现在按现场发现，优先级：
*   1. `DSH_WEB_PORT` / `DSH_PORT` 环境变量（显式覆盖 / 测试用）
*   2. 请求文件里进程内采集的端口（`ResetRequest.webPort`，最贴近真实）
*   3. 常见候选 19387（桌面 app）→ 3080（CLI）
*/
function candidatePorts(request) {
	const out = [];
	const push = (value) => {
		const port = typeof value === "string" ? Number(value) : value;
		if (typeof port === "number" && Number.isSafeInteger(port) && port > 0 && port < 65536 && !out.includes(port)) out.push(port);
	};
	push(process.env.DSH_WEB_PORT);
	push(process.env.DSH_PORT);
	push(request?.webPort);
	push(19387);
	push(3080);
	return out;
}
/** 监听 `port` 的进程 pid（找不到返回 undefined）。 */
function pidOnPort(port) {
	try {
		const out = execFileSync("lsof", [
			"-t",
			`-iTCP:${port}`,
			"-sTCP:LISTEN"
		], { encoding: "utf8" });
		const pid = Number(out.trim().split("\n")[0]);
		return Number.isSafeInteger(pid) && pid > 0 ? pid : void 0;
	} catch {
		return;
	}
}
/** 正在监听的 dsh host（pid + 端口）——返回第一个真有进程在听的候选端口。 */
function findDshListener(request) {
	for (const port of candidatePorts(request)) {
		const pid = pidOnPort(port);
		if (pid !== void 0) return {
			pid,
			port
		};
	}
}
/**
* 拉起桌面 app 用的**干净环境**（2026-09-27 实测根因修复——第二次踩坑）。
*
* **病象**：用户点「重启 DSH」后 app 只是**关掉了**、没有重新起来，需要手动开。
* 日志显示 `open -a` 明明调用了、也返回成功，但 app 进程 22 秒后才出现（= 用户
* 手动开的），不是 runner 拉起来的。
*
* **根因链**（每一步都实测过）：
*  1. 外壳 spawn host 时注入 `ELECTRON_RUN_AS_NODE=1`
*     （asar lib/main.js:3533 `desktopNodeEnvironment`）——host 用 Electron 二进制
*     以 **node 模式**跑，故该变量必须存在。
*  2. 引擎跑在 host 内 ⟹ runner 由引擎 spawn，**无 env 覆盖** ⟹ 继承该变量。
*  3. runner 调 `execFileSync('open', …, { stdio: 'ignore' })`，**无 env 覆盖**
*     ⟹ `open` 继承该变量。
*  4. **`open` 会把环境变量原样传给被启动的 app**（探针实测：
*     被启动进程看到 `ELECTRON_RUN_AS_NODE=[1]`）。
*  5. 于是 `open -a` 拉起的 DeepSeek Harness 带着 `ELECTRON_RUN_AS_NODE=1`
*     启动 ⟹ Electron 以 **node 模式**跑主进程 ⟹ `require('electron')` 直接抛
*     **`Cannot find module 'electron'`**（实测）⟹ 不是 GUI ⟹ 启动即死。
*
* **修法**：`open` 调用前把这些 Electron 专有变量摘掉。**只摘 `open` 的**——
* runner 自身仍必须保留 `ELECTRON_RUN_AS_NODE=1`（它就是靠这个以 node 模式跑
* 的；摘了反而会让 runner 变成 GUI 进程而挂住）。
*/
function desktopLaunchEnv() {
	const env = { ...process.env };
	delete env.ELECTRON_RUN_AS_NODE;
	delete env.ELECTRON_NO_ATTACH_CONSOLE;
	delete env.ELECTRON_FORCE_WINDOW_MENU_BAR;
	delete env.ELECTRON_TRASH;
	return env;
}
function readPsField(pid, field) {
	try {
		return execFileSync("ps", [
			"-o",
			field,
			"-p",
			String(pid)
		], { encoding: "utf8" }).trim();
	} catch {
		return "";
	}
}
/** 进程是否还活着（signal 0 探测——不真发信号）。 */
function pidAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}
function detectDesktopHost(hostPid) {
	const ppidRaw = readPsField(hostPid, "ppid=");
	const shellPid = Number(ppidRaw);
	if (!Number.isSafeInteger(shellPid) || shellPid <= 1) return void 0;
	const comm = readPsField(shellPid, "comm=");
	if (!comm.includes("/Contents/MacOS/")) return void 0;
	const bundle = comm.replace(/\/Contents\/MacOS\/.*$/, "");
	if (!bundle.endsWith(".app")) return void 0;
	return {
		shellPid,
		bundle
	};
}
/** 等 pid 消失（比等端口更严——`open -a` 抢在旧实例前会静默只聚焦旧实例）。 */
async function waitPidGone(pid, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		if (!pidAlive(pid)) return true;
		if (Date.now() >= deadline) return false;
		await sleep(250);
	}
}
/**
* 等桌面 app 的 shell 进程出现（2026-09-27 加）。
*
* 为什么要它：`serverReady` 只轮询端口，端口可能由**用户手动**拉起 app 而产生
* ⟹ 会把用户的动作记成 runner 的成功（实测假成功：runner 报就绪那一刻，
* host 其实是用户 22 秒前手动开的）。故显式确认「以该 bundle 的 MacOS 可执行
* 文件为 comm 的进程」存在；找不到返回 false（调用方照实上报，不假装成功）。
*/
async function waitForAppLaunch(bundle, timeoutMs) {
	const exe = `${bundle}/Contents/MacOS/`;
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		try {
			if (execFileSync("ps", ["-eo", "comm="], { encoding: "utf8" }).split("\n").some((l) => l.trim().startsWith(exe))) return true;
		} catch {}
		if (Date.now() >= deadline) return false;
		await sleep(500);
	}
}
/** 等 `port` 上的监听消失（旧 host 真的退出并释放端口）。 */
async function waitPortFree(port, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		if (pidOnPort(port) === void 0) return true;
		if (Date.now() >= deadline) return false;
		await sleep(500);
	}
}
/** 等 `port` 上的 web 有响应。 */
async function serverReady(port, timeoutMs = 12e4) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			if ((await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2e3) })).status > 0) return true;
		} catch {}
		await sleep(1e3);
	}
	return false;
}
/**
* 兜底守卫（**心跳存活判据**——2026-09-20 修）。
*
* **旧实现的硬风险**：守卫 t=0 挂、90s 后无脑拉 dsh。而全库清理可能 >90s ⟹
* 守卫会在**清理中途拉起 dsh** ⟹ dsh 开始加载会话 + runner 仍在 rename 文件
* = **写冲突/损坏**。
*
* **修法**：守卫循环检查，runner 每 5s 写心跳（`cleanup-heartbeat.json`）：
*  - runner 活（心跳新鲜 + pid 在）⟹ 继续等（**长清理安全**）
*  - runner 死 / 心跳过期 ⟹ 照常拉起 dsh（**backstop 不失效**）
*/
function spawnGuard(request, desktop) {
	const heartbeat = heartbeatPath();
	const ports = JSON.stringify(candidatePorts(request));
	const launch = desktop !== void 0 ? `const cleanEnv = { ...process.env }
        delete cleanEnv.ELECTRON_RUN_AS_NODE
        delete cleanEnv.ELECTRON_NO_ATTACH_CONSOLE
        delete cleanEnv.ELECTRON_FORCE_WINDOW_MENU_BAR
        delete cleanEnv.ELECTRON_TRASH
        const child = spawn('open', ['-a', ${JSON.stringify(desktop.bundle)}], { detached: true, stdio: 'ignore', env: cleanEnv })` : `const child = spawn(${JSON.stringify(request.restart.execPath)},
          [...${JSON.stringify(request.restart.execArgv ?? [])}, ${JSON.stringify(request.restart.argv[0])}, ...${JSON.stringify(request.restart.argv.slice(1))}],
          { cwd: ${JSON.stringify(request.restart.cwd)}, detached: true, stdio: 'ignore' })`;
	const script = `
    const { spawn } = require('node:child_process')
    const { readFileSync } = require('node:fs')
    const HEARTBEAT = ${JSON.stringify(heartbeat)}
    const PORTS = ${ports}
    const sleep = (ms) => new Promise(r => setTimeout(r, ms))
    const alive = (pid) => { try { process.kill(pid, 0); return true } catch { return false } }
    ;(async () => {
      for (;;) {
        await sleep(90_000)
        for (const port of PORTS) {
          try {
            const res = await fetch('http://127.0.0.1:' + port + '/', { signal: AbortSignal.timeout(2000) })
            if (res.status > 0) return   // dsh 已在 → 收工
          } catch {}
        }
        // runner 还在干？心跳新鲜 + pid 在 → 继续等（长清理安全）
        try {
          const hb = JSON.parse(readFileSync(HEARTBEAT, 'utf8'))
          if (hb && typeof hb.at === 'number' && Date.now() - hb.at < 60_000
              && typeof hb.pid === 'number' && alive(hb.pid)) continue
        } catch {}
        // runner 死了 / 心跳过期 → 兜底拉起
        ${launch}
        child.unref()
        return
      }
    })()
  `;
	spawn(process.execPath, ["-e", script], {
		detached: true,
		stdio: "ignore"
	}).unref();
}
/** 清理心跳文件路径（runner 写、守卫读）。 */
function heartbeatPath() {
	return join(DATA_DIR, "cleanup-heartbeat.json");
}
/** 写一次心跳（守卫靠它区分「runner 在干」与「runner 死了」）。 */
function writeHeartbeat() {
	try {
		writeFileSync(heartbeatPath(), JSON.stringify({
			pid: process.pid,
			at: Date.now()
		}));
	} catch {}
}
/** 清心跳（清理结束——守卫此后若被唤醒会按「runner 死」兜底拉起）。 */
function clearHeartbeat() {
	try {
		rmSync(heartbeatPath(), { force: true });
	} catch {}
}
/** 进度页端口。**不用 3080**：① 兜底守卫靠 fetch 3080 判 dsh 存活，进度页会
*  骗过守卫；② dsh 重启要绑 3080，进度页占着会冲突。 */
const PROGRESS_PORT = 3081;
/** 进度页「回到 DSH」链接指向的端口。渲染进度页时旧 host 还没停，
*  按环境变量/常见候选推断；真正重启时以现场发现的端口为准。 */
const PROGRESS_WEB_PORT = Number(process.env.DSH_WEB_PORT ?? process.env.DSH_PORT ?? 19387);
let progressPhase = "stopping";
let progressDone = 0;
let progressTotal = 0;
let progressNote = "正在停止 DSH…";
let progressServer;
/** 进度页状态快照（HTML 首屏与 /state 轮询共用——单一来源，防两处漂移）。 */
function progressState() {
	return {
		phase: progressPhase,
		done: progressDone,
		total: progressTotal,
		note: progressNote,
		ready: progressPhase === "ready",
		failed: progressPhase === "failed"
	};
}
/**
* 渲染进度页 HTML——**DSH 视觉同构**（2026-09-20 一帆「和 dsh 风格一样就行」）。
*
* 对齐 `packages/client/web/src/boot-page.module.css`：同一套 `--dsh-boot-*`
* token（深色 #151517 / 浅色 #fff + 三级 label + 12% 边框）、同一 spinner 几何
* （20px 圆 · 2px 环 · conic-gradient 弧线 · radial mask）、同一排版尺度
* （wordmark 16/24 600 letter-spacing .08em · hint 12/18 tertiary）。
*
* 差异只在语义：DSH 启动页的弧线 = 插件加载比，本页弧线 = 清理进度比
* （72°→288°，与 boot-page 的 `72 + ratio * 216` 同一公式——弧长即进度，
* 不再画第二条进度条）。状态轮询走 `/state` JSON（500ms），不做 meta refresh
* ——无整页闪烁。`<noscript>` 保留 2s 自刷新兜底。
*/
function progressHtml(copy) {
	const st = progressState();
	const initial = JSON.stringify(st);
	const phaseLabels = {
		stopping: copy.stopping,
		strip: copy.strip,
		prune: copy.prune,
		backup: copy.backup,
		starting: copy.starting,
		done: copy.done,
		ready: copy.ready,
		failed: copy.failed
	};
	const label = phaseLabels[st.phase] ?? st.phase;
	const ratio = st.total > 0 ? Math.min(st.done / st.total, 1) : 0;
	const arc = Math.round(72 + ratio * 216);
	const metaText = st.total > 0 ? `${st.done} / ${st.total} (${Math.round(ratio * 100)}%)` : "";
	const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	return `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(copy.title)}</title>
<style>
:root{--bg:#fff;--label-primary:#0f1115;--label-secondary:#61666b;--label-tertiary:#81858c;--border:rgb(0 0 0 / 10%);--brand:#0f1115;--ok:#2ea043}
@media (prefers-color-scheme: dark){:root{--bg:#151517;--label-primary:#f9fafb;--label-secondary:#cfd3d6;--label-tertiary:#adb2b8;--border:rgb(255 255 255 / 12%);--brand:#f9fafb}}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--label-primary);display:grid;place-items:center;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.card{display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px}
.wordmark{font-size:16px;line-height:24px;font-weight:600;letter-spacing:.08em;color:var(--label-primary)}
.spinner{position:relative;width:20px;height:20px;border-radius:50%;border:2px solid var(--border);
animation:spin .8s linear infinite}
.spinner::after{content:"";position:absolute;inset:-2px;border-radius:inherit;
background:conic-gradient(var(--brand) var(--arc,72deg),transparent 0);
-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 0);
mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 0)}
@keyframes spin{to{transform:rotate(360deg)}}
.hint{font-size:12px;line-height:18px;color:var(--label-tertiary);text-align:center}
.meta{font-size:12px;line-height:18px;color:var(--label-secondary);font-variant-numeric:tabular-nums}
.ok{font-size:14px;line-height:22px;font-weight:600;color:var(--ok)}
a{font-size:12px;line-height:18px;color:var(--label-tertiary);text-decoration:none}
a:hover{color:var(--label-primary)}
[hidden]{display:none!important}
</style>
</head><body>
<div class="card">
  <div class="wordmark">${esc(copy.wordmark)}</div>
  <div class="spinner" id="spinner" style="--arc:${arc}deg"${st.ready ? " hidden" : ""}></div>
  <div class="ok" id="ok"${st.ready ? "" : " hidden"}>${esc(copy.doneOk)}</div>
  <div class="hint" id="hint">${esc(label)}</div>
  <div class="meta" id="meta"${st.ready ? " hidden" : ""}>${esc(metaText)}</div>
  <a id="back" href="http://127.0.0.1:${PROGRESS_WEB_PORT}"${st.ready || st.failed ? "" : " hidden"}>${esc(st.failed ? copy.retry : copy.back)}</a>
</div>
<noscript><meta http-equiv="refresh" content="2"></noscript>
<script>
var LABELS = ${JSON.stringify(phaseLabels)};
var s = ${initial};
// closed = 「自动关闭已排程」标志——**不按 ready 初始化**：页面可能恰在 ready 态
// 才被打开（清理已完成时点按钮），此时仍应排程关窗（脚本开的窗口 close 生效；
// 手输 URL 的窗口浏览器静默拒绝，无害）。恒 false，由 paint() 的 ready 分支
// 一次性置位。
var closed = false;
function paint(){
  var ratio = s.total > 0 ? Math.min(s.done / s.total, 1) : 0;
  document.getElementById('spinner').style.setProperty('--arc', (72 + ratio * 216) + 'deg');
  document.getElementById('hint').textContent = LABELS[s.phase] || s.phase;
  document.getElementById('meta').textContent = s.total > 0
    ? s.done + ' / ' + s.total + '（' + Math.round(ratio * 100) + '%）' : '';
  if (s.ready){
    document.getElementById('spinner').hidden = true;
    document.getElementById('meta').hidden = true;
    document.getElementById('ok').hidden = false;
    document.getElementById('back').hidden = false;
    if (!closed){ closed = true; setTimeout(function(){ window.close(); }, 3000); }
  }
  // failed：停掉转圈、留在页面上把话说清楚——**不自动关窗**（否则用户永远
  // 看不到失败原因，这正是「点了不知道管用了没」的来源之一）。
  if (s.failed){
    document.getElementById('spinner').hidden = true;
    document.getElementById('meta').hidden = true;
    document.getElementById('ok').hidden = true;
    document.getElementById('back').hidden = false;
    var hint = document.getElementById('hint');
    hint.style.color = '#d1242f';
    hint.style.fontWeight = '600';
    closed = true;   // 停止轮询，页面留在失败态
  }
}
paint();
function tick(){
  if (closed) return;
  fetch('/state', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(j){
    s = j; paint(); setTimeout(tick, 500);
  }).catch(function(){ setTimeout(tick, 500); });
}
if (!s.ready) tick();
<\/script>
</body></html>`;
}
/** 起进度页（失败静默——进度是增强，不阻断重启）。 */
function startProgressServer() {
	try {
		progressServer = createServer((req, res) => {
			if ((req.url ?? "").startsWith("/state")) {
				res.writeHead(200, {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store"
				});
				res.end(JSON.stringify(progressState()));
				return;
			}
			res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			let lang;
			try {
				lang = new URL(req.url ?? "/", "http://127.0.0.1").searchParams.get("lang") ?? void 0;
			} catch {
				lang = void 0;
			}
			const accept = req.headers["accept-language"];
			res.end(progressHtml(progressCopyFor(lang, typeof accept === "string" ? accept : void 0)));
		});
		progressServer.on("error", () => {
			progressServer = void 0;
		});
		progressServer.listen(PROGRESS_PORT, "127.0.0.1");
	} catch {
		progressServer = void 0;
	}
}
/** 收尾进度页：切终态 → 5s 宽限 → **runner 侧关服务释放端口**。
*
*  **不依赖浏览器关页**：`window.close()` 只对脚本打开的窗口有效，用户手输
*  URL 的标签页浏览器会静默拒绝 ⟹ 3081 监听必须由 runner 释放，否则端口泄漏。
*  页面侧 `window.close()` 只是「尽力而为」的体验优化。
*/
async function finishProgressServer() {
	if (progressServer === void 0) return;
	progressPhase = "ready";
	progressNote = "清理已完成，DSH 已就绪。";
	await sleep(5e3);
	try {
		progressServer.close();
	} catch {}
	progressServer = void 0;
}
/** 会话日志按 zstd magic 切帧解压成明文（多帧顺序拼接）。 */
function logPlaintext(buffer) {
	const starts = [];
	for (let i = 0; i + 4 <= buffer.length; i += 1) if (buffer[i] === 40 && buffer[i + 1] === 181 && buffer[i + 2] === 47 && buffer[i + 3] === 253) starts.push(i);
	if (starts.length === 0) return buffer.toString("utf8");
	const parts = [];
	for (let k = 0; k < starts.length; k += 1) {
		const start = starts[k];
		const end = k + 1 < starts.length ? starts[k + 1] : buffer.length;
		try {
			parts.push(zlib.zstdDecompressSync(buffer.subarray(start, end)));
		} catch {}
	}
	return Buffer.concat(parts).toString("utf8");
}
/**
* seq 连续性门禁（与 DSH 读侧同一不变式）：逐行推进计数器，
* 普通事件 `seq === next`、打包行 `seq0 === next` 且按成员数推进。
* @returns 违例描述；通过返回 undefined。
*/
function gateSequential(logPath) {
	let next = 0;
	for (const line of logPlaintext(readFileSync(logPath)).split("\n")) {
		if (line.trim() === "") continue;
		let event;
		try {
			event = JSON.parse(line);
		} catch {
			return `unparsable line at index ${next}`;
		}
		if (event.type === "session") continue;
		if (typeof event.seq0 === "number") {
			const members = Array.isArray(event.data?.texts) ? event.data.texts.length : Array.isArray(event.data?.args) ? event.data.args.length : 0;
			if (event.seq0 !== next) return `seq0 gap at ${String(event.type)}: expected ${next}, got ${event.seq0}`;
			next += members;
			continue;
		}
		if (typeof event.seq === "number") {
			if (event.seq !== next) return `seq gap at ${String(event.type)}: expected ${next}, got ${event.seq}`;
			next += 1;
		}
	}
}
/** runner 主流程。 */
async function main() {
	const request = readResetRequest();
	if (request === void 0) {
		note(`无请求文件（${resetRequestPath()}）→ 退出`);
		return;
	}
	if (isResetRequestStale(request)) {
		note(`请求陈旧（写出于 ${new Date(request.at).toISOString()}，超 TTL ${RESET_REQUEST_TTL_MS / 6e4} 分钟）→ 清理并退出`);
		clearResetRequest();
		return;
	}
	note(`=== 面板重启 DSH 开始 session=${request.sessionId} source=${request.source ?? "(缺)"}`);
	const earlyListener = findDshListener(request);
	let desktop = earlyListener === void 0 ? void 0 : detectDesktopHost(earlyListener.pid);
	if (desktop !== void 0) note(`形态：桌面 app（shell pid=${desktop.shellPid}，bundle=${desktop.bundle}）`);
	spawnGuard(request, desktop);
	writeHeartbeat();
	const heartbeatTimer = setInterval(() => {
		writeHeartbeat();
	}, 5e3);
	heartbeatTimer.unref?.();
	note("兜底守卫已挂（心跳存活判据——runner 活则不抢跑；心跳每 5s 刷新）");
	startProgressServer();
	note(`进度页：http://127.0.0.1:${PROGRESS_PORT}（dsh 就绪后自动关闭）`);
	await sleep(5e3);
	note("等待回合收尾完成");
	progressPhase = "stopping";
	progressNote = "正在停止 DSH…";
	const listener = findDshListener(request);
	const webPort = listener?.port ?? candidatePorts(request)[0] ?? 3080;
	if (desktop === void 0 && listener !== void 0) desktop = detectDesktopHost(listener.pid);
	if (listener !== void 0) {
		const { pid, port } = listener;
		if (desktop !== void 0) {
			note(`停桌面 app：shell pid=${desktop.shellPid}（bundle=${desktop.bundle}，host pid=${pid}，端口 ${port}）`);
			try {
				process.kill(desktop.shellPid, "SIGTERM");
			} catch (error) {
				note(`SIGTERM(shell) 失败：${String(error)}`);
			}
			let gone = await waitPidGone(desktop.shellPid, 2e4);
			if (gone) gone = await waitPortFree(port, 1e4);
			if (!gone) {
				note("SIGTERM(shell) 超时 → SIGKILL(shell)");
				try {
					process.kill(desktop.shellPid, "SIGKILL");
				} catch {}
				gone = await waitPidGone(desktop.shellPid, 1e4);
				if (gone) gone = await waitPortFree(port, 15e3);
			}
			if (!gone) {
				progressPhase = "failed";
				progressNote = `桌面 app 未能退出（shell pid=${desktop.shellPid} 仍在）——已中止重启，请手动退出 DSH 后重试`;
				note(`中止：shell pid=${desktop.shellPid} 未退出，未重启（避免双实例/EADDRINUSE）`);
				clearResetRequest();
				note("失败提示保留 120s（页面可读）后退出");
				await sleep(12e4);
				clearInterval(heartbeatTimer);
				clearHeartbeat();
				await finishProgressServer();
				note(`=== 结束（失败，报告 ${REPORT}）`);
				return;
			}
			note(`桌面 app 已退出（shell pid=${desktop.shellPid}，端口 ${port} 已释放）`);
			await sleep(2e3);
		} else {
			note(`停 dsh pid=${pid}（端口 ${port}）`);
			try {
				process.kill(pid, "SIGTERM");
			} catch (error) {
				note(`SIGTERM 失败：${String(error)}`);
			}
			let freed = await waitPortFree(port, 45e3);
			if (!freed) {
				note("SIGTERM 超时 → SIGKILL");
				try {
					process.kill(pid, "SIGKILL");
				} catch {}
				freed = await waitPortFree(port, 1e4);
			}
			if (!freed) {
				progressPhase = "failed";
				progressNote = `端口 ${port} 仍被占用（pid=${pid} 未退出）——已中止重启，请手动退出 DSH 后重试`;
				note(`中止：端口 ${port} 未释放，未启动新 host（避免 EADDRINUSE 假重启）`);
				clearResetRequest();
				note("失败提示保留 120s（页面可读）后退出");
				await sleep(12e4);
				clearInterval(heartbeatTimer);
				clearHeartbeat();
				await finishProgressServer();
				note(`=== 结束（失败，报告 ${REPORT}）`);
				return;
			}
			note(`端口 ${port} 已释放`);
		}
	} else note(`未找到监听的 dsh 进程（候选端口 ${candidatePorts(request).join("/")} 都无监听；可能已停）`);
	await sleep(2e3);
	const config = getRuntimeConfig();
	const trimIds = selectedTrimSessionIds();
	const trimScope = config.restartCleanupEnabled ? "all" : trimIds.length > 0 ? "selected" : "none";
	if (trimScope === "none") note("清理：跳过（restartCleanupEnabled 未开启，也没有勾选会话）→ 只重启");
	else try {
		const dshHome = process.env.DSH_HOME ?? join(process.env.HOME ?? "", ".dsh");
		note(`清理开始：范围=${trimScope === "all" ? "全库" : `${trimIds.length} 个勾选会话`} · 轮数=${config.cleanupPruneTurns}（0=不剪裁）· 剥离保留=${config.sessionStreamKeepCount} 条 · 备份保留=${config.backupKeepCount}（0=不限）`);
		const outcome = await runCleanup({
			dshHome,
			turns: config.cleanupPruneTurns,
			streamKeepCount: config.sessionStreamKeepCount,
			backupKeep: config.backupKeepCount,
			...trimScope === "selected" ? { sessionIds: trimIds } : {},
			onProgress: (phase, done, total) => {
				progressPhase = phase;
				progressDone = done;
				progressTotal = total;
				note(`  阶段：${phase} ${total > 0 ? `${done}/${total}` : ""}`);
			}
		});
		const mb = (b) => (b / 1048576).toFixed(1);
		note(`清理完成 · ${outcome.seconds}s`);
		note(`  剥离：${outcome.strip.files} 个文件，释放 ${mb(outcome.strip.freedBytes)}MB，跳过 ${outcome.strip.skipped} 个`);
		note(outcome.prune.files === 0 && config.cleanupPruneTurns === 0 ? "  剪裁：跳过（轮数 0 = 不剪裁）" : `  剪裁：${outcome.prune.files} 个文件，释放 ${mb(outcome.prune.freedBytes)}MB，跳过 ${outcome.prune.skipped} 个`);
		const v = outcome.verify;
		note(`  官方验证：通过 ${v.checked - v.failed}/${v.checked} · 还原 ${v.restored}` + (v.unsupported > 0 ? ` · 官方格式不支持 ${v.unsupported} 个（未处理，DSH 自身也读不了）` : "") + (v.skippedNoBackup > 0 ? ` · 无备份跳过 ${v.skippedNoBackup}` : ""));
		note(`  备份：删 ${outcome.backups.removed} 份（释放 ${mb(outcome.backups.freedBytes)}MB） · 剩余 ${outcome.backups.remaining} 份 / ${mb(outcome.backups.remainingBytes)}MB`);
	} catch (error) {
		note(`清理异常（继续重启）：${String(error)}`);
	}
	if (request.logPath !== "" && existsSync(request.logPath)) {
		const gate = gateSequential(request.logPath);
		note(gate === void 0 ? "seq 门禁：PASS" : `seq 门禁：FAIL（${gate}）——仍继续重启，请人工核查`);
	} else note("seq 门禁：跳过（无目标日志路径）");
	progressPhase = "starting";
	progressNote = "正在启动 DSH…";
	let dshLog = "（未捕获）";
	if (desktop !== void 0) {
		note(`起桌面 app：open -a ${desktop.bundle}`);
		try {
			execFileSync("open", ["-a", desktop.bundle], {
				stdio: "ignore",
				env: desktopLaunchEnv()
			});
		} catch (error) {
			note(`open -a 失败：${String(error)}`);
		}
		note(await waitForAppLaunch(desktop.bundle, 3e4) ? "桌面 app 进程已出现" : "未观察到桌面 app 进程（open 可能未生效）");
	} else {
		const { execPath, argv, execArgv, cwd } = request.restart;
		const args = [...execArgv ?? [], ...argv];
		const logPath = join(DATA_DIR, `dsh-web-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.log`);
		let stdio = "ignore";
		try {
			const fd = openSync(logPath, "a");
			stdio = [
				"ignore",
				fd,
				fd
			];
		} catch {
			stdio = "ignore";
		}
		note(`起 dsh：${execPath} ${args.join(" ")} (cwd=${cwd})`);
		spawn(execPath, args, {
			cwd,
			detached: true,
			stdio
		}).unref();
		if (stdio !== "ignore") dshLog = logPath;
		note(`dsh 输出：${dshLog}`);
	}
	const ready = await serverReady(webPort);
	note(`web 就绪：${ready}（端口 ${webPort}）`);
	clearInterval(heartbeatTimer);
	clearHeartbeat();
	if (!ready) {
		progressPhase = "failed";
		progressNote = `DSH 启动超时（端口 ${webPort} 无响应）——请查看 ${dshLog}`;
		note(`启动失败：端口 ${webPort} 在超时内无响应；进度页保留失败提示`);
		clearResetRequest();
		note("失败提示保留 120s（页面可读）后退出");
		await sleep(12e4);
		clearInterval(heartbeatTimer);
		clearHeartbeat();
		await finishProgressServer();
		note(`=== 结束（失败，报告 ${REPORT}）`);
		return;
	}
	await finishProgressServer();
	note(`进度页已关闭（3081 释放）`);
	clearResetRequest();
	note(`=== 结束（报告 ${REPORT}）`);
}
if (process.argv[1] !== void 0 && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((error) => {
	note(`runner 异常：${String(error)}`);
});
//#endregion
export { gateSequential, main };
