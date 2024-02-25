const express = require('express');
const fs = require('fs');

// Create a new express application
const app = express();
const PORT = process.env.PORT || 3000;

// Body Parser Middleware to handle form data
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Function to process the Tiled Map JSON and associated images
async function processTiledMap(jsonFilePath, imageFilePaths) {
    // Read and parse the JSON file
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    // Image processing logic using sharp would go here
    // Update JSON references with new image paths and positions
    // Save the updated JSON file
    // Return the path to the updated JSON file
}

// Express route to handle the optimization request
app.post('/optimize-map', async (req, res) => {
    try {
        // You would handle file uploads here and pass the file paths to `processTiledMap`
        const jsonFilePath = '/path/to/json/file';
        const imageFilePaths = ['/path/to/image1', '/path/to/image2', '/path/to/image3'];

        const updatedJsonFilePath = await processTiledMap(jsonFilePath, imageFilePaths);
        res.status(200).json({ message: 'Map optimized successfully', path: updatedJsonFilePath });
    } catch (error) {
        res.status(500).json({ message: 'Error processing request', error: error.toString() });
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT})`));

module.exports = {
    processTiledMap,
};
