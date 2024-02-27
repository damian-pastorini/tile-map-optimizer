/**
 *
 * Reldens - Tile Map Optimizer - ExpressRequestProcessor
 *
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { TileMapOptimizer } = require('../tile-map-optimizer');

class ExpressRequestProcessor
{

    constructor(app)
    {
        this.app = app;
        this.tileMapOptimizer = null;
    }

    addListener()
    {
        this.app.use(express.urlencoded({ extended: false }));
        this.app.use(express.json());
        this.app.post('/optimize-map', async (req, res) => {
            try {
                let folder = process.env.DESTINY || 'destination';
                if (!fs.existsSync(folder)) {
                    fs.mkdirSync(folder, { recursive: true });
                }
                let jsonFileContent = '';
                for (const file of req.files) {
                    const tempPath = file.path;
                    const targetPath = path.join(folder, file.originalname);
                    if('.json' === path.extname(file.originalname).toLowerCase()){
                        const fileContent = fs.readFileSync(tempPath, 'utf8');
                        JSON.parse(fileContent);
                        jsonFileContent = fileContent;
                    }
                    fs.copyFileSync(tempPath, targetPath);
                    fs.unlinkSync(tempPath);
                }
                if('' === jsonFileContent){
                    res.status(500).json({message: 'Error, missing JSON file or invalid content.'});
                    return;
                }
                const options = {
                    originalJSON: jsonFileContent,
                    originalMapFileName: 'reldens-town',
                    factor: 2,
                    transparentColor: '#000000',
                    rootFolder: __dirname
                };
                this.tileMapOptimizer = new TileMapOptimizer(options);
                let result = await this.tileMapOptimizer.generate();
                res.status(200).json(result);
            } catch (error) {
                res.status(500).json({message: 'Error processing request', error: error.toString()});
            }
        });
    }
}

module.exports.ExpressRequestProcessor = ExpressRequestProcessor;
