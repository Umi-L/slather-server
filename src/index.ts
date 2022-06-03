import * as express from "express";
import e = require("express");
import * as http from "http";
import * as WebSocket from "ws";

//10 pixels per unit

const ticksPerSecond = 20;
const perfectTickTime = 1000 / ticksPerSecond;

let mapWidth = 3000;
let mapHeight = 3000;

const maxOrbs = 70;
let foodOrbs:FoodOrb[] = [];
let newOrbs:FoodOrb[] = [];

let defaultLen = 7;
let defaultRadius = 10;

//units per second
let defaultSpeed = 400;
let boostingSpeed = 600;
let boostingPentalty = 0.01;


let lastUpdate:number = Date.now();

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
    radius: number;
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

    ws.uuid = genUUID();

    newPlayer(ws.uuid);

    ws.on("message", (message: string) => {

        try {
            let jsonData = JSON.parse(message);

            switch (jsonData.method){
                case "connect":
                    if (typeof jsonData.username == "string" && jsonData.username != ""){
                        clients[ws.uuid].username = jsonData.username;
                        ws.send(JSON.stringify(
                            {
                                method:"initialData",  
                                data: {
                                    id: ws.uuid, 
                                    mapWidth: mapWidth, 
                                    mapHeight: mapHeight, 
                                    speed: clients[ws.uuid].speed,
                                    orbs:foodOrbs,
                                    radius: clients[ws.uuid].radius,
                                }
                            }));
                    }
                    else{
                        ws.close();
                    }
                    break;
                
                case "update":

                    //TODO check for must be in radians

                    clients[ws.uuid].heading = jsonData.data.heading;

                    if (jsonData.data.boosting && clients[ws.uuid].length > 3){
                        clients[ws.uuid].speed = boostingSpeed;

                        clients[ws.uuid].length -= boostingPentalty;

                        while(clients[ws.uuid].body.length > clients[ws.uuid].length){
                            clients[ws.uuid].body.pop();
                        }
                    }
                    else{
                        clients[ws.uuid].speed = defaultSpeed;
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

    ws.on("close", ()=>{
        delete clients[ws.uuid];
    });
});

//start our server
server.listen(process.env.PORT || 8999, () => {
    console.log(`Server started on port ${(<any>server.address()).port}`);
});

console.log("starting mainloop");

setInterval(()=>{

    let now = Date.now();
    let dt = (now - lastUpdate) / 1000// perfectTickTime;
    lastUpdate = now;


    if (foodOrbs.length < maxOrbs){
        makeOrb(Math.random()*0.3);
    }

    wss.clients.forEach((_socket:WebSocket)=>{
        let socket = _socket as ExtWebSocket;

        let data = clients[socket.uuid];

        //move snake forward
        let previousPoint = data.body[0];

        let nextPoint = {
            x: data.speed * dt * Math.cos(data.heading) + previousPoint.x,
            y: data.speed * dt * Math.sin(data.heading) + previousPoint.y,
        } as SnakePoint;


        nextPoint = clampPoint(nextPoint);

        data.body.unshift(nextPoint);
        data.body.pop();

        for (let i = foodOrbs.length - 1; i >= 0; i--)
        {
            if (pointDist(foodOrbs[i].x, foodOrbs[i].y, nextPoint.x, nextPoint.y) < data.radius*2 + 10){
                data.length += foodOrbs[i].value;

                data.radius = defaultRadius + data.length / 2;

                foodOrbs.splice(i, 1);

                while(data.body.length < Math.floor(data.length)){
                    data.body.push(data.body[-1]);
                }
            }
        }
    })

    wss.clients.forEach((_socket:WebSocket)=>{
        let socket = _socket as ExtWebSocket;
        let data = clients[socket.uuid];

        wss.clients.forEach((_ws:WebSocket)=>{
            let ws = _ws as ExtWebSocket;

            if (ws.uuid != socket.uuid){
                let otherData = clients[ws.uuid];

                for(let i = 1; i < otherData.body.length; i++){
                    if (!otherData.body[i])
                        continue;
                    if (pointDist(data.body[0].x, data.body[0].y, otherData.body[i].x, otherData.body[i].y) < (data.radius + otherData.radius)){
                        socket.send(JSON.stringify({method:"dead"}));

                        socket.close();

                        for (let j = 0; j < data.body.length; j++){
                            if (data.body[j]){
                                makeOrbAtPos(data.body[j].x + Math.random()*10, data.body[j].y + Math.random()*10, data.length/data.body.length);
                            }
                        }

                        return;
                    }
                }
            }
        })
    });

    broadcast(JSON.stringify({method: "update", data: clients, orbs: newOrbs}));

    foodOrbs = foodOrbs.concat(newOrbs);
    newOrbs = [];

    

    
}, 1000/ticksPerSecond);




// -------------- functions --------------

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
        radius: defaultRadius + defaultLen / 2
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

function makeOrb(value:number){
    let orb = {x:Math.random() * mapWidth, y:Math.random() * mapHeight, value: value} as FoodOrb;
    newOrbs.push(orb);
}

function makeOrbAtPos(x:number, y:number, value:number){
    let orb = {x:x, y:y, value: value} as FoodOrb;
    newOrbs.push(orb);
}

function pointDist(x1:number, y1:number, x2:number, y2:number){
    return Math.hypot(x2-x1, y2-y1)
}