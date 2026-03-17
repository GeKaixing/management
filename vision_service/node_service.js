const http = require("http");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const sharp = require("sharp");
const ort = require("onnxruntime-web");
const ortDistPath = path.dirname(require.resolve("onnxruntime-web"));
const ortDistUrl = pathToFileURL(`${ortDistPath}${path.sep}`).href;

ort.env.wasm.wasmPaths = ortDistUrl;
ort.env.wasm.numThreads = 1;

const MODEL_PATH = process.env.YOLO_ONNX_PATH || path.join(__dirname, "yolov8n.onnx");
const PORT = Number(process.env.VISION_PORT || 8010);
const CONF_THRES = Number(process.env.YOLO_CONF || 0.25);
const IOU_THRES = Number(process.env.YOLO_IOU || 0.45);
const INPUT_SIZE = 640;

const COCO = [
  "person","bicycle","car","motorcycle","airplane","bus","train","truck","boat","traffic light",
  "fire hydrant","stop sign","parking meter","bench","bird","cat","dog","horse","sheep","cow",
  "elephant","bear","zebra","giraffe","backpack","umbrella","handbag","tie","suitcase","frisbee",
  "skis","snowboard","sports ball","kite","baseball bat","baseball glove","skateboard","surfboard","tennis racket","bottle",
  "wine glass","cup","fork","knife","spoon","bowl","banana","apple","sandwich","orange",
  "broccoli","carrot","hot dog","pizza","donut","cake","chair","couch","potted plant","bed",
  "dining table","toilet","tv","laptop","mouse","remote","keyboard","cell phone","microwave","oven",
  "toaster","sink","refrigerator","book","clock","vase","scissors","teddy bear","hair drier","toothbrush"
];

let sessionPromise = null;

function loadSession() {
  if (!sessionPromise) {
    sessionPromise = fs.promises
      .readFile(MODEL_PATH)
      .then((modelData) => ort.InferenceSession.create(modelData, { executionProviders: ["wasm"] }));
  }
  return sessionPromise;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function iou(a, b) {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]);
  const areaB = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  const union = areaA + areaB - inter;
  return union <= 0 ? 0 : inter / union;
}

function nms(dets, iouThres) {
  dets.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const d of dets) {
    let keep = true;
    for (const k of kept) {
      if (iou(d.box, k.box) > iouThres) {
        keep = false;
        break;
      }
    }
    if (keep) kept.push(d);
  }
  return kept;
}

async function preprocess(base64) {
  const buffer = Buffer.from(base64, "base64");
  const image = sharp(buffer).removeAlpha();
  const meta = await image.metadata();
  const w = meta.width || INPUT_SIZE;
  const h = meta.height || INPUT_SIZE;
  const scale = Math.min(INPUT_SIZE / w, INPUT_SIZE / h);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const padX = Math.floor((INPUT_SIZE - nw) / 2);
  const padY = Math.floor((INPUT_SIZE - nh) / 2);

  const resized = await image
    .resize(nw, nh)
    .extend({
      top: padY,
      bottom: INPUT_SIZE - nh - padY,
      left: padX,
      right: INPUT_SIZE - nw - padX,
      background: { r: 114, g: 114, b: 114 }
    })
    .raw()
    .toBuffer();

  const float = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);
  for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
    float[i] = resized[i * 3] / 255;
    float[i + INPUT_SIZE * INPUT_SIZE] = resized[i * 3 + 1] / 255;
    float[i + 2 * INPUT_SIZE * INPUT_SIZE] = resized[i * 3 + 2] / 255;
  }

  return { tensor: new ort.Tensor("float32", float, [1, 3, INPUT_SIZE, INPUT_SIZE]), scale, padX, padY, width: w, height: h };
}

function postprocess(output, info) {
  const data = output.data;
  const rows = output.dims[2];
  const cols = output.dims[1];
  let maxCoord = 0;
  const coordScan = Math.min(rows, 2000);
  for (let i = 0; i < coordScan; i++) {
    const cx = data[i];
    const cy = data[rows + i];
    const w = data[2 * rows + i];
    const h = data[3 * rows + i];
    if (cx > maxCoord) maxCoord = cx;
    if (cy > maxCoord) maxCoord = cy;
    if (w > maxCoord) maxCoord = w;
    if (h > maxCoord) maxCoord = h;
  }
  const coordScale = maxCoord <= 2 ? INPUT_SIZE : 1;
  const dets = [];
  for (let i = 0; i < rows; i++) {
    const offset = i;
    const cx = data[offset] * coordScale;
    const cy = data[rows + offset] * coordScale;
    const w = data[2 * rows + offset] * coordScale;
    const h = data[3 * rows + offset] * coordScale;
    let bestScore = 0;
    let bestClass = -1;
    for (let c = 4; c < cols; c++) {
      const score = data[c * rows + offset];
      if (score > bestScore) {
        bestScore = score;
        bestClass = c - 4;
      }
    }
    if (bestScore < info.conf) continue;
    const x1 = (cx - w / 2 - info.padX) / info.scale;
    const y1 = (cy - h / 2 - info.padY) / info.scale;
    const x2 = (cx + w / 2 - info.padX) / info.scale;
    const y2 = (cy + h / 2 - info.padY) / info.scale;
    dets.push({
      classId: bestClass,
      score: bestScore,
      box: [x1, y1, x2, y2]
    });
  }
  const kept = nms(dets, info.iou);
  return kept;
}

async function handleDetect(req, res, body) {
  try {
    const started = Date.now();
    const parsed = JSON.parse(body);
    if (!parsed.image_base64) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "missing image_base64" }));
      return;
    }
    const session = await loadSession();
    const conf = Number.isFinite(parsed.conf) ? Number(parsed.conf) : CONF_THRES;
    const iou = Number.isFinite(parsed.iou) ? Number(parsed.iou) : IOU_THRES;
    const prep = await preprocess(parsed.image_base64);
    const feeds = {};
    feeds[session.inputNames[0]] = prep.tensor;
    const outputMap = await session.run(feeds);
    const output = outputMap[session.outputNames[0]];
    const dets = postprocess(output, { ...prep, conf, iou });
    const personCount = dets.filter((d) => COCO[d.classId] === "person").length;
    const phoneCount = dets.filter((d) => COCO[d.classId] === "cell phone").length;
    const labels = dets.map((d) => COCO[d.classId] || String(d.classId));
    const boxes = dets.map((d) => ({
      label: COCO[d.classId] || String(d.classId),
      score: Number(d.score.toFixed(3)),
      box: d.box.map((v) => Number(v.toFixed(1)))
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      personCount,
      phoneCount,
      labels,
      boxes,
      conf,
      iou,
      inferenceMs: Date.now() - started
    }));
  } catch (err) {
    console.error("[vision] detect_failed", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "detect_failed", message: String(err && err.message ? err.message : err) }));
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/detect") {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => handleDetect(req, res, body));
    return;
  }
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found" }));
});

server.listen(PORT, () => {
  console.log(`Vision service (ONNX) listening on http://127.0.0.1:${PORT}`);
});
