var getMtimeSync = require('./getMtimeSync');
var BPromise = require('bluebird');
var strHash = require('./stringHash');
var cacheWrapper = require('./cacheWrapper');
var defaultCache = require('./cache');
var readFile = require('./readFile');
var debug = require('debug')('deps-stream:cache');
function _resolveDepsByPath(resolver, path, getContent) {
  debug('_resolveDepsByPath: read content of "' + path + '"');

  var entry = {
    id: strHash(path),
    mtime: getMtimeSync(path),
    path: path
  };
  
  return getContent(entry).then(function(content){
    return {
        mtime: entry.mtime,
        cache: resolver(path, content.data)
      };
  });
}

module.exports = function resolveDepsWrapper(cache, resolver, getContent) {
  var wrappedCache = cacheWrapper(cache, {
    id: strHash,
    memoizePromiseCache: defaultCache.resolveDepsMemoizeCache
  });
  return function resolveDepsByPath(path) {
    var curMtime;
    return wrappedCache.get(path, function(record) {
      var curMtime = getMtimeSync(path);
      return !record || record.mtime == null || curMtime == null || curMtime > record.mtime;
    }, _resolveDepsByPath.bind(null, resolver, path, getContent)).then(function(result){
      return result && result.cache;
    });
  };
};
