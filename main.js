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

var expression = function (rbp) {
    // 29

    var left;
    var t = token;
    advance();
    left = t.nud();
    // 2
    // 29 < 50 → 29 < 30 → 29 < 0
    while (rbp < token.lbp) {
        // 3 → 4
        t = token;
        advance();
        // ((2 * 3) && 4)
        left = t.led(left);
    }
    return left;
}

var infix = function (id, bp, led) {
    var s = symbol(id, bp);
    s.led = led || function (left) {
        this.first = left;
        this.second = expression(bp);
        this.arity = "binary";
        return this;
    };
    return s;
};

infix("+", 50);
infix("-", 50);
infix("*", 60);
infix("/", 60);

infix("===", 40);
infix("!==", 40);
infix("<", 40);
infix("<=", 40);
infix(">", 40);
infix(">=", 40);

infix("?", 20, function (left) {
    this.first = left;
    this.second = expression(0);
    advance(":");
    this.third = expression(0);
    this.arity = "ternary";
    return this;
});

infix(".", 80, function (left) {
    this.first = left;
    if (token.arity !== "name") {
        token.error("Expected a property name.");
    }
    token.arity = "literal";
    this.second = token;
    this.arity = "binary";
    advance();
    return this;
});

infix("[", 80, function (left) {
    this.first = left;
    this.second = expression(0);
    this.arity = "binary";
    advance("]");
    return this;
});

var infixr = function (id, bp, led) {
    var s = symbol(id, bp);
    s.led = led || function (left) {
        this.first = left;
        this.second = expression(bp - 1);
        this.arity = "binary";
        return this;
    };
    return s;
};

infixr("&&", 30);
infixr("||", 30);

var prefix = function (id, nud) {
    var s = symbol(id);
    s.nud = nud || function () {
        scope.reserve(this);
        this.first = expression(70);
        this.arity = "unary";
        return this;
    };
    return s;
}
prefix("-");
prefix("!");
prefix("typeof");
prefix("(", function () {
    var e = expression(0);
    advance(")");
    return e;
});

var assignment = function (id) {
    return infixr(id, 10, function (left) {
        if (left.id !== "." && left.id !== "[" &&
                left.arity !== "name") {
            left.error("Bad lvalue.");
        }
        this.first = left;
        this.second = expression(9);
        this.assignment = true;
        this.arity = "binary";
        return this;
    });
};
assignment("=");
assignment("+=");
assignment("-=");

var constant = function (s, v) {
    var x = symbol(s);
    x.nud = function () {
        scope.reserve(this);
        this.value = symbol_table[this.id].value;
        this.arity = "literal";
        return this;
    };
    x.value = v;
    return x;
};
constant("true", true);
constant("false", false);
constant("null", null);
constant("pi", 3.141592653589793);

symbol("(literal)").nud = itself;