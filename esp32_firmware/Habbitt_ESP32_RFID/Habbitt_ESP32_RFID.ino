#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// --- ESP32 HARDWARE PIN CONFIGURATION ---
#define SS_PIN    5
#define RST_PIN   21
#define RELAY_PIN 4

// --- RELAY LOGIC (Active LOW vs Active HIGH) ---
#define IS_ACTIVE_LOW true
#define RELAY_ON  (IS_ACTIVE_LOW ? LOW : HIGH)
#define RELAY_OFF (IS_ACTIVE_LOW ? HIGH : LOW)

// --- WI-FI CONFIGURATION ---
const char* ssid     = "realme 12x 5G 9755";
const char* password = "12345678";

// --- PRODUCTION BACKEND CONFIGURATION ---
const String BACKEND_BASE_URL = "https://habbitt-backend.onrender.com";
const char* deviceApiKey = "habbitt_esp32_secret_key_2026";

// Dynamic API Endpoints
String scanUrl   = BACKEND_BASE_URL + "/api/rfid/scan?device_key=" + String(deviceApiKey);
String statusUrl = BACKEND_BASE_URL + "/api/machine/status?esp32=true&device_key=" + String(deviceApiKey);

// RFID Instance
MFRC522 rfid(SS_PIN, RST_PIN);

// Global State
bool currentRelayState = false;
unsigned long lastStatusCheck = 0;
unsigned long lastWifiRetry = 0;
const unsigned long STATUS_CHECK_INTERVAL = 5000; // 5 seconds heartbeat
const unsigned long WIFI_RETRY_INTERVAL   = 10000; // 10 seconds Wi-Fi retry interval

// --- TRULY NON-BLOCKING WI-FI MANAGER ---
void maintainWiFi() {
  static bool wasConnected = false;
  unsigned long now = millis();

  if (WiFi.status() == WL_CONNECTED) {
    if (!wasConnected) {
      wasConnected = true;
      Serial.println("\n✅ Wi-Fi Connected Successfully!");
      Serial.print("🌐 ESP32 IP Address: ");
      Serial.println(WiFi.localIP());
      Serial.println("----------------------------------------------");
      Serial.println("Ready for RFID card...");
    }
    return;
  }

  // If Wi-Fi is disconnected
  if (wasConnected) {
    wasConnected = false;
    Serial.println("\n⚠️ Wi-Fi Connection Lost! Attempting background reconnect...");
  }

  // Non-blocking retry every WIFI_RETRY_INTERVAL (10s)
  if (lastWifiRetry == 0 || (now - lastWifiRetry >= WIFI_RETRY_INTERVAL)) {
    lastWifiRetry = now;
    Serial.print("📶 [Wi-Fi Non-blocking] Connecting to SSID: ");
    Serial.println(ssid);
    WiFi.mode(WIFI_STA);
    WiFi.setTxPower(WIFI_POWER_15dBm);
    WiFi.begin(ssid, password);
  }
}

void setup() {
  Serial.begin(9600);
  delay(1000);

  Serial.println("\n==============================================");
  Serial.println("  HABBITT SMART LAUNDRY - ESP32 RFID SYSTEM  ");
  Serial.println("==============================================");

  // Initialize Relay Pin (OFF by default)
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF);
  currentRelayState = false;
  Serial.println("✅ Relay Initialized (GPIO 4 -> OFF/STANDBY)");

  // Initialize SPI bus and RC522 RFID Reader (SCK=18, MISO=19, MOSI=23, SS=5)
  SPI.begin(18, 19, 23, 5);
  rfid.PCD_Init();
  delay(100);
  Serial.println("✅ MFRC522 RFID Reader Initialized");
  Serial.print("🔍 RFID Hardware Check: ");
  rfid.PCD_DumpVersionToSerial();

  // Start non-blocking Wi-Fi connection
  maintainWiFi();
}

String readCardUID() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (i > 0) uid += ":";
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

void processRFIDScan(String uid) {
  Serial.println("\n----------------------------------------------");
  Serial.println("💳 RFID Card Detected!");
  Serial.print("  UID: ");
  Serial.println(uid);
  Serial.println("📡 Sending request to backend...");

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ Wi-Fi Not Connected! Cannot verify RFID scan right now.");
    return;
  }

  WiFiClientSecure client;
  client.setInsecure(); // Bypass TLS certificate validation for prototype

  HTTPClient http;
  http.begin(client, scanUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", deviceApiKey);
  http.setTimeout(15000); // 15 seconds to allow Render cold-start

  // Valid C++ JSON string formatting with escaped quotes
  String jsonPayload = "{\"rfidCardId\":\"" + uid + "\"}";

  int httpCode = http.POST(jsonPayload);

  Serial.print("Server HTTP status: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.print("Server response: ");
    Serial.println(payload);

    if (httpCode == 401) {
      Serial.println("❌ DEVICE AUTHENTICATION FAILED (Check DEVICE_API_KEY)");
    } else if (httpCode == 403) {
      Serial.println("❌ ACCESS DENIED");
    } else if (httpCode == 200) {
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        bool success = doc["success"] | false;
        bool targetRelayState = doc["relayState"] | false;
        const char* message = doc["message"] | "";
        const char* userName = doc["userName"] | "User";

        if (success && targetRelayState) {
          digitalWrite(RELAY_PIN, RELAY_ON);
          currentRelayState = true;
          Serial.println("==============================================");
          Serial.println("🎉 ACCESS GRANTED");
          Serial.println("⚡ RELAY ACTIVATED (GPIO " + String(RELAY_PIN) + " -> " + (IS_ACTIVE_LOW ? "LOW" : "HIGH") + ")");
          Serial.print("👤 User: ");
          Serial.println(userName);
          Serial.print("💬 ");
          Serial.println(message);
          Serial.println("==============================================");
        } else {
          Serial.println("==============================================");
          Serial.println("⛔ ACCESS DENIED");
          Serial.print("💬 ");
          Serial.println(message);
          Serial.println("==============================================");
          // If server says relay state should be OFF, force relay OFF
          if (!targetRelayState) {
            currentRelayState = false;
            digitalWrite(RELAY_PIN, RELAY_OFF);
            Serial.println("🔴 Relay set to OFF (GPIO " + String(RELAY_PIN) + " -> " + (IS_ACTIVE_LOW ? "HIGH" : "LOW") + ")");
          } else {
            Serial.println("ℹ️ Machine currently running active session. Relay remains ON.");
          }
        }
      } else {
        Serial.print("⚠️ JSON parsing failed: ");
        Serial.println(error.c_str());
      }
    } else {
      Serial.print("⚠️ Unexpected HTTP response code: ");
      Serial.println(httpCode);
    }
  } else {
    Serial.print("❌ HTTP Request failed, error: ");
    Serial.println(http.errorToString(httpCode).c_str());
  }

  http.end();
}

void checkMachineStatusHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, statusUrl);
  http.addHeader("X-Device-Key", deviceApiKey);
  http.setTimeout(8000);

  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      bool targetRelayState = doc["relayState"] | false;
      if (targetRelayState != currentRelayState) {
        currentRelayState = targetRelayState;
        digitalWrite(RELAY_PIN, currentRelayState ? RELAY_ON : RELAY_OFF);
        Serial.print("🔄 [HEARTBEAT] Relay state updated from server: ");
        Serial.print(currentRelayState ? "ON (RUNNING)" : "OFF (STANDBY)");
        Serial.println(" -> GPIO " + String(RELAY_PIN) + " set to " + (currentRelayState ? (IS_ACTIVE_LOW ? "LOW" : "HIGH") : (IS_ACTIVE_LOW ? "HIGH" : "LOW")));
      }
    }
  }

  http.end();
}

void loop() {
  // Maintain Wi-Fi connection non-blockingly (zero delay / zero blocking loops)
  maintainWiFi();

  // 1. Check for RFID Card Scan
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String scannedUid = readCardUID();
    processRFIDScan(scannedUid);

    // Halt PICC and stop crypto to prepare for next scan
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    delay(1500); // Debounce delay
  }

  // 2. Periodic Machine Status Heartbeat (~5s)
  unsigned long currentMillis = millis();
  if (currentMillis - lastStatusCheck >= STATUS_CHECK_INTERVAL) {
    lastStatusCheck = currentMillis;
    checkMachineStatusHeartbeat();
  }
}
