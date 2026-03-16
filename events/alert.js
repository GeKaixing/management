function notify(event) {
  console.log("ALERT", event.type, event.id, event.deviceId);
}

module.exports = {
  notify
};