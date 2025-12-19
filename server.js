const express = require('express')
const socketio = require('socket.io');
const path = require('path');

const app = express();
app.use(express.static('public'));

const server = app.listen(3000, () => {
    console.log('🎮 게임 서버 실행중 : http://localhost:3000');
});

app.get('/', (req, res) => {
    res.sendFile(__dirname, 'public', 'index.html');
})

const io = socketio(server);

const gameState = {
    players: {},
    items: {}
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
        step: 3,
        attackTime: null,
        direction: null
    }

    socket.emit('gameInit', {
        playerId: socket.id,
        players: gameState.players,
        items: gameState.items,
        health: 300
    });

    socket.broadcast.emit('playerJoined', gameState.players[socket.id]);

    socket.on('playerMove', (movementData) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].x = movementData.x;
            gameState.players[socket.id].y = movementData.y;
            gameState.players[socket.id].direction = movementData.direction;

            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: movementData.x,
                y: movementData.y,
                direction: movementData.direction
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
                    if (player.health == 0) {
                        let oldImage = player.image;
                        player.image = oldImage.slice(0, oldImage.length - 4) + '-dead.png';
                    }
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

    function getRandomImage() {
        const images = ['black.png', 'blue.png', 'blue1.png', 'brown.png', 'green.png',
            'green1.png', 'green2.png', 'red1.png', 'white.png', 'yellow1.png', 'pink.png'
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
});
