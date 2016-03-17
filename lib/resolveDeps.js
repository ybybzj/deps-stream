var BPromise = require('bluebird');
var strHash = require('./stringHash');
var getMtimeSync = require('./getMtimeSync');
var memoizePromise = require('memo-promise');

module.exports = function(resolveDepsByPath) {

  function resolveDeps(paths, result, excludes) {
    return Promise.all(paths.map(function(path) {
      return {
        id: strHash(path),
        p: path
      };
    }).map(function(entry) {
      if (result.resolved[entry.id]) {
        return Promise.resolve();
      }

      return resolveDepsByPath(entry.p).then(function(depResults) {
        return resolveDeps(depResults, result, excludes).then(function() {
          if (!result.resolved[entry.id] && !excludes[entry.id]) {
            result.resolved[entry.id] = {
              path: entry.p,
              mtime: getMtimeSync(entry.p)
            };
            result.queue.push(entry.id);
          }
          return null;
        });
      });

    }));
  }

  function resolveExcludes(paths, result, excludes) {
    return Promise.all(paths.map(function(path) {
      var id = strHash(path);
      if (excludes[id]) {
        return Promise.resolve();
      }

      return resolveDepsByPath(path).then(function(depResults) {
        return resolveExcludes(depResults, result, excludes).then(function() {
          removeExcludeDep(result, id);
          excludes[id] = 1;
          return null;
        });
      });
    }));
  }

  function computeDeps(deps, excludeDeps) {
    var result = {
      queue: [],
      resolved: {}
    };

    var excludes = {};

    return Promise.all([
      resolveExcludes(excludeDeps, result, excludes),
      resolveDeps(deps, result, excludes)
    ]).then(function() {
      return result;
    });
  }

  var memoFn =  memoizePromise(computeDeps, {
    hasher: hasher,
    cache: require('./cache').resolveResultMemoizeCache
  });
  return memoFn;
};

function removeExcludeDep(result, id) {
  if (result.resolved[id]) {
    result.queue.splice(result.queue.indexOf(id), 1);
    delete result.resolved[id];
  }
}

function hasher(deps, excludes){
  var t = new Date();
  var s = strHash(deps.sort().join('')) + '!' + strHash(excludes.sort().join(''));
  return s;
}
