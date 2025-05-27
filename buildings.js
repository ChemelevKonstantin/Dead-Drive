// Example buildings template for city layout
// Each building has x, y, width, height (multiples of 100), and img
const buildings = [
    // Row 1
    { x: -800, y: -1000, width: 200, height: 200, img: 'images/buildings/b10.png' },
    { x: -500, y: -1000, width: 300, height: 200, img: 'images/buildings/b2.png' },
    { x: -100, y: -1000, width: 200, height: 300, img: 'images/buildings/b1.png' },
    { x: 250, y: -1000, width: 300, height: 300, img: 'images/buildings/b11.png' },
    { x: 600, y: -1000, width: 400, height: 200, img: 'images/buildings/b4.png' },
    // Row 2
    { x: -800, y: -600, width: 200, height: 400, img: 'images/buildings/b3.png' },
    { x: -500, y: -600, width: 300, height: 200, img: 'images/buildings/b12.png' },
    { x: -100, y: -600, width: 200, height: 200, img: 'images/buildings/b5.png' },
    { x: 250, y: -600, width: 300, height: 200, img: 'images/buildings/b13.png' },
    { x: 600, y: -600, width: 400, height: 100, img: 'images/buildings/b8.png' },
    // Row 3
    { x: -800, y: -100, width: 200, height: 200, img: 'images/buildings/b19.png' },
    { x: -500, y: -100, width: 300, height: 300, img: 'images/buildings/b6.png' },
    { x: 100, y: 100, width: 200, height: 300, img: 'images/buildings/b14.png' },
    { x: 250, y: -100, width: 300, height: 200, img: 'images/buildings/b9.png' },
    { x: 600, y: -100, width: 400, height: 200, img: 'images/buildings/b20.png' },
    // Row 4
    { x: -800, y: 400, width: 200, height: 400, img: 'images/buildings/b15.png' },
    { x: -500, y: 400, width: 300, height: 300, img: 'images/buildings/b7.png' },
    { x: -100, y: 400, width: 200, height: 200, img: 'images/buildings/b16.png' },
    { x: 250, y: 400, width: 300, height: 200, img: 'images/buildings/b17.png' },
    { x: 600, y: 400, width: 400, height: 300, img: 'images/buildings/b18.png' },
    // Row 5
    { x: -800, y: 900, width: 200, height: 200, img: 'images/buildings/b3.png' },
    { x: -500, y: 900, width: 300, height: 200, img: 'images/buildings/b12.png' },
    { x: -100, y: 900, width: 200, height: 200, img: 'images/buildings/b5.png' },
    { x: 250, y: 900, width: 300, height: 200, img: 'images/buildings/b13.png' },
    { x: 600, y: 900, width: 400, height: 200, img: 'images/buildings/b8.png' }
];

// Example ground zones (different surface types)
const zones = [
    { x: -400, y: 100, width: 300, height: 200, type: 'grass' },
    { x: 200, y: 200, width: 200, height: 100, type: 'sand' }
    // ...add more zones as needed
];

// Decoration elements
// type: 'unbreakable', 'breakable', 'small', 'decal'
// ragdoll: true/false, collision: true/false, breakable: true/false
const decorations = [
    // 1) Big unbreakable ragdoll objects (e.g. big trashcan, big electronic furniture)
    {
        x: 50, y: -200, width: 60, height: 60, img: 'images/decoration/big_trashcan.png',
        type: 'unbreakable', ragdoll: true, collision: true, breakable: false
    },
    {
        x: 200, y: 500, width: 80, height: 40, img: 'images/decoration/big_tv.png',
        type: 'unbreakable', ragdoll: true, collision: true, breakable: false
    },
    // 2) Breakable ragdoll objects (e.g. trashcan, sign)
    {
        x: 400, y: 200, width: 40, height: 40, img: 'images/decoration/trashcan.png',
        type: 'breakable', ragdoll: true, collision: true, breakable: true, hitsToBreak: 3
    },
    {
        x: 600, y: 300, width: 30, height: 60, img: 'images/decoration/sign.png',
        type: 'breakable', ragdoll: true, collision: true, breakable: true, hitsToBreak: 2
    },
    // 3) Small unbreakable objects (e.g. tree, kiosk)
    {
        x: 800, y: 100, width: 36, height: 36, img: 'images/decoration/tree.png',
        type: 'small', ragdoll: false, collision: true, breakable: false
    },
    {
        x: 900, y: 200, width: 60, height: 40, img: 'images/decoration/kiosk.png',
        type: 'small', ragdoll: false, collision: true, breakable: false
    },
    // 4) Decal elements (no collision)
    {
        x: 1200, y: 300, width: 80, height: 40, img: 'images/decoration/road_paint.png',
        type: 'decal', ragdoll: false, collision: false, breakable: false
    },
    {
        x: 1300, y: 400, width: 50, height: 50, img: 'images/decoration/leaf_pile.png',
        type: 'decal', ragdoll: false, collision: false, breakable: false
    }
];

export { buildings, zones, decorations }; 