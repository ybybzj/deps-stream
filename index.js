var extend = require('xtend');
var assert = require('assert');
var eos = require('end-of-stream');
var BPromise = require('bluebird');
var debug = require('debug')('deps-stream');
var defaultCache = require('./lib/cache');
var getMtimeSync = require('./lib/getMtimeSync');
var resolveCache = require('./lib/resolveCache');
var resolveDeps = require('./lib/resolveDeps');
var strHash = require('./lib/stringHash');
var cacheWrapper = require('./lib/cacheWrapper');
var readFile = require('./lib/readFile');


function DepsStream(options) {
  var _resolveDepsByPath;
  if(!this instanceof DepsStream) {
    return new DepsStream(options);
  }
  if (typeof options === 'string' || Array.isArray(options)) {
    options = {
      entry: options
    };
  }

  this.options = extend({
    contentCache: defaultCache.contentCache,
    resolveDepsCache: defaultCache.resolveDepsCache
  }, options);
  // assert(typeof this.options.entry !== 'undefined', 'missing entry property!');
  assert(typeof this.options.depResolver === 'function', 'missing depResolver property!');
  this._contentCache = cacheWrapper(this.options.contentCache, {memoizePromiseCache: defaultCache.contentMemoizeCache});
  this._resolveDepsFn = resolveDeps(resolveCache(this.options.resolveDepsCache, this.options.depResolver));
  if(typeof this.options.entry !== 'undefined'){
    this._resolveDepsPromise = this._resolveDeps(normalizeEntryInput(this.options.entry));
  }
  return this;
}

var proto = DepsStream.prototype;

proto.buildFrom = function(entries){
  this._resolveDepsPromise = this._resolveDeps(normalizeEntryInput(entries));
  return this;
}

proto._resolveDeps = function(entryOpts){
  var startTime = new Date();
  // console.log(this.options);
  var entries = entryOpts.entries,
      excludeEntries = entryOpts.excludes,
      resolveDepsFn = this._resolveDepsFn,
      entryDepsPromise = resolveDepsFn(entries),
      excludeEntriesDepsPromise = resolveDepsFn(excludeEntries);
  return BPromise.all([entryDepsPromise, excludeEntriesDepsPromise])
    .spread(function(entryDeps, excludeEntriesDeps){
      var queue = [], resolved = {}, 
          entryDepsQ = entryDeps.queue,
          excludeEntriesDepsQ = excludeEntriesDeps.queue;
      entryDepsQ.forEach(function(entryDepId){
        if(excludeEntriesDepsQ.indexOf(entryDepId) === -1){
          queue.push(entryDepId);
          resolved[entryDepId] = entryDeps.resolved[entryDepId];
        }
      });
      debug('resolve time for %j: %s ms', entries, (new Date()).getTime() - startTime.getTime());
      return {
        queue: queue,
        resolved: resolved
      };
    });
};
proto.getMeta = function(){
  return this._resolveDepsPromise.then(function(deps){
    if(deps.queue.length === 0){
      return null;
    }
    var mtime = deps.resolved[deps.queue[0]].mtime, i, l, _mtime, etags = [];
    for(i = 1, l = deps.queue.length; i < l; i++){
      _mtime = deps.resolved[deps.queue[i]].mtime;
      etags.push(Number(_mtime).toString(36));
      if(_mtime > mtime){
        mtime = _mtime;
      }
    }
    return {
      mtime: mtime,
      etag: etags.join('')
    };
  });
};
proto.streamTo = function(writable){
  var _this = this;
  var contentCache = this._contentCache;
 
  eos(writable, function(err){
    if(err){
      console.error(err);
      console.error(err.stack);
      if(typeof _this._onErrorHandler === 'function') {
        return _this._onErrorHandler(err);
      }
    }
    if(typeof _this._onEndHandler === 'function'){
      _this._onEndHandler();
    }
  });
  this._resolveDepsPromise.catch(function(err){
    if(isResponse(writable)){
      writable.statusCode = 400;
      writable.write(err.toString());
    }
    throw err;
  }).then(function(deps){
    
    return deps.queue.map(function(id){
      return extend({
        id: id
      }, deps.resolved[id]);
    });
  }).then(function(depEntries){
    return BPromise.each(depEntries.map(_this._updateCacheEntry.bind(_this)), function(content, idx){
      // console.log(content);
      writable.write(content.data);
    }).then(function(){
      writable.end();
    });
  }).catch(writable.emit.bind(writable, 'error'));
};
proto.onEnd = function(fn){
  this._onEndHandler = fn;
  return this;
};
proto.onError = function(fn){
  this._onErrorHandler = fn;
  return this;
};
proto._updateCacheEntry = function(depEntry){
  var contentCache = this._contentCache,
      processFile = this._processFile.bind(this),
      id = depEntry.id,
      curMtime = depEntry.mtime,
      fpath = depEntry.path;
  // return lock.acquire(id, function(){
    return contentCache.get(id, function(cacheEntry){
        return curMtime > cacheEntry.mtime;
      }, function(){
        debug('update content', fpath);
        return processFile(fpath).then(function(content){
            return {mtime: curMtime, data: content};
          });
      });
  // });
};

proto._processFile = function(fpath){
  var transformers = [].concat(this.options.transformers).filter(isFunction);
  return readFile(fpath).then(function(content){
    var i, l = transformers.length, transformer, result;
    if(l > 0){
      result = {path: fpath, content: content};
      for(i = 0 ; i < l; i++){
        transformer = transformers[i];
        result = transformer(result);
      }
      return result.content;
    }
    return content;
  });
};
//helpers

function isFunction(f){
  return typeof f === 'function';
}
// function isObject(o){
//   return Object.prototype.toString.call(o) === '[object Object]';
// }
function isResponse(stream) {
  return stream.statusCode && typeof stream.setHeader === 'function';
}
function isNonEmptyStr(str){
  return typeof str === 'string' && str.trim().length > 0;
}
function toArray(input){
  return [].concat(input).filter(Boolean);
}
function normalizeEntryInput(entryOpts){
  assert(typeof entryOpts === 'string' || Object(entryOpts) === entryOpts, '[entry option] Invalid entry option! given: ' + entryOpts);
  if(typeof entryOpts === 'string' || Array.isArray(entryOpts)){
    entryOpts = {
      entries: entryOpts,
      excludes: []
    };
  }
  return {
    entries: toArray(entryOpts.entries).filter(isNonEmptyStr),
    excludes: toArray(entryOpts.excludes).filter(isNonEmptyStr)
  };
}

module.exports = DepsStream;