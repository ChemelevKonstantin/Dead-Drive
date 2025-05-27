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

export { buildings, zones }; 