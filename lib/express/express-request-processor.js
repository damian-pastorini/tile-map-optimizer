/**
 *
 * Reldens - Tile Map Optimizer - ExpressRequestProcessor
 *
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
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
                const DESTINY = process.env.DESTINY || 'destination';
                if (!fs.existsSync(DESTINY)) {
                    fs.mkdirSync(DESTINY, { recursive: true });
                }
                for (const file of req.files) {
                    const tempPath = file.path;
                    const targetPath = path.join(DESTINY, file.originalname);
                    fs.copyFileSync(tempPath, targetPath);
                    fs.unlinkSync(tempPath);
                }
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
