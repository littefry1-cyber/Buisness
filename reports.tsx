import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useCompany, EventRecord } from "@/context/CompanyContext";

function formatCurrency(n: number): string {
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

const RATING_COLORS: Record<string, string> = {
  "Strong Buy": Colors.accent,
  "Buy": "#4CAF7D",
  "Hold": Colors.warning,
  "Sell": "#FF7043",
  "Strong Sell": Colors.danger,
};

const RATING_ICONS: Record<string, string> = {
  "Strong Buy": "trending-up",
  "Buy": "arrow-up",
  "Hold": "remove",
  "Sell": "arrow-down",
  "Strong Sell": "trending-down",
};

function AnalystCard({ event }: { event: EventRecord }) {
  const ratingColor = RATING_COLORS[event.analystRating] || Colors.textSecondary;
  const iconName = (RATING_ICONS[event.analystRating] || "remove") as any;
  const isUp = event.stockChange >= 0;
  const date = new Date(event.timestamp);

  return (
    <View style={styles.analystCard}>
      <View style={styles.analystHeader}>
        <View style={[styles.ratingCircle, { backgroundColor: `${ratingColor}20`, borderColor: `${ratingColor}40` }]}>
          <Ionicons name={iconName} size={18} color={ratingColor} />
        </View>
        <View style={styles.analystMeta}>
          <Text style={[styles.analystRating, { color: ratingColor }]}>{event.analystRating}</Text>
          <Text style={styles.analystDate}>
            {date.toLocaleDateString([], { month: "short", day: "numeric" })}
          </Text>
        </View>
        <View style={[styles.priceChange, { backgroundColor: isUp ? "rgba(0,212,161,0.1)" : "rgba(255,71,87,0.1)" }]}>
          <Text style={[styles.priceChangeText, { color: isUp ? Colors.accent : Colors.danger }]}>
            {isUp ? "+" : ""}{event.stockChange.toFixed(2)}%
          </Text>
        </View>
      </View>
      <Text style={styles.analystHeadline}>{event.headline}</Text>
      <Text style={styles.analystNoteText}>{event.analystNote}</Text>
    </View>
  );
}

function FinancialRow({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean | null }) {
  return (
    <View style={styles.finRow}>
      <View style={styles.finLabelWrap}>
        <Text style={styles.finLabel}>{label}</Text>
        {sub ? <Text style={styles.finSub}>{sub}</Text> : null}
      </View>
      <Text style={[
        styles.finValue,
        positive === true ? { color: Colors.accent } : positive === false ? { color: Colors.danger } : {},
      ]}>
        {value}
      </Text>
    </View>
  );
}

function BarChart({ label, value, maxValue, color }: { label: string; value: number; maxValue: number; color: string }) {
  const pct = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { company, eventHistory, stockHistory } = useCompany();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const analytics = useMemo(() => {
    if (eventHistory.length === 0) return null;
    const gains = eventHistory.filter((e) => e.stockChange > 0);
    const losses = eventHistory.filter((e) => e.stockChange < 0);
    const avgChange = eventHistory.reduce((s, e) => s + e.stockChange, 0) / eventHistory.length;
    const bestEvent = eventHistory.reduce((best, e) => (e.stockChange > best.stockChange ? e : best), eventHistory[0]);
    const worstEvent = eventHistory.reduce((worst, e) => (e.stockChange < worst.stockChange ? e : worst), eventHistory[0]);
    const ratingCounts: Record<string, number> = {};
    eventHistory.forEach((e) => { ratingCounts[e.analystRating] = (ratingCounts[e.analystRating] || 0) + 1; });
    const latestRating = eventHistory[0]?.analystRating || "Hold";

    const priceStart = stockHistory.length > 0 ? stockHistory[0].price : company.stockPrice;
    const totalReturn = ((company.stockPrice - priceStart) / priceStart) * 100;

    return { gains: gains.length, losses: losses.length, avgChange, bestEvent, worstEvent, ratingCounts, latestRating, totalReturn };
  }, [eventHistory, company.stockPrice, stockHistory]);

  const ebitda = company.revenue * 0.18;
  const netIncome = company.revenue * 0.11;
  const grossProfit = company.revenue * 0.42;
  const operatingExpenses = company.revenue * 0.31;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Financial Reports</Text>
      <Text style={styles.screenSub}>{company.name} · {company.sector}</Text>

      {analytics ? (
        <>
          <LinearGradient colors={["#0A1E35", "#081628"]} style={styles.performanceCard}>
            <Text style={styles.perfTitle}>Overall Performance</Text>
            <View style={styles.perfRow}>
              <View style={styles.perfItem}>
                <Text style={[styles.perfValue, { color: analytics.totalReturn >= 0 ? Colors.accent : Colors.danger }]}>
                  {analytics.totalReturn >= 0 ? "+" : ""}{analytics.totalReturn.toFixed(1)}%
                </Text>
                <Text style={styles.perfLabel}>Total Return</Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfItem}>
                <Text style={[styles.perfValue, { color: analytics.avgChange >= 0 ? Colors.accent : Colors.danger }]}>
                  {analytics.avgChange >= 0 ? "+" : ""}{analytics.avgChange.toFixed(2)}%
                </Text>
                <Text style={styles.perfLabel}>Avg per Event</Text>
              </View>
              <View style={styles.perfDivider} />
              <View style={styles.perfItem}>
                <Text style={styles.perfValue}>{eventHistory.length}</Text>
                <Text style={styles.perfLabel}>Events</Text>
              </View>
            </View>
            <View style={styles.winLossRow}>
              <View style={styles.winItem}>
                <Ionicons name="arrow-up-circle" size={16} color={Colors.accent} />
                <Text style={[styles.winText, { color: Colors.accent }]}>{analytics.gains} gains</Text>
              </View>
              <View style={styles.winItem}>
                <Ionicons name="arrow-down-circle" size={16} color={Colors.danger} />
                <Text style={[styles.winText, { color: Colors.danger }]}>{analytics.losses} losses</Text>
              </View>
            </View>
          </LinearGradient>

          <Text style={styles.sectionTitle}>Analyst Rating Distribution</Text>
          <View style={styles.card}>
            {["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"].map((rating) => {
              const count = analytics.ratingCounts[rating] || 0;
              return count > 0 ? (
                <BarChart
                  key={rating}
                  label={rating}
                  value={count}
                  maxValue={eventHistory.length}
                  color={RATING_COLORS[rating]}
                />
              ) : null;
            })}
            <View style={styles.currentRatingRow}>
              <Text style={styles.currentRatingLabel}>Current Rating:</Text>
              <Text style={[styles.currentRatingValue, { color: RATING_COLORS[analytics.latestRating] }]}>
                {analytics.latestRating}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Notable Events</Text>
          <View style={styles.notableCard}>
            <View style={styles.notableSection}>
              <View style={styles.notableHeader}>
                <Ionicons name="trophy" size={14} color={Colors.accent} />
                <Text style={[styles.notableTitle, { color: Colors.accent }]}>Best Event</Text>
              </View>
              <Text style={styles.notableHeadline}>{analytics.bestEvent.headline}</Text>
              <Text style={[styles.notableChange, { color: Colors.accent }]}>
                +{analytics.bestEvent.stockChange.toFixed(2)}%
              </Text>
            </View>
            <View style={styles.notableDivider} />
            <View style={styles.notableSection}>
              <View style={styles.notableHeader}>
                <Ionicons name="warning" size={14} color={Colors.danger} />
                <Text style={[styles.notableTitle, { color: Colors.danger }]}>Worst Event</Text>
              </View>
              <Text style={styles.notableHeadline}>{analytics.worstEvent.headline}</Text>
              <Text style={[styles.notableChange, { color: Colors.danger }]}>
                {analytics.worstEvent.stockChange.toFixed(2)}%
              </Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.noDataCard}>
          <Ionicons name="bar-chart-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.noDataTitle}>No data yet</Text>
          <Text style={styles.noDataText}>Submit events in the Events tab to generate your financial report.</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Income Statement</Text>
      <View style={styles.card}>
        <FinancialRow label="Revenue" value={formatCurrency(company.revenue)} sub="Annual" />
        <View style={styles.rowDivider} />
        <FinancialRow label="Gross Profit" value={formatCurrency(grossProfit)} sub={`${42}% margin`} positive={true} />
        <View style={styles.rowDivider} />
        <FinancialRow label="Operating Expenses" value={formatCurrency(operatingExpenses)} positive={false} />
        <View style={styles.rowDivider} />
        <FinancialRow label="EBITDA" value={formatCurrency(ebitda)} sub={`${18}% margin`} positive={true} />
        <View style={styles.rowDivider} />
        <FinancialRow label="Net Income" value={formatCurrency(netIncome)} sub={`${11}% margin`} positive={true} />
      </View>

      <Text style={styles.sectionTitle}>Balance Sheet</Text>
      <View style={styles.card}>
        <FinancialRow label="Cash & Equivalents" value={formatCurrency(company.cash)} positive={true} />
        <View style={styles.rowDivider} />
        <FinancialRow label="Total Assets" value={formatCurrency(company.marketCap * 0.6)} />
        <View style={styles.rowDivider} />
        <FinancialRow label="Total Debt" value={formatCurrency(company.debt)} positive={false} />
        <View style={styles.rowDivider} />
        <FinancialRow label="Debt/Equity" value={`${(company.debt / Math.max(company.marketCap * 0.4, 1)).toFixed(2)}x`} />
        <View style={styles.rowDivider} />
        <FinancialRow label="Market Cap" value={formatCurrency(company.marketCap)} />
      </View>

      <Text style={styles.sectionTitle}>Analyst Reviews</Text>
      {eventHistory.length === 0 ? (
        <View style={styles.noDataCard}>
          <Text style={styles.noDataText}>Submit events to see analyst reviews.</Text>
        </View>
      ) : (
        eventHistory.slice(0, 10).map((event) => (
          <AnalystCard key={event.id} event={event} />
        ))
      )}

      <View style={{ height: Platform.OS === "web" ? 100 : 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { paddingHorizontal: 16 },
  screenTitle: { fontSize: 28, fontWeight: "800", color: Colors.dark.text, letterSpacing: -0.5 },
  screenSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2, marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10, marginTop: 20 },
  performanceCard: { borderRadius: 20, padding: 20, marginBottom: 4, borderWidth: 1, borderColor: Colors.border },
  perfTitle: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 },
  perfRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  perfItem: { flex: 1, alignItems: "center" },
  perfValue: { fontSize: 22, fontWeight: "800", color: Colors.dark.text, letterSpacing: -0.5 },
  perfLabel: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  perfDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  winLossRow: { flexDirection: "row", gap: 16 },
  winItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  winText: { fontSize: 13, fontWeight: "600" },
  card: { backgroundColor: Colors.surface, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  finRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  finLabelWrap: {},
  finLabel: { fontSize: 14, color: Colors.dark.text },
  finSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  finValue: { fontSize: 15, fontWeight: "700", color: Colors.dark.text },
  rowDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
  barRow: { paddingHorizontal: 16, paddingVertical: 10 },
  barLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6, fontWeight: "600" },
  barTrack: { height: 6, backgroundColor: Colors.surfaceAlt, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  currentRatingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: Colors.border },
  currentRatingLabel: { fontSize: 13, color: Colors.textSecondary },
  currentRatingValue: { fontSize: 15, fontWeight: "700" },
  notableCard: { backgroundColor: Colors.surface, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, marginBottom: 4 },
  notableSection: { padding: 16 },
  notableHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  notableTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },
  notableHeadline: { fontSize: 14, fontWeight: "600", color: Colors.dark.text, marginBottom: 4, lineHeight: 20 },
  notableChange: { fontSize: 20, fontWeight: "800" },
  notableDivider: { height: 1, backgroundColor: Colors.border },
  analystCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  analystHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  ratingCircle: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  analystMeta: { flex: 1 },
  analystRating: { fontSize: 14, fontWeight: "700" },
  analystDate: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  priceChange: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  priceChangeText: { fontSize: 13, fontWeight: "700" },
  analystHeadline: { fontSize: 14, fontWeight: "600", color: Colors.dark.text, marginBottom: 6, lineHeight: 20 },
  analystNoteText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  noDataCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, alignItems: "center", gap: 10, borderWidth: 1, borderColor: Colors.border },
  noDataTitle: { fontSize: 16, fontWeight: "700", color: Colors.dark.text },
  noDataText: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
