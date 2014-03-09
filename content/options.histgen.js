// maxAge: only consider hosts/places visited in the last maxAge days
// maxAgems: maxAge in milliseconds; read-only
// minDistinctTitles: hosts/places with less than minDistinctTitles distinct titles will be discarded
//TODO make it work again;
var hgSettings = { maxAge: 30, get maxAgems() { return Date.now() - hgSettings.maxAge*24*60*60*1000; }, minDistinctTitles: 5 };
var hgGenerated = null;

// will be called by the 'take over' button
function hgSelected2Ruleset(listbox){
	var selected = listbox.selectedItems;
	var relib = {}, resha = {};
	Components.utils.import("chrome://retitler/content/modules/retitler_shared.js", resha);
	Components.utils.import("chrome://retitler/content/modules/retitler_library.js", relib);
	var ruleArray = [];

	selected.forEach(function(v) {
		var sRule = new relib.simpleRule();
		sRule.url = "^https?://" + v.scc.topAncestor.title;	//assume only http(s)-served pages are relevant
		var toberule = v.scc.prefix.slice(0);
		toberule.forEach(function(v, i, a) { a[i] = regClean(v); }, this);
		toberule.push("(.+)");
		if (v.scc.topAncestor.isReverse) toberule.reverse();
		sRule.match = toberule.join("\\s+");
		sRule.replace = "$1";

		ruleArray.push(new relib.Rule(sRule));
	});
	resha.retitler_shared.ruleSet.append(ruleArray);
}

// will be called by the '(re)generate' button
function hgFill(listbox){
	hgGenerated = hgGenerate();
	var rules2b = hgGenerated[1];
	// sort by visit count of the domain/host
	rules2b.sort(function(a,b){ return a.topAncestor.accessCount-b.topAncestor.accessCount; });

	while (listbox.itemCount > 0) listbox.removeItemAt(0);
	while (rules2b.length > 0){
		var scc = rules2b.pop();
		var toberule = scc.prefix.slice(0);
		toberule.push("...");
		if (scc.topAncestor.isReverse) toberule.reverse();
		
		var item = doc.createElement("listitem");
		var dCell = doc.createElement("listcell");
		var tCell = doc.createElement("listcell");
		
		dCell.setAttribute("label", scc.topAncestor.title);
		item.appendChild(dCell);
		
		tCell.setAttribute("label", toberule.join(" "));
		item.appendChild(tCell);

		item.tooltipText = "host: visits: " + scc.topAncestor.accessCount + " distinct titles: " + scc.topAncestor.childCount +
			" distinct titles with this prefix/suffix: " + scc.nodes.length +
			" calculated probabilities: " + scc.probs.a.toString().substr(0, 4) + "/"+ scc.probs.b.toString().substr(0, 4) +
			" "+ scc.probs.fa.toString().substr(0, 4) + "/"+ scc.probs.fb.toString().substr(0, 4);
		item.scc = scc;

		/* set the 'oddness' for styling */
		if (listbox.itemCount % 2 == 1) item.setAttribute("odd", "true");

		listbox.appendChild(item);

	}
}


function hgGenerate() {
	var places = Array();
	var rules2b = Array();

	var historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"].getService(Components.interfaces.nsINavHistoryService);
	
	var options = historyService.getNewQueryOptions();
	options.resultType = options.RESULTS_AS_SITE_QUERY;
	options.expandQueries = true;
	var query = historyService.getNewQuery();
	
	var result = historyService.executeQuery(query, options);
	var placesContainer = result.root;
	placesContainer.containerOpen = true;

	for (var i = 0; i < placesContainer.childCount; i++){
		var node = placesContainer.getChild(i);
		node.QueryInterface(Components.interfaces.nsINavHistoryQueryResultNode);
		node.containerOpen = true;

		// filter irrelevant places
		if (!(node.childCount < hgSettings.minDistinctTitles) && !(node.time/1000 < hgSettings.maxAgems)){
//Components.utils.reportError("processing: " + node.title + "; "+ node.accessCount + " visits on " + node.childCount + " distinct urls");

			var topSCC = hgMakeSCC(node, false);
			if (topSCC.nodes.length < hgSettings.minDistinctTitles) continue;
			if (topSCC.sccs.length > 0) places.push(topSCC);	// skip if no common prefix
			rules2b.push.apply(rules2b, hgExtractRules(topSCC));	//'append'

			// reverse
			var topSCC = hgMakeSCC(node, true);
			if (topSCC.sccs.length > 0) places.push(topSCC);
			rules2b.push.apply(rules2b, hgExtractRules(topSCC));
		}
		node.containerOpen = false;
	}
	placesContainer.containerOpen = false;

	return [places, rules2b];
}

function hgMakeSCC(container, reverse){	// container: nsINavHistoryQueryResultNode containing nsINavHistoryResultNodes; must not be empty
	var nodes = new Array();
	for (var i = 0; i < container.childCount; i++){
		var onode = container.getChild(i);
		var title = onode.title;
		var node = {
			prefix: [],
			suffix: title.split(/\s+/),
			title: title,	// original title
			url: [onode.uri],
			toString: function(){ return this.prefix.join(" ")+this.suffix.join(" "); }
		};
		if (reverse) node.suffix.reverse();
		nodes.push(node);
	}

	nodes = hgGroupByTitle(nodes);
//Components.utils.reportError("grouping: urls: " + container.childCount + " -> " + nodes.length);
	
	var scc = new hgSCC(nodes, null);
	scc.title = container.title;	// the hostname
	scc.accessCount = container.accessCount;   // number of visits
	scc.childCount = nodes.length;	// nr. of distinct titles
	scc.isReverse = reverse;
	return scc;
}

function hgGroupByTitle(nodes){	// nodes of same title become one node (with multiple urls)
	nodes.sort();
	var newnodes = new Array();
	newnodes.push(nodes[0]);
	var nlen = nodes.length-1;

	for (var i = 0; i < nlen; i++) {
		if (nodes[i].suffix.join(" ") == nodes[i+1].suffix.join(" "))
			newnodes[newnodes.length-1].url.push(nodes[i+1].url[0]);
		else newnodes.push(nodes[i+1]);
	}
	
	return newnodes;
}

// SCC probably isn't the best description for this structure; sth. like 'subprefixGroup' might fit better ...
function hgSCC (nodes, parent) { // nodes: array of nodes; must not be empty
	this.nodes = nodes;
	this.parent = parent;
	this.prefix = nodes[0].prefix.slice(0);	// the whole prefix chain for this scc
	// the subprefix of this scc (i.e. the difference between this scc and its parent); same for all nodes
	this.subprefix = [this.prefix[this.prefix.length-1]]; 
	this.finishednodes = new Array();
	// at first this is an array of arrays of nodes; in the recursive step it will be transformed into an array of SCC objects
	this.sccs = new Array();
	this.sccprefixes = new Array();	// sccs.length == sccprefixes.length; this should always hold true

	if (nodes.length == 1) { // don't split any further if scc consists of only one element
		this.finishednodes.push(nodes[0]);
		return;
	}
	for (var i = nodes.length-1; i >= 0; i--){	// direct nodes to the corresponding (sub-)classes
		var node = nodes[i];
		if (node.suffix.length == 0) {
			this.finishednodes.push(node);
		} else {
			var spref = node.suffix.shift();
			node.prefix.push(spref);
			var scci = this.sccprefixes.indexOf(spref);
			if (scci == -1) {	// no scc with this prefix exists yet: add new one
				this.sccs.push([node]);
				this.sccprefixes.push(spref);
			}
			else this.sccs[scci].push(node);
		}
	}
	if (this.sccs.length == 1 && this.finishednodes.length == 0) {	// special case if sccs[0] contains all the elements in this.nodes
		var tmpScc = new hgSCC(this.sccs[0], this);
		this.prefix.push.apply(this.prefix, tmpScc.subprefix);
		this.subprefix.push.apply(this.subprefix, tmpScc.subprefix);
		this.finishednodes = tmpScc.finishednodes;
		this.sccs = tmpScc.sccs;
		this.sccs.forEach(function(v){v.parent = this;}, this);
		this.sccprefixes = tmpScc.sccprefixes;
		return;
	}
	this.sccs.forEach(function(v, i, a) { a[i] = new hgSCC(v, this); }, this); // recursive step
	
	// clean up; i.e. 'pull-up' elements from sub-SCCs not containing any diverse elements (i.e. only one)
	for (var i = this.sccs.length - 1; i >= 0; i--){
		var subscc = this.sccs[i];	
		if (subscc.sccs.length == 0 && subscc.finishednodes.length == 1) {
			var fn = subscc.finishednodes[0];
			fn.suffix.unshift(fn.prefix.pop());
			this.finishednodes.push(fn)
			this.sccs.splice(i, 1);
		}
	}
}


function hgExtractRules(topSCC){	// tries to find the 'best' common prefix(es) that are supposed to become rules ...
	var chosenOnes = [];
	var candidates = [topSCC];
	while (candidates.length > 0) {
		var scc = candidates.pop();
		var mean = scc.nodes.length / (scc.sccs.length+1);
		var becomeRule = true;
		for (var i = 0; i < scc.sccs.length; i++) {
			var subscc = scc.sccs[i];
			var sslen = subscc.nodes.length;
			if (sslen < 4 ) continue;	// subscc too small -> no significance
			var a = 0.33 * sslen/mean;
			var b = 2.5 * sslen/scc.nodes.length;
			subscc.probs = { a: a, b: b, fa: "-", fb: "-"};
			if ((a > 1 && b > 0.1) || b > 1) {
				becomeRule = false;
				subscc.hasSub = true;
				candidates.push(subscc);
			}
		}
		
		if (scc == topSCC) continue;

		var fragm = scc.sccs.length + scc.finishednodes.length;
		scc.probs.fa = 0.33 * fragm/mean;
		scc.probs.fb = 2.5 * fragm/scc.nodes.length;
		
		if (scc.probs.fa > 1 || scc.probs.fb > 1 || becomeRule) {
			chosenOnes.push(scc);
			var toberule = scc.prefix.slice(0);
			toberule.push("...");
			if (topSCC.isReverse) toberule.reverse();
//Components.utils.reportError(toberule.join(" "));
	
			// setting some additional properties for tree styling ...
			scc.isRule = true;
			scc.topAncestor = topSCC;
			var parent = scc.parent;
			while (parent != null) {
				parent.containsRuleChild = true;
				parent = parent.parent;
			}
		}
	}
	return chosenOnes;
}


