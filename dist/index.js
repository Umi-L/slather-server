"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
let mapWidth = 5000;
let mapHeight = 5000;
let defaultLen = 10;
const clients = {};
const app = express();
//initialize a simple http server
const server = http.createServer(app);
//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });
wss.on("connection", (_ws) => {
    console.log("playerJoin");
    let ws = _ws;
    let uuid = genUUID();
    newPlayer(uuid);
    ws.on("message", (message) => {
        console.log("messageRecived");
        console.log(message);
    });
});
//start our server
server.listen(process.env.PORT || 8999, () => {
    console.log(`Server started on port ${server.address().port}`);
});
function genUUID() {
    let uuid = Math.floor(Math.random() * 99999999);
    if (clients[uuid]) {
        return genUUID();
    }
    return uuid;
}
function newPlayer(uuid) {
    let pos = findSpawnPos();
    //init default data
    let data = {
        username: "undefined",
        length: defaultLen,
        x: pos.x,
        y: pos.y
    };
    clients[uuid] = data;
}
function broadcast(message) {
    wss.clients.forEach((_ws) => {
        const ws = _ws;
        ws.send(message);
    });
}
function findSpawnPos() {
    return { x: Math.random() * mapWidth, y: Math.random() * mapHeight };
}
//# sourceMappingURL=index.js.map