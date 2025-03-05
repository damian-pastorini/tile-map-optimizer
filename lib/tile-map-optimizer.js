/**
 *
 * Reldens - Tile Map Optimizer - TileMapOptimizer
 *
 */

const sharp = require('sharp');
const { OptionsValidator } = require('./validator/options-validator');
const { FileHandler } = require('./files/file-handler');
const { ErrorManager, Logger, sc } = require('@reldens/utils');

class TileMapOptimizer
{

    constructor(props)
    {
        this.currentDate = sc.getDateForFileName();
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
        this.newJSON = this.originalJSON;
        // optional:
        this.originalMapFileName = sc.get(options, 'originalMapFileName', '').toLowerCase();
        this.appendOriginalName = this.originalMapFileName ? '-'+this.originalMapFileName : '';
        this.newName = sc.get(
            options,
            'newName',
            `optimized-map${this.appendOriginalName}-${this.currentDate}`
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
        this.tileSetData = {};
        this.newImagesPositions = {};
        this.tileWidth = 0;
        this.tileHeight = 0;
        this.totalRows = 0;
        this.totalColumns = 0;
        this.newMapImageWidth = 0;
        this.newMapImageHeight = 0;
        this.newMapImage = null; // the image resource
        this.newJSONResized = null;
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
        this.tileWidth = this.newJSON.tilewidth;
        this.tileHeight = this.newJSON.tileheight;
        this.parseJSON();
        try {
            this.newMapImage = await sharp({
                create: {
                    width: this.newMapImageWidth,
                    height: this.newMapImageHeight,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            });
            await this.createThumbsFromLayersData();
            await this.createNewJSON();
            await this.newMapImage.png().toFile(this.tileSheetFileName);
            if(1 < this.factor){
                await this.resizeTileset();
            }
            this.output = {
                newImage: this.tileSheetFileName,
                newMap: this.mapFileName,
                newJSON: this.newJSON,
                newJSONResized: this.newJSONResized
            };
            Logger.info('Map optimized successfully: "'+this.tileSheetFileName+'".');
            return this.output;
        } catch (error) {
            Logger.error('Error creating new map image.', error);
            return null;
        }
    }

    parseJSON()
    {
        for(let layer of this.originalJSON.layers){
            if(layer.data){
                // clean up for duplicates
                let clean = [...new Set(layer.data)];
                // map new positions
                this.mappedOldToNewTiles = [...new Set([...this.mappedOldToNewTiles, ...clean])];
            }
        }
        let spacing = 0;
        // get tilesets data
        for(let tileset of this.originalJSON.tilesets){
            let wangsetsData = [];
            if(tileset.wangsets){
                wangsetsData = [...wangsetsData, ...tileset.wangsets];
            }
            let tilesData = [];
            let animationTiles = [];
            if(tileset.tiles){
                tilesData = [...tilesData, ...tileset.tiles];
                for(let tileData of tileset.tiles){
                    if(!tileData.animation){
                        continue;
                    }
                    animationTiles.push(tileset.firstgid + tileData.id);
                    for(let frame of tileData.animation){
                        animationTiles.push(tileset.firstgid + frame.tileid);
                    }
                }
            }
            let cleanAnimationTiles = [...new Set(animationTiles)];
            this.mappedOldToNewTiles = [...new Set([...this.mappedOldToNewTiles, ...cleanAnimationTiles])];
            let tilesetImagePathArray = tileset.image.split('/');
            let tilesetImageName = tilesetImagePathArray[tilesetImagePathArray.length - 1];
            this.tileSetData[tileset.name] = {
                first: tileset.firstgid,
                last: tileset.firstgid + tileset.tilecount,
                tiles_count: tileset.tilecount,
                image: tilesetImageName,
                tmp_image: tilesetImageName,
                width: tileset.imagewidth,
                height: tileset.imageheight,
                margin: tileset.margin,
                spacing: tileset.spacing,
                tilesData,
                wangsetsData
            };
            if(spacing < tileset.spacing){
                spacing = tileset.spacing;
            }
        }
        // sort
        this.mappedOldToNewTiles.sort((a, b) => a - b);
        // remove zero
        this.mappedOldToNewTiles.shift();
        // calculate new map image size
        let totalTiles = this.mappedOldToNewTiles.length;
        this.totalColumns = Math.ceil(Math.sqrt(totalTiles));
        this.newMapImageWidth = this.totalColumns * (this.tileWidth + spacing) + (this.tileWidth + spacing);
        this.totalRows = Math.ceil(totalTiles / this.totalColumns);
        this.newMapImageHeight = this.totalRows * this.tileHeight;
    }

    async createSingleTileImage(baseImage, tileX, tileY, spacing)
    {
        // create a single tile image:
        try {
            let image = await sharp(baseImage);
            let tileWidth = this.tileWidth + spacing;
            let tileHeight = this.tileHeight + spacing;
            let tileData = {
                left: tileX,
                top: tileY,
                width: tileWidth,
                height: tileHeight
            };
            return image.extract(tileData);
        } catch (error) {
            Logger.error('Tile image could not be created.', error);
            return false;
        }
    }

    async createThumbsFromLayersData()
    {
        let tilesRowCounter = 0;
        let tilesColCounter = 0;
        try {
            // create a new image to which we will copy all the tiles:
            this.newMapImage = await sharp({
                create: {
                    width: this.newMapImageWidth,
                    height: this.newMapImageHeight,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            }).png();
            this.composites = [];
            for(let [newTileIndex, mappedTileIndex] of this.mappedOldToNewTiles.entries()){
                // @TODO - BETA - Refactor to remove else.
                if(0 < tilesRowCounter && this.totalColumns === tilesRowCounter){
                    tilesRowCounter = 0;
                    tilesColCounter++;
                } else {
                    tilesRowCounter++;
                }
                let tileSet = this.getTileSetByTileIndex(mappedTileIndex);
                let tilePosition = this.getTilePositionFromTilesetData(tileSet, mappedTileIndex);
                if(!tilePosition){
                    Logger.error('Tile image creation error.', tilePosition, tileSet);
                    continue;
                }
                let newImagePosition = ((this.totalColumns + 1) * tilesColCounter) + tilesRowCounter + 1;
                let foundImageFile = this.findImageFile(tileSet);
                let singleTileImage = await this.createSingleTileImage(
                    foundImageFile,
                    tilePosition.x,
                    tilePosition.y,
                    tileSet.spacing
                );
                if(!singleTileImage){
                    Logger.error('Tile image creation error.', tilePosition, tileSet);
                    continue;
                }
                // calculate the destination X and Y positions for the new image:
                let destX = tilesRowCounter * (this.tileWidth + tileSet.spacing);
                let destY = tilesColCounter * (this.tileHeight + tileSet.spacing);
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
            // re-throw error for the next catch:
            ErrorManager.error('Error creating thumb for layers data. '+error);
        }
    }

    findImageFile(tileSet)
    {
        let fullPathFile = this.fileHandler.joinPaths(this.rootFolder, tileSet.tmp_image);
        if(this.fileHandler.exists(fullPathFile)){
            return fullPathFile;
        }
        return tileSet.tmp_image;
    }

    getTilePositionFromTilesetData(tileSet, mappedTileIndex)
    {
        let totalColumns = Math.ceil(tileSet.width / (this.tileWidth + tileSet.spacing));
        let totalRows = Math.ceil(tileSet.height / (this.tileHeight + tileSet.spacing));
        let tilesCounter = 0;
        // @TODO - BETA - Refactor to include logs about the column and row if result is false.
        let result = false;
        for(let r = 0; r < totalRows; r++){
            for(let c = 0; c < totalColumns; c++){
                let mapIndex = tilesCounter + tileSet.first;
                if(mapIndex === mappedTileIndex){
                    let posX = c * (this.tileWidth + tileSet.spacing);
                    let posY = r * (this.tileHeight + tileSet.spacing);
                    result = { x: posX, y: posY };
                    break;
                }
                tilesCounter++;
            }
            if(result){
                break;
            }
        }
        return result;
    }

    getTileSetByTileIndex(mappedTileIndex)
    {
        for(let [tileSetName, tileSet] of Object.entries(this.tileSetData)){
            if(mappedTileIndex >= tileSet.first && mappedTileIndex <= tileSet.last){
                return tileSet;
            }
        }
        Logger.error('Mapped tile index not found: '+mappedTileIndex);
    }

    async createNewJSON()
    {
        // update layer data to reference new tile positions:
        for(let layer of this.newJSON.layers){
            if(sc.isArray(layer.data)){
                for(let i = 0; i < layer.data.length; i++){
                    if(0 !== layer.data[i]){
                        layer.data[i] = this.newImagesPositions[layer.data[i]];
                    }
                }
            }
        }
        // update tileset information:
        let tilesData = [];
        let wangsetsData = [];
        for(let i of Object.keys(this.tileSetData)){
            let tileset = this.tileSetData[i];
            // map "tiles" with new data:
            for(let tile of tileset.tilesData){
                let newImagesPosition = this.fetchNewImagePositionForTile(tileset, tile.id);
                if(false === newImagesPosition){
                    continue;
                }
                let newTileData = {
                    id: newImagesPosition - 1
                };
                if(tile.animation){
                    let animation = [];
                    for(let frame of tile.animation){
                        let frameObj = {
                            duration: frame.duration,
                            tileid: this.newImagesPositions[tileset.first + frame.tileid] - 1
                        };
                        animation.push(frameObj);
                    }
                    newTileData.animation = animation;
                }
                if(tile.properties){
                    newTileData.properties = tile.properties;
                }
                tilesData.push(newTileData);
            }
            // map "wangset" with new data:
            for(let wangset of tileset.wangsetsData){
                let newImagesPosition = this.fetchNewImagePositionForTile(tileset, wangset.tile);
                if(false === newImagesPosition){
                    console.log(newImagesPosition);
                    continue;
                }
                let newWangsetTiles = [];
                console.log(wangset);
                for(let wangsetTile of wangset.wangtiles){
                    newWangsetTiles.push({
                        wangid: wangsetTile.wangid,
                        tileid: this.newImagesPositions[tileset.first + wangsetTile.tileid] - 1
                    });
                }
                wangsetsData.push({
                    colors: wangset.colors,
                    name: wangset.name,
                    type: wangset.type,
                    tile: newImagesPosition - 1,
                    wangtiles: newWangsetTiles
                });
            }
        }
        // create a new tileset object
        let newTileSet = {
            columns: this.newMapImageWidth / this.tileWidth,
            firstgid: 1,
            image: this.newName + '.png',
            imageheight: this.newMapImageHeight,
            imagewidth: this.newMapImageWidth,
            margin: 0,
            name: this.newName.toLowerCase(),
            spacing: 0,
            tilecount: this.totalRows * this.totalColumns,
            tileheight: this.tileHeight,
            tilewidth: this.tileWidth,
            transparentcolor: this.transparentColor,
            tiles: tilesData,
            wangsets: wangsetsData
        };
        // Replace the old tilesets with the new one
        this.newJSON.tilesets = [newTileSet];
        // write the modified json to a file
        this.fileHandler.createFolder(this.generatedFolder);
        await this.fileHandler.writeFile(this.mapFileName, this.mapToJSON(this.newJSON));
    }

    fetchNewImagePositionForTile(tileset, tileId)
    {
        let newImagePositionIndex = Number(tileset.first) + Number(tileId);
        let newImagesPosition = this.newImagesPositions[newImagePositionIndex];
        if (!newImagesPosition && 0 !== newImagesPosition) {
            Logger.critical(
                'New image position not found: ' + newImagePositionIndex + '.'
                + ' Tileset image: "' + tileset.image + '".'
                + ' Tile ID: "' + tileId + '".'
                + ' This usually means the tile itself is not present in the map.'
                + ' Edit the tileset on the map editor, search that tile ID and check the properties assigned.'
            );
            return false;
        }
        return newImagesPosition;
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
        let resizedImageName = `${this.newName}-x${this.factor}.png`;
        let imageOutputPath = this.fileHandler.joinPaths(this.generatedFolder, resizedImageName);
        let resizedJsonName = `${this.newName}-x${this.factor}.json`;
        let jsonOutputPath = this.fileHandler.joinPaths(this.generatedFolder, resizedJsonName);
        // resize the image:
        let image = this.newMapImage;
        let metadata = await image.metadata();
        let newWidth = metadata.width * this.factor;
        let newHeight = metadata.height * this.factor;
        await sharp(this.tileSheetFileName).resize({
            width: newWidth,
            height: newHeight,
            kernel: sharp.kernel.nearest,
            fit: sharp.fit.fill,
        }).toFile(imageOutputPath);
        // read and parse the original JSON:
        let json = JSON.parse(JSON.stringify(this.newJSON));
        // @TODO - BETA - Resize do not support "objects" layers, temporally removed here.
        let tileLayers = [];
        for(let layer of json.layers){
            if('tilelayer' !== layer.type){
                continue;
            }
            tileLayers.push(layer);
        }
        json.layers = tileLayers;
        // modify the JSON for the resized tileset:
        json.tilewidth *= this.factor;
        json.tileheight *= this.factor;
        json.tilesets[0].image = resizedImageName;
        json.tilesets[0].imagewidth = newWidth;
        json.tilesets[0].imageheight = newHeight;
        json.tilesets[0].tilewidth *= this.factor;
        json.tilesets[0].tileheight *= this.factor;
        this.newJSONResized = json;
        // save the modified JSON to a new file:
        this.fileHandler.createFolder(this.generatedFolder);
        await this.fileHandler.writeFile(jsonOutputPath, this.mapToJSON(json));
    }
}

module.exports.TileMapOptimizer = TileMapOptimizer;
