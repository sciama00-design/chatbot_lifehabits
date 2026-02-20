/**
 * Server Chatbot Nutrizionale
 * Carica il contesto estratto dal manuale e risponde alle domande via Gemini
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) {
    console.error("❌ GOOGLE_API_KEY mancante nel file .env");
    process.exit(1);
}

// Carica il contesto estratto dal manuale
const contextPath = path.resolve(process.cwd(), "context.md");
if (!fs.existsSync(contextPath)) {
    console.error("❌ context.md non trovato! Esegui prima: npm run extract");
    process.exit(1);
}

const manualContext = fs.readFileSync(contextPath, "utf-8");
console.log(`📚 Contesto caricato: ${(manualContext.length / 1024).toFixed(1)} KB`);

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `Sei l'assistente virtuale di LifeHabits, un chatbot amichevole e professionale che aiuta i clienti con consigli alimentari e sul benessere.

## Le tue regole:
1. Rispondi basandoti ESCLUSIVAMENTE sulle conoscenze nutrizionali fornite nel contesto qui sotto. Non inventare informazioni
2. NON menzionare MAI la fonte delle tue informazioni, non citare manuali, pagine, documenti o riferimenti bibliografici. Parla come se le conoscenze fossero tue
3. Se una domanda è fuori dal tuo ambito (non riguarda nutrizione, alimentazione o benessere), rispondi gentilmente: "Questa domanda esula dalle mie competenze. Ti consiglio di parlarne direttamente con il tuo coach 😊"
4. Usa un tono amichevole, incoraggiante e professionale — come un assistente che si prende cura del cliente
5. Quando citi dati (calorie, grammi, porzioni, percentuali), sii preciso
6. Usa emoji con moderazione per rendere la conversazione più piacevole
7. Se appropriato, suggerisci al cliente di approfondire con il proprio coach
8. Rispondi in italiano
9. Formatta le risposte in modo leggibile con elenchi puntati e grassetto per i concetti chiave
10. Non elencare fonti, riferimenti, studi o link — rispondi in modo naturale e discorsivo

## Conoscenze nutrizionali:
${manualContext}`,
});

const app = new Hono();
app.use("/*", cors());

// Serve chat UI
app.get("/", (c) => {
    const htmlPath = path.resolve(process.cwd(), "public/index.html");
    const html = fs.readFileSync(htmlPath, "utf-8");
    return c.html(html);
});

// Health check
app.get("/api/health", (c) => {
    return c.json({ status: "ok", contextSize: manualContext.length });
});

// Chat endpoint
app.post("/api/chat", async (c) => {
    try {
        const { message, history } = await c.req.json();

        if (!message || typeof message !== "string") {
            return c.json({ error: "Il campo 'message' è obbligatorio" }, 400);
        }

        console.log(`📩 Domanda: "${message.substring(0, 80)}..."`);

        // Costruisci la storia della conversazione per Gemini
        const chatHistory = (history || []).map((msg: { role: string; content: string }) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
        }));

        const chat = model.startChat({ history: chatHistory });
        const result = await chat.sendMessage(message);
        const responseText = result.response.text();

        console.log(`✅ Risposta generata (${responseText.length} caratteri)`);

        return c.json({ response: responseText });
    } catch (error: any) {
        console.error("❌ Errore:", error.message);
        return c.json(
            { error: "Si è verificato un errore. Riprova tra qualche istante." },
            500
        );
    }
});

const port = Number(process.env.PORT) || 3002;
serve({ fetch: app.fetch, port }, (info) => {
    console.log(`🚀 Chatbot server in ascolto su http://localhost:${info.port}`);
    console.log(`   POST /api/chat   — invia un messaggio`);
    console.log(`   GET  /api/health — stato del server`);
});
