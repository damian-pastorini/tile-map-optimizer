/**
 *
 * Reldens - Tile Map Optimizer - TiledMapOptimizer
 *
 */

const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
let { OptionsValidator } = require('./lib/validator/options-validator');
let { FileHandler } = require('./lib/files/file-handler');
const { Logger, sc } = require('@reldens/utils');

class TiledMapOptimizer
{

    version = 1

    constructor(props)
    {
        this.currentDate = (new Date()).toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '-');
        this.optionsValidator = new OptionsValidator();
        this.fileHandler = new FileHandler();
        this.isReady = false;
        if(props && 0 < Object.keys(props).length){
            this.setOptions(props);
            this.isReady = this.validate();
        }
    }

    setOptions(options)
    {
        // required:
        this.originalJSON = sc.get(options, 'originalJSON', false);
        // optional:
        this.originalMapFileName = sc.get(options, 'originalMapFileName', '').toLowerCase();
        this.appendOriginalName = this.originalMapFileName ? '-'+this.originalMapFileName : '';
        this.newName = sc.get(
            options,
            'newName',
            `optimized-map-v${this.version}${this.appendOriginalName}-${this.currentDate}`
        );
        this.factor = sc.get(options, 'factor', 1);
        this.transparentColor = sc.get(options, 'transparentColor', '#000000');
        this.rootFolder = sc.get(options, 'rootFolder', __dirname);
        this.generatedFolder = sc.get(
            options,
            'generatedFolder',
            this.fileHandler.joinPaths(this.rootFolder, 'generated')
        );
        this.mapFileName = sc.get(
            options,
            'mapFileName',
            this.fileHandler.joinPaths(this.generatedFolder, this.newName+'.json')
        );
        this.tileSheetFileName = sc.get(
            options,
            'tileSheetFileName',
            this.fileHandler.joinPaths(this.generatedFolder, this.newName+'.png')
        );
        // dynamic generated:
        this.mappedOldToNewTiles = [];
        this.tileSetData = [];
        this.newImagesPositions = [];
        this.tileWidth = 0;
        this.tileHeight = 0;
        this.totalRows = 0;
        this.totalColumns = 0;
        this.newMapImageWidth = 0;
        this.newMapImageHeight = 0;
        this.newMapImage = null; // the image resource
    }

    validate()
    {
        return this.optionsValidator.validate(this);
    }

    async generate()
    {
        this.isReady = this.validate();
        if(!this.isReady){
            return false;
        }
        return await this.optimize();
    }

    async optimize()
    {
        this.tileWidth = this.originalJSON.tilewidth;
        this.tileHeight = this.originalJSON.tileheight;
        this.parseJSON();
        try {
            this.newMapImage = sharp({
                create: {
                    width: this.newMapImageWidth,
                    height: this.newMapImageHeight,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            });
            await this.createThumbsFromLayersData();
            this.createNewJSON();
            await this.newMapImage.png().toFile(this.tileSheetFileName);
            if (1 < this.factor) {
                await this.resizeTileset();
            }
            this.output = {
                image: this.tileSheetFileName,
                json: this.mapFileName
            };
            return this.output;
        } catch (error) {
            Logger.error('Error creating new map image.', error);
            return null;
        }
    }

    parseJSON()
    {
        this.originalJSON.layers.forEach(layer => {
            if (!layer.data) {
                Logger.error('Invalid JSON.');
            }
            // clean up for duplicates
            const clean = [...new Set(layer.data)];
            // map new positions
            this.mappedOldToNewTiles = [...new Set([...this.mappedOldToNewTiles, ...clean])];
        });
        let spacing = 0;
        // get tilesets data
        this.originalJSON.tilesets.forEach(tileset => {
            let animations = [];
            let animationTiles = [];
            if (tileset.tiles) {
                animations = [...animations, ...tileset.tiles];
                tileset.tiles.forEach(animation => {
                    animationTiles.push(tileset.firstgid + animation.id);
                    animation.animation.forEach(frame => {
                        animationTiles.push(tileset.firstgid + frame.tileid);
                    });
                });
            }
            const cleanAnimationTiles = [...new Set(animationTiles)];
            this.mappedOldToNewTiles = [...new Set([...this.mappedOldToNewTiles, ...cleanAnimationTiles])];
            const tilesetImagePathArray = tileset.image.split('/');
            const tilesetImageName = tilesetImagePathArray[tilesetImagePathArray.length - 1];
            this.tileSetData[tileset.name] = {
                first: tileset.firstgid,
                last: tileset.firstgid + tileset.tilecount,
                tiles_count: tileset.tilecount,
                image: tilesetImageName,
                tmp_image: tilesetImageName,
                width: tileset.imagewidth,
                height: tileset.imageheight,
                animations: animations,
                margin: tileset.margin,
                spacing: tileset.spacing
            };
            if (spacing < tileset.spacing) {
                spacing = tileset.spacing;
            }
        });
        // sort
        this.mappedOldToNewTiles.sort((a, b) => a - b);
        // remove zero
        this.mappedOldToNewTiles.shift();
        // calculate new map image size
        const totalTiles = this.mappedOldToNewTiles.length;
        this.totalColumns = Math.ceil(Math.sqrt(totalTiles));
        this.newMapImageWidth = this.totalColumns * (this.tileWidth + spacing) + (this.tileWidth + spacing);
        this.totalRows = Math.ceil(totalTiles / this.totalColumns);
        this.newMapImageHeight = this.totalRows * this.tileHeight;
    }

    async createSingleTileImage(baseImage, tileX, tileY, spacing)
    {
        // create a single tile image:
        try {
            const image = sharp(baseImage);
            const metadata = await image.metadata();
            const tileWidth = this.tileWidth + spacing;
            const tileHeight = this.tileHeight + spacing;
            const tileData = {
                left: tileX,
                top: tileY,
                width: tileWidth,
                height: tileHeight
            };
            return image.extract(tileData);
        } catch (error) {
            Logger.error('Tile image could not be created.', error);
        }
    }

    async createThumbsFromLayersData()
    {
        let tilesRowCounter = 0;
        let tilesColCounter = 0;
        try {
            // create a new image to which we will copy all the tiles:
            this.newMapImage = sharp({
                create: {
                    width: this.newMapImageWidth,
                    height: this.newMapImageHeight,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            }).png();
            this.composites = [];
            for (const [newTileIndex, mappedTileIndex] of this.mappedOldToNewTiles.entries()) {
                if (tilesRowCounter > 0 && tilesRowCounter === this.totalColumns) {
                    tilesRowCounter = 0;
                    tilesColCounter++;
                } else {
                    tilesRowCounter++;
                }
                const tileSet = this.getTileSetByTileIndex(mappedTileIndex);
                const tilePosition = this.getTilePositionFromTilesetData(tileSet, mappedTileIndex);
                const newImagePosition = ((this.totalColumns + 1) * tilesColCounter) + tilesRowCounter + 1;
                const singleTileImage = await this.createSingleTileImage(
                    tileSet.tmp_image,
                    tilePosition.x,
                    tilePosition.y,
                    tileSet.spacing
                );
                // calculate the destination X and Y positions for the new image:
                const destX = tilesRowCounter * (this.tileWidth + tileSet.spacing);
                const destY = tilesColCounter * (this.tileHeight + tileSet.spacing);
                // composite the single tile image onto the new map image at the calculated position:
                this.composites.push({
                    input: await singleTileImage.png().toBuffer(),
                    left: destX,
                    top: destY
                });
                // update the new images positions map:
                this.newImagesPositions[mappedTileIndex] = newImagePosition;
            }
            this.newMapImage.composite(this.composites);
        } catch (error) {
            Logger.error('Error creating thumb for layers data.', error);
        }
    }

    getTilePositionFromTilesetData(tileSet, mappedTileIndex)
    {
        const totalColumns = Math.floor(tileSet.width / (this.tileWidth + tileSet.spacing));
        const totalRows = Math.floor(tileSet.height / (this.tileHeight + tileSet.spacing));
        let tilesCounter = 0;
        let result = false;
        for (let r = 0; r < totalRows; r++) {
            for (let c = 0; c < totalColumns; c++) {
                let mapIndex = tilesCounter + tileSet.first;
                if (mapIndex === mappedTileIndex) {
                    let posX = c * (this.tileWidth + tileSet.spacing);
                    let posY = r * (this.tileHeight + tileSet.spacing);
                    result = { x: posX, y: posY };
                    break;
                }
                tilesCounter++;
            }
            if (result) {
                break;
            }
        }
        return result;
    }

    getTileSetByTileIndex(mappedTileIndex)
    {
        for (const [tileSetName, tileSet] of Object.entries(this.tileSetData)) {
            if (mappedTileIndex >= tileSet.first && mappedTileIndex <= tileSet.last) {
                return tileSet;
            }
        }
        Logger.error('Mapped tile index not found: '+mappedTileIndex);
    }

    createNewJSON()
    {
        // update layer data to reference new tile positions:
        this.originalJSON.layers.forEach(layer => {
            if (Array.isArray(layer.data)) {
                for (let i = 0; i < layer.data.length; i++) {
                    if (layer.data[i] !== 0) {
                        layer.data[i] = this.newImagesPositions[layer.data[i]];
                    }
                }
            }
        });
        // update tileset information
        const animations = [];
        for (const tileset of this.tileSetData) {
            for (const animation of tileset.animations) {
                const animObj = {
                    animation: [],
                    id: this.newImagesPositions[tileset.first + animation.id] - 1
                };
                for (const frame of animation.animation) {
                    const frameObj = {
                        duration: frame.duration,
                        tileid: this.newImagesPositions[tileset.first + frame.tileid] - 1
                    };
                    animObj.animation.push(frameObj);
                }
                animations.push(animObj);
            }
        }
        // create a new tileset object
        const newTileSet = {
            columns: this.totalColumns,
            firstgid: 1,
            image: `${this.newName}.png`,
            imageheight: this.newMapImageHeight,
            imagewidth: this.newMapImageWidth,
            margin: 0,
            name: this.newName.toLowerCase(),
            spacing: 0,
            tilecount: this.totalRows * this.totalColumns,
            tileheight: this.tileHeight,
            tilewidth: this.tileWidth,
            transparentcolor: this.transparentColor,
            tiles: animations
        };
        // Replace the old tilesets with the new one
        this.originalJSON.tilesets = [newTileSet];
        // write the modified json to a file
        this.fileHandler.writeFile(this.mapFileName, this.mapToJSON(this.originalJSON));
    }

    mapToJSON(map)
    {
        let jsonString = JSON.stringify(map, null, 4);
        let dataPattern = /("data":\s*\[\n\s*)([\s\S]*?)(\n\s*\])/g;

        return jsonString.replace(dataPattern, (match, start, dataArray, end) => {
            let singleLineArray = dataArray.replace(/\s+/g, '');
            return `${start.trim()}${singleLineArray}${end.trim()}`;
        });
    }

    async resizeTileset()
    {
        const resizedImageName = `${this.newName}-x${this.factor}.png`;
        const imageOutputPath = path.join(this.generatedFolder, resizedImageName);
        const resizedJsonName = `${this.newName}-x${this.factor}.json`;
        const jsonOutputPath = path.join(this.generatedFolder, resizedJsonName);
        // resize the image:
        const image = this.newMapImage;
        const metadata = await image.metadata();
        const newWidth = metadata.width * this.factor;
        const newHeight = metadata.height * this.factor;
        await sharp(this.tileSheetFileName).resize({
            width: newWidth,
            height: newHeight,
            kernel: sharp.kernel.nearest,
            fit: sharp.fit.fill,
        }).toFile(imageOutputPath);
        // read and parse the original JSON:
        const json = JSON.parse(fs.readFileSync(this.mapFileName, 'utf8'));
        // modify the JSON for the resized tileset:
        json.tilewidth *= this.factor;
        json.tileheight *= this.factor;
        json.tilesets[0].image = resizedImageName;
        json.tilesets[0].imagewidth = newWidth;
        json.tilesets[0].imageheight = newHeight;
        json.tilesets[0].tilewidth *= this.factor;
        json.tilesets[0].tileheight *= this.factor;
        // save the modified JSON to a new file:
        this.fileHandler.writeFile(jsonOutputPath, this.mapToJSON(json));
    }
}

module.exports.TiledMapOptimizer = TiledMapOptimizer;
