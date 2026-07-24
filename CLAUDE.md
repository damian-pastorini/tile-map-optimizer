## Package Overview

**@reldens/tile-map-optimizer** is a tile map optimization package for Reldens. It provides:
- Tile map JSON optimization for Tiled editor maps
- Tileset image optimization and compression
- Unused tile removal and cleanup
- Image processing via Sharp library
- Map size reduction (typically 50-90% reduction)
- Tile remapping and index updates

## Key Commands

```bash
# Install dependencies
npm install

# Run optimization example
node ./optimize-example.js

# Run tests (if configured)
npm test
```

## Architecture

### Core Classes

**TileMapOptimizer** (`lib/tile-map-optimizer.js`):
- Main optimization class that processes Tiled JSON maps
- Parses original JSON to identify used tiles across all layers
- Extracts tiles from source tilesets
- Creates new compact tileset with only used tiles
- Updates JSON with remapped tile indices
- Handles tile animations, properties, and wangsets
- Generates optimized map and tileset files
- Optionally resizes output by a factor
- Key methods:
  - `generate()`: Main entry point for optimization
  - `optimize()`: Core optimization logic
  - `parseJSON()`: Identifies used tiles from layers
  - `createThumbsFromLayersData()`: Extracts tiles to new tileset
  - `createNewJSON()`: Updates JSON with new tile mappings
  - `resizeTileset()`: Optional scaling of output

**OptionsValidator** (`lib/validator/options-validator.js`):
- Validates required options before optimization
- Ensures `originalJSON` is provided
- Simple validation logic for configuration

## Usage Pattern

```javascript
const { TileMapOptimizer } = require('@reldens/tile-map-optimizer');
const originalJSON = require('./my-map.json');

const options = {
    originalJSON,                          // Required: Tiled JSON map
    originalMapFileName: 'my-map',         // Optional: Original map name
    factor: 2,                             // Optional: Resize factor (1 = no resize)
    transparentColor: '#000000',           // Optional: Transparent color
    rootFolder: __dirname,                 // Optional: Root folder path
    generatedFolder: './generated',        // Optional: Output folder
    newName: 'optimized-map'               // Optional: Output name
};

const optimizer = new TileMapOptimizer(options);
await optimizer.generate();
```

## Optimization Process

1. **Parse JSON**: Analyze all layers to find used tiles
2. **Map Tiles**: Create mapping between old and new tile indices
3. **Extract Tiles**: Extract used tiles from source tilesets
4. **Composite Image**: Create new compact tileset image
5. **Update JSON**: Remap all tile references in layers
6. **Preserve Data**: Maintain animations, properties, wangsets
7. **Generate Files**: Save optimized map JSON and tileset PNG
8. **Optional Resize**: Scale output by factor if specified

## Dependencies

- **Sharp**: Image processing and manipulation
- **@reldens/utils**: Logging, shortcuts, error handling
- **@reldens/server-utils**: File operations (FileHandler)

## Output

The optimizer generates:
- **Optimized tileset PNG**: Contains only used tiles in compact layout
- **Optimized map JSON**: Updated with new tile indices
- **Resized versions** (if factor > 1): Scaled map and tileset
- Files are timestamped to prevent overwriting

## Important Notes

- Uses Sharp library for high-performance image processing
- Optimizes Tiled map format (.json) from Tiled editor
- Typically reduces map and tileset size by 50-90%
- Used by @reldens/tile-map-generator for generated maps
- Can process existing maps or generated maps
- Preserves all map functionality (animations, properties, wangsets)
- Supports multiple source tilesets merged into one
- Handles tile spacing and margins correctly
- Maintains pixel-perfect tile extraction
