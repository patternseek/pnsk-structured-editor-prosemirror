"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.eventMixin = eventMixin;
var methods = {
  on: function on(type, f) {
    var map = this._handlers || (this._handlers = {});
    var arr = map[type] || (map[type] = []);
    arr.push(f);
  },

  off: function off(type, f) {
    var arr = this._handlers && this._handlers[type];
    if (arr) for (var i = 0; i < arr.length; ++i) {
      if (arr[i] == f) {
        arr.splice(i, 1);break;
      }
    }
  },

  signal: function signal(type) {
    var arr = this._handlers && this._handlers[type];

    for (var _len = arguments.length, values = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      values[_key - 1] = arguments[_key];
    }

    if (arr) for (var i = 0; i < arr.length; ++i) {
      arr[i].apply(arr, values);
    }
  },

  signalHandleable: function signalHandleable(type) {
    var arr = this._handlers && this._handlers[type];
    if (arr) {
      for (var _len2 = arguments.length, values = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        values[_key2 - 1] = arguments[_key2];
      }

      for (var i = 0; i < arr.length; ++i) {
        var result = arr[i].apply(arr, values);
        if (result !== false) return result;
      }
    }return false;
  },

  hasHandler: function hasHandler(type) {
    var arr = this._handlers && this._handlers[type];
    return arr && arr.length > 0;
  }
};

// Add event-related methods to a constructor's prototype, to make
// registering events on such objects more convenient.

function eventMixin(ctor) {
  var proto = ctor.prototype;
  for (var prop in methods) if (methods.hasOwnProperty(prop)) proto[prop] = methods[prop];
}