// this is responsible for adjusting tab width and flex
//TODO remove unnecessary stuff

retitler.tabs = {
	init: function(){
		this.pref = retitler_shared.getPrefBranch("tabs.");
		this.tabSettings.update();
		Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService)
			.addObserver(this, "sessionstore-windows-restored", false);
		gBrowser.tabContainer.addEventListener("TabOpen", function(event) {retitler.tabs.adjustTab(event.originalTarget);}, false);
		this.adjustAllTabs();
		this.pref.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.pref.addObserver("", this, false);
	},
	unload: function(){
		if (!this.pref) return;
		this.pref.removeObserver("", this);
		Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService)
			.removeObserver(this, "sessionstore-windows-restored");
	},
	observe: function(aSubject, aTopic, aData){
		if (aTopic != "nsPref:changed" && aTopic != "sessionstore-windows-restored") return;
		this.tabSettings.update();
		this.adjustAllTabs();
	},
	adjustAllTabs: function(){
		var cleanUp = !this.tabSettings.adjustWidth && this.tabSettings.adjustWidthWasTrue;
		if (!this.tabSettings.adjustWidth && !cleanUp) return;
		var gmTabs = gBrowser.mTabs;
		for (var i = 0; i < gmTabs.length; i++)
			this.adjustTab(gmTabs[i], cleanUp);
	},
	adjustTab: function(tab) {
		if (this.tabSettings.adjustWidth){
			if (tab.hasAttribute("width")) tab.removeAttribute("width");
                        tab.setAttribute("style", "width: auto !important; \
                            min-width: "+this.tabSettings.minWidth+"px !important; \
                            max-width: "+this.tabSettings.maxWidth+"px !important;");
			tab.setAttribute("flex", "0");
		} else if (arguments.length == 2 && arguments[1] === true){ // revert changes
			tab.removeAttribute("flex");
                        tab.removeAttribute("style");
		}
	},
	tabSettings: {	// this will be altered during init
		adjustWidth: false,
		minWidth: 100,
		maxWidth: 250,
		adjustWidthWasTrue: false,
		update: function() {
			var pref = retitler.tabs.pref;
			this.adjustWidth = pref.getBoolPref("adjustWidth");
			if (this.adjustWidth) this.adjustWidthWasTrue = true;
			this.minWidth = pref.getIntPref("minWidth");
			this.maxWidth = pref.getIntPref("maxWidth");
		}
	}
}
