/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-mixed-operators, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars, default-case, jsdoc/require-param*/
import $protobuf from "protobufjs/minimal.js";

const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;
const $Object = $util.global.Object, $undefined = $util.global.undefined, $Error = $util.global.Error, $TypeError = $util.global.TypeError, $String = $util.global.String, $Array = $util.global.Array, $Boolean = $util.global.Boolean, $parseInt = $util.global.parseInt, $Number = $util.global.Number, $BigInt = $util.global.BigInt, $isFinite = $util.global.isFinite;

const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const MumbleProto = $root.MumbleProto = (() => {

    const MumbleProto = {};

    MumbleProto.Version = (function() {

        const Version = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        Version.prototype.version = 0;
        Version.prototype.release = "";
        Version.prototype.os = "";
        Version.prototype.osVersion = "";

        Version.create = function(properties) {
            return new Version(properties);
        };

        Version.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                writer.uint32(8).uint32(message.version);
            if (message.release != null && $Object.hasOwnProperty.call(message, "release"))
                writer.uint32(18).string(message.release);
            if (message.os != null && $Object.hasOwnProperty.call(message, "os"))
                writer.uint32(26).string(message.os);
            if (message.osVersion != null && $Object.hasOwnProperty.call(message, "osVersion"))
                writer.uint32(34).string(message.osVersion);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        Version.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        Version.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.Version();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.version = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 2)
                            break;
                        message.release = reader.string();
                        continue;
                    }
                case 3: {
                        if (wireType !== 2)
                            break;
                        message.os = reader.string();
                        continue;
                    }
                case 4: {
                        if (wireType !== 2)
                            break;
                        message.osVersion = reader.string();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        Version.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        Version.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                if (!$util.isInteger(message.version))
                    return "version: integer expected";
            if (message.release != null && $Object.hasOwnProperty.call(message, "release"))
                if (!$util.isString(message.release))
                    return "release: string expected";
            if (message.os != null && $Object.hasOwnProperty.call(message, "os"))
                if (!$util.isString(message.os))
                    return "os: string expected";
            if (message.osVersion != null && $Object.hasOwnProperty.call(message, "osVersion"))
                if (!$util.isString(message.osVersion))
                    return "osVersion: string expected";
            return null;
        };

        Version.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.Version)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.Version: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.Version();
            if (object.version != null)
                message.version = object.version >>> 0;
            if (object.release != null)
                message.release = $String(object.release);
            if (object.os != null)
                message.os = $String(object.os);
            if (object.osVersion != null)
                message.osVersion = $String(object.osVersion);
            return message;
        };

        Version.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.version = 0;
                object.release = "";
                object.os = "";
                object.osVersion = "";
            }
            if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                object.version = message.version;
            if (message.release != null && $Object.hasOwnProperty.call(message, "release"))
                object.release = message.release;
            if (message.os != null && $Object.hasOwnProperty.call(message, "os"))
                object.os = message.os;
            if (message.osVersion != null && $Object.hasOwnProperty.call(message, "osVersion"))
                object.osVersion = message.osVersion;
            return object;
        };

        Version.prototype.toJSON = function() {
            return Version.toObject(this, $protobuf.util.toJSONOptions);
        };

        Version.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.Version";
        };

        return Version;
    })();

    MumbleProto.UDPTunnel = (function() {

        const UDPTunnel = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        UDPTunnel.prototype.packet = $util.newBuffer([]);

        UDPTunnel.create = function(properties) {
            return new UDPTunnel(properties);
        };

        UDPTunnel.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            writer.uint32(10).bytes(message.packet);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        UDPTunnel.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        UDPTunnel.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UDPTunnel();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 2)
                            break;
                        message.packet = reader.bytes();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            if (!$Object.hasOwnProperty.call(message, "packet"))
                throw $util.ProtocolError("missing required 'packet'", { instance: message });
            return message;
        };

        UDPTunnel.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        UDPTunnel.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (!(message.packet && typeof message.packet.length === "number" || $util.isString(message.packet)))
                return "packet: buffer expected";
            return null;
        };

        UDPTunnel.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.UDPTunnel)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.UDPTunnel: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.UDPTunnel();
            if (object.packet != null)
                if (typeof object.packet === "string")
                    $util.base64.decode(object.packet, message.packet = $util.newBuffer($util.base64.length(object.packet)), 0);
                else if (object.packet.length >= 0)
                    message.packet = object.packet;
            return message;
        };

        UDPTunnel.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults)
                if (options.bytes === $String)
                    object.packet = "";
                else {
                    object.packet = [];
                    if (options.bytes !== $Array)
                        object.packet = $util.newBuffer(object.packet);
                }
            if (message.packet != null && $Object.hasOwnProperty.call(message, "packet"))
                object.packet = options.bytes === $String ? $util.base64.encode(message.packet, 0, message.packet.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.packet) : message.packet;
            return object;
        };

        UDPTunnel.prototype.toJSON = function() {
            return UDPTunnel.toObject(this, $protobuf.util.toJSONOptions);
        };

        UDPTunnel.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.UDPTunnel";
        };

        return UDPTunnel;
    })();

    MumbleProto.Authenticate = (function() {

        const Authenticate = function (properties) {
            this.tokens = [];
            this.celtVersions = [];
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        Authenticate.prototype.username = "";
        Authenticate.prototype.password = "";
        Authenticate.prototype.tokens = $util.emptyArray;
        Authenticate.prototype.celtVersions = $util.emptyArray;
        Authenticate.prototype.opus = false;

        Authenticate.create = function(properties) {
            return new Authenticate(properties);
        };

        Authenticate.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.username != null && $Object.hasOwnProperty.call(message, "username"))
                writer.uint32(10).string(message.username);
            if (message.password != null && $Object.hasOwnProperty.call(message, "password"))
                writer.uint32(18).string(message.password);
            if (message.tokens != null && message.tokens.length)
                for (let i = 0; i < message.tokens.length; ++i)
                    writer.uint32(26).string(message.tokens[i]);
            if (message.celtVersions != null && message.celtVersions.length)
                for (let i = 0; i < message.celtVersions.length; ++i)
                    writer.uint32(32).int32(message.celtVersions[i]);
            if (message.opus != null && $Object.hasOwnProperty.call(message, "opus"))
                writer.uint32(40).bool(message.opus);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        Authenticate.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        Authenticate.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.Authenticate();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 2)
                            break;
                        message.username = reader.string();
                        continue;
                    }
                case 2: {
                        if (wireType !== 2)
                            break;
                        message.password = reader.string();
                        continue;
                    }
                case 3: {
                        if (wireType !== 2)
                            break;
                        if (!(message.tokens && message.tokens.length))
                            message.tokens = [];
                        message.tokens.push(reader.string());
                        continue;
                    }
                case 4: {
                        if (wireType === 2) {
                            if (!(message.celtVersions && message.celtVersions.length))
                                message.celtVersions = [];
                            reader.int32s(message.celtVersions);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.celtVersions && message.celtVersions.length))
                            message.celtVersions = [];
                        message.celtVersions.push(reader.int32());
                        continue;
                    }
                case 5: {
                        if (wireType !== 0)
                            break;
                        message.opus = reader.bool();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        Authenticate.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        Authenticate.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.username != null && $Object.hasOwnProperty.call(message, "username"))
                if (!$util.isString(message.username))
                    return "username: string expected";
            if (message.password != null && $Object.hasOwnProperty.call(message, "password"))
                if (!$util.isString(message.password))
                    return "password: string expected";
            if (message.tokens != null && $Object.hasOwnProperty.call(message, "tokens")) {
                if (!$Array.isArray(message.tokens))
                    return "tokens: array expected";
                for (let i = 0; i < message.tokens.length; ++i)
                    if (!$util.isString(message.tokens[i]))
                        return "tokens: string[] expected";
            }
            if (message.celtVersions != null && $Object.hasOwnProperty.call(message, "celtVersions")) {
                if (!$Array.isArray(message.celtVersions))
                    return "celtVersions: array expected";
                for (let i = 0; i < message.celtVersions.length; ++i)
                    if (!$util.isInteger(message.celtVersions[i]))
                        return "celtVersions: integer[] expected";
            }
            if (message.opus != null && $Object.hasOwnProperty.call(message, "opus"))
                if (typeof message.opus !== "boolean")
                    return "opus: boolean expected";
            return null;
        };

        Authenticate.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.Authenticate)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.Authenticate: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.Authenticate();
            if (object.username != null)
                message.username = $String(object.username);
            if (object.password != null)
                message.password = $String(object.password);
            if (object.tokens) {
                if (!$Array.isArray(object.tokens))
                    throw $TypeError(".MumbleProto.Authenticate.tokens: array expected");
                message.tokens = $Array(object.tokens.length);
                for (let i = 0; i < object.tokens.length; ++i)
                    message.tokens[i] = $String(object.tokens[i]);
            }
            if (object.celtVersions) {
                if (!$Array.isArray(object.celtVersions))
                    throw $TypeError(".MumbleProto.Authenticate.celtVersions: array expected");
                message.celtVersions = $Array(object.celtVersions.length);
                for (let i = 0; i < object.celtVersions.length; ++i)
                    message.celtVersions[i] = object.celtVersions[i] | 0;
            }
            if (object.opus != null)
                message.opus = $Boolean(object.opus);
            return message;
        };

        Authenticate.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults) {
                object.tokens = [];
                object.celtVersions = [];
            }
            if (options.defaults) {
                object.username = "";
                object.password = "";
                object.opus = false;
            }
            if (message.username != null && $Object.hasOwnProperty.call(message, "username"))
                object.username = message.username;
            if (message.password != null && $Object.hasOwnProperty.call(message, "password"))
                object.password = message.password;
            if (message.tokens && message.tokens.length) {
                object.tokens = $Array(message.tokens.length);
                for (let j = 0; j < message.tokens.length; ++j)
                    object.tokens[j] = message.tokens[j];
            }
            if (message.celtVersions && message.celtVersions.length) {
                object.celtVersions = $Array(message.celtVersions.length);
                for (let j = 0; j < message.celtVersions.length; ++j)
                    object.celtVersions[j] = message.celtVersions[j];
            }
            if (message.opus != null && $Object.hasOwnProperty.call(message, "opus"))
                object.opus = message.opus;
            return object;
        };

        Authenticate.prototype.toJSON = function() {
            return Authenticate.toObject(this, $protobuf.util.toJSONOptions);
        };

        Authenticate.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.Authenticate";
        };

        return Authenticate;
    })();

    MumbleProto.Ping = (function() {

        const Ping = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        Ping.prototype.timestamp = $util.Long ? $util.Long.fromBits(0,0,true) : 0;
        Ping.prototype.good = 0;
        Ping.prototype.late = 0;
        Ping.prototype.lost = 0;
        Ping.prototype.resync = 0;
        Ping.prototype.udpPackets = 0;
        Ping.prototype.tcpPackets = 0;
        Ping.prototype.udpPingAvg = 0;
        Ping.prototype.udpPingVar = 0;
        Ping.prototype.tcpPingAvg = 0;
        Ping.prototype.tcpPingVar = 0;

        Ping.create = function(properties) {
            return new Ping(properties);
        };

        Ping.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                writer.uint32(8).uint64(message.timestamp);
            if (message.good != null && $Object.hasOwnProperty.call(message, "good"))
                writer.uint32(16).uint32(message.good);
            if (message.late != null && $Object.hasOwnProperty.call(message, "late"))
                writer.uint32(24).uint32(message.late);
            if (message.lost != null && $Object.hasOwnProperty.call(message, "lost"))
                writer.uint32(32).uint32(message.lost);
            if (message.resync != null && $Object.hasOwnProperty.call(message, "resync"))
                writer.uint32(40).uint32(message.resync);
            if (message.udpPackets != null && $Object.hasOwnProperty.call(message, "udpPackets"))
                writer.uint32(48).uint32(message.udpPackets);
            if (message.tcpPackets != null && $Object.hasOwnProperty.call(message, "tcpPackets"))
                writer.uint32(56).uint32(message.tcpPackets);
            if (message.udpPingAvg != null && $Object.hasOwnProperty.call(message, "udpPingAvg"))
                writer.uint32(69).float(message.udpPingAvg);
            if (message.udpPingVar != null && $Object.hasOwnProperty.call(message, "udpPingVar"))
                writer.uint32(77).float(message.udpPingVar);
            if (message.tcpPingAvg != null && $Object.hasOwnProperty.call(message, "tcpPingAvg"))
                writer.uint32(85).float(message.tcpPingAvg);
            if (message.tcpPingVar != null && $Object.hasOwnProperty.call(message, "tcpPingVar"))
                writer.uint32(93).float(message.tcpPingVar);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        Ping.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        Ping.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.Ping();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.timestamp = reader.uint64();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.good = reader.uint32();
                        continue;
                    }
                case 3: {
                        if (wireType !== 0)
                            break;
                        message.late = reader.uint32();
                        continue;
                    }
                case 4: {
                        if (wireType !== 0)
                            break;
                        message.lost = reader.uint32();
                        continue;
                    }
                case 5: {
                        if (wireType !== 0)
                            break;
                        message.resync = reader.uint32();
                        continue;
                    }
                case 6: {
                        if (wireType !== 0)
                            break;
                        message.udpPackets = reader.uint32();
                        continue;
                    }
                case 7: {
                        if (wireType !== 0)
                            break;
                        message.tcpPackets = reader.uint32();
                        continue;
                    }
                case 8: {
                        if (wireType !== 5)
                            break;
                        message.udpPingAvg = reader.float();
                        continue;
                    }
                case 9: {
                        if (wireType !== 5)
                            break;
                        message.udpPingVar = reader.float();
                        continue;
                    }
                case 10: {
                        if (wireType !== 5)
                            break;
                        message.tcpPingAvg = reader.float();
                        continue;
                    }
                case 11: {
                        if (wireType !== 5)
                            break;
                        message.tcpPingVar = reader.float();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        Ping.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        Ping.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                if (!$util.isInteger(message.timestamp) && !(message.timestamp && $util.isInteger(message.timestamp.low) && $util.isInteger(message.timestamp.high)))
                    return "timestamp: integer|Long expected";
            if (message.good != null && $Object.hasOwnProperty.call(message, "good"))
                if (!$util.isInteger(message.good))
                    return "good: integer expected";
            if (message.late != null && $Object.hasOwnProperty.call(message, "late"))
                if (!$util.isInteger(message.late))
                    return "late: integer expected";
            if (message.lost != null && $Object.hasOwnProperty.call(message, "lost"))
                if (!$util.isInteger(message.lost))
                    return "lost: integer expected";
            if (message.resync != null && $Object.hasOwnProperty.call(message, "resync"))
                if (!$util.isInteger(message.resync))
                    return "resync: integer expected";
            if (message.udpPackets != null && $Object.hasOwnProperty.call(message, "udpPackets"))
                if (!$util.isInteger(message.udpPackets))
                    return "udpPackets: integer expected";
            if (message.tcpPackets != null && $Object.hasOwnProperty.call(message, "tcpPackets"))
                if (!$util.isInteger(message.tcpPackets))
                    return "tcpPackets: integer expected";
            if (message.udpPingAvg != null && $Object.hasOwnProperty.call(message, "udpPingAvg"))
                if (typeof message.udpPingAvg !== "number")
                    return "udpPingAvg: number expected";
            if (message.udpPingVar != null && $Object.hasOwnProperty.call(message, "udpPingVar"))
                if (typeof message.udpPingVar !== "number")
                    return "udpPingVar: number expected";
            if (message.tcpPingAvg != null && $Object.hasOwnProperty.call(message, "tcpPingAvg"))
                if (typeof message.tcpPingAvg !== "number")
                    return "tcpPingAvg: number expected";
            if (message.tcpPingVar != null && $Object.hasOwnProperty.call(message, "tcpPingVar"))
                if (typeof message.tcpPingVar !== "number")
                    return "tcpPingVar: number expected";
            return null;
        };

        Ping.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.Ping)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.Ping: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.Ping();
            if (object.timestamp != null)
                if ($util.Long)
                    message.timestamp = $util.Long.fromValue(object.timestamp, true);
                else if (typeof object.timestamp === "string")
                    message.timestamp = $parseInt(object.timestamp, 10);
                else if (typeof object.timestamp === "number")
                    message.timestamp = object.timestamp;
                else if (typeof object.timestamp === "object")
                    message.timestamp = new $util.LongBits(object.timestamp.low >>> 0, object.timestamp.high >>> 0).toNumber(true);
            if (object.good != null)
                message.good = object.good >>> 0;
            if (object.late != null)
                message.late = object.late >>> 0;
            if (object.lost != null)
                message.lost = object.lost >>> 0;
            if (object.resync != null)
                message.resync = object.resync >>> 0;
            if (object.udpPackets != null)
                message.udpPackets = object.udpPackets >>> 0;
            if (object.tcpPackets != null)
                message.tcpPackets = object.tcpPackets >>> 0;
            if (object.udpPingAvg != null)
                message.udpPingAvg = $Number(object.udpPingAvg);
            if (object.udpPingVar != null)
                message.udpPingVar = $Number(object.udpPingVar);
            if (object.tcpPingAvg != null)
                message.tcpPingAvg = $Number(object.tcpPingAvg);
            if (object.tcpPingVar != null)
                message.tcpPingVar = $Number(object.tcpPingVar);
            return message;
        };

        Ping.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.timestamp = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                } else
                    object.timestamp = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
                object.good = 0;
                object.late = 0;
                object.lost = 0;
                object.resync = 0;
                object.udpPackets = 0;
                object.tcpPackets = 0;
                object.udpPingAvg = 0;
                object.udpPingVar = 0;
                object.tcpPingAvg = 0;
                object.tcpPingVar = 0;
            }
            if (message.timestamp != null && $Object.hasOwnProperty.call(message, "timestamp"))
                if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                    object.timestamp = typeof message.timestamp === "number" ? $BigInt(message.timestamp) : $util.Long.fromBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0, true).toBigInt();
                else if (typeof message.timestamp === "number")
                    object.timestamp = options.longs === $String ? $String(message.timestamp) : message.timestamp;
                else
                    object.timestamp = options.longs === $String ? $util.Long.prototype.toString.call(message.timestamp) : options.longs === $Number ? new $util.LongBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0).toNumber(true) : message.timestamp;
            if (message.good != null && $Object.hasOwnProperty.call(message, "good"))
                object.good = message.good;
            if (message.late != null && $Object.hasOwnProperty.call(message, "late"))
                object.late = message.late;
            if (message.lost != null && $Object.hasOwnProperty.call(message, "lost"))
                object.lost = message.lost;
            if (message.resync != null && $Object.hasOwnProperty.call(message, "resync"))
                object.resync = message.resync;
            if (message.udpPackets != null && $Object.hasOwnProperty.call(message, "udpPackets"))
                object.udpPackets = message.udpPackets;
            if (message.tcpPackets != null && $Object.hasOwnProperty.call(message, "tcpPackets"))
                object.tcpPackets = message.tcpPackets;
            if (message.udpPingAvg != null && $Object.hasOwnProperty.call(message, "udpPingAvg"))
                object.udpPingAvg = options.json && !$isFinite(message.udpPingAvg) ? $String(message.udpPingAvg) : message.udpPingAvg;
            if (message.udpPingVar != null && $Object.hasOwnProperty.call(message, "udpPingVar"))
                object.udpPingVar = options.json && !$isFinite(message.udpPingVar) ? $String(message.udpPingVar) : message.udpPingVar;
            if (message.tcpPingAvg != null && $Object.hasOwnProperty.call(message, "tcpPingAvg"))
                object.tcpPingAvg = options.json && !$isFinite(message.tcpPingAvg) ? $String(message.tcpPingAvg) : message.tcpPingAvg;
            if (message.tcpPingVar != null && $Object.hasOwnProperty.call(message, "tcpPingVar"))
                object.tcpPingVar = options.json && !$isFinite(message.tcpPingVar) ? $String(message.tcpPingVar) : message.tcpPingVar;
            return object;
        };

        Ping.prototype.toJSON = function() {
            return Ping.toObject(this, $protobuf.util.toJSONOptions);
        };

        Ping.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.Ping";
        };

        return Ping;
    })();

    MumbleProto.Reject = (function() {

        const Reject = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        Reject.prototype.type = 0;
        Reject.prototype.reason = "";

        Reject.create = function(properties) {
            return new Reject(properties);
        };

        Reject.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                writer.uint32(8).int32(message.type);
            if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                writer.uint32(18).string(message.reason);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        Reject.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        Reject.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.Reject(), value;
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        value = reader.int32();
                        if ($root.MumbleProto.Reject.RejectType[value] !== $undefined)
                            message.type = value;
                        else if (!reader.discardUnknown) {
                            $util.makeProp(message, "$unknowns", false);
                            (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                        }
                        continue;
                    }
                case 2: {
                        if (wireType !== 2)
                            break;
                        message.reason = reader.string();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        Reject.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        Reject.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                switch (message.type) {
                default:
                    return "type: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                case 8:
                    break;
                }
            if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                if (!$util.isString(message.reason))
                    return "reason: string expected";
            return null;
        };

        Reject.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.Reject)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.Reject: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.Reject();
            switch (object.type) {
            case "None":
            case 0:
                message.type = 0;
                break;
            case "WrongVersion":
            case 1:
                message.type = 1;
                break;
            case "InvalidUsername":
            case 2:
                message.type = 2;
                break;
            case "WrongUserPW":
            case 3:
                message.type = 3;
                break;
            case "WrongServerPW":
            case 4:
                message.type = 4;
                break;
            case "UsernameInUse":
            case 5:
                message.type = 5;
                break;
            case "ServerFull":
            case 6:
                message.type = 6;
                break;
            case "NoCertificate":
            case 7:
                message.type = 7;
                break;
            case "AuthenticatorFail":
            case 8:
                message.type = 8;
                break;
            default:
            }
            if (object.reason != null)
                message.reason = $String(object.reason);
            return message;
        };

        Reject.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.type = options.enums === $String ? "None" : 0;
                object.reason = "";
            }
            if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                object.type = options.enums === $String ? $root.MumbleProto.Reject.RejectType[message.type] === $undefined ? message.type : $root.MumbleProto.Reject.RejectType[message.type] : message.type;
            if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                object.reason = message.reason;
            return object;
        };

        Reject.prototype.toJSON = function() {
            return Reject.toObject(this, $protobuf.util.toJSONOptions);
        };

        Reject.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.Reject";
        };

        Reject.RejectType = (function() {
            const valuesById = $Object.create(null), values = $Object.create(valuesById);
            values[valuesById[0] = "None"] = 0;
            values[valuesById[1] = "WrongVersion"] = 1;
            values[valuesById[2] = "InvalidUsername"] = 2;
            values[valuesById[3] = "WrongUserPW"] = 3;
            values[valuesById[4] = "WrongServerPW"] = 4;
            values[valuesById[5] = "UsernameInUse"] = 5;
            values[valuesById[6] = "ServerFull"] = 6;
            values[valuesById[7] = "NoCertificate"] = 7;
            values[valuesById[8] = "AuthenticatorFail"] = 8;
            return values;
        })();

        return Reject;
    })();

    MumbleProto.ServerSync = (function() {

        const ServerSync = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        ServerSync.prototype.session = 0;
        ServerSync.prototype.maxBandwidth = 0;
        ServerSync.prototype.welcomeText = "";
        ServerSync.prototype.permissions = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        ServerSync.create = function(properties) {
            return new ServerSync(properties);
        };

        ServerSync.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                writer.uint32(8).uint32(message.session);
            if (message.maxBandwidth != null && $Object.hasOwnProperty.call(message, "maxBandwidth"))
                writer.uint32(16).uint32(message.maxBandwidth);
            if (message.welcomeText != null && $Object.hasOwnProperty.call(message, "welcomeText"))
                writer.uint32(26).string(message.welcomeText);
            if (message.permissions != null && $Object.hasOwnProperty.call(message, "permissions"))
                writer.uint32(32).uint64(message.permissions);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ServerSync.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        ServerSync.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ServerSync();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.session = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.maxBandwidth = reader.uint32();
                        continue;
                    }
                case 3: {
                        if (wireType !== 2)
                            break;
                        message.welcomeText = reader.string();
                        continue;
                    }
                case 4: {
                        if (wireType !== 0)
                            break;
                        message.permissions = reader.uint64();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        ServerSync.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        ServerSync.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                if (!$util.isInteger(message.session))
                    return "session: integer expected";
            if (message.maxBandwidth != null && $Object.hasOwnProperty.call(message, "maxBandwidth"))
                if (!$util.isInteger(message.maxBandwidth))
                    return "maxBandwidth: integer expected";
            if (message.welcomeText != null && $Object.hasOwnProperty.call(message, "welcomeText"))
                if (!$util.isString(message.welcomeText))
                    return "welcomeText: string expected";
            if (message.permissions != null && $Object.hasOwnProperty.call(message, "permissions"))
                if (!$util.isInteger(message.permissions) && !(message.permissions && $util.isInteger(message.permissions.low) && $util.isInteger(message.permissions.high)))
                    return "permissions: integer|Long expected";
            return null;
        };

        ServerSync.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.ServerSync)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.ServerSync: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.ServerSync();
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.maxBandwidth != null)
                message.maxBandwidth = object.maxBandwidth >>> 0;
            if (object.welcomeText != null)
                message.welcomeText = $String(object.welcomeText);
            if (object.permissions != null)
                if ($util.Long)
                    message.permissions = $util.Long.fromValue(object.permissions, true);
                else if (typeof object.permissions === "string")
                    message.permissions = $parseInt(object.permissions, 10);
                else if (typeof object.permissions === "number")
                    message.permissions = object.permissions;
                else if (typeof object.permissions === "object")
                    message.permissions = new $util.LongBits(object.permissions.low >>> 0, object.permissions.high >>> 0).toNumber(true);
            return message;
        };

        ServerSync.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.session = 0;
                object.maxBandwidth = 0;
                object.welcomeText = "";
                if ($util.Long) {
                    let long = new $util.Long(0, 0, true);
                    object.permissions = options.longs === $String ? long.toString() : options.longs === $Number ? long.toNumber() : typeof $BigInt !== "undefined" && options.longs === $BigInt ? long.toBigInt() : long;
                } else
                    object.permissions = options.longs === $String ? "0" : typeof $BigInt !== "undefined" && options.longs === $BigInt ? $BigInt("0") : 0;
            }
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                object.session = message.session;
            if (message.maxBandwidth != null && $Object.hasOwnProperty.call(message, "maxBandwidth"))
                object.maxBandwidth = message.maxBandwidth;
            if (message.welcomeText != null && $Object.hasOwnProperty.call(message, "welcomeText"))
                object.welcomeText = message.welcomeText;
            if (message.permissions != null && $Object.hasOwnProperty.call(message, "permissions"))
                if (typeof $BigInt !== "undefined" && options.longs === $BigInt)
                    object.permissions = typeof message.permissions === "number" ? $BigInt(message.permissions) : $util.Long.fromBits(message.permissions.low >>> 0, message.permissions.high >>> 0, true).toBigInt();
                else if (typeof message.permissions === "number")
                    object.permissions = options.longs === $String ? $String(message.permissions) : message.permissions;
                else
                    object.permissions = options.longs === $String ? $util.Long.prototype.toString.call(message.permissions) : options.longs === $Number ? new $util.LongBits(message.permissions.low >>> 0, message.permissions.high >>> 0).toNumber(true) : message.permissions;
            return object;
        };

        ServerSync.prototype.toJSON = function() {
            return ServerSync.toObject(this, $protobuf.util.toJSONOptions);
        };

        ServerSync.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ServerSync";
        };

        return ServerSync;
    })();

    MumbleProto.ChannelRemove = (function() {

        const ChannelRemove = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        ChannelRemove.prototype.channelId = 0;

        ChannelRemove.create = function(properties) {
            return new ChannelRemove(properties);
        };

        ChannelRemove.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            writer.uint32(8).uint32(message.channelId);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ChannelRemove.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        ChannelRemove.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ChannelRemove();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.channelId = reader.uint32();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            if (!$Object.hasOwnProperty.call(message, "channelId"))
                throw $util.ProtocolError("missing required 'channelId'", { instance: message });
            return message;
        };

        ChannelRemove.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        ChannelRemove.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (!$util.isInteger(message.channelId))
                return "channelId: integer expected";
            return null;
        };

        ChannelRemove.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.ChannelRemove)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.ChannelRemove: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.ChannelRemove();
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            return message;
        };

        ChannelRemove.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults)
                object.channelId = 0;
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                object.channelId = message.channelId;
            return object;
        };

        ChannelRemove.prototype.toJSON = function() {
            return ChannelRemove.toObject(this, $protobuf.util.toJSONOptions);
        };

        ChannelRemove.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ChannelRemove";
        };

        return ChannelRemove;
    })();

    MumbleProto.ChannelState = (function() {

        const ChannelState = function (properties) {
            this.links = [];
            this.linksAdd = [];
            this.linksRemove = [];
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        ChannelState.prototype.channelId = 0;
        ChannelState.prototype.parent = 0;
        ChannelState.prototype.name = "";
        ChannelState.prototype.links = $util.emptyArray;
        ChannelState.prototype.description = "";
        ChannelState.prototype.linksAdd = $util.emptyArray;
        ChannelState.prototype.linksRemove = $util.emptyArray;
        ChannelState.prototype.temporary = false;
        ChannelState.prototype.position = 0;
        ChannelState.prototype.descriptionHash = $util.newBuffer([]);
        ChannelState.prototype.maxUsers = 0;

        ChannelState.create = function(properties) {
            return new ChannelState(properties);
        };

        ChannelState.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(8).uint32(message.channelId);
            if (message.parent != null && $Object.hasOwnProperty.call(message, "parent"))
                writer.uint32(16).uint32(message.parent);
            if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                writer.uint32(26).string(message.name);
            if (message.links != null && message.links.length)
                for (let i = 0; i < message.links.length; ++i)
                    writer.uint32(32).uint32(message.links[i]);
            if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                writer.uint32(42).string(message.description);
            if (message.linksAdd != null && message.linksAdd.length)
                for (let i = 0; i < message.linksAdd.length; ++i)
                    writer.uint32(48).uint32(message.linksAdd[i]);
            if (message.linksRemove != null && message.linksRemove.length)
                for (let i = 0; i < message.linksRemove.length; ++i)
                    writer.uint32(56).uint32(message.linksRemove[i]);
            if (message.temporary != null && $Object.hasOwnProperty.call(message, "temporary"))
                writer.uint32(64).bool(message.temporary);
            if (message.position != null && $Object.hasOwnProperty.call(message, "position"))
                writer.uint32(72).int32(message.position);
            if (message.descriptionHash != null && $Object.hasOwnProperty.call(message, "descriptionHash"))
                writer.uint32(82).bytes(message.descriptionHash);
            if (message.maxUsers != null && $Object.hasOwnProperty.call(message, "maxUsers"))
                writer.uint32(88).uint32(message.maxUsers);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ChannelState.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        ChannelState.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ChannelState();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.channelId = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.parent = reader.uint32();
                        continue;
                    }
                case 3: {
                        if (wireType !== 2)
                            break;
                        message.name = reader.string();
                        continue;
                    }
                case 4: {
                        if (wireType === 2) {
                            if (!(message.links && message.links.length))
                                message.links = [];
                            reader.uint32s(message.links);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.links && message.links.length))
                            message.links = [];
                        message.links.push(reader.uint32());
                        continue;
                    }
                case 5: {
                        if (wireType !== 2)
                            break;
                        message.description = reader.string();
                        continue;
                    }
                case 6: {
                        if (wireType === 2) {
                            if (!(message.linksAdd && message.linksAdd.length))
                                message.linksAdd = [];
                            reader.uint32s(message.linksAdd);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.linksAdd && message.linksAdd.length))
                            message.linksAdd = [];
                        message.linksAdd.push(reader.uint32());
                        continue;
                    }
                case 7: {
                        if (wireType === 2) {
                            if (!(message.linksRemove && message.linksRemove.length))
                                message.linksRemove = [];
                            reader.uint32s(message.linksRemove);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.linksRemove && message.linksRemove.length))
                            message.linksRemove = [];
                        message.linksRemove.push(reader.uint32());
                        continue;
                    }
                case 8: {
                        if (wireType !== 0)
                            break;
                        message.temporary = reader.bool();
                        continue;
                    }
                case 9: {
                        if (wireType !== 0)
                            break;
                        message.position = reader.int32();
                        continue;
                    }
                case 10: {
                        if (wireType !== 2)
                            break;
                        message.descriptionHash = reader.bytes();
                        continue;
                    }
                case 11: {
                        if (wireType !== 0)
                            break;
                        message.maxUsers = reader.uint32();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        ChannelState.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        ChannelState.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                if (!$util.isInteger(message.channelId))
                    return "channelId: integer expected";
            if (message.parent != null && $Object.hasOwnProperty.call(message, "parent"))
                if (!$util.isInteger(message.parent))
                    return "parent: integer expected";
            if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            if (message.links != null && $Object.hasOwnProperty.call(message, "links")) {
                if (!$Array.isArray(message.links))
                    return "links: array expected";
                for (let i = 0; i < message.links.length; ++i)
                    if (!$util.isInteger(message.links[i]))
                        return "links: integer[] expected";
            }
            if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                if (!$util.isString(message.description))
                    return "description: string expected";
            if (message.linksAdd != null && $Object.hasOwnProperty.call(message, "linksAdd")) {
                if (!$Array.isArray(message.linksAdd))
                    return "linksAdd: array expected";
                for (let i = 0; i < message.linksAdd.length; ++i)
                    if (!$util.isInteger(message.linksAdd[i]))
                        return "linksAdd: integer[] expected";
            }
            if (message.linksRemove != null && $Object.hasOwnProperty.call(message, "linksRemove")) {
                if (!$Array.isArray(message.linksRemove))
                    return "linksRemove: array expected";
                for (let i = 0; i < message.linksRemove.length; ++i)
                    if (!$util.isInteger(message.linksRemove[i]))
                        return "linksRemove: integer[] expected";
            }
            if (message.temporary != null && $Object.hasOwnProperty.call(message, "temporary"))
                if (typeof message.temporary !== "boolean")
                    return "temporary: boolean expected";
            if (message.position != null && $Object.hasOwnProperty.call(message, "position"))
                if (!$util.isInteger(message.position))
                    return "position: integer expected";
            if (message.descriptionHash != null && $Object.hasOwnProperty.call(message, "descriptionHash"))
                if (!(message.descriptionHash && typeof message.descriptionHash.length === "number" || $util.isString(message.descriptionHash)))
                    return "descriptionHash: buffer expected";
            if (message.maxUsers != null && $Object.hasOwnProperty.call(message, "maxUsers"))
                if (!$util.isInteger(message.maxUsers))
                    return "maxUsers: integer expected";
            return null;
        };

        ChannelState.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.ChannelState)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.ChannelState: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.ChannelState();
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.parent != null)
                message.parent = object.parent >>> 0;
            if (object.name != null)
                message.name = $String(object.name);
            if (object.links) {
                if (!$Array.isArray(object.links))
                    throw $TypeError(".MumbleProto.ChannelState.links: array expected");
                message.links = $Array(object.links.length);
                for (let i = 0; i < object.links.length; ++i)
                    message.links[i] = object.links[i] >>> 0;
            }
            if (object.description != null)
                message.description = $String(object.description);
            if (object.linksAdd) {
                if (!$Array.isArray(object.linksAdd))
                    throw $TypeError(".MumbleProto.ChannelState.linksAdd: array expected");
                message.linksAdd = $Array(object.linksAdd.length);
                for (let i = 0; i < object.linksAdd.length; ++i)
                    message.linksAdd[i] = object.linksAdd[i] >>> 0;
            }
            if (object.linksRemove) {
                if (!$Array.isArray(object.linksRemove))
                    throw $TypeError(".MumbleProto.ChannelState.linksRemove: array expected");
                message.linksRemove = $Array(object.linksRemove.length);
                for (let i = 0; i < object.linksRemove.length; ++i)
                    message.linksRemove[i] = object.linksRemove[i] >>> 0;
            }
            if (object.temporary != null)
                message.temporary = $Boolean(object.temporary);
            if (object.position != null)
                message.position = object.position | 0;
            if (object.descriptionHash != null)
                if (typeof object.descriptionHash === "string")
                    $util.base64.decode(object.descriptionHash, message.descriptionHash = $util.newBuffer($util.base64.length(object.descriptionHash)), 0);
                else if (object.descriptionHash.length >= 0)
                    message.descriptionHash = object.descriptionHash;
            if (object.maxUsers != null)
                message.maxUsers = object.maxUsers >>> 0;
            return message;
        };

        ChannelState.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults) {
                object.links = [];
                object.linksAdd = [];
                object.linksRemove = [];
            }
            if (options.defaults) {
                object.channelId = 0;
                object.parent = 0;
                object.name = "";
                object.description = "";
                object.temporary = false;
                object.position = 0;
                if (options.bytes === $String)
                    object.descriptionHash = "";
                else {
                    object.descriptionHash = [];
                    if (options.bytes !== $Array)
                        object.descriptionHash = $util.newBuffer(object.descriptionHash);
                }
                object.maxUsers = 0;
            }
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                object.channelId = message.channelId;
            if (message.parent != null && $Object.hasOwnProperty.call(message, "parent"))
                object.parent = message.parent;
            if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                object.name = message.name;
            if (message.links && message.links.length) {
                object.links = $Array(message.links.length);
                for (let j = 0; j < message.links.length; ++j)
                    object.links[j] = message.links[j];
            }
            if (message.description != null && $Object.hasOwnProperty.call(message, "description"))
                object.description = message.description;
            if (message.linksAdd && message.linksAdd.length) {
                object.linksAdd = $Array(message.linksAdd.length);
                for (let j = 0; j < message.linksAdd.length; ++j)
                    object.linksAdd[j] = message.linksAdd[j];
            }
            if (message.linksRemove && message.linksRemove.length) {
                object.linksRemove = $Array(message.linksRemove.length);
                for (let j = 0; j < message.linksRemove.length; ++j)
                    object.linksRemove[j] = message.linksRemove[j];
            }
            if (message.temporary != null && $Object.hasOwnProperty.call(message, "temporary"))
                object.temporary = message.temporary;
            if (message.position != null && $Object.hasOwnProperty.call(message, "position"))
                object.position = message.position;
            if (message.descriptionHash != null && $Object.hasOwnProperty.call(message, "descriptionHash"))
                object.descriptionHash = options.bytes === $String ? $util.base64.encode(message.descriptionHash, 0, message.descriptionHash.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.descriptionHash) : message.descriptionHash;
            if (message.maxUsers != null && $Object.hasOwnProperty.call(message, "maxUsers"))
                object.maxUsers = message.maxUsers;
            return object;
        };

        ChannelState.prototype.toJSON = function() {
            return ChannelState.toObject(this, $protobuf.util.toJSONOptions);
        };

        ChannelState.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ChannelState";
        };

        return ChannelState;
    })();

    MumbleProto.UserRemove = (function() {

        const UserRemove = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        UserRemove.prototype.session = 0;
        UserRemove.prototype.actor = 0;
        UserRemove.prototype.reason = "";
        UserRemove.prototype.ban = false;

        UserRemove.create = function(properties) {
            return new UserRemove(properties);
        };

        UserRemove.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            writer.uint32(8).uint32(message.session);
            if (message.actor != null && $Object.hasOwnProperty.call(message, "actor"))
                writer.uint32(16).uint32(message.actor);
            if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                writer.uint32(26).string(message.reason);
            if (message.ban != null && $Object.hasOwnProperty.call(message, "ban"))
                writer.uint32(32).bool(message.ban);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        UserRemove.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        UserRemove.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserRemove();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.session = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.actor = reader.uint32();
                        continue;
                    }
                case 3: {
                        if (wireType !== 2)
                            break;
                        message.reason = reader.string();
                        continue;
                    }
                case 4: {
                        if (wireType !== 0)
                            break;
                        message.ban = reader.bool();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            if (!$Object.hasOwnProperty.call(message, "session"))
                throw $util.ProtocolError("missing required 'session'", { instance: message });
            return message;
        };

        UserRemove.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        UserRemove.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (!$util.isInteger(message.session))
                return "session: integer expected";
            if (message.actor != null && $Object.hasOwnProperty.call(message, "actor"))
                if (!$util.isInteger(message.actor))
                    return "actor: integer expected";
            if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                if (!$util.isString(message.reason))
                    return "reason: string expected";
            if (message.ban != null && $Object.hasOwnProperty.call(message, "ban"))
                if (typeof message.ban !== "boolean")
                    return "ban: boolean expected";
            return null;
        };

        UserRemove.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.UserRemove)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.UserRemove: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.UserRemove();
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.actor != null)
                message.actor = object.actor >>> 0;
            if (object.reason != null)
                message.reason = $String(object.reason);
            if (object.ban != null)
                message.ban = $Boolean(object.ban);
            return message;
        };

        UserRemove.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.session = 0;
                object.actor = 0;
                object.reason = "";
                object.ban = false;
            }
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                object.session = message.session;
            if (message.actor != null && $Object.hasOwnProperty.call(message, "actor"))
                object.actor = message.actor;
            if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                object.reason = message.reason;
            if (message.ban != null && $Object.hasOwnProperty.call(message, "ban"))
                object.ban = message.ban;
            return object;
        };

        UserRemove.prototype.toJSON = function() {
            return UserRemove.toObject(this, $protobuf.util.toJSONOptions);
        };

        UserRemove.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.UserRemove";
        };

        return UserRemove;
    })();

    MumbleProto.UserState = (function() {

        const UserState = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        UserState.prototype.session = 0;
        UserState.prototype.actor = 0;
        UserState.prototype.name = "";
        UserState.prototype.userId = 0;
        UserState.prototype.channelId = 0;
        UserState.prototype.mute = false;
        UserState.prototype.deaf = false;
        UserState.prototype.suppress = false;
        UserState.prototype.selfMute = false;
        UserState.prototype.selfDeaf = false;
        UserState.prototype.texture = $util.newBuffer([]);
        UserState.prototype.pluginContext = $util.newBuffer([]);
        UserState.prototype.pluginIdentity = "";
        UserState.prototype.comment = "";
        UserState.prototype.hash = "";
        UserState.prototype.commentHash = $util.newBuffer([]);
        UserState.prototype.textureHash = $util.newBuffer([]);
        UserState.prototype.prioritySpeaker = false;
        UserState.prototype.recording = false;

        UserState.create = function(properties) {
            return new UserState(properties);
        };

        UserState.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                writer.uint32(8).uint32(message.session);
            if (message.actor != null && $Object.hasOwnProperty.call(message, "actor"))
                writer.uint32(16).uint32(message.actor);
            if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                writer.uint32(26).string(message.name);
            if (message.userId != null && $Object.hasOwnProperty.call(message, "userId"))
                writer.uint32(32).uint32(message.userId);
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(40).uint32(message.channelId);
            if (message.mute != null && $Object.hasOwnProperty.call(message, "mute"))
                writer.uint32(48).bool(message.mute);
            if (message.deaf != null && $Object.hasOwnProperty.call(message, "deaf"))
                writer.uint32(56).bool(message.deaf);
            if (message.suppress != null && $Object.hasOwnProperty.call(message, "suppress"))
                writer.uint32(64).bool(message.suppress);
            if (message.selfMute != null && $Object.hasOwnProperty.call(message, "selfMute"))
                writer.uint32(72).bool(message.selfMute);
            if (message.selfDeaf != null && $Object.hasOwnProperty.call(message, "selfDeaf"))
                writer.uint32(80).bool(message.selfDeaf);
            if (message.texture != null && $Object.hasOwnProperty.call(message, "texture"))
                writer.uint32(90).bytes(message.texture);
            if (message.pluginContext != null && $Object.hasOwnProperty.call(message, "pluginContext"))
                writer.uint32(98).bytes(message.pluginContext);
            if (message.pluginIdentity != null && $Object.hasOwnProperty.call(message, "pluginIdentity"))
                writer.uint32(106).string(message.pluginIdentity);
            if (message.comment != null && $Object.hasOwnProperty.call(message, "comment"))
                writer.uint32(114).string(message.comment);
            if (message.hash != null && $Object.hasOwnProperty.call(message, "hash"))
                writer.uint32(122).string(message.hash);
            if (message.commentHash != null && $Object.hasOwnProperty.call(message, "commentHash"))
                writer.uint32(130).bytes(message.commentHash);
            if (message.textureHash != null && $Object.hasOwnProperty.call(message, "textureHash"))
                writer.uint32(138).bytes(message.textureHash);
            if (message.prioritySpeaker != null && $Object.hasOwnProperty.call(message, "prioritySpeaker"))
                writer.uint32(144).bool(message.prioritySpeaker);
            if (message.recording != null && $Object.hasOwnProperty.call(message, "recording"))
                writer.uint32(152).bool(message.recording);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        UserState.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        UserState.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserState();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.session = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.actor = reader.uint32();
                        continue;
                    }
                case 3: {
                        if (wireType !== 2)
                            break;
                        message.name = reader.string();
                        continue;
                    }
                case 4: {
                        if (wireType !== 0)
                            break;
                        message.userId = reader.uint32();
                        continue;
                    }
                case 5: {
                        if (wireType !== 0)
                            break;
                        message.channelId = reader.uint32();
                        continue;
                    }
                case 6: {
                        if (wireType !== 0)
                            break;
                        message.mute = reader.bool();
                        continue;
                    }
                case 7: {
                        if (wireType !== 0)
                            break;
                        message.deaf = reader.bool();
                        continue;
                    }
                case 8: {
                        if (wireType !== 0)
                            break;
                        message.suppress = reader.bool();
                        continue;
                    }
                case 9: {
                        if (wireType !== 0)
                            break;
                        message.selfMute = reader.bool();
                        continue;
                    }
                case 10: {
                        if (wireType !== 0)
                            break;
                        message.selfDeaf = reader.bool();
                        continue;
                    }
                case 11: {
                        if (wireType !== 2)
                            break;
                        message.texture = reader.bytes();
                        continue;
                    }
                case 12: {
                        if (wireType !== 2)
                            break;
                        message.pluginContext = reader.bytes();
                        continue;
                    }
                case 13: {
                        if (wireType !== 2)
                            break;
                        message.pluginIdentity = reader.string();
                        continue;
                    }
                case 14: {
                        if (wireType !== 2)
                            break;
                        message.comment = reader.string();
                        continue;
                    }
                case 15: {
                        if (wireType !== 2)
                            break;
                        message.hash = reader.string();
                        continue;
                    }
                case 16: {
                        if (wireType !== 2)
                            break;
                        message.commentHash = reader.bytes();
                        continue;
                    }
                case 17: {
                        if (wireType !== 2)
                            break;
                        message.textureHash = reader.bytes();
                        continue;
                    }
                case 18: {
                        if (wireType !== 0)
                            break;
                        message.prioritySpeaker = reader.bool();
                        continue;
                    }
                case 19: {
                        if (wireType !== 0)
                            break;
                        message.recording = reader.bool();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        UserState.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        UserState.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                if (!$util.isInteger(message.session))
                    return "session: integer expected";
            if (message.actor != null && $Object.hasOwnProperty.call(message, "actor"))
                if (!$util.isInteger(message.actor))
                    return "actor: integer expected";
            if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            if (message.userId != null && $Object.hasOwnProperty.call(message, "userId"))
                if (!$util.isInteger(message.userId))
                    return "userId: integer expected";
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                if (!$util.isInteger(message.channelId))
                    return "channelId: integer expected";
            if (message.mute != null && $Object.hasOwnProperty.call(message, "mute"))
                if (typeof message.mute !== "boolean")
                    return "mute: boolean expected";
            if (message.deaf != null && $Object.hasOwnProperty.call(message, "deaf"))
                if (typeof message.deaf !== "boolean")
                    return "deaf: boolean expected";
            if (message.suppress != null && $Object.hasOwnProperty.call(message, "suppress"))
                if (typeof message.suppress !== "boolean")
                    return "suppress: boolean expected";
            if (message.selfMute != null && $Object.hasOwnProperty.call(message, "selfMute"))
                if (typeof message.selfMute !== "boolean")
                    return "selfMute: boolean expected";
            if (message.selfDeaf != null && $Object.hasOwnProperty.call(message, "selfDeaf"))
                if (typeof message.selfDeaf !== "boolean")
                    return "selfDeaf: boolean expected";
            if (message.texture != null && $Object.hasOwnProperty.call(message, "texture"))
                if (!(message.texture && typeof message.texture.length === "number" || $util.isString(message.texture)))
                    return "texture: buffer expected";
            if (message.pluginContext != null && $Object.hasOwnProperty.call(message, "pluginContext"))
                if (!(message.pluginContext && typeof message.pluginContext.length === "number" || $util.isString(message.pluginContext)))
                    return "pluginContext: buffer expected";
            if (message.pluginIdentity != null && $Object.hasOwnProperty.call(message, "pluginIdentity"))
                if (!$util.isString(message.pluginIdentity))
                    return "pluginIdentity: string expected";
            if (message.comment != null && $Object.hasOwnProperty.call(message, "comment"))
                if (!$util.isString(message.comment))
                    return "comment: string expected";
            if (message.hash != null && $Object.hasOwnProperty.call(message, "hash"))
                if (!$util.isString(message.hash))
                    return "hash: string expected";
            if (message.commentHash != null && $Object.hasOwnProperty.call(message, "commentHash"))
                if (!(message.commentHash && typeof message.commentHash.length === "number" || $util.isString(message.commentHash)))
                    return "commentHash: buffer expected";
            if (message.textureHash != null && $Object.hasOwnProperty.call(message, "textureHash"))
                if (!(message.textureHash && typeof message.textureHash.length === "number" || $util.isString(message.textureHash)))
                    return "textureHash: buffer expected";
            if (message.prioritySpeaker != null && $Object.hasOwnProperty.call(message, "prioritySpeaker"))
                if (typeof message.prioritySpeaker !== "boolean")
                    return "prioritySpeaker: boolean expected";
            if (message.recording != null && $Object.hasOwnProperty.call(message, "recording"))
                if (typeof message.recording !== "boolean")
                    return "recording: boolean expected";
            return null;
        };

        UserState.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.UserState)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.UserState: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.UserState();
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.actor != null)
                message.actor = object.actor >>> 0;
            if (object.name != null)
                message.name = $String(object.name);
            if (object.userId != null)
                message.userId = object.userId >>> 0;
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.mute != null)
                message.mute = $Boolean(object.mute);
            if (object.deaf != null)
                message.deaf = $Boolean(object.deaf);
            if (object.suppress != null)
                message.suppress = $Boolean(object.suppress);
            if (object.selfMute != null)
                message.selfMute = $Boolean(object.selfMute);
            if (object.selfDeaf != null)
                message.selfDeaf = $Boolean(object.selfDeaf);
            if (object.texture != null)
                if (typeof object.texture === "string")
                    $util.base64.decode(object.texture, message.texture = $util.newBuffer($util.base64.length(object.texture)), 0);
                else if (object.texture.length >= 0)
                    message.texture = object.texture;
            if (object.pluginContext != null)
                if (typeof object.pluginContext === "string")
                    $util.base64.decode(object.pluginContext, message.pluginContext = $util.newBuffer($util.base64.length(object.pluginContext)), 0);
                else if (object.pluginContext.length >= 0)
                    message.pluginContext = object.pluginContext;
            if (object.pluginIdentity != null)
                message.pluginIdentity = $String(object.pluginIdentity);
            if (object.comment != null)
                message.comment = $String(object.comment);
            if (object.hash != null)
                message.hash = $String(object.hash);
            if (object.commentHash != null)
                if (typeof object.commentHash === "string")
                    $util.base64.decode(object.commentHash, message.commentHash = $util.newBuffer($util.base64.length(object.commentHash)), 0);
                else if (object.commentHash.length >= 0)
                    message.commentHash = object.commentHash;
            if (object.textureHash != null)
                if (typeof object.textureHash === "string")
                    $util.base64.decode(object.textureHash, message.textureHash = $util.newBuffer($util.base64.length(object.textureHash)), 0);
                else if (object.textureHash.length >= 0)
                    message.textureHash = object.textureHash;
            if (object.prioritySpeaker != null)
                message.prioritySpeaker = $Boolean(object.prioritySpeaker);
            if (object.recording != null)
                message.recording = $Boolean(object.recording);
            return message;
        };

        UserState.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.session = 0;
                object.actor = 0;
                object.name = "";
                object.userId = 0;
                object.channelId = 0;
                object.mute = false;
                object.deaf = false;
                object.suppress = false;
                object.selfMute = false;
                object.selfDeaf = false;
                if (options.bytes === $String)
                    object.texture = "";
                else {
                    object.texture = [];
                    if (options.bytes !== $Array)
                        object.texture = $util.newBuffer(object.texture);
                }
                if (options.bytes === $String)
                    object.pluginContext = "";
                else {
                    object.pluginContext = [];
                    if (options.bytes !== $Array)
                        object.pluginContext = $util.newBuffer(object.pluginContext);
                }
                object.pluginIdentity = "";
                object.comment = "";
                object.hash = "";
                if (options.bytes === $String)
                    object.commentHash = "";
                else {
                    object.commentHash = [];
                    if (options.bytes !== $Array)
                        object.commentHash = $util.newBuffer(object.commentHash);
                }
                if (options.bytes === $String)
                    object.textureHash = "";
                else {
                    object.textureHash = [];
                    if (options.bytes !== $Array)
                        object.textureHash = $util.newBuffer(object.textureHash);
                }
                object.prioritySpeaker = false;
                object.recording = false;
            }
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                object.session = message.session;
            if (message.actor != null && $Object.hasOwnProperty.call(message, "actor"))
                object.actor = message.actor;
            if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                object.name = message.name;
            if (message.userId != null && $Object.hasOwnProperty.call(message, "userId"))
                object.userId = message.userId;
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                object.channelId = message.channelId;
            if (message.mute != null && $Object.hasOwnProperty.call(message, "mute"))
                object.mute = message.mute;
            if (message.deaf != null && $Object.hasOwnProperty.call(message, "deaf"))
                object.deaf = message.deaf;
            if (message.suppress != null && $Object.hasOwnProperty.call(message, "suppress"))
                object.suppress = message.suppress;
            if (message.selfMute != null && $Object.hasOwnProperty.call(message, "selfMute"))
                object.selfMute = message.selfMute;
            if (message.selfDeaf != null && $Object.hasOwnProperty.call(message, "selfDeaf"))
                object.selfDeaf = message.selfDeaf;
            if (message.texture != null && $Object.hasOwnProperty.call(message, "texture"))
                object.texture = options.bytes === $String ? $util.base64.encode(message.texture, 0, message.texture.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.texture) : message.texture;
            if (message.pluginContext != null && $Object.hasOwnProperty.call(message, "pluginContext"))
                object.pluginContext = options.bytes === $String ? $util.base64.encode(message.pluginContext, 0, message.pluginContext.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.pluginContext) : message.pluginContext;
            if (message.pluginIdentity != null && $Object.hasOwnProperty.call(message, "pluginIdentity"))
                object.pluginIdentity = message.pluginIdentity;
            if (message.comment != null && $Object.hasOwnProperty.call(message, "comment"))
                object.comment = message.comment;
            if (message.hash != null && $Object.hasOwnProperty.call(message, "hash"))
                object.hash = message.hash;
            if (message.commentHash != null && $Object.hasOwnProperty.call(message, "commentHash"))
                object.commentHash = options.bytes === $String ? $util.base64.encode(message.commentHash, 0, message.commentHash.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.commentHash) : message.commentHash;
            if (message.textureHash != null && $Object.hasOwnProperty.call(message, "textureHash"))
                object.textureHash = options.bytes === $String ? $util.base64.encode(message.textureHash, 0, message.textureHash.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.textureHash) : message.textureHash;
            if (message.prioritySpeaker != null && $Object.hasOwnProperty.call(message, "prioritySpeaker"))
                object.prioritySpeaker = message.prioritySpeaker;
            if (message.recording != null && $Object.hasOwnProperty.call(message, "recording"))
                object.recording = message.recording;
            return object;
        };

        UserState.prototype.toJSON = function() {
            return UserState.toObject(this, $protobuf.util.toJSONOptions);
        };

        UserState.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.UserState";
        };

        return UserState;
    })();

    MumbleProto.BanList = (function() {

        const BanList = function (properties) {
            this.bans = [];
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        BanList.prototype.bans = $util.emptyArray;
        BanList.prototype.query = false;

        BanList.create = function(properties) {
            return new BanList(properties);
        };

        BanList.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.bans != null && message.bans.length)
                for (let i = 0; i < message.bans.length; ++i)
                    $root.MumbleProto.BanList.BanEntry.encode(message.bans[i], writer.uint32(10).fork(), _depth + 1).ldelim();
            if (message.query != null && $Object.hasOwnProperty.call(message, "query"))
                writer.uint32(16).bool(message.query);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        BanList.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        BanList.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.BanList();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 2)
                            break;
                        if (!(message.bans && message.bans.length))
                            message.bans = [];
                        message.bans.push($root.MumbleProto.BanList.BanEntry.decode(reader, reader.uint32(), $undefined, _depth + 1));
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.query = reader.bool();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        BanList.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        BanList.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.bans != null && $Object.hasOwnProperty.call(message, "bans")) {
                if (!$Array.isArray(message.bans))
                    return "bans: array expected";
                for (let i = 0; i < message.bans.length; ++i) {
                    let error = $root.MumbleProto.BanList.BanEntry.verify(message.bans[i], _depth + 1);
                    if (error)
                        return "bans." + error;
                }
            }
            if (message.query != null && $Object.hasOwnProperty.call(message, "query"))
                if (typeof message.query !== "boolean")
                    return "query: boolean expected";
            return null;
        };

        BanList.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.BanList)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.BanList: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.BanList();
            if (object.bans) {
                if (!$Array.isArray(object.bans))
                    throw $TypeError(".MumbleProto.BanList.bans: array expected");
                message.bans = $Array(object.bans.length);
                for (let i = 0; i < object.bans.length; ++i) {
                    if (!$util.isObject(object.bans[i]))
                        throw $TypeError(".MumbleProto.BanList.bans: object expected");
                    message.bans[i] = $root.MumbleProto.BanList.BanEntry.fromObject(object.bans[i], _depth + 1);
                }
            }
            if (object.query != null)
                message.query = $Boolean(object.query);
            return message;
        };

        BanList.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults)
                object.bans = [];
            if (options.defaults)
                object.query = false;
            if (message.bans && message.bans.length) {
                object.bans = $Array(message.bans.length);
                for (let j = 0; j < message.bans.length; ++j)
                    object.bans[j] = $root.MumbleProto.BanList.BanEntry.toObject(message.bans[j], options, _depth + 1);
            }
            if (message.query != null && $Object.hasOwnProperty.call(message, "query"))
                object.query = message.query;
            return object;
        };

        BanList.prototype.toJSON = function() {
            return BanList.toObject(this, $protobuf.util.toJSONOptions);
        };

        BanList.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.BanList";
        };

        BanList.BanEntry = (function() {

            const BanEntry = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            BanEntry.prototype.address = $util.newBuffer([]);
            BanEntry.prototype.mask = 0;
            BanEntry.prototype.name = "";
            BanEntry.prototype.hash = "";
            BanEntry.prototype.reason = "";
            BanEntry.prototype.start = "";
            BanEntry.prototype.duration = 0;

            BanEntry.create = function(properties) {
                return new BanEntry(properties);
            };

            BanEntry.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                writer.uint32(10).bytes(message.address);
                writer.uint32(16).uint32(message.mask);
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    writer.uint32(26).string(message.name);
                if (message.hash != null && $Object.hasOwnProperty.call(message, "hash"))
                    writer.uint32(34).string(message.hash);
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    writer.uint32(42).string(message.reason);
                if (message.start != null && $Object.hasOwnProperty.call(message, "start"))
                    writer.uint32(50).string(message.start);
                if (message.duration != null && $Object.hasOwnProperty.call(message, "duration"))
                    writer.uint32(56).uint32(message.duration);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            BanEntry.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            BanEntry.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.BanList.BanEntry();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.address = reader.bytes();
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            message.mask = reader.uint32();
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.name = reader.string();
                            continue;
                        }
                    case 4: {
                            if (wireType !== 2)
                                break;
                            message.hash = reader.string();
                            continue;
                        }
                    case 5: {
                            if (wireType !== 2)
                                break;
                            message.reason = reader.string();
                            continue;
                        }
                    case 6: {
                            if (wireType !== 2)
                                break;
                            message.start = reader.string();
                            continue;
                        }
                    case 7: {
                            if (wireType !== 0)
                                break;
                            message.duration = reader.uint32();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                if (!$Object.hasOwnProperty.call(message, "address"))
                    throw $util.ProtocolError("missing required 'address'", { instance: message });
                if (!$Object.hasOwnProperty.call(message, "mask"))
                    throw $util.ProtocolError("missing required 'mask'", { instance: message });
                return message;
            };

            BanEntry.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            BanEntry.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (!(message.address && typeof message.address.length === "number" || $util.isString(message.address)))
                    return "address: buffer expected";
                if (!$util.isInteger(message.mask))
                    return "mask: integer expected";
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.hash != null && $Object.hasOwnProperty.call(message, "hash"))
                    if (!$util.isString(message.hash))
                        return "hash: string expected";
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    if (!$util.isString(message.reason))
                        return "reason: string expected";
                if (message.start != null && $Object.hasOwnProperty.call(message, "start"))
                    if (!$util.isString(message.start))
                        return "start: string expected";
                if (message.duration != null && $Object.hasOwnProperty.call(message, "duration"))
                    if (!$util.isInteger(message.duration))
                        return "duration: integer expected";
                return null;
            };

            BanEntry.fromObject = function (object, _depth) {
                if (object instanceof $root.MumbleProto.BanList.BanEntry)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".MumbleProto.BanList.BanEntry: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.MumbleProto.BanList.BanEntry();
                if (object.address != null)
                    if (typeof object.address === "string")
                        $util.base64.decode(object.address, message.address = $util.newBuffer($util.base64.length(object.address)), 0);
                    else if (object.address.length >= 0)
                        message.address = object.address;
                if (object.mask != null)
                    message.mask = object.mask >>> 0;
                if (object.name != null)
                    message.name = $String(object.name);
                if (object.hash != null)
                    message.hash = $String(object.hash);
                if (object.reason != null)
                    message.reason = $String(object.reason);
                if (object.start != null)
                    message.start = $String(object.start);
                if (object.duration != null)
                    message.duration = object.duration >>> 0;
                return message;
            };

            BanEntry.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    if (options.bytes === $String)
                        object.address = "";
                    else {
                        object.address = [];
                        if (options.bytes !== $Array)
                            object.address = $util.newBuffer(object.address);
                    }
                    object.mask = 0;
                    object.name = "";
                    object.hash = "";
                    object.reason = "";
                    object.start = "";
                    object.duration = 0;
                }
                if (message.address != null && $Object.hasOwnProperty.call(message, "address"))
                    object.address = options.bytes === $String ? $util.base64.encode(message.address, 0, message.address.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.address) : message.address;
                if (message.mask != null && $Object.hasOwnProperty.call(message, "mask"))
                    object.mask = message.mask;
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    object.name = message.name;
                if (message.hash != null && $Object.hasOwnProperty.call(message, "hash"))
                    object.hash = message.hash;
                if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                    object.reason = message.reason;
                if (message.start != null && $Object.hasOwnProperty.call(message, "start"))
                    object.start = message.start;
                if (message.duration != null && $Object.hasOwnProperty.call(message, "duration"))
                    object.duration = message.duration;
                return object;
            };

            BanEntry.prototype.toJSON = function() {
                return BanEntry.toObject(this, $protobuf.util.toJSONOptions);
            };

            BanEntry.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.BanList.BanEntry";
            };

            return BanEntry;
        })();

        return BanList;
    })();

    MumbleProto.TextMessage = (function() {

        const TextMessage = function (properties) {
            this.session = [];
            this.channelId = [];
            this.treeId = [];
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        TextMessage.prototype.actor = 0;
        TextMessage.prototype.session = $util.emptyArray;
        TextMessage.prototype.channelId = $util.emptyArray;
        TextMessage.prototype.treeId = $util.emptyArray;
        TextMessage.prototype.message = "";

        TextMessage.create = function(properties) {
            return new TextMessage(properties);
        };

        TextMessage.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.actor != null && $Object.hasOwnProperty.call(message, "actor"))
                writer.uint32(8).uint32(message.actor);
            if (message.session != null && message.session.length)
                for (let i = 0; i < message.session.length; ++i)
                    writer.uint32(16).uint32(message.session[i]);
            if (message.channelId != null && message.channelId.length)
                for (let i = 0; i < message.channelId.length; ++i)
                    writer.uint32(24).uint32(message.channelId[i]);
            if (message.treeId != null && message.treeId.length)
                for (let i = 0; i < message.treeId.length; ++i)
                    writer.uint32(32).uint32(message.treeId[i]);
            writer.uint32(42).string(message.message);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        TextMessage.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        TextMessage.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.TextMessage();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.actor = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType === 2) {
                            if (!(message.session && message.session.length))
                                message.session = [];
                            reader.uint32s(message.session);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.session && message.session.length))
                            message.session = [];
                        message.session.push(reader.uint32());
                        continue;
                    }
                case 3: {
                        if (wireType === 2) {
                            if (!(message.channelId && message.channelId.length))
                                message.channelId = [];
                            reader.uint32s(message.channelId);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.channelId && message.channelId.length))
                            message.channelId = [];
                        message.channelId.push(reader.uint32());
                        continue;
                    }
                case 4: {
                        if (wireType === 2) {
                            if (!(message.treeId && message.treeId.length))
                                message.treeId = [];
                            reader.uint32s(message.treeId);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.treeId && message.treeId.length))
                            message.treeId = [];
                        message.treeId.push(reader.uint32());
                        continue;
                    }
                case 5: {
                        if (wireType !== 2)
                            break;
                        message.message = reader.string();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            if (!$Object.hasOwnProperty.call(message, "message"))
                throw $util.ProtocolError("missing required 'message'", { instance: message });
            return message;
        };

        TextMessage.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        TextMessage.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.actor != null && $Object.hasOwnProperty.call(message, "actor"))
                if (!$util.isInteger(message.actor))
                    return "actor: integer expected";
            if (message.session != null && $Object.hasOwnProperty.call(message, "session")) {
                if (!$Array.isArray(message.session))
                    return "session: array expected";
                for (let i = 0; i < message.session.length; ++i)
                    if (!$util.isInteger(message.session[i]))
                        return "session: integer[] expected";
            }
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId")) {
                if (!$Array.isArray(message.channelId))
                    return "channelId: array expected";
                for (let i = 0; i < message.channelId.length; ++i)
                    if (!$util.isInteger(message.channelId[i]))
                        return "channelId: integer[] expected";
            }
            if (message.treeId != null && $Object.hasOwnProperty.call(message, "treeId")) {
                if (!$Array.isArray(message.treeId))
                    return "treeId: array expected";
                for (let i = 0; i < message.treeId.length; ++i)
                    if (!$util.isInteger(message.treeId[i]))
                        return "treeId: integer[] expected";
            }
            if (!$util.isString(message.message))
                return "message: string expected";
            return null;
        };

        TextMessage.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.TextMessage)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.TextMessage: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.TextMessage();
            if (object.actor != null)
                message.actor = object.actor >>> 0;
            if (object.session) {
                if (!$Array.isArray(object.session))
                    throw $TypeError(".MumbleProto.TextMessage.session: array expected");
                message.session = $Array(object.session.length);
                for (let i = 0; i < object.session.length; ++i)
                    message.session[i] = object.session[i] >>> 0;
            }
            if (object.channelId) {
                if (!$Array.isArray(object.channelId))
                    throw $TypeError(".MumbleProto.TextMessage.channelId: array expected");
                message.channelId = $Array(object.channelId.length);
                for (let i = 0; i < object.channelId.length; ++i)
                    message.channelId[i] = object.channelId[i] >>> 0;
            }
            if (object.treeId) {
                if (!$Array.isArray(object.treeId))
                    throw $TypeError(".MumbleProto.TextMessage.treeId: array expected");
                message.treeId = $Array(object.treeId.length);
                for (let i = 0; i < object.treeId.length; ++i)
                    message.treeId[i] = object.treeId[i] >>> 0;
            }
            if (object.message != null)
                message.message = $String(object.message);
            return message;
        };

        TextMessage.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults) {
                object.session = [];
                object.channelId = [];
                object.treeId = [];
            }
            if (options.defaults) {
                object.actor = 0;
                object.message = "";
            }
            if (message.actor != null && $Object.hasOwnProperty.call(message, "actor"))
                object.actor = message.actor;
            if (message.session && message.session.length) {
                object.session = $Array(message.session.length);
                for (let j = 0; j < message.session.length; ++j)
                    object.session[j] = message.session[j];
            }
            if (message.channelId && message.channelId.length) {
                object.channelId = $Array(message.channelId.length);
                for (let j = 0; j < message.channelId.length; ++j)
                    object.channelId[j] = message.channelId[j];
            }
            if (message.treeId && message.treeId.length) {
                object.treeId = $Array(message.treeId.length);
                for (let j = 0; j < message.treeId.length; ++j)
                    object.treeId[j] = message.treeId[j];
            }
            if (message.message != null && $Object.hasOwnProperty.call(message, "message"))
                object.message = message.message;
            return object;
        };

        TextMessage.prototype.toJSON = function() {
            return TextMessage.toObject(this, $protobuf.util.toJSONOptions);
        };

        TextMessage.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.TextMessage";
        };

        return TextMessage;
    })();

    MumbleProto.PermissionDenied = (function() {

        const PermissionDenied = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        PermissionDenied.prototype.permission = 0;
        PermissionDenied.prototype.channelId = 0;
        PermissionDenied.prototype.session = 0;
        PermissionDenied.prototype.reason = "";
        PermissionDenied.prototype.type = 0;
        PermissionDenied.prototype.name = "";

        PermissionDenied.create = function(properties) {
            return new PermissionDenied(properties);
        };

        PermissionDenied.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.permission != null && $Object.hasOwnProperty.call(message, "permission"))
                writer.uint32(8).uint32(message.permission);
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(16).uint32(message.channelId);
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                writer.uint32(24).uint32(message.session);
            if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                writer.uint32(34).string(message.reason);
            if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                writer.uint32(40).int32(message.type);
            if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                writer.uint32(50).string(message.name);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        PermissionDenied.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        PermissionDenied.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.PermissionDenied(), value;
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.permission = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.channelId = reader.uint32();
                        continue;
                    }
                case 3: {
                        if (wireType !== 0)
                            break;
                        message.session = reader.uint32();
                        continue;
                    }
                case 4: {
                        if (wireType !== 2)
                            break;
                        message.reason = reader.string();
                        continue;
                    }
                case 5: {
                        if (wireType !== 0)
                            break;
                        value = reader.int32();
                        if ($root.MumbleProto.PermissionDenied.DenyType[value] !== $undefined)
                            message.type = value;
                        else if (!reader.discardUnknown) {
                            $util.makeProp(message, "$unknowns", false);
                            (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                        }
                        continue;
                    }
                case 6: {
                        if (wireType !== 2)
                            break;
                        message.name = reader.string();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        PermissionDenied.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        PermissionDenied.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.permission != null && $Object.hasOwnProperty.call(message, "permission"))
                if (!$util.isInteger(message.permission))
                    return "permission: integer expected";
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                if (!$util.isInteger(message.channelId))
                    return "channelId: integer expected";
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                if (!$util.isInteger(message.session))
                    return "session: integer expected";
            if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                if (!$util.isString(message.reason))
                    return "reason: string expected";
            if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                switch (message.type) {
                default:
                    return "type: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                case 8:
                case 9:
                case 10:
                    break;
                }
            if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            return null;
        };

        PermissionDenied.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.PermissionDenied)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.PermissionDenied: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.PermissionDenied();
            if (object.permission != null)
                message.permission = object.permission >>> 0;
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.reason != null)
                message.reason = $String(object.reason);
            switch (object.type) {
            case "Text":
            case 0:
                message.type = 0;
                break;
            case "Permission":
            case 1:
                message.type = 1;
                break;
            case "SuperUser":
            case 2:
                message.type = 2;
                break;
            case "ChannelName":
            case 3:
                message.type = 3;
                break;
            case "TextTooLong":
            case 4:
                message.type = 4;
                break;
            case "H9K":
            case 5:
                message.type = 5;
                break;
            case "TemporaryChannel":
            case 6:
                message.type = 6;
                break;
            case "MissingCertificate":
            case 7:
                message.type = 7;
                break;
            case "UserName":
            case 8:
                message.type = 8;
                break;
            case "ChannelFull":
            case 9:
                message.type = 9;
                break;
            case "NestingLimit":
            case 10:
                message.type = 10;
                break;
            default:
            }
            if (object.name != null)
                message.name = $String(object.name);
            return message;
        };

        PermissionDenied.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.permission = 0;
                object.channelId = 0;
                object.session = 0;
                object.reason = "";
                object.type = options.enums === $String ? "Text" : 0;
                object.name = "";
            }
            if (message.permission != null && $Object.hasOwnProperty.call(message, "permission"))
                object.permission = message.permission;
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                object.channelId = message.channelId;
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                object.session = message.session;
            if (message.reason != null && $Object.hasOwnProperty.call(message, "reason"))
                object.reason = message.reason;
            if (message.type != null && $Object.hasOwnProperty.call(message, "type"))
                object.type = options.enums === $String ? $root.MumbleProto.PermissionDenied.DenyType[message.type] === $undefined ? message.type : $root.MumbleProto.PermissionDenied.DenyType[message.type] : message.type;
            if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                object.name = message.name;
            return object;
        };

        PermissionDenied.prototype.toJSON = function() {
            return PermissionDenied.toObject(this, $protobuf.util.toJSONOptions);
        };

        PermissionDenied.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.PermissionDenied";
        };

        PermissionDenied.DenyType = (function() {
            const valuesById = $Object.create(null), values = $Object.create(valuesById);
            values[valuesById[0] = "Text"] = 0;
            values[valuesById[1] = "Permission"] = 1;
            values[valuesById[2] = "SuperUser"] = 2;
            values[valuesById[3] = "ChannelName"] = 3;
            values[valuesById[4] = "TextTooLong"] = 4;
            values[valuesById[5] = "H9K"] = 5;
            values[valuesById[6] = "TemporaryChannel"] = 6;
            values[valuesById[7] = "MissingCertificate"] = 7;
            values[valuesById[8] = "UserName"] = 8;
            values[valuesById[9] = "ChannelFull"] = 9;
            values[valuesById[10] = "NestingLimit"] = 10;
            return values;
        })();

        return PermissionDenied;
    })();

    MumbleProto.ACL = (function() {

        const ACL = function (properties) {
            this.groups = [];
            this.acls = [];
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        ACL.prototype.channelId = 0;
        ACL.prototype.inheritAcls = true;
        ACL.prototype.groups = $util.emptyArray;
        ACL.prototype.acls = $util.emptyArray;
        ACL.prototype.query = false;

        ACL.create = function(properties) {
            return new ACL(properties);
        };

        ACL.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            writer.uint32(8).uint32(message.channelId);
            if (message.inheritAcls != null && $Object.hasOwnProperty.call(message, "inheritAcls"))
                writer.uint32(16).bool(message.inheritAcls);
            if (message.groups != null && message.groups.length)
                for (let i = 0; i < message.groups.length; ++i)
                    $root.MumbleProto.ACL.ChanGroup.encode(message.groups[i], writer.uint32(26).fork(), _depth + 1).ldelim();
            if (message.acls != null && message.acls.length)
                for (let i = 0; i < message.acls.length; ++i)
                    $root.MumbleProto.ACL.ChanACL.encode(message.acls[i], writer.uint32(34).fork(), _depth + 1).ldelim();
            if (message.query != null && $Object.hasOwnProperty.call(message, "query"))
                writer.uint32(40).bool(message.query);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ACL.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        ACL.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ACL();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.channelId = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.inheritAcls = reader.bool();
                        continue;
                    }
                case 3: {
                        if (wireType !== 2)
                            break;
                        if (!(message.groups && message.groups.length))
                            message.groups = [];
                        message.groups.push($root.MumbleProto.ACL.ChanGroup.decode(reader, reader.uint32(), $undefined, _depth + 1));
                        continue;
                    }
                case 4: {
                        if (wireType !== 2)
                            break;
                        if (!(message.acls && message.acls.length))
                            message.acls = [];
                        message.acls.push($root.MumbleProto.ACL.ChanACL.decode(reader, reader.uint32(), $undefined, _depth + 1));
                        continue;
                    }
                case 5: {
                        if (wireType !== 0)
                            break;
                        message.query = reader.bool();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            if (!$Object.hasOwnProperty.call(message, "channelId"))
                throw $util.ProtocolError("missing required 'channelId'", { instance: message });
            return message;
        };

        ACL.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        ACL.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (!$util.isInteger(message.channelId))
                return "channelId: integer expected";
            if (message.inheritAcls != null && $Object.hasOwnProperty.call(message, "inheritAcls"))
                if (typeof message.inheritAcls !== "boolean")
                    return "inheritAcls: boolean expected";
            if (message.groups != null && $Object.hasOwnProperty.call(message, "groups")) {
                if (!$Array.isArray(message.groups))
                    return "groups: array expected";
                for (let i = 0; i < message.groups.length; ++i) {
                    let error = $root.MumbleProto.ACL.ChanGroup.verify(message.groups[i], _depth + 1);
                    if (error)
                        return "groups." + error;
                }
            }
            if (message.acls != null && $Object.hasOwnProperty.call(message, "acls")) {
                if (!$Array.isArray(message.acls))
                    return "acls: array expected";
                for (let i = 0; i < message.acls.length; ++i) {
                    let error = $root.MumbleProto.ACL.ChanACL.verify(message.acls[i], _depth + 1);
                    if (error)
                        return "acls." + error;
                }
            }
            if (message.query != null && $Object.hasOwnProperty.call(message, "query"))
                if (typeof message.query !== "boolean")
                    return "query: boolean expected";
            return null;
        };

        ACL.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.ACL)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.ACL: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.ACL();
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.inheritAcls != null)
                message.inheritAcls = $Boolean(object.inheritAcls);
            if (object.groups) {
                if (!$Array.isArray(object.groups))
                    throw $TypeError(".MumbleProto.ACL.groups: array expected");
                message.groups = $Array(object.groups.length);
                for (let i = 0; i < object.groups.length; ++i) {
                    if (!$util.isObject(object.groups[i]))
                        throw $TypeError(".MumbleProto.ACL.groups: object expected");
                    message.groups[i] = $root.MumbleProto.ACL.ChanGroup.fromObject(object.groups[i], _depth + 1);
                }
            }
            if (object.acls) {
                if (!$Array.isArray(object.acls))
                    throw $TypeError(".MumbleProto.ACL.acls: array expected");
                message.acls = $Array(object.acls.length);
                for (let i = 0; i < object.acls.length; ++i) {
                    if (!$util.isObject(object.acls[i]))
                        throw $TypeError(".MumbleProto.ACL.acls: object expected");
                    message.acls[i] = $root.MumbleProto.ACL.ChanACL.fromObject(object.acls[i], _depth + 1);
                }
            }
            if (object.query != null)
                message.query = $Boolean(object.query);
            return message;
        };

        ACL.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults) {
                object.groups = [];
                object.acls = [];
            }
            if (options.defaults) {
                object.channelId = 0;
                object.inheritAcls = true;
                object.query = false;
            }
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                object.channelId = message.channelId;
            if (message.inheritAcls != null && $Object.hasOwnProperty.call(message, "inheritAcls"))
                object.inheritAcls = message.inheritAcls;
            if (message.groups && message.groups.length) {
                object.groups = $Array(message.groups.length);
                for (let j = 0; j < message.groups.length; ++j)
                    object.groups[j] = $root.MumbleProto.ACL.ChanGroup.toObject(message.groups[j], options, _depth + 1);
            }
            if (message.acls && message.acls.length) {
                object.acls = $Array(message.acls.length);
                for (let j = 0; j < message.acls.length; ++j)
                    object.acls[j] = $root.MumbleProto.ACL.ChanACL.toObject(message.acls[j], options, _depth + 1);
            }
            if (message.query != null && $Object.hasOwnProperty.call(message, "query"))
                object.query = message.query;
            return object;
        };

        ACL.prototype.toJSON = function() {
            return ACL.toObject(this, $protobuf.util.toJSONOptions);
        };

        ACL.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ACL";
        };

        ACL.ChanGroup = (function() {

            const ChanGroup = function (properties) {
                this.add = [];
                this.remove = [];
                this.inheritedMembers = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            ChanGroup.prototype.name = "";
            ChanGroup.prototype.inherited = true;
            ChanGroup.prototype.inherit = true;
            ChanGroup.prototype.inheritable = true;
            ChanGroup.prototype.add = $util.emptyArray;
            ChanGroup.prototype.remove = $util.emptyArray;
            ChanGroup.prototype.inheritedMembers = $util.emptyArray;

            ChanGroup.create = function(properties) {
                return new ChanGroup(properties);
            };

            ChanGroup.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                writer.uint32(10).string(message.name);
                if (message.inherited != null && $Object.hasOwnProperty.call(message, "inherited"))
                    writer.uint32(16).bool(message.inherited);
                if (message.inherit != null && $Object.hasOwnProperty.call(message, "inherit"))
                    writer.uint32(24).bool(message.inherit);
                if (message.inheritable != null && $Object.hasOwnProperty.call(message, "inheritable"))
                    writer.uint32(32).bool(message.inheritable);
                if (message.add != null && message.add.length)
                    for (let i = 0; i < message.add.length; ++i)
                        writer.uint32(40).uint32(message.add[i]);
                if (message.remove != null && message.remove.length)
                    for (let i = 0; i < message.remove.length; ++i)
                        writer.uint32(48).uint32(message.remove[i]);
                if (message.inheritedMembers != null && message.inheritedMembers.length)
                    for (let i = 0; i < message.inheritedMembers.length; ++i)
                        writer.uint32(56).uint32(message.inheritedMembers[i]);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            ChanGroup.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            ChanGroup.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ACL.ChanGroup();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 2)
                                break;
                            message.name = reader.string();
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            message.inherited = reader.bool();
                            continue;
                        }
                    case 3: {
                            if (wireType !== 0)
                                break;
                            message.inherit = reader.bool();
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            message.inheritable = reader.bool();
                            continue;
                        }
                    case 5: {
                            if (wireType === 2) {
                                if (!(message.add && message.add.length))
                                    message.add = [];
                                reader.uint32s(message.add);
                                continue;
                            }
                            if (wireType !== 0)
                                break;
                            if (!(message.add && message.add.length))
                                message.add = [];
                            message.add.push(reader.uint32());
                            continue;
                        }
                    case 6: {
                            if (wireType === 2) {
                                if (!(message.remove && message.remove.length))
                                    message.remove = [];
                                reader.uint32s(message.remove);
                                continue;
                            }
                            if (wireType !== 0)
                                break;
                            if (!(message.remove && message.remove.length))
                                message.remove = [];
                            message.remove.push(reader.uint32());
                            continue;
                        }
                    case 7: {
                            if (wireType === 2) {
                                if (!(message.inheritedMembers && message.inheritedMembers.length))
                                    message.inheritedMembers = [];
                                reader.uint32s(message.inheritedMembers);
                                continue;
                            }
                            if (wireType !== 0)
                                break;
                            if (!(message.inheritedMembers && message.inheritedMembers.length))
                                message.inheritedMembers = [];
                            message.inheritedMembers.push(reader.uint32());
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                if (!$Object.hasOwnProperty.call(message, "name"))
                    throw $util.ProtocolError("missing required 'name'", { instance: message });
                return message;
            };

            ChanGroup.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            ChanGroup.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (!$util.isString(message.name))
                    return "name: string expected";
                if (message.inherited != null && $Object.hasOwnProperty.call(message, "inherited"))
                    if (typeof message.inherited !== "boolean")
                        return "inherited: boolean expected";
                if (message.inherit != null && $Object.hasOwnProperty.call(message, "inherit"))
                    if (typeof message.inherit !== "boolean")
                        return "inherit: boolean expected";
                if (message.inheritable != null && $Object.hasOwnProperty.call(message, "inheritable"))
                    if (typeof message.inheritable !== "boolean")
                        return "inheritable: boolean expected";
                if (message.add != null && $Object.hasOwnProperty.call(message, "add")) {
                    if (!$Array.isArray(message.add))
                        return "add: array expected";
                    for (let i = 0; i < message.add.length; ++i)
                        if (!$util.isInteger(message.add[i]))
                            return "add: integer[] expected";
                }
                if (message.remove != null && $Object.hasOwnProperty.call(message, "remove")) {
                    if (!$Array.isArray(message.remove))
                        return "remove: array expected";
                    for (let i = 0; i < message.remove.length; ++i)
                        if (!$util.isInteger(message.remove[i]))
                            return "remove: integer[] expected";
                }
                if (message.inheritedMembers != null && $Object.hasOwnProperty.call(message, "inheritedMembers")) {
                    if (!$Array.isArray(message.inheritedMembers))
                        return "inheritedMembers: array expected";
                    for (let i = 0; i < message.inheritedMembers.length; ++i)
                        if (!$util.isInteger(message.inheritedMembers[i]))
                            return "inheritedMembers: integer[] expected";
                }
                return null;
            };

            ChanGroup.fromObject = function (object, _depth) {
                if (object instanceof $root.MumbleProto.ACL.ChanGroup)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".MumbleProto.ACL.ChanGroup: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.MumbleProto.ACL.ChanGroup();
                if (object.name != null)
                    message.name = $String(object.name);
                if (object.inherited != null)
                    message.inherited = $Boolean(object.inherited);
                if (object.inherit != null)
                    message.inherit = $Boolean(object.inherit);
                if (object.inheritable != null)
                    message.inheritable = $Boolean(object.inheritable);
                if (object.add) {
                    if (!$Array.isArray(object.add))
                        throw $TypeError(".MumbleProto.ACL.ChanGroup.add: array expected");
                    message.add = $Array(object.add.length);
                    for (let i = 0; i < object.add.length; ++i)
                        message.add[i] = object.add[i] >>> 0;
                }
                if (object.remove) {
                    if (!$Array.isArray(object.remove))
                        throw $TypeError(".MumbleProto.ACL.ChanGroup.remove: array expected");
                    message.remove = $Array(object.remove.length);
                    for (let i = 0; i < object.remove.length; ++i)
                        message.remove[i] = object.remove[i] >>> 0;
                }
                if (object.inheritedMembers) {
                    if (!$Array.isArray(object.inheritedMembers))
                        throw $TypeError(".MumbleProto.ACL.ChanGroup.inheritedMembers: array expected");
                    message.inheritedMembers = $Array(object.inheritedMembers.length);
                    for (let i = 0; i < object.inheritedMembers.length; ++i)
                        message.inheritedMembers[i] = object.inheritedMembers[i] >>> 0;
                }
                return message;
            };

            ChanGroup.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults) {
                    object.add = [];
                    object.remove = [];
                    object.inheritedMembers = [];
                }
                if (options.defaults) {
                    object.name = "";
                    object.inherited = true;
                    object.inherit = true;
                    object.inheritable = true;
                }
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    object.name = message.name;
                if (message.inherited != null && $Object.hasOwnProperty.call(message, "inherited"))
                    object.inherited = message.inherited;
                if (message.inherit != null && $Object.hasOwnProperty.call(message, "inherit"))
                    object.inherit = message.inherit;
                if (message.inheritable != null && $Object.hasOwnProperty.call(message, "inheritable"))
                    object.inheritable = message.inheritable;
                if (message.add && message.add.length) {
                    object.add = $Array(message.add.length);
                    for (let j = 0; j < message.add.length; ++j)
                        object.add[j] = message.add[j];
                }
                if (message.remove && message.remove.length) {
                    object.remove = $Array(message.remove.length);
                    for (let j = 0; j < message.remove.length; ++j)
                        object.remove[j] = message.remove[j];
                }
                if (message.inheritedMembers && message.inheritedMembers.length) {
                    object.inheritedMembers = $Array(message.inheritedMembers.length);
                    for (let j = 0; j < message.inheritedMembers.length; ++j)
                        object.inheritedMembers[j] = message.inheritedMembers[j];
                }
                return object;
            };

            ChanGroup.prototype.toJSON = function() {
                return ChanGroup.toObject(this, $protobuf.util.toJSONOptions);
            };

            ChanGroup.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.ACL.ChanGroup";
            };

            return ChanGroup;
        })();

        ACL.ChanACL = (function() {

            const ChanACL = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            ChanACL.prototype.applyHere = true;
            ChanACL.prototype.applySubs = true;
            ChanACL.prototype.inherited = true;
            ChanACL.prototype.userId = 0;
            ChanACL.prototype.group = "";
            ChanACL.prototype.grant = 0;
            ChanACL.prototype.deny = 0;

            ChanACL.create = function(properties) {
                return new ChanACL(properties);
            };

            ChanACL.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.applyHere != null && $Object.hasOwnProperty.call(message, "applyHere"))
                    writer.uint32(8).bool(message.applyHere);
                if (message.applySubs != null && $Object.hasOwnProperty.call(message, "applySubs"))
                    writer.uint32(16).bool(message.applySubs);
                if (message.inherited != null && $Object.hasOwnProperty.call(message, "inherited"))
                    writer.uint32(24).bool(message.inherited);
                if (message.userId != null && $Object.hasOwnProperty.call(message, "userId"))
                    writer.uint32(32).uint32(message.userId);
                if (message.group != null && $Object.hasOwnProperty.call(message, "group"))
                    writer.uint32(42).string(message.group);
                if (message.grant != null && $Object.hasOwnProperty.call(message, "grant"))
                    writer.uint32(48).uint32(message.grant);
                if (message.deny != null && $Object.hasOwnProperty.call(message, "deny"))
                    writer.uint32(56).uint32(message.deny);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            ChanACL.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            ChanACL.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ACL.ChanACL();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            message.applyHere = reader.bool();
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            message.applySubs = reader.bool();
                            continue;
                        }
                    case 3: {
                            if (wireType !== 0)
                                break;
                            message.inherited = reader.bool();
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            message.userId = reader.uint32();
                            continue;
                        }
                    case 5: {
                            if (wireType !== 2)
                                break;
                            message.group = reader.string();
                            continue;
                        }
                    case 6: {
                            if (wireType !== 0)
                                break;
                            message.grant = reader.uint32();
                            continue;
                        }
                    case 7: {
                            if (wireType !== 0)
                                break;
                            message.deny = reader.uint32();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            ChanACL.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            ChanACL.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.applyHere != null && $Object.hasOwnProperty.call(message, "applyHere"))
                    if (typeof message.applyHere !== "boolean")
                        return "applyHere: boolean expected";
                if (message.applySubs != null && $Object.hasOwnProperty.call(message, "applySubs"))
                    if (typeof message.applySubs !== "boolean")
                        return "applySubs: boolean expected";
                if (message.inherited != null && $Object.hasOwnProperty.call(message, "inherited"))
                    if (typeof message.inherited !== "boolean")
                        return "inherited: boolean expected";
                if (message.userId != null && $Object.hasOwnProperty.call(message, "userId"))
                    if (!$util.isInteger(message.userId))
                        return "userId: integer expected";
                if (message.group != null && $Object.hasOwnProperty.call(message, "group"))
                    if (!$util.isString(message.group))
                        return "group: string expected";
                if (message.grant != null && $Object.hasOwnProperty.call(message, "grant"))
                    if (!$util.isInteger(message.grant))
                        return "grant: integer expected";
                if (message.deny != null && $Object.hasOwnProperty.call(message, "deny"))
                    if (!$util.isInteger(message.deny))
                        return "deny: integer expected";
                return null;
            };

            ChanACL.fromObject = function (object, _depth) {
                if (object instanceof $root.MumbleProto.ACL.ChanACL)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".MumbleProto.ACL.ChanACL: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.MumbleProto.ACL.ChanACL();
                if (object.applyHere != null)
                    message.applyHere = $Boolean(object.applyHere);
                if (object.applySubs != null)
                    message.applySubs = $Boolean(object.applySubs);
                if (object.inherited != null)
                    message.inherited = $Boolean(object.inherited);
                if (object.userId != null)
                    message.userId = object.userId >>> 0;
                if (object.group != null)
                    message.group = $String(object.group);
                if (object.grant != null)
                    message.grant = object.grant >>> 0;
                if (object.deny != null)
                    message.deny = object.deny >>> 0;
                return message;
            };

            ChanACL.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.applyHere = true;
                    object.applySubs = true;
                    object.inherited = true;
                    object.userId = 0;
                    object.group = "";
                    object.grant = 0;
                    object.deny = 0;
                }
                if (message.applyHere != null && $Object.hasOwnProperty.call(message, "applyHere"))
                    object.applyHere = message.applyHere;
                if (message.applySubs != null && $Object.hasOwnProperty.call(message, "applySubs"))
                    object.applySubs = message.applySubs;
                if (message.inherited != null && $Object.hasOwnProperty.call(message, "inherited"))
                    object.inherited = message.inherited;
                if (message.userId != null && $Object.hasOwnProperty.call(message, "userId"))
                    object.userId = message.userId;
                if (message.group != null && $Object.hasOwnProperty.call(message, "group"))
                    object.group = message.group;
                if (message.grant != null && $Object.hasOwnProperty.call(message, "grant"))
                    object.grant = message.grant;
                if (message.deny != null && $Object.hasOwnProperty.call(message, "deny"))
                    object.deny = message.deny;
                return object;
            };

            ChanACL.prototype.toJSON = function() {
                return ChanACL.toObject(this, $protobuf.util.toJSONOptions);
            };

            ChanACL.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.ACL.ChanACL";
            };

            return ChanACL;
        })();

        return ACL;
    })();

    MumbleProto.QueryUsers = (function() {

        const QueryUsers = function (properties) {
            this.ids = [];
            this.names = [];
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        QueryUsers.prototype.ids = $util.emptyArray;
        QueryUsers.prototype.names = $util.emptyArray;

        QueryUsers.create = function(properties) {
            return new QueryUsers(properties);
        };

        QueryUsers.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.ids != null && message.ids.length)
                for (let i = 0; i < message.ids.length; ++i)
                    writer.uint32(8).uint32(message.ids[i]);
            if (message.names != null && message.names.length)
                for (let i = 0; i < message.names.length; ++i)
                    writer.uint32(18).string(message.names[i]);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        QueryUsers.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        QueryUsers.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.QueryUsers();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType === 2) {
                            if (!(message.ids && message.ids.length))
                                message.ids = [];
                            reader.uint32s(message.ids);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.ids && message.ids.length))
                            message.ids = [];
                        message.ids.push(reader.uint32());
                        continue;
                    }
                case 2: {
                        if (wireType !== 2)
                            break;
                        if (!(message.names && message.names.length))
                            message.names = [];
                        message.names.push(reader.string());
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        QueryUsers.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        QueryUsers.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.ids != null && $Object.hasOwnProperty.call(message, "ids")) {
                if (!$Array.isArray(message.ids))
                    return "ids: array expected";
                for (let i = 0; i < message.ids.length; ++i)
                    if (!$util.isInteger(message.ids[i]))
                        return "ids: integer[] expected";
            }
            if (message.names != null && $Object.hasOwnProperty.call(message, "names")) {
                if (!$Array.isArray(message.names))
                    return "names: array expected";
                for (let i = 0; i < message.names.length; ++i)
                    if (!$util.isString(message.names[i]))
                        return "names: string[] expected";
            }
            return null;
        };

        QueryUsers.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.QueryUsers)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.QueryUsers: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.QueryUsers();
            if (object.ids) {
                if (!$Array.isArray(object.ids))
                    throw $TypeError(".MumbleProto.QueryUsers.ids: array expected");
                message.ids = $Array(object.ids.length);
                for (let i = 0; i < object.ids.length; ++i)
                    message.ids[i] = object.ids[i] >>> 0;
            }
            if (object.names) {
                if (!$Array.isArray(object.names))
                    throw $TypeError(".MumbleProto.QueryUsers.names: array expected");
                message.names = $Array(object.names.length);
                for (let i = 0; i < object.names.length; ++i)
                    message.names[i] = $String(object.names[i]);
            }
            return message;
        };

        QueryUsers.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults) {
                object.ids = [];
                object.names = [];
            }
            if (message.ids && message.ids.length) {
                object.ids = $Array(message.ids.length);
                for (let j = 0; j < message.ids.length; ++j)
                    object.ids[j] = message.ids[j];
            }
            if (message.names && message.names.length) {
                object.names = $Array(message.names.length);
                for (let j = 0; j < message.names.length; ++j)
                    object.names[j] = message.names[j];
            }
            return object;
        };

        QueryUsers.prototype.toJSON = function() {
            return QueryUsers.toObject(this, $protobuf.util.toJSONOptions);
        };

        QueryUsers.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.QueryUsers";
        };

        return QueryUsers;
    })();

    MumbleProto.CryptSetup = (function() {

        const CryptSetup = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        CryptSetup.prototype.key = $util.newBuffer([]);
        CryptSetup.prototype.clientNonce = $util.newBuffer([]);
        CryptSetup.prototype.serverNonce = $util.newBuffer([]);

        CryptSetup.create = function(properties) {
            return new CryptSetup(properties);
        };

        CryptSetup.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.key != null && $Object.hasOwnProperty.call(message, "key"))
                writer.uint32(10).bytes(message.key);
            if (message.clientNonce != null && $Object.hasOwnProperty.call(message, "clientNonce"))
                writer.uint32(18).bytes(message.clientNonce);
            if (message.serverNonce != null && $Object.hasOwnProperty.call(message, "serverNonce"))
                writer.uint32(26).bytes(message.serverNonce);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        CryptSetup.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        CryptSetup.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.CryptSetup();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 2)
                            break;
                        message.key = reader.bytes();
                        continue;
                    }
                case 2: {
                        if (wireType !== 2)
                            break;
                        message.clientNonce = reader.bytes();
                        continue;
                    }
                case 3: {
                        if (wireType !== 2)
                            break;
                        message.serverNonce = reader.bytes();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        CryptSetup.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        CryptSetup.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.key != null && $Object.hasOwnProperty.call(message, "key"))
                if (!(message.key && typeof message.key.length === "number" || $util.isString(message.key)))
                    return "key: buffer expected";
            if (message.clientNonce != null && $Object.hasOwnProperty.call(message, "clientNonce"))
                if (!(message.clientNonce && typeof message.clientNonce.length === "number" || $util.isString(message.clientNonce)))
                    return "clientNonce: buffer expected";
            if (message.serverNonce != null && $Object.hasOwnProperty.call(message, "serverNonce"))
                if (!(message.serverNonce && typeof message.serverNonce.length === "number" || $util.isString(message.serverNonce)))
                    return "serverNonce: buffer expected";
            return null;
        };

        CryptSetup.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.CryptSetup)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.CryptSetup: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.CryptSetup();
            if (object.key != null)
                if (typeof object.key === "string")
                    $util.base64.decode(object.key, message.key = $util.newBuffer($util.base64.length(object.key)), 0);
                else if (object.key.length >= 0)
                    message.key = object.key;
            if (object.clientNonce != null)
                if (typeof object.clientNonce === "string")
                    $util.base64.decode(object.clientNonce, message.clientNonce = $util.newBuffer($util.base64.length(object.clientNonce)), 0);
                else if (object.clientNonce.length >= 0)
                    message.clientNonce = object.clientNonce;
            if (object.serverNonce != null)
                if (typeof object.serverNonce === "string")
                    $util.base64.decode(object.serverNonce, message.serverNonce = $util.newBuffer($util.base64.length(object.serverNonce)), 0);
                else if (object.serverNonce.length >= 0)
                    message.serverNonce = object.serverNonce;
            return message;
        };

        CryptSetup.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                if (options.bytes === $String)
                    object.key = "";
                else {
                    object.key = [];
                    if (options.bytes !== $Array)
                        object.key = $util.newBuffer(object.key);
                }
                if (options.bytes === $String)
                    object.clientNonce = "";
                else {
                    object.clientNonce = [];
                    if (options.bytes !== $Array)
                        object.clientNonce = $util.newBuffer(object.clientNonce);
                }
                if (options.bytes === $String)
                    object.serverNonce = "";
                else {
                    object.serverNonce = [];
                    if (options.bytes !== $Array)
                        object.serverNonce = $util.newBuffer(object.serverNonce);
                }
            }
            if (message.key != null && $Object.hasOwnProperty.call(message, "key"))
                object.key = options.bytes === $String ? $util.base64.encode(message.key, 0, message.key.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.key) : message.key;
            if (message.clientNonce != null && $Object.hasOwnProperty.call(message, "clientNonce"))
                object.clientNonce = options.bytes === $String ? $util.base64.encode(message.clientNonce, 0, message.clientNonce.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.clientNonce) : message.clientNonce;
            if (message.serverNonce != null && $Object.hasOwnProperty.call(message, "serverNonce"))
                object.serverNonce = options.bytes === $String ? $util.base64.encode(message.serverNonce, 0, message.serverNonce.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.serverNonce) : message.serverNonce;
            return object;
        };

        CryptSetup.prototype.toJSON = function() {
            return CryptSetup.toObject(this, $protobuf.util.toJSONOptions);
        };

        CryptSetup.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.CryptSetup";
        };

        return CryptSetup;
    })();

    MumbleProto.ContextActionModify = (function() {

        const ContextActionModify = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        ContextActionModify.prototype.action = "";
        ContextActionModify.prototype.text = "";
        ContextActionModify.prototype.context = 0;
        ContextActionModify.prototype.operation = 0;

        ContextActionModify.create = function(properties) {
            return new ContextActionModify(properties);
        };

        ContextActionModify.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            writer.uint32(10).string(message.action);
            if (message.text != null && $Object.hasOwnProperty.call(message, "text"))
                writer.uint32(18).string(message.text);
            if (message.context != null && $Object.hasOwnProperty.call(message, "context"))
                writer.uint32(24).uint32(message.context);
            if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                writer.uint32(32).int32(message.operation);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ContextActionModify.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        ContextActionModify.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ContextActionModify(), value;
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 2)
                            break;
                        message.action = reader.string();
                        continue;
                    }
                case 2: {
                        if (wireType !== 2)
                            break;
                        message.text = reader.string();
                        continue;
                    }
                case 3: {
                        if (wireType !== 0)
                            break;
                        message.context = reader.uint32();
                        continue;
                    }
                case 4: {
                        if (wireType !== 0)
                            break;
                        value = reader.int32();
                        if ($root.MumbleProto.ContextActionModify.Operation[value] !== $undefined)
                            message.operation = value;
                        else if (!reader.discardUnknown) {
                            $util.makeProp(message, "$unknowns", false);
                            (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                        }
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            if (!$Object.hasOwnProperty.call(message, "action"))
                throw $util.ProtocolError("missing required 'action'", { instance: message });
            return message;
        };

        ContextActionModify.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        ContextActionModify.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (!$util.isString(message.action))
                return "action: string expected";
            if (message.text != null && $Object.hasOwnProperty.call(message, "text"))
                if (!$util.isString(message.text))
                    return "text: string expected";
            if (message.context != null && $Object.hasOwnProperty.call(message, "context"))
                if (!$util.isInteger(message.context))
                    return "context: integer expected";
            if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                switch (message.operation) {
                default:
                    return "operation: enum value expected";
                case 0:
                case 1:
                    break;
                }
            return null;
        };

        ContextActionModify.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.ContextActionModify)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.ContextActionModify: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.ContextActionModify();
            if (object.action != null)
                message.action = $String(object.action);
            if (object.text != null)
                message.text = $String(object.text);
            if (object.context != null)
                message.context = object.context >>> 0;
            switch (object.operation) {
            case "Add":
            case 0:
                message.operation = 0;
                break;
            case "Remove":
            case 1:
                message.operation = 1;
                break;
            default:
            }
            return message;
        };

        ContextActionModify.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.action = "";
                object.text = "";
                object.context = 0;
                object.operation = options.enums === $String ? "Add" : 0;
            }
            if (message.action != null && $Object.hasOwnProperty.call(message, "action"))
                object.action = message.action;
            if (message.text != null && $Object.hasOwnProperty.call(message, "text"))
                object.text = message.text;
            if (message.context != null && $Object.hasOwnProperty.call(message, "context"))
                object.context = message.context;
            if (message.operation != null && $Object.hasOwnProperty.call(message, "operation"))
                object.operation = options.enums === $String ? $root.MumbleProto.ContextActionModify.Operation[message.operation] === $undefined ? message.operation : $root.MumbleProto.ContextActionModify.Operation[message.operation] : message.operation;
            return object;
        };

        ContextActionModify.prototype.toJSON = function() {
            return ContextActionModify.toObject(this, $protobuf.util.toJSONOptions);
        };

        ContextActionModify.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ContextActionModify";
        };

        ContextActionModify.Context = (function() {
            const valuesById = $Object.create(null), values = $Object.create(valuesById);
            values[valuesById[1] = "Server"] = 1;
            values[valuesById[2] = "Channel"] = 2;
            values[valuesById[4] = "User"] = 4;
            return values;
        })();

        ContextActionModify.Operation = (function() {
            const valuesById = $Object.create(null), values = $Object.create(valuesById);
            values[valuesById[0] = "Add"] = 0;
            values[valuesById[1] = "Remove"] = 1;
            return values;
        })();

        return ContextActionModify;
    })();

    MumbleProto.ContextAction = (function() {

        const ContextAction = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        ContextAction.prototype.session = 0;
        ContextAction.prototype.channelId = 0;
        ContextAction.prototype.action = "";

        ContextAction.create = function(properties) {
            return new ContextAction(properties);
        };

        ContextAction.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                writer.uint32(8).uint32(message.session);
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(16).uint32(message.channelId);
            writer.uint32(26).string(message.action);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ContextAction.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        ContextAction.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ContextAction();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.session = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.channelId = reader.uint32();
                        continue;
                    }
                case 3: {
                        if (wireType !== 2)
                            break;
                        message.action = reader.string();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            if (!$Object.hasOwnProperty.call(message, "action"))
                throw $util.ProtocolError("missing required 'action'", { instance: message });
            return message;
        };

        ContextAction.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        ContextAction.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                if (!$util.isInteger(message.session))
                    return "session: integer expected";
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                if (!$util.isInteger(message.channelId))
                    return "channelId: integer expected";
            if (!$util.isString(message.action))
                return "action: string expected";
            return null;
        };

        ContextAction.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.ContextAction)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.ContextAction: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.ContextAction();
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.action != null)
                message.action = $String(object.action);
            return message;
        };

        ContextAction.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.session = 0;
                object.channelId = 0;
                object.action = "";
            }
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                object.session = message.session;
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                object.channelId = message.channelId;
            if (message.action != null && $Object.hasOwnProperty.call(message, "action"))
                object.action = message.action;
            return object;
        };

        ContextAction.prototype.toJSON = function() {
            return ContextAction.toObject(this, $protobuf.util.toJSONOptions);
        };

        ContextAction.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ContextAction";
        };

        return ContextAction;
    })();

    MumbleProto.UserList = (function() {

        const UserList = function (properties) {
            this.users = [];
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        UserList.prototype.users = $util.emptyArray;

        UserList.create = function(properties) {
            return new UserList(properties);
        };

        UserList.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.users != null && message.users.length)
                for (let i = 0; i < message.users.length; ++i)
                    $root.MumbleProto.UserList.User.encode(message.users[i], writer.uint32(10).fork(), _depth + 1).ldelim();
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        UserList.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        UserList.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserList();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 2)
                            break;
                        if (!(message.users && message.users.length))
                            message.users = [];
                        message.users.push($root.MumbleProto.UserList.User.decode(reader, reader.uint32(), $undefined, _depth + 1));
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        UserList.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        UserList.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.users != null && $Object.hasOwnProperty.call(message, "users")) {
                if (!$Array.isArray(message.users))
                    return "users: array expected";
                for (let i = 0; i < message.users.length; ++i) {
                    let error = $root.MumbleProto.UserList.User.verify(message.users[i], _depth + 1);
                    if (error)
                        return "users." + error;
                }
            }
            return null;
        };

        UserList.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.UserList)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.UserList: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.UserList();
            if (object.users) {
                if (!$Array.isArray(object.users))
                    throw $TypeError(".MumbleProto.UserList.users: array expected");
                message.users = $Array(object.users.length);
                for (let i = 0; i < object.users.length; ++i) {
                    if (!$util.isObject(object.users[i]))
                        throw $TypeError(".MumbleProto.UserList.users: object expected");
                    message.users[i] = $root.MumbleProto.UserList.User.fromObject(object.users[i], _depth + 1);
                }
            }
            return message;
        };

        UserList.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults)
                object.users = [];
            if (message.users && message.users.length) {
                object.users = $Array(message.users.length);
                for (let j = 0; j < message.users.length; ++j)
                    object.users[j] = $root.MumbleProto.UserList.User.toObject(message.users[j], options, _depth + 1);
            }
            return object;
        };

        UserList.prototype.toJSON = function() {
            return UserList.toObject(this, $protobuf.util.toJSONOptions);
        };

        UserList.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.UserList";
        };

        UserList.User = (function() {

            const User = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            User.prototype.userId = 0;
            User.prototype.name = "";
            User.prototype.lastSeen = "";
            User.prototype.lastChannel = 0;

            User.create = function(properties) {
                return new User(properties);
            };

            User.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                writer.uint32(8).uint32(message.userId);
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    writer.uint32(18).string(message.name);
                if (message.lastSeen != null && $Object.hasOwnProperty.call(message, "lastSeen"))
                    writer.uint32(26).string(message.lastSeen);
                if (message.lastChannel != null && $Object.hasOwnProperty.call(message, "lastChannel"))
                    writer.uint32(32).uint32(message.lastChannel);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            User.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            User.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserList.User();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            message.userId = reader.uint32();
                            continue;
                        }
                    case 2: {
                            if (wireType !== 2)
                                break;
                            message.name = reader.string();
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.lastSeen = reader.string();
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            message.lastChannel = reader.uint32();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                if (!$Object.hasOwnProperty.call(message, "userId"))
                    throw $util.ProtocolError("missing required 'userId'", { instance: message });
                return message;
            };

            User.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            User.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (!$util.isInteger(message.userId))
                    return "userId: integer expected";
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    if (!$util.isString(message.name))
                        return "name: string expected";
                if (message.lastSeen != null && $Object.hasOwnProperty.call(message, "lastSeen"))
                    if (!$util.isString(message.lastSeen))
                        return "lastSeen: string expected";
                if (message.lastChannel != null && $Object.hasOwnProperty.call(message, "lastChannel"))
                    if (!$util.isInteger(message.lastChannel))
                        return "lastChannel: integer expected";
                return null;
            };

            User.fromObject = function (object, _depth) {
                if (object instanceof $root.MumbleProto.UserList.User)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".MumbleProto.UserList.User: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.MumbleProto.UserList.User();
                if (object.userId != null)
                    message.userId = object.userId >>> 0;
                if (object.name != null)
                    message.name = $String(object.name);
                if (object.lastSeen != null)
                    message.lastSeen = $String(object.lastSeen);
                if (object.lastChannel != null)
                    message.lastChannel = object.lastChannel >>> 0;
                return message;
            };

            User.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.userId = 0;
                    object.name = "";
                    object.lastSeen = "";
                    object.lastChannel = 0;
                }
                if (message.userId != null && $Object.hasOwnProperty.call(message, "userId"))
                    object.userId = message.userId;
                if (message.name != null && $Object.hasOwnProperty.call(message, "name"))
                    object.name = message.name;
                if (message.lastSeen != null && $Object.hasOwnProperty.call(message, "lastSeen"))
                    object.lastSeen = message.lastSeen;
                if (message.lastChannel != null && $Object.hasOwnProperty.call(message, "lastChannel"))
                    object.lastChannel = message.lastChannel;
                return object;
            };

            User.prototype.toJSON = function() {
                return User.toObject(this, $protobuf.util.toJSONOptions);
            };

            User.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.UserList.User";
            };

            return User;
        })();

        return UserList;
    })();

    MumbleProto.VoiceTarget = (function() {

        const VoiceTarget = function (properties) {
            this.targets = [];
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        VoiceTarget.prototype.id = 0;
        VoiceTarget.prototype.targets = $util.emptyArray;

        VoiceTarget.create = function(properties) {
            return new VoiceTarget(properties);
        };

        VoiceTarget.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                writer.uint32(8).uint32(message.id);
            if (message.targets != null && message.targets.length)
                for (let i = 0; i < message.targets.length; ++i)
                    $root.MumbleProto.VoiceTarget.Target.encode(message.targets[i], writer.uint32(18).fork(), _depth + 1).ldelim();
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        VoiceTarget.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        VoiceTarget.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.VoiceTarget();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.id = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 2)
                            break;
                        if (!(message.targets && message.targets.length))
                            message.targets = [];
                        message.targets.push($root.MumbleProto.VoiceTarget.Target.decode(reader, reader.uint32(), $undefined, _depth + 1));
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        VoiceTarget.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        VoiceTarget.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                if (!$util.isInteger(message.id))
                    return "id: integer expected";
            if (message.targets != null && $Object.hasOwnProperty.call(message, "targets")) {
                if (!$Array.isArray(message.targets))
                    return "targets: array expected";
                for (let i = 0; i < message.targets.length; ++i) {
                    let error = $root.MumbleProto.VoiceTarget.Target.verify(message.targets[i], _depth + 1);
                    if (error)
                        return "targets." + error;
                }
            }
            return null;
        };

        VoiceTarget.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.VoiceTarget)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.VoiceTarget: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.VoiceTarget();
            if (object.id != null)
                message.id = object.id >>> 0;
            if (object.targets) {
                if (!$Array.isArray(object.targets))
                    throw $TypeError(".MumbleProto.VoiceTarget.targets: array expected");
                message.targets = $Array(object.targets.length);
                for (let i = 0; i < object.targets.length; ++i) {
                    if (!$util.isObject(object.targets[i]))
                        throw $TypeError(".MumbleProto.VoiceTarget.targets: object expected");
                    message.targets[i] = $root.MumbleProto.VoiceTarget.Target.fromObject(object.targets[i], _depth + 1);
                }
            }
            return message;
        };

        VoiceTarget.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults)
                object.targets = [];
            if (options.defaults)
                object.id = 0;
            if (message.id != null && $Object.hasOwnProperty.call(message, "id"))
                object.id = message.id;
            if (message.targets && message.targets.length) {
                object.targets = $Array(message.targets.length);
                for (let j = 0; j < message.targets.length; ++j)
                    object.targets[j] = $root.MumbleProto.VoiceTarget.Target.toObject(message.targets[j], options, _depth + 1);
            }
            return object;
        };

        VoiceTarget.prototype.toJSON = function() {
            return VoiceTarget.toObject(this, $protobuf.util.toJSONOptions);
        };

        VoiceTarget.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.VoiceTarget";
        };

        VoiceTarget.Target = (function() {

            const Target = function (properties) {
                this.session = [];
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            Target.prototype.session = $util.emptyArray;
            Target.prototype.channelId = 0;
            Target.prototype.group = "";
            Target.prototype.links = false;
            Target.prototype.children = false;

            Target.create = function(properties) {
                return new Target(properties);
            };

            Target.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.session != null && message.session.length)
                    for (let i = 0; i < message.session.length; ++i)
                        writer.uint32(8).uint32(message.session[i]);
                if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                    writer.uint32(16).uint32(message.channelId);
                if (message.group != null && $Object.hasOwnProperty.call(message, "group"))
                    writer.uint32(26).string(message.group);
                if (message.links != null && $Object.hasOwnProperty.call(message, "links"))
                    writer.uint32(32).bool(message.links);
                if (message.children != null && $Object.hasOwnProperty.call(message, "children"))
                    writer.uint32(40).bool(message.children);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            Target.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            Target.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.VoiceTarget.Target();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType === 2) {
                                if (!(message.session && message.session.length))
                                    message.session = [];
                                reader.uint32s(message.session);
                                continue;
                            }
                            if (wireType !== 0)
                                break;
                            if (!(message.session && message.session.length))
                                message.session = [];
                            message.session.push(reader.uint32());
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            message.channelId = reader.uint32();
                            continue;
                        }
                    case 3: {
                            if (wireType !== 2)
                                break;
                            message.group = reader.string();
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            message.links = reader.bool();
                            continue;
                        }
                    case 5: {
                            if (wireType !== 0)
                                break;
                            message.children = reader.bool();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            Target.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            Target.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.session != null && $Object.hasOwnProperty.call(message, "session")) {
                    if (!$Array.isArray(message.session))
                        return "session: array expected";
                    for (let i = 0; i < message.session.length; ++i)
                        if (!$util.isInteger(message.session[i]))
                            return "session: integer[] expected";
                }
                if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                    if (!$util.isInteger(message.channelId))
                        return "channelId: integer expected";
                if (message.group != null && $Object.hasOwnProperty.call(message, "group"))
                    if (!$util.isString(message.group))
                        return "group: string expected";
                if (message.links != null && $Object.hasOwnProperty.call(message, "links"))
                    if (typeof message.links !== "boolean")
                        return "links: boolean expected";
                if (message.children != null && $Object.hasOwnProperty.call(message, "children"))
                    if (typeof message.children !== "boolean")
                        return "children: boolean expected";
                return null;
            };

            Target.fromObject = function (object, _depth) {
                if (object instanceof $root.MumbleProto.VoiceTarget.Target)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".MumbleProto.VoiceTarget.Target: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.MumbleProto.VoiceTarget.Target();
                if (object.session) {
                    if (!$Array.isArray(object.session))
                        throw $TypeError(".MumbleProto.VoiceTarget.Target.session: array expected");
                    message.session = $Array(object.session.length);
                    for (let i = 0; i < object.session.length; ++i)
                        message.session[i] = object.session[i] >>> 0;
                }
                if (object.channelId != null)
                    message.channelId = object.channelId >>> 0;
                if (object.group != null)
                    message.group = $String(object.group);
                if (object.links != null)
                    message.links = $Boolean(object.links);
                if (object.children != null)
                    message.children = $Boolean(object.children);
                return message;
            };

            Target.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.arrays || options.defaults)
                    object.session = [];
                if (options.defaults) {
                    object.channelId = 0;
                    object.group = "";
                    object.links = false;
                    object.children = false;
                }
                if (message.session && message.session.length) {
                    object.session = $Array(message.session.length);
                    for (let j = 0; j < message.session.length; ++j)
                        object.session[j] = message.session[j];
                }
                if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                    object.channelId = message.channelId;
                if (message.group != null && $Object.hasOwnProperty.call(message, "group"))
                    object.group = message.group;
                if (message.links != null && $Object.hasOwnProperty.call(message, "links"))
                    object.links = message.links;
                if (message.children != null && $Object.hasOwnProperty.call(message, "children"))
                    object.children = message.children;
                return object;
            };

            Target.prototype.toJSON = function() {
                return Target.toObject(this, $protobuf.util.toJSONOptions);
            };

            Target.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.VoiceTarget.Target";
            };

            return Target;
        })();

        return VoiceTarget;
    })();

    MumbleProto.PermissionQuery = (function() {

        const PermissionQuery = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        PermissionQuery.prototype.channelId = 0;
        PermissionQuery.prototype.permissions = 0;
        PermissionQuery.prototype.flush = false;

        PermissionQuery.create = function(properties) {
            return new PermissionQuery(properties);
        };

        PermissionQuery.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(8).uint32(message.channelId);
            if (message.permissions != null && $Object.hasOwnProperty.call(message, "permissions"))
                writer.uint32(16).uint32(message.permissions);
            if (message.flush != null && $Object.hasOwnProperty.call(message, "flush"))
                writer.uint32(24).bool(message.flush);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        PermissionQuery.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        PermissionQuery.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.PermissionQuery();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.channelId = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.permissions = reader.uint32();
                        continue;
                    }
                case 3: {
                        if (wireType !== 0)
                            break;
                        message.flush = reader.bool();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        PermissionQuery.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        PermissionQuery.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                if (!$util.isInteger(message.channelId))
                    return "channelId: integer expected";
            if (message.permissions != null && $Object.hasOwnProperty.call(message, "permissions"))
                if (!$util.isInteger(message.permissions))
                    return "permissions: integer expected";
            if (message.flush != null && $Object.hasOwnProperty.call(message, "flush"))
                if (typeof message.flush !== "boolean")
                    return "flush: boolean expected";
            return null;
        };

        PermissionQuery.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.PermissionQuery)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.PermissionQuery: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.PermissionQuery();
            if (object.channelId != null)
                message.channelId = object.channelId >>> 0;
            if (object.permissions != null)
                message.permissions = object.permissions >>> 0;
            if (object.flush != null)
                message.flush = $Boolean(object.flush);
            return message;
        };

        PermissionQuery.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.channelId = 0;
                object.permissions = 0;
                object.flush = false;
            }
            if (message.channelId != null && $Object.hasOwnProperty.call(message, "channelId"))
                object.channelId = message.channelId;
            if (message.permissions != null && $Object.hasOwnProperty.call(message, "permissions"))
                object.permissions = message.permissions;
            if (message.flush != null && $Object.hasOwnProperty.call(message, "flush"))
                object.flush = message.flush;
            return object;
        };

        PermissionQuery.prototype.toJSON = function() {
            return PermissionQuery.toObject(this, $protobuf.util.toJSONOptions);
        };

        PermissionQuery.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.PermissionQuery";
        };

        return PermissionQuery;
    })();

    MumbleProto.CodecVersion = (function() {

        const CodecVersion = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        CodecVersion.prototype.alpha = 0;
        CodecVersion.prototype.beta = 0;
        CodecVersion.prototype.preferAlpha = true;
        CodecVersion.prototype.opus = false;

        CodecVersion.create = function(properties) {
            return new CodecVersion(properties);
        };

        CodecVersion.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            writer.uint32(8).int32(message.alpha);
            writer.uint32(16).int32(message.beta);
            writer.uint32(24).bool(message.preferAlpha);
            if (message.opus != null && $Object.hasOwnProperty.call(message, "opus"))
                writer.uint32(32).bool(message.opus);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        CodecVersion.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        CodecVersion.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.CodecVersion();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.alpha = reader.int32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.beta = reader.int32();
                        continue;
                    }
                case 3: {
                        if (wireType !== 0)
                            break;
                        message.preferAlpha = reader.bool();
                        continue;
                    }
                case 4: {
                        if (wireType !== 0)
                            break;
                        message.opus = reader.bool();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            if (!$Object.hasOwnProperty.call(message, "alpha"))
                throw $util.ProtocolError("missing required 'alpha'", { instance: message });
            if (!$Object.hasOwnProperty.call(message, "beta"))
                throw $util.ProtocolError("missing required 'beta'", { instance: message });
            if (!$Object.hasOwnProperty.call(message, "preferAlpha"))
                throw $util.ProtocolError("missing required 'preferAlpha'", { instance: message });
            return message;
        };

        CodecVersion.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        CodecVersion.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (!$util.isInteger(message.alpha))
                return "alpha: integer expected";
            if (!$util.isInteger(message.beta))
                return "beta: integer expected";
            if (typeof message.preferAlpha !== "boolean")
                return "preferAlpha: boolean expected";
            if (message.opus != null && $Object.hasOwnProperty.call(message, "opus"))
                if (typeof message.opus !== "boolean")
                    return "opus: boolean expected";
            return null;
        };

        CodecVersion.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.CodecVersion)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.CodecVersion: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.CodecVersion();
            if (object.alpha != null)
                message.alpha = object.alpha | 0;
            if (object.beta != null)
                message.beta = object.beta | 0;
            if (object.preferAlpha != null)
                message.preferAlpha = $Boolean(object.preferAlpha);
            if (object.opus != null)
                message.opus = $Boolean(object.opus);
            return message;
        };

        CodecVersion.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.alpha = 0;
                object.beta = 0;
                object.preferAlpha = true;
                object.opus = false;
            }
            if (message.alpha != null && $Object.hasOwnProperty.call(message, "alpha"))
                object.alpha = message.alpha;
            if (message.beta != null && $Object.hasOwnProperty.call(message, "beta"))
                object.beta = message.beta;
            if (message.preferAlpha != null && $Object.hasOwnProperty.call(message, "preferAlpha"))
                object.preferAlpha = message.preferAlpha;
            if (message.opus != null && $Object.hasOwnProperty.call(message, "opus"))
                object.opus = message.opus;
            return object;
        };

        CodecVersion.prototype.toJSON = function() {
            return CodecVersion.toObject(this, $protobuf.util.toJSONOptions);
        };

        CodecVersion.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.CodecVersion";
        };

        return CodecVersion;
    })();

    MumbleProto.UserStats = (function() {

        const UserStats = function (properties) {
            this.certificates = [];
            this.celtVersions = [];
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        UserStats.prototype.session = 0;
        UserStats.prototype.statsOnly = false;
        UserStats.prototype.certificates = $util.emptyArray;
        UserStats.prototype.fromClient = null;
        UserStats.prototype.fromServer = null;
        UserStats.prototype.udpPackets = 0;
        UserStats.prototype.tcpPackets = 0;
        UserStats.prototype.udpPingAvg = 0;
        UserStats.prototype.udpPingVar = 0;
        UserStats.prototype.tcpPingAvg = 0;
        UserStats.prototype.tcpPingVar = 0;
        UserStats.prototype.version = null;
        UserStats.prototype.celtVersions = $util.emptyArray;
        UserStats.prototype.address = $util.newBuffer([]);
        UserStats.prototype.bandwidth = 0;
        UserStats.prototype.onlinesecs = 0;
        UserStats.prototype.idlesecs = 0;
        UserStats.prototype.strongCertificate = false;
        UserStats.prototype.opus = false;

        UserStats.create = function(properties) {
            return new UserStats(properties);
        };

        UserStats.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                writer.uint32(8).uint32(message.session);
            if (message.statsOnly != null && $Object.hasOwnProperty.call(message, "statsOnly"))
                writer.uint32(16).bool(message.statsOnly);
            if (message.certificates != null && message.certificates.length)
                for (let i = 0; i < message.certificates.length; ++i)
                    writer.uint32(26).bytes(message.certificates[i]);
            if (message.fromClient != null && $Object.hasOwnProperty.call(message, "fromClient"))
                $root.MumbleProto.UserStats.Stats.encode(message.fromClient, writer.uint32(34).fork(), _depth + 1).ldelim();
            if (message.fromServer != null && $Object.hasOwnProperty.call(message, "fromServer"))
                $root.MumbleProto.UserStats.Stats.encode(message.fromServer, writer.uint32(42).fork(), _depth + 1).ldelim();
            if (message.udpPackets != null && $Object.hasOwnProperty.call(message, "udpPackets"))
                writer.uint32(48).uint32(message.udpPackets);
            if (message.tcpPackets != null && $Object.hasOwnProperty.call(message, "tcpPackets"))
                writer.uint32(56).uint32(message.tcpPackets);
            if (message.udpPingAvg != null && $Object.hasOwnProperty.call(message, "udpPingAvg"))
                writer.uint32(69).float(message.udpPingAvg);
            if (message.udpPingVar != null && $Object.hasOwnProperty.call(message, "udpPingVar"))
                writer.uint32(77).float(message.udpPingVar);
            if (message.tcpPingAvg != null && $Object.hasOwnProperty.call(message, "tcpPingAvg"))
                writer.uint32(85).float(message.tcpPingAvg);
            if (message.tcpPingVar != null && $Object.hasOwnProperty.call(message, "tcpPingVar"))
                writer.uint32(93).float(message.tcpPingVar);
            if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                $root.MumbleProto.Version.encode(message.version, writer.uint32(98).fork(), _depth + 1).ldelim();
            if (message.celtVersions != null && message.celtVersions.length)
                for (let i = 0; i < message.celtVersions.length; ++i)
                    writer.uint32(104).int32(message.celtVersions[i]);
            if (message.address != null && $Object.hasOwnProperty.call(message, "address"))
                writer.uint32(114).bytes(message.address);
            if (message.bandwidth != null && $Object.hasOwnProperty.call(message, "bandwidth"))
                writer.uint32(120).uint32(message.bandwidth);
            if (message.onlinesecs != null && $Object.hasOwnProperty.call(message, "onlinesecs"))
                writer.uint32(128).uint32(message.onlinesecs);
            if (message.idlesecs != null && $Object.hasOwnProperty.call(message, "idlesecs"))
                writer.uint32(136).uint32(message.idlesecs);
            if (message.strongCertificate != null && $Object.hasOwnProperty.call(message, "strongCertificate"))
                writer.uint32(144).bool(message.strongCertificate);
            if (message.opus != null && $Object.hasOwnProperty.call(message, "opus"))
                writer.uint32(152).bool(message.opus);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        UserStats.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        UserStats.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserStats();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.session = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.statsOnly = reader.bool();
                        continue;
                    }
                case 3: {
                        if (wireType !== 2)
                            break;
                        if (!(message.certificates && message.certificates.length))
                            message.certificates = [];
                        message.certificates.push(reader.bytes());
                        continue;
                    }
                case 4: {
                        if (wireType !== 2)
                            break;
                        message.fromClient = $root.MumbleProto.UserStats.Stats.decode(reader, reader.uint32(), $undefined, _depth + 1, message.fromClient);
                        continue;
                    }
                case 5: {
                        if (wireType !== 2)
                            break;
                        message.fromServer = $root.MumbleProto.UserStats.Stats.decode(reader, reader.uint32(), $undefined, _depth + 1, message.fromServer);
                        continue;
                    }
                case 6: {
                        if (wireType !== 0)
                            break;
                        message.udpPackets = reader.uint32();
                        continue;
                    }
                case 7: {
                        if (wireType !== 0)
                            break;
                        message.tcpPackets = reader.uint32();
                        continue;
                    }
                case 8: {
                        if (wireType !== 5)
                            break;
                        message.udpPingAvg = reader.float();
                        continue;
                    }
                case 9: {
                        if (wireType !== 5)
                            break;
                        message.udpPingVar = reader.float();
                        continue;
                    }
                case 10: {
                        if (wireType !== 5)
                            break;
                        message.tcpPingAvg = reader.float();
                        continue;
                    }
                case 11: {
                        if (wireType !== 5)
                            break;
                        message.tcpPingVar = reader.float();
                        continue;
                    }
                case 12: {
                        if (wireType !== 2)
                            break;
                        message.version = $root.MumbleProto.Version.decode(reader, reader.uint32(), $undefined, _depth + 1, message.version);
                        continue;
                    }
                case 13: {
                        if (wireType === 2) {
                            if (!(message.celtVersions && message.celtVersions.length))
                                message.celtVersions = [];
                            reader.int32s(message.celtVersions);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.celtVersions && message.celtVersions.length))
                            message.celtVersions = [];
                        message.celtVersions.push(reader.int32());
                        continue;
                    }
                case 14: {
                        if (wireType !== 2)
                            break;
                        message.address = reader.bytes();
                        continue;
                    }
                case 15: {
                        if (wireType !== 0)
                            break;
                        message.bandwidth = reader.uint32();
                        continue;
                    }
                case 16: {
                        if (wireType !== 0)
                            break;
                        message.onlinesecs = reader.uint32();
                        continue;
                    }
                case 17: {
                        if (wireType !== 0)
                            break;
                        message.idlesecs = reader.uint32();
                        continue;
                    }
                case 18: {
                        if (wireType !== 0)
                            break;
                        message.strongCertificate = reader.bool();
                        continue;
                    }
                case 19: {
                        if (wireType !== 0)
                            break;
                        message.opus = reader.bool();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        UserStats.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        UserStats.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                if (!$util.isInteger(message.session))
                    return "session: integer expected";
            if (message.statsOnly != null && $Object.hasOwnProperty.call(message, "statsOnly"))
                if (typeof message.statsOnly !== "boolean")
                    return "statsOnly: boolean expected";
            if (message.certificates != null && $Object.hasOwnProperty.call(message, "certificates")) {
                if (!$Array.isArray(message.certificates))
                    return "certificates: array expected";
                for (let i = 0; i < message.certificates.length; ++i)
                    if (!(message.certificates[i] && typeof message.certificates[i].length === "number" || $util.isString(message.certificates[i])))
                        return "certificates: buffer[] expected";
            }
            if (message.fromClient != null && $Object.hasOwnProperty.call(message, "fromClient")) {
                let error = $root.MumbleProto.UserStats.Stats.verify(message.fromClient, _depth + 1);
                if (error)
                    return "fromClient." + error;
            }
            if (message.fromServer != null && $Object.hasOwnProperty.call(message, "fromServer")) {
                let error = $root.MumbleProto.UserStats.Stats.verify(message.fromServer, _depth + 1);
                if (error)
                    return "fromServer." + error;
            }
            if (message.udpPackets != null && $Object.hasOwnProperty.call(message, "udpPackets"))
                if (!$util.isInteger(message.udpPackets))
                    return "udpPackets: integer expected";
            if (message.tcpPackets != null && $Object.hasOwnProperty.call(message, "tcpPackets"))
                if (!$util.isInteger(message.tcpPackets))
                    return "tcpPackets: integer expected";
            if (message.udpPingAvg != null && $Object.hasOwnProperty.call(message, "udpPingAvg"))
                if (typeof message.udpPingAvg !== "number")
                    return "udpPingAvg: number expected";
            if (message.udpPingVar != null && $Object.hasOwnProperty.call(message, "udpPingVar"))
                if (typeof message.udpPingVar !== "number")
                    return "udpPingVar: number expected";
            if (message.tcpPingAvg != null && $Object.hasOwnProperty.call(message, "tcpPingAvg"))
                if (typeof message.tcpPingAvg !== "number")
                    return "tcpPingAvg: number expected";
            if (message.tcpPingVar != null && $Object.hasOwnProperty.call(message, "tcpPingVar"))
                if (typeof message.tcpPingVar !== "number")
                    return "tcpPingVar: number expected";
            if (message.version != null && $Object.hasOwnProperty.call(message, "version")) {
                let error = $root.MumbleProto.Version.verify(message.version, _depth + 1);
                if (error)
                    return "version." + error;
            }
            if (message.celtVersions != null && $Object.hasOwnProperty.call(message, "celtVersions")) {
                if (!$Array.isArray(message.celtVersions))
                    return "celtVersions: array expected";
                for (let i = 0; i < message.celtVersions.length; ++i)
                    if (!$util.isInteger(message.celtVersions[i]))
                        return "celtVersions: integer[] expected";
            }
            if (message.address != null && $Object.hasOwnProperty.call(message, "address"))
                if (!(message.address && typeof message.address.length === "number" || $util.isString(message.address)))
                    return "address: buffer expected";
            if (message.bandwidth != null && $Object.hasOwnProperty.call(message, "bandwidth"))
                if (!$util.isInteger(message.bandwidth))
                    return "bandwidth: integer expected";
            if (message.onlinesecs != null && $Object.hasOwnProperty.call(message, "onlinesecs"))
                if (!$util.isInteger(message.onlinesecs))
                    return "onlinesecs: integer expected";
            if (message.idlesecs != null && $Object.hasOwnProperty.call(message, "idlesecs"))
                if (!$util.isInteger(message.idlesecs))
                    return "idlesecs: integer expected";
            if (message.strongCertificate != null && $Object.hasOwnProperty.call(message, "strongCertificate"))
                if (typeof message.strongCertificate !== "boolean")
                    return "strongCertificate: boolean expected";
            if (message.opus != null && $Object.hasOwnProperty.call(message, "opus"))
                if (typeof message.opus !== "boolean")
                    return "opus: boolean expected";
            return null;
        };

        UserStats.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.UserStats)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.UserStats: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.UserStats();
            if (object.session != null)
                message.session = object.session >>> 0;
            if (object.statsOnly != null)
                message.statsOnly = $Boolean(object.statsOnly);
            if (object.certificates) {
                if (!$Array.isArray(object.certificates))
                    throw $TypeError(".MumbleProto.UserStats.certificates: array expected");
                message.certificates = $Array(object.certificates.length);
                for (let i = 0; i < object.certificates.length; ++i)
                    if (typeof object.certificates[i] === "string")
                        $util.base64.decode(object.certificates[i], message.certificates[i] = $util.newBuffer($util.base64.length(object.certificates[i])), 0);
                    else if (object.certificates[i].length >= 0)
                        message.certificates[i] = object.certificates[i];
            }
            if (object.fromClient != null) {
                if (!$util.isObject(object.fromClient))
                    throw $TypeError(".MumbleProto.UserStats.fromClient: object expected");
                message.fromClient = $root.MumbleProto.UserStats.Stats.fromObject(object.fromClient, _depth + 1);
            }
            if (object.fromServer != null) {
                if (!$util.isObject(object.fromServer))
                    throw $TypeError(".MumbleProto.UserStats.fromServer: object expected");
                message.fromServer = $root.MumbleProto.UserStats.Stats.fromObject(object.fromServer, _depth + 1);
            }
            if (object.udpPackets != null)
                message.udpPackets = object.udpPackets >>> 0;
            if (object.tcpPackets != null)
                message.tcpPackets = object.tcpPackets >>> 0;
            if (object.udpPingAvg != null)
                message.udpPingAvg = $Number(object.udpPingAvg);
            if (object.udpPingVar != null)
                message.udpPingVar = $Number(object.udpPingVar);
            if (object.tcpPingAvg != null)
                message.tcpPingAvg = $Number(object.tcpPingAvg);
            if (object.tcpPingVar != null)
                message.tcpPingVar = $Number(object.tcpPingVar);
            if (object.version != null) {
                if (!$util.isObject(object.version))
                    throw $TypeError(".MumbleProto.UserStats.version: object expected");
                message.version = $root.MumbleProto.Version.fromObject(object.version, _depth + 1);
            }
            if (object.celtVersions) {
                if (!$Array.isArray(object.celtVersions))
                    throw $TypeError(".MumbleProto.UserStats.celtVersions: array expected");
                message.celtVersions = $Array(object.celtVersions.length);
                for (let i = 0; i < object.celtVersions.length; ++i)
                    message.celtVersions[i] = object.celtVersions[i] | 0;
            }
            if (object.address != null)
                if (typeof object.address === "string")
                    $util.base64.decode(object.address, message.address = $util.newBuffer($util.base64.length(object.address)), 0);
                else if (object.address.length >= 0)
                    message.address = object.address;
            if (object.bandwidth != null)
                message.bandwidth = object.bandwidth >>> 0;
            if (object.onlinesecs != null)
                message.onlinesecs = object.onlinesecs >>> 0;
            if (object.idlesecs != null)
                message.idlesecs = object.idlesecs >>> 0;
            if (object.strongCertificate != null)
                message.strongCertificate = $Boolean(object.strongCertificate);
            if (object.opus != null)
                message.opus = $Boolean(object.opus);
            return message;
        };

        UserStats.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults) {
                object.certificates = [];
                object.celtVersions = [];
            }
            if (options.defaults) {
                object.session = 0;
                object.statsOnly = false;
                object.fromClient = null;
                object.fromServer = null;
                object.udpPackets = 0;
                object.tcpPackets = 0;
                object.udpPingAvg = 0;
                object.udpPingVar = 0;
                object.tcpPingAvg = 0;
                object.tcpPingVar = 0;
                object.version = null;
                if (options.bytes === $String)
                    object.address = "";
                else {
                    object.address = [];
                    if (options.bytes !== $Array)
                        object.address = $util.newBuffer(object.address);
                }
                object.bandwidth = 0;
                object.onlinesecs = 0;
                object.idlesecs = 0;
                object.strongCertificate = false;
                object.opus = false;
            }
            if (message.session != null && $Object.hasOwnProperty.call(message, "session"))
                object.session = message.session;
            if (message.statsOnly != null && $Object.hasOwnProperty.call(message, "statsOnly"))
                object.statsOnly = message.statsOnly;
            if (message.certificates && message.certificates.length) {
                object.certificates = $Array(message.certificates.length);
                for (let j = 0; j < message.certificates.length; ++j)
                    object.certificates[j] = options.bytes === $String ? $util.base64.encode(message.certificates[j], 0, message.certificates[j].length) : options.bytes === $Array ? $Array.prototype.slice.call(message.certificates[j]) : message.certificates[j];
            }
            if (message.fromClient != null && $Object.hasOwnProperty.call(message, "fromClient"))
                object.fromClient = $root.MumbleProto.UserStats.Stats.toObject(message.fromClient, options, _depth + 1);
            if (message.fromServer != null && $Object.hasOwnProperty.call(message, "fromServer"))
                object.fromServer = $root.MumbleProto.UserStats.Stats.toObject(message.fromServer, options, _depth + 1);
            if (message.udpPackets != null && $Object.hasOwnProperty.call(message, "udpPackets"))
                object.udpPackets = message.udpPackets;
            if (message.tcpPackets != null && $Object.hasOwnProperty.call(message, "tcpPackets"))
                object.tcpPackets = message.tcpPackets;
            if (message.udpPingAvg != null && $Object.hasOwnProperty.call(message, "udpPingAvg"))
                object.udpPingAvg = options.json && !$isFinite(message.udpPingAvg) ? $String(message.udpPingAvg) : message.udpPingAvg;
            if (message.udpPingVar != null && $Object.hasOwnProperty.call(message, "udpPingVar"))
                object.udpPingVar = options.json && !$isFinite(message.udpPingVar) ? $String(message.udpPingVar) : message.udpPingVar;
            if (message.tcpPingAvg != null && $Object.hasOwnProperty.call(message, "tcpPingAvg"))
                object.tcpPingAvg = options.json && !$isFinite(message.tcpPingAvg) ? $String(message.tcpPingAvg) : message.tcpPingAvg;
            if (message.tcpPingVar != null && $Object.hasOwnProperty.call(message, "tcpPingVar"))
                object.tcpPingVar = options.json && !$isFinite(message.tcpPingVar) ? $String(message.tcpPingVar) : message.tcpPingVar;
            if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                object.version = $root.MumbleProto.Version.toObject(message.version, options, _depth + 1);
            if (message.celtVersions && message.celtVersions.length) {
                object.celtVersions = $Array(message.celtVersions.length);
                for (let j = 0; j < message.celtVersions.length; ++j)
                    object.celtVersions[j] = message.celtVersions[j];
            }
            if (message.address != null && $Object.hasOwnProperty.call(message, "address"))
                object.address = options.bytes === $String ? $util.base64.encode(message.address, 0, message.address.length) : options.bytes === $Array ? $Array.prototype.slice.call(message.address) : message.address;
            if (message.bandwidth != null && $Object.hasOwnProperty.call(message, "bandwidth"))
                object.bandwidth = message.bandwidth;
            if (message.onlinesecs != null && $Object.hasOwnProperty.call(message, "onlinesecs"))
                object.onlinesecs = message.onlinesecs;
            if (message.idlesecs != null && $Object.hasOwnProperty.call(message, "idlesecs"))
                object.idlesecs = message.idlesecs;
            if (message.strongCertificate != null && $Object.hasOwnProperty.call(message, "strongCertificate"))
                object.strongCertificate = message.strongCertificate;
            if (message.opus != null && $Object.hasOwnProperty.call(message, "opus"))
                object.opus = message.opus;
            return object;
        };

        UserStats.prototype.toJSON = function() {
            return UserStats.toObject(this, $protobuf.util.toJSONOptions);
        };

        UserStats.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.UserStats";
        };

        UserStats.Stats = (function() {

            const Stats = function (properties) {
                if (properties)
                    for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            };

            Stats.prototype.good = 0;
            Stats.prototype.late = 0;
            Stats.prototype.lost = 0;
            Stats.prototype.resync = 0;

            Stats.create = function(properties) {
                return new Stats(properties);
            };

            Stats.encode = function (message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                if (message.good != null && $Object.hasOwnProperty.call(message, "good"))
                    writer.uint32(8).uint32(message.good);
                if (message.late != null && $Object.hasOwnProperty.call(message, "late"))
                    writer.uint32(16).uint32(message.late);
                if (message.lost != null && $Object.hasOwnProperty.call(message, "lost"))
                    writer.uint32(24).uint32(message.lost);
                if (message.resync != null && $Object.hasOwnProperty.call(message, "resync"))
                    writer.uint32(32).uint32(message.resync);
                if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            Stats.encodeDelimited = function(message, writer) {
                return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
            };

            Stats.decode = function (reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw $Error("max depth exceeded");
                let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserStats.Stats();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = $undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType !== 0)
                                break;
                            message.good = reader.uint32();
                            continue;
                        }
                    case 2: {
                            if (wireType !== 0)
                                break;
                            message.late = reader.uint32();
                            continue;
                        }
                    case 3: {
                            if (wireType !== 0)
                                break;
                            message.lost = reader.uint32();
                            continue;
                        }
                    case 4: {
                            if (wireType !== 0)
                                break;
                            message.resync = reader.uint32();
                            continue;
                        }
                    }
                    reader.skipType(wireType, _depth, tag);
                    if (!reader.discardUnknown) {
                        $util.makeProp(message, "$unknowns", false);
                        (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                    }
                }
                if (_end !== $undefined)
                    throw $Error("missing end group");
                return message;
            };

            Stats.decodeDelimited = function(reader) {
                if (!(reader instanceof $Reader))
                    reader = new $Reader(reader);
                return this.decode(reader, reader.uint32());
            };

            Stats.verify = function (message, _depth) {
                if (typeof message !== "object" || message === null)
                    return "object expected";
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    return "max depth exceeded";
                if (message.good != null && $Object.hasOwnProperty.call(message, "good"))
                    if (!$util.isInteger(message.good))
                        return "good: integer expected";
                if (message.late != null && $Object.hasOwnProperty.call(message, "late"))
                    if (!$util.isInteger(message.late))
                        return "late: integer expected";
                if (message.lost != null && $Object.hasOwnProperty.call(message, "lost"))
                    if (!$util.isInteger(message.lost))
                        return "lost: integer expected";
                if (message.resync != null && $Object.hasOwnProperty.call(message, "resync"))
                    if (!$util.isInteger(message.resync))
                        return "resync: integer expected";
                return null;
            };

            Stats.fromObject = function (object, _depth) {
                if (object instanceof $root.MumbleProto.UserStats.Stats)
                    return object;
                if (!$util.isObject(object))
                    throw $TypeError(".MumbleProto.UserStats.Stats: object expected");
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let message = new $root.MumbleProto.UserStats.Stats();
                if (object.good != null)
                    message.good = object.good >>> 0;
                if (object.late != null)
                    message.late = object.late >>> 0;
                if (object.lost != null)
                    message.lost = object.lost >>> 0;
                if (object.resync != null)
                    message.resync = object.resync >>> 0;
                return message;
            };

            Stats.toObject = function (message, options, _depth) {
                if (!options)
                    options = {};
                if (_depth === $undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw $Error("max depth exceeded");
                let object = {};
                if (options.defaults) {
                    object.good = 0;
                    object.late = 0;
                    object.lost = 0;
                    object.resync = 0;
                }
                if (message.good != null && $Object.hasOwnProperty.call(message, "good"))
                    object.good = message.good;
                if (message.late != null && $Object.hasOwnProperty.call(message, "late"))
                    object.late = message.late;
                if (message.lost != null && $Object.hasOwnProperty.call(message, "lost"))
                    object.lost = message.lost;
                if (message.resync != null && $Object.hasOwnProperty.call(message, "resync"))
                    object.resync = message.resync;
                return object;
            };

            Stats.prototype.toJSON = function() {
                return Stats.toObject(this, $protobuf.util.toJSONOptions);
            };

            Stats.getTypeUrl = function(prefix) {
                if (prefix === $undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.UserStats.Stats";
            };

            return Stats;
        })();

        return UserStats;
    })();

    MumbleProto.RequestBlob = (function() {

        const RequestBlob = function (properties) {
            this.sessionTexture = [];
            this.sessionComment = [];
            this.channelDescription = [];
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        RequestBlob.prototype.sessionTexture = $util.emptyArray;
        RequestBlob.prototype.sessionComment = $util.emptyArray;
        RequestBlob.prototype.channelDescription = $util.emptyArray;

        RequestBlob.create = function(properties) {
            return new RequestBlob(properties);
        };

        RequestBlob.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.sessionTexture != null && message.sessionTexture.length)
                for (let i = 0; i < message.sessionTexture.length; ++i)
                    writer.uint32(8).uint32(message.sessionTexture[i]);
            if (message.sessionComment != null && message.sessionComment.length)
                for (let i = 0; i < message.sessionComment.length; ++i)
                    writer.uint32(16).uint32(message.sessionComment[i]);
            if (message.channelDescription != null && message.channelDescription.length)
                for (let i = 0; i < message.channelDescription.length; ++i)
                    writer.uint32(24).uint32(message.channelDescription[i]);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        RequestBlob.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        RequestBlob.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.RequestBlob();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType === 2) {
                            if (!(message.sessionTexture && message.sessionTexture.length))
                                message.sessionTexture = [];
                            reader.uint32s(message.sessionTexture);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.sessionTexture && message.sessionTexture.length))
                            message.sessionTexture = [];
                        message.sessionTexture.push(reader.uint32());
                        continue;
                    }
                case 2: {
                        if (wireType === 2) {
                            if (!(message.sessionComment && message.sessionComment.length))
                                message.sessionComment = [];
                            reader.uint32s(message.sessionComment);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.sessionComment && message.sessionComment.length))
                            message.sessionComment = [];
                        message.sessionComment.push(reader.uint32());
                        continue;
                    }
                case 3: {
                        if (wireType === 2) {
                            if (!(message.channelDescription && message.channelDescription.length))
                                message.channelDescription = [];
                            reader.uint32s(message.channelDescription);
                            continue;
                        }
                        if (wireType !== 0)
                            break;
                        if (!(message.channelDescription && message.channelDescription.length))
                            message.channelDescription = [];
                        message.channelDescription.push(reader.uint32());
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        RequestBlob.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        RequestBlob.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.sessionTexture != null && $Object.hasOwnProperty.call(message, "sessionTexture")) {
                if (!$Array.isArray(message.sessionTexture))
                    return "sessionTexture: array expected";
                for (let i = 0; i < message.sessionTexture.length; ++i)
                    if (!$util.isInteger(message.sessionTexture[i]))
                        return "sessionTexture: integer[] expected";
            }
            if (message.sessionComment != null && $Object.hasOwnProperty.call(message, "sessionComment")) {
                if (!$Array.isArray(message.sessionComment))
                    return "sessionComment: array expected";
                for (let i = 0; i < message.sessionComment.length; ++i)
                    if (!$util.isInteger(message.sessionComment[i]))
                        return "sessionComment: integer[] expected";
            }
            if (message.channelDescription != null && $Object.hasOwnProperty.call(message, "channelDescription")) {
                if (!$Array.isArray(message.channelDescription))
                    return "channelDescription: array expected";
                for (let i = 0; i < message.channelDescription.length; ++i)
                    if (!$util.isInteger(message.channelDescription[i]))
                        return "channelDescription: integer[] expected";
            }
            return null;
        };

        RequestBlob.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.RequestBlob)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.RequestBlob: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.RequestBlob();
            if (object.sessionTexture) {
                if (!$Array.isArray(object.sessionTexture))
                    throw $TypeError(".MumbleProto.RequestBlob.sessionTexture: array expected");
                message.sessionTexture = $Array(object.sessionTexture.length);
                for (let i = 0; i < object.sessionTexture.length; ++i)
                    message.sessionTexture[i] = object.sessionTexture[i] >>> 0;
            }
            if (object.sessionComment) {
                if (!$Array.isArray(object.sessionComment))
                    throw $TypeError(".MumbleProto.RequestBlob.sessionComment: array expected");
                message.sessionComment = $Array(object.sessionComment.length);
                for (let i = 0; i < object.sessionComment.length; ++i)
                    message.sessionComment[i] = object.sessionComment[i] >>> 0;
            }
            if (object.channelDescription) {
                if (!$Array.isArray(object.channelDescription))
                    throw $TypeError(".MumbleProto.RequestBlob.channelDescription: array expected");
                message.channelDescription = $Array(object.channelDescription.length);
                for (let i = 0; i < object.channelDescription.length; ++i)
                    message.channelDescription[i] = object.channelDescription[i] >>> 0;
            }
            return message;
        };

        RequestBlob.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults) {
                object.sessionTexture = [];
                object.sessionComment = [];
                object.channelDescription = [];
            }
            if (message.sessionTexture && message.sessionTexture.length) {
                object.sessionTexture = $Array(message.sessionTexture.length);
                for (let j = 0; j < message.sessionTexture.length; ++j)
                    object.sessionTexture[j] = message.sessionTexture[j];
            }
            if (message.sessionComment && message.sessionComment.length) {
                object.sessionComment = $Array(message.sessionComment.length);
                for (let j = 0; j < message.sessionComment.length; ++j)
                    object.sessionComment[j] = message.sessionComment[j];
            }
            if (message.channelDescription && message.channelDescription.length) {
                object.channelDescription = $Array(message.channelDescription.length);
                for (let j = 0; j < message.channelDescription.length; ++j)
                    object.channelDescription[j] = message.channelDescription[j];
            }
            return object;
        };

        RequestBlob.prototype.toJSON = function() {
            return RequestBlob.toObject(this, $protobuf.util.toJSONOptions);
        };

        RequestBlob.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.RequestBlob";
        };

        return RequestBlob;
    })();

    MumbleProto.ServerConfig = (function() {

        const ServerConfig = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        ServerConfig.prototype.maxBandwidth = 0;
        ServerConfig.prototype.welcomeText = "";
        ServerConfig.prototype.allowHtml = false;
        ServerConfig.prototype.messageLength = 0;
        ServerConfig.prototype.imageMessageLength = 0;
        ServerConfig.prototype.maxUsers = 0;

        ServerConfig.create = function(properties) {
            return new ServerConfig(properties);
        };

        ServerConfig.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.maxBandwidth != null && $Object.hasOwnProperty.call(message, "maxBandwidth"))
                writer.uint32(8).uint32(message.maxBandwidth);
            if (message.welcomeText != null && $Object.hasOwnProperty.call(message, "welcomeText"))
                writer.uint32(18).string(message.welcomeText);
            if (message.allowHtml != null && $Object.hasOwnProperty.call(message, "allowHtml"))
                writer.uint32(24).bool(message.allowHtml);
            if (message.messageLength != null && $Object.hasOwnProperty.call(message, "messageLength"))
                writer.uint32(32).uint32(message.messageLength);
            if (message.imageMessageLength != null && $Object.hasOwnProperty.call(message, "imageMessageLength"))
                writer.uint32(40).uint32(message.imageMessageLength);
            if (message.maxUsers != null && $Object.hasOwnProperty.call(message, "maxUsers"))
                writer.uint32(48).uint32(message.maxUsers);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ServerConfig.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        ServerConfig.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ServerConfig();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.maxBandwidth = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 2)
                            break;
                        message.welcomeText = reader.string();
                        continue;
                    }
                case 3: {
                        if (wireType !== 0)
                            break;
                        message.allowHtml = reader.bool();
                        continue;
                    }
                case 4: {
                        if (wireType !== 0)
                            break;
                        message.messageLength = reader.uint32();
                        continue;
                    }
                case 5: {
                        if (wireType !== 0)
                            break;
                        message.imageMessageLength = reader.uint32();
                        continue;
                    }
                case 6: {
                        if (wireType !== 0)
                            break;
                        message.maxUsers = reader.uint32();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        ServerConfig.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        ServerConfig.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.maxBandwidth != null && $Object.hasOwnProperty.call(message, "maxBandwidth"))
                if (!$util.isInteger(message.maxBandwidth))
                    return "maxBandwidth: integer expected";
            if (message.welcomeText != null && $Object.hasOwnProperty.call(message, "welcomeText"))
                if (!$util.isString(message.welcomeText))
                    return "welcomeText: string expected";
            if (message.allowHtml != null && $Object.hasOwnProperty.call(message, "allowHtml"))
                if (typeof message.allowHtml !== "boolean")
                    return "allowHtml: boolean expected";
            if (message.messageLength != null && $Object.hasOwnProperty.call(message, "messageLength"))
                if (!$util.isInteger(message.messageLength))
                    return "messageLength: integer expected";
            if (message.imageMessageLength != null && $Object.hasOwnProperty.call(message, "imageMessageLength"))
                if (!$util.isInteger(message.imageMessageLength))
                    return "imageMessageLength: integer expected";
            if (message.maxUsers != null && $Object.hasOwnProperty.call(message, "maxUsers"))
                if (!$util.isInteger(message.maxUsers))
                    return "maxUsers: integer expected";
            return null;
        };

        ServerConfig.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.ServerConfig)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.ServerConfig: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.ServerConfig();
            if (object.maxBandwidth != null)
                message.maxBandwidth = object.maxBandwidth >>> 0;
            if (object.welcomeText != null)
                message.welcomeText = $String(object.welcomeText);
            if (object.allowHtml != null)
                message.allowHtml = $Boolean(object.allowHtml);
            if (object.messageLength != null)
                message.messageLength = object.messageLength >>> 0;
            if (object.imageMessageLength != null)
                message.imageMessageLength = object.imageMessageLength >>> 0;
            if (object.maxUsers != null)
                message.maxUsers = object.maxUsers >>> 0;
            return message;
        };

        ServerConfig.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.maxBandwidth = 0;
                object.welcomeText = "";
                object.allowHtml = false;
                object.messageLength = 0;
                object.imageMessageLength = 0;
                object.maxUsers = 0;
            }
            if (message.maxBandwidth != null && $Object.hasOwnProperty.call(message, "maxBandwidth"))
                object.maxBandwidth = message.maxBandwidth;
            if (message.welcomeText != null && $Object.hasOwnProperty.call(message, "welcomeText"))
                object.welcomeText = message.welcomeText;
            if (message.allowHtml != null && $Object.hasOwnProperty.call(message, "allowHtml"))
                object.allowHtml = message.allowHtml;
            if (message.messageLength != null && $Object.hasOwnProperty.call(message, "messageLength"))
                object.messageLength = message.messageLength;
            if (message.imageMessageLength != null && $Object.hasOwnProperty.call(message, "imageMessageLength"))
                object.imageMessageLength = message.imageMessageLength;
            if (message.maxUsers != null && $Object.hasOwnProperty.call(message, "maxUsers"))
                object.maxUsers = message.maxUsers;
            return object;
        };

        ServerConfig.prototype.toJSON = function() {
            return ServerConfig.toObject(this, $protobuf.util.toJSONOptions);
        };

        ServerConfig.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ServerConfig";
        };

        return ServerConfig;
    })();

    MumbleProto.SuggestConfig = (function() {

        const SuggestConfig = function (properties) {
            if (properties)
                for (let keys = $Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        };

        SuggestConfig.prototype.version = 0;
        SuggestConfig.prototype.positional = false;
        SuggestConfig.prototype.pushToTalk = false;

        SuggestConfig.create = function(properties) {
            return new SuggestConfig(properties);
        };

        SuggestConfig.encode = function (message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                writer.uint32(8).uint32(message.version);
            if (message.positional != null && $Object.hasOwnProperty.call(message, "positional"))
                writer.uint32(16).bool(message.positional);
            if (message.pushToTalk != null && $Object.hasOwnProperty.call(message, "pushToTalk"))
                writer.uint32(24).bool(message.pushToTalk);
            if (message.$unknowns != null && $Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        SuggestConfig.encodeDelimited = function(message, writer) {
            return this.encode(message, (writer || $Writer.create()).fork()).ldelim();
        };

        SuggestConfig.decode = function (reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw $Error("max depth exceeded");
            let end = length === $undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.SuggestConfig();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = $undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.version = reader.uint32();
                        continue;
                    }
                case 2: {
                        if (wireType !== 0)
                            break;
                        message.positional = reader.bool();
                        continue;
                    }
                case 3: {
                        if (wireType !== 0)
                            break;
                        message.pushToTalk = reader.bool();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                if (!reader.discardUnknown) {
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
            }
            if (_end !== $undefined)
                throw $Error("missing end group");
            return message;
        };

        SuggestConfig.decodeDelimited = function(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        SuggestConfig.verify = function (message, _depth) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                return "max depth exceeded";
            if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                if (!$util.isInteger(message.version))
                    return "version: integer expected";
            if (message.positional != null && $Object.hasOwnProperty.call(message, "positional"))
                if (typeof message.positional !== "boolean")
                    return "positional: boolean expected";
            if (message.pushToTalk != null && $Object.hasOwnProperty.call(message, "pushToTalk"))
                if (typeof message.pushToTalk !== "boolean")
                    return "pushToTalk: boolean expected";
            return null;
        };

        SuggestConfig.fromObject = function (object, _depth) {
            if (object instanceof $root.MumbleProto.SuggestConfig)
                return object;
            if (!$util.isObject(object))
                throw $TypeError(".MumbleProto.SuggestConfig: object expected");
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let message = new $root.MumbleProto.SuggestConfig();
            if (object.version != null)
                message.version = object.version >>> 0;
            if (object.positional != null)
                message.positional = $Boolean(object.positional);
            if (object.pushToTalk != null)
                message.pushToTalk = $Boolean(object.pushToTalk);
            return message;
        };

        SuggestConfig.toObject = function (message, options, _depth) {
            if (!options)
                options = {};
            if (_depth === $undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw $Error("max depth exceeded");
            let object = {};
            if (options.defaults) {
                object.version = 0;
                object.positional = false;
                object.pushToTalk = false;
            }
            if (message.version != null && $Object.hasOwnProperty.call(message, "version"))
                object.version = message.version;
            if (message.positional != null && $Object.hasOwnProperty.call(message, "positional"))
                object.positional = message.positional;
            if (message.pushToTalk != null && $Object.hasOwnProperty.call(message, "pushToTalk"))
                object.pushToTalk = message.pushToTalk;
            return object;
        };

        SuggestConfig.prototype.toJSON = function() {
            return SuggestConfig.toObject(this, $protobuf.util.toJSONOptions);
        };

        SuggestConfig.getTypeUrl = function(prefix) {
            if (prefix === $undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.SuggestConfig";
        };

        return SuggestConfig;
    })();

    return MumbleProto;
})();

export {
  $root as default
};
