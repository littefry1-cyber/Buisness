import React, { createContext, useContext, useState, useMemo, ReactNode, useCallback, useEffect, useRef } from "react";
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
  isAuto?: boolean;
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
  isAutoProcessing: boolean;
  submitEvent: (event: string) => Promise<void>;
  resetCompany: () => void;
  autoEventsEnabled: boolean;
  setAutoEventsEnabled: (enabled: boolean) => void;
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

async function callProcessEvent(
  event: string,
  company: CompanyState,
  recentHistory: EventRecord[]
): Promise<Record<string, unknown>> {
  const baseUrl = getApiUrl();
  const res = await fetch(`${baseUrl}api/process-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      companyName: company.name,
      sector: company.sector,
      currentStockPrice: company.stockPrice,
      currentRevenue: company.revenue,
      currentEmployees: company.employees,
      eventHistory: recentHistory.slice(0, 5),
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return res.json();
}

function applyEventToCompany(
  prev: CompanyState,
  data: Record<string, unknown>
): CompanyState {
  const stockChangeFactor = 1 + (Number(data.stockChangePercent) || 0) / 100;
  const newPrice = Math.max(prev.stockPrice * stockChangeFactor, 0.5);
  const sharesOutstanding = prev.marketCap / prev.stockPrice;
  return {
    ...prev,
    stockPrice: newPrice,
    revenue: Math.max(prev.revenue * (1 + (Number(data.revenueChangePercent) || 0) / 100), 0),
    employees: Math.max(prev.employees + (Math.round(Number(data.employeeChange)) || 0), 0),
    marketCap: newPrice * sharesOutstanding,
    peRatio: Math.max(prev.peRatio + (Number(data.stockChangePercent) || 0) * 0.1, 1),
    cash: Math.max(prev.cash * (1 + (Number(data.revenueChangePercent) || 0) / 200), 0),
    debt: prev.debt * (1 + (Number(data.revenueChangePercent) || 0) / -400),
  };
}

function buildEventRecord(
  eventText: string,
  data: Record<string, unknown>,
  priceBefore: number,
  priceAfter: number,
  isAuto: boolean
): EventRecord {
  return {
    id: `${Date.now()}-${Math.random()}`,
    description: eventText,
    headline: String(data.headline || eventText).slice(0, 120),
    summary: String(data.summary || ""),
    stockChange: Number(data.stockChangePercent) || 0,
    revenueChangePercent: Number(data.revenueChangePercent) || 0,
    employeeChange: Math.round(Number(data.employeeChange) || 0),
    sentiment: String(data.sentiment || "neutral"),
    analystRating: String(data.analystRating || "Hold"),
    analystNote: String(data.analystNote || ""),
    marketReaction: String(data.marketReaction || ""),
    timestamp: Date.now(),
    priceBefore,
    priceAfter,
    isAuto,
  };
}

const STORAGE_KEY = "stocksim_state_v4";
const AUTO_EVENT_INTERVAL_MS = 45_000;

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<CompanyState>(() => generateInitialCompany());
  const [stockHistory, setStockHistory] = useState<StockDataPoint[]>([]);
  const [eventHistory, setEventHistory] = useState<EventRecord[]>([]);
  // Separate loading indicators: one for user events, one for auto events
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [autoEventsEnabled, setAutoEventsEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Refs for use inside callbacks/timers without stale closures
  const companyRef = useRef(company);
  const eventHistoryRef = useRef(eventHistory);
  const autoRunningRef = useRef(false); // prevents auto-event concurrency only
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  companyRef.current = company;
  eventHistoryRef.current = eventHistory;

  // Load saved state
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

  // Persist state
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ company, stockHistory, eventHistory }));
  }, [company, stockHistory, eventHistory, loaded]);

  // Core event processor — used by both user and auto events
  const processEvent = useCallback(async (eventText: string, isAuto: boolean) => {
    const currentCompany = companyRef.current;
    const currentHistory = eventHistoryRef.current;

    try {
      const data = await callProcessEvent(eventText, currentCompany, currentHistory);
      const newCompany = applyEventToCompany(currentCompany, data);
      const record = buildEventRecord(
        eventText, data, currentCompany.stockPrice, newCompany.stockPrice, isAuto
      );
      setCompany(newCompany);
      setStockHistory((prev) => [...prev, { price: newCompany.stockPrice, timestamp: Date.now() }]);
      setEventHistory((prev) => [record, ...prev]);
    } catch (e) {
      console.error("processEvent failed:", e);
      throw e;
    }
  }, []);

  // User-submitted event — always runs, independent of auto events
  const submitEvent = useCallback(async (eventText: string) => {
    setIsProcessing(true);
    try {
      await processEvent(eventText, false);
    } finally {
      setIsProcessing(false);
    }
  }, [processEvent]);

  // Auto-event timer
  useEffect(() => {
    if (!loaded || !autoEventsEnabled) return;

    const scheduleNext = () => {
      autoTimerRef.current = setTimeout(async () => {
        // Skip if auto is already running; user events can still run concurrently
        if (!autoRunningRef.current) {
          autoRunningRef.current = true;
          setIsAutoProcessing(true);
          try {
            const baseUrl = getApiUrl();
            const res = await fetch(`${baseUrl}api/random-event`);
            if (res.ok) {
              const { event } = await res.json();
              await processEvent(event, true);
            }
          } catch (e) {
            console.error("Auto-event failed:", e);
          } finally {
            autoRunningRef.current = false;
            setIsAutoProcessing(false);
          }
        }
        scheduleNext();
      }, AUTO_EVENT_INTERVAL_MS);
    };

    scheduleNext();
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [loaded, autoEventsEnabled, processEvent]);

  const resetCompany = useCallback(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    const c = generateInitialCompany();
    setCompany(c);
    setStockHistory(generateInitialHistory(c.stockPrice));
    setEventHistory([]);
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      company, stockHistory, eventHistory,
      isProcessing, isAutoProcessing,
      submitEvent, resetCompany,
      autoEventsEnabled, setAutoEventsEnabled,
    }),
    [company, stockHistory, eventHistory, isProcessing, isAutoProcessing, submitEvent, resetCompany, autoEventsEnabled]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
