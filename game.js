const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    // Subtract header height (assume 80px for h1 and margin)
    canvas.height = window.innerHeight - 80;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const car = {
    width: 40,
    height: 70,
    angle: 0,
    speed: 0,
    maxSpeed: 5,
    acceleration: 0.2,
    friction: 0.02,
    turnSpeed: 3,
    driftTurnSpeed: 6,
    worldX: 0,
    worldY: 0,
    vx: 0,
    vy: 0,
    steer: 0 // for smooth turning
};

const keys = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
    Space: false
};

document.addEventListener('keydown', (e) => {
    if (e.code in keys) keys[e.code] = true;
});
document.addEventListener('keyup', (e) => {
    if (e.code in keys) keys[e.code] = false;
});

// Remove boundary constraints and add world offset for infinite world
let worldOffsetX = 0;
let worldOffsetY = 0;

// Drift and visual effects
let tireMarks = [];
let smokeParticles = [];
let wasDrifting = false;

import { buildings, zones } from './buildings.js';

// Friction zones
const zoneTypes = {
    grass: { friction: 0.04, grip: 0.12, color: '#3a5' },
    sand: { friction: 0.08, grip: 0.08, color: '#dbb' }
};

// Damage system
let carHealth = 100;
let lastCollisionTime = 0;
let playerHealth = 100;

// Sparks
let sparks = [];
function spawnSparks(x, y, angle) {
    for (let i = 0; i < 12; i++) {
        let a = angle + (Math.random() - 0.5) * Math.PI / 2;
        let speed = 3 + Math.random() * 2;
        sparks.push({
            x, y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            alpha: 1,
            life: 20 + Math.random() * 10
        });
    }
}

function checkCollision(rect, carX, carY, carAngle, carW, carH) {
    // Get car corners after rotation
    let rad = carAngle * Math.PI / 180;
    let cos = Math.cos(rad), sin = Math.sin(rad);
    let hw = carW / 2, hh = carH / 2;
    let corners = [
        { x: carX + (-hw) * cos - (-hh) * sin, y: carY + (-hw) * sin + (-hh) * cos }, // topleft
        { x: carX + (hw) * cos - (-hh) * sin, y: carY + (hw) * sin + (-hh) * cos }, // topright
        { x: carX + (hw) * cos - (hh) * sin, y: carY + (hw) * sin + (hh) * cos }, // botright
        { x: carX + (-hw) * cos - (hh) * sin, y: carY + (-hw) * sin + (hh) * cos }  // botleft
    ];
    // Axis-Aligned Bounding Box (AABB) for building
    let rx = rect.x, ry = rect.y, rw = rect.width, rh = rect.height;
    // Check if any car corner is inside the building
    for (let c of corners) {
        if (c.x > rx && c.x < rx + rw && c.y > ry && c.y < ry + rh) return true;
    }
    // Check if any building corner is inside the car
    let buildingCorners = [
        { x: rx, y: ry },
        { x: rx + rw, y: ry },
        { x: rx + rw, y: ry + rh },
        { x: rx, y: ry + rh }
    ];
    for (let b of buildingCorners) {
        // Transform building corner to car local space
        let dx = b.x - carX, dy = b.y - carY;
        let localX = dx * cos + dy * sin;
        let localY = -dx * sin + dy * cos;
        if (Math.abs(localX) < hw && Math.abs(localY) < hh) return true;
    }
    return false;
}

function resolveCollision(car, building) {
    // Find the closest point on the building to the car center
    let closestX = Math.max(building.x, Math.min(car.worldX, building.x + building.width));
    let closestY = Math.max(building.y, Math.min(car.worldY, building.y + building.height));
    // Vector from car to closest point
    let dx = car.worldX - closestX;
    let dy = car.worldY - closestY;
    let dist = Math.sqrt(dx * dx + dy * dy) || 1;
    // Nudge car away from building
    let nudgeDist = 2;
    car.worldX += (dx / dist) * nudgeDist;
    car.worldY += (dy / dist) * nudgeDist;
    // Project velocity onto normal and tangent
    let normalX = dx / dist, normalY = dy / dist;
    let dot = car.vx * normalX + car.vy * normalY;
    // Elastic bounce: reflect velocity off normal
    let bounciness = 0.5; // 0 = no bounce, 1 = perfect bounce
    car.vx = car.vx - (1 + bounciness) * dot * normalX;
    car.vy = car.vy - (1 + bounciness) * dot * normalY;
    // Apply wall friction to tangent
    car.vx *= 0.85;
    car.vy *= 0.85;
    // Damage system
    let now = Date.now();
    if (now - lastCollisionTime > 300) {
        carHealth -= Math.min(20, Math.abs(dot) * 8);
        if (carHealth < 0) carHealth = 0;
        lastCollisionTime = now;
        let impactAngle = Math.atan2(normalY, normalX);
        spawnSparks(closestX, closestY, impactAngle);
    }
}

// Car image
const carImg = new window.Image();
carImg.src = 'images/cars/car1.png';

// Preload all building images
const buildingImgs = {};
for (const b of buildings) {
    if (b.img && !buildingImgs[b.img]) {
        const img = new window.Image();
        img.src = b.img;
        buildingImgs[b.img] = img;
    }
}

// Player state: in car or on foot
let inCar = true;
const player = {
    x: 0,
    y: 0,
    radius: 10,
    speed: 2
};

// Listen for E to enter/exit car
let canToggleCar = true;
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && canToggleCar) {
        if (inCar) {
            // Exit car: place player at left side of car (perpendicular to car angle)
            const angleRad = car.angle * Math.PI / 180;
            const exitDistance = (car.width / 2 + player.radius) * 2;
            player.x = car.worldX + Math.cos(angleRad - Math.PI / 2) * exitDistance;
            player.y = car.worldY + Math.sin(angleRad - Math.PI / 2) * exitDistance;
            inCar = false;
            car.vx = 0;
            car.vy = 0;
        } else {
            // Try to enter car if close enough
            const dx = player.x - car.worldX;
            const dy = player.y - car.worldY;
            if (Math.sqrt(dx*dx + dy*dy) < 80) {
                inCar = true;
            }
        }
        canToggleCar = false;
    }
});
document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyE') canToggleCar = true;
});

function circleRectCollision(cx, cy, cr, rx, ry, rw, rh) {
    // Find closest point to circle center within the rectangle
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    // Calculate distance from circle center to closest point
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
}

function circleCarCollision(px, py, pr, car) {
    // Use car's rotated rectangle for collision
    let rad = car.angle * Math.PI / 180;
    let cos = Math.cos(rad), sin = Math.sin(rad);
    let hw = car.width / 2, hh = car.height / 2;
    // Transform player position to car local space
    let dx = px - car.worldX, dy = py - car.worldY;
    let localX = dx * cos + dy * sin;
    let localY = -dx * sin + dy * cos;
    // Find closest point in car rect
    const closestX = Math.max(-hw, Math.min(localX, hw));
    const closestY = Math.max(-hh, Math.min(localY, hh));
    const ddx = localX - closestX;
    const ddy = localY - closestY;
    return (ddx * ddx + ddy * ddy) < (pr * pr);
}

// ZOMBIE AI
const zombies = [];
const zombieCount = 100;
const ZOMBIE_DETECTION_RANGE = 500;
let zombieTries = 0;
for (let i = 0; i < zombieCount && zombieTries < zombieCount * 10; ) {
    // Spawn zombies at random positions far from (0,0)
    let angle = Math.random() * 2 * Math.PI;
    let dist = 800 + Math.random() * 1200;
    let zx = Math.cos(angle) * dist;
    let zy = Math.sin(angle) * dist;
    let radius = 10;
    let collides = false;
    for (const b of buildings) {
        if (circleRectCollision(zx, zy, radius, b.x, b.y, b.width, b.height)) {
            collides = true;
            break;
        }
    }
    if (!collides) {
        // Assign zombie type
        let type = 'normal';
        let r = Math.random();
        if (r > 0.99) type = 'boss'; // 0.5% chance
        else if (r > 0.95) type = 'tank'; // 1.5% chance
        else if (r > 0.93) type = 'fast'; // 5% chance
        // Set stats by type
        let stats = {
            normal: { radius: 10, speed: 0.7 + Math.random() * 0.3, health: 30 },
            fast:   { radius: 8,  speed: 1.5 + Math.random() * 0.5, health: 18 },
            tank:   { radius: 16, speed: 0.4 + Math.random() * 0.2, health: 80 },
            boss:   { radius: 24, speed: 0.3 + Math.random() * 0.1, health: 300 }
        }[type];
        zombies.push({
            x: zx,
            y: zy,
            radius: stats.radius,
            speed: stats.speed,
            damageCooldown: 0,
            health: stats.health,
            type,
            vx: 0,
            vy: 0,
            angle: 0,
            spin: 0,
            ragdollTimer: 0,
            chaseTimer: 0,
            wanderAngle: Math.random() * 2 * Math.PI,
            wanderTimer: Math.floor(Math.random() * 120)
        });
        i++;
    }
    zombieTries++;
}

function lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    // Check if a line from (x1, y1) to (x2, y2) intersects the rectangle
    // Check all 4 sides
    function lineIntersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
        // Returns true if line segments (x1,y1)-(x2,y2) and (x3,y3)-(x4,y4) intersect
        function ccw(ax, ay, bx, by, cx, cy) {
            return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
        }
        return (ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4)) &&
               (ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4));
    }
    return (
        lineIntersectsLine(x1, y1, x2, y2, rx, ry, rx + rw, ry) || // top
        lineIntersectsLine(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh) || // right
        lineIntersectsLine(x1, y1, x2, y2, rx + rw, ry + rh, rx, ry + rh) || // bottom
        lineIntersectsLine(x1, y1, x2, y2, rx, ry + rh, rx, ry) // left
    );
}

function hasLineOfSight(zx, zy, tx, ty) {
    for (const b of buildings) {
        if (lineIntersectsRect(zx, zy, tx, ty, b.x, b.y, b.width, b.height)) {
            return false;
        }
    }
    return true;
}

let splashes = [];
let bodyParts = [];

function spawnSplash(x, y, radius = 1) {
    for (let i = 0; i < 28 + Math.floor(Math.random()*10); i++) {
        let angle = Math.random() * 2 * Math.PI;
        let speed = (1 + Math.random() * 2) * (0.7 + Math.random()*0.7);
        splashes.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed * (0.7 + Math.random()*0.7),
            vy: Math.sin(angle) * speed * (0.7 + Math.random()*0.7),
            alpha: 1,
            radius: (8 + Math.random() * 12) * radius,
            grow: 0.7 + Math.random()*0.5
        });
    }
}

function spawnBodyParts(zombie, carKill) {
    if (!carKill) return;
    const partColors = ['#a00', '#2f2', '#ff6', '#39f', '#a3f', '#fff'];
    let count = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
        let angle = Math.random() * 2 * Math.PI;
        let speed = 2 + Math.random() * 4;
        bodyParts.push({
            x: zombie.x,
            y: zombie.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1,
            radius: 4 + Math.random() * 5,
            color: partColors[Math.floor(Math.random() * partColors.length)],
            spin: (Math.random() - 0.5) * 0.2
        });
    }
}

function updateBodyParts() {
    for (let p of bodyParts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.93;
        p.vy *= 0.93;
        p.alpha -= 0.025;
        p.radius *= 0.98;
    }
    bodyParts = bodyParts.filter(p => p.alpha > 0 && p.radius > 1);
}

function drawBodyParts() {
    ctx.save();
    for (let p of bodyParts) {
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(
            canvas.width / 2 + (p.x - worldOffsetX),
            canvas.height / 2 + (p.y - worldOffsetY),
            p.radius, 0, 2 * Math.PI
        );
        ctx.fillStyle = p.color;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function updateZombies() {
    // Remove dead zombies
    for (let i = zombies.length - 1; i >= 0; i--) {
        if (zombies[i].health <= 0) {
            // Determine if killed by car (ragdollTimer > 0 means car hit)
            const carKill = zombies[i].ragdollTimer > 0;
            spawnSplash(zombies[i].x, zombies[i].y, zombies[i].radius/10);
            spawnBodyParts(zombies[i], carKill);
            zombies.splice(i, 1);
        }
    }
    for (let i = 0; i < zombies.length; i++) {
        let z = zombies[i];
        // Always check for car hit and apply damage, even in ragdoll
        if (circleCarCollision(z.x, z.y, z.radius, car)) {
            let carSpeed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
            if (carSpeed > 2) {
                z.health -= Math.floor(carSpeed * 2);
                // If not already in ragdoll, apply ragdoll effect
                if (z.ragdollTimer === 0) {
                    const pushStrength = carSpeed * 2.5;
                    const carAngle = Math.atan2(car.vy, car.vx);
                    z.vx = Math.cos(carAngle) * pushStrength;
                    z.vy = Math.sin(carAngle) * pushStrength;
                    z.spin = (Math.random() - 0.5) * 0.4;
                    z.ragdollTimer = 40 + Math.floor(Math.random() * 20);
                }
            }
        }
        // Ragdoll physics
        if (z.ragdollTimer > 0) {
            z.x += z.vx;
            z.y += z.vy;
            z.angle += z.spin;
            z.vx *= 0.92;
            z.vy *= 0.92;
            z.spin *= 0.92;
            z.ragdollTimer--;
            continue;
        }
        // Target: player if on foot, car if in car
        let tx = inCar ? car.worldX : player.x;
        let ty = inCar ? car.worldY : player.y;
        let dx = tx - z.x;
        let dy = ty - z.y;
        let dist = Math.hypot(dx, dy);
        let seesTarget = dist < ZOMBIE_DETECTION_RANGE && hasLineOfSight(z.x, z.y, tx, ty);
        if (seesTarget) {
            z.chaseTimer = 180; // 3 seconds
        } else if (z.chaseTimer > 0) {
            z.chaseTimer--;
        }
        // Move toward target if sees or recently saw
        if (dist > 1 && (seesTarget || z.chaseTimer > 0)) {
            let moveX = (dx / dist) * z.speed;
            let moveY = (dy / dist) * z.speed;
            let nextX = z.x + moveX;
            let nextY = z.y + moveY;
            let blocked = false;
            for (const b of buildings) {
                if (circleRectCollision(nextX, nextY, z.radius, b.x, b.y, b.width, b.height)) {
                    blocked = true;
                    break;
                }
            }
            if (!blocked) {
                z.x = nextX;
                z.y = nextY;
            } else {
                // Try X only
                let tryX = z.x + moveX;
                let blockedX = false;
                for (const b of buildings) {
                    if (circleRectCollision(tryX, z.y, z.radius, b.x, b.y, b.width, b.height)) {
                        blockedX = true;
                        break;
                    }
                }
                if (!blockedX) {
                    z.x = tryX;
                } else {
                    // Try Y only
                    let tryY = z.y + moveY;
                    let blockedY = false;
                    for (const b of buildings) {
                        if (circleRectCollision(z.x, tryY, z.radius, b.x, b.y, b.width, b.height)) {
                            blockedY = true;
                            break;
                        }
                    }
                    if (!blockedY) {
                        z.y = tryY;
                    }
                }
            }
        } else {
            // Wandering
            z.wanderTimer--;
            if (z.wanderTimer <= 0) {
                z.wanderAngle = Math.random() * 2 * Math.PI;
                z.wanderTimer = 60 + Math.floor(Math.random() * 120);
            }
            let moveX = Math.cos(z.wanderAngle) * z.speed * 0.4;
            let moveY = Math.sin(z.wanderAngle) * z.speed * 0.4;
            let nextX = z.x + moveX;
            let nextY = z.y + moveY;
            let blocked = false;
            for (const b of buildings) {
                if (circleRectCollision(nextX, nextY, z.radius, b.x, b.y, b.width, b.height)) {
                    blocked = true;
                    break;
                }
            }
            if (!blocked) {
                z.x = nextX;
                z.y = nextY;
            }
        }
        // Damage logic
        if (z.damageCooldown > 0) z.damageCooldown--;
        // Hit player
        if (!inCar && Math.hypot(z.x - player.x, z.y - player.y) < z.radius + player.radius) {
            if (z.damageCooldown === 0) {
                playerHealth -= 10;
                if (playerHealth < 0) playerHealth = 0;
                z.damageCooldown = 40;
            }
        }
        // Hit car
        if (inCar && circleCarCollision(z.x, z.y, z.radius, car)) {
            if (z.damageCooldown === 0) {
                carHealth -= 10;
                if (carHealth < 0) carHealth = 0;
                z.damageCooldown = 40;
            }
        }
    }
    // --- BEGIN COLLISION RESOLUTION ---
    // Zombie-zombie collision
    for (let i = 0; i < zombies.length; i++) {
        let a = zombies[i];
        if (a.ragdollTimer > 0) continue;
        for (let j = i + 1; j < zombies.length; j++) {
            let b = zombies[j];
            if (b.ragdollTimer > 0) continue;
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let dist = Math.hypot(dx, dy);
            let minDist = a.radius + b.radius;
            if (dist < minDist && dist > 0.01) {
                let overlap = (minDist - dist) / 2;
                let nx = dx / dist, ny = dy / dist;
                a.x -= nx * overlap;
                a.y -= ny * overlap;
                b.x += nx * overlap;
                b.y += ny * overlap;
            }
        }
    }
    // Zombie-player collision (on foot)
    if (!inCar) {
        for (let i = 0; i < zombies.length; i++) {
            let z = zombies[i];
            let dx = player.x - z.x;
            let dy = player.y - z.y;
            let dist = Math.hypot(dx, dy);
            let minDist = player.radius + z.radius;
            if (dist < minDist && dist > 0.01) {
                let overlap = (minDist - dist) / 2;
                let nx = dx / dist, ny = dy / dist;
                player.x += nx * overlap;
                player.y += ny * overlap;
                z.x -= nx * overlap;
                z.y -= ny * overlap;
            }
        }
    }
    // Zombie-car collision (not ragdoll)
    if (inCar) {
        for (let i = 0; i < zombies.length; i++) {
            let z = zombies[i];
            if (z.ragdollTimer > 0) continue;
            // Use circleCarCollision for overlap, but resolve as circle-rect
            let rad = car.angle * Math.PI / 180;
            let cos = Math.cos(rad), sin = Math.sin(rad);
            let hw = car.width / 2, hh = car.height / 2;
            // Transform zombie position to car local space
            let dx = z.x - car.worldX, dy = z.y - car.worldY;
            let localX = dx * cos + dy * sin;
            let localY = -dx * sin + dy * cos;
            // Clamp to car rect
            const closestX = Math.max(-hw, Math.min(localX, hw));
            const closestY = Math.max(-hh, Math.min(localY, hh));
            const ddx = localX - closestX;
            const ddy = localY - closestY;
            let dist = Math.hypot(ddx, ddy);
            if (dist < z.radius && dist > 0.01) {
                // Move zombie outward from car edge
                let nx = ddx / dist, ny = ddy / dist;
                // Move in world space
                let worldNx = nx * cos - ny * sin;
                let worldNy = nx * sin + ny * cos;
                let overlap = z.radius - dist;
                z.x += worldNx * overlap;
                z.y += worldNy * overlap;
            }
        }
    }
    // --- END COLLISION RESOLUTION ---
}

function update() {
    if (!inCar) {
        // On foot movement with collision
        let moveX = 0, moveY = 0;
        if (keys.KeyW) moveY -= 1;
        if (keys.KeyS) moveY += 1;
        if (keys.KeyA) moveX -= 1;
        if (keys.KeyD) moveX += 1;
        const len = Math.hypot(moveX, moveY);
        let nextX = player.x, nextY = player.y;
        if (len > 0) {
            moveX /= len;
            moveY /= len;
            // Try X movement
            let tryX = player.x + moveX * player.speed;
            let blockedX = false;
            for (const b of buildings) {
                if (circleRectCollision(tryX, player.y, player.radius, b.x, b.y, b.width, b.height)) {
                    blockedX = true;
                    break;
                }
            }
            if (!blockedX && !circleCarCollision(tryX, player.y, player.radius, car)) {
                nextX = tryX;
            }
            // Try Y movement
            let tryY = player.y + moveY * player.speed;
            let blockedY = false;
            for (const b of buildings) {
                if (circleRectCollision(nextX, tryY, player.radius, b.x, b.y, b.width, b.height)) {
                    blockedY = true;
                    break;
                }
            }
            if (!blockedY && !circleCarCollision(nextX, tryY, player.radius, car)) {
                nextY = tryY;
            }
        }
        player.x = nextX;
        player.y = nextY;
        // Camera follows player
        worldOffsetX = player.x;
        worldOffsetY = player.y;
        updateZombies();
        return;
    }
    // Friction zones
    let zone = getZoneAt(car.worldX, car.worldY);
    let friction = car.friction;
    let grip = 0.18;
    if (zone) {
        friction = zoneTypes[zone.type].friction;
        grip = zoneTypes[zone.type].grip;
    }

    // Calculate forward and side directions
    let angleRad = car.angle * Math.PI / 180;
    let forwardX = Math.sin(angleRad);
    let forwardY = -Math.cos(angleRad);
    let rightX = Math.cos(angleRad);
    let rightY = Math.sin(angleRad);

    // Acceleration
    let accel = 0;
    if (keys.KeyW) accel = car.acceleration;
    if (keys.KeyS) accel = -car.acceleration;
    car.vx += forwardX * accel;
    car.vy += forwardY * accel;

    // Turning (smooth, with return to center and max steer limit)
    let speed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
    let turnSpeed = keys.Space ? car.driftTurnSpeed : car.turnSpeed;
    let forward = (car.vx * forwardX + car.vy * forwardY) >= 0;
    let steerTarget = 0;
    if (speed > 0.5) {
        if (keys.KeyA) steerTarget -= 1;
        if (keys.KeyD) steerTarget += 1;
    }
    // Smoothly interpolate steer, with return to center
    car.steer += (steerTarget - car.steer) * 0.12;
    // Limit max steer
    const maxSteer = 0.5;
    if (car.steer > maxSteer) car.steer = maxSteer;
    if (car.steer < -maxSteer) car.steer = -maxSteer;
    car.angle += car.steer * turnSpeed * (speed / car.maxSpeed) * (forward ? 1 : -1);

    // Grip and friction
    let zoneGrip = keys.Space ? Math.min(grip, 0.07) : grip;
    let zoneFriction = friction + (keys.Space ? 0.03 : 0);
    // Project velocity onto forward and side directions
    let vForward = car.vx * forwardX + car.vy * forwardY;
    let vSide = car.vx * rightX + car.vy * rightY;
    // Reduce side velocity (simulate grip)
    vSide *= (1 - zoneGrip);
    // Reduce all velocity (simulate friction)
    vForward *= (1 - zoneFriction);
    // Recompose velocity
    car.vx = forwardX * vForward + rightX * vSide;
    car.vy = forwardY * vForward + rightY * vSide;

    // Clamp speed
    let newSpeed = Math.sqrt(car.vx * car.vx + car.vy * car.vy);
    // Calculate forward velocity
    let forwardVel = car.vx * forwardX + car.vy * forwardY;
    let maxFwd = car.maxSpeed;
    let maxRev = car.maxSpeed * 0.4; // backwards is 40% of forward
    if (forwardVel >= 0 && newSpeed > maxFwd) {
        car.vx *= maxFwd / newSpeed;
        car.vy *= maxFwd / newSpeed;
    } else if (forwardVel < 0 && newSpeed > maxRev) {
        car.vx *= maxRev / newSpeed;
        car.vy *= maxRev / newSpeed;
    }

    // Save previous position
    let prevX = car.worldX;
    let prevY = car.worldY;

    // Move car
    car.worldX += car.vx;
    car.worldY += car.vy;
    worldOffsetX = car.worldX;
    worldOffsetY = car.worldY;

    // Collision with buildings
    for (let b of buildings) {
        if (checkCollision(b, car.worldX, car.worldY, car.angle, car.width, car.height)) {
            // Enhanced collision response
            car.worldX = prevX;
            car.worldY = prevY;
            resolveCollision(car, b);
            // If still colliding, nudge again
            if (checkCollision(b, car.worldX, car.worldY, car.angle, car.width, car.height)) {
                resolveCollision(car, b);
            }
            break;
        }
    }

    // Sliding detection for effects
    let velocityAngle = Math.atan2(car.vy, car.vx);
    let carAngle = Math.atan2(forwardY, forwardX) + Math.PI / 2;
    let angleDiff = Math.abs(Math.atan2(Math.sin(velocityAngle - angleRad), Math.cos(velocityAngle - angleRad)));
    let sliding = angleDiff > 0.2 && newSpeed > 1;

    // Tire marks and smoke when sliding AND handbrake is held
    if (sliding && keys.Space) {
        if (!wasDrifting) {
            tireMarks.push(null); // break the path
        }
        let rearOffset = 20;
        let leftWheel = {
            x: car.worldX + Math.sin(angleRad + Math.PI / 2) * (car.width / 2 - 8) - Math.sin(angleRad) * rearOffset,
            y: car.worldY - Math.cos(angleRad + Math.PI / 2) * (car.width / 2 - 8) + Math.cos(angleRad) * rearOffset
        };
        let rightWheel = {
            x: car.worldX + Math.sin(angleRad - Math.PI / 2) * (car.width / 2 - 8) - Math.sin(angleRad) * rearOffset,
            y: car.worldY - Math.cos(angleRad - Math.PI / 2) * (car.width / 2 - 8) + Math.cos(angleRad) * rearOffset
        };
        tireMarks.push({left: {...leftWheel}, right: {...rightWheel}, alpha: 0.7});
        for (let i = 0; i < 2; i++) {
            let wheel = i === 0 ? leftWheel : rightWheel;
            smokeParticles.push({
                x: wheel.x,
                y: wheel.y,
                alpha: 0.5 + Math.random() * 0.3,
                radius: 8 + Math.random() * 6,
                vx: (Math.random() - 0.5) * 1.2,
                vy: (Math.random() - 0.5) * 1.2
            });
        }
        wasDrifting = true;
    } else {
        wasDrifting = false;
    }

    // Update smoke particles
    for (let p of smokeParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.012;
        p.radius += 0.2;
    }
    smokeParticles = smokeParticles.filter(p => p.alpha > 0);
    if (tireMarks.length > 400) tireMarks = tireMarks.slice(-400);

    updateSparks();
    updateSplashes();
    updateBodyParts();
    updateZombies();

    // After car movement, push car out of zombies if overlapping (not ragdoll)
    for (let i = 0; i < zombies.length; i++) {
        let z = zombies[i];
        if (z.ragdollTimer > 0) continue;
        // Use circleCarCollision for overlap, but resolve as circle-rect
        let rad = car.angle * Math.PI / 180;
        let cos = Math.cos(rad), sin = Math.sin(rad);
        let hw = car.width / 2, hh = car.height / 2;
        let dx = z.x - car.worldX, dy = z.y - car.worldY;
        let localX = dx * cos + dy * sin;
        let localY = -dx * sin + dy * cos;
        const closestX = Math.max(-hw, Math.min(localX, hw));
        const closestY = Math.max(-hh, Math.min(localY, hh));
        const ddx = localX - closestX;
        const ddy = localY - closestY;
        let dist = Math.hypot(ddx, ddy);
        if (dist < z.radius && dist > 0.01) {
            let nx = ddx / dist, ny = ddy / dist;
            // Move in world space
            let worldNx = nx * cos - ny * sin;
            let worldNy = nx * sin + ny * cos;
            let overlap = z.radius - dist;
            car.worldX -= worldNx * overlap;
            car.worldY -= worldNy * overlap;
        }
    }
}

function drawGrid() {
    const gridSize = 100;
    ctx.save();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    // Align grid to world origin (0,0)
    let offsetX = (worldOffsetX % gridSize + gridSize) % gridSize;
    let offsetY = (worldOffsetY % gridSize + gridSize) % gridSize;
    for (let x = -offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = -offsetY; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
    ctx.restore();
}

function drawCar() {
    ctx.save();
    // Draw soft car shadow directly under the car
    ctx.translate(
        canvas.width / 2 + (car.worldX - worldOffsetX),
        canvas.height / 2 + (car.worldY - worldOffsetY)
    );
    ctx.rotate(car.angle * Math.PI / 180);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.filter = 'blur(4px)';
    ctx.fillStyle = '#000';
    ctx.fillRect(-car.width / 2, -car.height / 2, car.width + 8, car.height + 8);
    ctx.filter = 'none';
    ctx.restore();
    // Draw car image or fallback
    if (carImg.complete && carImg.naturalWidth > 0) {
        ctx.drawImage(carImg, -car.width / 2, -car.height / 2, car.width, car.height);
    } else {
        ctx.fillStyle = '#ff0';
        ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);
    }
    // Draw car border for collision
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e22';
    ctx.strokeRect(-car.width / 2, -car.height / 2, car.width, car.height);
    ctx.restore();
    ctx.restore();
}

function drawTireMarks() {
    ctx.save();
    ctx.strokeStyle = 'rgba(40,40,40,0.7)';
    ctx.lineWidth = 4;
    for (let i = 1; i < tireMarks.length; i++) {
        if (!tireMarks[i-1] || !tireMarks[i]) continue;
        ctx.globalAlpha = tireMarks[i].alpha;
        ctx.beginPath();
        ctx.moveTo(
            canvas.width / 2 + (tireMarks[i-1].left.x - worldOffsetX),
            canvas.height / 2 + (tireMarks[i-1].left.y - worldOffsetY)
        );
        ctx.lineTo(
            canvas.width / 2 + (tireMarks[i].left.x - worldOffsetX),
            canvas.height / 2 + (tireMarks[i].left.y - worldOffsetY)
        );
        ctx.moveTo(
            canvas.width / 2 + (tireMarks[i-1].right.x - worldOffsetX),
            canvas.height / 2 + (tireMarks[i-1].right.y - worldOffsetY)
        );
        ctx.lineTo(
            canvas.width / 2 + (tireMarks[i].right.x - worldOffsetX),
            canvas.height / 2 + (tireMarks[i].right.y - worldOffsetY)
        );
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawSmoke() {
    ctx.save();
    for (let p of smokeParticles) {
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(
            canvas.width / 2 + (p.x - worldOffsetX),
            canvas.height / 2 + (p.y - worldOffsetY),
            p.radius, 0, 2 * Math.PI
        );
        ctx.fillStyle = 'rgba(200,200,200,0.5)';
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawBuildings() {
    ctx.save();
    for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        // Draw soft shadow with smaller offset
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.filter = 'blur(6px)';
        ctx.fillStyle = '#000';
        ctx.fillRect(
            canvas.width / 2 + (b.x - worldOffsetX) + 5,
            canvas.height / 2 + (b.y - worldOffsetY) + 7,
            b.width + 8, b.height + 8
        );
        ctx.filter = 'none';
        ctx.restore();
    }
    for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        ctx.beginPath();
        ctx.rect(
            canvas.width / 2 + (b.x - worldOffsetX),
            canvas.height / 2 + (b.y - worldOffsetY),
            b.width, b.height
        );
        const img = b.img ? buildingImgs[b.img] : null;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.clip();
            ctx.drawImage(
                img,
                canvas.width / 2 + (b.x - worldOffsetX),
                canvas.height / 2 + (b.y - worldOffsetY),
                b.width, b.height
            );
            ctx.restore();
        } else {
            ctx.fillStyle = '#888';
            ctx.fill();
        }
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Draw building image name
        ctx.save();
        ctx.font = '16px monospace';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const label = b.img ? b.img.split('/').pop() : 'none';
        ctx.fillText(label, canvas.width / 2 + (b.x - worldOffsetX) + b.width / 2, canvas.height / 2 + (b.y - worldOffsetY) + 4);
        ctx.restore();
    }
    ctx.restore();
}

function drawSparks() {
    ctx.save();
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    for (let s of sparks) {
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 + (s.x - worldOffsetX), canvas.height / 2 + (s.y - worldOffsetY));
        ctx.lineTo(canvas.width / 2 + (s.x + s.vx * 2 - worldOffsetX), canvas.height / 2 + (s.y + s.vy * 2 - worldOffsetY));
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawZones() {
    ctx.save();
    for (let z of zones) {
        ctx.fillStyle = zoneTypes[z.type].color;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(
            canvas.width / 2 + (z.x - worldOffsetX),
            canvas.height / 2 + (z.y - worldOffsetY),
            z.width, z.height
        );
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawPlayer() {
    if (!inCar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, player.radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#39f';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.restore();
    }
}

function drawHealthBar() {
    ctx.save();
    // Car health
    ctx.fillStyle = '#222';
    ctx.fillRect(20, 20, 200, 24);
    ctx.fillStyle = carHealth > 30 ? '#0f0' : '#f00';
    ctx.fillRect(20, 20, 2 * carHealth, 24);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 200, 24);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Car Health', 24, 38);
    // Player health
    ctx.fillStyle = '#222';
    ctx.fillRect(20, 52, 200, 24);
    ctx.fillStyle = playerHealth > 30 ? '#0af' : '#f00';
    ctx.fillRect(20, 52, 2 * playerHealth, 24);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 52, 200, 24);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Player Health', 24, 70);
    // Zombies left counter
    ctx.font = '20px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Zombies Left: ' + zombies.length, 240, 38);
    ctx.restore();
}

function getZoneAt(x, y) {
    for (let z of zones) {
        if (x > z.x && x < z.x + z.width && y > z.y && y < z.y + z.height) return z;
    }
    return null;
}

function updateSparks() {
    for (let s of sparks) {
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.92;
        s.vy *= 0.92;
        s.alpha -= 0.04;
        s.life--;
    }
    sparks = sparks.filter(s => s.life > 0 && s.alpha > 0);
}

function updateSplashes() {
    for (let s of splashes) {
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.92;
        s.vy *= 0.92;
        s.alpha -= 0.018;
        s.radius += s.grow;
        s.grow *= 0.93;
    }
    splashes = splashes.filter(s => s.alpha > 0 && s.radius > 1);
}

function drawSplashes() {
    ctx.save();
    for (let s of splashes) {
        ctx.globalAlpha = s.alpha * 0.7;
        ctx.beginPath();
        ctx.arc(
            canvas.width / 2 + (s.x - worldOffsetX),
            canvas.height / 2 + (s.y - worldOffsetY),
            s.radius, 0, 2 * Math.PI
        );
        ctx.fillStyle = '#a00';
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function drawZombies() {
    ctx.save();
    for (let z of zombies) {
        ctx.save();
        ctx.translate(
            canvas.width / 2 + (z.x - worldOffsetX),
            canvas.height / 2 + (z.y - worldOffsetY)
        );
        ctx.rotate(z.angle);
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, 2 * Math.PI);
        // Color by type
        let color = '#2f2';
        if (z.type === 'fast') color = '#ff6';
        else if (z.type === 'tank') color = '#39f';
        else if (z.type === 'boss') color = '#a3f';
        if (z.health < 10) color = '#f22';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#070';
        ctx.globalAlpha = 1;
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

// Background image for tiling
const bgImg = new window.Image();
bgImg.src = 'images/bg.png';

function drawBackground() {
    if (!bgImg.complete || bgImg.naturalWidth === 0) return;
    // Tile the background image to cover the visible canvas
    const tileW = bgImg.naturalWidth;
    const tileH = bgImg.naturalHeight;
    // Find top-left world coordinate visible on screen
    const startX = worldOffsetX - canvas.width / 2;
    const startY = worldOffsetY - canvas.height / 2;
    // Find the first tile to draw (may be negative)
    const offsetX = -((startX % tileW) + tileW) % tileW;
    const offsetY = -((startY % tileH) + tileH) % tileH;
    for (let x = offsetX; x < canvas.width; x += tileW) {
        for (let y = offsetY; y < canvas.height; y += tileH) {
            ctx.drawImage(bgImg, x, y, tileW, tileH);
        }
    }
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawGrid();
    drawZones();
    drawBuildings();
    drawTireMarks();
    drawSmoke();
    drawSplashes();
    drawBodyParts();
    drawZombies();
    drawSparks();
    update();
    drawCar();
    drawPlayer();
    drawHealthBar();
    requestAnimationFrame(gameLoop);
}

gameLoop(); 