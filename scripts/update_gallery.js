const fs = require('fs');
const path = require('path');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function filterImageFiles(files) {
    return files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return IMAGE_EXTENSIONS.includes(ext);
    });
}

// Allow importing for tests
module.exports = { filterImageFiles, IMAGE_EXTENSIONS };

// Run as script when executed directly
if (require.main === module) {
    const galleryDir = path.join(__dirname, '../images/gallery');
    const outputFile = path.join(__dirname, '../data/gallery.json');

    if (!fs.existsSync(galleryDir)) {
        console.error(`Gallery directory not found: ${galleryDir}`);
        process.exit(1);
    }

    try {
        const files = fs.readdirSync(galleryDir);
        const imageFiles = filterImageFiles(files);
        const jsonContent = JSON.stringify(imageFiles, null, 2);
        fs.writeFileSync(outputFile, jsonContent);
        console.log(`Updated gallery.json with ${imageFiles.length} images.`);
    } catch (err) {
        console.error('Error updating gallery JSON:', err);
        process.exit(1);
    }
}
