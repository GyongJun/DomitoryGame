class SpriteManager {
    constructor() {
        this.basePath = ['assets/dead/', 'assets/frame0/', 'assets/frame1/', 
            'assets/frame2/', 'assets/frame3/', 'assets/frame4/'];
        this.itemsBasePath = 'assets/items/';
        this.extensions = ['-dead.png', '-frame0.png', '-frame1.png',
            '-frame2.png',  '-frame3.png', '-frame4.png'];
        this.itemImages = ['box1.png', 'box2.png', 'box3.png', 'health.png', 'speedBoots.png', 'strength.png', 'windoc.png'];
        this.images = new Map();
        this.cnt = 0;
    }

    async loadImage(imagePath) {
        let fullPath = '';
        if (this.cnt < this.basePath.length * 11) {
            fullPath = this.basePath[Math.floor(this.cnt / 11)] + imagePath + 
            this.extensions[Math.floor(this.cnt / 11)];
        }
        else {
            fullPath = this.itemsBasePath + imagePath;
        }

        if(this.images.has(fullPath)) {
            return this.images.get(fullPath);
        }

        return new Promise((resolve) => {
            const img = new Image();
            
            img.onload = () => {
                img.className = 'player-style';
                this.images.set(fullPath, img);
                console.log('이미지 로드', fullPath);
                resolve(img);
            };

            img.onerror = () => {
                console.error('이미지 로드 실패', fullPath);
                resolve(null);
            };
            img.className = 'player-style';
            img.src = fullPath;
            this.cnt++;
        });
    }

    async preloadImages() {
        const commonImages = [
            'black', 'blue1', 'blue', 'brown', 'green',
            'green1', 'red', 'white', 'yellow1', 'pink2', 'pink'
        ];

        const loadPromises = new Array();
        for (let i = 0; i < commonImages.length * this.basePath.length; i++) {
            loadPromises.push(this.loadImage(commonImages[i % 11]));
        }

        for (let i = 0; i < this.itemImages.length; i++) {
            loadPromises.push(this.loadImage(this.itemImages[i]));
        }

        await Promise.all(loadPromises);
    }

    getImage(imagePath) {
        return this.images.get(imagePath);
    }
}