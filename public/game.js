const socket = io();
const spriteManager = new SpriteManager();

const gameState = {
    players: {},
    myPlayerId: null,
    canvas: null,
    ctx: null,
    keys: {},
    timers: {},
    items: {}
};

const nameSetup = document.getElementById('name-setup');
const playerNameInput = document.getElementById('player-name-input');
const startGameBtn = document.getElementById('start-game');
const playersContainer = document.getElementById('players-container');
const chatMessages = document.getElementById('chat-messages');
const itemsContainers = document.getElementsByClassName('item-container');
let itemDy = 0, itemDirection = 1;

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
        gameState.players[playerData.id].direction = playerData.direction;
        gameState.players[playerData.id].crrtStep = playerData.crrtStep;
    }
});

socket.on('playerJoined', (player) => {
    gameState.players[player.id] = player;
    updatePlayersList();
    addChatMessage('System', `${player.name || '닉명'} 선수가 접속하였습니다.`, new Date().toLocaleTimeString());
});

function initGame() {
    console.log('start initGame');

    UIManager.initAll();

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

    let vX = 0, vY = 0;

    if (myPlayer.health > 0) {

        if (gameState.keys['ArrowUp'] || gameState.keys['w']) {
            vY = -1;
            // myPlayer.y -= myPlayer.speed;
            moved = true;
        }
        if (gameState.keys['ArrowDown'] || gameState.keys['s']) {
            vY = 1;
            // myPlayer.y += myPlayer.speed;
            moved = true;
        }
        if (gameState.keys['ArrowLeft'] || gameState.keys['a']) {
            vX = -1;
            // myPlayer.x -= myPlayer.speed;
            moved = true;
            myPlayer.direction = "left";
        }
        if (gameState.keys['ArrowRight'] || gameState.keys['d']) {
            vX = 1;
            // myPlayer.x += myPlayer.speed;
            moved = true;
            myPlayer.direction = "right";
        }
        
        if (gameState.keys['Space'] || gameState.keys[' '] || gameState.keys['Spacebar']) {
            if (gameState.players[gameState.myPlayerId].attackTime === null) {    
                gameState.players[gameState.myPlayerId].attackTime = Date.now();
                socket.emit('attackRequested');
            }
        }

        myPlayer.y += myPlayer.speed * vY * Math.sqrt(2 - vX * vX) / Math.sqrt(2);
        myPlayer.x += myPlayer.speed * vX * Math.sqrt(2 - vY * vY) / Math.sqrt(2);


        // 화면 경계 체크
        myPlayer.x = Math.max(0, Math.min(gameState.canvas.width - 30, myPlayer.x));
        myPlayer.y = Math.max(0, Math.min(gameState.canvas.height - 30, myPlayer.y));
        

        //선수들간 겹침 방지



        // 이동 시 서버에 알림
        if(!isValidPosition(myPlayer.x, myPlayer.y)) {
            myPlayer.x = oldX;
            myPlayer.y = oldY;
        }

        if(!moved)
            myPlayer.crrtStep = 0;
        else {
            myPlayer.crrtStep = 1 + (myPlayer.crrtStep + 1) % 40;
        }

        socket.emit('playerMove', {
            x: myPlayer.x,
            y: myPlayer.y,
            moved: moved,
            direction: myPlayer.direction
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
        if ((player.id == gameState.myPlayerId) || (player.visibility)) {
            // 그림자만 그리기 (객체는 아님)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(player.x + 25, player.y + 75, 30, 10, 0, 0, Math.PI * 2);
            ctx.fill();

            // 공격효과 현시
            if(player.attackTime) {
                let currentTime = Date.now();
                let startTime = player.attackTime;
                if (currentTime - startTime > 300)
                    player.attackTime = null;
                else {
                    radiusX = 100 * (currentTime - startTime) / 300;     
                    radiusY = 15 * (currentTime- startTime) / 300;
                    ctx.fillStyle = 'rgba(247, 240, 48, 0.6)';
                    ctx.beginPath();
                    ctx.ellipse(player.x + 25, player.y + 75, radiusX, radiusY, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    });

    Object.values(gameState.items).forEach(item => {
        // 그림자만 그리기 (객체는 아님)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(item.x + 20, item.y + 50, 20, 10, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    

    
    ctx.restore();
    // if(gameState.players[myPlayerId].x == undefined || gameState.players[myPlayerId].y == undefiend) {
    //     getInitialPostion();
    // }

    if (itemDirection == 1) {
        if (itemDy < 2) {
            itemDy += 0.1;
        }
        else itemDirection = -1;
    } 
    else {
        if (itemDy > 0) {
            itemDy -= 0.1;
        }
        else itemDirection = 1;
    }
    Object.values(gameState.items).forEach(item => {
        const boxImage = spriteManager.getImage(item.boxImage);
        const itemImage = spriteManager.getImage(item.itemImage);
        if (boxImage && boxImage.complete) {
            ctx.drawImage(boxImage, item.x, item.y + itemDy, 40, 40);
        }
    });

    Object.values(gameState.players).forEach(player => {
        if ((player.id == gameState.myPlayerId) || (player.visibility)) {
            let imagePath;
            let playerImage;
            let crrtFrame = Math.ceil(player.crrtStep / 10);
            if (player.health == 0) {
                imagePath = basePath[0] + player.image + extensions[0];
                playerImage = spriteManager.getImage(imagePath);
            }
            else  if (player.health > 0) {
                imagePath = basePath[1 + crrtFrame] + player.image + extensions[1 + crrtFrame];
                playerImage = spriteManager.getImage(imagePath);
            }
            // const image = path.join(__dirname, '../assets/' + player.image);
            if(playerImage && playerImage.complete) {
                if (!player.visibility)
                    ctx.globalAlpha = 0.3;
                if (player.direction === "left") {
                    ctx.save();
                    ctx.scale(-1, 1);
                    ctx.drawImage(playerImage, -player.x - 50, player.y, 50, 70);
                    ctx.restore();
                }
                else {
                    ctx.drawImage(playerImage, player.x, player.y, 50, 70);
                }
                if (ctx.globalAlpha == 0.3)
                    ctx.globalAlpha = 1;
            } else {
                ctx.fillStyle = "#ff6b6b";
                ctx.fillRect(player.x, player.y, 50, 70);
            }
            // 남은 피 현시
            ctx.strokeStyle = 'red'
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(player.x, player.y - 3);
            ctx.lineTo(player.x + Math.floor(50 * (player.health) / 300), player.y - 3);
            ctx.stroke();

            // 줄어든 피 현시    
            ctx.strokeStyle = 'black';
            ctx.beginPath();
            ctx.moveTo(player.x + Math.floor(50 * (player.health) / 300), player.y - 3);
            ctx.lineTo(player.x + 50, player.y - 3);
            ctx.stroke();

            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(player.name || '닉명', player.x + 15, player.y - 5);
        }
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
    for (const player of Object.values(gameState.players)) {
        if (player.id === gameState.myPlayerId)
            continue;
        if((x <= player.x + dx && x >= player.x - dx) && (y <= player.y + dy && y >= player.y - dy)) {
            isValid = 0;
            break;
        }
    }
    if(isValid)
        return true;
    else return false;
}

//일반공격 효과
socket.on('playerIsAttacking', (data) => {
    gameState.players[data.id].attackTime = data.attackTime;
});

socket.on('attackResult', (data) => {
    if (!gameState.players[data.id].visibility) {
        gameState.players[data.id].visibility = 1;
    }

    Object.keys(data.attackedPlayers).forEach(playerId => {
        gameState.players[playerId].health = data.attackedPlayers[playerId];
    });
});

socket.on('itemCreated', (data) => {
    gameState.items = data;
});

socket.on('itemReached', (items) => {
    gameState.items = items;
});

socket.on('itemUpdated', (items) => {
    gameState.players[gameState.myPlayerId].items = items;
    const myPlayerId= gameState.myPlayerId;
    const myPlayer = gameState.players[myPlayerId];
    UIManager.inventory.update(myPlayer.items);
});

socket.on('healthIncreased', (data) => {
    gameState.players[data.id].health = data.health;
    console.log('health 증가');
})

socket.on('movingSpeedChanged', (data) => {
    gameState.players[data.id].speed = data.speed;
})

socket.on('playerVisibility', (data) => {
    gameState.players[data.id].visibility = data.visibility;
});


socket.on('playersRespawned', (playersData) => {
    playersData.forEach(playerData => {
        gameState.players[playerData.id] = playerData.player;
    });
});


const UIManager = {
    inventory: {
        containers: null,

        init() {
            this.containers = document.querySelectorAll('.item-container');
            this.setupEvents();
        },

        setupEvents() {
            this.containers.forEach((container, index) => {
                container.addEventListener('click', () => {
                    this.useItem(index);
                });
            });
        },

        useItem(index) {
            console.log(`아이템 ${index} 사용`);
            socket.emit('itemClicked', index);
        },

        update(playerItems) {
            if (!playerItems)
                return;

            playerItems.forEach((item, index) => {
                this.updateSlot(index, item);
            });

            for (let i = playerItems.length; i < 4; i++) {
                this.clearSlot(i);
            }
        },

        updateSlot(index, item) {
            const container = this.containers[index];
            container.style.backgroundImage = `url('${item.image}')`;
            container.style.backgroundSize = 'cover';
            container.dataset.itemType = item.type;
            
            container.classList.add('item-acquired');
        },

        clearSlot(index) {
            const container = this.containers[index];
            container.style.backgroundImage = 'none';
            container.dataset.itemType = '';
        }    
    },

    
    initAll() {
        this.inventory.init();
    }
}

