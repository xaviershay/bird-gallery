import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_SIZE = 2000;
const SVG_DIR = path.resolve(__dirname, '../../src/static/svg/components');
const OUTPUT_FILE = path.resolve(__dirname, '../../src/static/svg/composited.svg');

/**
 * Generate a random integer between min (inclusive) and max (exclusive).
 */
function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
}

/**
 * Check if a new element overlaps with existing elements.
 */
function isOverlapping(x: number, y: number, width: number, height: number, padding: number, placements: { x: number; y: number; width: number; height: number }[]): boolean {
    for (const placement of placements) {
        if (
            x + width + padding > placement.x &&
            x < placement.x + placement.width + padding &&
            y + height + padding > placement.y &&
            y < placement.y + placement.height + padding
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Extract the content inside the first <g> element of an SVG file.
 */
function extractFirstGroup(svgContent: string): string {
    const match = svgContent.match(/<g[^>]*>[\s\S]*<\/g>/);
    return match ? match[0] : '';
}

/**
 * Generate a composited SVG with random arrangement of SVGs from the directory.
 * @param density Number of SVGs to include in the composition.
 */
function generateCompositeSVG(density: number, padding: number = 50): void {
    const svgFiles = fs.readdirSync(SVG_DIR).filter(file => file.endsWith('.svg'));

    if (svgFiles.length === 0) {
        console.error('No SVG files found in the directory.');
        return;
    }

    let compositeContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}">`;
    const placements: { x: number; y: number; width: number; height: number }[] = [];

    for (let i = 0; i < density; i++) {
        const randomFile = svgFiles[getRandomInt(0, svgFiles.length)];
        const svgContent = fs.readFileSync(path.join(SVG_DIR, randomFile), 'utf-8');

        // Extract the content inside the first <g> element
        const innerContent = extractFirstGroup(svgContent);

        // Random scale and calculate dimensions
        const scale = 0.05;
        const width = OUTPUT_SIZE * scale;
        const height = OUTPUT_SIZE * scale;

        let x, y;
        let attempts = 0;
        do {
            x = getRandomInt(0, OUTPUT_SIZE - width);
            y = getRandomInt(0, OUTPUT_SIZE - height);
            attempts++;
        } while (isOverlapping(x, y, width, height, padding, placements) && attempts < 100);

        if (attempts === 100) {
            console.warn('Could not place an element without overlap after 100 attempts.');
            continue;
        }

        placements.push({ x, y, width, height });

        compositeContent += `
            <g transform="translate(${x}, ${y}) scale(0.4)">
                ${innerContent}
            </g>
        `;
    }

    compositeContent += '</svg>';

    fs.writeFileSync(OUTPUT_FILE, compositeContent);
    console.log(`Composite SVG generated at: ${OUTPUT_FILE}`);
}

// Example usage: Generate a composite SVG with a density of 20 and padding of 10
generateCompositeSVG(80, 40);
