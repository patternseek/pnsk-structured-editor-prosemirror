"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _edit = require("../edit");

var _rebase = require("./rebase");

exports.rebaseSteps = _rebase.rebaseSteps;

(0, _edit.defineOption)("collab", false, function (pm, value) {
  if (pm.mod.collab) {
    pm.mod.collab.detach();
    pm.mod.collab = null;
  }

  if (value) {
    pm.mod.collab = new Collab(pm, value);
  }
});

var Collab = (function () {
  function Collab(pm, options) {
    var _this = this;

    _classCallCheck(this, Collab);

    this.pm = pm;
    this.options = options;

    this.version = options.version || 0;
    this.versionDoc = pm.doc;

    this.unconfirmedSteps = [];
    this.unconfirmedMaps = [];

    pm.on("transform", this.onTransform = function (transform) {
      for (var i = 0; i < transform.steps.length; i++) {
        _this.unconfirmedSteps.push(transform.steps[i]);
        _this.unconfirmedMaps.push(transform.maps[i]);
      }
      _this.signal("mustSend");
    });
    pm.on("beforeSetDoc", this.onSetDoc = function () {
      throw new Error("setDoc is not supported on a collaborative editor");
    });
    pm.history.allowCollapsing = false;
  }

  _createClass(Collab, [{
    key: "detach",
    value: function detach() {
      this.pm.off("transform", this.onTransform);
      this.pm.off("beforeSetDoc", this.onSetDoc);
      this.pm.history.allowCollapsing = true;
    }
  }, {
    key: "hasSendableSteps",
    value: function hasSendableSteps() {
      return this.unconfirmedSteps.length > 0;
    }
  }, {
    key: "sendableSteps",
    value: function sendableSteps() {
      return {
        version: this.version,
        doc: this.pm.doc,
        steps: this.unconfirmedSteps.slice()
      };
    }
  }, {
    key: "confirmSteps",
    value: function confirmSteps(sendable) {
      this.unconfirmedSteps.splice(0, sendable.steps.length);
      this.unconfirmedMaps.splice(0, sendable.steps.length);
      this.version += sendable.steps.length;
      this.versionDoc = sendable.doc;
    }
  }, {
    key: "receive",
    value: function receive(steps) {
      var doc = this.versionDoc;
      var maps = steps.map(function (step) {
        var result = step.apply(doc);
        doc = result.doc;
        return result.map;
      });
      this.version += steps.length;
      this.versionDoc = doc;

      var rebased = (0, _rebase.rebaseSteps)(doc, maps, this.unconfirmedSteps, this.unconfirmedMaps);
      this.unconfirmedSteps = rebased.transform.steps.slice();
      this.unconfirmedMaps = rebased.transform.maps.slice();

      this.pm.updateDoc(rebased.doc, rebased.mapping);
      this.pm.history.rebased(maps, rebased.transform, rebased.positions);
      return maps;
    }
  }]);

  return Collab;
})();

(0, _edit.eventMixin)(Collab);