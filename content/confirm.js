var contentlistener = new Object();
Components.utils.import("chrome://retitler/content/modules/retitler_contentlistener.js", contentlistener);

var argdata = null;
var rules;
function init(){
	var lb = window.document.getElementById("listbox");
	try {
		argdata = window.arguments[0];
//Components.utils.reportError("arguments.length: " + window.arguments.length+ " rules: "+argdata.data);
		rules = contentlistener.sInFilter(argdata.data, false);
		rules.forEach(function(v, i, a){
			lb.appendItem("rule "+(i+1)+":\n").tooltipText = "rule "+(i+1);
			v.mandatory.forEach(function(part){ lb.appendItem("  "+part+": "+v[part]+"\n").tooltipText = part+": "+v[part]; });
		});
	} catch (e) {
		etext = window.document.getElementById("stringbundle").getString("error");
		lb.appendItem(etext + e).tooltipText = etext + e;
	}
}

function accept(){
	argdata.rules=rules;
	window.close();
}

