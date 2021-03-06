var BPromise = require('bluebird');
var strHash = require('./stringHash');
var getMtimeSync = require('./getMtimeSync');
var memoizePromise = require('memo-promise');

module.exports = function(resolveDepsByPath, options) {
  options = options || {};

  function _resolveDeps(paths) {
    return BPromise.all(paths.map(resolveDepsByPath))
      .then(function(depResults) {
        var rtn = depResults.reduce(function(res, deps) {
          deps.forEach(function(dep) {
            if (res.indexOf(dep) === -1) {
              res.push(dep);
            }
          });
          return res;
        }, []);
        return rtn;
      });
  }

  function resolveDeps(paths, result) {
    paths = paths.reduce(function(m, p) {
      var id = strHash(p);
      if (!result.visited[id]) {
        m.push(p);
        result.visited[id] = 1;
      }
      // else{
      //   console.log('revisit:  ', p)
      // }

      return m;
    }, []);

    if (paths.length === 0) return BPromise.resolve();

    return _resolveDeps(paths, result).then(function(depResult) {
      return resolveDeps(depResult, result).then(function() {
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
        excludes[id] = 1;
      }
      return m;
    }, []);

    if (paths.length === 0) return BPromise.resolve();

    return _resolveDeps(paths).then(function(depResult) {
      return resolveExcludes(depResult, excludes);
    });
  }


  function computeDeps(paths, excludePaths) {
    var result = {
      queue: [],
      resolved: {},
      visited: {}
    };


    var excludes = {};

    return BPromise.all([
      resolveExcludes(excludePaths, excludes),
      resolveDeps(paths, result)
    ]).then(function() {
      result = result.queue.reduce(function(m, id) {
        var item;
        if (!excludes[id]) {
          item = result.resolved[id];
          m.push({
            id: id,
            path: item.path,
            mtime: item.mtime
          });
        }
        return m;
      }, []);

      return result;
    });
  }

  var memoFn = options.reloadOnChange === false ? memoizePromise(computeDeps, {
    hasher: hasher,
    cache: require('./cache').resolveResultMemoizeCache
  }): computeDeps;
  return memoFn;
};


function hasher(deps, excludes) {
  var s = strHash(deps.sort().join('')) + '!' + strHash(excludes.sort().join(''));
  return s;
}
