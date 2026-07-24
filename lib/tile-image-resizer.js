const sharp = require('sharp');
const { Logger } = require('@reldens/utils');

class TileImageResizer
{
    async resize(inputPath, outputPath, factor)
    {
        try {
            let meta = await sharp(inputPath).metadata();
            let newWidth = Math.round(meta.width * factor);
            let newHeight = Math.round(meta.height * factor);
            await sharp(inputPath)
                .resize({
                    width: newWidth,
                    height: newHeight,
                    kernel: sharp.kernel.nearest,
                    fit: sharp.fit.fill
                })
                .toFile(outputPath);
            return { width: newWidth, height: newHeight };
        } catch(error) {
            Logger.error('TileImageResizer: failed to resize image: '+error.message);
            return false;
        }
    }
}

module.exports.TileImageResizer = TileImageResizer;
