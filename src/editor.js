window.ProseMirror = require("prosemirror/dist/edit").ProseMirror
require("prosemirror/dist/menu/menubar") // Load menubar module
require( "prosemirror/dist/parse/markdown" )
require( "prosemirror/dist/serialize/markdown" )
window.ProseMirrorUtils = {};
window.ProseMirrorUtils.Schema = require( "prosemirror/dist/model").Schema
window.ProseMirrorUtils.defaultSchema = require( "prosemirror/dist/model").defaultSchema
//var editor = new ProseMirror({
//    place: document.body,
//    menuBar: true
//})



