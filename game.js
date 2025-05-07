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
    gameTime: 300,
    initialGold: 1000,
    enemySpawnRate: 1000, // ms between enemies in a wave
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

// Slow Spell Configuration
const slowSpellConfig = {
    buttonSize: 15,
    buttonColor: '#e0e0e0',
    buttonText: 'slow',
    get buttonX() { return canvas.width - 10; },
    get buttonY() { return canvas.height - 100; },
    effectRadius: Math.round(125 * 0.7), // 70% của 125
    slowEffect: 0.5,
    duration: 3000, // 3s
    cooldown: 10000, // 10s
    hintOpacity: 0.3
};
const slowSpellState = {
    isSelecting: false, // true khi đã click nút và chờ chọn vị trí
    isOnCooldown: false,
    cooldownRemaining: 0,
    hintX: null,
    hintY: null
};

// --- Stun Spell Configuration ---
const stunSpellConfig = {
    buttonSize: 15,
    buttonColor: '#b0e0ff',
    buttonText: 'stun',
    get buttonX() { return canvas.width - 10; },
    get buttonY() { return slowSpellConfig.buttonY - 30; }, // phía trên slow 30px
    effectRadius: slowSpellConfig.effectRadius,
    duration: 3000,
    cooldown: 10000,
    hintOpacity: 0.3
};
const stunSpellState = {
    isSelecting: false,
    isOnCooldown: false,
    cooldownRemaining: 0,
    hintX: null,
    hintY: null
};

// --- Fire Spell Configuration ---
const fireSpellConfig = {
    buttonSize: 15,
    buttonColor: '#ff9800',
    buttonText: 'fire',
    get buttonX() { return canvas.width - 10; },
    get buttonY() { return stunSpellConfig.buttonY - 30; }, // phía trên stun 30px
    effectRadius: slowSpellConfig.effectRadius,
    damage: 50,
    cooldown: 10000,
    hintOpacity: 0.3
};
const fireSpellState = {
    isSelecting: false,
    isOnCooldown: false,
    cooldownRemaining: 0,
    hintX: null,
    hintY: null
};

// --- Return Spell Configuration ---
const returnSpellConfig = {
    buttonSize: 15,
    buttonColor: '#6c3483',
    buttonText: 'return',
    get buttonX() { return canvas.width - 10; },
    get buttonY() { return fireSpellConfig.buttonY - 30; }, // phía trên fire 30px
    effectRadius: slowSpellConfig.effectRadius,
    duration: 3000,
    cooldown: 10000,
    hintOpacity: 0.3
};
const returnSpellState = {
    isSelecting: false,
    isOnCooldown: false,
    cooldownRemaining: 0,
    hintX: null,
    hintY: null
};

// --- Version ---
const GAME_VERSION = '1.2'; // Tăng lên 0.1 mỗi lần accepted

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
    // Cho phép đặt trụ toàn màn hình (không giới hạn vùng)
    // Check if too close to path
    for (let i = 0; i < config.path.length - 1; i++) {
        const start = config.path[i];
        const end = config.path[i + 1];
        // Calculate distance to line segment
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx*dx + dy*dy);
        const dot = ((x - start.x) * dx + (y - start.y) * dy) / (len * len);
        const closestX = start.x + dot * dx;
        const closestY = start.y + dot * dy;
        const dist = distance(x, y, closestX, closestY);
        if (dist < 5) return false; // đổi từ 40 thành 5
    }
    // Check if too close to other towers
    for (let tower of gameState.towers) {
        if (distance(x, y, tower.x, tower.y) < 10) return false; // đổi từ 40 thành 5
    }
    return true;
}

function placeTower(x, y, towerId) {
    const towerType = config.towerTypes.find(t => t.id === towerId);
    if (!towerType) return;
    if (gameState.towers.length >= 3) return;
    if (gameState.towers.some(t => t.id === towerId)) return;
    if (gameState.gold < towerType.cost) return;
    if (!canPlaceTower(x, y)) return;
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
        accumulatedUnits: towerType.isBarracks ? 0 : undefined,
        barracksTimer: towerType.isBarracks ? 0 : undefined
    };
    gameState.towers.push(tower);
    gameState.gold -= towerType.cost;
    goldElement.textContent = gameState.gold;
    updateTowerButtons();
}

// Spawn enemy with increasing health based on wave
function spawnEnemy() {
    if (gameState.enemiesSpawned >= gameState.enemiesInWave || gameState.gameOver) return;
    
    // Calculate stats based on wave (increasing health by 5% per wave)
    const waveMultiplier = 1 + ((gameState.currentWave - 1) * 0.05);

    // Tính tốc độ quái dựa trên wave: wave 1 đi hết đường 30s, mỗi wave sau giảm 2s, tối thiểu 5s
    const pathLen = getPathLength();
    const minTime = 5;
    const timeToFinish = Math.max(30 - (gameState.currentWave - 1) * 2, minTime);
    const enemySpeed = (pathLen / (timeToFinish * 10)) * 0.2; // tăng tốc độ lên x2 (so với 10%)

    // Random enemy type
    const enemyTypeIndex = Math.floor(Math.random() * config.enemyTypes.length);
    const enemyType = config.enemyTypes[enemyTypeIndex];
    
    const enemy = {
        x: config.path[0].x,
        y: config.path[0].y,
        health: Math.floor(enemyType.health * waveMultiplier),
        maxHealth: Math.floor(enemyType.health * waveMultiplier),
        speed: enemySpeed,
        reward: enemyType.reward,
        color: enemyType.color,
        progress: 0,
        type: enemyType.name,
        attackRange: enemyType.attackRange,
        attackDamage: enemyType.attackDamage,
        attackCooldown: enemyType.attackCooldown,
        attackCooldownRemaining: 0,
        isInCombat: false
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
        // Update game timer
        gameTimer += delta;
        if (gameTimer >= 1) {
            gameTimer = 0;
            gameState.timeRemaining--;
            timerElement.textContent = gameState.timeRemaining;
            
            if (gameState.timeRemaining <= 0) {
                endGame(true); // Victory
            }
        }

        // Wave logic
        if (!gameState.waveInProgress) {
            waveTimer += delta * 1000;
            if (waveTimer >= config.waveCooldown) {
                waveTimer = 0;
                startWave();
            }
        } else if (gameState.enemiesSpawned >= gameState.enemiesInWave) {
            // Wave đã spawn đủ quái, bắt đầu đếm cooldown cho wave tiếp theo
            gameState.waveInProgress = false;
            gameState.currentWave++;
            waveTimer = 0;
            
            // Bonus gold cho hoàn thành wave (giữ nguyên logic cũ)
            const waveBonus = 50 + (gameState.currentWave * 10);
            gameState.gold += waveBonus;
            goldElement.textContent = gameState.gold;
            
            // Hiển thị thông báo hoàn thành wave (giữ nguyên logic cũ)
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
            setTimeout(() => {
                waveMessage.remove();
            }, 2000);
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
                    // --- Trụ 75 vàng: bắn 2 mục tiêu gần nhất ---
                    if (tower.id === 3) { // Ice tower
                        // Tìm tối đa 2 quái gần nhất trong phạm vi
                        let targets = gameState.enemies
                            .map(enemy => ({ enemy, dist: distance(tower.x, tower.y, enemy.x, enemy.y) }))
                            .filter(obj => obj.dist < tower.range)
                            .sort((a, b) => a.dist - b.dist)
                            .slice(0, 2)
                            .map(obj => obj.enemy);
                        if (targets.length > 0) {
                            for (let target of targets) {
                                target.health -= tower.damage;
                                // Add projectile
                                gameState.projectiles.push({
                                    x: tower.x,
                                    y: tower.y,
                                    targetX: target.x,
                                    targetY: target.y,
                                    color: tower.color,
                                    timeLeft: 0.2
                                });
                                // Check if enemy died
                                if (target.health <= 0) {
                                    const index = gameState.enemies.indexOf(target);
                                    if (index > -1) {
                                        gameState.enemies.splice(index, 1);
                                        gameState.gold += target.reward;
                                        goldElement.textContent = gameState.gold;
                                        gameState.enemiesKilled++;
                                        enemiesElement.textContent = gameState.enemies.length + "/" + gameState.enemiesInWave;
                                    }
                                }
                            }
                            tower.cooldownRemaining = tower.cooldown;
                        }
                    }
                    // --- Trụ 100 vàng: bắn 3 lần, lần 4 x2 sát thương ---
                    else if (tower.id === 2) { // Cannon tower
                        if (!tower.shotCount) tower.shotCount = 0;
                        // Tìm quái gần nhất trong phạm vi
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
                            tower.shotCount++;
                            let dmg = tower.damage;
                            if (tower.shotCount === 4) {
                                dmg = tower.damage * 2;
                                tower.shotCount = 0;
                            }
                            closestEnemy.health -= dmg;
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
                                    enemiesElement.textContent = gameState.enemies.length + "/" + gameState.enemiesInWave;
                                }
                            }
                        }
                    }
                    // --- Các trụ khác giữ nguyên logic cũ ---
                    else {
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
                                    enemiesElement.textContent = gameState.enemies.length + "/" + gameState.enemiesInWave;
                                }
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
            // --- Chặn di chuyển/tấn công nếu bị stun ---
            if (enemy.activeEffect && enemy.activeEffect.type === 'stun') {
                continue;
            }
            // --- Nếu bị return, di chuyển ngược hướng với baseSpeed ---
            let moveSpeed = enemy.speed;
            if (enemy.activeEffect && enemy.activeEffect.type === 'return') {
                moveSpeed = -enemy.speed;
            } else if (enemy.activeEffect && enemy.activeEffect.type === 'slow') {
                moveSpeed = enemy.speed * enemy.activeEffect.slowEffect;
            }
            if (!enemy.isInCombat) {
                enemy.progress += (moveSpeed * delta) / 10;
                const position = getPathPosition(enemy.progress);
                enemy.x = position.x;
                enemy.y = position.y;
            }
            // Check if enemy reached the end
            if (enemy.progress >= 1) {
                gameState.enemies.splice(i, 1);
                gameState.enemiesLeaked++;
                
                // Update display
                enemiesElement.textContent = gameState.enemies.length + "/" + gameState.enemiesInWave;
                
                if (gameState.enemiesLeaked >= 10) {
                    endGame(false); // Game over
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

        // Update Slow Spell
        updateSlowSpell(delta);

        // Update Stun Spell
        updateStunSpell(delta);

        // Update Fire Spell
        updateFireSpell(delta);

        // Update Fire Hit Effects
        updateFireHitEffects(delta);

        // Update Return Spell
        updateReturnSpell(delta);
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
    
    // Draw path
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 40;
    ctx.beginPath();
    ctx.moveTo(config.path[0].x, config.path[0].y);
    for (let i = 1; i < config.path.length; i++) {
        ctx.lineTo(config.path[i].x, config.path[i].y);
    }
    ctx.stroke();
    
    // Draw path border
    ctx.strokeStyle = '#6e4223';
    ctx.lineWidth = 42;
    ctx.beginPath();
    ctx.moveTo(config.path[0].x, config.path[0].y);
    for (let i = 1; i < config.path.length; i++) {
        ctx.lineTo(config.path[i].x, config.path[i].y);
    }
    ctx.stroke();
    
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
    ctx.fillText('Tiêu diệt: ' + gameState.enemiesKilled + '   v' + GAME_VERSION, 10, 80);
    ctx.fillText('Lọt qua: ' + gameState.enemiesLeaked + '/10', 10, 100);

    // Draw Slow Spell Button
    drawSlowSpellButton(ctx);
    drawSlowSpellHint(ctx);
    drawSlowEffectIndicators(ctx);

    // Draw Stun Spell Button
    drawStunSpellButton(ctx);
    drawStunSpellHint(ctx);
    drawStunEffectIndicators(ctx);

    // Draw Fire Spell Button
    drawFireSpellButton(ctx);
    drawFireSpellHint(ctx);

    // Draw Fire Hit Effects
    for (const enemy of gameState.enemies) {
        if (enemy.fireFlash && enemy.fireFlash > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, enemy.fireFlash * 3);
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, 16, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,180,0.7)';
            ctx.fill();
            ctx.restore();
        }
    }

    // Draw Return Spell Button
    drawReturnSpellButton(ctx);
    drawReturnSpellHint(ctx);
}

// Draw Slow Spell Button
function drawSlowSpellButton(ctx) {
    ctx.save();
    ctx.fillStyle = slowSpellState.isOnCooldown ? '#808080' : slowSpellConfig.buttonColor;
    ctx.beginPath();
    ctx.arc(slowSpellConfig.buttonX, slowSpellConfig.buttonY, slowSpellConfig.buttonSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slowSpellConfig.buttonText, slowSpellConfig.buttonX, slowSpellConfig.buttonY);
    if (slowSpellState.isOnCooldown) {
        const percent = slowSpellState.cooldownRemaining / slowSpellConfig.cooldown;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(slowSpellConfig.buttonX, slowSpellConfig.buttonY);
        ctx.arc(slowSpellConfig.buttonX, slowSpellConfig.buttonY, slowSpellConfig.buttonSize, -Math.PI/2, -Math.PI/2 + (1-percent)*Math.PI*2);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

// Draw Slow Spell Hint
function drawSlowSpellHint(ctx) {
    if (!slowSpellState.isSelecting || slowSpellState.hintX === null || slowSpellState.hintY === null) return;
    ctx.save();
    ctx.globalAlpha = slowSpellConfig.hintOpacity;
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(slowSpellState.hintX, slowSpellState.hintY, slowSpellConfig.effectRadius, 0, Math.PI * 2);
    ctx.stroke();
    // Vòng tròn xoay
    const rotation = (Date.now() % 1000) / 1000 * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(slowSpellState.hintX, slowSpellState.hintY, slowSpellConfig.effectRadius, rotation, rotation + Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
}

// Draw Slow Effect Indicators
function drawSlowEffectIndicators(ctx) {
    for (const enemy of gameState.enemies) {
        if (enemy.isSlowed) {
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,0,0.9)';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('!', enemy.x, enemy.y - 25);
            ctx.restore();
        }
    }
}

// Update Slow Spell
function updateSlowSpell(delta) {
    // Cooldown
    if (slowSpellState.isOnCooldown) {
        slowSpellState.cooldownRemaining -= delta * 1000;
        if (slowSpellState.cooldownRemaining <= 0) {
            slowSpellState.isOnCooldown = false;
            slowSpellState.cooldownRemaining = 0;
        }
    }
    // Remove slow effect
    const now = Date.now();
    for (const enemy of gameState.enemies) {
        if (enemy.isSlowed && enemy.slowEndTime && now > enemy.slowEndTime) {
            enemy.speed = enemy.originalSpeed || enemy.speed;
            enemy.isSlowed = false;
        }
    }
}

// Draw Stun Spell Button
function drawStunSpellButton(ctx) {
    ctx.save();
    ctx.fillStyle = stunSpellState.isOnCooldown ? '#7fa6b8' : stunSpellConfig.buttonColor;
    ctx.beginPath();
    ctx.arc(stunSpellConfig.buttonX, stunSpellConfig.buttonY, stunSpellConfig.buttonSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stunSpellConfig.buttonText, stunSpellConfig.buttonX, stunSpellConfig.buttonY);
    if (stunSpellState.isOnCooldown) {
        const percent = stunSpellState.cooldownRemaining / stunSpellConfig.cooldown;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(stunSpellConfig.buttonX, stunSpellConfig.buttonY);
        ctx.arc(stunSpellConfig.buttonX, stunSpellConfig.buttonY, stunSpellConfig.buttonSize, -Math.PI/2, -Math.PI/2 + (1-percent)*Math.PI*2);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

// Draw Stun Spell Hint
function drawStunSpellHint(ctx) {
    if (!stunSpellState.isSelecting || stunSpellState.hintX === null || stunSpellState.hintY === null) return;
    ctx.save();
    ctx.globalAlpha = stunSpellConfig.hintOpacity;
    ctx.strokeStyle = '#7fa6b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(stunSpellState.hintX, stunSpellState.hintY, stunSpellConfig.effectRadius, 0, Math.PI * 2);
    ctx.stroke();
    // Vòng tròn xoay
    const rotation = (Date.now() % 1000) / 1000 * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(stunSpellState.hintX, stunSpellState.hintY, stunSpellConfig.effectRadius, rotation, rotation + Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
}

// Draw Stun Effect Indicators
function drawStunEffectIndicators(ctx) {
    for (const enemy of gameState.enemies) {
        if (enemy.activeEffect && enemy.activeEffect.type === 'stun') {
            ctx.save();
            ctx.fillStyle = 'rgba(0,200,255,0.9)';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Z', enemy.x, enemy.y - 25);
            ctx.restore();
        }
    }
}

// Update Stun Spell
function updateStunSpell(delta) {
    if (stunSpellState.isOnCooldown) {
        stunSpellState.cooldownRemaining -= delta * 1000;
        if (stunSpellState.cooldownRemaining <= 0) {
            stunSpellState.isOnCooldown = false;
            stunSpellState.cooldownRemaining = 0;
        }
    }
    // Remove stun effect nếu hết hạn
    const now = Date.now();
    for (const enemy of gameState.enemies) {
        if (enemy.activeEffect && enemy.activeEffect.type === 'stun' && now > enemy.activeEffect.endTime) {
            enemy.activeEffect = null;
        }
    }
}

// Handle Slow Spell Mouse Events
canvas.addEventListener('mousedown', function(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Nếu đang chọn vị trí, click lên canvas để kích hoạt spell
    if (slowSpellState.isSelecting && !slowSpellState.isOnCooldown) {
        // Không cho phép click lại vào nút
        const distBtn = Math.sqrt((x - slowSpellConfig.buttonX) ** 2 + (y - slowSpellConfig.buttonY) ** 2);
        if (distBtn > slowSpellConfig.buttonSize + 2) {
            // Kích hoạt spell tại vị trí x, y
            for (const enemy of gameState.enemies) {
                const dist = Math.sqrt((enemy.x - x) ** 2 + (enemy.y - y) ** 2);
                if (dist <= slowSpellConfig.effectRadius) {
                    if (!enemy.isSlowed) {
                        enemy.originalSpeed = enemy.speed;
                        enemy.speed = enemy.speed * slowSpellConfig.slowEffect;
                        enemy.isSlowed = true;
                        enemy.slowEndTime = Date.now() + slowSpellConfig.duration;
                    } else {
                        enemy.slowEndTime = Date.now() + slowSpellConfig.duration;
                    }
                }
            }
            slowSpellState.isSelecting = false;
            slowSpellState.isOnCooldown = true;
            slowSpellState.cooldownRemaining = slowSpellConfig.cooldown;
            slowSpellState.hintX = null;
            slowSpellState.hintY = null;
        }
        return;
    }
    // Nếu click vào nút slow và không cooldown thì chuyển sang trạng thái chọn vị trí
    const dist = Math.sqrt((x - slowSpellConfig.buttonX) ** 2 + (y - slowSpellConfig.buttonY) ** 2);
    if (!slowSpellState.isOnCooldown && dist <= slowSpellConfig.buttonSize) {
        slowSpellState.isSelecting = true;
        slowSpellState.hintX = x;
        slowSpellState.hintY = y;
    }
});

canvas.addEventListener('mousemove', function(event) {
    if (!slowSpellState.isSelecting) return;
    const rect = canvas.getBoundingClientRect();
    slowSpellState.hintX = event.clientX - rect.left;
    slowSpellState.hintY = event.clientY - rect.top;
});

// --- Mouse events cho stunspell ---
canvas.addEventListener('mousedown', function(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Stun spell
    if (stunSpellState.isSelecting && !stunSpellState.isOnCooldown) {
        const distBtn = Math.sqrt((x - stunSpellConfig.buttonX) ** 2 + (y - stunSpellConfig.buttonY) ** 2);
        if (distBtn > stunSpellConfig.buttonSize + 2) {
            for (const enemy of gameState.enemies) {
                const dist = Math.sqrt((enemy.x - x) ** 2 + (enemy.y - y) ** 2);
                if (dist <= stunSpellConfig.effectRadius) {
                    // Overwrite hiệu ứng cũ
                    enemy.activeEffect = null;
                    enemy.activeEffect = {
                        type: 'stun',
                        endTime: Date.now() + stunSpellConfig.duration
                    };
                }
            }
            stunSpellState.isSelecting = false;
            stunSpellState.isOnCooldown = true;
            stunSpellState.cooldownRemaining = stunSpellConfig.cooldown;
            stunSpellState.hintX = null;
            stunSpellState.hintY = null;
        }
        return;
    }
    if (!stunSpellState.isOnCooldown && Math.sqrt((x - stunSpellConfig.buttonX) ** 2 + (y - stunSpellConfig.buttonY) ** 2) <= stunSpellConfig.buttonSize) {
        stunSpellState.isSelecting = true;
        stunSpellState.hintX = x;
        stunSpellState.hintY = y;
        return;
    }
});
canvas.addEventListener('mousemove', function(event) {
    const rect = canvas.getBoundingClientRect();
    if (stunSpellState.isSelecting) {
        stunSpellState.hintX = event.clientX - rect.left;
        stunSpellState.hintY = event.clientY - rect.top;
    }
});

// Start game
function startGame() {
    gameState.isPlaying = true;
    gameState.gold = config.initialGold;
    gameState.timeRemaining = config.gameTime;
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
    timerElement.textContent = gameState.timeRemaining;
    goldElement.textContent = gameState.gold;
    waveElement.textContent = gameState.currentWave;
    enemiesElement.textContent = "0/" + gameState.enemiesInWave;
    updateTowerButtons();
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

// --- Vô hiệu hóa button trụ đã xây ---
function updateTowerButtons() {
    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById('tower' + i);
        if (!btn) continue;
        if (gameState.towers.some(t => t.id === i)) {
            btn.disabled = true;
            btn.style.opacity = 0.5;
            btn.style.cursor = 'not-allowed';
        } else {
            btn.disabled = false;
            btn.style.opacity = 1;
            btn.style.cursor = 'pointer';
        }
    }
}

// Draw Fire Spell Button
function drawFireSpellButton(ctx) {
    ctx.save();
    ctx.fillStyle = fireSpellState.isOnCooldown ? '#b26a00' : fireSpellConfig.buttonColor;
    ctx.beginPath();
    ctx.arc(fireSpellConfig.buttonX, fireSpellConfig.buttonY, fireSpellConfig.buttonSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fireSpellConfig.buttonText, fireSpellConfig.buttonX, fireSpellConfig.buttonY);
    if (fireSpellState.isOnCooldown) {
        const percent = fireSpellState.cooldownRemaining / fireSpellConfig.cooldown;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(fireSpellConfig.buttonX, fireSpellConfig.buttonY);
        ctx.arc(fireSpellConfig.buttonX, fireSpellConfig.buttonY, fireSpellConfig.buttonSize, -Math.PI/2, -Math.PI/2 + (1-percent)*Math.PI*2);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

// Draw Fire Spell Hint
function drawFireSpellHint(ctx) {
    if (!fireSpellState.isSelecting || fireSpellState.hintX === null || fireSpellState.hintY === null) return;
    ctx.save();
    ctx.globalAlpha = fireSpellConfig.hintOpacity;
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fireSpellState.hintX, fireSpellState.hintY, fireSpellConfig.effectRadius, 0, Math.PI * 2);
    ctx.stroke();
    // Vòng tròn xoay
    const rotation = (Date.now() % 1000) / 1000 * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(fireSpellState.hintX, fireSpellState.hintY, fireSpellConfig.effectRadius, rotation, rotation + Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
}

// Update Fire Spell
function updateFireSpell(delta) {
    if (fireSpellState.isOnCooldown) {
        fireSpellState.cooldownRemaining -= delta * 1000;
        if (fireSpellState.cooldownRemaining <= 0) {
            fireSpellState.isOnCooldown = false;
            fireSpellState.cooldownRemaining = 0;
        }
    }
}

// Update Fire Hit Effects
function updateFireHitEffects(delta) {
    for (const enemy of gameState.enemies) {
        if (enemy.fireFlash && enemy.fireFlash > 0) {
            enemy.fireFlash -= delta;
            if (enemy.fireFlash < 0) enemy.fireFlash = 0;
        }
    }
}

// Handle Fire Spell Mouse Events
canvas.addEventListener('mousedown', function(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Fire spell
    if (fireSpellState.isSelecting && !fireSpellState.isOnCooldown) {
        const distBtn = Math.sqrt((x - fireSpellConfig.buttonX) ** 2 + (y - fireSpellConfig.buttonY) ** 2);
        if (distBtn > fireSpellConfig.buttonSize + 2) {
            for (const enemy of gameState.enemies) {
                const dist = Math.sqrt((enemy.x - x) ** 2 + (enemy.y - y) ** 2);
                if (dist <= fireSpellConfig.effectRadius) {
                    enemy.health -= fireSpellConfig.damage;
                    enemy.fireFlash = 0.3;
                    if (enemy.health <= 0) {
                        const index = gameState.enemies.indexOf(enemy);
                        if (index > -1) {
                            gameState.enemies.splice(index, 1);
                            gameState.gold += enemy.reward;
                            goldElement.textContent = gameState.gold;
                            gameState.enemiesKilled++;
                            enemiesElement.textContent = gameState.enemies.length + "/" + gameState.enemiesInWave;
                        }
                    }
                }
            }
            fireSpellState.isSelecting = false;
            fireSpellState.isOnCooldown = true;
            fireSpellState.cooldownRemaining = fireSpellConfig.cooldown;
            fireSpellState.hintX = null;
            fireSpellState.hintY = null;
        }
        return;
    }
    if (!fireSpellState.isOnCooldown && Math.sqrt((x - fireSpellConfig.buttonX) ** 2 + (y - fireSpellConfig.buttonY) ** 2) <= fireSpellConfig.buttonSize) {
        fireSpellState.isSelecting = true;
        fireSpellState.hintX = x;
        fireSpellState.hintY = y;
        return;
    }
});

canvas.addEventListener('mousemove', function(event) {
    const rect = canvas.getBoundingClientRect();
    if (fireSpellState.isSelecting) {
        fireSpellState.hintX = event.clientX - rect.left;
        fireSpellState.hintY = event.clientY - rect.top;
    }
});

// Draw Return Spell Button
function drawReturnSpellButton(ctx) {
    ctx.save();
    ctx.fillStyle = returnSpellState.isOnCooldown ? '#4a235a' : returnSpellConfig.buttonColor;
    ctx.beginPath();
    ctx.arc(returnSpellConfig.buttonX, returnSpellConfig.buttonY, returnSpellConfig.buttonSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(returnSpellConfig.buttonText, returnSpellConfig.buttonX, returnSpellConfig.buttonY);
    if (returnSpellState.isOnCooldown) {
        const percent = returnSpellState.cooldownRemaining / returnSpellConfig.cooldown;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(returnSpellConfig.buttonX, returnSpellConfig.buttonY);
        ctx.arc(returnSpellConfig.buttonX, returnSpellConfig.buttonY, returnSpellConfig.buttonSize, -Math.PI/2, -Math.PI/2 + (1-percent)*Math.PI*2);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

// Draw Return Spell Hint
function drawReturnSpellHint(ctx) {
    if (!returnSpellState.isSelecting || returnSpellState.hintX === null || returnSpellState.hintY === null) return;
    ctx.save();
    ctx.globalAlpha = returnSpellConfig.hintOpacity;
    ctx.strokeStyle = '#6c3483';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(returnSpellState.hintX, returnSpellState.hintY, returnSpellConfig.effectRadius, 0, Math.PI * 2);
    ctx.stroke();
    // Vòng tròn xoay
    const rotation = (Date.now() % 1000) / 1000 * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(returnSpellState.hintX, returnSpellState.hintY, returnSpellConfig.effectRadius, rotation, rotation + Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
}

// Update Return Spell
function updateReturnSpell(delta) {
    if (returnSpellState.isOnCooldown) {
        returnSpellState.cooldownRemaining -= delta * 1000;
        if (returnSpellState.cooldownRemaining <= 0) {
            returnSpellState.isOnCooldown = false;
            returnSpellState.cooldownRemaining = 0;
        }
    }
    // Remove return effect nếu hết hạn
    const now = Date.now();
    for (const enemy of gameState.enemies) {
        if (enemy.activeEffect && enemy.activeEffect.type === 'return' && now > enemy.activeEffect.endTime) {
            if (enemy.activeEffect.originalColor) {
                enemy.color = enemy.activeEffect.originalColor;
            }
            enemy.activeEffect = null;
        }
    }
}

// --- Mouse events cho returnspell ---
canvas.addEventListener('mousedown', function(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    // Return spell
    if (returnSpellState.isSelecting && !returnSpellState.isOnCooldown) {
        const distBtn = Math.sqrt((x - returnSpellConfig.buttonX) ** 2 + (y - returnSpellConfig.buttonY) ** 2);
        if (distBtn > returnSpellConfig.buttonSize + 2) {
            for (const enemy of gameState.enemies) {
                const dist = Math.sqrt((enemy.x - x) ** 2 + (enemy.y - y) ** 2);
                if (dist <= returnSpellConfig.effectRadius) {
                    // Overwrite hiệu ứng cũ
                    enemy.activeEffect = null;
                    enemy.activeEffect = {
                        type: 'return',
                        endTime: Date.now() + returnSpellConfig.duration,
                        originalColor: enemy.color
                    };
                    enemy.color = '#111'; // chuyển sang màu đen
                }
            }
            returnSpellState.isSelecting = false;
            returnSpellState.isOnCooldown = true;
            returnSpellState.cooldownRemaining = returnSpellConfig.cooldown;
            returnSpellState.hintX = null;
            returnSpellState.hintY = null;
        }
        return;
    }
    if (!returnSpellState.isOnCooldown && Math.sqrt((x - returnSpellConfig.buttonX) ** 2 + (y - returnSpellConfig.buttonY) ** 2) <= returnSpellConfig.buttonSize) {
        returnSpellState.isSelecting = true;
        returnSpellState.hintX = x;
        returnSpellState.hintY = y;
        return;
    }
});

canvas.addEventListener('mousemove', function(event) {
    const rect = canvas.getBoundingClientRect();
    if (returnSpellState.isSelecting) {
        returnSpellState.hintX = event.clientX - rect.left;
        returnSpellState.hintY = event.clientY - rect.top;
    }
});
