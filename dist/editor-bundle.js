(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.elt = elt;
exports.requestAnimationFrame = requestAnimationFrame;
exports.cancelAnimationFrame = cancelAnimationFrame;
exports.contains = contains;
exports.insertCSS = insertCSS;
exports.ensureCSSAdded = ensureCSSAdded;
function elt(tag, attrs) {
  var result = document.createElement(tag);
  if (attrs) for (var name in attrs) {
    if (name == "style") result.style.cssText = attrs[name];else if (attrs[name] != null) result.setAttribute(name, attrs[name]);
  }

  for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    args[_key - 2] = arguments[_key];
  }

  for (var i = 0; i < args.length; i++) {
    add(args[i], result);
  }return result;
}

function add(value, target) {
  if (typeof value == "string") value = document.createTextNode(value);

  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i++) {
      add(value[i], target);
    }
  } else {
    target.appendChild(value);
  }
}

var reqFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
var cancelFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.webkitCancelAnimationFrame || window.msCancelAnimationFrame;

function requestAnimationFrame(f) {
  if (reqFrame) return reqFrame(f);else return setTimeout(f, 10);
}

function cancelAnimationFrame(handle) {
  if (reqFrame) return cancelFrame(handle);else clearTimeout(handle);
}

var ie_upto10 = /MSIE \d/.test(navigator.userAgent);
var ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(navigator.userAgent);

var browser = exports.browser = {
  mac: /Mac/.test(navigator.platform),
  ie_upto10: ie_upto10,
  ie_11up: ie_11up,
  ie: ie_upto10 || ie_11up,
  gecko: /gecko\/\d/i.test(navigator.userAgent),
  ios: /AppleWebKit/.test(navigator.userAgent) && /Mobile\/\w+/.test(navigator.userAgent)
};

// : (DOMNode, DOMNode) → bool
// Check whether a DOM node is an ancestor of another DOM node.
function contains(parent, child) {
  // Android browser and IE will return false if child is a text node.
  if (child.nodeType != 1) child = child.parentNode;
  return child && parent.contains(child);
}

var accumulatedCSS = "",
    cssNode = null;

function insertCSS(css) {
  if (cssNode) cssNode.textContent += css;else accumulatedCSS += css;
}

// This is called when a ProseMirror instance is created, to ensure
// the CSS is in the DOM.
function ensureCSSAdded() {
  if (!cssNode) {
    cssNode = document.createElement("style");
    cssNode.textContent = "/* ProseMirror CSS */\n" + accumulatedCSS;
    document.head.insertBefore(cssNode, document.head.firstChild);
  }
}
},{}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.baseCommands = undefined;

var _transform = require("../transform");

var _char = require("./char");

var _selection = require("./selection");

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

// :: Object<CommandSpec>
// The set of default commands defined by the core library. They are
// included in the [default command set](#CommandSet.default).
var baseCommands = exports.baseCommands = Object.create(null);

// ;; #kind=command
// Delete the selection, if there is one.
//
// **Keybindings:** Backspace, Delete, Mod-Backspace, Mod-Delete,
// **Ctrl-H (Mac), Alt-Backspace (Mac), Ctrl-D (Mac),
// **Ctrl-Alt-Backspace (Mac), Alt-Delete (Mac), Alt-D (Mac)
baseCommands.deleteSelection = {
  label: "Delete the selection",
  run: function run(pm) {
    return pm.tr.replaceSelection().apply(pm.apply.scroll);
  },

  keys: {
    all: ["Backspace(10)", "Delete(10)", "Mod-Backspace(10)", "Mod-Delete(10)"],
    mac: ["Ctrl-H(10)", "Alt-Backspace(10)", "Ctrl-D(10)", "Ctrl-Alt-Backspace(10)", "Alt-Delete(10)", "Alt-D(10)"]
  }
};

function deleteBarrier(pm, cut) {
  var $cut = pm.doc.resolve(cut),
      before = $cut.nodeBefore,
      after = $cut.nodeAfter;
  if (before.type.canContainContent(after.type)) {
    var tr = pm.tr.join(cut);
    if (tr.steps.length && before.content.size == 0 && !before.sameMarkup(after)) tr.setNodeType(cut - before.nodeSize, after.type, after.attrs);
    if (tr.apply(pm.apply.scroll) !== false) return;
  }

  var conn = undefined;
  if (after.isTextblock && (conn = before.type.findConnection(after.type))) {
    var tr = pm.tr,
        end = cut + after.nodeSize;
    tr.step("ancestor", cut, end, { types: [before.type].concat(_toConsumableArray(conn)),
      attrs: [before.attrs].concat(_toConsumableArray(conn.map(function () {
        return null;
      }))) });
    tr.join(end + 2 * conn.length + 2, 1, true);
    tr.join(cut);
    if (tr.apply(pm.apply.scroll) !== false) return;
  }

  var selAfter = (0, _selection.findSelectionFrom)(pm.doc, cut, 1);
  return pm.tr.lift(selAfter.from, selAfter.to, true).apply(pm.apply.scroll);
}

// ;; #kind=command
// If the selection is empty and at the start of a textblock, move
// that block closer to the block before it, by lifting it out of its
// parent or, if it has no parent it doesn't share with the node
// before it, moving it into a parent of that node, or joining it with
// that.
//
// **Keybindings:** Backspace, Mod-Backspace
baseCommands.joinBackward = {
  label: "Join with the block above",
  run: function run(pm) {
    var _pm$selection = pm.selection;
    var head = _pm$selection.head;
    var empty = _pm$selection.empty;

    if (!empty) return false;

    var $head = pm.doc.resolve(head);
    if ($head.parentOffset > 0) return false;

    // Find the node before this one
    var before = undefined,
        cut = undefined;
    for (var i = $head.depth - 1; !before && i >= 0; i--) {
      if ($head.index(i) > 0) {
        cut = $head.before(i + 1);
        before = $head.node(i).child($head.index(i) - 1);
      }
    } // If there is no node before this, try to lift
    if (!before) return pm.tr.lift(head, head, true).apply(pm.apply.scroll);

    // If the node below has no content and the node above is
    // selectable, delete the node below and select the one above.
    if (before.type.contains == null && before.type.selectable && $head.parent.content.size == 0) {
      var tr = pm.tr.delete(cut, cut + $head.parent.nodeSize).apply(pm.apply.scroll);
      pm.setNodeSelection(cut - before.nodeSize);
      return tr;
    }

    // If the node doesn't allow children, delete it
    if (before.type.contains == null) return pm.tr.delete(cut - before.nodeSize, cut).apply(pm.apply.scroll);

    // Apply the joining algorithm
    return deleteBarrier(pm, cut);
  },

  keys: ["Backspace(30)", "Mod-Backspace(30)"]
};

// Get an offset moving backward from a current offset inside a node.
function moveBackward(doc, pos, by) {
  if (by != "char" && by != "word") throw new RangeError("Unknown motion unit: " + by);

  var $pos = doc.resolve(pos);
  var parent = $pos.parent,
      offset = $pos.parentOffset;

  var cat = null,
      counted = 0;
  for (;;) {
    if (offset == 0) return pos;

    var _parent$childBefore = parent.childBefore(offset);

    var start = _parent$childBefore.offset;
    var node = _parent$childBefore.node;

    if (!node) return pos;
    if (!node.isText) return cat ? pos : pos - 1;

    if (by == "char") {
      for (var i = offset - start; i > 0; i--) {
        if (!(0, _char.isExtendingChar)(node.text.charAt(i - 1))) return pos - 1;
        offset--;
        pos--;
      }
    } else if (by == "word") {
      // Work from the current position backwards through text of a singular
      // character category (e.g. "cat" of "#!*") until reaching a character in a
      // different category (i.e. the end of the word).
      for (var i = offset - start; i > 0; i--) {
        var nextCharCat = (0, _char.charCategory)(node.text.charAt(i - 1));
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat;else if (cat != nextCharCat) return pos;
        offset--;
        pos--;
        counted++;
      }
    }
  }
}

// ;; #kind=command
// Delete the character before the cursor, if the selection is empty
// and the cursor isn't at the start of a textblock.
//
// **Keybindings:** Backspace, Ctrl-H (Mac)
baseCommands.deleteCharBefore = {
  label: "Delete a character before the cursor",
  run: function run(pm) {
    var _pm$selection2 = pm.selection;
    var head = _pm$selection2.head;
    var empty = _pm$selection2.empty;

    if (!empty || pm.doc.resolve(head).parentOffset == 0) return false;
    var dest = moveBackward(pm.doc, head, "char");
    return pm.tr.delete(dest, head).apply(pm.apply.scroll);
  },

  keys: {
    all: ["Backspace(60)"],
    mac: ["Ctrl-H(40)"]
  }
};

// ;; #kind=command
// Delete the word before the cursor, if the selection is empty and
// the cursor isn't at the start of a textblock.
//
// **Keybindings:** Mod-Backspace, Alt-Backspace (Mac)
baseCommands.deleteWordBefore = {
  label: "Delete the word before the cursor",
  run: function run(pm) {
    var _pm$selection3 = pm.selection;
    var head = _pm$selection3.head;
    var empty = _pm$selection3.empty;

    if (!empty || pm.doc.resolve(head).parentOffset == 0) return false;
    var dest = moveBackward(pm.doc, head, "word");
    return pm.tr.delete(dest, head).apply(pm.apply.scroll);
  },

  keys: {
    all: ["Mod-Backspace(40)"],
    mac: ["Alt-Backspace(40)"]
  }
};

// ;; #kind=command
// If the selection is empty and the cursor is at the end of a
// textblock, move the node after it closer to the node with the
// cursor (lifting it out of parents that aren't shared, moving it
// into parents of the cursor block, or joining the two when they are
// siblings).
//
// **Keybindings:** Delete, Mod-Delete
baseCommands.joinForward = {
  label: "Join with the block below",
  run: function run(pm) {
    var _pm$selection4 = pm.selection;
    var head = _pm$selection4.head;
    var empty = _pm$selection4.empty;var $head = undefined;
    if (!empty || ($head = pm.doc.resolve(head)).parentOffset < $head.parent.content.size) return false;

    // Find the node after this one
    var after = undefined,
        cut = undefined;
    for (var i = $head.depth - 1; !after && i >= 0; i--) {
      var parent = $head.node(i);
      if ($head.index(i) + 1 < parent.childCount) {
        after = parent.child($head.index(i) + 1);
        cut = $head.after(i + 1);
      }
    }

    // If there is no node after this, there's nothing to do
    if (!after) return false;

    // If the node doesn't allow children, delete it
    if (after.type.contains == null) return pm.tr.delete(cut, cut + after.nodeSize).apply(pm.apply.scroll);

    // Apply the joining algorithm
    return deleteBarrier(pm, cut);
  },

  keys: ["Delete(30)", "Mod-Delete(30)"]
};

function moveForward(doc, pos, by) {
  if (by != "char" && by != "word") throw new RangeError("Unknown motion unit: " + by);

  var $pos = doc.resolve(pos);
  var parent = $pos.parent,
      offset = $pos.parentOffset;

  var cat = null,
      counted = 0;
  for (;;) {
    if (offset == parent.content.size) return pos;

    var _parent$childAfter = parent.childAfter(offset);

    var start = _parent$childAfter.offset;
    var node = _parent$childAfter.node;

    if (!node) return pos;
    if (!node.isText) return cat ? pos : pos + 1;

    if (by == "char") {
      for (var i = offset - start; i < node.text.length; i++) {
        if (!(0, _char.isExtendingChar)(node.text.charAt(i + 1))) return pos + 1;
        offset++;
        pos++;
      }
    } else if (by == "word") {
      for (var i = offset - start; i < node.text.length; i++) {
        var nextCharCat = (0, _char.charCategory)(node.text.charAt(i));
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat;else if (cat != nextCharCat) return pos;
        offset++;
        pos++;
        counted++;
      }
    }
  }
}

// ;; #kind=command
// Delete the character after the cursor, if the selection is empty
// and the cursor isn't at the end of its textblock.
//
// **Keybindings:** Delete, Ctrl-D (Mac)
baseCommands.deleteCharAfter = {
  label: "Delete a character after the cursor",
  run: function run(pm) {
    var _pm$selection5 = pm.selection;
    var head = _pm$selection5.head;
    var empty = _pm$selection5.empty;var $head = undefined;
    if (!empty || ($head = pm.doc.resolve(head)).parentOffset == $head.parent.content.size) return false;
    var dest = moveForward(pm.doc, head, "char");
    return pm.tr.delete(head, dest).apply(pm.apply.scroll);
  },

  keys: {
    all: ["Delete(60)"],
    mac: ["Ctrl-D(60)"]
  }
};

// ;; #kind=command
// Delete the word after the cursor, if the selection is empty and the
// cursor isn't at the end of a textblock.
//
// **Keybindings:** Mod-Delete, Ctrl-Alt-Backspace (Mac), Alt-Delete
// (Mac), Alt-D (Mac)
baseCommands.deleteWordAfter = {
  label: "Delete a word after the cursor",
  run: function run(pm) {
    var _pm$selection6 = pm.selection;
    var head = _pm$selection6.head;
    var empty = _pm$selection6.empty;var $head = undefined;
    if (!empty || ($head = pm.doc.resolve(head)).parentOffset == $head.parent.content.size) return false;
    var dest = moveForward(pm.doc, head, "word");
    return pm.tr.delete(head, dest).apply(pm.apply.scroll);
  },

  keys: {
    all: ["Mod-Delete(40)"],
    mac: ["Ctrl-Alt-Backspace(40)", "Alt-Delete(40)", "Alt-D(40)"]
  }
};

function joinPointAbove(pm) {
  var _pm$selection7 = pm.selection;
  var node = _pm$selection7.node;
  var from = _pm$selection7.from;

  if (node) return (0, _transform.joinable)(pm.doc, from) ? from : null;else return (0, _transform.joinPoint)(pm.doc, from, -1);
}

// ;; #kind=command
// Join the selected block or, if there is a text selection, the
// closest ancestor block of the selection that can be joined, with
// the sibling above it.
//
// **Keybindings:** Alt-Up
baseCommands.joinUp = {
  label: "Join with above block",
  run: function run(pm) {
    var point = joinPointAbove(pm),
        selectNode = undefined;
    if (!point) return false;
    if (pm.selection.node) selectNode = point - pm.doc.resolve(point).nodeBefore.nodeSize;
    pm.tr.join(point).apply();
    if (selectNode != null) pm.setNodeSelection(selectNode);
  },
  select: function select(pm) {
    return joinPointAbove(pm);
  },

  menu: {
    group: "block", rank: 80,
    display: {
      type: "icon",
      width: 800, height: 900,
      path: "M0 75h800v125h-800z M0 825h800v-125h-800z M250 400h100v-100h100v100h100v100h-100v100h-100v-100h-100z"
    }
  },
  keys: ["Alt-Up"]
};

function joinPointBelow(pm) {
  var _pm$selection8 = pm.selection;
  var node = _pm$selection8.node;
  var to = _pm$selection8.to;

  if (node) return (0, _transform.joinable)(pm.doc, to) ? to : null;else return (0, _transform.joinPoint)(pm.doc, to, 1);
}

// ;; #kind=command
// Join the selected block, or the closest ancestor of the selection
// that can be joined, with the sibling after it.
//
// **Keybindings:** Alt-Down
baseCommands.joinDown = {
  label: "Join with below block",
  run: function run(pm) {
    var node = pm.selection.node,
        nodeAt = pm.selection.from;
    var point = joinPointBelow(pm);
    if (!point) return false;
    pm.tr.join(point).apply();
    if (node) pm.setNodeSelection(nodeAt);
  },
  select: function select(pm) {
    return joinPointBelow(pm);
  },

  keys: ["Alt-Down"]
};

// ;; #kind=command
// Lift the selected block, or the closest ancestor block of the
// selection that can be lifted, out of its parent node.
//
// **Keybindings:** Ctrl-[
baseCommands.lift = {
  label: "Lift out of enclosing block",
  run: function run(pm) {
    var _pm$selection9 = pm.selection;
    var from = _pm$selection9.from;
    var to = _pm$selection9.to;

    return pm.tr.lift(from, to, true).apply(pm.apply.scroll);
  },
  select: function select(pm) {
    var _pm$selection10 = pm.selection;
    var from = _pm$selection10.from;
    var to = _pm$selection10.to;

    return (0, _transform.canLift)(pm.doc, from, to);
  },

  menu: {
    group: "block", rank: 75,
    display: {
      type: "icon",
      width: 1024, height: 1024,
      path: "M219 310v329q0 7-5 12t-12 5q-8 0-13-5l-164-164q-5-5-5-13t5-13l164-164q5-5 13-5 7 0 12 5t5 12zM1024 749v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12zM1024 530v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 310v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 91v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12z"
    }
  },
  keys: ["Mod-["]
};

// ;; #kind=command
// If the selection is in a node whose type has a truthy `isCode`
// property, replace the selection with a newline character.
//
// **Keybindings:** Enter
baseCommands.newlineInCode = {
  label: "Insert newline",
  run: function run(pm) {
    var _pm$selection11 = pm.selection;
    var from = _pm$selection11.from;
    var to = _pm$selection11.to;
    var node = _pm$selection11.node;

    if (node) return false;
    var $from = pm.doc.resolve(from);
    if (!$from.parent.type.isCode || to >= $from.end($from.depth)) return false;
    return pm.tr.typeText("\n").apply(pm.apply.scroll);
  },

  keys: ["Enter(10)"]
};

// ;; #kind=command
// If a block node is selected, create an empty paragraph before (if
// it is its parent's first child) or after it.
//
// **Keybindings:** Enter
baseCommands.createParagraphNear = {
  label: "Create a paragraph near the selected block",
  run: function run(pm) {
    var _pm$selection12 = pm.selection;
    var from = _pm$selection12.from;
    var to = _pm$selection12.to;
    var node = _pm$selection12.node;

    if (!node || !node.isBlock) return false;
    var side = pm.doc.resolve(from).parentOffset ? to : from;
    pm.tr.insert(side, pm.schema.defaultTextblockType().create()).apply(pm.apply.scroll);
    pm.setTextSelection(side + 1);
  },

  keys: ["Enter(20)"]
};

// ;; #kind=command
// If the cursor is in an empty textblock that can be lifted, lift the
// block.
//
// **Keybindings:** Enter
baseCommands.liftEmptyBlock = {
  label: "Move current block up",
  run: function run(pm) {
    var _pm$selection13 = pm.selection;
    var head = _pm$selection13.head;
    var empty = _pm$selection13.empty;var $head = undefined;
    if (!empty || ($head = pm.doc.resolve(head)).parentOffset > 0 || $head.parent.content.size) return false;
    if ($head.depth > 1) {
      if ($head.index($head.depth - 1) > 0 && $head.index($head.depth - 1) < $head.node($head.depth - 1).childCount - 1 && pm.tr.split($head.before($head.depth)).apply() !== false) return;
    }
    return pm.tr.lift(head, head, true).apply(pm.apply.scroll);
  },

  keys: ["Enter(30)"]
};

// ;; #kind=command
// Split the parent block of the selection. If the selection is a text
// selection, delete it.
//
// **Keybindings:** Enter
baseCommands.splitBlock = {
  label: "Split the current block",
  run: function run(pm) {
    var _pm$selection14 = pm.selection;
    var from = _pm$selection14.from;
    var to = _pm$selection14.to;
    var node = _pm$selection14.node;var $from = pm.doc.resolve(from);
    if (node && node.isBlock) {
      if (!$from.parentOffset) return false;
      return pm.tr.split(from).apply(pm.apply.scroll);
    } else {
      var $to = pm.doc.resolve(to),
          atEnd = $to.parentOffset == $to.parent.content.size;
      var deflt = pm.schema.defaultTextblockType();
      var type = atEnd ? deflt : null;
      var tr = pm.tr.delete(from, to).split(from, 1, type);
      if (!atEnd && !$from.parentOffset && $from.parent.type != deflt) tr.setNodeType($from.before($from.depth), deflt);
      return tr.apply(pm.apply.scroll);
    }
  },

  keys: ["Enter(60)"]
};

function nodeAboveSelection(pm) {
  var sel = pm.selection;
  if (sel.node) {
    var $from = pm.doc.resolve(sel.from);
    return !!$from.depth && $from.before($from.depth);
  }
  var $head = pm.doc.resolve(sel.head);
  var same = $head.sameDepth(pm.doc.resolve(sel.anchor));
  return same == 0 ? false : $head.before(same);
}

// ;; #kind=command
// Move the selection to the node wrapping the current selection, if
// any. (Will not select the document node.)
//
// **Keybindings:** Esc
baseCommands.selectParentNode = {
  label: "Select parent node",
  run: function run(pm) {
    var node = nodeAboveSelection(pm);
    if (node === false) return false;
    pm.setNodeSelection(node);
  },
  select: function select(pm) {
    return nodeAboveSelection(pm);
  },

  menu: {
    group: "block", rank: 90,
    display: { type: "icon", text: "⬚", style: "font-weight: bold" }
  },
  keys: ["Esc"]
};

// ;; #kind=command
// Undo the most recent change event, if any.
//
// **Keybindings:** Mod-Z
baseCommands.undo = {
  label: "Undo last change",
  run: function run(pm) {
    pm.scrollIntoView();return pm.history.undo();
  },
  select: function select(pm) {
    return pm.history.undoDepth > 0;
  },

  menu: {
    group: "history", rank: 10,
    display: {
      type: "icon",
      width: 1024, height: 1024,
      path: "M761 1024c113-206 132-520-313-509v253l-384-384 384-384v248c534-13 594 472 313 775z"
    }
  },
  keys: ["Mod-Z"]
};

// ;; #kind=command
// Redo the most recently undone change event, if any.
//
// **Keybindings:** Mod-Y, Shift-Mod-Z
baseCommands.redo = {
  label: "Redo last undone change",
  run: function run(pm) {
    pm.scrollIntoView();return pm.history.redo();
  },
  select: function select(pm) {
    return pm.history.redoDepth > 0;
  },

  menu: {
    group: "history", rank: 20,
    display: {
      type: "icon",
      width: 1024, height: 1024,
      path: "M576 248v-248l384 384-384 384v-253c-446-10-427 303-313 509-280-303-221-789 313-775z"
    }
  },
  keys: ["Mod-Y", "Shift-Mod-Z"]
};
},{"../transform":40,"./char":4,"./selection":17}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.captureKeys = undefined;

var _browserkeymap = require("browserkeymap");

var _browserkeymap2 = _interopRequireDefault(_browserkeymap);

var _selection = require("./selection");

var _dom = require("../dom");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function nothing() {}

function moveSelectionBlock(pm, dir) {
  var _pm$selection = pm.selection;
  var from = _pm$selection.from;
  var to = _pm$selection.to;
  var node = _pm$selection.node;

  var side = pm.doc.resolve(dir > 0 ? to : from);
  return (0, _selection.findSelectionFrom)(pm.doc, node && node.isBlock ? side.pos : dir > 0 ? side.after(side.depth) : side.before(side.depth), dir);
}

function selectNodeHorizontally(pm, dir) {
  var _pm$selection2 = pm.selection;
  var empty = _pm$selection2.empty;
  var node = _pm$selection2.node;
  var from = _pm$selection2.from;
  var to = _pm$selection2.to;

  if (!empty && !node) return false;

  if (node && node.isInline) {
    pm.setTextSelection(dir > 0 ? to : from);
    return true;
  }

  if (!node) {
    var $from = pm.doc.resolve(from);

    var _ref = dir > 0 ? $from.parent.childAfter($from.parentOffset) : $from.parent.childBefore($from.parentOffset);

    var nextNode = _ref.node;
    var offset = _ref.offset;

    if (nextNode) {
      if (nextNode.type.selectable && offset == $from.parentOffset - (dir > 0 ? 0 : nextNode.nodeSize)) {
        pm.setNodeSelection(dir < 0 ? from - nextNode.nodeSize : from);
        return true;
      }
      return false;
    }
  }

  var next = moveSelectionBlock(pm, dir);
  if (next && (next instanceof _selection.NodeSelection || node)) {
    pm.setSelection(next);
    return true;
  }
  return false;
}

function horiz(dir) {
  return function (pm) {
    var done = selectNodeHorizontally(pm, dir);
    if (done) pm.scrollIntoView();
    return done;
  };
}

// : (ProseMirror, number)
// Check whether vertical selection motion would involve node
// selections. If so, apply it (if not, the result is left to the
// browser)
function selectNodeVertically(pm, dir) {
  var _pm$selection3 = pm.selection;
  var empty = _pm$selection3.empty;
  var node = _pm$selection3.node;
  var from = _pm$selection3.from;
  var to = _pm$selection3.to;

  if (!empty && !node) return false;

  var leavingTextblock = true;
  if (!node || node.isInline) {
    pm.flush(); // verticalMotionLeavesTextblock needs an up-to-date DOM
    leavingTextblock = (0, _selection.verticalMotionLeavesTextblock)(pm, dir > 0 ? to : from, dir);
  }

  if (leavingTextblock) {
    var next = moveSelectionBlock(pm, dir);
    if (next && next instanceof _selection.NodeSelection) {
      pm.setSelection(next);
      return true;
    }
  }

  if (!node || node.isInline) return false;

  var beyond = (0, _selection.findSelectionFrom)(pm.doc, dir < 0 ? from : to, dir);
  if (beyond) pm.setSelection(beyond);
  return true;
}

function vert(dir) {
  return function (pm) {
    var done = selectNodeVertically(pm, dir);
    if (done !== false) pm.scrollIntoView();
    return done;
  };
}

// A backdrop keymap used to make sure we always suppress keys that
// have a dangerous default effect, even if the commands they are
// bound to return false, and to make sure that cursor-motion keys
// find a cursor (as opposed to a node selection) when pressed. For
// cursor-motion keys, the code in the handlers also takes care of
// block selections.

var keys = {
  "Esc": nothing,
  "Enter": nothing,
  "Ctrl-Enter": nothing,
  "Mod-Enter": nothing,
  "Shift-Enter": nothing,
  "Backspace": nothing,
  "Delete": nothing,
  "Mod-B": nothing,
  "Mod-I": nothing,
  "Mod-Backspace": nothing,
  "Mod-Delete": nothing,
  "Shift-Backspace": nothing,
  "Shift-Delete": nothing,
  "Shift-Mod-Backspace": nothing,
  "Shift-Mod-Delete": nothing,
  "Mod-Z": nothing,
  "Mod-Y": nothing,
  "Shift-Mod-Z": nothing,
  "Ctrl-D": nothing,
  "Ctrl-H": nothing,
  "Ctrl-Alt-Backspace": nothing,
  "Alt-D": nothing,
  "Alt-Delete": nothing,
  "Alt-Backspace": nothing,

  "Left": horiz(-1),
  "Mod-Left": horiz(-1),
  "Right": horiz(1),
  "Mod-Right": horiz(1),
  "Up": vert(-1),
  "Down": vert(1)
};

if (_dom.browser.mac) {
  keys["Alt-Left"] = horiz(-1);
  keys["Alt-Right"] = horiz(1);
  keys["Ctrl-Backspace"] = keys["Ctrl-Delete"] = nothing;
}

var captureKeys = exports.captureKeys = new _browserkeymap2.default(keys);
},{"../dom":1,"./selection":17,"browserkeymap":55}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isWordChar = isWordChar;
exports.charCategory = charCategory;
exports.isExtendingChar = isExtendingChar;
var nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/;

// Extending unicode characters. A series of a non-extending char +
// any number of extending chars is treated as a single unit as far
// as editing and measuring is concerned. This is not fully correct,
// since some scripts/fonts/browsers also treat other configurations
// of code points as a group.
var extendingChar = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/;

function isWordChar(ch) {
  return (/\w/.test(ch) || isExtendingChar(ch) || ch > "\x80" && (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch))
  );
}

// Get the category of a given character. Either a "space",
// a character that can be part of a word ("word"), or anything else ("other").
function charCategory(ch) {
  return (/\s/.test(ch) ? "space" : isWordChar(ch) ? "word" : "other"
  );
}

function isExtendingChar(ch) {
  return ch.charCodeAt(0) >= 768 && extendingChar.test(ch);
}
},{}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CommandSet = exports.Command = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.updateCommands = updateCommands;
exports.selectedNodeAttr = selectedNodeAttr;

var _browserkeymap = require("browserkeymap");

var _browserkeymap2 = _interopRequireDefault(_browserkeymap);

var _model = require("../model");

var _transform = require("../transform");

var _dom = require("../dom");

var _sortedinsert = require("../util/sortedinsert");

var _sortedinsert2 = _interopRequireDefault(_sortedinsert);

var _obj = require("../util/obj");

var _base_commands = require("./base_commands");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; A command is a named piece of functionality that can be bound to
// a key, shown in the menu, or otherwise exposed to the user.
//
// The commands available in a given editor are determined by the
// `commands` option. By default, they come from the `baseCommands`
// object and the commands [registered](#SchemaItem.register) with
// schema items. Registering a `CommandSpec` on a [node](#NodeType) or
// [mark](#MarkType) type will cause that command to come into scope
// in editors whose schema includes that item.

var Command = exports.Command = function () {
  function Command(spec, self, name) {
    _classCallCheck(this, Command);

    // :: string The name of the command.
    this.name = name;
    if (!this.name) throw new RangeError("Trying to define a command without a name");
    // :: CommandSpec The command's specifying object.
    this.spec = spec;
    this.self = self;
  }

  // :: (ProseMirror, ?[any]) → ?bool
  // Execute this command. If the command takes
  // [parameters](#Command.params), they can be passed as second
  // argument here, or otherwise the user will be prompted for them
  // using the value of the `commandParamPrompt` option.
  //
  // Returns the value returned by the command spec's [`run`
  // method](#CommandSpec.run), or a `ParamPrompt` instance if the
  // command is ran asynchronously through a prompt.


  _createClass(Command, [{
    key: "exec",
    value: function exec(pm, params) {
      var run = this.spec.run;
      if (!params) {
        if (!this.params.length) return run.call(this.self, pm);
        return new pm.options.commandParamPrompt(pm, this).open();
      } else {
        if (this.params.length != (params ? params.length : 0)) throw new RangeError("Invalid amount of parameters for command " + this.name);
        return run.call.apply(run, [this.self, pm].concat(_toConsumableArray(params)));
      }
    }

    // :: (ProseMirror) → bool
    // Ask this command whether it is currently relevant, given the
    // editor's document and selection. If the command does not define a
    // [`select`](#CommandSpec.select) method, this always returns true.

  }, {
    key: "select",
    value: function select(pm) {
      var f = this.spec.select;
      return f ? f.call(this.self, pm) : true;
    }

    // :: (ProseMirror) → bool
    // Ask this command whether it is “active”. This is mostly used to
    // style inline mark icons (such as strong) differently when the
    // selection contains such marks.

  }, {
    key: "active",
    value: function active(pm) {
      var f = this.spec.active;
      return f ? f.call(this.self, pm) : false;
    }

    // :: [CommandParam]
    // Get the list of parameters that this command expects.

  }, {
    key: "params",
    get: function get() {
      return this.spec.params || empty;
    }

    // :: string
    // Get the label for this command.

  }, {
    key: "label",
    get: function get() {
      return this.spec.label || this.name;
    }
  }]);

  return Command;
}();

var empty = [];

function deriveCommandSpec(type, spec, name) {
  if (!spec.derive) return spec;
  var conf = _typeof(spec.derive) == "object" ? spec.derive : {};
  var dname = conf.name || name;
  var derive = type.constructor.derivableCommands[dname];
  if (!derive) throw new RangeError("Don't know how to derive command " + dname);
  var derived = derive.call(type, conf);
  for (var prop in spec) {
    if (prop != "derive") derived[prop] = spec[prop];
  }return derived;
}

// ;; The type used as the value of the `commands` option. Allows you
// to specify the set of commands that are available in the editor by
// adding and modifying command specs.

var CommandSet = function () {
  function CommandSet(base, op) {
    _classCallCheck(this, CommandSet);

    this.base = base;
    this.op = op;
  }

  // :: (union<Object<CommandSpec>, "schema">, ?(string, CommandSpec) → bool) → CommandSet
  // Add a set of commands, creating a new command set. If `set` is
  // the string `"schema"`, the commands are retrieved from the
  // editor's schema's [registry](#Schema.registry), otherwise, it
  // should be an object mapping command names to command specs.
  //
  // A filter function can be given to add only the commands for which
  // the filter returns true.


  _createClass(CommandSet, [{
    key: "add",
    value: function add(set, filter) {
      return new CommandSet(this, function (commands, schema) {
        function add(name, spec, self) {
          if (!filter || filter(name, spec)) {
            if (commands[name]) throw new RangeError("Duplicate definition of command " + name);
            commands[name] = new Command(spec, self, name);
          }
        }

        if (set === "schema") {
          schema.registry("command", function (name, spec, type, typeName) {
            add(typeName + ":" + name, deriveCommandSpec(type, spec, name), type);
          });
        } else {
          for (var name in set) {
            add(name, set[name]);
          }
        }
      });
    }

    // :: (Object<?CommandSpec>) → CommandSet
    // Create a new command set by adding, modifying, or deleting
    // commands. The `update` object can map a command name to `null` to
    // delete it, to a full `CommandSpec` (containing a `run` property)
    // to add it, or to a partial `CommandSpec` (without a `run`
    // property) to update some properties in the command by that name.

  }, {
    key: "update",
    value: function update(_update) {
      return new CommandSet(this, function (commands) {
        for (var name in _update) {
          var spec = _update[name];
          if (!spec) {
            delete commands[name];
          } else if (spec.run) {
            commands[name] = new Command(spec, null, name);
          } else {
            var known = commands[name];
            if (known) commands[name] = new Command((0, _obj.copyObj)(spec, (0, _obj.copyObj)(known.spec)), known.self, name);
          }
        }
      });
    }
  }, {
    key: "derive",
    value: function derive(schema) {
      var commands = this.base ? this.base.derive(schema) : Object.create(null);
      this.op(commands, schema);
      return commands;
    }
  }]);

  return CommandSet;
}();

// :: CommandSet
// A set without any commands.


exports.CommandSet = CommandSet;
CommandSet.empty = new CommandSet(null, function () {
  return null;
});

// :: CommandSet
// The default value of the `commands` option. Includes the [base
// commands](#baseCommands) and the commands defined by the schema.
CommandSet.default = CommandSet.empty.add("schema").add(_base_commands.baseCommands);

// ;; #path=CommandSpec #kind=interface
// Commands are defined using objects that specify various aspects of
// the command. The only property that _must_ appear in a command spec
// is [`run`](#CommandSpec.run). You should probably also give your
// commands a `label`.

// :: string #path=CommandSpec.label
// A user-facing label for the command. This will be used, among other
// things. as the tooltip title for the command's menu item. If there
// is no `label`, the command's `name` will be used instead.

// :: (pm: ProseMirror, ...params: [any]) → ?bool #path=CommandSpec.run
// The function that executes the command. If the command has
// [parameters](#CommandSpec.params), their values are passed as
// arguments. For commands [registered](#SchemaItem.register) on node or
// mark types, `this` will be bound to the node or mark type when this
// function is ran. Should return `false` when the command could not
// be executed.

// :: [CommandParam] #path=CommandSpec.params
// The parameters that this command expects.

// :: (pm: ProseMirror) → bool #path=CommandSpec.select
// The function used to [select](#Command.select) the command. `this`
// will again be bound to a node or mark type, when available.

// :: (pm: ProseMirror) → bool #path=CommandSpec.active
// The function used to determine whether the command is
// [active](#Command.active). `this` refers to the associated node or
// mark type.

// :: union<Object<[string]>, [string]> #path=CommandSpec.keys
// The default key bindings for this command. May either be an array
// of strings containing [key
// names](https://github.com/marijnh/browserkeymap#a-string-notation-for-key-events),
// or an object with optional `all`, `mac`, and `pc` properties,
// specifying arrays of keys for different platforms.

// :: union<bool, Object> #path=CommandSpec.derive
// [Mark](#MarkType) and [node](#NodeType) types often need to define
// boilerplate commands. To reduce the amount of duplicated code, you
// can derive such commands by setting the `derive` property to either
// `true` or an object which is passed to the deriving function. If
// this object has a `name` property, that is used, instead of the
// command name, to pick a deriving function.
//
// For node types, you can derive `"insert"`, `"make"`, and `"wrap"`.
//
// For mark types, you can derive `"set"`, `"unset"`, and `"toggle"`.

// ;; #path=CommandParam #kind=interface
// The parameters that a command can take are specified using objects
// with the following properties:

// :: string #path=CommandParam.label
// The user-facing name of the parameter. Shown to the user when
// prompting for this parameter.

// :: string #path=CommandParam.type
// The type of the parameter. Supported types are `"text"` and `"select"`.

// :: any #path=CommandParam.default
// A default value for the parameter.

// :: (ProseMirror) → ?any #path=CommandParam.prefill
// A function that, given an editor instance (and a `this` bound to
// the command's source item), tries to derive an initial value for
// the parameter, or return null if it can't.

// :: (any) → ?string #path=CommandParam.validate
// An optional function that is called to validate values provided for
// this parameter. Should return a falsy value when the value is
// valid, and an error message when it is not.

function deriveKeymap(pm) {
  var bindings = {},
      platform = _dom.browser.mac ? "mac" : "pc";
  function add(command, keys) {
    for (var i = 0; i < keys.length; i++) {
      var _$exec = /^(.+?)(?:\((\d+)\))?$/.exec(keys[i]);

      var _$exec2 = _slicedToArray(_$exec, 3);

      var _ = _$exec2[0];
      var name = _$exec2[1];
      var _$exec2$ = _$exec2[2];
      var rank = _$exec2$ === undefined ? 50 : _$exec2$;

      (0, _sortedinsert2.default)(bindings[name] || (bindings[name] = []), { command: command, rank: rank }, function (a, b) {
        return a.rank - b.rank;
      });
    }
  }
  for (var name in pm.commands) {
    var cmd = pm.commands[name],
        keys = cmd.spec.keys;
    if (!keys) continue;
    if (Array.isArray(keys)) {
      add(cmd, keys);
    } else {
      if (keys.all) add(cmd, keys.all);
      if (keys[platform]) add(cmd, keys[platform]);
    }
  }

  for (var key in bindings) {
    bindings[key] = bindings[key].map(function (b) {
      return b.command.name;
    });
  }return new _browserkeymap2.default(bindings);
}

function updateCommands(pm, set) {
  // :: () #path=ProseMirror#events#commandsChanging
  // Fired before the set of commands for the editor is updated.
  pm.signal("commandsChanging");
  pm.commands = set.derive(pm.schema);
  pm.input.baseKeymap = deriveKeymap(pm);
  pm.commandKeys = Object.create(null);
  // :: () #path=ProseMirror#events#commandsChanged
  // Fired when the set of commands for the editor is updated.
  pm.signal("commandsChanged");
}

function markActive(pm, type) {
  var sel = pm.selection;
  if (sel.empty) return type.isInSet(pm.activeMarks());else return pm.doc.rangeHasMark(sel.from, sel.to, type);
}

function canAddInline(pm, type) {
  var _pm$selection = pm.selection;
  var from = _pm$selection.from;
  var to = _pm$selection.to;
  var empty = _pm$selection.empty;

  if (empty) return !type.isInSet(pm.activeMarks()) && pm.doc.resolve(from).parent.type.canContainMark(type);
  var can = false;
  pm.doc.nodesBetween(from, to, function (node) {
    if (can || node.isTextblock && !node.type.canContainMark(type)) return false;
    if (node.isInline && !type.isInSet(node.marks)) can = true;
  });
  return can;
}

function markApplies(pm, type) {
  var _pm$selection2 = pm.selection;
  var from = _pm$selection2.from;
  var to = _pm$selection2.to;

  var relevant = false;
  pm.doc.nodesBetween(from, to, function (node) {
    if (node.isTextblock) {
      if (node.type.canContainMark(type)) relevant = true;
      return false;
    }
  });
  return relevant;
}

function selectedMarkAttr(pm, type, attr) {
  var _pm$selection3 = pm.selection;
  var from = _pm$selection3.from;
  var to = _pm$selection3.to;
  var empty = _pm$selection3.empty;

  var start = undefined,
      end = undefined;
  if (empty) {
    start = end = type.isInSet(pm.activeMarks());
  } else {
    var startChunk = pm.doc.resolve(from).nodeAfter;
    start = startChunk ? type.isInSet(startChunk.marks) : null;
    end = type.isInSet(pm.doc.marksAt(to));
  }
  if (start && end && start.attrs[attr] == end.attrs[attr]) return start.attrs[attr];
}

function selectedNodeAttr(pm, type, name) {
  var node = pm.selection.node;

  if (node && node.type == type) return node.attrs[name];
}

function deriveParams(type, params) {
  return params && params.map(function (param) {
    var attr = type.attrs[param.attr];
    var obj = { type: "text",
      default: attr.default,
      prefill: type instanceof _model.NodeType ? function (pm) {
        return selectedNodeAttr(pm, this, param.attr);
      } : function (pm) {
        return selectedMarkAttr(pm, this, param.attr);
      } };
    for (var prop in param) {
      obj[prop] = param[prop];
    }return obj;
  });
}

function fillAttrs(conf, givenParams) {
  var attrs = conf.attrs;
  if (conf.params) {
    (function () {
      var filled = Object.create(null);
      if (attrs) for (var name in attrs) {
        filled[name] = attrs[name];
      }conf.params.forEach(function (param, i) {
        return filled[param.attr] = givenParams[i];
      });
      attrs = filled;
    })();
  }
  return attrs;
}

_model.NodeType.derivableCommands = Object.create(null);
_model.MarkType.derivableCommands = Object.create(null);

_model.MarkType.derivableCommands.set = function (conf) {
  return {
    run: function run(pm) {
      for (var _len = arguments.length, params = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        params[_key - 1] = arguments[_key];
      }

      pm.setMark(this, true, fillAttrs(conf, params));
    },
    select: function select(pm) {
      return conf.inverseSelect ? markApplies(pm, this) && !markActive(pm, this) : canAddInline(pm, this);
    },

    params: deriveParams(this, conf.params)
  };
};

_model.MarkType.derivableCommands.unset = function () {
  return {
    run: function run(pm) {
      pm.setMark(this, false);
    },
    select: function select(pm) {
      return markActive(pm, this);
    }
  };
};

_model.MarkType.derivableCommands.toggle = function () {
  return {
    run: function run(pm) {
      pm.setMark(this, null);
    },
    active: function active(pm) {
      return markActive(pm, this);
    },
    select: function select(pm) {
      return markApplies(pm, this);
    }
  };
};

function isAtTopOfListItem(doc, from, to, listType) {
  var $from = doc.resolve(from);
  return $from.sameParent(doc.resolve(to)) && $from.depth >= 2 && $from.index($from.depth - 1) == 0 && listType.canContain($from.node($from.depth - 1));
}

_model.NodeType.derivableCommands.wrap = function (conf) {
  return {
    run: function run(pm) {
      var _pm$selection4 = pm.selection;
      var from = _pm$selection4.from;
      var to = _pm$selection4.to;
      var head = _pm$selection4.head;var doJoin = false;
      var $from = pm.doc.resolve(from);
      if (conf.list && head && isAtTopOfListItem(pm.doc, from, to, this)) {
        // Don't do anything if this is the top of the list
        if ($from.index($from.depth - 2) == 0) return false;
        doJoin = true;
      }

      for (var _len2 = arguments.length, params = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        params[_key2 - 1] = arguments[_key2];
      }

      var tr = pm.tr.wrap(from, to, this, fillAttrs(conf, params));
      if (doJoin) tr.join($from.before($from.depth - 1));
      return tr.apply(pm.apply.scroll);
    },
    select: function select(pm) {
      var _pm$selection5 = pm.selection;
      var from = _pm$selection5.from;
      var to = _pm$selection5.to;
      var head = _pm$selection5.head;var $from = undefined;
      if (conf.list && head && isAtTopOfListItem(pm.doc, from, to, this) && ($from = pm.doc.resolve(from)).index($from.depth - 2) == 0) return false;
      return (0, _transform.canWrap)(pm.doc, from, to, this, conf.attrs);
    },

    params: deriveParams(this, conf.params)
  };
};

function alreadyHasBlockType(doc, from, to, type, attrs) {
  var found = false;
  if (!attrs) attrs = {};
  doc.nodesBetween(from, to || from, function (node) {
    if (node.isTextblock) {
      if (node.hasMarkup(type, attrs)) found = true;
      return false;
    }
  });
  return found;
}

function activeTextblockIs(pm, type, attrs) {
  var _pm$selection6 = pm.selection;
  var from = _pm$selection6.from;
  var to = _pm$selection6.to;
  var node = _pm$selection6.node;

  if (!node || node.isInline) {
    var $from = pm.doc.resolve(from);
    if (!$from.sameParent(pm.doc.resolve(to))) return false;
    node = $from.parent;
  } else if (!node.isTextblock) {
    return false;
  }
  return node.hasMarkup(type, attrs);
}

_model.NodeType.derivableCommands.make = function (conf) {
  return {
    run: function run(pm) {
      var _pm$selection7 = pm.selection;
      var from = _pm$selection7.from;
      var to = _pm$selection7.to;

      return pm.tr.setBlockType(from, to, this, conf.attrs).apply(pm.apply.scroll);
    },

    // FIXME deal with situations where not all text blocks have the same kind
    select: function select(pm) {
      var _pm$selection8 = pm.selection;
      var from = _pm$selection8.from;
      var to = _pm$selection8.to;
      var node = _pm$selection8.node;

      if (node) return node.isTextblock && !node.hasMarkup(this, conf.attrs);else return !alreadyHasBlockType(pm.doc, from, to, this, conf.attrs);
    },
    active: function active(pm) {
      return activeTextblockIs(pm, this, conf.attrs);
    }
  };
};

_model.NodeType.derivableCommands.insert = function (conf) {
  return {
    run: function run(pm) {
      for (var _len3 = arguments.length, params = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        params[_key3 - 1] = arguments[_key3];
      }

      return pm.tr.replaceSelection(this.create(fillAttrs(conf, params))).apply(pm.apply.scroll);
    },

    select: this.isInline ? function (pm) {
      return pm.doc.resolve(pm.selection.from).parent.type.canContainType(this);
    } : null,
    params: deriveParams(this, conf.params)
  };
};
},{"../dom":1,"../model":33,"../transform":40,"../util/obj":53,"../util/sortedinsert":54,"./base_commands":2,"browserkeymap":55}],6:[function(require,module,exports){
"use strict";

var _dom = require("../dom");

(0, _dom.insertCSS)("\n\n.ProseMirror {\n  border: 1px solid silver;\n  position: relative;\n}\n\n.ProseMirror-content {\n  padding: 4px 8px 4px 14px;\n  white-space: pre-wrap;\n  line-height: 1.2;\n}\n\n.ProseMirror-drop-target {\n  position: absolute;\n  width: 1px;\n  background: #666;\n}\n\n.ProseMirror-content ul.tight p, .ProseMirror-content ol.tight p {\n  margin: 0;\n}\n\n.ProseMirror-content ul, .ProseMirror-content ol {\n  padding-left: 30px;\n  cursor: default;\n}\n\n.ProseMirror-content blockquote {\n  padding-left: 1em;\n  border-left: 3px solid #eee;\n  margin-left: 0; margin-right: 0;\n}\n\n.ProseMirror-content pre {\n  white-space: pre-wrap;\n}\n\n.ProseMirror-selectednode {\n  outline: 2px solid #8cf;\n}\n\n.ProseMirror-nodeselection *::selection { background: transparent; }\n.ProseMirror-nodeselection *::-moz-selection { background: transparent; }\n\n.ProseMirror-content p:first-child,\n.ProseMirror-content h1:first-child,\n.ProseMirror-content h2:first-child,\n.ProseMirror-content h3:first-child,\n.ProseMirror-content h4:first-child,\n.ProseMirror-content h5:first-child,\n.ProseMirror-content h6:first-child {\n  margin-top: .3em;\n}\n\n/* Add space around the hr to make clicking it easier */\n\n.ProseMirror-content hr {\n  position: relative;\n  height: 6px;\n  border: none;\n}\n\n.ProseMirror-content hr:after {\n  content: \"\";\n  position: absolute;\n  left: 10px;\n  right: 10px;\n  top: 2px;\n  border-top: 2px solid silver;\n}\n\n.ProseMirror-content img {\n  cursor: default;\n}\n\n/* Make sure li selections wrap around markers */\n\n.ProseMirror-content li {\n  position: relative;\n  pointer-events: none; /* Don't do weird stuff with marker clicks */\n}\n.ProseMirror-content li > * {\n  pointer-events: auto;\n}\n\nli.ProseMirror-selectednode {\n  outline: none;\n}\n\nli.ProseMirror-selectednode:after {\n  content: \"\";\n  position: absolute;\n  left: -32px;\n  right: -2px; top: -2px; bottom: -2px;\n  border: 2px solid #8cf;\n  pointer-events: none;\n}\n\n");
},{"../dom":1}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.readInputChange = readInputChange;
exports.readCompositionChange = readCompositionChange;

var _model = require("../model");

var _format = require("../format");

var _map = require("../transform/map");

var _selection = require("./selection");

var _dompos = require("./dompos");

function readInputChange(pm) {
  pm.ensureOperation({ readSelection: false });
  return readDOMChange(pm, rangeAroundSelection(pm));
}

function readCompositionChange(pm, margin) {
  return readDOMChange(pm, rangeAroundComposition(pm, margin));
}

// Note that all referencing and parsing is done with the
// start-of-operation selection and document, since that's the one
// that the DOM represents. If any changes came in in the meantime,
// the modification is mapped over those before it is applied, in
// readDOMChange.

function parseBetween(pm, from, to) {
  var _DOMFromPos = (0, _dompos.DOMFromPos)(pm, from, true);

  var parent = _DOMFromPos.node;
  var startOff = _DOMFromPos.offset;

  var endOff = (0, _dompos.DOMFromPos)(pm, to, true).offset;
  while (startOff) {
    var prev = parent.childNodes[startOff - 1];
    if (prev.nodeType != 1 || !prev.hasAttribute("pm-offset")) --startOff;else break;
  }
  while (endOff < parent.childNodes.length) {
    var next = parent.childNodes[endOff];
    if (next.nodeType != 1 || !next.hasAttribute("pm-offset")) ++endOff;else break;
  }
  return (0, _format.fromDOM)(pm.schema, parent, {
    topNode: pm.doc.resolve(from).parent.copy(),
    from: startOff,
    to: endOff,
    preserveWhitespace: true,
    editableContent: true
  });
}

function isAtEnd($pos, depth) {
  for (var i = depth || 0; i < $pos.depth; i++) {
    if ($pos.index(i) + 1 < $pos.node(i).childCount) return false;
  }return $pos.parentOffset == $pos.parent.content.size;
}
function isAtStart($pos, depth) {
  for (var i = depth || 0; i < $pos.depth; i++) {
    if ($pos.index(0) > 0) return false;
  }return $pos.parentOffset == 0;
}

function rangeAroundSelection(pm) {
  var _pm$operation = pm.operation;
  var sel = _pm$operation.sel;
  var doc = _pm$operation.doc;var $from = doc.resolve(sel.from);var $to = doc.resolve(sel.to);
  // When the selection is entirely inside a text block, use
  // rangeAroundComposition to get a narrow range.
  if ($from.sameParent($to) && $from.parent.isTextblock && $from.parentOffset && $to.parentOffset < $to.parent.content.size) return rangeAroundComposition(pm, 0);

  for (var depth = 0;; depth++) {
    var fromStart = isAtStart($from, depth + 1),
        toEnd = isAtEnd($to, depth + 1);
    if (fromStart || toEnd || $from.index(depth) != $to.index(depth) || $to.node(depth).isTextblock) {
      var from = $from.before(depth + 1),
          to = $to.after(depth + 1);
      if (fromStart && $from.index(depth) > 0) from -= $from.node(depth).child($from.index(depth) - 1).nodeSize;
      if (toEnd && $to.index(depth) + 1 < $to.node(depth).childCount) to += $to.node(depth).child($to.index(depth) + 1).nodeSize;
      return { from: from, to: to };
    }
  }
}

function rangeAroundComposition(pm, margin) {
  var _pm$operation2 = pm.operation;
  var sel = _pm$operation2.sel;
  var doc = _pm$operation2.doc;

  var $from = doc.resolve(sel.from),
      $to = doc.resolve(sel.to);
  if (!$from.sameParent($to)) return rangeAroundSelection(pm);
  var startOff = Math.max(0, $from.parentOffset - margin);
  var size = $from.parent.content.size;
  var endOff = Math.min(size, $to.parentOffset + margin);

  if (startOff > 0) startOff = $from.parent.childBefore(startOff).offset;
  if (endOff < size) {
    var after = $from.parent.childAfter(endOff);
    endOff = after.offset + after.node.nodeSize;
  }
  var nodeStart = $from.start($from.depth);
  return { from: nodeStart + startOff, to: nodeStart + endOff };
}

function readDOMChange(pm, range) {
  var op = pm.operation;
  // If the document was reset since the start of the current
  // operation, we can't do anything useful with the change to the
  // DOM, so we discard it.
  if (op.docSet) {
    pm.markAllDirty();
    return;
  }

  var parsed = parseBetween(pm, range.from, range.to);
  var compare = op.doc.slice(range.from, range.to);
  var change = findDiff(compare.content, parsed.content, range.from, op.sel.from);
  if (!change) return;
  var fromMapped = (0, _map.mapThroughResult)(op.mappings, change.start);
  var toMapped = (0, _map.mapThroughResult)(op.mappings, change.endA);
  if (fromMapped.deleted && toMapped.deleted) return;

  // Mark nodes touched by this change as 'to be redrawn'
  markDirtyFor(pm, op.doc, change.start, change.endA);

  var $from = parsed.resolveNoCache(change.start - range.from);
  var $to = parsed.resolveNoCache(change.endB - range.from),
      nextSel = undefined,
      text = undefined;
  // If this looks like the effect of pressing Enter, just dispatch an
  // Enter key instead.
  if (!$from.sameParent($to) && $from.pos < parsed.content.size && (nextSel = (0, _selection.findSelectionFrom)(parsed, $from.pos + 1, 1, true)) && nextSel.head == $to.pos) {
    pm.input.dispatchKey("Enter");
  } else if ($from.sameParent($to) && $from.parent.isTextblock && (text = uniformTextBetween(parsed, $from.pos, $to.pos)) != null) {
    pm.input.insertText(fromMapped.pos, toMapped.pos, text);
  } else {
    var slice = parsed.slice(change.start - range.from, change.endB - range.from);
    pm.tr.replace(fromMapped.pos, toMapped.pos, slice).apply(pm.apply.scroll);
  }
}

function uniformTextBetween(node, from, to) {
  var result = "",
      valid = true,
      marks = null;
  node.nodesBetween(from, to, function (node, pos) {
    if (!node.isInline && pos < from) return;
    if (!node.isText) return valid = false;
    if (!marks) marks = node.marks;else if (!_model.Mark.sameSet(marks, node.marks)) valid = false;
    result += node.text.slice(Math.max(0, from - pos), to - pos);
  });
  return valid ? result : null;
}

function findDiff(a, b, pos, preferedStart) {
  var start = (0, _model.findDiffStart)(a, b, pos);
  if (!start) return null;

  var _findDiffEnd = (0, _model.findDiffEnd)(a, b, pos + a.size, pos + b.size);

  var endA = _findDiffEnd.a;
  var endB = _findDiffEnd.b;

  if (endA < start) {
    var move = preferedStart <= start && preferedStart >= endA ? start - preferedStart : 0;
    start -= move;
    endB = start + (endB - endA);
    endA = start;
  } else if (endB < start) {
    var move = preferedStart <= start && preferedStart >= endB ? start - preferedStart : 0;
    start -= move;
    endA = start + (endA - endB);
    endB = start;
  }
  return { start: start, endA: endA, endB: endB };
}

function markDirtyFor(pm, doc, start, end) {
  var $start = doc.resolve(start),
      $end = doc.resolve(end),
      same = $start.sameDepth($end);
  if (same == 0) pm.markAllDirty();else pm.markRangeDirty($start.before(same), $start.after(same), doc);
}
},{"../format":21,"../model":33,"../transform/map":42,"./dompos":8,"./selection":17}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.posBeforeFromDOM = posBeforeFromDOM;
exports.posFromDOM = posFromDOM;
exports.childContainer = childContainer;
exports.DOMFromPos = DOMFromPos;
exports.DOMAfterPos = DOMAfterPos;
exports.scrollIntoView = scrollIntoView;
exports.posAtCoords = posAtCoords;
exports.coordsAtPos = coordsAtPos;
exports.selectableNodeAbove = selectableNodeAbove;
exports.handleNodeClick = handleNodeClick;

var _dom = require("../dom");

// : (ProseMirror, DOMNode) → number
// Get the path for a given a DOM node in a document.
function posBeforeFromDOM(pm, node) {
  var pos = 0,
      add = 0;
  for (var cur = node; cur != pm.content; cur = cur.parentNode) {
    var attr = cur.getAttribute("pm-offset");
    if (attr) {
      pos += +attr + add;add = 1;
    }
  }
  return pos;
}

// : (ProseMirror, DOMNode, number) → number
function posFromDOM(pm, dom, domOffset) {
  if (pm.operation && pm.doc != pm.operation.doc) throw new RangeError("Fetching a position from an outdated DOM structure");

  if (domOffset == null) {
    domOffset = Array.prototype.indexOf.call(dom.parentNode.childNodes, dom);
    dom = dom.parentNode;
  }

  // Move up to the wrapping container, counting local offset along
  // the way.
  var innerOffset = 0,
      tag = undefined;
  for (;;) {
    var adjust = 0;
    if (dom.nodeType == 3) {
      innerOffset += domOffset;
    } else if (tag = dom.getAttribute("pm-offset") && !childContainer(dom)) {
      var size = +dom.getAttribute("pm-size");
      return posBeforeFromDOM(pm, dom) + (domOffset == dom.childNodes.length ? size : Math.min(innerOffset, size));
    } else if (dom.hasAttribute("pm-container")) {
      break;
    } else if (tag = dom.getAttribute("pm-inner-offset")) {
      innerOffset += +tag;
      adjust = -1;
    } else if (domOffset && domOffset == dom.childNodes.length) {
      adjust = 1;
    }

    var parent = dom.parentNode;
    domOffset = adjust < 0 ? 0 : Array.prototype.indexOf.call(parent.childNodes, dom) + adjust;
    dom = parent;
  }

  var start = dom == pm.content ? 0 : posBeforeFromDOM(pm, dom) + 1,
      before = 0;

  for (var child = dom.childNodes[domOffset - 1]; child; child = child.previousSibling) {
    if (child.nodeType == 1 && (tag = child.getAttribute("pm-offset"))) {
      before += +tag + +child.getAttribute("pm-size");
      break;
    }
  }
  return start + before + innerOffset;
}

// : (DOMNode) → ?DOMNode
function childContainer(dom) {
  return dom.hasAttribute("pm-container") ? dom : dom.querySelector("[pm-container]");
}

// : (DOMNode, number) → {node: DOMNode, offset: number}
// Find the DOM node and offset into that node that the given document
// position refers to.
function DOMFromPos(pm, pos, liberal) {
  if (!liberal && pm.operation && pm.doc != pm.operation.doc) throw new RangeError("Resolving a position in an outdated DOM structure");

  var container = pm.content,
      offset = pos;
  outer: for (;;) {
    for (var child = container.firstChild, i = 0;; child = child.nextSibling, i++) {
      if (!child) {
        if (offset && !liberal) throw new RangeError("Failed to find node at " + pos + " rem = " + offset);
        return { node: container, offset: i };
      }

      var size = child.nodeType == 1 && child.getAttribute("pm-size");
      if (size) {
        if (!offset) return { node: container, offset: i };
        size = +size;
        if (offset < size) {
          container = childContainer(child);
          if (!container) {
            return leafAt(child, offset);
          } else {
            offset--;
            break;
          }
        } else {
          offset -= size;
        }
      }
    }
  }
}

// : (DOMNode, number) → DOMNode
function DOMAfterPos(pm, pos) {
  var _DOMFromPos = DOMFromPos(pm, pos);

  var node = _DOMFromPos.node;
  var offset = _DOMFromPos.offset;

  if (node.nodeType != 1 || offset == node.childNodes.length) throw new RangeError("No node after pos " + pos);
  return node.childNodes[offset];
}

// : (DOMNode, number) → {node: DOMNode, offset: number}
function leafAt(node, offset) {
  for (;;) {
    var child = node.firstChild;
    if (!child) return { node: node, offset: offset };
    if (child.nodeType != 1) return { node: child, offset: offset };
    if (child.hasAttribute("pm-inner-offset")) {
      var nodeOffset = 0;
      for (;;) {
        var nextSib = child.nextSibling,
            nextOffset = undefined;
        if (!nextSib || (nextOffset = +nextSib.getAttribute("pm-inner-offset")) >= offset) break;
        child = nextSib;
        nodeOffset = nextOffset;
      }
      offset -= nodeOffset;
    }
    node = child;
  }
}

function windowRect() {
  return { left: 0, right: window.innerWidth,
    top: 0, bottom: window.innerHeight };
}

var scrollMargin = 5;

function scrollIntoView(pm, pos) {
  if (!pos) pos = pm.sel.range.head || pm.sel.range.from;
  var coords = coordsAtPos(pm, pos);
  for (var parent = pm.content;; parent = parent.parentNode) {
    var atBody = parent == document.body;
    var rect = atBody ? windowRect() : parent.getBoundingClientRect();
    var moveX = 0,
        moveY = 0;
    if (coords.top < rect.top) moveY = -(rect.top - coords.top + scrollMargin);else if (coords.bottom > rect.bottom) moveY = coords.bottom - rect.bottom + scrollMargin;
    if (coords.left < rect.left) moveX = -(rect.left - coords.left + scrollMargin);else if (coords.right > rect.right) moveX = coords.right - rect.right + scrollMargin;
    if (moveX || moveY) {
      if (atBody) {
        window.scrollBy(moveX, moveY);
      } else {
        if (moveY) parent.scrollTop += moveY;
        if (moveX) parent.scrollLeft += moveX;
      }
    }
    if (atBody) break;
  }
}

function findOffsetInNode(node, coords) {
  var closest = undefined,
      dyClosest = 1e8,
      coordsClosest = undefined,
      offset = 0;
  for (var child = node.firstChild; child; child = child.nextSibling) {
    var rects = undefined;
    if (child.nodeType == 1) rects = child.getClientRects();else if (child.nodeType == 3) rects = textRects(child);else continue;

    for (var i = 0; i < rects.length; i++) {
      var rect = rects[i];
      if (rect.left <= coords.left && rect.right >= coords.left) {
        var dy = rect.top > coords.top ? rect.top - coords.top : rect.bottom < coords.top ? coords.top - rect.bottom : 0;
        if (dy < dyClosest) {
          // FIXME does not group by row
          closest = child;
          dyClosest = dy;
          coordsClosest = dy ? { left: coords.left, top: rect.top } : coords;
          if (child.nodeType == 1 && !child.firstChild) offset = i + (coords.left >= (rect.left + rect.right) / 2 ? 1 : 0);
          continue;
        }
      }
      if (!closest && (coords.top >= rect.bottom || coords.top >= rect.top && coords.left >= rect.right)) offset = i + 1;
    }
  }
  if (!closest) return { node: node, offset: offset };
  if (closest.nodeType == 3) return findOffsetInText(closest, coordsClosest);
  if (closest.firstChild) return findOffsetInNode(closest, coordsClosest);
  return { node: node, offset: offset };
}

function findOffsetInText(node, coords) {
  var len = node.nodeValue.length;
  var range = document.createRange();
  for (var i = 0; i < len; i++) {
    range.setEnd(node, i + 1);
    range.setStart(node, i);
    var rect = range.getBoundingClientRect();
    if (rect.top == rect.bottom) continue;
    if (rect.left - 1 <= coords.left && rect.right + 1 >= coords.left && rect.top - 1 <= coords.top && rect.bottom + 1 >= coords.top) return { node: node, offset: i + (coords.left >= (rect.left + rect.right) / 2 ? 1 : 0) };
  }
  return { node: node, offset: 0 };
}

// Given an x,y position on the editor, get the position in the document.
function posAtCoords(pm, coords) {
  var elt = document.elementFromPoint(coords.left, coords.top + 1);
  if (!(0, _dom.contains)(pm.content, elt)) return null;

  if (!elt.firstChild) elt = elt.parentNode;

  var _findOffsetInNode = findOffsetInNode(elt, coords);

  var node = _findOffsetInNode.node;
  var offset = _findOffsetInNode.offset;

  return posFromDOM(pm, node, offset);
}

function textRect(node, from, to) {
  var range = document.createRange();
  range.setEnd(node, to);
  range.setStart(node, from);
  return range.getBoundingClientRect();
}

function textRects(node) {
  var range = document.createRange();
  range.setEnd(node, node.nodeValue.length);
  range.setStart(node, 0);
  return range.getClientRects();
}

// : (ProseMirror, number) → ClientRect
// Given a position in the document model, get a bounding box of the character at
// that position, relative to the window.
function coordsAtPos(pm, pos) {
  var _DOMFromPos2 = DOMFromPos(pm, pos);

  var node = _DOMFromPos2.node;
  var offset = _DOMFromPos2.offset;

  var side = undefined,
      rect = undefined;
  if (node.nodeType == 3) {
    if (offset < node.nodeValue.length) {
      rect = textRect(node, offset, offset + 1);
      side = "left";
    }
    if ((!rect || rect.left == rect.right) && offset) {
      rect = textRect(node, offset - 1, offset);
      side = "right";
    }
  } else if (node.firstChild) {
    if (offset < node.childNodes.length) {
      var child = node.childNodes[offset];
      rect = child.nodeType == 3 ? textRect(child, 0, child.nodeValue.length) : child.getBoundingClientRect();
      side = "left";
    }
    if ((!rect || rect.left == rect.right) && offset) {
      var child = node.childNodes[offset - 1];
      rect = child.nodeType == 3 ? textRect(child, 0, child.nodeValue.length) : child.getBoundingClientRect();
      side = "right";
    }
  } else {
    rect = node.getBoundingClientRect();
    side = "left";
  }
  var x = rect[side];
  return { top: rect.top, bottom: rect.bottom, left: x, right: x };
}

// ;; #path=NodeType #kind=class #noAnchor
// You can add several properties to [node types](#NodeType) to
// influence the way the editor interacts with them.

// :: (node: Node, pos: number, dom: DOMNode, coords: {left: number, top: number}) → ?number
// #path=NodeType.prototype.countCoordsAsChild
// Specifies that, if this node is clicked, a child node might
// actually be meant. This is used to, for example, make clicking a
// list marker (which, in the DOM, is part of the list node) select
// the list item it belongs to. Should return null if the given
// coordinates don't refer to a child node, or the position
// before the child otherwise.

function selectableNodeAbove(pm, dom, coords, liberal) {
  for (; dom && dom != pm.content; dom = dom.parentNode) {
    if (dom.hasAttribute("pm-offset")) {
      var pos = posBeforeFromDOM(pm, dom),
          node = pm.doc.nodeAt(pos);
      if (node.type.countCoordsAsChild) {
        var result = node.type.countCoordsAsChild(node, pos, dom, coords);
        if (result != null) return result;
      }
      // Leaf nodes are implicitly clickable
      if ((liberal || node.type.contains == null) && node.type.selectable) return pos;
      if (!liberal) return null;
    }
  }
}

// :: (pm: ProseMirror, event: MouseEvent, pos: number, node: Node) → bool
// #path=NodeType.prototype.handleClick
// If a node is directly clicked (that is, the click didn't land in a
// DOM node belonging to a child node), and its type has a
// `handleClick` method, that method is given a chance to handle the
// click. The method is called, and should return `false` if it did
// _not_ handle the click.
//
// The `event` passed is the event for `"mousedown"`, but calling
// `preventDefault` on it has no effect, since this method is only
// called after a corresponding `"mouseup"` has occurred and
// ProseMirror has determined that this is not a drag or multi-click
// event.

// :: (pm: ProseMirror, event: MouseEvent, pos: number, node: Node) → bool
// #path=NodeType.prototype.handleDoubleClick
// This works like [`handleClick`](#NodeType.handleClick), but is
// called for double clicks instead.

// :: (pm: ProseMirror, event: MouseEvent, pos: number, node: Node) → bool
// #path=NodeType.prototype.handleContextMenu
//
// When the [context
// menu](https://developer.mozilla.org/en-US/docs/Web/Events/contextmenu)
// is activated in the editable context, nodes that the clicked
// position falls inside of get a chance to react to it. Node types
// may define a `handleContextMenu` method, which will be called when
// present, first on inner nodes and then up the document tree, until
// one of the methods returns something other than `false`.
//
// The handlers can inspect `event.target` to figure out whether they
// were directly clicked, and may call `event.preventDefault()` to
// prevent the native context menu.

function handleNodeClick(pm, type, event, target, direct) {
  for (var dom = target; dom && dom != pm.content; dom = dom.parentNode) {
    if (dom.hasAttribute("pm-offset")) {
      var pos = posBeforeFromDOM(pm, dom),
          node = pm.doc.nodeAt(pos);
      var handled = node.type[type] && node.type[type](pm, event, pos, node) !== false;
      if (direct || handled) return handled;
    }
  }
}
},{"../dom":1}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.draw = draw;
exports.redraw = redraw;

var _format = require("../format");

var _dom = require("../dom");

var _main = require("./main");

var _dompos = require("./dompos");

function options(ranges) {
  return {
    pos: 0,
    preRenderContent: function preRenderContent() {
      this.pos++;
    },
    postRenderContent: function postRenderContent() {
      this.pos++;
    },
    onRender: function onRender(node, dom, offset) {
      if (node.isBlock) {
        if (offset != null) dom.setAttribute("pm-offset", offset);
        dom.setAttribute("pm-size", node.nodeSize);
        if (node.isTextblock) adjustTrailingHacks(dom, node);
        if (dom.contentEditable == "false") dom = (0, _dom.elt)("div", null, dom);
        if (!node.type.contains) this.pos++;
      }

      return dom;
    },
    onContainer: function onContainer(node) {
      node.setAttribute("pm-container", true);
    },

    // : (Node, DOMNode, number) → DOMNode
    renderInlineFlat: function renderInlineFlat(node, dom, offset) {
      ranges.advanceTo(this.pos);
      var pos = this.pos,
          end = pos + node.nodeSize;
      var nextCut = ranges.nextChangeBefore(end);

      var inner = dom,
          wrapped = undefined;
      for (var i = 0; i < node.marks.length; i++) {
        inner = inner.firstChild;
      }if (dom.nodeType != 1) {
        dom = (0, _dom.elt)("span", null, dom);
        if (nextCut == -1) wrapped = dom;
      }
      if (!wrapped && (nextCut > -1 || ranges.current.length)) {
        wrapped = inner == dom ? dom = (0, _dom.elt)("span", null, inner) : inner.parentNode.appendChild((0, _dom.elt)("span", null, inner));
      }

      dom.setAttribute("pm-offset", offset);
      dom.setAttribute("pm-size", node.nodeSize);

      var inlineOffset = 0;
      while (nextCut > -1) {
        var size = nextCut - pos;
        var split = splitSpan(wrapped, size);
        if (ranges.current.length) split.className = ranges.current.join(" ");
        split.setAttribute("pm-inner-offset", inlineOffset);
        inlineOffset += size;
        ranges.advanceTo(nextCut);
        nextCut = ranges.nextChangeBefore(end);
        if (nextCut == -1) wrapped.setAttribute("pm-inner-offset", inlineOffset);
        pos += size;
      }

      if (ranges.current.length) wrapped.className = ranges.current.join(" ");
      this.pos += node.nodeSize;
      return dom;
    },

    document: document
  };
}

function splitSpan(span, at) {
  var textNode = span.firstChild,
      text = textNode.nodeValue;
  var newNode = span.parentNode.insertBefore((0, _dom.elt)("span", null, text.slice(0, at)), span);
  textNode.nodeValue = text.slice(at);
  return newNode;
}

function draw(pm, doc) {
  pm.content.textContent = "";
  pm.content.appendChild((0, _format.toDOM)(doc, options(pm.ranges.activeRangeTracker())));
}

function adjustTrailingHacks(dom, node) {
  var needs = node.content.size == 0 || node.lastChild.type.isBR || node.type.isCode && node.lastChild.isText && /\n$/.test(node.lastChild.text) ? "br" : !node.lastChild.isText && node.lastChild.type.contains == null ? "text" : null;
  var last = dom.lastChild;
  var has = !last || last.nodeType != 1 || !last.hasAttribute("pm-ignore") ? null : last.nodeName == "BR" ? "br" : "text";
  if (needs != has) {
    if (has) dom.removeChild(last);
    if (needs) dom.appendChild(needs == "br" ? (0, _dom.elt)("br", { "pm-ignore": "trailing-break" }) : (0, _dom.elt)("span", { "pm-ignore": "cursor-text" }, ""));
  }
}

function findNodeIn(parent, i, node) {
  for (; i < parent.childCount; i++) {
    var child = parent.child(i);
    if (child == node) return i;
  }
  return -1;
}

function movePast(dom) {
  var next = dom.nextSibling;
  dom.parentNode.removeChild(dom);
  return next;
}

function redraw(pm, dirty, doc, prev) {
  if (dirty.get(prev) == _main.DIRTY_REDRAW) return draw(pm, doc);

  var opts = options(pm.ranges.activeRangeTracker());

  function scan(dom, node, prev, pos) {
    var iPrev = 0,
        pChild = prev.firstChild;
    var domPos = dom.firstChild;

    for (var iNode = 0, offset = 0; iNode < node.childCount; iNode++) {
      var child = node.child(iNode),
          matching = undefined,
          reuseDOM = undefined;
      var found = pChild == child ? iPrev : findNodeIn(prev, iPrev + 1, child);
      if (found > -1) {
        matching = child;
        while (iPrev != found) {
          iPrev++;
          domPos = movePast(domPos);
        }
      }

      if (matching && !dirty.get(matching)) {
        reuseDOM = true;
      } else if (pChild && !child.isText && child.sameMarkup(pChild) && dirty.get(pChild) != _main.DIRTY_REDRAW) {
        reuseDOM = true;
        if (pChild.type.contains) scan((0, _dompos.childContainer)(domPos), child, pChild, pos + offset + 1);
      } else {
        opts.pos = pos + offset;
        var rendered = (0, _format.nodeToDOM)(child, opts, offset);
        dom.insertBefore(rendered, domPos);
        reuseDOM = false;
      }

      if (reuseDOM) {
        domPos.setAttribute("pm-offset", offset);
        domPos.setAttribute("pm-size", child.nodeSize);
        domPos = domPos.nextSibling;
        pChild = prev.maybeChild(++iPrev);
      }
      offset += child.nodeSize;
    }

    while (pChild) {
      domPos = movePast(domPos);
      pChild = prev.maybeChild(++iPrev);
    }
    if (node.isTextblock) adjustTrailingHacks(dom, node);
  }
  scan(pm.content, doc, prev, 0);
}
},{"../dom":1,"../format":21,"./dompos":8,"./main":13}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.History = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _transform = require("../transform");

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ProseMirror's history implements not a way to roll back to a
// previous state, because ProseMirror supports applying changes
// without adding them to the history (for example during
// collaboration).
//
// To this end, each 'Branch' (one for the undo history and one for
// the redo history) keeps an array of 'Items', which can optionally
// hold a step (an actual undoable change), and always hold a position
// map (which is needed to move changes below them to apply to the
// current document).
//
// An item that has both a step and a selection token field is the
// start of an 'event' -- a group of changes that will be undone or
// redone at once. (It stores only a token, since that way we don't
// have to provide a document until the selection is actually applied,
// which is useful when compressing.)

// Used to schedule history compression
var max_empty_items = 500;

var Branch = function () {
  function Branch(maxEvents) {
    _classCallCheck(this, Branch);

    this.events = 0;
    this.maxEvents = maxEvents;
    // Item 0 is always a dummy that's only used to have an id to
    // refer to at the start of the history.
    this.items = [new Item()];
  }

  // : (Node, bool, ?Item) → ?{transform: Transform, selection: SelectionToken, ids: [number]}
  // Pop the latest event off the branch's history and apply it
  // to a document transform, returning the transform and the step IDs.


  _createClass(Branch, [{
    key: "popEvent",
    value: function popEvent(doc, preserveItems, upto) {
      var preserve = preserveItems,
          transform = new _transform.Transform(doc);
      var remap = new BranchRemapping();
      var selection = undefined,
          ids = [],
          i = this.items.length;

      for (;;) {
        var cur = this.items[--i];
        if (upto && cur == upto) break;
        if (!cur.map) return null;

        if (!cur.step) {
          remap.add(cur);
          preserve = true;
          continue;
        }

        if (preserve) {
          var step = cur.step.map(remap.remap),
              map = undefined;

          this.items[i] = new MapItem(cur.map);
          if (step && transform.maybeStep(step).doc) {
            map = transform.maps[transform.maps.length - 1];
            this.items.push(new MapItem(map, this.items[i].id));
          }
          remap.movePastStep(cur, map);
        } else {
          this.items.pop();
          transform.maybeStep(cur.step);
        }

        ids.push(cur.id);
        if (cur.selection) {
          this.events--;
          if (!upto) {
            selection = cur.selection.type.mapToken(cur.selection, remap.remap);
            break;
          }
        }
      }

      return { transform: transform, selection: selection, ids: ids };
    }
  }, {
    key: "clear",
    value: function clear() {
      this.items.length = 1;
      this.events = 0;
    }

    // : (Transform, ?[number]) → Branch
    // Create a new branch with the given transform added.

  }, {
    key: "addTransform",
    value: function addTransform(transform, selection, ids) {
      for (var i = 0; i < transform.steps.length; i++) {
        var step = transform.steps[i].invert(transform.docs[i]);
        this.items.push(new StepItem(transform.maps[i], ids && ids[i], step, selection));
        if (selection) {
          this.events++;
          selection = null;
        }
      }
      if (this.events > this.maxEvents) this.clip();
    }

    // Clip this branch to the max number of events.

  }, {
    key: "clip",
    value: function clip() {
      var seen = 0,
          toClip = this.events - this.maxEvents;
      for (var i = 0;; i++) {
        var cur = this.items[i];
        if (cur.selection) {
          if (seen < toClip) {
            ++seen;
          } else {
            this.items.splice(0, i, new Item(null, this.events[toClip - 1]));
            this.events = this.maxEvents;
            return;
          }
        }
      }
    }
  }, {
    key: "addMaps",
    value: function addMaps(array) {
      if (this.events == 0) return;
      for (var i = 0; i < array.length; i++) {
        this.items.push(new MapItem(array[i]));
      }
    }
  }, {
    key: "findChangeID",
    value: function findChangeID(id) {
      if (id == this.items[0].id) return this.items[0];

      for (var i = this.items.length - 1; i >= 0; i--) {
        var cur = this.items[i];
        if (cur.step) {
          if (cur.id == id) return cur;
          if (cur.id < id) return null;
        }
      }
    }

    // : ([PosMap], Transform, [number])
    // When the collab module receives remote changes, the history has
    // to know about those, so that it can adjust the steps that were
    // rebased on top of the remote changes, and include the position
    // maps for the remote changes in its array of items.

  }, {
    key: "rebased",
    value: function rebased(newMaps, rebasedTransform, positions) {
      if (this.events == 0) return;

      var rebasedItems = [],
          start = this.items.length - positions.length,
          startPos = 0;
      if (start < 1) {
        startPos = 1 - start;
        start = 1;
        this.items[0] = new Item();
      }

      if (positions.length) {
        var remap = new _transform.Remapping([], newMaps.slice());
        for (var iItem = start, iPosition = startPos; iItem < this.items.length; iItem++) {
          var item = this.items[iItem],
              pos = positions[iPosition++],
              id = undefined;
          if (pos != -1) {
            var map = rebasedTransform.maps[pos];
            if (item.step) {
              var step = rebasedTransform.steps[pos].invert(rebasedTransform.docs[pos]);
              var selection = item.selection && item.selection.type.mapToken(item.selection, remap);
              rebasedItems.push(new StepItem(map, item.id, step, selection));
            } else {
              rebasedItems.push(new MapItem(map));
            }
            id = remap.addToBack(map);
          }
          remap.addToFront(item.map.invert(), id);
        }

        this.items.length = start;
      }

      for (var i = 0; i < newMaps.length; i++) {
        this.items.push(new MapItem(newMaps[i]));
      }for (var i = 0; i < rebasedItems.length; i++) {
        this.items.push(rebasedItems[i]);
      }if (!this.compressing && this.emptyItems(start) + newMaps.length > max_empty_items) this.compress(start + newMaps.length);
    }
  }, {
    key: "emptyItems",
    value: function emptyItems(upto) {
      var count = 0;
      for (var i = 1; i < upto; i++) {
        if (!this.items[i].step) count++;
      }return count;
    }

    // Compressing a branch means rewriting it to push the air (map-only
    // items) out. During collaboration, these naturally accumulate
    // because each remote change adds one. The `upto` argument is used
    // to ensure that only the items below a given level are compressed,
    // because `rebased` relies on a clean, untouched set of items in
    // order to associate old ids to rebased steps.

  }, {
    key: "compress",
    value: function compress(upto) {
      var remap = new BranchRemapping();
      var items = [],
          events = 0;
      for (var i = this.items.length - 1; i >= 0; i--) {
        var item = this.items[i];
        if (i >= upto) {
          items.push(item);
        } else if (item.step) {
          var step = item.step.map(remap.remap),
              map = step && step.posMap();
          remap.movePastStep(item, map);
          if (step) {
            var selection = item.selection && item.selection.type.mapToken(item.selection, remap.remap);
            items.push(new StepItem(map.invert(), item.id, step, selection));
            if (selection) events++;
          }
        } else if (item.map) {
          remap.add(item);
        } else {
          items.push(item);
        }
      }
      this.items = items.reverse();
      this.events = events;
    }
  }, {
    key: "toString",
    value: function toString() {
      return this.items.join("\n");
    }
  }, {
    key: "changeID",
    get: function get() {
      for (var i = this.items.length - 1; i > 0; i--) {
        if (this.items[i].step) return this.items[i].id;
      }return this.items[0].id;
    }
  }]);

  return Branch;
}();

// History items all have ids, but the meaning of these is somewhat
// complicated.
//
// - For StepItems, the ids are kept ordered (inside a given branch),
//   and are kept associated with a given change (if you undo and then
//   redo it, the resulting item gets the old id)
//
// - For MapItems, the ids are just opaque identifiers, not
//   necessarily ordered.
//
// - The placeholder item at the base of a branch's list


var nextID = 1;

var Item = function () {
  function Item(map, id) {
    _classCallCheck(this, Item);

    this.map = map;
    this.id = id || nextID++;
  }

  _createClass(Item, [{
    key: "toString",
    value: function toString() {
      return this.id + ":" + (this.map || "") + (this.step ? ":" + this.step : "") + (this.mirror != null ? "->" + this.mirror : "");
    }
  }]);

  return Item;
}();

var StepItem = function (_Item) {
  _inherits(StepItem, _Item);

  function StepItem(map, id, step, selection) {
    _classCallCheck(this, StepItem);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(StepItem).call(this, map, id));

    _this.step = step;
    _this.selection = selection;
    return _this;
  }

  return StepItem;
}(Item);

var MapItem = function (_Item2) {
  _inherits(MapItem, _Item2);

  function MapItem(map, mirror) {
    _classCallCheck(this, MapItem);

    var _this2 = _possibleConstructorReturn(this, Object.getPrototypeOf(MapItem).call(this, map));

    _this2.mirror = mirror;
    return _this2;
  }

  return MapItem;
}(Item);

// Assists with remapping a step with other changes that have been
// made since the step was first applied.


var BranchRemapping = function () {
  function BranchRemapping() {
    _classCallCheck(this, BranchRemapping);

    this.remap = new _transform.Remapping();
    this.mirrorBuffer = Object.create(null);
  }

  _createClass(BranchRemapping, [{
    key: "add",
    value: function add(item) {
      var id = this.remap.addToFront(item.map, this.mirrorBuffer[item.id]);
      if (item.mirror != null) this.mirrorBuffer[item.mirror] = id;
      return id;
    }
  }, {
    key: "movePastStep",
    value: function movePastStep(item, map) {
      var id = this.add(item);
      if (map) this.remap.addToBack(map, id);
    }
  }]);

  return BranchRemapping;
}();

// ;; An undo/redo history manager for an editor instance.


var History = exports.History = function () {
  function History(pm) {
    _classCallCheck(this, History);

    this.pm = pm;

    this.done = new Branch(pm.options.historyDepth);
    this.undone = new Branch(pm.options.historyDepth);

    this.lastAddedAt = 0;
    this.ignoreTransform = false;
    this.preserveItems = 0;

    pm.on("transform", this.recordTransform.bind(this));
  }

  // : (Transform, Selection, Object)
  // Record a transformation in undo history.


  _createClass(History, [{
    key: "recordTransform",
    value: function recordTransform(transform, selection, options) {
      if (this.ignoreTransform) return;

      if (options.addToHistory == false) {
        this.done.addMaps(transform.maps);
        this.undone.addMaps(transform.maps);
      } else {
        var now = Date.now();
        // Group transforms that occur in quick succession into one event.
        var newGroup = now > this.lastAddedAt + this.pm.options.historyEventDelay;
        this.done.addTransform(transform, newGroup ? selection.token : null);
        this.undone.clear();
        this.lastAddedAt = now;
      }
    }

    // :: () → bool
    // Undo one history event. The return value indicates whether
    // anything was actually undone. Note that in a collaborative
    // context, or when changes are [applied](#ProseMirror.apply)
    // without adding them to the history, it is possible for
    // [`undoDepth`](#History.undoDepth) to have a positive value, but
    // this method to still return `false`, when non-history changes
    // overwrote all remaining changes in the history.

  }, {
    key: "undo",
    value: function undo() {
      return this.shift(this.done, this.undone);
    }

    // :: () → bool
    // Redo one history event. The return value indicates whether
    // anything was actually redone.

  }, {
    key: "redo",
    value: function redo() {
      return this.shift(this.undone, this.done);
    }

    // :: number
    // The amount of undoable events available.

  }, {
    key: "shift",


    // : (Branch, Branch) → bool
    // Apply the latest event from one branch to the document and optionally
    // shift the event onto the other branch. Returns true when an event could
    // be shifted.
    value: function shift(from, to) {
      var pop = from.popEvent(this.pm.doc, this.preserveItems > 0);
      if (!pop) return false;
      var selectionBeforeTransform = this.pm.selection;

      if (!pop.transform.steps.length) return this.shift(from, to);

      var selection = pop.selection.type.fromToken(pop.selection, pop.transform.doc);
      this.applyIgnoring(pop.transform, selection);

      // Store the selection before transform on the event so that
      // it can be reapplied if the event is undone or redone (e.g.
      // redoing a character addition should place the cursor after
      // the character).
      to.addTransform(pop.transform, selectionBeforeTransform.token, pop.ids);

      this.lastAddedAt = 0;

      return true;
    }
  }, {
    key: "applyIgnoring",
    value: function applyIgnoring(transform, selection) {
      this.ignoreTransform = true;
      this.pm.apply(transform, { selection: selection, filter: false });
      this.ignoreTransform = false;
    }

    // :: () → Object
    // Get the current ‘version’ of the editor content. This can be used
    // to later [check](#History.isAtVersion) whether anything changed, or
    // to [roll back](#History.backToVersion) to this version.

  }, {
    key: "getVersion",
    value: function getVersion() {
      return this.done.changeID;
    }

    // :: (Object) → bool
    // Returns `true` when the editor history is in the state that it
    // was when the given [version](#History.getVersion) was recorded.
    // That means either no changes were made, or changes were
    // done/undone and then undone/redone again.

  }, {
    key: "isAtVersion",
    value: function isAtVersion(version) {
      return this.done.changeID == version;
    }

    // :: (Object) → bool
    // Rolls back all changes made since the given
    // [version](#History.getVersion) was recorded. Returns `false` if
    // that version was no longer found in the history, and thus the
    // action could not be completed.

  }, {
    key: "backToVersion",
    value: function backToVersion(version) {
      var found = this.done.findChangeID(version);
      if (!found) return false;

      var _done$popEvent = this.done.popEvent(this.pm.doc, this.preserveItems > 0, found);

      var transform = _done$popEvent.transform;

      this.applyIgnoring(transform);
      this.undone.clear();
      return true;
    }

    // Used by the collab module to tell the history that some of its
    // content has been rebased.

  }, {
    key: "rebased",
    value: function rebased(newMaps, rebasedTransform, positions) {
      this.done.rebased(newMaps, rebasedTransform, positions);
      this.undone.rebased(newMaps, rebasedTransform, positions);
    }
  }, {
    key: "undoDepth",
    get: function get() {
      return this.done.events;
    }

    // :: number
    // The amount of redoable events available.

  }, {
    key: "redoDepth",
    get: function get() {
      return this.undone.events;
    }
  }]);

  return History;
}();
},{"../transform":40}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Keymap = exports.baseCommands = exports.Command = exports.CommandSet = exports.MarkedRange = exports.NodeSelection = exports.TextSelection = exports.Selection = exports.defineOption = exports.ProseMirror = undefined;

var _main = require("./main");

Object.defineProperty(exports, "ProseMirror", {
  enumerable: true,
  get: function get() {
    return _main.ProseMirror;
  }
});

var _options = require("./options");

Object.defineProperty(exports, "defineOption", {
  enumerable: true,
  get: function get() {
    return _options.defineOption;
  }
});

var _selection = require("./selection");

Object.defineProperty(exports, "Selection", {
  enumerable: true,
  get: function get() {
    return _selection.Selection;
  }
});
Object.defineProperty(exports, "TextSelection", {
  enumerable: true,
  get: function get() {
    return _selection.TextSelection;
  }
});
Object.defineProperty(exports, "NodeSelection", {
  enumerable: true,
  get: function get() {
    return _selection.NodeSelection;
  }
});

var _range = require("./range");

Object.defineProperty(exports, "MarkedRange", {
  enumerable: true,
  get: function get() {
    return _range.MarkedRange;
  }
});

var _command = require("./command");

Object.defineProperty(exports, "CommandSet", {
  enumerable: true,
  get: function get() {
    return _command.CommandSet;
  }
});
Object.defineProperty(exports, "Command", {
  enumerable: true,
  get: function get() {
    return _command.Command;
  }
});

var _base_commands = require("./base_commands");

Object.defineProperty(exports, "baseCommands", {
  enumerable: true,
  get: function get() {
    return _base_commands.baseCommands;
  }
});

require("./schema_commands");

var _browserkeymap = require("browserkeymap");

var _browserkeymap2 = _interopRequireDefault(_browserkeymap);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.Keymap = _browserkeymap2.default;
},{"./base_commands":2,"./command":5,"./main":13,"./options":14,"./range":15,"./schema_commands":16,"./selection":17,"browserkeymap":55}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Input = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _model = require("../model");

var _browserkeymap = require("browserkeymap");

var _browserkeymap2 = _interopRequireDefault(_browserkeymap);

var _format = require("../format");

var _capturekeys = require("./capturekeys");

var _dom = require("../dom");

var _domchange = require("./domchange");

var _selection = require("./selection");

var _dompos = require("./dompos");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var stopSeq = null;

// A collection of DOM events that occur within the editor, and callback functions
// to invoke when the event fires.
var handlers = {};

var Input = exports.Input = function () {
  function Input(pm) {
    var _this = this;

    _classCallCheck(this, Input);

    this.pm = pm;
    this.baseKeymap = null;

    this.keySeq = null;

    this.mouseDown = null;
    this.dragging = null;
    this.dropTarget = null;
    this.shiftKey = false;
    this.finishComposing = null;

    this.keymaps = [];
    this.defaultKeymap = null;

    this.storedMarks = null;

    var _loop = function _loop(event) {
      var handler = handlers[event];
      pm.content.addEventListener(event, function (e) {
        return handler(pm, e);
      });
    };

    for (var event in handlers) {
      _loop(event);
    }

    pm.on("selectionChange", function () {
      return _this.storedMarks = null;
    });
  }

  // Dispatch a key press to the internal keymaps, which will override the default
  // DOM behavior.


  _createClass(Input, [{
    key: "dispatchKey",
    value: function dispatchKey(name, e) {
      var pm = this.pm,
          seq = pm.input.keySeq;
      // If the previous key should be used in sequence with this one, modify the name accordingly.
      if (seq) {
        if (_browserkeymap2.default.isModifierKey(name)) return true;
        clearTimeout(stopSeq);
        stopSeq = setTimeout(function () {
          if (pm.input.keySeq == seq) pm.input.keySeq = null;
        }, 50);
        name = seq + " " + name;
      }

      var handle = function handle(bound) {
        if (bound === false) return "nothing";
        if (bound == "...") return "multi";
        if (bound == null) return false;

        var result = false;
        if (Array.isArray(bound)) {
          for (var i = 0; result === false && i < bound.length; i++) {
            result = handle(bound[i]);
          }
        } else if (typeof bound == "string") {
          result = pm.execCommand(bound);
        } else {
          result = bound(pm);
        }
        return result == false ? false : "handled";
      };

      var result = undefined;
      for (var i = 0; !result && i < pm.input.keymaps.length; i++) {
        result = handle(pm.input.keymaps[i].map.lookup(name, pm));
      }if (!result) result = handle(pm.input.baseKeymap.lookup(name, pm)) || handle(_capturekeys.captureKeys.lookup(name));

      // If the key should be used in sequence with the next key, store the keyname internally.
      if (result == "multi") pm.input.keySeq = name;

      if ((result == "handled" || result == "multi") && e) e.preventDefault();

      if (seq && !result && /\'$/.test(name)) {
        if (e) e.preventDefault();
        return true;
      }
      return !!result;
    }

    // : (ProseMirror, TextSelection, string)
    // Insert text into a document.

  }, {
    key: "insertText",
    value: function insertText(from, to, text) {
      if (from == to && !text) return;
      var pm = this.pm,
          marks = pm.input.storedMarks || pm.doc.marksAt(from);
      var tr = pm.tr.replaceWith(from, to, text ? pm.schema.text(text, marks) : null);
      tr.apply({
        scrollIntoView: true,
        selection: (0, _selection.findSelectionNear)(tr.doc, tr.map(to), -1, true)
      });
      // :: () #path=ProseMirror#events#textInput
      // Fired when the user types text into the editor.
      if (text) pm.signal("textInput", text);
    }
  }, {
    key: "startComposition",
    value: function startComposition(dataLen, realStart) {
      this.pm.ensureOperation({ noFlush: true, readSelection: realStart }).composing = {
        ended: false,
        applied: false,
        margin: dataLen
      };
      this.pm.unscheduleFlush();
    }
  }, {
    key: "applyComposition",
    value: function applyComposition(andFlush) {
      var composing = this.composing;
      if (composing.applied) return;
      (0, _domchange.readCompositionChange)(this.pm, composing.margin);
      composing.applied = true;
      // Operations that read DOM changes must be flushed, to make sure
      // subsequent DOM changes find a clean DOM.
      if (andFlush) this.pm.flush();
    }
  }, {
    key: "composing",
    get: function get() {
      return this.pm.operation && this.pm.operation.composing;
    }
  }]);

  return Input;
}();

handlers.keydown = function (pm, e) {
  // :: () #path=ProseMirror#events#interaction
  // Fired when the user interacts with the editor, for example by
  // clicking on it or pressing a key while it is focused. Mostly
  // useful for closing or resetting transient UI state such as open
  // menus.
  if (!(0, _selection.hasFocus)(pm)) return;
  pm.signal("interaction");
  if (e.keyCode == 16) pm.input.shiftKey = true;
  if (pm.input.composing) return;
  var name = _browserkeymap2.default.keyName(e);
  if (name && pm.input.dispatchKey(name, e)) return;
  pm.sel.fastPoll();
};

handlers.keyup = function (pm, e) {
  if (e.keyCode == 16) pm.input.shiftKey = false;
};

handlers.keypress = function (pm, e) {
  if (!(0, _selection.hasFocus)(pm) || pm.input.composing || !e.charCode || e.ctrlKey && !e.altKey || _dom.browser.mac && e.metaKey) return;
  if (pm.input.dispatchKey(_browserkeymap2.default.keyName(e), e)) return;
  var sel = pm.selection;
  // On iOS, let input through, because if we handle it the virtual
  // keyboard's default case doesn't update (it only does so when the
  // user types or taps, not on selection updates from JavaScript).
  if (!_dom.browser.ios) {
    pm.input.insertText(sel.from, sel.to, String.fromCharCode(e.charCode));
    e.preventDefault();
  }
};

function realTarget(pm, mouseEvent) {
  if (pm.operation && pm.flush()) return document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY);else return mouseEvent.target;
}

function selectClickedNode(pm, e, target) {
  var pos = (0, _dompos.selectableNodeAbove)(pm, target, { left: e.clientX, top: e.clientY }, true);
  if (pos == null) return pm.sel.fastPoll();

  var _pm$selection = pm.selection;
  var node = _pm$selection.node;
  var from = _pm$selection.from;

  if (node) {
    var $pos = pm.doc.resolve(pos),
        $from = pm.doc.resolve(from);
    if ($pos.depth >= $from.depth && $pos.before($from.depth) == from) {
      if ($from.depth == 0) return pm.sel.fastPoll();
      pos = $pos.before($pos.depth);
    }
  }

  pm.setNodeSelection(pos);
  pm.focus();
  e.preventDefault();
}

var lastClick = 0,
    oneButLastClick = 0;

function handleTripleClick(pm, e, target) {
  e.preventDefault();
  var pos = (0, _dompos.selectableNodeAbove)(pm, target, { left: e.clientX, top: e.clientY }, true);
  if (pos != null) {
    var $pos = pm.doc.resolve(pos),
        node = $pos.nodeAfter;
    if (node.isBlock && !node.isTextblock) // Non-textblock block, select it
      pm.setNodeSelection(pos);else if (node.isInline) // Inline node, select whole parent
      pm.setTextSelection($pos.start($pos.depth), $pos.end($pos.depth));else // Textblock, select content
      pm.setTextSelection(pos + 1, pos + 1 + node.content.size);
    pm.focus();
  }
}

handlers.mousedown = function (pm, e) {
  pm.signal("interaction");
  var now = Date.now(),
      doubleClick = now - lastClick < 500,
      tripleClick = now - oneButLastClick < 600;
  oneButLastClick = lastClick;
  lastClick = now;

  var target = realTarget(pm, e);
  if (tripleClick) handleTripleClick(pm, e, target);else if (doubleClick && (0, _dompos.handleNodeClick)(pm, "handleDoubleClick", e, target, true)) {} else pm.input.mouseDown = new MouseDown(pm, e, target, doubleClick);
};

var MouseDown = function () {
  function MouseDown(pm, event, target, doubleClick) {
    _classCallCheck(this, MouseDown);

    this.pm = pm;
    this.event = event;
    this.target = target;
    this.leaveToBrowser = pm.input.shiftKey || doubleClick;

    var pos = (0, _dompos.posBeforeFromDOM)(pm, this.target),
        node = pm.doc.nodeAt(pos);
    this.mightDrag = node.type.draggable || node == pm.sel.range.node ? pos : null;
    if (this.mightDrag != null) {
      this.target.draggable = true;
      if (_dom.browser.gecko && (this.setContentEditable = !this.target.hasAttribute("contentEditable"))) this.target.setAttribute("contentEditable", "false");
    }

    this.x = event.clientX;this.y = event.clientY;

    window.addEventListener("mouseup", this.up = this.up.bind(this));
    window.addEventListener("mousemove", this.move = this.move.bind(this));
    pm.sel.fastPoll();
  }

  _createClass(MouseDown, [{
    key: "done",
    value: function done() {
      window.removeEventListener("mouseup", this.up);
      window.removeEventListener("mousemove", this.move);
      if (this.mightDrag != null) {
        this.target.draggable = false;
        if (_dom.browser.gecko && this.setContentEditable) this.target.removeAttribute("contentEditable");
      }
    }
  }, {
    key: "up",
    value: function up(event) {
      this.done();

      var target = realTarget(this.pm, event);
      if (this.leaveToBrowser || !(0, _dom.contains)(this.pm.content, target)) {
        this.pm.sel.fastPoll();
      } else if (this.event.ctrlKey) {
        selectClickedNode(this.pm, event, target);
      } else if (!(0, _dompos.handleNodeClick)(this.pm, "handleClick", event, target, true)) {
        var pos = (0, _dompos.selectableNodeAbove)(this.pm, target, { left: this.x, top: this.y });
        if (pos) {
          this.pm.setNodeSelection(pos);
          this.pm.focus();
        } else {
          this.pm.sel.fastPoll();
        }
      }
    }
  }, {
    key: "move",
    value: function move(event) {
      if (!this.leaveToBrowser && (Math.abs(this.x - event.clientX) > 4 || Math.abs(this.y - event.clientY) > 4)) this.leaveToBrowser = true;
      this.pm.sel.fastPoll();
    }
  }]);

  return MouseDown;
}();

handlers.touchdown = function (pm) {
  pm.sel.fastPoll();
};

handlers.contextmenu = function (pm, e) {
  (0, _dompos.handleNodeClick)(pm, "handleContextMenu", e, realTarget(pm, e), false);
};

// Input compositions are hard. Mostly because the events fired by
// browsers are A) very unpredictable and inconsistent, and B) not
// cancelable.
//
// ProseMirror has the problem that it must not update the DOM during
// a composition, or the browser will cancel it. What it does is keep
// long-running operations (delayed DOM updates) when a composition is
// active.
//
// We _do not_ trust the information in the composition events which,
// apart from being very uninformative to begin with, is often just
// plain wrong. Instead, when a composition ends, we parse the dom
// around the original selection, and derive an update from that.

handlers.compositionstart = function (pm, e) {
  if (!pm.input.composing && (0, _selection.hasFocus)(pm)) pm.input.startComposition(e.data ? e.data.length : 0, true);
};

handlers.compositionupdate = function (pm) {
  if (!pm.input.composing && (0, _selection.hasFocus)(pm)) pm.input.startComposition(0, false);
};

handlers.compositionend = function (pm, e) {
  if (!(0, _selection.hasFocus)(pm)) return;
  var composing = pm.input.composing;
  if (!composing) {
    // We received a compositionend without having seen any previous
    // events for the composition. If there's data in the event
    // object, we assume that it's a real change, and start a
    // composition. Otherwise, we just ignore it.
    if (e.data) pm.input.startComposition(e.data.length, false);else return;
  } else if (composing.applied) {
    // This happens when a flush during composition causes a
    // syncronous compositionend.
    return;
  }

  clearTimeout(pm.input.finishComposing);
  pm.operation.composing.ended = true;
  // Applying the composition right away from this event confuses
  // Chrome (and probably other browsers), causing them to re-update
  // the DOM afterwards. So we apply the composition either in the
  // next input event, or after a short interval.
  pm.input.finishComposing = window.setTimeout(function () {
    var composing = pm.input.composing;
    if (composing && composing.ended) pm.input.applyComposition(true);
  }, 20);
};

handlers.input = function (pm) {
  if (!(0, _selection.hasFocus)(pm)) return;
  var composing = pm.input.composing;
  if (composing) {
    // Ignore input events during composition, except when the
    // composition has ended, in which case we can apply it.
    if (composing.ended) pm.input.applyComposition(true);
    return;
  }

  // Read the changed DOM and derive an update from that.
  (0, _domchange.readInputChange)(pm);
  pm.flush();
};

function toClipboard(doc, from, to, dataTransfer) {
  var slice = doc.slice(from, to),
      $from = doc.resolve(from);
  var parent = $from.node($from.depth - slice.openLeft);
  var attr = parent.type.name + " " + slice.openLeft + " " + slice.openRight;
  var html = "<div pm-context=\"" + attr + "\">" + (0, _format.toHTML)(slice.content) + "</div>";
  dataTransfer.clearData();
  dataTransfer.setData("text/html", html);
  dataTransfer.setData("text/plain", (0, _format.toText)(slice.content));
  return slice;
}

var cachedCanUpdateClipboard = null;

function canUpdateClipboard(dataTransfer) {
  if (cachedCanUpdateClipboard != null) return cachedCanUpdateClipboard;
  dataTransfer.setData("text/html", "<hr>");
  return cachedCanUpdateClipboard = dataTransfer.getData("text/html") == "<hr>";
}

// :: (text: string) → string #path=ProseMirror#events#transformPastedText
// Fired when plain text is pasted. Handlers must return the given
// string or a [transformed](#EventMixin.signalPipelined) version of
// it.

// :: (html: string) → string #path=ProseMirror#events#transformPastedHTML
// Fired when html content is pasted or dragged into the editor.
// Handlers must return the given string or a
// [transformed](#EventMixin.signalPipelined) version of it.

// :: (slice: Slice) → Slice #path=ProseMirror#events#transformPasted
// Fired when something is pasted or dragged into the editor. The
// given slice represents the pasted content, and your handler can
// return a modified version to manipulate it before it is inserted
// into the document.

// : (ProseMirror, DataTransfer, ?bool) → ?Slice
function fromClipboard(pm, dataTransfer, plainText) {
  var txt = dataTransfer.getData("text/plain");
  var html = dataTransfer.getData("text/html");
  if (!html && !txt) return null;
  var doc = undefined,
      slice = undefined;
  if ((plainText || !html) && txt) {
    doc = (0, _format.parseFrom)(pm.schema, pm.signalPipelined("transformPastedText", txt), "text");
  } else {
    var dom = document.createElement("div");
    dom.innerHTML = pm.signalPipelined("transformPastedHTML", html);
    var wrap = dom.querySelector("[pm-context]"),
        context = undefined,
        contextNodeType = undefined,
        found = undefined;
    if (wrap && (context = /^(\w+) (\d+) (\d+)$/.exec(wrap.getAttribute("pm-context"))) && (contextNodeType = pm.schema.nodes[context[1]]) && contextNodeType.defaultAttrs && (found = parseFromContext(wrap, contextNodeType, +context[2], +context[3]))) slice = found;else doc = (0, _format.fromDOM)(pm.schema, dom);
  }
  if (!slice) slice = doc.slice((0, _selection.findSelectionAtStart)(doc).from, (0, _selection.findSelectionAtEnd)(doc).to);
  return pm.signalPipelined("transformPasted", slice);
}

function parseFromContext(dom, contextNodeType, openLeft, openRight) {
  var schema = contextNodeType.schema,
      contextNode = contextNodeType.create();
  var parsed = (0, _format.fromDOM)(schema, dom, { topNode: contextNode, preserveWhitespace: true });
  return new _model.Slice(parsed.content, clipOpen(parsed.content, openLeft, true), clipOpen(parsed.content, openRight, false), contextNode);
}

function clipOpen(fragment, max, start) {
  for (var i = 0; i < max; i++) {
    var node = start ? fragment.firstChild : fragment.lastChild;
    if (!node || node.type.contains == null) return i;
    fragment = node.content;
  }
  return max;
}

handlers.copy = handlers.cut = function (pm, e) {
  var _pm$selection2 = pm.selection;
  var from = _pm$selection2.from;
  var to = _pm$selection2.to;
  var empty = _pm$selection2.empty;

  if (empty || !e.clipboardData || !canUpdateClipboard(e.clipboardData)) return;
  toClipboard(pm.doc, from, to, e.clipboardData);
  e.preventDefault();
  if (e.type == "cut" && !empty) pm.tr.delete(from, to).apply();
};

handlers.paste = function (pm, e) {
  if (!(0, _selection.hasFocus)(pm)) return;
  if (!e.clipboardData) return;
  var sel = pm.selection;
  var slice = fromClipboard(pm, e.clipboardData, pm.input.shiftKey);
  if (slice) {
    e.preventDefault();
    pm.tr.replace(sel.from, sel.to, slice).apply(pm.apply.scroll);
  }
};

var Dragging = function Dragging(slice, from, to) {
  _classCallCheck(this, Dragging);

  this.slice = slice;
  this.from = from;
  this.to = to;
};

function dropPos(pm, e, slice) {
  var pos = pm.posAtCoords({ left: e.clientX, top: e.clientY });
  if (pos == null || !slice || !slice.content.size) return pos;
  var $pos = pm.doc.resolve(pos),
      kind = slice.content.leastSuperKind();
  for (var d = $pos.depth; d >= 0; d--) {
    if (kind.isSubKind($pos.node(d).type.contains)) {
      if (d == $pos.depth) return pos;
      if (pos <= ($pos.start(d + 1) + $pos.end(d + 1)) / 2) return $pos.before(d + 1);
      return $pos.after(d + 1);
    }
  }
  return pos;
}

function removeDropTarget(pm) {
  if (pm.input.dropTarget) {
    pm.wrapper.removeChild(pm.input.dropTarget);
    pm.input.dropTarget = null;
  }
}

handlers.dragstart = function (pm, e) {
  var mouseDown = pm.input.mouseDown;
  if (mouseDown) mouseDown.done();

  if (!e.dataTransfer) return;

  var _pm$selection3 = pm.selection;
  var from = _pm$selection3.from;
  var to = _pm$selection3.to;
  var empty = _pm$selection3.empty;var dragging = undefined;
  var pos = !empty && pm.posAtCoords({ left: e.clientX, top: e.clientY });
  if (pos != null && pos >= from && pos <= to) {
    dragging = { from: from, to: to };
  } else if (mouseDown && mouseDown.mightDrag != null) {
    var _pos = mouseDown.mightDrag;
    dragging = { from: _pos, to: _pos + pm.doc.nodeAt(_pos).nodeSize };
  }

  if (dragging) {
    var slice = toClipboard(pm.doc, dragging.from, dragging.to, e.dataTransfer);
    // FIXME the document could change during a drag, invalidating this range
    // use a marked range?
    pm.input.dragging = new Dragging(slice, dragging.from, dragging.to);
  }
};

handlers.dragend = function (pm) {
  return window.setTimeout(function () {
    return pm.input.dragging = null;
  }, 50);
};

handlers.dragover = handlers.dragenter = function (pm, e) {
  e.preventDefault();

  var target = pm.input.dropTarget;
  if (!target) target = pm.input.dropTarget = pm.wrapper.appendChild((0, _dom.elt)("div", { class: "ProseMirror-drop-target" }));

  var pos = dropPos(pm, e, pm.input.dragging && pm.input.dragging.slice);
  if (pos == null) return;
  var coords = pm.coordsAtPos(pos);
  var rect = pm.wrapper.getBoundingClientRect();
  coords.top -= rect.top;
  coords.right -= rect.left;
  coords.bottom -= rect.top;
  coords.left -= rect.left;
  target.style.left = coords.left - 1 + "px";
  target.style.top = coords.top + "px";
  target.style.height = coords.bottom - coords.top + "px";
};

handlers.dragleave = function (pm, e) {
  if (e.target == pm.content) removeDropTarget(pm);
};

handlers.drop = function (pm, e) {
  var dragging = pm.input.dragging;
  pm.input.dragging = null;
  removeDropTarget(pm);

  // :: (event: DOMEvent) #path=ProseMirror#events#drop
  // Fired when a drop event occurs on the editor content. A handler
  // may declare the event handled by calling `preventDefault` on it
  // or returning a truthy value.
  if (!e.dataTransfer || pm.signalDOM(e)) return;

  var slice = dragging && dragging.slice || fromClipboard(pm, e.dataTransfer);
  if (slice) {
    e.preventDefault();
    var insertPos = dropPos(pm, e, slice),
        start = insertPos;
    if (insertPos == null) return;
    var tr = pm.tr;
    if (dragging && !e.ctrlKey && dragging.from != null) {
      tr.delete(dragging.from, dragging.to);
      insertPos = tr.map(insertPos);
    }
    tr.replace(insertPos, insertPos, slice).apply();
    var found = undefined;
    if (slice.content.childCount == 1 && slice.openLeft == 0 && slice.openRight == 0 && slice.content.child(0).type.selectable && (found = pm.doc.nodeAt(insertPos)) && found.sameMarkup(slice.content.child(0))) {
      pm.setNodeSelection(insertPos);
    } else {
      var left = (0, _selection.findSelectionNear)(pm.doc, insertPos, 1, true).from;
      var right = (0, _selection.findSelectionNear)(pm.doc, tr.map(start), -1, true).to;
      pm.setTextSelection(left, right);
    }
    pm.focus();
  }
};

handlers.focus = function (pm) {
  pm.wrapper.classList.add("ProseMirror-focused");
  // :: () #path=ProseMirror#events#focus
  // Fired when the editor gains focus.
  pm.signal("focus");
};

handlers.blur = function (pm) {
  pm.wrapper.classList.remove("ProseMirror-focused");
  // :: () #path=ProseMirror#events#blur
  // Fired when the editor loses focus.
  pm.signal("blur");
};
},{"../dom":1,"../format":21,"../model":33,"./capturekeys":3,"./domchange":7,"./dompos":8,"./selection":17,"browserkeymap":55}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DIRTY_REDRAW = exports.DIRTY_RESCAN = exports.ProseMirror = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

require("./css");

var _browserkeymap = require("browserkeymap");

var _browserkeymap2 = _interopRequireDefault(_browserkeymap);

var _sortedinsert = require("../util/sortedinsert");

var _sortedinsert2 = _interopRequireDefault(_sortedinsert);

var _map = require("../util/map");

var _event = require("../util/event");

var _dom = require("../dom");

var _format = require("../format");

var _options = require("./options");

var _selection = require("./selection");

var _dompos = require("./dompos");

var _draw = require("./draw");

var _input = require("./input");

var _history = require("./history");

var _range = require("./range");

var _transform = require("./transform");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; This is the class used to represent instances of the editor. A
// ProseMirror editor holds a [document](#Node) and a
// [selection](#Selection), and displays an editable surface
// representing that document in the browser document.
//
// Contains event methods (`on`, etc) from the [event
// mixin](#EventMixin).

var ProseMirror = exports.ProseMirror = function () {
  // :: (Object)
  // Construct a new editor from a set of [options](#edit_options)
  // and, if it has a [`place`](#place) option, add it to the
  // document.

  function ProseMirror(opts) {
    _classCallCheck(this, ProseMirror);

    (0, _dom.ensureCSSAdded)();

    opts = this.options = (0, _options.parseOptions)(opts);
    // :: Schema
    // The schema for this editor's document.
    this.schema = opts.schema;
    if (opts.doc == null) opts.doc = this.schema.node("doc", null, [this.schema.node("paragraph")]);
    // :: DOMNode
    // The editable DOM node containing the document.
    this.content = (0, _dom.elt)("div", { class: "ProseMirror-content", "pm-container": true });
    // :: DOMNode
    // The outer DOM element of the editor.
    this.wrapper = (0, _dom.elt)("div", { class: "ProseMirror" }, this.content);
    this.wrapper.ProseMirror = this;

    if (opts.place && opts.place.appendChild) opts.place.appendChild(this.wrapper);else if (opts.place) opts.place(this.wrapper);

    this.setDocInner(opts.docFormat ? (0, _format.parseFrom)(this.schema, opts.doc, opts.docFormat) : opts.doc);
    (0, _draw.draw)(this, this.doc);
    this.content.contentEditable = true;
    if (opts.label) this.content.setAttribute("aria-label", opts.label);

    // :: Object
    // A namespace where modules can store references to themselves
    // associated with this editor instance.
    this.mod = Object.create(null);
    this.cached = Object.create(null);
    this.operation = null;
    this.dirtyNodes = new _map.Map(); // Maps node object to 1 (re-scan content) or 2 (redraw entirely)
    this.flushScheduled = null;

    this.sel = new _selection.SelectionState(this, (0, _selection.findSelectionAtStart)(this.doc));
    this.accurateSelection = false;
    this.input = new _input.Input(this);

    // :: Object<Command>
    // The commands available in the editor.
    this.commands = null;
    this.commandKeys = null;
    (0, _options.initOptions)(this);
  }

  // :: (string, any)
  // Update the value of the given [option](#edit_options).


  _createClass(ProseMirror, [{
    key: "setOption",
    value: function setOption(name, value) {
      (0, _options.setOption)(this, name, value);
      // :: (name: string, value: *) #path=ProseMirror#events#optionChanged
      // Fired when [`setOption`](#ProseMirror.setOption) is called.
      this.signal("optionChanged", name, value);
    }

    // :: (string) → any
    // Get the current value of the given [option](#edit_options).

  }, {
    key: "getOption",
    value: function getOption(name) {
      return this.options[name];
    }

    // :: Selection
    // Get the current selection.

  }, {
    key: "setTextSelection",


    // :: (number, ?number)
    // Set the selection to a [text selection](#TextSelection) from
    // `anchor` to `head`, or, if `head` is null, a cursor selection at
    // `anchor`.
    value: function setTextSelection(anchor) {
      var head = arguments.length <= 1 || arguments[1] === undefined ? anchor : arguments[1];

      this.checkPos(head, true);
      if (anchor != head) this.checkPos(anchor, true);
      this.setSelection(new _selection.TextSelection(anchor, head));
    }

    // :: (number)
    // Set the selection to a node selection on the node after `pos`.

  }, {
    key: "setNodeSelection",
    value: function setNodeSelection(pos) {
      this.checkPos(pos, false);
      var node = this.doc.nodeAt(pos);
      if (!node) throw new RangeError("Trying to set a node selection that doesn't point at a node");
      if (!node.type.selectable) throw new RangeError("Trying to select a non-selectable node");
      this.setSelection(new _selection.NodeSelection(pos, pos + node.nodeSize, node));
    }

    // :: (Selection)
    // Set the selection to the given selection object.

  }, {
    key: "setSelection",
    value: function setSelection(selection) {
      this.ensureOperation();
      if (!selection.eq(this.sel.range)) this.sel.setAndSignal(selection);
    }

    // :: (any, ?string)
    // Replace the editor's document. When `format` is given, it should
    // be a [parsable format](#format), and `value` should something in
    // that format. If not, `value` should be a `Node`.

  }, {
    key: "setContent",
    value: function setContent(value, format) {
      if (format) value = (0, _format.parseFrom)(this.schema, value, format);
      this.setDoc(value);
    }

    // :: (?string) → any
    // Get the editor's content in a given format. When `format` is not
    // given, a `Node` is returned. If it is given, it should be an
    // existing [serialization format](#format).

  }, {
    key: "getContent",
    value: function getContent(format) {
      return format ? (0, _format.serializeTo)(this.doc, format) : this.doc;
    }
  }, {
    key: "setDocInner",
    value: function setDocInner(doc) {
      if (doc.type != this.schema.nodes.doc) throw new RangeError("Trying to set a document with a different schema");
      // :: Node The current document.
      this.doc = doc;
      this.ranges = new _range.RangeStore(this);
      // :: History The edit history for the editor.
      this.history = new _history.History(this);
    }

    // :: (Node, ?Selection)
    // Set the editor's content, and optionally include a new selection.

  }, {
    key: "setDoc",
    value: function setDoc(doc, sel) {
      if (!sel) sel = (0, _selection.findSelectionAtStart)(doc);
      // :: (doc: Node, selection: Selection) #path=ProseMirror#events#beforeSetDoc
      // Fired when [`setDoc`](#ProseMirror.setDoc) is called, before
      // the document is actually updated.
      this.signal("beforeSetDoc", doc, sel);
      this.ensureOperation();
      this.setDocInner(doc);
      this.operation.docSet = true;
      this.sel.set(sel, true);
      // :: (doc: Node, selection: Selection) #path=ProseMirror#events#setDoc
      // Fired when [`setDoc`](#ProseMirror.setDoc) is called, after
      // the document is updated.
      this.signal("setDoc", doc, sel);
    }
  }, {
    key: "updateDoc",
    value: function updateDoc(doc, mapping, selection) {
      this.ensureOperation();
      this.ranges.transform(mapping);
      this.operation.mappings.push(mapping);
      this.doc = doc;
      this.sel.setAndSignal(selection || this.sel.range.map(doc, mapping));
      // :: () #path=ProseMirror#events#change
      // Fired when the document has changed. See
      // [`setDoc`](#ProseMirror.event_setDoc) and
      // [`transform`](#ProseMirror.event_transform) for more specific
      // change-related events.
      this.signal("change");
    }

    // :: EditorTransform
    // Create an editor- and selection-aware `Transform` for this editor.

  }, {
    key: "apply",


    // :: (Transform, ?Object) → union<Transform,bool>
    // Apply a transformation (which you might want to create with the
    // [`tr` getter](#ProseMirror.tr)) to the document in the editor.
    // The following options are supported:
    //
    // **`selection`**`: ?Selection`
    //   : A new selection to set after the transformation is applied.
    //
    // **`scrollIntoView`**: ?bool
    //   : When true, scroll the selection into view on the next
    //     [redraw](#ProseMirror.flush).
    //
    // **`filter`**: ?bool
    //   : When set to false, suppresses the ability of the
    //     [`"filterTransform"` event](#ProseMirror.event_beforeTransform)
    //     to cancel this transform.
    //
    // Returns the transform, or `false` if there were no steps in it.
    //
    // Has the following property:
    value: function apply(transform) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? nullOptions : arguments[1];

      if (!transform.steps.length) return false;
      if (!transform.docs[0].eq(this.doc)) throw new RangeError("Applying a transform that does not start with the current document");

      // :: (transform: Transform) #path=ProseMirror#events#filterTransform
      // Fired before a transform (applied without `filter: false`) is
      // applied. The handler can return a truthy value to cancel the
      // transform.
      if (options.filter !== false && this.signalHandleable("filterTransform", transform)) return false;

      var selectionBeforeTransform = this.selection;

      // :: (transform: Transform, options: Object) #path=ProseMirror#events#beforeTransform
      // Indicates that the given transform is about to be
      // [applied](#ProseMirror.apply). The handler may add additional
      // [steps](#Step) to the transform, but it it not allowed to
      // interfere with the editor's state.
      this.signal("beforeTransform", transform, options);
      this.updateDoc(transform.doc, transform, options.selection);
      // :: (transform: Transform, selectionBeforeTransform: Selection, options: Object) #path=ProseMirror#events#transform
      // Signals that a (non-empty) transformation has been aplied to
      // the editor. Passes the `Transform`, the selection before the
      // transform, and the options given to [`apply`](#ProseMirror.apply)
      // as arguments to the handler.
      this.signal("transform", transform, selectionBeforeTransform, options);
      if (options.scrollIntoView) this.scrollIntoView();
      return transform;
    }

    // :: (number, ?bool)
    // Verify that the given position is valid in the current document,
    // and throw an error otherwise. When `textblock` is true, the position
    // must also fall within a textblock node.

  }, {
    key: "checkPos",
    value: function checkPos(pos, textblock) {
      var valid = pos >= 0 && pos <= this.doc.content.size;
      if (valid && textblock) valid = this.doc.resolve(pos).parent.isTextblock;
      if (!valid) throw new RangeError("Position " + pos + " is not valid in current document");
    }

    // : (?Object) → Operation
    // Ensure that an operation has started.

  }, {
    key: "ensureOperation",
    value: function ensureOperation(options) {
      return this.operation || this.startOperation(options);
    }

    // : (?Object) → Operation
    // Start an operation and schedule a flush so that any effect of
    // the operation shows up in the DOM.

  }, {
    key: "startOperation",
    value: function startOperation(options) {
      var _this = this;

      this.operation = new Operation(this);
      if (!(options && options.readSelection === false) && this.sel.readFromDOM()) this.operation.sel = this.sel.range;

      if (this.flushScheduled == null) this.flushScheduled = (0, _dom.requestAnimationFrame)(function () {
        return _this.flush();
      });
      return this.operation;
    }

    // Cancel any scheduled operation flush.

  }, {
    key: "unscheduleFlush",
    value: function unscheduleFlush() {
      if (this.flushScheduled != null) {
        (0, _dom.cancelAnimationFrame)(this.flushScheduled);
        this.flushScheduled = null;
      }
    }

    // :: () → bool
    // Flush any pending changes to the DOM. When the document,
    // selection, or marked ranges in an editor change, the DOM isn't
    // updated immediately, but rather scheduled to be updated the next
    // time the browser redraws the screen. This method can be used to
    // force this to happen immediately. It can be useful when you, for
    // example, want to measure where on the screen a part of the
    // document ends up, immediately after changing the document.
    //
    // Returns true when it updated the document DOM.

  }, {
    key: "flush",
    value: function flush() {
      this.unscheduleFlush();

      if (!document.body.contains(this.wrapper) || !this.operation) return false;
      // :: () #path=ProseMirror#events#flushing
      // Fired when the editor is about to [flush](#ProseMirror.flush)
      // an update to the DOM.
      this.signal("flushing");

      var op = this.operation,
          redrawn = false;
      if (!op) return false;
      if (op.composing) this.input.applyComposition();

      this.operation = null;
      this.accurateSelection = true;

      if (op.doc != this.doc || this.dirtyNodes.size) {
        (0, _draw.redraw)(this, this.dirtyNodes, this.doc, op.doc);
        this.dirtyNodes.clear();
        redrawn = true;
      }

      if (redrawn || !op.sel.eq(this.sel.range) || op.focus) this.sel.toDOM(op.focus);

      // FIXME somehow schedule this relative to ui/update so that it
      // doesn't cause extra layout
      if (op.scrollIntoView !== false) (0, _dompos.scrollIntoView)(this, op.scrollIntoView);
      // :: () #path=ProseMirror#events#draw
      // Fired when the editor redrew its document in the DOM.
      if (redrawn) this.signal("draw");
      // :: () #path=ProseMirror#events#flush
      // Fired when the editor has finished
      // [flushing](#ProseMirror.flush) an update to the DOM.
      this.signal("flush");
      this.accurateSelection = false;
      return redrawn;
    }

    // :: (Keymap, ?number)
    // Add a
    // [keymap](https://github.com/marijnh/browserkeymap#an-object-type-for-keymaps)
    // to the editor. Keymaps added in this way are queried before the
    // base keymap. The `rank` parameter can be used to
    // control when they are queried relative to other maps added like
    // this. Maps with a lower rank get queried first.

  }, {
    key: "addKeymap",
    value: function addKeymap(map) {
      var rank = arguments.length <= 1 || arguments[1] === undefined ? 50 : arguments[1];

      (0, _sortedinsert2.default)(this.input.keymaps, { map: map, rank: rank }, function (a, b) {
        return a.rank - b.rank;
      });
    }

    // :: (union<string, Keymap>)
    // Remove the given keymap, or the keymap with the given name, from
    // the editor.

  }, {
    key: "removeKeymap",
    value: function removeKeymap(map) {
      var maps = this.input.keymaps;
      for (var i = 0; i < maps.length; ++i) {
        if (maps[i].map == map || maps[i].map.options.name == map) {
          maps.splice(i, 1);
          return true;
        }
      }
    }

    // :: (number, number, ?Object) → MarkedRange
    // Create a marked range between the given positions. Marked ranges
    // “track” the part of the document they point to—as the document
    // changes, they are updated to move, grow, and shrink along with
    // their content.
    //
    // `options` may be an object containing these properties:
    //
    // **`inclusiveLeft`**`: bool = false`
    //   : Whether the left side of the range is inclusive. When it is,
    //     content inserted at that point will become part of the range.
    //     When not, it will be outside of the range.
    //
    // **`inclusiveRight`**`: bool = false`
    //   : Whether the right side of the range is inclusive.
    //
    // **`removeWhenEmpty`**`: bool = true`
    //   : Whether the range should be forgotten when it becomes empty
    //     (because all of its content was deleted).
    //
    // **`className`**: string
    //   : A CSS class to add to the inline content that is part of this
    //     range.

  }, {
    key: "markRange",
    value: function markRange(from, to, options) {
      this.checkPos(from);
      this.checkPos(to);
      var range = new _range.MarkedRange(from, to, options);
      this.ranges.addRange(range);
      return range;
    }

    // :: (MarkedRange)
    // Remove the given range from the editor.

  }, {
    key: "removeRange",
    value: function removeRange(range) {
      this.ranges.removeRange(range);
    }

    // :: (MarkType, ?bool, ?Object)
    // Set (when `to` is true), unset (`to` is false), or toggle (`to`
    // is null) the given mark type on the selection. When there is a
    // non-empty selection, the marks of the selection are updated. When
    // the selection is empty, the set of [active
    // marks](#ProseMirror.activeMarks) is updated.

  }, {
    key: "setMark",
    value: function setMark(type, to, attrs) {
      var sel = this.selection;
      if (sel.empty) {
        var marks = this.activeMarks();
        if (to == null) to = !type.isInSet(marks);
        if (to && !this.doc.resolve(sel.head).parent.type.canContainMark(type)) return;
        this.input.storedMarks = to ? type.create(attrs).addToSet(marks) : type.removeFromSet(marks);
        // :: () #path=ProseMirror#events#activeMarkChange
        // Fired when the set of [active marks](#ProseMirror.activeMarks) changes.
        this.signal("activeMarkChange");
      } else {
        if (to != null ? to : !this.doc.rangeHasMark(sel.from, sel.to, type)) this.apply(this.tr.addMark(sel.from, sel.to, type.create(attrs)));else this.apply(this.tr.removeMark(sel.from, sel.to, type));
      }
    }

    // :: () → [Mark]
    // Get the marks at the cursor. By default, this yields the marks
    // associated with the content at the cursor, as per `Node.marksAt`.
    // But `setMark` may have been used to change the set of active
    // marks, in which case that set is returned.

  }, {
    key: "activeMarks",
    value: function activeMarks() {
      var head;
      return this.input.storedMarks || ((head = this.selection.head) != null ? this.doc.marksAt(head) : []);
    }

    // :: ()
    // Give the editor focus.

  }, {
    key: "focus",
    value: function focus() {
      if (this.operation) this.operation.focus = true;else this.sel.toDOM(true);
    }

    // :: () → bool
    // Query whether the editor has focus.

  }, {
    key: "hasFocus",
    value: function hasFocus() {
      if (this.sel.range instanceof _selection.NodeSelection) return document.activeElement == this.content;else return (0, _selection.hasFocus)(this);
    }

    // :: ({top: number, left: number}) → ?number
    // If the given coordinates (which should be relative to the top
    // left corner of the window—not the page) fall within the editable
    // content, this method will return the document position that
    // corresponds to those coordinates.

  }, {
    key: "posAtCoords",
    value: function posAtCoords(coords) {
      this.flush();
      return (0, _dompos.posAtCoords)(this, coords);
    }

    // :: (number) → {top: number, left: number, bottom: number}
    // Find the screen coordinates (relative to top left corner of the
    // window) of the given document position.

  }, {
    key: "coordsAtPos",
    value: function coordsAtPos(pos) {
      this.checkPos(pos);
      this.flush();
      return (0, _dompos.coordsAtPos)(this, pos);
    }

    // :: (?number)
    // Scroll the given position, or the cursor position if `pos` isn't
    // given, into view.

  }, {
    key: "scrollIntoView",
    value: function scrollIntoView() {
      var pos = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      if (pos) this.checkPos(pos);
      this.ensureOperation();
      this.operation.scrollIntoView = pos;
    }

    // :: (string, ?[any]) → bool
    // Execute the named [command](#Command). If the command takes
    // parameters, they can be passed as an array.

  }, {
    key: "execCommand",
    value: function execCommand(name, params) {
      var cmd = this.commands[name];
      return !!(cmd && cmd.exec(this, params) !== false);
    }

    // :: (string) → ?string
    // Return the name of the key that is bound to the given command, if
    // any.

  }, {
    key: "keyForCommand",
    value: function keyForCommand(name) {
      var cached = this.commandKeys[name];
      if (cached !== undefined) return cached;

      var cmd = this.commands[name],
          keymap = this.input.baseKeymap;
      if (!cmd) return this.commandKeys[name] = null;
      var key = cmd.spec.key || (_dom.browser.mac ? cmd.spec.macKey : cmd.spec.pcKey);
      if (key) {
        key = _browserkeymap2.default.normalizeKeyName(Array.isArray(key) ? key[0] : key);
        var deflt = keymap.bindings[key];
        if (Array.isArray(deflt) ? deflt.indexOf(name) > -1 : deflt == name) return this.commandKeys[name] = key;
      }
      for (var _key in keymap.bindings) {
        var bound = keymap.bindings[_key];
        if (Array.isArray(bound) ? bound.indexOf(name) > -1 : bound == name) return this.commandKeys[name] = _key;
      }
      return this.commandKeys[name] = null;
    }
  }, {
    key: "markRangeDirty",
    value: function markRangeDirty(from, to) {
      var doc = arguments.length <= 2 || arguments[2] === undefined ? this.doc : arguments[2];

      this.ensureOperation();
      var dirty = this.dirtyNodes;
      var $from = doc.resolve(from),
          $to = doc.resolve(to);
      var same = $from.sameDepth($to);
      for (var depth = 0; depth <= same; depth++) {
        var child = $from.node(depth);
        if (!dirty.has(child)) dirty.set(child, DIRTY_RESCAN);
      }
      var start = $from.index(same),
          end = Math.max(start + 1, $to.index(same) + (same == $to.depth ? 0 : 1));
      var parent = $from.node(same);
      for (var i = start; i < end; i++) {
        dirty.set(parent.child(i), DIRTY_REDRAW);
      }
    }
  }, {
    key: "markAllDirty",
    value: function markAllDirty() {
      this.dirtyNodes.set(this.doc, DIRTY_REDRAW);
    }

    // :: (string) → string
    // Return a translated string, if a translate function has been supplied,
    // or the original string.

  }, {
    key: "translate",
    value: function translate(string) {
      var trans = this.options.translate;
      return trans ? trans(string) : string;
    }
  }, {
    key: "selection",
    get: function get() {
      if (!this.accurateSelection) this.ensureOperation();
      return this.sel.range;
    }
  }, {
    key: "tr",
    get: function get() {
      return new _transform.EditorTransform(this);
    }
  }]);

  return ProseMirror;
}();

// :: Object
// The object `{scrollIntoView: true}`, which is a common argument to
// pass to `ProseMirror.apply` or `EditorTransform.apply`.


ProseMirror.prototype.apply.scroll = { scrollIntoView: true };

var DIRTY_RESCAN = exports.DIRTY_RESCAN = 1,
    DIRTY_REDRAW = exports.DIRTY_REDRAW = 2;

var nullOptions = {};

(0, _event.eventMixin)(ProseMirror);

// Operations are used to delay/batch DOM updates. When a change to
// the editor state happens, it is not immediately flushed to the DOM,
// but rather a call to `ProseMirror.flush` is scheduled using
// `requestAnimationFrame`. An object of this class is stored in the
// editor's `operation` property, and holds information about the
// state at the start of the operation, which can be used to determine
// the minimal DOM update needed. It also stores information about
// whether a focus needs to happen on flush, and whether something
// needs to be scrolled into view.

var Operation = function Operation(pm) {
  _classCallCheck(this, Operation);

  this.doc = pm.doc;
  this.docSet = false;
  this.sel = pm.sel.range;
  this.scrollIntoView = false;
  this.focus = false;
  this.mappings = [];
  this.composing = null;
};
},{"../dom":1,"../format":21,"../util/event":51,"../util/map":52,"../util/sortedinsert":54,"./css":6,"./dompos":8,"./draw":9,"./history":10,"./input":12,"./options":14,"./range":15,"./selection":17,"./transform":18,"browserkeymap":55}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defineOption = defineOption;
exports.parseOptions = parseOptions;
exports.initOptions = initOptions;
exports.setOption = setOption;

var _model = require("../model");

var _prompt = require("../ui/prompt");

var _command = require("./command");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// An option encapsulates functionality for an editor instance,
// e.g. the amount of history events that the editor should hold
// onto or the document's schema.

var Option = function Option(defaultValue, update, updateOnInit) {
  _classCallCheck(this, Option);

  this.defaultValue = defaultValue;
  // A function that will be invoked with the option's old and new
  // value every time the option is [set](#ProseMirror.setOption).
  // This function should bootstrap option functionality.
  this.update = update;
  this.updateOnInit = updateOnInit !== false;
};

var options = Object.create(null);

// :: (string, any, (pm: ProseMirror, newValue: any, oldValue: any, init: bool), bool)
// Define a new option. The `update` handler will be called with the
// option's old and new value every time the option is
// [changed](#ProseMirror.setOption). When `updateOnInit` is false, it
// will not be called on editor init, otherwise it is called with null as the old value,
// and a fourth argument of true.
function defineOption(name, defaultValue, update, updateOnInit) {
  options[name] = new Option(defaultValue, update, updateOnInit);
}

// :: Schema #path=schema #kind=option
// The [schema](#Schema) that the editor's document should use.
defineOption("schema", _model.defaultSchema, false);

// :: any #path=doc #kind=option
// The starting document. Usually a `Node`, but can be in another
// format when the `docFormat` option is also specified.
defineOption("doc", null, function (pm, value) {
  return pm.setDoc(value);
}, false);

// :: ?string #path=docFormat #kind=option
// The format in which the `doc` option is given. Defaults to `null`
// (a raw `Node`).
defineOption("docFormat", null);

// :: ?union<DOMNode, (DOMNode)> #path=place #kind=option
// Determines the placement of the editor in the page. When `null`,
// the editor is not placed. When a DOM node is given, the editor is
// appended to that node. When a function is given, it is called
// with the editor's wrapping DOM node, and is expected to place it
// into the document.
defineOption("place", null);

// :: number #path=historyDepth #kind=option
// The amount of history events that are collected before the oldest
// events are discarded. Defaults to 100.
defineOption("historyDepth", 100);

// :: number #path=historyEventDelay #kind=option
// The amount of milliseconds that must pass between changes to
// start a new history event. Defaults to 500.
defineOption("historyEventDelay", 500);

// :: CommandSet #path=commands #kind=option
// Specifies the set of [commands](#Command) available in the editor
// (which in turn determines the base key bindings and items available
// in the menus). Defaults to `CommandSet.default`.
defineOption("commands", _command.CommandSet.default, _command.updateCommands);

// :: ParamPrompt #path=commandParamPrompt #kind=option
// A default [parameter prompting](#ui/prompt) class to use when a
// command is [executed](#ProseMirror.execCommand) without providing
// parameters.
defineOption("commandParamPrompt", _prompt.ParamPrompt);

// :: ?string #path=label #kind=option
// The label of the editor. When set, the editable DOM node gets an
// `aria-label` attribute with this value.
defineOption("label", null);

// :: ?(string) → string #path=translate #kind=option
// Optional function to translate strings such as menu labels and prompts.
// When set, should be a function that takes a string as argument and returns
// a string, i.e. :: (string) → string
defineOption("translate", null); // FIXME create a way to explicitly force a menu redraw

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
  if (desc === undefined) throw new RangeError("Option '" + name + "' is not defined");
  if (desc.update === false) throw new RangeError("Option '" + name + "' can not be changed");
  var old = pm.options[name];
  pm.options[name] = value;
  if (desc.update) desc.update(pm, value, old, false);
}
},{"../model":33,"../ui/prompt":48,"./command":5}],15:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RangeStore = exports.MarkedRange = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _event = require("../util/event");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; A [marked range](#ProseMirror.markRange). Includes the methods
// from the [event mixin](#EventMixin).

var MarkedRange = exports.MarkedRange = function () {
  function MarkedRange(from, to, options) {
    _classCallCheck(this, MarkedRange);

    this.options = options || {};
    // :: ?number
    // The current start position of the range. Updated whenever the
    // editor's document is changed. Set to `null` when the marked
    // range is [removed](#ProseMirror.removeRange).
    this.from = from;
    // :: ?number
    // The current end position of the range. Updated whenever the
    // editor's document is changed. Set to `null` when the marked
    // range is [removed](#ProseMirror.removeRange).
    this.to = to;
  }

  _createClass(MarkedRange, [{
    key: "remove",
    value: function remove() {
      // :: (from: number, to: number) #path=MarkedRange#events#removed
      // Signalled when the marked range is removed from the editor.
      this.signal("removed", this.from, Math.max(this.to, this.from));
      this.from = this.to = null;
    }
  }]);

  return MarkedRange;
}();

(0, _event.eventMixin)(MarkedRange);

var RangeSorter = function () {
  function RangeSorter() {
    _classCallCheck(this, RangeSorter);

    this.sorted = [];
  }

  _createClass(RangeSorter, [{
    key: "find",
    value: function find(at) {
      var min = 0,
          max = this.sorted.length;
      for (;;) {
        if (max < min + 10) {
          for (var i = min; i < max; i++) {
            if (this.sorted[i].at >= at) return i;
          }return max;
        }
        var mid = min + max >> 1;
        if (this.sorted[mid].at > at) max = mid;else min = mid;
      }
    }
  }, {
    key: "insert",
    value: function insert(obj) {
      this.sorted.splice(this.find(obj.at), 0, obj);
    }
  }, {
    key: "remove",
    value: function remove(at, range) {
      var pos = this.find(at);
      for (var dist = 0;; dist++) {
        var leftPos = pos - dist - 1,
            rightPos = pos + dist;
        if (leftPos >= 0 && this.sorted[leftPos].range == range) {
          this.sorted.splice(leftPos, 1);
          return;
        } else if (rightPos < this.sorted.length && this.sorted[rightPos].range == range) {
          this.sorted.splice(rightPos, 1);
          return;
        }
      }
    }
  }, {
    key: "resort",
    value: function resort() {
      for (var i = 0; i < this.sorted.length; i++) {
        var cur = this.sorted[i];
        var at = cur.at = cur.type == "open" ? cur.range.from : cur.range.to;
        var pos = i;
        while (pos > 0 && this.sorted[pos - 1].at > at) {
          this.sorted[pos] = this.sorted[pos - 1];
          this.sorted[--pos] = cur;
        }
      }
    }
  }]);

  return RangeSorter;
}();

var RangeStore = exports.RangeStore = function () {
  function RangeStore(pm) {
    _classCallCheck(this, RangeStore);

    this.pm = pm;
    this.ranges = [];
    this.sorted = new RangeSorter();
  }

  _createClass(RangeStore, [{
    key: "addRange",
    value: function addRange(range) {
      this.ranges.push(range);
      this.sorted.insert({ type: "open", at: range.from, range: range });
      this.sorted.insert({ type: "close", at: range.to, range: range });
      if (range.options.className) this.pm.markRangeDirty(range.from, range.to);
    }
  }, {
    key: "removeRange",
    value: function removeRange(range) {
      var found = this.ranges.indexOf(range);
      if (found > -1) {
        this.ranges.splice(found, 1);
        this.sorted.remove(range.from, range);
        this.sorted.remove(range.to, range);
        if (range.options.className) this.pm.markRangeDirty(range.from, range.to);
        range.remove();
      }
    }
  }, {
    key: "transform",
    value: function transform(mapping) {
      for (var i = 0; i < this.ranges.length; i++) {
        var range = this.ranges[i];
        range.from = mapping.map(range.from, range.options.inclusiveLeft ? -1 : 1);
        range.to = mapping.map(range.to, range.options.inclusiveRight ? 1 : -1);
        if (range.options.removeWhenEmpty !== false && range.from >= range.to) {
          this.removeRange(range);
          i--;
        } else if (range.from > range.to) {
          range.to = range.from;
        }
      }
      this.sorted.resort();
    }
  }, {
    key: "activeRangeTracker",
    value: function activeRangeTracker() {
      return new RangeTracker(this.sorted.sorted);
    }
  }]);

  return RangeStore;
}();

var RangeTracker = function () {
  function RangeTracker(sorted) {
    _classCallCheck(this, RangeTracker);

    this.sorted = sorted;
    this.pos = 0;
    this.current = [];
  }

  _createClass(RangeTracker, [{
    key: "advanceTo",
    value: function advanceTo(pos) {
      var next = undefined;
      while (this.pos < this.sorted.length && (next = this.sorted[this.pos]).at <= pos) {
        var className = next.range.options.className;
        if (className) {
          if (next.type == "open") this.current.push(className);else this.current.splice(this.current.indexOf(className), 1);
        }
        this.pos++;
      }
    }
  }, {
    key: "nextChangeBefore",
    value: function nextChangeBefore(pos) {
      for (;;) {
        if (this.pos == this.sorted.length) return -1;
        var next = this.sorted[this.pos];
        if (!next.range.options.className) this.pos++;else if (next.at >= pos) return -1;else return next.at;
      }
    }
  }]);

  return RangeTracker;
}();
},{"../util/event":51}],16:[function(require,module,exports){
"use strict";

var _model = require("../model");

var _command = require("./command");

var _format = require("../format");

// # Mark types

// ;; #path="strong:set" #kind=command
// Add the [strong](#StrongMark) mark to the selected content.
_model.StrongMark.register("command", "set", { derive: true, label: "Set strong" });

// ;; #path="strong:unset" #kind=command
// Remove the [strong](#StrongMark) mark from the selected content.
_model.StrongMark.register("command", "unset", { derive: true, label: "Unset strong" });

// ;; #path="strong:toggle" #kind=command
// Toggle the [strong](#StrongMark) mark. If there is any strong
// content in the selection, or there is no selection and the [active
// marks](#ProseMirror.activeMarks) contain the strong mark, this
// counts as [active](#Command.active) and executing it removes the
// mark. Otherwise, this does not count as active, and executing it
// makes the selected content strong.
//
// **Keybindings:** Mod-B
_model.StrongMark.register("command", "toggle", {
  derive: true,
  label: "Toggle strong",
  menu: {
    group: "inline", rank: 20,
    display: {
      type: "icon",
      width: 805, height: 1024,
      path: "M317 869q42 18 80 18 214 0 214-191 0-65-23-102-15-25-35-42t-38-26-46-14-48-6-54-1q-41 0-57 5 0 30-0 90t-0 90q0 4-0 38t-0 55 2 47 6 38zM309 442q24 4 62 4 46 0 81-7t62-25 42-51 14-81q0-40-16-70t-45-46-61-24-70-8q-28 0-74 7 0 28 2 86t2 86q0 15-0 45t-0 45q0 26 0 39zM0 950l1-53q8-2 48-9t60-15q4-6 7-15t4-19 3-18 1-21 0-19v-37q0-561-12-585-2-4-12-8t-25-6-28-4-27-2-17-1l-2-47q56-1 194-6t213-5q13 0 39 0t38 0q40 0 78 7t73 24 61 40 42 59 16 78q0 29-9 54t-22 41-36 32-41 25-48 22q88 20 146 76t58 141q0 57-20 102t-53 74-78 48-93 27-100 8q-25 0-75-1t-75-1q-60 0-175 6t-132 6z"
    }
  },
  keys: ["Mod-B"]
});

// ;; #path=em:set #kind=command
// Add the [emphasis](#EmMark) mark to the selected content.
_model.EmMark.register("command", "set", { derive: true, label: "Add emphasis" });

// ;; #path=em:unset #kind=command
// Remove the [emphasis](#EmMark) mark from the selected content.
_model.EmMark.register("command", "unset", { derive: true, label: "Remove emphasis" });

// ;; #path=em:toggle #kind=command
// Toggle the [emphasis](#EmMark) mark. If there is any emphasized
// content in the selection, or there is no selection and the [active
// marks](#ProseMirror.activeMarks) contain the emphasis mark, this
// counts as [active](#Command.active) and executing it removes the
// mark. Otherwise, this does not count as active, and executing it
// makes the selected content emphasized.
//
// **Keybindings:** Mod-I
_model.EmMark.register("command", "toggle", {
  derive: true,
  label: "Toggle emphasis",
  menu: {
    group: "inline", rank: 21,
    display: {
      type: "icon",
      width: 585, height: 1024,
      path: "M0 949l9-48q3-1 46-12t63-21q16-20 23-57 0-4 35-165t65-310 29-169v-14q-13-7-31-10t-39-4-33-3l10-58q18 1 68 3t85 4 68 1q27 0 56-1t69-4 56-3q-2 22-10 50-17 5-58 16t-62 19q-4 10-8 24t-5 22-4 26-3 24q-15 84-50 239t-44 203q-1 5-7 33t-11 51-9 47-3 32l0 10q9 2 105 17-1 25-9 56-6 0-18 0t-18 0q-16 0-49-5t-49-5q-78-1-117-1-29 0-81 5t-69 6z"
    }
  },
  keys: ["Mod-I"]
});

// ;; #path=code:set #kind=command
// Add the [code](#CodeMark) mark to the selected content.
_model.CodeMark.register("command", "set", { derive: true, label: "Set code style" });

// ;; #path=code:unset #kind=command
// Remove the [code](#CodeMark) mark from the selected content.
_model.CodeMark.register("command", "unset", { derive: true, label: "Remove code style" });

// ;; #path=code:toggle #kind=command
// Toggle the [code](#CodeMark) mark. If there is any code-styled
// content in the selection, or there is no selection and the [active
// marks](#ProseMirror.activeMarks) contain the code mark, this
// counts as [active](#Command.active) and executing it removes the
// mark. Otherwise, this does not count as active, and executing it
// styles the selected content as code.
//
// **Keybindings:** Mod-`
_model.CodeMark.register("command", "toggle", {
  derive: true,
  label: "Toggle code style",
  menu: {
    group: "inline", rank: 22,
    display: {
      type: "icon",
      width: 896, height: 1024,
      path: "M608 192l-96 96 224 224-224 224 96 96 288-320-288-320zM288 192l-288 320 288 320 96-96-224-224 224-224-96-96z"
    }
  },
  keys: ["Mod-`"]
});

var linkIcon = {
  type: "icon",
  width: 951, height: 1024,
  path: "M832 694q0-22-16-38l-118-118q-16-16-38-16-24 0-41 18 1 1 10 10t12 12 8 10 7 14 2 15q0 22-16 38t-38 16q-8 0-15-2t-14-7-10-8-12-12-10-10q-18 17-18 41 0 22 16 38l117 118q15 15 38 15 22 0 38-14l84-83q16-16 16-38zM430 292q0-22-16-38l-117-118q-16-16-38-16-22 0-38 15l-84 83q-16 16-16 38 0 22 16 38l118 118q15 15 38 15 24 0 41-17-1-1-10-10t-12-12-8-10-7-14-2-15q0-22 16-38t38-16q8 0 15 2t14 7 10 8 12 12 10 10q18-17 18-41zM941 694q0 68-48 116l-84 83q-47 47-116 47-69 0-116-48l-117-118q-47-47-47-116 0-70 50-119l-50-50q-49 50-118 50-68 0-116-48l-118-118q-48-48-48-116t48-116l84-83q47-47 116-47 69 0 116 48l117 118q47 47 47 116 0 70-50 119l50 50q49-50 118-50 68 0 116 48l118 118q48 48 48 116z"
};

// ;; #path=link:unset #kind=command
// Removes all links for the selected content, or, if there is no
// selection, from the [active marks](#ProseMirror.activeMarks). Will
// only [select](#Command.select) itself when there is a link in the
// selection or active marks.
_model.LinkMark.register("command", "unset", {
  derive: true,
  label: "Unlink",
  menu: { group: "inline", rank: 30, display: linkIcon },
  active: function active() {
    return true;
  }
});

// ;; #path=link:set #kind=command
// Adds a link mark to the selection or set of [active
// marks](#ProseMirror.activeMarks). Takes parameters to determine the
// attributes of the link:
//
// **`href`**`: string`
//   : The link's target.
//
// **`title`**`: string`
//   : The link's title.
//
// Only selects itself when `unlink` isn't selected, so that only one
// of the two is visible in the menu at any time.
_model.LinkMark.register("command", "set", {
  derive: {
    inverseSelect: true,
    params: [{ label: "Target", attr: "href" }, { label: "Title", attr: "title" }]
  },
  label: "Add link",
  menu: { group: "inline", rank: 30, display: linkIcon }
});

// Node types

// ;; #path=image:insert #kind=command
// Replace the selection with an [image](#Image) node. Takes paramers
// that specify the image's attributes:
//
// **`src`**`: string`
//   : The URL of the image.
//
// **`alt`**`: string`
//   : The alt text for the image.
//
// **`title`**`: string`
//   : A title for the image.
_model.Image.register("command", "insert", {
  derive: {
    params: [{ label: "Image URL", attr: "src" }, { label: "Description / alternative text", attr: "alt",
      prefill: function prefill(pm) {
        return (0, _command.selectedNodeAttr)(pm, this, "alt") || (0, _format.toText)(pm.doc.cut(pm.selection.from, pm.selection.to));
      } }, { label: "Title", attr: "title" }]
  },
  label: "Insert image",
  menu: {
    group: "insert", rank: 20,
    display: { type: "label", label: "Image" }
  }
});

// ;; #path=bullet_list:wrap #kind=command
// Wrap the selection in a bullet list.
//
// **Keybindings:** Shift-Ctrl-8
_model.BulletList.register("command", "wrap", {
  derive: { list: true },
  label: "Wrap the selection in a bullet list",
  menu: {
    group: "block", rank: 40,
    display: {
      type: "icon",
      width: 768, height: 896,
      path: "M0 512h128v-128h-128v128zM0 256h128v-128h-128v128zM0 768h128v-128h-128v128zM256 512h512v-128h-512v128zM256 256h512v-128h-512v128zM256 768h512v-128h-512v128z"
    }
  },
  keys: ["Shift-Ctrl-8"]
});

// ;; #path=ordered_list:wrap #kind=command
// Wrap the selection in an ordered list.
//
// **Keybindings:** Shift-Ctrl-9
_model.OrderedList.register("command", "wrap", {
  derive: { list: true },
  label: "Wrap the selection in an ordered list",
  menu: {
    group: "block", rank: 41,
    display: {
      type: "icon",
      width: 768, height: 896,
      path: "M320 512h448v-128h-448v128zM320 768h448v-128h-448v128zM320 128v128h448v-128h-448zM79 384h78v-256h-36l-85 23v50l43-2v185zM189 590c0-36-12-78-96-78-33 0-64 6-83 16l1 66c21-10 42-15 67-15s32 11 32 28c0 26-30 58-110 112v50h192v-67l-91 2c49-30 87-66 87-113l1-1z"
    }
  },
  keys: ["Shift-Ctrl-9"]
});

// ;; #path=blockquote:wrap #kind=command
// Wrap the selection in a block quote.
//
// **Keybindings:** Shift-Ctrl-.
_model.BlockQuote.register("command", "wrap", {
  derive: true,
  label: "Wrap the selection in a block quote",
  menu: {
    group: "block", rank: 45,
    display: {
      type: "icon",
      width: 640, height: 896,
      path: "M0 448v256h256v-256h-128c0 0 0-128 128-128v-128c0 0-256 0-256 256zM640 320v-128c0 0-256 0-256 256v256h256v-256h-128c0 0 0-128 128-128z"
    }
  },
  keys: ["Shift-Ctrl-."]
});

// ;; #path=hard_break:insert #kind=command
// Replace the selection with a hard break node. If the selection is
// in a node whose [type](#NodeType) has a truthy `isCode` property
// (such as `CodeBlock` in the default schema), a regular newline is
// inserted instead.
//
// **Keybindings:** Mod-Enter, Shift-Enter
_model.HardBreak.register("command", "insert", {
  label: "Insert hard break",
  run: function run(pm) {
    var _pm$selection = pm.selection;
    var node = _pm$selection.node;
    var from = _pm$selection.from;

    if (node && node.isBlock) return false;else if (pm.doc.resolve(from).parent.type.isCode) return pm.tr.typeText("\n").apply(pm.apply.scroll);else return pm.tr.replaceSelection(this.create()).apply(pm.apply.scroll);
  },

  keys: { all: ["Mod-Enter", "Shift-Enter"],
    mac: ["Ctrl-Enter"] }
});

// ;; #path=list_item:split #kind=command
// If the selection is a text selection inside of a child of a list
// item, split that child and the list item, and delete the selection.
//
// **Keybindings:** Enter
_model.ListItem.register("command", "split", {
  label: "Split the current list item",
  run: function run(pm) {
    var _pm$selection2 = pm.selection;
    var from = _pm$selection2.from;
    var to = _pm$selection2.to;
    var node = _pm$selection2.node;var $from = pm.doc.resolve(from);
    if (node && node.isBlock || $from.depth < 2 || !$from.sameParent(pm.doc.resolve(to))) return false;
    var grandParent = $from.node($from.depth - 1);
    if (grandParent.type != this) return false;
    var nextType = to == $from.end($from.depth) ? pm.schema.defaultTextblockType() : null;
    return pm.tr.delete(from, to).split(from, 2, nextType).apply(pm.apply.scroll);
  },

  keys: ["Enter(50)"]
});

function selectedListItems(pm, type) {
  var _pm$selection3 = pm.selection;
  var node = _pm$selection3.node;
  var from = _pm$selection3.from;
  var to = _pm$selection3.to;var $from = pm.doc.resolve(from);
  if (node && node.type == type) return { from: from, to: to, depth: $from.depth + 1 };

  var itemDepth = $from.parent.type == type ? $from.depth : $from.depth > 0 && $from.node($from.depth - 1).type == type ? $from.depth - 1 : null;
  if (itemDepth == null) return;

  var $to = pm.doc.resolve(to);
  if ($from.sameDepth($to) < itemDepth - 1) return null;
  return { from: $from.before(itemDepth),
    to: $to.after(itemDepth),
    depth: itemDepth };
}

// ;; #path="list_item:lift" #kind=command
// Lift a list item into a parent list.
//
// **Keybindings:** Mod-[
_model.ListItem.register("command", "lift", {
  label: "Lift the selected list items to an outer list",
  run: function run(pm) {
    var selected = selectedListItems(pm, this);
    if (!selected || selected.depth < 3) return false;
    var $to = pm.doc.resolve(pm.selection.to);
    if ($to.node(selected.depth - 2).type != this) return false;
    var itemsAfter = selected.to < $to.end(selected.depth - 1);
    var tr = pm.tr.splitIfNeeded(selected.to, 2).splitIfNeeded(selected.from, 2);
    var end = tr.map(selected.to, -1);
    tr.step("ancestor", tr.map(selected.from), end, { depth: 2 });
    if (itemsAfter) tr.join(end - 2);
    return tr.apply(pm.apply.scroll);
  },

  keys: ["Mod-[(20)"]
});

// ;; #path="list_item:sink" #kind=command
// Move a list item into a sublist.
//
// **Keybindings:** Mod-]
_model.ListItem.register("command", "sink", {
  label: "Sink the selected list items into an inner list",
  run: function run(pm) {
    var selected = selectedListItems(pm, this);
    if (!selected) return false;
    var $from = pm.doc.resolve(pm.selection.from),
        startIndex = $from.index(selected.depth - 1);
    if (startIndex == 0) return false;
    var parent = $from.node(selected.depth - 1),
        before = parent.child(startIndex - 1);
    var tr = pm.tr.wrap(selected.from, selected.to, parent.type, parent.attrs);
    if (before.type == this) tr.join(selected.from, before.lastChild && before.lastChild.type == parent.type ? 2 : 1);
    return tr.apply(pm.apply.scroll);
  },

  keys: ["Mod-](20)"]
});

var _loop = function _loop(i) {
  // ;; #path="heading:make_" #kind=command
  // The commands `make1` to `make6` set the textblocks in the
  // selection to become headers with the given level.
  //
  // **Keybindings:** Shift-Ctrl-1 through Shift-Ctrl-6
  _model.Heading.registerComputed("command", "make" + i, function (type) {
    var attrs = { level: String(i) };
    if (i <= type.maxLevel) return {
      derive: { name: "make", attrs: attrs },
      label: "Change to heading " + i,
      keys: i <= 6 && ["Shift-Ctrl-" + i],
      menu: {
        group: "textblockHeading", rank: 30 + i,
        display: { type: "label", label: "Level " + i },
        activeDisplay: "Head " + i
      }
    };
  });
};

for (var i = 1; i <= 10; i++) {
  _loop(i);
} // ;; #path=paragraph:make #kind=command
// Set the textblocks in the selection to be regular paragraphs.
//
// **Keybindings:** Shift-Ctrl-0
_model.Paragraph.register("command", "make", {
  derive: true,
  label: "Change to paragraph",
  keys: ["Shift-Ctrl-0"],
  menu: {
    group: "textblock", rank: 10,
    display: { type: "label", label: "Plain" },
    activeDisplay: "Plain"
  }
});

// ;; #path=code_block:make #kind=command
// Set the textblocks in the selection to be code blocks.
//
// **Keybindings:** Shift-Ctrl-\
_model.CodeBlock.register("command", "make", {
  derive: true,
  label: "Change to code block",
  keys: ["Shift-Ctrl-\\"],
  menu: {
    group: "textblock", rank: 20,
    display: { type: "label", label: "Code" },
    activeDisplay: "Code"
  }
});

// ;; #path=horizontal_rule:insert #kind=command
// Replace the selection with a horizontal rule.
//
// **Keybindings:** Mod-Shift-Minus
_model.HorizontalRule.register("command", "insert", {
  derive: true,
  label: "Insert horizontal rule",
  keys: ["Mod-Shift--"],
  menu: { group: "insert", rank: 70, display: { type: "label", label: "Horizontal rule" } }
});
},{"../format":21,"../model":33,"./command":5}],17:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NodeSelection = exports.TextSelection = exports.Selection = exports.SelectionState = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.hasFocus = hasFocus;
exports.findSelectionFrom = findSelectionFrom;
exports.findSelectionNear = findSelectionNear;
exports.findSelectionAtStart = findSelectionAtStart;
exports.findSelectionAtEnd = findSelectionAtEnd;
exports.verticalMotionLeavesTextblock = verticalMotionLeavesTextblock;

var _dom = require("../dom");

var _dompos = require("./dompos");

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Track the state of the current editor selection. Keeps the editor
// selection in sync with the DOM selection by polling for changes,
// as there is no DOM event for DOM selection changes.

var SelectionState = exports.SelectionState = function () {
  function SelectionState(pm, range) {
    var _this = this;

    _classCallCheck(this, SelectionState);

    this.pm = pm;
    // The current editor selection.
    this.range = range;

    // The timeout ID for the poller when active.
    this.polling = null;
    // Track the state of the DOM selection.
    this.lastAnchorNode = this.lastHeadNode = this.lastAnchorOffset = this.lastHeadOffset = null;
    // The corresponding DOM node when a node selection is active.
    this.lastNode = null;

    pm.content.addEventListener("focus", function () {
      return _this.receivedFocus();
    });

    this.poller = this.poller.bind(this);
  }

  // : (Selection, boolean)
  // Set the current selection and signal an event on the editor.


  _createClass(SelectionState, [{
    key: "setAndSignal",
    value: function setAndSignal(range, clearLast) {
      this.set(range, clearLast);
      // :: () #path=ProseMirror#events#selectionChange
      // Indicates that the editor's selection has changed.
      this.pm.signal("selectionChange");
    }

    // : (Selection, boolean)
    // Set the current selection.

  }, {
    key: "set",
    value: function set(range, clearLast) {
      this.pm.ensureOperation({ readSelection: false });
      this.range = range;
      if (clearLast !== false) this.lastAnchorNode = null;
    }
  }, {
    key: "poller",
    value: function poller() {
      if (hasFocus(this.pm)) {
        if (!this.pm.operation) this.readFromDOM();
        this.polling = setTimeout(this.poller, 100);
      } else {
        this.polling = null;
      }
    }
  }, {
    key: "startPolling",
    value: function startPolling() {
      clearTimeout(this.polling);
      this.polling = setTimeout(this.poller, 50);
    }
  }, {
    key: "fastPoll",
    value: function fastPoll() {
      this.startPolling();
    }
  }, {
    key: "stopPolling",
    value: function stopPolling() {
      clearTimeout(this.polling);
      this.polling = null;
    }

    // : () → bool
    // Whether the DOM selection has changed from the last known state.

  }, {
    key: "domChanged",
    value: function domChanged() {
      var sel = window.getSelection();
      return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset || sel.focusNode != this.lastHeadNode || sel.focusOffset != this.lastHeadOffset;
    }

    // Store the current state of the DOM selection.

  }, {
    key: "storeDOMState",
    value: function storeDOMState() {
      var sel = window.getSelection();
      this.lastAnchorNode = sel.anchorNode;this.lastAnchorOffset = sel.anchorOffset;
      this.lastHeadNode = sel.focusNode;this.lastHeadOffset = sel.focusOffset;
    }

    // : () → bool
    // When the DOM selection changes in a notable manner, modify the
    // current selection state to match.

  }, {
    key: "readFromDOM",
    value: function readFromDOM() {
      if (!hasFocus(this.pm) || !this.domChanged()) return false;

      var sel = window.getSelection(),
          doc = this.pm.doc;
      var anchor = (0, _dompos.posFromDOM)(this.pm, sel.anchorNode, sel.anchorOffset);
      var head = sel.isCollapsed ? anchor : (0, _dompos.posFromDOM)(this.pm, sel.focusNode, sel.focusOffset);

      var newRange = findSelectionNear(doc, head, this.range.head != null && this.range.head < head ? 1 : -1);
      if (newRange instanceof TextSelection) {
        var selNearAnchor = findSelectionNear(doc, anchor, anchor > newRange.to ? -1 : 1, true);
        newRange = new TextSelection(selNearAnchor.anchor, newRange.head);
      } else if (anchor < newRange.from || anchor > newRange.to) {
        // If head falls on a node, but anchor falls outside of it,
        // create a text selection between them
        var inv = anchor > newRange.to;
        newRange = new TextSelection(findSelectionNear(doc, anchor, inv ? -1 : 1, true).anchor, findSelectionNear(doc, inv ? newRange.from : newRange.to, inv ? 1 : -1, true).head);
      }
      this.setAndSignal(newRange);

      if (newRange instanceof NodeSelection || newRange.head != head || newRange.anchor != anchor) {
        this.toDOM();
      } else {
        this.clearNode();
        this.storeDOMState();
      }
      return true;
    }
  }, {
    key: "toDOM",
    value: function toDOM(takeFocus) {
      if (!hasFocus(this.pm)) {
        if (!takeFocus) return;
        // See https://bugzilla.mozilla.org/show_bug.cgi?id=921444
        else if (_dom.browser.gecko) this.pm.content.focus();
      }
      if (this.range instanceof NodeSelection) this.nodeToDOM();else this.rangeToDOM();
    }

    // Make changes to the DOM for a node selection.

  }, {
    key: "nodeToDOM",
    value: function nodeToDOM() {
      var dom = (0, _dompos.DOMAfterPos)(this.pm, this.range.from);
      if (dom != this.lastNode) {
        this.clearNode();
        dom.classList.add("ProseMirror-selectednode");
        this.pm.content.classList.add("ProseMirror-nodeselection");
        this.lastNode = dom;
      }
      var range = document.createRange(),
          sel = window.getSelection();
      range.selectNode(dom);
      sel.removeAllRanges();
      sel.addRange(range);
      this.storeDOMState();
    }

    // Make changes to the DOM for a text selection.

  }, {
    key: "rangeToDOM",
    value: function rangeToDOM() {
      this.clearNode();

      var anchor = (0, _dompos.DOMFromPos)(this.pm, this.range.anchor);
      var head = (0, _dompos.DOMFromPos)(this.pm, this.range.head);

      var sel = window.getSelection(),
          range = document.createRange();
      if (sel.extend) {
        range.setEnd(anchor.node, anchor.offset);
        range.collapse(false);
      } else {
        if (this.range.anchor > this.range.head) {
          var tmp = anchor;anchor = head;head = tmp;
        }
        range.setEnd(head.node, head.offset);
        range.setStart(anchor.node, anchor.offset);
      }
      sel.removeAllRanges();
      sel.addRange(range);
      if (sel.extend) sel.extend(head.node, head.offset);
      this.storeDOMState();
    }

    // Clear all DOM statefulness of the last node selection.

  }, {
    key: "clearNode",
    value: function clearNode() {
      if (this.lastNode) {
        this.lastNode.classList.remove("ProseMirror-selectednode");
        this.pm.content.classList.remove("ProseMirror-nodeselection");
        this.lastNode = null;
        return true;
      }
    }
  }, {
    key: "receivedFocus",
    value: function receivedFocus() {
      if (this.polling == null) this.startPolling();
    }
  }]);

  return SelectionState;
}();

// ;; An editor selection. Can be one of two selection types:
// `TextSelection` and `NodeSelection`. Both have the properties
// listed here, but also contain more information (such as the
// selected [node](#NodeSelection.node) or the
// [head](#TextSelection.head) and [anchor](#TextSelection.anchor)).


var Selection = exports.Selection = function Selection() {
  _classCallCheck(this, Selection);
};

// :: number #path=Selection.prototype.from
// The left-bound of the selection.

// :: number #path=Selection.prototype.to
// The right-bound of the selection.

// :: bool #path=Selection.empty
// True if the selection is an empty text selection (head an anchor
// are the same).

// :: (other: Selection) → bool #path=Selection.eq
// Test whether the selection is the same as another selection.

// :: (doc: Node, mapping: Mappable) → Selection #path=Selection.map
// Map this selection through a [mappable](#Mappable) thing. `doc`
// should be the new document, to which we are mapping.


// ;; A text selection represents a classical editor
// selection, with a head (the moving side) and anchor (immobile
// side), both of which point into textblock nodes. It can be empty (a
// regular cursor position).

var TextSelection = exports.TextSelection = function (_Selection) {
  _inherits(TextSelection, _Selection);

  // :: (number, ?number)
  // Construct a text selection. When `head` is not given, it defaults
  // to `anchor`.

  function TextSelection(anchor, head) {
    _classCallCheck(this, TextSelection);

    // :: number
    // The selection's immobile side (does not move when pressing
    // shift-arrow).

    var _this2 = _possibleConstructorReturn(this, Object.getPrototypeOf(TextSelection).call(this));

    _this2.anchor = anchor;
    // :: number
    // The selection's mobile side (the side that moves when pressing
    // shift-arrow).
    _this2.head = head == null ? anchor : head;
    return _this2;
  }

  _createClass(TextSelection, [{
    key: "eq",
    value: function eq(other) {
      return other instanceof TextSelection && other.head == this.head && other.anchor == this.anchor;
    }
  }, {
    key: "map",
    value: function map(doc, mapping) {
      var head = mapping.map(this.head);
      if (!doc.resolve(head).parent.isTextblock) return findSelectionNear(doc, head);
      var anchor = mapping.map(this.anchor);
      return new TextSelection(doc.resolve(anchor).parent.isTextblock ? anchor : head, head);
    }
  }, {
    key: "inverted",
    get: function get() {
      return this.anchor > this.head;
    }
  }, {
    key: "from",
    get: function get() {
      return Math.min(this.head, this.anchor);
    }
  }, {
    key: "to",
    get: function get() {
      return Math.max(this.head, this.anchor);
    }
  }, {
    key: "empty",
    get: function get() {
      return this.anchor == this.head;
    }
  }, {
    key: "token",
    get: function get() {
      return new SelectionToken(TextSelection, this.anchor, this.head);
    }
  }], [{
    key: "mapToken",
    value: function mapToken(token, mapping) {
      return new SelectionToken(TextSelection, mapping.map(token.a), mapping.map(token.b));
    }
  }, {
    key: "fromToken",
    value: function fromToken(token, doc) {
      if (!doc.resolve(token.b).parent.isTextblock) return findSelectionNear(doc, token.b);
      return new TextSelection(doc.resolve(token.a).parent.isTextblock ? token.a : token.b, token.b);
    }
  }]);

  return TextSelection;
}(Selection);

// ;; A node selection is a selection that points at a
// single node. All nodes marked [selectable](#NodeType.selectable)
// can be the target of a node selection. In such an object, `from`
// and `to` point directly before and after the selected node.


var NodeSelection = exports.NodeSelection = function (_Selection2) {
  _inherits(NodeSelection, _Selection2);

  // :: (number, number, Node)
  // Create a node selection. Does not verify the validity of its
  // arguments. Use `ProseMirror.setNodeSelection` for an easier,
  // error-checking way to create a node selection.

  function NodeSelection(from, to, node) {
    _classCallCheck(this, NodeSelection);

    var _this3 = _possibleConstructorReturn(this, Object.getPrototypeOf(NodeSelection).call(this));

    _this3.from = from;
    _this3.to = to;
    // :: Node The selected node.
    _this3.node = node;
    return _this3;
  }

  _createClass(NodeSelection, [{
    key: "eq",
    value: function eq(other) {
      return other instanceof NodeSelection && this.from == other.from;
    }
  }, {
    key: "map",
    value: function map(doc, mapping) {
      var from = mapping.map(this.from, 1);
      var to = mapping.map(this.to, -1);
      var node = doc.nodeAt(from);
      if (node && to == from + node.nodeSize && node.type.selectable) return new NodeSelection(from, to, node);
      return findSelectionNear(doc, from);
    }
  }, {
    key: "empty",
    get: function get() {
      return false;
    }
  }, {
    key: "token",
    get: function get() {
      return new SelectionToken(NodeSelection, this.from, this.to);
    }
  }], [{
    key: "mapToken",
    value: function mapToken(token, mapping) {
      return new SelectionToken(TextSelection, mapping.map(token.a, 1), mapping.map(token.b, -1));
    }
  }, {
    key: "fromToken",
    value: function fromToken(token, doc) {
      var node = doc.nodeAt(token.a);
      if (node && token.b == token.a + node.nodeSize && node.type.selectable) return new NodeSelection(token.a, token.b, node);
      return findSelectionNear(doc, token.a);
    }
  }]);

  return NodeSelection;
}(Selection);

var SelectionToken = function SelectionToken(type, a, b) {
  _classCallCheck(this, SelectionToken);

  this.type = type;
  this.a = a;
  this.b = b;
};

function hasFocus(pm) {
  if (document.activeElement != pm.content) return false;
  var sel = window.getSelection();
  return sel.rangeCount && (0, _dom.contains)(pm.content, sel.anchorNode);
}

// Try to find a selection inside the given node. `pos` points at the
// position where the search starts. When `text` is true, only return
// text selections.
function findSelectionIn(node, pos, index, dir, text) {
  for (var i = index - (dir > 0 ? 0 : 1); dir > 0 ? i < node.childCount : i >= 0; i += dir) {
    var child = node.child(i);
    if (child.isTextblock) return new TextSelection(pos + dir);
    if (child.type.contains) {
      var inner = findSelectionIn(child, pos + dir, dir < 0 ? child.childCount : 0, dir, text);
      if (inner) return inner;
    } else if (!text && child.type.selectable) {
      return new NodeSelection(pos - (dir < 0 ? child.nodeSize : 0), pos + (dir > 0 ? child.nodeSize : 0), child);
    }
    pos += child.nodeSize * dir;
  }
}

// FIXME we'll need some awareness of text direction when scanning for selections

// Create a selection which is moved relative to a position in a
// given direction. When a selection isn't found at the given position,
// walks up the document tree one level and one step in the
// desired direction.
function findSelectionFrom(doc, pos, dir, text) {
  var $pos = doc.resolve(pos);
  var inner = $pos.parent.isTextblock ? new TextSelection(pos) : findSelectionIn($pos.parent, pos, $pos.index($pos.depth), dir, text);
  if (inner) return inner;

  for (var depth = $pos.depth - 1; depth >= 0; depth--) {
    var found = dir < 0 ? findSelectionIn($pos.node(depth), $pos.before(depth + 1), $pos.index(depth), dir, text) : findSelectionIn($pos.node(depth), $pos.after(depth + 1), $pos.index(depth) + 1, dir, text);
    if (found) return found;
  }
}

function findSelectionNear(doc, pos) {
  var bias = arguments.length <= 2 || arguments[2] === undefined ? 1 : arguments[2];
  var text = arguments[3];

  var result = findSelectionFrom(doc, pos, bias, text) || findSelectionFrom(doc, pos, -bias, text);
  if (!result) throw new RangeError("Searching for selection in invalid document " + doc);
  return result;
}

// Find the selection closest to the start of the given node. `pos`,
// if given, should point at the start of the node's content.
function findSelectionAtStart(node, text) {
  return findSelectionIn(node, 0, 0, 1, text);
}

// Find the selection closest to the end of the given node.
function findSelectionAtEnd(node, text) {
  return findSelectionIn(node, node.content.size, node.childCount, -1, text);
}

// : (ProseMirror, number, number)
// Whether vertical position motion in a given direction
// from a position would leave a text block.
function verticalMotionLeavesTextblock(pm, pos, dir) {
  var $pos = pm.doc.resolve(pos);
  var dom = (0, _dompos.DOMAfterPos)(pm, $pos.before($pos.depth));
  var coords = (0, _dompos.coordsAtPos)(pm, pos);
  for (var child = dom.firstChild; child; child = child.nextSibling) {
    if (child.nodeType != 1) continue;
    var boxes = child.getClientRects();
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      if (dir < 0 ? box.bottom < coords.top : box.top > coords.bottom) return false;
    }
  }
  return true;
}
},{"../dom":1,"./dompos":8}],18:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EditorTransform = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _transform = require("../transform");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// ;; A selection-aware extension of `Transform`. Use
// `ProseMirror.tr` to create an instance.

var EditorTransform = exports.EditorTransform = function (_Transform) {
  _inherits(EditorTransform, _Transform);

  function EditorTransform(pm) {
    _classCallCheck(this, EditorTransform);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(EditorTransform).call(this, pm.doc));

    _this.pm = pm;
    return _this;
  }

  // :: (?Object) → ?EditorTransform
  // Apply the transformation. Returns the transform, or `false` it is
  // was empty.


  _createClass(EditorTransform, [{
    key: "apply",
    value: function apply(options) {
      return this.pm.apply(this, options);
    }

    // :: Selection
    // Get the editor's current selection, [mapped](#Selection.map)
    // through the steps in this transform.

  }, {
    key: "replaceSelection",


    // :: (?Node, ?bool) → EditorTransform
    // Replace the selection with the given node, or delete it if `node`
    // is null. When `inheritMarks` is true and the node is an inline
    // node, it inherits the marks from the place where it is inserted.
    value: function replaceSelection(node, inheritMarks) {
      var _selection = this.selection;
      var empty = _selection.empty;
      var from = _selection.from;
      var to = _selection.to;
      var selNode = _selection.node;


      if (node && node.isInline && inheritMarks !== false) node = node.mark(empty ? this.pm.input.storedMarks : this.doc.marksAt(from));

      if (selNode && selNode.isTextblock && node && node.isInline) {
        // Putting inline stuff onto a selected textblock puts it
        // inside, so cut off the sides
        from++;
        to--;
      } else if (selNode) {
        // This node can not simply be removed/replaced. Remove its parent as well
        var $from = this.doc.resolve(from),
            depth = $from.depth;
        while (depth && $from.node(depth).childCount == 1 && !(node ? $from.node(depth).type.canContain(node) : $from.node(depth).type.canBeEmpty)) {
          depth--;
        }if (depth < $from.depth) {
          from = $from.before(depth + 1);
          to = $from.after(depth + 1);
        }
      } else if (node && node.isBlock) {
        var $from = this.doc.resolve(from);
        // Inserting a block node into a textblock. Try to insert it above by splitting the textblock
        if ($from.depth && $from.node($from.depth - 1).type.canContain(node)) {
          this.delete(from, to);
          if ($from.parentOffset && $from.parentOffset < $from.parent.content.size) this.split(from);
          return this.insert(from + ($from.parentOffset ? 1 : -1), node);
        }
      }

      return this.replaceWith(from, to, node);
    }

    // :: () → EditorTransform
    // Delete the selection.

  }, {
    key: "deleteSelection",
    value: function deleteSelection() {
      return this.replaceSelection();
    }

    // :: (string) → EditorTransform
    // Replace the selection with a text node containing the given string.

  }, {
    key: "typeText",
    value: function typeText(text) {
      return this.replaceSelection(this.pm.schema.text(text), true);
    }
  }, {
    key: "selection",
    get: function get() {
      return this.steps.length ? this.pm.selection.map(this) : this.pm.selection;
    }
  }]);

  return EditorTransform;
}(_transform.Transform);
},{"../transform":40}],19:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.fromDOM = fromDOM;
exports.fromHTML = fromHTML;

var _model = require("../model");

var _sortedinsert = require("../util/sortedinsert");

var _sortedinsert2 = _interopRequireDefault(_sortedinsert);

var _register = require("./register");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// :: (Schema, DOMNode, ?Object) → Node
// Parse document from the content of a DOM node. To pass an explicit
// parent document (for example, when not in a browser window
// environment, where we simply use the global document), pass it as
// the `document` property of `options`.
function fromDOM(schema, dom, options) {
  if (!options) options = {};
  var context = new DOMParseState(schema, options.topNode || schema.node("doc"), options);
  var start = options.from ? dom.childNodes[options.from] : dom.firstChild;
  var end = options.to != null && dom.childNodes[options.to] || null;
  context.addAll(start, end, true);
  var doc = undefined;
  do {
    doc = context.leave();
  } while (context.stack.length);
  return doc;
}

// ;; #path=DOMParseSpec #kind=interface
// To define the way [node](#NodeType) and [mark](#MarkType) types are
// parsed, you can associate one or more DOM parsing specifications to
// them using the [`register`](#SchemaItem.register) method with the
// `"parseDOM"` namespace, using the HTML node name (lowercase) as
// value name. Each of them defines a parsing strategy for a certain
// type of DOM node. When `"_"` is used as name, the parser is
// activated for all nodes.

// :: ?number #path=DOMParseSpec.rank
// The precedence of this parsing strategy. Should be a number between
// 0 and 100, which determines when this parser gets a chance relative
// to others that apply to the node (low ranks go first). Defaults to
// 50.

// :: union<string, (dom: DOMNode, state: DOMParseState) → ?bool> #path=DOMParseSpec.parse
// The function that, given a DOM node, parses it, updating the parse
// state. It should return (the exact value) `false` when it wants to
// indicate that it was not able to parse this node. This function is
// called in such a way that `this` is bound to the type that the
// parse spec was associated with.
//
// When this is set to the string `"block"`, the content of the DOM
// node is parsed as the content in a node of the type that this spec
// was associated with.
//
// When set to the string `"mark"`, the content of the DOM node is
// parsed with an instance of the mark that this spec was associated
// with added to their marks.

// :: ?string #path=DOMParseSpec.selector
// A css selector to match against. If present, it will try to match the selector
// against the dom node prior to calling the parse function.

(0, _register.defineSource)("dom", fromDOM);

// :: (Schema, string, ?Object) → Node
// Parses the HTML into a DOM, and then calls through to `fromDOM`.
function fromHTML(schema, html, options) {
  var wrap = (options && options.document || window.document).createElement("div");
  wrap.innerHTML = html;
  return fromDOM(schema, wrap, options);
}

(0, _register.defineSource)("html", fromHTML);

var blockElements = {
  address: true, article: true, aside: true, blockquote: true, canvas: true,
  dd: true, div: true, dl: true, fieldset: true, figcaption: true, figure: true,
  footer: true, form: true, h1: true, h2: true, h3: true, h4: true, h5: true,
  h6: true, header: true, hgroup: true, hr: true, li: true, noscript: true, ol: true,
  output: true, p: true, pre: true, section: true, table: true, tfoot: true, ul: true
};

var ignoreElements = {
  head: true, noscript: true, object: true, script: true, style: true, title: true
};

var listElements = { ol: true, ul: true };

var noMarks = [];

// ;; A state object used to track context during a parse,
// and to expose methods to custom parsing functions.

var DOMParseState = function () {
  function DOMParseState(schema, topNode, options) {
    _classCallCheck(this, DOMParseState);

    // :: Object The options passed to this parse.
    this.options = options || {};
    // :: Schema The schema that we are parsing into.
    this.schema = schema;
    this.stack = [];
    this.marks = noMarks;
    this.closing = false;
    this.enter(topNode.type, topNode.attrs);
    var info = schemaInfo(schema);
    this.tagInfo = info.tags;
    this.styleInfo = info.styles;
  }

  _createClass(DOMParseState, [{
    key: "addDOM",
    value: function addDOM(dom) {
      if (dom.nodeType == 3) {
        var value = dom.nodeValue;
        var top = this.top,
            last = undefined;
        if (/\S/.test(value) || top.type.isTextblock) {
          if (!this.options.preserveWhitespace) {
            value = value.replace(/\s+/g, " ");
            // If this starts with whitespace, and there is either no node
            // before it or a node that ends with whitespace, strip the
            // leading space.
            if (/^\s/.test(value) && (!(last = top.content[top.content.length - 1]) || last.type.name == "text" && /\s$/.test(last.text))) value = value.slice(1);
          }
          if (value) this.insertNode(this.schema.text(value, this.marks));
        }
      } else if (dom.nodeType == 1 && !dom.hasAttribute("pm-ignore")) {
        var style = dom.getAttribute("style");
        if (style) this.addElementWithStyles(parseStyles(style), dom);else this.addElement(dom);
      }
    }
  }, {
    key: "addElement",
    value: function addElement(dom) {
      var name = dom.nodeName.toLowerCase();
      if (listElements.hasOwnProperty(name)) this.normalizeList(dom);
      // Ignore trailing BR nodes, which browsers create during editing
      if (this.options.editableContent && name == "br" && !dom.nextSibling) return;
      if (!this.parseNodeType(name, dom) && !ignoreElements.hasOwnProperty(name)) {
        this.addAll(dom.firstChild, null);
        if (blockElements.hasOwnProperty(name) && this.top.type == this.schema.defaultTextblockType()) this.closing = true;
      }
    }
  }, {
    key: "addElementWithStyles",
    value: function addElementWithStyles(styles, dom) {
      var _this = this;

      var wrappers = [];
      for (var i = 0; i < styles.length; i += 2) {
        var parsers = this.styleInfo[styles[i]],
            value = styles[i + 1];
        if (parsers) for (var j = 0; j < parsers.length; j++) {
          wrappers.push(parsers[j], value);
        }
      }
      var next = function next(i) {
        if (i == wrappers.length) {
          _this.addElement(dom);
        } else {
          var parser = wrappers[i];
          parser.parse.call(parser.type, wrappers[i + 1], _this, next.bind(null, i + 2));
        }
      };
      next(0);
    }
  }, {
    key: "tryParsers",
    value: function tryParsers(parsers, dom) {
      if (parsers) for (var i = 0; i < parsers.length; i++) {
        var parser = parsers[i];
        if ((!parser.selector || matches(dom, parser.selector)) && parser.parse.call(parser.type, dom, this) !== false) return true;
      }
    }
  }, {
    key: "parseNodeType",
    value: function parseNodeType(name, dom) {
      return this.tryParsers(this.tagInfo[name], dom) || this.tryParsers(this.tagInfo._, dom);
    }
  }, {
    key: "addAll",
    value: function addAll(from, to, sync) {
      var stack = sync && this.stack.slice();
      for (var dom = from; dom != to; dom = dom.nextSibling) {
        this.addDOM(dom);
        if (sync && blockElements.hasOwnProperty(dom.nodeName.toLowerCase())) this.sync(stack);
      }
    }
  }, {
    key: "doClose",
    value: function doClose() {
      if (!this.closing || this.stack.length < 2) return;
      var left = this.leave();
      this.enter(left.type, left.attrs);
      this.closing = false;
    }
  }, {
    key: "insertNode",
    value: function insertNode(node) {
      if (this.top.type.canContain(node)) {
        this.doClose();
      } else {
        var found = undefined;
        for (var i = this.stack.length - 1; i >= 0; i--) {
          var route = this.stack[i].type.findConnection(node.type);
          if (!route) continue;
          if (i == this.stack.length - 1) {
            this.doClose();
          } else {
            while (this.stack.length > i + 1) {
              this.leave();
            }
          }
          found = route;
          break;
        }
        if (!found) return;
        for (var j = 0; j < found.length; j++) {
          this.enter(found[j]);
        }if (this.marks.length) this.marks = noMarks;
      }
      this.top.content.push(node);
      return node;
    }
  }, {
    key: "close",
    value: function close(type, attrs, content) {
      content = _model.Fragment.from(content);
      if (!type.checkContent(content, attrs)) {
        content = type.fixContent(content, attrs);
        if (!content) return null;
      }
      return type.create(attrs, content, this.marks);
    }

    // :: (DOMNode, NodeType, ?Object, [Node]) → ?Node
    // Insert a node of the given type, with the given content, based on
    // `dom`, at the current position in the document.

  }, {
    key: "insert",
    value: function insert(type, attrs, content) {
      var closed = this.close(type, attrs, content);
      if (closed) return this.insertNode(closed);
    }
  }, {
    key: "enter",
    value: function enter(type, attrs) {
      this.stack.push({ type: type, attrs: attrs, content: [] });
    }
  }, {
    key: "leave",
    value: function leave() {
      if (this.marks.length) this.marks = noMarks;
      var top = this.stack.pop();
      var last = top.content[top.content.length - 1];
      if (!this.options.preserveWhitespace && last && last.isText && /\s$/.test(last.text)) {
        if (last.text.length == 1) top.content.pop();else top.content[top.content.length - 1] = last.copy(last.text.slice(0, last.text.length - 1));
      }
      var node = this.close(top.type, top.attrs, top.content);
      if (node && this.stack.length) this.insertNode(node);
      return node;
    }
  }, {
    key: "sync",
    value: function sync(stack) {
      while (this.stack.length > stack.length) {
        this.leave();
      }for (;;) {
        var n = this.stack.length - 1,
            one = this.stack[n],
            two = stack[n];
        if (one.type == two.type && _model.Node.sameAttrs(one.attrs, two.attrs)) break;
        this.leave();
      }
      while (stack.length > this.stack.length) {
        var add = stack[this.stack.length];
        this.enter(add.type, add.attrs);
      }
      if (this.marks.length) this.marks = noMarks;
      this.closing = false;
    }

    // :: (DOMNode, NodeType, ?Object)
    // Parse the contents of `dom` as children of a node of the given
    // type.

  }, {
    key: "wrapIn",
    value: function wrapIn(dom, type, attrs) {
      this.enter(type, attrs);
      this.addAll(dom.firstChild, null, true);
      this.leave();
    }

    // :: (DOMNode, Mark)
    // Parse the contents of `dom`, with `mark` added to the set of
    // current marks.

  }, {
    key: "wrapMark",
    value: function wrapMark(inner, mark) {
      var old = this.marks;
      this.marks = (mark.instance || mark).addToSet(old);
      if (inner.call) inner();else this.addAll(inner.firstChild, null);
      this.marks = old;
    }
  }, {
    key: "normalizeList",
    value: function normalizeList(dom) {
      for (var child = dom.firstChild, prev; child; child = child.nextSibling) {
        if (child.nodeType == 1 && listElements.hasOwnProperty(child.nodeName.toLowerCase()) && (prev = child.previousSibling)) {
          prev.appendChild(child);
          child = prev;
        }
      }
    }
  }, {
    key: "top",
    get: function get() {
      return this.stack[this.stack.length - 1];
    }
  }]);

  return DOMParseState;
}();

function matches(dom, selector) {
  return (dom.matches || dom.msMatchesSelector || dom.webkitMatchesSelector || dom.mozMatchesSelector).call(dom, selector);
}

function parseStyles(style) {
  var re = /\s*([\w-]+)\s*:\s*([^;]+)/g,
      m = undefined,
      result = [];
  while (m = re.exec(style)) {
    result.push(m[1], m[2].trim());
  }return result;
}

function schemaInfo(schema) {
  return schema.cached.parseDOMInfo || (schema.cached.parseDOMInfo = summarizeSchemaInfo(schema));
}

function summarizeSchemaInfo(schema) {
  var tags = Object.create(null),
      styles = Object.create(null);
  tags._ = [];
  schema.registry("parseDOM", function (tag, info, type) {
    var parse = info.parse;
    if (parse == "block") parse = function parse(dom, state) {
      state.wrapIn(dom, this);
    };else if (parse == "mark") parse = function parse(dom, state) {
      state.wrapMark(dom, this);
    };
    (0, _sortedinsert2.default)(tags[tag] || (tags[tag] = []), {
      type: type, parse: parse,
      selector: info.selector,
      rank: info.rank == null ? 50 : info.rank
    }, function (a, b) {
      return a.rank - b.rank;
    });
  });
  schema.registry("parseDOMStyle", function (style, info, type) {
    (0, _sortedinsert2.default)(styles[style] || (styles[style] = []), {
      type: type,
      parse: info.parse,
      rank: info.rank == null ? 50 : info.rank
    }, function (a, b) {
      return a.rank - b.rank;
    });
  });
  return { tags: tags, styles: styles };
}

_model.Paragraph.register("parseDOM", "p", { parse: "block" });

_model.BlockQuote.register("parseDOM", "blockquote", { parse: "block" });

var _loop = function _loop(i) {
  _model.Heading.registerComputed("parseDOM", "h" + i, function (type) {
    if (i <= type.maxLevel) return {
      parse: function parse(dom, state) {
        state.wrapIn(dom, this, { level: String(i) });
      }
    };
  });
};

for (var i = 1; i <= 6; i++) {
  _loop(i);
}_model.HorizontalRule.register("parseDOM", "hr", { parse: "block" });

_model.CodeBlock.register("parseDOM", "pre", {
  parse: function parse(dom, state) {
    var params = dom.firstChild && /^code$/i.test(dom.firstChild.nodeName) && dom.firstChild.getAttribute("class");
    if (params && /fence/.test(params)) {
      var found = [],
          re = /(?:^|\s)lang-(\S+)/g,
          m = undefined;
      while (m = re.exec(params)) {
        found.push(m[1]);
      }params = found.join(" ");
    } else {
      params = null;
    }
    var text = dom.textContent;
    state.insert(this, { params: params }, text ? [state.schema.text(text)] : []);
  }
});

_model.BulletList.register("parseDOM", "ul", { parse: "block" });

_model.OrderedList.register("parseDOM", "ol", {
  parse: function parse(dom, state) {
    var attrs = { order: dom.getAttribute("start") || "1" };
    state.wrapIn(dom, this, attrs);
  }
});

_model.ListItem.register("parseDOM", "li", { parse: "block" });

_model.HardBreak.register("parseDOM", "br", {
  parse: function parse(_, state) {
    state.insert(this);
  }
});

_model.Image.register("parseDOM", "img", {
  parse: function parse(dom, state) {
    state.insert(this, {
      src: dom.getAttribute("src"),
      title: dom.getAttribute("title") || null,
      alt: dom.getAttribute("alt") || null
    });
  }
});

// Inline style tokens

_model.LinkMark.register("parseDOM", "a", {
  parse: function parse(dom, state) {
    state.wrapMark(dom, this.create({ href: dom.getAttribute("href"),
      title: dom.getAttribute("title") }));
  },

  selector: "[href]"
});

_model.EmMark.register("parseDOM", "i", { parse: "mark" });
_model.EmMark.register("parseDOM", "em", { parse: "mark" });
_model.EmMark.register("parseDOMStyle", "font-style", {
  parse: function parse(value, state, inner) {
    if (value == "italic") state.wrapMark(inner, this);else inner();
  }
});

_model.StrongMark.register("parseDOM", "b", { parse: "mark" });
_model.StrongMark.register("parseDOM", "strong", { parse: "mark" });
_model.StrongMark.register("parseDOMStyle", "font-weight", {
  parse: function parse(value, state, inner) {
    if (value == "bold" || value == "bolder" || !/\D/.test(value) && +value >= 500) state.wrapMark(inner, this);else inner();
  }
});

_model.CodeMark.register("parseDOM", "code", { parse: "mark" });
},{"../model":33,"../util/sortedinsert":54,"./register":22}],20:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fromText = fromText;

var _register = require("./register");

// FIXME is it meaningful to try and attach text-parsing information
// to node types?

// :: (Schema, string) → Node
// Convert a string into a simple ProseMirror document.
function fromText(schema, text) {
  var blocks = text.trim().split(/\n{2,}/);
  var nodes = [];
  for (var i = 0; i < blocks.length; i++) {
    var spans = [];
    var parts = blocks[i].split("\n");
    for (var j = 0; j < parts.length; j++) {
      if (j) spans.push(schema.node("hard_break"));
      if (parts[j]) spans.push(schema.text(parts[j]));
    }
    nodes.push(schema.node("paragraph", null, spans));
  }
  if (!nodes.length) nodes.push(schema.node("paragraph"));
  return schema.node("doc", null, nodes);
}

(0, _register.defineSource)("text", fromText);
},{"./register":22}],21:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _register = require("./register");

Object.defineProperty(exports, "serializeTo", {
  enumerable: true,
  get: function get() {
    return _register.serializeTo;
  }
});
Object.defineProperty(exports, "knownTarget", {
  enumerable: true,
  get: function get() {
    return _register.knownTarget;
  }
});
Object.defineProperty(exports, "defineTarget", {
  enumerable: true,
  get: function get() {
    return _register.defineTarget;
  }
});
Object.defineProperty(exports, "parseFrom", {
  enumerable: true,
  get: function get() {
    return _register.parseFrom;
  }
});
Object.defineProperty(exports, "knownSource", {
  enumerable: true,
  get: function get() {
    return _register.knownSource;
  }
});
Object.defineProperty(exports, "defineSource", {
  enumerable: true,
  get: function get() {
    return _register.defineSource;
  }
});

var _from_dom = require("./from_dom");

Object.defineProperty(exports, "fromDOM", {
  enumerable: true,
  get: function get() {
    return _from_dom.fromDOM;
  }
});
Object.defineProperty(exports, "fromHTML", {
  enumerable: true,
  get: function get() {
    return _from_dom.fromHTML;
  }
});

var _to_dom = require("./to_dom");

Object.defineProperty(exports, "toDOM", {
  enumerable: true,
  get: function get() {
    return _to_dom.toDOM;
  }
});
Object.defineProperty(exports, "toHTML", {
  enumerable: true,
  get: function get() {
    return _to_dom.toHTML;
  }
});
Object.defineProperty(exports, "nodeToDOM", {
  enumerable: true,
  get: function get() {
    return _to_dom.nodeToDOM;
  }
});

var _from_text = require("./from_text");

Object.defineProperty(exports, "fromText", {
  enumerable: true,
  get: function get() {
    return _from_text.fromText;
  }
});

var _to_text = require("./to_text");

Object.defineProperty(exports, "toText", {
  enumerable: true,
  get: function get() {
    return _to_text.toText;
  }
});
},{"./from_dom":19,"./from_text":20,"./register":22,"./to_dom":23,"./to_text":24}],22:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.serializeTo = serializeTo;
exports.knownTarget = knownTarget;
exports.defineTarget = defineTarget;
exports.parseFrom = parseFrom;
exports.knownSource = knownSource;
exports.defineSource = defineSource;
var serializers = Object.create(null);

// :: (Node, string, ?Object) → any
// Serialize the given document to the given format. If `options` is
// given, it will be passed along to the serializer function.
function serializeTo(doc, format, options) {
  var converter = serializers[format];
  if (!converter) throw new RangeError("Target format " + format + " not defined");
  return converter(doc, options);
}

// :: (string) → bool
// Query whether a given serialization format has been registered.
function knownTarget(format) {
  return !!serializers[format];
}

// :: (string, (Node, ?Object) → any)
// Register a function as the serializer for `format`.
function defineTarget(format, func) {
  serializers[format] = func;
}

defineTarget("json", function (doc) {
  return doc.toJSON();
});

var parsers = Object.create(null);

// :: (Schema, any, string, ?Object) → Node
// Parse document `value` from the format named by `format`. If
// `options` is given, it is passed along to the parser function.
function parseFrom(schema, value, format, options) {
  var converter = parsers[format];
  if (!converter) throw new RangeError("Source format " + format + " not defined");
  return converter(schema, value, options);
}

// :: (string) → bool
// Query whether a parser for the named format has been registered.
function knownSource(format) {
  return !!parsers[format];
}

// :: (string, (Schema, any, ?Object) → Node)
// Register a parser function for `format`.
function defineSource(format, func) {
  parsers[format] = func;
}

defineSource("json", function (schema, json) {
  return schema.nodeFromJSON(json);
});
},{}],23:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.toDOM = toDOM;
exports.nodeToDOM = nodeToDOM;
exports.toHTML = toHTML;

var _model = require("../model");

var _register = require("./register");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; Object used to to expose relevant values and methods
// to DOM serializer functions.

var DOMSerializer = function () {
  function DOMSerializer(options) {
    _classCallCheck(this, DOMSerializer);

    // :: Object The options passed to the serializer.
    this.options = options || {};
    // :: DOMDocument The DOM document in which we are working.
    this.doc = this.options.document || window.document;
  }

  // :: (string, ?Object, ...union<string, DOMNode>) → DOMNode
  // Create a DOM node of the given type, with (optionally) the given
  // attributes and content. Content elements may be strings (for text
  // nodes) or other DOM nodes.


  _createClass(DOMSerializer, [{
    key: "elt",
    value: function elt(type, attrs) {
      var result = this.doc.createElement(type);
      if (attrs) for (var name in attrs) {
        if (name == "style") result.style.cssText = attrs[name];else if (attrs[name]) result.setAttribute(name, attrs[name]);
      }

      for (var _len = arguments.length, content = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        content[_key - 2] = arguments[_key];
      }

      for (var i = 0; i < content.length; i++) {
        result.appendChild(typeof content[i] == "string" ? this.doc.createTextNode(content[i]) : content[i]);
      }return result;
    }
  }, {
    key: "renderNode",
    value: function renderNode(node, offset) {
      var dom = node.type.serializeDOM(node, this);
      if (this.options.onRender) dom = this.options.onRender(node, dom, offset) || dom;
      return dom;
    }
  }, {
    key: "renderFragment",
    value: function renderFragment(fragment, where) {
      if (!where) where = this.doc.createDocumentFragment();
      if (fragment.size == 0) return where;

      if (!fragment.firstChild.isInline) this.renderBlocksInto(fragment, where);else if (this.options.renderInlineFlat) this.renderInlineFlatInto(fragment, where);else this.renderInlineInto(fragment, where);
      return where;
    }
  }, {
    key: "renderBlocksInto",
    value: function renderBlocksInto(fragment, where) {
      var _this = this;

      fragment.forEach(function (node, offset) {
        return where.appendChild(_this.renderNode(node, offset));
      });
    }
  }, {
    key: "renderInlineInto",
    value: function renderInlineInto(fragment, where) {
      var _this2 = this;

      var top = where;
      var active = [];
      fragment.forEach(function (node, offset) {
        var keep = 0;
        for (; keep < Math.min(active.length, node.marks.length); ++keep) {
          if (!node.marks[keep].eq(active[keep])) break;
        }while (keep < active.length) {
          active.pop();
          top = top.parentNode;
        }
        while (active.length < node.marks.length) {
          var add = node.marks[active.length];
          active.push(add);
          top = top.appendChild(_this2.renderMark(add));
        }
        top.appendChild(_this2.renderNode(node, offset));
      });
    }
  }, {
    key: "renderInlineFlatInto",
    value: function renderInlineFlatInto(fragment, where) {
      var _this3 = this;

      fragment.forEach(function (node, offset) {
        var dom = _this3.renderNode(node, offset);
        dom = _this3.wrapInlineFlat(dom, node.marks);
        dom = _this3.options.renderInlineFlat(node, dom, offset) || dom;
        where.appendChild(dom);
      });
    }
  }, {
    key: "renderMark",
    value: function renderMark(mark) {
      return mark.type.serializeDOM(mark, this);
    }
  }, {
    key: "wrapInlineFlat",
    value: function wrapInlineFlat(dom, marks) {
      for (var i = marks.length - 1; i >= 0; i--) {
        var wrap = this.renderMark(marks[i]);
        wrap.appendChild(dom);
        dom = wrap;
      }
      return dom;
    }

    // :: (Node, string, ?Object) → DOMNode
    // Render the content of ProseMirror node into a DOM node with the
    // given tag name and attributes.

  }, {
    key: "renderAs",
    value: function renderAs(node, tagName, tagAttrs) {
      if (this.options.preRenderContent) this.options.preRenderContent(node);

      var dom = this.renderFragment(node.content, this.elt(tagName, tagAttrs));
      if (this.options.onContainer) this.options.onContainer(dom);

      if (this.options.postRenderContent) this.options.postRenderContent(node);
      return dom;
    }
  }]);

  return DOMSerializer;
}();

// :: (union<Node, Fragment>, ?Object) → DOMFragment
// Serialize the given content to a DOM fragment. When not
// in the browser, the `document` option, containing a DOM document,
// should be passed so that the serialize can create nodes.
//
// To define rendering behavior for your own [node](#NodeType) and
// [mark](#MarkType) types, give them a `serializeDOM` method. This
// method is passed a `Node` and a `DOMSerializer`, and should return
// the [DOM
// node](https://developer.mozilla.org/en-US/docs/Web/API/Node) that
// represents this node and its content. For marks, that should be an
// inline wrapping node like `<a>` or `<strong>`.
//
// Individual attributes can also define serialization behavior. If an
// `Attribute` object has a `serializeDOM` method, that will be called
// with the DOM node representing the node that the attribute applies
// to and the atttribute's value, so that it can set additional DOM
// attributes on the DOM node.


function toDOM(content, options) {
  return new DOMSerializer(options).renderFragment(content instanceof _model.Node ? content.content : content);
}

(0, _register.defineTarget)("dom", toDOM);

// :: (Node, ?Object) → DOMNode
// Serialize a given node to a DOM node. This is useful when you need
// to serialize a part of a document, as opposed to the whole
// document.
function nodeToDOM(node, options, offset) {
  var serializer = new DOMSerializer(options);
  var dom = serializer.renderNode(node, offset);
  if (node.isInline) {
    dom = serializer.wrapInlineFlat(dom, node.marks);
    if (serializer.options.renderInlineFlat) dom = options.renderInlineFlat(node, dom, offset) || dom;
  }
  return dom;
}

// :: (union<Node, Fragment>, ?Object) → string
// Serialize a node as an HTML string. Goes through `toDOM` and then
// serializes the result. Again, you must pass a `document` option
// when not in the browser.
function toHTML(content, options) {
  var serializer = new DOMSerializer(options);
  var wrap = serializer.elt("div");
  wrap.appendChild(serializer.renderFragment(content instanceof _model.Node ? content.content : content));
  return wrap.innerHTML;
}

(0, _register.defineTarget)("html", toHTML);

// Block nodes

function def(cls, method) {
  cls.prototype.serializeDOM = method;
}

def(_model.BlockQuote, function (node, s) {
  return s.renderAs(node, "blockquote");
});

_model.BlockQuote.prototype.countCoordsAsChild = function (_, pos, dom, coords) {
  var childBox = dom.firstChild.getBoundingClientRect();
  if (coords.left < childBox.left - 2) return pos;
};

def(_model.BulletList, function (node, s) {
  return s.renderAs(node, "ul");
});

def(_model.OrderedList, function (node, s) {
  return s.renderAs(node, "ol", { start: node.attrs.order != "1" && node.attrs.order });
});

_model.OrderedList.prototype.countCoordsAsChild = _model.BulletList.prototype.countCoordsAsChild = function (_, pos, dom, coords) {
  for (var child = dom.firstChild; child; child = child.nextSibling) {
    var off = child.getAttribute("pm-offset");
    if (!off) continue;
    var childBox = child.getBoundingClientRect();
    if (coords.left > childBox.left - 2) return null;
    if (childBox.top <= coords.top && childBox.bottom >= coords.top) return pos + 1 + +off;
  }
};

def(_model.ListItem, function (node, s) {
  return s.renderAs(node, "li");
});

def(_model.HorizontalRule, function (_, s) {
  return s.elt("div", null, s.elt("hr"));
});

def(_model.Paragraph, function (node, s) {
  return s.renderAs(node, "p");
});

def(_model.Heading, function (node, s) {
  return s.renderAs(node, "h" + node.attrs.level);
});

def(_model.CodeBlock, function (node, s) {
  var code = s.renderAs(node, "code");
  if (node.attrs.params != null) code.className = "fence " + node.attrs.params.replace(/(^|\s+)/g, "$&lang-");
  return s.elt("pre", null, code);
});

// Inline content

def(_model.Text, function (node, s) {
  return s.doc.createTextNode(node.text);
});

def(_model.Image, function (node, s) {
  return s.elt("img", {
    src: node.attrs.src,
    alt: node.attrs.alt,
    title: node.attrs.title
  });
});

def(_model.HardBreak, function (_, s) {
  return s.elt("br");
});

// Inline styles

def(_model.EmMark, function (_, s) {
  return s.elt("em");
});

def(_model.StrongMark, function (_, s) {
  return s.elt("strong");
});

def(_model.CodeMark, function (_, s) {
  return s.elt("code");
});

def(_model.LinkMark, function (mark, s) {
  return s.elt("a", { href: mark.attrs.href,
    title: mark.attrs.title });
});
},{"../model":33,"./register":22}],24:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.toText = toText;

var _model = require("../model");

var _register = require("./register");

function serializeFragment(fragment) {
  var accum = "";
  fragment.forEach(function (child) {
    return accum += child.type.serializeText(child);
  });
  return accum;
}

_model.Block.prototype.serializeText = function (node) {
  return serializeFragment(node.content);
};

_model.Textblock.prototype.serializeText = function (node) {
  var text = _model.Block.prototype.serializeText(node);
  return text && text + "\n\n";
};

_model.Inline.prototype.serializeText = function () {
  return "";
};

_model.HardBreak.prototype.serializeText = function () {
  return "\n";
};

_model.Text.prototype.serializeText = function (node) {
  return node.text;
};

// :: (union<Node, Fragment>) → string
// Serialize content as a plain text string.
function toText(content) {
  return serializeFragment(content).trim();
}

(0, _register.defineTarget)("text", toText);
},{"../model":33,"./register":22}],25:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.fromMarkdown = fromMarkdown;

var _markdownIt = require("markdown-it");

var _markdownIt2 = _interopRequireDefault(_markdownIt);

var _model = require("../model");

var _format = require("../format");

var _sortedinsert = require("../util/sortedinsert");

var _sortedinsert2 = _interopRequireDefault(_sortedinsert);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// :: (Schema, string, ?Object) → Node
// Parse a string as [CommonMark](http://commonmark.org/) markup, and
// create a ProseMirror document corresponding to its meaning. Note
// that, by default, some CommonMark features, namely inline HTML and
// tight lists, are not supported.
function fromMarkdown(schema, text, options) {
  var tokens = configureMarkdown(schema).parse(text, {});
  var state = new MarkdownParseState(schema, tokens, options),
      doc = undefined;
  state.parseTokens(tokens);
  do {
    doc = state.closeNode();
  } while (state.stack.length);
  return doc;
}

// ;; #kind=interface #path=MarkdownParseSpec
// Schema-specific parsing logic can be defined
// [registering](#SchemaItem.register) values with parsing information
// on [mark](#MarkType) and [node](#NodeType) types, using the
// `"parseMarkdown"` namespace.
//
// The name of the registered item should be the
// [markdown-it](https://github.com/markdown-it/markdown-it) token
// name that the parser should respond to,
//
// To influence the way the markdown-it parser is initialized and
// configured, you can register values under the `"configureMarkdown"`
// namespace. An item with the name `"init"` will be called to
// initialize the parser. Items with other names will be called with a
// parser and should return a parser. You could for example configure
// a subscript mark to enable the [subscript
// plugin](https://github.com/markdown-it/markdown-it-sub):
//
//     SubMark.register("configureMarkdown", "sub", parser => {
//       return parser.use(require("markdown-it-sub"))
//     })

// FIXME give registerable things their own top-level reference guide entries?

// :: union<string, (state: MarkdownParseState, token: MarkdownToken) → Node> #path=MarkdownParseSpec.parse
// The parsing function for this token. It is, when a matching token
// is encountered, passed the parsing state and the token, and must
// return a `Node` if the parsing spec was for a node type, and a
// `Mark` if it was for a mark type.
//
// The function will be called so that `this` is bound to the node or
// mark type instance that the spec was associated with.
//
// As a shorthand, `parse` can be set to a string. You can use
// `"block"` to create a node of the type that this spec was
// associated with, and wrap the content between the open and close
// tokens in this node.
//
// Alternatively, it can be set to `"mark"`, if the spec is associated
// with a [mark type](#MarkType), which will cause the content between
// the opening and closing token to be marked with an instance of that
// mark type.

// :: ?union<Object, (MarkdownParseState, MarkdownToken) → Object> #path=MarkdownParseSpec.attrs
// When `parse` is set to a string, this property can be used to
// specify attributes for the node or mark. It may hold an object or a
// function that, when called with the [parser
// state](#MarkdownParseState) and the token object, returns an
// attribute object.

(0, _format.defineSource)("markdown", fromMarkdown);

var noMarks = [];

function maybeMerge(a, b) {
  if (a.isText && b.isText && _model.Mark.sameSet(a.marks, b.marks)) return a.copy(a.text + b.text);
}

// ;; Object used to track the context of a running parse,
// and to expose parsing-related methods to node-specific parsing
// functions.

var MarkdownParseState = function () {
  function MarkdownParseState(schema, tokens, options) {
    _classCallCheck(this, MarkdownParseState);

    // :: Schema
    // The schema into which we are parsing.
    this.schema = schema;
    this.stack = [{ type: schema.nodes.doc, content: [] }];
    this.tokens = tokens;
    this.marks = noMarks;
    this.tokenTypes = tokenTypeInfo(schema);
    // :: Object
    // The options passed to the parser.
    this.options = options;
  }

  _createClass(MarkdownParseState, [{
    key: "top",
    value: function top() {
      return this.stack[this.stack.length - 1];
    }
  }, {
    key: "push",
    value: function push(elt) {
      if (this.stack.length) this.top().content.push(elt);
    }

    // :: (string)
    // Adds the given text to the current position in the document,
    // using the current marks as styling.

  }, {
    key: "addText",
    value: function addText(text) {
      var nodes = this.top().content,
          last = nodes[nodes.length - 1];
      var node = this.schema.text(text, this.marks),
          merged = undefined;
      if (last && (merged = maybeMerge(last, node))) nodes[nodes.length - 1] = merged;else nodes.push(node);
    }

    // :: (Mark)
    // Adds the given mark to the set of active marks.

  }, {
    key: "openMark",
    value: function openMark(mark) {
      this.marks = mark.addToSet(this.marks);
    }

    // :: (Mark)
    // Removes the given mark from the set of active marks.

  }, {
    key: "closeMark",
    value: function closeMark(mark) {
      this.marks = mark.removeFromSet(this.marks);
    }
  }, {
    key: "parseTokens",
    value: function parseTokens(toks) {
      for (var i = 0; i < toks.length; i++) {
        var tok = toks[i];
        var tokenType = this.tokenTypes[tok.type];
        if (!tokenType) throw new Error("Token type `" + tok.type + "` not supported by Markdown parser");

        tokenType(this, tok);
      }
    }

    // :: (NodeType, ?Object, ?[Node]) → ?Node
    // Add a node at the current position.

  }, {
    key: "addNode",
    value: function addNode(type, attrs, content) {
      content = _model.Fragment.from(content);
      if (!type.checkContent(content, attrs)) {
        content = type.fixContent(content, attrs);
        if (!content) return null;
      }
      var node = type.create(attrs, content, this.marks);
      this.push(node);
      return node;
    }

    // :: (NodeType, ?Object)
    // Wrap subsequent content in a node of the given type.

  }, {
    key: "openNode",
    value: function openNode(type, attrs) {
      this.stack.push({ type: type, attrs: attrs, content: [] });
    }

    // :: () → ?Node
    // Close and return the node that is currently on top of the stack.

  }, {
    key: "closeNode",
    value: function closeNode() {
      if (this.marks.length) this.marks = noMarks;
      var info = this.stack.pop();
      return this.addNode(info.type, info.attrs, info.content);
    }

    // :: (MarkdownToken, string) → any
    // Retrieve the named attribute from the given token.

  }, {
    key: "getAttr",
    value: function getAttr(tok, name) {
      if (tok.attrs) for (var i = 0; i < tok.attrs.length; i++) {
        if (tok.attrs[i][0] == name) return tok.attrs[i][1];
      }
    }
  }]);

  return MarkdownParseState;
}();

function tokenTypeInfo(schema) {
  return schema.cached.markdownTokens || (schema.cached.markdownTokens = summarizeTokens(schema));
}

function registerTokens(tokens, name, type, info) {
  if (info.parse == "block") {
    tokens[name + "_open"] = function (state, tok) {
      var attrs = typeof info.attrs == "function" ? info.attrs.call(type, state, tok) : info.attrs;
      state.openNode(type, attrs);
    };
    tokens[name + "_close"] = function (state) {
      return state.closeNode();
    };
  } else if (info.parse == "mark") {
    tokens[name + "_open"] = function (state, tok) {
      var attrs = info.attrs instanceof Function ? info.attrs.call(type, state, tok) : info.attrs;
      state.openMark(type.create(attrs));
    };
    tokens[name + "_close"] = function (state) {
      return state.closeMark(type);
    };
  } else if (info.parse) {
    tokens[name] = info.parse.bind(type);
  } else {
    throw new RangeError("Unrecognized markdown parsing spec: " + info);
  }
}

function summarizeTokens(schema) {
  var tokens = Object.create(null);
  tokens.text = function (state, tok) {
    return state.addText(tok.content);
  };
  tokens.inline = function (state, tok) {
    return state.parseTokens(tok.children);
  };
  tokens.softbreak = function (state) {
    return state.addText("\n");
  };

  schema.registry("parseMarkdown", function (name, info, type) {
    registerTokens(tokens, name, type, info);
  });
  return tokens;
}

function configFromSchema(schema) {
  var found = schema.cached.markdownConfig;
  if (!found) {
    (function () {
      var init = null;
      var modifiers = [];
      schema.registry("configureMarkdown", function (name, f) {
        if (name == "init") {
          if (init) throw new RangeError("Two markdown parser initializers defined in schema");
          init = f;
        } else {
          var rank = (/_(\d+)$/.exec(name) || [0, 50])[1];
          (0, _sortedinsert2.default)(modifiers, { f: f, rank: rank }, function (a, b) {
            return a.rank - b.rank;
          });
        }
      });
      found = { init: init || function () {
          return (0, _markdownIt2.default)("commonmark", { html: false });
        }, modifiers: modifiers.map(function (spec) {
          return spec.f;
        }) };
    })();
  }
  return found;
}

function configureMarkdown(schema) {
  var config = configFromSchema(schema);
  var module = config.init();
  config.modifiers.forEach(function (f) {
    return module = f(module);
  });
  return module;
}

_model.BlockQuote.register("parseMarkdown", "blockquote", { parse: "block" });

_model.Paragraph.register("parseMarkdown", "paragraph", { parse: "block" });

_model.ListItem.register("parseMarkdown", "list_item", { parse: "block" });

_model.BulletList.register("parseMarkdown", "bullet_list", { parse: "block" });

_model.OrderedList.register("parseMarkdown", "ordered_list", { parse: "block", attrs: function attrs(state, tok) {
    return {
      order: state.getAttr(tok, "order") || "1"
    };
  } });

_model.Heading.register("parseMarkdown", "heading", { parse: "block", attrs: function attrs(_, tok) {
    return { level: "" + Math.min(this.maxLevel, +tok.tag.slice(1)) };
  } });

function trimTrailingNewline(str) {
  if (str.charAt(str.length - 1) == "\n") return str.slice(0, str.length - 1);
  return str;
}

function parseCodeBlock(state, tok) {
  state.openNode(this);
  state.addText(trimTrailingNewline(tok.content));
  state.closeNode();
}

_model.CodeBlock.register("parseMarkdown", "code_block", { parse: parseCodeBlock });
_model.CodeBlock.register("parseMarkdown", "fence", { parse: parseCodeBlock });

_model.HorizontalRule.register("parseMarkdown", "hr", { parse: function parse(state, tok) {
    state.addNode(this, { markup: tok.markup });
  } });

_model.Image.register("parseMarkdown", "image", { parse: function parse(state, tok) {
    state.addNode(this, { src: state.getAttr(tok, "src"),
      title: state.getAttr(tok, "title") || null,
      alt: tok.children[0] && tok.children[0].content || null });
  } });

_model.HardBreak.register("parseMarkdown", "hardbreak", { parse: function parse(state) {
    state.addNode(this);
  } });

// Inline marks

_model.EmMark.register("parseMarkdown", "em", { parse: "mark" });

_model.StrongMark.register("parseMarkdown", "strong", { parse: "mark" });

_model.LinkMark.register("parseMarkdown", "link", {
  parse: "mark",
  attrs: function attrs(state, tok) {
    return {
      href: state.getAttr(tok, "href"),
      title: state.getAttr(tok, "title") || null
    };
  }
});

_model.CodeMark.register("parseMarkdown", "code_inline", { parse: function parse(state, tok) {
    state.openMark(this.create());
    state.addText(tok.content);
    state.closeMark(this);
  } });
},{"../format":21,"../model":33,"../util/sortedinsert":54,"markdown-it":56}],26:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.toMarkdown = toMarkdown;

var _model = require("../model");

var _format = require("../format");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// :: (Node, ?Object) → string
// Serialize the content of the given node to [CommonMark](http://commonmark.org/).
//
// To define serialization behavior for your own [node
// types](#NodeType), give them a `serializeMarkDown` method. It will
// be called with a `MarkdownSerializer` and a `Node`, and should
// update the serializer's state to add the content of the node.
//
// [Mark types](#MarkType) can define `openMarkdown` and
// `closeMarkdown` properties, which provide the markup text that
// marked content should be wrapped in. They may hold either a string
// or a function from a `MarkdownSerializer` and a `Mark` to a string.
function toMarkdown(doc, options) {
  var state = new MarkdownSerializer(options);
  state.renderContent(doc);
  return state.out;
}

(0, _format.defineTarget)("markdown", toMarkdown);

// ;; This is an object used to track state and expose
// methods related to markdown serialization. Instances are passed to
// node and mark serialization methods (see `toMarkdown`).

var MarkdownSerializer = function () {
  function MarkdownSerializer(options) {
    _classCallCheck(this, MarkdownSerializer);

    this.delim = this.out = "";
    this.closed = false;
    this.inTightList = false;
    // :: Object
    // The options passed to the serializer.
    this.options = options;
  }

  _createClass(MarkdownSerializer, [{
    key: "flushClose",
    value: function flushClose(size) {
      if (this.closed) {
        if (!this.atBlank()) this.out += "\n";
        if (size == null) size = 2;
        if (size > 1) {
          var delimMin = this.delim;
          var trim = /\s+$/.exec(delimMin);
          if (trim) delimMin = delimMin.slice(0, delimMin.length - trim[0].length);
          for (var i = 1; i < size; i++) {
            this.out += delimMin + "\n";
          }
        }
        this.closed = false;
      }
    }

    // :: (string, ?string, Node, ())
    // Render a block, prefixing each line with `delim`, and the first
    // line in `firstDelim`. `node` should be the node that is closed at
    // the end of the block, and `f` is a function that renders the
    // content of the block.

  }, {
    key: "wrapBlock",
    value: function wrapBlock(delim, firstDelim, node, f) {
      var old = this.delim;
      this.write(firstDelim || delim);
      this.delim += delim;
      f();
      this.delim = old;
      this.closeBlock(node);
    }
  }, {
    key: "atBlank",
    value: function atBlank() {
      return (/(^|\n)$/.test(this.out)
      );
    }

    // :: ()
    // Ensure the current content ends with a newline.

  }, {
    key: "ensureNewLine",
    value: function ensureNewLine() {
      if (!this.atBlank()) this.out += "\n";
    }

    // :: (?string)
    // Prepare the state for writing output (closing closed paragraphs,
    // adding delimiters, and so on), and then optionally add content
    // (unescaped) to the output.

  }, {
    key: "write",
    value: function write(content) {
      this.flushClose();
      if (this.delim && this.atBlank()) this.out += this.delim;
      if (content) this.out += content;
    }

    // :: (Node)
    // Close the block for the given node.

  }, {
    key: "closeBlock",
    value: function closeBlock(node) {
      this.closed = node;
    }

    // :: (string, ?bool)
    // Add the given text to the document. When escape is not `false`,
    // it will be escaped.

  }, {
    key: "text",
    value: function text(_text, escape) {
      var lines = _text.split("\n");
      for (var i = 0; i < lines.length; i++) {
        var startOfLine = this.atBlank() || this.closed;
        this.write();
        this.out += escape !== false ? this.esc(lines[i], startOfLine) : lines[i];
        if (i != lines.length - 1) this.out += "\n";
      }
    }

    // :: (Node)
    // Render the given node as a block.

  }, {
    key: "render",
    value: function render(node) {
      node.type.serializeMarkdown(this, node);
    }

    // :: (Node)
    // Render the contents of `parent` as block nodes.

  }, {
    key: "renderContent",
    value: function renderContent(parent) {
      var _this = this;

      parent.forEach(function (child) {
        return _this.render(child);
      });
    }

    // :: (Node)
    // Render the contents of `parent` as inline content.

  }, {
    key: "renderInline",
    value: function renderInline(parent) {
      var _this2 = this;

      var active = [];
      var progress = function progress(node) {
        var marks = node ? node.marks : [];
        var code = marks.length && marks[marks.length - 1].type.isCode && marks[marks.length - 1];
        var len = marks.length - (code ? 1 : 0);

        // Try to reorder 'mixable' marks, such as em and strong, which
        // in Markdown may be opened and closed in different order, so
        // that order of the marks for the token matches the order in
        // active.
        outer: for (var i = 0; i < len; i++) {
          var mark = marks[i];
          if (!mark.type.markdownMixable) break;
          for (var j = 0; j < active.length; j++) {
            var other = active[j];
            if (!other.type.markdownMixable) break;
            if (mark.eq(other)) {
              if (i > j) marks = marks.slice(0, j).concat(mark).concat(marks.slice(j, i)).concat(marks.slice(i + 1), len);else if (j > i) marks = marks.slice(0, i).concat(marks.slice(i + 1, j)).concat(mark).concat(marks.slice(j, len));
              continue outer;
            }
          }
        }

        // Find the prefix of the mark set that didn't change
        var keep = 0;
        while (keep < Math.min(active.length, len) && marks[keep].eq(active[keep])) {
          ++keep;
        } // Close the marks that need to be closed
        while (keep < active.length) {
          _this2.text(_this2.markString(active.pop(), false), false);
        } // Open the marks that need to be opened
        while (active.length < len) {
          var add = marks[active.length];
          active.push(add);
          _this2.text(_this2.markString(add, true), false);
        }

        // Render the node. Special case code marks, since their content
        // may not be escaped.
        if (node) {
          if (code && node.isText) _this2.text(_this2.markString(code, false) + node.text + _this2.markString(code, true), false);else _this2.render(node);
        }
      };
      parent.forEach(progress);
      progress(null);
    }
  }, {
    key: "renderList",
    value: function renderList(node, delim, firstDelim) {
      var _this3 = this;

      if (this.closed && this.closed.type == node.type) this.flushClose(3);else if (this.inTightList) this.flushClose(1);

      var prevTight = this.inTightList;
      this.inTightList = node.attrs.tight;

      var _loop = function _loop(i) {
        if (i && node.attrs.tight) _this3.flushClose(1);
        _this3.wrapBlock(delim, firstDelim(i), node, function () {
          return _this3.render(node.child(i));
        });
      };

      for (var i = 0; i < node.childCount; i++) {
        _loop(i);
      }
      this.inTightList = prevTight;
    }

    // :: (string, ?bool) → string
    // Escape the given string so that it can safely appear in Markdown
    // content. If `startOfLine` is true, also escape characters that
    // has special meaning only at the start of the line.

  }, {
    key: "esc",
    value: function esc(str, startOfLine) {
      str = str.replace(/[`*\\~+\[\]]/g, "\\$&");
      if (startOfLine) str = str.replace(/^[:#-]/, "\\$&");
      return str;
    }
  }, {
    key: "quote",
    value: function quote(str) {
      var wrap = str.indexOf('"') == -1 ? '""' : str.indexOf("'") == -1 ? "''" : "()";
      return wrap[0] + str + wrap[1];
    }

    // :: (string, number) → string
    // Repeat the given string `n` times.

  }, {
    key: "repeat",
    value: function repeat(str, n) {
      var out = "";
      for (var i = 0; i < n; i++) {
        out += str;
      }return out;
    }

    // : (Mark, bool) → string
    // Get the markdown string for a given opening or closing mark.

  }, {
    key: "markString",
    value: function markString(mark, open) {
      var value = open ? mark.type.openMarkdown : mark.type.closeMarkdown;
      return typeof value == "string" ? value : value(this, mark);
    }
  }]);

  return MarkdownSerializer;
}();

function def(cls, method) {
  cls.prototype.serializeMarkdown = method;
}

def(_model.BlockQuote, function (state, node) {
  state.wrapBlock("> ", null, node, function () {
    return state.renderContent(node);
  });
});

def(_model.CodeBlock, function (state, node) {
  if (node.attrs.params == null) {
    state.wrapBlock("    ", null, node, function () {
      return state.text(node.textContent, false);
    });
  } else {
    state.write("```" + node.attrs.params + "\n");
    state.text(node.textContent, false);
    state.ensureNewLine();
    state.write("```");
    state.closeBlock(node);
  }
});

def(_model.Heading, function (state, node) {
  state.write(state.repeat("#", node.attrs.level) + " ");
  state.renderInline(node);
  state.closeBlock(node);
});

def(_model.HorizontalRule, function (state, node) {
  state.write(node.attrs.markup || "---");
  state.closeBlock(node);
});

def(_model.BulletList, function (state, node) {
  state.renderList(node, "  ", function () {
    return (node.attrs.bullet || "*") + " ";
  });
});

def(_model.OrderedList, function (state, node) {
  var start = Number(node.attrs.order || 1);
  var maxW = String(start + node.childCount - 1).length;
  var space = state.repeat(" ", maxW + 2);
  state.renderList(node, space, function (i) {
    var nStr = String(start + i);
    return state.repeat(" ", maxW - nStr.length) + nStr + ". ";
  });
});

def(_model.ListItem, function (state, node) {
  return state.renderContent(node);
});

def(_model.Paragraph, function (state, node) {
  state.renderInline(node);
  state.closeBlock(node);
});

// Inline nodes

def(_model.Image, function (state, node) {
  state.write("![" + state.esc(node.attrs.alt || "") + "](" + state.esc(node.attrs.src) + (node.attrs.title ? " " + state.quote(node.attrs.title) : "") + ")");
});

def(_model.HardBreak, function (state) {
  return state.write("\\\n");
});

def(_model.Text, function (state, node) {
  return state.text(node.text);
});

// Marks

_model.EmMark.prototype.openMarkdown = _model.EmMark.prototype.closeMarkdown = "*";
_model.EmMark.prototype.markdownMixable = true;

_model.StrongMark.prototype.openMarkdown = _model.StrongMark.prototype.closeMarkdown = "**";
_model.StrongMark.prototype.markdownMixable = true;

_model.LinkMark.prototype.openMarkdown = "[";
_model.LinkMark.prototype.closeMarkdown = function (state, mark) {
  return "](" + state.esc(mark.attrs.href) + (mark.attrs.title ? " " + state.quote(mark.attrs.title) : "") + ")";
};

_model.CodeMark.prototype.openMarkdown = _model.CodeMark.prototype.closeMarkdown = "`";
},{"../format":21,"../model":33}],27:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getIcon = getIcon;

var _dom = require("../dom");

var svgCollection = null;
var svgBuilt = Object.create(null);

var SVG = "http://www.w3.org/2000/svg";
var XLINK = "http://www.w3.org/1999/xlink";

var prefix = "ProseMirror-icon";

function getIcon(name, data) {
  var node = document.createElement("div");
  node.className = prefix;
  if (data.path) {
    if (!svgBuilt[name]) buildSVG(name, data);
    var svg = node.appendChild(document.createElementNS(SVG, "svg"));
    svg.style.width = data.width / data.height + "em";
    var use = svg.appendChild(document.createElementNS(SVG, "use"));
    use.setAttributeNS(XLINK, "href", /([^#]*)/.exec(document.location)[1] + "#pm-icon-" + name);
  } else if (data.dom) {
    node.appendChild(data.dom.cloneNode(true));
  } else {
    node.appendChild(document.createElement("span")).textContent = data.text || '';
    if (data.style) node.firstChild.style.cssText = data.style;
  }
  return node;
}

function buildSVG(name, data) {
  if (!svgCollection) {
    svgCollection = document.createElementNS(SVG, "svg");
    svgCollection.style.display = "none";
    document.body.insertBefore(svgCollection, document.body.firstChild);
  }
  var sym = document.createElementNS(SVG, "symbol");
  sym.id = "pm-icon-" + name;
  sym.setAttribute("viewBox", "0 0 " + data.width + " " + data.height);
  var path = sym.appendChild(document.createElementNS(SVG, "path"));
  path.setAttribute("d", data.path);
  svgCollection.appendChild(sym);
  svgBuilt[name] = true;
}

(0, _dom.insertCSS)("\n." + prefix + " {\n  display: inline-block;\n  line-height: .8;\n  vertical-align: -2px; /* Compensate for padding */\n  padding: 2px 8px;\n  cursor: pointer;\n}\n\n." + prefix + " svg {\n  fill: currentColor;\n  height: 1em;\n}\n\n." + prefix + " span {\n  vertical-align: text-top;\n}");
},{"../dom":1}],28:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.historyGroup = exports.blockGroup = exports.textblockMenu = exports.insertMenu = exports.inlineGroup = exports.DropdownSubmenu = exports.Dropdown = exports.MenuCommandGroup = exports.MenuCommand = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.resolveGroup = resolveGroup;
exports.renderGrouped = renderGrouped;

var _dom = require("../dom");

var _sortedinsert = require("../util/sortedinsert");

var _sortedinsert2 = _interopRequireDefault(_sortedinsert);

var _obj = require("../util/obj");

var _icons = require("./icons");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// !! This module defines a number of building blocks for ProseMirror
// menus, as consumed by the [`menubar`](#menu/menubar) and
// [`tooltipmenu`](#menu/tooltipmenu) modules.

// ;; #path=MenuElement #kind=interface
// The types defined in this module aren't the only thing you can
// display in your menu. Anything that conforms to this interface can
// be put into a menu structure.

// :: (pm: ProseMirror) → ?DOMNode #path=MenuElement.render
// Render the element for display in the menu. Returning `null` can be
// used to signal that this element shouldn't be displayed for the
// given editor state.

// ;; #path=MenuGroup #kind=interface
// A menu group represents a group of things that may appear in a
// menu. It may be either a `MenuElement`, a `MenuCommandGroup`, or an
// array of such values. Can be reduced to an array of `MenuElement`s
// using `resolveGroup`.

var prefix = "ProseMirror-menu";

function title(pm, command) {
  if (!command.label) return null;
  var label = pm.translate(command.label);
  var key = command.name && pm.keyForCommand(command.name);
  return key ? label + " (" + key + ")" : label;
}

// ;; Wraps a [command](#Command) so that it can be rendered in a
// menu.

var MenuCommand = exports.MenuCommand = function () {
  // :: (union<Command, string>, MenuCommandSpec)

  function MenuCommand(command, options) {
    _classCallCheck(this, MenuCommand);

    this.command_ = command;
    this.options = options;
  }

  // :: (ProseMirror) → Command
  // Retrieve the command associated with this object.


  _createClass(MenuCommand, [{
    key: "command",
    value: function command(pm) {
      return typeof this.command_ == "string" ? pm.commands[this.command_] : this.command_;
    }
  }, {
    key: "render",


    // :: (ProseMirror) → DOMNode
    // Renders the command according to its [display
    // spec](#MenuCommandSpec.display), and adds an event handler which
    // executes the command when the representation is clicked.
    value: function render(pm) {
      var cmd = this.command(pm),
          disabled = false;
      if (!cmd) return;
      if (this.options.select != "ignore" && !cmd.select(pm)) {
        if (this.options.select == null || this.options.select == "hide") return null;else if (this.options.select == "disable") disabled = true;
      }

      var disp = this.options.display;
      if (!disp) throw new RangeError("No display style defined for menu command " + cmd.name);

      var dom = undefined;
      if (disp.render) {
        dom = disp.render(cmd, pm);
      } else if (disp.type == "icon") {
        dom = (0, _icons.getIcon)(cmd.name, disp);
        if (!disabled && cmd.active(pm)) dom.classList.add(prefix + "-active");
      } else if (disp.type == "label") {
        var label = pm.translate(disp.label || cmd.spec.label);
        dom = (0, _dom.elt)("div", null, label);
      } else {
        throw new RangeError("Unsupported command display style: " + disp.type);
      }
      dom.setAttribute("title", title(pm, cmd));
      if (this.options.class) dom.classList.add(this.options.class);
      if (disabled) dom.classList.add(prefix + "-disabled");
      if (this.options.css) dom.style.cssText += this.options.css;
      dom.addEventListener("mousedown", function (e) {
        e.preventDefault();e.stopPropagation();
        pm.signal("interaction");
        cmd.exec(pm, null, dom);
      });
      dom.setAttribute("data-command", this.commandName);
      return dom;
    }
  }, {
    key: "commandName",
    get: function get() {
      return typeof this.command_ === "string" ? this.command_.command : this.command_.name;
    }
  }]);

  return MenuCommand;
}();

// ;; Represents a [group](#MenuCommandSpec.group) of commands, as
// they appear in the editor's schema.


var MenuCommandGroup = exports.MenuCommandGroup = function () {
  // :: (string, ?MenuCommandSpec)
  // Create a group for the given group name, optionally adding or
  // overriding fields in the commands' [specs](#MenuCommandSpec).

  function MenuCommandGroup(name, options) {
    _classCallCheck(this, MenuCommandGroup);

    this.name = name;
    this.options = options;
  }

  _createClass(MenuCommandGroup, [{
    key: "collect",
    value: function collect(pm) {
      var _this = this;

      var result = [];
      for (var name in pm.commands) {
        var cmd = pm.commands[name],
            spec = cmd.spec.menu;
        if (spec && spec.group == this.name) (0, _sortedinsert2.default)(result, { cmd: cmd, rank: spec.rank == null ? 50 : spec.rank }, function (a, b) {
          return a.rank - b.rank;
        });
      }
      return result.map(function (o) {
        var spec = o.cmd.spec.menu;
        if (_this.options) spec = (0, _obj.copyObj)(_this.options, (0, _obj.copyObj)(spec));
        return new MenuCommand(o.cmd, spec);
      });
    }

    // :: (ProseMirror) → [MenuCommand]
    // Get the group of matching commands in the given editor.

  }, {
    key: "get",
    value: function get(pm) {
      var groups = pm.mod.menuGroups || this.startGroups(pm);
      return groups[this.name] || (groups[this.name] = this.collect(pm));
    }
  }, {
    key: "startGroups",
    value: function startGroups(pm) {
      var clear = function clear() {
        pm.mod.menuGroups = null;
        pm.off("commandsChanging", clear);
      };
      pm.on("commandsChanging", clear);
      return pm.mod.menuGroups = Object.create(null);
    }
  }]);

  return MenuCommandGroup;
}();

// ;; A drop-down menu, displayed as a label with a downwards-pointing
// triangle to the right of it.


var Dropdown = exports.Dropdown = function () {
  // :: (Object, MenuGroup)
  // Create a dropdown wrapping the given group. Options may include
  // the following properties:
  //
  // **`label`**`: string`
  //   : The label to show on the drop-down control. When
  //     `activeLabel` is also given, this one is used as a
  //     fallback.
  //
  // **`activeLabel`**`: bool`
  //   : Instead of showing a fixed label, enabling this causes the
  //     element to search through its content, looking for an
  //     [active](#CommandSpec.active) command. If one is found, its
  //     [`activeLabel`](#MenuCommandSpec.activeLabel) property is
  //     shown as the drop-down's label.
  //
  // **`title`**`: string`
  //   : Sets the
  //     [`title`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title)
  //     attribute given to the menu control.
  //
  // **`class`**`: string`
  //   : When given, adds an extra CSS class to the menu control.

  function Dropdown(options, content) {
    _classCallCheck(this, Dropdown);

    this.options = options || {};
    this.content = content;
  }

  // :: (ProseMirror) → DOMNode
  // Returns a node showing the collapsed menu, which expands when clicked.


  _createClass(Dropdown, [{
    key: "render",
    value: function render(pm) {
      var _this2 = this;

      var items = renderDropdownItems(resolveGroup(pm, this.content), pm);
      if (!items.length) return;

      var label = this.options.activeLabel && this.findActiveIn(this, pm) || this.options.label;
      label = pm.translate(label);
      var dom = (0, _dom.elt)("div", { class: prefix + "-dropdown " + (this.options.class || ""),
        style: this.options.css,
        title: this.options.title }, label);
      var open = null;
      dom.addEventListener("mousedown", function (e) {
        e.preventDefault();e.stopPropagation();
        if (open && open()) open = null;else open = _this2.expand(pm, dom, items);
      });
      return dom;
    }
  }, {
    key: "select",
    value: function select(pm) {
      return resolveGroup(pm, this.content).some(function (e) {
        return e.select(pm);
      });
    }
  }, {
    key: "expand",
    value: function expand(pm, dom, items) {
      var box = dom.getBoundingClientRect(),
          outer = pm.wrapper.getBoundingClientRect();
      var menuDOM = (0, _dom.elt)("div", { class: prefix + "-dropdown-menu " + (this.options.class || ""),
        style: "left: " + (box.left - outer.left) + "px; top: " + (box.bottom - outer.top) + "px" }, items);

      var done = false;
      function finish() {
        if (done) return;
        done = true;
        pm.off("interaction", finish);
        pm.wrapper.removeChild(menuDOM);
        return true;
      }
      pm.signal("interaction");
      pm.wrapper.appendChild(menuDOM);
      pm.on("interaction", finish);
      return finish;
    }
  }, {
    key: "findActiveIn",
    value: function findActiveIn(element, pm) {
      var items = resolveGroup(pm, element.content);
      for (var i = 0; i < items.length; i++) {
        var cur = items[i];
        if (cur instanceof MenuCommand) {
          var active = cur.command(pm).active(pm);
          if (active) return cur.options.activeLabel;
        } else if (cur instanceof DropdownSubmenu) {
          var found = this.findActiveIn(cur, pm);
          if (found) return found;
        }
      }
    }
  }]);

  return Dropdown;
}();

function renderDropdownItems(items, pm) {
  var rendered = [];
  for (var i = 0; i < items.length; i++) {
    var inner = items[i].render(pm);
    if (inner) rendered.push((0, _dom.elt)("div", { class: prefix + "-dropdown-item" }, inner));
  }
  return rendered;
}

// ;; Represents a submenu wrapping a group of items that start hidden
// and expand to the right when hovered over or tapped.

var DropdownSubmenu = exports.DropdownSubmenu = function () {
  // :: (Object, MenuGroup)
  // Creates a submenu for the given group of menu elements. The
  // following options are recognized:
  //
  // **`label`**`: string`
  //   : The label to show on the submenu.

  function DropdownSubmenu(options, content) {
    _classCallCheck(this, DropdownSubmenu);

    this.options = options || {};
    this.content = content;
  }

  // :: (ProseMirror) → DOMNode
  // Renders the submenu.


  _createClass(DropdownSubmenu, [{
    key: "render",
    value: function render(pm) {
      var items = renderDropdownItems(resolveGroup(pm, this.content), pm);
      if (!items.length) return;

      var label = (0, _dom.elt)("div", { class: prefix + "-submenu-label" }, pm.translate(this.options.label));
      var wrap = (0, _dom.elt)("div", { class: prefix + "-submenu-wrap" }, label, (0, _dom.elt)("div", { class: prefix + "-submenu" }, items));
      label.addEventListener("mousedown", function (e) {
        e.preventDefault();e.stopPropagation();
        wrap.classList.toggle(prefix + "-submenu-wrap-active");
      });
      return wrap;
    }
  }]);

  return DropdownSubmenu;
}();

// :: (ProseMirror, MenuGroup) → [MenuElement]
// Resolve the given `MenuGroup` into a flat array of renderable
// elements.


function resolveGroup(pm, content) {
  var result = undefined,
      isArray = Array.isArray(content);
  for (var i = 0; i < (isArray ? content.length : 1); i++) {
    var cur = isArray ? content[i] : content;
    if (cur instanceof MenuCommandGroup) {
      var elts = cur.get(pm);
      if (!isArray || content.length == 1) return elts;else result = (result || content.slice(0, i)).concat(elts);
    } else if (result) {
      result.push(cur);
    }
  }
  return result || (isArray ? content : [content]);
}

// :: (ProseMirror, [MenuGroup]) → ?DOMFragment
// Render the given menu groups into a document fragment, placing
// separators between them (and ensuring no superfluous separators
// appear when some of the groups turn out to be empty).
function renderGrouped(pm, content) {
  var result = document.createDocumentFragment(),
      needSep = false;
  for (var i = 0; i < content.length; i++) {
    var items = resolveGroup(pm, content[i]),
        added = false;
    for (var j = 0; j < items.length; j++) {
      var rendered = items[j].render(pm);
      if (rendered) {
        if (!added && needSep) result.appendChild(separator());
        result.appendChild((0, _dom.elt)("span", { class: prefix + "item" }, rendered));
        added = true;
      }
    }
    if (added) needSep = true;
  }
  return result;
}

function separator() {
  return (0, _dom.elt)("span", { class: prefix + "separator" });
}

// ;; #path=CommandSpec #kind=interface #noAnchor
// The `menu` module gives meaning to an additional property in
// [command specs](#CommandSpec).

// :: MenuCommandSpec #path=CommandSpec.menu
// Adds the command to a menu group, so that it is picked up by
// `MenuCommandGroup` objects with the matching
// [name](#MenuCommandSpec.name).

// ;; #path=MenuCommandSpec #kind=interface
// Configures the way a command shows up in a menu, when wrapped in a
// `MenuCommand`.

// :: string #path=MenuCommandSpec.group
// Identifies the group this command should be added to (for example
// `"inline"` or `"block"`). Only meaningful when associated with a
// `CommandSpec` (as opposed to passed directly to `MenuCommand`).

// :: number #path=MenuCommandSpec.rank
// Determines the command's position in its group (lower ranks come
// first). Only meaningful in a `CommandSpec`.

// :: Object #path=MenuCommandSpec.display
// Determines how the command is shown in the menu. It may have either
// a `type` property containing one of the strings shown below, or a
// `render` property that, when called with the command and a
// `ProseMirror` instance as arguments, returns a DOM node
// representing the command's menu representation.
//
// **`"icon"`**
//   : Show the command as an icon. The object may have `{path, width,
//     height}` properties, where `path` is an [SVG path
//     spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d),
//     and `width` and `height` provide the viewbox in which that path
//     exists. Alternatively, it may have a `text` property specifying
//     a string of text that makes up the icon, with an optional
//     `style` property giving additional CSS styling for the text,
//     _or_ a `dom` property containing a DOM node.
//
// **`"label"`**
//   : Render the command as a label. Mostly useful for commands
//     wrapped in a [drop-down](#Dropdown) or similar menu. The object
//     should have a `label` property providing the text to display.

// :: string #path=MenuCommandSpec.activeLabel
// When used in a `Dropdown` with `activeLabel` enabled, this should
// provide the text shown when the command is active.

// :: string #path=MenuCommandSpec.select
// Controls whether the command's [`select`](#CommandSpec.select)
// method has influence on its appearance. When set to `"hide"`, or
// not given, the command is hidden when it is not selectable. When
// set to `"ignore"`, the `select` method is not called. When set to
// `"disable"`, the command is shown in disabled form when `select`
// returns false.

// :: string #path=MenuCommandSpec.class
// Optionally adds a CSS class to the command's DOM representation.

// :: string #path=MenuCommandSpec.css
// Optionally adds a string of inline CSS to the command's DOM
// representation.

// :: MenuCommandGroup
// The inline command group.
var inlineGroup = exports.inlineGroup = new MenuCommandGroup("inline");

// :: Dropdown
// The default insert dropdown menu.
var insertMenu = exports.insertMenu = new Dropdown({ label: "Insert" }, new MenuCommandGroup("insert"));

// :: Dropdown
// The default textblock type menu.
var textblockMenu = exports.textblockMenu = new Dropdown({ label: "Type..", displayActive: true, class: "ProseMirror-textblock-dropdown" }, [new MenuCommandGroup("textblock"), new DropdownSubmenu({ label: "Heading" }, new MenuCommandGroup("textblockHeading"))]);

// :: MenuCommandGroup
// The block command group.
var blockGroup = exports.blockGroup = new MenuCommandGroup("block");

// :: MenuCommandGroup
// The history command group.
var historyGroup = exports.historyGroup = new MenuCommandGroup("history");

(0, _dom.insertCSS)("\n\n.ProseMirror-textblock-dropdown {\n  min-width: 3em;\n}\n\n." + prefix + " {\n  margin: 0 -4px;\n  line-height: 1;\n}\n\n.ProseMirror-tooltip ." + prefix + " {\n  width: -webkit-fit-content;\n  width: fit-content;\n  white-space: pre;\n}\n\n." + prefix + "item {\n  margin-right: 3px;\n  display: inline-block;\n}\n\n." + prefix + "separator {\n  border-right: 1px solid #ddd;\n  margin-right: 3px;\n}\n\n." + prefix + "-dropdown, ." + prefix + "-dropdown-menu {\n  font-size: 90%;\n  white-space: nowrap;\n}\n\n." + prefix + "-dropdown {\n  padding: 1px 14px 1px 4px;\n  display: inline-block;\n  vertical-align: 1px;\n  position: relative;\n  cursor: pointer;\n}\n\n." + prefix + "-dropdown:after {\n  content: \"\";\n  border-left: 4px solid transparent;\n  border-right: 4px solid transparent;\n  border-top: 4px solid currentColor;\n  opacity: .6;\n  position: absolute;\n  right: 2px;\n  top: calc(50% - 2px);\n}\n\n." + prefix + "-dropdown-menu, ." + prefix + "-submenu {\n  position: absolute;\n  background: white;\n  color: #666;\n  border: 1px solid #aaa;\n  padding: 2px;\n}\n\n." + prefix + "-dropdown-menu {\n  z-index: 15;\n  min-width: 6em;\n}\n\n." + prefix + "-dropdown-item {\n  cursor: pointer;\n  padding: 2px 8px 2px 4px;\n}\n\n." + prefix + "-dropdown-item:hover {\n  background: #f2f2f2;\n}\n\n." + prefix + "-submenu-wrap {\n  position: relative;\n  margin-right: -4px;\n}\n\n." + prefix + "-submenu-label:after {\n  content: \"\";\n  border-top: 4px solid transparent;\n  border-bottom: 4px solid transparent;\n  border-left: 4px solid currentColor;\n  opacity: .6;\n  position: absolute;\n  right: 4px;\n  top: calc(50% - 4px);\n}\n\n." + prefix + "-submenu {\n  display: none;\n  min-width: 4em;\n  left: 100%;\n  top: -3px;\n}\n\n." + prefix + "-active {\n  background: #eee;\n  border-radius: 4px;\n}\n\n." + prefix + "-active {\n  background: #eee;\n  border-radius: 4px;\n}\n\n." + prefix + "-disabled {\n  opacity: .3;\n}\n\n." + prefix + "-submenu-wrap:hover ." + prefix + "-submenu, ." + prefix + "-submenu-wrap-active ." + prefix + "-submenu {\n  display: block;\n}\n");
},{"../dom":1,"../util/obj":53,"../util/sortedinsert":54,"./icons":27}],29:[function(require,module,exports){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _edit = require("../edit");

var _dom = require("../dom");

var _update = require("../ui/update");

var _menu = require("./menu");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var prefix = "ProseMirror-menubar";

// :: union<bool, Object> #path=menuBar #kind=option
//
// When given a truthy value, enables the menu bar module for this
// editor. The menu bar takes up space above the editor, showing
// currently available commands (that have been
// [added](#CommandSpec.menuGroup) to the menu). To configure the
// module, you can pass a configuration object, on which the following
// properties are supported:
//
// **`float`**`: bool = false`
//   : When enabled, causes the menu bar to stay visible when the
//     editor is partially scrolled out of view, by making it float at
//     the top of the viewport.
//
// **`content`**`: [`[`MenuGroup`](#MenuGroup)`]`
//   : Determines the content of the menu.

(0, _edit.defineOption)("menuBar", false, function (pm, value) {
  if (pm.mod.menuBar) pm.mod.menuBar.detach();
  pm.mod.menuBar = value ? new MenuBar(pm, value) : null;
});

var defaultMenu = [_menu.inlineGroup, _menu.insertMenu, [_menu.textblockMenu, _menu.blockGroup], _menu.historyGroup];

var MenuBar = function () {
  function MenuBar(pm, config) {
    var _this = this;

    _classCallCheck(this, MenuBar);

    this.pm = pm;
    this.config = config || {};

    this.wrapper = pm.wrapper.insertBefore((0, _dom.elt)("div", { class: prefix }), pm.wrapper.firstChild);
    this.spacer = null;
    this.maxHeight = 0;
    this.widthForMaxHeight = 0;

    this.updater = new _update.UpdateScheduler(pm, "selectionChange change activeMarkChange commandsChanged", function () {
      return _this.update();
    });
    this.content = config.content || defaultMenu;
    this.updater.force();

    this.floating = false;
    if (this.config.float) {
      this.updateFloat();
      this.scrollFunc = function () {
        if (!document.body.contains(_this.pm.wrapper)) window.removeEventListener("scroll", _this.scrollFunc);else _this.updateFloat();
      };
      window.addEventListener("scroll", this.scrollFunc);
    }
  }

  _createClass(MenuBar, [{
    key: "detach",
    value: function detach() {
      this.updater.detach();
      this.wrapper.parentNode.removeChild(this.wrapper);

      if (this.scrollFunc) window.removeEventListener("scroll", this.scrollFunc);
    }
  }, {
    key: "update",
    value: function update() {
      var _this2 = this;

      this.wrapper.textContent = "";
      this.wrapper.appendChild((0, _menu.renderGrouped)(this.pm, this.content));

      return this.floating ? this.updateScrollCursor() : function () {
        if (_this2.wrapper.offsetWidth != _this2.widthForMaxHeight) {
          _this2.widthForMaxHeight = _this2.wrapper.offsetWidth;
          _this2.maxHeight = 0;
        }
        if (_this2.wrapper.offsetHeight > _this2.maxHeight) {
          _this2.maxHeight = _this2.wrapper.offsetHeight;
          return function () {
            _this2.wrapper.style.minHeight = _this2.maxHeight + "px";
          };
        }
      };
    }
  }, {
    key: "updateFloat",
    value: function updateFloat() {
      var editorRect = this.pm.wrapper.getBoundingClientRect();
      if (this.floating) {
        if (editorRect.top >= 0 || editorRect.bottom < this.wrapper.offsetHeight + 10) {
          this.floating = false;
          this.wrapper.style.position = this.wrapper.style.left = this.wrapper.style.width = "";
          this.wrapper.style.display = "";
          this.spacer.parentNode.removeChild(this.spacer);
          this.spacer = null;
        } else {
          var border = (this.pm.wrapper.offsetWidth - this.pm.wrapper.clientWidth) / 2;
          this.wrapper.style.left = editorRect.left + border + "px";
          this.wrapper.style.display = editorRect.top > window.innerHeight ? "none" : "";
        }
      } else {
        if (editorRect.top < 0 && editorRect.bottom >= this.wrapper.offsetHeight + 10) {
          this.floating = true;
          var menuRect = this.wrapper.getBoundingClientRect();
          this.wrapper.style.left = menuRect.left + "px";
          this.wrapper.style.width = menuRect.width + "px";
          this.wrapper.style.position = "fixed";
          this.spacer = (0, _dom.elt)("div", { class: prefix + "-spacer", style: "height: " + menuRect.height + "px" });
          this.pm.wrapper.insertBefore(this.spacer, this.wrapper);
        }
      }
    }
  }, {
    key: "updateScrollCursor",
    value: function updateScrollCursor() {
      var _this3 = this;

      if (!this.floating) return null;
      var head = this.pm.selection.head;
      if (!head) return null;
      return function () {
        var cursorPos = _this3.pm.coordsAtPos(head);
        var menuRect = _this3.wrapper.getBoundingClientRect();
        if (cursorPos.top < menuRect.bottom && cursorPos.bottom > menuRect.top) {
          var _ret = function () {
            var scrollable = findWrappingScrollable(_this3.pm.wrapper);
            if (scrollable) return {
                v: function v() {
                  scrollable.scrollTop -= menuRect.bottom - cursorPos.top;
                }
              };
          }();

          if ((typeof _ret === "undefined" ? "undefined" : _typeof(_ret)) === "object") return _ret.v;
        }
      };
    }
  }]);

  return MenuBar;
}();

function findWrappingScrollable(node) {
  for (var cur = node.parentNode; cur; cur = cur.parentNode) {
    if (cur.scrollHeight > cur.clientHeight) return cur;
  }
}

(0, _dom.insertCSS)("\n." + prefix + " {\n  border-top-left-radius: inherit;\n  border-top-right-radius: inherit;\n  position: relative;\n  min-height: 1em;\n  color: #666;\n  padding: 1px 6px;\n  top: 0; left: 0; right: 0;\n  border-bottom: 1px solid silver;\n  background: white;\n  z-index: 10;\n  -moz-box-sizing: border-box;\n  box-sizing: border-box;\n  overflow: visible;\n}\n");
},{"../dom":1,"../edit":11,"../ui/update":49,"./menu":28}],30:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultSchema = exports.CodeMark = exports.LinkMark = exports.StrongMark = exports.EmMark = exports.HardBreak = exports.Image = exports.Paragraph = exports.CodeBlock = exports.Heading = exports.HorizontalRule = exports.ListItem = exports.BulletList = exports.OrderedList = exports.BlockQuote = exports.Doc = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _schema = require("./schema");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// ;; The default top-level document node type.

var Doc = exports.Doc = function (_Block) {
  _inherits(Doc, _Block);

  function Doc() {
    _classCallCheck(this, Doc);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Doc).apply(this, arguments));
  }

  _createClass(Doc, [{
    key: "kind",
    get: function get() {
      return null;
    }
  }]);

  return Doc;
}(_schema.Block);

// ;; The default blockquote node type.


var BlockQuote = exports.BlockQuote = function (_Block2) {
  _inherits(BlockQuote, _Block2);

  function BlockQuote() {
    _classCallCheck(this, BlockQuote);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(BlockQuote).apply(this, arguments));
  }

  return BlockQuote;
}(_schema.Block);

// :: NodeKind The node kind used for list items in the default
// schema.


_schema.NodeKind.list_item = new _schema.NodeKind("list_item");

// ;; The default ordered list node type. Has a single attribute,
// `order`, which determines the number at which the list starts
// counting, and defaults to 1.

var OrderedList = exports.OrderedList = function (_Block3) {
  _inherits(OrderedList, _Block3);

  function OrderedList() {
    _classCallCheck(this, OrderedList);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(OrderedList).apply(this, arguments));
  }

  _createClass(OrderedList, [{
    key: "contains",
    get: function get() {
      return _schema.NodeKind.list_item;
    }
  }, {
    key: "attrs",
    get: function get() {
      return { order: new _schema.Attribute({ default: "1" }) };
    }
  }]);

  return OrderedList;
}(_schema.Block);

// ;; The default bullet list node type.


var BulletList = exports.BulletList = function (_Block4) {
  _inherits(BulletList, _Block4);

  function BulletList() {
    _classCallCheck(this, BulletList);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(BulletList).apply(this, arguments));
  }

  _createClass(BulletList, [{
    key: "contains",
    get: function get() {
      return _schema.NodeKind.list_item;
    }
  }]);

  return BulletList;
}(_schema.Block);

// ;; The default list item node type.


var ListItem = exports.ListItem = function (_Block5) {
  _inherits(ListItem, _Block5);

  function ListItem() {
    _classCallCheck(this, ListItem);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(ListItem).apply(this, arguments));
  }

  _createClass(ListItem, [{
    key: "kind",
    get: function get() {
      return _schema.NodeKind.list_item;
    }
  }]);

  return ListItem;
}(_schema.Block);

// ;; The default horizontal rule node type.


var HorizontalRule = exports.HorizontalRule = function (_Block6) {
  _inherits(HorizontalRule, _Block6);

  function HorizontalRule() {
    _classCallCheck(this, HorizontalRule);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(HorizontalRule).apply(this, arguments));
  }

  _createClass(HorizontalRule, [{
    key: "contains",
    get: function get() {
      return null;
    }
  }]);

  return HorizontalRule;
}(_schema.Block);

// ;; The default heading node type. Has a single attribute
// `level`, which indicates the heading level, and defaults to 1.


var Heading = exports.Heading = function (_Textblock) {
  _inherits(Heading, _Textblock);

  function Heading() {
    _classCallCheck(this, Heading);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Heading).apply(this, arguments));
  }

  _createClass(Heading, [{
    key: "attrs",
    get: function get() {
      return { level: new _schema.Attribute({ default: "1" }) };
    }
    // :: number
    // Controls the maximum heading level. Has the value 6 in the
    // `Heading` class, but you can override it in a subclass.

  }, {
    key: "maxLevel",
    get: function get() {
      return 6;
    }
  }]);

  return Heading;
}(_schema.Textblock);

// ;; The default code block / listing node type. Only
// allows unmarked text nodes inside of it.


var CodeBlock = exports.CodeBlock = function (_Textblock2) {
  _inherits(CodeBlock, _Textblock2);

  function CodeBlock() {
    _classCallCheck(this, CodeBlock);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(CodeBlock).apply(this, arguments));
  }

  _createClass(CodeBlock, [{
    key: "contains",
    get: function get() {
      return _schema.NodeKind.text;
    }
  }, {
    key: "containsMarks",
    get: function get() {
      return false;
    }
  }, {
    key: "isCode",
    get: function get() {
      return true;
    }
  }]);

  return CodeBlock;
}(_schema.Textblock);

// ;; The default paragraph node type.


var Paragraph = exports.Paragraph = function (_Textblock3) {
  _inherits(Paragraph, _Textblock3);

  function Paragraph() {
    _classCallCheck(this, Paragraph);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Paragraph).apply(this, arguments));
  }

  _createClass(Paragraph, [{
    key: "defaultTextblock",
    get: function get() {
      return true;
    }
  }]);

  return Paragraph;
}(_schema.Textblock);

// ;; The default inline image node type. Has these
// attributes:
//
// - **`src`** (required): The URL of the image.
// - **`alt`**: The alt text.
// - **`title`**: The title of the image.


var Image = exports.Image = function (_Inline) {
  _inherits(Image, _Inline);

  function Image() {
    _classCallCheck(this, Image);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Image).apply(this, arguments));
  }

  _createClass(Image, [{
    key: "attrs",
    get: function get() {
      return {
        src: new _schema.Attribute(),
        alt: new _schema.Attribute({ default: "" }),
        title: new _schema.Attribute({ default: "" })
      };
    }
  }, {
    key: "draggable",
    get: function get() {
      return true;
    }
  }]);

  return Image;
}(_schema.Inline);

// ;; The default hard break node type.


var HardBreak = exports.HardBreak = function (_Inline2) {
  _inherits(HardBreak, _Inline2);

  function HardBreak() {
    _classCallCheck(this, HardBreak);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(HardBreak).apply(this, arguments));
  }

  _createClass(HardBreak, [{
    key: "selectable",
    get: function get() {
      return false;
    }
  }, {
    key: "isBR",
    get: function get() {
      return true;
    }
  }]);

  return HardBreak;
}(_schema.Inline);

// ;; The default emphasis mark type.


var EmMark = exports.EmMark = function (_MarkType) {
  _inherits(EmMark, _MarkType);

  function EmMark() {
    _classCallCheck(this, EmMark);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(EmMark).apply(this, arguments));
  }

  _createClass(EmMark, null, [{
    key: "rank",
    get: function get() {
      return 31;
    }
  }]);

  return EmMark;
}(_schema.MarkType);

// ;; The default strong mark type.


var StrongMark = exports.StrongMark = function (_MarkType2) {
  _inherits(StrongMark, _MarkType2);

  function StrongMark() {
    _classCallCheck(this, StrongMark);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(StrongMark).apply(this, arguments));
  }

  _createClass(StrongMark, null, [{
    key: "rank",
    get: function get() {
      return 32;
    }
  }]);

  return StrongMark;
}(_schema.MarkType);

// ;; The default link mark type. Has these attributes:
//
// - **`href`** (required): The link target.
// - **`title`**: The link's title.


var LinkMark = exports.LinkMark = function (_MarkType3) {
  _inherits(LinkMark, _MarkType3);

  function LinkMark() {
    _classCallCheck(this, LinkMark);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(LinkMark).apply(this, arguments));
  }

  _createClass(LinkMark, [{
    key: "attrs",
    get: function get() {
      return {
        href: new _schema.Attribute(),
        title: new _schema.Attribute({ default: "" })
      };
    }
  }], [{
    key: "rank",
    get: function get() {
      return 60;
    }
  }]);

  return LinkMark;
}(_schema.MarkType);

// ;; The default code font mark type.


var CodeMark = exports.CodeMark = function (_MarkType4) {
  _inherits(CodeMark, _MarkType4);

  function CodeMark() {
    _classCallCheck(this, CodeMark);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(CodeMark).apply(this, arguments));
  }

  _createClass(CodeMark, [{
    key: "isCode",
    get: function get() {
      return true;
    }
  }], [{
    key: "rank",
    get: function get() {
      return 101;
    }
  }]);

  return CodeMark;
}(_schema.MarkType);

// :: SchemaSpec
// The specification for the default schema.


var defaultSpec = new _schema.SchemaSpec({
  doc: Doc,
  blockquote: BlockQuote,
  ordered_list: OrderedList,
  bullet_list: BulletList,
  list_item: ListItem,
  horizontal_rule: HorizontalRule,

  paragraph: Paragraph,
  heading: Heading,
  code_block: CodeBlock,

  text: _schema.Text,
  image: Image,
  hard_break: HardBreak
}, {
  em: EmMark,
  strong: StrongMark,
  link: LinkMark,
  code: CodeMark
});

// :: Schema
// ProseMirror's default document schema.
var defaultSchema = exports.defaultSchema = new _schema.Schema(defaultSpec);
},{"./schema":38}],31:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findDiffStart = findDiffStart;
exports.findDiffEnd = findDiffEnd;
// :: (Node, Node) → ?number
// Find the first position at which nodes `a` and `b` differ, or
// `null` if they are the same.
function findDiffStart(a, b) {
  var pos = arguments.length <= 2 || arguments[2] === undefined ? 0 : arguments[2];

  for (var i = 0;; i++) {
    if (i == a.childCount || i == b.childCount) return a.childCount == b.childCount ? null : pos;

    var childA = a.child(i),
        childB = b.child(i);
    if (childA == childB) {
      pos += childA.nodeSize;continue;
    }

    if (!childA.sameMarkup(childB)) return pos;

    if (childA.isText && childA.text != childB.text) {
      for (var j = 0; childA.text[j] == childB.text[j]; j++) {
        pos++;
      }return pos;
    }
    if (childA.content.size || childB.content.size) {
      var inner = findDiffStart(childA.content, childB.content, pos + 1);
      if (inner != null) return inner;
    }
    pos += childA.nodeSize;
  }
}

// :: (Node, Node) → ?{a: number, b: number}
// Find the first position, searching from the end, at which nodes `a`
// and `b` differ, or `null` if they are the same. Since this position
// will not be the same in both nodes, an object with two separate
// positions is returned.
function findDiffEnd(a, b) {
  var posA = arguments.length <= 2 || arguments[2] === undefined ? a.size : arguments[2];
  var posB = arguments.length <= 3 || arguments[3] === undefined ? b.size : arguments[3];

  for (var iA = a.childCount, iB = b.childCount;;) {
    if (iA == 0 || iB == 0) return iA == iB ? null : { a: posA, b: posB };

    var childA = a.child(--iA),
        childB = b.child(--iB),
        size = childA.nodeSize;
    if (childA == childB) {
      posA -= size;posB -= size;
      continue;
    }

    if (!childA.sameMarkup(childB)) return { a: posA, b: posB };

    if (childA.isText && childA.text != childB.text) {
      var same = 0,
          minSize = Math.min(childA.text.length, childB.text.length);
      while (same < minSize && childA.text[childA.text.length - same - 1] == childB.text[childB.text.length - same - 1]) {
        same++;posA--;posB--;
      }
      return { a: posA, b: posB };
    }
    if (childA.content.size || childB.content.size) {
      var inner = findDiffEnd(childA.content, childB.content, posA - 1, posB - 1);
      if (inner) return inner;
    }
    posA -= size;posB -= size;
  }
}
},{}],32:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; Fragment is the type used to represent a node's collection of
// child nodes.
//
// Fragments are persistent data structures. That means you should
// _not_ mutate them or their content, but create new instances
// whenever needed. The API tries to make this easy.

var Fragment = exports.Fragment = function () {
  function Fragment(content, size) {
    _classCallCheck(this, Fragment);

    this.content = content;
    this.size = size || 0;
    if (size == null) for (var i = 0; i < content.length; i++) {
      this.size += content[i].nodeSize;
    }
  }

  // :: string
  // Concatenate all the text nodes found in this fragment and its
  // children.


  _createClass(Fragment, [{
    key: "toString",


    // :: () → string
    // Return a debugging string that describes this fragment.
    value: function toString() {
      return "<" + this.toStringInner() + ">";
    }
  }, {
    key: "toStringInner",
    value: function toStringInner() {
      return this.content.join(", ");
    }
  }, {
    key: "nodesBetween",
    value: function nodesBetween(from, to, f, nodeStart, parent) {
      for (var i = 0, pos = 0; pos < to; i++) {
        var child = this.content[i],
            end = pos + child.nodeSize;
        if (end > from && f(child, nodeStart + pos, parent) !== false && child.content.size) {
          var start = pos + 1;
          child.nodesBetween(Math.max(0, from - start), Math.min(child.content.size, to - start), f, nodeStart + start);
        }
        pos = end;
      }
    }

    // :: (number, ?number) → Fragment
    // Cut out the sub-fragment between the two given positions.

  }, {
    key: "cut",
    value: function cut(from, to) {
      if (to == null) to = this.size;
      if (from == 0 && to == this.size) return this;
      var result = [],
          size = 0;
      if (to > from) for (var i = 0, pos = 0; pos < to; i++) {
        var child = this.content[i],
            end = pos + child.nodeSize;
        if (end > from) {
          if (pos < from || end > to) {
            if (child.isText) child = child.cut(Math.max(0, from - pos), Math.min(child.text.length, to - pos));else child = child.cut(Math.max(0, from - pos - 1), Math.min(child.content.size, to - pos - 1));
          }
          result.push(child);
          size += child.nodeSize;
        }
        pos = end;
      }
      return new Fragment(result, size);
    }

    // :: (Fragment) → Fragment
    // Create a new fragment containing the content of this fragment and
    // `other`.

  }, {
    key: "append",
    value: function append(other) {
      if (!other.size) return this;
      if (!this.size) return other;
      var last = this.lastChild,
          first = other.firstChild,
          content = this.content.slice(),
          i = 0;
      if (last.isText && last.sameMarkup(first)) {
        content[content.length - 1] = last.copy(last.text + first.text);
        i = 1;
      }
      for (; i < other.content.length; i++) {
        content.push(other.content[i]);
      }return new Fragment(content, this.size + other.size);
    }

    // :: (number, Node) → Fragment
    // Create a new fragment in which the node at the given index is
    // replaced by the given node.

  }, {
    key: "replaceChild",
    value: function replaceChild(index, node) {
      var copy = this.content.slice();
      var size = this.size + node.nodeSize - copy[index].nodeSize;
      copy[index] = node;
      return new Fragment(copy, size);
    }

    // (Node) → Fragment
    // Create a new fragment by prepending the given node to this
    // fragment.

  }, {
    key: "addToStart",
    value: function addToStart(node) {
      return new Fragment([node].concat(this.content), this.size + node.nodeSize);
    }

    // (Node) → Fragment
    // Create a new fragment by appending the given node to this
    // fragment.

  }, {
    key: "addToEnd",
    value: function addToEnd(node) {
      return new Fragment(this.content.concat(node), this.size + node.nodeSize);
    }

    // :: () → ?Object
    // Create a JSON-serializeable representation of this fragment.

  }, {
    key: "toJSON",
    value: function toJSON() {
      return this.content.length ? this.content.map(function (n) {
        return n.toJSON();
      }) : null;
    }

    // :: (Schema, ?Object) → Fragment
    // Deserialize a fragment from its JSON representation.

  }, {
    key: "eq",


    // :: (Fragment) → bool
    // Compare this fragment to another one.
    value: function eq(other) {
      if (this.content.length != other.content.length) return false;
      for (var i = 0; i < this.content.length; i++) {
        if (!this.content[i].eq(other.content[i])) return false;
      }return true;
    }

    // :: (?union<Fragment, Node, [Node]>) → Fragment
    // Create a fragment from something that can be interpreted as a set
    // of nodes. For `null`, it returns the empty fragment. For a
    // fragment, the fragment itself. For a node or array of nodes, a
    // fragment containing those nodes.

  }, {
    key: "child",


    // :: (number) → Node
    // Get the child node at the given index. Raise an error when the
    // index is out of range.
    value: function child(index) {
      var found = this.content[index];
      if (!found) throw new RangeError("Index " + index + " out of range for " + this);
      return found;
    }

    // :: (number) → ?Node
    // Get the child node at the given index, if it exists.

  }, {
    key: "maybeChild",
    value: function maybeChild(index) {
      return this.content[index];
    }

    // :: ((node: Node, offset: number))
    // Call `f` for every child node, passing the node and its offset
    // into this parent node.

  }, {
    key: "forEach",
    value: function forEach(f) {
      for (var i = 0, p = 0; i < this.content.length; i++) {
        var child = this.content[i];
        f(child, p);
        p += child.nodeSize;
      }
    }
  }, {
    key: "leastSuperKind",
    value: function leastSuperKind() {
      var kind = undefined;
      for (var i = this.childCount - 1; i >= 0; i--) {
        var cur = this.child(i).type.kind;
        kind = kind ? kind.sharedSuperKind(cur) : cur;
      }
      return kind;
    }

    // : (number, ?number) → {index: number, offset: number}
    // Find the index and inner offset corresponding to a given relative
    // position in this fragment. The result object will be reused
    // (overwritten) the next time the function is called. (Not public.)

  }, {
    key: "findIndex",
    value: function findIndex(pos) {
      var round = arguments.length <= 1 || arguments[1] === undefined ? -1 : arguments[1];

      if (pos == 0) return retIndex(0, pos);
      if (pos == this.size) return retIndex(this.content.length, pos);
      if (pos > this.size || pos < 0) throw new RangeError("Position " + pos + " outside of fragment (" + this + ")");
      for (var i = 0, curPos = 0;; i++) {
        var cur = this.child(i),
            end = curPos + cur.nodeSize;
        if (end >= pos) {
          if (end == pos || round > 0) return retIndex(i + 1, end);
          return retIndex(i, curPos);
        }
        curPos = end;
      }
    }
  }, {
    key: "textContent",
    get: function get() {
      var text = "";
      this.content.forEach(function (n) {
        return text += n.textContent;
      });
      return text;
    }
  }, {
    key: "firstChild",


    // :: ?Node
    // The first child of the fragment, or `null` if it is empty.
    get: function get() {
      return this.content.length ? this.content[0] : null;
    }

    // :: ?Node
    // The last child of the fragment, or `null` if it is empty.

  }, {
    key: "lastChild",
    get: function get() {
      return this.content.length ? this.content[this.content.length - 1] : null;
    }

    // :: number
    // The number of child nodes in this fragment.

  }, {
    key: "childCount",
    get: function get() {
      return this.content.length;
    }
  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, value) {
      return value ? new Fragment(value.map(schema.nodeFromJSON)) : Fragment.empty;
    }

    // :: ([Node]) → Fragment
    // Build a fragment from an array of nodes. Ensures that adjacent
    // text nodes with the same style are joined together.

  }, {
    key: "fromArray",
    value: function fromArray(array) {
      if (!array.length) return Fragment.empty;
      var joined = undefined,
          size = 0;
      for (var i = 0; i < array.length; i++) {
        var node = array[i];
        size += node.nodeSize;
        if (i && node.isText && array[i - 1].sameMarkup(node)) {
          if (!joined) joined = array.slice(0, i);
          joined[joined.length - 1] = node.copy(joined[joined.length - 1].text + node.text);
        } else if (joined) {
          joined.push(node);
        }
      }
      return new Fragment(joined || array, size);
    }
  }, {
    key: "from",
    value: function from(nodes) {
      if (!nodes) return Fragment.empty;
      if (nodes instanceof Fragment) return nodes;
      if (Array.isArray(nodes)) return this.fromArray(nodes);
      return new Fragment([nodes], nodes.nodeSize);
    }
  }]);

  return Fragment;
}();

var found = { index: 0, offset: 0 };
function retIndex(index, offset) {
  found.index = index;
  found.offset = offset;
  return found;
}

// :: Fragment
// An empty fragment. Intended to be reused whenever a node doesn't
// contain anything (rather than allocating a new empty fragment for
// each leaf node).
Fragment.empty = new Fragment([], 0);
},{}],33:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
        value: true
});

var _node = require("./node");

Object.defineProperty(exports, "Node", {
        enumerable: true,
        get: function get() {
                return _node.Node;
        }
});

var _resolvedpos = require("./resolvedpos");

Object.defineProperty(exports, "ResolvedPos", {
        enumerable: true,
        get: function get() {
                return _resolvedpos.ResolvedPos;
        }
});

var _fragment = require("./fragment");

Object.defineProperty(exports, "Fragment", {
        enumerable: true,
        get: function get() {
                return _fragment.Fragment;
        }
});

var _replace = require("./replace");

Object.defineProperty(exports, "Slice", {
        enumerable: true,
        get: function get() {
                return _replace.Slice;
        }
});
Object.defineProperty(exports, "ReplaceError", {
        enumerable: true,
        get: function get() {
                return _replace.ReplaceError;
        }
});

var _mark = require("./mark");

Object.defineProperty(exports, "Mark", {
        enumerable: true,
        get: function get() {
                return _mark.Mark;
        }
});

var _schema = require("./schema");

Object.defineProperty(exports, "SchemaSpec", {
        enumerable: true,
        get: function get() {
                return _schema.SchemaSpec;
        }
});
Object.defineProperty(exports, "Schema", {
        enumerable: true,
        get: function get() {
                return _schema.Schema;
        }
});
Object.defineProperty(exports, "NodeType", {
        enumerable: true,
        get: function get() {
                return _schema.NodeType;
        }
});
Object.defineProperty(exports, "Block", {
        enumerable: true,
        get: function get() {
                return _schema.Block;
        }
});
Object.defineProperty(exports, "Textblock", {
        enumerable: true,
        get: function get() {
                return _schema.Textblock;
        }
});
Object.defineProperty(exports, "Inline", {
        enumerable: true,
        get: function get() {
                return _schema.Inline;
        }
});
Object.defineProperty(exports, "Text", {
        enumerable: true,
        get: function get() {
                return _schema.Text;
        }
});
Object.defineProperty(exports, "MarkType", {
        enumerable: true,
        get: function get() {
                return _schema.MarkType;
        }
});
Object.defineProperty(exports, "Attribute", {
        enumerable: true,
        get: function get() {
                return _schema.Attribute;
        }
});
Object.defineProperty(exports, "NodeKind", {
        enumerable: true,
        get: function get() {
                return _schema.NodeKind;
        }
});

var _defaultschema = require("./defaultschema");

Object.defineProperty(exports, "defaultSchema", {
        enumerable: true,
        get: function get() {
                return _defaultschema.defaultSchema;
        }
});
Object.defineProperty(exports, "Doc", {
        enumerable: true,
        get: function get() {
                return _defaultschema.Doc;
        }
});
Object.defineProperty(exports, "BlockQuote", {
        enumerable: true,
        get: function get() {
                return _defaultschema.BlockQuote;
        }
});
Object.defineProperty(exports, "OrderedList", {
        enumerable: true,
        get: function get() {
                return _defaultschema.OrderedList;
        }
});
Object.defineProperty(exports, "BulletList", {
        enumerable: true,
        get: function get() {
                return _defaultschema.BulletList;
        }
});
Object.defineProperty(exports, "ListItem", {
        enumerable: true,
        get: function get() {
                return _defaultschema.ListItem;
        }
});
Object.defineProperty(exports, "HorizontalRule", {
        enumerable: true,
        get: function get() {
                return _defaultschema.HorizontalRule;
        }
});
Object.defineProperty(exports, "Paragraph", {
        enumerable: true,
        get: function get() {
                return _defaultschema.Paragraph;
        }
});
Object.defineProperty(exports, "Heading", {
        enumerable: true,
        get: function get() {
                return _defaultschema.Heading;
        }
});
Object.defineProperty(exports, "CodeBlock", {
        enumerable: true,
        get: function get() {
                return _defaultschema.CodeBlock;
        }
});
Object.defineProperty(exports, "Image", {
        enumerable: true,
        get: function get() {
                return _defaultschema.Image;
        }
});
Object.defineProperty(exports, "HardBreak", {
        enumerable: true,
        get: function get() {
                return _defaultschema.HardBreak;
        }
});
Object.defineProperty(exports, "CodeMark", {
        enumerable: true,
        get: function get() {
                return _defaultschema.CodeMark;
        }
});
Object.defineProperty(exports, "EmMark", {
        enumerable: true,
        get: function get() {
                return _defaultschema.EmMark;
        }
});
Object.defineProperty(exports, "StrongMark", {
        enumerable: true,
        get: function get() {
                return _defaultschema.StrongMark;
        }
});
Object.defineProperty(exports, "LinkMark", {
        enumerable: true,
        get: function get() {
                return _defaultschema.LinkMark;
        }
});

var _diff = require("./diff");

Object.defineProperty(exports, "findDiffStart", {
        enumerable: true,
        get: function get() {
                return _diff.findDiffStart;
        }
});
Object.defineProperty(exports, "findDiffEnd", {
        enumerable: true,
        get: function get() {
                return _diff.findDiffEnd;
        }
});
},{"./defaultschema":30,"./diff":31,"./fragment":32,"./mark":34,"./node":35,"./replace":36,"./resolvedpos":37,"./schema":38}],34:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; A mark is a piece of information that can be attached to a node,
// such as it being emphasized, in code font, or a link. It has a type
// and optionally a set of attributes that provide further information
// (such as the target of the link). Marks are created through a
// `Schema`, which controls which types exist and which
// attributes they have.

var Mark = exports.Mark = function () {
  function Mark(type, attrs) {
    _classCallCheck(this, Mark);

    // :: MarkType
    // The type of this mark.
    this.type = type;
    // :: Object
    // The attributes associated with this mark.
    this.attrs = attrs;
  }

  // :: () → Object
  // Convert this mark to a JSON-serializeable representation.


  _createClass(Mark, [{
    key: "toJSON",
    value: function toJSON() {
      var obj = { _: this.type.name };
      for (var attr in this.attrs) {
        obj[attr] = this.attrs[attr];
      }return obj;
    }

    // :: ([Mark]) → [Mark]
    // Given a set of marks, create a new set which contains this one as
    // well, in the right position. If this mark or another of its type
    // is already in the set, the set itself is returned.

  }, {
    key: "addToSet",
    value: function addToSet(set) {
      for (var i = 0; i < set.length; i++) {
        var other = set[i];
        if (other.type == this.type) {
          if (this.eq(other)) return set;
          var copy = set.slice();
          copy[i] = this;
          return copy;
        }
        if (other.type.rank > this.type.rank) return set.slice(0, i).concat(this).concat(set.slice(i));
      }
      return set.concat(this);
    }

    // :: ([Mark]) → [Mark]
    // Remove this mark from the given set, returning a new set. If this
    // mark is not in the set, the set itself is returned.

  }, {
    key: "removeFromSet",
    value: function removeFromSet(set) {
      for (var i = 0; i < set.length; i++) {
        if (this.eq(set[i])) return set.slice(0, i).concat(set.slice(i + 1));
      }return set;
    }

    // :: ([Mark]) → bool
    // Test whether this mark is in the given set of marks.

  }, {
    key: "isInSet",
    value: function isInSet(set) {
      for (var i = 0; i < set.length; i++) {
        if (this.eq(set[i])) return true;
      }return false;
    }

    // :: (Mark) → bool
    // Test whether this mark has the same type and attributes as
    // another mark.

  }, {
    key: "eq",
    value: function eq(other) {
      if (this == other) return true;
      if (this.type != other.type) return false;
      for (var attr in this.attrs) {
        if (other.attrs[attr] != this.attrs[attr]) return false;
      }return true;
    }

    // :: ([Mark], [Mark]) → bool
    // Test whether two sets of marks are identical.

  }], [{
    key: "sameSet",
    value: function sameSet(a, b) {
      if (a == b) return true;
      if (a.length != b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (!a[i].eq(b[i])) return false;
      }return true;
    }

    // :: (?union<Mark, [Mark]>) → [Mark]
    // Create a properly sorted mark set from null, a single mark, or an
    // unsorted array of marks.

  }, {
    key: "setFrom",
    value: function setFrom(marks) {
      if (!marks || marks.length == 0) return empty;
      if (marks instanceof Mark) return [marks];
      var copy = marks.slice();
      copy.sort(function (a, b) {
        return a.type.rank - b.type.rank;
      });
      return copy;
    }
  }]);

  return Mark;
}();

var empty = [];
},{}],35:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TextNode = exports.Node = undefined;

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fragment = require("./fragment");

var _mark = require("./mark");

var _replace2 = require("./replace");

var _resolvedpos = require("./resolvedpos");

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var emptyArray = [],
    emptyAttrs = Object.create(null);

// ;; This class represents a node in the tree that makes up a
// ProseMirror document. So a document is an instance of `Node`, with
// children that are also instances of `Node`.
//
// Nodes are persistent data structures. Instead of changing them, you
// create new ones with the content you want. Old ones keep pointing
// at the old document shape. This is made cheaper by sharing
// structure between the old and new data as much as possible, which a
// tree shape like this (without back pointers) makes easy.
//
// **Never** directly mutate the properties of a `Node` object. See
// [this guide](guide/doc.html) for more information.

var Node = exports.Node = function () {
  function Node(type, attrs, content, marks) {
    _classCallCheck(this, Node);

    // :: NodeType
    // The type of node that this is.
    this.type = type;

    // :: Object
    // An object mapping attribute names to string values. The kind of
    // attributes allowed and required are determined by the node
    // type.
    this.attrs = attrs;

    // :: Fragment
    // The node's content.
    this.content = content || _fragment.Fragment.empty;

    // :: [Mark]
    // The marks (things like whether it is emphasized or part of a
    // link) associated with this node.
    this.marks = marks || emptyArray;
  }

  // :: number
  // The size of this node. For text node, this is the amount of
  // characters. For leaf nodes, it is one. And for non-leaf nodes, it
  // is the size of the content plus two (the start and end token).


  _createClass(Node, [{
    key: "child",


    // :: (number) → Node
    // Get the child node at the given index. Raise an error when the
    // index is out of range.
    value: function child(index) {
      return this.content.child(index);
    }

    // :: (number) → ?Node
    // Get the child node at the given index, if it exists.

  }, {
    key: "maybeChild",
    value: function maybeChild(index) {
      return this.content.maybeChild(index);
    }

    // :: ((node: Node, offset: number))
    // Call `f` for every child node, passing the node and its offset
    // into this parent node.

  }, {
    key: "forEach",
    value: function forEach(f) {
      this.content.forEach(f);
    }

    // :: string
    // Concatenate all the text nodes found in this fragment and its
    // children.

  }, {
    key: "eq",


    // :: (Node) → bool
    // Test whether two nodes represent the same content.
    value: function eq(other) {
      return this == other || this.sameMarkup(other) && this.content.eq(other.content);
    }

    // :: (Node) → bool
    // Compare the markup (type, attributes, and marks) of this node to
    // those of another. Returns `true` if both have the same markup.

  }, {
    key: "sameMarkup",
    value: function sameMarkup(other) {
      return this.hasMarkup(other.type, other.attrs, other.marks);
    }

    // :: (NodeType, ?Object, ?[Mark]) → bool
    // Check whether this node's markup correspond to the given type,
    // attributes, and marks.

  }, {
    key: "hasMarkup",
    value: function hasMarkup(type, attrs, marks) {
      return this.type == type && Node.sameAttrs(this.attrs, attrs || emptyAttrs) && _mark.Mark.sameSet(this.marks, marks || emptyArray);
    }
  }, {
    key: "copy",


    // :: (?Fragment) → Node
    // Create a new node with the same markup as this node, containing
    // the given content (or empty, if no content is given).
    value: function copy() {
      var content = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      if (content == this.content) return this;
      return new this.constructor(this.type, this.attrs, content, this.marks);
    }

    // :: ([Mark]) → Node
    // Create a copy of this node, with the given set of marks instead
    // of the node's own marks.

  }, {
    key: "mark",
    value: function mark(marks) {
      return new this.constructor(this.type, this.attrs, this.content, marks);
    }

    // :: (number, ?number) → Node
    // Create a copy of this node with only the content between the
    // given offsets. If `to` is not given, it defaults to the end of
    // the node.

  }, {
    key: "cut",
    value: function cut(from, to) {
      if (from == 0 && to == this.content.size) return this;
      return this.copy(this.content.cut(from, to));
    }

    // :: (number, ?number) → Slice
    // Cut out the part of the document between the given positions, and
    // return it as a `Slice` object.

  }, {
    key: "slice",
    value: function slice(from) {
      var to = arguments.length <= 1 || arguments[1] === undefined ? this.content.size : arguments[1];

      if (from == to) return _replace2.Slice.empty;

      var $from = this.resolve(from),
          $to = this.resolve(to);
      var depth = $from.sameDepth($to),
          start = $from.start(depth),
          node = $from.node(depth);
      var content = node.content.cut($from.pos - start, $to.pos - start);
      return new _replace2.Slice(content, $from.depth - depth, $to.depth - depth, node);
    }

    // :: (number, number, Slice) → Node
    // Replace the part of the document between the given positions with
    // the given slice. The slice must 'fit', meaning its open sides
    // must be able to connect to the surrounding content, and its
    // content nodes must be valid children for the node they are placed
    // into. If any of this is violated, an error of type `ReplaceError`
    // is thrown.

  }, {
    key: "replace",
    value: function replace(from, to, slice) {
      return (0, _replace2.replace)(this.resolve(from), this.resolve(to), slice);
    }

    // :: (number) → ?Node
    // Find the node after the given position.

  }, {
    key: "nodeAt",
    value: function nodeAt(pos) {
      for (var node = this;;) {
        var _node$content$findInd = node.content.findIndex(pos);

        var index = _node$content$findInd.index;
        var offset = _node$content$findInd.offset;

        node = node.maybeChild(index);
        if (!node) return null;
        if (offset == pos || node.isText) return node;
        pos -= offset + 1;
      }
    }

    // :: (number) → {node: ?Node, index: number, offset: number}
    // Find the (direct) child node after the given offset, if any,
    // and return it along with its index and offset relative to this
    // node.

  }, {
    key: "childAfter",
    value: function childAfter(pos) {
      var _content$findIndex = this.content.findIndex(pos);

      var index = _content$findIndex.index;
      var offset = _content$findIndex.offset;

      return { node: this.content.maybeChild(index), index: index, offset: offset };
    }

    // :: (number) → {node: ?Node, index: number, offset: number}
    // Find the (direct) child node before the given offset, if any,
    // and return it along with its index and offset relative to this
    // node.

  }, {
    key: "childBefore",
    value: function childBefore(pos) {
      if (pos == 0) return { node: null, index: 0, offset: 0 };

      var _content$findIndex2 = this.content.findIndex(pos);

      var index = _content$findIndex2.index;
      var offset = _content$findIndex2.offset;

      if (offset < pos) return { node: this.content.child(index), index: index, offset: offset };
      var node = this.content.child(index - 1);
      return { node: node, index: index - 1, offset: offset - node.nodeSize };
    }

    // :: (?number, ?number, (node: Node, pos: number, parent: Node))
    // Iterate over all nodes between the given two positions, calling
    // the callback with the node, its position, and its parent
    // node.

  }, {
    key: "nodesBetween",
    value: function nodesBetween(from, to, f) {
      var pos = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];

      this.content.nodesBetween(from, to, f, pos, this);
    }

    // :: ((node: Node, pos: number, parent: Node))
    // Call the given callback for every descendant node.

  }, {
    key: "descendants",
    value: function descendants(f) {
      this.nodesBetween(0, this.content.size, f);
    }

    // :: (number) → ResolvedPos
    // Resolve the given position in the document, returning an object
    // describing its path through the document.

  }, {
    key: "resolve",
    value: function resolve(pos) {
      return _resolvedpos.ResolvedPos.resolveCached(this, pos);
    }
  }, {
    key: "resolveNoCache",
    value: function resolveNoCache(pos) {
      return _resolvedpos.ResolvedPos.resolve(this, pos);
    }

    // :: (number) → [Mark]
    // Get the marks at the given position factoring in the surrounding marks'
    // inclusiveLeft and inclusiveRight properties. If the position is at the
    // start of a non-empty node, the marks of the node after it are returned.

  }, {
    key: "marksAt",
    value: function marksAt(pos) {
      var $pos = this.resolve(pos),
          parent = $pos.parent,
          index = $pos.index($pos.depth);

      // In an empty parent, return the empty array
      if (parent.content.size == 0) return emptyArray;
      // When inside a text node or at the start of the parent node, return the node's marks
      if (index == 0 || !$pos.atNodeBoundary) return parent.child(index).marks;

      var marks = parent.child(index - 1).marks;
      for (var i = 0; i < marks.length; i++) {
        if (!marks[i].type.inclusiveRight) marks = marks[i--].removeFromSet(marks);
      }return marks;
    }

    // :: (?number, ?number, MarkType) → bool
    // Test whether a mark of the given type occurs in this document
    // between the two given positions.

  }, {
    key: "rangeHasMark",
    value: function rangeHasMark(from, to, type) {
      var found = false;
      this.nodesBetween(from, to, function (node) {
        if (type.isInSet(node.marks)) found = true;
        return !found;
      });
      return found;
    }

    // :: bool
    // True when this is a block (non-inline node)

  }, {
    key: "toString",


    // :: () → string
    // Return a string representation of this node for debugging
    // purposes.
    value: function toString() {
      var name = this.type.name;
      if (this.content.size) name += "(" + this.content.toStringInner() + ")";
      return wrapMarks(this.marks, name);
    }

    // :: () → Object
    // Return a JSON-serializeable representation of this node.

  }, {
    key: "toJSON",
    value: function toJSON() {
      var obj = { type: this.type.name };
      for (var _ in this.attrs) {
        obj.attrs = this.attrs;
        break;
      }
      if (this.content.size) obj.content = this.content.toJSON();
      if (this.marks.length) obj.marks = this.marks.map(function (n) {
        return n.toJSON();
      });
      return obj;
    }

    // :: (Schema, Object) → Node
    // Deserialize a node from its JSON representation.

  }, {
    key: "nodeSize",
    get: function get() {
      return this.type.contains ? 2 + this.content.size : 1;
    }

    // :: number
    // The number of children that the node has.

  }, {
    key: "childCount",
    get: function get() {
      return this.content.childCount;
    }
  }, {
    key: "textContent",
    get: function get() {
      return this.content.textContent;
    }

    // :: ?Node
    // Returns this node's first child, or `null` if there are no
    // children.

  }, {
    key: "firstChild",
    get: function get() {
      return this.content.firstChild;
    }

    // :: ?Node
    // Returns this node's last child, or `null` if there are no
    // children.

  }, {
    key: "lastChild",
    get: function get() {
      return this.content.lastChild;
    }
  }, {
    key: "isBlock",
    get: function get() {
      return this.type.isBlock;
    }

    // :: bool
    // True when this is a textblock node, a block node with inline
    // content.

  }, {
    key: "isTextblock",
    get: function get() {
      return this.type.isTextblock;
    }

    // :: bool
    // True when this is an inline node (a text node or a node that can
    // appear among text).

  }, {
    key: "isInline",
    get: function get() {
      return this.type.isInline;
    }

    // :: bool
    // True when this is a text node.

  }, {
    key: "isText",
    get: function get() {
      return this.type.isText;
    }
  }, {
    key: "value",


    // This is a hack to be able to treat a node object as an iterator result
    get: function get() {
      return this;
    }
  }], [{
    key: "sameAttrs",
    value: function sameAttrs(a, b) {
      if (a == b) return true;
      for (var prop in a) {
        if (a[prop] !== b[prop]) return false;
      }return true;
    }
  }, {
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      var type = schema.nodeType(json.type);
      var content = json.text != null ? json.text : _fragment.Fragment.fromJSON(schema, json.content);
      return type.create(json.attrs, content, json.marks && json.marks.map(schema.markFromJSON));
    }
  }]);

  return Node;
}();

// ;; #forward=Node


var TextNode = exports.TextNode = function (_Node) {
  _inherits(TextNode, _Node);

  function TextNode(type, attrs, content, marks) {
    _classCallCheck(this, TextNode);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(TextNode).call(this, type, attrs, null, marks));

    if (!content) throw new RangeError("Empty text nodes are not allowed");

    // :: ?string
    // For text nodes, this contains the node's text content.
    _this.text = content;
    return _this;
  }

  _createClass(TextNode, [{
    key: "toString",
    value: function toString() {
      return wrapMarks(this.marks, JSON.stringify(this.text));
    }
  }, {
    key: "mark",
    value: function mark(marks) {
      return new TextNode(this.type, this.attrs, this.text, marks);
    }
  }, {
    key: "cut",
    value: function cut() {
      var from = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];
      var to = arguments.length <= 1 || arguments[1] === undefined ? this.text.length : arguments[1];

      if (from == 0 && to == this.text.length) return this;
      return this.copy(this.text.slice(from, to));
    }
  }, {
    key: "eq",
    value: function eq(other) {
      return this.sameMarkup(other) && this.text == other.text;
    }
  }, {
    key: "toJSON",
    value: function toJSON() {
      var base = _get(Object.getPrototypeOf(TextNode.prototype), "toJSON", this).call(this);
      base.text = this.text;
      return base;
    }
  }, {
    key: "textContent",
    get: function get() {
      return this.text;
    }
  }, {
    key: "nodeSize",
    get: function get() {
      return this.text.length;
    }
  }]);

  return TextNode;
}(Node);

function wrapMarks(marks, str) {
  for (var i = marks.length - 1; i >= 0; i--) {
    str = marks[i].type.name + "(" + str + ")";
  }return str;
}
},{"./fragment":32,"./mark":34,"./replace":36,"./resolvedpos":37}],36:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Slice = exports.ReplaceError = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.replace = replace;

var _error = require("../util/error");

var _fragment = require("./fragment");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// ;; Error type raised by `Node.replace` when given an invalid
// replacement.

var ReplaceError = exports.ReplaceError = function (_ProseMirrorError) {
  _inherits(ReplaceError, _ProseMirrorError);

  function ReplaceError() {
    _classCallCheck(this, ReplaceError);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(ReplaceError).apply(this, arguments));
  }

  return ReplaceError;
}(_error.ProseMirrorError);

// ;; A slice represents a piece cut out of a larger document. It
// stores not only a fragment, but also the depth up to which nodes on
// both side are 'open' / cut through.


var Slice = exports.Slice = function () {
  // :: (Fragment, number, number)

  function Slice(content, openLeft, openRight, possibleParent) {
    _classCallCheck(this, Slice);

    // :: Fragment The slice's content nodes.
    this.content = content;
    // :: number The open depth at the start.
    this.openLeft = openLeft;
    // :: number The open depth at the end.
    this.openRight = openRight;
    this.possibleParent = possibleParent;
  }

  // :: number
  // The size this slice would add when inserted into a document.


  _createClass(Slice, [{
    key: "toJSON",


    // :: () → ?Object
    // Convert a slice to a JSON-serializable representation.
    value: function toJSON() {
      if (!this.content.size) return null;
      return { content: this.content.toJSON(),
        openLeft: this.openLeft,
        openRight: this.openRight };
    }

    // :: (Schema, ?Object) → Slice
    // Deserialize a slice from its JSON representation.

  }, {
    key: "size",
    get: function get() {
      return this.content.size - this.openLeft - this.openRight;
    }
  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      if (!json) return Slice.empty;
      return new Slice(_fragment.Fragment.fromJSON(schema, json.content), json.openLeft, json.openRight);
    }
  }]);

  return Slice;
}();

// :: Slice
// The empty slice.


Slice.empty = new Slice(_fragment.Fragment.empty, 0, 0);

function replace($from, $to, slice) {
  if (slice.openLeft > $from.depth) throw new ReplaceError("Inserted content deeper than insertion position");
  if ($from.depth - slice.openLeft != $to.depth - slice.openRight) throw new ReplaceError("Inconsistent open depths");
  return replaceOuter($from, $to, slice, 0);
}

function replaceOuter($from, $to, slice, depth) {
  var index = $from.index(depth),
      node = $from.node(depth);
  if (index == $to.index(depth) && depth < $from.depth - slice.openLeft) {
    var inner = replaceOuter($from, $to, slice, depth + 1);
    return node.copy(node.content.replaceChild(index, inner));
  } else if (slice.content.size) {
    var _prepareSliceForRepla = prepareSliceForReplace(slice, $from);

    var start = _prepareSliceForRepla.start;
    var end = _prepareSliceForRepla.end;

    return close(node, replaceThreeWay($from, start, end, $to, depth));
  } else {
    return close(node, replaceTwoWay($from, $to, depth));
  }
}

function checkJoin(main, sub) {
  if (!main.type.canContainContent(sub.type)) throw new ReplaceError("Cannot join " + sub.type.name + " onto " + main.type.name);
}

function joinable($before, $after, depth) {
  var node = $before.node(depth);
  checkJoin(node, $after.node(depth));
  return node;
}

function addNode(child, target) {
  var last = target.length - 1;
  if (last >= 0 && child.isText && child.sameMarkup(target[last])) target[last] = child.copy(target[last].text + child.text);else target.push(child);
}

function addRange($start, $end, depth, target) {
  var node = ($end || $start).node(depth);
  var startIndex = 0,
      endIndex = $end ? $end.index(depth) : node.childCount;
  if ($start) {
    startIndex = $start.index(depth);
    if ($start.depth > depth) {
      startIndex++;
    } else if (!$start.atNodeBoundary) {
      addNode($start.nodeAfter, target);
      startIndex++;
    }
  }
  for (var i = startIndex; i < endIndex; i++) {
    addNode(node.child(i), target);
  }if ($end && $end.depth == depth && !$end.atNodeBoundary) addNode($end.nodeBefore, target);
}

function close(node, content) {
  if (!node.type.checkContent(content, node.attrs)) throw new ReplaceError("Invalid content for node " + node.type.name);
  return node.copy(content);
}

function replaceThreeWay($from, $start, $end, $to, depth) {
  var openLeft = $from.depth > depth && joinable($from, $start, depth + 1);
  var openRight = $to.depth > depth && joinable($end, $to, depth + 1);

  var content = [];
  addRange(null, $from, depth, content);
  if (openLeft && openRight && $start.index(depth) == $end.index(depth)) {
    checkJoin(openLeft, openRight);
    addNode(close(openLeft, replaceThreeWay($from, $start, $end, $to, depth + 1)), content);
  } else {
    if (openLeft) addNode(close(openLeft, replaceTwoWay($from, $start, depth + 1)), content);
    addRange($start, $end, depth, content);
    if (openRight) addNode(close(openRight, replaceTwoWay($end, $to, depth + 1)), content);
  }
  addRange($to, null, depth, content);
  return new _fragment.Fragment(content);
}

function replaceTwoWay($from, $to, depth) {
  var content = [];
  addRange(null, $from, depth, content);
  if ($from.depth > depth) {
    var type = joinable($from, $to, depth + 1);
    addNode(close(type, replaceTwoWay($from, $to, depth + 1)), content);
  }
  addRange($to, null, depth, content);
  return new _fragment.Fragment(content);
}

function prepareSliceForReplace(slice, $along) {
  var extra = $along.depth - slice.openLeft,
      parent = $along.node(extra);
  if (!parent.type.canContainFragment(slice.content)) throw new ReplaceError("Content " + slice.content + " cannot be placed in " + parent.type.name);
  var node = parent.copy(slice.content);
  for (var i = extra - 1; i >= 0; i--) {
    node = $along.node(i).copy(_fragment.Fragment.from(node));
  }return { start: node.resolveNoCache(slice.openLeft + extra),
    end: node.resolveNoCache(node.content.size - slice.openRight - extra) };
}
},{"../util/error":50,"./fragment":32}],37:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; The usual way to represent positions in a document is with a
// plain integer. Since those tell you very little about the context
// of that position, you'll often have to 'resolve' a position to get
// the context you need. Objects of this class represent such a
// resolved position, providing various pieces of context information
// and helper methods.

var ResolvedPos = exports.ResolvedPos = function () {
  function ResolvedPos(pos, path, parentOffset) {
    _classCallCheck(this, ResolvedPos);

    // :: number The position that was resolved.
    this.pos = pos;
    this.path = path;
    // :: number
    // The number of levels the parent node is from the root. If this
    // position points directly into the root, it is 0. If it points
    // into a top-level paragraph, 1, and so on.
    this.depth = path.length / 3 - 1;
    // :: number The offset this position has into its parent node.
    this.parentOffset = parentOffset;
  }

  // :: Node
  // The parent node that the position points into. Note that even if
  // a position points into a text node, that node is not considered
  // the parent—text nodes are 'flat' in this model.


  _createClass(ResolvedPos, [{
    key: "node",


    // :: (number) → Node
    // The ancestor node at the given level. `p.node(p.depth)` is the
    // same as `p.parent`.
    value: function node(depth) {
      return this.path[depth * 3];
    }

    // :: (number) → number
    // The index into the ancestor at the given level. If this points at
    // the 3rd node in the 2nd paragraph on the top level, for example,
    // `p.index(0)` is 2 and `p.index(1)` is 3.

  }, {
    key: "index",
    value: function index(depth) {
      return this.path[depth * 3 + 1];
    }

    // :: (number) → number
    // The (absolute) position at the start of the node at the given
    // level.

  }, {
    key: "start",
    value: function start(depth) {
      return depth == 0 ? 0 : this.path[depth * 3 - 1] + 1;
    }

    // :: (number) → number
    // The (absolute) position at the end of the node at the given
    // level.

  }, {
    key: "end",
    value: function end(depth) {
      return this.start(depth) + this.node(depth).content.size;
    }

    // :: (number) → number
    // The (absolute) position directly before the node at the given
    // level, or, when `level` is `this.level + 1`, the original
    // position.

  }, {
    key: "before",
    value: function before(depth) {
      if (!depth) throw new RangeError("There is no position before the top-level node");
      return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1];
    }

    // :: (number) → number
    // The (absolute) position directly after the node at the given
    // level, or, when `level` is `this.level + 1`, the original
    // position.

  }, {
    key: "after",
    value: function after(depth) {
      if (!depth) throw new RangeError("There is no position after the top-level node");
      return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1] + this.path[depth * 3].nodeSize;
    }

    // :: bool
    // True if this position points at a node boundary, false if it
    // points into a text node.

  }, {
    key: "sameDepth",


    // :: (ResolvedPos) → number
    // The depth up to which this position and the other share the same
    // parent nodes.
    value: function sameDepth(other) {
      var depth = 0,
          max = Math.min(this.depth, other.depth);
      while (depth < max && this.index(depth) == other.index(depth)) {
        ++depth;
      }return depth;
    }

    // :: (ResolvedPos) → bool
    // Query whether the given position shares the same parent node.

  }, {
    key: "sameParent",
    value: function sameParent(other) {
      return this.pos - this.parentOffset == other.pos - other.parentOffset;
    }
  }, {
    key: "toString",
    value: function toString() {
      var str = "";
      for (var i = 1; i <= this.depth; i++) {
        str += (str ? "/" : "") + this.node(i).type.name + "_" + this.index(i - 1);
      }return str + ":" + this.parentOffset;
    }
  }, {
    key: "parent",
    get: function get() {
      return this.node(this.depth);
    }
  }, {
    key: "atNodeBoundary",
    get: function get() {
      return this.path[this.path.length - 1] == this.pos;
    }

    // :: ?Node
    // Get the node directly after the position, if any. If the position
    // points into a text node, only the part of that node after the
    // position is returned.

  }, {
    key: "nodeAfter",
    get: function get() {
      var parent = this.parent,
          index = this.index(this.depth);
      if (index == parent.childCount) return null;
      var dOff = this.pos - this.path[this.path.length - 1],
          child = parent.child(index);
      return dOff ? parent.child(index).cut(dOff) : child;
    }

    // :: ?Node
    // Get the node directly before the position, if any. If the
    // position points into a text node, only the part of that node
    // before the position is returned.

  }, {
    key: "nodeBefore",
    get: function get() {
      var index = this.index(this.depth);
      var dOff = this.pos - this.path[this.path.length - 1];
      if (dOff) return this.parent.child(index).cut(0, dOff);
      return index == 0 ? null : this.parent.child(index - 1);
    }
  }], [{
    key: "resolve",
    value: function resolve(doc, pos) {
      if (!(pos >= 0 && pos <= doc.content.size)) throw new RangeError("Position " + pos + " out of range");
      var path = [];
      var start = 0,
          parentOffset = pos;
      for (var node = doc;;) {
        var _node$content$findInd = node.content.findIndex(parentOffset);

        var index = _node$content$findInd.index;
        var offset = _node$content$findInd.offset;

        var rem = parentOffset - offset;
        path.push(node, index, start + offset);
        if (!rem) break;
        node = node.child(index);
        if (node.isText) break;
        parentOffset = rem - 1;
        start += offset + 1;
      }
      return new ResolvedPos(pos, path, parentOffset);
    }
  }, {
    key: "resolveCached",
    value: function resolveCached(doc, pos) {
      for (var i = 0; i < resolveCache.length; i++) {
        var cached = resolveCache[i];
        if (cached.pos == pos && cached.node(0) == doc) return cached;
      }
      var result = resolveCache[resolveCachePos] = ResolvedPos.resolve(doc, pos);
      resolveCachePos = (resolveCachePos + 1) % resolveCacheSize;
      return result;
    }
  }]);

  return ResolvedPos;
}();

var resolveCache = [],
    resolveCachePos = 0,
    resolveCacheSize = 6;
},{}],38:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Schema = exports.SchemaSpec = exports.MarkType = exports.Attribute = exports.Text = exports.Inline = exports.Textblock = exports.Block = exports.NodeKind = exports.NodeType = undefined;

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _node = require("./node");

var _fragment = require("./fragment");

var _mark = require("./mark");

var _obj = require("../util/obj");

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; The [node](#NodeType) and [mark](#MarkType) types
// that make up a schema have several things in common—they support
// attributes, and you can [register](#SchemaItem.register) values
// with them. This class implements this functionality, and acts as a
// superclass to those `NodeType` and `MarkType`.

var SchemaItem = function () {
  function SchemaItem() {
    _classCallCheck(this, SchemaItem);
  }

  _createClass(SchemaItem, [{
    key: "getDefaultAttrs",


    // For node types where all attrs have a default value (or which don't
    // have any attributes), build up a single reusable default attribute
    // object, and use it for all nodes that don't specify specific
    // attributes.
    value: function getDefaultAttrs() {
      var defaults = Object.create(null);
      for (var attrName in this.attrs) {
        var attr = this.attrs[attrName];
        if (attr.default == null) return null;
        defaults[attrName] = attr.default;
      }
      return defaults;
    }
  }, {
    key: "computeAttrs",
    value: function computeAttrs(attrs, arg) {
      var built = Object.create(null);
      for (var name in this.attrs) {
        var value = attrs && attrs[name];
        if (value == null) {
          var attr = this.attrs[name];
          if (attr.default != null) value = attr.default;else if (attr.compute) value = attr.compute(this, arg);else throw new RangeError("No value supplied for attribute " + name);
        }
        built[name] = value;
      }
      return built;
    }
  }, {
    key: "freezeAttrs",
    value: function freezeAttrs() {
      var frozen = Object.create(null);
      for (var name in this.attrs) {
        frozen[name] = this.attrs[name];
      }Object.defineProperty(this, "attrs", { value: frozen });
    }
  }, {
    key: "attrs",

    // :: Object<Attribute>
    // The set of attributes to associate with each node or mark of this
    // type.
    get: function get() {
      return {};
    }

    // :: (Object<?Attribute>)
    // Add or remove attributes from this type. Expects an object
    // mapping names to either attributes (to add) or null (to remove
    // the attribute by that name).

  }], [{
    key: "updateAttrs",
    value: function updateAttrs(attrs) {
      Object.defineProperty(this.prototype, "attrs", { value: overlayObj(this.prototype.attrs, attrs) });
    }
  }, {
    key: "getRegistry",
    value: function getRegistry() {
      if (this == SchemaItem) return null;
      if (!this.prototype.hasOwnProperty("registry")) this.prototype.registry = Object.create(Object.getPrototypeOf(this).getRegistry());
      return this.prototype.registry;
    }
  }, {
    key: "getNamespace",
    value: function getNamespace(name) {
      if (this == SchemaItem) return null;
      var reg = this.getRegistry();
      if (!Object.prototype.hasOwnProperty.call(reg, name)) reg[name] = Object.create(Object.getPrototypeOf(this).getNamespace(name));
      return reg[name];
    }

    // :: (string, string, *)
    // Register a value in this type's registry. Various components use
    // `Schema.registry` to query values from the marks and nodes that
    // make up the schema. The `namespace`, for example
    // [`"command"`](#commands), determines which component will see
    // this value. `name` is a name specific to this value. Its meaning
    // differs per namespace.
    //
    // Subtypes inherit the registered values from their supertypes.
    // They can override individual values by calling this method to
    // overwrite them with a new value, or with `null` to disable them.

  }, {
    key: "register",
    value: function register(namespace, name, value) {
      this.getNamespace(namespace)[name] = function () {
        return value;
      };
    }

    // :: (string, string, (SchemaItem) → *)
    // Register a value in this types's registry, like
    // [`register`](#SchemaItem.register), but providing a function that
    // will be called with the actual node or mark type, whose return
    // value will be treated as the effective value (or will be ignored,
    // if `null`).

  }, {
    key: "registerComputed",
    value: function registerComputed(namespace, name, f) {
      this.getNamespace(namespace)[name] = f;
    }

    // :: (string)
    // By default, schema items inherit the
    // [registered](#SchemaItem.register) items from their superclasses.
    // Call this to disable that behavior for the given namespace.

  }, {
    key: "cleanNamespace",
    value: function cleanNamespace(namespace) {
      this.getNamespace(namespace).__proto__ = null;
    }
  }]);

  return SchemaItem;
}();

// ;; Node types are objects allocated once per `Schema`
// and used to tag `Node` instances with a type. They are
// instances of sub-types of this class, and contain information about
// the node type (its name, its allowed attributes, methods for
// serializing it to various formats, information to guide
// deserialization, and so on).


var NodeType = exports.NodeType = function (_SchemaItem) {
  _inherits(NodeType, _SchemaItem);

  function NodeType(name, schema) {
    _classCallCheck(this, NodeType);

    // :: string
    // The name the node type has in this schema.

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(NodeType).call(this));

    _this.name = name;
    // Freeze the attributes, to avoid calling a potentially expensive
    // getter all the time.
    _this.freezeAttrs();
    _this.defaultAttrs = _this.getDefaultAttrs();
    // :: Schema
    // A link back to the `Schema` the node type belongs to.
    _this.schema = schema;
    return _this;
  }

  // :: bool
  // True if this is a block type.


  _createClass(NodeType, [{
    key: "canContainFragment",


    // :: (Fragment) → bool
    // Test whether the content of the given fragment could be contained
    // in this node type.
    value: function canContainFragment(fragment) {
      for (var i = 0; i < fragment.childCount; i++) {
        if (!this.canContain(fragment.child(i))) return false;
      }return true;
    }

    // :: (Node) → bool
    // Test whether the given node could be contained in this node type.

  }, {
    key: "canContain",
    value: function canContain(node) {
      if (!this.canContainType(node.type)) return false;
      for (var i = 0; i < node.marks.length; i++) {
        if (!this.canContainMark(node.marks[i])) return false;
      }return true;
    }

    // :: (MarkType) → bool
    // Test whether this node type can contain children with the given
    // mark type.

  }, {
    key: "canContainMark",
    value: function canContainMark(mark) {
      var contains = this.containsMarks;
      if (contains === true) return true;
      if (contains) for (var i = 0; i < contains.length; i++) {
        if (contains[i] == mark.name) return true;
      }return false;
    }

    // :: (NodeType) → bool
    // Test whether this node type can contain nodes of the given node
    // type.

  }, {
    key: "canContainType",
    value: function canContainType(type) {
      return type.kind && type.kind.isSubKind(this.contains);
    }

    // :: (NodeType) → bool
    // Test whether the nodes that can be contained in the given node
    // type are a sub-type of the nodes that can be contained in this
    // type.

  }, {
    key: "canContainContent",
    value: function canContainContent(type) {
      return type.contains && type.contains.isSubKind(this.contains);
    }

    // :: (NodeType) → ?[NodeType]
    // Find a set of intermediate node types, possibly empty, that have
    // to be inserted between this type and `other` to put a node of
    // type `other` into this type.

  }, {
    key: "findConnection",
    value: function findConnection(other) {
      return other.kind && this.findConnectionToKind(other.kind);
    }
  }, {
    key: "findConnectionToKind",
    value: function findConnectionToKind(kind) {
      var cache = this.schema.cached.connections,
          key = this.name + "-" + kind.id;
      if (key in cache) return cache[key];
      return cache[key] = this.findConnectionToKindInner(kind);
    }
  }, {
    key: "findConnectionToKindInner",
    value: function findConnectionToKindInner(kind) {
      if (kind.isSubKind(this.contains)) return [];

      var seen = Object.create(null);
      var active = [{ from: this, via: [] }];
      while (active.length) {
        var current = active.shift();
        for (var name in this.schema.nodes) {
          var type = this.schema.nodes[name];
          if (type.contains && type.defaultAttrs && !(type.contains.id in seen) && current.from.canContainType(type)) {
            var via = current.via.concat(type);
            if (kind.isSubKind(type.contains)) return via;
            active.push({ from: type, via: via });
            seen[type.contains.id] = true;
          }
        }
      }
    }
  }, {
    key: "computeAttrs",
    value: function computeAttrs(attrs, content) {
      if (!attrs && this.defaultAttrs) return this.defaultAttrs;else return _get(Object.getPrototypeOf(NodeType.prototype), "computeAttrs", this).call(this, attrs, content);
    }

    // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
    // Create a `Node` of this type. The given attributes are
    // checked and defaulted (you can pass `null` to use the type's
    // defaults entirely, if no required attributes exist). `content`
    // may be a `Fragment`, a node, an array of nodes, or
    // `null`. Similarly `marks` may be `null` to default to the empty
    // set of marks.

  }, {
    key: "create",
    value: function create(attrs, content, marks) {
      return new _node.Node(this, this.computeAttrs(attrs, content), _fragment.Fragment.from(content), _mark.Mark.setFrom(marks));
    }

    // FIXME use declarative schema, maybe tie in with .contains

  }, {
    key: "checkContent",
    value: function checkContent(content, _attrs) {
      if (content.size == 0) return this.canBeEmpty;
      for (var i = 0; i < content.childCount; i++) {
        if (!this.canContain(content.child(i))) return false;
      }return true;
    }
  }, {
    key: "fixContent",
    value: function fixContent(_content, _attrs) {
      return this.defaultContent();
    }

    // :: bool
    // Controls whether this node is allowed to be empty.

  }, {
    key: "isBlock",
    get: function get() {
      return false;
    }

    // :: bool
    // True if this is a textblock type, a block that contains inline
    // content.

  }, {
    key: "isTextblock",
    get: function get() {
      return false;
    }

    // :: bool
    // True if this is an inline type.

  }, {
    key: "isInline",
    get: function get() {
      return false;
    }

    // :: bool
    // True if this is the text node type.

  }, {
    key: "isText",
    get: function get() {
      return false;
    }

    // :: bool
    // Controls whether nodes of this type can be selected (as a user
    // node selection).

  }, {
    key: "selectable",
    get: function get() {
      return true;
    }

    // :: bool
    // Determines whether nodes of this type can be dragged. Enabling it
    // causes ProseMirror to set a `draggable` attribute on its DOM
    // representation, and to put its HTML serialization into the drag
    // event's [data
    // transfer](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer)
    // when dragged.

  }, {
    key: "draggable",
    get: function get() {
      return false;
    }

    // :: bool
    // Controls whether this node type is locked.

  }, {
    key: "locked",
    get: function get() {
      return false;
    }

    // :: ?NodeKind
    // The kind of nodes this node may contain. `null` means it's a
    // leaf node.

  }, {
    key: "contains",
    get: function get() {
      return null;
    }

    // :: ?NodeKind Sets the _kind_ of the node, which is used to
    // determine valid parent/child [relations](#NodeType.contains).
    // Should only be `null` for nodes that can't be child nodes (i.e.
    // the document top node).

  }, {
    key: "kind",
    get: function get() {
      return null;
    }
  }, {
    key: "canBeEmpty",
    get: function get() {
      return true;
    }
  }, {
    key: "containsMarks",


    // :: union<bool, [string]>
    // The mark types that child nodes of this node may have. `false`
    // means no marks, `true` means any mark, and an array of strings
    // can be used to explicitly list the allowed mark types.
    get: function get() {
      return false;
    }
  }], [{
    key: "compile",
    value: function compile(types, schema) {
      var result = Object.create(null);
      for (var name in types) {
        result[name] = new types[name](name, schema);
      }if (!result.doc) throw new RangeError("Every schema needs a 'doc' type");
      if (!result.text) throw new RangeError("Every schema needs a 'text' type");

      return result;
    }
  }]);

  return NodeType;
}(SchemaItem);

// ;; Class used to represent node [kind](#NodeType.kind).


var NodeKind = exports.NodeKind = function () {
  // :: (string, ?[NodeKind], ?[NodeKind])
  // Create a new node kind with the given set of superkinds (the new
  // kind counts as a member of each of the superkinds) and subkinds
  // (which will count as a member of this new kind). The `name` field
  // is only for debugging purposes—kind equivalens is defined by
  // identity.

  function NodeKind(name, supers, subs) {
    var _this2 = this;

    _classCallCheck(this, NodeKind);

    this.name = name;
    this.id = ++NodeKind.nextID;
    this.supers = Object.create(null);
    this.supers[this.id] = this;
    this.subs = subs || [];

    if (supers) supers.forEach(function (sup) {
      return _this2.addSuper(sup);
    });
    if (subs) subs.forEach(function (sub) {
      return _this2.addSub(sub);
    });
  }

  _createClass(NodeKind, [{
    key: "sharedSuperKind",
    value: function sharedSuperKind(other) {
      if (this.isSubKind(other)) return other;
      if (other.isSubKind(this)) return this;
      var found = undefined;
      for (var id in this.supers) {
        var shared = other.supers[id];
        if (shared && (!found || shared.isSupKind(found))) found = shared;
      }
      return found;
    }
  }, {
    key: "addSuper",
    value: function addSuper(sup) {
      for (var id in sup.supers) {
        this.supers[id] = sup.supers[id];
        sup.subs.push(this);
      }
    }
  }, {
    key: "addSub",
    value: function addSub(sub) {
      var _this3 = this;

      if (this.supers[sub.id]) throw new RangeError("Circular subkind relation");
      sub.supers[this.id] = true;
      sub.subs.forEach(function (next) {
        return _this3.addSub(next);
      });
    }

    // :: (NodeKind) → bool
    // Test whether `other` is a subkind of this kind (or the same
    // kind).

  }, {
    key: "isSubKind",
    value: function isSubKind(other) {
      return other && other.id in this.supers || false;
    }
  }]);

  return NodeKind;
}();

NodeKind.nextID = 0;

// :: NodeKind The node kind used for generic block nodes.
NodeKind.block = new NodeKind("block");

// :: NodeKind The node kind used for generic inline nodes.
NodeKind.inline = new NodeKind("inline");

// :: NodeKind The node kind used for text nodes. Subkind of
// `NodeKind.inline`.
NodeKind.text = new NodeKind("text", [NodeKind.inline]);

// ;; Base type for block nodetypes.

var Block = exports.Block = function (_NodeType) {
  _inherits(Block, _NodeType);

  function Block() {
    _classCallCheck(this, Block);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Block).apply(this, arguments));
  }

  _createClass(Block, [{
    key: "defaultContent",
    value: function defaultContent() {
      var inner = this.schema.defaultTextblockType().create();
      var conn = this.findConnection(inner.type);
      if (!conn) throw new RangeError("Can't create default content for " + this.name);
      for (var i = conn.length - 1; i >= 0; i--) {
        inner = conn[i].create(null, inner);
      }return _fragment.Fragment.from(inner);
    }
  }, {
    key: "contains",
    get: function get() {
      return NodeKind.block;
    }
  }, {
    key: "kind",
    get: function get() {
      return NodeKind.block;
    }
  }, {
    key: "isBlock",
    get: function get() {
      return true;
    }
  }, {
    key: "canBeEmpty",
    get: function get() {
      return this.contains == null;
    }
  }]);

  return Block;
}(NodeType);

// ;; Base type for textblock node types.


var Textblock = exports.Textblock = function (_Block) {
  _inherits(Textblock, _Block);

  function Textblock() {
    _classCallCheck(this, Textblock);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Textblock).apply(this, arguments));
  }

  _createClass(Textblock, [{
    key: "contains",
    get: function get() {
      return NodeKind.inline;
    }
  }, {
    key: "containsMarks",
    get: function get() {
      return true;
    }
  }, {
    key: "isTextblock",
    get: function get() {
      return true;
    }
  }, {
    key: "canBeEmpty",
    get: function get() {
      return true;
    }
  }]);

  return Textblock;
}(Block);

// ;; Base type for inline node types.


var Inline = exports.Inline = function (_NodeType2) {
  _inherits(Inline, _NodeType2);

  function Inline() {
    _classCallCheck(this, Inline);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Inline).apply(this, arguments));
  }

  _createClass(Inline, [{
    key: "kind",
    get: function get() {
      return NodeKind.inline;
    }
  }, {
    key: "isInline",
    get: function get() {
      return true;
    }
  }]);

  return Inline;
}(NodeType);

// ;; The text node type.


var Text = exports.Text = function (_Inline) {
  _inherits(Text, _Inline);

  function Text() {
    _classCallCheck(this, Text);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Text).apply(this, arguments));
  }

  _createClass(Text, [{
    key: "create",
    value: function create(attrs, content, marks) {
      return new _node.TextNode(this, this.computeAttrs(attrs, content), content, marks);
    }
  }, {
    key: "selectable",
    get: function get() {
      return false;
    }
  }, {
    key: "isText",
    get: function get() {
      return true;
    }
  }, {
    key: "kind",
    get: function get() {
      return NodeKind.text;
    }
  }]);

  return Text;
}(Inline);

// Attribute descriptors

// ;; Attributes are named strings associated with nodes and marks.
// Each node type or mark type has a fixed set of attributes, which
// instances of this class are used to control.


var Attribute =
// :: (Object)
// Create an attribute. `options` is an object containing the
// settings for the attributes. The following settings are
// supported:
//
// **`default`**`: ?string`
//   : The default value for this attribute, to choose when no
//     explicit value is provided.
//
// **`compute`**`: ?(Fragment) → string`
//   : A function that computes a default value for the attribute from
//     the node's content.
//
// **`label`**`: ?string`
//   : A user-readable text label associated with the attribute.
//
// Attributes that have no default or compute property must be
// provided whenever a node or mark of a type that has them is
// created.
exports.Attribute = function Attribute() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  _classCallCheck(this, Attribute);

  this.default = options.default;
  this.compute = options.compute;
  this.label = options.label;
};

// Marks

// ;; Like nodes, marks (which are associated with nodes to signify
// things like emphasis or being part of a link) are tagged with type
// objects, which are instantiated once per `Schema`.


var MarkType = exports.MarkType = function (_SchemaItem2) {
  _inherits(MarkType, _SchemaItem2);

  function MarkType(name, rank, schema) {
    _classCallCheck(this, MarkType);

    // :: string
    // The name of the mark type.

    var _this8 = _possibleConstructorReturn(this, Object.getPrototypeOf(MarkType).call(this));

    _this8.name = name;
    _this8.freezeAttrs();
    _this8.rank = rank;
    // :: Schema
    // The schema that this mark type instance is part of.
    _this8.schema = schema;
    var defaults = _this8.getDefaultAttrs();
    _this8.instance = defaults && new _mark.Mark(_this8, defaults);
    return _this8;
  }

  // :: number
  // Mark type ranks are used to determine the order in which mark
  // arrays are sorted. (If multiple mark types end up with the same
  // rank, they still get a fixed order in the schema, but there's no
  // guarantee what it will be.)


  _createClass(MarkType, [{
    key: "create",


    // :: (?Object) → Mark
    // Create a mark of this type. `attrs` may be `null` or an object
    // containing only some of the mark's attributes. The others, if
    // they have defaults, will be added.
    value: function create(attrs) {
      if (!attrs && this.instance) return this.instance;
      return new _mark.Mark(this, this.computeAttrs(attrs));
    }
  }, {
    key: "removeFromSet",


    // :: ([Mark]) → [Mark]
    // When there is a mark of this type in the given set, a new set
    // without it is returned. Otherwise, the input set is returned.
    value: function removeFromSet(set) {
      for (var i = 0; i < set.length; i++) {
        if (set[i].type == this) return set.slice(0, i).concat(set.slice(i + 1));
      }return set;
    }

    // :: ([Mark]) → ?Mark
    // Tests whether there is a mark of this type in the given set.

  }, {
    key: "isInSet",
    value: function isInSet(set) {
      for (var i = 0; i < set.length; i++) {
        if (set[i].type == this) return set[i];
      }
    }
  }, {
    key: "inclusiveRight",


    // :: bool
    // Whether this mark should be active when the cursor is positioned
    // at the end of the mark.
    get: function get() {
      return true;
    }
  }], [{
    key: "getOrder",
    value: function getOrder(marks) {
      var sorted = [];
      for (var name in marks) {
        sorted.push({ name: name, rank: marks[name].rank });
      }sorted.sort(function (a, b) {
        return a.rank - b.rank;
      });
      var ranks = Object.create(null);
      for (var i = 0; i < sorted.length; i++) {
        ranks[sorted[i].name] = i;
      }return ranks;
    }
  }, {
    key: "compile",
    value: function compile(marks, schema) {
      var order = this.getOrder(marks);
      var result = Object.create(null);
      for (var name in marks) {
        result[name] = new marks[name](name, order[name], schema);
      }return result;
    }
  }, {
    key: "rank",
    get: function get() {
      return 50;
    }
  }]);

  return MarkType;
}(SchemaItem);

// Schema specifications are data structures that specify a schema --
// a set of node types, their names, attributes, and nesting behavior.

// ;; A schema specification is a blueprint for an actual
// `Schema`. It maps names to node and mark types.
//
// A specification consists of an object that associates node names
// with node type constructors and another similar object associating
// mark names with mark type constructors.


var SchemaSpec = exports.SchemaSpec = function () {
  // :: (?Object<constructor<NodeType>>, ?Object<constructor<MarkType>>)
  // Create a schema specification from scratch. The arguments map
  // node names to node type constructors and mark names to mark type
  // constructors.

  function SchemaSpec(nodes, marks) {
    _classCallCheck(this, SchemaSpec);

    this.nodes = nodes || {};
    this.marks = marks || {};
  }

  // :: (?Object<?NodeType>, ?Object<?MarkType>) → SchemaSpec
  // Base a new schema spec on this one by specifying nodes and marks
  // to add or remove.
  //
  // When `nodes` is passed, it should be an object mapping type names
  // to either `null`, to delete the type of that name, or to a
  // `NodeType` subclass, to add or replace the node type of that
  // name.
  //
  // Similarly, `marks` can be an object to add, change, or remove
  // [mark types](#MarkType) in the schema.


  _createClass(SchemaSpec, [{
    key: "update",
    value: function update(nodes, marks) {
      return new SchemaSpec(nodes ? overlayObj(this.nodes, nodes) : this.nodes, marks ? overlayObj(this.marks, marks) : this.marks);
    }
  }]);

  return SchemaSpec;
}();

function overlayObj(base, update) {
  var copy = (0, _obj.copyObj)(base);
  for (var name in update) {
    var value = update[name];
    if (value == null) delete copy[name];else copy[name] = value;
  }
  return copy;
}

// ;; Each document is based on a single schema, which provides the
// node and mark types that it is made up of (which, in turn,
// determine the structure it is allowed to have).

var Schema = function () {
  // :: (SchemaSpec)
  // Construct a schema from a specification.

  function Schema(spec) {
    _classCallCheck(this, Schema);

    // :: SchemaSpec
    // The specification on which the schema is based.
    this.spec = spec;

    // :: Object<NodeType>
    // An object mapping the schema's node names to node type objects.
    this.nodes = NodeType.compile(spec.nodes, this);
    // :: Object<MarkType>
    // A map from mark names to mark type objects.
    this.marks = MarkType.compile(spec.marks, this);
    for (var prop in this.nodes) {
      if (prop in this.marks) throw new RangeError(prop + " can not be both a node and a mark");
    } // :: Object
    // An object for storing whatever values modules may want to
    // compute and cache per schema. (If you want to store something
    // in it, try to use property names unlikely to clash.)
    this.cached = Object.create(null);
    this.cached.connections = Object.create(null);

    this.node = this.node.bind(this);
    this.text = this.text.bind(this);
    this.nodeFromJSON = this.nodeFromJSON.bind(this);
    this.markFromJSON = this.markFromJSON.bind(this);
  }

  // :: (union<string, NodeType>, ?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a node in this schema. The `type` may be a string or a
  // `NodeType` instance. Attributes will be extended
  // with defaults, `content` may be a `Fragment`,
  // `null`, a `Node`, or an array of nodes.
  //
  // When creating a text node, `content` should be a string and is
  // interpreted as the node's text.
  //
  // This method is bound to the Schema, meaning you don't have to
  // call it as a method, but can pass it to higher-order functions
  // and such.


  _createClass(Schema, [{
    key: "node",
    value: function node(type, attrs, content, marks) {
      if (typeof type == "string") type = this.nodeType(type);else if (!(type instanceof NodeType)) throw new RangeError("Invalid node type: " + type);else if (type.schema != this) throw new RangeError("Node type from different schema used (" + type.name + ")");

      return type.create(attrs, content, marks);
    }

    // :: (string, ?[Mark]) → Node
    // Create a text node in the schema. This method is bound to the
    // Schema. Empty text nodes are not allowed.

  }, {
    key: "text",
    value: function text(_text, marks) {
      return this.nodes.text.create(null, _text, _mark.Mark.setFrom(marks));
    }

    // :: () → ?NodeType
    // Return the default textblock type for this schema, or `null` if
    // it does not contain a node type with a `defaultTextblock`
    // property.

  }, {
    key: "defaultTextblockType",
    value: function defaultTextblockType() {
      var cached = this.cached.defaultTextblockType;
      if (cached !== undefined) return cached;
      for (var name in this.nodes) {
        if (this.nodes[name].defaultTextblock) return this.cached.defaultTextblockType = this.nodes[name];
      }
      return this.cached.defaultTextblockType = null;
    }

    // :: (string, ?Object) → Mark
    // Create a mark with the named type

  }, {
    key: "mark",
    value: function mark(name, attrs) {
      var spec = this.marks[name];
      if (!spec) throw new RangeError("No mark named " + name);
      return spec.create(attrs);
    }

    // :: (Object) → Node
    // Deserialize a node from its JSON representation. This method is
    // bound.

  }, {
    key: "nodeFromJSON",
    value: function nodeFromJSON(json) {
      return _node.Node.fromJSON(this, json);
    }

    // :: (Object) → Mark
    // Deserialize a mark from its JSON representation. This method is
    // bound.

  }, {
    key: "markFromJSON",
    value: function markFromJSON(json) {
      var type = this.marks[json._];
      var attrs = null;
      for (var prop in json) {
        if (prop != "_") {
          if (!attrs) attrs = Object.create(null);
          attrs[prop] = json[prop];
        }
      }return attrs ? type.create(attrs) : type.instance;
    }

    // :: (string) → NodeType
    // Get the `NodeType` associated with the given name in
    // this schema, or raise an error if it does not exist.

  }, {
    key: "nodeType",
    value: function nodeType(name) {
      var found = this.nodes[name];
      if (!found) throw new RangeError("Unknown node type: " + name);
      return found;
    }

    // :: (string, (name: string, value: *, source: union<NodeType, MarkType>, name: string))
    // Retrieve all registered items under the given name from this
    // schema. The given function will be called with the name, each item, the
    // element—node type or mark type—that it was associated with, and
    // that element's name in the schema.

  }, {
    key: "registry",
    value: function registry(namespace, f) {
      for (var i = 0; i < 2; i++) {
        var obj = i ? this.marks : this.nodes;
        for (var tname in obj) {
          var type = obj[tname],
              registry = type.registry,
              ns = registry && registry[namespace];
          if (ns) for (var prop in ns) {
            var value = ns[prop](type);
            if (value != null) f(prop, value, type, tname);
          }
        }
      }
    }
  }]);

  return Schema;
}();

exports.Schema = Schema;
},{"../util/obj":53,"./fragment":32,"./mark":34,"./node":35}],39:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.canLift = canLift;
exports.canWrap = canWrap;

var _model = require("../model");

var _transform = require("./transform");

var _step = require("./step");

var _map = require("./map");

// !! **`ancestor`**
//    : Change the stack of nodes that wrap the part of the document
//      between `from` and `to`, which must point into the same parent
//      node.
//
//      The set of ancestors to replace is determined by the `depth`
//      property of the step's parameter. If this is greater than
//      zero, `from` and `to` must point at the start and end of a
//      stack of nodes, of that depth, since this step will not split
//      nodes.
//
//      The set of new ancestors to wrap with is determined by the
//      `types` and `attrs` properties of the parameter. The first
//      should be an array of `NodeType`s, and the second, optionally,
//      an array of attribute objects.

function isFlatRange($from, $to) {
  if ($from.depth != $to.depth) return false;
  for (var i = 0; i < $from.depth; i++) {
    if ($from.index(i) != $to.index(i)) return false;
  }return $from.parentOffset <= $to.parentOffset;
}

_step.Step.define("ancestor", {
  apply: function apply(doc, step) {
    var $from = doc.resolve(step.from),
        $to = doc.resolve(step.to);
    if (!isFlatRange($from, $to)) return _step.StepResult.fail("Not a flat range");

    var _step$param = step.param;
    var _step$param$depth = _step$param.depth;
    var depth = _step$param$depth === undefined ? 0 : _step$param$depth;
    var _step$param$types = _step$param.types;
    var types = _step$param$types === undefined ? [] : _step$param$types;
    var _step$param$attrs = _step$param.attrs;
    var attrs = _step$param$attrs === undefined ? [] : _step$param$attrs;

    if (depth == 0 && types.length == 0) return _step.StepResult.ok(doc);

    for (var i = 0, d = $from.depth; i < depth; i++, d--) {
      if ($from.start(d) != $from.pos - i || $to.end(d) != $to.pos + i) return _step.StepResult.fail("Parent at depth " + d + " not fully covered");
    }var inner = $from.parent,
        slice = undefined;
    if (types.length) {
      var lastWrapper = types[types.length - 1];
      if (!lastWrapper.contains) throw new RangeError("Can not wrap content in node type " + lastWrapper.name);
      var content = inner.content.cut($from.parentOffset, $to.parentOffset);
      if (!lastWrapper.checkContent(content, attrs[types.length - 1])) return _step.StepResult.fail("Content can not be wrapped in ancestor " + lastWrapper.name);
      for (var i = types.length - 1; i >= 0; i--) {
        content = _model.Fragment.from(types[i].create(attrs[i], content));
      }slice = new _model.Slice(content, 0, 0);
    } else {
      slice = new _model.Slice(inner.content, 0, 0);
    }
    return _step.StepResult.fromReplace(doc, $from.pos - depth, $to.pos + depth, slice);
  },
  posMap: function posMap(step) {
    var depth = step.param.depth || 0,
        newDepth = step.param.types ? step.param.types.length : 0;
    if (depth == newDepth && depth < 2) return _map.PosMap.empty;
    return new _map.PosMap([step.from - depth, depth, newDepth, step.to, depth, newDepth]);
  },
  invert: function invert(step, oldDoc) {
    var types = [],
        attrs = [];
    var $from = oldDoc.resolve(step.from);
    var oldDepth = step.param.depth || 0,
        newDepth = step.param.types ? step.param.types.length : 0;
    for (var i = 0; i < oldDepth; i++) {
      var parent = $from.node($from.depth - i);
      types.unshift(parent.type);
      attrs.unshift(parent.attrs);
    }
    var dDepth = newDepth - oldDepth;
    return new _step.Step("ancestor", step.from + dDepth, step.to + dDepth, { depth: newDepth, types: types, attrs: attrs });
  },
  paramToJSON: function paramToJSON(param) {
    return { depth: param.depth,
      types: param.types && param.types.map(function (t) {
        return t.name;
      }),
      attrs: param.attrs };
  },
  paramFromJSON: function paramFromJSON(schema, json) {
    return { depth: json.depth,
      types: json.types && json.types.map(function (n) {
        return schema.nodeType(n);
      }),
      attrs: json.attrs };
  }
});

// :: (Node, number, ?number) → bool
// Tells you whether the range in the given positions' shared
// ancestor, or any of _its_ ancestor nodes, can be lifted out of a
// parent.
function canLift(doc, from, to) {
  return !!findLiftable(doc.resolve(from), doc.resolve(to == null ? from : to));
}

function rangeDepth(from, to) {
  var shared = from.sameDepth(to);
  if (from.node(shared).isTextblock) --shared;
  if (shared && from.before(shared) >= to.after(shared)) return null;
  return shared;
}

function findLiftable(from, to) {
  var shared = rangeDepth(from, to);
  if (shared == null) return null;
  var parent = from.node(shared);
  for (var depth = shared - 1; depth >= 0; --depth) {
    if (from.node(depth).type.canContainContent(parent.type)) return { depth: depth, shared: shared, unwrap: false };
  }if (parent.isBlock) for (var depth = shared - 1; depth >= 0; --depth) {
    var target = from.node(depth);
    for (var i = from.index(shared), e = Math.min(to.index(shared) + 1, parent.childCount); i < e; i++) {
      if (!target.type.canContainContent(parent.child(i).type)) continue;
    }return { depth: depth, shared: shared, unwrap: true };
  }
}

// :: (number, ?number, ?bool) → Transform
// Lift the nearest liftable ancestor of the [sibling
// range](#Node.siblingRange) of the given positions out of its parent
// (or do nothing if no such node exists). When `silent` is true, this
// won't raise an error when the lift is impossible.
_transform.Transform.prototype.lift = function (from) {
  var to = arguments.length <= 1 || arguments[1] === undefined ? from : arguments[1];
  var silent = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

  var $from = this.doc.resolve(from),
      $to = this.doc.resolve(to);
  var liftable = findLiftable($from, $to);
  if (!liftable) {
    if (!silent) throw new RangeError("No valid lift target");
    return this;
  }

  var depth = liftable.depth;
  var shared = liftable.shared;
  var unwrap = liftable.unwrap;

  var start = $from.before(shared + 1),
      end = $to.after(shared + 1);

  for (var d = shared; d > depth; d--) {
    if ($to.index(d) + 1 < $to.node(d).childCount) {
      this.split($to.after(d + 1), d - depth);
      break;
    }
  }for (var d = shared; d > depth; d--) {
    if ($from.index(d) > 0) {
      var cut = d - depth;
      this.split($from.before(d + 1), cut);
      start += 2 * cut;
      end += 2 * cut;
      break;
    }
  }if (unwrap) {
    var joinPos = start,
        parent = $from.node(shared);
    for (var i = $from.index(shared), e = $to.index(shared) + 1, first = true; i < e; i++, first = false) {
      if (!first) {
        this.join(joinPos);
        end -= 2;
      }
      joinPos += parent.child(i).nodeSize - (first ? 0 : 2);
    }
    shared++;
    start++;
    end--;
  }
  return this.step("ancestor", start, end, { depth: shared - depth });
};

// :: (Node, number, ?number, NodeType) → bool
// Determines whether the [sibling range](#Node.siblingRange) of the
// given positions can be wrapped in the given node type.
function canWrap(doc, from, to, type) {
  return !!checkWrap(doc.resolve(from), doc.resolve(to == null ? from : to), type);
}

function checkWrap($from, $to, type) {
  var shared = rangeDepth($from, $to);
  if (shared == null) return null;
  var parent = $from.node(shared);
  var around = parent.type.findConnection(type);
  var inside = type.findConnection(parent.child($from.index(shared)).type);
  if (around && inside) return { shared: shared, around: around, inside: inside };
}

// :: (number, ?number, NodeType, ?Object) → Transform
// Wrap the [sibling range](#Node.siblingRange) of the given positions
// in a node of the given type, with the given attributes (if
// possible).
_transform.Transform.prototype.wrap = function (from) {
  var to = arguments.length <= 1 || arguments[1] === undefined ? from : arguments[1];
  var type = arguments[2];
  var wrapAttrs = arguments[3];

  var $from = this.doc.resolve(from),
      $to = this.doc.resolve(to);
  var check = checkWrap($from, $to, type);
  if (!check) throw new RangeError("Wrap not possible");
  var shared = check.shared;
  var around = check.around;
  var inside = check.inside;


  var types = around.concat(type).concat(inside);
  var attrs = around.map(function () {
    return null;
  }).concat(wrapAttrs).concat(inside.map(function () {
    return null;
  }));
  var start = $from.before(shared + 1);
  this.step("ancestor", start, $to.after(shared + 1), { types: types, attrs: attrs });
  if (inside.length) {
    var splitPos = start + types.length,
        parent = $from.node(shared);
    for (var i = $from.index(shared), e = $to.index(shared) + 1, first = true; i < e; i++, first = false) {
      if (!first) this.split(splitPos, inside.length);
      splitPos += parent.child(i).nodeSize + (first ? 0 : 2 * inside.length);
    }
  }
  return this;
};

// :: (number, ?number, NodeType, ?Object) → Transform
// Set the type of all textblocks (partly) between `from` and `to` to
// the given node type with the given attributes.
_transform.Transform.prototype.setBlockType = function (from) {
  var to = arguments.length <= 1 || arguments[1] === undefined ? from : arguments[1];

  var _this = this;

  var type = arguments[2];
  var attrs = arguments[3];

  if (!type.isTextblock) throw new RangeError("Type given to setBlockType should be a textblock");
  this.doc.nodesBetween(from, to, function (node, pos) {
    if (node.isTextblock && !node.hasMarkup(type, attrs)) {
      // Ensure all markup that isn't allowed in the new node type is cleared
      var start = pos + 1,
          end = start + node.content.size;
      _this.clearMarkup(start, end, type);
      _this.step("ancestor", start, end, { depth: 1, types: [type], attrs: [attrs] });
      return false;
    }
  });
  return this;
};

// :: (number, ?NodeType, ?Object) → Transform
// Change the type and attributes of the node after `pos`.
_transform.Transform.prototype.setNodeType = function (pos, type, attrs) {
  var node = this.doc.nodeAt(pos);
  if (!node) throw new RangeError("No node at given position");
  if (!type) type = node.type;
  if (node.type.contains) return this.step("ancestor", pos + 1, pos + 1 + node.content.size, { depth: 1, types: [type], attrs: [attrs] });else return this.replaceWith(pos, pos + node.nodeSize, type.create(attrs, null, node.marks));
};
},{"../model":33,"./map":42,"./step":46,"./transform":47}],40:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Remapping = exports.MapResult = exports.PosMap = exports.joinable = exports.joinPoint = exports.canWrap = exports.canLift = exports.StepResult = exports.Step = exports.TransformError = exports.Transform = undefined;

var _transform = require("./transform");

Object.defineProperty(exports, "Transform", {
  enumerable: true,
  get: function get() {
    return _transform.Transform;
  }
});
Object.defineProperty(exports, "TransformError", {
  enumerable: true,
  get: function get() {
    return _transform.TransformError;
  }
});

var _step = require("./step");

Object.defineProperty(exports, "Step", {
  enumerable: true,
  get: function get() {
    return _step.Step;
  }
});
Object.defineProperty(exports, "StepResult", {
  enumerable: true,
  get: function get() {
    return _step.StepResult;
  }
});

var _ancestor = require("./ancestor");

Object.defineProperty(exports, "canLift", {
  enumerable: true,
  get: function get() {
    return _ancestor.canLift;
  }
});
Object.defineProperty(exports, "canWrap", {
  enumerable: true,
  get: function get() {
    return _ancestor.canWrap;
  }
});

var _join = require("./join");

Object.defineProperty(exports, "joinPoint", {
  enumerable: true,
  get: function get() {
    return _join.joinPoint;
  }
});
Object.defineProperty(exports, "joinable", {
  enumerable: true,
  get: function get() {
    return _join.joinable;
  }
});

var _map = require("./map");

Object.defineProperty(exports, "PosMap", {
  enumerable: true,
  get: function get() {
    return _map.PosMap;
  }
});
Object.defineProperty(exports, "MapResult", {
  enumerable: true,
  get: function get() {
    return _map.MapResult;
  }
});
Object.defineProperty(exports, "Remapping", {
  enumerable: true,
  get: function get() {
    return _map.Remapping;
  }
});

require("./mark");

require("./split");

require("./replace");
},{"./ancestor":39,"./join":41,"./map":42,"./mark":43,"./replace":44,"./split":45,"./step":46,"./transform":47}],41:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.joinable = joinable;
exports.joinPoint = joinPoint;

var _model = require("../model");

var _transform = require("./transform");

var _step = require("./step");

var _map = require("./map");

// !! **`join`**
//   : Join two block elements together. `from` and `to` must point at
//     the end of the first and start of the second element (so that
//     the intention is preserved even when the positions are mapped).

_step.Step.define("join", {
  apply: function apply(doc, step) {
    var $from = doc.resolve(step.from),
        $to = doc.resolve(step.to);
    if ($from.parentOffset < $from.parent.content.size || $to.parentOffset > 0 || $to.pos - $from.pos != 2) return _step.StepResult.fail("Join positions not around a split");
    return _step.StepResult.fromReplace(doc, $from.pos, $to.pos, _model.Slice.empty);
  },
  posMap: function posMap(step) {
    return new _map.PosMap([step.from, 2, 0]);
  },
  invert: function invert(step, doc) {
    var $before = doc.resolve(step.from),
        d1 = $before.depth - 1;
    var parentAfter = $before.node(d1).child($before.index(d1) + 1);
    var param = null;
    if (!$before.parent.sameMarkup(parentAfter)) param = { type: parentAfter.type, attrs: parentAfter.attrs };
    return new _step.Step("split", step.from, step.from, param);
  }
});

// :: (Node, number) → bool
// Test whether the blocks before and after a given position can be
// joined.
function joinable(doc, pos) {
  var $pos = doc.resolve(pos);
  return canJoin($pos.nodeBefore, $pos.nodeAfter);
}

function canJoin(a, b) {
  return a && b && !a.isText && a.type.contains && a.type.canContainContent(b.type);
}

// :: (Node, number, ?number) → ?number
// Find an ancestor of the given position that can be joined to the
// block before (or after if `dir` is positive). Returns the joinable
// point, if any.
function joinPoint(doc, pos) {
  var dir = arguments.length <= 2 || arguments[2] === undefined ? -1 : arguments[2];

  var $pos = doc.resolve(pos);
  for (var d = $pos.depth;; d--) {
    var before = undefined,
        after = undefined;
    if (d == $pos.depth) {
      before = $pos.nodeBefore;
      after = $pos.nodeAfter;
    } else if (dir > 0) {
      before = $pos.node(d + 1);
      after = $pos.node(d).maybeChild($pos.index(d) + 1);
    } else {
      before = $pos.node(d).maybeChild($pos.index(d) - 1);
      after = $pos.node(d + 1);
    }
    if (before && !before.isTextblock && canJoin(before, after)) return pos;
    if (d == 0) break;
    pos = dir < 0 ? $pos.before(d) : $pos.after(d);
  }
}

// :: (number, ?number, ?bool) → Transform
// Join the blocks around the given position. When `silent` is true,
// the method will return without raising an error if the position
// isn't a valid place to join.
_transform.Transform.prototype.join = function (pos) {
  var depth = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];
  var silent = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

  for (var i = 0; i < depth; i++) {
    var $pos = this.doc.resolve(pos);
    if ($pos.parentOffset == 0 || $pos.parentOffset == $pos.parent.content.size || !$pos.nodeBefore.type.canContainContent($pos.nodeAfter.type)) {
      if (!silent) throw new RangeError("Nothing to join at " + pos);
      break;
    }
    this.step("join", pos - 1, pos + 1);
    pos--;
  }
  return this;
};
},{"../model":33,"./map":42,"./step":46,"./transform":47}],42:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.mapThrough = mapThrough;
exports.mapThroughResult = mapThroughResult;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; #path=Mappable #kind=interface
// There are various things that positions can be mapped through.
// We'll denote those as 'mappable'. This is not an actual class in
// the codebase, only an agreed-on interface.

// :: (pos: number, bias: ?number) → number #path=Mappable.map
// Map a position through this object. When given, the `bias`
// determines in which direction to move when a chunk of content is
// inserted at or around the mapped position.

// :: (pos: number, bias: ?number) → MapResult #path=Mappable.mapResult
// Map a position, and return an object containing additional
// information about the mapping. The result's `deleted` field tells
// you whether the position was deleted (completely enclosed in a
// replaced range) during the mapping.

// Recovery values encode a range index and an offset. They are
// represented as numbers, because tons of them will be created when
// mapping, for example, a large number of marked ranges. The number's
// lower 16 bits provide the index, the remaining bits the offset.
//
// Note: We intentionally don't use bit shift operators to en- and
// decode these, since those clip to 32 bits, which we might in rare
// cases want to overflow. A 64-bit float can represent 48-bit
// integers precisely.

var lower16 = 0xffff;
var factor16 = Math.pow(2, 16);

function makeRecover(index, offset) {
  return index + offset * factor16;
}
function recoverIndex(value) {
  return value & lower16;
}
function recoverOffset(value) {
  return (value - (value & lower16)) / factor16;
}

// ;; The return value of mapping a position.

var MapResult = exports.MapResult = function MapResult(pos) {
  var deleted = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];
  var recover = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

  _classCallCheck(this, MapResult);

  // :: number The mapped version of the position.
  this.pos = pos;
  // :: bool Tells you whether the position was deleted, that is,
  // whether the step removed its surroundings from the document.
  this.deleted = deleted;
  this.recover = recover;
};

// ;; A position map, holding information about the way positions in
// the pre-step version of a document correspond to positions in the
// post-step version. This class implements `Mappable`.


var PosMap = exports.PosMap = function () {
  // :: ([number])
  // Create a position map. The modifications to the document are
  // represented as an array of numbers, in which each group of three
  // represents an [start, oldSize, newSize] chunk.

  function PosMap(ranges, inverted) {
    _classCallCheck(this, PosMap);

    this.ranges = ranges;
    this.inverted = inverted || false;
  }

  _createClass(PosMap, [{
    key: "recover",
    value: function recover(value) {
      var diff = 0,
          index = recoverIndex(value);
      if (!this.inverted) for (var i = 0; i < index; i++) {
        diff += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1];
      }return this.ranges[index * 3] + diff + recoverOffset(value);
    }

    // :: (number, ?number) → MapResult
    // Map the given position through this map. The `bias` parameter can
    // be used to control what happens when the transform inserted
    // content at (or around) this position—if `bias` is negative, the a
    // position before the inserted content will be returned, if it is
    // positive, a position after the insertion is returned.

  }, {
    key: "mapResult",
    value: function mapResult(pos, bias) {
      return this._map(pos, bias, false);
    }

    // :: (number, ?number) → number
    // Map the given position through this map, returning only the
    // mapped position.

  }, {
    key: "map",
    value: function map(pos, bias) {
      return this._map(pos, bias, true);
    }
  }, {
    key: "_map",
    value: function _map(pos, bias, simple) {
      var diff = 0,
          oldIndex = this.inverted ? 2 : 1,
          newIndex = this.inverted ? 1 : 2;
      for (var i = 0; i < this.ranges.length; i += 3) {
        var start = this.ranges[i] - (this.inverted ? diff : 0);
        if (start > pos) break;
        var oldSize = this.ranges[i + oldIndex],
            newSize = this.ranges[i + newIndex],
            end = start + oldSize;
        if (pos <= end) {
          var side = !oldSize ? bias : pos == start ? -1 : pos == end ? 1 : bias;
          var result = start + diff + (side < 0 ? 0 : newSize);
          if (simple) return result;
          var recover = makeRecover(i / 3, pos - start);
          return new MapResult(result, pos != start && pos != end, recover);
        }
        diff += newSize - oldSize;
      }
      return simple ? pos + diff : new MapResult(pos + diff);
    }
  }, {
    key: "touches",
    value: function touches(pos, recover) {
      var diff = 0,
          index = recoverIndex(recover);
      var oldIndex = this.inverted ? 2 : 1,
          newIndex = this.inverted ? 1 : 2;
      for (var i = 0; i < this.ranges.length; i += 3) {
        var start = this.ranges[i] - (this.inverted ? diff : 0);
        if (start > pos) break;
        var oldSize = this.ranges[i + oldIndex],
            end = start + oldSize;
        if (pos <= end && i == index * 3) return true;
        diff += this.ranges[i + newIndex] - oldSize;
      }
      return false;
    }

    // :: () → PosMap
    // Create an inverted version of this map. The result can be used to
    // map positions in the post-step document to the pre-step document.

  }, {
    key: "invert",
    value: function invert() {
      return new PosMap(this.ranges, !this.inverted);
    }
  }, {
    key: "toString",
    value: function toString() {
      return (this.inverted ? "-" : "") + JSON.stringify(this.ranges);
    }
  }]);

  return PosMap;
}();

PosMap.empty = new PosMap([]);

// ;; A remapping represents a pipeline of zero or more mappings. It
// is a specialized data structured used to manage mapping through a
// series of steps, typically including inverted and non-inverted
// versions of the same step. (This comes up when ‘rebasing’ steps for
// collaboration or history management.) This class implements
// `Mappable`.

var Remapping = exports.Remapping = function () {
  // :: (?[PosMap], ?[PosMap])

  function Remapping() {
    var head = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];
    var tail = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

    _classCallCheck(this, Remapping);

    // :: [PosMap]
    // The maps in the head of the mapping are applied to input
    // positions first, back-to-front. So the map at the end of this
    // array (if any) is the very first one applied.
    this.head = head;
    // The maps in the tail are applied last, front-to-back.
    this.tail = tail;
    this.mirror = Object.create(null);
  }

  // :: (PosMap, ?number) → number
  // Add a map to the mapping's front. If this map is the mirror image
  // (produced by an inverted step) of another map in this mapping,
  // that map's id (as returned by this method or
  // [`addToBack`](#Remapping.addToBack)) should be passed as a second
  // parameter to register the correspondence.


  _createClass(Remapping, [{
    key: "addToFront",
    value: function addToFront(map, corr) {
      this.head.push(map);
      var id = -this.head.length;
      if (corr != null) this.mirror[id] = corr;
      return id;
    }

    // :: (PosMap, ?number) → number
    // Add a map to the mapping's back. If the map is the mirror image
    // of another mapping in this object, the id of that map should be
    // passed to register the correspondence.

  }, {
    key: "addToBack",
    value: function addToBack(map, corr) {
      this.tail.push(map);
      var id = this.tail.length - 1;
      if (corr != null) this.mirror[corr] = id;
      return id;
    }
  }, {
    key: "get",
    value: function get(id) {
      return id < 0 ? this.head[-id - 1] : this.tail[id];
    }

    // :: (number, ?number) → MapResult
    // Map a position through this remapping, returning a mapping
    // result.

  }, {
    key: "mapResult",
    value: function mapResult(pos, bias) {
      return this._map(pos, bias, false);
    }

    // :: (number, ?number) → number
    // Map a position through this remapping.

  }, {
    key: "map",
    value: function map(pos, bias) {
      return this._map(pos, bias, true);
    }
  }, {
    key: "_map",
    value: function _map(pos, bias, simple) {
      var deleted = false,
          recoverables = null;

      for (var i = -this.head.length; i < this.tail.length; i++) {
        var map = this.get(i),
            rec = undefined;

        if ((rec = recoverables && recoverables[i]) != null && map.touches(pos, rec)) {
          pos = map.recover(rec);
          continue;
        }

        var result = map.mapResult(pos, bias);
        if (result.recover != null) {
          var corr = this.mirror[i];
          if (corr != null) {
            if (result.deleted) {
              i = corr;
              pos = this.get(corr).recover(result.recover);
              continue;
            } else {
              ;(recoverables || (recoverables = Object.create(null)))[corr] = result.recover;
            }
          }
        }

        if (result.deleted) deleted = true;
        pos = result.pos;
      }

      return simple ? pos : new MapResult(pos, deleted);
    }
  }, {
    key: "toString",
    value: function toString() {
      var maps = [];
      for (var i = -this.head.length; i < this.tail.length; i++) {
        maps.push(i + ":" + this.get(i) + (this.mirror[i] != null ? "->" + this.mirror[i] : ""));
      }return maps.join("\n");
    }
  }]);

  return Remapping;
}();

function mapThrough(mappables, pos, bias) {
  for (var i = 0; i < mappables.length; i++) {
    pos = mappables[i].map(pos, bias);
  }return pos;
}

function mapThroughResult(mappables, pos, bias) {
  var deleted = false;
  for (var i = 0; i < mappables.length; i++) {
    var result = mappables[i].mapResult(pos, bias);
    pos = result.pos;
    if (result.deleted) deleted = true;
  }
  return new MapResult(pos, deleted);
}
},{}],43:[function(require,module,exports){
"use strict";

var _model = require("../model");

var _transform = require("./transform");

var _step = require("./step");

// !!
// **`addMark`**
//   : Add the `Mark` given as the step's parameter to all
//     inline content between `from` and `to` (when allowed).
//
// **`removeMark`**
//   : Remove the `Mark` given as the step's parameter from all inline
//     content between `from` and `to`.

function mapNode(node, f, parent) {
  if (node.content.size) node = node.copy(mapFragment(node.content, f, node));
  if (node.isInline) node = f(node, parent);
  return node;
}

function mapFragment(fragment, f, parent) {
  var mapped = [];
  for (var i = 0; i < fragment.childCount; i++) {
    mapped.push(mapNode(fragment.child(i), f, parent));
  }return _model.Fragment.fromArray(mapped);
}

_step.Step.define("addMark", {
  apply: function apply(doc, step) {
    var slice = doc.slice(step.from, step.to),
        $pos = doc.resolve(step.from);
    slice.content = mapFragment(slice.content, function (node, parent) {
      if (!parent.type.canContainMark(step.param.type)) return node;
      return node.mark(step.param.addToSet(node.marks));
    }, $pos.node($pos.depth - slice.openLeft));
    return _step.StepResult.fromReplace(doc, step.from, step.to, slice);
  },
  invert: function invert(step) {
    return new _step.Step("removeMark", step.from, step.to, step.param);
  },
  paramToJSON: function paramToJSON(param) {
    return param.toJSON();
  },
  paramFromJSON: function paramFromJSON(schema, json) {
    return schema.markFromJSON(json);
  }
});

// :: (number, number, Mark) → Transform
// Add the given mark to the inline content between `from` and `to`.
_transform.Transform.prototype.addMark = function (from, to, mark) {
  var _this = this;

  var removed = [],
      added = [],
      removing = null,
      adding = null;
  this.doc.nodesBetween(from, to, function (node, pos, parent) {
    if (!node.isInline) return;
    var marks = node.marks;
    if (mark.isInSet(marks) || !parent.type.canContainMark(mark.type)) {
      adding = removing = null;
    } else {
      var start = Math.max(pos, from),
          end = Math.min(pos + node.nodeSize, to);
      var rm = mark.type.isInSet(marks);

      if (!rm) removing = null;else if (removing && removing.param.eq(rm)) removing.to = end;else removed.push(removing = new _step.Step("removeMark", start, end, rm));

      if (adding) adding.to = end;else added.push(adding = new _step.Step("addMark", start, end, mark));
    }
  });

  removed.forEach(function (s) {
    return _this.step(s);
  });
  added.forEach(function (s) {
    return _this.step(s);
  });
  return this;
};

_step.Step.define("removeMark", {
  apply: function apply(doc, step) {
    var slice = doc.slice(step.from, step.to);
    slice.content = mapFragment(slice.content, function (node) {
      return node.mark(step.param.removeFromSet(node.marks));
    });
    return _step.StepResult.fromReplace(doc, step.from, step.to, slice);
  },
  invert: function invert(step) {
    return new _step.Step("addMark", step.from, step.to, step.param);
  },
  paramToJSON: function paramToJSON(param) {
    return param.toJSON();
  },
  paramFromJSON: function paramFromJSON(schema, json) {
    return schema.markFromJSON(json);
  }
});

// :: (number, number, ?union<Mark, MarkType>) → Transform
// Remove the given mark, or all marks of the given type, from inline
// nodes between `from` and `to`.
_transform.Transform.prototype.removeMark = function (from, to) {
  var _this2 = this;

  var mark = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

  var matched = [],
      step = 0;
  this.doc.nodesBetween(from, to, function (node, pos) {
    if (!node.isInline) return;
    step++;
    var toRemove = null;
    if (mark instanceof _model.MarkType) {
      var found = mark.isInSet(node.marks);
      if (found) toRemove = [found];
    } else if (mark) {
      if (mark.isInSet(node.marks)) toRemove = [mark];
    } else {
      toRemove = node.marks;
    }
    if (toRemove && toRemove.length) {
      var end = Math.min(pos + node.nodeSize, to);
      for (var i = 0; i < toRemove.length; i++) {
        var style = toRemove[i],
            found = undefined;
        for (var j = 0; j < matched.length; j++) {
          var m = matched[j];
          if (m.step == step - 1 && style.eq(matched[j].style)) found = m;
        }
        if (found) {
          found.to = end;
          found.step = step;
        } else {
          matched.push({ style: style, from: Math.max(pos, from), to: end, step: step });
        }
      }
    }
  });
  matched.forEach(function (m) {
    return _this2.step("removeMark", m.from, m.to, m.style);
  });
  return this;
};

// :: (number, number, ?NodeType) → Transform
// Remove all marks and non-text inline nodes, or if `newParent` is
// given, all marks and inline nodes that may not appear as content of
// `newParent`, from the given range.
_transform.Transform.prototype.clearMarkup = function (from, to, newParent) {
  var _this3 = this;

  var delSteps = []; // Must be accumulated and applied in inverse order
  this.doc.nodesBetween(from, to, function (node, pos) {
    if (!node.isInline) return;
    if (newParent ? !newParent.canContainType(node.type) : !node.type.isText) {
      delSteps.push(new _step.Step("replace", pos, pos + node.nodeSize));
      return;
    }
    for (var i = 0; i < node.marks.length; i++) {
      var mark = node.marks[i];
      if (!newParent || !newParent.canContainMark(mark.type)) _this3.step("removeMark", Math.max(pos, from), Math.min(pos + node.nodeSize, to), mark);
    }
  });
  for (var i = delSteps.length - 1; i >= 0; i--) {
    this.step(delSteps[i]);
  }return this;
};
},{"../model":33,"./step":46,"./transform":47}],44:[function(require,module,exports){
"use strict";

var _model = require("../model");

var _transform = require("./transform");

var _step = require("./step");

var _map = require("./map");

// !! **`replace`**
//   : Delete the part of the document between `from` and `to` and
//     optionally replace it with another piece of content.
//
//     When new content is to be inserted, the step's parameter should
//     be a `Slice` object that properly fits the 'gap' between `from`
//     and `to`—the depths must line up, and the surrounding nodes
//     must be able to be joined with the open sides of the slice.

_step.Step.define("replace", {
  apply: function apply(doc, step) {
    return _step.StepResult.fromReplace(doc, step.from, step.to, step.param);
  },
  posMap: function posMap(step) {
    return new _map.PosMap([step.from, step.to - step.from, step.param.size]);
  },
  invert: function invert(step, oldDoc) {
    return new _step.Step("replace", step.from, step.from + step.param.size, oldDoc.slice(step.from, step.to));
  },
  paramToJSON: function paramToJSON(param) {
    return param.toJSON();
  },
  paramFromJSON: function paramFromJSON(schema, json) {
    return _model.Slice.fromJSON(schema, json);
  }
});

// :: (number, number) → Transform
// Delete the content between the given positions.
_transform.Transform.prototype.delete = function (from, to) {
  if (from != to) this.replace(from, to, _model.Slice.empty);
  return this;
};

// :: (number, ?number, ?Slice) → Transform
// Replace the part of the document between `from` and `to` with the
// part of the `source` between `start` and `end`.
_transform.Transform.prototype.replace = function (from) {
  var to = arguments.length <= 1 || arguments[1] === undefined ? from : arguments[1];
  var slice = arguments.length <= 2 || arguments[2] === undefined ? _model.Slice.empty : arguments[2];

  var $from = this.doc.resolve(from),
      $to = this.doc.resolve(to);

  var _fitSliceInto = fitSliceInto($from, $to, slice);

  var fitted = _fitSliceInto.fitted;
  var distAfter = _fitSliceInto.distAfter;var fSize = fitted.size;
  if (from == to && !fSize) return this;
  this.step("replace", from, to, fitted);

  // If the endpoints of the replacement don't end right next to each
  // other, we may need to move text that occurs directly after the
  // slice to fit onto the inserted content. But only if there is text
  // before and after the cut, and if those endpoints aren't already
  // next to each other.
  if (!fSize || !$to.parent.isTextblock) return this;
  var after = from + fSize;
  var inner = !slice.size ? from : distAfter < 0 ? -1 : after - distAfter,
      $inner = undefined;
  if (inner == -1 || inner == after || !($inner = this.doc.resolve(inner)).parent.isTextblock || !$inner.parent.type.canContainFragment($to.parent.content)) return this;
  mergeTextblockAfter(this, $inner, this.doc.resolve(after));
  return this;
};

// :: (number, number, union<Fragment, Node, [Node]>) → Transform
// Replace the given range with the given content, which may be a
// fragment, node, or array of nodes.
_transform.Transform.prototype.replaceWith = function (from, to, content) {
  return this.replace(from, to, new _model.Slice(_model.Fragment.from(content), 0, 0));
};

// :: (number, union<Fragment, Node, [Node]>) → Transform
// Insert the given content at the given position.
_transform.Transform.prototype.insert = function (pos, content) {
  return this.replaceWith(pos, pos, content);
};

// :: (number, string) → Transform
// Insert the given text at `pos`, inheriting the marks of the
// existing content at that position.
_transform.Transform.prototype.insertText = function (pos, text) {
  return this.insert(pos, this.doc.type.schema.text(text, this.doc.marksAt(pos)));
};

// :: (number, Node) → Transform
// Insert the given node at `pos`, inheriting the marks of the
// existing content at that position.
_transform.Transform.prototype.insertInline = function (pos, node) {
  return this.insert(pos, node.mark(this.doc.marksAt(pos)));
};

// This is an output variable for closeFragment and friends, used to
// track the distance between the end of the resulting slice and the
// end of the inserted content, so that we can find back the position
// afterwards.
var distAfter = 0;

// : (ResolvedPos, ResolvedPos, Slice) → {fitted: Slice, distAfter: number}
// Mangle the content of a slice so that it fits between the given
// positions.
function fitSliceInto($from, $to, slice) {
  var base = $from.sameDepth($to);
  var placed = placeSlice($from, slice),
      outer = outerPlaced(placed);
  if (outer) base = Math.min(outer.depth, base);

  // distAfter starts negative, and is set to a positive value when
  // the end of the inserted content is placed.
  distAfter = -1e10; // FIXME kludge
  var fragment = closeFragment($from.node(base).type, fillBetween($from, $to, base, placed), $from, $to, base);
  return { fitted: new _model.Slice(fragment, $from.depth - base, $to.depth - base),
    distAfter: distAfter - ($to.depth - base) };
}

function outerPlaced(placed) {
  for (var i = 0; i < placed.length; i++) {
    if (placed[i]) return placed[i];
  }
}

function fillBetween($from, $to, depth, placed) {
  var fromNext = $from.depth > depth && $from.node(depth + 1);
  var toNext = $to.depth > depth && $to.node(depth + 1);
  var placedHere = placed[depth];

  if (fromNext && toNext && fromNext.type.canContainContent(toNext.type) && !placedHere) return _model.Fragment.from(closeNode(fromNext, fillBetween($from, $to, depth + 1, placed), $from, $to, depth + 1));

  var content = _model.Fragment.empty;
  if (placedHere) {
    content = closeLeft(placedHere.content, placedHere.openLeft);
    if (placedHere.isEnd) distAfter = placedHere.openRight;
  }

  distAfter--;
  if (fromNext) content = content.addToStart(closeNode(fromNext, fillFrom($from, depth + 1, placed), $from, null, depth + 1));
  if (toNext) content = closeTo(content, $to, depth + 1, placedHere ? placedHere.openRight : 0);else if (placedHere) content = closeRight(content, placedHere.openRight);
  distAfter++;

  return content;
}

function fillFrom($from, depth, placed) {
  var placedHere = placed[depth],
      content = _model.Fragment.empty;
  if (placedHere) {
    content = closeRight(placedHere.content, placedHere.openRight);
    if (placedHere.isEnd) distAfter = placedHere.openRight;
  }

  distAfter--;
  if ($from.depth > depth) content = content.addToStart(closeNode($from.node(depth + 1), fillFrom($from, depth + 1, placed), $from, null, depth + 1));
  distAfter++;

  return content;
}

function closeTo(content, $to, depth, openDepth) {
  var after = $to.node(depth);
  if (openDepth == 0 || !after.type.canContainContent(content.lastChild.type)) {
    var finish = closeNode(after, fillTo($to, depth), null, $to, depth);
    distAfter += finish.nodeSize;
    return closeRight(content, openDepth).addToEnd(finish);
  }
  var inner = content.lastChild.content;
  if (depth < $to.depth) inner = closeTo(inner, $to, depth + 1, openDepth - 1);
  return content.replaceChild(content.childCount - 1, after.copy(inner));
}

function fillTo(to, depth) {
  if (to.depth == depth) return _model.Fragment.empty;
  return _model.Fragment.from(closeNode(to.node(depth + 1), fillTo(to, depth + 1), null, to, depth + 1));
}

// Closing nodes is the process of ensuring that they contain valid
// content, optionally changing the content (that is inside of the
// replace) to make sure.

function closeRight(content, openDepth) {
  if (openDepth == 0) return content;
  var last = content.lastChild,
      closed = closeNode(last, closeRight(last.content, openDepth - 1));
  return closed == last ? content : content.replaceChild(content.childCount - 1, closed);
}

function closeLeft(content, openDepth) {
  if (openDepth == 0) return content;
  var first = content.firstChild,
      closed = closeNode(first, first.content);
  return closed == first ? content : content.replaceChild(0, closed);
}

function closeFragment(type, content, $to, $from, depth) {
  // FIXME replace this with a more general approach
  if (type.canBeEmpty) return content;
  var hasContent = content.size || $to && ($to.depth > depth || $to.index(depth)) || $from && ($from.depth > depth || $from.index(depth) < $from.node(depth).childCount);
  return hasContent ? content : type.defaultContent();
}

function closeNode(node, content, $to, $from, depth) {
  return node.copy(closeFragment(node.type, content, $to, $from, depth));
}

// Algorithm for 'placing' the elements of a slice into a gap:
//
// We consider the content of each node that is open to the left to be
// independently placeable. I.e. in <p("foo"), p("bar")>, when the
// paragraph on the left is open, "foo" can be placed (somewhere on
// the left side of the replacement gap) independently from p("bar").
//
// So placeSlice splits up a slice into a number of sub-slices,
// along with information on where they can be placed on the given
// left-side edge. It works by walking the open side of the slice,
// from the inside out, and trying to find a landing spot for each
// element, by simultaneously scanning over the gap side. When no
// place is found for an open node's content, it is left in that node.
//
// If the outer content can't be placed, a set of wrapper nodes is
// made up for it (by rooting it in the document node type using
// findConnection), and the algorithm continues to iterate over those.
// This is guaranteed to find a fit, since both stacks now start with
// the same node type (doc).

function nodeLeft(slice, depth) {
  var content = slice.content;
  for (var i = 1; i < depth; i++) {
    content = content.firstChild.content;
  }return content.firstChild;
}

function placeSlice($from, slice) {
  var dFrom = $from.depth,
      unplaced = null,
      openLeftUnplaced = 0;
  var placed = [],
      parents = null;

  for (var dSlice = slice.openLeft;; --dSlice) {
    var curType = undefined,
        curAttrs = undefined,
        curFragment = undefined;
    if (dSlice >= 0) {
      if (dSlice > 0) {
        // Inside slice
        ;
        var _nodeLeft = nodeLeft(slice, dSlice);

        curType = _nodeLeft.type;
        curAttrs = _nodeLeft.attrs;
        curFragment = _nodeLeft.content;
      } else if (dSlice == 0) {
        // Top of slice
        curFragment = slice.content;
      }
      if (dSlice < slice.openLeft) curFragment = curFragment.cut(curFragment.firstChild.nodeSize);
    } else {
      // Outside slice
      curFragment = _model.Fragment.empty;
      curType = parents[parents.length + dSlice - 1];
    }
    if (unplaced) curFragment = curFragment.addToStart(unplaced);

    if (curFragment.size == 0 && dSlice <= 0) break;

    var found = findPlacement(curType, curFragment, $from, dFrom);
    if (found > -1) {
      if (curFragment.size > 0) placed[found] = { content: curFragment,
        openLeft: openLeftUnplaced,
        openRight: dSlice > 0 ? 0 : slice.openRight - dSlice,
        isEnd: dSlice <= 0,
        depth: found };
      if (dSlice <= 0) break;
      unplaced = null;
      openLeftUnplaced = 0;
      dFrom = Math.max(0, found - 1);
    } else {
      if (dSlice == 0) {
        parents = $from.node(0).type.findConnectionToKind(curFragment.leastSuperKind());
        if (!parents) break;
        parents.unshift($from.node(0).type);
        curType = parents[parents.length - 1];
      }
      unplaced = curType.create(curAttrs, curFragment);
      openLeftUnplaced++;
    }
  }

  return placed;
}

function findPlacement(type, fragment, $from, start) {
  for (var d = start; d >= 0; d--) {
    var fromType = $from.node(d).type;
    if (type ? fromType.canContainContent(type) : fromType.canContainFragment(fragment)) return d;
  }
  return -1;
}

// When a replace ends in an (open) textblock, and the content that
// ends up before it also ends in an open textblock, the textblock
// after is moved to and connected with the one before it. This
// influences content outside of the replaced range, so it is not done
// as part of the replace step itself, but instead tacked on as a set
// of split/ancestor/join steps.

function mergeTextblockAfter(tr, $inside, $after) {
  var base = $inside.sameDepth($after);

  var end = $after.end($after.depth),
      cutAt = end + 1,
      cutDepth = $after.depth - 1;
  while (cutDepth > base && $after.index(cutDepth) + 1 == $after.node(cutDepth).childCount) {
    --cutDepth;
    ++cutAt;
  }
  if (cutDepth > base) tr.split(cutAt, cutDepth - base);
  var types = [],
      attrs = [];
  for (var i = base + 1; i <= $inside.depth; i++) {
    var node = $inside.node(i);
    types.push(node.type);
    attrs.push(node.attrs);
  }
  tr.step("ancestor", $after.pos, end, { depth: $after.depth - base, types: types, attrs: attrs });
  tr.join($after.pos - ($after.depth - base), $inside.depth - base);
}
},{"../model":33,"./map":42,"./step":46,"./transform":47}],45:[function(require,module,exports){
"use strict";

var _model = require("../model");

var _transform = require("./transform");

var _step = require("./step");

var _map = require("./map");

// !! **`split`**
//   : Split a block node at `pos`. The parameter, if given, may be
//     `{type, ?attrs}` object giving the node type and optionally the
//     attributes of the node created to hold the content after the
//     split.

_step.Step.define("split", {
  apply: function apply(doc, step) {
    var $pos = doc.resolve(step.from),
        parent = $pos.parent;
    var cut = [parent.copy(), step.param ? step.param.type.create(step.attrs) : parent.copy()];
    return _step.StepResult.fromReplace(doc, $pos.pos, $pos.pos, new _model.Slice(_model.Fragment.fromArray(cut), 1, 1));
  },
  posMap: function posMap(step) {
    return new _map.PosMap([step.from, 0, 2]);
  },
  invert: function invert(step) {
    return new _step.Step("join", step.from, step.from + 2);
  },
  paramToJSON: function paramToJSON(param) {
    return param && { type: param.type.name, attrs: param.attrs };
  },
  paramFromJSON: function paramFromJSON(schema, json) {
    return json && { type: schema.nodeType(json.type), attrs: json.attrs };
  }
});

// :: (number, ?number, ?NodeType, ?Object) → Transform
// Split the node at the given position, and optionally, if `depth` is
// greater than one, any number of nodes above that. By default, the part
// split off will inherit the node type of the original node. This can
// be changed by passing `typeAfter` and `attrsAfter`.
_transform.Transform.prototype.split = function (pos) {
  var depth = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];
  var typeAfter = arguments[2];
  var attrsAfter = arguments[3];

  for (var i = 0; i < depth; i++) {
    this.step("split", pos + i, pos + i, i == 0 && typeAfter ? { type: typeAfter, attrs: attrsAfter } : null);
  }return this;
};

// :: (number, ?number) → Transform
// Split at the given position, up to the given depth, if that
// position isn't already at the start or end of its parent node.
_transform.Transform.prototype.splitIfNeeded = function (pos) {
  var depth = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];

  var $pos = this.doc.resolve(pos),
      before = true;
  for (var i = 0; i < depth; i++) {
    var d = $pos.depth - i,
        point = i == 0 ? $pos.pos : before ? $pos.before(d + 1) : $pos.after(d + 1);
    if (point == $pos.start(d)) before = true;else if (point == $pos.end(d)) before = false;else return this.split(point, depth - i);
  }
  return this;
};
},{"../model":33,"./map":42,"./step":46,"./transform":47}],46:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StepResult = exports.Step = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _model = require("../model");

var _map = require("./map");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; A step object wraps an atomic operation. It generally applies
// only to the document it was created for, since the positions
// associated with it will only make sense for that document.

var Step = exports.Step = function () {
  // :: (string, number, number, ?any)
  // Build a step. The type should name a [defined](Step.define) step
  // type, and the shape of the positions and parameter should be
  // appropriate for that type.

  function Step(type, from, to) {
    var param = arguments.length <= 3 || arguments[3] === undefined ? null : arguments[3];

    _classCallCheck(this, Step);

    if (!(type in steps)) throw new RangeError("Unknown step type: " + type);
    // :: string
    // The type of the step.
    this.type = type;
    // :: ?number
    // The start of the step's range, if any. Which of the three
    // optional positions associated with a step a given step type
    // uses differs. The way each of these positions is mapped when
    // the step is mapped over a [position mapping](#PosMap) depends
    // on its role.
    this.from = from;
    // :: ?number
    // The end of the step's range.
    this.to = to;
    // :: ?any
    // Extra step-type-specific information associated with the step.
    this.param = param;
  }

  // :: (Node) → ?StepResult
  // Applies this step to the given document, returning a result
  // containing the transformed document (the input document is not
  // changed) and a `PosMap`. If the step could not meaningfully be
  // applied to the given document, this returns `null`.


  _createClass(Step, [{
    key: "apply",
    value: function apply(doc) {
      return steps[this.type].apply(doc, this);
    }
  }, {
    key: "posMap",
    value: function posMap() {
      var type = steps[this.type];
      return type.posMap ? type.posMap(this) : _map.PosMap.empty;
    }

    // :: (Node) → Step
    // Create an inverted version of this step. Needs the document as it
    // was before the step as input.

  }, {
    key: "invert",
    value: function invert(oldDoc) {
      return steps[this.type].invert(this, oldDoc);
    }

    // :: (Mappable) → ?Step
    // Map this step through a mappable thing, returning either a
    // version of that step with its positions adjusted, or `null` if
    // the step was entirely deleted by the mapping.

  }, {
    key: "map",
    value: function map(remapping) {
      var from = remapping.mapResult(this.from, 1);
      var to = this.to == this.from ? from : remapping.mapResult(this.to, -1);
      if (from.deleted && to.deleted) return null;
      return new Step(this.type, from.pos, Math.max(from.pos, to.pos), this.param);
    }

    // :: () → Object
    // Create a JSON-serializeable representation of this step.

  }, {
    key: "toJSON",
    value: function toJSON() {
      var impl = steps[this.type];
      return {
        type: this.type,
        from: this.from,
        to: this.to,
        param: impl.paramToJSON ? impl.paramToJSON(this.param) : this.param
      };
    }

    // :: (Schema, Object) → Step
    // Deserialize a step from its JSON representation.

  }, {
    key: "toString",
    value: function toString() {
      return this.type + "@" + this.from + "-" + this.to;
    }
  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      var impl = steps[json.type];
      return new Step(json.type, json.from, json.to, impl.paramFromJSON ? impl.paramFromJSON(schema, json.param) : json.param);
    }

    // :: (string, Object)
    // Define a new type of step. Implementation should have the
    // following properties:
    //
    // **`apply`**`(doc: Node, step: Step) → ?StepResult
    //   : Applies the step to a document.
    // **`invert`**`(step: Step, oldDoc: Node) → Step
    //   : Create an inverted version of the step.
    // **`paramToJSON`**`(param: ?any) → ?Object
    //   : Serialize this step type's parameter to JSON.
    // **`paramFromJSON`**`(schema: Schema, json: ?Object) → ?any
    //   : Deserialize this step type's parameter from JSON.

  }, {
    key: "define",
    value: function define(type, implementation) {
      steps[type] = implementation;
    }
  }]);

  return Step;
}();

var steps = Object.create(null);

// ;; The result of [applying](#Step.apply) a step. Contains either a
// new document or a failure value.

var StepResult = exports.StepResult = function () {
  // :: (?Node, ?string)

  function StepResult(doc, failed) {
    _classCallCheck(this, StepResult);

    // :: ?Node The transformed document.
    this.doc = doc;
    // :: ?string A text providing information about a failed step.
    this.failed = failed;
  }

  // :: (Node) → StepResult
  // Create a successful step result.


  _createClass(StepResult, null, [{
    key: "ok",
    value: function ok(doc) {
      return new StepResult(doc, null);
    }

    // :: (string) → StepResult
    // Create a failed step result.

  }, {
    key: "fail",
    value: function fail(val) {
      return new StepResult(null, val);
    }

    // :: (Node, number, number, Slice) → StepResult
    // Run `Node.replace`, create a successful result if it succeeds,
    // and a failed one if it throws a `ReplaceError`.

  }, {
    key: "fromReplace",
    value: function fromReplace(doc, from, to, slice) {
      try {
        return StepResult.ok(doc.replace(from, to, slice));
      } catch (e) {
        if (e instanceof _model.ReplaceError) return StepResult.fail(e.message);
        throw e;
      }
    }
  }]);

  return StepResult;
}();
},{"../model":33,"./map":42}],47:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Transform = exports.TransformError = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _error = require("../util/error");

var _step2 = require("./step");

var _map = require("./map");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TransformError = exports.TransformError = function (_ProseMirrorError) {
  _inherits(TransformError, _ProseMirrorError);

  function TransformError() {
    _classCallCheck(this, TransformError);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(TransformError).apply(this, arguments));
  }

  return TransformError;
}(_error.ProseMirrorError);

// ;; A change to a document often consists of a series of
// [steps](#Step). This class provides a convenience abstraction to
// build up and track such an array of steps. A `Transform` object
// implements `Mappable`.
//
// The high-level transforming methods return the `Transform` object
// itself, so that they can be chained.


var Transform = function () {
  // :: (Node)
  // Create a transformation that starts with the given document.

  function Transform(doc) {
    _classCallCheck(this, Transform);

    this.doc = doc;
    this.docs = [];
    this.steps = [];
    this.maps = [];
  }

  _createClass(Transform, [{
    key: "step",


    // :: (Step) → Transform
    value: function step(_step, from, to, param) {
      if (typeof _step == "string") _step = new _step2.Step(_step, from, to, param);
      var result = this.maybeStep(_step);
      if (result.failed) throw new TransformError(result.failed);
      return this;
    }
  }, {
    key: "maybeStep",
    value: function maybeStep(step) {
      var result = step.apply(this.doc);
      if (!result.failed) {
        this.docs.push(this.doc);
        this.steps.push(step);
        this.maps.push(step.posMap());
        this.doc = result.doc;
      }
      return result;
    }

    // :: (number, ?number) → MapResult
    // Map a position through the whole transformation (all the position
    // maps in [`maps`](#Transform.maps)), and return the result.

  }, {
    key: "mapResult",
    value: function mapResult(pos, bias) {
      return (0, _map.mapThroughResult)(this.maps, pos, bias);
    }

    // :: (number, ?number) → number
    // Map a position through the whole transformation, and return the
    // mapped position.

  }, {
    key: "map",
    value: function map(pos, bias) {
      return (0, _map.mapThrough)(this.maps, pos, bias);
    }
  }, {
    key: "before",
    get: function get() {
      return this.docs.length ? this.docs[0] : this.doc;
    }
  }]);

  return Transform;
}();

exports.Transform = Transform;
},{"../util/error":50,"./map":42,"./step":46}],48:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ParamPrompt = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.openPrompt = openPrompt;

var _dom = require("../dom");

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// !! The `ui/prompt` module implements functionality for prompting
// the user for [command parameters](#CommandSpec.params).
//
// The default implementation gets the job done, roughly, but you'll
// probably want to customize it in your own system (or submit patches
// to improve this implementation).

// ;; This class represents a dialog that prompts for [command
// parameters](#CommandSpec.params). It is the default value of the
// `commandParamPrompt` option. You can set this option to a subclass
// (or a complete reimplementation) to customize the way in which
// parameters are read.

var ParamPrompt = exports.ParamPrompt = function () {
  // :: (ProseMirror, Command)
  // Construct a prompt. Note that this does not
  // [open](#ParamPrompt.open) it yet.

  function ParamPrompt(pm, command) {
    var _this = this;

    _classCallCheck(this, ParamPrompt);

    // :: ProseMirror
    this.pm = pm;
    // :: Command
    this.command = command;
    this.doClose = null;
    // :: [DOMNode]
    // An array of fields, as created by `ParamTypeSpec.render`, for
    // the command's parameters.
    this.fields = command.params.map(function (param) {
      if (!(param.type in _this.paramTypes)) throw new RangeError("Unsupported parameter type: " + param.type);
      return _this.paramTypes[param.type].render.call(_this.pm, param, _this.defaultValue(param));
    });
    var promptTitle = (0, _dom.elt)("h5", {}, command.spec && command.spec.label ? pm.translate(command.spec.label) : "");
    var submitButton = (0, _dom.elt)("button", { type: "submit", class: "ProseMirror-prompt-submit" }, "Ok");
    var cancelButton = (0, _dom.elt)("button", { type: "button", class: "ProseMirror-prompt-cancel" }, "Cancel");
    cancelButton.addEventListener("click", function () {
      return _this.close();
    });
    // :: DOMNode
    // An HTML form wrapping the fields.
    this.form = (0, _dom.elt)("form", null, promptTitle, this.fields.map(function (f) {
      return (0, _dom.elt)("div", null, f);
    }), (0, _dom.elt)("div", { class: "ProseMirror-prompt-buttons" }, submitButton, " ", cancelButton));
  }

  // :: ()
  // Close the prompt.


  _createClass(ParamPrompt, [{
    key: "close",
    value: function close() {
      if (this.doClose) {
        this.doClose();
        this.doClose = null;
      }
    }

    // :: ()
    // Open the prompt's dialog.

  }, {
    key: "open",
    value: function open() {
      var _this2 = this;

      this.close();
      var prompt = this.prompt();
      var hadFocus = this.pm.hasFocus();
      this.doClose = function () {
        prompt.close();
        if (hadFocus) setTimeout(function () {
          return _this2.pm.focus();
        }, 50);
      };

      var submit = function submit() {
        var params = _this2.values();
        if (params) {
          _this2.close();
          _this2.command.exec(_this2.pm, params);
        }
      };

      this.form.addEventListener("submit", function (e) {
        e.preventDefault();
        submit();
      });

      this.form.addEventListener("keydown", function (e) {
        if (e.keyCode == 27) {
          e.preventDefault();
          prompt.close();
        } else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
          e.preventDefault();
          submit();
        }
      });

      var input = this.form.querySelector("input, textarea");
      if (input) input.focus();
    }

    // :: () → ?[any]
    // Read the values from the form's field. Validate them, and when
    // one isn't valid (either has a validate function that produced an
    // error message, or has no validate function, no value, and no
    // default value), show the problem to the user and return `null`.

  }, {
    key: "values",
    value: function values() {
      var result = [];
      for (var i = 0; i < this.command.params.length; i++) {
        var param = this.command.params[i],
            dom = this.fields[i];
        var type = this.paramTypes[param.type],
            value = undefined,
            bad = undefined;
        if (type.validate) bad = type.validate(dom);
        if (!bad) {
          value = type.read.call(this.pm, dom);
          if (param.validate) bad = param.validate(value);else if (!value && param.default == null) bad = "No default value available";
        }

        if (bad) {
          if (type.reportInvalid) type.reportInvalid.call(this.pm, dom, bad);else this.reportInvalid(dom, bad);
          return null;
        }
        result.push(value);
      }
      return result;
    }

    // :: (CommandParam) → ?any
    // Get a parameter's default value, if any.

  }, {
    key: "defaultValue",
    value: function defaultValue(param) {
      if (param.prefill) {
        var prefill = param.prefill.call(this.command.self, this.pm);
        if (prefill != null) return prefill;
      }
      return param.default;
    }

    // :: () → {close: ()}
    // Open a prompt with the parameter form in it. The default
    // implementation calls `openPrompt`.

  }, {
    key: "prompt",
    value: function prompt() {
      var _this3 = this;

      return openPrompt(this.pm, this.form, { onClose: function onClose() {
          return _this3.close();
        } });
    }

    // :: (DOMNode, string)
    // Report a field as invalid, showing the given message to the user.

  }, {
    key: "reportInvalid",
    value: function reportInvalid(dom, message) {
      // FIXME this is awful and needs a lot more work
      var parent = dom.parentNode;
      var style = "left: " + (dom.offsetLeft + dom.offsetWidth + 2) + "px; top: " + (dom.offsetTop - 5) + "px";
      var msg = parent.appendChild((0, _dom.elt)("div", { class: "ProseMirror-invalid", style: style }, message));
      setTimeout(function () {
        return parent.removeChild(msg);
      }, 1500);
    }
  }]);

  return ParamPrompt;
}();

// ;; #path=ParamTypeSpec #kind=interface
// By default, the prompting interface only knows how to prompt for
// parameters of type `text` and `select`. You can change the way
// those are prompted for, and define new types, by writing to
// `ParamPrompt.paramTypes`. All methods on these specs will be called
// with `this` bound to the relevant `ProseMirror` instance.

// :: (param: CommandParam, value: ?any) → DOMNode #path=ParamTypeSpec.render
// Create the DOM structure for a parameter field of this type, and
// pre-fill it with `value`, if given.

// :: (field: DOMNode) → any #path=ParamTypeSpec.read
// Read the value from the DOM field created by
// [`render`](#ParamTypeSpec.render).

// :: (field: DOMNode) → ?string #path=ParamTypeSpec.validate
// Optional. Validate the value in the given field, and return a
// string message if it is not a valid input for this type.

// :: (field: DOMNode, message: string) #path=ParamTypeSpec.reportInvalid
// Report the value in the given field as invalid, showing the given
// error message. This property is optional, and the prompt
// implementation will fall back to its own method of showing the
// message when it is not provided.

// :: Object<ParamTypeSpec>
// A collection of default renderers and readers for [parameter
// types](#CommandParam.type), which [parameter
// handlers](#commandParamHandler) can optionally use to prompt for
// parameters. `render` should create a form field for the parameter,
// and `read` should, given that field, return its value.


ParamPrompt.prototype.paramTypes = Object.create(null);

ParamPrompt.prototype.paramTypes.text = {
  render: function render(param, value) {
    return (0, _dom.elt)("input", { type: "text",
      placeholder: this.translate(param.label),
      value: value,
      autocomplete: "off" });
  },
  read: function read(dom) {
    return dom.value;
  }
};

ParamPrompt.prototype.paramTypes.select = {
  render: function render(param, value) {
    var _this4 = this;

    var options = param.options.call ? param.options(this) : param.options;
    return (0, _dom.elt)("select", null, options.map(function (o) {
      return (0, _dom.elt)("option", { value: o.value, selected: o.value == value ? "true" : null }, _this4.translate(o.label));
    }));
  },
  read: function read(dom) {
    return dom.value;
  }
};

// :: (ProseMirror, DOMNode, ?Object) → {close: ()}
// Open a dialog box for the given editor, putting `content` inside of
// it. The `close` method on the return value can be used to
// explicitly close the dialog again. The following options are
// supported:
//
// **`pos`**`: {left: number, top: number}`
//   : Provide an explicit position for the element. By default, it'll
//     be placed in the center of the editor.
//
// **`onClose`**`: fn()`
//   : A function to be called when the dialog is closed.
function openPrompt(pm, content, options) {
  var button = (0, _dom.elt)("button", { class: "ProseMirror-prompt-close" });
  var wrapper = (0, _dom.elt)("div", { class: "ProseMirror-prompt" }, content, button);
  var outerBox = pm.wrapper.getBoundingClientRect();

  pm.wrapper.appendChild(wrapper);
  if (options && options.pos) {
    wrapper.style.left = options.pos.left - outerBox.left + "px";
    wrapper.style.top = options.pos.top - outerBox.top + "px";
  } else {
    var blockBox = wrapper.getBoundingClientRect();
    var cX = Math.max(0, outerBox.left) + Math.min(window.innerWidth, outerBox.right) - blockBox.width;
    var cY = Math.max(0, outerBox.top) + Math.min(window.innerHeight, outerBox.bottom) - blockBox.height;
    wrapper.style.left = cX / 2 - outerBox.left + "px";
    wrapper.style.top = cY / 2 - outerBox.top + "px";
  }

  var close = function close() {
    pm.off("interaction", close);
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
      if (options && options.onClose) options.onClose();
    }
  };
  button.addEventListener("click", close);
  pm.on("interaction", close);
  return { close: close };
}

(0, _dom.insertCSS)("\n.ProseMirror-prompt {\n  background: white;\n  padding: 2px 6px 2px 15px;\n  border: 1px solid silver;\n  position: absolute;\n  border-radius: 3px;\n  z-index: 11;\n}\n\n.ProseMirror-prompt h5 {\n  margin: 0;\n  font-weight: normal;\n  font-size: 100%;\n  color: #444;\n}\n\n.ProseMirror-prompt input[type=\"text\"],\n.ProseMirror-prompt textarea {\n  background: #eee;\n  border: none;\n  outline: none;\n}\n\n.ProseMirror-prompt input[type=\"text\"] {\n  padding: 0 4px;\n}\n\n.ProseMirror-prompt-close {\n  position: absolute;\n  left: 2px; top: 1px;\n  color: #666;\n  border: none; background: transparent; padding: 0;\n}\n\n.ProseMirror-prompt-close:after {\n  content: \"✕\";\n  font-size: 12px;\n}\n\n.ProseMirror-invalid {\n  background: #ffc;\n  border: 1px solid #cc7;\n  border-radius: 4px;\n  padding: 5px 10px;\n  position: absolute;\n  min-width: 10em;\n}\n\n.ProseMirror-prompt-buttons {\n  margin-top: 5px;\n  display: none;\n}\n\n");
},{"../dom":1}],49:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.scheduleDOMUpdate = scheduleDOMUpdate;
exports.unscheduleDOMUpdate = unscheduleDOMUpdate;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var UPDATE_TIMEOUT = 50;
var MIN_FLUSH_DELAY = 100;

var CentralScheduler = function () {
  function CentralScheduler(pm) {
    var _this = this;

    _classCallCheck(this, CentralScheduler);

    this.waiting = [];
    this.timeout = null;
    this.lastForce = 0;
    this.pm = pm;
    this.timedOut = function () {
      if (_this.pm.operation) _this.timeout = setTimeout(_this.timedOut, UPDATE_TIMEOUT);else _this.force();
    };
    pm.on("flush", this.onFlush.bind(this));
  }

  _createClass(CentralScheduler, [{
    key: "set",
    value: function set(f) {
      if (this.waiting.length == 0) this.timeout = setTimeout(this.timedOut, UPDATE_TIMEOUT);
      if (this.waiting.indexOf(f) == -1) this.waiting.push(f);
    }
  }, {
    key: "unset",
    value: function unset(f) {
      var index = this.waiting.indexOf(f);
      if (index > -1) this.waiting.splice(index, 1);
    }
  }, {
    key: "force",
    value: function force() {
      clearTimeout(this.timeout);
      this.lastForce = Date.now();

      while (this.waiting.length) {
        for (var i = 0; i < this.waiting.length; i++) {
          var result = this.waiting[i]();
          if (result) this.waiting[i] = result;else this.waiting.splice(i--, 1);
        }
      }
    }
  }, {
    key: "onFlush",
    value: function onFlush() {
      if (this.waiting.length && Date.now() - this.lastForce > MIN_FLUSH_DELAY) this.force();
    }
  }], [{
    key: "get",
    value: function get(pm) {
      return pm.mod.centralScheduler || (pm.mod.centralScheduler = new this(pm));
    }
  }]);

  return CentralScheduler;
}();

// :: (ProseMirror, () -> ?() -> ?())
// Schedule a DOM update function to be called either the next time
// the editor is [flushed](#ProseMirror.flush), or if no flush happens
// immediately, after 200 milliseconds. This is used to synchronize
// DOM updates and read to prevent [DOM layout
// thrashing](http://eloquentjavascript.net/13_dom.html#p_nnTb9RktUT).
//
// Often, your updates will need to both read and write from the DOM.
// To schedule such access in lockstep with other modules, the
// function you give can return another function, which may return
// another function, and so on. The first call should _write_ to the
// DOM, and _not read_. If a _read_ needs to happen, that should be
// done in the function returned from the first call. If that has to
// be followed by another _write_, that should be done in a function
// returned from the second function, and so on.


function scheduleDOMUpdate(pm, f) {
  CentralScheduler.get(pm).set(f);
}

// :: (ProseMirror, () -> ?() -> ?())
// Cancel an update scheduled with `scheduleDOMUpdate`. Calling this with
// a function that is not actually scheduled is harmless.
function unscheduleDOMUpdate(pm, f) {
  CentralScheduler.get(pm).unset(f);
}

// ;; Helper for scheduling updates whenever any of a series of events
// happen.

var UpdateScheduler = exports.UpdateScheduler = function () {
  // :: (ProseMirror, string, () -> ?())
  // Creates an update scheduler for the given editor. `events` should
  // be a space-separated list of event names (for example
  // `"selectionChange change"`). `start` should be a function as
  // expected by `scheduleDOMUpdate`.

  function UpdateScheduler(pm, events, start) {
    var _this2 = this;

    _classCallCheck(this, UpdateScheduler);

    this.pm = pm;
    this.start = start;

    this.events = events.split(" ");
    this.onEvent = this.onEvent.bind(this);
    this.events.forEach(function (event) {
      return pm.on(event, _this2.onEvent);
    });
  }

  // :: ()
  // Detach the event handlers registered by this scheduler.


  _createClass(UpdateScheduler, [{
    key: "detach",
    value: function detach() {
      var _this3 = this;

      unscheduleDOMUpdate(this.pm, this.start);
      this.events.forEach(function (event) {
        return _this3.pm.off(event, _this3.onEvent);
      });
    }
  }, {
    key: "onEvent",
    value: function onEvent() {
      scheduleDOMUpdate(this.pm, this.start);
    }

    // :: ()
    // Force an update. Note that if the editor has scheduled a flush,
    // the update is still delayed until the flush occurs.

  }, {
    key: "force",
    value: function force() {
      if (this.pm.operation) {
        this.onEvent();
      } else {
        unscheduleDOMUpdate(this.pm, this.start);
        for (var run = this.start; run; run = run()) {}
      }
    }
  }]);

  return UpdateScheduler;
}();
},{}],50:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProseMirrorError = ProseMirrorError;
// ;; Superclass for ProseMirror-related errors. Does some magic to
// make it safely subclassable even on ES5 runtimes.
function ProseMirrorError(message) {
  Error.call(this, message);
  if (this.message != message) {
    this.message = message;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.name);else this.stack = new Error(message).stack;
  }
}

ProseMirrorError.prototype = Object.create(Error.prototype);

ProseMirrorError.prototype.constructor = ProseMirrorError;

Object.defineProperty(ProseMirrorError.prototype, "name", {
  get: function get() {
    return this.constructor.name || functionName(this.constructor) || "ProseMirrorError";
  }
});

function functionName(f) {
  var match = /^function (\w+)/.exec(f.toString());
  return match && match[1];
}
},{}],51:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.eventMixin = eventMixin;
// ;; #path=EventMixin #kind=interface
// A set of methods for objects that emit events. Added by calling
// `eventMixin` on a constructor.

var noHandlers = [];

function getHandlers(obj, type) {
  return obj._handlers && obj._handlers[type] || noHandlers;
}

var methods = {
  // :: (type: string, handler: (...args: [any])) #path=EventMixin.on
  // Register an event handler for the given event type.

  on: function on(type, handler) {
    var map = this._handlers || (this._handlers = Object.create(null));
    map[type] = type in map ? map[type].concat(handler) : [handler];
  },


  // :: (type: string, handler: (...args: [any])) #path=EventMixin.off
  // Unregister an event handler for the given event type.
  off: function off(type, handler) {
    var map = this._handlers,
        arr = map && map[type];
    if (arr) for (var i = 0; i < arr.length; ++i) {
      if (arr[i] == handler) {
        map[type] = arr.slice(0, i).concat(arr.slice(i + 1));
        break;
      }
    }
  },


  // :: (type: string, ...args: [any]) #path=EventMixin.signal
  // Signal an event of the given type, passing any number of
  // arguments. Will call the handlers for the event, passing them the
  // arguments.
  signal: function signal(type) {
    var arr = getHandlers(this, type);

    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    for (var i = 0; i < arr.length; ++i) {
      arr[i].apply(arr, args);
    }
  },


  // :: (type: string, ...args: [any]) → any
  // #path=EventMixin.signalHandleable Signal a handleable event of
  // the given type. All handlers for the event will be called with
  // the given arguments, until one of them returns something that is
  // not the value `null` or `undefined`. When that happens, the
  // return value of that handler is returned. If that does not
  // happen, `undefined` is returned.
  signalHandleable: function signalHandleable(type) {
    var arr = getHandlers(this, type);

    for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }

    for (var i = 0; i < arr.length; ++i) {
      var result = arr[i].apply(arr, args);
      if (result != null) return result;
    }
  },


  // :: (type: string, value: any) → any #path=EventMixin.signalPipelined
  // Give all handlers for an event a chance to transform a value. The
  // value returned from a handler will be passed to the next handler.
  // The method returns the value returned by the final handler (or
  // the original value, if there are no handlers).
  signalPipelined: function signalPipelined(type, value) {
    var arr = getHandlers(this, type);
    for (var i = 0; i < arr.length; ++i) {
      value = arr[i](value);
    }return value;
  },


  // :: (DOMEvent, ?string) → bool
  // Fire all handlers for `event.type` (or override the type name
  // with the `type` parameter), until one of them calls
  // `preventDefault` on the event or returns `true` to indicate it
  // handled the event. Return `true` when one of the handlers handled
  // the event.
  signalDOM: function signalDOM(event, type) {
    var arr = getHandlers(this, type || event.type);
    for (var i = 0; i < arr.length; ++i) {
      if (arr[i](event) || event.defaultPrevented) return true;
    }return false;
  },


  // :: (type: string) → bool #path=EventMixin.hasHandler
  // Query whether there are any handlers for this event type.
  hasHandler: function hasHandler(type) {
    return getHandlers(this, type).length > 0;
  }
};

// :: (())
// Add the methods in the `EventMixin` interface to the prototype
// object of the given constructor.
function eventMixin(ctor) {
  var proto = ctor.prototype;
  for (var prop in methods) {
    if (methods.hasOwnProperty(prop)) proto[prop] = methods[prop];
  }
}
},{}],52:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Map = exports.Map = window.Map || function () {
  function _class() {
    _classCallCheck(this, _class);

    this.content = [];
  }

  _createClass(_class, [{
    key: "set",
    value: function set(key, value) {
      var found = this.find(key);
      if (found > -1) this.content[found + 1] = value;else this.content.push(key, value);
    }
  }, {
    key: "get",
    value: function get(key) {
      var found = this.find(key);
      return found == -1 ? undefined : this.content[found + 1];
    }
  }, {
    key: "has",
    value: function has(key) {
      return this.find(key) > -1;
    }
  }, {
    key: "find",
    value: function find(key) {
      for (var i = 0; i < this.content.length; i += 2) {
        if (this.content[i] === key) return i;
      }
    }
  }, {
    key: "clear",
    value: function clear() {
      this.content.length = 0;
    }
  }, {
    key: "size",
    get: function get() {
      return this.content.length / 2;
    }
  }]);

  return _class;
}();
},{}],53:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.copyObj = copyObj;
function copyObj(obj, base) {
  var copy = base || Object.create(null);
  for (var prop in obj) {
    copy[prop] = obj[prop];
  }return copy;
}
},{}],54:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = sortedInsert;
function sortedInsert(array, elt, compare) {
  var i = 0;
  for (; i < array.length; i++) {
    if (compare(array[i], elt) > 0) break;
  }array.splice(i, 0, elt);
}
},{}],55:[function(require,module,exports){
(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    module.exports = mod()
  else if (typeof define == "function" && define.amd) // AMD
    return define([], mod)
  else // Plain browser env
    (this || window).browserKeymap = mod()
})(function() {
  "use strict"

  var mac = typeof navigator != "undefined" ? /Mac/.test(navigator.platform)
          : typeof os != "undefined" ? os.platform() == "darwin" : false

  // :: Object<string>
  // A map from key codes to key names.
  var keyNames = {
    3: "Enter", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
    19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
    36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
    46: "Delete", 59: ";", 61: "=", 91: "Mod", 92: "Mod", 93: "Mod",
    106: "*", 107: "=", 109: "-", 110: ".", 111: "/", 127: "Delete",
    173: "-", 186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\",
    221: "]", 222: "'", 63232: "Up", 63233: "Down", 63234: "Left", 63235: "Right", 63272: "Delete",
    63273: "Home", 63275: "End", 63276: "PageUp", 63277: "PageDown", 63302: "Insert"
  }

  // Number keys
  for (var i = 0; i < 10; i++) keyNames[i + 48] = keyNames[i + 96] = String(i)
  // Alphabetic keys
  for (var i = 65; i <= 90; i++) keyNames[i] = String.fromCharCode(i)
  // Function keys
  for (var i = 1; i <= 12; i++) keyNames[i + 111] = keyNames[i + 63235] = "F" + i

  // :: (KeyboardEvent) → ?string
  // Find a name for the given keydown event. If the keycode in the
  // event is not known, this will return `null`. Otherwise, it will
  // return a string like `"Shift-Cmd-Ctrl-Alt-Home"`. The parts before
  // the dashes give the modifiers (always in that order, if present),
  // and the last word gives the key name, which one of the names in
  // `keyNames`.
  //
  // The convention for keypress events is to use the pressed character
  // between single quotes. Due to limitations in the browser API,
  // keypress events can not have modifiers.
  function keyName(event) {
    if (event.type == "keypress") return "'" + String.fromCharCode(event.charCode) + "'"

    var base = keyNames[event.keyCode], name = base
    if (name == null || event.altGraphKey) return null

    if (event.altKey && base != "Alt") name = "Alt-" + name
    if (event.ctrlKey && base != "Ctrl") name = "Ctrl-" + name
    if (event.metaKey && base != "Cmd") name = "Cmd-" + name
    if (event.shiftKey && base != "Shift") name = "Shift-" + name
    return name
  }

  // :: (string) → bool
  // Test whether the given key name refers to a modifier key.
  function isModifierKey(name) {
    name = /[^-]*$/.exec(name)[0]
    return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod"
  }

  // :: (string) → string
  // Normalize a sloppy key name, which may have modifiers in the wrong
  // order or use shorthands for modifiers, to a properly formed key
  // name. Used to normalize names provided in keymaps.
  //
  // Note that the modifier `mod` is a shorthand for `Cmd` on Mac, and
  // `Ctrl` on other platforms.
  function normalizeKeyName(name) {
    var parts = name.split(/-(?!'?$)/), result = parts[parts.length - 1]
    var alt, ctrl, shift, cmd
    for (var i = 0; i < parts.length - 1; i++) {
      var mod = parts[i]
      if (/^(cmd|meta|m)$/i.test(mod)) cmd = true
      else if (/^a(lt)?$/i.test(mod)) alt = true
      else if (/^(c|ctrl|control)$/i.test(mod)) ctrl = true
      else if (/^s(hift)$/i.test(mod)) shift = true
      else if (/^mod$/i.test(mod)) { if (mac) cmd = true; else ctrl = true }
      else throw new Error("Unrecognized modifier name: " + mod)
    }
    if (alt) result = "Alt-" + result
    if (ctrl) result = "Ctrl-" + result
    if (cmd) result = "Cmd-" + result
    if (shift) result = "Shift-" + result
    return result
  }

  // :: (Object, ?Object)
  // A keymap binds a set of [key names](#keyName) to commands names
  // or functions.
  //
  // Construct a keymap using the bindings in `keys`, whose properties
  // should be [key names](#keyName) or space-separated sequences of
  // key names. In the second case, the binding will be for a
  // multi-stroke key combination.
  //
  // When `options` has a property `call`, this will be a programmatic
  // keymap, meaning that instead of looking keys up in its set of
  // bindings, it will pass the key name to `options.call`, and use
  // the return value of that calls as the resolved binding.
  //
  // `options.name` can be used to give the keymap a name, making it
  // easier to [remove](#ProseMirror.removeKeymap) from an editor.
  function Keymap(keys, options) {
    this.options = options || {}
    this.bindings = Object.create(null)
    if (keys) for (var keyname in keys) if (Object.prototype.hasOwnProperty.call(keys, keyname))
      this.addBinding(keyname, keys[keyname])
  }

  Keymap.prototype = {
    normalize: function(name) {
      return this.options.multi !== false ? name.split(/ +(?!\'$)/).map(normalizeKeyName) : [normalizeKeyName(name)]
    },

    // :: (string, any)
    // Add a binding for the given key or key sequence.
    addBinding: function(keyname, value) {
      var keys = this.normalize(keyname)
      for (var i = 0; i < keys.length; i++) {
        var name = keys.slice(0, i + 1).join(" ")
        var val = i == keys.length - 1 ? value : "..."
        var prev = this.bindings[name]
        if (!prev) this.bindings[name] = val
        else if (prev != val) throw new Error("Inconsistent bindings for " + name)
      }
    },

    // :: (string)
    // Remove the binding for the given key or key sequence.
    removeBinding: function(keyname) {
      var keys = this.normalize(keyname)
      for (var i = keys.length - 1; i >= 0; i--) {
        var name = keys.slice(0, i).join(" ")
        var val = this.bindings[name]
        if (val == "..." && !this.unusedMulti(name))
          break
        else if (val)
          delete this.bindings[name]
      }
    },

    unusedMulti: function(name) {
      for (var binding in this.bindings)
        if (binding.length > name && binding.indexOf(name) == 0 && binding.charAt(name.length) == " ")
          return false
      return true
    },

    // :: (string, ?any) → any
    // Looks up the given key or key sequence in this keymap. Returns
    // the value the key is bound to (which may be undefined if it is
    // not bound), or the string `"..."` if the key is a prefix of a
    // multi-key sequence that is bound by this keymap.
    lookup: function(key, context) {
      return this.options.call ? this.options.call(key, context) : this.bindings[key]
    },

    constructor: Keymap
  }

  Keymap.keyName = keyName
  Keymap.isModifierKey = isModifierKey
  Keymap.normalizeKeyName = normalizeKeyName

  return Keymap
})

},{}],56:[function(require,module,exports){
'use strict';


module.exports = require('./lib/');

},{"./lib/":66}],57:[function(require,module,exports){
// HTML5 entities map: { name -> utf16string }
//
'use strict';

/*eslint quotes:0*/
module.exports = require('entities/maps/entities.json');

},{"entities/maps/entities.json":107}],58:[function(require,module,exports){
// List of valid html blocks names, accorting to commonmark spec
// http://jgm.github.io/CommonMark/spec.html#html-blocks

'use strict';


module.exports = [
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'head',
  'header',
  'hr',
  'html',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'meta',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'pre',
  'section',
  'source',
  'title',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'track',
  'ul'
];

},{}],59:[function(require,module,exports){
// Regexps to match html elements

'use strict';

var attr_name     = '[a-zA-Z_:][a-zA-Z0-9:._-]*';

var unquoted      = '[^"\'=<>`\\x00-\\x20]+';
var single_quoted = "'[^']*'";
var double_quoted = '"[^"]*"';

var attr_value  = '(?:' + unquoted + '|' + single_quoted + '|' + double_quoted + ')';

var attribute   = '(?:\\s+' + attr_name + '(?:\\s*=\\s*' + attr_value + ')?)';

var open_tag    = '<[A-Za-z][A-Za-z0-9\\-]*' + attribute + '*\\s*\\/?>';

var close_tag   = '<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>';
var comment     = '<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->';
var processing  = '<[?].*?[?]>';
var declaration = '<![A-Z]+\\s+[^>]*>';
var cdata       = '<!\\[CDATA\\[[\\s\\S]*?\\]\\]>';

var HTML_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + '|' + comment +
                        '|' + processing + '|' + declaration + '|' + cdata + ')');
var HTML_OPEN_CLOSE_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + ')');

module.exports.HTML_TAG_RE = HTML_TAG_RE;
module.exports.HTML_OPEN_CLOSE_TAG_RE = HTML_OPEN_CLOSE_TAG_RE;

},{}],60:[function(require,module,exports){
// List of valid url schemas, accorting to commonmark spec
// http://jgm.github.io/CommonMark/spec.html#autolinks

'use strict';


module.exports = [
  'coap',
  'doi',
  'javascript',
  'aaa',
  'aaas',
  'about',
  'acap',
  'cap',
  'cid',
  'crid',
  'data',
  'dav',
  'dict',
  'dns',
  'file',
  'ftp',
  'geo',
  'go',
  'gopher',
  'h323',
  'http',
  'https',
  'iax',
  'icap',
  'im',
  'imap',
  'info',
  'ipp',
  'iris',
  'iris.beep',
  'iris.xpc',
  'iris.xpcs',
  'iris.lwz',
  'ldap',
  'mailto',
  'mid',
  'msrp',
  'msrps',
  'mtqp',
  'mupdate',
  'news',
  'nfs',
  'ni',
  'nih',
  'nntp',
  'opaquelocktoken',
  'pop',
  'pres',
  'rtsp',
  'service',
  'session',
  'shttp',
  'sieve',
  'sip',
  'sips',
  'sms',
  'snmp',
  'soap.beep',
  'soap.beeps',
  'tag',
  'tel',
  'telnet',
  'tftp',
  'thismessage',
  'tn3270',
  'tip',
  'tv',
  'urn',
  'vemmi',
  'ws',
  'wss',
  'xcon',
  'xcon-userid',
  'xmlrpc.beep',
  'xmlrpc.beeps',
  'xmpp',
  'z39.50r',
  'z39.50s',
  'adiumxtra',
  'afp',
  'afs',
  'aim',
  'apt',
  'attachment',
  'aw',
  'beshare',
  'bitcoin',
  'bolo',
  'callto',
  'chrome',
  'chrome-extension',
  'com-eventbrite-attendee',
  'content',
  'cvs',
  'dlna-playsingle',
  'dlna-playcontainer',
  'dtn',
  'dvb',
  'ed2k',
  'facetime',
  'feed',
  'finger',
  'fish',
  'gg',
  'git',
  'gizmoproject',
  'gtalk',
  'hcp',
  'icon',
  'ipn',
  'irc',
  'irc6',
  'ircs',
  'itms',
  'jar',
  'jms',
  'keyparc',
  'lastfm',
  'ldaps',
  'magnet',
  'maps',
  'market',
  'message',
  'mms',
  'ms-help',
  'msnim',
  'mumble',
  'mvn',
  'notes',
  'oid',
  'palm',
  'paparazzi',
  'platform',
  'proxy',
  'psyc',
  'query',
  'res',
  'resource',
  'rmi',
  'rsync',
  'rtmp',
  'secondlife',
  'sftp',
  'sgn',
  'skype',
  'smb',
  'soldat',
  'spotify',
  'ssh',
  'steam',
  'svn',
  'teamspeak',
  'things',
  'udp',
  'unreal',
  'ut2004',
  'ventrilo',
  'view-source',
  'webcal',
  'wtai',
  'wyciwyg',
  'xfire',
  'xri',
  'ymsgr'
];

},{}],61:[function(require,module,exports){
// Utilities
//
'use strict';


function _class(obj) { return Object.prototype.toString.call(obj); }

function isString(obj) { return _class(obj) === '[object String]'; }

var _hasOwnProperty = Object.prototype.hasOwnProperty;

function has(object, key) {
  return _hasOwnProperty.call(object, key);
}

// Merge objects
//
function assign(obj /*from1, from2, from3, ...*/) {
  var sources = Array.prototype.slice.call(arguments, 1);

  sources.forEach(function (source) {
    if (!source) { return; }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be object');
    }

    Object.keys(source).forEach(function (key) {
      obj[key] = source[key];
    });
  });

  return obj;
}

// Remove element from array and put another array at those position.
// Useful for some operations with tokens
function arrayReplaceAt(src, pos, newElements) {
  return [].concat(src.slice(0, pos), newElements, src.slice(pos + 1));
}

////////////////////////////////////////////////////////////////////////////////

function isValidEntityCode(c) {
  /*eslint no-bitwise:0*/
  // broken sequence
  if (c >= 0xD800 && c <= 0xDFFF) { return false; }
  // never used
  if (c >= 0xFDD0 && c <= 0xFDEF) { return false; }
  if ((c & 0xFFFF) === 0xFFFF || (c & 0xFFFF) === 0xFFFE) { return false; }
  // control codes
  if (c >= 0x00 && c <= 0x08) { return false; }
  if (c === 0x0B) { return false; }
  if (c >= 0x0E && c <= 0x1F) { return false; }
  if (c >= 0x7F && c <= 0x9F) { return false; }
  // out of range
  if (c > 0x10FFFF) { return false; }
  return true;
}

function fromCodePoint(c) {
  /*eslint no-bitwise:0*/
  if (c > 0xffff) {
    c -= 0x10000;
    var surrogate1 = 0xd800 + (c >> 10),
        surrogate2 = 0xdc00 + (c & 0x3ff);

    return String.fromCharCode(surrogate1, surrogate2);
  }
  return String.fromCharCode(c);
}


var UNESCAPE_MD_RE  = /\\([!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~])/g;
var ENTITY_RE       = /&([a-z#][a-z0-9]{1,31});/gi;
var UNESCAPE_ALL_RE = new RegExp(UNESCAPE_MD_RE.source + '|' + ENTITY_RE.source, 'gi');

var DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))/i;

var entities = require('./entities');

function replaceEntityPattern(match, name) {
  var code = 0;

  if (has(entities, name)) {
    return entities[name];
  }

  if (name.charCodeAt(0) === 0x23/* # */ && DIGITAL_ENTITY_TEST_RE.test(name)) {
    code = name[1].toLowerCase() === 'x' ?
      parseInt(name.slice(2), 16)
    :
      parseInt(name.slice(1), 10);
    if (isValidEntityCode(code)) {
      return fromCodePoint(code);
    }
  }

  return match;
}

/*function replaceEntities(str) {
  if (str.indexOf('&') < 0) { return str; }

  return str.replace(ENTITY_RE, replaceEntityPattern);
}*/

function unescapeMd(str) {
  if (str.indexOf('\\') < 0) { return str; }
  return str.replace(UNESCAPE_MD_RE, '$1');
}

function unescapeAll(str) {
  if (str.indexOf('\\') < 0 && str.indexOf('&') < 0) { return str; }

  return str.replace(UNESCAPE_ALL_RE, function(match, escaped, entity) {
    if (escaped) { return escaped; }
    return replaceEntityPattern(match, entity);
  });
}

////////////////////////////////////////////////////////////////////////////////

var HTML_ESCAPE_TEST_RE = /[&<>"]/;
var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
var HTML_REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
};

function replaceUnsafeChar(ch) {
  return HTML_REPLACEMENTS[ch];
}

function escapeHtml(str) {
  if (HTML_ESCAPE_TEST_RE.test(str)) {
    return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
  }
  return str;
}

////////////////////////////////////////////////////////////////////////////////

var REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;

function escapeRE (str) {
  return str.replace(REGEXP_ESCAPE_RE, '\\$&');
}

////////////////////////////////////////////////////////////////////////////////

// Zs (unicode class) || [\t\f\v\r\n]
function isWhiteSpace(code) {
  if (code >= 0x2000 && code <= 0x200A) { return true; }
  switch (code) {
    case 0x09: // \t
    case 0x0A: // \n
    case 0x0B: // \v
    case 0x0C: // \f
    case 0x0D: // \r
    case 0x20:
    case 0xA0:
    case 0x1680:
    case 0x202F:
    case 0x205F:
    case 0x3000:
      return true;
  }
  return false;
}

////////////////////////////////////////////////////////////////////////////////

/*eslint-disable max-len*/
var UNICODE_PUNCT_RE = require('uc.micro/categories/P/regex');

// Currently without astral characters support.
function isPunctChar(char) {
  return UNICODE_PUNCT_RE.test(char);
}


// Markdown ASCII punctuation characters.
//
// !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~
// http://spec.commonmark.org/0.15/#ascii-punctuation-character
//
// Don't confuse with unicode punctuation !!! It lacks some chars in ascii range.
//
function isMdAsciiPunct(ch) {
  switch (ch) {
    case 0x21/* ! */:
    case 0x22/* " */:
    case 0x23/* # */:
    case 0x24/* $ */:
    case 0x25/* % */:
    case 0x26/* & */:
    case 0x27/* ' */:
    case 0x28/* ( */:
    case 0x29/* ) */:
    case 0x2A/* * */:
    case 0x2B/* + */:
    case 0x2C/* , */:
    case 0x2D/* - */:
    case 0x2E/* . */:
    case 0x2F/* / */:
    case 0x3A/* : */:
    case 0x3B/* ; */:
    case 0x3C/* < */:
    case 0x3D/* = */:
    case 0x3E/* > */:
    case 0x3F/* ? */:
    case 0x40/* @ */:
    case 0x5B/* [ */:
    case 0x5C/* \ */:
    case 0x5D/* ] */:
    case 0x5E/* ^ */:
    case 0x5F/* _ */:
    case 0x60/* ` */:
    case 0x7B/* { */:
    case 0x7C/* | */:
    case 0x7D/* } */:
    case 0x7E/* ~ */:
      return true;
    default:
      return false;
  }
}

// Hepler to unify [reference labels].
//
function normalizeReference(str) {
  // use .toUpperCase() instead of .toLowerCase()
  // here to avoid a conflict with Object.prototype
  // members (most notably, `__proto__`)
  return str.trim().replace(/\s+/g, ' ').toUpperCase();
}

////////////////////////////////////////////////////////////////////////////////

// Re-export libraries commonly used in both markdown-it and its plugins,
// so plugins won't have to depend on them explicitly, which reduces their
// bundled size (e.g. a browser build).
//
exports.lib                 = {};
exports.lib.mdurl           = require('mdurl');
exports.lib.ucmicro         = require('uc.micro');

exports.assign              = assign;
exports.isString            = isString;
exports.has                 = has;
exports.unescapeMd          = unescapeMd;
exports.unescapeAll         = unescapeAll;
exports.isValidEntityCode   = isValidEntityCode;
exports.fromCodePoint       = fromCodePoint;
// exports.replaceEntities     = replaceEntities;
exports.escapeHtml          = escapeHtml;
exports.arrayReplaceAt      = arrayReplaceAt;
exports.isWhiteSpace        = isWhiteSpace;
exports.isMdAsciiPunct      = isMdAsciiPunct;
exports.isPunctChar         = isPunctChar;
exports.escapeRE            = escapeRE;
exports.normalizeReference  = normalizeReference;

},{"./entities":57,"mdurl":113,"uc.micro":119,"uc.micro/categories/P/regex":117}],62:[function(require,module,exports){
// Just a shortcut for bulk export
'use strict';


exports.parseLinkLabel       = require('./parse_link_label');
exports.parseLinkDestination = require('./parse_link_destination');
exports.parseLinkTitle       = require('./parse_link_title');

},{"./parse_link_destination":63,"./parse_link_label":64,"./parse_link_title":65}],63:[function(require,module,exports){
// Parse link destination
//
'use strict';


var unescapeAll   = require('../common/utils').unescapeAll;


module.exports = function parseLinkDestination(str, pos, max) {
  var code, level,
      lines = 0,
      start = pos,
      result = {
        ok: false,
        pos: 0,
        lines: 0,
        str: ''
      };

  if (str.charCodeAt(pos) === 0x3C /* < */) {
    pos++;
    while (pos < max) {
      code = str.charCodeAt(pos);
      if (code === 0x0A /* \n */) { return result; }
      if (code === 0x3E /* > */) {
        result.pos = pos + 1;
        result.str = unescapeAll(str.slice(start + 1, pos));
        result.ok = true;
        return result;
      }
      if (code === 0x5C /* \ */ && pos + 1 < max) {
        pos += 2;
        continue;
      }

      pos++;
    }

    // no closing '>'
    return result;
  }

  // this should be ... } else { ... branch

  level = 0;
  while (pos < max) {
    code = str.charCodeAt(pos);

    if (code === 0x20) { break; }

    // ascii control characters
    if (code < 0x20 || code === 0x7F) { break; }

    if (code === 0x5C /* \ */ && pos + 1 < max) {
      pos += 2;
      continue;
    }

    if (code === 0x28 /* ( */) {
      level++;
      if (level > 1) { break; }
    }

    if (code === 0x29 /* ) */) {
      level--;
      if (level < 0) { break; }
    }

    pos++;
  }

  if (start === pos) { return result; }

  result.str = unescapeAll(str.slice(start, pos));
  result.lines = lines;
  result.pos = pos;
  result.ok = true;
  return result;
};

},{"../common/utils":61}],64:[function(require,module,exports){
// Parse link label
//
// this function assumes that first character ("[") already matches;
// returns the end of the label
//
'use strict';

module.exports = function parseLinkLabel(state, start, disableNested) {
  var level, found, marker, prevPos,
      labelEnd = -1,
      max = state.posMax,
      oldPos = state.pos;

  state.pos = start + 1;
  level = 1;

  while (state.pos < max) {
    marker = state.src.charCodeAt(state.pos);
    if (marker === 0x5D /* ] */) {
      level--;
      if (level === 0) {
        found = true;
        break;
      }
    }

    prevPos = state.pos;
    state.md.inline.skipToken(state);
    if (marker === 0x5B /* [ */) {
      if (prevPos === state.pos - 1) {
        // increase level if we find text `[`, which is not a part of any token
        level++;
      } else if (disableNested) {
        state.pos = oldPos;
        return -1;
      }
    }
  }

  if (found) {
    labelEnd = state.pos;
  }

  // restore old state
  state.pos = oldPos;

  return labelEnd;
};

},{}],65:[function(require,module,exports){
// Parse link title
//
'use strict';


var unescapeAll = require('../common/utils').unescapeAll;


module.exports = function parseLinkTitle(str, pos, max) {
  var code,
      marker,
      lines = 0,
      start = pos,
      result = {
        ok: false,
        pos: 0,
        lines: 0,
        str: ''
      };

  if (pos >= max) { return result; }

  marker = str.charCodeAt(pos);

  if (marker !== 0x22 /* " */ && marker !== 0x27 /* ' */ && marker !== 0x28 /* ( */) { return result; }

  pos++;

  // if opening marker is "(", switch it to closing marker ")"
  if (marker === 0x28) { marker = 0x29; }

  while (pos < max) {
    code = str.charCodeAt(pos);
    if (code === marker) {
      result.pos = pos + 1;
      result.lines = lines;
      result.str = unescapeAll(str.slice(start + 1, pos));
      result.ok = true;
      return result;
    } else if (code === 0x0A) {
      lines++;
    } else if (code === 0x5C /* \ */ && pos + 1 < max) {
      pos++;
      if (str.charCodeAt(pos) === 0x0A) {
        lines++;
      }
    }

    pos++;
  }

  return result;
};

},{"../common/utils":61}],66:[function(require,module,exports){
// Main perser class

'use strict';


var utils        = require('./common/utils');
var helpers      = require('./helpers');
var Renderer     = require('./renderer');
var ParserCore   = require('./parser_core');
var ParserBlock  = require('./parser_block');
var ParserInline = require('./parser_inline');
var LinkifyIt    = require('linkify-it');
var mdurl        = require('mdurl');
var punycode     = require('punycode');


var config = {
  'default': require('./presets/default'),
  zero: require('./presets/zero'),
  commonmark: require('./presets/commonmark')
};

////////////////////////////////////////////////////////////////////////////////
//
// This validator can prohibit more than really needed to prevent XSS. It's a
// tradeoff to keep code simple and to be secure by default.
//
// If you need different setup - override validator method as you wish. Or
// replace it with dummy function and use external sanitizer.
//

var BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
var GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;

function validateLink(url) {
  // url should be normalized at this point, and existing entities are decoded
  var str = url.trim().toLowerCase();

  return BAD_PROTO_RE.test(str) ? (GOOD_DATA_RE.test(str) ? true : false) : true;
}

////////////////////////////////////////////////////////////////////////////////


var RECODE_HOSTNAME_FOR = [ 'http:', 'https:', 'mailto:' ];

function normalizeLink(url) {
  var parsed = mdurl.parse(url, true);

  if (parsed.hostname) {
    // Encode hostnames in urls like:
    // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
    //
    // We don't encode unknown schemas, because it's likely that we encode
    // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
    //
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toASCII(parsed.hostname);
      } catch(er) {}
    }
  }

  return mdurl.encode(mdurl.format(parsed));
}

function normalizeLinkText(url) {
  var parsed = mdurl.parse(url, true);

  if (parsed.hostname) {
    // Encode hostnames in urls like:
    // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
    //
    // We don't encode unknown schemas, because it's likely that we encode
    // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
    //
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toUnicode(parsed.hostname);
      } catch(er) {}
    }
  }

  return mdurl.decode(mdurl.format(parsed));
}


/**
 * class MarkdownIt
 *
 * Main parser/renderer class.
 *
 * ##### Usage
 *
 * ```javascript
 * // node.js, "classic" way:
 * var MarkdownIt = require('markdown-it'),
 *     md = new MarkdownIt();
 * var result = md.render('# markdown-it rulezz!');
 *
 * // node.js, the same, but with sugar:
 * var md = require('markdown-it')();
 * var result = md.render('# markdown-it rulezz!');
 *
 * // browser without AMD, added to "window" on script load
 * // Note, there are no dash.
 * var md = window.markdownit();
 * var result = md.render('# markdown-it rulezz!');
 * ```
 *
 * Single line rendering, without paragraph wrap:
 *
 * ```javascript
 * var md = require('markdown-it')();
 * var result = md.renderInline('__markdown-it__ rulezz!');
 * ```
 **/

/**
 * new MarkdownIt([presetName, options])
 * - presetName (String): optional, `commonmark` / `zero`
 * - options (Object)
 *
 * Creates parser instanse with given config. Can be called without `new`.
 *
 * ##### presetName
 *
 * MarkdownIt provides named presets as a convenience to quickly
 * enable/disable active syntax rules and options for common use cases.
 *
 * - ["commonmark"](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/commonmark.js) -
 *   configures parser to strict [CommonMark](http://commonmark.org/) mode.
 * - [default](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/default.js) -
 *   similar to GFM, used when no preset name given. Enables all available rules,
 *   but still without html, typographer & autolinker.
 * - ["zero"](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/zero.js) -
 *   all rules disabled. Useful to quickly setup your config via `.enable()`.
 *   For example, when you need only `bold` and `italic` markup and nothing else.
 *
 * ##### options:
 *
 * - __html__ - `false`. Set `true` to enable HTML tags in source. Be careful!
 *   That's not safe! You may need external sanitizer to protect output from XSS.
 *   It's better to extend features via plugins, instead of enabling HTML.
 * - __xhtmlOut__ - `false`. Set `true` to add '/' when closing single tags
 *   (`<br />`). This is needed only for full CommonMark compatibility. In real
 *   world you will need HTML output.
 * - __breaks__ - `false`. Set `true` to convert `\n` in paragraphs into `<br>`.
 * - __langPrefix__ - `language-`. CSS language class prefix for fenced blocks.
 *   Can be useful for external highlighters.
 * - __linkify__ - `false`. Set `true` to autoconvert URL-like text to links.
 * - __typographer__  - `false`. Set `true` to enable [some language-neutral
 *   replacement](https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/replacements.js) +
 *   quotes beautification (smartquotes).
 * - __quotes__ - `“”‘’`, String or Array. Double + single quotes replacement
 *   pairs, when typographer enabled and smartquotes on. For example, you can
 *   use `'«»„“'` for Russian, `'„“‚‘'` for German, and
 *   `['«\xA0', '\xA0»', '‹\xA0', '\xA0›']` for French (including nbsp).
 * - __highlight__ - `null`. Highlighter function for fenced code blocks.
 *   Highlighter `function (str, lang)` should return escaped HTML. It can also
 *   return empty string if the source was not changed and should be escaped externaly.
 *
 * ##### Example
 *
 * ```javascript
 * // commonmark mode
 * var md = require('markdown-it')('commonmark');
 *
 * // default mode
 * var md = require('markdown-it')();
 *
 * // enable everything
 * var md = require('markdown-it')({
 *   html: true,
 *   linkify: true,
 *   typographer: true
 * });
 * ```
 *
 * ##### Syntax highlighting
 *
 * ```js
 * var hljs = require('highlight.js') // https://highlightjs.org/
 *
 * var md = require('markdown-it')({
 *   highlight: function (str, lang) {
 *     if (lang && hljs.getLanguage(lang)) {
 *       try {
 *         return hljs.highlight(lang, str).value;
 *       } catch (__) {}
 *     }
 *
 *     try {
 *       return hljs.highlightAuto(str).value;
 *     } catch (__) {}
 *
 *     return ''; // use external default escaping
 *   }
 * });
 * ```
 **/
function MarkdownIt(presetName, options) {
  if (!(this instanceof MarkdownIt)) {
    return new MarkdownIt(presetName, options);
  }

  if (!options) {
    if (!utils.isString(presetName)) {
      options = presetName || {};
      presetName = 'default';
    }
  }

  /**
   * MarkdownIt#inline -> ParserInline
   *
   * Instance of [[ParserInline]]. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.inline = new ParserInline();

  /**
   * MarkdownIt#block -> ParserBlock
   *
   * Instance of [[ParserBlock]]. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.block = new ParserBlock();

  /**
   * MarkdownIt#core -> Core
   *
   * Instance of [[Core]] chain executor. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.core = new ParserCore();

  /**
   * MarkdownIt#renderer -> Renderer
   *
   * Instance of [[Renderer]]. Use it to modify output look. Or to add rendering
   * rules for new token types, generated by plugins.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * function myToken(tokens, idx, options, env, self) {
   *   //...
   *   return result;
   * };
   *
   * md.renderer.rules['my_token'] = myToken
   * ```
   *
   * See [[Renderer]] docs and [source code](https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.js).
   **/
  this.renderer = new Renderer();

  /**
   * MarkdownIt#linkify -> LinkifyIt
   *
   * [linkify-it](https://github.com/markdown-it/linkify-it) instance.
   * Used by [linkify](https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/linkify.js)
   * rule.
   **/
  this.linkify = new LinkifyIt();

  /**
   * MarkdownIt#validateLink(url) -> Boolean
   *
   * Link validation function. CommonMark allows too much in links. By default
   * we disable `javascript:`, `vbscript:`, `file:` schemas, and almost all `data:...` schemas
   * except some embedded image types.
   *
   * You can change this behaviour:
   *
   * ```javascript
   * var md = require('markdown-it')();
   * // enable everything
   * md.validateLink = function () { return true; }
   * ```
   **/
  this.validateLink = validateLink;

  /**
   * MarkdownIt#normalizeLink(url) -> String
   *
   * Function used to encode link url to a machine-readable format,
   * which includes url-encoding, punycode, etc.
   **/
  this.normalizeLink = normalizeLink;

  /**
   * MarkdownIt#normalizeLinkText(url) -> String
   *
   * Function used to decode link url to a human-readable format`
   **/
  this.normalizeLinkText = normalizeLinkText;


  // Expose utils & helpers for easy acces from plugins

  /**
   * MarkdownIt#utils -> utils
   *
   * Assorted utility functions, useful to write plugins. See details
   * [here](https://github.com/markdown-it/markdown-it/blob/master/lib/common/utils.js).
   **/
  this.utils = utils;

  /**
   * MarkdownIt#helpers -> helpers
   *
   * Link components parser functions, useful to write plugins. See details
   * [here](https://github.com/markdown-it/markdown-it/blob/master/lib/helpers).
   **/
  this.helpers = helpers;


  this.options = {};
  this.configure(presetName);

  if (options) { this.set(options); }
}


/** chainable
 * MarkdownIt.set(options)
 *
 * Set parser options (in the same format as in constructor). Probably, you
 * will never need it, but you can change options after constructor call.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')()
 *             .set({ html: true, breaks: true })
 *             .set({ typographer, true });
 * ```
 *
 * __Note:__ To achieve the best possible performance, don't modify a
 * `markdown-it` instance options on the fly. If you need multiple configurations
 * it's best to create multiple instances and initialize each with separate
 * config.
 **/
MarkdownIt.prototype.set = function (options) {
  utils.assign(this.options, options);
  return this;
};


/** chainable, internal
 * MarkdownIt.configure(presets)
 *
 * Batch load of all options and compenent settings. This is internal method,
 * and you probably will not need it. But if you with - see available presets
 * and data structure [here](https://github.com/markdown-it/markdown-it/tree/master/lib/presets)
 *
 * We strongly recommend to use presets instead of direct config loads. That
 * will give better compatibility with next versions.
 **/
MarkdownIt.prototype.configure = function (presets) {
  var self = this, presetName;

  if (utils.isString(presets)) {
    presetName = presets;
    presets = config[presetName];
    if (!presets) { throw new Error('Wrong `markdown-it` preset "' + presetName + '", check name'); }
  }

  if (!presets) { throw new Error('Wrong `markdown-it` preset, can\'t be empty'); }

  if (presets.options) { self.set(presets.options); }

  if (presets.components) {
    Object.keys(presets.components).forEach(function (name) {
      if (presets.components[name].rules) {
        self[name].ruler.enableOnly(presets.components[name].rules);
      }
    });
  }
  return this;
};


/** chainable
 * MarkdownIt.enable(list, ignoreInvalid)
 * - list (String|Array): rule name or list of rule names to enable
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable list or rules. It will automatically find appropriate components,
 * containing rules with given names. If rule not found, and `ignoreInvalid`
 * not set - throws exception.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')()
 *             .enable(['sub', 'sup'])
 *             .disable('smartquotes');
 * ```
 **/
MarkdownIt.prototype.enable = function (list, ignoreInvalid) {
  var result = [];

  if (!Array.isArray(list)) { list = [ list ]; }

  [ 'core', 'block', 'inline' ].forEach(function (chain) {
    result = result.concat(this[chain].ruler.enable(list, true));
  }, this);

  var missed = list.filter(function (name) { return result.indexOf(name) < 0; });

  if (missed.length && !ignoreInvalid) {
    throw new Error('MarkdownIt. Failed to enable unknown rule(s): ' + missed);
  }

  return this;
};


/** chainable
 * MarkdownIt.disable(list, ignoreInvalid)
 * - list (String|Array): rule name or list of rule names to disable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * The same as [[MarkdownIt.enable]], but turn specified rules off.
 **/
MarkdownIt.prototype.disable = function (list, ignoreInvalid) {
  var result = [];

  if (!Array.isArray(list)) { list = [ list ]; }

  [ 'core', 'block', 'inline' ].forEach(function (chain) {
    result = result.concat(this[chain].ruler.disable(list, true));
  }, this);

  var missed = list.filter(function (name) { return result.indexOf(name) < 0; });

  if (missed.length && !ignoreInvalid) {
    throw new Error('MarkdownIt. Failed to disable unknown rule(s): ' + missed);
  }
  return this;
};


/** chainable
 * MarkdownIt.use(plugin, params)
 *
 * Load specified plugin with given params into current parser instance.
 * It's just a sugar to call `plugin(md, params)` with curring.
 *
 * ##### Example
 *
 * ```javascript
 * var iterator = require('markdown-it-for-inline');
 * var md = require('markdown-it')()
 *             .use(iterator, 'foo_replace', 'text', function (tokens, idx) {
 *               tokens[idx].content = tokens[idx].content.replace(/foo/g, 'bar');
 *             });
 * ```
 **/
MarkdownIt.prototype.use = function (plugin /*, params, ... */) {
  var args = [ this ].concat(Array.prototype.slice.call(arguments, 1));
  plugin.apply(plugin, args);
  return this;
};


/** internal
 * MarkdownIt.parse(src, env) -> Array
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Parse input string and returns list of block tokens (special token type
 * "inline" will contain list of inline tokens). You should not call this
 * method directly, until you write custom renderer (for example, to produce
 * AST).
 *
 * `env` is used to pass data between "distributed" rules and return additional
 * metadata like reference info, needed for for renderer. It also can be used to
 * inject data in specific cases. Usually, you will be ok to pass `{}`,
 * and then pass updated object to renderer.
 **/
MarkdownIt.prototype.parse = function (src, env) {
  var state = new this.core.State(src, this, env);

  this.core.process(state);

  return state.tokens;
};


/**
 * MarkdownIt.render(src [, env]) -> String
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Render markdown string into html. It does all magic for you :).
 *
 * `env` can be used to inject additional metadata (`{}` by default).
 * But you will not need it with high probability. See also comment
 * in [[MarkdownIt.parse]].
 **/
MarkdownIt.prototype.render = function (src, env) {
  env = env || {};

  return this.renderer.render(this.parse(src, env), this.options, env);
};


/** internal
 * MarkdownIt.parseInline(src, env) -> Array
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * The same as [[MarkdownIt.parse]] but skip all block rules. It returns the
 * block tokens list with the single `inline` element, containing parsed inline
 * tokens in `children` property. Also updates `env` object.
 **/
MarkdownIt.prototype.parseInline = function (src, env) {
  var state = new this.core.State(src, this, env);

  state.inlineMode = true;
  this.core.process(state);

  return state.tokens;
};


/**
 * MarkdownIt.renderInline(src [, env]) -> String
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Similar to [[MarkdownIt.render]] but for single paragraph content. Result
 * will NOT be wrapped into `<p>` tags.
 **/
MarkdownIt.prototype.renderInline = function (src, env) {
  env = env || {};

  return this.renderer.render(this.parseInline(src, env), this.options, env);
};


module.exports = MarkdownIt;

},{"./common/utils":61,"./helpers":62,"./parser_block":67,"./parser_core":68,"./parser_inline":69,"./presets/commonmark":70,"./presets/default":71,"./presets/zero":72,"./renderer":73,"linkify-it":108,"mdurl":113,"punycode":122}],67:[function(require,module,exports){
/** internal
 * class ParserBlock
 *
 * Block-level tokenizer.
 **/
'use strict';


var Ruler           = require('./ruler');


var _rules = [
  // First 2 params - rule name & source. Secondary array - list of rules,
  // which can be terminated by this one.
  [ 'code',       require('./rules_block/code') ],
  [ 'fence',      require('./rules_block/fence'),      [ 'paragraph', 'reference', 'blockquote', 'list' ] ],
  [ 'blockquote', require('./rules_block/blockquote'), [ 'paragraph', 'reference', 'list' ] ],
  [ 'hr',         require('./rules_block/hr'),         [ 'paragraph', 'reference', 'blockquote', 'list' ] ],
  [ 'list',       require('./rules_block/list'),       [ 'paragraph', 'reference', 'blockquote' ] ],
  [ 'reference',  require('./rules_block/reference') ],
  [ 'heading',    require('./rules_block/heading'),    [ 'paragraph', 'reference', 'blockquote' ] ],
  [ 'lheading',   require('./rules_block/lheading') ],
  [ 'html_block', require('./rules_block/html_block'), [ 'paragraph', 'reference', 'blockquote' ] ],
  [ 'table',      require('./rules_block/table'),      [ 'paragraph', 'reference' ] ],
  [ 'paragraph',  require('./rules_block/paragraph') ]
];


/**
 * new ParserBlock()
 **/
function ParserBlock() {
  /**
   * ParserBlock#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of block rules.
   **/
  this.ruler = new Ruler();

  for (var i = 0; i < _rules.length; i++) {
    this.ruler.push(_rules[i][0], _rules[i][1], { alt: (_rules[i][2] || []).slice() });
  }
}


// Generate tokens for input range
//
ParserBlock.prototype.tokenize = function (state, startLine, endLine) {
  var ok, i,
      rules = this.ruler.getRules(''),
      len = rules.length,
      line = startLine,
      hasEmptyLines = false,
      maxNesting = state.md.options.maxNesting;

  while (line < endLine) {
    state.line = line = state.skipEmptyLines(line);
    if (line >= endLine) { break; }

    // Termination condition for nested calls.
    // Nested calls currently used for blockquotes & lists
    if (state.tShift[line] < state.blkIndent) { break; }

    // If nesting level exceeded - skip tail to the end. That's not ordinary
    // situation and we should not care about content.
    if (state.level >= maxNesting) {
      state.line = endLine;
      break;
    }

    // Try all possible rules.
    // On success, rule should:
    //
    // - update `state.line`
    // - update `state.tokens`
    // - return true

    for (i = 0; i < len; i++) {
      ok = rules[i](state, line, endLine, false);
      if (ok) { break; }
    }

    // set state.tight iff we had an empty line before current tag
    // i.e. latest empty line should not count
    state.tight = !hasEmptyLines;

    // paragraph might "eat" one newline after it in nested lists
    if (state.isEmpty(state.line - 1)) {
      hasEmptyLines = true;
    }

    line = state.line;

    if (line < endLine && state.isEmpty(line)) {
      hasEmptyLines = true;
      line++;

      // two empty lines should stop the parser in list mode
      if (line < endLine && state.parentType === 'list' && state.isEmpty(line)) { break; }
      state.line = line;
    }
  }
};


/**
 * ParserBlock.parse(str, md, env, outTokens)
 *
 * Process input string and push block tokens into `outTokens`
 **/
ParserBlock.prototype.parse = function (src, md, env, outTokens) {
  var state;

  if (!src) { return []; }

  state = new this.State(src, md, env, outTokens);

  this.tokenize(state, state.line, state.lineMax);
};


ParserBlock.prototype.State = require('./rules_block/state_block');


module.exports = ParserBlock;

},{"./ruler":74,"./rules_block/blockquote":75,"./rules_block/code":76,"./rules_block/fence":77,"./rules_block/heading":78,"./rules_block/hr":79,"./rules_block/html_block":80,"./rules_block/lheading":81,"./rules_block/list":82,"./rules_block/paragraph":83,"./rules_block/reference":84,"./rules_block/state_block":85,"./rules_block/table":86}],68:[function(require,module,exports){
/** internal
 * class Core
 *
 * Top-level rules executor. Glues block/inline parsers and does intermediate
 * transformations.
 **/
'use strict';


var Ruler  = require('./ruler');


var _rules = [
  [ 'normalize',      require('./rules_core/normalize')      ],
  [ 'block',          require('./rules_core/block')          ],
  [ 'inline',         require('./rules_core/inline')         ],
  [ 'linkify',        require('./rules_core/linkify')        ],
  [ 'replacements',   require('./rules_core/replacements')   ],
  [ 'smartquotes',    require('./rules_core/smartquotes')    ]
];


/**
 * new Core()
 **/
function Core() {
  /**
   * Core#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of core rules.
   **/
  this.ruler = new Ruler();

  for (var i = 0; i < _rules.length; i++) {
    this.ruler.push(_rules[i][0], _rules[i][1]);
  }
}


/**
 * Core.process(state)
 *
 * Executes core chain rules.
 **/
Core.prototype.process = function (state) {
  var i, l, rules;

  rules = this.ruler.getRules('');

  for (i = 0, l = rules.length; i < l; i++) {
    rules[i](state);
  }
};

Core.prototype.State = require('./rules_core/state_core');


module.exports = Core;

},{"./ruler":74,"./rules_core/block":87,"./rules_core/inline":88,"./rules_core/linkify":89,"./rules_core/normalize":90,"./rules_core/replacements":91,"./rules_core/smartquotes":92,"./rules_core/state_core":93}],69:[function(require,module,exports){
/** internal
 * class ParserInline
 *
 * Tokenizes paragraph content.
 **/
'use strict';


var Ruler           = require('./ruler');


////////////////////////////////////////////////////////////////////////////////
// Parser rules

var _rules = [
  [ 'text',            require('./rules_inline/text') ],
  [ 'newline',         require('./rules_inline/newline') ],
  [ 'escape',          require('./rules_inline/escape') ],
  [ 'backticks',       require('./rules_inline/backticks') ],
  [ 'strikethrough',   require('./rules_inline/strikethrough') ],
  [ 'emphasis',        require('./rules_inline/emphasis') ],
  [ 'link',            require('./rules_inline/link') ],
  [ 'image',           require('./rules_inline/image') ],
  [ 'autolink',        require('./rules_inline/autolink') ],
  [ 'html_inline',     require('./rules_inline/html_inline') ],
  [ 'entity',          require('./rules_inline/entity') ]
];


/**
 * new ParserInline()
 **/
function ParserInline() {
  /**
   * ParserInline#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of inline rules.
   **/
  this.ruler = new Ruler();

  for (var i = 0; i < _rules.length; i++) {
    this.ruler.push(_rules[i][0], _rules[i][1]);
  }
}


// Skip single token by running all rules in validation mode;
// returns `true` if any rule reported success
//
ParserInline.prototype.skipToken = function (state) {
  var i, pos = state.pos,
      rules = this.ruler.getRules(''),
      len = rules.length,
      maxNesting = state.md.options.maxNesting,
      cache = state.cache;


  if (typeof cache[pos] !== 'undefined') {
    state.pos = cache[pos];
    return;
  }

  /*istanbul ignore else*/
  if (state.level < maxNesting) {
    for (i = 0; i < len; i++) {
      if (rules[i](state, true)) {
        cache[pos] = state.pos;
        return;
      }
    }
  }

  state.pos++;
  cache[pos] = state.pos;
};


// Generate tokens for input range
//
ParserInline.prototype.tokenize = function (state) {
  var ok, i,
      rules = this.ruler.getRules(''),
      len = rules.length,
      end = state.posMax,
      maxNesting = state.md.options.maxNesting;

  while (state.pos < end) {
    // Try all possible rules.
    // On success, rule should:
    //
    // - update `state.pos`
    // - update `state.tokens`
    // - return true

    if (state.level < maxNesting) {
      for (i = 0; i < len; i++) {
        ok = rules[i](state, false);
        if (ok) { break; }
      }
    }

    if (ok) {
      if (state.pos >= end) { break; }
      continue;
    }

    state.pending += state.src[state.pos++];
  }

  if (state.pending) {
    state.pushPending();
  }
};


/**
 * ParserInline.parse(str, md, env, outTokens)
 *
 * Process input string and push inline tokens into `outTokens`
 **/
ParserInline.prototype.parse = function (str, md, env, outTokens) {
  var state = new this.State(str, md, env, outTokens);

  this.tokenize(state);
};


ParserInline.prototype.State = require('./rules_inline/state_inline');


module.exports = ParserInline;

},{"./ruler":74,"./rules_inline/autolink":94,"./rules_inline/backticks":95,"./rules_inline/emphasis":96,"./rules_inline/entity":97,"./rules_inline/escape":98,"./rules_inline/html_inline":99,"./rules_inline/image":100,"./rules_inline/link":101,"./rules_inline/newline":102,"./rules_inline/state_inline":103,"./rules_inline/strikethrough":104,"./rules_inline/text":105}],70:[function(require,module,exports){
// Commonmark default options

'use strict';


module.exports = {
  options: {
    html:         true,         // Enable HTML tags in source
    xhtmlOut:     true,         // Use '/' to close single tags (<br />)
    breaks:       false,        // Convert '\n' in paragraphs into <br>
    langPrefix:   'language-',  // CSS language prefix for fenced blocks
    linkify:      false,        // autoconvert URL-like texts to links

    // Enable some language-neutral replacements + quotes beautification
    typographer:  false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019' /* “”‘’ */,

    // Highlighter function. Should return escaped HTML,
    // or '' if input not changed
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    maxNesting:   20            // Internal protection, recursion limit
  },

  components: {

    core: {
      rules: [
        'normalize',
        'block',
        'inline'
      ]
    },

    block: {
      rules: [
        'blockquote',
        'code',
        'fence',
        'heading',
        'hr',
        'html_block',
        'lheading',
        'list',
        'reference',
        'paragraph'
      ]
    },

    inline: {
      rules: [
        'autolink',
        'backticks',
        'emphasis',
        'entity',
        'escape',
        'html_inline',
        'image',
        'link',
        'newline',
        'text'
      ]
    }
  }
};

},{}],71:[function(require,module,exports){
// markdown-it default options

'use strict';


module.exports = {
  options: {
    html:         false,        // Enable HTML tags in source
    xhtmlOut:     false,        // Use '/' to close single tags (<br />)
    breaks:       false,        // Convert '\n' in paragraphs into <br>
    langPrefix:   'language-',  // CSS language prefix for fenced blocks
    linkify:      false,        // autoconvert URL-like texts to links

    // Enable some language-neutral replacements + quotes beautification
    typographer:  false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019' /* “”‘’ */,

    // Highlighter function. Should return escaped HTML,
    // or '' if input not changed
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    maxNesting:   20            // Internal protection, recursion limit
  },

  components: {

    core: {},
    block: {},
    inline: {}
  }
};

},{}],72:[function(require,module,exports){
// "Zero" preset, with nothing enabled. Useful for manual configuring of simple
// modes. For example, to parse bold/italic only.

'use strict';


module.exports = {
  options: {
    html:         false,        // Enable HTML tags in source
    xhtmlOut:     false,        // Use '/' to close single tags (<br />)
    breaks:       false,        // Convert '\n' in paragraphs into <br>
    langPrefix:   'language-',  // CSS language prefix for fenced blocks
    linkify:      false,        // autoconvert URL-like texts to links

    // Enable some language-neutral replacements + quotes beautification
    typographer:  false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019' /* “”‘’ */,

    // Highlighter function. Should return escaped HTML,
    // or '' if input not changed
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    maxNesting:   20            // Internal protection, recursion limit
  },

  components: {

    core: {
      rules: [
        'normalize',
        'block',
        'inline'
      ]
    },

    block: {
      rules: [
        'paragraph'
      ]
    },

    inline: {
      rules: [
        'text'
      ]
    }
  }
};

},{}],73:[function(require,module,exports){
/**
 * class Renderer
 *
 * Generates HTML from parsed token stream. Each instance has independent
 * copy of rules. Those can be rewritten with ease. Also, you can add new
 * rules if you create plugin and adds new token types.
 **/
'use strict';


var assign          = require('./common/utils').assign;
var unescapeAll     = require('./common/utils').unescapeAll;
var escapeHtml      = require('./common/utils').escapeHtml;


////////////////////////////////////////////////////////////////////////////////

var default_rules = {};


default_rules.code_inline = function (tokens, idx /*, options, env */) {
  return '<code>' + escapeHtml(tokens[idx].content) + '</code>';
};


default_rules.code_block = function (tokens, idx /*, options, env */) {
  return '<pre><code>' + escapeHtml(tokens[idx].content) + '</code></pre>\n';
};


default_rules.fence = function (tokens, idx, options, env, self) {
  var token = tokens[idx],
      info = token.info ? unescapeAll(token.info).trim() : '',
      langName = '',
      highlighted;

  if (info) {
    langName = info.split(/\s+/g)[0];
    token.attrPush([ 'class', options.langPrefix + langName ]);
  }

  if (options.highlight) {
    highlighted = options.highlight(token.content, langName) || escapeHtml(token.content);
  } else {
    highlighted = escapeHtml(token.content);
  }

  return  '<pre><code' + self.renderAttrs(token) + '>'
        + highlighted
        + '</code></pre>\n';
};


default_rules.image = function (tokens, idx, options, env, self) {
  var token = tokens[idx];

  // "alt" attr MUST be set, even if empty. Because it's mandatory and
  // should be placed on proper position for tests.
  //
  // Replace content with actual value

  token.attrs[token.attrIndex('alt')][1] =
    self.renderInlineAsText(token.children, options, env);

  return self.renderToken(tokens, idx, options);
};


default_rules.hardbreak = function (tokens, idx, options /*, env */) {
  return options.xhtmlOut ? '<br />\n' : '<br>\n';
};
default_rules.softbreak = function (tokens, idx, options /*, env */) {
  return options.breaks ? (options.xhtmlOut ? '<br />\n' : '<br>\n') : '\n';
};


default_rules.text = function (tokens, idx /*, options, env */) {
  return escapeHtml(tokens[idx].content);
};


default_rules.html_block = function (tokens, idx /*, options, env */) {
  return tokens[idx].content;
};
default_rules.html_inline = function (tokens, idx /*, options, env */) {
  return tokens[idx].content;
};


/**
 * new Renderer()
 *
 * Creates new [[Renderer]] instance and fill [[Renderer#rules]] with defaults.
 **/
function Renderer() {

  /**
   * Renderer#rules -> Object
   *
   * Contains render rules for tokens. Can be updated and extended.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * md.renderer.rules.strong_open  = function () { return '<b>'; };
   * md.renderer.rules.strong_close = function () { return '</b>'; };
   *
   * var result = md.renderInline(...);
   * ```
   *
   * Each rule is called as independed static function with fixed signature:
   *
   * ```javascript
   * function my_token_render(tokens, idx, options, env, renderer) {
   *   // ...
   *   return renderedHTML;
   * }
   * ```
   *
   * See [source code](https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.js)
   * for more details and examples.
   **/
  this.rules = assign({}, default_rules);
}


/**
 * Renderer.renderAttrs(token) -> String
 *
 * Render token attributes to string.
 **/
Renderer.prototype.renderAttrs = function renderAttrs(token) {
  var i, l, result;

  if (!token.attrs) { return ''; }

  result = '';

  for (i = 0, l = token.attrs.length; i < l; i++) {
    result += ' ' + escapeHtml(token.attrs[i][0]) + '="' + escapeHtml(token.attrs[i][1]) + '"';
  }

  return result;
};


/**
 * Renderer.renderToken(tokens, idx, options) -> String
 * - tokens (Array): list of tokens
 * - idx (Numbed): token index to render
 * - options (Object): params of parser instance
 *
 * Default token renderer. Can be overriden by custom function
 * in [[Renderer#rules]].
 **/
Renderer.prototype.renderToken = function renderToken(tokens, idx, options) {
  var nextToken,
      result = '',
      needLf = false,
      token = tokens[idx];

  // Tight list paragraphs
  if (token.hidden) {
    return '';
  }

  // Insert a newline between hidden paragraph and subsequent opening
  // block-level tag.
  //
  // For example, here we should insert a newline before blockquote:
  //  - a
  //    >
  //
  if (token.block && token.nesting !== -1 && idx && tokens[idx - 1].hidden) {
    result += '\n';
  }

  // Add token name, e.g. `<img`
  result += (token.nesting === -1 ? '</' : '<') + token.tag;

  // Encode attributes, e.g. `<img src="foo"`
  result += this.renderAttrs(token);

  // Add a slash for self-closing tags, e.g. `<img src="foo" /`
  if (token.nesting === 0 && options.xhtmlOut) {
    result += ' /';
  }

  // Check if we need to add a newline after this tag
  if (token.block) {
    needLf = true;

    if (token.nesting === 1) {
      if (idx + 1 < tokens.length) {
        nextToken = tokens[idx + 1];

        if (nextToken.type === 'inline' || nextToken.hidden) {
          // Block-level tag containing an inline tag.
          //
          needLf = false;

        } else if (nextToken.nesting === -1 && nextToken.tag === token.tag) {
          // Opening tag + closing tag of the same type. E.g. `<li></li>`.
          //
          needLf = false;
        }
      }
    }
  }

  result += needLf ? '>\n' : '>';

  return result;
};


/**
 * Renderer.renderInline(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to renter
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * The same as [[Renderer.render]], but for single token of `inline` type.
 **/
Renderer.prototype.renderInline = function (tokens, options, env) {
  var type,
      result = '',
      rules = this.rules;

  for (var i = 0, len = tokens.length; i < len; i++) {
    type = tokens[i].type;

    if (typeof rules[type] !== 'undefined') {
      result += rules[type](tokens, i, options, env, this);
    } else {
      result += this.renderToken(tokens, i, options);
    }
  }

  return result;
};


/** internal
 * Renderer.renderInlineAsText(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to renter
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * Special kludge for image `alt` attributes to conform CommonMark spec.
 * Don't try to use it! Spec requires to show `alt` content with stripped markup,
 * instead of simple escaping.
 **/
Renderer.prototype.renderInlineAsText = function (tokens, options, env) {
  var result = '',
      rules = this.rules;

  for (var i = 0, len = tokens.length; i < len; i++) {
    if (tokens[i].type === 'text') {
      result += rules.text(tokens, i, options, env, this);
    } else if (tokens[i].type === 'image') {
      result += this.renderInlineAsText(tokens[i].children, options, env);
    }
  }

  return result;
};


/**
 * Renderer.render(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to renter
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * Takes token stream and generates HTML. Probably, you will never need to call
 * this method directly.
 **/
Renderer.prototype.render = function (tokens, options, env) {
  var i, len, type,
      result = '',
      rules = this.rules;

  for (i = 0, len = tokens.length; i < len; i++) {
    type = tokens[i].type;

    if (type === 'inline') {
      result += this.renderInline(tokens[i].children, options, env);
    } else if (typeof rules[type] !== 'undefined') {
      result += rules[tokens[i].type](tokens, i, options, env, this);
    } else {
      result += this.renderToken(tokens, i, options, env);
    }
  }

  return result;
};

module.exports = Renderer;

},{"./common/utils":61}],74:[function(require,module,exports){
/**
 * class Ruler
 *
 * Helper class, used by [[MarkdownIt#core]], [[MarkdownIt#block]] and
 * [[MarkdownIt#inline]] to manage sequences of functions (rules):
 *
 * - keep rules in defined order
 * - assign the name to each rule
 * - enable/disable rules
 * - add/replace rules
 * - allow assign rules to additional named chains (in the same)
 * - cacheing lists of active rules
 *
 * You will not need use this class directly until write plugins. For simple
 * rules control use [[MarkdownIt.disable]], [[MarkdownIt.enable]] and
 * [[MarkdownIt.use]].
 **/
'use strict';


/**
 * new Ruler()
 **/
function Ruler() {
  // List of added rules. Each element is:
  //
  // {
  //   name: XXX,
  //   enabled: Boolean,
  //   fn: Function(),
  //   alt: [ name2, name3 ]
  // }
  //
  this.__rules__ = [];

  // Cached rule chains.
  //
  // First level - chain name, '' for default.
  // Second level - diginal anchor for fast filtering by charcodes.
  //
  this.__cache__ = null;
}

////////////////////////////////////////////////////////////////////////////////
// Helper methods, should not be used directly


// Find rule index by name
//
Ruler.prototype.__find__ = function (name) {
  for (var i = 0; i < this.__rules__.length; i++) {
    if (this.__rules__[i].name === name) {
      return i;
    }
  }
  return -1;
};


// Build rules lookup cache
//
Ruler.prototype.__compile__ = function () {
  var self = this;
  var chains = [ '' ];

  // collect unique names
  self.__rules__.forEach(function (rule) {
    if (!rule.enabled) { return; }

    rule.alt.forEach(function (altName) {
      if (chains.indexOf(altName) < 0) {
        chains.push(altName);
      }
    });
  });

  self.__cache__ = {};

  chains.forEach(function (chain) {
    self.__cache__[chain] = [];
    self.__rules__.forEach(function (rule) {
      if (!rule.enabled) { return; }

      if (chain && rule.alt.indexOf(chain) < 0) { return; }

      self.__cache__[chain].push(rule.fn);
    });
  });
};


/**
 * Ruler.at(name, fn [, options])
 * - name (String): rule name to replace.
 * - fn (Function): new rule function.
 * - options (Object): new rule options (not mandatory).
 *
 * Replace rule by name with new function & options. Throws error if name not
 * found.
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * Replace existing typorgapher replacement rule with new one:
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.core.ruler.at('replacements', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.at = function (name, fn, options) {
  var index = this.__find__(name);
  var opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + name); }

  this.__rules__[index].fn = fn;
  this.__rules__[index].alt = opt.alt || [];
  this.__cache__ = null;
};


/**
 * Ruler.before(beforeName, ruleName, fn [, options])
 * - beforeName (String): new rule will be added before this one.
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Add new rule to chain before one with given name. See also
 * [[Ruler.after]], [[Ruler.push]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.block.ruler.before('paragraph', 'my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.before = function (beforeName, ruleName, fn, options) {
  var index = this.__find__(beforeName);
  var opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + beforeName); }

  this.__rules__.splice(index, 0, {
    name: ruleName,
    enabled: true,
    fn: fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};


/**
 * Ruler.after(afterName, ruleName, fn [, options])
 * - afterName (String): new rule will be added after this one.
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Add new rule to chain after one with given name. See also
 * [[Ruler.before]], [[Ruler.push]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.inline.ruler.after('text', 'my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.after = function (afterName, ruleName, fn, options) {
  var index = this.__find__(afterName);
  var opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + afterName); }

  this.__rules__.splice(index + 1, 0, {
    name: ruleName,
    enabled: true,
    fn: fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};

/**
 * Ruler.push(ruleName, fn [, options])
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Push new rule to the end of chain. See also
 * [[Ruler.before]], [[Ruler.after]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.core.ruler.push('my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.push = function (ruleName, fn, options) {
  var opt = options || {};

  this.__rules__.push({
    name: ruleName,
    enabled: true,
    fn: fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};


/**
 * Ruler.enable(list [, ignoreInvalid]) -> Array
 * - list (String|Array): list of rule names to enable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable rules with given names. If any rule name not found - throw Error.
 * Errors can be disabled by second param.
 *
 * Returns list of found rule names (if no exception happened).
 *
 * See also [[Ruler.disable]], [[Ruler.enableOnly]].
 **/
Ruler.prototype.enable = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [ list ]; }

  var result = [];

  // Search by name and enable
  list.forEach(function (name) {
    var idx = this.__find__(name);

    if (idx < 0) {
      if (ignoreInvalid) { return; }
      throw new Error('Rules manager: invalid rule name ' + name);
    }
    this.__rules__[idx].enabled = true;
    result.push(name);
  }, this);

  this.__cache__ = null;
  return result;
};


/**
 * Ruler.enableOnly(list [, ignoreInvalid])
 * - list (String|Array): list of rule names to enable (whitelist).
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable rules with given names, and disable everything else. If any rule name
 * not found - throw Error. Errors can be disabled by second param.
 *
 * See also [[Ruler.disable]], [[Ruler.enable]].
 **/
Ruler.prototype.enableOnly = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [ list ]; }

  this.__rules__.forEach(function (rule) { rule.enabled = false; });

  this.enable(list, ignoreInvalid);
};


/**
 * Ruler.disable(list [, ignoreInvalid]) -> Array
 * - list (String|Array): list of rule names to disable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Disable rules with given names. If any rule name not found - throw Error.
 * Errors can be disabled by second param.
 *
 * Returns list of found rule names (if no exception happened).
 *
 * See also [[Ruler.enable]], [[Ruler.enableOnly]].
 **/
Ruler.prototype.disable = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [ list ]; }

  var result = [];

  // Search by name and disable
  list.forEach(function (name) {
    var idx = this.__find__(name);

    if (idx < 0) {
      if (ignoreInvalid) { return; }
      throw new Error('Rules manager: invalid rule name ' + name);
    }
    this.__rules__[idx].enabled = false;
    result.push(name);
  }, this);

  this.__cache__ = null;
  return result;
};


/**
 * Ruler.getRules(chainName) -> Array
 *
 * Return array of active functions (rules) for given chain name. It analyzes
 * rules configuration, compiles caches if not exists and returns result.
 *
 * Default chain name is `''` (empty string). It can't be skipped. That's
 * done intentionally, to keep signature monomorphic for high speed.
 **/
Ruler.prototype.getRules = function (chainName) {
  if (this.__cache__ === null) {
    this.__compile__();
  }

  // Chain can be empty, if rules disabled. But we still have to return Array.
  return this.__cache__[chainName] || [];
};

module.exports = Ruler;

},{}],75:[function(require,module,exports){
// Block quotes

'use strict';


module.exports = function blockquote(state, startLine, endLine, silent) {
  var nextLine, lastLineEmpty, oldTShift, oldBMarks, oldIndent, oldParentType, lines,
      terminatorRules, token,
      i, l, terminate,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  // check the block quote marker
  if (state.src.charCodeAt(pos++) !== 0x3E/* > */) { return false; }

  // we know that it's going to be a valid blockquote,
  // so no point trying to find the end of it in silent mode
  if (silent) { return true; }

  // skip one optional space after '>'
  if (state.src.charCodeAt(pos) === 0x20) { pos++; }

  oldIndent = state.blkIndent;
  state.blkIndent = 0;

  oldBMarks = [ state.bMarks[startLine] ];
  state.bMarks[startLine] = pos;

  // check if we have an empty blockquote
  pos = pos < max ? state.skipSpaces(pos) : pos;
  lastLineEmpty = pos >= max;

  oldTShift = [ state.tShift[startLine] ];
  state.tShift[startLine] = pos - state.bMarks[startLine];

  terminatorRules = state.md.block.ruler.getRules('blockquote');

  // Search the end of the block
  //
  // Block ends with either:
  //  1. an empty line outside:
  //     ```
  //     > test
  //
  //     ```
  //  2. an empty line inside:
  //     ```
  //     >
  //     test
  //     ```
  //  3. another tag
  //     ```
  //     > test
  //      - - -
  //     ```
  for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
    if (state.tShift[nextLine] < oldIndent) { break; }

    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos >= max) {
      // Case 1: line is not inside the blockquote, and this line is empty.
      break;
    }

    if (state.src.charCodeAt(pos++) === 0x3E/* > */) {
      // This line is inside the blockquote.

      // skip one optional space after '>'
      if (state.src.charCodeAt(pos) === 0x20) { pos++; }

      oldBMarks.push(state.bMarks[nextLine]);
      state.bMarks[nextLine] = pos;

      pos = pos < max ? state.skipSpaces(pos) : pos;
      lastLineEmpty = pos >= max;

      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = pos - state.bMarks[nextLine];
      continue;
    }

    // Case 2: line is not inside the blockquote, and the last line was empty.
    if (lastLineEmpty) { break; }

    // Case 3: another tag found.
    terminate = false;
    for (i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) { break; }

    oldBMarks.push(state.bMarks[nextLine]);
    oldTShift.push(state.tShift[nextLine]);

    // A negative number means that this is a paragraph continuation;
    //
    // Any negative number will do the job here, but it's better for it
    // to be large enough to make any bugs obvious.
    state.tShift[nextLine] = -1;
  }

  oldParentType = state.parentType;
  state.parentType = 'blockquote';

  token        = state.push('blockquote_open', 'blockquote', 1);
  token.markup = '>';
  token.map    = lines = [ startLine, 0 ];

  state.md.block.tokenize(state, startLine, nextLine);

  token        = state.push('blockquote_close', 'blockquote', -1);
  token.markup = '>';

  state.parentType = oldParentType;
  lines[1] = state.line;

  // Restore original tShift; this might not be necessary since the parser
  // has already been here, but just to make sure we can do that.
  for (i = 0; i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i];
    state.tShift[i + startLine] = oldTShift[i];
  }
  state.blkIndent = oldIndent;

  return true;
};

},{}],76:[function(require,module,exports){
// Code block (4 spaces padded)

'use strict';


module.exports = function code(state, startLine, endLine/*, silent*/) {
  var nextLine, last, token;

  if (state.tShift[startLine] - state.blkIndent < 4) { return false; }

  last = nextLine = startLine + 1;

  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine++;
      continue;
    }
    if (state.tShift[nextLine] - state.blkIndent >= 4) {
      nextLine++;
      last = nextLine;
      continue;
    }
    break;
  }

  state.line = nextLine;

  token         = state.push('code_block', 'code', 0);
  token.content = state.getLines(startLine, last, 4 + state.blkIndent, true);
  token.map     = [ startLine, state.line ];

  return true;
};

},{}],77:[function(require,module,exports){
// fences (``` lang, ~~~ lang)

'use strict';


module.exports = function fence(state, startLine, endLine, silent) {
  var marker, len, params, nextLine, mem, token, markup,
      haveEndMarker = false,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  if (pos + 3 > max) { return false; }

  marker = state.src.charCodeAt(pos);

  if (marker !== 0x7E/* ~ */ && marker !== 0x60 /* ` */) {
    return false;
  }

  // scan marker length
  mem = pos;
  pos = state.skipChars(pos, marker);

  len = pos - mem;

  if (len < 3) { return false; }

  markup = state.src.slice(mem, pos);
  params = state.src.slice(pos, max);

  if (params.indexOf('`') >= 0) { return false; }

  // Since start is found, we can report success here in validation mode
  if (silent) { return true; }

  // search end of block
  nextLine = startLine;

  for (;;) {
    nextLine++;
    if (nextLine >= endLine) {
      // unclosed block should be autoclosed by end of document.
      // also block seems to be autoclosed by end of parent
      break;
    }

    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos < max && state.tShift[nextLine] < state.blkIndent) {
      // non-empty line with negative indent should stop the list:
      // - ```
      //  test
      break;
    }

    if (state.src.charCodeAt(pos) !== marker) { continue; }

    if (state.tShift[nextLine] - state.blkIndent >= 4) {
      // closing fence should be indented less than 4 spaces
      continue;
    }

    pos = state.skipChars(pos, marker);

    // closing code fence must be at least as long as the opening one
    if (pos - mem < len) { continue; }

    // make sure tail has spaces only
    pos = state.skipSpaces(pos);

    if (pos < max) { continue; }

    haveEndMarker = true;
    // found!
    break;
  }

  // If a fence has heading spaces, they should be removed from its inner block
  len = state.tShift[startLine];

  state.line = nextLine + (haveEndMarker ? 1 : 0);

  token         = state.push('fence', 'code', 0);
  token.info    = params;
  token.content = state.getLines(startLine + 1, nextLine, len, true);
  token.markup  = markup;
  token.map     = [ startLine, state.line ];

  return true;
};

},{}],78:[function(require,module,exports){
// heading (#, ##, ...)

'use strict';


module.exports = function heading(state, startLine, endLine, silent) {
  var ch, level, tmp, token,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  ch  = state.src.charCodeAt(pos);

  if (ch !== 0x23/* # */ || pos >= max) { return false; }

  // count heading level
  level = 1;
  ch = state.src.charCodeAt(++pos);
  while (ch === 0x23/* # */ && pos < max && level <= 6) {
    level++;
    ch = state.src.charCodeAt(++pos);
  }

  if (level > 6 || (pos < max && ch !== 0x20/* space */)) { return false; }

  if (silent) { return true; }

  // Let's cut tails like '    ###  ' from the end of string

  max = state.skipCharsBack(max, 0x20, pos); // space
  tmp = state.skipCharsBack(max, 0x23, pos); // #
  if (tmp > pos && state.src.charCodeAt(tmp - 1) === 0x20/* space */) {
    max = tmp;
  }

  state.line = startLine + 1;

  token        = state.push('heading_open', 'h' + String(level), 1);
  token.markup = '########'.slice(0, level);
  token.map    = [ startLine, state.line ];

  token          = state.push('inline', '', 0);
  token.content  = state.src.slice(pos, max).trim();
  token.map      = [ startLine, state.line ];
  token.children = [];

  token        = state.push('heading_close', 'h' + String(level), -1);
  token.markup = '########'.slice(0, level);

  return true;
};

},{}],79:[function(require,module,exports){
// Horizontal rule

'use strict';


module.exports = function hr(state, startLine, endLine, silent) {
  var marker, cnt, ch, token,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  marker = state.src.charCodeAt(pos++);

  // Check hr marker
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x5F/* _ */) {
    return false;
  }

  // markers can be mixed with spaces, but there should be at least 3 one

  cnt = 1;
  while (pos < max) {
    ch = state.src.charCodeAt(pos++);
    if (ch !== marker && ch !== 0x20/* space */) { return false; }
    if (ch === marker) { cnt++; }
  }

  if (cnt < 3) { return false; }

  if (silent) { return true; }

  state.line = startLine + 1;

  token        = state.push('hr', 'hr', 0);
  token.map    = [ startLine, state.line ];
  token.markup = Array(cnt + 1).join(String.fromCharCode(marker));

  return true;
};

},{}],80:[function(require,module,exports){
// HTML block

'use strict';


var block_names = require('../common/html_blocks');
var HTML_OPEN_CLOSE_TAG_RE = require('../common/html_re').HTML_OPEN_CLOSE_TAG_RE;

// An array of opening and corresponding closing sequences for html tags,
// last argument defines whether it can terminate a paragraph or not
//
var HTML_SEQUENCES = [
  [ /^<(script|pre|style)(?=(\s|>|$))/i, /<\/(script|pre|style)>/i, true ],
  [ /^<!--/,        /-->/,   true ],
  [ /^<\?/,         /\?>/,   true ],
  [ /^<![A-Z]/,     />/,     true ],
  [ /^<!\[CDATA\[/, /\]\]>/, true ],
  [ new RegExp('^</?(' + block_names.join('|') + ')(?=(\\s|/?>|$))', 'i'), /^$/, true ],
  [ new RegExp(HTML_OPEN_CLOSE_TAG_RE.source + '\\s*$'),  /^$/, false ]
];


module.exports = function html_block(state, startLine, endLine, silent) {
  var i, nextLine, token, lineText,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  if (!state.md.options.html) { return false; }

  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false; }

  lineText = state.src.slice(pos, max);

  for (i = 0; i < HTML_SEQUENCES.length; i++) {
    if (HTML_SEQUENCES[i][0].test(lineText)) { break; }
  }

  if (i === HTML_SEQUENCES.length) { return false; }

  if (silent) {
    // true if this sequence can be a terminator, false otherwise
    return HTML_SEQUENCES[i][2];
  }

  nextLine = startLine + 1;

  // If we are here - we detected HTML block.
  // Let's roll down till block end.
  if (!HTML_SEQUENCES[i][1].test(lineText)) {
    for (; nextLine < endLine; nextLine++) {
      if (state.tShift[nextLine] < state.blkIndent) { break; }

      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      lineText = state.src.slice(pos, max);

      if (HTML_SEQUENCES[i][1].test(lineText)) {
        if (lineText.length !== 0) { nextLine++; }
        break;
      }
    }
  }

  state.line = nextLine;

  token         = state.push('html_block', '', 0);
  token.map     = [ startLine, nextLine ];
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true);

  return true;
};

},{"../common/html_blocks":58,"../common/html_re":59}],81:[function(require,module,exports){
// lheading (---, ===)

'use strict';


module.exports = function lheading(state, startLine, endLine/*, silent*/) {
  var marker, pos, max, token, level,
      next = startLine + 1;

  if (next >= endLine) { return false; }
  if (state.tShift[next] < state.blkIndent) { return false; }

  // Scan next line

  if (state.tShift[next] - state.blkIndent > 3) { return false; }

  pos = state.bMarks[next] + state.tShift[next];
  max = state.eMarks[next];

  if (pos >= max) { return false; }

  marker = state.src.charCodeAt(pos);

  if (marker !== 0x2D/* - */ && marker !== 0x3D/* = */) { return false; }

  pos = state.skipChars(pos, marker);

  pos = state.skipSpaces(pos);

  if (pos < max) { return false; }

  pos = state.bMarks[startLine] + state.tShift[startLine];

  state.line = next + 1;
  level = (marker === 0x3D/* = */ ? 1 : 2);

  token          = state.push('heading_open', 'h' + String(level), 1);
  token.markup   = String.fromCharCode(marker);
  token.map      = [ startLine, state.line ];

  token          = state.push('inline', '', 0);
  token.content  = state.src.slice(pos, state.eMarks[startLine]).trim();
  token.map      = [ startLine, state.line - 1 ];
  token.children = [];

  token          = state.push('heading_close', 'h' + String(level), -1);
  token.markup   = String.fromCharCode(marker);

  return true;
};

},{}],82:[function(require,module,exports){
// Lists

'use strict';


// Search `[-+*][\n ]`, returns next pos arter marker on success
// or -1 on fail.
function skipBulletListMarker(state, startLine) {
  var marker, pos, max;

  pos = state.bMarks[startLine] + state.tShift[startLine];
  max = state.eMarks[startLine];

  marker = state.src.charCodeAt(pos++);
  // Check bullet
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x2B/* + */) {
    return -1;
  }

  if (pos < max && state.src.charCodeAt(pos) !== 0x20) {
    // " 1.test " - is not a list item
    return -1;
  }

  return pos;
}

// Search `\d+[.)][\n ]`, returns next pos arter marker on success
// or -1 on fail.
function skipOrderedListMarker(state, startLine) {
  var ch,
      start = state.bMarks[startLine] + state.tShift[startLine],
      pos = start,
      max = state.eMarks[startLine];

  // List marker should have at least 2 chars (digit + dot)
  if (pos + 1 >= max) { return -1; }

  ch = state.src.charCodeAt(pos++);

  if (ch < 0x30/* 0 */ || ch > 0x39/* 9 */) { return -1; }

  for (;;) {
    // EOL -> fail
    if (pos >= max) { return -1; }

    ch = state.src.charCodeAt(pos++);

    if (ch >= 0x30/* 0 */ && ch <= 0x39/* 9 */) {

      // List marker should have no more than 9 digits
      // (prevents integer overflow in browsers)
      if (pos - start >= 10) { return -1; }

      continue;
    }

    // found valid marker
    if (ch === 0x29/* ) */ || ch === 0x2e/* . */) {
      break;
    }

    return -1;
  }


  if (pos < max && state.src.charCodeAt(pos) !== 0x20/* space */) {
    // " 1.test " - is not a list item
    return -1;
  }
  return pos;
}

function markTightParagraphs(state, idx) {
  var i, l,
      level = state.level + 2;

  for (i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
    if (state.tokens[i].level === level && state.tokens[i].type === 'paragraph_open') {
      state.tokens[i + 2].hidden = true;
      state.tokens[i].hidden = true;
      i += 2;
    }
  }
}


module.exports = function list(state, startLine, endLine, silent) {
  var nextLine,
      indent,
      oldTShift,
      oldIndent,
      oldTight,
      oldParentType,
      start,
      posAfterMarker,
      max,
      indentAfterMarker,
      markerValue,
      markerCharCode,
      isOrdered,
      contentStart,
      listTokIdx,
      prevEmptyEnd,
      listLines,
      itemLines,
      tight = true,
      terminatorRules,
      token,
      i, l, terminate;

  // Detect list type and position after marker
  if ((posAfterMarker = skipOrderedListMarker(state, startLine)) >= 0) {
    isOrdered = true;
  } else if ((posAfterMarker = skipBulletListMarker(state, startLine)) >= 0) {
    isOrdered = false;
  } else {
    return false;
  }

  // We should terminate list on style change. Remember first one to compare.
  markerCharCode = state.src.charCodeAt(posAfterMarker - 1);

  // For validation mode we can terminate immediately
  if (silent) { return true; }

  // Start list
  listTokIdx = state.tokens.length;

  if (isOrdered) {
    start = state.bMarks[startLine] + state.tShift[startLine];
    markerValue = Number(state.src.substr(start, posAfterMarker - start - 1));

    token       = state.push('ordered_list_open', 'ol', 1);
    if (markerValue !== 1) {
      token.attrs = [ [ 'start', markerValue ] ];
    }

  } else {
    token       = state.push('bullet_list_open', 'ul', 1);
  }

  token.map    = listLines = [ startLine, 0 ];
  token.markup = String.fromCharCode(markerCharCode);

  //
  // Iterate list items
  //

  nextLine = startLine;
  prevEmptyEnd = false;
  terminatorRules = state.md.block.ruler.getRules('list');

  while (nextLine < endLine) {
    contentStart = state.skipSpaces(posAfterMarker);
    max = state.eMarks[nextLine];

    if (contentStart >= max) {
      // trimming space in "-    \n  3" case, indent is 1 here
      indentAfterMarker = 1;
    } else {
      indentAfterMarker = contentStart - posAfterMarker;
    }

    // If we have more than 4 spaces, the indent is 1
    // (the rest is just indented code block)
    if (indentAfterMarker > 4) { indentAfterMarker = 1; }

    // "  -  test"
    //  ^^^^^ - calculating total length of this thing
    indent = (posAfterMarker - state.bMarks[nextLine]) + indentAfterMarker;

    // Run subparser & write tokens
    token        = state.push('list_item_open', 'li', 1);
    token.markup = String.fromCharCode(markerCharCode);
    token.map    = itemLines = [ startLine, 0 ];

    oldIndent = state.blkIndent;
    oldTight = state.tight;
    oldTShift = state.tShift[startLine];
    oldParentType = state.parentType;
    state.tShift[startLine] = contentStart - state.bMarks[startLine];
    state.blkIndent = indent;
    state.tight = true;
    state.parentType = 'list';

    state.md.block.tokenize(state, startLine, endLine, true);

    // If any of list item is tight, mark list as tight
    if (!state.tight || prevEmptyEnd) {
      tight = false;
    }
    // Item become loose if finish with empty line,
    // but we should filter last element, because it means list finish
    prevEmptyEnd = (state.line - startLine) > 1 && state.isEmpty(state.line - 1);

    state.blkIndent = oldIndent;
    state.tShift[startLine] = oldTShift;
    state.tight = oldTight;
    state.parentType = oldParentType;

    token        = state.push('list_item_close', 'li', -1);
    token.markup = String.fromCharCode(markerCharCode);

    nextLine = startLine = state.line;
    itemLines[1] = nextLine;
    contentStart = state.bMarks[startLine];

    if (nextLine >= endLine) { break; }

    if (state.isEmpty(nextLine)) {
      break;
    }

    //
    // Try to check if list is terminated or continued.
    //
    if (state.tShift[nextLine] < state.blkIndent) { break; }

    // fail if terminating block found
    terminate = false;
    for (i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) { break; }

    // fail if list has another type
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0) { break; }
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0) { break; }
    }

    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) { break; }
  }

  // Finilize list
  if (isOrdered) {
    token = state.push('ordered_list_close', 'ol', -1);
  } else {
    token = state.push('bullet_list_close', 'ul', -1);
  }
  token.markup = String.fromCharCode(markerCharCode);

  listLines[1] = nextLine;
  state.line = nextLine;

  // mark paragraphs tight if needed
  if (tight) {
    markTightParagraphs(state, listTokIdx);
  }

  return true;
};

},{}],83:[function(require,module,exports){
// Paragraph

'use strict';


module.exports = function paragraph(state, startLine/*, endLine*/) {
  var content, terminate, i, l, token,
      nextLine = startLine + 1,
      terminatorRules = state.md.block.ruler.getRules('paragraph'),
      endLine = state.lineMax;

  // jump line-by-line until empty one or EOF
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.tShift[nextLine] - state.blkIndent > 3) { continue; }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.tShift[nextLine] < 0) { continue; }

    // Some tags can terminate paragraph without empty line.
    terminate = false;
    for (i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) { break; }
  }

  content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();

  state.line = nextLine;

  token          = state.push('paragraph_open', 'p', 1);
  token.map      = [ startLine, state.line ];

  token          = state.push('inline', '', 0);
  token.content  = content;
  token.map      = [ startLine, state.line ];
  token.children = [];

  token          = state.push('paragraph_close', 'p', -1);

  return true;
};

},{}],84:[function(require,module,exports){
'use strict';


var parseLinkDestination = require('../helpers/parse_link_destination');
var parseLinkTitle       = require('../helpers/parse_link_title');
var normalizeReference   = require('../common/utils').normalizeReference;


module.exports = function reference(state, startLine, _endLine, silent) {
  var ch,
      destEndPos,
      destEndLineNo,
      endLine,
      href,
      i,
      l,
      label,
      labelEnd,
      res,
      start,
      str,
      terminate,
      terminatorRules,
      title,
      lines = 0,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine],
      nextLine = startLine + 1;

  if (state.src.charCodeAt(pos) !== 0x5B/* [ */) { return false; }

  // Simple check to quickly interrupt scan on [link](url) at the start of line.
  // Can be useful on practice: https://github.com/markdown-it/markdown-it/issues/54
  while (++pos < max) {
    if (state.src.charCodeAt(pos) === 0x5D /* ] */ &&
        state.src.charCodeAt(pos - 1) !== 0x5C/* \ */) {
      if (pos + 1 === max) { return false; }
      if (state.src.charCodeAt(pos + 1) !== 0x3A/* : */) { return false; }
      break;
    }
  }

  endLine = state.lineMax;

  // jump line-by-line until empty one or EOF
  terminatorRules = state.md.block.ruler.getRules('reference');

  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.tShift[nextLine] - state.blkIndent > 3) { continue; }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.tShift[nextLine] < 0) { continue; }

    // Some tags can terminate paragraph without empty line.
    terminate = false;
    for (i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) { break; }
  }

  str = state.getLines(startLine, nextLine, state.blkIndent, false).trim();
  max = str.length;

  for (pos = 1; pos < max; pos++) {
    ch = str.charCodeAt(pos);
    if (ch === 0x5B /* [ */) {
      return false;
    } else if (ch === 0x5D /* ] */) {
      labelEnd = pos;
      break;
    } else if (ch === 0x0A /* \n */) {
      lines++;
    } else if (ch === 0x5C /* \ */) {
      pos++;
      if (pos < max && str.charCodeAt(pos) === 0x0A) {
        lines++;
      }
    }
  }

  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3A/* : */) { return false; }

  // [label]:   destination   'title'
  //         ^^^ skip optional whitespace here
  for (pos = labelEnd + 2; pos < max; pos++) {
    ch = str.charCodeAt(pos);
    if (ch === 0x0A) {
      lines++;
    } else if (ch === 0x20) {
      /*eslint no-empty:0*/
    } else {
      break;
    }
  }

  // [label]:   destination   'title'
  //            ^^^^^^^^^^^ parse this
  res = parseLinkDestination(str, pos, max);
  if (!res.ok) { return false; }

  href = state.md.normalizeLink(res.str);
  if (!state.md.validateLink(href)) { return false; }

  pos = res.pos;
  lines += res.lines;

  // save cursor state, we could require to rollback later
  destEndPos = pos;
  destEndLineNo = lines;

  // [label]:   destination   'title'
  //                       ^^^ skipping those spaces
  start = pos;
  for (; pos < max; pos++) {
    ch = str.charCodeAt(pos);
    if (ch === 0x0A) {
      lines++;
    } else if (ch === 0x20) {
      /*eslint no-empty:0*/
    } else {
      break;
    }
  }

  // [label]:   destination   'title'
  //                          ^^^^^^^ parse this
  res = parseLinkTitle(str, pos, max);
  if (pos < max && start !== pos && res.ok) {
    title = res.str;
    pos = res.pos;
    lines += res.lines;
  } else {
    title = '';
    pos = destEndPos;
    lines = destEndLineNo;
  }

  // skip trailing spaces until the rest of the line
  while (pos < max && str.charCodeAt(pos) === 0x20/* space */) { pos++; }

  if (pos < max && str.charCodeAt(pos) !== 0x0A) {
    if (title) {
      // garbage at the end of the line after title,
      // but it could still be a valid reference if we roll back
      title = '';
      pos = destEndPos;
      lines = destEndLineNo;
      while (pos < max && str.charCodeAt(pos) === 0x20/* space */) { pos++; }
    }
  }

  if (pos < max && str.charCodeAt(pos) !== 0x0A) {
    // garbage at the end of the line
    return false;
  }

  label = normalizeReference(str.slice(1, labelEnd));
  if (!label) {
    // CommonMark 0.20 disallows empty labels
    return false;
  }

  // Reference can not terminate anything. This check is for safety only.
  /*istanbul ignore if*/
  if (silent) { return true; }

  if (typeof state.env.references === 'undefined') {
    state.env.references = {};
  }
  if (typeof state.env.references[label] === 'undefined') {
    state.env.references[label] = { title: title, href: href };
  }

  state.line = startLine + lines + 1;
  return true;
};

},{"../common/utils":61,"../helpers/parse_link_destination":63,"../helpers/parse_link_title":65}],85:[function(require,module,exports){
// Parser state class

'use strict';

var Token = require('../token');


function StateBlock(src, md, env, tokens) {
  var ch, s, start, pos, len, indent, indent_found;

  this.src = src;

  // link to parser instance
  this.md     = md;

  this.env = env;

  //
  // Internal state vartiables
  //

  this.tokens = tokens;

  this.bMarks = [];  // line begin offsets for fast jumps
  this.eMarks = [];  // line end offsets for fast jumps
  this.tShift = [];  // indent for each line

  // block parser variables
  this.blkIndent  = 0; // required block content indent
                       // (for example, if we are in list)
  this.line       = 0; // line index in src
  this.lineMax    = 0; // lines count
  this.tight      = false;  // loose/tight mode for lists
  this.parentType = 'root'; // if `list`, block parser stops on two newlines
  this.ddIndent   = -1; // indent of the current dd block (-1 if there isn't any)

  this.level = 0;

  // renderer
  this.result = '';

  // Create caches
  // Generate markers.
  s = this.src;
  indent = 0;
  indent_found = false;

  for (start = pos = indent = 0, len = s.length; pos < len; pos++) {
    ch = s.charCodeAt(pos);

    if (!indent_found) {
      if (ch === 0x20/* space */) {
        indent++;
        continue;
      } else {
        indent_found = true;
      }
    }

    if (ch === 0x0A || pos === len - 1) {
      if (ch !== 0x0A) { pos++; }
      this.bMarks.push(start);
      this.eMarks.push(pos);
      this.tShift.push(indent);

      indent_found = false;
      indent = 0;
      start = pos + 1;
    }
  }

  // Push fake entry to simplify cache bounds checks
  this.bMarks.push(s.length);
  this.eMarks.push(s.length);
  this.tShift.push(0);

  this.lineMax = this.bMarks.length - 1; // don't count last fake line
}

// Push new token to "stream".
//
StateBlock.prototype.push = function (type, tag, nesting) {
  var token = new Token(type, tag, nesting);
  token.block = true;

  if (nesting < 0) { this.level--; }
  token.level = this.level;
  if (nesting > 0) { this.level++; }

  this.tokens.push(token);
  return token;
};

StateBlock.prototype.isEmpty = function isEmpty(line) {
  return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
};

StateBlock.prototype.skipEmptyLines = function skipEmptyLines(from) {
  for (var max = this.lineMax; from < max; from++) {
    if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
      break;
    }
  }
  return from;
};

// Skip spaces from given position.
StateBlock.prototype.skipSpaces = function skipSpaces(pos) {
  for (var max = this.src.length; pos < max; pos++) {
    if (this.src.charCodeAt(pos) !== 0x20/* space */) { break; }
  }
  return pos;
};

// Skip char codes from given position
StateBlock.prototype.skipChars = function skipChars(pos, code) {
  for (var max = this.src.length; pos < max; pos++) {
    if (this.src.charCodeAt(pos) !== code) { break; }
  }
  return pos;
};

// Skip char codes reverse from given position - 1
StateBlock.prototype.skipCharsBack = function skipCharsBack(pos, code, min) {
  if (pos <= min) { return pos; }

  while (pos > min) {
    if (code !== this.src.charCodeAt(--pos)) { return pos + 1; }
  }
  return pos;
};

// cut lines range from source.
StateBlock.prototype.getLines = function getLines(begin, end, indent, keepLastLF) {
  var i, first, last, queue, shift,
      line = begin;

  if (begin >= end) {
    return '';
  }

  // Opt: don't use push queue for single line;
  if (line + 1 === end) {
    first = this.bMarks[line] + Math.min(this.tShift[line], indent);
    last = this.eMarks[end - 1] + (keepLastLF ? 1 : 0);
    return this.src.slice(first, last);
  }

  queue = new Array(end - begin);

  for (i = 0; line < end; line++, i++) {
    shift = this.tShift[line];
    if (shift > indent) { shift = indent; }
    if (shift < 0) { shift = 0; }

    first = this.bMarks[line] + shift;

    if (line + 1 < end || keepLastLF) {
      // No need for bounds check because we have fake entry on tail.
      last = this.eMarks[line] + 1;
    } else {
      last = this.eMarks[line];
    }

    queue[i] = this.src.slice(first, last);
  }

  return queue.join('');
};

// re-export Token class to use in block rules
StateBlock.prototype.Token = Token;


module.exports = StateBlock;

},{"../token":106}],86:[function(require,module,exports){
// GFM table, non-standard

'use strict';


function getLine(state, line) {
  var pos = state.bMarks[line] + state.blkIndent,
      max = state.eMarks[line];

  return state.src.substr(pos, max - pos);
}

function escapedSplit(str) {
  var result = [],
      pos = 0,
      max = str.length,
      ch,
      escapes = 0,
      lastPos = 0,
      backTicked = false,
      lastBackTick = 0;

  ch  = str.charCodeAt(pos);

  while (pos < max) {
    if (ch === 0x60/* ` */ && (escapes % 2 === 0)) {
      backTicked = !backTicked;
      lastBackTick = pos;
    } else if (ch === 0x7c/* | */ && (escapes % 2 === 0) && !backTicked) {
      result.push(str.substring(lastPos, pos));
      lastPos = pos + 1;
    } else if (ch === 0x5c/* \ */) {
      escapes++;
    } else {
      escapes = 0;
    }

    pos++;

    // If there was an un-closed backtick, go back to just after
    // the last backtick, but as if it was a normal character
    if (pos === max && backTicked) {
      backTicked = false;
      pos = lastBackTick + 1;
    }

    ch = str.charCodeAt(pos);
  }

  result.push(str.substring(lastPos));

  return result;
}


module.exports = function table(state, startLine, endLine, silent) {
  var ch, lineText, pos, i, nextLine, rows, token,
      aligns, t, tableLines, tbodyLines;

  // should have at least three lines
  if (startLine + 2 > endLine) { return false; }

  nextLine = startLine + 1;

  if (state.tShift[nextLine] < state.blkIndent) { return false; }

  // first character of the second line should be '|' or '-'

  pos = state.bMarks[nextLine] + state.tShift[nextLine];
  if (pos >= state.eMarks[nextLine]) { return false; }

  ch = state.src.charCodeAt(pos);
  if (ch !== 0x7C/* | */ && ch !== 0x2D/* - */ && ch !== 0x3A/* : */) { return false; }

  lineText = getLine(state, startLine + 1);
  if (!/^[-:| ]+$/.test(lineText)) { return false; }

  rows = lineText.split('|');
  if (rows.length < 2) { return false; }
  aligns = [];
  for (i = 0; i < rows.length; i++) {
    t = rows[i].trim();
    if (!t) {
      // allow empty columns before and after table, but not in between columns;
      // e.g. allow ` |---| `, disallow ` ---||--- `
      if (i === 0 || i === rows.length - 1) {
        continue;
      } else {
        return false;
      }
    }

    if (!/^:?-+:?$/.test(t)) { return false; }
    if (t.charCodeAt(t.length - 1) === 0x3A/* : */) {
      aligns.push(t.charCodeAt(0) === 0x3A/* : */ ? 'center' : 'right');
    } else if (t.charCodeAt(0) === 0x3A/* : */) {
      aligns.push('left');
    } else {
      aligns.push('');
    }
  }

  lineText = getLine(state, startLine).trim();
  if (lineText.indexOf('|') === -1) { return false; }
  rows = escapedSplit(lineText.replace(/^\||\|$/g, ''));
  if (aligns.length !== rows.length) { return false; }
  if (silent) { return true; }

  token     = state.push('table_open', 'table', 1);
  token.map = tableLines = [ startLine, 0 ];

  token     = state.push('thead_open', 'thead', 1);
  token.map = [ startLine, startLine + 1 ];

  token     = state.push('tr_open', 'tr', 1);
  token.map = [ startLine, startLine + 1 ];

  for (i = 0; i < rows.length; i++) {
    token          = state.push('th_open', 'th', 1);
    token.map      = [ startLine, startLine + 1 ];
    if (aligns[i]) {
      token.attrs  = [ [ 'style', 'text-align:' + aligns[i] ] ];
    }

    token          = state.push('inline', '', 0);
    token.content  = rows[i].trim();
    token.map      = [ startLine, startLine + 1 ];
    token.children = [];

    token          = state.push('th_close', 'th', -1);
  }

  token     = state.push('tr_close', 'tr', -1);
  token     = state.push('thead_close', 'thead', -1);

  token     = state.push('tbody_open', 'tbody', 1);
  token.map = tbodyLines = [ startLine + 2, 0 ];

  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.tShift[nextLine] < state.blkIndent) { break; }

    lineText = getLine(state, nextLine).trim();
    if (lineText.indexOf('|') === -1) { break; }
    rows = escapedSplit(lineText.replace(/^\||\|$/g, ''));

    // set number of columns to number of columns in header row
    rows.length = aligns.length;

    token = state.push('tr_open', 'tr', 1);
    for (i = 0; i < rows.length; i++) {
      token          = state.push('td_open', 'td', 1);
      if (aligns[i]) {
        token.attrs  = [ [ 'style', 'text-align:' + aligns[i] ] ];
      }

      token          = state.push('inline', '', 0);
      token.content  = rows[i] ? rows[i].trim() : '';
      token.children = [];

      token          = state.push('td_close', 'td', -1);
    }
    token = state.push('tr_close', 'tr', -1);
  }
  token = state.push('tbody_close', 'tbody', -1);
  token = state.push('table_close', 'table', -1);

  tableLines[1] = tbodyLines[1] = nextLine;
  state.line = nextLine;
  return true;
};

},{}],87:[function(require,module,exports){
'use strict';


module.exports = function block(state) {
  var token;

  if (state.inlineMode) {
    token          = new state.Token('inline', '', 0);
    token.content  = state.src;
    token.map      = [ 0, 1 ];
    token.children = [];
    state.tokens.push(token);
  } else {
    state.md.block.parse(state.src, state.md, state.env, state.tokens);
  }
};

},{}],88:[function(require,module,exports){
'use strict';

module.exports = function inline(state) {
  var tokens = state.tokens, tok, i, l;

  // Parse inlines
  for (i = 0, l = tokens.length; i < l; i++) {
    tok = tokens[i];
    if (tok.type === 'inline') {
      state.md.inline.parse(tok.content, state.md, state.env, tok.children);
    }
  }
};

},{}],89:[function(require,module,exports){
// Replace link-like texts with link nodes.
//
// Currently restricted by `md.validateLink()` to http/https/ftp
//
'use strict';


var arrayReplaceAt = require('../common/utils').arrayReplaceAt;


function isLinkOpen(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose(str) {
  return /^<\/a\s*>/i.test(str);
}


module.exports = function linkify(state) {
  var i, j, l, tokens, token, currentToken, nodes, ln, text, pos, lastPos,
      level, htmlLinkLevel, url, fullUrl, urlText,
      blockTokens = state.tokens,
      links;

  if (!state.md.options.linkify) { return; }

  for (j = 0, l = blockTokens.length; j < l; j++) {
    if (blockTokens[j].type !== 'inline' ||
        !state.md.linkify.pretest(blockTokens[j].content)) {
      continue;
    }

    tokens = blockTokens[j].children;

    htmlLinkLevel = 0;

    // We scan from the end, to keep position when new tags added.
    // Use reversed logic in links start/end match
    for (i = tokens.length - 1; i >= 0; i--) {
      currentToken = tokens[i];

      // Skip content of markdown links
      if (currentToken.type === 'link_close') {
        i--;
        while (tokens[i].level !== currentToken.level && tokens[i].type !== 'link_open') {
          i--;
        }
        continue;
      }

      // Skip content of html tag links
      if (currentToken.type === 'html_inline') {
        if (isLinkOpen(currentToken.content) && htmlLinkLevel > 0) {
          htmlLinkLevel--;
        }
        if (isLinkClose(currentToken.content)) {
          htmlLinkLevel++;
        }
      }
      if (htmlLinkLevel > 0) { continue; }

      if (currentToken.type === 'text' && state.md.linkify.test(currentToken.content)) {

        text = currentToken.content;
        links = state.md.linkify.match(text);

        // Now split string to nodes
        nodes = [];
        level = currentToken.level;
        lastPos = 0;

        for (ln = 0; ln < links.length; ln++) {

          url = links[ln].url;
          fullUrl = state.md.normalizeLink(url);
          if (!state.md.validateLink(fullUrl)) { continue; }

          urlText = links[ln].text;

          // Linkifier might send raw hostnames like "example.com", where url
          // starts with domain name. So we prepend http:// in those cases,
          // and remove it afterwards.
          //
          if (!links[ln].schema) {
            urlText = state.md.normalizeLinkText('http://' + urlText).replace(/^http:\/\//, '');
          } else if (links[ln].schema === 'mailto:' && !/^mailto:/i.test(urlText)) {
            urlText = state.md.normalizeLinkText('mailto:' + urlText).replace(/^mailto:/, '');
          } else {
            urlText = state.md.normalizeLinkText(urlText);
          }

          pos = links[ln].index;

          if (pos > lastPos) {
            token         = new state.Token('text', '', 0);
            token.content = text.slice(lastPos, pos);
            token.level   = level;
            nodes.push(token);
          }

          token         = new state.Token('link_open', 'a', 1);
          token.attrs   = [ [ 'href', fullUrl ] ];
          token.level   = level++;
          token.markup  = 'linkify';
          token.info    = 'auto';
          nodes.push(token);

          token         = new state.Token('text', '', 0);
          token.content = urlText;
          token.level   = level;
          nodes.push(token);

          token         = new state.Token('link_close', 'a', -1);
          token.level   = --level;
          token.markup  = 'linkify';
          token.info    = 'auto';
          nodes.push(token);

          lastPos = links[ln].lastIndex;
        }
        if (lastPos < text.length) {
          token         = new state.Token('text', '', 0);
          token.content = text.slice(lastPos);
          token.level   = level;
          nodes.push(token);
        }

        // replace current node
        blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, nodes);
      }
    }
  }
};

},{"../common/utils":61}],90:[function(require,module,exports){
// Normalize input string

'use strict';


var TABS_SCAN_RE = /[\n\t]/g;
var NEWLINES_RE  = /\r[\n\u0085]|[\u2424\u2028\u0085]/g;
var NULL_RE      = /\u0000/g;


module.exports = function inline(state) {
  var str, lineStart, lastTabPos;

  // Normalize newlines
  str = state.src.replace(NEWLINES_RE, '\n');

  // Replace NULL characters
  str = str.replace(NULL_RE, '\uFFFD');

  // Replace tabs with proper number of spaces (1..4)
  if (str.indexOf('\t') >= 0) {
    lineStart = 0;
    lastTabPos = 0;

    str = str.replace(TABS_SCAN_RE, function (match, offset) {
      var result;
      if (str.charCodeAt(offset) === 0x0A) {
        lineStart = offset + 1;
        lastTabPos = 0;
        return match;
      }
      result = '    '.slice((offset - lineStart - lastTabPos) % 4);
      lastTabPos = offset - lineStart + 1;
      return result;
    });
  }

  state.src = str;
};

},{}],91:[function(require,module,exports){
// Simple typographyc replacements
//
// (c) (C) → ©
// (tm) (TM) → ™
// (r) (R) → ®
// +- → ±
// (p) (P) -> §
// ... → … (also ?.... → ?.., !.... → !..)
// ???????? → ???, !!!!! → !!!, `,,` → `,`
// -- → &ndash;, --- → &mdash;
//
'use strict';

// TODO:
// - fractionals 1/2, 1/4, 3/4 -> ½, ¼, ¾
// - miltiplication 2 x 4 -> 2 × 4

var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;

// Workaround for phantomjs - need regex without /g flag,
// or root check will fail every second time
var SCOPED_ABBR_TEST_RE = /\((c|tm|r|p)\)/i;

var SCOPED_ABBR_RE = /\((c|tm|r|p)\)/ig;
var SCOPED_ABBR = {
  'c': '©',
  'r': '®',
  'p': '§',
  'tm': '™'
};

function replaceFn(match, name) {
  return SCOPED_ABBR[name.toLowerCase()];
}

function replace_scoped(inlineTokens) {
  var i, token;

  for (i = inlineTokens.length - 1; i >= 0; i--) {
    token = inlineTokens[i];
    if (token.type === 'text') {
      token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
    }
  }
}

function replace_rare(inlineTokens) {
  var i, token;

  for (i = inlineTokens.length - 1; i >= 0; i--) {
    token = inlineTokens[i];
    if (token.type === 'text') {
      if (RARE_RE.test(token.content)) {
        token.content = token.content
                    .replace(/\+-/g, '±')
                    // .., ..., ....... -> …
                    // but ?..... & !..... -> ?.. & !..
                    .replace(/\.{2,}/g, '…').replace(/([?!])…/g, '$1..')
                    .replace(/([?!]){4,}/g, '$1$1$1').replace(/,{2,}/g, ',')
                    // em-dash
                    .replace(/(^|[^-])---([^-]|$)/mg, '$1\u2014$2')
                    // en-dash
                    .replace(/(^|\s)--(\s|$)/mg, '$1\u2013$2')
                    .replace(/(^|[^-\s])--([^-\s]|$)/mg, '$1\u2013$2');
      }
    }
  }
}


module.exports = function replace(state) {
  var blkIdx;

  if (!state.md.options.typographer) { return; }

  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {

    if (state.tokens[blkIdx].type !== 'inline') { continue; }

    if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) {
      replace_scoped(state.tokens[blkIdx].children);
    }

    if (RARE_RE.test(state.tokens[blkIdx].content)) {
      replace_rare(state.tokens[blkIdx].children);
    }

  }
};

},{}],92:[function(require,module,exports){
// Convert straight quotation marks to typographic ones
//
'use strict';


var isWhiteSpace   = require('../common/utils').isWhiteSpace;
var isPunctChar    = require('../common/utils').isPunctChar;
var isMdAsciiPunct = require('../common/utils').isMdAsciiPunct;

var QUOTE_TEST_RE = /['"]/;
var QUOTE_RE = /['"]/g;
var APOSTROPHE = '\u2019'; /* ’ */


function replaceAt(str, index, ch) {
  return str.substr(0, index) + ch + str.substr(index + 1);
}

function process_inlines(tokens, state) {
  var i, token, text, t, pos, max, thisLevel, item, lastChar, nextChar,
      isLastPunctChar, isNextPunctChar, isLastWhiteSpace, isNextWhiteSpace,
      canOpen, canClose, j, isSingle, stack, openQuote, closeQuote;

  stack = [];

  for (i = 0; i < tokens.length; i++) {
    token = tokens[i];

    thisLevel = tokens[i].level;

    for (j = stack.length - 1; j >= 0; j--) {
      if (stack[j].level <= thisLevel) { break; }
    }
    stack.length = j + 1;

    if (token.type !== 'text') { continue; }

    text = token.content;
    pos = 0;
    max = text.length;

    /*eslint no-labels:0,block-scoped-var:0*/
    OUTER:
    while (pos < max) {
      QUOTE_RE.lastIndex = pos;
      t = QUOTE_RE.exec(text);
      if (!t) { break; }

      canOpen = canClose = true;
      pos = t.index + 1;
      isSingle = (t[0] === "'");

      // treat begin/end of the line as a whitespace
      lastChar = t.index - 1 >= 0 ? text.charCodeAt(t.index - 1) : 0x20;
      nextChar = pos < max ? text.charCodeAt(pos) : 0x20;

      isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
      isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));

      isLastWhiteSpace = isWhiteSpace(lastChar);
      isNextWhiteSpace = isWhiteSpace(nextChar);

      if (isNextWhiteSpace) {
        canOpen = false;
      } else if (isNextPunctChar) {
        if (!(isLastWhiteSpace || isLastPunctChar)) {
          canOpen = false;
        }
      }

      if (isLastWhiteSpace) {
        canClose = false;
      } else if (isLastPunctChar) {
        if (!(isNextWhiteSpace || isNextPunctChar)) {
          canClose = false;
        }
      }

      if (nextChar === 0x22 /* " */ && t[0] === '"') {
        if (lastChar >= 0x30 /* 0 */ && lastChar <= 0x39 /* 9 */) {
          // special case: 1"" - count first quote as an inch
          canClose = canOpen = false;
        }
      }

      if (canOpen && canClose) {
        // treat this as the middle of the word
        canOpen = false;
        canClose = isNextPunctChar;
      }

      if (!canOpen && !canClose) {
        // middle of word
        if (isSingle) {
          token.content = replaceAt(token.content, t.index, APOSTROPHE);
        }
        continue;
      }

      if (canClose) {
        // this could be a closing quote, rewind the stack to get a match
        for (j = stack.length - 1; j >= 0; j--) {
          item = stack[j];
          if (stack[j].level < thisLevel) { break; }
          if (item.single === isSingle && stack[j].level === thisLevel) {
            item = stack[j];

            if (isSingle) {
              openQuote = state.md.options.quotes[2];
              closeQuote = state.md.options.quotes[3];
            } else {
              openQuote = state.md.options.quotes[0];
              closeQuote = state.md.options.quotes[1];
            }

            // replace token.content *before* tokens[item.token].content,
            // because, if they are pointing at the same token, replaceAt
            // could mess up indices when quote length != 1
            token.content = replaceAt(token.content, t.index, closeQuote);
            tokens[item.token].content = replaceAt(
              tokens[item.token].content, item.pos, openQuote);

            pos += closeQuote.length - 1;
            if (item.token === i) { pos += openQuote.length - 1; }

            text = token.content;
            max = text.length;

            stack.length = j;
            continue OUTER;
          }
        }
      }

      if (canOpen) {
        stack.push({
          token: i,
          pos: t.index,
          single: isSingle,
          level: thisLevel
        });
      } else if (canClose && isSingle) {
        token.content = replaceAt(token.content, t.index, APOSTROPHE);
      }
    }
  }
}


module.exports = function smartquotes(state) {
  /*eslint max-depth:0*/
  var blkIdx;

  if (!state.md.options.typographer) { return; }

  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {

    if (state.tokens[blkIdx].type !== 'inline' ||
        !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) {
      continue;
    }

    process_inlines(state.tokens[blkIdx].children, state);
  }
};

},{"../common/utils":61}],93:[function(require,module,exports){
// Core state object
//
'use strict';

var Token = require('../token');


function StateCore(src, md, env) {
  this.src = src;
  this.env = env;
  this.tokens = [];
  this.inlineMode = false;
  this.md = md; // link to parser instance
}

// re-export Token class to use in core rules
StateCore.prototype.Token = Token;


module.exports = StateCore;

},{"../token":106}],94:[function(require,module,exports){
// Process autolinks '<protocol:...>'

'use strict';

var url_schemas = require('../common/url_schemas');


/*eslint max-len:0*/
var EMAIL_RE    = /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/;
var AUTOLINK_RE = /^<([a-zA-Z.\-]{1,25}):([^<>\x00-\x20]*)>/;


module.exports = function autolink(state, silent) {
  var tail, linkMatch, emailMatch, url, fullUrl, token,
      pos = state.pos;

  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false; }

  tail = state.src.slice(pos);

  if (tail.indexOf('>') < 0) { return false; }

  if (AUTOLINK_RE.test(tail)) {
    linkMatch = tail.match(AUTOLINK_RE);

    if (url_schemas.indexOf(linkMatch[1].toLowerCase()) < 0) { return false; }

    url = linkMatch[0].slice(1, -1);
    fullUrl = state.md.normalizeLink(url);
    if (!state.md.validateLink(fullUrl)) { return false; }

    if (!silent) {
      token         = state.push('link_open', 'a', 1);
      token.attrs   = [ [ 'href', fullUrl ] ];

      token         = state.push('text', '', 0);
      token.content = state.md.normalizeLinkText(url);

      token         = state.push('link_close', 'a', -1);
    }

    state.pos += linkMatch[0].length;
    return true;
  }

  if (EMAIL_RE.test(tail)) {
    emailMatch = tail.match(EMAIL_RE);

    url = emailMatch[0].slice(1, -1);
    fullUrl = state.md.normalizeLink('mailto:' + url);
    if (!state.md.validateLink(fullUrl)) { return false; }

    if (!silent) {
      token         = state.push('link_open', 'a', 1);
      token.attrs   = [ [ 'href', fullUrl ] ];
      token.markup  = 'autolink';
      token.info    = 'auto';

      token         = state.push('text', '', 0);
      token.content = state.md.normalizeLinkText(url);

      token         = state.push('link_close', 'a', -1);
      token.markup  = 'autolink';
      token.info    = 'auto';
    }

    state.pos += emailMatch[0].length;
    return true;
  }

  return false;
};

},{"../common/url_schemas":60}],95:[function(require,module,exports){
// Parse backticks

'use strict';

module.exports = function backtick(state, silent) {
  var start, max, marker, matchStart, matchEnd, token,
      pos = state.pos,
      ch = state.src.charCodeAt(pos);

  if (ch !== 0x60/* ` */) { return false; }

  start = pos;
  pos++;
  max = state.posMax;

  while (pos < max && state.src.charCodeAt(pos) === 0x60/* ` */) { pos++; }

  marker = state.src.slice(start, pos);

  matchStart = matchEnd = pos;

  while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
    matchEnd = matchStart + 1;

    while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60/* ` */) { matchEnd++; }

    if (matchEnd - matchStart === marker.length) {
      if (!silent) {
        token         = state.push('code_inline', 'code', 0);
        token.markup  = marker;
        token.content = state.src.slice(pos, matchStart)
                                 .replace(/[ \n]+/g, ' ')
                                 .trim();
      }
      state.pos = matchEnd;
      return true;
    }
  }

  if (!silent) { state.pending += marker; }
  state.pos += marker.length;
  return true;
};

},{}],96:[function(require,module,exports){
// Process *this* and _that_
//
'use strict';


var isWhiteSpace   = require('../common/utils').isWhiteSpace;
var isPunctChar    = require('../common/utils').isPunctChar;
var isMdAsciiPunct = require('../common/utils').isMdAsciiPunct;


// parse sequence of emphasis markers,
// "start" should point at a valid marker
function scanDelims(state, start) {
  var pos = start, lastChar, nextChar, count, can_open, can_close,
      isLastWhiteSpace, isLastPunctChar,
      isNextWhiteSpace, isNextPunctChar,
      left_flanking = true,
      right_flanking = true,
      max = state.posMax,
      marker = state.src.charCodeAt(start);

  // treat beginning of the line as a whitespace
  lastChar = start > 0 ? state.src.charCodeAt(start - 1) : 0x20;

  while (pos < max && state.src.charCodeAt(pos) === marker) { pos++; }

  count = pos - start;

  // treat end of the line as a whitespace
  nextChar = pos < max ? state.src.charCodeAt(pos) : 0x20;

  isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
  isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));

  isLastWhiteSpace = isWhiteSpace(lastChar);
  isNextWhiteSpace = isWhiteSpace(nextChar);

  if (isNextWhiteSpace) {
    left_flanking = false;
  } else if (isNextPunctChar) {
    if (!(isLastWhiteSpace || isLastPunctChar)) {
      left_flanking = false;
    }
  }

  if (isLastWhiteSpace) {
    right_flanking = false;
  } else if (isLastPunctChar) {
    if (!(isNextWhiteSpace || isNextPunctChar)) {
      right_flanking = false;
    }
  }

  if (marker === 0x5F /* _ */) {
    // "_" inside a word can neither open nor close an emphasis
    can_open  = left_flanking  && (!right_flanking || isLastPunctChar);
    can_close = right_flanking && (!left_flanking  || isNextPunctChar);
  } else {
    can_open  = left_flanking;
    can_close = right_flanking;
  }

  return {
    can_open: can_open,
    can_close: can_close,
    delims: count
  };
}

module.exports = function emphasis(state, silent) {
  var startCount,
      count,
      found,
      oldCount,
      newCount,
      stack,
      res,
      token,
      max = state.posMax,
      start = state.pos,
      marker = state.src.charCodeAt(start);

  if (marker !== 0x5F/* _ */ && marker !== 0x2A /* * */) { return false; }
  if (silent) { return false; } // don't run any pairs in validation mode

  res = scanDelims(state, start);
  startCount = res.delims;
  if (!res.can_open) {
    state.pos += startCount;
    // Earlier we checked !silent, but this implementation does not need it
    state.pending += state.src.slice(start, state.pos);
    return true;
  }

  state.pos = start + startCount;
  stack = [ startCount ];

  while (state.pos < max) {
    if (state.src.charCodeAt(state.pos) === marker) {
      res = scanDelims(state, state.pos);
      count = res.delims;
      if (res.can_close) {
        oldCount = stack.pop();
        newCount = count;

        while (oldCount !== newCount) {
          if (newCount < oldCount) {
            stack.push(oldCount - newCount);
            break;
          }

          // assert(newCount > oldCount)
          newCount -= oldCount;

          if (stack.length === 0) { break; }
          state.pos += oldCount;
          oldCount = stack.pop();
        }

        if (stack.length === 0) {
          startCount = oldCount;
          found = true;
          break;
        }
        state.pos += count;
        continue;
      }

      if (res.can_open) { stack.push(count); }
      state.pos += count;
      continue;
    }

    state.md.inline.skipToken(state);
  }

  if (!found) {
    // parser failed to find ending tag, so it's not valid emphasis
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + startCount;

  // Earlier we checked !silent, but this implementation does not need it

  // we have `startCount` starting and ending markers,
  // now trying to serialize them into tokens
  for (count = startCount; count > 1; count -= 2) {
    token        = state.push('strong_open', 'strong', 1);
    token.markup = String.fromCharCode(marker) + String.fromCharCode(marker);
  }
  if (count % 2) {
    token        = state.push('em_open', 'em', 1);
    token.markup = String.fromCharCode(marker);
  }

  state.md.inline.tokenize(state);

  if (count % 2) {
    token        = state.push('em_close', 'em', -1);
    token.markup = String.fromCharCode(marker);
  }
  for (count = startCount; count > 1; count -= 2) {
    token        = state.push('strong_close', 'strong', -1);
    token.markup = String.fromCharCode(marker) + String.fromCharCode(marker);
  }

  state.pos = state.posMax + startCount;
  state.posMax = max;
  return true;
};

},{"../common/utils":61}],97:[function(require,module,exports){
// Process html entity - &#123;, &#xAF;, &quot;, ...

'use strict';

var entities          = require('../common/entities');
var has               = require('../common/utils').has;
var isValidEntityCode = require('../common/utils').isValidEntityCode;
var fromCodePoint     = require('../common/utils').fromCodePoint;


var DIGITAL_RE = /^&#((?:x[a-f0-9]{1,8}|[0-9]{1,8}));/i;
var NAMED_RE   = /^&([a-z][a-z0-9]{1,31});/i;


module.exports = function entity(state, silent) {
  var ch, code, match, pos = state.pos, max = state.posMax;

  if (state.src.charCodeAt(pos) !== 0x26/* & */) { return false; }

  if (pos + 1 < max) {
    ch = state.src.charCodeAt(pos + 1);

    if (ch === 0x23 /* # */) {
      match = state.src.slice(pos).match(DIGITAL_RE);
      if (match) {
        if (!silent) {
          code = match[1][0].toLowerCase() === 'x' ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);
          state.pending += isValidEntityCode(code) ? fromCodePoint(code) : fromCodePoint(0xFFFD);
        }
        state.pos += match[0].length;
        return true;
      }
    } else {
      match = state.src.slice(pos).match(NAMED_RE);
      if (match) {
        if (has(entities, match[1])) {
          if (!silent) { state.pending += entities[match[1]]; }
          state.pos += match[0].length;
          return true;
        }
      }
    }
  }

  if (!silent) { state.pending += '&'; }
  state.pos++;
  return true;
};

},{"../common/entities":57,"../common/utils":61}],98:[function(require,module,exports){
// Proceess escaped chars and hardbreaks

'use strict';

var ESCAPED = [];

for (var i = 0; i < 256; i++) { ESCAPED.push(0); }

'\\!"#$%&\'()*+,./:;<=>?@[]^_`{|}~-'
  .split('').forEach(function(ch) { ESCAPED[ch.charCodeAt(0)] = 1; });


module.exports = function escape(state, silent) {
  var ch, pos = state.pos, max = state.posMax;

  if (state.src.charCodeAt(pos) !== 0x5C/* \ */) { return false; }

  pos++;

  if (pos < max) {
    ch = state.src.charCodeAt(pos);

    if (ch < 256 && ESCAPED[ch] !== 0) {
      if (!silent) { state.pending += state.src[pos]; }
      state.pos += 2;
      return true;
    }

    if (ch === 0x0A) {
      if (!silent) {
        state.push('hardbreak', 'br', 0);
      }

      pos++;
      // skip leading whitespaces from next line
      while (pos < max && state.src.charCodeAt(pos) === 0x20) { pos++; }

      state.pos = pos;
      return true;
    }
  }

  if (!silent) { state.pending += '\\'; }
  state.pos++;
  return true;
};

},{}],99:[function(require,module,exports){
// Process html tags

'use strict';


var HTML_TAG_RE = require('../common/html_re').HTML_TAG_RE;


function isLetter(ch) {
  /*eslint no-bitwise:0*/
  var lc = ch | 0x20; // to lower case
  return (lc >= 0x61/* a */) && (lc <= 0x7a/* z */);
}


module.exports = function html_inline(state, silent) {
  var ch, match, max, token,
      pos = state.pos;

  if (!state.md.options.html) { return false; }

  // Check start
  max = state.posMax;
  if (state.src.charCodeAt(pos) !== 0x3C/* < */ ||
      pos + 2 >= max) {
    return false;
  }

  // Quick fail on second char
  ch = state.src.charCodeAt(pos + 1);
  if (ch !== 0x21/* ! */ &&
      ch !== 0x3F/* ? */ &&
      ch !== 0x2F/* / */ &&
      !isLetter(ch)) {
    return false;
  }

  match = state.src.slice(pos).match(HTML_TAG_RE);
  if (!match) { return false; }

  if (!silent) {
    token         = state.push('html_inline', '', 0);
    token.content = state.src.slice(pos, pos + match[0].length);
  }
  state.pos += match[0].length;
  return true;
};

},{"../common/html_re":59}],100:[function(require,module,exports){
// Process ![image](<src> "title")

'use strict';

var parseLinkLabel       = require('../helpers/parse_link_label');
var parseLinkDestination = require('../helpers/parse_link_destination');
var parseLinkTitle       = require('../helpers/parse_link_title');
var normalizeReference   = require('../common/utils').normalizeReference;


module.exports = function image(state, silent) {
  var attrs,
      code,
      label,
      labelEnd,
      labelStart,
      pos,
      ref,
      res,
      title,
      token,
      tokens,
      start,
      href = '',
      oldPos = state.pos,
      max = state.posMax;

  if (state.src.charCodeAt(state.pos) !== 0x21/* ! */) { return false; }
  if (state.src.charCodeAt(state.pos + 1) !== 0x5B/* [ */) { return false; }

  labelStart = state.pos + 2;
  labelEnd = parseLinkLabel(state, state.pos + 1, false);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) { return false; }

  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 0x28/* ( */) {
    //
    // Inline link
    //

    // [link](  <href>  "title"  )
    //        ^^ skipping these spaces
    pos++;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }
    if (pos >= max) { return false; }

    // [link](  <href>  "title"  )
    //          ^^^^^^ parsing link destination
    start = pos;
    res = parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) {
        pos = res.pos;
      } else {
        href = '';
      }
    }

    // [link](  <href>  "title"  )
    //                ^^ skipping these spaces
    start = pos;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }

    // [link](  <href>  "title"  )
    //                  ^^^^^^^ parsing link title
    res = parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;

      // [link](  <href>  "title"  )
      //                         ^^ skipping these spaces
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (code !== 0x20 && code !== 0x0A) { break; }
      }
    } else {
      title = '';
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  } else {
    //
    // Link reference
    //
    if (typeof state.env.references === 'undefined') { return false; }

    // [foo]  [bar]
    //      ^^ optional whitespace (can include newlines)
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }

    if (pos < max && state.src.charCodeAt(pos) === 0x5B/* [ */) {
      start = pos + 1;
      pos = parseLinkLabel(state, pos);
      if (pos >= 0) {
        label = state.src.slice(start, pos++);
      } else {
        pos = labelEnd + 1;
      }
    } else {
      pos = labelEnd + 1;
    }

    // covers label === '' and label === undefined
    // (collapsed reference link and shortcut reference link respectively)
    if (!label) { label = state.src.slice(labelStart, labelEnd); }

    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }

  //
  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  //
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;

    var newState = new state.md.inline.State(
      state.src.slice(labelStart, labelEnd),
      state.md,
      state.env,
      tokens = []
    );
    newState.md.inline.tokenize(newState);

    token          = state.push('image', 'img', 0);
    token.attrs    = attrs = [ [ 'src', href ], [ 'alt', '' ] ];
    token.children = tokens;
    if (title) {
      attrs.push([ 'title', title ]);
    }
  }

  state.pos = pos;
  state.posMax = max;
  return true;
};

},{"../common/utils":61,"../helpers/parse_link_destination":63,"../helpers/parse_link_label":64,"../helpers/parse_link_title":65}],101:[function(require,module,exports){
// Process [link](<to> "stuff")

'use strict';

var parseLinkLabel       = require('../helpers/parse_link_label');
var parseLinkDestination = require('../helpers/parse_link_destination');
var parseLinkTitle       = require('../helpers/parse_link_title');
var normalizeReference   = require('../common/utils').normalizeReference;


module.exports = function link(state, silent) {
  var attrs,
      code,
      label,
      labelEnd,
      labelStart,
      pos,
      res,
      ref,
      title,
      token,
      href = '',
      oldPos = state.pos,
      max = state.posMax,
      start = state.pos;

  if (state.src.charCodeAt(state.pos) !== 0x5B/* [ */) { return false; }

  labelStart = state.pos + 1;
  labelEnd = parseLinkLabel(state, state.pos, true);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) { return false; }

  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 0x28/* ( */) {
    //
    // Inline link
    //

    // [link](  <href>  "title"  )
    //        ^^ skipping these spaces
    pos++;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }
    if (pos >= max) { return false; }

    // [link](  <href>  "title"  )
    //          ^^^^^^ parsing link destination
    start = pos;
    res = parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) {
        pos = res.pos;
      } else {
        href = '';
      }
    }

    // [link](  <href>  "title"  )
    //                ^^ skipping these spaces
    start = pos;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }

    // [link](  <href>  "title"  )
    //                  ^^^^^^^ parsing link title
    res = parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;

      // [link](  <href>  "title"  )
      //                         ^^ skipping these spaces
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (code !== 0x20 && code !== 0x0A) { break; }
      }
    } else {
      title = '';
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  } else {
    //
    // Link reference
    //
    if (typeof state.env.references === 'undefined') { return false; }

    // [foo]  [bar]
    //      ^^ optional whitespace (can include newlines)
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }

    if (pos < max && state.src.charCodeAt(pos) === 0x5B/* [ */) {
      start = pos + 1;
      pos = parseLinkLabel(state, pos);
      if (pos >= 0) {
        label = state.src.slice(start, pos++);
      } else {
        pos = labelEnd + 1;
      }
    } else {
      pos = labelEnd + 1;
    }

    // covers label === '' and label === undefined
    // (collapsed reference link and shortcut reference link respectively)
    if (!label) { label = state.src.slice(labelStart, labelEnd); }

    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }

  //
  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  //
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;

    token        = state.push('link_open', 'a', 1);
    token.attrs  = attrs = [ [ 'href', href ] ];
    if (title) {
      attrs.push([ 'title', title ]);
    }

    state.md.inline.tokenize(state);

    token        = state.push('link_close', 'a', -1);
  }

  state.pos = pos;
  state.posMax = max;
  return true;
};

},{"../common/utils":61,"../helpers/parse_link_destination":63,"../helpers/parse_link_label":64,"../helpers/parse_link_title":65}],102:[function(require,module,exports){
// Proceess '\n'

'use strict';

module.exports = function newline(state, silent) {
  var pmax, max, pos = state.pos;

  if (state.src.charCodeAt(pos) !== 0x0A/* \n */) { return false; }

  pmax = state.pending.length - 1;
  max = state.posMax;

  // '  \n' -> hardbreak
  // Lookup in pending chars is bad practice! Don't copy to other rules!
  // Pending string is stored in concat mode, indexed lookups will cause
  // convertion to flat mode.
  if (!silent) {
    if (pmax >= 0 && state.pending.charCodeAt(pmax) === 0x20) {
      if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 0x20) {
        state.pending = state.pending.replace(/ +$/, '');
        state.push('hardbreak', 'br', 0);
      } else {
        state.pending = state.pending.slice(0, -1);
        state.push('softbreak', 'br', 0);
      }

    } else {
      state.push('softbreak', 'br', 0);
    }
  }

  pos++;

  // skip heading spaces for next line
  while (pos < max && state.src.charCodeAt(pos) === 0x20) { pos++; }

  state.pos = pos;
  return true;
};

},{}],103:[function(require,module,exports){
// Inline parser state

'use strict';


var Token = require('../token');

function StateInline(src, md, env, outTokens) {
  this.src = src;
  this.env = env;
  this.md = md;
  this.tokens = outTokens;

  this.pos = 0;
  this.posMax = this.src.length;
  this.level = 0;
  this.pending = '';
  this.pendingLevel = 0;

  this.cache = {};        // Stores { start: end } pairs. Useful for backtrack
                          // optimization of pairs parse (emphasis, strikes).
}


// Flush pending text
//
StateInline.prototype.pushPending = function () {
  var token = new Token('text', '', 0);
  token.content = this.pending;
  token.level = this.pendingLevel;
  this.tokens.push(token);
  this.pending = '';
  return token;
};


// Push new token to "stream".
// If pending text exists - flush it as text token
//
StateInline.prototype.push = function (type, tag, nesting) {
  if (this.pending) {
    this.pushPending();
  }

  var token = new Token(type, tag, nesting);

  if (nesting < 0) { this.level--; }
  token.level = this.level;
  if (nesting > 0) { this.level++; }

  this.pendingLevel = this.level;
  this.tokens.push(token);
  return token;
};

// re-export Token class to use in block rules
StateInline.prototype.Token = Token;


module.exports = StateInline;

},{"../token":106}],104:[function(require,module,exports){
// ~~strike through~~
//
'use strict';


var isWhiteSpace   = require('../common/utils').isWhiteSpace;
var isPunctChar    = require('../common/utils').isPunctChar;
var isMdAsciiPunct = require('../common/utils').isMdAsciiPunct;


// parse sequence of markers,
// "start" should point at a valid marker
function scanDelims(state, start) {
  var pos = start, lastChar, nextChar, count,
      isLastWhiteSpace, isLastPunctChar,
      isNextWhiteSpace, isNextPunctChar,
      can_open = true,
      can_close = true,
      max = state.posMax,
      marker = state.src.charCodeAt(start);

  // treat beginning of the line as a whitespace
  lastChar = start > 0 ? state.src.charCodeAt(start - 1) : 0x20;

  while (pos < max && state.src.charCodeAt(pos) === marker) { pos++; }

  if (pos >= max) {
    can_open = false;
  }

  count = pos - start;

  // treat end of the line as a whitespace
  nextChar = pos < max ? state.src.charCodeAt(pos) : 0x20;

  isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
  isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));

  isLastWhiteSpace = isWhiteSpace(lastChar);
  isNextWhiteSpace = isWhiteSpace(nextChar);

  if (isNextWhiteSpace) {
    can_open = false;
  } else if (isNextPunctChar) {
    if (!(isLastWhiteSpace || isLastPunctChar)) {
      can_open = false;
    }
  }

  if (isLastWhiteSpace) {
    can_close = false;
  } else if (isLastPunctChar) {
    if (!(isNextWhiteSpace || isNextPunctChar)) {
      can_close = false;
    }
  }

  return {
    can_open: can_open,
    can_close: can_close,
    delims: count
  };
}


module.exports = function strikethrough(state, silent) {
  var startCount,
      count,
      tagCount,
      found,
      stack,
      res,
      token,
      max = state.posMax,
      start = state.pos,
      marker = state.src.charCodeAt(start);

  if (marker !== 0x7E/* ~ */) { return false; }
  if (silent) { return false; } // don't run any pairs in validation mode

  res = scanDelims(state, start);
  startCount = res.delims;
  if (!res.can_open) {
    state.pos += startCount;
    // Earlier we checked !silent, but this implementation does not need it
    state.pending += state.src.slice(start, state.pos);
    return true;
  }

  stack = Math.floor(startCount / 2);
  if (stack <= 0) { return false; }
  state.pos = start + startCount;

  while (state.pos < max) {
    if (state.src.charCodeAt(state.pos) === marker) {
      res = scanDelims(state, state.pos);
      count = res.delims;
      tagCount = Math.floor(count / 2);
      if (res.can_close) {
        if (tagCount >= stack) {
          state.pos += count - 2;
          found = true;
          break;
        }
        stack -= tagCount;
        state.pos += count;
        continue;
      }

      if (res.can_open) { stack += tagCount; }
      state.pos += count;
      continue;
    }

    state.md.inline.skipToken(state);
  }

  if (!found) {
    // parser failed to find ending tag, so it's not valid emphasis
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + 2;

  // Earlier we checked !silent, but this implementation does not need it
  token        = state.push('s_open', 's', 1);
  token.markup = '~~';

  state.md.inline.tokenize(state);

  token        = state.push('s_close', 's', -1);
  token.markup = '~~';

  state.pos = state.posMax + 2;
  state.posMax = max;
  return true;
};

},{"../common/utils":61}],105:[function(require,module,exports){
// Skip text characters for text token, place those to pending buffer
// and increment current pos

'use strict';


// Rule to skip pure text
// '{}$%@~+=:' reserved for extentions

// !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~

// !!!! Don't confuse with "Markdown ASCII Punctuation" chars
// http://spec.commonmark.org/0.15/#ascii-punctuation-character
function isTerminatorChar(ch) {
  switch (ch) {
    case 0x0A/* \n */:
    case 0x21/* ! */:
    case 0x23/* # */:
    case 0x24/* $ */:
    case 0x25/* % */:
    case 0x26/* & */:
    case 0x2A/* * */:
    case 0x2B/* + */:
    case 0x2D/* - */:
    case 0x3A/* : */:
    case 0x3C/* < */:
    case 0x3D/* = */:
    case 0x3E/* > */:
    case 0x40/* @ */:
    case 0x5B/* [ */:
    case 0x5C/* \ */:
    case 0x5D/* ] */:
    case 0x5E/* ^ */:
    case 0x5F/* _ */:
    case 0x60/* ` */:
    case 0x7B/* { */:
    case 0x7D/* } */:
    case 0x7E/* ~ */:
      return true;
    default:
      return false;
  }
}

module.exports = function text(state, silent) {
  var pos = state.pos;

  while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
    pos++;
  }

  if (pos === state.pos) { return false; }

  if (!silent) { state.pending += state.src.slice(state.pos, pos); }

  state.pos = pos;

  return true;
};

// Alternative implementation, for memory.
//
// It costs 10% of performance, but allows extend terminators list, if place it
// to `ParcerInline` property. Probably, will switch to it sometime, such
// flexibility required.

/*
var TERMINATOR_RE = /[\n!#$%&*+\-:<=>@[\\\]^_`{}~]/;

module.exports = function text(state, silent) {
  var pos = state.pos,
      idx = state.src.slice(pos).search(TERMINATOR_RE);

  // first char is terminator -> empty text
  if (idx === 0) { return false; }

  // no terminator -> text till end of string
  if (idx < 0) {
    if (!silent) { state.pending += state.src.slice(pos); }
    state.pos = state.src.length;
    return true;
  }

  if (!silent) { state.pending += state.src.slice(pos, pos + idx); }

  state.pos += idx;

  return true;
};*/

},{}],106:[function(require,module,exports){
// Token class

'use strict';


/**
 * class Token
 **/

/**
 * new Token(type, tag, nesting)
 *
 * Create new token and fill passed properties.
 **/
function Token(type, tag, nesting) {
  /**
   * Token#type -> String
   *
   * Type of the token (string, e.g. "paragraph_open")
   **/
  this.type     = type;

  /**
   * Token#tag -> String
   *
   * html tag name, e.g. "p"
   **/
  this.tag      = tag;

  /**
   * Token#attrs -> Array
   *
   * Html attributes. Format: `[ [ name1, value1 ], [ name2, value2 ] ]`
   **/
  this.attrs    = null;

  /**
   * Token#map -> Array
   *
   * Source map info. Format: `[ line_begin, line_end ]`
   **/
  this.map      = null;

  /**
   * Token#nesting -> Number
   *
   * Level change (number in {-1, 0, 1} set), where:
   *
   * -  `1` means the tag is opening
   * -  `0` means the tag is self-closing
   * - `-1` means the tag is closing
   **/
  this.nesting  = nesting;

  /**
   * Token#level -> Number
   *
   * nesting level, the same as `state.level`
   **/
  this.level    = 0;

  /**
   * Token#children -> Array
   *
   * An array of child nodes (inline and img tokens)
   **/
  this.children = null;

  /**
   * Token#content -> String
   *
   * In a case of self-closing tag (code, html, fence, etc.),
   * it has contents of this tag.
   **/
  this.content  = '';

  /**
   * Token#markup -> String
   *
   * '*' or '_' for emphasis, fence string for fence, etc.
   **/
  this.markup   = '';

  /**
   * Token#info -> String
   *
   * fence infostring
   **/
  this.info     = '';

  /**
   * Token#meta -> Object
   *
   * A place for plugins to store an arbitrary data
   **/
  this.meta     = null;

  /**
   * Token#block -> Boolean
   *
   * True for block-level tokens, false for inline tokens.
   * Used in renderer to calculate line breaks
   **/
  this.block    = false;

  /**
   * Token#hidden -> Boolean
   *
   * If it's true, ignore this element when rendering. Used for tight lists
   * to hide paragraphs.
   **/
  this.hidden   = false;
}


/**
 * Token.attrIndex(name) -> Number
 *
 * Search attribute index by name.
 **/
Token.prototype.attrIndex = function attrIndex(name) {
  var attrs, i, len;

  if (!this.attrs) { return -1; }

  attrs = this.attrs;

  for (i = 0, len = attrs.length; i < len; i++) {
    if (attrs[i][0] === name) { return i; }
  }
  return -1;
};


/**
 * Token.attrPush(attrData)
 *
 * Add `[ name, value ]` attribute to list. Init attrs if necessary
 **/
Token.prototype.attrPush = function attrPush(attrData) {
  if (this.attrs) {
    this.attrs.push(attrData);
  } else {
    this.attrs = [ attrData ];
  }
};


module.exports = Token;

},{}],107:[function(require,module,exports){
module.exports={"Aacute":"\u00C1","aacute":"\u00E1","Abreve":"\u0102","abreve":"\u0103","ac":"\u223E","acd":"\u223F","acE":"\u223E\u0333","Acirc":"\u00C2","acirc":"\u00E2","acute":"\u00B4","Acy":"\u0410","acy":"\u0430","AElig":"\u00C6","aelig":"\u00E6","af":"\u2061","Afr":"\uD835\uDD04","afr":"\uD835\uDD1E","Agrave":"\u00C0","agrave":"\u00E0","alefsym":"\u2135","aleph":"\u2135","Alpha":"\u0391","alpha":"\u03B1","Amacr":"\u0100","amacr":"\u0101","amalg":"\u2A3F","amp":"&","AMP":"&","andand":"\u2A55","And":"\u2A53","and":"\u2227","andd":"\u2A5C","andslope":"\u2A58","andv":"\u2A5A","ang":"\u2220","ange":"\u29A4","angle":"\u2220","angmsdaa":"\u29A8","angmsdab":"\u29A9","angmsdac":"\u29AA","angmsdad":"\u29AB","angmsdae":"\u29AC","angmsdaf":"\u29AD","angmsdag":"\u29AE","angmsdah":"\u29AF","angmsd":"\u2221","angrt":"\u221F","angrtvb":"\u22BE","angrtvbd":"\u299D","angsph":"\u2222","angst":"\u00C5","angzarr":"\u237C","Aogon":"\u0104","aogon":"\u0105","Aopf":"\uD835\uDD38","aopf":"\uD835\uDD52","apacir":"\u2A6F","ap":"\u2248","apE":"\u2A70","ape":"\u224A","apid":"\u224B","apos":"'","ApplyFunction":"\u2061","approx":"\u2248","approxeq":"\u224A","Aring":"\u00C5","aring":"\u00E5","Ascr":"\uD835\uDC9C","ascr":"\uD835\uDCB6","Assign":"\u2254","ast":"*","asymp":"\u2248","asympeq":"\u224D","Atilde":"\u00C3","atilde":"\u00E3","Auml":"\u00C4","auml":"\u00E4","awconint":"\u2233","awint":"\u2A11","backcong":"\u224C","backepsilon":"\u03F6","backprime":"\u2035","backsim":"\u223D","backsimeq":"\u22CD","Backslash":"\u2216","Barv":"\u2AE7","barvee":"\u22BD","barwed":"\u2305","Barwed":"\u2306","barwedge":"\u2305","bbrk":"\u23B5","bbrktbrk":"\u23B6","bcong":"\u224C","Bcy":"\u0411","bcy":"\u0431","bdquo":"\u201E","becaus":"\u2235","because":"\u2235","Because":"\u2235","bemptyv":"\u29B0","bepsi":"\u03F6","bernou":"\u212C","Bernoullis":"\u212C","Beta":"\u0392","beta":"\u03B2","beth":"\u2136","between":"\u226C","Bfr":"\uD835\uDD05","bfr":"\uD835\uDD1F","bigcap":"\u22C2","bigcirc":"\u25EF","bigcup":"\u22C3","bigodot":"\u2A00","bigoplus":"\u2A01","bigotimes":"\u2A02","bigsqcup":"\u2A06","bigstar":"\u2605","bigtriangledown":"\u25BD","bigtriangleup":"\u25B3","biguplus":"\u2A04","bigvee":"\u22C1","bigwedge":"\u22C0","bkarow":"\u290D","blacklozenge":"\u29EB","blacksquare":"\u25AA","blacktriangle":"\u25B4","blacktriangledown":"\u25BE","blacktriangleleft":"\u25C2","blacktriangleright":"\u25B8","blank":"\u2423","blk12":"\u2592","blk14":"\u2591","blk34":"\u2593","block":"\u2588","bne":"=\u20E5","bnequiv":"\u2261\u20E5","bNot":"\u2AED","bnot":"\u2310","Bopf":"\uD835\uDD39","bopf":"\uD835\uDD53","bot":"\u22A5","bottom":"\u22A5","bowtie":"\u22C8","boxbox":"\u29C9","boxdl":"\u2510","boxdL":"\u2555","boxDl":"\u2556","boxDL":"\u2557","boxdr":"\u250C","boxdR":"\u2552","boxDr":"\u2553","boxDR":"\u2554","boxh":"\u2500","boxH":"\u2550","boxhd":"\u252C","boxHd":"\u2564","boxhD":"\u2565","boxHD":"\u2566","boxhu":"\u2534","boxHu":"\u2567","boxhU":"\u2568","boxHU":"\u2569","boxminus":"\u229F","boxplus":"\u229E","boxtimes":"\u22A0","boxul":"\u2518","boxuL":"\u255B","boxUl":"\u255C","boxUL":"\u255D","boxur":"\u2514","boxuR":"\u2558","boxUr":"\u2559","boxUR":"\u255A","boxv":"\u2502","boxV":"\u2551","boxvh":"\u253C","boxvH":"\u256A","boxVh":"\u256B","boxVH":"\u256C","boxvl":"\u2524","boxvL":"\u2561","boxVl":"\u2562","boxVL":"\u2563","boxvr":"\u251C","boxvR":"\u255E","boxVr":"\u255F","boxVR":"\u2560","bprime":"\u2035","breve":"\u02D8","Breve":"\u02D8","brvbar":"\u00A6","bscr":"\uD835\uDCB7","Bscr":"\u212C","bsemi":"\u204F","bsim":"\u223D","bsime":"\u22CD","bsolb":"\u29C5","bsol":"\\","bsolhsub":"\u27C8","bull":"\u2022","bullet":"\u2022","bump":"\u224E","bumpE":"\u2AAE","bumpe":"\u224F","Bumpeq":"\u224E","bumpeq":"\u224F","Cacute":"\u0106","cacute":"\u0107","capand":"\u2A44","capbrcup":"\u2A49","capcap":"\u2A4B","cap":"\u2229","Cap":"\u22D2","capcup":"\u2A47","capdot":"\u2A40","CapitalDifferentialD":"\u2145","caps":"\u2229\uFE00","caret":"\u2041","caron":"\u02C7","Cayleys":"\u212D","ccaps":"\u2A4D","Ccaron":"\u010C","ccaron":"\u010D","Ccedil":"\u00C7","ccedil":"\u00E7","Ccirc":"\u0108","ccirc":"\u0109","Cconint":"\u2230","ccups":"\u2A4C","ccupssm":"\u2A50","Cdot":"\u010A","cdot":"\u010B","cedil":"\u00B8","Cedilla":"\u00B8","cemptyv":"\u29B2","cent":"\u00A2","centerdot":"\u00B7","CenterDot":"\u00B7","cfr":"\uD835\uDD20","Cfr":"\u212D","CHcy":"\u0427","chcy":"\u0447","check":"\u2713","checkmark":"\u2713","Chi":"\u03A7","chi":"\u03C7","circ":"\u02C6","circeq":"\u2257","circlearrowleft":"\u21BA","circlearrowright":"\u21BB","circledast":"\u229B","circledcirc":"\u229A","circleddash":"\u229D","CircleDot":"\u2299","circledR":"\u00AE","circledS":"\u24C8","CircleMinus":"\u2296","CirclePlus":"\u2295","CircleTimes":"\u2297","cir":"\u25CB","cirE":"\u29C3","cire":"\u2257","cirfnint":"\u2A10","cirmid":"\u2AEF","cirscir":"\u29C2","ClockwiseContourIntegral":"\u2232","CloseCurlyDoubleQuote":"\u201D","CloseCurlyQuote":"\u2019","clubs":"\u2663","clubsuit":"\u2663","colon":":","Colon":"\u2237","Colone":"\u2A74","colone":"\u2254","coloneq":"\u2254","comma":",","commat":"@","comp":"\u2201","compfn":"\u2218","complement":"\u2201","complexes":"\u2102","cong":"\u2245","congdot":"\u2A6D","Congruent":"\u2261","conint":"\u222E","Conint":"\u222F","ContourIntegral":"\u222E","copf":"\uD835\uDD54","Copf":"\u2102","coprod":"\u2210","Coproduct":"\u2210","copy":"\u00A9","COPY":"\u00A9","copysr":"\u2117","CounterClockwiseContourIntegral":"\u2233","crarr":"\u21B5","cross":"\u2717","Cross":"\u2A2F","Cscr":"\uD835\uDC9E","cscr":"\uD835\uDCB8","csub":"\u2ACF","csube":"\u2AD1","csup":"\u2AD0","csupe":"\u2AD2","ctdot":"\u22EF","cudarrl":"\u2938","cudarrr":"\u2935","cuepr":"\u22DE","cuesc":"\u22DF","cularr":"\u21B6","cularrp":"\u293D","cupbrcap":"\u2A48","cupcap":"\u2A46","CupCap":"\u224D","cup":"\u222A","Cup":"\u22D3","cupcup":"\u2A4A","cupdot":"\u228D","cupor":"\u2A45","cups":"\u222A\uFE00","curarr":"\u21B7","curarrm":"\u293C","curlyeqprec":"\u22DE","curlyeqsucc":"\u22DF","curlyvee":"\u22CE","curlywedge":"\u22CF","curren":"\u00A4","curvearrowleft":"\u21B6","curvearrowright":"\u21B7","cuvee":"\u22CE","cuwed":"\u22CF","cwconint":"\u2232","cwint":"\u2231","cylcty":"\u232D","dagger":"\u2020","Dagger":"\u2021","daleth":"\u2138","darr":"\u2193","Darr":"\u21A1","dArr":"\u21D3","dash":"\u2010","Dashv":"\u2AE4","dashv":"\u22A3","dbkarow":"\u290F","dblac":"\u02DD","Dcaron":"\u010E","dcaron":"\u010F","Dcy":"\u0414","dcy":"\u0434","ddagger":"\u2021","ddarr":"\u21CA","DD":"\u2145","dd":"\u2146","DDotrahd":"\u2911","ddotseq":"\u2A77","deg":"\u00B0","Del":"\u2207","Delta":"\u0394","delta":"\u03B4","demptyv":"\u29B1","dfisht":"\u297F","Dfr":"\uD835\uDD07","dfr":"\uD835\uDD21","dHar":"\u2965","dharl":"\u21C3","dharr":"\u21C2","DiacriticalAcute":"\u00B4","DiacriticalDot":"\u02D9","DiacriticalDoubleAcute":"\u02DD","DiacriticalGrave":"`","DiacriticalTilde":"\u02DC","diam":"\u22C4","diamond":"\u22C4","Diamond":"\u22C4","diamondsuit":"\u2666","diams":"\u2666","die":"\u00A8","DifferentialD":"\u2146","digamma":"\u03DD","disin":"\u22F2","div":"\u00F7","divide":"\u00F7","divideontimes":"\u22C7","divonx":"\u22C7","DJcy":"\u0402","djcy":"\u0452","dlcorn":"\u231E","dlcrop":"\u230D","dollar":"$","Dopf":"\uD835\uDD3B","dopf":"\uD835\uDD55","Dot":"\u00A8","dot":"\u02D9","DotDot":"\u20DC","doteq":"\u2250","doteqdot":"\u2251","DotEqual":"\u2250","dotminus":"\u2238","dotplus":"\u2214","dotsquare":"\u22A1","doublebarwedge":"\u2306","DoubleContourIntegral":"\u222F","DoubleDot":"\u00A8","DoubleDownArrow":"\u21D3","DoubleLeftArrow":"\u21D0","DoubleLeftRightArrow":"\u21D4","DoubleLeftTee":"\u2AE4","DoubleLongLeftArrow":"\u27F8","DoubleLongLeftRightArrow":"\u27FA","DoubleLongRightArrow":"\u27F9","DoubleRightArrow":"\u21D2","DoubleRightTee":"\u22A8","DoubleUpArrow":"\u21D1","DoubleUpDownArrow":"\u21D5","DoubleVerticalBar":"\u2225","DownArrowBar":"\u2913","downarrow":"\u2193","DownArrow":"\u2193","Downarrow":"\u21D3","DownArrowUpArrow":"\u21F5","DownBreve":"\u0311","downdownarrows":"\u21CA","downharpoonleft":"\u21C3","downharpoonright":"\u21C2","DownLeftRightVector":"\u2950","DownLeftTeeVector":"\u295E","DownLeftVectorBar":"\u2956","DownLeftVector":"\u21BD","DownRightTeeVector":"\u295F","DownRightVectorBar":"\u2957","DownRightVector":"\u21C1","DownTeeArrow":"\u21A7","DownTee":"\u22A4","drbkarow":"\u2910","drcorn":"\u231F","drcrop":"\u230C","Dscr":"\uD835\uDC9F","dscr":"\uD835\uDCB9","DScy":"\u0405","dscy":"\u0455","dsol":"\u29F6","Dstrok":"\u0110","dstrok":"\u0111","dtdot":"\u22F1","dtri":"\u25BF","dtrif":"\u25BE","duarr":"\u21F5","duhar":"\u296F","dwangle":"\u29A6","DZcy":"\u040F","dzcy":"\u045F","dzigrarr":"\u27FF","Eacute":"\u00C9","eacute":"\u00E9","easter":"\u2A6E","Ecaron":"\u011A","ecaron":"\u011B","Ecirc":"\u00CA","ecirc":"\u00EA","ecir":"\u2256","ecolon":"\u2255","Ecy":"\u042D","ecy":"\u044D","eDDot":"\u2A77","Edot":"\u0116","edot":"\u0117","eDot":"\u2251","ee":"\u2147","efDot":"\u2252","Efr":"\uD835\uDD08","efr":"\uD835\uDD22","eg":"\u2A9A","Egrave":"\u00C8","egrave":"\u00E8","egs":"\u2A96","egsdot":"\u2A98","el":"\u2A99","Element":"\u2208","elinters":"\u23E7","ell":"\u2113","els":"\u2A95","elsdot":"\u2A97","Emacr":"\u0112","emacr":"\u0113","empty":"\u2205","emptyset":"\u2205","EmptySmallSquare":"\u25FB","emptyv":"\u2205","EmptyVerySmallSquare":"\u25AB","emsp13":"\u2004","emsp14":"\u2005","emsp":"\u2003","ENG":"\u014A","eng":"\u014B","ensp":"\u2002","Eogon":"\u0118","eogon":"\u0119","Eopf":"\uD835\uDD3C","eopf":"\uD835\uDD56","epar":"\u22D5","eparsl":"\u29E3","eplus":"\u2A71","epsi":"\u03B5","Epsilon":"\u0395","epsilon":"\u03B5","epsiv":"\u03F5","eqcirc":"\u2256","eqcolon":"\u2255","eqsim":"\u2242","eqslantgtr":"\u2A96","eqslantless":"\u2A95","Equal":"\u2A75","equals":"=","EqualTilde":"\u2242","equest":"\u225F","Equilibrium":"\u21CC","equiv":"\u2261","equivDD":"\u2A78","eqvparsl":"\u29E5","erarr":"\u2971","erDot":"\u2253","escr":"\u212F","Escr":"\u2130","esdot":"\u2250","Esim":"\u2A73","esim":"\u2242","Eta":"\u0397","eta":"\u03B7","ETH":"\u00D0","eth":"\u00F0","Euml":"\u00CB","euml":"\u00EB","euro":"\u20AC","excl":"!","exist":"\u2203","Exists":"\u2203","expectation":"\u2130","exponentiale":"\u2147","ExponentialE":"\u2147","fallingdotseq":"\u2252","Fcy":"\u0424","fcy":"\u0444","female":"\u2640","ffilig":"\uFB03","fflig":"\uFB00","ffllig":"\uFB04","Ffr":"\uD835\uDD09","ffr":"\uD835\uDD23","filig":"\uFB01","FilledSmallSquare":"\u25FC","FilledVerySmallSquare":"\u25AA","fjlig":"fj","flat":"\u266D","fllig":"\uFB02","fltns":"\u25B1","fnof":"\u0192","Fopf":"\uD835\uDD3D","fopf":"\uD835\uDD57","forall":"\u2200","ForAll":"\u2200","fork":"\u22D4","forkv":"\u2AD9","Fouriertrf":"\u2131","fpartint":"\u2A0D","frac12":"\u00BD","frac13":"\u2153","frac14":"\u00BC","frac15":"\u2155","frac16":"\u2159","frac18":"\u215B","frac23":"\u2154","frac25":"\u2156","frac34":"\u00BE","frac35":"\u2157","frac38":"\u215C","frac45":"\u2158","frac56":"\u215A","frac58":"\u215D","frac78":"\u215E","frasl":"\u2044","frown":"\u2322","fscr":"\uD835\uDCBB","Fscr":"\u2131","gacute":"\u01F5","Gamma":"\u0393","gamma":"\u03B3","Gammad":"\u03DC","gammad":"\u03DD","gap":"\u2A86","Gbreve":"\u011E","gbreve":"\u011F","Gcedil":"\u0122","Gcirc":"\u011C","gcirc":"\u011D","Gcy":"\u0413","gcy":"\u0433","Gdot":"\u0120","gdot":"\u0121","ge":"\u2265","gE":"\u2267","gEl":"\u2A8C","gel":"\u22DB","geq":"\u2265","geqq":"\u2267","geqslant":"\u2A7E","gescc":"\u2AA9","ges":"\u2A7E","gesdot":"\u2A80","gesdoto":"\u2A82","gesdotol":"\u2A84","gesl":"\u22DB\uFE00","gesles":"\u2A94","Gfr":"\uD835\uDD0A","gfr":"\uD835\uDD24","gg":"\u226B","Gg":"\u22D9","ggg":"\u22D9","gimel":"\u2137","GJcy":"\u0403","gjcy":"\u0453","gla":"\u2AA5","gl":"\u2277","glE":"\u2A92","glj":"\u2AA4","gnap":"\u2A8A","gnapprox":"\u2A8A","gne":"\u2A88","gnE":"\u2269","gneq":"\u2A88","gneqq":"\u2269","gnsim":"\u22E7","Gopf":"\uD835\uDD3E","gopf":"\uD835\uDD58","grave":"`","GreaterEqual":"\u2265","GreaterEqualLess":"\u22DB","GreaterFullEqual":"\u2267","GreaterGreater":"\u2AA2","GreaterLess":"\u2277","GreaterSlantEqual":"\u2A7E","GreaterTilde":"\u2273","Gscr":"\uD835\uDCA2","gscr":"\u210A","gsim":"\u2273","gsime":"\u2A8E","gsiml":"\u2A90","gtcc":"\u2AA7","gtcir":"\u2A7A","gt":">","GT":">","Gt":"\u226B","gtdot":"\u22D7","gtlPar":"\u2995","gtquest":"\u2A7C","gtrapprox":"\u2A86","gtrarr":"\u2978","gtrdot":"\u22D7","gtreqless":"\u22DB","gtreqqless":"\u2A8C","gtrless":"\u2277","gtrsim":"\u2273","gvertneqq":"\u2269\uFE00","gvnE":"\u2269\uFE00","Hacek":"\u02C7","hairsp":"\u200A","half":"\u00BD","hamilt":"\u210B","HARDcy":"\u042A","hardcy":"\u044A","harrcir":"\u2948","harr":"\u2194","hArr":"\u21D4","harrw":"\u21AD","Hat":"^","hbar":"\u210F","Hcirc":"\u0124","hcirc":"\u0125","hearts":"\u2665","heartsuit":"\u2665","hellip":"\u2026","hercon":"\u22B9","hfr":"\uD835\uDD25","Hfr":"\u210C","HilbertSpace":"\u210B","hksearow":"\u2925","hkswarow":"\u2926","hoarr":"\u21FF","homtht":"\u223B","hookleftarrow":"\u21A9","hookrightarrow":"\u21AA","hopf":"\uD835\uDD59","Hopf":"\u210D","horbar":"\u2015","HorizontalLine":"\u2500","hscr":"\uD835\uDCBD","Hscr":"\u210B","hslash":"\u210F","Hstrok":"\u0126","hstrok":"\u0127","HumpDownHump":"\u224E","HumpEqual":"\u224F","hybull":"\u2043","hyphen":"\u2010","Iacute":"\u00CD","iacute":"\u00ED","ic":"\u2063","Icirc":"\u00CE","icirc":"\u00EE","Icy":"\u0418","icy":"\u0438","Idot":"\u0130","IEcy":"\u0415","iecy":"\u0435","iexcl":"\u00A1","iff":"\u21D4","ifr":"\uD835\uDD26","Ifr":"\u2111","Igrave":"\u00CC","igrave":"\u00EC","ii":"\u2148","iiiint":"\u2A0C","iiint":"\u222D","iinfin":"\u29DC","iiota":"\u2129","IJlig":"\u0132","ijlig":"\u0133","Imacr":"\u012A","imacr":"\u012B","image":"\u2111","ImaginaryI":"\u2148","imagline":"\u2110","imagpart":"\u2111","imath":"\u0131","Im":"\u2111","imof":"\u22B7","imped":"\u01B5","Implies":"\u21D2","incare":"\u2105","in":"\u2208","infin":"\u221E","infintie":"\u29DD","inodot":"\u0131","intcal":"\u22BA","int":"\u222B","Int":"\u222C","integers":"\u2124","Integral":"\u222B","intercal":"\u22BA","Intersection":"\u22C2","intlarhk":"\u2A17","intprod":"\u2A3C","InvisibleComma":"\u2063","InvisibleTimes":"\u2062","IOcy":"\u0401","iocy":"\u0451","Iogon":"\u012E","iogon":"\u012F","Iopf":"\uD835\uDD40","iopf":"\uD835\uDD5A","Iota":"\u0399","iota":"\u03B9","iprod":"\u2A3C","iquest":"\u00BF","iscr":"\uD835\uDCBE","Iscr":"\u2110","isin":"\u2208","isindot":"\u22F5","isinE":"\u22F9","isins":"\u22F4","isinsv":"\u22F3","isinv":"\u2208","it":"\u2062","Itilde":"\u0128","itilde":"\u0129","Iukcy":"\u0406","iukcy":"\u0456","Iuml":"\u00CF","iuml":"\u00EF","Jcirc":"\u0134","jcirc":"\u0135","Jcy":"\u0419","jcy":"\u0439","Jfr":"\uD835\uDD0D","jfr":"\uD835\uDD27","jmath":"\u0237","Jopf":"\uD835\uDD41","jopf":"\uD835\uDD5B","Jscr":"\uD835\uDCA5","jscr":"\uD835\uDCBF","Jsercy":"\u0408","jsercy":"\u0458","Jukcy":"\u0404","jukcy":"\u0454","Kappa":"\u039A","kappa":"\u03BA","kappav":"\u03F0","Kcedil":"\u0136","kcedil":"\u0137","Kcy":"\u041A","kcy":"\u043A","Kfr":"\uD835\uDD0E","kfr":"\uD835\uDD28","kgreen":"\u0138","KHcy":"\u0425","khcy":"\u0445","KJcy":"\u040C","kjcy":"\u045C","Kopf":"\uD835\uDD42","kopf":"\uD835\uDD5C","Kscr":"\uD835\uDCA6","kscr":"\uD835\uDCC0","lAarr":"\u21DA","Lacute":"\u0139","lacute":"\u013A","laemptyv":"\u29B4","lagran":"\u2112","Lambda":"\u039B","lambda":"\u03BB","lang":"\u27E8","Lang":"\u27EA","langd":"\u2991","langle":"\u27E8","lap":"\u2A85","Laplacetrf":"\u2112","laquo":"\u00AB","larrb":"\u21E4","larrbfs":"\u291F","larr":"\u2190","Larr":"\u219E","lArr":"\u21D0","larrfs":"\u291D","larrhk":"\u21A9","larrlp":"\u21AB","larrpl":"\u2939","larrsim":"\u2973","larrtl":"\u21A2","latail":"\u2919","lAtail":"\u291B","lat":"\u2AAB","late":"\u2AAD","lates":"\u2AAD\uFE00","lbarr":"\u290C","lBarr":"\u290E","lbbrk":"\u2772","lbrace":"{","lbrack":"[","lbrke":"\u298B","lbrksld":"\u298F","lbrkslu":"\u298D","Lcaron":"\u013D","lcaron":"\u013E","Lcedil":"\u013B","lcedil":"\u013C","lceil":"\u2308","lcub":"{","Lcy":"\u041B","lcy":"\u043B","ldca":"\u2936","ldquo":"\u201C","ldquor":"\u201E","ldrdhar":"\u2967","ldrushar":"\u294B","ldsh":"\u21B2","le":"\u2264","lE":"\u2266","LeftAngleBracket":"\u27E8","LeftArrowBar":"\u21E4","leftarrow":"\u2190","LeftArrow":"\u2190","Leftarrow":"\u21D0","LeftArrowRightArrow":"\u21C6","leftarrowtail":"\u21A2","LeftCeiling":"\u2308","LeftDoubleBracket":"\u27E6","LeftDownTeeVector":"\u2961","LeftDownVectorBar":"\u2959","LeftDownVector":"\u21C3","LeftFloor":"\u230A","leftharpoondown":"\u21BD","leftharpoonup":"\u21BC","leftleftarrows":"\u21C7","leftrightarrow":"\u2194","LeftRightArrow":"\u2194","Leftrightarrow":"\u21D4","leftrightarrows":"\u21C6","leftrightharpoons":"\u21CB","leftrightsquigarrow":"\u21AD","LeftRightVector":"\u294E","LeftTeeArrow":"\u21A4","LeftTee":"\u22A3","LeftTeeVector":"\u295A","leftthreetimes":"\u22CB","LeftTriangleBar":"\u29CF","LeftTriangle":"\u22B2","LeftTriangleEqual":"\u22B4","LeftUpDownVector":"\u2951","LeftUpTeeVector":"\u2960","LeftUpVectorBar":"\u2958","LeftUpVector":"\u21BF","LeftVectorBar":"\u2952","LeftVector":"\u21BC","lEg":"\u2A8B","leg":"\u22DA","leq":"\u2264","leqq":"\u2266","leqslant":"\u2A7D","lescc":"\u2AA8","les":"\u2A7D","lesdot":"\u2A7F","lesdoto":"\u2A81","lesdotor":"\u2A83","lesg":"\u22DA\uFE00","lesges":"\u2A93","lessapprox":"\u2A85","lessdot":"\u22D6","lesseqgtr":"\u22DA","lesseqqgtr":"\u2A8B","LessEqualGreater":"\u22DA","LessFullEqual":"\u2266","LessGreater":"\u2276","lessgtr":"\u2276","LessLess":"\u2AA1","lesssim":"\u2272","LessSlantEqual":"\u2A7D","LessTilde":"\u2272","lfisht":"\u297C","lfloor":"\u230A","Lfr":"\uD835\uDD0F","lfr":"\uD835\uDD29","lg":"\u2276","lgE":"\u2A91","lHar":"\u2962","lhard":"\u21BD","lharu":"\u21BC","lharul":"\u296A","lhblk":"\u2584","LJcy":"\u0409","ljcy":"\u0459","llarr":"\u21C7","ll":"\u226A","Ll":"\u22D8","llcorner":"\u231E","Lleftarrow":"\u21DA","llhard":"\u296B","lltri":"\u25FA","Lmidot":"\u013F","lmidot":"\u0140","lmoustache":"\u23B0","lmoust":"\u23B0","lnap":"\u2A89","lnapprox":"\u2A89","lne":"\u2A87","lnE":"\u2268","lneq":"\u2A87","lneqq":"\u2268","lnsim":"\u22E6","loang":"\u27EC","loarr":"\u21FD","lobrk":"\u27E6","longleftarrow":"\u27F5","LongLeftArrow":"\u27F5","Longleftarrow":"\u27F8","longleftrightarrow":"\u27F7","LongLeftRightArrow":"\u27F7","Longleftrightarrow":"\u27FA","longmapsto":"\u27FC","longrightarrow":"\u27F6","LongRightArrow":"\u27F6","Longrightarrow":"\u27F9","looparrowleft":"\u21AB","looparrowright":"\u21AC","lopar":"\u2985","Lopf":"\uD835\uDD43","lopf":"\uD835\uDD5D","loplus":"\u2A2D","lotimes":"\u2A34","lowast":"\u2217","lowbar":"_","LowerLeftArrow":"\u2199","LowerRightArrow":"\u2198","loz":"\u25CA","lozenge":"\u25CA","lozf":"\u29EB","lpar":"(","lparlt":"\u2993","lrarr":"\u21C6","lrcorner":"\u231F","lrhar":"\u21CB","lrhard":"\u296D","lrm":"\u200E","lrtri":"\u22BF","lsaquo":"\u2039","lscr":"\uD835\uDCC1","Lscr":"\u2112","lsh":"\u21B0","Lsh":"\u21B0","lsim":"\u2272","lsime":"\u2A8D","lsimg":"\u2A8F","lsqb":"[","lsquo":"\u2018","lsquor":"\u201A","Lstrok":"\u0141","lstrok":"\u0142","ltcc":"\u2AA6","ltcir":"\u2A79","lt":"<","LT":"<","Lt":"\u226A","ltdot":"\u22D6","lthree":"\u22CB","ltimes":"\u22C9","ltlarr":"\u2976","ltquest":"\u2A7B","ltri":"\u25C3","ltrie":"\u22B4","ltrif":"\u25C2","ltrPar":"\u2996","lurdshar":"\u294A","luruhar":"\u2966","lvertneqq":"\u2268\uFE00","lvnE":"\u2268\uFE00","macr":"\u00AF","male":"\u2642","malt":"\u2720","maltese":"\u2720","Map":"\u2905","map":"\u21A6","mapsto":"\u21A6","mapstodown":"\u21A7","mapstoleft":"\u21A4","mapstoup":"\u21A5","marker":"\u25AE","mcomma":"\u2A29","Mcy":"\u041C","mcy":"\u043C","mdash":"\u2014","mDDot":"\u223A","measuredangle":"\u2221","MediumSpace":"\u205F","Mellintrf":"\u2133","Mfr":"\uD835\uDD10","mfr":"\uD835\uDD2A","mho":"\u2127","micro":"\u00B5","midast":"*","midcir":"\u2AF0","mid":"\u2223","middot":"\u00B7","minusb":"\u229F","minus":"\u2212","minusd":"\u2238","minusdu":"\u2A2A","MinusPlus":"\u2213","mlcp":"\u2ADB","mldr":"\u2026","mnplus":"\u2213","models":"\u22A7","Mopf":"\uD835\uDD44","mopf":"\uD835\uDD5E","mp":"\u2213","mscr":"\uD835\uDCC2","Mscr":"\u2133","mstpos":"\u223E","Mu":"\u039C","mu":"\u03BC","multimap":"\u22B8","mumap":"\u22B8","nabla":"\u2207","Nacute":"\u0143","nacute":"\u0144","nang":"\u2220\u20D2","nap":"\u2249","napE":"\u2A70\u0338","napid":"\u224B\u0338","napos":"\u0149","napprox":"\u2249","natural":"\u266E","naturals":"\u2115","natur":"\u266E","nbsp":"\u00A0","nbump":"\u224E\u0338","nbumpe":"\u224F\u0338","ncap":"\u2A43","Ncaron":"\u0147","ncaron":"\u0148","Ncedil":"\u0145","ncedil":"\u0146","ncong":"\u2247","ncongdot":"\u2A6D\u0338","ncup":"\u2A42","Ncy":"\u041D","ncy":"\u043D","ndash":"\u2013","nearhk":"\u2924","nearr":"\u2197","neArr":"\u21D7","nearrow":"\u2197","ne":"\u2260","nedot":"\u2250\u0338","NegativeMediumSpace":"\u200B","NegativeThickSpace":"\u200B","NegativeThinSpace":"\u200B","NegativeVeryThinSpace":"\u200B","nequiv":"\u2262","nesear":"\u2928","nesim":"\u2242\u0338","NestedGreaterGreater":"\u226B","NestedLessLess":"\u226A","NewLine":"\n","nexist":"\u2204","nexists":"\u2204","Nfr":"\uD835\uDD11","nfr":"\uD835\uDD2B","ngE":"\u2267\u0338","nge":"\u2271","ngeq":"\u2271","ngeqq":"\u2267\u0338","ngeqslant":"\u2A7E\u0338","nges":"\u2A7E\u0338","nGg":"\u22D9\u0338","ngsim":"\u2275","nGt":"\u226B\u20D2","ngt":"\u226F","ngtr":"\u226F","nGtv":"\u226B\u0338","nharr":"\u21AE","nhArr":"\u21CE","nhpar":"\u2AF2","ni":"\u220B","nis":"\u22FC","nisd":"\u22FA","niv":"\u220B","NJcy":"\u040A","njcy":"\u045A","nlarr":"\u219A","nlArr":"\u21CD","nldr":"\u2025","nlE":"\u2266\u0338","nle":"\u2270","nleftarrow":"\u219A","nLeftarrow":"\u21CD","nleftrightarrow":"\u21AE","nLeftrightarrow":"\u21CE","nleq":"\u2270","nleqq":"\u2266\u0338","nleqslant":"\u2A7D\u0338","nles":"\u2A7D\u0338","nless":"\u226E","nLl":"\u22D8\u0338","nlsim":"\u2274","nLt":"\u226A\u20D2","nlt":"\u226E","nltri":"\u22EA","nltrie":"\u22EC","nLtv":"\u226A\u0338","nmid":"\u2224","NoBreak":"\u2060","NonBreakingSpace":"\u00A0","nopf":"\uD835\uDD5F","Nopf":"\u2115","Not":"\u2AEC","not":"\u00AC","NotCongruent":"\u2262","NotCupCap":"\u226D","NotDoubleVerticalBar":"\u2226","NotElement":"\u2209","NotEqual":"\u2260","NotEqualTilde":"\u2242\u0338","NotExists":"\u2204","NotGreater":"\u226F","NotGreaterEqual":"\u2271","NotGreaterFullEqual":"\u2267\u0338","NotGreaterGreater":"\u226B\u0338","NotGreaterLess":"\u2279","NotGreaterSlantEqual":"\u2A7E\u0338","NotGreaterTilde":"\u2275","NotHumpDownHump":"\u224E\u0338","NotHumpEqual":"\u224F\u0338","notin":"\u2209","notindot":"\u22F5\u0338","notinE":"\u22F9\u0338","notinva":"\u2209","notinvb":"\u22F7","notinvc":"\u22F6","NotLeftTriangleBar":"\u29CF\u0338","NotLeftTriangle":"\u22EA","NotLeftTriangleEqual":"\u22EC","NotLess":"\u226E","NotLessEqual":"\u2270","NotLessGreater":"\u2278","NotLessLess":"\u226A\u0338","NotLessSlantEqual":"\u2A7D\u0338","NotLessTilde":"\u2274","NotNestedGreaterGreater":"\u2AA2\u0338","NotNestedLessLess":"\u2AA1\u0338","notni":"\u220C","notniva":"\u220C","notnivb":"\u22FE","notnivc":"\u22FD","NotPrecedes":"\u2280","NotPrecedesEqual":"\u2AAF\u0338","NotPrecedesSlantEqual":"\u22E0","NotReverseElement":"\u220C","NotRightTriangleBar":"\u29D0\u0338","NotRightTriangle":"\u22EB","NotRightTriangleEqual":"\u22ED","NotSquareSubset":"\u228F\u0338","NotSquareSubsetEqual":"\u22E2","NotSquareSuperset":"\u2290\u0338","NotSquareSupersetEqual":"\u22E3","NotSubset":"\u2282\u20D2","NotSubsetEqual":"\u2288","NotSucceeds":"\u2281","NotSucceedsEqual":"\u2AB0\u0338","NotSucceedsSlantEqual":"\u22E1","NotSucceedsTilde":"\u227F\u0338","NotSuperset":"\u2283\u20D2","NotSupersetEqual":"\u2289","NotTilde":"\u2241","NotTildeEqual":"\u2244","NotTildeFullEqual":"\u2247","NotTildeTilde":"\u2249","NotVerticalBar":"\u2224","nparallel":"\u2226","npar":"\u2226","nparsl":"\u2AFD\u20E5","npart":"\u2202\u0338","npolint":"\u2A14","npr":"\u2280","nprcue":"\u22E0","nprec":"\u2280","npreceq":"\u2AAF\u0338","npre":"\u2AAF\u0338","nrarrc":"\u2933\u0338","nrarr":"\u219B","nrArr":"\u21CF","nrarrw":"\u219D\u0338","nrightarrow":"\u219B","nRightarrow":"\u21CF","nrtri":"\u22EB","nrtrie":"\u22ED","nsc":"\u2281","nsccue":"\u22E1","nsce":"\u2AB0\u0338","Nscr":"\uD835\uDCA9","nscr":"\uD835\uDCC3","nshortmid":"\u2224","nshortparallel":"\u2226","nsim":"\u2241","nsime":"\u2244","nsimeq":"\u2244","nsmid":"\u2224","nspar":"\u2226","nsqsube":"\u22E2","nsqsupe":"\u22E3","nsub":"\u2284","nsubE":"\u2AC5\u0338","nsube":"\u2288","nsubset":"\u2282\u20D2","nsubseteq":"\u2288","nsubseteqq":"\u2AC5\u0338","nsucc":"\u2281","nsucceq":"\u2AB0\u0338","nsup":"\u2285","nsupE":"\u2AC6\u0338","nsupe":"\u2289","nsupset":"\u2283\u20D2","nsupseteq":"\u2289","nsupseteqq":"\u2AC6\u0338","ntgl":"\u2279","Ntilde":"\u00D1","ntilde":"\u00F1","ntlg":"\u2278","ntriangleleft":"\u22EA","ntrianglelefteq":"\u22EC","ntriangleright":"\u22EB","ntrianglerighteq":"\u22ED","Nu":"\u039D","nu":"\u03BD","num":"#","numero":"\u2116","numsp":"\u2007","nvap":"\u224D\u20D2","nvdash":"\u22AC","nvDash":"\u22AD","nVdash":"\u22AE","nVDash":"\u22AF","nvge":"\u2265\u20D2","nvgt":">\u20D2","nvHarr":"\u2904","nvinfin":"\u29DE","nvlArr":"\u2902","nvle":"\u2264\u20D2","nvlt":"<\u20D2","nvltrie":"\u22B4\u20D2","nvrArr":"\u2903","nvrtrie":"\u22B5\u20D2","nvsim":"\u223C\u20D2","nwarhk":"\u2923","nwarr":"\u2196","nwArr":"\u21D6","nwarrow":"\u2196","nwnear":"\u2927","Oacute":"\u00D3","oacute":"\u00F3","oast":"\u229B","Ocirc":"\u00D4","ocirc":"\u00F4","ocir":"\u229A","Ocy":"\u041E","ocy":"\u043E","odash":"\u229D","Odblac":"\u0150","odblac":"\u0151","odiv":"\u2A38","odot":"\u2299","odsold":"\u29BC","OElig":"\u0152","oelig":"\u0153","ofcir":"\u29BF","Ofr":"\uD835\uDD12","ofr":"\uD835\uDD2C","ogon":"\u02DB","Ograve":"\u00D2","ograve":"\u00F2","ogt":"\u29C1","ohbar":"\u29B5","ohm":"\u03A9","oint":"\u222E","olarr":"\u21BA","olcir":"\u29BE","olcross":"\u29BB","oline":"\u203E","olt":"\u29C0","Omacr":"\u014C","omacr":"\u014D","Omega":"\u03A9","omega":"\u03C9","Omicron":"\u039F","omicron":"\u03BF","omid":"\u29B6","ominus":"\u2296","Oopf":"\uD835\uDD46","oopf":"\uD835\uDD60","opar":"\u29B7","OpenCurlyDoubleQuote":"\u201C","OpenCurlyQuote":"\u2018","operp":"\u29B9","oplus":"\u2295","orarr":"\u21BB","Or":"\u2A54","or":"\u2228","ord":"\u2A5D","order":"\u2134","orderof":"\u2134","ordf":"\u00AA","ordm":"\u00BA","origof":"\u22B6","oror":"\u2A56","orslope":"\u2A57","orv":"\u2A5B","oS":"\u24C8","Oscr":"\uD835\uDCAA","oscr":"\u2134","Oslash":"\u00D8","oslash":"\u00F8","osol":"\u2298","Otilde":"\u00D5","otilde":"\u00F5","otimesas":"\u2A36","Otimes":"\u2A37","otimes":"\u2297","Ouml":"\u00D6","ouml":"\u00F6","ovbar":"\u233D","OverBar":"\u203E","OverBrace":"\u23DE","OverBracket":"\u23B4","OverParenthesis":"\u23DC","para":"\u00B6","parallel":"\u2225","par":"\u2225","parsim":"\u2AF3","parsl":"\u2AFD","part":"\u2202","PartialD":"\u2202","Pcy":"\u041F","pcy":"\u043F","percnt":"%","period":".","permil":"\u2030","perp":"\u22A5","pertenk":"\u2031","Pfr":"\uD835\uDD13","pfr":"\uD835\uDD2D","Phi":"\u03A6","phi":"\u03C6","phiv":"\u03D5","phmmat":"\u2133","phone":"\u260E","Pi":"\u03A0","pi":"\u03C0","pitchfork":"\u22D4","piv":"\u03D6","planck":"\u210F","planckh":"\u210E","plankv":"\u210F","plusacir":"\u2A23","plusb":"\u229E","pluscir":"\u2A22","plus":"+","plusdo":"\u2214","plusdu":"\u2A25","pluse":"\u2A72","PlusMinus":"\u00B1","plusmn":"\u00B1","plussim":"\u2A26","plustwo":"\u2A27","pm":"\u00B1","Poincareplane":"\u210C","pointint":"\u2A15","popf":"\uD835\uDD61","Popf":"\u2119","pound":"\u00A3","prap":"\u2AB7","Pr":"\u2ABB","pr":"\u227A","prcue":"\u227C","precapprox":"\u2AB7","prec":"\u227A","preccurlyeq":"\u227C","Precedes":"\u227A","PrecedesEqual":"\u2AAF","PrecedesSlantEqual":"\u227C","PrecedesTilde":"\u227E","preceq":"\u2AAF","precnapprox":"\u2AB9","precneqq":"\u2AB5","precnsim":"\u22E8","pre":"\u2AAF","prE":"\u2AB3","precsim":"\u227E","prime":"\u2032","Prime":"\u2033","primes":"\u2119","prnap":"\u2AB9","prnE":"\u2AB5","prnsim":"\u22E8","prod":"\u220F","Product":"\u220F","profalar":"\u232E","profline":"\u2312","profsurf":"\u2313","prop":"\u221D","Proportional":"\u221D","Proportion":"\u2237","propto":"\u221D","prsim":"\u227E","prurel":"\u22B0","Pscr":"\uD835\uDCAB","pscr":"\uD835\uDCC5","Psi":"\u03A8","psi":"\u03C8","puncsp":"\u2008","Qfr":"\uD835\uDD14","qfr":"\uD835\uDD2E","qint":"\u2A0C","qopf":"\uD835\uDD62","Qopf":"\u211A","qprime":"\u2057","Qscr":"\uD835\uDCAC","qscr":"\uD835\uDCC6","quaternions":"\u210D","quatint":"\u2A16","quest":"?","questeq":"\u225F","quot":"\"","QUOT":"\"","rAarr":"\u21DB","race":"\u223D\u0331","Racute":"\u0154","racute":"\u0155","radic":"\u221A","raemptyv":"\u29B3","rang":"\u27E9","Rang":"\u27EB","rangd":"\u2992","range":"\u29A5","rangle":"\u27E9","raquo":"\u00BB","rarrap":"\u2975","rarrb":"\u21E5","rarrbfs":"\u2920","rarrc":"\u2933","rarr":"\u2192","Rarr":"\u21A0","rArr":"\u21D2","rarrfs":"\u291E","rarrhk":"\u21AA","rarrlp":"\u21AC","rarrpl":"\u2945","rarrsim":"\u2974","Rarrtl":"\u2916","rarrtl":"\u21A3","rarrw":"\u219D","ratail":"\u291A","rAtail":"\u291C","ratio":"\u2236","rationals":"\u211A","rbarr":"\u290D","rBarr":"\u290F","RBarr":"\u2910","rbbrk":"\u2773","rbrace":"}","rbrack":"]","rbrke":"\u298C","rbrksld":"\u298E","rbrkslu":"\u2990","Rcaron":"\u0158","rcaron":"\u0159","Rcedil":"\u0156","rcedil":"\u0157","rceil":"\u2309","rcub":"}","Rcy":"\u0420","rcy":"\u0440","rdca":"\u2937","rdldhar":"\u2969","rdquo":"\u201D","rdquor":"\u201D","rdsh":"\u21B3","real":"\u211C","realine":"\u211B","realpart":"\u211C","reals":"\u211D","Re":"\u211C","rect":"\u25AD","reg":"\u00AE","REG":"\u00AE","ReverseElement":"\u220B","ReverseEquilibrium":"\u21CB","ReverseUpEquilibrium":"\u296F","rfisht":"\u297D","rfloor":"\u230B","rfr":"\uD835\uDD2F","Rfr":"\u211C","rHar":"\u2964","rhard":"\u21C1","rharu":"\u21C0","rharul":"\u296C","Rho":"\u03A1","rho":"\u03C1","rhov":"\u03F1","RightAngleBracket":"\u27E9","RightArrowBar":"\u21E5","rightarrow":"\u2192","RightArrow":"\u2192","Rightarrow":"\u21D2","RightArrowLeftArrow":"\u21C4","rightarrowtail":"\u21A3","RightCeiling":"\u2309","RightDoubleBracket":"\u27E7","RightDownTeeVector":"\u295D","RightDownVectorBar":"\u2955","RightDownVector":"\u21C2","RightFloor":"\u230B","rightharpoondown":"\u21C1","rightharpoonup":"\u21C0","rightleftarrows":"\u21C4","rightleftharpoons":"\u21CC","rightrightarrows":"\u21C9","rightsquigarrow":"\u219D","RightTeeArrow":"\u21A6","RightTee":"\u22A2","RightTeeVector":"\u295B","rightthreetimes":"\u22CC","RightTriangleBar":"\u29D0","RightTriangle":"\u22B3","RightTriangleEqual":"\u22B5","RightUpDownVector":"\u294F","RightUpTeeVector":"\u295C","RightUpVectorBar":"\u2954","RightUpVector":"\u21BE","RightVectorBar":"\u2953","RightVector":"\u21C0","ring":"\u02DA","risingdotseq":"\u2253","rlarr":"\u21C4","rlhar":"\u21CC","rlm":"\u200F","rmoustache":"\u23B1","rmoust":"\u23B1","rnmid":"\u2AEE","roang":"\u27ED","roarr":"\u21FE","robrk":"\u27E7","ropar":"\u2986","ropf":"\uD835\uDD63","Ropf":"\u211D","roplus":"\u2A2E","rotimes":"\u2A35","RoundImplies":"\u2970","rpar":")","rpargt":"\u2994","rppolint":"\u2A12","rrarr":"\u21C9","Rrightarrow":"\u21DB","rsaquo":"\u203A","rscr":"\uD835\uDCC7","Rscr":"\u211B","rsh":"\u21B1","Rsh":"\u21B1","rsqb":"]","rsquo":"\u2019","rsquor":"\u2019","rthree":"\u22CC","rtimes":"\u22CA","rtri":"\u25B9","rtrie":"\u22B5","rtrif":"\u25B8","rtriltri":"\u29CE","RuleDelayed":"\u29F4","ruluhar":"\u2968","rx":"\u211E","Sacute":"\u015A","sacute":"\u015B","sbquo":"\u201A","scap":"\u2AB8","Scaron":"\u0160","scaron":"\u0161","Sc":"\u2ABC","sc":"\u227B","sccue":"\u227D","sce":"\u2AB0","scE":"\u2AB4","Scedil":"\u015E","scedil":"\u015F","Scirc":"\u015C","scirc":"\u015D","scnap":"\u2ABA","scnE":"\u2AB6","scnsim":"\u22E9","scpolint":"\u2A13","scsim":"\u227F","Scy":"\u0421","scy":"\u0441","sdotb":"\u22A1","sdot":"\u22C5","sdote":"\u2A66","searhk":"\u2925","searr":"\u2198","seArr":"\u21D8","searrow":"\u2198","sect":"\u00A7","semi":";","seswar":"\u2929","setminus":"\u2216","setmn":"\u2216","sext":"\u2736","Sfr":"\uD835\uDD16","sfr":"\uD835\uDD30","sfrown":"\u2322","sharp":"\u266F","SHCHcy":"\u0429","shchcy":"\u0449","SHcy":"\u0428","shcy":"\u0448","ShortDownArrow":"\u2193","ShortLeftArrow":"\u2190","shortmid":"\u2223","shortparallel":"\u2225","ShortRightArrow":"\u2192","ShortUpArrow":"\u2191","shy":"\u00AD","Sigma":"\u03A3","sigma":"\u03C3","sigmaf":"\u03C2","sigmav":"\u03C2","sim":"\u223C","simdot":"\u2A6A","sime":"\u2243","simeq":"\u2243","simg":"\u2A9E","simgE":"\u2AA0","siml":"\u2A9D","simlE":"\u2A9F","simne":"\u2246","simplus":"\u2A24","simrarr":"\u2972","slarr":"\u2190","SmallCircle":"\u2218","smallsetminus":"\u2216","smashp":"\u2A33","smeparsl":"\u29E4","smid":"\u2223","smile":"\u2323","smt":"\u2AAA","smte":"\u2AAC","smtes":"\u2AAC\uFE00","SOFTcy":"\u042C","softcy":"\u044C","solbar":"\u233F","solb":"\u29C4","sol":"/","Sopf":"\uD835\uDD4A","sopf":"\uD835\uDD64","spades":"\u2660","spadesuit":"\u2660","spar":"\u2225","sqcap":"\u2293","sqcaps":"\u2293\uFE00","sqcup":"\u2294","sqcups":"\u2294\uFE00","Sqrt":"\u221A","sqsub":"\u228F","sqsube":"\u2291","sqsubset":"\u228F","sqsubseteq":"\u2291","sqsup":"\u2290","sqsupe":"\u2292","sqsupset":"\u2290","sqsupseteq":"\u2292","square":"\u25A1","Square":"\u25A1","SquareIntersection":"\u2293","SquareSubset":"\u228F","SquareSubsetEqual":"\u2291","SquareSuperset":"\u2290","SquareSupersetEqual":"\u2292","SquareUnion":"\u2294","squarf":"\u25AA","squ":"\u25A1","squf":"\u25AA","srarr":"\u2192","Sscr":"\uD835\uDCAE","sscr":"\uD835\uDCC8","ssetmn":"\u2216","ssmile":"\u2323","sstarf":"\u22C6","Star":"\u22C6","star":"\u2606","starf":"\u2605","straightepsilon":"\u03F5","straightphi":"\u03D5","strns":"\u00AF","sub":"\u2282","Sub":"\u22D0","subdot":"\u2ABD","subE":"\u2AC5","sube":"\u2286","subedot":"\u2AC3","submult":"\u2AC1","subnE":"\u2ACB","subne":"\u228A","subplus":"\u2ABF","subrarr":"\u2979","subset":"\u2282","Subset":"\u22D0","subseteq":"\u2286","subseteqq":"\u2AC5","SubsetEqual":"\u2286","subsetneq":"\u228A","subsetneqq":"\u2ACB","subsim":"\u2AC7","subsub":"\u2AD5","subsup":"\u2AD3","succapprox":"\u2AB8","succ":"\u227B","succcurlyeq":"\u227D","Succeeds":"\u227B","SucceedsEqual":"\u2AB0","SucceedsSlantEqual":"\u227D","SucceedsTilde":"\u227F","succeq":"\u2AB0","succnapprox":"\u2ABA","succneqq":"\u2AB6","succnsim":"\u22E9","succsim":"\u227F","SuchThat":"\u220B","sum":"\u2211","Sum":"\u2211","sung":"\u266A","sup1":"\u00B9","sup2":"\u00B2","sup3":"\u00B3","sup":"\u2283","Sup":"\u22D1","supdot":"\u2ABE","supdsub":"\u2AD8","supE":"\u2AC6","supe":"\u2287","supedot":"\u2AC4","Superset":"\u2283","SupersetEqual":"\u2287","suphsol":"\u27C9","suphsub":"\u2AD7","suplarr":"\u297B","supmult":"\u2AC2","supnE":"\u2ACC","supne":"\u228B","supplus":"\u2AC0","supset":"\u2283","Supset":"\u22D1","supseteq":"\u2287","supseteqq":"\u2AC6","supsetneq":"\u228B","supsetneqq":"\u2ACC","supsim":"\u2AC8","supsub":"\u2AD4","supsup":"\u2AD6","swarhk":"\u2926","swarr":"\u2199","swArr":"\u21D9","swarrow":"\u2199","swnwar":"\u292A","szlig":"\u00DF","Tab":"\t","target":"\u2316","Tau":"\u03A4","tau":"\u03C4","tbrk":"\u23B4","Tcaron":"\u0164","tcaron":"\u0165","Tcedil":"\u0162","tcedil":"\u0163","Tcy":"\u0422","tcy":"\u0442","tdot":"\u20DB","telrec":"\u2315","Tfr":"\uD835\uDD17","tfr":"\uD835\uDD31","there4":"\u2234","therefore":"\u2234","Therefore":"\u2234","Theta":"\u0398","theta":"\u03B8","thetasym":"\u03D1","thetav":"\u03D1","thickapprox":"\u2248","thicksim":"\u223C","ThickSpace":"\u205F\u200A","ThinSpace":"\u2009","thinsp":"\u2009","thkap":"\u2248","thksim":"\u223C","THORN":"\u00DE","thorn":"\u00FE","tilde":"\u02DC","Tilde":"\u223C","TildeEqual":"\u2243","TildeFullEqual":"\u2245","TildeTilde":"\u2248","timesbar":"\u2A31","timesb":"\u22A0","times":"\u00D7","timesd":"\u2A30","tint":"\u222D","toea":"\u2928","topbot":"\u2336","topcir":"\u2AF1","top":"\u22A4","Topf":"\uD835\uDD4B","topf":"\uD835\uDD65","topfork":"\u2ADA","tosa":"\u2929","tprime":"\u2034","trade":"\u2122","TRADE":"\u2122","triangle":"\u25B5","triangledown":"\u25BF","triangleleft":"\u25C3","trianglelefteq":"\u22B4","triangleq":"\u225C","triangleright":"\u25B9","trianglerighteq":"\u22B5","tridot":"\u25EC","trie":"\u225C","triminus":"\u2A3A","TripleDot":"\u20DB","triplus":"\u2A39","trisb":"\u29CD","tritime":"\u2A3B","trpezium":"\u23E2","Tscr":"\uD835\uDCAF","tscr":"\uD835\uDCC9","TScy":"\u0426","tscy":"\u0446","TSHcy":"\u040B","tshcy":"\u045B","Tstrok":"\u0166","tstrok":"\u0167","twixt":"\u226C","twoheadleftarrow":"\u219E","twoheadrightarrow":"\u21A0","Uacute":"\u00DA","uacute":"\u00FA","uarr":"\u2191","Uarr":"\u219F","uArr":"\u21D1","Uarrocir":"\u2949","Ubrcy":"\u040E","ubrcy":"\u045E","Ubreve":"\u016C","ubreve":"\u016D","Ucirc":"\u00DB","ucirc":"\u00FB","Ucy":"\u0423","ucy":"\u0443","udarr":"\u21C5","Udblac":"\u0170","udblac":"\u0171","udhar":"\u296E","ufisht":"\u297E","Ufr":"\uD835\uDD18","ufr":"\uD835\uDD32","Ugrave":"\u00D9","ugrave":"\u00F9","uHar":"\u2963","uharl":"\u21BF","uharr":"\u21BE","uhblk":"\u2580","ulcorn":"\u231C","ulcorner":"\u231C","ulcrop":"\u230F","ultri":"\u25F8","Umacr":"\u016A","umacr":"\u016B","uml":"\u00A8","UnderBar":"_","UnderBrace":"\u23DF","UnderBracket":"\u23B5","UnderParenthesis":"\u23DD","Union":"\u22C3","UnionPlus":"\u228E","Uogon":"\u0172","uogon":"\u0173","Uopf":"\uD835\uDD4C","uopf":"\uD835\uDD66","UpArrowBar":"\u2912","uparrow":"\u2191","UpArrow":"\u2191","Uparrow":"\u21D1","UpArrowDownArrow":"\u21C5","updownarrow":"\u2195","UpDownArrow":"\u2195","Updownarrow":"\u21D5","UpEquilibrium":"\u296E","upharpoonleft":"\u21BF","upharpoonright":"\u21BE","uplus":"\u228E","UpperLeftArrow":"\u2196","UpperRightArrow":"\u2197","upsi":"\u03C5","Upsi":"\u03D2","upsih":"\u03D2","Upsilon":"\u03A5","upsilon":"\u03C5","UpTeeArrow":"\u21A5","UpTee":"\u22A5","upuparrows":"\u21C8","urcorn":"\u231D","urcorner":"\u231D","urcrop":"\u230E","Uring":"\u016E","uring":"\u016F","urtri":"\u25F9","Uscr":"\uD835\uDCB0","uscr":"\uD835\uDCCA","utdot":"\u22F0","Utilde":"\u0168","utilde":"\u0169","utri":"\u25B5","utrif":"\u25B4","uuarr":"\u21C8","Uuml":"\u00DC","uuml":"\u00FC","uwangle":"\u29A7","vangrt":"\u299C","varepsilon":"\u03F5","varkappa":"\u03F0","varnothing":"\u2205","varphi":"\u03D5","varpi":"\u03D6","varpropto":"\u221D","varr":"\u2195","vArr":"\u21D5","varrho":"\u03F1","varsigma":"\u03C2","varsubsetneq":"\u228A\uFE00","varsubsetneqq":"\u2ACB\uFE00","varsupsetneq":"\u228B\uFE00","varsupsetneqq":"\u2ACC\uFE00","vartheta":"\u03D1","vartriangleleft":"\u22B2","vartriangleright":"\u22B3","vBar":"\u2AE8","Vbar":"\u2AEB","vBarv":"\u2AE9","Vcy":"\u0412","vcy":"\u0432","vdash":"\u22A2","vDash":"\u22A8","Vdash":"\u22A9","VDash":"\u22AB","Vdashl":"\u2AE6","veebar":"\u22BB","vee":"\u2228","Vee":"\u22C1","veeeq":"\u225A","vellip":"\u22EE","verbar":"|","Verbar":"\u2016","vert":"|","Vert":"\u2016","VerticalBar":"\u2223","VerticalLine":"|","VerticalSeparator":"\u2758","VerticalTilde":"\u2240","VeryThinSpace":"\u200A","Vfr":"\uD835\uDD19","vfr":"\uD835\uDD33","vltri":"\u22B2","vnsub":"\u2282\u20D2","vnsup":"\u2283\u20D2","Vopf":"\uD835\uDD4D","vopf":"\uD835\uDD67","vprop":"\u221D","vrtri":"\u22B3","Vscr":"\uD835\uDCB1","vscr":"\uD835\uDCCB","vsubnE":"\u2ACB\uFE00","vsubne":"\u228A\uFE00","vsupnE":"\u2ACC\uFE00","vsupne":"\u228B\uFE00","Vvdash":"\u22AA","vzigzag":"\u299A","Wcirc":"\u0174","wcirc":"\u0175","wedbar":"\u2A5F","wedge":"\u2227","Wedge":"\u22C0","wedgeq":"\u2259","weierp":"\u2118","Wfr":"\uD835\uDD1A","wfr":"\uD835\uDD34","Wopf":"\uD835\uDD4E","wopf":"\uD835\uDD68","wp":"\u2118","wr":"\u2240","wreath":"\u2240","Wscr":"\uD835\uDCB2","wscr":"\uD835\uDCCC","xcap":"\u22C2","xcirc":"\u25EF","xcup":"\u22C3","xdtri":"\u25BD","Xfr":"\uD835\uDD1B","xfr":"\uD835\uDD35","xharr":"\u27F7","xhArr":"\u27FA","Xi":"\u039E","xi":"\u03BE","xlarr":"\u27F5","xlArr":"\u27F8","xmap":"\u27FC","xnis":"\u22FB","xodot":"\u2A00","Xopf":"\uD835\uDD4F","xopf":"\uD835\uDD69","xoplus":"\u2A01","xotime":"\u2A02","xrarr":"\u27F6","xrArr":"\u27F9","Xscr":"\uD835\uDCB3","xscr":"\uD835\uDCCD","xsqcup":"\u2A06","xuplus":"\u2A04","xutri":"\u25B3","xvee":"\u22C1","xwedge":"\u22C0","Yacute":"\u00DD","yacute":"\u00FD","YAcy":"\u042F","yacy":"\u044F","Ycirc":"\u0176","ycirc":"\u0177","Ycy":"\u042B","ycy":"\u044B","yen":"\u00A5","Yfr":"\uD835\uDD1C","yfr":"\uD835\uDD36","YIcy":"\u0407","yicy":"\u0457","Yopf":"\uD835\uDD50","yopf":"\uD835\uDD6A","Yscr":"\uD835\uDCB4","yscr":"\uD835\uDCCE","YUcy":"\u042E","yucy":"\u044E","yuml":"\u00FF","Yuml":"\u0178","Zacute":"\u0179","zacute":"\u017A","Zcaron":"\u017D","zcaron":"\u017E","Zcy":"\u0417","zcy":"\u0437","Zdot":"\u017B","zdot":"\u017C","zeetrf":"\u2128","ZeroWidthSpace":"\u200B","Zeta":"\u0396","zeta":"\u03B6","zfr":"\uD835\uDD37","Zfr":"\u2128","ZHcy":"\u0416","zhcy":"\u0436","zigrarr":"\u21DD","zopf":"\uD835\uDD6B","Zopf":"\u2124","Zscr":"\uD835\uDCB5","zscr":"\uD835\uDCCF","zwj":"\u200D","zwnj":"\u200C"}
},{}],108:[function(require,module,exports){
'use strict';


////////////////////////////////////////////////////////////////////////////////
// Helpers

// Merge objects
//
function assign(obj /*from1, from2, from3, ...*/) {
  var sources = Array.prototype.slice.call(arguments, 1);

  sources.forEach(function (source) {
    if (!source) { return; }

    Object.keys(source).forEach(function (key) {
      obj[key] = source[key];
    });
  });

  return obj;
}

function _class(obj) { return Object.prototype.toString.call(obj); }
function isString(obj) { return _class(obj) === '[object String]'; }
function isObject(obj) { return _class(obj) === '[object Object]'; }
function isRegExp(obj) { return _class(obj) === '[object RegExp]'; }
function isFunction(obj) { return _class(obj) === '[object Function]'; }


  function escapeRE(str) {
    return str.replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&');
  }

////////////////////////////////////////////////////////////////////////////////


var defaultOptions = {
  fuzzyLink: true,
  fuzzyEmail: true,
  fuzzyIP: false
};


function isOptionsObj(obj) {
  return Object.keys(obj || {}).reduce(function (acc, k) {
    return acc || defaultOptions.hasOwnProperty(k);
  }, false);
}


var defaultSchemas = {
  'http:': {
    validate: function (text, pos, self) {
      var tail = text.slice(pos);

      if (!self.re.http) {
        // compile lazily, because "host"-containing variables can change on tlds update.
        self.re.http =  new RegExp(
          '^\\/\\/' + self.re.src_auth + self.re.src_host_port_strict + self.re.src_path, 'i'
        );
      }
      if (self.re.http.test(tail)) {
        return tail.match(self.re.http)[0].length;
      }
      return 0;
    }
  },
  'https:':  'http:',
  'ftp:':    'http:',
  '//':      {
    validate: function (text, pos, self) {
      var tail = text.slice(pos);

      if (!self.re.no_http) {
      // compile lazily, becayse "host"-containing variables can change on tlds update.
        self.re.no_http =  new RegExp(
          '^' + self.re.src_auth + self.re.src_host_port_strict + self.re.src_path, 'i'
        );
      }

      if (self.re.no_http.test(tail)) {
        // should not be `://`, that protects from errors in protocol name
        if (pos >= 3 && text[pos - 3] === ':') { return 0; }
        return tail.match(self.re.no_http)[0].length;
      }
      return 0;
    }
  },
  'mailto:': {
    validate: function (text, pos, self) {
      var tail = text.slice(pos);

      if (!self.re.mailto) {
        self.re.mailto =  new RegExp(
          '^' + self.re.src_email_name + '@' + self.re.src_host_strict, 'i'
        );
      }
      if (self.re.mailto.test(tail)) {
        return tail.match(self.re.mailto)[0].length;
      }
      return 0;
    }
  }
};

/*eslint-disable max-len*/

// RE pattern for 2-character tlds (autogenerated by ./support/tlds_2char_gen.js)
var tlds_2ch_src_re = 'a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]';

// DON'T try to make PRs with changes. Extend TLDs with LinkifyIt.tlds() instead
var tlds_default = 'biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф'.split('|');

/*eslint-enable max-len*/

////////////////////////////////////////////////////////////////////////////////

function resetScanCache(self) {
  self.__index__ = -1;
  self.__text_cache__   = '';
}

function createValidator(re) {
  return function (text, pos) {
    var tail = text.slice(pos);

    if (re.test(tail)) {
      return tail.match(re)[0].length;
    }
    return 0;
  };
}

function createNormalizer() {
  return function (match, self) {
    self.normalize(match);
  };
}

// Schemas compiler. Build regexps.
//
function compile(self) {

  // Load & clone RE patterns.
  var re = self.re = assign({}, require('./lib/re'));

  // Define dynamic patterns
  var tlds = self.__tlds__.slice();

  if (!self.__tlds_replaced__) {
    tlds.push(tlds_2ch_src_re);
  }
  tlds.push(re.src_xn);

  re.src_tlds = tlds.join('|');

  function untpl(tpl) { return tpl.replace('%TLDS%', re.src_tlds); }

  re.email_fuzzy      = RegExp(untpl(re.tpl_email_fuzzy), 'i');
  re.link_fuzzy       = RegExp(untpl(re.tpl_link_fuzzy), 'i');
  re.link_no_ip_fuzzy = RegExp(untpl(re.tpl_link_no_ip_fuzzy), 'i');
  re.host_fuzzy_test  = RegExp(untpl(re.tpl_host_fuzzy_test), 'i');

  //
  // Compile each schema
  //

  var aliases = [];

  self.__compiled__ = {}; // Reset compiled data

  function schemaError(name, val) {
    throw new Error('(LinkifyIt) Invalid schema "' + name + '": ' + val);
  }

  Object.keys(self.__schemas__).forEach(function (name) {
    var val = self.__schemas__[name];

    // skip disabled methods
    if (val === null) { return; }

    var compiled = { validate: null, link: null };

    self.__compiled__[name] = compiled;

    if (isObject(val)) {
      if (isRegExp(val.validate)) {
        compiled.validate = createValidator(val.validate);
      } else if (isFunction(val.validate)) {
        compiled.validate = val.validate;
      } else {
        schemaError(name, val);
      }

      if (isFunction(val.normalize)) {
        compiled.normalize = val.normalize;
      } else if (!val.normalize) {
        compiled.normalize = createNormalizer();
      } else {
        schemaError(name, val);
      }

      return;
    }

    if (isString(val)) {
      aliases.push(name);
      return;
    }

    schemaError(name, val);
  });

  //
  // Compile postponed aliases
  //

  aliases.forEach(function (alias) {
    if (!self.__compiled__[self.__schemas__[alias]]) {
      // Silently fail on missed schemas to avoid errons on disable.
      // schemaError(alias, self.__schemas__[alias]);
      return;
    }

    self.__compiled__[alias].validate =
      self.__compiled__[self.__schemas__[alias]].validate;
    self.__compiled__[alias].normalize =
      self.__compiled__[self.__schemas__[alias]].normalize;
  });

  //
  // Fake record for guessed links
  //
  self.__compiled__[''] = { validate: null, normalize: createNormalizer() };

  //
  // Build schema condition
  //
  var slist = Object.keys(self.__compiled__)
      .filter(function (name) {
                        // Filter disabled & fake schemas
                        return name.length > 0 && self.__compiled__[name];
                      })
                      .map(escapeRE)
                      .join('|');
  // (?!_) cause 1.5x slowdown
  self.re.schema_test   = RegExp('(^|(?!_)(?:>|' + re.src_ZPCc + '))(' + slist + ')', 'i');
  self.re.schema_search = RegExp('(^|(?!_)(?:>|' + re.src_ZPCc + '))(' + slist + ')', 'ig');

  self.re.pretest       = RegExp(
                            '(' + self.re.schema_test.source + ')|' +
                            '(' + self.re.host_fuzzy_test.source + ')|' +
                            '@',
                            'i');

  //
  // Cleanup
  //

  resetScanCache(self);
}

/**
 * class Match
 *
 * Match result. Single element of array, returned by [[LinkifyIt#match]]
 **/
function Match(self, shift) {
  var start = self.__index__,
      end   = self.__last_index__,
      text  = self.__text_cache__.slice(start, end);

  /**
   * Match#schema -> String
   *
   * Prefix (protocol) for matched string.
   **/
  this.schema    = self.__schema__.toLowerCase();
  /**
   * Match#index -> Number
   *
   * First position of matched string.
   **/
  this.index     = start + shift;
  /**
   * Match#lastIndex -> Number
   *
   * Next position after matched string.
   **/
  this.lastIndex = end + shift;
  /**
   * Match#raw -> String
   *
   * Matched string.
   **/
  this.raw       = text;
  /**
   * Match#text -> String
   *
   * Notmalized text of matched string.
   **/
  this.text      = text;
  /**
   * Match#url -> String
   *
   * Normalized url of matched string.
   **/
  this.url       = text;
}

function createMatch(self, shift) {
  var match = new Match(self, shift);

  self.__compiled__[match.schema].normalize(match, self);

  return match;
}


/**
 * class LinkifyIt
 **/

/**
 * new LinkifyIt(schemas, options)
 * - schemas (Object): Optional. Additional schemas to validate (prefix/validator)
 * - options (Object): { fuzzyLink|fuzzyEmail|fuzzyIP: true|false }
 *
 * Creates new linkifier instance with optional additional schemas.
 * Can be called without `new` keyword for convenience.
 *
 * By default understands:
 *
 * - `http(s)://...` , `ftp://...`, `mailto:...` & `//...` links
 * - "fuzzy" links and emails (example.com, foo@bar.com).
 *
 * `schemas` is an object, where each key/value describes protocol/rule:
 *
 * - __key__ - link prefix (usually, protocol name with `:` at the end, `skype:`
 *   for example). `linkify-it` makes shure that prefix is not preceeded with
 *   alphanumeric char and symbols. Only whitespaces and punctuation allowed.
 * - __value__ - rule to check tail after link prefix
 *   - _String_ - just alias to existing rule
 *   - _Object_
 *     - _validate_ - validator function (should return matched length on success),
 *       or `RegExp`.
 *     - _normalize_ - optional function to normalize text & url of matched result
 *       (for example, for @twitter mentions).
 *
 * `options`:
 *
 * - __fuzzyLink__ - recognige URL-s without `http(s):` prefix. Default `true`.
 * - __fuzzyIP__ - allow IPs in fuzzy links above. Can conflict with some texts
 *   like version numbers. Default `false`.
 * - __fuzzyEmail__ - recognize emails without `mailto:` prefix.
 *
 **/
function LinkifyIt(schemas, options) {
  if (!(this instanceof LinkifyIt)) {
    return new LinkifyIt(schemas, options);
  }

  if (!options) {
    if (isOptionsObj(schemas)) {
      options = schemas;
      schemas = {};
    }
  }

  this.__opts__           = assign({}, defaultOptions, options);

  // Cache last tested result. Used to skip repeating steps on next `match` call.
  this.__index__          = -1;
  this.__last_index__     = -1; // Next scan position
  this.__schema__         = '';
  this.__text_cache__     = '';

  this.__schemas__        = assign({}, defaultSchemas, schemas);
  this.__compiled__       = {};

  this.__tlds__           = tlds_default;
  this.__tlds_replaced__  = false;

  this.re = {};

  compile(this);
}


/** chainable
 * LinkifyIt#add(schema, definition)
 * - schema (String): rule name (fixed pattern prefix)
 * - definition (String|RegExp|Object): schema definition
 *
 * Add new rule definition. See constructor description for details.
 **/
LinkifyIt.prototype.add = function add(schema, definition) {
  this.__schemas__[schema] = definition;
  compile(this);
  return this;
};


/** chainable
 * LinkifyIt#set(options)
 * - options (Object): { fuzzyLink|fuzzyEmail|fuzzyIP: true|false }
 *
 * Set recognition options for links without schema.
 **/
LinkifyIt.prototype.set = function set(options) {
  this.__opts__ = assign(this.__opts__, options);
  return this;
};


/**
 * LinkifyIt#test(text) -> Boolean
 *
 * Searches linkifiable pattern and returns `true` on success or `false` on fail.
 **/
LinkifyIt.prototype.test = function test(text) {
  // Reset scan cache
  this.__text_cache__ = text;
  this.__index__      = -1;

  if (!text.length) { return false; }

  var m, ml, me, len, shift, next, re, tld_pos, at_pos;

  // try to scan for link with schema - that's the most simple rule
  if (this.re.schema_test.test(text)) {
    re = this.re.schema_search;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      len = this.testSchemaAt(text, m[2], re.lastIndex);
      if (len) {
        this.__schema__     = m[2];
        this.__index__      = m.index + m[1].length;
        this.__last_index__ = m.index + m[0].length + len;
        break;
      }
    }
  }

  if (this.__opts__.fuzzyLink && this.__compiled__['http:']) {
    // guess schemaless links
    tld_pos = text.search(this.re.host_fuzzy_test);
    if (tld_pos >= 0) {
      // if tld is located after found link - no need to check fuzzy pattern
      if (this.__index__ < 0 || tld_pos < this.__index__) {
        if ((ml = text.match(this.__opts__.fuzzyIP ? this.re.link_fuzzy : this.re.link_no_ip_fuzzy)) !== null) {

          shift = ml.index + ml[1].length;

          if (this.__index__ < 0 || shift < this.__index__) {
            this.__schema__     = '';
            this.__index__      = shift;
            this.__last_index__ = ml.index + ml[0].length;
          }
        }
      }
    }
  }

  if (this.__opts__.fuzzyEmail && this.__compiled__['mailto:']) {
    // guess schemaless emails
    at_pos = text.indexOf('@');
    if (at_pos >= 0) {
      // We can't skip this check, because this cases are possible:
      // 192.168.1.1@gmail.com, my.in@example.com
      if ((me = text.match(this.re.email_fuzzy)) !== null) {

        shift = me.index + me[1].length;
        next  = me.index + me[0].length;

        if (this.__index__ < 0 || shift < this.__index__ ||
            (shift === this.__index__ && next > this.__last_index__)) {
          this.__schema__     = 'mailto:';
          this.__index__      = shift;
          this.__last_index__ = next;
        }
      }
    }
  }

  return this.__index__ >= 0;
};


/**
 * LinkifyIt#pretest(text) -> Boolean
 *
 * Very quick check, that can give false positives. Returns true if link MAY BE
 * can exists. Can be used for speed optimization, when you need to check that
 * link NOT exists.
 **/
LinkifyIt.prototype.pretest = function pretest(text) {
  return this.re.pretest.test(text);
};


/**
 * LinkifyIt#testSchemaAt(text, name, position) -> Number
 * - text (String): text to scan
 * - name (String): rule (schema) name
 * - position (Number): text offset to check from
 *
 * Similar to [[LinkifyIt#test]] but checks only specific protocol tail exactly
 * at given position. Returns length of found pattern (0 on fail).
 **/
LinkifyIt.prototype.testSchemaAt = function testSchemaAt(text, schema, pos) {
  // If not supported schema check requested - terminate
  if (!this.__compiled__[schema.toLowerCase()]) {
    return 0;
  }
  return this.__compiled__[schema.toLowerCase()].validate(text, pos, this);
};


/**
 * LinkifyIt#match(text) -> Array|null
 *
 * Returns array of found link descriptions or `null` on fail. We strongly
 * recommend to use [[LinkifyIt#test]] first, for best speed.
 *
 * ##### Result match description
 *
 * - __schema__ - link schema, can be empty for fuzzy links, or `//` for
 *   protocol-neutral  links.
 * - __index__ - offset of matched text
 * - __lastIndex__ - index of next char after mathch end
 * - __raw__ - matched text
 * - __text__ - normalized text
 * - __url__ - link, generated from matched text
 **/
LinkifyIt.prototype.match = function match(text) {
  var shift = 0, result = [];

  // Try to take previous element from cache, if .test() called before
  if (this.__index__ >= 0 && this.__text_cache__ === text) {
    result.push(createMatch(this, shift));
    shift = this.__last_index__;
  }

  // Cut head if cache was used
  var tail = shift ? text.slice(shift) : text;

  // Scan string until end reached
  while (this.test(tail)) {
    result.push(createMatch(this, shift));

    tail = tail.slice(this.__last_index__);
    shift += this.__last_index__;
  }

  if (result.length) {
    return result;
  }

  return null;
};


/** chainable
 * LinkifyIt#tlds(list [, keepOld]) -> this
 * - list (Array): list of tlds
 * - keepOld (Boolean): merge with current list if `true` (`false` by default)
 *
 * Load (or merge) new tlds list. Those are user for fuzzy links (without prefix)
 * to avoid false positives. By default this algorythm used:
 *
 * - hostname with any 2-letter root zones are ok.
 * - biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф
 *   are ok.
 * - encoded (`xn--...`) root zones are ok.
 *
 * If list is replaced, then exact match for 2-chars root zones will be checked.
 **/
LinkifyIt.prototype.tlds = function tlds(list, keepOld) {
  list = Array.isArray(list) ? list : [ list ];

  if (!keepOld) {
    this.__tlds__ = list.slice();
    this.__tlds_replaced__ = true;
    compile(this);
    return this;
  }

  this.__tlds__ = this.__tlds__.concat(list)
                                  .sort()
      .filter(function (el, idx, arr) {
                                    return el !== arr[idx - 1];
                                  })
                                  .reverse();

  compile(this);
  return this;
};

/**
 * LinkifyIt#normalize(match)
 *
 * Default normalizer (if schema does not define it's own).
 **/
LinkifyIt.prototype.normalize = function normalize(match) {

  // Do minimal possible changes by default. Need to collect feedback prior
  // to move forward https://github.com/markdown-it/linkify-it/issues/1

  if (!match.schema) { match.url = 'http://' + match.url; }

  if (match.schema === 'mailto:' && !/^mailto:/i.test(match.url)) {
    match.url = 'mailto:' + match.url;
  }
};


module.exports = LinkifyIt;

},{"./lib/re":109}],109:[function(require,module,exports){
'use strict';

// Use direct extract instead of `regenerate` to reduse browserified size
var src_Any = exports.src_Any = require('uc.micro/properties/Any/regex').source;
var src_Cc  = exports.src_Cc = require('uc.micro/categories/Cc/regex').source;
var src_Z   = exports.src_Z  = require('uc.micro/categories/Z/regex').source;
var src_P   = exports.src_P  = require('uc.micro/categories/P/regex').source;

// \p{\Z\P\Cc\CF} (white spaces + control + format + punctuation)
var src_ZPCc = exports.src_ZPCc = [ src_Z, src_P, src_Cc ].join('|');

// \p{\Z\Cc} (white spaces + control)
var src_ZCc = exports.src_ZCc = [ src_Z, src_Cc ].join('|');

// All possible word characters (everything without punctuation, spaces & controls)
// Defined via punctuation & spaces to save space
// Should be something like \p{\L\N\S\M} (\w but without `_`)
var src_pseudo_letter       = '(?:(?!' + src_ZPCc + ')' + src_Any + ')';
// The same as abothe but without [0-9]
var src_pseudo_letter_non_d = '(?:(?![0-9]|' + src_ZPCc + ')' + src_Any + ')';

////////////////////////////////////////////////////////////////////////////////

var src_ip4 = exports.src_ip4 =

  '(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)';

exports.src_auth    = '(?:(?:(?!' + src_ZCc + ').)+@)?';

var src_port = exports.src_port =

  '(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?';

var src_host_terminator = exports.src_host_terminator =

  '(?=$|' + src_ZPCc + ')(?!-|_|:\\d|\\.-|\\.(?!$|' + src_ZPCc + '))';

var src_path = exports.src_path =

  '(?:' +
    '[/?#]' +
      '(?:' +
        '(?!' + src_ZCc + '|[()[\\]{}.,"\'?!\\-]).|' +
        '\\[(?:(?!' + src_ZCc + '|\\]).)*\\]|' +
        '\\((?:(?!' + src_ZCc + '|[)]).)*\\)|' +
        '\\{(?:(?!' + src_ZCc + '|[}]).)*\\}|' +
        '\\"(?:(?!' + src_ZCc + '|["]).)+\\"|' +
        "\\'(?:(?!" + src_ZCc + "|[']).)+\\'|" +
        "\\'(?=" + src_pseudo_letter + ').|' +  // allow `I'm_king` if no pair found
        '\\.{2,3}[a-zA-Z0-9%/]|' + // github has ... in commit range links. Restrict to
                                   // - english
                                   // - percent-encoded
                                   // - parts of file path
                                   // until more examples found.
        '\\.(?!' + src_ZCc + '|[.]).|' +
        '\\-(?!--(?:[^-]|$))(?:-*)|' +  // `---` => long dash, terminate
        '\\,(?!' + src_ZCc + ').|' +      // allow `,,,` in paths
        '\\!(?!' + src_ZCc + '|[!]).|' +
        '\\?(?!' + src_ZCc + '|[?]).' +
      ')+' +
    '|\\/' +
  ')?';

var src_email_name = exports.src_email_name =

  '[\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]+';

var src_xn = exports.src_xn =

  'xn--[a-z0-9\\-]{1,59}';

// More to read about domain names
// http://serverfault.com/questions/638260/

var src_domain_root = exports.src_domain_root =

  // Can't have digits and dashes
  '(?:' +
    src_xn +
    '|' +
    src_pseudo_letter_non_d + '{1,63}' +
  ')';

var src_domain = exports.src_domain =

  '(?:' +
    src_xn +
    '|' +
    '(?:' + src_pseudo_letter + ')' +
    '|' +
    // don't allow `--` in domain names, because:
    // - that can conflict with markdown &mdash; / &ndash;
    // - nobody use those anyway
    '(?:' + src_pseudo_letter + '(?:-(?!-)|' + src_pseudo_letter + '){0,61}' + src_pseudo_letter + ')' +
  ')';

var src_host = exports.src_host =

  '(?:' +
    src_ip4 +
  '|' +
    '(?:(?:(?:' + src_domain + ')\\.)*' + src_domain_root + ')' +
  ')';

var tpl_host_fuzzy = exports.tpl_host_fuzzy =

  '(?:' +
    src_ip4 +
  '|' +
    '(?:(?:(?:' + src_domain + ')\\.)+(?:%TLDS%))' +
  ')';

var tpl_host_no_ip_fuzzy = exports.tpl_host_no_ip_fuzzy =

  '(?:(?:(?:' + src_domain + ')\\.)+(?:%TLDS%))';

exports.src_host_strict =

  src_host + src_host_terminator;

var tpl_host_fuzzy_strict = exports.tpl_host_fuzzy_strict =

  tpl_host_fuzzy + src_host_terminator;

exports.src_host_port_strict =

  src_host + src_port + src_host_terminator;

var tpl_host_port_fuzzy_strict = exports.tpl_host_port_fuzzy_strict =

  tpl_host_fuzzy + src_port + src_host_terminator;

var tpl_host_port_no_ip_fuzzy_strict = exports.tpl_host_port_no_ip_fuzzy_strict =

  tpl_host_no_ip_fuzzy + src_port + src_host_terminator;


////////////////////////////////////////////////////////////////////////////////
// Main rules

// Rude test fuzzy links by host, for quick deny
exports.tpl_host_fuzzy_test =

  'localhost|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:' + src_ZPCc + '|$))';

exports.tpl_email_fuzzy =

    '(^|>|\\(|' + src_ZCc + ')(' + src_email_name + '@' + tpl_host_fuzzy_strict + ')';

exports.tpl_link_fuzzy =
    // Fuzzy link can't be prepended with .:/\- and non punctuation.
    // but can start with > (markdown blockquote)
    '(^|(?![.:/\\-_@])(?:[$+<=>^`|]|' + src_ZPCc + '))' +
    '((?![$+<=>^`|])' + tpl_host_port_fuzzy_strict + src_path + ')';

exports.tpl_link_no_ip_fuzzy =
    // Fuzzy link can't be prepended with .:/\- and non punctuation.
    // but can start with > (markdown blockquote)
    '(^|(?![.:/\\-_@])(?:[$+<=>^`|]|' + src_ZPCc + '))' +
    '((?![$+<=>^`|])' + tpl_host_port_no_ip_fuzzy_strict + src_path + ')';

},{"uc.micro/categories/Cc/regex":115,"uc.micro/categories/P/regex":117,"uc.micro/categories/Z/regex":118,"uc.micro/properties/Any/regex":120}],110:[function(require,module,exports){

'use strict';


/* eslint-disable no-bitwise */

var decodeCache = {};

function getDecodeCache(exclude) {
  var i, ch, cache = decodeCache[exclude];
  if (cache) { return cache; }

  cache = decodeCache[exclude] = [];

  for (i = 0; i < 128; i++) {
    ch = String.fromCharCode(i);
    cache.push(ch);
  }

  for (i = 0; i < exclude.length; i++) {
    ch = exclude.charCodeAt(i);
    cache[ch] = '%' + ('0' + ch.toString(16).toUpperCase()).slice(-2);
  }

  return cache;
}


// Decode percent-encoded string.
//
function decode(string, exclude) {
  var cache;

  if (typeof exclude !== 'string') {
    exclude = decode.defaultChars;
  }

  cache = getDecodeCache(exclude);

  return string.replace(/(%[a-f0-9]{2})+/gi, function(seq) {
    var i, l, b1, b2, b3, b4, chr,
        result = '';

    for (i = 0, l = seq.length; i < l; i += 3) {
      b1 = parseInt(seq.slice(i + 1, i + 3), 16);

      if (b1 < 0x80) {
        result += cache[b1];
        continue;
      }

      if ((b1 & 0xE0) === 0xC0 && (i + 3 < l)) {
        // 110xxxxx 10xxxxxx
        b2 = parseInt(seq.slice(i + 4, i + 6), 16);

        if ((b2 & 0xC0) === 0x80) {
          chr = ((b1 << 6) & 0x7C0) | (b2 & 0x3F);

          if (chr < 0x80) {
            result += '\ufffd\ufffd';
          } else {
            result += String.fromCharCode(chr);
          }

          i += 3;
          continue;
        }
      }

      if ((b1 & 0xF0) === 0xE0 && (i + 6 < l)) {
        // 1110xxxx 10xxxxxx 10xxxxxx
        b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        b3 = parseInt(seq.slice(i + 7, i + 9), 16);

        if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
          chr = ((b1 << 12) & 0xF000) | ((b2 << 6) & 0xFC0) | (b3 & 0x3F);

          if (chr < 0x800 || (chr >= 0xD800 && chr <= 0xDFFF)) {
            result += '\ufffd\ufffd\ufffd';
          } else {
            result += String.fromCharCode(chr);
          }

          i += 6;
          continue;
        }
      }

      if ((b1 & 0xF8) === 0xF0 && (i + 9 < l)) {
        // 111110xx 10xxxxxx 10xxxxxx 10xxxxxx
        b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        b4 = parseInt(seq.slice(i + 10, i + 12), 16);

        if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80 && (b4 & 0xC0) === 0x80) {
          chr = ((b1 << 18) & 0x1C0000) | ((b2 << 12) & 0x3F000) | ((b3 << 6) & 0xFC0) | (b4 & 0x3F);

          if (chr < 0x10000 || chr > 0x10FFFF) {
            result += '\ufffd\ufffd\ufffd\ufffd';
          } else {
            chr -= 0x10000;
            result += String.fromCharCode(0xD800 + (chr >> 10), 0xDC00 + (chr & 0x3FF));
          }

          i += 9;
          continue;
        }
      }

      result += '\ufffd';
    }

    return result;
  });
}


decode.defaultChars   = ';/?:@&=+$,#';
decode.componentChars = '';


module.exports = decode;

},{}],111:[function(require,module,exports){

'use strict';


var encodeCache = {};


// Create a lookup array where anything but characters in `chars` string
// and alphanumeric chars is percent-encoded.
//
function getEncodeCache(exclude) {
  var i, ch, cache = encodeCache[exclude];
  if (cache) { return cache; }

  cache = encodeCache[exclude] = [];

  for (i = 0; i < 128; i++) {
    ch = String.fromCharCode(i);

    if (/^[0-9a-z]$/i.test(ch)) {
      // always allow unencoded alphanumeric characters
      cache.push(ch);
    } else {
      cache.push('%' + ('0' + i.toString(16).toUpperCase()).slice(-2));
    }
  }

  for (i = 0; i < exclude.length; i++) {
    cache[exclude.charCodeAt(i)] = exclude[i];
  }

  return cache;
}


// Encode unsafe characters with percent-encoding, skipping already
// encoded sequences.
//
//  - string       - string to encode
//  - exclude      - list of characters to ignore (in addition to a-zA-Z0-9)
//  - keepEscaped  - don't encode '%' in a correct escape sequence (default: true)
//
function encode(string, exclude, keepEscaped) {
  var i, l, code, nextCode, cache,
      result = '';

  if (typeof exclude !== 'string') {
    // encode(string, keepEscaped)
    keepEscaped  = exclude;
    exclude = encode.defaultChars;
  }

  if (typeof keepEscaped === 'undefined') {
    keepEscaped = true;
  }

  cache = getEncodeCache(exclude);

  for (i = 0, l = string.length; i < l; i++) {
    code = string.charCodeAt(i);

    if (keepEscaped && code === 0x25 /* % */ && i + 2 < l) {
      if (/^[0-9a-f]{2}$/i.test(string.slice(i + 1, i + 3))) {
        result += string.slice(i, i + 3);
        i += 2;
        continue;
      }
    }

    if (code < 128) {
      result += cache[code];
      continue;
    }

    if (code >= 0xD800 && code <= 0xDFFF) {
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < l) {
        nextCode = string.charCodeAt(i + 1);
        if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
          result += encodeURIComponent(string[i] + string[i + 1]);
          i++;
          continue;
        }
      }
      result += '%EF%BF%BD';
      continue;
    }

    result += encodeURIComponent(string[i]);
  }

  return result;
}

encode.defaultChars   = ";/?:@&=+$,-_.!~*'()#";
encode.componentChars = "-_.!~*'()";


module.exports = encode;

},{}],112:[function(require,module,exports){

'use strict';


module.exports = function format(url) {
  var result = '';

  result += url.protocol || '';
  result += url.slashes ? '//' : '';
  result += url.auth ? url.auth + '@' : '';

  if (url.hostname && url.hostname.indexOf(':') !== -1) {
    // ipv6 address
    result += '[' + url.hostname + ']';
  } else {
    result += url.hostname || '';
  }

  result += url.port ? ':' + url.port : '';
  result += url.pathname || '';
  result += url.search || '';
  result += url.hash || '';

  return result;
};

},{}],113:[function(require,module,exports){
'use strict';


module.exports.encode = require('./encode');
module.exports.decode = require('./decode');
module.exports.format = require('./format');
module.exports.parse  = require('./parse');

},{"./decode":110,"./encode":111,"./format":112,"./parse":114}],114:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

//
// Changes from joyent/node:
//
// 1. No leading slash in paths,
//    e.g. in `url.parse('http://foo?bar')` pathname is ``, not `/`
//
// 2. Backslashes are not replaced with slashes,
//    so `http:\\example.org\` is treated like a relative path
//
// 3. Trailing colon is treated like a part of the path,
//    i.e. in `http://example.org:foo` pathname is `:foo`
//
// 4. Nothing is URL-encoded in the resulting object,
//    (in joyent/node some chars in auth and paths are encoded)
//
// 5. `url.parse()` does not have `parseQueryString` argument
//
// 6. Removed extraneous result properties: `host`, `path`, `query`, etc.,
//    which can be constructed using other parts of the url.
//


function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.pathname = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = [ '<', '>', '"', '`', ' ', '\r', '\n', '\t' ],

    // RFC 2396: characters not allowed for various reasons.
    unwise = [ '{', '}', '|', '\\', '^', '`' ].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = [ '\'' ].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = [ '%', '/', '?', ';', '#' ].concat(autoEscape),
    hostEndingChars = [ '/', '?', '#' ],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    /* eslint-disable no-script-url */
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    };
    /* eslint-enable no-script-url */

function urlParse(url, slashesDenoteHost) {
  if (url && url instanceof Url) { return url; }

  var u = new Url();
  u.parse(url, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, slashesDenoteHost) {
  var i, l, lowerProto, hec, slashes,
      rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    var simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
      }
      return this;
    }
  }

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    lowerProto = proto.toLowerCase();
    this.protocol = proto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (i = 0; i < hostEndingChars.length; i++) {
      hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = auth;
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (i = 0; i < nonHostChars.length; i++) {
      hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1) {
      hostEnd = rest.length;
    }

    if (rest[hostEnd - 1] === ':') { hostEnd--; }
    var host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost(host);

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) { continue; }
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    }

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
    }
  }

  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    rest = rest.slice(0, qm);
  }
  if (rest) { this.pathname = rest; }
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '';
  }

  return this;
};

Url.prototype.parseHost = function(host) {
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) { this.hostname = host; }
};

module.exports = urlParse;

},{}],115:[function(require,module,exports){
module.exports=/[\0-\x1F\x7F-\x9F]/
},{}],116:[function(require,module,exports){
module.exports=/[\xAD\u0600-\u0605\u061C\u06DD\u070F\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804\uDCBD|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/
},{}],117:[function(require,module,exports){
module.exports=/[!-#%-\*,-/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E42\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDE38-\uDE3D]|\uD805[\uDCC6\uDDC1-\uDDC9\uDE41-\uDE43]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD82F\uDC9F/
},{}],118:[function(require,module,exports){
module.exports=/[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/
},{}],119:[function(require,module,exports){

module.exports.Any = require('./properties/Any/regex');
module.exports.Cc  = require('./categories/Cc/regex');
module.exports.Cf  = require('./categories/Cf/regex');
module.exports.P   = require('./categories/P/regex');
module.exports.Z   = require('./categories/Z/regex');

},{"./categories/Cc/regex":115,"./categories/Cf/regex":116,"./categories/P/regex":117,"./categories/Z/regex":118,"./properties/Any/regex":120}],120:[function(require,module,exports){
module.exports=/[\0-\uD7FF\uDC00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF]/
},{}],121:[function(require,module,exports){
window.ProseMirror = require("prosemirror/dist/edit").ProseMirror
require("prosemirror/dist/menu/menubar") // Load menubar module
require( "prosemirror/dist/markdown/to_markdown" )
require( "prosemirror/dist/markdown/from_markdown" )
window.ProseMirrorUtils = {};
window.ProseMirrorUtils.defaultschema = require( "prosemirror/dist/model/defaultschema")
window.ProseMirrorUtils.schema = require( "prosemirror/dist/model/schema")
window.ProseMirrorUtils.commandSet = require( "prosemirror/dist/edit/command").CommandSet
window.ProseMirrorUtils.menu = require ( "prosemirror/dist/menu/menu" )


},{"prosemirror/dist/edit":11,"prosemirror/dist/edit/command":5,"prosemirror/dist/markdown/from_markdown":25,"prosemirror/dist/markdown/to_markdown":26,"prosemirror/dist/menu/menu":28,"prosemirror/dist/menu/menubar":29,"prosemirror/dist/model/defaultschema":30,"prosemirror/dist/model/schema":38}],122:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.3.2 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.3.2',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[121]);
