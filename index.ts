import { Jimp } from "jimp";
import path from "path";
import fs from "fs";

const MTG_CARD_CORNER_RADIUS_MM = 2.5;
const MM_TO_INCH = 0.0393701;
const MTG_CARD_HEIGHT_MM = 88;
const MTG_CARD_WIDTH_MM = 63;

async function main() {
  const inputPath = path.resolve(".", "input");
  const outputPath = path.resolve(".", "output");

  const inputImages = fs.readdirSync(inputPath);
  for (const imageName of inputImages) {
    const image = await Jimp.read(path.join(inputPath, imageName));
    const pixelsPerMm = image.height / MTG_CARD_HEIGHT_MM;
    const pixelsPerInch = pixelsPerMm / MM_TO_INCH;
    const bleedSize = Math.floor(pixelsPerInch * 0.125);

    const biggerCanvas = new Jimp({
      height: image.height + bleedSize * 2,
      width: image.width + bleedSize * 2,
      color: 0x00000000,
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

    const topEdge = image.clone().crop({ x: 0, y: 0, w: image.width, h: 1 });
    topEdge.resize({
      w: image.width,
      h: bleedSize,
    });

    const bottomEdge = image
      .clone()
      .crop({ x: 0, y: image.height - 1, w: image.width, h: 1 });
    bottomEdge.resize({
      w: image.width,
      h: bleedSize,
    });

    biggerCanvas.composite(topEdge, bleedSize, 0);
    biggerCanvas.composite(bottomEdge, bleedSize, image.height + bleedSize);
    biggerCanvas.composite(leftEdge, 0, 0);
    biggerCanvas.composite(leftEdge, 0, bleedSize);

    biggerCanvas.write(path.join(outputPath, imageName) as any);
    // leftEdge.write(path.join(outputPath, "left" + imageName) as any);
    // rightEdge.write(path.join(outputPath, "right" + imageName) as any);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
