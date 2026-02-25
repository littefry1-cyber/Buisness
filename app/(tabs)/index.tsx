import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop } from "react-native-svg";
import Colors from "@/constants/colors";
import { useCompany } from "@/context/CompanyContext";

const CHART_WIDTH = 340;
const CHART_HEIGHT = 130;
const CHART_PAD = 12;

function StockChart() {
  const { stockHistory } = useCompany();

  const chartData = useMemo(() => {
    if (stockHistory.length < 2) return null;
    const prices = stockHistory.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const w = CHART_WIDTH - CHART_PAD * 2;
    const h = CHART_HEIGHT - CHART_PAD * 2;
    const points = prices.map((p, i) => ({
      x: CHART_PAD + (i / (prices.length - 1)) * w,
      y: CHART_PAD + h - ((p - min) / range) * h,
    }));
    const linePath = points.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ");
    const fillPath = `${linePath} L${points[points.length - 1].x},${CHART_HEIGHT} L${points[0].x},${CHART_HEIGHT} Z`;
    const isUp = prices[prices.length - 1] >= prices[0];
    return { linePath, fillPath, isUp };
  }, [stockHistory]);

  if (!chartData) {
    return <View style={styles.chartPlaceholder} />;
  }

  const color = chartData.isUp ? Colors.accent : Colors.danger;
  const fillId = chartData.isUp ? "fillUp" : "fillDown";

  return (
    <View style={styles.chartWrap}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Defs>
          <SvgGrad id={fillId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.3" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </SvgGrad>
        </Defs>
        <Path d={chartData.fillPath} fill={`url(#${fillId})`} />
        <Path d={chartData.linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function MetricCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: "up" | "down" | "neutral" }) {
  const trendColor = trend === "up" ? Colors.accent : trend === "down" ? Colors.danger : Colors.textSecondary;
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, trend ? { color: trendColor } : {}]}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { company, stockHistory, eventHistory, resetCompany } = useCompany();

  const priceChange = useMemo(() => {
    if (stockHistory.length < 2) return 0;
    const first = stockHistory[0].price;
    return ((company.stockPrice - first) / first) * 100;
  }, [stockHistory, company.stockPrice]);

  const lastEvent = eventHistory[0];

  const handleReset = () => {
    Alert.alert("Start New Company", "This will reset your company. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: resetCompany },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.companyName}>{company.name}</Text>
          <View style={styles.tickerRow}>
            <Text style={styles.ticker}>{company.ticker}</Text>
            <View style={styles.sectorBadge}>
              <Text style={styles.sectorText}>{company.sector}</Text>
            </View>
          </View>
        </View>
        <Pressable onPress={handleReset} style={styles.resetBtn} hitSlop={12}>
          <Ionicons name="refresh" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <LinearGradient
        colors={["#0F1D35", "#0A1525"]}
        style={styles.priceCard}
      >
        <View style={styles.priceRow}>
          <Text style={styles.stockPrice}>${company.stockPrice.toFixed(2)}</Text>
          <View style={[styles.changeBadge, { backgroundColor: priceChange >= 0 ? "rgba(0,212,161,0.15)" : "rgba(255,71,87,0.15)" }]}>
            <Ionicons
              name={priceChange >= 0 ? "arrow-up" : "arrow-down"}
              size={13}
              color={priceChange >= 0 ? Colors.accent : Colors.danger}
            />
            <Text style={[styles.changeText, { color: priceChange >= 0 ? Colors.accent : Colors.danger }]}>
              {Math.abs(priceChange).toFixed(2)}%
            </Text>
          </View>
        </View>
        <Text style={styles.mcText}>Market Cap {formatCurrency(company.marketCap)}</Text>
        <StockChart />
        <View style={styles.chartPeriodRow}>
          <Text style={styles.chartPeriodLabel}>All Time</Text>
        </View>
      </LinearGradient>

      {lastEvent ? (
        <View style={styles.latestEvent}>
          <Ionicons name="flash" size={14} color={Colors.warning} />
          <Text style={styles.latestEventText} numberOfLines={2}>{lastEvent.headline}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Key Metrics</Text>
      <View style={styles.metricsGrid}>
        <MetricCard
          label="Revenue"
          value={formatCurrency(company.revenue)}
          sub="Annual"
          trend={eventHistory.length > 0 ? (eventHistory[0].revenueChangePercent >= 0 ? "up" : "down") : "neutral"}
        />
        <MetricCard label="Employees" value={formatNum(company.employees)} sub="Total headcount" />
        <MetricCard label="P/E Ratio" value={company.peRatio.toFixed(1)} sub="Price-to-Earnings" />
        <MetricCard label="Div. Yield" value={`${company.dividendYield.toFixed(2)}%`} sub="Annual" />
        <MetricCard label="Cash" value={formatCurrency(company.cash)} sub="On hand" trend="up" />
        <MetricCard label="Debt" value={formatCurrency(company.debt)} sub="Total" trend="down" />
      </View>

      <Text style={styles.sectionTitle}>Company Info</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Founded</Text>
          <Text style={styles.infoValue}>{company.founded}</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sector</Text>
          <Text style={styles.infoValue}>{company.sector}</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Events Logged</Text>
          <Text style={styles.infoValue}>{eventHistory.length}</Text>
        </View>
      </View>

      <View style={{ height: Platform.OS === "web" ? 100 : 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  companyName: { fontSize: 24, fontWeight: "700", color: Colors.dark.text, letterSpacing: -0.5 },
  tickerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  ticker: { fontSize: 14, fontWeight: "700", color: Colors.accent, letterSpacing: 2 },
  sectorBadge: { backgroundColor: Colors.surfaceAlt, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  sectorText: { fontSize: 11, color: Colors.textSecondary, fontWeight: "600" },
  resetBtn: { padding: 8, backgroundColor: Colors.surface, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  priceCard: { borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  stockPrice: { fontSize: 42, fontWeight: "800", color: Colors.dark.text, letterSpacing: -1 },
  changeBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  changeText: { fontSize: 14, fontWeight: "700" },
  mcText: { fontSize: 12, color: Colors.textSecondary, marginBottom: 16 },
  chartWrap: { alignItems: "center" },
  chartPlaceholder: { height: CHART_HEIGHT, backgroundColor: Colors.surfaceAlt, borderRadius: 8 },
  chartPeriodRow: { alignItems: "flex-start", marginTop: 8 },
  chartPeriodLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: "600" },
  latestEvent: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  latestEventText: { fontSize: 13, color: Colors.dark.text, flex: 1, fontWeight: "500", lineHeight: 18 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12, marginTop: 4 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  metricCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, width: "47%", borderWidth: 1, borderColor: Colors.border },
  metricLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: "600", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  metricValue: { fontSize: 20, fontWeight: "700", color: Colors.dark.text, marginBottom: 2 },
  metricSub: { fontSize: 11, color: Colors.textMuted },
  infoCard: { backgroundColor: Colors.surface, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  infoLabel: { fontSize: 14, color: Colors.textSecondary },
  infoValue: { fontSize: 14, fontWeight: "600", color: Colors.dark.text },
  infoDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },
});
