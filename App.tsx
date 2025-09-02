import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Platform,
} from "react-native";

/** ---------------- Types ---------------- */
type TimeWindow = { open: string; close: string }; // "HH:MM"
type Stall = {
  name: string;
  latLong: string; // "lat,lon"
  openDay: string[]; // ["Mon","Tue",...]
  openTime: TimeWindow; // single window; extend to array if needed
};
type Home = { latLong: string };
type DataShape = {
  toppanHome: Home[];
  icaHome: Home[];
  toppanFood: Stall[];
  icaFood: Stall[];
};

const dataJson = require("./fatty.json") as DataShape;

/** -------------- Utilities -------------- */

function parseLatLong(str?: string) {
  if (!str) return null;
  const [latStr, lonStr] = str.split(",").map((s) => s.trim());
  const latitude = Number(latStr);
  const longitude = Number(lonStr);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

// Haversine (km)
function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * R;
}

function weekdayShort(d: Date) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// handles normal and overnight (close < open) windows
function inOpenWindow(nowMin: number, open: string, close: string) {
  const s = toMinutes(open);
  const e = toMinutes(close);
  if (Number.isNaN(s) || Number.isNaN(e)) return false;
  return s <= e ? nowMin >= s && nowMin <= e : nowMin >= s || nowMin <= e;
}

function isOpenNow(stall: Stall, now: Date) {
  if (!stall?.openDay || !stall.openTime) return false;
  if (!stall.openDay.includes(weekdayShort(now))) return false;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const { open, close } = stall.openTime;
  return inOpenWindow(nowMin, open, close);
}

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** ---------------- App ---------------- */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [homeChoice, setHomeChoice] = useState<"toppan" | "ica">("toppan");
  const [selectedStall, setSelectedStall] = useState<Stall | null>(null);
  const [distanceKm, setDistanceKm] = useState<string | null>(null);
  const [mapsUrl, setMapsUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!dataJson) throw new Error("fatty.json not found.");
      setError(null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  function getHomeCoord() {
    const homes = homeChoice === "toppan" ? dataJson.toppanHome : dataJson.icaHome;
    const home = homes?.[0];
    return home ? parseLatLong(home.latLong) : null;
  }

  function onPick() {
    const key = homeChoice === "toppan" ? "toppanFood" : "icaFood";
    const list: Stall[] = Array.isArray((dataJson as any)[key]) ? (dataJson as any)[key] : [];
    const now = new Date();

    const openNow = list.filter((s) => parseLatLong(s.latLong) && isOpenNow(s, now));
    if (openNow.length === 0) {
      setSelectedStall(null);
      setDistanceKm(null);
      setMapsUrl(null);
      setError(`No stalls currently OPEN in ${key}.`);
      return;
    }

    const stall = pickRandom(openNow);
    setSelectedStall(stall);
    setError(null);

    const homeCoord = getHomeCoord();
    const stallCoord = parseLatLong(stall.latLong);
    if (homeCoord && stallCoord) {
      setDistanceKm(haversineKm(homeCoord, stallCoord).toFixed(2));
      const url = `https://www.google.com/maps/dir/?api=1&origin=${homeCoord.latitude},${homeCoord.longitude}&destination=${stallCoord.latitude},${stallCoord.longitude}&travelmode=walking`;
      setMapsUrl(url);
    } else {
      setDistanceKm(null);
      setMapsUrl(null);
    }
  }

  function openMaps() {
    if (mapsUrl) Linking.openURL(mapsUrl).catch((err) => setError(String(err)));
  }

  const homeCoord = getHomeCoord();
  const homeLabel = homeChoice === "toppan" ? "Toppan Home" : "ICA Home";

  const now = new Date();
  const nowDay = weekdayShort(now);
  const nowTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.h1}>What to eat</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Data & Home Selection</Text>

          <View style={styles.row2}>
            <View>
              <Text style={styles.muted}>Data source</Text>
              <Text>fatty.json (local)</Text>
            </View>
            <View>
              <Text style={styles.muted}>Load status</Text>
              <Text>{loading ? "Loading…" : error ? "Error" : "Loaded"}</Text>
            </View>
          </View>

          <View style={{ marginTop: 10 }}>
            <Text style={styles.muted}>Choose Home</Text>
            <View style={styles.radioRow}>
              <TouchableOpacity
                style={[styles.radioBtn, homeChoice === "toppan" && styles.radioBtnActive]}
                onPress={() => setHomeChoice("toppan")}
              >
                <Text style={[styles.radioText, homeChoice === "toppan" && styles.radioTextActive]}>
                  Toppan Home
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.radioBtn, homeChoice === "ica" && styles.radioBtnActive]}
                onPress={() => setHomeChoice("ica")}
              >
                <Text style={[styles.radioText, homeChoice === "ica" && styles.radioTextActive]}>
                  ICA Home
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginTop: 10 }}>
            <Text style={styles.muted}>{homeLabel} coordinate</Text>
            <Text style={styles.coords}>
              {homeCoord
                ? `(${homeCoord.latitude.toFixed(6)}, ${homeCoord.longitude.toFixed(6)})`
                : "N/A (Check toppanHome/icaHome[0].latLong)"}
            </Text>
          </View>

          <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.muted}>Now: </Text>
            <Text style={styles.pill}>{`${nowDay} ${nowTime}`}</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onPick}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Pick a random OPEN stall</Text>
          </TouchableOpacity>
        </View>

        {selectedStall && (
          <View style={styles.card}>
            <Text style={styles.title}>Selected Stall</Text>
            <Text style={styles.strong}>{selectedStall.name || "Unnamed"}</Text>

            <Text style={styles.coords}>
              {parseLatLong(selectedStall.latLong)
                ? `(${parseLatLong(selectedStall.latLong)!.latitude.toFixed(6)}, ${parseLatLong(selectedStall.latLong)!.longitude.toFixed(6)})`
                : "Coordinates: N/A"}
            </Text>

            <Text style={{ marginTop: 6 }}>
              Distance from {homeLabel}: {distanceKm != null ? `${distanceKm} km` : "N/A"}
            </Text>

            <Text style={styles.muted}>
              {selectedStall.openTime
                ? `Hours: ${selectedStall.openTime.open}–${selectedStall.openTime.close}`
                : "Hours: N/A"}
            </Text>

            <Text style={styles.muted}>
              Days: {Array.isArray(selectedStall.openDay) ? selectedStall.openDay.join(", ") : "N/A"}
            </Text>

            {mapsUrl && (
              <TouchableOpacity style={styles.linkBtn} onPress={openMaps}>
                <Text style={styles.linkText}>Open in Google Maps (Walking)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {error && (
          <View style={[styles.card, styles.error]}>
            <Text style={{ fontWeight: "700" }}>Error</Text>
            <Text>{error}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** ---------------- styles ---------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f7f9" },
  wrap: { padding: 16, gap: 14 },
  h1: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 2,
    gap: 10,
  },
  row2: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  muted: { color: "#666" },
  coords: {
    fontFamily:
      Platform.OS === "ios" ? "Menlo" : Platform.OS === "android" ? "monospace" : "Courier",
  },
  pill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#eef",
    color: "#113",
    fontSize: 13,
    overflow: "hidden",
  },
  button: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600" },
  title: { fontWeight: "700", fontSize: 16, marginBottom: 2 },
  strong: { fontWeight: "700", fontSize: 16 },
  radioRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  radioBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  radioBtnActive: { backgroundColor: "#111" },
  radioText: { color: "#111", fontWeight: "600" },
  radioTextActive: { color: "#fff" },
  linkBtn: { marginTop: 10 },
  linkText: { color: "#0b6bcb", textDecorationLine: "underline", fontWeight: "600" },
  error: { borderWidth: 1, borderColor: "#f3c2c2", backgroundColor: "#fff6f6" },
});