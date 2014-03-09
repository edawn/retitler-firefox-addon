Components.utils.import("chrome://retitler/content/modules/retitler_shared.js");

var treeView = {
	ruleSet: undefined,
	rules: [],
	matchingRules: [],
	errorAtom: getAtom("error"),
	matchedAtom: getAtom("matched"),
	newAtom: getAtom("new"),

	currentTab: null,
	refresh: function() {
		this.rules = retitler_shared.ruleSet.storage;
		this.matchingRules = retitler_shared.ruleSet.getMatchingRules(this.currentTab.contentDocument);
	},

	get rowCount() { return this.rules.length; },
	getCellText: function(row,col){
		return this.rules[row][col.id];
	},
	getCellValue: function(row,col){
		return this.rules[row][col.id];
	},
	setTree: function(treebox){ this.treebox = treebox; },
	setCellText: function(row, col, text){
		this.rules[row][col.id] = text;
	},
	setCellValue: function(row, col, text){
		this.rules[row][col.id] = text == "true" ? true : false;
	},
	isEditable: function(row, col){ return true;},
	isContainer: function(row){ return false; },
	isSeparator: function(row){ return false; },
	isSorted: function(){ return false; },
	getLevel: function(row){ return 0; },
	getImageSrc: function(row,col){ return null; },
	getRowProperties: function(row,props){
		if (retitler_shared.latelyGenerated.indexOf(this.rules[row]) != -1)
			props.AppendElement(this.newAtom);
	},
	getColumnProperties: function(colid,col,props){},
	getCellProperties: function(row, col, props){
		if (!this.rules[row].isValid) {
			if (col.id == "url" && "name" in this.rules[row]["urlRegExp"] ||
			col.id == "match" && "name" in this.rules[row]["matchRegExp"])	// 'instanceof Error'
				props.AppendElement(this.errorAtom);
		}
		var matching = undefined;
		for (var i = this.matchingRules.length-1; i >= 0; i--) {
			if (this.matchingRules[i].rule === this.rules[row]){
				matching = this.matchingRules[i];
				break;
			}
		}
		if (matching !== undefined) {
			if (col.id == "url") props.AppendElement(this.matchedAtom);
			else if (col.id == "match" && matching.onTitle)
				props.AppendElement(this.matchedAtom);
			else if (col.id == "replace" && matching.changedTitle)
				props.AppendElement(this.matchedAtom);
		}
	}
};

initTabListener();
treeView.refresh();

