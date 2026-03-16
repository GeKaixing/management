const { startStream } = require("./stream");

function startCamera(config) {
  return startStream(config);
}

module.exports = {
  startCamera
};