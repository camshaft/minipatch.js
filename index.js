exports = module.exports = createPatcher();
exports.createPatcher = createPatcher;

var CHAIN = 0;
var COPY = 1;
var MOVE = 2;
var SPLICE = 3;
var SLICE = 4;

var DELETE = {};

var isArray = Array.isArray;

function createPatcher(applyFn) {
  var fun = applyFn ?
    function onPatch(_, value, patch) {
      return applyFn(defaultApply.bind(null, fun), value, patch);
    } : defaultApply;

  return apply.bind(null, fun);
};

function apply(applyFn, value, patch) {
  if (isArray(patch)) {
    switch (patch.length) {
      case 0:
        // remove
        return null;
      case 1:
        // replace
        return patch[0];
      default:
        switch (patch[0]) {
          case CHAIN:
            return patch.slice(1).reduce(function(acc, op) {
              return apply(applyFn, acc, op);
            }, value);
          default:
            throw new Error('Invalid operator: ' + patch[0]);
        }
    }
  }

  return applyFn(applyFn, value, patch);
}

function defaultApply(applyFn, value, patch) {
  if (typeof value === 'string') return applyString(applyFn, value, patch);
  return isArray(value) ?
    applyArray(applyFn, value, patch) :
    applyObject(applyFn, value, patch);
}

function applyObject(applyFn, obj, patch) {
  var op;
  obj = obj || {};
  var acc = shallowCopy(obj);

  var k;
  for (k in patch) {
    applyObjectPatch(applyFn, obj, patch[k], k, acc);
  }

  for (k in acc) {
    if (acc[k] === DELETE) delete acc[k];
  }

  return acc;
}

function applyObjectPatch(applyFn, prev, op, k, acc) {
  if (isArray(op)) {
    switch (op.length) {
      case 0:
        // remove
        acc[k] = DELETE;
        break;
      case 1:
        // replace
        acc[k] = op[0];
        break;
      default:
        switch (op[0]) {
          case CHAIN:
            return op.slice(1).forEach(function(op) {
              applyObjectPatch(applyFn, prev, op, k, acc);
            });
            break;
          case COPY:
            acc[k] = prev[op[1]];
            break;
          case MOVE:
            var prevk = op[1];
            if (acc[k] !== DELETE) {
              acc[prevk] = DELETE;
            }
            acc[k] = prev[prevk];
            break;
          default:
            throw new Error('Invalid operator: ' + op[0]);
        }
    }
  } else {
    acc[k] = apply(applyFn, prev[k], op);
  }
}

var CONMOVE = {};

function applyArray(applyFn, arr, patch) {
  return Object.keys(patch).sort(reverseSort).reduce(function(acc, k) {
    return applyArrayPatch(applyFn, arr, patch[k], +k, acc);
  }, arr.slice()).reduce(function(acc, v) {
    if (v === DELETE) return acc;
    if (v && v.t === CONMOVE) {
      acc.push(v.a[0], v.a[1]);
    } else {
      acc.push(v);
    }
    return acc;
  }, []);
}

function applyArrayPatch(applyFn, prev, op, k, acc) {
  if (isArray(op)) {
    switch (op.length) {
      case 0:
        // remove
        acc[k] = DELETE;
        break;
      case 1:
        // replace
        acc[k] = op[0];
        break;
      default:
        switch (op[0]) {
          case CHAIN:
            acc = op.slice(1).reduce(function(acc, op) {
              return applyArrayPatch(applyFn, prev, op, k, acc);
            }, acc);
          case COPY:
            acc.splice(k, 0, prev[op[1]]);
            break;
          case MOVE:
            var prevk = op[1];
            if (Math.abs(k - prevk) === 1) {
              acc[k] = prev[prevk];
              acc[prevk] = prev[k];
            } else {
              var accv = acc[prevk];
              if (accv && accv.t === CONMOVE) {
                // perform a swap
                acc[prevk] = accv.a[0];
                acc[k] = accv.a[1];
              } else {
                acc[prevk] = DELETE;
                acc[k] = {t: CONMOVE, a: [prev[prevk], prev[k]]};
              }
            }
            break;
          case SPLICE:
            acc.splice.apply(acc, [k].concat(op.slice(1)));
            break;
          case SLICE:
            acc = acc.slice(k, op[1]);
            break;
          default:
            throw new Error('Invalid operator: ' + op[0]);
        }
    }
  } else {
    acc[k] = apply(applyFn, prev[k], op);
  }
  return acc;
}

function applyString(applyFn, prev, patch) {
  return applyArray(applyFn, prev.split(''), patch).join('');
}

function shallowCopy(obj) {
  var target = {};
  for (var k in obj) {
    target[k] = obj[k];
  }
  return target;
}

function reverseSort(a, b) {
  return b - a;
}
