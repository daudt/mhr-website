const fs = require('fs');
const path = require('path');

const galleryDir = path.join(__dirname, '../images/gallery');
const outputFile = path.join(__dirname, '../data/gallery.json');

// Ensure gallery directory exists
if (!fs.existsSync(galleryDir)) {
    console.error(`Gallery directory not found: ${galleryDir}`);
    process.exit(1);
}

// Read directory
try {
    const files = fs.readdirSync(galleryDir);

    // Filter for image files (jpg, jpeg, png, gif, webp)
    const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
    });

    // Write to JSON file
    const jsonContent = JSON.stringify(imageFiles, null, 2);
    fs.writeFileSync(outputFile, jsonContent);

    console.log(`Updated gallery.json with ${imageFiles.length} images.`);

} catch (err) {
    console.error('Error updating gallery JSON:', err);
    process.exit(1);
}
