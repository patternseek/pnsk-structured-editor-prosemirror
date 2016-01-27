"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convertFrom = convertFrom;
exports.knownSource = knownSource;
exports.defineSource = defineSource;
var parsers = Object.create(null);

function convertFrom(schema, value, format, arg) {
  var converter = parsers[format];
  if (!converter) throw new Error("Source format " + format + " not defined");
  return converter(schema, value, arg);
}

function knownSource(format) {
  return !!parsers[format];
}

function defineSource(format, func) {
  parsers[format] = func;
}

defineSource("json", function (schema, json) {
  return schema.nodeFromJSON(json);
});