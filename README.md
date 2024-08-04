[![Reldens - GitHub - Release](https://www.dwdeveloper.com/media/reldens/reldens-mmorpg-platform.png)](https://github.com/damian-pastorini/reldens)

# Reldens - Tile Map Optimizer

A tool to optimize a tile map JSON, merge multiple tilesheets into a single image only with the used tiles.

Need some specific feature?

[Request a feature here: https://www.reldens.com/features-request](https://www.reldens.com/features-request)

---

## Documentation

[https://www.reldens.com/documentation/tile-map-optimizer/](https://www.reldens.com/documentation/tile-map-optimizer/)

### Simple to use example:

Create a file to configure the optimizer with the file to be optimized: 

```
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
```
$ node ./optimize-example.js
```

Look for your optimized maps on the "generated" folder.

---

### [Reldens](https://github.com/damian-pastorini/reldens/ "Reldens")

##### [By DwDeveloper](https://www.dwdeveloper.com/ "DwDeveloper")
