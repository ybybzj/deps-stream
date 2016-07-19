function slice(){
  return Array.prototype.slice.call(arguments[0], arguments[1]);
}

var pipe = function pipe() {
  var fns = Array.isArray(arguments[0]) ? arguments[0] : slice(arguments);

  return function piped() {
    var args = slice(arguments),
      i = 0,
      l = fns.length,
      fn, result = args;
    for (; i < l; i++) {
      fn = fns[i];
      result = fn.apply(this, result);
      if (result && typeof result.then === 'function') {
        var rest = pipe(slice(fns, i + 1)).bind(this);
        return result.then(rest);
      } else {
        result = [result];
      }
    }
    return result[0];
  };
};

module.exports = pipe;

