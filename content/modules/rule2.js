EXPORTED_SYMBOLS = ["Rule2", "rtt"];
//TODO: a lot ...

Components.utils.import("chrome://retitler/content/modules/retitler_shared.js");

var Rule2 = function(){
    var alen = arguments.length;

    if (alen == 0){	// empty/new rule
        this._isActive = true;
        this._ruleStr = new String();
    } else if (alen == 1) {	// simpleRule
        var sRule = arguments[0];
        this._isActive = true;
        this._ruleStr = "\
var ruleObject = {\
    test: function(url, title) {\
        var matchUrl = this.urlRegExp.test(url);\
        if (!matchUrl) return {matchUrl: false};\
        return {matchUrl: true, matchTtl: this.ttlRegExp.test(title), newTtl: title.replace(this.ttlRegExp, this.ttlReplace)};\
    },\
    /* return this.test(url, title); would also work, but less effciently */\
    replace: function(url, title) {\
Components.utils.reportError('replace: url: '+ url + ' title: ' + title);\n\
        var matchUrl = this.urlRegExp.test(url);\
Components.utils.reportError('replace: matchUrl: ' + matchUrl);\n\
        if (!matchUrl) return {matchUrl: false};\
var newTtl = title.replace(this.ttlRegExp, this.ttlReplace);\n\
Components.utils.reportError(\"newTtl: \" + newTtl);\n\
        return {matchUrl: true, newTtl: newTtl};\
    }\
};\
ruleObject.urlRegExp = new RegExp('"+sRule.url.replace("\\", "\\\\", "g")+"');\
ruleObject.ttlRegExp = new RegExp('"+sRule.match.replace("\\", "\\\\", "g")+"');\
ruleObject.ttlReplace = '"+sRule.replace.replace("\\", "\\\\", "g")+"';";
    } else if (alen == 2){	// user input / other
        this._isActive = arguments[0];
        this._ruleStr = arguments[1];
    } else if (alen == 4) {	// for clone()
        this._isActive = arguments[0];
        this._ruleStr = arguments[1];
        this._ruleObj = arguments[2];
        this.isValid = arguments[3]
    } else {
        throw new Error("nix rule");
    }

    if (this.isValid === undefined) this._validate();

}

Rule2.prototype.test = function(url, title){    // may throw an error
    var rO = {isActive: this._isActive, isValid: this.isValid};
    if (!rO.isActive || !rO.isValid) return rO;
    rO.result = this._ruleObj.test(url, title);
    return rO
}

Rule2.prototype.replace = function(url, title){    // may throw an error
    var rO = {isActive: this._isActive, isValid: this.isValid};
    if (!rO.isActive || !rO.isValid) return rO;
    rO.result = this._ruleObj.replace(url, title);
    return rO
}

Rule2.prototype._validate = function() {
    this.isValid = true;
    try {
        eval(this._ruleStr);
        this._ruleObj = ruleObject;
Components.utils.reportError(this._ruleObj.toSource());
    } catch (e) {
Components.utils.reportError(e);
        this._ruleObj = e;
        this.isValid = false;
    }
}
Rule2.prototype.addRuleChangeListener = function(callback){
    this.rclCallback = callback;
}
Rule2.prototype.removeRuleChangeListener = function(){
    this.rclCallback = undefined;
}
Rule2.prototype._notifyRuleChangeListener = function(id, oldval, newval) {
    if (this.rclCallback == undefined) return;
    this.rclCallback({rule:this, id:id, oldval:oldval, newval:newval});
}
Rule2.prototype.toString = function() {
    return "Rule2: active: " + this._isActive + "\nCode:\n" + this._ruleStr+
            "\nObject:\n" + this._ruleObj.toSource();
}
// a second optional boolean argument may be given which tells the function
// if the 'isActive' property should be considered when checking for equlity
// the default is: true
Rule2.prototype.equals = function(otherRule) {
    if (!(arguments.length == 2 && arguments[1] == false) && this._isActive !== otherRule._isActive) return false;
    if (this._ruleStr != otherRule._ruleStr) return false;
    return true;
}
Rule2.prototype.clone = function(){
    return new Rule2(this._isActive, this._ruleStr, this._ruleObj, this.isValid);
}


/*** Rule2 Test ***/
var rtt = {};
rtt.rules = [];
rtt.fromStorage = function(){
    var rules = [];
    var statement = retitler_shared.dbConn.createStatement("SELECT active, ruleObjStr FROM funrules");
    while (statement.executeStep())
        rules.push(new Rule2(statement.getInt32(0) === 1, statement.getUTF8String(1)));
    statement.finalize();
    return rules;
}

rtt.toStorageTest = function(){
    var rule = retitler_shared.ruleSet.storage[0];
    var rule2 = new Rule2(rule);
    retitler_shared.dbConn.beginTransaction();
    try {
    var statement = retitler_shared.dbConn.createStatement("INSERT INTO funrules (active, ruleObjStr) VALUES (?1, ?2)");
    statement.bindInt32Parameter(0, 1);
    statement.bindUTF8StringParameter(1, rule2._ruleStr);
    statement.execute();
    statement.finalize();
    retitler_shared.dbConn.commitTransaction();
    }
    catch (e) { // something's went wrong during transaction -> rollback
            if (retitler_shared.dbConn.transactionInProgress) {
                Components.utils.reportError("toStorage: " + e.name + ": " + e.message);
                retitler_shared.dbConn.rollbackTransaction();
            } else throw e;
        }
}

rtt.apply = function(url, title) {
Components.utils.reportError("apply: title: "+title);
    var matchCount = 0; // url match counter
    rtt.rules.forEach(function(r){
       var rO = r.replace(url, title);
Components.utils.reportError("apply active: "+rO.isActive+" valid: " + rO.isValid);
       if (rO.result !== undefined){
           title = rO.result.newTtl;
Components.utils.reportError("apply: newTtl: "+title);


            matchCount = rO.result.matchUrl === true ? matchCount + 1 : matchCount;
       }
    });
    return {title: title, matchCount: matchCount};
}

/*** init ***/
rtt.toStorageTest();
rtt.rules = rtt.fromStorage();
Components.utils.reportError("rules: " + rtt.rules.length + "\n" + rtt.rules);