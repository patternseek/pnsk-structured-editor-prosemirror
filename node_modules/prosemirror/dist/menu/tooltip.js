"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _dom = require("../dom");

var prefix = "ProseMirror-tooltip";

var Tooltip = (function () {
  function Tooltip(pm, dir) {
    var _this = this;

    _classCallCheck(this, Tooltip);

    this.pm = pm;
    this.dir = dir || "above";
    this.pointer = pm.wrapper.appendChild((0, _dom.elt)("div", { "class": prefix + "-pointer-" + this.dir + " " + prefix + "-pointer" }));
    this.pointerWidth = this.pointerHeight = null;
    this.dom = pm.wrapper.appendChild((0, _dom.elt)("div", { "class": prefix }));
    this.dom.addEventListener("transitionend", function () {
      if (_this.dom.style.opacity == "0") _this.dom.style.display = _this.pointer.style.display = "";
    });

    this.isOpen = false;
    this.lastLeft = this.lastRight = null;
  }

  _createClass(Tooltip, [{
    key: "detach",
    value: function detach() {
      this.dom.parentNode.removeChild(this.dom);
      this.pointer.parentNode.removeChild(this.pointer);
    }
  }, {
    key: "getSize",
    value: function getSize(node) {
      var wrap = this.pm.wrapper.appendChild((0, _dom.elt)("div", {
        "class": prefix,
        style: "display: block; position: absolute"
      }, node));
      var size = { width: wrap.offsetWidth, height: wrap.offsetHeight };
      wrap.parentNode.removeChild(wrap);
      return size;
    }
  }, {
    key: "open",
    value: function open(node, pos) {
      var left = this.lastLeft = pos ? pos.left : this.lastLeft;
      var top = this.lastTop = pos ? pos.top : this.lastTop;

      var size = this.getSize(node);

      var around = this.pm.wrapper.getBoundingClientRect();

      for (var child = this.dom.firstChild, next = undefined; child; child = next) {
        next = child.nextSibling;
        if (child != this.pointer) this.dom.removeChild(child);
      }
      this.dom.appendChild(node);

      this.dom.style.display = this.pointer.style.display = "block";

      if (this.pointerWidth == null) {
        this.pointerWidth = this.pointer.offsetWidth - 1;
        this.pointerHeight = this.pointer.offsetHeight - 1;
      }

      this.dom.style.width = size.width + "px";
      this.dom.style.height = size.height + "px";

      var margin = 5;
      if (this.dir == "above" || this.dir == "below") {
        var tipLeft = Math.max(0, Math.min(left - size.width / 2, window.innerWidth - size.width));
        this.dom.style.left = tipLeft - around.left + "px";
        this.pointer.style.left = left - around.left - this.pointerWidth / 2 + "px";
        if (this.dir == "above") {
          var tipTop = top - around.top - margin - this.pointerHeight - size.height;
          this.dom.style.top = tipTop + "px";
          this.pointer.style.top = tipTop + size.height + "px";
        } else {
          // below
          var tipTop = top - around.top + margin;
          this.pointer.style.top = tipTop + "px";
          this.dom.style.top = tipTop + this.pointerHeight + "px";
        }
      } else if (this.dir == "left" || this.dir == "right") {
        this.dom.style.top = top - around.top - size.height / 2 + "px";
        this.pointer.style.top = top - this.pointerHeight / 2 - around.top + "px";
        if (this.dir == "left") {
          var pointerLeft = left - around.left - margin - this.pointerWidth;
          this.dom.style.left = pointerLeft - size.width + "px";
          this.pointer.style.left = pointerLeft + "px";
        } else {
          // right
          var pointerLeft = left - around.left + margin;
          this.dom.style.left = pointerLeft + this.pointerWidth + "px";
          this.pointer.style.left = pointerLeft + "px";
        }
      } else if (this.dir == "center") {
        var _top = Math.max(around.top, 0),
            bottom = Math.min(around.bottom, window.innerHeight);
        var fromTop = (bottom - _top - size.height) / 2;
        this.dom.style.left = (around.width - size.width) / 2 + "px";
        this.dom.style.top = _top - around.top + fromTop + "px";
      }

      getComputedStyle(this.dom).opacity;
      getComputedStyle(this.pointer).opacity;
      this.dom.style.opacity = this.pointer.style.opacity = 1;
      this.isOpen = true;
    }
  }, {
    key: "close",
    value: function close() {
      if (this.isOpen) {
        this.isOpen = false;
        this.dom.style.opacity = this.pointer.style.opacity = 0;
      }
    }
  }]);

  return Tooltip;
})();

exports.Tooltip = Tooltip;

(0, _dom.insertCSS)("\n\n.ProseMirror-tooltip {\n  position: absolute;\n  display: none;\n  box-sizing: border-box;\n  -moz-box-sizing: border- box;\n  overflow: hidden;\n\n  -webkit-transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  -moz-transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  opacity: 0;\n\n  border-radius: 5px;\n  padding: 3px 7px;\n  margin: 0;\n  background: #444;\n  border-color: #777;\n  color: white;\n\n  z-index: 5;\n}\n\n.ProseMirror-tooltip-pointer {\n  content: \"\";\n  position: absolute;\n  display: none;\n  width: 0; height: 0;\n\n  -webkit-transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  -moz-transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  opacity: 0;\n\n  z-index: 5;\n}\n\n.ProseMirror-tooltip-pointer-above {\n  border-left: 6px solid transparent;\n  border-right: 6px solid transparent;\n  border-top: 6px solid #444;\n}\n\n.ProseMirror-tooltip-pointer-below {\n  border-left: 6px solid transparent;\n  border-right: 6px solid transparent;\n  border-bottom: 6px solid #444;\n}\n\n.ProseMirror-tooltip-pointer-right {\n  border-top: 6px solid transparent;\n  border-bottom: 6px solid transparent;\n  border-right: 6px solid #444;\n}\n\n.ProseMirror-tooltip-pointer-left {\n  border-top: 6px solid transparent;\n  border-bottom: 6px solid transparent;\n  border-left: 6px solid #444;\n}\n\n.ProseMirror-tooltip input[type=\"text\"],\n.ProseMirror-tooltip textarea {\n  background: #666;\n  color: white;\n  border: none;\n  outline: none;\n}\n\n.ProseMirror-tooltip input[type=\"text\"] {\n  padding: 0 4px;\n}\n\n");