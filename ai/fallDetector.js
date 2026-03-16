function detectFall(meta = {}) {
  if (meta.debugFall === true) return true;

  const pose = meta.pose || {};
  const motion = meta.motion || {};

  const tiltDeg = Number(pose.tiltDeg || 0);
  const heightDrop = Number(pose.heightDrop || 0);
  const immobileSeconds = Number(motion.immobileSeconds || 0);
  const lying = motion.state === "lying" || motion.lying === true;

  const poseFall = tiltDeg >= 70 && heightDrop >= 0.4;
  const motionFall = lying && immobileSeconds >= 1.0;

  return poseFall || motionFall;
}

module.exports = {
  detectFall
};