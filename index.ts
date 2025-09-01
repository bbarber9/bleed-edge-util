import { Jimp, intToRGBA, rgbaToInt } from "jimp";
import path from "path";
import fs from "fs";

const MTG_CARD_CORNER_RADIUS_MM = 2.5;
const MM_TO_INCH = 0.0393701;
const MTG_CARD_HEIGHT_MM = 88;
const MTG_CARD_WIDTH_MM = 63;
const TRANSPARENT = 0x00000000;

function getAverageColorAroundPixel(
  image: any,
  x: number,
  y: number,
  radius: number
): number {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let i = -radius; i <= radius; i++) {
    for (let j = -radius; j <= radius; j++) {
      if (i * i + j * j <= radius * radius) {
        if (
          x + i < 0 ||
          x + i >= image.width ||
          y + j < 0 ||
          y + j >= image.height
        ) {
          continue; // Skip pixels outside the image bounds
        }
        const pixelColor = image.getPixelColor(x + i, y + j);
        const rgba = intToRGBA(pixelColor);
        if (rgba.a !== 255) {
          continue; // Skip transparent pixels
        }
        r += rgba.r;
        g += rgba.g;
        b += rgba.b;
        count++;
      }
    }
  }

  const avgColor = rgbaToInt(
    Math.floor(r / count),
    Math.floor(g / count),
    Math.floor(b / count),
    255
  );

  return avgColor;
}

function fillInTransparentPixels(image: any, startY: number, endY: number) {
  const COLOR_AVG_RADIUS = 15;
  for (let y = startY; y < endY; y++) {
    const leftSideTransparentPixels: [number, number][] = [];
    const rightSideTransparentPixels: [number, number][] = [];

    for (let x = Math.floor(image.width / 2); x > -1; x--) {
      const color = image.getPixelColor(x, y);
      const isTransparent = intToRGBA(color).a !== 255;
      if (isTransparent) {
        leftSideTransparentPixels.push([x, y]);
      }
    }

    for (let x = Math.ceil(image.width / 2); x < image.width; x++) {
      const color = image.getPixelColor(x, y);
      const isTransparent = intToRGBA(color).a !== 255;
      if (isTransparent) {
        rightSideTransparentPixels.push([x, y]);
      }
    }

    leftSideTransparentPixels.forEach((coordinate) => {
      image.setPixelColor(
        getAverageColorAroundPixel(
          image,
          coordinate[0],
          coordinate[1],
          COLOR_AVG_RADIUS
        ),
        coordinate[0],
        coordinate[1]
      );
    });

    rightSideTransparentPixels.forEach((coordinate) => {
      image.setPixelColor(
        getAverageColorAroundPixel(
          image,
          coordinate[0],
          coordinate[1],
          COLOR_AVG_RADIUS
        ),
        coordinate[0],
        coordinate[1]
      );
    });
  }
}

async function main() {
  if (process.env.INPUT_PATH === undefined) {
    throw new Error("need to set INPUT_PATH");
  }
  if (process.env.OUTPUT_PATH === undefined) {
    throw new Error("need to set OUTPUT_PATH");
  }
  const inputPath = path.resolve(process.env.INPUT_PATH);
  const outputPath = path.resolve(process.env.OUTPUT_PATH);

  const inputImages = fs.readdirSync(inputPath);
  for (const imageName of inputImages) {
    const image = await Jimp.read(path.join(inputPath, imageName));
    const pixelsPerMm = image.height / MTG_CARD_HEIGHT_MM;
    const pixelsPerInch = pixelsPerMm / MM_TO_INCH;
    const bleedSize = Math.floor(pixelsPerInch * 0.125);
    const cornerRadiusPixels = Math.floor(
      pixelsPerMm * MTG_CARD_CORNER_RADIUS_MM
    );

    const biggerCanvas = new Jimp({
      height: image.height + bleedSize * 2,
      width: image.width + bleedSize * 2,
      color: TRANSPARENT,
    });
    // put original image in the bigger canvas
    biggerCanvas.composite(image, bleedSize, bleedSize);

    const horizontalFlippedImage = image.clone().flip({
      horizontal: true,
      vertical: false,
    });

    const rightEdge = horizontalFlippedImage.clone().crop({
      x: 0,
      y: 0,
      w: bleedSize,
      h: image.height,
    });

    const leftEdge = horizontalFlippedImage.clone().crop({
      x: image.width - bleedSize,
      y: 0,
      w: bleedSize,
      h: image.height,
    });

    biggerCanvas.composite(leftEdge, 0, bleedSize);
    biggerCanvas.composite(rightEdge, image.width + bleedSize, bleedSize);

    const verticalFlippedImage = biggerCanvas.clone().flip({
      horizontal: false,
      vertical: true,
    });

    //@ts-expect-error Jimp.clone is not typed correctly, it thinks crop doesn't exist
    const topEdge = verticalFlippedImage.clone().crop({
      x: 0,
      y: image.height,
      w: biggerCanvas.width,
      h: bleedSize,
    });

    //@ts-expect-error Jimp.clone is not typed correctly, it thinks crop doesn't exist
    const bottomEdge = verticalFlippedImage.clone().crop({
      x: 0,
      y: bleedSize,
      w: biggerCanvas.width,
      h: bleedSize,
    });

    biggerCanvas.composite(topEdge, 0, 0);
    biggerCanvas.composite(bottomEdge, 0, biggerCanvas.height - bleedSize);

    fillInTransparentPixels(biggerCanvas, 0, cornerRadiusPixels + bleedSize);
    fillInTransparentPixels(
      biggerCanvas,
      biggerCanvas.height - cornerRadiusPixels - bleedSize,
      biggerCanvas.height
    );

    biggerCanvas.write(path.join(outputPath, imageName) as any);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
