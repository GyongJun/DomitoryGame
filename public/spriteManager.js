class SpriteManager {
    constructor() {
        this.basePath = 'assets/';
        this.images = new Map();
    }

    async loadImage(imagePath) {
        const fullPath = this.basePath + imagePath;

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
        });
    }

    async preloadImages() {
        const commonImages = [
            'black.png', 'blue.png', 'blue1.png', 'brown.png', 'green.png',
            'green1.png', 'green2.png', 'red1.png', 'white.png', 'yellow1.png',
            'pink.png',
            'black-dead.png', 'blue-dead.png', 'blue1-dead.png', 'brown-dead.png', 'green-dead.png',
            'green1-dead.png', 'green2-dead.png', 'red1-dead.png', 'white-dead.png', 'yellow1-dead.png',
            'pink-dead.png'
        ];

        const loadPromises = commonImages.map(image =>
            this.loadImage(image)
        );

        await Promise.all(loadPromises);
    }

    getImage(imagePath) {
        const fullPath = this.basePath + imagePath;
        return this.images.get(fullPath);
    }
}