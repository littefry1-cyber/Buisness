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
  "The CFO announced
