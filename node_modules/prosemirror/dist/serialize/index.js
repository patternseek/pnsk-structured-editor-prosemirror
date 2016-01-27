"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convertTo = convertTo;
exports.knownTarget = knownTarget;
exports.defineTarget = defineTarget;
var serializers = Object.create(null);

function convertTo(doc, format, arg) {
  var converter = serializers[format];
  if (!converter) throw new Error("Target format " + format + " not defined");
  return converter(doc, arg);
}

function knownTarget(format) {
  return !!serializers[format];
}

function defineTarget(format, func) {
  serializers[format] = func;
}

defineTarget("json", function (doc) {
  return doc.toJSON();
});