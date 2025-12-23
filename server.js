const express = require('express')
const socketio = require('socket.io');
const path = require('path');

const ItemManager = require('./services/ItemManager');

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
        attackTime: null,
        direction: null,
        crrtStep: 0,
        items: []
    }

    socket.emit('gameInit', {
        playerId: socket.id,
        players: gameState.players,
        health: 300
    });

    socket.broadcast.emit('playerJoined', gameState.players[socket.id]);

    socket.on('playerMove', (movementData) => {
        if (gameState.players[socket.id]) {
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
        }
    });

    socket.on('chatMessage', (messageData) => {
        io.emit('chatMessage', {
            playerId: socket.id,
            playerName: gameState.players[socket.id]?.name || '닉명',
            message: messageData.message,
            timestamp: new Date().toLocaleTimeString()
        });
    });

    socket.on('setPlayerName', (nameData) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].name = nameData.name;
            io.emit('playerUpdated', gameState.players[socket.id]);
        }
    });

    
    socket.on('disconnect', () => {
        console.log('❌ 선수결 해제:', socket.id);
        delete gameState.players[socket.id];
        io.emit('playerLeft', socket.id);
    });

    socket.on('attackRequested', () => {
        console.log('공격 요청:', socket.id);
        let currentTime = Date.now();
        let attackedPlayers = {};
        let deadPlayers = {};
        Object.values(gameState.players).forEach(player => {
            if (socket.id !== player.id) {
                let rx = player.x - gameState.players[socket.id].x;
                let ry = player.y - gameState.players[socket.id].y;
                if (player.health && Math.sqrt(rx * rx + ry * ry) < 100) {
                    player.health = Math.max(player.health - 30, 0);
                    attackedPlayers[player.id] = player.health;
                }
            }
        });
        socket.broadcast.emit('playerIsAttacking', {
            id: socket.id,
            attackTime: currentTime
        });

        io.emit('attackResult', {
            attackedPlayers: attackedPlayers
        });
    });

    socket.on('itemClicked', (indexItem) => {
        const player = gameState.players[socket.id];
        if (player && player.items[indexItem]) {
            const itemType = player.items[indexItem].type;
            itemEffect(socket.id, itemType);
            gameState.players[socket.id].items.splice(indexItem, 1);
            socket.emit('itemUpdated', gameState.players[socket.id].items);
        }
        else {
            console.log('빈 아이템입니다.');
        }
    })
    
    function getRandomImage() {
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

    function checkNearByItems(socketId, x, y) {
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

    function isRanged(x, y, r) {
        if (Math.sqrt(x * x + y * y) <= r)
            return true;
        else 
            return false;
    }

    function itemEffect(socketId, itemType) {
        switch(itemType) {
            case 'health':
                const health = Math.min(gameState.players[socketId].health + 150, 300);
                gameState.players[socketId].health = health;
                io.emit('healthIncreased', {id: socketId, health: health});
                break;
            case 'speedBoots':
                break;
        }
    }
});
