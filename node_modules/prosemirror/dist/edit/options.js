"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defineOption = defineOption;
exports.parseOptions = parseOptions;
exports.initOptions = initOptions;
exports.setOption = setOption;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _model = require("../model");

var _commands = require("./commands");

var Option = function Option(defaultValue, update, updateOnInit) {
  _classCallCheck(this, Option);

  this.defaultValue = defaultValue;
  this.update = update;
  this.updateOnInit = updateOnInit !== false;
};

var options = {
  __proto__: null,

  schema: new Option(_model.defaultSchema, false, false),

  doc: new Option(null, function (pm, value) {
    pm.setDoc(value);
  }, false),

  docFormat: new Option(null),

  place: new Option(null),

  keymap: new Option(null, function (pm, value) {
    if (!value) pm.options.keymap = (0, _commands.defaultKeymap)(pm);
  }),

  historyDepth: new Option(50),

  historyEventDelay: new Option(500),

  commandParamHandler: new Option("default"),

  label: new Option(null)
};

function defineOption(name, defaultValue, update, updateOnInit) {
  options[name] = new Option(defaultValue, update, updateOnInit);
}

function parseOptions(obj) {
  var result = Object.create(null);
  var given = obj ? [obj].concat(obj.use || []) : [];
  outer: for (var opt in options) {
    for (var i = 0; i < given.length; i++) {
      if (opt in given[i]) {
        result[opt] = given[i][opt];
        continue outer;
      }
    }
    result[opt] = options[opt].defaultValue;
  }
  return result;
}

function initOptions(pm) {
  for (var opt in options) {
    var desc = options[opt];
    if (desc.update && desc.updateOnInit) desc.update(pm, pm.options[opt], null, true);
  }
}

function setOption(pm, name, value) {
  var desc = options[name];
  if (desc.update === false) throw new Error("Option '" + name + "' can not be changed");
  var old = pm.options[name];
  pm.options[name] = value;
  if (desc.update) desc.update(pm, value, old, false);
}