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
var depsStreamMaker = require('deps-stream')(options);
//pass in entries to generator a stream object
var depsStream = depsStreamMaker({
  entry: pUtil.resolve(__dirname, './index.js'), //required
  excludeEntries: [pUtil.resolve(__dirname, './other1.js'), pUtil.resolve(__dirname, './other2.js')]
});
//then use the stream object to stream to file stream or a response stream

depsStream.streamTo(writableStream);
```