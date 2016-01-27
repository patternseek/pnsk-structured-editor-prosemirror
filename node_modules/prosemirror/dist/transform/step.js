"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

exports.defineStep = defineStep;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _model = require("../model");

var Step = (function () {
  function Step(name, from, to, pos) {
    var param = arguments.length <= 4 || arguments[4] === undefined ? null : arguments[4];

    _classCallCheck(this, Step);

    if (!(name in steps)) throw new Error("Unknown step type: " + name);
    this.name = name;
    this.from = from;
    this.to = to;
    this.pos = pos;
    this.param = param;
  }

  _createClass(Step, [{
    key: "apply",
    value: function apply(doc) {
      return steps[this.name].apply(doc, this);
    }
  }, {
    key: "invert",
    value: function invert(oldDoc, map) {
      return steps[this.name].invert(this, oldDoc, map);
    }
  }, {
    key: "toJSON",
    value: function toJSON() {
      var impl = steps[this.name];
      return {
        name: this.name,
        from: this.from,
        to: this.to,
        pos: this.pos,
        param: impl.paramToJSON ? impl.paramToJSON(this.param) : this.param
      };
    }
  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      var impl = steps[json.name];
      return new Step(json.name, json.from && _model.Pos.fromJSON(json.from), json.to && _model.Pos.fromJSON(json.to), json.pos && _model.Pos.fromJSON(json.pos), impl.paramFromJSON ? impl.paramFromJSON(schema, json.param) : json.param);
    }
  }]);

  return Step;
})();

exports.Step = Step;

var steps = Object.create(null);

function defineStep(name, impl) {
  steps[name] = impl;
}