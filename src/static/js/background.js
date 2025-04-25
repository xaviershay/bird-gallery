/**
 * Random Image Placement Script
 * 
 * This script places a number of images randomly on the background of the body element
 * without overlapping. The density is customizable through the 'density' parameter.
 */

// Configuration
const config = {
  imageSize: 100, // Size of each image in pixels (assumes square images)
  density: 0.01,  // Density factor (0.0 to 1.0) - higher means more images
  images: [       // Array of image URLs to use
    '/svg/bird1.svg',
    '/svg/bird2.svg',
    '/svg/bird3.svg',
    '/svg/bird4.svg',
  ],
  padding: 50     // Minimum padding between images in pixels
};

/**
 * Places images randomly in a fixed-size container without overlapping
 * @param {Object} options - Configuration options
 */
function placeRandomImages(options = {}) {
  // Merge provided options with defaults
  const settings = { ...config, ...options };

  // Create a container div for the background images
  let backgroundContainer = document.getElementById('background-container');
  if (!backgroundContainer) {
    backgroundContainer = document.createElement('div');
    backgroundContainer.id = 'background-container';
    backgroundContainer.style.position = 'absolute';
    backgroundContainer.style.width = '3000px';
    backgroundContainer.style.height = '3000px';
    backgroundContainer.style.top = '0';
    backgroundContainer.style.left = '0';
    backgroundContainer.style.zIndex = '-1';
    backgroundContainer.style.overflow = 'hidden';
    document.body.appendChild(backgroundContainer);
  }

  // Clear existing images in the container
  backgroundContainer.style.backgroundImage = '';
  backgroundContainer.style.backgroundPosition = '';
  backgroundContainer.style.backgroundSize = '';
  backgroundContainer.style.backgroundRepeat = '';

  // Calculate number of images based on density and container size
  const containerWidth = 3000;
  const containerHeight = 3000;
  const totalArea = containerWidth * containerHeight;
  const imageArea = settings.imageSize * settings.imageSize;
  const maxImages = Math.floor((totalArea * settings.density) / imageArea);

  // Track placed image positions to avoid overlaps
  const placedPositions = [];

  // Function to check if a position would overlap with existing images
  function wouldOverlap(x, y) {
    const size = settings.imageSize;
    const padding = settings.padding;

    for (const pos of placedPositions) {
      const xOverlap = Math.abs(x - pos.x) < (size + padding);
      const yOverlap = Math.abs(y - pos.y) < (size + padding);

      if (xOverlap && yOverlap) {
        return true;
      }
    }
    return false;
  }

  // Try to place maxImages images
  let placedCount = 0;
  let attempts = 0;
  const maxAttempts = maxImages * 10;

  // Collect background images data
  const backgroundImages = [];

  while (placedCount < maxImages && attempts < maxAttempts) {
    attempts++;

    // Generate random position
    const x = Math.floor(Math.random() * (containerWidth - settings.imageSize));
    const y = Math.floor(Math.random() * (containerHeight - settings.imageSize));

    // Check if this position would overlap with existing images
    if (!wouldOverlap(x, y)) {
      const imageUrl = settings.images[Math.floor(Math.random() * settings.images.length)];

      backgroundImages.push({
        url: imageUrl,
        x: x,
        y: y
      });

      placedPositions.push({ x, y });
      placedCount++;
    }
  }

  // Apply background images to the container
  if (backgroundImages.length > 0) {
    const backgroundImageValue = backgroundImages.map(img => `url('${img.url}')`).join(', ');
    const backgroundPositionValue = backgroundImages.map(img => `calc(${img.x}px) calc(${img.y}px)`).join(', ');
    const backgroundSizeValue = backgroundImages.map(() => `${settings.imageSize}px ${settings.imageSize}px`).join(', ');
    const backgroundRepeatValue = backgroundImages.map(() => 'no-repeat').join(', ');

    backgroundContainer.style.backgroundImage = backgroundImageValue;
    backgroundContainer.style.backgroundPosition = backgroundPositionValue;
    backgroundContainer.style.backgroundSize = backgroundSizeValue;
    backgroundContainer.style.backgroundRepeat = backgroundRepeatValue;
  }

  console.log(`Placed ${placedCount} images out of attempted ${attempts}.`);
  return placedCount;
}

/**
 * Updates the size and position of the background container to match the page dimensions.
 */
function updateBackgroundContainer() {
  const backgroundContainer = document.getElementById('background-container');
  if (backgroundContainer) {
    backgroundContainer.style.width = `${window.innerWidth - 20}px`;
    backgroundContainer.style.height = `${window.innerHeight -20}px`;
  }
}

// Call updateBackgroundContainer on resize and scroll
window.addEventListener('resize', updateBackgroundContainer);
window.addEventListener('scroll', updateBackgroundContainer);

// Ensure the container is updated when the page loads
window.addEventListener('load', () => {
  updateBackgroundContainer();
  placeRandomImages({
    density: 0.2, // Adjust density here (0.0 to 1.0)
    // You can override any other config options here
  });
});

// You can also call it directly
// placeRandomImages();

// To change density dynamically:
function updateDensity(newDensity) {
  // Clear existing background images
  document.body.style.backgroundImage = '';
  document.body.style.backgroundPosition = '';
  document.body.style.backgroundSize = '';
  document.body.style.backgroundRepeat = '';

  // Place new images with updated density
  placeRandomImages({ density: newDensity });
}

// Example of updating density with a slider
// <input type="range" min="0" max="100" value="20" 
//   oninput="updateDensity(this.value / 1000)">