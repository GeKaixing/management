const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const { spawn, execFile } = require("child_process");

const DEFAULT_VERSION = "1.16.3";

function getPlatformArch() {
  const platform = process.platform;
  const arch = process.arch;

  const platformName = platform === "darwin" ? "darwin" : platform === "linux" ? "linux" : "windows";
  const archName = arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : null;

  if (!archName) {
    throw new Error(`Unsupported CPU architecture: ${arch}`);
  }

  if (platformName === "windows") {
    throw new Error("Windows 未内置 MediaMTX。请手动安装并设置 MEDIAMTX_PATH。");
  }

  return { platformName, archName };
}

function getAssetName(version, platformName, archName) {
  return `mediamtx_v${version}_${platformName}_${archName}.tar.gz`;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        return download(response.headers.location, dest).then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        return reject(new Error(`Download failed (${response.statusCode})`));
      }
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
    });
    request.on("error", (err) => {
      file.close();
      reject(err);
    });
  });
}

function extractTarGz(archivePath, destDir) {
  return new Promise((resolve, reject) => {
    execFile("tar", ["-xzf", archivePath, "-C", destDir], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function ensureBinary() {
  const envPath = process.env.MEDIAMTX_PATH;
  if (envPath) {
    if (fs.existsSync(envPath)) {
      return envPath;
    }
    console.warn(`MEDIAMTX_PATH 指向的文件不存在: ${envPath}`);
  }

  const platform = process.platform;
  const packagedPath =
    platform === "darwin"
      ? path.resolve(__dirname, "bin", "mediamtx", "mac", "mediamtx")
      : platform === "win32"
        ? path.resolve(__dirname, "bin", "mediamtx", "win", "mediamtx.exe")
        : path.resolve(__dirname, "bin", "mediamtx", "linux", "mediamtx");

  if (fs.existsSync(packagedPath)) {
    try {
      if (process.platform !== "win32") {
        fs.chmodSync(packagedPath, 0o755);
      }
    } catch (err) {
      console.warn(`无法设置 MediaMTX 可执行权限: ${err.message || err}`);
    }
    return packagedPath;
  }

  const version = process.env.MEDIAMTX_VERSION || DEFAULT_VERSION;
  const { platformName, archName } = getPlatformArch();
  const asset = getAssetName(version, platformName, archName);
  const cacheDir = path.join(os.homedir(), ".cache", "management", "mediamtx", `v${version}`, `${platformName}_${archName}`);
  const binPath = path.join(cacheDir, "mediamtx");

  if (fs.existsSync(binPath)) {
    return binPath;
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  const archivePath = path.join(cacheDir, asset);
  const url = `https://github.com/bluenviron/mediamtx/releases/download/v${version}/${asset}`;

  console.log(`Downloading MediaMTX ${version}...`);
  await download(url, archivePath);
  await extractTarGz(archivePath, cacheDir);
  fs.chmodSync(binPath, 0o755);
  console.log(`MediaMTX 下载到: ${binPath}`);
  return binPath;
}

async function ensureRtspServer({ config, disabled }) {
  if (disabled) return null;
  if (!config || !config.stream || config.stream.protocol !== "rtsp") return null;

  let binPath;
  try {
    binPath = await ensureBinary();
  } catch (err) {
    console.warn(`RTSP server unavailable: ${err.message || err}`);
    console.warn("请安装 MediaMTX 或设置 MEDIAMTX_PATH 指向有效二进制。");
    return null;
  }

  console.log(`MediaMTX 已启动: ${binPath}`);
  const proc = spawn(binPath, [], { stdio: "inherit", cwd: path.dirname(binPath) });
  return {
    proc,
    stop: () => {
      if (!proc.killed) proc.kill();
    }
  };
}

module.exports = {
  ensureRtspServer
};
