Components.utils.import("chrome://retitler/content/modules/retitler_shared.js");
Components.utils.import("chrome://retitler/content/modules/retitler_contentlistener.js");
Components.utils.import("chrome://retitler/content/modules/retitler_library.js");

const MVDN = 1, MVUP = -1;
var treecmEvent = undefined;
var tree, treeBox;
var baseBranch = retitler_shared.baseBranch;

//will be used by treeview for coloring the rows of the rules that matched
var currentTab = null;

function testtreetooltip(e){
	var row = {}, col = {}, child = {};
	treeBox.getCellAt(e.clientX, e.clientY, row, col, child);
	var storage = retitler_shared.ruleSet.storage;
	if (col.value != null && row.value >= 0 && row.value < storage.length && !storage[row.value].isValid) {
		if (col.value.id == "url" && "name" in storage[row.value]["urlRegExp"])
			e.target.setAttribute("tooltiptext", storage[row.value]["urlRegExp"].toString());
		else if	(col.value.id == "match" && "name" in storage[row.value]["matchRegExp"])
			e.target.setAttribute("tooltiptext", storage[row.value]["matchRegExp"].toString());
		else e.target.setAttribute("tooltiptext", "");
	} else e.target.setAttribute("tooltiptext", "");
}

function moveSelected(direction){	// direction < 0 (> 0) -> move up (down)
	if (direction == 0) return;
	var selection = treeView.selection;
	var storage = retitler_shared.ruleSet.storage;
	var index = direction < 0 ? function(i) { return i; } : function(i) { return storage.length - 1 - i; };
	var last = 0;
	for (var i = 0; i < storage.length; i++){
		if (!selection.isSelected(index(i)) && selection.isSelected(index(i+1))){
			selection.toggleSelect(index(i));
			selection.toggleSelect(index(i+1))
			var swap = storage[index(i)];
			storage[index(i)] = storage[index(i+1)];
			storage[index(i+1)] = swap;
		}
	}
	retitler_shared.ruleSet.storage = storage;

}

function help(){
	if (baseBranch.getPrefType("helpURL") != baseBranch.PREF_STRING) return;
	var url = baseBranch.getCharPref("helpURL");
	var win = Components.classes["@mozilla.org/appshell/window-mediator;1"].
		getService(Components.interfaces.nsIWindowMediator).
		getMostRecentWindow("navigator:browser");
	if (win != null) {
		win.getBrowser().addTab(url);
	} else {
		window.open(url, "null");
	}
}


function apply(){
	retitler_shared.toStorage();
}

function okay(){
	apply();
	close();
}

function appendRule(){
	retitler_shared.ruleSet.push(new Rule());
}
function delRules(e){
	var selection = treeView.selection;
	retitler_shared.ruleSet.filter(function(e, i, a) { return !selection.isSelected(i);});
}
function undoRules(){
	retitler_shared.undoRules();
}
function restoreRules(){
	retitler_shared.restoreRules();
}

function appendExactRule(){
	var rule = createExactMatchRule();
	if (rule != null) retitler_shared.ruleSet.push(rule);
}

function generate(){
	var rules = getSimirules();
	retitler_shared.latelyGenerated = retitler_shared.latelyGenerated.concat(rules);
	retitler_shared.ruleSet.append(rules);
}

function treecmShowingHandler(e){
	treecmEvent = e;
}

function treecmNewRule(){
	var row = treeBox.getRowAt(treecmEvent.clientX, treecmEvent.clientY);
	var pos = row < 0 ? retitler_shared.ruleSet.length : row;
	retitler_shared.ruleSet.insertAt(new Rule(), pos);
	treeView.selection.clearSelection();
	treeView.selection.toggleSelect(pos);
}

function treecmCopy(){
	var selection = treeView.selection;
	var selectedRules = retitler_shared.ruleSet.storage.filter(function(e, i, a) { return selection.isSelected(i);});
	var generatedURI = sOutFilter(selectedRules);
	var clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].
		getService(Components.interfaces.nsIClipboardHelper);
	clipboardHelper.copyString(generatedURI);
}

function treecmPaste(){	// http://developer.mozilla.org/en/docs/Using_the_Clipboard
	var clip = Components.classes["@mozilla.org/widget/clipboard;1"].getService(Components.interfaces.nsIClipboard);
	if (!clip) return false;
	var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);
	if (!trans) return false;
	trans.addDataFlavor("text/unicode");
	clip.getData(trans, clip.kGlobalClipboard);
	var str = new Object();
	var strLength = new Object();
	trans.getTransferData("text/unicode", str, strLength);
	if (str) str = str.value.QueryInterface(Components.interfaces.nsISupportsString); else return;
	if (str) str = str.data.substring(0, strLength.value / 2); else return;
	str = /^data:application\/retitler,(.*)$/.exec(str);
	if (str == null || str[1] == undefined) return;
	appendSimpleRules(sInFilter(str[1]));	
}

var startDragY = undefined;
function treeMouseDownTest(e){
	var row = treeBox.getRowAt(e.clientX, e.clientY);
	if (row != -1 /*treeView.selection.isSelected(row)*/) startDragY = e.screenY;
}
function treeMouseUpTest(e){ startDragY = undefined; }
function treeMouseMoveTest(e){
	if (startDragY == undefined) testtreetooltip(e);
	else {
		var rowHeight = treeBox.rowHeight;
		var dY = e.screenY - startDragY;
		var tick = Math.round(dY/rowHeight);	// usually -1 || 1
		if (tick != 0) {
			startDragY = startDragY + tick*rowHeight;
			moveSelected(tick);
		}
	}
}

function setCloseButtons(e){
	var prefs = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService)
			.getBranch("browser.tabs.closeButtons");
	prefs.setIntPref("", e.target.value);
}

function setTabWidth(e){
	baseBranch.setBoolPref("tabs.adjustWidth", e.target.checked);
}

function setMinTabWidth(e){
	baseBranch.setIntPref("tabs.minWidth", e.target.valueNumber);
}

function setMaxTabWidth(e){
	baseBranch.setIntPref("tabs.maxWidth", e.target.valueNumber);
}

function init() {
	tree = $("ruletree");
	tree.view = treeView;
	treeBox = tree.treeBoxObject;
	
	function makeTreeRCL(tView) {
		return function listener(){
			tView.refresh();
			tView.treebox.beginUpdateBatch();
			tView.treebox.endUpdateBatch();
		}
	}
	var treeRCL = makeTreeRCL(treeView);
	retitler_shared.addRuleChangeListener(treeRCL);
	window.addEventListener("unload", function() {
		retitler_shared.removeRuleChangeListener(treeRCL);
		retitler_shared.latelyGenerated = [];
		unloadTabListener();
	}, false);
	
	$("xombi").addEventListener("command", function(e){ 
			baseBranch.setBoolPref("showMenuBarItem", e.target.checked);
	}, false);
	$("xombi").checked = baseBranch.getBoolPref("showMenuBarItem");

	$("exoptsicon").addEventListener("command", function(e){ 
			baseBranch.setCharPref("showStatusBarIcon", e.target.value);
	}, false);
	
	if (baseBranch.getPrefType("showStatusBarIcon") == baseBranch.PREF_STRING) {
		var selected = baseBranch.getCharPref("showStatusBarIcon");
		var menuitems = $("exoptsicon").getElementsByTagName("menuitem");
		for (var i = 0; i < menuitems.length; i++){
			if (menuitems[i].getAttribute("value") == selected) {
				$("exoptsicon").parentNode.selectedIndex = i;	
				break;
			}
		}
	}

	var tcb = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService)
		.getBranch("browser.tabs.closeButtons").getIntPref("");
	$("exoptsclose").selectedIndex = Math.min(2, tcb);

	$("xowcb").checked = baseBranch.getBoolPref("tabs.adjustWidth");
	$("xowmin").value = baseBranch.getIntPref("tabs.minWidth");
	$("xowmax").value = baseBranch.getIntPref("tabs.maxWidth");
	

	$("xodupgen").addEventListener("command", function(e){
		baseBranch.setBoolPref("createDuplicateRules", e.target.checked);
	}, false);
	$("xodupgen").checked = baseBranch.getBoolPref("createDuplicateRules");
}

window.addEventListener("load", init, false);

