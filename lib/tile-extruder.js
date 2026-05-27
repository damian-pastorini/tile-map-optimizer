/**
 *
 * Reldens - Tile Map Optimizer - TileExtruder
 *
 * Ported from https://github.com/sporadic-labs/tile-extruder
 * Re-implemented using sharp with raw pixel manipulation for performance.
 *
 */

const sharp = require('sharp');
const { Logger } = require('@reldens/utils');

class TileExtruder
{

    async extrude(tw, th, inputPath, {margin = 0, spacing = 0, color = 0xffffff00, extrusion = 1} = {})
    {
        let {data: srcRaw, info: srcInfo} = await sharp(inputPath).ensureAlpha().raw().toBuffer({resolveWithObject: true});
        let srcWidth = srcInfo.width;
        let srcHeight = srcInfo.height;
        let cols = (srcWidth - 2 * margin + spacing) / (tw + spacing);
        let rows = (srcHeight - 2 * margin + spacing) / (th + spacing);
        if(!Number.isInteger(cols) || !Number.isInteger(rows)){
            Logger.critical('TileExtruder: non-integer number of rows or cols found.', {srcWidth, srcHeight, tw, th, margin, spacing, cols, rows});
            return false;
        }
        let newWidth = 2 * margin + (cols - 1) * spacing + cols * (tw + 2 * extrusion);
        let newHeight = 2 * margin + (rows - 1) * spacing + rows * (th + 2 * extrusion);
        let background = this.parseColorToBackground(color);
        let outBuf = Buffer.alloc(newWidth * newHeight * 4);
        this.fillBackground(outBuf, newWidth, newHeight, background);
        for(let row = 0; row < rows; row++){
            this.processTileRow(srcRaw, srcWidth, outBuf, newWidth, tw, th, margin, spacing, extrusion, row, cols);
        }
        return {
            width: newWidth,
            height: newHeight,
            toFile: (outputPath) => this.saveExtrudedImage(newWidth, newHeight, outBuf, outputPath)
        };
    }

    async saveExtrudedImage(newWidth, newHeight, rawBuf, outputPath)
    {
        await sharp(rawBuf, {raw: {width: newWidth, height: newHeight, channels: 4}}).png().toFile(outputPath);
    }

    processTileRow(srcRaw, srcWidth, outBuf, outWidth, tw, th, margin, spacing, extrusion, row, cols)
    {
        for(let col = 0; col < cols; col++){
            this.copyTileWithExtrusion(srcRaw, srcWidth, outBuf, outWidth, tw, th, margin, spacing, extrusion, row, col);
        }
    }

    copyTileWithExtrusion(srcRaw, srcWidth, outBuf, outWidth, tw, th, margin, spacing, extrusion, row, col)
    {
        let srcX = margin + col * (tw + spacing);
        let srcY = margin + row * (th + spacing);
        let destX = margin + col * (tw + spacing + 2 * extrusion);
        let destY = margin + row * (th + spacing + 2 * extrusion);
        this.copyRect(srcRaw, srcWidth, srcX, srcY, tw, th, outBuf, outWidth, destX + extrusion, destY + extrusion);
        this.extrudeEdge(srcRaw, srcWidth, srcX, srcY, tw, 1, outBuf, outWidth, destX + extrusion, destY, extrusion, false);
        this.extrudeEdge(srcRaw, srcWidth, srcX, srcY + th - 1, tw, 1, outBuf, outWidth, destX + extrusion, destY + extrusion + th, extrusion, false);
        this.extrudeEdge(srcRaw, srcWidth, srcX, srcY, 1, th, outBuf, outWidth, destX, destY + extrusion, extrusion, true);
        this.extrudeEdge(srcRaw, srcWidth, srcX + tw - 1, srcY, 1, th, outBuf, outWidth, destX + extrusion + tw, destY + extrusion, extrusion, true);
        this.fillCorner(srcRaw, srcWidth, srcX, srcY, outBuf, outWidth, destX, destY, extrusion);
        this.fillCorner(srcRaw, srcWidth, srcX + tw - 1, srcY, outBuf, outWidth, destX + extrusion + tw, destY, extrusion);
        this.fillCorner(srcRaw, srcWidth, srcX, srcY + th - 1, outBuf, outWidth, destX, destY + extrusion + th, extrusion);
        this.fillCorner(srcRaw, srcWidth, srcX + tw - 1, srcY + th - 1, outBuf, outWidth, destX + extrusion + tw, destY + extrusion + th, extrusion);
    }

    extrudeEdge(srcBuf, srcWidth, srcX, srcY, w, h, dstBuf, dstWidth, dstX, dstY, extrusion, horizontal)
    {
        for(let step = 0; step < extrusion; step++){
            let stepX = horizontal ? dstX + step : dstX;
            let stepY = horizontal ? dstY : dstY + step;
            this.copyRect(srcBuf, srcWidth, srcX, srcY, w, h, dstBuf, dstWidth, stepX, stepY);
        }
    }

    copyRect(srcBuf, srcWidth, srcX, srcY, w, h, dstBuf, dstWidth, dstX, dstY)
    {
        for(let y = 0; y < h; y++){
            this.copyRectRow(srcBuf, srcWidth, srcX, srcY + y, w, dstBuf, dstWidth, dstX, dstY + y);
        }
    }

    copyRectRow(srcBuf, srcWidth, srcX, srcY, w, dstBuf, dstWidth, dstX, dstY)
    {
        let srcOffset = (srcY * srcWidth + srcX) * 4;
        let dstOffset = (dstY * dstWidth + dstX) * 4;
        srcBuf.copy(dstBuf, dstOffset, srcOffset, srcOffset + w * 4);
    }

    fillCorner(srcBuf, srcWidth, srcX, srcY, dstBuf, dstWidth, dstX, dstY, size)
    {
        let srcOffset = (srcY * srcWidth + srcX) * 4;
        let r = srcBuf[srcOffset];
        let g = srcBuf[srcOffset + 1];
        let b = srcBuf[srcOffset + 2];
        let a = srcBuf[srcOffset + 3];
        this.fillRect(dstBuf, dstWidth, dstX, dstY, size, size, r, g, b, a);
    }

    fillBackground(targetBuf, width, height, background)
    {
        let alpha = Math.round(background.alpha * 255);
        this.fillRect(targetBuf, width, 0, 0, width, height, background.r, background.g, background.b, alpha);
    }

    fillRect(targetBuf, targetWidth, targetX, targetY, w, h, r, g, b, a)
    {
        for(let y = 0; y < h; y++){
            this.fillRectRow(targetBuf, targetWidth, targetX, targetY + y, w, r, g, b, a);
        }
    }

    fillRectRow(targetBuf, targetWidth, targetX, targetY, w, r, g, b, a)
    {
        for(let x = 0; x < w; x++){
            this.writePixel(targetBuf, (targetY * targetWidth + targetX + x) * 4, r, g, b, a);
        }
    }

    writePixel(targetBuf, offset, r, g, b, a)
    {
        targetBuf[offset] = r;
        targetBuf[offset + 1] = g;
        targetBuf[offset + 2] = b;
        targetBuf[offset + 3] = a;
    }

    parseColorToBackground(color)
    {
        return {
            r: (color >>> 24) & 0xff,
            g: (color >>> 16) & 0xff,
            b: (color >>> 8) & 0xff,
            alpha: (color & 0xff) / 255
        };
    }

}

module.exports.TileExtruder = TileExtruder;
