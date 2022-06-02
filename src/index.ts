import * as express from "express";
import e = require("express");
import * as http from "http";
import * as WebSocket from "ws";

//10 pixels per unit

let mapWidth = 5000;
let mapHeight = 5000;

let foodOrbs:FoodOrb[] = [];

let defaultLen = 10;

//units per second
let defaultSpeed = 2;

let ticksPerSecond = 20;

export interface ExtWebSocket extends WebSocket {
    isAlive: boolean;
    uuid: number;
}

interface PlayerData{
    username:string;
    length: number;
    body: SnakePoint[];
    heading: number;
    speed: number;
}

interface SnakePoint{
    x:number;
    y:number;
}

interface FoodOrb{
    x: number;
    y: number;
    value: number;
}

interface IClients {
    [key: number]:PlayerData
}

const clients:IClients = {};

const app = express();

//initialize a simple http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

wss.on("connection", (_ws:WebSocket) => {

    console.log("playerJoin");

    let ws = _ws as ExtWebSocket;

    let uuid = genUUID();

    newPlayer(uuid);

    ws.on("message", (message: string) => {

        try {
            let jsonData = JSON.parse(message);

            switch (jsonData.method){
                case "connect":
                    if (typeof jsonData.username == "string" && jsonData.username != ""){
                        clients[ws.uuid].username = jsonData.username;
                    }
                    else{
                        ws.close();
                    }
                    break;
                
                


                default:
                    console.log("Unknown message recived from: ", ws.uuid);
                    console.log(jsonData);
                    break;
            }
        } catch (error) {
            console.log("ERROR IN MESSAGE from: ", ws.uuid);
            console.log("MESSAGE =>",  message);
            console.log(error);
        }
    });
});

//start our server
server.listen(process.env.PORT || 8999, () => {
    console.log(`Server started on port ${(<any>server.address()).port}`);
});

console.log("starting mainloop");

setInterval(()=>{

    wss.clients.forEach((_socket:WebSocket)=>{
        let socket = _socket as ExtWebSocket;

        let data = clients[socket.uuid];

        //move snake forward
        let previousPoint = data.body[0];

        let nextPoint = {
            x: data.speed * Math.cos(data.heading) + previousPoint.x,
            y: data.speed * -Math.cos(data.heading) + previousPoint.y,
        } as SnakePoint;

        nextPoint = clampPoint(nextPoint);

        data.body.unshift(nextPoint);
        data.body.pop();

        //update client
        socket.send(JSON.stringify({method: "update", data: data}));
    })

    
}, 1000/ticksPerSecond);








function genUUID():number{
    let uuid = Math.floor(Math.random() * 99999999);

    if (clients[uuid]){
        return genUUID();
    }

    return uuid;
}

function newPlayer(uuid:number): void{

    let pos = findSpawnPos();

    //init default data
    let data:PlayerData = {
        username: "undefined",
        length: defaultLen,
        body: fillArray({x:pos.x, y:pos.y} as SnakePoint, defaultLen),
        heading: 0,
        speed: defaultSpeed,
    }

    clients[uuid] = data;
}

function broadcast(message:string){
    wss.clients.forEach((_ws:WebSocket) =>{
        const ws = _ws as ExtWebSocket;

        ws.send(message);
    })
}

function findSpawnPos(){
    return {x:Math.random() * mapWidth, y:Math.random() * mapHeight};
}


function fillArray(value:any, len:number) {
    if (len == 0) return [];
    var a = [value];
    while (a.length * 2 <= len) a = a.concat(a);
    if (a.length < len) a = a.concat(a.slice(0, len - a.length));
    return a;
}

function clampPoint(point:SnakePoint): SnakePoint{
    return {x: clamp(point.x, 0, mapWidth), y: clamp(point.y, 0, mapHeight)}
}

function clamp(num:number, min:number, max:number) {
    return Math.min(Math.max(num, min), max)
};