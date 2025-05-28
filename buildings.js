// Example buildings template for city layout
// Each building has x, y, width, height (multiples of 100), and img
const buildings = [
    // FANCE
    { x: -4000, y: -2700, width: 7000, height: 300, img: 'images/buildings/fance.png' },
    { x: -4000, y: -2700, width: 300, height: 6000, img: 'images/buildings/fance.png' },
    { x: 3000, y: -2700, width: 300, height: 6000, img: 'images/buildings/fance.png' },
    { x: -4000, y: 3300, width: 7000, height: 300, img: 'images/buildings/fance.png' },

    // Row 2
    { x: 800, y: -1800, width: 260, height: 700, img: 'images/buildings/b3.png' },
    { x: 1060, y: -1800, width: 600, height: 300, img: 'images/buildings/b4.png' },
    { x: 1660, y: -1800, width: 240, height: 1400, img: 'images/buildings/b7.png' },
    { x: -100, y: -440, width: 2000, height: 240, img: 'images/buildings/b8.png' },
    { x: 1000, y: -800, width: 100, height: 100, img: 'images/buildings/b9.png' },

    { x: -2130, y: -1320, width: 240, height: 920, img: 'images/buildings/b10.png' },
    { x: -2700, y: -620, width: 570, height: 220, img: 'images/buildings/b10.png' },

    { x: -3280, y: -680, width: 300, height: 1360, img: 'images/buildings/b10.png' },

    { x: -3280, y: -2240, width: 300, height: 1300, img: 'images/buildings/b10.png' },
    { x: -2980, y: -2240, width: 920, height: 240, img: 'images/buildings/b10.png' },
    { x: -2360, y: -2000, width: 300, height: 300, img: 'images/buildings/b10.png' },
    { x: -2740, y: -960, width: 200, height: 200, img: 'images/buildings/b10.png' },

    { x: -2520, y: 40, width: 380, height: 380, img: 'images/buildings/b10.png' },

    // Row 3
    { x: -1560, y: -1220, width: 340, height: 340, img: 'images/buildings/b10.png' },

    { x: -940, y: -240, width: 240, height: 260, img: 'images/buildings/b11.png' },
    { x: -1700, y: -440, width: 1000, height: 200, img: 'images/buildings/b13.png' },
    { x: -1700, y: -240, width: 240, height: 260, img: 'images/buildings/b12.png' },

    { x: -940, y: 380, width: 240, height: 260, img: 'images/buildings/b11.png' },
    { x: -1700, y: 640, width: 1000, height: 200, img: 'images/buildings/b13.png' },
    { x: -1700, y: 380, width: 240, height: 260, img: 'images/buildings/b12.png' },

    { x: -330, y: 80, width: 320, height: 320, img: 'images/buildings/b17.png' },
    { x: 400, y: 140, width: 1200, height: 200, img: 'images/buildings/b18.png' },

    { x: -1360, y: 1400, width: 340, height: 340, img: 'images/buildings/b19.png' },

    { x: -760, y: 1120, width: 200, height: 200, img: 'images/buildings/b17.png' },
    { x: 720, y: 1200, width: 160, height: 160, img: 'images/buildings/b17.png' },

    { x: 0, y: 700, width: 1500, height: 200, img: 'images/buildings/b20.png' },
    { x: 1300, y: 900, width: 200, height: 900, img: 'images/buildings/b21.png' },
    { x: -500, y: 1600, width: 1800, height: 200, img: 'images/buildings/b22.png' }
];

// Example ground zones (different surface types)
const zones = [
    { x: -680, y: 100, width: 300, height: 200, type: 'grass' },
    { x: -680, y: 900, width: 400, height: 400, type: 'grass' },
    { x: -1800, y: 500, width: 800, height: 1100, type: 'grass' },
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
        x: 600, y: 220, width: 30, height: 60, img: 'images/decoration/sport.png',
        type: 'breakable', ragdoll: true, collision: true, breakable: true, hitsToBreak: 2
    },
    // 3) Small unbreakable objects (e.g. tree, kiosk)
    {
        x: 800, y: 200, width: 36, height: 36, img: 'images/decoration/tree.png',
        type: 'small', ragdoll: false, collision: true, breakable: false
    },
    {
        x: 1100, y: 240, width: 60, height: 40, img: 'images/decoration/kiosk.png',
        type: 'small', ragdoll: false, collision: true, breakable: false
    },
    // 4) Decal elements (no collision)
    {
        x: 1140, y: -100, width: 140, height: 100, img: 'images/decoration/cafe_enjoy.png',
        type: 'decal', ragdoll: false, collision: false, breakable: false
    },
    {
        x: 1200, y: 420, width: 100, height: 100, img: 'images/decoration/lotok.png',
        type: 'decal', ragdoll: false, collision: false, breakable: false
    },
    {
        x: 440, y: 420, width: 100, height: 100, img: 'images/decoration/lotok.png',
        type: 'decal', ragdoll: false, collision: false, breakable: false
    }
];

export { buildings, zones, decorations }; 