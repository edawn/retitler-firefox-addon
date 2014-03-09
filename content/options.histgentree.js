var hgTreeView = {
	places: [],
	linearTree: [],
	get rowCount() { return this.linearTree.length; },
	getCellText : function(row,column){
		var a = this.linearTree[row];
		if (a.level == 0) {	// places
			if (column.id == "title") return a.title;
			if (column.id == "url") return "visits: " + a.accessCount + " distinct titles: " + a.childCount + (a.isReverse ? " R" : "");
			else return "";
		}
		var rsuf = " ";
		if ("probs" in a) rsuf += a.probs.a.toString().substr(0,3) +"/"+a.probs.b.toString().substr(0,3)+"  "
					+a.probs.fa.toString().substr(0,3)+"/"+a.probs.fb.toString().substr(0,3);
		if (column.id == "title") return a.container ? a.subprefix.join(" ")+rsuf : a.suffix.join(" ");
		if (column.id == "url") return a.container ? a.sccs.length+"/"+a.finishednodes.length+"/"+a.nodes.length
								: a.url[0] + " (" + a.url.length + ")";

	},
	setTree: function(treebox){ this.treebox = treebox; },
	isContainer: function(row){ return this.linearTree[row].container; },
	isContainerEmpty: function(row){ return false;},
	isContainerOpen: function(row){ return this.linearTree[row].open; },
	isSeparator: function(row){ return false; },
	isSorted: function(){ return false; },
	getLevel: function(row){ return this.linearTree[row].level; },
	getImageSrc: function(row,col){ return null; },
	getRowProperties: function(row,props){
		var node = this.linearTree[row];
		if (node.isRule === true) props.AppendElement(this.isruleAtom);
		if (node.containsRuleChild === true) props.AppendElement(this.rulebelowAtom);
	},
	getCellProperties: function(row,col,props){},
	getColumnProperties: function(colid,col,props){},
	hasNextSibling: function(row, afterIndex) {
		var a = this.linearTree[row];
		var b = this.linearTree[afterIndex];
		if (a.parent == b.parent && b.nextSib != null) return true;
		return false;
	},
	getParentIndex: function(row){
		if (this.linearTree[row].parent == null) return -1;
		return this.linearTree[row].parent.index;
	},
	toggleOpenState: function(row){
		var a = this.linearTree[row];
		a.open = !(a.open);
		this.makeLinearTree();
		this.treebox.beginUpdateBatch();
		this.treebox.endUpdateBatch();
	},
	makeLinearTree: function(){
		this.linearTree = new Array();
		var appendbelow = function (scc, arr){
			var sum = 0;
			scc.sccs.forEach(function(v, i, a){
				v.index = arr.length;
				arr.push(v);
				sum++;
				if (v.open) sum += appendbelow(v, arr);
			});
			arr.push.apply(arr, scc.finishednodes);	// 'append' the array scc.finishednodes
			sum += scc.finishednodes.length;
			
			scc.countbelow = sum;
			return sum;
		};
					
		var prevsum = 0
		for (var i = 0; i < this.places.length; i++){
			this.places[i].index = i > 0 ? (this.places[i-1].index+prevsum+1) : 0;
			this.linearTree.push(this.places[i]);
			prevsum = this.places[i].open ? appendbelow(this.places[i], this.linearTree) : 0;
		}
	},

	initWith: function(places){
		this.places = places;
		places.forEach(function(v, i, a){
			var prevsib = i > 0 ? a[i-1] : null;
			var nextsib = i < (a.length-1) ? a[i+1] : null;
			this.prepareForTreeView(v, 0, prevsib, nextsib);
		}, this);
		this.makeLinearTree();
	},

	// this extends the nodes to contain some useful information for the treeview
	prepareForTreeView: function(scc, level, prevsib, nextsib){
		scc.level = level;
		scc.container = true;
		scc.open = false;
		scc.prevSib = prevsib;
		scc.nextSib = nextsib;
		scc.sccs.forEach(function(v, i, a) {
			var prevSib = i > 0 ? a[i-1] : null;
			var nextSib = i < (a.length-1) ? a[i+1] : ( (v.parent != null && v.parent.finishednodes.length > 0) ? v.parent.finishednodes[0] : null);
			this.prepareForTreeView(v, level+1, prevSib, nextSib);
		}, this);
		scc.finishednodes.forEach(function(v, i, a) {
			v.level = level+1;
			v.container = false;
			v.open = false;
			v.prevSib = i > 0 ? a[i-1] : ( (v.parent != null && v.parent.sccs.length > 0) ? v.parent.sccs[v.parent.sccs.length-1] : null);
			v.nextSib = i < (a.length-1) ? a[i+1] : null;
		});
	}

}
hgTreeView.isruleAtom = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService).getAtom("isrule");
hgTreeView.rulebelowAtom = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService).getAtom("rulebelow");


function hgTree(treeElement) {
	if (hgGenerated == null || treeElement.hidden) return
	hgTreeView.initWith(hgGenerated[0]);
	treeElement.view = hgTreeView;
}

