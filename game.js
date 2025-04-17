// Game elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const timerElement = document.getElementById('timer');
const goldElement = document.getElementById('gold');
const waveElement = document.getElementById('wave');
const enemiesElement = document.getElementById('enemies');

// Tower buttons
const tower1Button = document.getElementById('tower1');
const tower2Button = document.getElementById('tower2');
const tower3Button = document.getElementById('tower3');
const tower4Button = document.getElementById('tower4');

// Game configuration
const config = {
    gameTime: 120,
    initialGold: 1000,
    enemySpawnRate: 250, // ms between enemies in a wave
    waveCooldown: 5000, // ms between waves
    initialEnemiesPerWave: 10,
    barracksUnitInterval: 6000, // ms, lính tích lũy mỗi 6s
    towerTypes: [
        { id: 1, name: "Archer", cost: 50, damage: 20, range: 120, color: "#3498db", cooldown: 1000 },
        { id: 2, name: "Cannon", cost: 100, damage: 40, range: 100, color: "#e74c3c", cooldown: 2000 },
        { id: 3, name: "Ice", cost: 75, damage: 10, range: 90, color: "#1abc9c", cooldown: 2500 },
        { id: 4, name: "Barracks", cost: 150, range: 80, color: "#f39c12", isBarracks: true }
    ],
    enemyTypes: [
        { name: "Normal", health: 100, speed: 1, reward: 10, color: "#8e44ad", attackRange: 30, attackDamage: 10, attackCooldown: 1200 },
        { name: "Fast", health: 70, speed: 1.5, reward: 15, color: "#3498db", attackRange: 30, attackDamage: 8, attackCooldown: 900 },
        { name: "Tank", health: 200, speed: 0.7, reward: 20, color: "#e74c3c", attackRange: 35, attackDamage: 20, attackCooldown: 1800 }
    ],
    path: [
        {x: 180, y: 0},
        {x: 180, y: 200},
        {x: 100, y: 300},
        {x: 260, y: 400},
        {x: 180, y: 500},
        {x: 180, y: 640}
    ]
};

// Game state
const gameState = {
    isPlaying: false,
    gold: config.initialGold,
    timeRemaining: config.gameTime,
    selectedTower: null,
    towers: [],
    enemies: [],
    units: [],
    projectiles: [],
    enemiesKilled: 0,
    enemiesLeaked: 0,
    mouseX: 0,
    mouseY: 0,
    currentWave: 1,
    enemiesInWave: config.initialEnemiesPerWave,
    enemiesSpawned: 0,
    waveInProgress: false,
    gameOver: false
};

// Helper functions
function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function getPathLength() {
    let len = 0;
    for (let i = 0; i < config.path.length - 1; i++) {
        len += distance(config.path[i].x, config.path[i].y, config.path[i+1].x, config.path[i+1].y);
    }
    return len;
}

function getPathPosition(progress) {
    const pathLength = config.path.length - 1;
    const segment = Math.min(Math.floor(progress * pathLength), pathLength - 1);
    const segmentProgress = (progress * pathLength) - segment;
    
    const startX = config.path[segment].x;
    const startY = config.path[segment].y;
    const endX = config.path[segment + 1].x;
    const endY = config.path[segment + 1].y;
    
    return {
        x: startX + (endX - startX) * segmentProgress,
        y: startY + (endY - startY) * segmentProgress
    };
}

// Tower placement
function canPlaceTower(x, y) {
    // Cho phép đặt trụ toàn màn hình, chỉ kiểm tra không quá gần trụ khác
    for (let tower of gameState.towers) {
        if (distance(x, y, tower.x, tower.y) < 40) return false;
    }
    return true;
}

function placeTower(x, y, towerId) {
    const towerType = config.towerTypes.find(t => t.id === towerId);
    if (!towerType) return;
    
    // Check if enough gold
    if (gameState.gold < towerType.cost) return;
    
    // Check if valid position
    if (!canPlaceTower(x, y)) return;
    
    // Create tower
    const tower = {
        x: x,
        y: y,
        id: towerId,
        type: towerType.name,
        damage: towerType.damage || 0,
        range: towerType.range,
        cooldown: towerType.cooldown || 1000,
        cooldownRemaining: 0,
        color: towerType.color,
        isBarracks: towerType.isBarracks || false,
        cost: towerType.cost,
        // Barracks-specific
        accumulatedUnits: towerType.isBarracks ? 0 : undefined,
        barracksTimer: towerType.isBarracks ? 0 : undefined
    };
    
    gameState.towers.push(tower);
    gameState.gold -= towerType.cost;
    goldElement.textContent = gameState.gold;
}

const SPAWN_POINTS = Array.from({length: 10}, (_, i) => {
    // 10 điểm x đều nhau trên đầu canvas (giả sử canvas.width = 360)
    // Cách đều trong khoảng [30, 330] (để không sát mép)
    return { x: 30 + i * (300 / 9), y: 0 };
});

// Spawn enemy with increasing health based on wave
function spawnEnemy() {
    if (gameState.enemiesSpawned >= gameState.enemiesInWave || gameState.gameOver) return;

    // Calculate stats based on wave (increasing health by 5% per wave)
    const waveMultiplier = 1 + ((gameState.currentWave - 1) * 0.05);

    // Tốc độ quái: wave 1 đi hết màn hình 30s, mỗi wave sau giảm 2s, tối thiểu 5s
    const minTime = 5;
    const timeToFinish = Math.max(30 - (gameState.currentWave - 1) * 2, minTime);
    const enemySpeed = (canvas.height / timeToFinish);

    // Random enemy type
    const enemyTypeIndex = Math.floor(Math.random() * config.enemyTypes.length);
    const enemyType = config.enemyTypes[enemyTypeIndex];

    // Chọn 1 trong 10 điểm spawn
    const spawnIdx = Math.floor(Math.random() * SPAWN_POINTS.length);
    const spawnPoint = SPAWN_POINTS[spawnIdx];

    const enemy = {
        x: spawnPoint.x,
        y: spawnPoint.y,
        health: Math.floor(enemyType.health * waveMultiplier * 1.2),
        maxHealth: Math.floor(enemyType.health * waveMultiplier * 1.2),
        speed: enemySpeed,
        reward: enemyType.reward,
        color: enemyType.color,
        type: enemyType.name,
        attackRange: enemyType.attackRange,
        attackDamage: enemyType.attackDamage,
        attackCooldown: enemyType.attackCooldown,
        attackCooldownRemaining: 0,
        isInCombat: false,
        isStraightDown: true // đánh dấu enemy này đi thẳng xuống
    };

    gameState.enemies.push(enemy);
    gameState.enemiesSpawned++;

    // Update display
    enemiesElement.textContent = gameState.enemies.length + "/" + gameState.enemiesInWave;

    // Schedule next enemy spawn
    if (gameState.enemiesSpawned < gameState.enemiesInWave) {
        setTimeout(spawnEnemy, config.enemySpawnRate);
    }
}

// Start a new wave
function startWave() {
    if (gameState.waveInProgress || gameState.gameOver) return;
    
    gameState.waveInProgress = true;
    gameState.enemiesSpawned = 0;
    
    // Calculate enemies per wave (10 in wave 1, +2 mỗi wave)
    gameState.enemiesInWave = config.initialEnemiesPerWave + (gameState.currentWave - 1) * 2;
    
    // Update display
    waveElement.textContent = gameState.currentWave;
    enemiesElement.textContent = "0/" + gameState.enemiesInWave;
    
    // Start spawning enemies
    spawnEnemy();
}

// Spawn unit (from barracks)
function spawnUnit(x, y) {
    const unit = {
        x: x,
        y: y,
        health: 50,
        maxHealth: 50,
        damage: 15,
        range: 60,
        speed: 1,
        attackCooldown: 800,
        attackCooldownRemaining: 0,
        color: "#f1c40f",
        target: null,
        isInCombat: false
    };
    
    gameState.units.push(unit);
}

// Game end
function endGame(isVictory) {
    gameState.gameOver = true;
    
    if (isVictory) {
        alert("Chiến thắng! Bạn đã sống sót qua tất cả các wave.");
    } else {
        alert("Thất bại! Quá nhiều quái vật đã lọt qua.");
    }
    
    startButton.style.display = 'block';
}

// Game loop variables
let lastTimestamp = 0;
let enemySpawnTimer = 0;
let waveTimer = 0;
let gameTimer = 0;

// Main game loop
function gameLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const delta = (timestamp - lastTimestamp) / 1000; // Convert to seconds
    lastTimestamp = timestamp;

    if (gameState.isPlaying && !gameState.gameOver) {
        // Wave logic
        if (!gameState.waveInProgress) {
            waveTimer += delta * 1000;
            if (waveTimer >= config.waveCooldown) {
                waveTimer = 0;
                startWave();
            }
        } else if (gameState.enemiesSpawned >= gameState.enemiesInWave && gameState.enemies.length === 0) {
            // Wave completed
            gameState.waveInProgress = false;
            gameState.currentWave++;
            waveTimer = 0;

            // Bonus gold for completing wave
            const waveBonus = 50 + (gameState.currentWave * 10);
            gameState.gold += waveBonus;
            goldElement.textContent = gameState.gold;

            // Show wave complete message
            const waveMessage = document.createElement('div');
            waveMessage.textContent = "Wave " + (gameState.currentWave - 1) + " hoàn thành! +" + waveBonus + " vàng";
            waveMessage.style.position = "absolute";
            waveMessage.style.top = "100px";
            waveMessage.style.left = "50%";
            waveMessage.style.transform = "translateX(-50%)";
            waveMessage.style.backgroundColor = "rgba(0,0,0,0.7)";
            waveMessage.style.padding = "10px";
            waveMessage.style.borderRadius = "5px";
            waveMessage.style.color = "white";
            waveMessage.style.zIndex = "100";
            document.getElementById('gameContainer').appendChild(waveMessage);

            // Remove message after 2 seconds
            setTimeout(() => {
                waveMessage.remove();
            }, 2000);

            // Nếu đã qua 10 waves thì kiểm tra điều kiện thắng
            if (gameState.currentWave > 10) {
                if (gameState.enemiesLeaked < 10) {
                    endGame(true); // Victory
                } else {
                    endGame(false); // Defeat
                }
            }
        }

        // Update barracks: accumulate units
        for (let tower of gameState.towers) {
            if (tower.isBarracks) {
                if (typeof tower.barracksTimer !== "number") tower.barracksTimer = 0;
                tower.barracksTimer += delta * 1000;
                while (tower.barracksTimer >= config.barracksUnitInterval) {
                    tower.barracksTimer -= config.barracksUnitInterval;
                    tower.accumulatedUnits = (tower.accumulatedUnits || 0) + 1;
                }
            } else {
                // Update cooldown for other towers
                if (tower.cooldownRemaining > 0) {
                    tower.cooldownRemaining -= delta * 1000;
                }
            }
        }

        // Update towers (attack logic for non-barracks)
        for (let tower of gameState.towers) {
            if (!tower.isBarracks) {
                if (tower.cooldownRemaining > 0) {
                    tower.cooldownRemaining -= delta * 1000;
                } else {
                    // Find closest enemy in range
                    let closestEnemy = null;
                    let minDistance = tower.range;
                    
                    for (let enemy of gameState.enemies) {
                        const dist = distance(tower.x, tower.y, enemy.x, enemy.y);
                        if (dist < minDistance) {
                            minDistance = dist;
                            closestEnemy = enemy;
                        }
                    }
                    
                    if (closestEnemy) {
                        // Attack enemy
                        closestEnemy.health -= tower.damage;
                        tower.cooldownRemaining = tower.cooldown;
                        
                        // Add projectile
                        gameState.projectiles.push({
                            x: tower.x,
                            y: tower.y,
                            targetX: closestEnemy.x,
                            targetY: closestEnemy.y,
                            color: tower.color,
                            timeLeft: 0.2
                        });
                        
                        // Check if enemy died
                        if (closestEnemy.health <= 0) {
                            const index = gameState.enemies.indexOf(closestEnemy);
                            if (index > -1) {
                                gameState.enemies.splice(index, 1);
                                gameState.gold += closestEnemy.reward;
                                goldElement.textContent = gameState.gold;
                                gameState.enemiesKilled++;
                                
                                // Update display
                                enemiesElement.textContent = gameState.enemies.length + "/" + gameState.enemiesInWave;
                            }
                        }
                    }
                }
            }
        }

        // --- Combat logic: Enemy vs Unit ---
        // Reset combat state
        for (let enemy of gameState.enemies) enemy.isInCombat = false;
        for (let unit of gameState.units) unit.isInCombat = false;

        // Enemy attack unit
        for (let i = gameState.enemies.length - 1; i >= 0; i--) {
            const enemy = gameState.enemies[i];
            let attackedUnit = null;
            let minUnitDist = enemy.attackRange;
            for (let j = 0; j < gameState.units.length; j++) {
                const unit = gameState.units[j];
                const dist = distance(enemy.x, enemy.y, unit.x, unit.y);
                if (dist <= enemy.attackRange && dist < minUnitDist) {
                    minUnitDist = dist;
                    attackedUnit = unit;
                }
            }
            if (attackedUnit) {
                enemy.isInCombat = true;
                attackedUnit.isInCombat = true;
                if (enemy.attackCooldownRemaining <= 0) {
                    // Hiển thị máu tiêu hao
                    attackedUnit.lastDamage = enemy.attackDamage;
                    attackedUnit.lastDamageTimer = 0.7; // hiển thị 0.7s
                    attackedUnit.health -= enemy.attackDamage;
                    enemy.attackCooldownRemaining = enemy.attackCooldown;
                }
            }
            if (enemy.attackCooldownRemaining > 0) {
                enemy.attackCooldownRemaining -= delta * 1000;
            }
        }

        // Unit attack enemy
        for (let i = gameState.units.length - 1; i >= 0; i--) {
            const unit = gameState.units[i];
            let attackedEnemy = null;
            let minEnemyDist = unit.range;
            for (let j = 0; j < gameState.enemies.length; j++) {
                const enemy = gameState.enemies[j];
                const dist = distance(unit.x, unit.y, enemy.x, enemy.y);
                if (dist <= unit.range && dist < minEnemyDist) {
                    minEnemyDist = dist;
                    attackedEnemy = enemy;
                }
            }
            if (attackedEnemy) {
                unit.isInCombat = true;
                attackedEnemy.isInCombat = true;
                if (unit.attackCooldownRemaining <= 0) {
                    attackedEnemy.health -= unit.damage;
                    unit.attackCooldownRemaining = unit.attackCooldown;
                }
            }
            if (unit.attackCooldownRemaining > 0) {
                unit.attackCooldownRemaining -= delta * 1000;
            }

            // Check if unit died
            if (unit.health <= 0) {
                gameState.units.splice(i, 1);
                continue;
            }
        }

        // Update enemies (move if not in combat)
        for (let i = gameState.enemies.length - 1; i >= 0; i--) {
            const enemy = gameState.enemies[i];
            if (!enemy.isInCombat) {
                if (enemy.isStraightDown) {
                    enemy.y += enemy.speed * delta;
                } else {
                    enemy.progress += (enemy.speed * delta) / 10;
                    const position = getPathPosition(enemy.progress);
                    enemy.x = position.x;
                    enemy.y = position.y;
                }
            }
            // Check if enemy reached the end
            if (enemy.isStraightDown) {
                if (enemy.y > canvas.height) {
                    gameState.enemies.splice(i, 1);
                    gameState.enemiesLeaked++;
                    // Update display
                    enemiesElement.textContent = gameState.enemies.length + "/" + gameState.enemiesInWave;
                    if (gameState.enemiesLeaked >= 10) {
                        endGame(false); // Game over
                    }
                    continue;
                }
            } else {
                if (enemy.progress >= 1) {
                    gameState.enemies.splice(i, 1);
                    gameState.enemiesLeaked++;
                    // Update display
                    enemiesElement.textContent = gameState.enemies.length + "/" + gameState.enemiesInWave;
                    if (gameState.enemiesLeaked >= 10) {
                        endGame(false); // Game over
                    }
                    continue;
                }
            }
            // Check if enemy died
            if (enemy.health <= 0) {
                gameState.enemies.splice(i, 1);
                gameState.gold += enemy.reward;
                goldElement.textContent = gameState.gold;
                gameState.enemiesKilled++;
                enemiesElement.textContent = gameState.enemies.length + "/" + gameState.enemiesInWave;
            }
        }

        // Update units (move if not in combat)
        for (let i = gameState.units.length - 1; i >= 0; i--) {
            const unit = gameState.units[i];
            if (!unit.isInCombat) {
                // Find target if don't have one
                if (!unit.target || unit.target.health <= 0 || gameState.enemies.indexOf(unit.target) === -1) {
                    unit.target = null;
                    
                    let closestEnemy = null;
                    let minDistance = unit.range * 2;
                    
                    for (let enemy of gameState.enemies) {
                        const dist = distance(unit.x, unit.y, enemy.x, enemy.y);
                        if (dist < minDistance) {
                            minDistance = dist;
                            closestEnemy = enemy;
                        }
                    }
                    
                    unit.target = closestEnemy;
                }
                // Move towards target
                if (unit.target) {
                    const targetDist = distance(unit.x, unit.y, unit.target.x, unit.target.y);
                    if (targetDist > unit.range) {
                        const dx = unit.target.x - unit.x;
                        const dy = unit.target.y - unit.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        unit.x += (dx / len) * unit.speed;
                        unit.y += (dy / len) * unit.speed;
                    }
                } else {
                    // Random movement if no target
                    if (Math.random() < 0.02) {
                        unit.x += (Math.random() - 0.5) * 2;
                        unit.y += (Math.random() - 0.5) * 2;
                        unit.x = Math.max(10, Math.min(canvas.width - 10, unit.x));
                        unit.y = Math.max(10, Math.min(canvas.height - 70, unit.y));
                    }
                }
            }
            // Giảm lastDamageTimer nếu có
            if (unit.lastDamageTimer > 0) {
                unit.lastDamageTimer -= delta;
                if (unit.lastDamageTimer <= 0) {
                    unit.lastDamageTimer = 0;
                    unit.lastDamage = 0;
                }
            }
        }

        // Update projectiles
        for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
            const projectile = gameState.projectiles[i];
            projectile.timeLeft -= delta;
            if (projectile.timeLeft <= 0) {
                gameState.projectiles.splice(i, 1);
            }
        }
    }

    // Draw everything
    draw();

    // Continue the game loop
    requestAnimationFrame(gameLoop);
}

// Draw game state
function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Không vẽ path nữa

    // Không vẽ path border nữa

    // Draw deployment zone line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 320);
    ctx.lineTo(360, 320);
    ctx.stroke();
    
    // Draw towers
    for (let tower of gameState.towers) {
        // Tower base
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Tower color
        ctx.fillStyle = tower.color;
        ctx.beginPath();
        ctx.arc(tower.x, tower.y, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw special symbol for barracks
        if (tower.isBarracks) {
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.moveTo(tower.x - 5, tower.y - 5);
            ctx.lineTo(tower.x + 5, tower.y - 5);
            ctx.lineTo(tower.x, tower.y + 5);
            ctx.closePath();
            ctx.fill();

            // Draw accumulated units
            ctx.fillStyle = 'yellow';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(tower.accumulatedUnits || 0, tower.x, tower.y + 20);
        }
        
        // Draw cooldown indicator (for non-barracks)
        if (!tower.isBarracks && tower.cooldownRemaining > 0) {
            const percent = tower.cooldownRemaining / tower.cooldown;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.moveTo(tower.x, tower.y);
            ctx.arc(tower.x, tower.y, 12, -Math.PI/2, -Math.PI/2 + (1-percent) * Math.PI * 2);
            ctx.closePath();
            ctx.fill();
        }
    }
    
    // Draw units
    for (let unit of gameState.units) {
        // Unit body
        ctx.fillStyle = unit.color;
        ctx.beginPath();
        ctx.arc(unit.x, unit.y, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Unit symbol (sword)
        ctx.fillStyle = 'white';
        ctx.fillRect(unit.x - 1, unit.y - 5, 2, 10);
        ctx.fillRect(unit.x - 3, unit.y - 1, 6, 2);
        
        // Health bar
        const healthPercent = unit.health / unit.maxHealth;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(unit.x - 10, unit.y - 15, 20, 3);
        ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(unit.x - 10, unit.y - 15, 20 * healthPercent, 3);

        // Hiển thị máu tiêu hao nếu có
        if (unit.lastDamage && unit.lastDamageTimer > 0) {
            ctx.fillStyle = 'red';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('-' + unit.lastDamage, unit.x, unit.y - 25);
        }
    }
    
    // Draw projectiles
    for (let projectile of gameState.projectiles) {
        ctx.strokeStyle = projectile.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(projectile.x, projectile.y);
        ctx.lineTo(projectile.targetX, projectile.targetY);
        ctx.stroke();
    }
    
    // Draw enemies
    for (let enemy of gameState.enemies) {
        // Enemy body
        ctx.fillStyle = enemy.color;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Health bar
        const healthPercent = enemy.health / enemy.maxHealth;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(enemy.x - 15, enemy.y - 20, 30, 5);
        ctx.fillStyle = healthPercent > 0.5 ? '#2ecc71' : healthPercent > 0.25 ? '#f39c12' : '#e74c3c';
        ctx.fillRect(enemy.x - 15, enemy.y - 20, 30 * healthPercent, 5);
        
        // Display health value for debugging
        ctx.fillStyle = 'white';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(Math.floor(enemy.health), enemy.x, enemy.y - 25);
    }
    
    // Draw tower preview if selected
    if (gameState.selectedTower && gameState.mouseX && gameState.mouseY) {
        const towerType = config.towerTypes.find(t => t.id === gameState.selectedTower);
        if (towerType && canPlaceTower(gameState.mouseX, gameState.mouseY)) {
            // Vùng đặt trụ màu xanh lá
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            ctx.arc(gameState.mouseX, gameState.mouseY, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.7;

            // Tower base
            ctx.fillStyle = '#7f8c8d';
            ctx.beginPath();
            ctx.arc(gameState.mouseX, gameState.mouseY, 15, 0, Math.PI * 2);
            ctx.fill();
            
            // Tower color
            ctx.fillStyle = towerType.color;
            ctx.beginPath();
            ctx.arc(gameState.mouseX, gameState.mouseY, 12, 0, Math.PI * 2);
            ctx.fill();
            
            // Tower range
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(gameState.mouseX, gameState.mouseY, towerType.range, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.globalAlpha = 1;
        }
    }
    
    // Draw wave timer if not in progress
    if (!gameState.waveInProgress && gameState.isPlaying && !gameState.gameOver) {
        const timeToNextWave = Math.max(0, Math.ceil((config.waveCooldown - waveTimer) / 1000));
        ctx.fillStyle = 'white';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Wave ' + gameState.currentWave + ' bắt đầu sau: ' + timeToNextWave + 's', canvas.width / 2, 130);
    }
    
    // Draw game stats
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Tiêu diệt: ' + gameState.enemiesKilled, 10, 80);
    ctx.fillText('Lọt qua: ' + gameState.enemiesLeaked + '/10', 10, 100);
}

// Start game
function startGame() {
    gameState.isPlaying = true;
    gameState.gold = config.initialGold;
    gameState.towers = [];
    gameState.enemies = [];
    gameState.units = [];
    gameState.projectiles = [];
    gameState.enemiesKilled = 0;
    gameState.enemiesLeaked = 0;
    gameState.currentWave = 1;
    gameState.waveInProgress = false;
    gameState.gameOver = false;

    startButton.style.display = 'none';
    goldElement.textContent = gameState.gold;
    waveElement.textContent = gameState.currentWave;
    enemiesElement.textContent = "0/" + gameState.enemiesInWave;

    // Start first wave after a delay
    setTimeout(startWave, 2000);
}

// Event Listeners
startButton.addEventListener('click', startGame);
 
tower1Button.addEventListener('click', function() {
    if (!gameState.isPlaying || gameState.gameOver) return;
    gameState.selectedTower = 1;
});

tower2Button.addEventListener('click', function() {
    if (!gameState.isPlaying || gameState.gameOver) return;
    gameState.selectedTower = 2;
});

tower3Button.addEventListener('click', function() {
    if (!gameState.isPlaying || gameState.gameOver) return;
    gameState.selectedTower = 3;
});

tower4Button.addEventListener('click', function() {
    if (!gameState.isPlaying || gameState.gameOver) return;
    gameState.selectedTower = 4;
});

// Canvas mouse events
canvas.addEventListener('mousemove', function(event) {
    const rect = canvas.getBoundingClientRect();
    gameState.mouseX = event.clientX - rect.left;
    gameState.mouseY = event.clientY - rect.top;
});

canvas.addEventListener('click', function(event) {
    if (!gameState.isPlaying || gameState.gameOver) return;
    
    if (gameState.selectedTower) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const towerType = config.towerTypes.find(t => t.id === gameState.selectedTower);
        if (towerType && towerType.isBarracks) {
            // Thả lính như xây trụ: kiểm tra đủ vàng, trừ vàng, spawn lính tại vị trí click
            if (gameState.gold >= towerType.cost) {
                spawnUnit(x, y);
                gameState.gold -= towerType.cost;
                goldElement.textContent = gameState.gold;
            }
            // Không reset selectedTower, cho phép thả nhiều lần liên tục
            return;
        }

        // Đặt trụ bình thường
        placeTower(x, y, gameState.selectedTower);
        gameState.selectedTower = null;
    }
});

// Start game loop
requestAnimationFrame(gameLoop);
