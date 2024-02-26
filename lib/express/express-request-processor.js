/**
 *
 * Reldens - Tile Map Optimizer - ExpressRequestProcessor
 *
 */

const express = require('express');
const fs = require('fs');
const { TiledMapOptimizer } = require('../../tile-map-optimizer');


class ExpressRequestProcessor
{

    constructor(app)
    {
        this.app = app;
        this.tileMapOptimizer = null;
    }

    addListener(listener)
    {
        this.app.use(express.urlencoded({ extended: false }));
        this.app.use(express.json());
        this.app.post('/optimize-map', async (req, res) => {
            try {
                // You would handle file uploads here and pass the file paths to `processTiledMap`
                const options = {
                    originalJSON: fs.readFileSync('./'+req.body.originalJSON, 'utf8'),
                    originalMapFileName: 'reldens-town',
                    factor: 2,
                    transparentColor: '#000000',
                    rootFolder: __dirname
                };

                const tileMapOptimizer = new TiledMapOptimizer(options);

                let result = await tileMapOptimizer.generate();

                res.status(200).json(result);
            } catch (error) {
                res.status(500).json({message: 'Error processing request', error: error.toString()});
            }
        });
    }
}

module.exports.ExpressRequestProcessor = ExpressRequestProcessor;
