import { Jimp, colorDiff, intToRGBA } from "jimp";
import path from "path";
import fs from "fs";

const MTG_CARD_CORNER_RADIUS_MM = 2.5;
const MM_TO_INCH = 0.0393701;
const MTG_CARD_HEIGHT_MM = 88;
const MTG_CARD_WIDTH_MM = 63;
const TRANSPARENT = 0x00000000;

function fillInTransparentPixels(image: any, startY: number, endY: number) {
  const sampleDepth = 10;
  for (let y = startY; y < endY; y++) {
    const leftSideTransparentPixels: [number, number][] = [];
    const rightSideTransparentPixels: [number, number][] = [];

    let leftSideEdgeColor: number | undefined;

    let rightSideEdgeColor: number | undefined;

    for (let x = 0; x < image.width; x++) {
      const color = image.getPixelColor(x, y);
      const isTransparent = intToRGBA(color).a !== 255;
      if (leftSideEdgeColor === undefined && !isTransparent) {
        leftSideEdgeColor = image.getPixelColor(x + sampleDepth, y);
      }
      if (
        rightSideEdgeColor === undefined &&
        isTransparent &&
        x > image.width / 2
      ) {
        rightSideEdgeColor = image.getPixelColor(x - sampleDepth, y);
      }
      if (isTransparent && x < image.width / 2) {
        leftSideTransparentPixels.push([x, y]);
      }
      if (isTransparent && x > image.width / 2) {
        rightSideTransparentPixels.push([x, y]);
      }
    }

    if (leftSideEdgeColor) {
      leftSideTransparentPixels.forEach((coordinate) => {
        image.setPixelColor(leftSideEdgeColor, coordinate[0], coordinate[1]);
      });
    }

    if (rightSideEdgeColor) {
      rightSideTransparentPixels.forEach((coordinate) => {
        image.setPixelColor(rightSideEdgeColor, coordinate[0], coordinate[1]);
      });
    }
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

    fillInTransparentPixels(image, 0, cornerRadiusPixels);
    fillInTransparentPixels(
      image,
      image.height - cornerRadiusPixels,
      image.height
    );

    const biggerCanvas = new Jimp({
      height: image.height + bleedSize * 2,
      width: image.width + bleedSize * 2,
      color: TRANSPARENT,
    });
    // put original image in the bigger canvas
    biggerCanvas.composite(image, bleedSize, bleedSize);

    const rightEdge = image.clone().crop({
      x: image.width - 1,
      y: 0,
      w: 1,
      h: image.height,
    });
    rightEdge.resize({ w: bleedSize, h: image.height });

    const leftEdge = image.clone().crop({
      x: 1,
      y: 0,
      w: 1,
      h: image.height,
    });
    leftEdge.resize({ w: bleedSize, h: image.height });

    biggerCanvas.composite(leftEdge, 0, bleedSize);
    biggerCanvas.composite(rightEdge, image.width + bleedSize, bleedSize);

    const topEdge = biggerCanvas
      .clone()
      .crop({ x: 0, y: bleedSize, w: biggerCanvas.width, h: 1 });
    topEdge.resize({
      w: biggerCanvas.width,
      h: bleedSize,
    });

    const bottomEdge = biggerCanvas.clone().crop({
      x: 0,
      y: image.height + bleedSize - 1,
      w: biggerCanvas.width,
      h: 1,
    });
    bottomEdge.resize({
      w: biggerCanvas.width,
      h: bleedSize,
    });

    biggerCanvas.composite(topEdge, 0, 0);
    biggerCanvas.composite(bottomEdge, 0, biggerCanvas.height - bleedSize);

    biggerCanvas.write(path.join(outputPath, imageName) as any);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
