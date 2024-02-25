/**
 *
 * Reldens - Tile Map Optimizer - Examples
 *
 */

const { TiledMapOptimizer } = require('../tile-map-optimizer');
const { Logger } = require('@reldens/utils');
const originalJSON = require('./reldens-town.json');

const options = {
    originalJSON,
    originalImages: {
        doors: 'doors.png',
        house: 'house.png',
        outside: 'outside.png',
        terrain: 'terrain.png',
        water: 'water.png'
    },
    factor: 2,
    transparentColor: '#000000',
    rootFolder: __dirname
};

const tileMapOptimizer = new TiledMapOptimizer(options);

await tileMapOptimizer.generate().catch((error) => {
    Logger.error(error);
}).then(() => {
    Logger.info('Map saved! Check generated folder.');
});
