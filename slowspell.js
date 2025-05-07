// Slow Spell Configuration
const slowSpellConfig = {
    buttonSize: 15,
    buttonColor: '#e0e0e0', // Light gray
    buttonText: 'slow',
    buttonPosition: {
        x: 350, // 360 - 10 (right edge - margin)
        y: 540  // 640 - 100 (bottom edge - margin)
    },
    effectRadius: 25, // 50px diameter = 25px radius
    slowEffect: 0.5, // 50% speed reduction
    duration: 5000, // 5 seconds
    cooldown: 45000, // 45 seconds
    hintOpacity: 0.3
};

// Slow Spell State
const slowSpellState = {
    isDragging: false,
    isOnCooldown: false,
    cooldownRemaining: 0,
    activeEffects: [] // Array of active slow effects
};

// Initialize Slow Spell
function initSlowSpell(canvas, ctx) {
    // Add event listeners for drag and drop
    canvas.addEventListener('mousedown', handleSlowSpellMouseDown);
    canvas.addEventListener('mousemove', handleSlowSpellMouseMove);
    canvas.addEventListener('mouseup', handleSlowSpellMouseUp);
}

// Draw Slow Spell Button
function drawSlowSpellButton(ctx) {
    // Draw button background
    ctx.fillStyle = slowSpellState.isOnCooldown ? '#808080' : slowSpellConfig.buttonColor;
    ctx.beginPath();
    ctx.arc(slowSpellConfig.buttonPosition.x, slowSpellConfig.buttonPosition.y, 
            slowSpellConfig.buttonSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw button text
    ctx.fillStyle = '#000000';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slowSpellConfig.buttonText, 
                 slowSpellConfig.buttonPosition.x, 
                 slowSpellConfig.buttonPosition.y);

    // Draw cooldown indicator if on cooldown
    if (slowSpellState.isOnCooldown) {
        const percent = slowSpellState.cooldownRemaining / slowSpellConfig.cooldown;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.moveTo(slowSpellConfig.buttonPosition.x, slowSpellConfig.buttonPosition.y);
        ctx.arc(slowSpellConfig.buttonPosition.x, slowSpellConfig.buttonPosition.y, 
                slowSpellConfig.buttonSize, -Math.PI/2, -Math.PI/2 + (1-percent) * Math.PI * 2);
        ctx.closePath();
        ctx.fill();
    }
}

// Handle mouse down on slow spell button
function handleSlowSpellMouseDown(event) {
    if (slowSpellState.isOnCooldown) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const dist = Math.sqrt(
        Math.pow(x - slowSpellConfig.buttonPosition.x, 2) + 
        Math.pow(y - slowSpellConfig.buttonPosition.y, 2)
    );

    if (dist <= slowSpellConfig.buttonSize) {
        slowSpellState.isDragging = true;
        slowSpellState.dragStartX = x;
        slowSpellState.dragStartY = y;
    }
}

// Handle mouse move during slow spell drag
function handleSlowSpellMouseMove(event) {
    if (!slowSpellState.isDragging) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Draw hint circle at current position
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw(); // Redraw game state
    drawSlowSpellButton(ctx);

    // Draw hint circle
    ctx.strokeStyle = `rgba(200, 200, 200, ${slowSpellConfig.hintOpacity})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, slowSpellConfig.effectRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw rotating circle
    const rotation = (Date.now() % 1000) / 1000 * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x, y, slowSpellConfig.effectRadius, rotation, rotation + Math.PI * 1.5);
    ctx.stroke();
}

// Handle mouse up to activate slow spell
function handleSlowSpellMouseUp(event) {
    if (!slowSpellState.isDragging) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Activate slow effect
    activateSlowEffect(x, y);

    // Start cooldown
    slowSpellState.isOnCooldown = true;
    slowSpellState.cooldownRemaining = slowSpellConfig.cooldown;

    // Reset drag state
    slowSpellState.isDragging = false;
}

// Activate slow effect at position
function activateSlowEffect(x, y) {
    // Find enemies in range
    const affectedEnemies = gameState.enemies.filter(enemy => {
        const dist = Math.sqrt(
            Math.pow(enemy.x - x, 2) + 
            Math.pow(enemy.y - y, 2)
        );
        return dist <= slowSpellConfig.effectRadius;
    });

    // Apply slow effect to each enemy
    affectedEnemies.forEach(enemy => {
        // Store original speed
        const originalSpeed = enemy.speed;
        
        // Apply slow effect
        enemy.speed *= slowSpellConfig.slowEffect;
        enemy.isSlowed = true;
        enemy.slowEndTime = Date.now() + slowSpellConfig.duration;

        // Add to active effects
        slowSpellState.activeEffects.push({
            enemy: enemy,
            originalSpeed: originalSpeed,
            endTime: Date.now() + slowSpellConfig.duration
        });
    });
}

// Update slow spell effects
function updateSlowSpell(delta) {
    // Update cooldown
    if (slowSpellState.isOnCooldown) {
        slowSpellState.cooldownRemaining -= delta * 1000;
        if (slowSpellState.cooldownRemaining <= 0) {
            slowSpellState.isOnCooldown = false;
            slowSpellState.cooldownRemaining = 0;
        }
    }

    // Update active effects
    const currentTime = Date.now();
    slowSpellState.activeEffects = slowSpellState.activeEffects.filter(effect => {
        if (currentTime >= effect.endTime) {
            // Restore original speed
            effect.enemy.speed = effect.originalSpeed;
            effect.enemy.isSlowed = false;
            return false;
        }
        return true;
    });
}

// Draw slow effect indicators on enemies
function drawSlowEffectIndicators(ctx) {
    slowSpellState.activeEffects.forEach(effect => {
        const enemy = effect.enemy;
        // Draw slow indicator (dot) above enemy
        ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y - 20, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Export functions for use in main game
export {
    initSlowSpell,
    drawSlowSpellButton,
    updateSlowSpell,
    drawSlowEffectIndicators
}; 