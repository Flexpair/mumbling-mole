/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-mixed-operators, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars, default-case, jsdoc/require-param*/
import $protobuf from "protobufjs/minimal.js";

const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const MumbleProto = $root.MumbleProto = (() => {

    const MumbleProto = {};

    MumbleProto.Version = (function() {

        function Version(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        Version.prototype.version = 0;
        Version.prototype.release = "";
        Version.prototype.os = "";
        Version.prototype.osVersion = "";

        Version.create = function create(properties) {
            return new Version(properties);
        };

        Version.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                writer.uint32(8).uint32(message.version);
            if (message.release != null && Object.hasOwnProperty.call(message, "release"))
                writer.uint32(18).string(message.release);
            if (message.os != null && Object.hasOwnProperty.call(message, "os"))
                writer.uint32(26).string(message.os);
            if (message.osVersion != null && Object.hasOwnProperty.call(message, "osVersion"))
                writer.uint32(34).string(message.osVersion);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        Version.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.Version();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        Version.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.Version";
        };

        return Version;
    })();

    MumbleProto.UDPTunnel = (function() {

        function UDPTunnel(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        UDPTunnel.prototype.packet = $util.newBuffer([]);

        UDPTunnel.create = function create(properties) {
            return new UDPTunnel(properties);
        };

        UDPTunnel.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            writer.uint32(10).bytes(message.packet);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        UDPTunnel.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UDPTunnel();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            if (!message.hasOwnProperty("packet"))
                throw $util.ProtocolError("missing required 'packet'", { instance: message });
            return message;
        };

        UDPTunnel.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.UDPTunnel";
        };

        return UDPTunnel;
    })();

    MumbleProto.Authenticate = (function() {

        function Authenticate(properties) {
            this.tokens = [];
            this.celtVersions = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        Authenticate.prototype.username = "";
        Authenticate.prototype.password = "";
        Authenticate.prototype.tokens = $util.emptyArray;
        Authenticate.prototype.celtVersions = $util.emptyArray;
        Authenticate.prototype.opus = false;

        Authenticate.create = function create(properties) {
            return new Authenticate(properties);
        };

        Authenticate.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.username != null && Object.hasOwnProperty.call(message, "username"))
                writer.uint32(10).string(message.username);
            if (message.password != null && Object.hasOwnProperty.call(message, "password"))
                writer.uint32(18).string(message.password);
            if (message.tokens != null && message.tokens.length)
                for (let i = 0; i < message.tokens.length; ++i)
                    writer.uint32(26).string(message.tokens[i]);
            if (message.celtVersions != null && message.celtVersions.length)
                for (let i = 0; i < message.celtVersions.length; ++i)
                    writer.uint32(32).int32(message.celtVersions[i]);
            if (message.opus != null && Object.hasOwnProperty.call(message, "opus"))
                writer.uint32(40).bool(message.opus);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        Authenticate.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.Authenticate();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.celtVersions.push(reader.int32());
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        Authenticate.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.Authenticate";
        };

        return Authenticate;
    })();

    MumbleProto.Ping = (function() {

        function Ping(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

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

        Ping.create = function create(properties) {
            return new Ping(properties);
        };

        Ping.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.timestamp != null && Object.hasOwnProperty.call(message, "timestamp"))
                writer.uint32(8).uint64(message.timestamp);
            if (message.good != null && Object.hasOwnProperty.call(message, "good"))
                writer.uint32(16).uint32(message.good);
            if (message.late != null && Object.hasOwnProperty.call(message, "late"))
                writer.uint32(24).uint32(message.late);
            if (message.lost != null && Object.hasOwnProperty.call(message, "lost"))
                writer.uint32(32).uint32(message.lost);
            if (message.resync != null && Object.hasOwnProperty.call(message, "resync"))
                writer.uint32(40).uint32(message.resync);
            if (message.udpPackets != null && Object.hasOwnProperty.call(message, "udpPackets"))
                writer.uint32(48).uint32(message.udpPackets);
            if (message.tcpPackets != null && Object.hasOwnProperty.call(message, "tcpPackets"))
                writer.uint32(56).uint32(message.tcpPackets);
            if (message.udpPingAvg != null && Object.hasOwnProperty.call(message, "udpPingAvg"))
                writer.uint32(69).float(message.udpPingAvg);
            if (message.udpPingVar != null && Object.hasOwnProperty.call(message, "udpPingVar"))
                writer.uint32(77).float(message.udpPingVar);
            if (message.tcpPingAvg != null && Object.hasOwnProperty.call(message, "tcpPingAvg"))
                writer.uint32(85).float(message.tcpPingAvg);
            if (message.tcpPingVar != null && Object.hasOwnProperty.call(message, "tcpPingVar"))
                writer.uint32(93).float(message.tcpPingVar);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        Ping.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.Ping();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        Ping.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.Ping";
        };

        return Ping;
    })();

    MumbleProto.Reject = (function() {

        function Reject(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        Reject.prototype.type = 0;
        Reject.prototype.reason = "";

        Reject.create = function create(properties) {
            return new Reject(properties);
        };

        Reject.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                writer.uint32(8).int32(message.type);
            if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                writer.uint32(18).string(message.reason);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        Reject.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.Reject();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 0)
                            break;
                        message.type = reader.int32();
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        Reject.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.Reject";
        };

        Reject.RejectType = (function() {
            const valuesById = {}, values = Object.create(valuesById);
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

        function ServerSync(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        ServerSync.prototype.session = 0;
        ServerSync.prototype.maxBandwidth = 0;
        ServerSync.prototype.welcomeText = "";
        ServerSync.prototype.permissions = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        ServerSync.create = function create(properties) {
            return new ServerSync(properties);
        };

        ServerSync.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.session != null && Object.hasOwnProperty.call(message, "session"))
                writer.uint32(8).uint32(message.session);
            if (message.maxBandwidth != null && Object.hasOwnProperty.call(message, "maxBandwidth"))
                writer.uint32(16).uint32(message.maxBandwidth);
            if (message.welcomeText != null && Object.hasOwnProperty.call(message, "welcomeText"))
                writer.uint32(26).string(message.welcomeText);
            if (message.permissions != null && Object.hasOwnProperty.call(message, "permissions"))
                writer.uint32(32).uint64(message.permissions);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ServerSync.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ServerSync();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        ServerSync.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ServerSync";
        };

        return ServerSync;
    })();

    MumbleProto.ChannelRemove = (function() {

        function ChannelRemove(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        ChannelRemove.prototype.channelId = 0;

        ChannelRemove.create = function create(properties) {
            return new ChannelRemove(properties);
        };

        ChannelRemove.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            writer.uint32(8).uint32(message.channelId);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ChannelRemove.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ChannelRemove();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            if (!message.hasOwnProperty("channelId"))
                throw $util.ProtocolError("missing required 'channelId'", { instance: message });
            return message;
        };

        ChannelRemove.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ChannelRemove";
        };

        return ChannelRemove;
    })();

    MumbleProto.ChannelState = (function() {

        function ChannelState(properties) {
            this.links = [];
            this.linksAdd = [];
            this.linksRemove = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

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

        ChannelState.create = function create(properties) {
            return new ChannelState(properties);
        };

        ChannelState.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(8).uint32(message.channelId);
            if (message.parent != null && Object.hasOwnProperty.call(message, "parent"))
                writer.uint32(16).uint32(message.parent);
            if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                writer.uint32(26).string(message.name);
            if (message.links != null && message.links.length)
                for (let i = 0; i < message.links.length; ++i)
                    writer.uint32(32).uint32(message.links[i]);
            if (message.description != null && Object.hasOwnProperty.call(message, "description"))
                writer.uint32(42).string(message.description);
            if (message.linksAdd != null && message.linksAdd.length)
                for (let i = 0; i < message.linksAdd.length; ++i)
                    writer.uint32(48).uint32(message.linksAdd[i]);
            if (message.linksRemove != null && message.linksRemove.length)
                for (let i = 0; i < message.linksRemove.length; ++i)
                    writer.uint32(56).uint32(message.linksRemove[i]);
            if (message.temporary != null && Object.hasOwnProperty.call(message, "temporary"))
                writer.uint32(64).bool(message.temporary);
            if (message.position != null && Object.hasOwnProperty.call(message, "position"))
                writer.uint32(72).int32(message.position);
            if (message.descriptionHash != null && Object.hasOwnProperty.call(message, "descriptionHash"))
                writer.uint32(82).bytes(message.descriptionHash);
            if (message.maxUsers != null && Object.hasOwnProperty.call(message, "maxUsers"))
                writer.uint32(88).uint32(message.maxUsers);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ChannelState.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ChannelState();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.links.push(reader.uint32());
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
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.linksAdd.push(reader.uint32());
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
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.linksRemove.push(reader.uint32());
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        ChannelState.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ChannelState";
        };

        return ChannelState;
    })();

    MumbleProto.UserRemove = (function() {

        function UserRemove(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        UserRemove.prototype.session = 0;
        UserRemove.prototype.actor = 0;
        UserRemove.prototype.reason = "";
        UserRemove.prototype.ban = false;

        UserRemove.create = function create(properties) {
            return new UserRemove(properties);
        };

        UserRemove.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            writer.uint32(8).uint32(message.session);
            if (message.actor != null && Object.hasOwnProperty.call(message, "actor"))
                writer.uint32(16).uint32(message.actor);
            if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                writer.uint32(26).string(message.reason);
            if (message.ban != null && Object.hasOwnProperty.call(message, "ban"))
                writer.uint32(32).bool(message.ban);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        UserRemove.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserRemove();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            if (!message.hasOwnProperty("session"))
                throw $util.ProtocolError("missing required 'session'", { instance: message });
            return message;
        };

        UserRemove.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.UserRemove";
        };

        return UserRemove;
    })();

    MumbleProto.UserState = (function() {

        function UserState(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

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

        UserState.create = function create(properties) {
            return new UserState(properties);
        };

        UserState.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.session != null && Object.hasOwnProperty.call(message, "session"))
                writer.uint32(8).uint32(message.session);
            if (message.actor != null && Object.hasOwnProperty.call(message, "actor"))
                writer.uint32(16).uint32(message.actor);
            if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                writer.uint32(26).string(message.name);
            if (message.userId != null && Object.hasOwnProperty.call(message, "userId"))
                writer.uint32(32).uint32(message.userId);
            if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(40).uint32(message.channelId);
            if (message.mute != null && Object.hasOwnProperty.call(message, "mute"))
                writer.uint32(48).bool(message.mute);
            if (message.deaf != null && Object.hasOwnProperty.call(message, "deaf"))
                writer.uint32(56).bool(message.deaf);
            if (message.suppress != null && Object.hasOwnProperty.call(message, "suppress"))
                writer.uint32(64).bool(message.suppress);
            if (message.selfMute != null && Object.hasOwnProperty.call(message, "selfMute"))
                writer.uint32(72).bool(message.selfMute);
            if (message.selfDeaf != null && Object.hasOwnProperty.call(message, "selfDeaf"))
                writer.uint32(80).bool(message.selfDeaf);
            if (message.texture != null && Object.hasOwnProperty.call(message, "texture"))
                writer.uint32(90).bytes(message.texture);
            if (message.pluginContext != null && Object.hasOwnProperty.call(message, "pluginContext"))
                writer.uint32(98).bytes(message.pluginContext);
            if (message.pluginIdentity != null && Object.hasOwnProperty.call(message, "pluginIdentity"))
                writer.uint32(106).string(message.pluginIdentity);
            if (message.comment != null && Object.hasOwnProperty.call(message, "comment"))
                writer.uint32(114).string(message.comment);
            if (message.hash != null && Object.hasOwnProperty.call(message, "hash"))
                writer.uint32(122).string(message.hash);
            if (message.commentHash != null && Object.hasOwnProperty.call(message, "commentHash"))
                writer.uint32(130).bytes(message.commentHash);
            if (message.textureHash != null && Object.hasOwnProperty.call(message, "textureHash"))
                writer.uint32(138).bytes(message.textureHash);
            if (message.prioritySpeaker != null && Object.hasOwnProperty.call(message, "prioritySpeaker"))
                writer.uint32(144).bool(message.prioritySpeaker);
            if (message.recording != null && Object.hasOwnProperty.call(message, "recording"))
                writer.uint32(152).bool(message.recording);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        UserState.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserState();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        UserState.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.UserState";
        };

        return UserState;
    })();

    MumbleProto.BanList = (function() {

        function BanList(properties) {
            this.bans = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        BanList.prototype.bans = $util.emptyArray;
        BanList.prototype.query = false;

        BanList.create = function create(properties) {
            return new BanList(properties);
        };

        BanList.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.bans != null && message.bans.length)
                for (let i = 0; i < message.bans.length; ++i)
                    $root.MumbleProto.BanList.BanEntry.encode(message.bans[i], writer.uint32(10).fork(), _depth + 1).ldelim();
            if (message.query != null && Object.hasOwnProperty.call(message, "query"))
                writer.uint32(16).bool(message.query);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        BanList.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.BanList();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 2)
                            break;
                        if (!(message.bans && message.bans.length))
                            message.bans = [];
                        message.bans.push($root.MumbleProto.BanList.BanEntry.decode(reader, reader.uint32(), undefined, _depth + 1));
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        BanList.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.BanList";
        };

        BanList.BanEntry = (function() {

            function BanEntry(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            BanEntry.prototype.address = $util.newBuffer([]);
            BanEntry.prototype.mask = 0;
            BanEntry.prototype.name = "";
            BanEntry.prototype.hash = "";
            BanEntry.prototype.reason = "";
            BanEntry.prototype.start = "";
            BanEntry.prototype.duration = 0;

            BanEntry.create = function create(properties) {
                return new BanEntry(properties);
            };

            BanEntry.encode = function encode(message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw Error("max depth exceeded");
                writer.uint32(10).bytes(message.address);
                writer.uint32(16).uint32(message.mask);
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    writer.uint32(26).string(message.name);
                if (message.hash != null && Object.hasOwnProperty.call(message, "hash"))
                    writer.uint32(34).string(message.hash);
                if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                    writer.uint32(42).string(message.reason);
                if (message.start != null && Object.hasOwnProperty.call(message, "start"))
                    writer.uint32(50).string(message.start);
                if (message.duration != null && Object.hasOwnProperty.call(message, "duration"))
                    writer.uint32(56).uint32(message.duration);
                if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            BanEntry.decode = function decode(reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw Error("max depth exceeded");
                let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.BanList.BanEntry();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = undefined;
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
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
                if (_end !== undefined)
                    throw Error("missing end group");
                if (!message.hasOwnProperty("address"))
                    throw $util.ProtocolError("missing required 'address'", { instance: message });
                if (!message.hasOwnProperty("mask"))
                    throw $util.ProtocolError("missing required 'mask'", { instance: message });
                return message;
            };

            BanEntry.getTypeUrl = function getTypeUrl(prefix) {
                if (prefix === undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.BanList.BanEntry";
            };

            return BanEntry;
        })();

        return BanList;
    })();

    MumbleProto.TextMessage = (function() {

        function TextMessage(properties) {
            this.session = [];
            this.channelId = [];
            this.treeId = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        TextMessage.prototype.actor = 0;
        TextMessage.prototype.session = $util.emptyArray;
        TextMessage.prototype.channelId = $util.emptyArray;
        TextMessage.prototype.treeId = $util.emptyArray;
        TextMessage.prototype.message = "";

        TextMessage.create = function create(properties) {
            return new TextMessage(properties);
        };

        TextMessage.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.actor != null && Object.hasOwnProperty.call(message, "actor"))
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
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        TextMessage.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.TextMessage();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.session.push(reader.uint32());
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
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.channelId.push(reader.uint32());
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
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.treeId.push(reader.uint32());
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            if (!message.hasOwnProperty("message"))
                throw $util.ProtocolError("missing required 'message'", { instance: message });
            return message;
        };

        TextMessage.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.TextMessage";
        };

        return TextMessage;
    })();

    MumbleProto.PermissionDenied = (function() {

        function PermissionDenied(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        PermissionDenied.prototype.permission = 0;
        PermissionDenied.prototype.channelId = 0;
        PermissionDenied.prototype.session = 0;
        PermissionDenied.prototype.reason = "";
        PermissionDenied.prototype.type = 0;
        PermissionDenied.prototype.name = "";

        PermissionDenied.create = function create(properties) {
            return new PermissionDenied(properties);
        };

        PermissionDenied.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.permission != null && Object.hasOwnProperty.call(message, "permission"))
                writer.uint32(8).uint32(message.permission);
            if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(16).uint32(message.channelId);
            if (message.session != null && Object.hasOwnProperty.call(message, "session"))
                writer.uint32(24).uint32(message.session);
            if (message.reason != null && Object.hasOwnProperty.call(message, "reason"))
                writer.uint32(34).string(message.reason);
            if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                writer.uint32(40).int32(message.type);
            if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                writer.uint32(50).string(message.name);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        PermissionDenied.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.PermissionDenied();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                        message.type = reader.int32();
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        PermissionDenied.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.PermissionDenied";
        };

        PermissionDenied.DenyType = (function() {
            const valuesById = {}, values = Object.create(valuesById);
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

        function ACL(properties) {
            this.groups = [];
            this.acls = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        ACL.prototype.channelId = 0;
        ACL.prototype.inheritAcls = true;
        ACL.prototype.groups = $util.emptyArray;
        ACL.prototype.acls = $util.emptyArray;
        ACL.prototype.query = false;

        ACL.create = function create(properties) {
            return new ACL(properties);
        };

        ACL.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            writer.uint32(8).uint32(message.channelId);
            if (message.inheritAcls != null && Object.hasOwnProperty.call(message, "inheritAcls"))
                writer.uint32(16).bool(message.inheritAcls);
            if (message.groups != null && message.groups.length)
                for (let i = 0; i < message.groups.length; ++i)
                    $root.MumbleProto.ACL.ChanGroup.encode(message.groups[i], writer.uint32(26).fork(), _depth + 1).ldelim();
            if (message.acls != null && message.acls.length)
                for (let i = 0; i < message.acls.length; ++i)
                    $root.MumbleProto.ACL.ChanACL.encode(message.acls[i], writer.uint32(34).fork(), _depth + 1).ldelim();
            if (message.query != null && Object.hasOwnProperty.call(message, "query"))
                writer.uint32(40).bool(message.query);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ACL.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ACL();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                        message.groups.push($root.MumbleProto.ACL.ChanGroup.decode(reader, reader.uint32(), undefined, _depth + 1));
                        continue;
                    }
                case 4: {
                        if (wireType !== 2)
                            break;
                        if (!(message.acls && message.acls.length))
                            message.acls = [];
                        message.acls.push($root.MumbleProto.ACL.ChanACL.decode(reader, reader.uint32(), undefined, _depth + 1));
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            if (!message.hasOwnProperty("channelId"))
                throw $util.ProtocolError("missing required 'channelId'", { instance: message });
            return message;
        };

        ACL.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ACL";
        };

        ACL.ChanGroup = (function() {

            function ChanGroup(properties) {
                this.add = [];
                this.remove = [];
                this.inheritedMembers = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            ChanGroup.prototype.name = "";
            ChanGroup.prototype.inherited = true;
            ChanGroup.prototype.inherit = true;
            ChanGroup.prototype.inheritable = true;
            ChanGroup.prototype.add = $util.emptyArray;
            ChanGroup.prototype.remove = $util.emptyArray;
            ChanGroup.prototype.inheritedMembers = $util.emptyArray;

            ChanGroup.create = function create(properties) {
                return new ChanGroup(properties);
            };

            ChanGroup.encode = function encode(message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw Error("max depth exceeded");
                writer.uint32(10).string(message.name);
                if (message.inherited != null && Object.hasOwnProperty.call(message, "inherited"))
                    writer.uint32(16).bool(message.inherited);
                if (message.inherit != null && Object.hasOwnProperty.call(message, "inherit"))
                    writer.uint32(24).bool(message.inherit);
                if (message.inheritable != null && Object.hasOwnProperty.call(message, "inheritable"))
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
                if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            ChanGroup.decode = function decode(reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw Error("max depth exceeded");
                let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ACL.ChanGroup();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = undefined;
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
                                let end2 = reader.uint32() + reader.pos;
                                while (reader.pos < end2)
                                    message.add.push(reader.uint32());
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
                                let end2 = reader.uint32() + reader.pos;
                                while (reader.pos < end2)
                                    message.remove.push(reader.uint32());
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
                                let end2 = reader.uint32() + reader.pos;
                                while (reader.pos < end2)
                                    message.inheritedMembers.push(reader.uint32());
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
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
                if (_end !== undefined)
                    throw Error("missing end group");
                if (!message.hasOwnProperty("name"))
                    throw $util.ProtocolError("missing required 'name'", { instance: message });
                return message;
            };

            ChanGroup.getTypeUrl = function getTypeUrl(prefix) {
                if (prefix === undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.ACL.ChanGroup";
            };

            return ChanGroup;
        })();

        ACL.ChanACL = (function() {

            function ChanACL(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            ChanACL.prototype.applyHere = true;
            ChanACL.prototype.applySubs = true;
            ChanACL.prototype.inherited = true;
            ChanACL.prototype.userId = 0;
            ChanACL.prototype.group = "";
            ChanACL.prototype.grant = 0;
            ChanACL.prototype.deny = 0;

            ChanACL.create = function create(properties) {
                return new ChanACL(properties);
            };

            ChanACL.encode = function encode(message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.applyHere != null && Object.hasOwnProperty.call(message, "applyHere"))
                    writer.uint32(8).bool(message.applyHere);
                if (message.applySubs != null && Object.hasOwnProperty.call(message, "applySubs"))
                    writer.uint32(16).bool(message.applySubs);
                if (message.inherited != null && Object.hasOwnProperty.call(message, "inherited"))
                    writer.uint32(24).bool(message.inherited);
                if (message.userId != null && Object.hasOwnProperty.call(message, "userId"))
                    writer.uint32(32).uint32(message.userId);
                if (message.group != null && Object.hasOwnProperty.call(message, "group"))
                    writer.uint32(42).string(message.group);
                if (message.grant != null && Object.hasOwnProperty.call(message, "grant"))
                    writer.uint32(48).uint32(message.grant);
                if (message.deny != null && Object.hasOwnProperty.call(message, "deny"))
                    writer.uint32(56).uint32(message.deny);
                if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            ChanACL.decode = function decode(reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw Error("max depth exceeded");
                let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ACL.ChanACL();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = undefined;
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
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
                if (_end !== undefined)
                    throw Error("missing end group");
                return message;
            };

            ChanACL.getTypeUrl = function getTypeUrl(prefix) {
                if (prefix === undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.ACL.ChanACL";
            };

            return ChanACL;
        })();

        return ACL;
    })();

    MumbleProto.QueryUsers = (function() {

        function QueryUsers(properties) {
            this.ids = [];
            this.names = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        QueryUsers.prototype.ids = $util.emptyArray;
        QueryUsers.prototype.names = $util.emptyArray;

        QueryUsers.create = function create(properties) {
            return new QueryUsers(properties);
        };

        QueryUsers.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.ids != null && message.ids.length)
                for (let i = 0; i < message.ids.length; ++i)
                    writer.uint32(8).uint32(message.ids[i]);
            if (message.names != null && message.names.length)
                for (let i = 0; i < message.names.length; ++i)
                    writer.uint32(18).string(message.names[i]);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        QueryUsers.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.QueryUsers();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType === 2) {
                            if (!(message.ids && message.ids.length))
                                message.ids = [];
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.ids.push(reader.uint32());
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        QueryUsers.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.QueryUsers";
        };

        return QueryUsers;
    })();

    MumbleProto.CryptSetup = (function() {

        function CryptSetup(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        CryptSetup.prototype.key = $util.newBuffer([]);
        CryptSetup.prototype.clientNonce = $util.newBuffer([]);
        CryptSetup.prototype.serverNonce = $util.newBuffer([]);

        CryptSetup.create = function create(properties) {
            return new CryptSetup(properties);
        };

        CryptSetup.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.key != null && Object.hasOwnProperty.call(message, "key"))
                writer.uint32(10).bytes(message.key);
            if (message.clientNonce != null && Object.hasOwnProperty.call(message, "clientNonce"))
                writer.uint32(18).bytes(message.clientNonce);
            if (message.serverNonce != null && Object.hasOwnProperty.call(message, "serverNonce"))
                writer.uint32(26).bytes(message.serverNonce);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        CryptSetup.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.CryptSetup();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        CryptSetup.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.CryptSetup";
        };

        return CryptSetup;
    })();

    MumbleProto.ContextActionModify = (function() {

        function ContextActionModify(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        ContextActionModify.prototype.action = "";
        ContextActionModify.prototype.text = "";
        ContextActionModify.prototype.context = 0;
        ContextActionModify.prototype.operation = 0;

        ContextActionModify.create = function create(properties) {
            return new ContextActionModify(properties);
        };

        ContextActionModify.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            writer.uint32(10).string(message.action);
            if (message.text != null && Object.hasOwnProperty.call(message, "text"))
                writer.uint32(18).string(message.text);
            if (message.context != null && Object.hasOwnProperty.call(message, "context"))
                writer.uint32(24).uint32(message.context);
            if (message.operation != null && Object.hasOwnProperty.call(message, "operation"))
                writer.uint32(32).int32(message.operation);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ContextActionModify.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ContextActionModify();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                        message.operation = reader.int32();
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            if (!message.hasOwnProperty("action"))
                throw $util.ProtocolError("missing required 'action'", { instance: message });
            return message;
        };

        ContextActionModify.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ContextActionModify";
        };

        ContextActionModify.Context = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[1] = "Server"] = 1;
            values[valuesById[2] = "Channel"] = 2;
            values[valuesById[4] = "User"] = 4;
            return values;
        })();

        ContextActionModify.Operation = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "Add"] = 0;
            values[valuesById[1] = "Remove"] = 1;
            return values;
        })();

        return ContextActionModify;
    })();

    MumbleProto.ContextAction = (function() {

        function ContextAction(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        ContextAction.prototype.session = 0;
        ContextAction.prototype.channelId = 0;
        ContextAction.prototype.action = "";

        ContextAction.create = function create(properties) {
            return new ContextAction(properties);
        };

        ContextAction.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.session != null && Object.hasOwnProperty.call(message, "session"))
                writer.uint32(8).uint32(message.session);
            if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(16).uint32(message.channelId);
            writer.uint32(26).string(message.action);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ContextAction.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ContextAction();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            if (!message.hasOwnProperty("action"))
                throw $util.ProtocolError("missing required 'action'", { instance: message });
            return message;
        };

        ContextAction.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ContextAction";
        };

        return ContextAction;
    })();

    MumbleProto.UserList = (function() {

        function UserList(properties) {
            this.users = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        UserList.prototype.users = $util.emptyArray;

        UserList.create = function create(properties) {
            return new UserList(properties);
        };

        UserList.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.users != null && message.users.length)
                for (let i = 0; i < message.users.length; ++i)
                    $root.MumbleProto.UserList.User.encode(message.users[i], writer.uint32(10).fork(), _depth + 1).ldelim();
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        UserList.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserList();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType !== 2)
                            break;
                        if (!(message.users && message.users.length))
                            message.users = [];
                        message.users.push($root.MumbleProto.UserList.User.decode(reader, reader.uint32(), undefined, _depth + 1));
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        UserList.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.UserList";
        };

        UserList.User = (function() {

            function User(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            User.prototype.userId = 0;
            User.prototype.name = "";
            User.prototype.lastSeen = "";
            User.prototype.lastChannel = 0;

            User.create = function create(properties) {
                return new User(properties);
            };

            User.encode = function encode(message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw Error("max depth exceeded");
                writer.uint32(8).uint32(message.userId);
                if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                    writer.uint32(18).string(message.name);
                if (message.lastSeen != null && Object.hasOwnProperty.call(message, "lastSeen"))
                    writer.uint32(26).string(message.lastSeen);
                if (message.lastChannel != null && Object.hasOwnProperty.call(message, "lastChannel"))
                    writer.uint32(32).uint32(message.lastChannel);
                if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            User.decode = function decode(reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw Error("max depth exceeded");
                let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserList.User();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = undefined;
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
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
                if (_end !== undefined)
                    throw Error("missing end group");
                if (!message.hasOwnProperty("userId"))
                    throw $util.ProtocolError("missing required 'userId'", { instance: message });
                return message;
            };

            User.getTypeUrl = function getTypeUrl(prefix) {
                if (prefix === undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.UserList.User";
            };

            return User;
        })();

        return UserList;
    })();

    MumbleProto.VoiceTarget = (function() {

        function VoiceTarget(properties) {
            this.targets = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        VoiceTarget.prototype.id = 0;
        VoiceTarget.prototype.targets = $util.emptyArray;

        VoiceTarget.create = function create(properties) {
            return new VoiceTarget(properties);
        };

        VoiceTarget.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(8).uint32(message.id);
            if (message.targets != null && message.targets.length)
                for (let i = 0; i < message.targets.length; ++i)
                    $root.MumbleProto.VoiceTarget.Target.encode(message.targets[i], writer.uint32(18).fork(), _depth + 1).ldelim();
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        VoiceTarget.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.VoiceTarget();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                        message.targets.push($root.MumbleProto.VoiceTarget.Target.decode(reader, reader.uint32(), undefined, _depth + 1));
                        continue;
                    }
                }
                reader.skipType(wireType, _depth, tag);
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        VoiceTarget.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.VoiceTarget";
        };

        VoiceTarget.Target = (function() {

            function Target(properties) {
                this.session = [];
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            Target.prototype.session = $util.emptyArray;
            Target.prototype.channelId = 0;
            Target.prototype.group = "";
            Target.prototype.links = false;
            Target.prototype.children = false;

            Target.create = function create(properties) {
                return new Target(properties);
            };

            Target.encode = function encode(message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.session != null && message.session.length)
                    for (let i = 0; i < message.session.length; ++i)
                        writer.uint32(8).uint32(message.session[i]);
                if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                    writer.uint32(16).uint32(message.channelId);
                if (message.group != null && Object.hasOwnProperty.call(message, "group"))
                    writer.uint32(26).string(message.group);
                if (message.links != null && Object.hasOwnProperty.call(message, "links"))
                    writer.uint32(32).bool(message.links);
                if (message.children != null && Object.hasOwnProperty.call(message, "children"))
                    writer.uint32(40).bool(message.children);
                if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            Target.decode = function decode(reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw Error("max depth exceeded");
                let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.VoiceTarget.Target();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = undefined;
                        break;
                    }
                    let wireType = tag & 7;
                    switch (tag >>>= 3) {
                    case 1: {
                            if (wireType === 2) {
                                if (!(message.session && message.session.length))
                                    message.session = [];
                                let end2 = reader.uint32() + reader.pos;
                                while (reader.pos < end2)
                                    message.session.push(reader.uint32());
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
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
                if (_end !== undefined)
                    throw Error("missing end group");
                return message;
            };

            Target.getTypeUrl = function getTypeUrl(prefix) {
                if (prefix === undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.VoiceTarget.Target";
            };

            return Target;
        })();

        return VoiceTarget;
    })();

    MumbleProto.PermissionQuery = (function() {

        function PermissionQuery(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        PermissionQuery.prototype.channelId = 0;
        PermissionQuery.prototype.permissions = 0;
        PermissionQuery.prototype.flush = false;

        PermissionQuery.create = function create(properties) {
            return new PermissionQuery(properties);
        };

        PermissionQuery.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.channelId != null && Object.hasOwnProperty.call(message, "channelId"))
                writer.uint32(8).uint32(message.channelId);
            if (message.permissions != null && Object.hasOwnProperty.call(message, "permissions"))
                writer.uint32(16).uint32(message.permissions);
            if (message.flush != null && Object.hasOwnProperty.call(message, "flush"))
                writer.uint32(24).bool(message.flush);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        PermissionQuery.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.PermissionQuery();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        PermissionQuery.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.PermissionQuery";
        };

        return PermissionQuery;
    })();

    MumbleProto.CodecVersion = (function() {

        function CodecVersion(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        CodecVersion.prototype.alpha = 0;
        CodecVersion.prototype.beta = 0;
        CodecVersion.prototype.preferAlpha = true;
        CodecVersion.prototype.opus = false;

        CodecVersion.create = function create(properties) {
            return new CodecVersion(properties);
        };

        CodecVersion.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            writer.uint32(8).int32(message.alpha);
            writer.uint32(16).int32(message.beta);
            writer.uint32(24).bool(message.preferAlpha);
            if (message.opus != null && Object.hasOwnProperty.call(message, "opus"))
                writer.uint32(32).bool(message.opus);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        CodecVersion.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.CodecVersion();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            if (!message.hasOwnProperty("alpha"))
                throw $util.ProtocolError("missing required 'alpha'", { instance: message });
            if (!message.hasOwnProperty("beta"))
                throw $util.ProtocolError("missing required 'beta'", { instance: message });
            if (!message.hasOwnProperty("preferAlpha"))
                throw $util.ProtocolError("missing required 'preferAlpha'", { instance: message });
            return message;
        };

        CodecVersion.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.CodecVersion";
        };

        return CodecVersion;
    })();

    MumbleProto.UserStats = (function() {

        function UserStats(properties) {
            this.certificates = [];
            this.celtVersions = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

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

        UserStats.create = function create(properties) {
            return new UserStats(properties);
        };

        UserStats.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.session != null && Object.hasOwnProperty.call(message, "session"))
                writer.uint32(8).uint32(message.session);
            if (message.statsOnly != null && Object.hasOwnProperty.call(message, "statsOnly"))
                writer.uint32(16).bool(message.statsOnly);
            if (message.certificates != null && message.certificates.length)
                for (let i = 0; i < message.certificates.length; ++i)
                    writer.uint32(26).bytes(message.certificates[i]);
            if (message.fromClient != null && Object.hasOwnProperty.call(message, "fromClient"))
                $root.MumbleProto.UserStats.Stats.encode(message.fromClient, writer.uint32(34).fork(), _depth + 1).ldelim();
            if (message.fromServer != null && Object.hasOwnProperty.call(message, "fromServer"))
                $root.MumbleProto.UserStats.Stats.encode(message.fromServer, writer.uint32(42).fork(), _depth + 1).ldelim();
            if (message.udpPackets != null && Object.hasOwnProperty.call(message, "udpPackets"))
                writer.uint32(48).uint32(message.udpPackets);
            if (message.tcpPackets != null && Object.hasOwnProperty.call(message, "tcpPackets"))
                writer.uint32(56).uint32(message.tcpPackets);
            if (message.udpPingAvg != null && Object.hasOwnProperty.call(message, "udpPingAvg"))
                writer.uint32(69).float(message.udpPingAvg);
            if (message.udpPingVar != null && Object.hasOwnProperty.call(message, "udpPingVar"))
                writer.uint32(77).float(message.udpPingVar);
            if (message.tcpPingAvg != null && Object.hasOwnProperty.call(message, "tcpPingAvg"))
                writer.uint32(85).float(message.tcpPingAvg);
            if (message.tcpPingVar != null && Object.hasOwnProperty.call(message, "tcpPingVar"))
                writer.uint32(93).float(message.tcpPingVar);
            if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                $root.MumbleProto.Version.encode(message.version, writer.uint32(98).fork(), _depth + 1).ldelim();
            if (message.celtVersions != null && message.celtVersions.length)
                for (let i = 0; i < message.celtVersions.length; ++i)
                    writer.uint32(104).int32(message.celtVersions[i]);
            if (message.address != null && Object.hasOwnProperty.call(message, "address"))
                writer.uint32(114).bytes(message.address);
            if (message.bandwidth != null && Object.hasOwnProperty.call(message, "bandwidth"))
                writer.uint32(120).uint32(message.bandwidth);
            if (message.onlinesecs != null && Object.hasOwnProperty.call(message, "onlinesecs"))
                writer.uint32(128).uint32(message.onlinesecs);
            if (message.idlesecs != null && Object.hasOwnProperty.call(message, "idlesecs"))
                writer.uint32(136).uint32(message.idlesecs);
            if (message.strongCertificate != null && Object.hasOwnProperty.call(message, "strongCertificate"))
                writer.uint32(144).bool(message.strongCertificate);
            if (message.opus != null && Object.hasOwnProperty.call(message, "opus"))
                writer.uint32(152).bool(message.opus);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        UserStats.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserStats();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                        message.fromClient = $root.MumbleProto.UserStats.Stats.decode(reader, reader.uint32(), undefined, _depth + 1, message.fromClient);
                        continue;
                    }
                case 5: {
                        if (wireType !== 2)
                            break;
                        message.fromServer = $root.MumbleProto.UserStats.Stats.decode(reader, reader.uint32(), undefined, _depth + 1, message.fromServer);
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
                        message.version = $root.MumbleProto.Version.decode(reader, reader.uint32(), undefined, _depth + 1, message.version);
                        continue;
                    }
                case 13: {
                        if (wireType === 2) {
                            if (!(message.celtVersions && message.celtVersions.length))
                                message.celtVersions = [];
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.celtVersions.push(reader.int32());
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        UserStats.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.UserStats";
        };

        UserStats.Stats = (function() {

            function Stats(properties) {
                if (properties)
                    for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                        if (properties[keys[i]] != null && keys[i] !== "__proto__")
                            this[keys[i]] = properties[keys[i]];
            }

            Stats.prototype.good = 0;
            Stats.prototype.late = 0;
            Stats.prototype.lost = 0;
            Stats.prototype.resync = 0;

            Stats.create = function create(properties) {
                return new Stats(properties);
            };

            Stats.encode = function encode(message, writer, _depth) {
                if (!writer)
                    writer = $Writer.create();
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $util.recursionLimit)
                    throw Error("max depth exceeded");
                if (message.good != null && Object.hasOwnProperty.call(message, "good"))
                    writer.uint32(8).uint32(message.good);
                if (message.late != null && Object.hasOwnProperty.call(message, "late"))
                    writer.uint32(16).uint32(message.late);
                if (message.lost != null && Object.hasOwnProperty.call(message, "lost"))
                    writer.uint32(24).uint32(message.lost);
                if (message.resync != null && Object.hasOwnProperty.call(message, "resync"))
                    writer.uint32(32).uint32(message.resync);
                if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                    for (let i = 0; i < message.$unknowns.length; ++i)
                        writer.raw(message.$unknowns[i]);
                return writer;
            };

            Stats.decode = function decode(reader, length, _end, _depth, _target) {
                if (!(reader instanceof $Reader))
                    reader = $Reader.create(reader);
                if (_depth === undefined)
                    _depth = 0;
                if (_depth > $Reader.recursionLimit)
                    throw Error("max depth exceeded");
                let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.UserStats.Stats();
                while (reader.pos < end) {
                    let start = reader.pos;
                    let tag = reader.tag();
                    if (tag === _end) {
                        _end = undefined;
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
                    $util.makeProp(message, "$unknowns", false);
                    (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
                }
                if (_end !== undefined)
                    throw Error("missing end group");
                return message;
            };

            Stats.getTypeUrl = function getTypeUrl(prefix) {
                if (prefix === undefined)
                    prefix = "type.googleapis.com";
                return prefix + "/MumbleProto.UserStats.Stats";
            };

            return Stats;
        })();

        return UserStats;
    })();

    MumbleProto.RequestBlob = (function() {

        function RequestBlob(properties) {
            this.sessionTexture = [];
            this.sessionComment = [];
            this.channelDescription = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        RequestBlob.prototype.sessionTexture = $util.emptyArray;
        RequestBlob.prototype.sessionComment = $util.emptyArray;
        RequestBlob.prototype.channelDescription = $util.emptyArray;

        RequestBlob.create = function create(properties) {
            return new RequestBlob(properties);
        };

        RequestBlob.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.sessionTexture != null && message.sessionTexture.length)
                for (let i = 0; i < message.sessionTexture.length; ++i)
                    writer.uint32(8).uint32(message.sessionTexture[i]);
            if (message.sessionComment != null && message.sessionComment.length)
                for (let i = 0; i < message.sessionComment.length; ++i)
                    writer.uint32(16).uint32(message.sessionComment[i]);
            if (message.channelDescription != null && message.channelDescription.length)
                for (let i = 0; i < message.channelDescription.length; ++i)
                    writer.uint32(24).uint32(message.channelDescription[i]);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        RequestBlob.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.RequestBlob();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
                    break;
                }
                let wireType = tag & 7;
                switch (tag >>>= 3) {
                case 1: {
                        if (wireType === 2) {
                            if (!(message.sessionTexture && message.sessionTexture.length))
                                message.sessionTexture = [];
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.sessionTexture.push(reader.uint32());
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
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.sessionComment.push(reader.uint32());
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
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.channelDescription.push(reader.uint32());
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        RequestBlob.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.RequestBlob";
        };

        return RequestBlob;
    })();

    MumbleProto.ServerConfig = (function() {

        function ServerConfig(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        ServerConfig.prototype.maxBandwidth = 0;
        ServerConfig.prototype.welcomeText = "";
        ServerConfig.prototype.allowHtml = false;
        ServerConfig.prototype.messageLength = 0;
        ServerConfig.prototype.imageMessageLength = 0;
        ServerConfig.prototype.maxUsers = 0;

        ServerConfig.create = function create(properties) {
            return new ServerConfig(properties);
        };

        ServerConfig.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.maxBandwidth != null && Object.hasOwnProperty.call(message, "maxBandwidth"))
                writer.uint32(8).uint32(message.maxBandwidth);
            if (message.welcomeText != null && Object.hasOwnProperty.call(message, "welcomeText"))
                writer.uint32(18).string(message.welcomeText);
            if (message.allowHtml != null && Object.hasOwnProperty.call(message, "allowHtml"))
                writer.uint32(24).bool(message.allowHtml);
            if (message.messageLength != null && Object.hasOwnProperty.call(message, "messageLength"))
                writer.uint32(32).uint32(message.messageLength);
            if (message.imageMessageLength != null && Object.hasOwnProperty.call(message, "imageMessageLength"))
                writer.uint32(40).uint32(message.imageMessageLength);
            if (message.maxUsers != null && Object.hasOwnProperty.call(message, "maxUsers"))
                writer.uint32(48).uint32(message.maxUsers);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        ServerConfig.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.ServerConfig();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        ServerConfig.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
                prefix = "type.googleapis.com";
            return prefix + "/MumbleProto.ServerConfig";
        };

        return ServerConfig;
    })();

    MumbleProto.SuggestConfig = (function() {

        function SuggestConfig(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        SuggestConfig.prototype.version = 0;
        SuggestConfig.prototype.positional = false;
        SuggestConfig.prototype.pushToTalk = false;

        SuggestConfig.create = function create(properties) {
            return new SuggestConfig(properties);
        };

        SuggestConfig.encode = function encode(message, writer, _depth) {
            if (!writer)
                writer = $Writer.create();
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.version != null && Object.hasOwnProperty.call(message, "version"))
                writer.uint32(8).uint32(message.version);
            if (message.positional != null && Object.hasOwnProperty.call(message, "positional"))
                writer.uint32(16).bool(message.positional);
            if (message.pushToTalk != null && Object.hasOwnProperty.call(message, "pushToTalk"))
                writer.uint32(24).bool(message.pushToTalk);
            if (message.$unknowns != null && Object.hasOwnProperty.call(message, "$unknowns"))
                for (let i = 0; i < message.$unknowns.length; ++i)
                    writer.raw(message.$unknowns[i]);
            return writer;
        };

        SuggestConfig.decode = function decode(reader, length, _end, _depth, _target) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (_depth === undefined)
                _depth = 0;
            if (_depth > $Reader.recursionLimit)
                throw Error("max depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = _target || new $root.MumbleProto.SuggestConfig();
            while (reader.pos < end) {
                let start = reader.pos;
                let tag = reader.tag();
                if (tag === _end) {
                    _end = undefined;
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
                $util.makeProp(message, "$unknowns", false);
                (message.$unknowns || (message.$unknowns = [])).push(reader.raw(start, reader.pos));
            }
            if (_end !== undefined)
                throw Error("missing end group");
            return message;
        };

        SuggestConfig.getTypeUrl = function getTypeUrl(prefix) {
            if (prefix === undefined)
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
