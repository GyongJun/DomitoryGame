const socket = io();
const spriteManager = new SpriteManager();

const gameState = {
    players: {},
    myPlayerId: null,
    canvas: null,
    ctx: null,
    keys: {},
    health: null
};

const nameSetup = document.getElementById('name-setup');
const playerNameInput = document.getElementById('player-name-input');
const startGameBtn = document.getElementById('start-game');
const playersContainer = document.getElementById('players-container');
const chatMessages = document.getElementById('chat-messages');

function updatePlayersList() {
    playersContainer.innerHTML = '';

    Object.values(gameState.players).forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-item';
        playerElement.innerHTML = `
            <span>${player.name || '닉명'} ${player.id === gameState.myPlayerId ? '(나)' : ''}</span>
        `;
        playersContainer.appendChild(playerElement);
    });
}

function addChatMessage(playerName, message, timestamp) {
    const messageElement = document.createElement('div');
    messageElement.innerHTML = `<strong>${playerName}:</strong> ${message}
        <small>$(timestamp)</small>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

socket.on('gameInit', (data) => {
    gameState.myPlayerId = data.playerId;
    gameState.players = data.players;
    spriteManager.preloadImages();

    updatePlayersList();
});

socket.on('playerMoved', (playerData) => {
    if (gameState.players[playerData.id]) {
        gameState.players[playerData.id].x = playerData.x;
        gameState.players[playerData.id].y = playerData.y;
    }
});

socket.on('playerJoined', (player) => {
    gameState.players[player.id] = player;
    updatePlayersList();
    addChatMessage('System', `${player.name || '닉명'} 선수가 접속하였습니다.`, new Date().toLocaleTimeString());
});

function initGame() {
    console.log('start initGame');
    gameState.canvas = document.getElementById('game-canvas');
    gameState.ctx = gameState.canvas.getContext('2d');

    gameState.canvas.height = document.getElementById('game-canvas-container').clientHeight;
    gameState.canvas.width = document.getElementById('game-canvas-container').clientWidth;

    window.addEventListener('keydown', (e) => {
        gameState.keys[e.key] = true;
    })

    window.addEventListener('keyup', (e) => {
        gameState.keys[e.key] = false;
    })

    gameLoop();
    
    nameSetup.classList.add('hidden');
}  

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

function update() {
    if (!gameState.myPlayerId || !gameState.players[gameState.myPlayerId]) return;

    const myPlayer = gameState.players[gameState.myPlayerId];
    let moved = false;

    let oldX = myPlayer.x;
    let oldY = myPlayer.y;

    if (gameState.keys['ArrowUp'] || gameState.keys['w']) {
        myPlayer.y -= 3;
        moved = true;
    }
    if (gameState.keys['ArrowDown'] || gameState.keys['s']) {
        myPlayer.y += 3;
        moved = true;
    }
    if (gameState.keys['ArrowLeft'] || gameState.keys['a']) {
        myPlayer.x -= 3;
        moved = true;
    }
    if (gameState.keys['ArrowRight'] || gameState.keys['d']) {
        myPlayer.x += 3;
        moved = true;
    }
    
    // 화면 경계 체크
    myPlayer.x = Math.max(0, Math.min(gameState.canvas.width - 30, myPlayer.x));
    myPlayer.y = Math.max(0, Math.min(gameState.canvas.height - 30, myPlayer.y));
    

    //선수들간 겹침 방지



    // 이동 시 서버에 알림
    if (moved) {
        if(!isValidPosition(myPlayer.x, myPlayer.y)) {
            myPlayer.x = oldX;
            myPlayer.y = oldY;
            console.log(isValidPosition(myPlayer.x, myPlayer.y));
        }
        socket.emit('playerMove', {
            x: myPlayer.x,
            y: myPlayer.y
        });
    }
}

socket.on('chatMessage', (data) => {
    addChatMessage(data.playerName, data.message, data.timestamp);
});

startGameBtn.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim() || '닉명';
    socket.emit('setPlayerName', {name: playerName});
    initGame();
});

socket.on('playerUpdated', (player) => {
    if (gameState.players[player.id]) {
        gameState.players[player.id] = player;
        updatePlayersList();
    }
});

socket.on('playerLeft', (playerId) => {
    const playerName = gameState.players[playerId]?.name || '익명';
    delete gameState.players[playerId];
    console.log('delete complete');
    updatePlayersList();
    addChatMessage('시스템', `${playerName} 플레이어가 나갔습니다.`, new Date().toLocaleTimeString());
});
 
function render() {
    const ctx = gameState.ctx;
    const canvas = gameState.canvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = 0; y < canvas.height;  y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    ctx.save();
    Object.values(gameState.players).forEach(player => {
        // 그림자만 그리기 (객체는 아님)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(player.x + 25, player.y + 75, 30, 10, 0, 0, Math.PI * 2);
        ctx.fill();
    });


    ctx.restore();
    // if(gameState.players[myPlayerId].x == undefined || gameState.players[myPlayerId].y == undefiend) {
    //     getInitialPostion();
    // }

    Object.values(gameState.players).forEach(player => {
        const playerImage = spriteManager.getImage(player.image);
        // const image = path.join(__dirname, '../assets/' + player.image);
        if(playerImage && playerImage.complete) {
            ctx.drawImage(playerImage, player.x, player.y, 50, 70);
        } else {
            ctx.fillStyle = "#ff6b6b";
            ctx.fillRect(player.x, player.y, 50, 70);
        }

            ctx.strokeStyle = 'red'
            ctx.lineWidth = 1;
    
            ctx.beginPath();
            ctx.moveTo(player.x, player.y - 3);
            ctx.lineTo(player.x + Math.floor(50 * (200) / 300), player.y - 3);
            ctx.stroke();

            ctx.strokeStyle = 'black';
            ctx.beginPath();
            ctx.moveTo(player.x + Math.floor(50 * (200) / 300), player.y - 3);
            ctx.lineTo(player.x + 50, player.y - 3);
            ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.name || '닉명', player.x + 15, player.y - 5);
    });
}

window.addEventListener('resize', () => {
    if (gameState.canvas) {
        gameState.canvas.width = document.getElementById('game-canvas-container').clientWidth;
        gameState.canvas.height = document.getElementById('game-canvas-container').clientHeight;
    }
});


// 작성자 함수

// 움직이려는 위치가 다른 객체들과 겹치지 않는지 검사
function isValidPosition (x, y) {
    let isValid = 1;
    console.log('validFunction');
    for (const player of Object.values(gameState.players)) {
        if (player.id === gameState.myPlayerId)
            continue;
        if((x <= player.x + 50 && x >= player.x - 50) && (y <= player.y + 70 && y >= player.y - 70)) {
            isValid = 0;
            break;
        }
    }
    if(isValid)
        return true;
    else return false;
}