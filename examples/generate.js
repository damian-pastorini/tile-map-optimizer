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
    originalMapFileName: 'reldens-town',
    factor: 2,
    transparentColor: '#000000',
    rootFolder: __dirname
};

const tileMapOptimizer = new TiledMapOptimizer(options);

tileMapOptimizer.generate().catch((error) => {
    Logger.error(error);
}).then(() => {
    Logger.info('Map saved! Check generated folder.');
});
