/**
 *
 * Reldens - Tile Map Optimizer - TileExtruder
 *
 * Ported from https://github.com/sporadic-labs/tile-extruder
 * Re-implemented using sharp instead of Jimp.
 *
 */

const sharp = require('sharp');

class TileExtruder
{

    async extrude(tw, th, inputPath, {margin = 0, spacing = 0, color = 0xffffff00, extrusion = 1} = {})
    {
        let meta = await sharp(inputPath).metadata();
        let srcWidth = meta.width;
        let srcHeight = meta.height;
        let cols = (srcWidth - 2 * margin + spacing) / (tw + spacing);
        let rows = (srcHeight - 2 * margin + spacing) / (th + spacing);
        if(!Number.isInteger(cols) || !Number.isInteger(rows)){
            throw new Error('Non-integer number of rows or cols found.');
        }
        let newWidth = 2 * margin + (cols - 1) * spacing + cols * (tw + 2 * extrusion);
        let newHeight = 2 * margin + (rows - 1) * spacing + rows * (th + 2 * extrusion);
        let srcBuffer = await sharp(inputPath).ensureAlpha().png().toBuffer();
        let bg = this.parseColorToBackground(color);
        let composites = [];
        for(let row = 0; row < rows; row++){
            for(let col = 0; col < cols; col++){
                await this.buildTileComposites(composites, srcBuffer, tw, th, margin, spacing, extrusion, row, col);
            }
        }
        return {
            width: newWidth,
            height: newHeight,
            toFile: (outputPath) => this.saveExtrudedImage(newWidth, newHeight, bg, composites, outputPath)
        };
    }

    async saveExtrudedImage(newWidth, newHeight, bg, composites, outputPath)
    {
        await sharp({
            create: {
                width: newWidth,
                height: newHeight,
                channels: 4,
                background: bg
            }
        }).composite(composites).png().toFile(outputPath);
    }

    async buildTileComposites(composites, srcBuffer, tw, th, margin, spacing, extrusion, row, col)
    {
        let srcX = margin + col * (tw + spacing);
        let srcY = margin + row * (th + spacing);
        let destX = margin + col * (tw + spacing + 2 * extrusion);
        let destY = margin + row * (th + spacing + 2 * extrusion);
        let tileBuffer = await sharp(srcBuffer)
            .extract({left: srcX, top: srcY, width: tw, height: th})
            .png()
            .toBuffer();
        composites.push({input: tileBuffer, left: destX + extrusion, top: destY + extrusion});
        let topBuffer = await sharp(srcBuffer)
            .extract({left: srcX, top: srcY, width: tw, height: 1})
            .resize({width: tw, height: extrusion, kernel: sharp.kernel.nearest, fit: sharp.fit.fill})
            .png()
            .toBuffer();
        composites.push({input: topBuffer, left: destX + extrusion, top: destY});
        let bottomBuffer = await sharp(srcBuffer)
            .extract({left: srcX, top: srcY + th - 1, width: tw, height: 1})
            .resize({width: tw, height: extrusion, kernel: sharp.kernel.nearest, fit: sharp.fit.fill})
            .png()
            .toBuffer();
        composites.push({input: bottomBuffer, left: destX + extrusion, top: destY + extrusion + th});
        let leftBuffer = await sharp(srcBuffer)
            .extract({left: srcX, top: srcY, width: 1, height: th})
            .resize({width: extrusion, height: th, kernel: sharp.kernel.nearest, fit: sharp.fit.fill})
            .png()
            .toBuffer();
        composites.push({input: leftBuffer, left: destX, top: destY + extrusion});
        let rightBuffer = await sharp(srcBuffer)
            .extract({left: srcX + tw - 1, top: srcY, width: 1, height: th})
            .resize({width: extrusion, height: th, kernel: sharp.kernel.nearest, fit: sharp.fit.fill})
            .png()
            .toBuffer();
        composites.push({input: rightBuffer, left: destX + extrusion + tw, top: destY + extrusion});
        let tlBuffer = await sharp(srcBuffer)
            .extract({left: srcX, top: srcY, width: 1, height: 1})
            .resize({width: extrusion, height: extrusion, kernel: sharp.kernel.nearest, fit: sharp.fit.fill})
            .png()
            .toBuffer();
        composites.push({input: tlBuffer, left: destX, top: destY});
        let trBuffer = await sharp(srcBuffer)
            .extract({left: srcX + tw - 1, top: srcY, width: 1, height: 1})
            .resize({width: extrusion, height: extrusion, kernel: sharp.kernel.nearest, fit: sharp.fit.fill})
            .png()
            .toBuffer();
        composites.push({input: trBuffer, left: destX + extrusion + tw, top: destY});
        let blBuffer = await sharp(srcBuffer)
            .extract({left: srcX, top: srcY + th - 1, width: 1, height: 1})
            .resize({width: extrusion, height: extrusion, kernel: sharp.kernel.nearest, fit: sharp.fit.fill})
            .png()
            .toBuffer();
        composites.push({input: blBuffer, left: destX, top: destY + extrusion + th});
        let brBuffer = await sharp(srcBuffer)
            .extract({left: srcX + tw - 1, top: srcY + th - 1, width: 1, height: 1})
            .resize({width: extrusion, height: extrusion, kernel: sharp.kernel.nearest, fit: sharp.fit.fill})
            .png()
            .toBuffer();
        composites.push({input: brBuffer, left: destX + extrusion + tw, top: destY + extrusion + th});
    }

    parseColorToBackground(color)
    {
        let r = (color >>> 24) & 0xff;
        let g = (color >>> 16) & 0xff;
        let b = (color >>> 8) & 0xff;
        let a = color & 0xff;
        return {r, g, b, alpha: a / 255};
    }

}

module.exports.TileExtruder = TileExtruder;
