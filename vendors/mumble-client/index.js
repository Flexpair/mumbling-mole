// Robust export: support both transpiled (default export) and plain CommonJS
let impl
try {
	impl = require('./lib/client.js')
	// If transpiled by Babel with ESModule default export structure
	if (impl && impl.__esModule && impl.default) {
		module.exports = impl.default
	} else {
		module.exports = impl
	}
} catch (e) {
	// Provide clearer error to consumers
	throw new Error("mumble-client: unable to load ./lib/client.js – was the library built? Original: " + e.message)
}
