"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
//10 pixels per unit
let mapWidth = 3000;
let mapHeight = 3000;
const maxOrbs = 70;
let foodOrbs = [];
let newOrbs = [];
let defaultLen = 7;
//units per second
let defaultSpeed = 1000;
let ticksPerSecond = 20;
const clients = {};
const app = express();
//initialize a simple http server
const server = http.createServer(app);
//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });
wss.on("connection", (_ws) => {
    console.log("playerJoin");
    let ws = _ws;
    ws.uuid = genUUID();
    newPlayer(ws.uuid);
    ws.on("message", (message) => {
        try {
            let jsonData = JSON.parse(message);
            switch (jsonData.method) {
                case "connect":
                    if (typeof jsonData.username == "string" && jsonData.username != "") {
                        clients[ws.uuid].username = jsonData.username;
                        ws.send(JSON.stringify({
                            method: "initialData",
                            data: {
                                id: ws.uuid,
                                mapWidth: mapWidth,
                                mapHeight: mapHeight,
                                speed: clients[ws.uuid].speed,
                                orbs: foodOrbs
                            }
                        }));
                    }
                    else {
                        ws.close();
                    }
                    break;
                case "update":
                    //TODO check for must be in radians
                    clients[ws.uuid].heading = jsonData.data.heading;
                    break;
                default:
                    console.log("Unknown message recived from: ", ws.uuid);
                    console.log(jsonData);
                    break;
            }
        }
        catch (error) {
            console.log("ERROR IN MESSAGE from: ", ws.uuid);
            console.log("MESSAGE =>", message);
            console.log(error);
        }
    });
    ws.on("close", () => {
        delete clients[ws.uuid];
    });
});
//start our server
server.listen(process.env.PORT || 8999, () => {
    console.log(`Server started on port ${server.address().port}`);
});
console.log("starting mainloop");
setInterval(() => {
    if (foodOrbs.length < maxOrbs) {
        makeOrb(Math.random() * 0.1);
        console.log("orbMade");
    }
    wss.clients.forEach((_socket) => {
        let dt = ticksPerSecond / 1000;
        let socket = _socket;
        let data = clients[socket.uuid];
        //move snake forward
        let previousPoint = data.body[0];
        let nextPoint = {
            x: data.speed * dt * Math.cos(data.heading) + previousPoint.x,
            y: data.speed * dt * Math.sin(data.heading) + previousPoint.y,
        };
        nextPoint = clampPoint(nextPoint);
        data.body.unshift(nextPoint);
        data.body.pop();
        for (let i = foodOrbs.length - 1; i >= 0; i--) {
            if (pointDist(foodOrbs[i].x, foodOrbs[i].y, nextPoint.x, nextPoint.y) < 20) {
                data.length += foodOrbs[i].value;
                console.log(data.length);
                foodOrbs.splice(i, 1);
                while (data.body.length < Math.floor(data.length)) {
                    data.body.push(data.body[-1]);
                }
            }
        }
    });
    broadcast(JSON.stringify({ method: "update", data: clients, orbs: newOrbs }));
    foodOrbs = foodOrbs.concat(newOrbs);
    newOrbs = [];
}, 1000 / ticksPerSecond);
// -------------- functions --------------
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
        body: fillArray({ x: pos.x, y: pos.y }, defaultLen),
        heading: 0,
        speed: defaultSpeed,
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
function fillArray(value, len) {
    if (len == 0)
        return [];
    var a = [value];
    while (a.length * 2 <= len)
        a = a.concat(a);
    if (a.length < len)
        a = a.concat(a.slice(0, len - a.length));
    return a;
}
function clampPoint(point) {
    return { x: clamp(point.x, 0, mapWidth), y: clamp(point.y, 0, mapHeight) };
}
function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}
;
function makeOrb(value) {
    let orb = { x: Math.random() * mapWidth, y: Math.random() * mapHeight, value: value };
    newOrbs.push(orb);
}
function pointDist(x1, y1, x2, y2) {
    return Math.abs(Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2)));
}
//# sourceMappingURL=index.js.map