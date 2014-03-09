EXPORTED_SYMBOLS = ["retitler_shared"];

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("chrome://retitler/content/modules/retitler_library.js");

var retitler_shared = {};

retitler_shared.baseBranch = undefined;

// array of lately generated rules / rules lately inserted into the ruleset
retitler_shared.latelyGenerated = [];

retitler_shared.__defineGetter__("ruleSet", function(){ return _currentRuleset;});

retitler_shared.backupRules = function(){
    backdupRuleset = currentRuleset.clone();
    return currentRuleset;
}
retitler_shared.undoRules = function(){
    currentRuleset = backdupRuleset.clone();
    return currentRuleset;
}
retitler_shared.restoreRules = function(){
    currentRuleset = retitler_shared.fromStorage();
}

// loads rules from storage (sqlite db)
retitler_shared.fromStorage = function(){
    var statement = dbConn.createStatement("SELECT active, url, match, replace FROM rules");
    var rules = [];
    while (statement.executeStep())
        rules.push(new Rule(statement.getInt32(0) === 1, statement.getUTF8String(1),
            statement.getUTF8String(2),statement.getUTF8String(3)));
    statement.finalize();
    return new Ruleset(rules);
}

// saves rules in storage
retitler_shared.toStorage = function(){
    try {
        dbConn.beginTransaction();
        try {
            dbConn.executeSimpleSQL("DELETE FROM rules"); // very cheap ...
            var rules = _currentRuleset._storage;
            var statement = dbConn.createStatement("INSERT INTO rules (active, url, match, replace) VALUES (?1, ?2, ?3, ?4)");
            for (var i = 0; i < rules.length; i++) {
                var rule = rules[i];
                statement.bindInt32Parameter(0, rule.isActive);
                statement.bindUTF8StringParameter(1, rule.url);
                statement.bindUTF8StringParameter(2, rule.match);
                statement.bindUTF8StringParameter(3, rule.replace);
                statement.execute();
            }
            statement.finalize();
            dbConn.commitTransaction();
        } catch (e) { // something's went wrong during transaction -> rollback
            if (dbConn.transactionInProgress) {
                Components.utils.reportError("toStorage: " + e.name + ": " + e.message);
                dbConn.rollbackTransaction();
            } else throw e;
        }
    } catch (e) {
        Components.utils.reportError("toStorage: " + e.name + ": " + e.message);
    }
}

retitler_shared.getPrefBranch = function(subBranch) {
    var prefs = Services.prefs;
    prefs = prefs.getBranch("extensions.retitler." + subBranch);
    return prefs;
}

retitler_shared.addRuleChangeListener = function(callback){
    ruleChangeListeners.push(callback);
}

retitler_shared.removeRuleChangeListener = function(callback){
    ruleChangeListeners = ruleChangeListeners.filter(function (a) {return a != callback});
}


//'private'

function Ruleset(x){
    var thisthis = this;
    this._notifyRuleChangeListener = function(change){
        if (thisthis.rsclCallback == undefined) return;
        if (change == undefined) change = {ruleset:thisthis};
        change.ruleset = thisthis;
        thisthis.rsclCallback(change);
    }

    if (x instanceof Array){ // assume deep copy ready-to-eat
        this._storage = x;
        this._registerRules();
    } else this._storage = new Array();
}
Ruleset.prototype.__defineGetter__("storage", function(){
    return this._storage.map(function(a){ return a; });	// shallow array copy
});
Ruleset.prototype.__defineSetter__("storage", function(x){
    this._storage = x.map(function(a) { return a;});	// shallow ...
    this._registerRules();
    this._notifyRuleChangeListener();
});
Ruleset.prototype.__defineGetter__("length", function(){ return this._storage.length; });
Ruleset.prototype.atIndex = function(i){
    return this._storage[i];
}
Ruleset.prototype.insertAt = function(rule, i){	// rather "insertAtIndex" ...
    this._storage.splice(i, 0, rule);
    rule.addRuleChangeListener(this._notifyRuleChangeListener);
    this._notifyRuleChangeListener();
}
Ruleset.prototype.push = function(rule){
    this._storage.push(rule);
    rule.addRuleChangeListener(this._notifyRuleChangeListener);
    this._notifyRuleChangeListener();
}
Ruleset.prototype.splice = function(){
    this._storage.splice.apply(this._storage, arguments);
    this._registerRules();
    this._notifyRuleChangeListener();
}
Ruleset.prototype.append = function(arry){
    while (arry.length > 0){
        var rule = arry.shift();
        this._storage.push(rule);
        rule.addRuleChangeListener(this._notifyRuleChangeListener);
    }
    this._notifyRuleChangeListener();
}
Ruleset.prototype.forEach = function(fun) {
    this._storage.forEach(fun);
}
Ruleset.prototype.filter = function(fun){	// works in-place - opposing to Array.filter()
    var oldlen = this._storage.length;
    this._storage = this._storage.filter(fun);
    if (this._storage.length != oldlen) this._notifyRuleChangeListener();
    return this._storage.length;
}

Ruleset.prototype._registerRules = function(){ //sets _notifyRuleChangeListener as (rule change listener) callback for each rule currently in _storage
    this._storage.forEach(function(a){a.addRuleChangeListener(this._notifyRuleChangeListener);}, this);
}
Ruleset.prototype.setRuleChangeListener = function(callback){
    this.rsclCallback = callback;
}
Ruleset.prototype.unsetRuleChangeListener = function(){
    this.rsclCallback = undefined;
}

// this will apply the current rules to url and title
// and return the resulting title along with the number of (url-)rules that matched the url
Ruleset.prototype.applyRules = function(url, title) {
    var urlMatchCounter = 0;
    this._storage.forEach(function (r){
        if (r.isActive == true && r.isValid && r.urlRegExp.test(url) == true){	// url-rule matches the document's URL
            urlMatchCounter++;
            title = title.replace(r.matchRegExp, r.replace); // replace ...
        }
    });
    return { title: title /*The new/transformed title*/, matchCount: urlMatchCounter };
}

// returns an array of objects containing more detailed information about
// the rules that applied to the url/title of the given content document
Ruleset.prototype.getMatchingRules = function(doc) {
    if (doc == null) return [];
    var title = doc.originalTitle ? doc.originalTitle : doc.title;
    var url = doc.location.toString();
    var results = [];
    this._storage.forEach(function (r){
        if (r.isActive == true && r.isValid && r.urlRegExp.test(url) == true){
            var oldTitle = title;
            title = title.replace(r.matchRegExp, r.replace);
            var matched = { rule: r, onURL: true, onTitle: r.matchRegExp.test(oldTitle), changedTitle: title !== oldTitle };
            results.push(matched);
        }
    });
    return results;
}

Ruleset.prototype.toString = function(){
    var retStr = new String("Rules:\n");
    for (var i = 0; i < this._storage.length; i++) retStr = retStr+this._storage[i]+"\n";
    return retStr;
}
Ruleset.prototype.clone = function(){
    var stor = this._storage.map(function(a){ return a.clone(); });
    return new Ruleset(stor);
}

//init:

var dbConn;
var backdupRuleset;

var _currentRuleset;
__defineGetter__("currentRuleset", function(){ return _currentRuleset;});
__defineSetter__("currentRuleset", function(x){
        if (_currentRuleset != undefined) _currentRuleset.unsetRuleChangeListener();
        _currentRuleset=x;
        _currentRuleset.setRuleChangeListener(notifyRuleChangeListeners);
        notifyRuleChangeListeners();
    });


var ruleChangeListeners = new Array();

function notifyRuleChangeListeners() {
    ruleChangeListeners.forEach(function(a) { a();});
}

function initStorage(){
    var file = Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
    file.append("retitler.sqlite");
    var storageService = Services.storage;
    dbConn = storageService.openDatabase(file);

    // old style rules
    var statement = dbConn.createStatement("CREATE TABLE IF NOT EXISTS rules (active INTEGER NOT NULL, url VARCHAR NOT NULL, match VARCHAR NOT NULL, replace VARCHAR NOT NULL)");
    statement.execute();
    statement.finalize();

    // table for functional rules
    var statement = dbConn.createStatement("CREATE TABLE IF NOT EXISTS funrules (active INTEGER NOT NULL, ruleObjStr VARCHAR NOT NULL)");
    statement.execute();
    statement.finalize();

}

retitler_shared.baseBranch = retitler_shared.getPrefBranch("");

initStorage();
retitler_shared.restoreRules();
retitler_shared.backupRules();

retitler_shared.dbConn = dbConn;