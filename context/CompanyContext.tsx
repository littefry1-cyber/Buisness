import React, { createContext, useContext, useState, useMemo, ReactNode, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiUrl } from "@/lib/query-client";

export interface StockDataPoint {
  price: number;
  timestamp: number;
}

export interface EventRecord {
  id: string;
  description: string;
  headline: string;
  summary: string;
  stockChange: number;
  revenueChangePercent: number;
  employeeChange: number;
  sentiment: string;
  analystRating: string;
  analystNote: string;
  marketReaction: string;
  timestamp: number;
  priceBefore: number;
  priceAfter: number;
}

export interface CompanyState {
  name: string;
  ticker: string;
  sector: string;
  stockPrice: number;
  revenue: number;
  employees: number;
  founded: number;
  marketCap: number;
  peRatio: number;
  dividendYield: number;
  cash: number;
  debt: number;
}

interface CompanyContextValue {
  company: CompanyState;
  stockHistory: StockDataPoint[];
  eventHistory: EventRecord[];
  isProcessing: boolean;
  submitEvent: (event: string) => Promise<void>;
  resetCompany: () => void;
}

const INITIAL_COMPANIES = [
  { name: "Nexus Technologies", ticker: "NXTC", sector: "Technology" },
  { name: "Apex Dynamics", ticker: "APDX", sector: "Aerospace" },
  { name: "Prism Health", ticker: "PRSM", sector: "Healthcare" },
  { name: "Vertex Energy", ticker: "VRTX", sector: "Energy" },
  { name: "Orbital Finance", ticker: "ORBL", sector: "Finance" },
];

function generateInitialCompany(): CompanyState {
  const base = INITIAL_COMPANIES[Math.floor(Math.random() * INITIAL_COMPANIES.length)];
  const stockPrice = 40 + Math.random() * 160;
  const revenue = (50 + Math.random() * 450) * 1_000_000;
  const employees = Math.floor(500 + Math.random() * 9500);
  const marketCap = stockPrice * (10_000_000 + Math.random() * 90_000_000);
  return {
    ...base,
    stockPrice,
    revenue,
    employees,
    founded: 1990 + Math.floor(Math.random() * 30),
    marketCap,
    peRatio: 10 + Math.random() * 40,
    dividendYield: Math.random() * 4,
    cash: revenue * (0.1 + Math.random() * 0.3),
    debt: revenue * (0.05 + Math.random() * 0.5),
  };
}

function generateInitialHistory(startPrice: number): StockDataPoint[] {
  const points: StockDataPoint[] = [];
  const now = Date.now();
  let price = startPrice * 0.6;
  for (let i = 29; i >= 0; i--) {
    price = Math.max(price * (0.97 + Math.random() * 0.06), 1);
    points.push({ price, timestamp: now - i * 24 * 60 * 60 * 1000 });
  }
  points[points.length - 1].price = startPrice;
  return points;
}

const STORAGE_KEY = "stocksim_state_v2";

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanyState>(() => generateInitialCompany());
  const [stockHistory, setStockHistory] = useState<StockDataPoint[]>([]);
  const [eventHistory, setEventHistory] = useState<EventRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved.company) setCompany(saved.company);
          if (saved.stockHistory) setStockHistory(saved.stockHistory);
          if (saved.eventHistory) setEventHistory(saved.eventHistory);
          setLoaded(true);
          return;
        } catch {}
      }
      const c = generateInitialCompany();
      setCompany(c);
      setStockHistory(generateInitialHistory(c.stockPrice));
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ company, stockHistory, eventHistory }));
  }, [company, stockHistory, eventHistory, loaded]);

  const submitEvent = useCallback(async (eventText: string) => {
    setIsProcessing(true);
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/process-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: eventText,
          companyName: company.name,
          sector: company.sector,
          currentStockPrice: company.stockPrice,
          currentRevenue: company.revenue,
          currentEmployees: company.employees,
          eventHistory: eventHistory.slice(-5),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      const stockChangeFactor = 1 + (data.stockChangePercent || 0) / 100;
      const newPrice = Math.max(company.stockPrice * stockChangeFactor, 0.5);
      const newRevenue = Math.max(company.revenue * (1 + (data.revenueChangePercent || 0) / 100), 0);
      const newEmployees = Math.max(company.employees + (data.employeeChange || 0), 0);

      const eventRecord: EventRecord = {
        id: `${Date.now()}`,
        description: eventText,
        headline: data.headline || eventText,
        summary: data.summary || "",
        stockChange: data.stockChangePercent || 0,
        revenueChangePercent: data.revenueChangePercent || 0,
        employeeChange: data.employeeChange || 0,
        sentiment: data.sentiment || "neutral",
        analystRating: data.analystRating || "Hold",
        analystNote: data.analystNote || "",
        marketReaction: data.marketReaction || "",
        timestamp: Date.now(),
        priceBefore: company.stockPrice,
        priceAfter: newPrice,
      };

      setCompany((prev) => ({
        ...prev,
        stockPrice: newPrice,
        revenue: newRevenue,
        employees: newEmployees,
        marketCap: newPrice * (prev.marketCap / prev.stockPrice),
        peRatio: Math.max(prev.peRatio * (1 + (data.stockChangePercent || 0) / 200), 0),
      }));

      setStockHistory((prev) => [
        ...prev,
        { price: newPrice, timestamp: Date.now() },
      ]);

      setEventHistory((prev) => [eventRecord, ...prev]);
    } catch (e) {
      console.error("Event processing failed:", e);
    } finally {
      setIsProcessing(false);
    }
  }, [company, eventHistory]);

  const resetCompany = useCallback(() => {
    const c = generateInitialCompany();
    setCompany(c);
    setStockHistory(generateInitialHistory(c.stockPrice));
    setEventHistory([]);
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ company, stockHistory, eventHistory, isProcessing, submitEvent, resetCompany }),
    [company, stockHistory, eventHistory, isProcessing, submitEvent, resetCompany]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
