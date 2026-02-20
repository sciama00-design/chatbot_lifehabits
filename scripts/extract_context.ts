/**
 * Script di estrazione multimodale del PDF "Manuale LC Nutrition"
 * Usa Gemini per analizzare testo + immagini e generare un context.md completo
 */
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

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

const EXTRACTION_PROMPT = `Sei un esperto analista di documenti nutrizionali. Analizza questo manuale di nutrizione ("Manuale LC Nutrition") in modo ESTREMAMENTE dettagliato e completo.

Il tuo compito è creare un documento di riferimento completo che catturi OGNI informazione presente nel PDF, incluse le informazioni visive.

## Istruzioni specifiche:

### Per il TESTO:
- Estrai TUTTO il testo fedelmente, senza omettere nulla
- Mantieni la struttura originale del documento (capitoli, sezioni, sottosezioni)
- Preserva tutti i dati numerici: calorie, grammi, percentuali, porzioni
- Mantieni elenchi puntati/numerati esattamente come sono
- Includi note a piè di pagina, avvertenze, disclaimer

### Per le TABELLE:
- Riproducile FEDELMENTE in formato markdown
- Includi tutte le righe e colonne senza eccezioni
- Mantieni le unità di misura

### Per le IMMAGINI e GRAFICI:
- Descrivi ogni immagine in dettaglio
- Per i grafici: descrivi assi, valori, trend, legenda
- Per le piramidi alimentari: descrivi ogni livello con i relativi alimenti
- Per le foto di piatti/alimenti: descrivi cosa contengono
- Per gli schemi/diagrammi: descrivi ogni componente e le relazioni

### Per le FORMULE e CALCOLI:
- Riporta ogni formula esattamente
- Includi esempi di calcolo se presenti

## Formato output:
Scrivi in Markdown ben strutturato con:
- Titoli gerarchici (# ## ### ####)
- Tabelle markdown per i dati tabulari
- **Grassetto** per concetti chiave
- Elenchi puntati per le liste
- Blocchi citazione per note importanti

IMPORTANTE: Non riassumere, non sintetizzare, non omettere. Il tuo output deve contenere il 100% delle informazioni presenti nel documento originale, sia testuali che visive.`;

async function extractContext() {
    const pdfPath = path.resolve(process.cwd(), "Manuale LC Nutrition.pdf");

    if (!fs.existsSync(pdfPath)) {
        console.error(`❌ PDF non trovato: ${pdfPath}`);
        process.exit(1);
    }

    console.log("📄 Caricamento PDF...");
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString("base64");
    console.log(`   Dimensione file: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log("🤖 Invio a Gemini per analisi multimodale...");
    console.log("   (Questo potrebbe richiedere qualche minuto per un PDF lungo)");

    try {
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: "application/pdf",
                    data: pdfBase64,
                },
            },
            { text: EXTRACTION_PROMPT },
        ]);

        const responseText = result.response.text();

        if (!responseText || responseText.length < 100) {
            console.error("❌ Risposta troppo corta. Possibile errore nell'analisi.");
            console.log("Risposta:", responseText);
            process.exit(1);
        }

        // Salva il contesto estratto
        const outputPath = path.resolve(process.cwd(), "context.md");
        fs.writeFileSync(outputPath, responseText, "utf-8");

        console.log(`\n✅ Estrazione completata!`);
        console.log(`   📝 File salvato: ${outputPath}`);
        console.log(`   📊 Dimensione contesto: ${(responseText.length / 1024).toFixed(1)} KB`);
        console.log(`   📊 Caratteri totali: ${responseText.length.toLocaleString()}`);

        // Mostra un'anteprima
        console.log("\n--- Anteprima (prime 500 caratteri) ---");
        console.log(responseText.substring(0, 500));
        console.log("...\n");

    } catch (error: any) {
        console.error("❌ Errore durante l'analisi:", error.message);

        if (error.message?.includes("too large")) {
            console.log("\n💡 Il PDF potrebbe essere troppo grande per un'unica richiesta.");
            console.log("   Proverò un approccio a sezioni...");
        }
        process.exit(1);
    }
}

extractContext().catch(console.error);
