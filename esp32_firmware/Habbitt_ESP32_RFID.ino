/*
 * ============================================================================
 * HABBITT SMART LAUNDRY - FULL ESP32 RFID & RELAY AUTOMATION FIRMWARE
 * ============================================================================
 * 
 * Circuit Wiring Details:
 * -----------------------
 * 1. RC522 RFID Module ↔ ESP32:
 *    - SDA (SS)  --> GPIO 5
 *    - SCK       --> GPIO 18
 *    - MOSI      --> GPIO 23
 *    - MISO      --> GPIO 19
 *    - RST       --> GPIO 21
 *    - 3.3V      --> ESP32 3.3V
 *    - GND       --> ESP32 GND
 * 
 * 2. Relay Module ↔ ESP32:
 *    - IN        --> GPIO 4
 *    - VCC       --> VIN (5V) or 3.3V
 *    - GND       --> ESP32 GND
 * 
 * Wi-Fi Credentials:
 *    - SSID:     "Harsh"
 *    - Password: "12345678"
 * 
 * Production Deployment Server URL:
 *    - Change BACKEND_BASE_URL to your Render Web Service domain:
 *      e.g. "https://your-habbitt-backend.onrender.com"
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// --- PIN DEFINITIONS ---
#define SS_PIN    5
#define RST_PIN   21
#define RELAY_PIN 4

// --- RELAY LOGIC (Active LOW vs Active HIGH) ---
// Set to true if your Relay turns ON when pin is LOW
#define IS_ACTIVE_LOW true

#define RELAY_ON  (IS_ACTIVE_LOW ? LOW : HIGH)
#define RELAY_OFF (IS_ACTIVE_LOW ? HIGH : LOW)

// --- WI-FI & SERVER CONFIGURATION ---
const char* ssid = "Harsh";
const char* password = "12345678";

// Configurable Production Backend URL (Change this to your deployed Render HTTPS backend URL)
// Example Production: "https://your-habbitt-backend.onrender.com"
const String BACKEND_BASE_URL = "https://your-habbitt-backend.onrender.com"; 

// Dynamic API Endpoints
String scanUrl   = BACKEND_BASE_URL + "/api/rfid/scan";
String statusUrl = BACKEND_BASE_URL + "/api/machine/status?esp32=true";

// Create RFID instance
MFRC522 rfid(SS_PIN, RST_PIN);

bool currentRelayState = false;
unsigned long lastStatusCheck = 0;

void setup() {
  Serial.begin(9600);
  delay(1000);

  Serial.println("\n==============================================");
  Serial.println("  HABBITT SMART LAUNDRY - ESP32 RFID SYSTEM  ");
  Serial.println("==============================================");

  // Initialize Relay Pin (OFF by default)
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF);
  Serial.println("✅ Relay Pin Initialized (GPIO 4 -> OFF/STANDBY)");

  // Initialize SPI bus and RC522 RFID Reader
  SPI.begin(18, 19, 23, 5); // SCK, MISO, MOSI, SS
  rfid.PCD_Init();
  delay(100);
  Serial.println("✅ MFRC522 RFID Reader Initialized!");

  // Connect to Wi-Fi
  Serial.print("📶 Connecting to Wi-Fi SSID: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Wi-Fi Connected Successfully!");
    Serial.print("📍 ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n⚠️ Wi-Fi Connection Timeout. Will retry in loop.");
  }

  Serial.println("==============================================");
  Serial.println("👉 Ready! Touch your registered RFID Card...");
  Serial.println("==============================================");
}

void loop() {
  // 1. Check for RFID Card Scan
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    // Extract Card UID e.g. "2C:4F:6D:05"
    String cardUID = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      if (i > 0) cardUID += ":";
      if (rfid.uid.uidByte[i] < 0x10) cardUID += "0";
      cardUID += String(rfid.uid.uidByte[i], HEX);
    }
    cardUID.toUpperCase();

    Serial.println("\n----------------------------------------------");
    Serial.print("💳 RFID Card Detected! UID: ");
    Serial.println(cardUID);

    // Halt RFID chip to prevent continuous reading
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();

    // Verify card and active slot with server
    verifyRfidWithServer(cardUID);
  }

  // 2. Poll server for live relay status every 5 seconds (heartbeat)
  if (millis() - lastStatusCheck > 5000) {
    lastStatusCheck = millis();
    checkMachineStatusFromServer();
  }
}

void verifyRfidWithServer(String uid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Wi-Fi Disconnected! Reconnecting...");
    WiFi.begin(ssid, password);
    delay(2000);
    if (WiFi.status() != WL_CONNECTED) return;
  }

  // Ensure current relay state is firmly held before making HTTP POST
  digitalWrite(RELAY_PIN, currentRelayState ? RELAY_ON : RELAY_OFF);

  HTTPClient http;

  // HTTPS Communication Layer Setup
  if (BACKEND_BASE_URL.startsWith("https")) {
    WiFiClientSecure client;
    // =========================================================================
    // SECURITY WARNING / TEMPORARY PRODUCTION SECURITY LIMITATION:
    // setInsecure() bypasses SSL certificate validation for prototype deployment.
    // For strict production security, replace setInsecure() with client.setCACert(rootCACertificate).
    // =========================================================================
    client.setInsecure();
    http.begin(client, scanUrl);
  } else {
    http.begin(scanUrl);
  }

  http.addHeader("Content-Type", "application/json");

  String jsonPayload = "{\"rfidCardId\":\"" + uid + "\"}";
  Serial.print("📡 Verifying Card with Server: ");
  Serial.println(jsonPayload);

  int httpCode = http.POST(jsonPayload);

  if (httpCode > 0) {
    String responseStr = http.getString();
    Serial.print("📄 Server Response: ");
    Serial.println(responseStr);

    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, responseStr);

    if (!error) {
      bool success = doc["success"] | false;
      bool relayState = doc["relayState"] | false;
      const char* message = doc["message"] | "";
      const char* userName = doc["userName"] | "User";

      if (success && relayState) {
        Serial.println("\n🎉 ACCESS GRANTED!");
        Serial.print("👤 User: ");
        Serial.println(userName);
        Serial.print("💬 Message: ");
        Serial.println(message);

        // Turn ON Relay
        digitalWrite(RELAY_PIN, RELAY_ON);
        currentRelayState = true;
        Serial.println("⚡ RELAY ACTIVATED (GPIO 4 -> ON)... Machine Started!");

      } else {
        Serial.println("\n⛔ ACCESS DENIED!");
        Serial.print("💬 Reason: ");
        Serial.println(message);

        // Re-assert active relay state on ESP32 hardware pin!
        if (currentRelayState) {
          digitalWrite(RELAY_PIN, RELAY_ON);
          Serial.println("🔒 Active machine is running! Preserving Relay ON (GPIO 4 -> ON).");
        } else {
          digitalWrite(RELAY_PIN, RELAY_OFF);
          Serial.println("🔒 Machine is standby. Preserving Relay OFF (GPIO 4 -> OFF).");
        }
      }
    }
  } else {
    Serial.print("❌ Server HTTP Error: ");
    Serial.println(httpCode);
    // On HTTP error, preserve active running relay state
    digitalWrite(RELAY_PIN, currentRelayState ? RELAY_ON : RELAY_OFF);
  }

  http.end();
  Serial.println("----------------------------------------------\n");
}

void checkMachineStatusFromServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;

  // HTTPS Communication Layer Setup
  if (BACKEND_BASE_URL.startsWith("https")) {
    WiFiClientSecure client;
    client.setInsecure();
    http.begin(client, statusUrl);
  } else {
    http.begin(statusUrl);
  }

  http.setTimeout(1500);

  int httpCode = http.GET();

  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      bool targetRelayState = doc["relayState"] | false;
      if (targetRelayState != currentRelayState) {
        currentRelayState = targetRelayState;
        if (currentRelayState) {
          digitalWrite(RELAY_PIN, RELAY_ON);
          Serial.println("⚡ [SYNC] Relay Turned ON by Server!");
        } else {
          digitalWrite(RELAY_PIN, RELAY_OFF);
          Serial.println("💤 [SYNC] Relay Turned OFF by Server!");
        }
      }
    }
  }
  http.end();
}
