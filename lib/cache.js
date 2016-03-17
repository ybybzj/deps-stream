var BPromise = require('bluebird');
var getMtimeSync = require('./getMtimeSync');
function memCache() {
  return {
    _data: Object.create(null),
    get: function(id) {
      return BPromise.resolve(this._data[id]);
    },
    set: function(id, val) {
      this._data[id] = val;
      return BPromise.resolve(val);
    },
    del: function(id) {
      delete this._data[id];
      return BPromise.resolve();
    }
  };
}

function memoizePromiseCache() {
  return {
    _data: Object.create(null),
    get: function(key) {
      return this._data[key];
    },
    set: function(key, val) {
      this._data[key] = val;
    },
    del: function(key) {
      delete this._data[key];
    }
  };
}
module.exports = {
  contentCache: memCache(),
  resolveDepsCache: memCache(),
  contentMemoizeCache : memoizePromiseCache(),
  resolveDepsMemoizeCache : memoizePromiseCache(),
  resolveResultMemoizeCache : memoizePromiseCache()
};
