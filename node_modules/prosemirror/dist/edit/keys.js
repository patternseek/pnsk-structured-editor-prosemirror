// From CodeMirror, should be factored into its own NPM module

// declare_global: navigator
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

exports.keyName = keyName;
exports.isModifierKey = isModifierKey;
exports.normalizeKeyName = normalizeKeyName;
exports.lookupKey = lookupKey;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var mac = typeof navigator != "undefined" ? /Mac/.test(navigator.platform) : false;

/**
 * A map of KeyboardEvent keycodes to key names.
 *
 * @type {Array}
 */
var names = {
  3: "Enter", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
  19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
  36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
  46: "Delete", 59: ";", 61: "=", 91: "Mod", 92: "Mod", 93: "Mod",
  106: "*", 107: "=", 109: "-", 110: ".", 111: "/", 127: "Delete",
  173: "-", 186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\",
  221: "]", 222: "'", 63232: "Up", 63233: "Down", 63234: "Left", 63235: "Right", 63272: "Delete",
  63273: "Home", 63275: "End", 63276: "PageUp", 63277: "PageDown", 63302: "Insert"
};

exports.names = names;
// Number keys
for (var i = 0; i < 10; i++) {
  names[i + 48] = names[i + 96] = String(i);
} // Alphabetic keys
for (var i = 65; i <= 90; i++) {
  names[i] = String.fromCharCode(i);
} // Function keys
for (var i = 1; i <= 12; i++) {
  names[i + 111] = names[i + 63235] = "F" + i;
} /**
   * Given a keypress event, get the key name.
   *
   * @param  {KeyboardEvent} event   The keypress event.
   * @param  {Boolean}       noShift
   * @return {string}                The key name.
   */

function keyName(event, noShift) {
  var base = names[event.keyCode],
      name = base;
  if (name == null || event.altGraphKey) return false;

  if (event.altKey && base != "Alt") name = "Alt-" + name;
  if (event.ctrlKey && base != "Ctrl") name = "Ctrl-" + name;
  if (event.metaKey && base != "Cmd") name = "Cmd-" + name;
  if (!noShift && event.shiftKey && base != "Shift") name = "Shift-" + name;
  return name;
}

function isModifierKey(value) {
  var name = typeof value == "string" ? value : names[value.keyCode];
  return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod";
}

function normalizeKeyName(fullName) {
  var parts = fullName.split(/-(?!'?$)/),
      name = parts[parts.length - 1];
  var alt = undefined,
      ctrl = undefined,
      shift = undefined,
      cmd = undefined;
  for (var i = 0; i < parts.length - 1; i++) {
    var mod = parts[i];
    if (/^(cmd|meta|m)$/i.test(mod)) cmd = true;else if (/^a(lt)?$/i.test(mod)) alt = true;else if (/^(c|ctrl|control)$/i.test(mod)) ctrl = true;else if (/^s(hift)$/i.test(mod)) shift = true;else if (/^mod$/i.test(mod)) {
      if (mac) cmd = true;else ctrl = true;
    } else throw new Error("Unrecognized modifier name: " + mod);
  }
  if (alt) name = "Alt-" + name;
  if (ctrl) name = "Ctrl-" + name;
  if (cmd) name = "Cmd-" + name;
  if (shift) name = "Shift-" + name;
  return name;
}

/**
 * A group of bindings of key names and editor commands,
 * which override the default key press event behavior in the editor's DOM.
 */

var Keymap = (function () {
  function Keymap(keys, options) {
    _classCallCheck(this, Keymap);

    this.options = options || {};
    this.bindings = Object.create(null);
    if (keys) for (var keyname in keys) {
      if (Object.prototype.hasOwnProperty.call(keys, keyname)) this.addBinding(keyname, keys[keyname]);
    }
  }

  /**
   * Lookup a key name in a KeyMap, and pass the mapped value to a handler.
   *
   * @param {string}   key     The key name.
   * @param {Keymap}   map     The key map. If the keymap has an options.call method,
   *                           that will be invoked to get the mapped value.
   * @param {Function} handle  Callback
   * @param {Object}   context
   * @return {string} If the key name has a mapping and the callback is invoked ("handled"),
   *                  if the key name needs to be combined in sequence with the next key ("multi"),
   *                  if there is no mapping ("nothing").
   */

  _createClass(Keymap, [{
    key: "addBinding",
    value: function addBinding(keyname, value) {
      var keys = keyname.split(" ").map(normalizeKeyName);
      for (var i = 0; i < keys.length; i++) {
        var _name = keys.slice(0, i + 1).join(" ");
        var val = i == keys.length - 1 ? value : "...";
        var prev = this.bindings[_name];
        if (!prev) this.bindings[_name] = val;else if (prev != val) throw new Error("Inconsistent bindings for " + _name);
      }
    }
  }, {
    key: "removeBinding",
    value: function removeBinding(keyname) {
      var keys = keyname.split(" ").map(normalizeKeyName);
      for (var i = keys.length - 1; i >= 0; i--) {
        var _name2 = keys.slice(0, i).join(" ");
        var val = this.bindings[_name2];
        if (val == "..." && !this.unusedMulti(_name2)) break;else if (val) delete this.bindings[_name2];
      }
    }
  }, {
    key: "unusedMulti",
    value: function unusedMulti(name) {
      for (var binding in this.bindings) {
        if (binding.length > name && binding.indexOf(name) == 0 && binding.charAt(name.length) == " ") return false;
      }return true;
    }
  }]);

  return Keymap;
})();

exports.Keymap = Keymap;

function lookupKey(_x, _x2, _x3, _x4) {
  var _again = true;

  _function: while (_again) {
    var key = _x,
        map = _x2,
        handle = _x3,
        context = _x4;
    _again = false;

    var found = map.options.call ? map.options.call(key, context) : map.bindings[key];
    if (found === false) return "nothing";
    if (found === "...") return "multi";
    if (found != null && handle(found)) return "handled";

    var fall = map.options.fallthrough;
    if (fall) {
      if (!Array.isArray(fall)) {
        _x = key;
        _x2 = fall;
        _x3 = handle;
        _x4 = context;
        _again = true;
        found = fall = undefined;
        continue _function;
      }
      for (var i = 0; i < fall.length; i++) {
        var result = lookupKey(key, fall[i], handle, context);
        if (result) return result;
      }
    }
  }
}