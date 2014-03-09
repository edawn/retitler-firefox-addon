Components.utils.import("chrome://retitler/content/modules/retitler_shared.js");

var retitler = {};

retitler.lib = {};
Components.utils.import("chrome://retitler/content/modules/retitler_library.js", retitler.lib);

retitler.cl = {}; // exported symbols not needed in here; import() just to initialise the module at startup
Components.utils.import("chrome://retitler/content/modules/retitler_contentlistener.js", retitler.cl);

//TODO uncomment ...
//retitler.r2 = {};
//Components.utils.import("chrome://retitler/content/modules/rule2.js", retitler.r2);

retitler.ruleSet = retitler_shared.ruleSet;

retitler.titleChangeEventHandler = function (e){ // title change event occured
    var doc = e.target;

    if (doc.tceCounter > 0){ // we have just caused a title change event -> ignore
        doc.tceCounter--;
        return;
    }
    doc.tceCounter = 0;

    var win = doc.defaultView;
    var beenhere = win.beenhere;
    var isInternal = arguments.length > 1 ? arguments[1] : false;
    if ((!isInternal && beenhere) || !doc.originalTitle) doc.originalTitle = doc.title;

    var original = doc.originalTitle ? doc.originalTitle : doc.title;
    var title = !isInternal && beenhere ? doc.title : original;
    
    win.beenhere = true;
    var url = doc.location;
    if (url == null) return;
    url = url.toString();

    var res = retitler.ruleSet.applyRules(url, title);
    // var res2 = retitler.r2.rtt.apply(url, res.title);
    // title = res2.title;
    doc.URLmatched = res.matchCount; //+ res2.matchCount;  // indicates how many url-regexps matched the url of the document

    if (res.title == doc.title) {
		// only update icon if title change happened in currently selected tab
		if (doc === gBrowser.selectedBrowser.contentDocument) retitler.sbIcon.update();
		return;
	}
    doc.tceCounter++;
    doc.title = res.title;
    if (doc === gBrowser.selectedBrowser.contentDocument) retitler.sbIcon.update();
}

retitler.ruleChangeListener = function() {
    retitler.ruleSet = retitler_shared.ruleSet;
    var bro = gBrowser.browsers;
    for (var i = 0; i < bro.length; i++){	// for every open tab ...
        var e = {target: bro[i].contentDocument};
        retitler.titleChangeEventHandler(e, true);	// ... simulate a title change event
    }
}

retitler.generate = function(){
    var rules = retitler.lib.getSimirules();
    // only append rules that aren't yet in the ruleset?
    if (!retitler_shared.baseBranch.getBoolPref("createDuplicateRules"))
        rules = rules.filter(function(v) {return !retitler.ruleSet.storage.some(
                            function(w) {return w.equals(v, false);});});
    retitler_shared.latelyGenerated = retitler_shared.latelyGenerated.concat(rules);
    retitler_shared.ruleSet.append(rules);
    retitler_shared.toStorage();
}

window.addEventListener("load", function() {
    retitler.firstRun();
    retitler.tabs.init();
    retitler.sbIcon.init();
    retitler.sbTooltip.init();

    var rtmi = window.document.getElementById("retitler-tools-menu-item");
    rtmi.label = retitler.lib.selfInfo.name;
    rtmi.collapsed = !retitler_shared.baseBranch.getBoolPref("showMenuBarItem");

    gBrowser.parentNode.addEventListener("DOMTitleChanged", retitler.titleChangeEventHandler, true);
}, false);

retitler_shared.addRuleChangeListener(retitler.ruleChangeListener);

// not sure if any of this (with the exception of the ruleChangeListener) is really necessary,
// as the window is about to being destroyed at this point ...
// in which case there would not be much left that could send (or receive) events ...
window.addEventListener("unload", function() {
    gBrowser.parentNode.removeEventListener("DOMTitleChanged", retitler.titleChangeEventHandler, true);
    retitler_shared.removeRuleChangeListener(retitler.ruleChangeListener);
    retitler.sbTooltip.unload();
    retitler.sbIcon.unload();
    retitler.tabs.unload();
}, false);


