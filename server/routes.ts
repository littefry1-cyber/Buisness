import type { Express } from "express";
import { createServer, type Server } from "node:http";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/process-event", async (req, res) => {
    try {
      const { event, companyName, sector, currentStockPrice, currentRevenue, currentEmployees, eventHistory } = req.body;

      if (!event || !companyName) {
        return res.status(400).json({ error: "Event and company name required" });
      }

      const historyContext = eventHistory && eventHistory.length > 0
        ? `\nPrevious events:\n${eventHistory.slice(-5).map((e: any) => `- ${e.description} (stock ${e.stockChange > 0 ? '+' : ''}${e.stockChange}%)`).join('\n')}`
        : '';

      const prompt = `You are a realistic financial market simulator. Analyze this business event and provide realistic market impacts.

Company: ${companyName}
Sector: ${sector}
Current Stock Price: $${currentStockPrice.toFixed(2)}
Current Annual Revenue: $${(currentRevenue / 1000000).toFixed(1)}M
Current Employees: ${currentEmployees}${historyContext}

New Event: "${event}"

Respond with a JSON object (no markdown, just raw JSON) with these exact fields:
{
  "stockChangePercent": number (positive = gain, negative = loss, range -30 to +30, realistic based on event severity),
  "revenueChangePercent": number (range -20 to +20),
  "employeeChange": number (integer, can be negative for layoffs),
  "sentiment": "very_positive" | "positive" | "neutral" | "negative" | "very_negative",
  "headline": string (short punchy news headline, max 80 chars),
  "summary": string (2-3 sentence market analysis),
  "analystRating": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
  "analystNote": string (1-2 sentence analyst commentary),
  "marketReaction": string (one sentence describing market reaction)
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 512,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const result = JSON.parse(cleaned);

      res.json(result);
    } catch (error) {
      console.error("Error processing event:", error);
      res.status(500).json({ error: "Failed to process event" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
