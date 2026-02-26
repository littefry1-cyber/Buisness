import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useCompany, EventRecord } from "@/context/CompanyContext";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 58;

const SENTIMENT_CONFIG: Record<string, { color: string }> = {
  very_positive: { color: Colors.accent },
  positive: { color: "#4CAF7D" },
  neutral: { color: Colors.textSecondary },
  negative: { color: Colors.warning },
  very_negative: { color: Colors.danger },
};

const RATING_COLORS: Record<string, string> = {
  "Strong Buy": Colors.accent,
  "Buy": "#4CAF7D",
  "Hold": Colors.warning,
  "Sell": "#FF7043",
  "Strong Sell": Colors.danger,
};

function EventCard({ item }: { item: EventRecord }) {
  const [expanded, setExpanded] = useState(false);
  const sentiment = SENTIMENT_CONFIG[item.sentiment] || SENTIMENT_CONFIG.neutral;
  const ratingColor = RATING_COLORS[item.analystRating] || Colors.textSecondary;
  const isUp = item.stockChange >= 0;
  const date = new Date(item.timestamp);
  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <Pressable onPress={() => setExpanded((v) => !v)} style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <View style={[styles.sentimentDot, { backgroundColor: sentiment.color }]} />
        <View style={styles.eventMeta}>
          <Text style={styles.eventDate}>{dateStr} {timeStr}</Text>
          {item.isAuto && (
            <View style={styles.autoBadge}>
              <Ionicons name="flash" size={10} color={Colors.warning} />
              <Text style={styles.autoText}>Auto</Text>
            </View>
          )}
          <View style={[styles.ratingBadge, { backgroundColor: `${ratingColor}22` }]}>
            <Text style={[styles.ratingText, { color: ratingColor }]}>{item.analystRating}</Text>
          </View>
        </View>
        <View style={[styles.stockChangeBadge, { backgroundColor: isUp ? "rgba(0,212,161,0.1)" : "rgba(255,71,87,0.1)" }]}>
          <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={11} color={isUp ? Colors.accent : Colors.danger} />
          <Text style={[styles.stockChangeText, { color: isUp ? Colors.accent : Colors.danger }]}>
            {Math.abs(item.stockChange).toFixed(2)}%
          </Text>
        </View>
      </View>

      <Text style={styles.eventHeadline}>{item.headline}</Text>
      <Text style={styles.eventDescription} numberOfLines={expanded ? undefined : 2}>
        {item.description}
      </Text>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.impactRow}>
            <View style={styles.impactItem}>
              <Text style={styles.impactLabel}>Stock</Text>
              <Text style={[styles.impactValue, { color: isUp ? Colors.accent : Colors.danger }]}>
                {isUp ? "+" : ""}{item.stockChange.toFixed(2)}%
              </Text>
            </View>
            <View style={styles.impactDivider} />
            <View style={styles.impactItem}>
              <Text style={styles.impactLabel}>Revenue</Text>
              <Text style={[styles.impactValue, { color: item.revenueChangePercent >= 0 ? Colors.accent : Colors.danger }]}>
                {item.revenueChangePercent >= 0 ? "+" : ""}{item.revenueChangePercent.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.impactDivider} />
            <View style={styles.impactItem}>
              <Text style={styles.impactLabel}>Staff</Text>
              <Text style={[styles.impactValue, { color: item.employeeChange >= 0 ? Colors.accent : Colors.danger }]}>
                {item.employeeChange >= 0 ? "+" : ""}{item.employeeChange}
              </Text>
            </View>
          </View>
          {item.summary ? <Text style={styles.summaryText}>{item.summary}</Text> : null}
          {item.analystNote ? (
            <View style={styles.analystBox}>
              <Text style={styles.analystLabel}>Analyst Note</Text>
              <Text style={styles.analystNote}>{item.analystNote}</Text>
            </View>
          ) : null}
          {item.marketReaction ? (
            <Text style={styles.marketReaction}>{item.marketReaction}</Text>
          ) : null}
        </View>
      )}

      <View style={styles.chevronRow}>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={Colors.textMuted} />
      </View>
    </Pressable>
  );
}

const SUGGESTIONS = [
  "Major product launch exceeded expectations",
  "CEO resigned due to controversy",
  "Record quarterly earnings announced",
  "Factory accident caused production halt",
  "Won a landmark government contract",
  "Viral PR scandal on social media",
];

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { eventHistory, isProcessing, isAutoProcessing, submitEvent, autoEventsEnabled, setAutoEventsEnabled } = useCompany();
  const [input, setInput] = useState("");
  const inputRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  // Extra space for tab bar since it's absolutely positioned
  const tabOffset = TAB_BAR_HEIGHT + bottomPad;

  const handleSubmit = async () => {
    const trimmed = input.trim();
    // Only block on user event processing — auto events run independently
    if (!trimmed || isProcessing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setInput("");
    Keyboard.dismiss();
    await submitEvent(trimmed);
  };

  const handleSuggestion = (s: string) => {
    setInput(s);
    inputRef.current?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={TAB_BAR_HEIGHT + (Platform.OS === "ios" ? insets.bottom : 0)}
    >
      <View style={[styles.titleBar, { paddingTop: topPad + 12 }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.screenTitle}>Event Feed</Text>
            <Text style={styles.screenSub}>{eventHistory.length} events recorded</Text>
          </View>
          <View style={styles.autoRow}>
            <Ionicons name="flash" size={14} color={autoEventsEnabled ? Colors.warning : Colors.textMuted} />
            <Text style={[styles.autoLabel, { color: autoEventsEnabled ? Colors.warning : Colors.textMuted }]}>
              Auto
            </Text>
            <Switch
              value={autoEventsEnabled}
              onValueChange={setAutoEventsEnabled}
              trackColor={{ false: Colors.border, true: `${Colors.warning}66` }}
              thumbColor={autoEventsEnabled ? Colors.warning : Colors.textMuted}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        </View>
      </View>

      <FlatList
        data={eventHistory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EventCard item={item} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabOffset + 80 }]}
        scrollEnabled
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="flash-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptyText}>
              Type below or wait for an auto-event to hit your company.
            </Text>
            <Text style={styles.emptyHint}>Try one of these:</Text>
            <View style={styles.suggestionGrid}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => handleSuggestion(s)} style={styles.suggestionChip}>
                  <Text style={styles.suggestionText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      {eventHistory.length > 0 && !isProcessing && (
        <View style={styles.suggestionsWrap}>
          <FlatList
            horizontal
            data={SUGGESTIONS.slice(0, 4)}
            keyExtractor={(s) => s}
            renderItem={({ item: s }) => (
              <Pressable onPress={() => handleSuggestion(s)} style={styles.miniChip}>
                <Text style={styles.miniChipText} numberOfLines={1}>{s}</Text>
              </Pressable>
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          />
        </View>
      )}

      <View style={[styles.inputBar, { paddingBottom: tabOffset }]}>
        {(isProcessing || isAutoProcessing) && (
          <View style={styles.processingRow}>
            <ActivityIndicator size="small" color={isProcessing ? Colors.accent : Colors.warning} />
            <Text style={[styles.processingText, { color: isProcessing ? Colors.accent : Colors.warning }]}>
              {isProcessing ? "Analyzing your event..." : "Auto-event in progress..."}
            </Text>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Something happens to your company..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={300}
            editable={!isProcessing}
          />
          <Pressable
            onPress={handleSubmit}
            disabled={!input.trim() || isProcessing}
            style={[styles.sendBtn, (!input.trim() || isProcessing) && styles.sendBtnDisabled]}
            testID="send-event-btn"
          >
            <Ionicons name="arrow-up" size={20} color={Colors.dark.background} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  titleBar: { paddingHorizontal: 16, paddingBottom: 10 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  screenTitle: { fontSize: 28, fontWeight: "800", color: Colors.dark.text, letterSpacing: -0.5 },
  screenSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  autoRow: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.surface, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: Colors.border },
  autoLabel: { fontSize: 12, fontWeight: "700" },
  listContent: { paddingHorizontal: 16 },
  eventCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sentimentDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  eventMeta: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  eventDate: { fontSize: 11, color: Colors.textMuted },
  autoBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: `${Colors.warning}22`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  autoText: { fontSize: 10, color: Colors.warning, fontWeight: "700" },
  ratingBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  ratingText: { fontSize: 11, fontWeight: "700" },
  stockChangeBadge: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  stockChangeText: { fontSize: 12, fontWeight: "700" },
  eventHeadline: { fontSize: 15, fontWeight: "700", color: Colors.dark.text, marginBottom: 4, lineHeight: 21 },
  eventDescription: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  expandedContent: { marginTop: 12 },
  impactRow: { flexDirection: "row", backgroundColor: Colors.surfaceAlt, borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  impactItem: { flex: 1, alignItems: "center", paddingVertical: 10 },
  impactLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: "600", textTransform: "uppercase", marginBottom: 2 },
  impactValue: { fontSize: 16, fontWeight: "700" },
  impactDivider: { width: 1, backgroundColor: Colors.border },
  summaryText: { fontSize: 13, color: Colors.dark.text, lineHeight: 20, marginBottom: 10 },
  analystBox: { backgroundColor: Colors.surfaceAlt, borderRadius: 10, padding: 12, marginBottom: 8 },
  analystLabel: { fontSize: 10, fontWeight: "700", color: Colors.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  analystNote: { fontSize: 13, color: Colors.dark.text, lineHeight: 19 },
  marketReaction: { fontSize: 12, color: Colors.textSecondary, fontStyle: "italic" },
  chevronRow: { alignItems: "center", marginTop: 8 },
  emptyState: { alignItems: "center", paddingTop: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: Colors.dark.text, marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center", lineHeight: 21, marginBottom: 24 },
  emptyHint: { fontSize: 12, color: Colors.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  suggestionGrid: { gap: 8, width: "100%" },
  suggestionChip: { backgroundColor: Colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: Colors.border },
  suggestionText: { fontSize: 13, color: Colors.dark.text },
  suggestionsWrap: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  miniChip: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.border },
  miniChipText: { fontSize: 12, color: Colors.textSecondary, maxWidth: 160 },
  inputBar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  processingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  processingText: { fontSize: 13, color: Colors.accent },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    color: Colors.dark.text,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    backgroundColor: Colors.accent,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
});
