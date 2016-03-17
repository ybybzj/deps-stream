var memoizePromise = require('memo-promise');
var BPromise = require('bluebird');
function isFunction(f){return typeof f === 'function';}
function identity(o){return o;}

module.exports = function(cache, opts){
  var getId = isFunction(opts && opts.id) ? opts.id: identity;
  return {
    get: memoizePromise(function get(id, invalid, load){
      var _this = this;
      return BPromise.resolve(cache.get(getId(id)))
        .then(function(data){
          if(data === undefined || (isFunction(invalid) && invalid(data))){
            // console.log('invalid:',cache);
            if(isFunction(load)){
              return load(data).then(function(freshData){
                return _this.set(id, freshData).then(function(){
                  return freshData;
                });
              });
            }else{
              return _this.del(id);
            }
          }
          return data;
        });
    },{
      cache: opts.memoizePromiseCache,
      discardResult: true
    }),
    set: function(id, val){
      id = getId(id);
      return BPromise.resolve(cache.set(id, val));
    },
    del: function(id){
      id = getId(id);
      return BPromise.resolve(cache.del(id)).then(function(){
          return undefined;
        });
    }
  };
};
