const express = require('express')
const socketio = require('socket.io');
const path = require('path');
const fs = require('fs')

const ItemManager = require('./services/ItemManager');
const attackLogStream = fs.createWriteStream('ai_server/data/attack_log.csv', {flags: 'a'});
const combatDecisionStream = fs.createWriteStream('ai_server/data/chase_decision_log.csv', {flags: 'a'});
// CSV Header 작성
// attackLogStream.write('attacker_health, nearest_enemy_distance, attacked\n');
// chaseDecisionLogStream.write('health_rate, nearest_enemy_distance, combat_decision\n')

const app = express();
app.use(express.static('public'));

const server = app.listen(3000, () => {
    console.log('🎮 게임 서버 실행중 : http://localhost:3000');
});

app.get('/', (req, res) => {
    res.sendFile(__dirname, 'public', 'index.html');
});

const io = socketio(server);
const itemManager = new ItemManager();

setInterval(() => {
    if (Object.keys(itemManager.items).length <= 10) {
        itemManager.createItem();
        io.emit('itemCreated', itemManager.items);
    }
}, 3000);

const gameState = {
    players: {}
}

const coordinates = {
    0: [[0, -0.7], [1, 1.7]],
    1: [[1, -0.7], [0, 1.7]],
    2: [[0, -0.7], [1, 1.7]],
    3: [[1, -0.7], [0, 1.7]]
};

io.on('connection', (socket) => {
    console.log('새 선수 접속:', socket.id);

    const [x, y] = getInitialXY();

    gameState.players[socket.id] = {
        id: socket.id,
        x: x,
        y: y,
        image: getRandomImage(),
        health: 300,
        speed: 3,
        damage: 30,
        haste: [],
        strength: [],
        visibility: 1,
        attackTime: null,
        direction: null,
        crrtStep: 0,
        items: [],
        attackRange: 100,
        attackLogFlag: true
    };

    setInterval(() => {
        gameState.players[socket.id].attackLogFlag = !gameState.players[socket.id].attackLogFlag;
    }, 300)

    socket.emit('gameInit', {
        playerId: socket.id,
        players: gameState.players,
        health: 300
    });

    socket.broadcast.emit('playerJoined', gameState.players[socket.id]);

    socket.on('playerMove', (movementData) => { // 선수움직임 요청 들어왔을때
        if (gameState.players[socket.id].attackLogFlag && gameState.players[socket.id].health > 0) {
            if (gameState.players[socket.id]) {
                if (Object.values(gameState.players).length > 1) { // 공격 및 회피 의사결정 상태 기록
                    const myPlayer = gameState.players[socket.id];
                    const nearestEnemy = findNearestEnemy(socket.id);
                    if (gameState.players[nearestEnemy.id].health > 0 && gameState.players[nearestEnemy.id].visibility && myPlayer.visibilitysa) {
                        const vector1 = [nearestEnemy.x - myPlayer.x, nearestEnemy.y - myPlayer.y];
                        const minDistance = Math.sqrt(vector1[0] * vector1[0] + vector1[1] * vector1[1]);
                        let logLine;

                        const directionVector1 = findDirectionVector(vector1);
                        
                        const temp1 = coordinates[directionVector1][0], temp2 = coordinates[directionVector1][1];
                        const vector2 = [vector1[0] + 50 * temp1[0], vector1[1] + 70 * temp1[1]];
                        const vector3 = [vector1[0] + 50 * temp2[0], vector1[1] + 70 * temp2[1]];
                        const movingVector = [(movementData.x - myPlayer.x) * 10, (movementData.y - myPlayer.y) * 10];

                        if (movingVector[0] != 0 || movingVector[1] != 0) {
                            coefficient = findCoefficient(vector2, vector3, movingVector);
                            if (minDistance >= 450) {
                                logLine = `${myPlayer.health / gameState.players[nearestEnemy.id].health}, ${minDistance}, 0`;
                            }
                            else {
                                let combat_decision;
                                if (coefficient[0] > 0 && coefficient[1] > 0) {
                                    combat_decision = 1;
                                }
                                else if (coefficient[0] < 0 && coefficient[1] < 0) {
                                    combat_decision = 2;
                                }
                                else combat_decision = 0;
                                logLine = `${myPlayer.health / gameState.players[nearestEnemy.id].health}, ${minDistance}, ${combat_decision}\n`;
                                combatDecisionStream.write(logLine);
                            }
                            console.log(findCoefficient(vector2, vector3, movingVector));
                            // console.log(directionVector1);
                            gameState.players[socket.id].attackLogFlag = false;
                        }
                    }
                }
            }
        }
        // 움직임 상태 기록 및 움직임 정보 배포
        gameState.players[socket.id].x = movementData.x;
        gameState.players[socket.id].y = movementData.y;
        checkNearByItems(socket.id, movementData.x, movementData.y);
        if (!movementData.moved)
            gameState.players[socket.id].crrtStep = 0;
        else {
            gameState.players[socket.id].crrtStep = 1 + (gameState.players[socket.id].crrtStep + 1) % 40;
        }   
        gameState.players[socket.id].direction = movementData.direction;
    
        socket.broadcast.emit('playerMoved', {
            id: socket.id,
            x: movementData.x,
            y: movementData.y,
            direction: movementData.direction,
            crrtStep: gameState.players[socket.id].crrtStep
        });
    });

    socket.on('chatMessage', (messageData) => {
        io.emit('chatMessage', {
            playerId: socket.id,
            playerName: gameState.players[socket.id]?.name || '닉명',
            message: messageData.message,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    socket.on('setPlayerName', (nameData) => { // 선수이름 설정
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].name = nameData.name;
            io.emit('playerUpdated', gameState.players[socket.id]);
        }
    });

    
    socket.on('disconnect', () => { // 선수 해제시 기록
        console.log('❌ 선수결 해제:', socket.id);
        delete gameState.players[socket.id];
        io.emit('playerLeft', socket.id);
    });

    socket.on('attackRequested', () => { // 공격효과 적용, 죽은 선수들 기록
        let currentTime = Date.now();
        let attackedPlayers = {};
        let deadPlayers = [];
        let damage = gameState.players[socket.id].damage;
        
        if (!gameState.players[socket.id].visibility) {
            gameState.players[socket.id].visibility = 1;
        }
        
        Object.values(gameState.players).forEach(player => { // 공격 효과적용 및 결과 기록 (AI Data)
            if (socket.id !== player.id) {
                let rx = player.x - gameState.players[socket.id].x;
                let ry = player.y - gameState.players[socket.id].y;
                let r = Math.sqrt(rx * rx + ry * ry);
                if (player.health && r <= player.attackRange) {
                    player.health = Math.max(player.health - damage, 0);
                    if (!player.health)
                        deadPlayers.push(player.id);
                    attackedPlayers[player.id] = player.health;
                }

                let logLine = `${r}, ${r <= player.attackRange? 1 : 0}\n`;
                attackLogStream.write(logLine);
            }
        });

        setTimeout(() => { // 죽은 player 들 10초후 되살리기
            if (deadPlayers.length > 0) {
                respawnedPlayers = [];
                deadPlayers.forEach(playerId => {
                    const [x, y] = getInitialXY();
                    gameState.players[playerId].x = x;
                    gameState.players[playerId].y = y;
                    gameState.players[playerId].visibility = 1;
                    gameState.players[playerId].health = 300;
                    respawnedPlayers.push({id: playerId, player: gameState.players[playerId]});
                });
                io.emit('playersRespawned', respawnedPlayers);
            }
        }, 10000);

        socket.broadcast.emit('playerIsAttacking', {
            id: socket.id,
            attackTime: currentTime
        });

        io.emit('attackResult', {
            id: socket.id,
            attackedPlayers: attackedPlayers
        });
    });

    socket.on('itemClicked', (indexItem) => { // 아이템클릭요청이 들어왔을때
        const player = gameState.players[socket.id];
        if (player && player.items[indexItem]) {
            if (!player.visibility) {
                gameState.players[socket.id].visibility = 1;
                io.emit('playerVisibility', {id: socket.id, visibility: gameState.players[socket.id].visibility});
            }

            const itemType = player.items[indexItem].type;
            itemEffect(socket.id, itemType);
            gameState.players[socket.id].items.splice(indexItem, 1);
            socket.emit('itemUpdated', gameState.players[socket.id].items);
        }
        else {
            console.log('빈 아이템입니다.');
        }
    })
    
    function getRandomImage() { // 선수의 그림 화일 제목 얻기
        const images = ['black', 'blue1', 'blue', 'brown', 'green1',
            'green1', 'pink2', 'pink', 'red', 'white', 'yellow1'
        ];

        return images[Math.floor(Math.random() * images.length)];
    }

    function getInitialXY() {
        let isValid = 1, x, y;
        while(1) {
            x = Math.floor(Math.random() * 700 + 50);
            y = Math.floor(Math.random() * 500 + 50);
            for (const player of Object.values(gameState.players)) {
                if((player.x - 50 <= x && player.x + 50 >= x) && (player.y - 70 <= y && player.y + 70 >= y)) {
                    isValid = 0;
                    break;
                }
            };
            
            if(isValid) 
                break;
        }
        return [x, y];
    }

    function checkNearByItems(socketId, x, y) { // 가장 가까운 아이템까지의 거리 계산 및 아이템획득상태
        Object.keys(itemManager.items).forEach(itemId => {
            if (gameState.players[socketId].items.length < 4) {
                let currItem = itemManager.items[itemId];
                let itemX = currItem.x + 20;
                let itemY = currItem.y + 20;
                if (isRanged(itemX + 20 - (x + 25), itemY + 20 - (y + 35), 30)) {
                    gameState.players[socketId].items.push({type: currItem.itemType, image: currItem.itemImage});
                    delete itemManager.items[itemId];
                    io.emit('itemReached', itemManager.items);
                    socket.emit('itemUpdated', gameState.players[socketId].items);
                }
            }
        });
    }

    function isRanged(x, y, r) { // 범위안에 들었는가 계산
        if (Math.sqrt(x * x + y * y) <= r)
            return true;
        else 
            return false;
    }

    function findDirectionVector(vector) {
        if (vector[0] >= 0) {
            if (vector[1] <= 0)
                return 0;
            else return 3;
        }
        else {
            if (vector[1] <= 0)
                return 1;
            else return 2;
        }
    }

    function findNearestEnemy(socketId) { // 가장가까운 선수와의 거리 계산
        let result = {};
        let distance = Infinity;
        Object.values(gameState.players).forEach(player => {
            if (player.id != socketId) {
                let dx = gameState.players[socketId].x- player.x;
                let dy = gameState.players[socketId].y - player.y;
                let dr = Math.sqrt(dx * dx + dy * dy);
                if (dr < distance) {
                    distance = dr;
                    result = {id: player.id, x: player.x, y: player.y};    
                }
            }
        });
        return result;
    }

    function calculateMovingDirection(vector1, vector2) {
        let length1 = vector1[0] * vector1[0] + vector1[0] * vector1[1];
        let length2 = vector2[0] * vector2[0] + vector2[1] * vector2[1];
        let cosAngle = (vector1[0] * vector2[0] + vector1[1] * vector2[1]) / (Math.sqrt(length1 * length2));
        return cosAngle;
    }

    function findCoefficient (vector1, vector2, vector3) {
        let coef1 = (vector3[0] * vector2[1] - vector3[1] * vector2[0]) /  (vector1[0] * vector2[1] - vector1[1] * vector2[0]);
        let coef2 = (vector3[1] *vector1[0] - vector3[0] *vector1[1]) / (vector1[0] * vector2[1] - vector1[1] * vector2[0]);
        return [coef1, coef2];
    }


    function itemEffect(socketId, itemType) { // 아이템을 사용할때 아이템효과 관리
        switch(itemType) {
            case 'health':
                const health = Math.min(gameState.players[socketId].health + 150, 300);
                gameState.players[socketId].health = health;
                io.emit('healthIncreased', {id: socketId, health: health});
                break;
            case 'speedBoots':
                const speed = gameState.players[socketId].speed;
                const increasedSpeed = Math.min(speed * 1.2, 4.5);
                gameState.players[socketId].haste.push(speed);
                gameState.players[socketId].speed = increasedSpeed;
                io.emit('movingSpeedChanged', {id: socketId, speed: increasedSpeed});
                setTimeout(() => {
                    const initialSpeed = gameState.players[socketId].haste.pop();
                    gameState.players[socketId].speed = initialSpeed;
                    io.emit('movingSpeedChanged', {id: socketId, speed: initialSpeed});
                }, 4000);
                break;
            case 'windoc':
                gameState.players[socketId].visibility = 0;
                io.emit('playerVisibility', {id: socketId, visibility: gameState.players[socketId].visibility});
                setTimeout(() => {
                    if (!gameState.players[socketId].visibility) {
                        gameState.players[socketId].visibility = 1;
                        io.emit('playerVisibility', {id: socketId, visibility: gameState.players[socketId].visibility});
                    }
                }, 15000);
                break;
            case 'strength':
                const strength = gameState.players[socketId].damage;
                const increasedStrength = Math.min(strength * 1.3, 100);
                gameState.players[socketId].strength.push(strength);
                gameState.players[socketId].damage = increasedStrength;
                setTimeout(() => {
                    const initialStrength = gameState.players[socketId].strength.pop();
                    gameState.players[socketId].damage = initialStrength;
                }, 3000);
                break;
        }
    }
});
