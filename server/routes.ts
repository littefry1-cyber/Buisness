import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
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

      const historyContext = eventHistory && eventHistory.length > 0
        ? `\nPrevious events:\n${eventHistory.slice(-5).map((e: any) => `- ${e.description} (stock ${e.stockChange > 0 ? '+' : ''}${e.stockChange.toFixed(1)}%)`).join('\n')}`
        : '';

      const prompt = `You are a realistic financial market simulator. Analyze this business event and return ONLY a valid JSON object with no extra text.

Company: ${companyName}
Sector: ${sector}
Current Stock Price: $${currentStockPrice.toFixed(2)}
Annual Revenue: $${(currentRevenue / 1_000_000).toFixed(1)}M
Employees: ${currentEmployees}${historyContext}

Event: "${event}"

Return this exact JSON structure:
{
  "stockChangePercent": <number between -25 and 25>,
  "revenueChangePercent": <number between -15 and 15>,
  "employeeChange": <integer>,
  "sentiment": <"very_positive"|"positive"|"neutral"|"negative"|"very_negative">,
  "headline": <string max 80 chars>,
  "summary": <string 2-3 sentences>,
  "analystRating": <"Strong Buy"|"Buy"|"Hold"|"Sell"|"Strong Sell">,
  "analystNote": <string 1-2 sentences>,
  "marketReaction": <string one sentence>
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: "You are a financial market simulator. Always respond with valid JSON only, no markdown, no explanation.",
          },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 600,
      });

      const raw = completion.choices[0]?.message?.content ?? "{}";
      console.log("AI raw response:", raw.slice(0, 200));

      // Strip any markdown fences
      const cleaned = raw
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();

      let result: Record<string, unknown> = {};
      try {
        result = JSON.parse(cleaned);
      } catch (parseErr) {
        // Extract JSON from the text if possible
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          result = JSON.parse(match[0]);
        } else {
          throw new Error("Could not parse JSON from AI response");
        }
      }

      // Ensure defaults so the client never gets an empty object
      const safeResult = {
        stockChangePercent: Number(result.stockChangePercent) || 0,
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
      res.status(500).json({ error: "Failed to process event" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
