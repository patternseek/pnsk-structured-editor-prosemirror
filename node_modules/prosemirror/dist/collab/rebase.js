"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.rebaseSteps = rebaseSteps;

var _transform = require("../transform");

function rebaseSteps(doc, forward, steps, maps) {
  var remap = new _transform.Remapping([], forward.slice());
  var transform = new _transform.Transform(doc);
  var positions = [];

  for (var i = 0; i < steps.length; i++) {
    var step = (0, _transform.mapStep)(steps[i], remap);
    var result = step && transform.step(step);
    var id = remap.addToFront(maps[i].invert());
    if (result) {
      remap.addToBack(result.map, id);
      positions.push(transform.steps.length - 1);
    } else {
      positions.push(-1);
    }
  }
  return { doc: transform.doc, transform: transform, mapping: remap, positions: positions };
}