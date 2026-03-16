const http = require("http");
const express = require("express");
const router = require("./router");
const { createSignalingServer } = require("../stream/signaling");

const app = express();

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Device-Token");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  return next();
});

app.use(express.json({ limit: "10mb" }));
app.use(router);

const server = http.createServer(app);
createSignalingServer(server);

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
