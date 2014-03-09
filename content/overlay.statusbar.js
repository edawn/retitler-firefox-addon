// this is responsible for setting the right status bar icon and its tooltip
retitler.sbIcon = {
	pref: null,
	sbPanel: null,
	init: function(){
		this.pref = retitler_shared.getPrefBranch("showStatusBarIcon");
		this.sbPanel = window.document.getElementById("retitler-status");
		this.updateFromPrefs();
		this.pref.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.pref.addObserver("", this, false);
		gBrowser.tabContainer.addEventListener("TabSelect", function() { retitler.sbIcon.update.call(retitler.sbIcon); }, false);
	},
	unload: function(){
		if (!this.pref) return;
		this.pref.removeObserver("", this);
	},
	observe: function(aSubject, aTopic, aData){
		if(aTopic != "nsPref:changed") return;
		this.updateFromPrefs();
	},
	updateFromPrefs: function(){
		if (this.pref.getPrefType("") != this.pref.PREF_STRING || this.pref.getCharPref("") == "none") {
			this.sbPanel.hidden = true;
		} else {
			this.sbPanel.hidden = false;
			this.sbPanel.setAttribute("icontype", this.pref.getCharPref(""));
			this.update();
		}
	},		
	update: function() {
		if (this.sbPanel.hidden) return;	// do nothing if icon is hidden anyway
		var cDoc = gBrowser.selectedBrowser.contentDocument;
		var icon;
		if ("URLmatched" in cDoc && cDoc.URLmatched > 0) {
			if (cDoc.originalTitle &&
			    cDoc.originalTitle != cDoc.title) { // title has been changed by some rule(s)
				icon = 2;
			} else { 	// some rule(s) applied, but didn't change the title
				icon = 1;
			}
		} else {	// no rule applied
			icon = 0;
		}
		this.sbPanel.setAttribute("icon", icon);
	}

};

retitler.sbTooltip = {
	stringbundle: null,
	description: [],
	init: function() {
		var doc = window.document;
		// set the tooltip heading
		doc.getElementById("retitler-status-tooltip-desc-name").value=
			retitler.lib.selfInfo.name+" "+retitler.lib.selfInfo.version;
		this.stringbundle = doc.getElementById("retitler-status-tooltip-stringbundle");
		var ttel = doc.getElementById("retitler-status-tooltip");
		var desc = this.description;
		for (var i = 0; i < 5; i++) {
			desc[i] = doc.createElement("description");
			desc[i].setAttribute("numbuh", i);
			desc[i].setAttribute("hidden", "true");
			ttel.appendChild(desc[i]);
		}
		ttel.addEventListener("popupshowing", this.show, false);
	},
	unload: function() {
		// maybe this function should so something?
	},
	show: function(e){
		var tts = retitler.sbTooltip.stringbundle;
		var ttd = retitler.sbTooltip.description;
		ttd.forEach(function (el) { el.setAttribute("hidden", "true"); });

		var cDoc = gBrowser.selectedBrowser.contentDocument;
		if ("URLmatched" in cDoc && cDoc.URLmatched > 0) {
			ttd[0].setAttribute("hidden", "false");
			ttd[0].setAttribute("value", tts.getFormattedString("matched", [cDoc.URLmatched]));
			if (cDoc.originalTitle !== undefined &&
			    cDoc.originalTitle != cDoc.title) { // title has been changed by some rule(s)
				ttd[1].setAttribute("hidden", "false");
				ttd[1].setAttribute("value", tts.getString("changed"));
				ttd[2].setAttribute("hidden", "false");
				ttd[2].setAttribute("value", cDoc.originalTitle);
				ttd[3].setAttribute("hidden", "false");
				ttd[3].setAttribute("value", "\u2193");
				ttd[4].setAttribute("hidden", "false");
				ttd[4].setAttribute("value", cDoc.title);
			} else { 	// some rule(s) applied, but didn't change the title
				ttd[1].setAttribute("hidden", "false");
				ttd[1].setAttribute("value", tts.getString("nochange"));
			}
		} else {	// no rule applied
			ttd[0].setAttribute("hidden", "false");
			ttd[0].setAttribute("value", tts.getString("nomatch"));
		}
	}
}
