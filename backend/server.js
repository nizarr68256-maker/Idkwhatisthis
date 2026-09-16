require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenAI } = require("@google/genai");

const app = express();

// Render akan memberikan PORT sendiri.
// Saat lokal, gunakan 3000.
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// Izinkan frontend mengirim request ke backend
app.use(cors());

app.use(express.json());

// Test endpoint
app.get("/", (req, res) => {
  res.send("Lynuxs Backend + Gemini aktif!");
});

// Gemini Chat
app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body.message;

    if (!message) {
      return res.status(400).json({
        error: "Message tidak boleh kosong."
      });
    }

    const interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: message
    });

    res.json({
      reply: interaction.output_text
    });

  } catch (error) {
    console.error("Gemini error:", error);

    res.status(500).json({
      error: "Gagal menghubungi Gemini."
    });
  }
});

// Jalankan server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server berjalan di port ${PORT}`);
});
