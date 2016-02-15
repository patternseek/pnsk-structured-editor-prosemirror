window.ProseMirror = require("prosemirror/dist/edit").ProseMirror
require("prosemirror/dist/menu/menubar") // Load menubar module
require( "prosemirror/dist/markdown/to_markdown" )
require( "prosemirror/dist/markdown/from_markdown" )
window.ProseMirrorUtils = {};
window.ProseMirrorUtils.defaultschema = require( "prosemirror/dist/model/defaultschema")
window.ProseMirrorUtils.schema = require( "prosemirror/dist/model/schema")
window.ProseMirrorUtils.commandSet = require( "prosemirror/dist/edit/command").CommandSet
window.ProseMirrorUtils.menu = require ( "prosemirror/dist/menu/menu" )

