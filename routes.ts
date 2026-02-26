import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  console.warn("[WARNING] AI_INTEGRATIONS_OPENAI_API_KEY is not set — /api/process-event will fail.");
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "missing-key",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const AUTO_EVENTS = [
  "Competitors launched a rival product at lower price",
  "A major client renewed their contract unexpectedly",
  "Supply chain disruption hit key components",
  "The CFO announced a surprise share buyback program",
  "A whistleblower leaked internal financial documents",
  "The company received an unsolicited acquisition offer",
  "A viral social media post criticized product quality",
  "Government imposed new industry regulations",
  "Quarterly earnings beat analyst estimates by 12%",
  "A key patent was invalidated by a court ruling",
  "The company announced entry into a new international market",
  "A cyberattack compromised customer data",
  "Interest rates rose sharply, increasing debt costs",
  "A major supplier went bankrupt",
  "The company won a prestigious industry award",
];

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/random-event", (_req, res) => {
    const event = AUTO_EVENTS[Math.floor(Math.random() * AUTO_EVENTS.length)];
    res.json({ event });
  });

  app.post("/api/process-event", async (req, res) => {
    try {
      const { event, companyName, sector, currentStockPrice, currentRevenue, currentEmployees, eventHistory } = req.body;

      if (!event || !companyName) {
        return res.status(400).json({ error: "Event and company name required" });
      }

      // Parse explicit percentage mentions from the user's event text
      const percentMatch = event.match(
        /(?:go(?:es)?|rise[sd]?|increase[sd]?|up|jump[sed]?|surge[sd]?|gain[sed]?|grow[sn]?|climb[sed]?|rocket[sed]?|soar[sed]?|spike[sd]?|boost[sed]?)\s+(?:by\s+)?(\d+(?:\.\d+)?)%/i
      ) || event.match(
        /(?:drop[sped]*|fall[sn]?|decrease[sd]?|down|crash(?:es|ed)?|decline[sd]?|sink[s]?|plummet[sed]?|tank[sed]?|lose[s]?|lost|plunge[sd]?)\s+(?:by\s+)?(\d+(?:\.\d+)?)%/i
      ) || event.match(
        /(\d+(?:\.\d+)?)%\s+(?:increase|decrease|rise|drop|gain|loss|up|down|jump|crash|surge|decline)/i
      );

      const directionDown = event.match(
        /(?:drop|fall|decrease|down|crash|decline|sink|plummet|tank|lose|lost|plunge)/i
      );

      let explicitPercent: number | null = null;
      if (percentMatch) {
        const rawNum = parseFloat(percentMatch[1]);
        if (!isNaN(rawNum)) {
          explicitPercent = directionDown ? -rawNum : rawNum;
        }
      }

      const historyContext = eventHistory && eventHistory.length > 0
        ? `\nPrevious events:\n${eventHistory.slice(-5).map((e: any) => `- ${e.description} (stock ${e.stockChange > 0 ? '+' : ''}${e.stockChange.toFixed(1)}%)`).join('\n')}`
        : '';

      const explicitInstruction = explicitPercent !== null
        ? `\n\nCRITICAL: The user specified an EXACT stock change of ${explicitPercent > 0 ? '+' : ''}${explicitPercent}%. You MUST set "stockChangePercent" to EXACTLY ${explicitPercent}. Do NOT cap it, do NOT adjust it, do NOT reduce it. Use the exact number ${explicitPercent} for stockChangePercent. Scale revenueChangePercent and employeeChange proportionally to match the magnitude of this move.`
        : '';

      const prompt = `You are a financial market simulator for a business tycoon game. Analyze this business event and return ONLY a valid JSON object with no extra text.

Company: ${companyName}
Sector: ${sector}
Current Stock Price: $${currentStockPrice.toFixed(2)}
Annual Revenue: $${(currentRevenue / 1_000_000).toFixed(1)}M
Employees: ${currentEmployees}${historyContext}

Event: "${event}"${explicitInstruction}

Return this exact JSON structure:
{
  "stockChangePercent": <number — use the EXACT percentage if the user specified one, otherwise pick a realistic value>,
  "revenueChangePercent": <number — scale proportionally to the stock change>,
  "employeeChange": <integer — scale proportionally to the stock change>,
  "sentiment": <"very_positive"|"positive"|"neutral"|"negative"|"very_negative">,
  "headline": <string max 80 chars>,
  "summary": <string 2-3 sentences>,
  "analystRating": <"Strong Buy"|"Buy"|"Hold"|"Sell"|"Strong Sell">,
  "analystNote": <string 1-2 sentences>,
  "marketReaction": <string one sentence>
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          {
            role: "system",
            content: "You are a financial market simulator. Always respond with valid JSON only, no markdown, no explanation.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 600,
      });

      const msg = completion.choices[0]?.message;
      const raw = msg?.content || (msg as any)?.reasoning_content || "{}";
      console.log("AI raw response:", raw.slice(0, 200));

      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();

      let result: Record<string, unknown> = {};
      try {
        result = JSON.parse(cleaned);
      } catch (parseErr) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          result = JSON.parse(match[0]);
        } else {
          throw new Error("Could not parse JSON from AI response");
        }
      }

      const safeResult = {
        stockChangePercent: explicitPercent !== null
          ? explicitPercent
          : (Number(result.stockChangePercent) || 0),
        revenueChangePercent: Number(result.revenueChangePercent) || 0,
        employeeChange: Math.round(Number(result.employeeChange) || 0),
        sentiment: result.sentiment || "neutral",
        headline: result.headline || event.slice(0, 80),
        summary: result.summary || "Market digesting the news.",
        analystRating: result.analystRating || "Hold",
        analystNote: result.analystNote || "Monitoring developments.",
        marketReaction: result.marketReaction || "Traders watching closely.",
      };

      res.json(safeResult);
    } catch (error) {
      console.error("Error processing event:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: "Failed to process event", detail: message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
