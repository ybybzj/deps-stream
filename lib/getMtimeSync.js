var fs = require('fs');
function getMtimeSync(path) {
  try {
    return fs.statSync(path).mtime.getTime();
  } catch (e) {
    return null;
  }
}
module.exports = getMtimeSync;