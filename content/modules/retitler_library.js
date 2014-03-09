EXPORTED_SYMBOLS = ["getSimirules", "simpleRule", "Rule", "selfInfo", "createExactMatchRule", "regClean"];
Components.utils.import("resource://gre/modules/Services.jsm");

var Rule = function(){
	var alen = arguments.length;

	if (alen == 0){	// empty/new rule
		this._isActive = true;
		this._url = new String();
		this._match = new String();
		this._replace = new String();
	} else if (alen == 1) {	// simpleRule
		var sRule = arguments[0];
		this._isActive = true;
		this._url = sRule.url;
		this._match = sRule.match;
		this._replace = sRule.replace;
	} else if (alen == 4){	// user input / other
		this._isActive = arguments[0];
		this._url = arguments[1];
		this._match = arguments[2];
		this._replace = arguments[3];
	} else if (alen == 7) {	// for clone()
		this._isActive = arguments[0];
		this._url = arguments[1];
		this.urlRegExp = arguments[4];
		this._match = arguments[2];
		this.matchRegExp = arguments[5];
		this._replace = arguments[3];
		this.isValid = arguments[6]
	} else {
		throw new Error("nix rule");
	}

	if (this.isValid === undefined) this._validate();

	this.__defineSetter__("isActive", function(val){ this._setter("_isActive", val); });
	this.__defineSetter__("url", function(val){ this._setter("_url", val); });
	this.__defineSetter__("match", function(val){ this._setter("_match", val); });
	this.__defineSetter__("replace", function(val){ this._setter("_replace", val); });
	this.__defineGetter__("isActive", function() {return this._isActive;});
	this.__defineGetter__("url", function() {return this._url;});
	this.__defineGetter__("match", function() {return this._match;});
	this.__defineGetter__("replace", function() {return this._replace;});
}
Rule.prototype.__defineGetter__("asArray", function(){return [this._isActive, this._url, this._match, this._replace];});
Rule.prototype._setter = function(id, newval){
	if (this[id] == newval) return;		// nothing's changed
	var oldval = this[id];
	this[id] = newval;
	if (id == "_url" || id == "_match") this._validate();
	this._notifyRuleChangeListener(id, oldval, newval);
	return;
}
Rule.prototype._validate = function() {
	this.isValid = true;
	try {
		this.urlRegExp = new RegExp(this._url);
	} catch (e) {
		this.urlRegExp = e;
		this.isValid = false;
	}
	try {
		this.matchRegExp = new RegExp(this._match);
	} catch (e) {
		this.matchRegExp = e;
		this.isValid = false;
	}
}
Rule.prototype.addRuleChangeListener = function(callback){
	this.rclCallback = callback;
}
Rule.prototype.removeRuleChangeListener = function(){
	this.rclCallback = undefined;
}
Rule.prototype._notifyRuleChangeListener = function(id, oldval, newval) {
//Components.utils.reportError("Rule changed: this: " + this + " id: " + id + " oldval: " + oldval + " newval: "+ newval + " rclCallback: " +this.rclCallback);
	if (this.rclCallback == undefined) return;
	this.rclCallback({rule:this, id:id, oldval:oldval, newval:newval});
}
Rule.prototype.toString = function() {
	return this._isActive + " " + this._url + " " + this._match + " " + this._replace + " " + this.isValid + " " + this.urlRegExp + " " + this.matchRegExp + "\n";
}
// a second optional boolean argument may be given which tells the function
// if the 'isActive' property should be considered when checking for equlity
// the default is: true
Rule.prototype.equals = function(otherRule) {
	if (!(arguments.length == 2 && arguments[1] == false) && this._isActive !== otherRule._isActive) return false;
	if (this._url !== otherRule._url || this._match !== otherRule._match || this._replace !== otherRule._replace) return false;
	return true;
}	
Rule.prototype.clone = function(){
	return new Rule(this._isActive, this._url, this._match, this._replace, this.urlRegExp, this.matchRegExp, this.isValid);
}	



var simpleRule = function(){}
simpleRule.prototype.isActive = undefined;
simpleRule.prototype.url = undefined;
simpleRule.prototype.match = undefined;
simpleRule.prototype.replace = undefined;
simpleRule.prototype.mandatory = ["url", "match", "replace"];
simpleRule.prototype.properties = ["isActive", "url", "match", "replace"];
simpleRule.prototype.check = function(){
	return this.mandatory.every(function(e){ return this[e] != undefined; }, this);
}
simpleRule.prototype.equals = function(otherSimpleRule){
	return this.properties.every(function(e){ return this[e] == otherSimpleRule[e]; }, this);
}


// the following four functions are used for automatic rule generation

function regClean(str){	// escape special RegEx chars
	return str.replace("\\", "\\\\").replace(/([\^\$\*\+\?\.\(\)\|\[\]\{\}])/g, "\\$1");
}

function redfun(prev, curr, index, ary) {
	if (prev.uri.host != curr.uri.host) return curr;
	var ptsplit = prev.ttl.split(/\s/);
	var ctsplit = curr.ttl.split(/\s/);
	var minlen = Math.min(ptsplit.length, ctsplit.length);

	var is=0;
	while (is < minlen && ptsplit[is] == ctsplit[is]) is++;
	if (is == minlen) return curr;	// one title is entirely contained in the other one;
	var prefixRegexp = ptsplit.slice(0, Math.max(0, is));

	ptsplit.reverse();
	ctsplit.reverse();
	var ie=0;
	while (ie < minlen && ptsplit[ie] == ctsplit[ie]) ie++;
	if (ie == minlen || (is == 0 && ie == 0)) return curr;
	// ^- one title is entirely contained in the other one; no match
		
	prefixRegexp = prefixRegexp.map(regClean).join("\\s") + "\\s";
	prefixRegexp = "^"+prefixRegexp+"(.*)$";

	var suffixRegexp = "\\s" + ptsplit.slice(0, Math.max(0, ie)).reverse().map(regClean).join("\\s");
	suffixRegexp = "^(.*)"+suffixRegexp+"$";

	ary[index].match = prefixRegexp.length > suffixRegexp.length ? prefixRegexp : suffixRegexp;
	return curr;
}

function simirule(browsers){
	var tary = [];
	for (var i = 0; i < browsers.length; i++){ // the tabs of one open window (browser)
		var doc = browsers[i].contentDocument;
		if ((typeof doc.title == "string") && (doc.title != "") && (typeof doc.documentURIObject == "object")){
			try { 
				doc.documentURIObject.host;
				tary.push({ uri: doc.documentURIObject, ttl: doc.title });
			} catch (e) {}
		}
	}
	if (tary.length < 2) return [];
	tary.sort(function(a, b) { return a.uri.prePath.localeCompare(b.uri.prePath);});
	tary.reduce(redfun);	// probably an unjustified misuse
	tary = tary.filter(function(e){ return typeof e.match == "string"; });
	tary.forEach(function(e, i, a){ 
			var srule = new simpleRule();
			srule.url = "^"+regClean(e.uri.prePath);
			srule.match = e.match;
			srule.replace = "$1";
			a[i] = srule; });
	return tary;
}

// returns an array of Rule()s
function getSimirules(){
    var rules = new Array();
    var enumerator = Services.wm.getEnumerator("navigator:browser");
    while(enumerator.hasMoreElements()) {
        var bro = enumerator.getNext().gBrowser.browsers;
        rules = rules.concat(simirule(bro));
    }
    rules = rules.filter(function(e, i, a){ var j=i-1; while (j >= 0) {if (e.equals(a[j])) return false; j--;}; return true;});
    rules.forEach(function(e, i, a){ a[i] = new Rule(e);});
    return rules;
}


//returns a Rule() that (more or less) exactly matches the url/title of the currently selected tab
function createExactMatchRule() {
    var doc = Services.wm.getMostRecentWindow("navigator:browser").content.document;
    if ((typeof doc.title != "string") || (doc.title == "") || (typeof doc.documentURIObject != "object")) return null;

    var url = "^" + regClean(doc.documentURIObject.prePath);
    var match = "^("+regClean(doc.title).replace(/\s/g, "\\s")+")$";
    return new Rule(true, url, match, "$1");
}

	

// information about the addon itself
//TODO make it dynamic
var selfInfo = {
    name: "retitler",
    version: "0.2.x",
}


	
