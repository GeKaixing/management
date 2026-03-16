const os = require("os");

function getDefaultCameraConfig() {
  if (os.platform() === "darwin") {
    return {
      format: "avfoundation",
      input: "0"
    };
  }

  return {
    format: "dshow",
    input: "video=Integrated Camera"
  };
}

module.exports = {
  getDefaultCameraConfig
};