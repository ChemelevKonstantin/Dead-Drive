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
    width: 48,
    height: 84,
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

import { buildings, zones, decorations } from './buildings.js';

// Friction zones
const zoneTypes = {
    grass: { friction: 0.04, grip: 0.12, color: '#3a5' },
    sand: { friction: 0.08, grip: 0.08, color: '#dbb' }
};

// Damage system
// let carHealth = 100;
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
        car.health -= Math.min(10, Math.abs(dot) * 2); // use car.health, not carHealth
        if (car.health < 0) car.health = 0;
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

// Preload all decoration images
const decorationImgs = {};
for (const d of decorations) {
    if (d.img && !decorationImgs[d.img]) {
        const img = new window.Image();
        img.src = d.img;
        decorationImgs[d.img] = img;
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
// Add lastMoveAngle for player facing direction
let lastMoveAngle = 0;

// Drivable cars array (only one at a time)
let cars = [];
let activeCar = null;
// Initialize with the original car
cars.push({
    width: 48,
    height: 84,
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
    steer: 0,
    img: 'images/cars/car1.png',
    health: 300
});
activeCar = cars[0];

// Update E key logic for entering/exiting cars and abandoned cars
let canToggleCar = true;
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && canToggleCar) {
        if (inCar) {
            // Exit car: place player at left side of car (perpendicular to car angle)
            const angleRad = activeCar.angle * Math.PI / 180;
            const exitDistance = (activeCar.width / 2 + player.radius) * 2;
            player.x = activeCar.worldX + Math.cos(angleRad - Math.PI / 2) * exitDistance;
            player.y = activeCar.worldY + Math.sin(angleRad - Math.PI / 2) * exitDistance;
            inCar = false;
            activeCar.vx = 0;
            activeCar.vy = 0;
        } else {
            // Try to enter the drivable car if close enough
            const dx = player.x - activeCar.worldX;
            const dy = player.y - activeCar.worldY;
            if (Math.sqrt(dx*dx + dy*dy) < 80) {
                inCar = true;
            } else {
                // Try to enter an abandoned car
                for (let i = 0; i < abandonedCars.length; i++) {
                    const a = abandonedCars[i];
                    if (a.destroyed) continue;
                    const dx = player.x - a.x;
                    const dy = player.y - a.y;
                    if (Math.sqrt(dx*dx + dy*dy) < 80) {
                        // Convert the current car to an abandoned car
                        abandonedCars.push({
                            x: activeCar.worldX,
                            y: activeCar.worldY,
                            angle: activeCar.angle,
                            img: (typeof activeCar.img === 'string') ? activeCar.img : (activeCar.img && activeCar.img.src ? activeCar.img.src : 'images/cars/car1.png'),
                            width: activeCar.width,
                            height: activeCar.height,
                            health: activeCar.health,
                            fireParticles: carFireParticles.slice() // copy current fire particles
                        });
                        // Preload image for new abandoned car if not already loaded
                        let imgPath = (typeof activeCar.img === 'string') ? activeCar.img : (activeCar.img && activeCar.img.src ? activeCar.img.src : 'images/cars/car1.png');
                        if (!abandonedCarImgs[imgPath]) {
                            const img = new window.Image();
                            img.src = imgPath;
                            abandonedCarImgs[imgPath] = img;
                            abandonedCarImgs[img.src] = img; // ensure both keys
                        }
                        // Convert abandoned car to drivable car
                        let newCar = {
                            width: a.width,
                            height: a.height,
                            angle: a.angle,
                            speed: 0,
                            maxSpeed: 5,
                            acceleration: 0.2,
                            friction: 0.02,
                            turnSpeed: 3,
                            driftTurnSpeed: 6,
                            worldX: a.x,
                            worldY: a.y,
                            vx: 0,
                            vy: 0,
                            steer: 0,
                            img: a.img,
                            health: (typeof a.health === 'number') ? a.health : 300
                        };
                        if (a.fireParticles) {
                            carFireParticles = a.fireParticles.slice();
                        }
                        cars[0] = newCar;
                        activeCar = newCar;
                        abandonedCars.splice(i, 1);
                        inCar = true;
                        break;
                    }
                }
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
const zombieCount = 400;
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
let staticBodyParts = [];
let bloodSpills = [];

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
        // Also spawn static body part on ground
        let staticAngle = Math.random() * 2 * Math.PI;
        let staticDist = Math.random() * 18;
        staticBodyParts.push({
            x: zombie.x + Math.cos(staticAngle) * staticDist,
            y: zombie.y + Math.sin(staticAngle) * staticDist,
            radius: 4 + Math.random() * 5,
            color: partColors[Math.floor(Math.random() * partColors.length)]
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

function drawStaticBodyParts() {
    ctx.save();
    for (let p of staticBodyParts) {
        ctx.beginPath();
        ctx.arc(
            canvas.width / 2 + (p.x - worldOffsetX),
            canvas.height / 2 + (p.y - worldOffsetY),
            p.radius, 0, 2 * Math.PI
        );
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.55;
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
            // Add several small blood spills spread out
            let nSpills = 3 + Math.floor(Math.random() * 4); // 3-6
            for (let s = 0; s < nSpills; s++) {
                let angle = Math.random() * 2 * Math.PI;
                let dist = 6 + Math.random() * 22;
                let bx = zombies[i].x + Math.cos(angle) * dist;
                let by = zombies[i].y + Math.sin(angle) * dist;
                let initialRadius = 4 + Math.random() * 7;
                let finalRadius = 10 + Math.random() * 16;
                bloodSpills.push({
                    x: bx,
                    y: by,
                    radius: initialRadius,
                    targetRadius: finalRadius,
                    alpha: 0.22 + Math.random() * 0.18,
                    grow: (finalRadius - initialRadius) / 500, // grow over ~5 seconds at 60fps
                    growing: true
                });
            }
            zombies.splice(i, 1);
        }
    }
    for (let i = 0; i < zombies.length; i++) {
        let z = zombies[i];
        // Always check for car hit and apply damage, even in ragdoll
        if (circleCarCollision(z.x, z.y, z.radius, activeCar)) {
            let carSpeed = Math.sqrt(activeCar.vx * activeCar.vx + activeCar.vy * activeCar.vy);
            if (carSpeed > 2) {
                z.health -= Math.floor(carSpeed * 2);
                // If not already in ragdoll, apply ragdoll effect
                if (z.ragdollTimer === 0) {
                    const pushStrength = carSpeed * 2.5;
                    const carAngle = Math.atan2(activeCar.vy, activeCar.vx);
                    z.vx = Math.cos(carAngle) * pushStrength;
                    z.vy = Math.sin(carAngle) * pushStrength;
                    z.spin = (Math.random() - 0.5) * 0.4;
                    z.ragdollTimer = 40 + Math.floor(Math.random() * 20);
                    // Small blood splash on hit
                    spawnSplash(z.x, z.y, 0.25 + Math.random() * 0.18);
                    // Add blood splat to car at impact side
                    // Compute local car coordinates of zombie
                    let dx = z.x - activeCar.worldX;
                    let dy = z.y - activeCar.worldY;
                    let rad = activeCar.angle * Math.PI / 180;
                    let localX = dx * Math.cos(rad) + dy * Math.sin(rad);
                    let localY = -dx * Math.sin(rad) + dy * Math.cos(rad);
                    // Clamp to car surface (with some random offset)
                    let edgeDist = Math.max(Math.abs(localX) / (activeCar.width/2), Math.abs(localY) / (activeCar.height/2), 1);
                    let clampedX = Math.max(-activeCar.width/2 + 8, Math.min(activeCar.width/2 - 8, localX / edgeDist * (activeCar.width/2 - 8)));
                    let clampedY = Math.max(-activeCar.height/2 + 12, Math.min(activeCar.height/2 - 12, localY / edgeDist * (activeCar.height/2 - 12)));
                    let splatX = clampedX + (Math.random()-0.5)*3;
                    let splatY = clampedY + (Math.random()-0.5)*3;
                    let splat = {
                        x: splatX,
                        y: splatY,
                        radius: 3 + Math.random() * 5,
                        alpha: 0.7 + Math.random() * 0.2,
                        angle: Math.random() * 2 * Math.PI,
                        timer: 1200 // 20 seconds at 60fps
                    };
                    carBloodSplats.push(splat);
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
        let tx = inCar ? activeCar.worldX : player.x;
        let ty = inCar ? activeCar.worldY : player.y;
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
            // Decorations collision
            if (!blocked) {
                for (const d of decorations) {
                    if (d.collision && circleRectCollision(nextX, nextY, z.radius, d.x, d.y, d.width, d.height)) {
                        blocked = true;
                        break;
                    }
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
                    for (const d of decorations) {
                        if (d.collision && circleRectCollision(tryX, z.y, z.radius, d.x, d.y, d.width, d.height)) {
                            blockedX = true;
                            break;
                        }
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
                        for (const d of decorations) {
                            if (d.collision && circleRectCollision(z.x, tryY, z.radius, d.x, d.y, d.width, d.height)) {
                                blockedY = true;
                                break;
                            }
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
            // Decorations collision
            if (!blocked) {
                for (const d of decorations) {
                    if (d.collision && circleRectCollision(nextX, nextY, z.radius, d.x, d.y, d.width, d.height)) {
                        blocked = true;
                        break;
                    }
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
        if (inCar && circleCarCollision(z.x, z.y, z.radius, activeCar)) {
            if (z.damageCooldown === 0) {
                activeCar.health -= 2; // was 10, now 3
                if (activeCar.health < 0) activeCar.health = 0;
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
                // Try to push a
                let axNew = a.x - nx * overlap;
                let ayNew = a.y - ny * overlap;
                let aBlocked = false;
                for (const bld of buildings) {
                    if (circleRectCollision(axNew, ayNew, a.radius, bld.x, bld.y, bld.width, bld.height)) {
                        aBlocked = true;
                        break;
                    }
                }
                if (!aBlocked) {
                    a.x = axNew;
                    a.y = ayNew;
                }
                // Try to push b
                let bxNew = b.x + nx * overlap;
                let byNew = b.y + ny * overlap;
                let bBlocked = false;
                for (const bld of buildings) {
                    if (circleRectCollision(bxNew, byNew, b.radius, bld.x, bld.y, bld.width, bld.height)) {
                        bBlocked = true;
                        break;
                    }
                }
                if (!bBlocked) {
                    b.x = bxNew;
                    b.y = byNew;
                }
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
                // Try to push player
                let pxNew = player.x + nx * overlap;
                let pyNew = player.y + ny * overlap;
                let pBlocked = false;
                for (const bld of buildings) {
                    if (circleRectCollision(pxNew, pyNew, player.radius, bld.x, bld.y, bld.width, bld.height)) {
                        pBlocked = true;
                        break;
                    }
                }
                if (!pBlocked) {
                    player.x = pxNew;
                    player.y = pyNew;
                }
                // Try to push zombie
                let zxNew = z.x - nx * overlap;
                let zyNew = z.y - ny * overlap;
                let zBlocked = false;
                for (const bld of buildings) {
                    if (circleRectCollision(zxNew, zyNew, z.radius, bld.x, bld.y, bld.width, bld.height)) {
                        zBlocked = true;
                        break;
                    }
                }
                if (!zBlocked) {
                    z.x = zxNew;
                    z.y = zyNew;
                }
            }
        }
    }
    // Zombie-car collision (not ragdoll)
    if (inCar) {
        for (let i = 0; i < zombies.length; i++) {
            let z = zombies[i];
            if (z.ragdollTimer > 0) continue;
            // Use circleCarCollision for overlap, but resolve as circle-rect
            let rad = activeCar.angle * Math.PI / 180;
            let cos = Math.cos(rad), sin = Math.sin(rad);
            let hw = activeCar.width / 2, hh = activeCar.height / 2;
            // Transform zombie position to car local space
            let dx = z.x - activeCar.worldX, dy = z.y - activeCar.worldY;
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
                // Try to push car out (as before)
                activeCar.worldX -= worldNx * overlap;
                activeCar.worldY -= worldNy * overlap;
                // Also try to push zombie out, but only if not into building
                let zxNew = z.x + worldNx * overlap;
                let zyNew = z.y + worldNy * overlap;
                let blocked = false;
                for (const bld of buildings) {
                    if (circleRectCollision(zxNew, zyNew, z.radius, bld.x, bld.y, bld.width, bld.height)) {
                        blocked = true;
                        break;
                    }
                }
                if (!blocked) {
                    z.x = zxNew;
                    z.y = zyNew;
                }
            }
        }
    }
    // --- END COLLISION RESOLUTION ---

    // Eject zombies from buildings if stuck inside
    for (let i = 0; i < zombies.length; i++) {
        let z = zombies[i];
        for (const b of buildings) {
            if (circleRectCollision(z.x, z.y, z.radius, b.x, b.y, b.width, b.height)) {
                // Find closest point on building edge
                let closestX = Math.max(b.x, Math.min(z.x, b.x + b.width));
                let closestY = Math.max(b.y, Math.min(z.y, b.y + b.height));
                let dx = z.x - closestX;
                let dy = z.y - closestY;
                let dist = Math.hypot(dx, dy) || 1;
                // Move zombie just outside the building
                z.x = closestX + (dx / dist) * (z.radius + 0.1);
                z.y = closestY + (dy / dist) * (z.radius + 0.1);
            }
        }
        // Eject zombies from decorations if stuck inside
        for (const d of decorations) {
            if (d.collision && circleRectCollision(z.x, z.y, z.radius, d.x, d.y, d.width, d.height)) {
                let closestX = Math.max(d.x, Math.min(z.x, d.x + d.width));
                let closestY = Math.max(d.y, Math.min(z.y, d.y + d.height));
                let dx = z.x - closestX;
                let dy = z.y - closestY;
                let dist = Math.hypot(dx, dy) || 1;
                z.x = closestX + (dx / dist) * (z.radius + 0.1);
                z.y = closestY + (dy / dist) * (z.radius + 0.1);
            }
        }
    }
}

// Burnout state
let burnoutTimer = 0;
let wasStopped = true;
let bloodyTiresTimer = 0;

// Ragdoll state for decorations
let decorationRagdolls = [];

function update() {
    if (gameOver || gameWon) return;
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
            for (const d of decorations) {
                if (d.collision && circleRectCollision(tryX, player.y, player.radius, d.x, d.y, d.width, d.height)) {
                    blockedX = true;
                    break;
                }
            }
            if (!blockedX && !circleCarCollision(tryX, player.y, player.radius, activeCar)) {
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
            for (const d of decorations) {
                if (d.collision && circleRectCollision(nextX, tryY, player.radius, d.x, d.y, d.width, d.height)) {
                    blockedY = true;
                    break;
                }
            }
            if (!blockedY && !circleCarCollision(nextX, tryY, player.radius, activeCar)) {
                nextY = tryY;
            }
        }
        player.x = nextX;
        player.y = nextY;
        // Track last movement direction for swing
        if (moveX !== 0 || moveY !== 0) {
            lastMoveAngle = Math.atan2(moveY, moveX);
        }
        // --- Melee swing logic ---
        if (meleeSwingCooldown > 0) meleeSwingCooldown--;
        if (meleeSwinging) {
            meleeSwingTimer--;
            // Damage zombies in arc only on first frame of swing
            if (meleeSwingTimer === MELEE_SWING_DURATION - 1) {
                for (let z of zombies) {
                    const dx = z.x - player.x;
                    const dy = z.y - player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < MELEE_SWING_RANGE + z.radius) {
                        let angleToZombie = Math.atan2(dy, dx);
                        let swingStart = meleeSwingAngle - MELEE_SWING_ARC / 2;
                        // Normalize angles
                        let rel = ((angleToZombie - swingStart + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
                        if (rel >= 0 && rel <= MELEE_SWING_ARC) {
                            z.health -= MELEE_SWING_DAMAGE;
                            // Stronger knockback and ragdoll effect
                            z.vx += Math.cos(angleToZombie) * 6;
                            z.vy += Math.sin(angleToZombie) * 6;
                            z.ragdollTimer = 18; // short ragdoll/knockback
                        }
                    }
                }
            }
            if (meleeSwingTimer <= 0) {
                meleeSwinging = false;
            }
        }
        // Camera follows player
        worldOffsetX = player.x;
        worldOffsetY = player.y;
        // Continue updating visual effects even when not in car
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
        // Simple circle collision between player and abandoned cars
        if (!inCar) {
            for (let i = 0; i < abandonedCars.length; i++) {
                const a = abandonedCars[i];
                const ax = a.x;
                const ay = a.y;
                const aradius = (a.width + a.height) / 4;
                const dx = player.x - ax;
                const dy = player.y - ay;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = aradius + player.radius;
                if (dist < minDist && dist > 0.01) {
                    // Push player out to the edge of the collision circle
                    const nx = dx / dist;
                    const ny = dy / dist;
                    player.x = ax + nx * minDist;
                    player.y = ay + ny * minDist;
                }
            }
        }
        // At the end of update, check for player death
        if (playerHealth <= 0 && !gameOver) {
            playerHealth = 0;
            gameOver = true;
        }
        // Check for win condition
        if (zombies.length === 0 && !gameWon) {
            gameWon = true;
        }
        return;
    }
    // Friction zones
    let zone = getZoneAt(activeCar.worldX, activeCar.worldY);
    let friction = activeCar.friction;
    let grip = 0.18;
    if (zone) {
        friction = zoneTypes[zone.type].friction;
        grip = zoneTypes[zone.type].grip;
    }

    // Calculate forward and side directions
    let angleRad = activeCar.angle * Math.PI / 180;
    let forwardX = Math.sin(angleRad);
    let forwardY = -Math.cos(angleRad);
    let rightX = Math.cos(angleRad);
    let rightY = Math.sin(angleRad);

    // Acceleration
    let accel = 0;
    if (keys.KeyW) accel = activeCar.acceleration;
    if (keys.KeyS) accel = -activeCar.acceleration;
    activeCar.vx += forwardX * accel;
    activeCar.vy += forwardY * accel;

    // Turning (smooth, with return to center and max steer limit)
    let speed = Math.sqrt(activeCar.vx * activeCar.vx + activeCar.vy * activeCar.vy);
    let turnSpeed = keys.Space ? activeCar.driftTurnSpeed : activeCar.turnSpeed;
    let forward = (activeCar.vx * forwardX + activeCar.vy * forwardY) >= 0;
    let steerTarget = 0;
    if (speed > 0.5) {
        if (keys.KeyA) steerTarget -= 1;
        if (keys.KeyD) steerTarget += 1;
    }
    // Smoothly interpolate steer, with return to center
    activeCar.steer += (steerTarget - activeCar.steer) * 0.12;
    // Limit max steer
    const maxSteer = 0.5;
    if (activeCar.steer > maxSteer) activeCar.steer = maxSteer;
    if (activeCar.steer < -maxSteer) activeCar.steer = -maxSteer;
    activeCar.angle += activeCar.steer * turnSpeed * (speed / activeCar.maxSpeed) * (forward ? 1 : -1);

    // Grip and friction
    let zoneGrip = keys.Space ? Math.min(grip, 0.07) : grip;
    let zoneFriction = friction + (keys.Space ? 0.03 : 0);
    // Project velocity onto forward and side directions
    let vForward = activeCar.vx * forwardX + activeCar.vy * forwardY;
    let vSide = activeCar.vx * rightX + activeCar.vy * rightY;
    // Reduce side velocity (simulate grip)
    vSide *= (1 - zoneGrip);
    // Reduce all velocity (simulate friction)
    vForward *= (1 - zoneFriction);
    // Recompose velocity
    activeCar.vx = forwardX * vForward + rightX * vSide;
    activeCar.vy = forwardY * vForward + rightY * vSide;

    // Clamp speed
    let newSpeed = Math.sqrt(activeCar.vx * activeCar.vx + activeCar.vy * activeCar.vy);
    // Calculate forward velocity
    let forwardVel = activeCar.vx * forwardX + activeCar.vy * forwardY;
    let maxFwd = activeCar.maxSpeed;
    let maxRev = activeCar.maxSpeed * 0.4; // backwards is 40% of forward
    if (forwardVel >= 0 && newSpeed > maxFwd) {
        activeCar.vx *= maxFwd / newSpeed;
        activeCar.vy *= maxFwd / newSpeed;
    } else if (forwardVel < 0 && newSpeed > maxRev) {
        activeCar.vx *= maxRev / newSpeed;
        activeCar.vy *= maxRev / newSpeed;
    }

    // Burnout detection
    let accelerating = keys.KeyW || keys.KeyS;
    if (wasStopped && accelerating && newSpeed < 0.5) {
        burnoutTimer = 18; // ~0.3s at 60fps
    }
    wasStopped = newSpeed < 0.2;

    // Save previous position
    let prevX = activeCar.worldX;
    let prevY = activeCar.worldY;

    // Move car
    activeCar.worldX += activeCar.vx;
    activeCar.worldY += activeCar.vy;
    worldOffsetX = activeCar.worldX;
    worldOffsetY = activeCar.worldY;

    // Collision with buildings
    for (let b of buildings) {
        if (checkCollision(b, activeCar.worldX, activeCar.worldY, activeCar.angle, activeCar.width, activeCar.height)) {
            // Enhanced collision response
            activeCar.worldX = prevX;
            activeCar.worldY = prevY;
            resolveCollision(activeCar, b);
            // If still colliding, nudge again
            if (checkCollision(b, activeCar.worldX, activeCar.worldY, activeCar.angle, activeCar.width, activeCar.height)) {
                resolveCollision(activeCar, b);
            }
            break;
        }
    }

    // Collision with unbreakable decorations (persistent physics)
    for (let d of decorations) {
        if (d.type === 'unbreakable' && d.ragdoll && !d.breakable && d.collision) {
            let rect = { x: d.x, y: d.y, width: d.width, height: d.height };
            if (checkCollision(rect, activeCar.worldX, activeCar.worldY, activeCar.angle, activeCar.width, activeCar.height)) {
                // Calculate push direction using car's velocity direction
                let carSpeed = Math.sqrt(activeCar.vx * activeCar.vx + activeCar.vy * activeCar.vy);
                let pushX = carSpeed > 0.1 ? activeCar.vx / carSpeed : 0;
                let pushY = carSpeed > 0.1 ? activeCar.vy / carSpeed : 0;
                let push = Math.max(2, carSpeed);
                d.vx = (d.vx || 0) + pushX * push * 1.2;
                d.vy = (d.vy || 0) + pushY * push * 1.2;
                d.spin = (d.spin || 0) + (Math.random()-0.5)*0.2;
                // Nudge car away from the object (prevent sticking)
                let maxAttempts = 8;
                let attempts = 0;
                while (checkCollision(rect, activeCar.worldX, activeCar.worldY, activeCar.angle, activeCar.width, activeCar.height) && attempts < maxAttempts) {
                    let closestX = Math.max(d.x, Math.min(activeCar.worldX, d.x + d.width));
                    let closestY = Math.max(d.y, Math.min(activeCar.worldY, d.y + d.height));
                    let ndx = activeCar.worldX - closestX;
                    let ndy = activeCar.worldY - closestY;
                    let ndist = Math.sqrt(ndx*ndx + ndy*ndy) || 1;
                    let nudgeDist = 2;
                    activeCar.worldX += (ndx / ndist) * nudgeDist;
                    activeCar.worldY += (ndy / ndist) * nudgeDist;
                    attempts++;
                }
                // Project velocity onto normal and tangent
                let closestX = Math.max(d.x, Math.min(activeCar.worldX, d.x + d.width));
                let closestY = Math.max(d.y, Math.min(activeCar.worldY, d.y + d.height));
                let ndx = activeCar.worldX - closestX;
                let ndy = activeCar.worldY - closestY;
                let ndist = Math.sqrt(ndx*ndx + ndy*ndy) || 1;
                let normalX = ndx / ndist, normalY = ndy / ndist;
                let dot = activeCar.vx * normalX + activeCar.vy * normalY;
                let bounciness = 0.5;
                activeCar.vx = activeCar.vx - (1 + bounciness) * dot * normalX;
                activeCar.vy = activeCar.vy - (1 + bounciness) * dot * normalY;
                activeCar.vx *= 0.85;
                activeCar.vy *= 0.85;
                // Damage system
                let now = Date.now();
                if (now - lastCollisionTime > 300) {
                    activeCar.health -= Math.min(20, Math.abs(dot) * 8);
                    if (activeCar.health < 0) activeCar.health = 0;
                    lastCollisionTime = now;
                    let impactAngle = Math.atan2(normalY, normalX);
                    spawnSparks(closestX, closestY, impactAngle);
                }
                break;
            }
        }
    }

    // Collision with decorations
    for (let d of decorations) {
        // Skip unbreakable ragdoll objects (handled by persistent physics above)
        if (d.type === 'unbreakable' && d.ragdoll && !d.breakable) continue;
        if (d.collision && d.state !== 'ragdoll' && checkCollision(d, activeCar.worldX, activeCar.worldY, activeCar.angle, activeCar.width, activeCar.height)) {
            activeCar.worldX = prevX;
            activeCar.worldY = prevY;
            resolveDecorationCollision(activeCar, d);
            if (checkCollision(d, activeCar.worldX, activeCar.worldY, activeCar.angle, activeCar.width, activeCar.height)) {
                resolveDecorationCollision(activeCar, d);
            }
            break;
        }
    }

    // Sliding detection for effects
    let velocityAngle = Math.atan2(activeCar.vy, activeCar.vx);
    let carAngle = Math.atan2(forwardY, forwardX) + Math.PI / 2;
    let angleDiff = Math.abs(Math.atan2(Math.sin(velocityAngle - angleRad), Math.cos(velocityAngle - angleRad)));
    let sliding = angleDiff > 0.2 && newSpeed > 1;

    // After moving car, check if rear tires are over a blood spill
    let rearOffset = 20;
    let leftWheel = {
        x: activeCar.worldX + Math.sin(angleRad + Math.PI / 2) * (activeCar.width / 2 - 8) - Math.sin(angleRad) * rearOffset,
        y: activeCar.worldY - Math.cos(angleRad + Math.PI / 2) * (activeCar.width / 2 - 8) + Math.cos(angleRad) * rearOffset
    };
    let rightWheel = {
        x: activeCar.worldX + Math.sin(angleRad - Math.PI / 2) * (activeCar.width / 2 - 8) - Math.sin(angleRad) * rearOffset,
        y: activeCar.worldY - Math.cos(angleRad - Math.PI / 2) * (activeCar.width / 2 - 8) + Math.cos(angleRad) * rearOffset
    };
    for (let s of bloodSpills) {
        let dL = Math.hypot(leftWheel.x - s.x, leftWheel.y - s.y);
        let dR = Math.hypot(rightWheel.x - s.x, rightWheel.y - s.y);
        if (dL < s.radius || dR < s.radius) {
            bloodyTiresTimer = 120; // 2 seconds at 60fps
            break;
        }
    }
    if (bloodyTiresTimer > 0) bloodyTiresTimer--;

    // Tire marks and smoke when sliding AND handbrake is held
    if (sliding && keys.Space) {
        if (!wasDrifting) {
            tireMarks.push(null); // break the path
        }
        tireMarks.push({left: {...leftWheel}, right: {...rightWheel}, alpha: 0.7, blood: bloodyTiresTimer > 0});
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
        let rad = activeCar.angle * Math.PI / 180;
        let cos = Math.cos(rad), sin = Math.sin(rad);
        let hw = activeCar.width / 2, hh = activeCar.height / 2;
        let dx = z.x - activeCar.worldX, dy = z.y - activeCar.worldY;
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
            // Try to push car out (as before)
            activeCar.worldX -= worldNx * overlap;
            activeCar.worldY -= worldNy * overlap;
            // Also try to push zombie out, but only if not into building
            let zxNew = z.x + worldNx * overlap;
            let zyNew = z.y + worldNy * overlap;
            let blocked = false;
            for (const bld of buildings) {
                if (circleRectCollision(zxNew, zyNew, z.radius, bld.x, bld.y, bld.width, bld.height)) {
                    blocked = true;
                    break;
                }
            }
            if (!blocked) {
                z.x = zxNew;
                z.y = zyNew;
            }
        }
    }

    // Burnout effect (extra smoke and tire marks at rear wheels)
    if (burnoutTimer > 0) {
        if (burnoutTimer === 18) {
            tireMarks.push(null); // break the path at the start of burnout
        }
        tireMarks.push({left: {...leftWheel}, right: {...rightWheel}, alpha: 1, blood: bloodyTiresTimer > 0});
        for (let i = 0; i < 2; i++) {
            let wheel = i === 0 ? leftWheel : rightWheel;
            smokeParticles.push({
                x: wheel.x,
                y: wheel.y,
                alpha: 0.7 + Math.random() * 0.3,
                radius: 12 + Math.random() * 8,
                vx: (Math.random() - 0.5) * 1.8,
                vy: (Math.random() - 0.5) * 1.8
            });
        }
        burnoutTimer--;
    }

    // Collision with persistent ragdoll decorations (unbreakable objects)
    for (let r of decorationRagdolls) {
        if (r.collision && r.persistent) {
            // Treat ragdoll as a static obstacle (centered at r.x, r.y)
            let rect = {
                x: r.x - r.width/2,
                y: r.y - r.height/2,
                width: r.width,
                height: r.height
            };
            if (checkCollision(rect, activeCar.worldX, activeCar.worldY, activeCar.angle, activeCar.width, activeCar.height)) {
                activeCar.worldX = prevX;
                activeCar.worldY = prevY;
                resolveCollision(activeCar, rect);
                // If still colliding, nudge again
                if (checkCollision(rect, activeCar.worldX, activeCar.worldY, activeCar.angle, activeCar.width, activeCar.height)) {
                    resolveCollision(activeCar, rect);
                }
                break;
            }
        }
    }

    // Simple circle collision with abandoned cars (centered at a.x, a.y)
    for (let i = 0; i < abandonedCars.length; i++) {
        const a = abandonedCars[i];
        // Center of abandoned car is (a.x, a.y)
        const ax = a.x;
        const ay = a.y;
        const aradius = (a.width + a.height) / 4;
        const carRadius = (activeCar.width + activeCar.height) / 4;
        const dx = activeCar.worldX - ax;
        const dy = activeCar.worldY - ay;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < aradius + carRadius) {
            // Simple response: move car back to previous position and stop velocity
            activeCar.worldX = prevX;
            activeCar.worldY = prevY;
            activeCar.vx = 0;
            activeCar.vy = 0;
            break;
        }
    }

    // Car destruction logic
    if (activeCar.health <= 0 && !activeCar.destroyed) {
        // Trigger explosion effect
        spawnCarExplosion(activeCar.worldX, activeCar.worldY, activeCar.width, activeCar.height);
        // Add to abandonedCars as destroyed
        abandonedCars.push({
            x: activeCar.worldX,
            y: activeCar.worldY,
            angle: activeCar.angle,
            img: activeCar.img,
            width: activeCar.width,
            height: activeCar.height,
            health: 0,
            destroyed: true
        });
        // Remove from drivable cars
        cars.splice(cars.indexOf(activeCar), 1);
        inCar = false;
        activeCar.destroyed = true;
        // Place player outside car
        const angleRad = activeCar.angle * Math.PI / 180;
        const exitDistance = (activeCar.width / 2 + player.radius) * 2;
        player.x = activeCar.worldX + Math.cos(angleRad - Math.PI / 2) * exitDistance;
        player.y = activeCar.worldY + Math.sin(angleRad - Math.PI / 2) * exitDistance;
        activeCar.vx = 0;
        activeCar.vy = 0;
        // Switch to another car if available
        if (cars.length > 0) {
            activeCar = cars[0];
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

// Preload car images for all possible car types
const carImgs = {};
['images/cars/car1.png', 'images/cars/car2.png', 'images/cars/car3.png', 'images/cars/car4.png', 'images/cars/car5.png', 'images/cars/car6.png', 'images/cars/car7.png', 'images/cars/car8.png', 'images/cars/car9.png'].forEach(src => {
    const img = new window.Image();
    img.src = src;
    carImgs[src] = img;
});

function drawCar() {
    ctx.save();
    ctx.translate(
        canvas.width / 2 + (activeCar.worldX - worldOffsetX),
        canvas.height / 2 + (activeCar.worldY - worldOffsetY)
    );
    ctx.rotate(activeCar.angle * Math.PI / 180);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.filter = 'blur(4px)';
    ctx.fillStyle = '#000';
    // Draw rounded rectangle for shadow
    const shadowW = activeCar.width + 8;
    const shadowH = activeCar.height + 8;
    const shadowR = Math.min(shadowW, shadowH) * 0.22;
    ctx.beginPath();
    roundedRectPath(ctx, -activeCar.width / 2, -activeCar.height / 2, shadowW, shadowH, shadowR);
    ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
    // Draw car image or fallback
    if (activeCar.img) {
        const img = carImgs[activeCar.img];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, -activeCar.width / 2, -activeCar.height / 2, activeCar.width, activeCar.height);
        } else {
            ctx.fillStyle = '#ff0';
            ctx.fillRect(-activeCar.width / 2, -activeCar.height / 2, activeCar.width, activeCar.height);
        }
    }
    // Draw blood splats on car (on top)
    for (let s of carBloodSplats) {
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.translate(s.x, s.y);
        ctx.rotate(s.angle);
        ctx.beginPath();
        ctx.arc(0, 0, s.radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#a00';
        ctx.filter = 'blur(1.5px)';
        ctx.fill();
        ctx.filter = 'none';
        ctx.restore();
    }
    ctx.globalAlpha = 1;
    // Draw fire effect (on top of car)
    ctx.restore();
    drawCarFireParticles();
    // Draw car border for collision
    // ctx.save();
    // ctx.lineWidth = 2;
    // ctx.strokeStyle = '#e22';
    // ctx.strokeRect(-activeCar.width / 2, -activeCar.height / 2, activeCar.width, activeCar.height);
    // ctx.restore();
    ctx.restore();
}

function drawTireMarks() {
    ctx.save();
    for (let i = 1; i < tireMarks.length; i++) {
        if (!tireMarks[i-1] || !tireMarks[i]) continue;
        ctx.lineWidth = 4;
        // Blood color if either mark is bloody
        let isBlood = tireMarks[i].blood || tireMarks[i-1].blood;
        ctx.strokeStyle = isBlood ? 'rgba(160,0,0,0.7)' : 'rgba(40,40,40,0.7)';
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
    ctx.fillStyle = '#222';
    ctx.fillRect(20, 20, 200, 24);
    ctx.fillStyle = activeCar.health > 30 ? '#0f0' : '#f00';
    ctx.fillRect(20, 20, 2 * activeCar.health, 24);
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
        s.alpha -= 0.007;
        s.radius += s.grow;
        s.grow *= 0.96;
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

function drawBloodSpills() {
    ctx.save();
    for (let s of bloodSpills) {
        ctx.beginPath();
        ctx.arc(
            canvas.width / 2 + (s.x - worldOffsetX),
            canvas.height / 2 + (s.y - worldOffsetY),
            s.radius, 0, 2 * Math.PI
        );
        ctx.fillStyle = '#a00';
        ctx.globalAlpha = s.alpha;
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

function lerpColor(a, b, t) {
    // a, b: hex color strings like '#a00', '#2f2'
    // t: 0..1
    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        return [parseInt(hex.substr(0,2),16), parseInt(hex.substr(2,2),16), parseInt(hex.substr(4,2),16)];
    }
    function rgbToHex(r,g,b) {
        return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
    }
    let c1 = hexToRgb(a), c2 = hexToRgb(b);
    let r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    let g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    let b_ = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    return rgbToHex(r,g,b_);
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
        // Color by type, blend to bloody red as health drops
        let baseColor = '#2f2';
        if (z.type === 'fast') baseColor = '#ff6';
        else if (z.type === 'tank') baseColor = '#39f';
        else if (z.type === 'boss') baseColor = '#a3f';
        let t = 1 - Math.max(0, Math.min(1, z.health / (z.type === 'boss' ? 300 : z.type === 'tank' ? 80 : z.type === 'fast' ? 18 : 30)));
        let color = lerpColor(baseColor, '#a00', t);
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
    // Shift background 200px to the left
    const offsetX = -((startX % tileW) + tileW) % tileW - 4400;
    const offsetY = -((startY % tileH) + tileH) % tileH - 3680;
    for (let x = offsetX; x < canvas.width; x += tileW) {
        for (let y = offsetY; y < canvas.height; y += tileH) {
            ctx.drawImage(bgImg, x, y, tileW, tileH);
        }
    }
}

function updateBloodSpills() {
    for (let s of bloodSpills) {
        if (s.growing) {
            s.radius += s.grow;
            if ((s.grow > 0 && s.radius >= s.targetRadius) || (s.grow < 0 && s.radius <= s.targetRadius)) {
                s.radius = s.targetRadius;
                s.growing = false;
            }
        }
    }
}

let carBloodSplats = [];

function updateCarBloodSplats() {
    for (let s of carBloodSplats) {
        s.timer--;
        s.alpha = Math.max(0, s.alpha - (1 / 1200));
    }
    carBloodSplats = carBloodSplats.filter(s => s.timer > 0 && s.alpha > 0.01);
}

function drawDecorations() {
    ctx.save();
    for (const d of decorations) {
        if (d.state === 'ragdoll') continue;
        // Draw shadow for 3D effect (optional)
        if (d.collision) {
            ctx.save();
            ctx.globalAlpha = 0.18;
            ctx.filter = 'blur(4px)';
            ctx.fillStyle = '#000';
            ctx.fillRect(
                canvas.width / 2 + (d.x - worldOffsetX) + 4,
                canvas.height / 2 + (d.y - worldOffsetY) + 8,
                d.width + 6, d.height + 6
            );
            ctx.filter = 'none';
            ctx.restore();
        }
        // Draw image or fallback
        const img = d.img ? decorationImgs[d.img] : null;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(
                img,
                canvas.width / 2 + (d.x - worldOffsetX),
                canvas.height / 2 + (d.y - worldOffsetY),
                d.width, d.height
            );
        } else {
            ctx.fillStyle = d.collision ? '#888' : '#ccc';
            ctx.fillRect(
                canvas.width / 2 + (d.x - worldOffsetX),
                canvas.height / 2 + (d.y - worldOffsetY),
                d.width, d.height
            );
        }
        // Draw decoration name
        ctx.save();
        ctx.font = '14px monospace';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        const label = d.name ? d.name : (d.img ? d.img.split('/').pop().replace('.png','') : '');
        ctx.fillText(label, canvas.width / 2 + (d.x - worldOffsetX) + d.width / 2, canvas.height / 2 + (d.y - worldOffsetY) - 2);
        ctx.restore();
    }
    ctx.restore();
}

function resolveDecorationCollision(car, deco) {
    // Breakable logic
    if (deco.breakable && deco.hitsToBreak > 0) {
        deco.hitsToBreak--;
        if (deco.hitsToBreak <= 0) {
            // Remove from decorations and spawn ragdoll with NO collision (debris fades out)
            if (deco.img && deco.img.includes('.png')) {
                deco.img = deco.img.replace('.png', '_broken.png');
            }
            spawnDecorationRagdoll(deco, car, false); // breakable: not persistent
            const idx = decorations.indexOf(deco);
            if (idx !== -1) decorations.splice(idx, 1);
            return;
        }
    } else if (deco.ragdoll && !deco.breakable) {
        // Unbreakable ragdoll: move the object to ragdoll array and remove from decorations
        spawnDecorationRagdoll(deco, car, true); // unbreakable: persistent
        const idx = decorations.indexOf(deco);
        if (idx !== -1) decorations.splice(idx, 1);
        return;
    }
    resolveCollision(car, deco);
}

function spawnDecorationRagdoll(deco, car, persistent) {
    // persistent: true for unbreakable, false for breakable debris
    let angle = Math.atan2(car.vy, car.vx);
    let speed = Math.max(2, Math.sqrt(car.vx * car.vx + car.vy * car.vy));
    decorationRagdolls.push({
        x: deco.x + deco.width/2,
        y: deco.y + deco.height/2,
        vx: Math.cos(angle) * speed * 2,
        vy: Math.sin(angle) * speed * 2,
        width: deco.width,
        height: deco.height,
        img: deco.img,
        alpha: 1,
        timer: persistent ? 999999 : 60 + Math.floor(Math.random() * 30), // persistent for unbreakable, short for debris
        angle: 0,
        spin: (Math.random() - 0.5) * 0.2,
        collision: !!persistent,
        persistent: !!persistent
    });
}

function updateDecorationRagdolls() {
    for (let r of decorationRagdolls) {
        r.x += r.vx;
        r.y += r.vy;
        r.vx *= 0.92;
        r.vy *= 0.92;
        r.angle += r.spin;
        r.spin *= 0.92;
        if (!r.persistent) r.alpha -= 0.025;
        r.timer--;
        // If velocity is very low, stop collision but keep persistent ragdoll as static
        if (r.collision && Math.abs(r.vx) < 0.05 && Math.abs(r.vy) < 0.05) {
            if (r.persistent) {
                r.vx = 0; r.vy = 0; r.spin = 0; r.collision = true; // stay as static obstacle
            } else {
                r.collision = false;
            }
        }
    }
    decorationRagdolls = decorationRagdolls.filter(r => r.persistent || (r.timer > 0 && (r.collision || r.alpha > 0)));
}

function drawDecorationRagdolls() {
    ctx.save();
    for (let r of decorationRagdolls) {
        ctx.save();
        ctx.globalAlpha = r.alpha;
        ctx.translate(canvas.width / 2 + (r.x - worldOffsetX), canvas.height / 2 + (r.y - worldOffsetY));
        ctx.rotate(r.angle);
        const img = r.img ? decorationImgs[r.img] : null;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, -r.width/2, -r.height/2, r.width, r.height);
        } else {
            ctx.fillStyle = '#a52';
            ctx.fillRect(-r.width/2, -r.height/2, r.width, r.height);
        }
        ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

// Simple AABB-vs-AABB collision for decorations/buildings
function aabbCollision(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function updateDecorationPhysics() {
    for (const d of decorations) {
        if (d.type === 'unbreakable' && d.ragdoll && !d.breakable) {
            let nextX = d.x + (d.vx || 0);
            let nextY = d.y + (d.vy || 0);
            // Check X movement
            let canMoveX = true;
            for (const b of buildings) {
                if (aabbCollision({x: nextX, y: d.y, width: d.width, height: d.height}, b)) {
                    canMoveX = false;
                    break;
                }
            }
            if (canMoveX) {
                d.x = nextX;
            } else {
                d.vx = 0;
            }
            // After X movement, recalculate nextY using updated d.x
            let nextY2 = d.y + (d.vy || 0);
            let canMoveY = true;
            for (const b of buildings) {
                if (aabbCollision({x: d.x, y: nextY2, width: d.width, height: d.height}, b)) {
                    canMoveY = false;
                    break;
                }
            }
            if (canMoveY) {
                d.y = nextY2;
            } else {
                d.vy = 0;
            }
            d.angle += d.spin || 0;
            // Friction
            d.vx *= 0.92;
            d.vy *= 0.92;
            d.spin *= 0.92;
            // Stop if very slow
            if (Math.abs(d.vx) < 0.05) d.vx = 0;
            if (Math.abs(d.vy) < 0.05) d.vy = 0;
            if (Math.abs(d.spin) < 0.01) d.spin = 0;
        }
    }
}

// Fire particles for car damage
let carFireParticles = [];

function updateCarFireParticles() {
    // Number of fire sources depends on car health
    let fireCount = 0;
    if (activeCar.health < 70) fireCount = 1;
    if (activeCar.health < 50) fireCount = 2;
    if (activeCar.health < 30) fireCount = 3;
    if (activeCar.health < 15) fireCount = 5;
    // Add new fire particles at random points on car
    for (let i = 0; i < fireCount; i++) {
        // Place fire at random spot on car top
        let angle = activeCar.angle * Math.PI / 180;
        let rx = (Math.random() - 0.5) * (activeCar.width - 18);
        let ry = (Math.random() - 0.2) * (activeCar.height * 0.7 - 18) - activeCar.height * 0.15;
        let px = activeCar.worldX + rx * Math.cos(angle) - ry * Math.sin(angle);
        let py = activeCar.worldY + rx * Math.sin(angle) + ry * Math.cos(angle);
        carFireParticles.push({
            x: px,
            y: py,
            vx: (Math.random() - 0.5) * 0.4, // slightly less spread
            vy: -0.7 - Math.random() * 0.4,  // less vertical speed
            radius: 3 + Math.random() * 2 + (5 - fireCount) * 0.7, // much smaller
            alpha: 0.7 + Math.random() * 0.3,
            color: Math.random() < 0.5 ? '#ff0' : (Math.random() < 0.5 ? '#f80' : '#f00'),
            life: 14 + Math.random() * 6
        });
    }
    // Update fire particles
    for (let p of carFireParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy -= 0.03; // less upward acceleration
        p.radius *= 0.97;
        p.alpha -= 0.025;
        p.life--;
    }
    carFireParticles = carFireParticles.filter(p => p.life > 0 && p.alpha > 0.05 && p.radius > 1);

    // --- Update fire for all abandoned cars ---
    for (let a of abandonedCars) {
        if (typeof a.health !== 'number') continue;
        if (!a.fireParticles) a.fireParticles = [];
        // Only show fire if health is low
        let fireCount = 0;
        if (a.health < 70) fireCount = 1;
        if (a.health < 50) fireCount = 2;
        if (a.health < 30) fireCount = 3;
        if (a.health < 15) fireCount = 5;
        for (let i = 0; i < fireCount; i++) {
            let angle = (a.angle || 0) * Math.PI / 180;
            let rx = (Math.random() - 0.5) * ((a.width || 48) - 18);
            let ry = (Math.random() - 0.2) * ((a.height || 84) * 0.7 - 18) - (a.height || 84) * 0.15;
            let px = (a.x + (a.width||48)/2) + rx * Math.cos(angle) - ry * Math.sin(angle);
            let py = (a.y + (a.height||84)/2) + rx * Math.sin(angle) + ry * Math.cos(angle);
            a.fireParticles.push({
                x: px,
                y: py,
                vx: (Math.random() - 0.5) * 0.4,
                vy: -0.7 - Math.random() * 0.4,
                radius: 3 + Math.random() * 2 + (5 - fireCount) * 0.7,
                alpha: 0.7 + Math.random() * 0.3,
                color: Math.random() < 0.5 ? '#ff0' : (Math.random() < 0.5 ? '#f80' : '#f00'),
                life: 14 + Math.random() * 6
            });
        }
        // Update fire particles
        for (let p of a.fireParticles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy -= 0.03;
            p.radius *= 0.97;
            p.alpha -= 0.025;
            p.life--;
        }
        a.fireParticles = a.fireParticles.filter(p => p.life > 0 && p.alpha > 0.05 && p.radius > 1);
        // If car is repaired, clear fire
        if (a.health >= 70) a.fireParticles = [];
    }
}

function drawCarFireParticles() {
    ctx.save();
    for (let p of carFireParticles) {
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(
            canvas.width / 2 + (p.x - worldOffsetX),
            canvas.height / 2 + (p.y - worldOffsetY),
            p.radius, 0, 2 * Math.PI
        );
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#ff0';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.restore();
}

// Abandoned cars as background props
const abandonedCars = [
    { x: 880, y: -60, angle: 0, img: 'images/cars/car2.png', width: 48, height: 84 },
    { x: 620, y: -100, angle: 0, img: 'images/cars/car3.png', width: 48, height: 84 },
    { x: 120, y: 400, angle: 90, img: 'images/cars/car4.png', width: 60, height: 100 },
    { x: 1100, y: 20, angle: 0, img: 'images/cars/car5.png', width: 48, height: 84 },
    { x: 300, y: 200, angle: 15, img: 'images/cars/car6.png', width: 48, height: 84 },
    { x: 400, y: 600, angle: -30, img: 'images/cars/car7.png', width: 48, height: 84 },
    { x: -600, y: -400, angle: 45, img: 'images/cars/car8.png', width: 60, height: 100 },
    { x: 1000, y: 300, angle: 0, img: 'images/cars/car9.png', width: 48, height: 84 }
];
const abandonedCarImgs = {};
for (const a of abandonedCars) {
    if (a.img && !abandonedCarImgs[a.img]) {
        const img = new window.Image();
        img.src = a.img;
        abandonedCarImgs[a.img] = img;
    }
}

function drawAbandonedCars() {
    ctx.save();
    for (const a of abandonedCars) {
        ctx.save();
        ctx.translate(
            canvas.width / 2 + (a.x - worldOffsetX),
            canvas.height / 2 + (a.y - worldOffsetY)
        );
        ctx.rotate((a.angle || 0) * Math.PI / 180);
        // Draw shadow
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.filter = 'blur(4px)';
        ctx.fillStyle = '#000';
        ctx.fillRect(-a.width / 2, -a.height / 2, a.width + 8, a.height + 8);
        ctx.filter = 'none';
        ctx.restore();
        // Draw car image or fallback
        if (a.destroyed) {
            ctx.fillStyle = '#111';
            ctx.fillRect(-a.width / 2, -a.height / 2, a.width, a.height);
        } else {
            const img = abandonedCarImgs[a.img];
            if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, -a.width / 2, -a.height / 2, a.width, a.height);
            } else {
                ctx.fillStyle = '#888';
                ctx.fillRect(-a.width / 2, -a.height / 2, a.width, a.height);
            }
        }
        // Draw fire particles for this abandoned car
        if (a.fireParticles && a.fireParticles.length > 0) {
            for (let p of a.fireParticles) {
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x - (a.x + a.width/2), p.y - (a.y + a.height/2), p.radius, 0, 2 * Math.PI);
                ctx.fillStyle = p.color;
                ctx.shadowColor = '#ff0';
                ctx.shadowBlur = 12;
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.restore();
            }
        }
        ctx.restore();
    }
    ctx.restore();
}

// --- Melee attack state ---
let meleeSwinging = false;
let meleeSwingTimer = 0;
let meleeSwingCooldown = 0;
const MELEE_SWING_DURATION = 12; // frames
const MELEE_SWING_COOLDOWN = 24; // frames
const MELEE_SWING_ARC = Math.PI / 1.8; // 150 degrees
const MELEE_SWING_RANGE = 30; // pixels
const MELEE_SWING_DAMAGE = 10;
let meleeSwingAngle = 0;

// --- Mouse state for melee direction ---
let mouseX = 0;
let mouseY = 0;
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});
// Listen for left mouse click to swing
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0 && !inCar && meleeSwingCooldown === 0 && !meleeSwinging) {
        meleeSwinging = true;
        meleeSwingTimer = MELEE_SWING_DURATION;
        meleeSwingCooldown = MELEE_SWING_COOLDOWN;
        // Swing angle is toward mouse
        meleeSwingAngle = Math.atan2(mouseY - canvas.height / 2, mouseX - canvas.width / 2);
    }
});
// Remove F key logic for melee
// ... existing code ...
// Track last movement direction for swing and update direction to mouse when on foot
if (!inCar) {
    // Use mouse direction for facing
    lastMoveAngle = Math.atan2(mouseY - canvas.height / 2, mouseX - canvas.width / 2);
}
// ... existing code ...

// Preload knife image for melee swing
const knifeImg = new window.Image();
knifeImg.src = 'images/knife.png';

let gameOver = false;
let gameWon = false;

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawAbandonedCars();
    drawZones();
    drawBuildings();
    drawDecorations();
    updateBloodSpills();
    drawBloodSpills();
    drawTireMarks();
    drawSmoke();
    drawSplashes();
    drawStaticBodyParts();
    drawBodyParts();
    drawZombies();
    drawSparks();
    updateCarBloodSplats();
    updateCarFireParticles();
    updateDecorationPhysics();
    if (!gameOver && !gameWon) update();
    drawCar();
    drawMeleeSwing();
    drawPlayer();
    drawHealthBar();
    // Force win if counter is zero
    if (zombies.length === 0 && !gameWon) {
        gameWon = true;
    }
    drawDecorationRagdolls();
    updateDecorationRagdolls();
    drawGameOver();
    drawWin();
    requestAnimationFrame(gameLoop);
}

function drawMeleeSwing() {
    if (!meleeSwinging || inCar) return;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, MELEE_SWING_RANGE, meleeSwingAngle - MELEE_SWING_ARC / 2, meleeSwingAngle + MELEE_SWING_ARC / 2);
    ctx.stroke();
    // Draw knife animation at the tip of the swing arc
    // Animate knife along the arc based on swing progress
    let swingProgress = 1 - meleeSwingTimer / MELEE_SWING_DURATION;
    let arcStart = meleeSwingAngle - MELEE_SWING_ARC / 2;
    let arcEnd = meleeSwingAngle + MELEE_SWING_ARC / 2;
    let knifeAngle = arcStart + (arcEnd - arcStart) * swingProgress;
    let knifeX = Math.cos(knifeAngle) * MELEE_SWING_RANGE;
    let knifeY = Math.sin(knifeAngle) * MELEE_SWING_RANGE;
    ctx.save();
    ctx.translate(knifeX, knifeY);
    ctx.rotate(knifeAngle);
    // Draw knife image if loaded, else draw a white rectangle as placeholder
    if (knifeImg.complete && knifeImg.naturalWidth > 0) {
        ctx.drawImage(knifeImg, -12, -4, 24, 8);
    } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-12, -3, 24, 6);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.restore();
}

// Helper function for rounded rectangle path
function roundedRectPath(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
}

// Explosion effect for car destruction
function spawnCarExplosion(x, y, w, h) {
    for (let i = 0; i < 32; i++) {
        let angle = Math.random() * 2 * Math.PI;
        let speed = 2 + Math.random() * 6;
        sparks.push({
            x: x + (Math.random()-0.5)*w/2,
            y: y + (Math.random()-0.5)*h/2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 0.7 + Math.random()*0.3,
            life: 20 + Math.random() * 10
        });
    }
}

function drawGameOver() {
    if (!gameOver) return;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 80px Arial';
    ctx.fillStyle = '#f00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
    ctx.font = '32px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Press F5 to Restart', canvas.width / 2, canvas.height / 2 + 70);
    ctx.restore();
}

function drawWin() {
    if (!gameWon) return;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 80px Arial';
    ctx.fillStyle = '#0f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOU WIN!', canvas.width / 2, canvas.height / 2);
    ctx.font = '32px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText('Press F5 to Restart', canvas.width / 2, canvas.height / 2 + 70);
    ctx.restore();
}

gameLoop();