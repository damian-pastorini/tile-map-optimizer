const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
const { sc } = require('@reldens/utils');

class TiledMapProcessor
{

    version = 1

    constructor()
    {
        this.newName = '';
        this.mappedOldToNewTiles = [];
        this.tileSetData = [];
        this.uploadedImages = [];
        this.newImagesPositions = [];
        this.baseDir = '';
        this.createDir = '';
        this.tileWidth = 0;
        this.tileHeight = 0;
    }

    setOptions(options)
    {
        this.newName = sc.get(options, 'newName', '');
        this.mappedOldToNewTiles = sc.get(options, 'mappedOldToNewTiles', []);
        this.tileSetData = sc.get(options, 'tileSetData', []);
        this.uploadedImages = sc.get(options, 'uploadedImages', []);
        this.newImagesPositions = sc.get(options, 'newImagesPositions', []);
        this.baseDir = sc.get(options, 'baseDir', '');
        this.createDir = sc.get(options, 'createDir', '');
        this.tileWidth = sc.get(options, 'tileWidth', 0);
        this.tileHeight = sc.get(options, 'tileHeight', 0);
    }

    parseJSON(json)
    {
        json.layers.forEach(layer => {
            if (!layer.data) {
                throw new Error('ERROR CODE - 2 - Invalid JSON.');
            }
            // clean up for duplicates
            const clean = [...new Set(layer.data)];
            // map new positions
            this.mappedOldToNewTiles = [...new Set([...this.mappedOldToNewTiles, ...clean])];
        });

        let spacing = 0;
        // get tilesets data
        json.tilesets.forEach(tileset => {
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
                tmp_image: this.getTempImageByName(tilesetImageName),
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

    getTempImageByName(tilesetImageName)
    {
        const uploadedImage = this.uploadedImages.find(img => img.name === tilesetImageName);
        if (!uploadedImage) {
            throw new Error(`ERROR - The specified image in the tileset was not found: ${tilesetImageName}`);
        }
        return uploadedImage.tmp_name;
    }

    async createSingleTileImage(baseImage, tileX, tileY, spacing)
    {
        // Create a single tile image using sharp
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
            throw new Error('ERROR - Tile image could not be created.');
        }
    }

    async createThumbsFromLayersData() {
        let tilesRowCounter = 0;
        let tilesColCounter = 0;

        // Create a new image to which we will copy all the tiles
        const newMapImage = sharp({
            create: {
                width: this.newMapImageWidth,
                height: this.newMapImageHeight,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            }
        });

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

            // Calculate the destination X and Y positions for the new image
            const destX = tilesRowCounter * (this.tileWidth + tileSet.spacing);
            const destY = tilesColCounter * (this.tileHeight + tileSet.spacing);

            // Composite the single tile image onto the new map image at the calculated position
            newMapImage.composite([{
                input: await singleTileImage.toBuffer(),
                left: destX,
                top: destY
            }]);

            // Update the new images positions map
            this.newImagesPositions[mappedTileIndex] = newImagePosition;
        }

        // Save the composited image to disk
        const outputPath = path.join(this.createDir, `${this.newName}.png`);
        await newMapImage.toFile(outputPath);

        // Update the output message with links to the new image and JSON
        this.output += '<div class="col-12 mb-3">' +
            '<hr class="mb-6"/>' +
            '<h2>Download your optimized JSON and image map file!</h2>' +
            '</div>' +
            '<div class="col-12 mb-3">' +
            `<a href="${this.createUrl}${this.newName}.json">New JSON Map File</a>` +
            '</div>' +
            '<div class="col-12 mb-3">' +
            `<a href="${this.createUrl}${this.newName}.png">` +
            `<img src="${this.createUrl}${this.newName}.png"/>` +
            '</a>' +
            '</div>';
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

    getTileSetByTileIndex(mappedTileIndex) {
        for (const [tileSetName, tileSet] of Object.entries(this.tileSetData)) {
            if (mappedTileIndex >= tileSet.first && mappedTileIndex <= tileSet.last) {
                return tileSet;
            }
        }
        throw new Error(`ERROR - Mapped tile index not found: ${mappedTileIndex}`);
    }

    createNewJSON(json)
    {
        // Modify the json object directly
        json.layers.forEach(layer => {
            layer.data = layer.data.map(data => data !== 0 ? this.newImagesPositions[data] : data);
        });
        // Handle animations and the rest of the json manipulation here

        // Write the modified json to a file
        const newJsonPath = path.join(this.createDir, `${this.newName}.json`);
        fs.writeFileSync(newJsonPath, JSON.stringify(json, null, 2));
        fs.chmodSync(newJsonPath, 0o775);
    }

    async resizeTileset(factors = '2') {
        const multipliers = factors.split(',').map(Number);
        const originalTilesetImage = path.join(this.createDir, `${this.newName}.png`);
        const originalTilesetJson = path.join(this.createDir, `${this.newName}.json`);

        for (const multiplier of multipliers) {
            const resizedImageName = `${this.newName}-x${multiplier}.png`;
            const resizedJsonName = `${this.newName}-x${multiplier}.json`;
            const outputPath = path.join(this.createDir, resizedImageName);

            // Resize the image
            const image = sharp(originalTilesetImage);
            const metadata = await image.metadata();
            const newWidth = metadata.width * multiplier;
            const newHeight = metadata.height * multiplier;

            await image
                .resize(newWidth, newHeight)
                .toFile(outputPath);

            // Read and parse the original JSON
            const json = JSON.parse(fs.readFileSync(originalTilesetJson, 'utf8'));

            // Modify the JSON for the resized tileset
            json.tilewidth *= multiplier;
            json.tileheight *= multiplier;
            json.tilesets[0].image = resizedImageName;
            json.tilesets[0].imagewidth = newWidth;
            json.tilesets[0].imageheight = newHeight;

            // Save the modified JSON to a new file
            const newJsonPath = path.join(this.createDir, resizedJsonName);
            fs.writeFileSync(newJsonPath, JSON.stringify(json, null, 2));

            // Update your output property or handle the result as needed
            this.output += `<div class="col-12 mb-3">
                        <hr class="mb-6"/>
                        <a href="${this.createUrl}${resizedJsonName}">Download your JSON file! Resized x${multiplier}</a>
                      </div>
                      <a class="col-12 mb-3">
                        <a href="${this.createUrl}${resizedImageName}" target="_blank">
                          <img src="${this.createUrl}${resizedImageName}"/>
                        </a>
                      </div>`;
        }
    }
}

module.exports = TiledMapProcessor;
