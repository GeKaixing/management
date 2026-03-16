function verifyDevice(req, res, next) {
  const expected = process.env.DEVICE_TOKEN;
  if (!expected) return next();

  const token = req.headers["x-device-token"];
  if (token !== expected) {
    return res.status(401).json({ error: "unauthorized" });
  }

  return next();
}

module.exports = {
  verifyDevice
};