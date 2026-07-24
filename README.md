[![Reldens - GitHub - Release](https://www.dwdeveloper.com/media/reldens/reldens-mmorpg-platform.png)](https://github.com/damian-pastorini/reldens)

# Reldens - Tile Map Optimizer

A powerful tool to optimize Tiled JSON maps by removing unused tiles, merging multiple tilesets into a single optimized image, and significantly reducing file sizes.

Need some specific feature?

[Request a feature here: https://www.reldens.com/features-request](https://www.reldens.com/features-request)

---

## Features

- **Tile Map Optimization**: Analyzes Tiled JSON maps and identifies used tiles
- **Unused Tile Removal**: Removes unused tiles from tilesets to reduce file size
- **Tileset Merging**: Combines multiple source tilesets into a single optimized image
- **Image Compression**: Uses Sharp library for high-performance image processing
- **Tile Remapping**: Automatically updates all tile indices in map layers
- **Animation Preservation**: Maintains tile animations, properties, and wangsets
- **Optional Scaling**: Resize output by any factor with nearest-neighbor interpolation
- **Significant Size Reduction**: Typically achieves 50-90% file size reduction

## Documentation

[https://www.reldens.com/documentation/tile-map-optimizer/](https://www.reldens.com/documentation/tile-map-optimizer/)

## Installation

```bash
npm install @reldens/tile-map-optimizer
```

## Quick Start

Create a file to configure the optimizer with the map to be optimized:

```javascript
const { TileMapOptimizer } = require('@reldens/tile-map-optimizer');
const originalJSON = require('./reldens-town.json');

const options = {
    originalJSON,
    originalMapFileName: 'reldens-town',
    factor: 2,
    transparentColor: '#000000',
    rootFolder: __dirname
};

const tileMapOptimizer = new TileMapOptimizer(options);

tileMapOptimizer.generate().catch((error) => {
    console.log(error);
}).then(() => {
    console.log('Map saved! Check generated folder.');
});
```

Run it:
```bash
$ node ./optimize-example.js
```

Look for your optimized maps in the "generated" folder.

## Configuration Options

### Required Options

- **originalJSON**: The Tiled JSON map object to optimize

### Optional Options

- **originalMapFileName**: Name of the original map file (used in output naming)
- **newName**: Custom name for optimized output files (default: auto-generated with timestamp)
- **factor**: Resize factor for output scaling (default: 1, no resize)
- **transparentColor**: Transparent color for tileset (default: '#000000')
- **rootFolder**: Root folder path for finding source tileset images (default: `__dirname`)
- **generatedFolder**: Output folder for optimized files (default: `rootFolder/generated`)
- **mapFileName**: Custom path for output map JSON (default: auto-generated)
- **tileSheetFileName**: Custom path for output tileset image (default: auto-generated)

## How It Works

1. **Parse Map**: Analyzes all layers to identify which tiles are actually used
2. **Extract Tiles**: Extracts only the used tiles from source tilesets
3. **Create Tileset**: Builds a new compact tileset image with optimal layout
4. **Remap Indices**: Updates all tile references in the map JSON
5. **Preserve Features**: Maintains animations, properties, and wangset data
6. **Generate Output**: Saves optimized map JSON and tileset PNG
7. **Optional Resize**: Scales output by factor if specified (e.g., 2x, 3x)

## Output Files

The optimizer generates:

- **Optimized Map JSON**: Updated Tiled map with new tile indices
- **Optimized Tileset PNG**: Compact image containing only used tiles
- **Resized Versions** (if factor > 1): Scaled map and tileset for different resolutions

All files are timestamped to prevent accidental overwriting.

## Use Cases

- Optimize maps created with Tiled editor before deployment
- Reduce asset file sizes for web-based games
- Remove unused tiles from large tileset collections
- Merge multiple tilesets into a single optimized image
- Generate multiple scaled versions from a single source
- Prepare maps for the Reldens platform

## Dependencies

- **sharp**: High-performance image processing
- **@reldens/utils**: Logging, shortcuts, error handling
- **@reldens/server-utils**: File operations

## Related Packages

- **@reldens/tile-map-generator**: Generates random tile maps
- **Reldens**: MMORPG platform that uses these optimized maps

---

### [Reldens](https://github.com/damian-pastorini/reldens/ "Reldens")

##### [By DwDeveloper](https://www.dwdeveloper.com/ "DwDeveloper")
