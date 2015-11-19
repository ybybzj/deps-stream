var BPromise = require('bluebird');
var strHash = require('./stringHash');
var getMtimeSync = require('./getMtimeSync');

module.exports = function(resolveDepsByPath){
  function resolveDeps(paths) {
    return BPromise.all(paths.map(function(path) {
      return resolveDepsByPath(path);
    })).then(function(depResults) {
      return depResults.reduce(function(m, results) {
        var i = 0,
          l = results.length,
          r;
        for (; i < l; i++) {
          r = results[i];
          if (m.indexOf(r) === -1) {
            m.push(r);
          }
        }
        return m;
      }, []);
    });
  }

  function genDeps(results, paths) {
    paths = [].concat(paths);
    if (paths.every(function(p) {
        return !!results.resolved[p];
      })) {
      return BPromise.resolve();
    }
    return resolveDeps(paths).then(function(deps) {
      return genDeps(results, deps).then(function() {
        addDep(results, paths);
      });
    });
  }

  function addDep(results, deps) {
    deps.forEach(function(dep) {
      var hash = strHash(dep);
      if (!results.resolved[hash]) {
        results.resolved[hash] = {
          path: dep,
          mtime: getMtimeSync(dep)
        };
        results.queue.push(hash);
      }
    })
  }

  function computeDeps(paths) {
    var results = {
      queue: [],
      resolved: {}
    };
    return genDeps(results, paths).then(function() {
      return results;
    });
  }
  return computeDeps;
};