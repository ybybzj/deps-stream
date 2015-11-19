var getMtimeSync = require('./getMtimeSync');
var BPromise = require('bluebird');
var strHash = require('./stringHash');
var cacheWrapper = require('./cacheWrapper');
var defaultCache = require('./cache');
var readFile = require('./readFile');
var debug = require('debug')('deps-stream');
function _resolveDepsByPath(resolver, path) {
  debug('_resolveDepsByPath: read content of "' + path + '"');
  return readFile(path).then(function(content){
    return {
        mtime: getMtimeSync(path),
        cache: resolver(path, content)
      };
  });
}
module.exports = function resolveDepsWrapper(cache, resolver) {
  var wrappedCache = cacheWrapper(cache, {
    id: strHash,
    memoizePromiseCache: defaultCache.resolveDepsMemoizeCache
  });
  return function resolveDepsByPath(path) {
    var curMtime;
    return wrappedCache.get(path, function(record) {
      var curMtime = getMtimeSync(path);
      return !record || record.mtime == null || curMtime == null || curMtime > record.mtime;
    }, _resolveDepsByPath.bind(null, resolver, path)).then(function(result){
      return result && result.cache;
    });
  };
};