// this is supposed to set currentTab to the currently selected tab of the foremost window 
function updateCurrentTab(e){
	var nowSelected = mostRecentWindow.getBrowser().selectedBrowser;
	treeView.currentTab = nowSelected;
	treeView.refresh();
	treeView.treebox.beginUpdateBatch();
	treeView.treebox.endUpdateBatch();
}	

// will be set at init (opening of retitler preferences); this may cause problems with multiple/new windows
var mostRecentWindow;

function initTabListener(){
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Components.interfaces.nsIWindowMediator);
	mostRecentWindow = wm.getMostRecentWindow("navigator:browser");

	mostRecentWindow.getBrowser().tabContainer.addEventListener("TabSelect", updateCurrentTab, false);
	mostRecentWindow.getBrowser().addEventListener("load", updateCurrentTab, true);
	
	treeView.currentTab = mostRecentWindow.getBrowser().selectedBrowser;
}

function unloadTabListener(){
	try {
		mostRecentWindow.getBrowser().tabContainer.removeEventListener("TabSelect", updateCurrentTab, false);
		mostRecentWindow.getBrowser().removeEventListener("load", updateCurrentTab, true);
	} catch (e) {}	// wnd has probably been closed before ... not that important
}
