// DOM library / common shortcuts / only makes sense in the context of some window

var doc = window.document;

function $(id){ return doc.getElementById(id); }

function getAtom(name){ return Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService).getAtom(name); }
