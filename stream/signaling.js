const WebSocket = require("ws");

function createSignalingServer(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: "/ws" });
  const clients = new Map();

  wss.on("connection", (ws) => {
    let clientId = null;

    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch (err) {
        return;
      }

      if (msg.type === "register" && msg.id) {
        clientId = msg.id;
        clients.set(clientId, ws);
        ws.send(JSON.stringify({ type: "registered", id: clientId }));
        return;
      }

      if (msg.type === "signal" && msg.to) {
        const dest = clients.get(msg.to);
        if (dest) {
          dest.send(JSON.stringify({ type: "signal", from: clientId, data: msg.data }));
        }
      }
    });

    ws.on("close", () => {
      if (clientId) clients.delete(clientId);
    });
  });

  return wss;
}

module.exports = {
  createSignalingServer
};