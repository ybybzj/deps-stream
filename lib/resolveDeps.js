var BPromise = require('bluebird');
var strHash = require('./stringHash');
var getMtimeSync = require('./getMtimeSync');
var memoizePromise = require('memo-promise');

module.exports = function(resolveDepsByPath) {

  function _resolveDeps(paths) {
    return BPromise.all(paths.map(resolveDepsByPath))
      .then(function(depResults) {
        var rtn = depResults.reduce(function(result, deps) {
          deps.forEach(function(dep) {
            if (result.indexOf(dep) === -1) {
              result.push(dep);
            }
          });
          return result;
        }, []);
        return rtn;
      });
  }

  function resolveDeps(paths, result, excludes) {
    paths = paths.reduce(function(m, p) {
      var id = strHash(p);
      if (!result.resolved[id]) {
        m.push(p);
      }
      return m;
    }, []);

    if (paths.length === 0) return BPromise.resolve();

    return _resolveDeps(paths).then(function(depResult) {
      return resolveDeps(depResult, result, excludes).then(function() {
        paths.forEach(function(p) {
          var id = strHash(p);
          if (!result.resolved[id]) {
            result.resolved[id] = {
              path: p,
              mtime: getMtimeSync(p)
            };

            result.queue.push(id);
          }
        });
        return null;
      });
    });
  }


  function resolveExcludes(paths, excludes) {
    paths = paths.reduce(function(m, p) {
      var id = strHash(p);
      if (!excludes[id]) {
        m.push(p);
      }
      return m;
    }, []);

    if (paths.length === 0) return BPromise.resolve();

    return _resolveDeps(paths).then(function(depResult) {
      return resolveExcludes(depResult, excludes).then(function() {
        paths.forEach(function(p) {
          excludes[strHash(p)] = 1;
        });
      });
    });
  }


  function computeDeps(paths, excludePaths) {
    var result = {
      queue: [],
      resolved: {}
    };


    var excludes = {};

    return BPromise.all([
      resolveExcludes(excludePaths, excludes),
      resolveDeps(paths, result)
    ]).then(function() {

      result = result.queue.reduce(function(m, id) {
        if (!excludes[id]) {
          m.queue.push(id);
          m.resolved[id] = result.resolved[id];
        }
        return m;
      }, {
        queue: [],
        resolved: {}
      });

      return result;
    });
  }

  var memoFn = memoizePromise(computeDeps, {
    hasher: hasher,
    cache: require('./cache').resolveResultMemoizeCache
  });
  return memoFn;
};


function hasher(deps, excludes) {
  var t = new Date();
  var s = strHash(deps.sort().join('')) + '!' + strHash(excludes.sort().join(''));
  return s;
}
