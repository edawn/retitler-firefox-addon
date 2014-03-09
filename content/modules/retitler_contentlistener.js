EXPORTED_SYMBOLS = ["sOutFilter", "sInFilter", "appendSimpleRules"];

Components.utils.import("chrome://retitler/content/modules/retitler_shared.js");
Components.utils.import("chrome://retitler/content/modules/retitler_library.js");

var data;

var sOutFilter = function(rules) {	// array of Rule()s
	var outString = "RetitlerSimpleRuleSetV1\n";
	function redfun(prev, curr) { 
		return prev + "rule:\nurl:" + curr.url +
				"\nmatch:" + curr.match +
				"\nreplace:" + curr.replace + "\n";
	}
	outString = rules.reduce(redfun, outString);
	outString = encodeURIComponent(outString);
	return "data:application/retitler," + outString;
}

// assume that when being called from 'outside' (the importing code), the strings created are encoded in UTF-8.
// otherwise (when being called from the ContentListener below) the Strings seem to be created in some other encoding (latin-1 probably)
// very annoying behavior btw.
var sInFilter = function(inputString){
	if (arguments.length == 2 && arguments[1] === false) return _sInFilter(inputString, false);
	return _sInFilter(inputString, true);
}

var _sInFilter = function(inputString, assumeUTF8String){
	var rules = new Array();
	try {
		var inputString = decodeURIComponent(inputString);
		if (!assumeUTF8String) {
			var uniConv = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
				createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
			uniConv.charset = "UTF-8";
			inputString = uniConv.ConvertToUnicode(inputString);
		}
		var next = new simpleRule();
		var split = inputString.split("\n");
		if (split.length < 5) return null;	// at least 5 lines (i.e. one rule)
		var i = 0;
		if (split[i++] != "RetitlerSimpleRuleSetV1") return null;	// first line
		while (i < split.length){
			var ln = split[i].split(":", 2);
			ln[1] = split[i].substr(ln[0].length+1);	// stupid not-java-like split
			if (ln[0] == "rule"){	// new rule starts
				if (next.check()) rules.push(next);
				next = new simpleRule();
			} else if (next.mandatory.indexOf(ln[0]) != -1) {
				next[ln[0]] = ln[1];
			}
			i++;
		}
		if (next.check()) rules.push(next);
	} catch (e) {	// oops
		return null;
	}
	return rules;
}

var appendSimpleRules = function(rules){
	if (rules == undefined || rules == null) return;
	rules.forEach(function(e, i, a){ a[i] = new Rule(e); });
	retitler_shared.ruleSet.append(rules);
}

// opens confirmation dialog window
var getConfirmation = function(rules){	// array of simple rules
	// data: the data: uri received and to be passed to the dialog for display
	// rules: 'return value'; will be set by the dialog; array of simpleRules derived (and possibly filtered) from the passed data: uri by using sInFilter()
	var args = { data: data, rules: null };
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Components.interfaces.nsIWindowMediator);
	var topWnd = wm.getMostRecentWindow("navigator:browser");
	topWnd.openDialog("chrome://retitler/content/confirm.xul", "retitlerConfirmDlg", "chrome,centerscreen,modal", args);
	appendSimpleRules(args.rules);
}
	

var retitlerContentStreamHandler = {
	QueryInterface: function(aIID) {
		if (aIID.equals(Components.interfaces.nsISupports)
		|| aIID.equals(Components.interfaces.nsIRequestObserver)
		|| aIID.equals(Components.interfaces.nsIStreamListener)
		|| aIID.equals(Components.interfaces.nsISupportsWeakReference))
			return this;
		throw Components.results.NS_NOINTERFACE;
	},

	onStartRequest: function( /*nsIRequest*/ request , /*nsISupports*/ context ) {
		data = new String();
	},
	onStopRequest: function( /*nsIRequest*/ request , /*nsISupports*/ context , /*nsresult*/ statusCode ){
		appendSimpleRules(getConfirmation(data));
//Components.utils.reportError(sInFilter(data));
	},
	onDataAvailable: function( /*nsIRequest*/ request , /*nsISupports*/ context , /*nsIInputStream*/ inputStream , /*PRUint32*/ offset , /*PRUint32*/ count ){
		var sis = Components.classes["@mozilla.org/scriptableinputstream;1"].createInstance(Components.interfaces.nsIScriptableInputStream);
		sis.init(inputStream);
		data += sis.read(count);
	} 
}

// http://forums.mozillazine.org/viewtopic.php?p=2090958
var retitlerContentListener = {
	QueryInterface: function(aIID) {
		if (aIID.equals(Components.interfaces.nsISupports)
		|| aIID.equals(Components.interfaces.nsIURIContentListener)
		|| aIID.equals(Components.interfaces.nsISupportsWeakReference))
			return this;
		throw Components.results.NS_NOINTERFACE;
	},

	canHandleContent: function ( /*char* */ contentType , /*PRBool*/ isContentPreferred , /*out char* */ desiredContentType ) {
		if (contentType == "application/retitler") return true;
		else return false;
	},

	doContent: function ( /*char* */ contentType , /*PRBool*/ isContentPreferred , /*nsIRequest*/ request , /*out nsIStreamListener*/ contentHandler ) {
		contentHandler.value = retitlerContentStreamHandler;
		return false;
	},

	isPreferred: function ( /*char* */ contentType , /*out char* */ desiredContentType ) {
		if (contentType == "application/retitler") return true;
		else return false;
	},

	onStartURIOpen: function ( /*nsIURI*/ URI ) {
		return true;
	}
}

Components.classes["@mozilla.org/uriloader;1"].getService(Components.interfaces.nsIURILoader).registerContentListener(retitlerContentListener);

