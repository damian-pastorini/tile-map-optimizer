/**
 *
 * Reldens - Tile Map Optimizer - MapTilesetsExtruder
 *
 * Extrudes every tileset image of a map and applies the margin, spacing and size adjustments
 * to the map JSON (tilesets and map tile dimensions). Path resolution and configuration values
 * are provided by the caller.
 *
 */

const { TileExtruder } = require('./tile-extruder');
const { Logger, sc } = require('@reldens/utils');

class MapTilesetsExtruder
{

    constructor(props)
    {
        this.margin = Number(sc.get(props, 'margin', 0));
        this.spacing = Number(sc.get(props, 'spacing', 0));
        this.color = sc.get(props, 'color', 0xffffff00);
        this.extrusion = Number(sc.get(props, 'extrusion', 1));
        this.tilesetMargin = Number(sc.get(props, 'tilesetMargin', 1));
        this.tilesetSpacing = Number(sc.get(props, 'tilesetSpacing', 2));
        this.resolveInputPath = sc.get(props, 'resolveInputPath', null);
        this.resolveOutputPath = sc.get(props, 'resolveOutputPath', null);
    }

    async extrudeMapImages(mapJson, mapsImages)
    {
        if(!this.resolveInputPath || !this.resolveOutputPath){
            Logger.error('MapTilesetsExtruder: missing input or output path resolver.');
            return {errorCode: 'missingPathResolvers'};
        }
        for(let image of mapsImages){
            let imageResult = await this.extrudeMapImage(image, mapJson);
            if(imageResult.errorCode){
                return imageResult;
            }
        }
        if(this.margin){
            mapJson.tilewidth = mapJson.tilewidth + 2 * this.margin;
            mapJson.tileheight = mapJson.tileheight + 2 * this.margin;
        }
        return {result: true};
    }

    async extrudeMapImage(image, mapJson)
    {
        let imageObject = await this.extrudeImageObject(image, mapJson);
        if(!imageObject){
            return {errorCode: 'imageObjectExtrudeError'};
        }
        let saved = await this.saveImageObject(image, imageObject);
        if(!saved){
            return {errorCode: 'imageObjectSaveError'};
        }
        this.applyTilesetAdjustments(mapJson, image, imageObject);
        return {result: true};
    }

    async extrudeImageObject(image, mapJson)
    {
        try {
            return await (new TileExtruder()).extrude(
                mapJson.tilewidth,
                mapJson.tileheight,
                this.resolveInputPath(image),
                {margin: this.margin, spacing: this.spacing, color: this.color, extrusion: this.extrusion}
            );
        } catch (error) {
            Logger.critical('Image object could not be extruded.', image, error);
            return false;
        }
    }

    async saveImageObject(image, imageObject)
    {
        try {
            await imageObject.toFile(this.resolveOutputPath(image));
            return true;
        } catch (error) {
            Logger.critical('Image object could not be saved as file.', image, error);
            return false;
        }
    }

    applyTilesetAdjustments(mapJson, image, imageObject)
    {
        for(let tileset of mapJson.tilesets){
            if(tileset.image !== image){
                continue;
            }
            tileset.margin = this.tilesetMargin;
            tileset.spacing = this.tilesetSpacing;
            tileset.imagewidth = imageObject.width;
            tileset.imageheight = imageObject.height;
            if(this.margin){
                tileset.tilewidth = tileset.tilewidth + 2 * this.margin;
                tileset.tileheight = tileset.tileheight + 2 * this.margin;
            }
        }
    }

}

module.exports.MapTilesetsExtruder = MapTilesetsExtruder;
