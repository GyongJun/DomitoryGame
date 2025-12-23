const basePath = 'assets/items/';
const itemImages = ['health.png', 'speedBoots.png', 'strength.png', 'windoc.png'];
const boxImages = ['box1.png', 'box2.png', 'box3.png'];

class ItemManager {
    constructor(io) {
        this.items = {};
        this.timer = null;
        this.io = io;
    }

    createItem() {
        let current = Date.now();
        let boxImageId = Math.floor(Math.random() * boxImages.length);
        let itemImageId = Math.floor(Math.random() * itemImages.length);
        this.items[current] = {
            x: Math.floor(Math.random() * 700 + 50),
            y: Math.floor(Math.random() * 500 + 50),
            boxImage: basePath + boxImages[boxImageId],
            itemImage: basePath + itemImages[itemImageId],
            itemType: itemImages[itemImageId].slice(0, itemImages[itemImageId].length - 4)
        };
    }
}

module.exports = ItemManager;