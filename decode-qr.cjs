const fs = require('fs');
const jsQR = require('jsqr');
const jpeg = require('jpeg-js');

const jpegData = fs.readFileSync('d:/ten-11/public/qr-payment.jpg');
const rawImageData = jpeg.decode(jpegData, {useTArray: true}); 

const code = jsQR(rawImageData.data, rawImageData.width, rawImageData.height);

if (code) {
  console.log("Found QR code", code.data);
} else {
  console.log("No QR code found");
}
