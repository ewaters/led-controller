#include "SPI.h"
#include "Adafruit_WS2801.h"

// Setup strip
uint16_t pixelCount = 50;
uint8_t dataPin  = 2;    // Yellow wire on Adafruit Pixels
uint8_t clockPin = 3;    // Green wire on Adafruit Pixels
Adafruit_WS2801 strip = Adafruit_WS2801(pixelCount, dataPin, clockPin);

uint16_t currentPixelIndex = 0;
uint32_t currentColor;
uint8_t  currentChannel = 1;
byte     gReady = 0xff;

void setup() {
	Serial.begin(57600);

	strip.begin();
	strip.show();

        colorWipe(Color(255, 0, 0), 20);
        colorWipe(Color(0, 0, 0), 20);
        Serial.write(gReady);
}

void loop() {
	while (Serial.available() > 0) {
		// Read the next byte off the stream and adjust the current color accordingly.
		byte val = (byte)Serial.read();
		if (currentChannel == 1) {
			currentColor = val;
		}
		else {
			currentColor <<= 8;
			currentColor |= val;
		}
		
		// If I haven't yet read all three channels, increment and loop again.
		if (currentChannel < 3) {
			currentChannel += 1;
			continue;
		}

		// Set the pixel color.
		strip.setPixelColor(currentPixelIndex, currentColor);
                //strip.show();

		// Reset the current channel.
		currentChannel = 1;

		// If we have more pixel colors to read, loop again.
		if (currentPixelIndex < (pixelCount - 1)) {
			currentPixelIndex += 1;
			continue;
		}

		// All pixel data has been read; show, report and reset.
		strip.show();
		currentPixelIndex = 0;
		Serial.write(gReady);
	}
}

/* Helper functions */

// Create a 24 bit color value from R,G,B
uint32_t Color(byte r, byte g, byte b)
{
  uint32_t c;
  c = r;
  c <<= 8;
  c |= g;
  c <<= 8;
  c |= b;
  return c;
}

//Input a value 0 to 255 to get a color value.
//The colours are a transition r - g -b - back to r
uint32_t Wheel(byte WheelPos)
{
  if (WheelPos < 85) {
   return Color(WheelPos * 3, 255 - WheelPos * 3, 0);
  } else if (WheelPos < 170) {
   WheelPos -= 85;
   return Color(255 - WheelPos * 3, 0, WheelPos * 3);
  } else {
   WheelPos -= 170; 
   return Color(0, WheelPos * 3, 255 - WheelPos * 3);
  }
}

void rainbow(uint8_t wait) {
  int i, j;
   
  for (j=0; j < 256; j++) {     // 3 cycles of all 256 colors in the wheel
    for (i=0; i < strip.numPixels(); i++) {
      strip.setPixelColor(i, Wheel( (i + j) % 255));
    }  
    strip.show();   // write all the pixels out
    delay(wait);
  }
}

// Slightly different, this one makes the rainbow wheel equally distributed 
// along the chain
void rainbowCycle(uint8_t wait) {
  int i, j;
  
  for (j=0; j < 256 * 5; j++) {     // 5 cycles of all 25 colors in the wheel
    for (i=0; i < strip.numPixels(); i++) {
      // tricky math! we use each pixel as a fraction of the full 96-color wheel
      // (thats the i / strip.numPixels() part)
      // Then add in j which makes the colors go around per pixel
      // the % 96 is to make the wheel cycle around
      strip.setPixelColor(i, Wheel( ((i * 256 / strip.numPixels()) + j) % 256) );
    }  
    strip.show();   // write all the pixels out
    delay(wait);
  }
}

// fill the dots one after the other with said color
// good for testing purposes
void colorWipe(uint32_t c, uint8_t wait) {
  int i;
  
  for (i=0; i < strip.numPixels(); i++) {
      strip.setPixelColor(i, c);
      strip.show();
      delay(wait);
  }
}
