import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const PORT = process.env.PORT || 5174;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://inf-293-24g-m293user20.iet-gibb.net",
      "https://gamebase-frontend.vercel.app",
    ],
  })
);
app.use(express.json());

let accessToken = null;

// 🔑 Token von Twitch holen
async function fetchAppToken() {
  console.log("🔑 Hole neuen App Access Token von Twitch...");
  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error("❌ Fehler beim Abrufen des Tokens:", data);
    throw new Error("Kein Token erhalten");
  }

  accessToken = data.access_token;
  console.log("✅ Neuer IGDB Token geholt");
  return accessToken;
}

// 🧠 Proxy-Endpunkt für IGDB
app.post("/api/games", express.text(), async (req, res) => {
  try {
    if (!accessToken) {
      await fetchAppToken();
    }

    const igdbResponse = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "text/plain",
      },
      body: req.body, // <- dein IGDB Query kommt hier rein
    });

    // Token abgelaufen? -> Retry
    if (igdbResponse.status === 401) {
      console.log("⚠️ Token abgelaufen, hole neuen...");
      await fetchAppToken();

      const retryResponse = await fetch("https://api.igdb.com/v4/games", {
        method: "POST",
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "text/plain",
        },
        body: req.body,
      });

      const retryData = await retryResponse.json();
      return res.json(retryData);
    }

    const data = await igdbResponse.json();
    res.json(data);
  } catch (err) {
    console.error("Proxy Fehler:", err);
    res.status(500).json({ error: "Interner Proxy-Fehler", details: err.message });
  }
});

app.get("/api/profile", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Kein Token angegeben" });
    }

    const token = authHeader.split(" ")[1];

    const response = await fetch("https://api.twitch.tv/helix/users", {
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || "Fehler beim Abrufen des Profils" });
    }

    res.json(data.data[0]); // Twitch gibt ein Array mit 1 Objekt zurück
  } catch (err) {
    console.error("Fehler beim Laden des Profils:", err);
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});





// 🚀 Server starten
app.listen(PORT, () => {
  console.log(`🚀 Proxy läuft auf http://localhost:${PORT}`);
});