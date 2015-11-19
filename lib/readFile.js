var fs = require('fs');
var BPromise = require('bluebird');
function readFile(path){
  return new BPromise(function(done, onErr){
    fs.readFile(path, 'utf8', function(err, data){
      if(err){
        return onErr(err);
      }
      return done(data);
    });
  });
}
module.exports = readFile;