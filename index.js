var extend = require('xtend');
var assert = require('assert');
var eos = require('end-of-stream');
var BPromise = require('bluebird');
var debugTiming = require('debug')('deps-stream:timing');
var debugCache = require('debug')('deps-stream:cache');
var defaultCache = require('./lib/cache');
var getMtimeSync = require('./lib/getMtimeSync');
var resolveCache = require('./lib/resolveCache');
var resolveDeps = require('./lib/resolveDeps');
var strHash = require('./lib/stringHash');
var cacheWrapper = require('./lib/cacheWrapper');
var readFile = require('./lib/readFile');


function DepsStream(options) {
  var _resolveDepsByPath;
  if (!(this instanceof DepsStream)) {
    return new DepsStream(options);
  }
  
  this.options = extend({
    contentCache: defaultCache.contentCache,
    resolveDepsCache: defaultCache.resolveDepsCache
  }, options);
  
  assert(typeof this.options.entry !== 'undefined', 'missing entry property!');
  assert(typeof this.options.depResolver === 'function', 'missing depResolver property!');

  this._contentCache = cacheWrapper(this.options.contentCache, {
    memoizePromiseCache: defaultCache.contentMemoizeCache
  });
  
  this._resolveDepsFn = resolveDeps(resolveCache(this.options.resolveDepsCache, this.options.depResolver));

  this._resolveDepsPromise = this._resolveDeps();
  
  return this;
}

var proto = DepsStream.prototype;


proto._resolveDeps = function() {
  var startTime = new Date();
  // console.log(this.options);
  var entries = [].concat(this.options.entry).filter(Boolean),
    excludeEntries = [].concat(this.options.excludeEntries).filter(Boolean),
    resolveDepsFn = this._resolveDepsFn;

  return resolveDepsFn(entries, excludeEntries).then(function(result) {
    debugTiming('resolve time for %j: %s ms', entries, (new Date()).getTime() - startTime.getTime());
    return result;
  });
};

proto.getMeta = function() {
  return this._resolveDepsPromise.then(function(deps) {
    if (deps.queue.length === 0) {
      return null;
    }
    var mtime = deps.resolved[deps.queue[0]].mtime,
      i, l, _mtime, etags = [];
    for (i = 1, l = deps.queue.length; i < l; i++) {
      _mtime = deps.resolved[deps.queue[i]].mtime;
      etags.push(Number(_mtime).toString(36));
      if (_mtime > mtime) {
        mtime = _mtime;
      }
    }
    return {
      mtime: mtime,
      etag: etags.join('')
    };
  });
};

proto.streamTo = function(writable) {
  var _this = this;

  eos(writable, function(err) {
    if (err) {
      console.error(err);
      console.error(err.stack);
      if (typeof _this._onErrorHandler === 'function') {
        return _this._onErrorHandler(err);
      }
    }
    if (typeof _this._onEndHandler === 'function') {
      _this._onEndHandler();
    }
  });

  this._resolveDepsPromise.then(function(deps) {

    return deps.queue.map(function(id) {
      return extend({
        id: id
      }, deps.resolved[id]);
    });
  }).then(function(depEntries) {
    return BPromise.each(depEntries.map(_this._updateCacheEntry.bind(_this)), function(content, idx) {
      // console.log(content);
      return writable.write(content.data);
    }).then(function() {
      return writable.end();
    });
  }).catch(function(err){
    writable.emit('error', err);
    throw err;
  });

  return null;
};

proto.onEnd = function(fn) {
  this._onEndHandler = fn;
};

proto.onError = function(fn) {
  this._onErrorHandler = fn;
};

proto._updateCacheEntry = function(depEntry) {
  var contentCache = this._contentCache,
    processFile = this._processFile.bind(this),
    id = depEntry.id,
    curMtime = depEntry.mtime,
    fpath = depEntry.path;

  return contentCache.get(id, function(cacheEntry) {
    return curMtime > cacheEntry.mtime;
  }, function() {
    debugCache('update content', fpath);
    return processFile(fpath).then(function(content) {
      return {
        mtime: curMtime,
        data: content
      };
    });
  });
};

function isFunction(f) {
  return typeof f === 'function';
}

proto._processFile = function(fpath) {
  var transformers = [].concat(this.options.transformers).filter(isFunction);
  return readFile(fpath).then(function(content) {
    var i, l = transformers.length,
      transformer, result;
    if (l > 0) {
      result = {
        path: fpath,
        content: content
      };
      for (i = 0; i < l; i++) {
        transformer = transformers[i];
        result = transformer(result);
      }
      return result.content;
    }
    return content;
  });
};


//helpers
function isResponse(stream) {
  return stream.statusCode && typeof stream.setHeader === 'function';
}

module.exports = function createDepsStreamer(options) {
  return function makeDepsStream(entryOpts) {
    if (typeof entryOpts === 'string' || Array.isArray(entryOpts)) {
      entryOpts = {
        entry: entryOpts
      };
    }

    var opts = extend({}, options, entryOpts);

    return new DepsStream(opts);
  };
};
