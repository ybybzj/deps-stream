# Introduction
Utility for streaming content generated from an entry file or entry files. 
All dependent files must be resolved by providing a customized resolver.

## Usage
```js
var pUtil = require('path');
//default options
var options = {
  depResolver: function(path, content){}, //required
  //transhformers: [trans1, trans2,...],
  //contentCache: mongoCache
};
//make a stream maker
var DepsStream = require('deps-stream');
//pass in options to initiate a stream object
var depsStream = new DepsStream(options);
//then use buildFrom method to accept input entries;
depsStream.buildFrom({
  entry: pUtil.resolve(__dirname, './index.js'), //required
  excludeEntries: [pUtil.resolve(__dirname, './other1.js'), pUtil.resolve(__dirname, './other2.js')]
});
//then use the stream object to stream to file stream or a response stream

depsStream.streamTo(writableStream);

//or youcan obtain the meta infomation about the output stream
depsStream.getMeta().then(function(metaInfo){
  console.log(metaInfo);
  //{
  //  etag: 'xxx'
  //  mtime: xxx
  //}
})
```