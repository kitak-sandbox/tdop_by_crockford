var symbol_table = {};

var original_symbol = {
    nud: function () {
        // prefix
        this.error("Undefined.");
    },
    led: function (left) {
        // infix
        this.error("Missing operator.");
    }
};

var symbol = function (id, bp) {
    // bp = binding power
    var s = symbol_table[id];
    bp = bp || 0;
    if (s) {
        if (bp >= s.lbp) {
            s.lbp = bp;
        }
    } else {
        s = Object.create(original_symbol);
        s.id = s.value = id;
        s.lbp = bp;
        symbol_table[id] = s;
    }
    return s;
};

symbol(":");
symbol(";");
symbol(",");
symbol(")");
symbol("]");
symbol("}");
symbol("else");
symbol("(end)");
symbol("(name)");

var token;

var advance = function (id) {
    var a, o, t, v;
    if (id && token.id !== id) {
        token.error("Expected '" + id + "'.");
    }
    if (token_nr >= tokens.length) {
        token = symbol_table["(end)"];
        return;
    }
    t = tokens[token_nr];
    token_nr += 1;
    v = t.value;
    a = t.type;
    if (a === "name") {
        o = scope.find(v);
    } else if (a === "operator") {
        o = symbol_table[v];
        if (!o) {
            t.error("Unknown operator.");
        }
    } else if (a === "string" || a === "number") {
        a = "literal";
        o = symbol_table["(literal)"];
    } else {
        t.error("Unexpected token.");
    }
    token = Object.create(o);
    token.value = v;
    token.arity = a;
    return token;
};

// current scope
var scope;

var itself = function () {
    return this;
};
var original_scope = {
    define: function (n) {
        var t = this.def[n.value];
        if (typeof t === "object") {
            n.error(t.reserved ?
                "Already reserved." :
                "Already defined.");
        }
        this.def[n.value] = n;
        n.reserved = false;
        n.nud = itself;
        n.led = null;
        n.std = null;
        n.lbp = 0;
        n.scope = scope;
        return n;
    },
    find: function (n) {
        var e = this, o;
        while (true) {
            o = e.def[n];
            if (o && typeof o !== 'function') {
                return e.def[n];
            }
            e = e.parent;
            if (!e) {
                o = symbol_table[n];
                return o && typeof o !== 'function' ?
                    o : symbol_table["(name)"];
            }
        }
    },
    pop: function () {
        scope = this.parent;
    },
    reserve: function (n) {
        if (n.arity !== "name" || n.reserved) {
            return;
        }
        var t = this.def[n.value];
        if (t) {
            if (t.reserved) {
                return;
            }
            if (t.arity === "name") {
                n.error("Already defined.");
            }
        }
        this.def[n.value] = n;
        n.reserved = true;
    }
};

var new_scope = function () {
    var s = scope;
    scope = Object.create(original_scope);
    scope.def = {};
    scope.parent = s;
    return scope;
};


