// disable flexible tab widths in favour of tabmixplus and
//TODO insert default wikipedia rule in database/ruleset
retitler.firstRun = function(){
	if (retitler_shared.baseBranch.getBoolPref("firstRun") == false) return;
	retitler_shared.baseBranch.setBoolPref("firstRun", false);
	try {
		var tmpScope = {};
		var loader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
        	               .getService(Components.interfaces.mozIJSSubScriptLoader)
			       .loadSubScript("resource://gre/components/nsExtensionManager.js", tmpScope);
		var exm = new tmpScope.ExtensionManager();
		var TMPisActive = exm._getActiveItems(2).some(function(v){
				return v.id == "{dc572301-7619-498c-a57d-39143191b318}";});
		var TMPflexTabs = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService)
			.getBranch("").getBoolPref("extensions.tabmix.flexTabs");
		if (TMPisActive && TMPflexTabs)	// avoid conflicts with TMP
			retitler_shared.baseBranch.setBoolPref("tabs.adjustWidth", false);
	} catch (e) {
		Components.utils.reportError("could not determine if TMP is handling flexible tab widths");
	}
}


