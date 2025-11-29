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
        health: 300
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

            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: movementData.x,
                y: movementData.y
            });
        }
    });

    socket.on('chatMessage', (messageData) => {
        io.emit('chatMessage', {
            playerId: socker.id,
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

    function getRandomImage() {
        const images = ['black.png', 'blue.png', 'blue1.png', 'brown.png', 'green.png',
            'green1.png', 'green2.png', 'red1.png', 'white.png', 'yellow1.png'
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
