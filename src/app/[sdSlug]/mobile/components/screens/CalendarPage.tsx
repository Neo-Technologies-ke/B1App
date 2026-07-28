"use client";

import React, { useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Chip, Icon, IconButton, Skeleton, Typography } from "@mui/material";
import { ApiHelper, Locale } from "@churchapps/apphelper";
import { MarkdownPreviewLight } from "@churchapps/apphelper/markdown";
import type { LinkInterface } from "@churchapps/helpers";
import UserContext from "@/context/UserContext";
import { ConfigurationInterface } from "@/helpers/ConfigHelper";
import { mobileTheme } from "../mobileTheme";
import { EventProcessor } from "../../helpers/eventProcessor";
import { useChurchLinks, filterVisibleLinks } from "../../hooks/useConfig";

interface Props {
  config: ConfigurationInterface;
}

interface EventRow {
  id?: string;
  groupId?: string;
  title?: string;
  description?: string;
  start?: string | Date;
  end?: string | Date;
  allDay?: boolean;
  visibility?: string;
  recurrenceRule?: string;
  tags?: string;
}

const describeRecurrence = (rule?: string) => {
  if (!rule) return "";
  const parts = rule.split(";").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k) acc[k.toUpperCase()] = v || "";
    return acc;
  }, {});
  const freq = parts.FREQ;
  const interval = parts.INTERVAL ? parseInt(parts.INTERVAL, 10) : 1;
  if (!freq) return Locale.label("mobile.group.repeats");
  const map: Record<string, string> = {
    DAILY: interval === 1 ? Locale.label("mobile.group.daily") : Locale.label("mobile.group.everyNDays").replace("{}", String(interval)),
    WEEKLY: interval === 1 ? Locale.label("mobile.group.weekly") : Locale.label("mobile.group.everyNWeeks").replace("{}", String(interval)),
    MONTHLY: interval === 1 ? Locale.label("mobile.group.monthly") : Locale.label("mobile.group.everyNMonths").replace("{}", String(interval)),
    YEARLY: interval === 1 ? Locale.label("mobile.group.yearly") : Locale.label("mobile.group.everyNYears").replace("{}", String(interval))
  };
  return map[freq] || Locale.label("mobile.group.repeats");
};

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const formatMonth = (d: Date) => d.toLocaleDateString(undefined, { month: "long", year: "numeric" });

const formatTimeRange = (start?: string | Date, end?: string | Date, allDay?: boolean) => {
  if (!start) return "";
  if (allDay) return Locale.label("mobile.group.allDay");
  const s = new Date(start);
  if (isNaN(s.getTime())) return "";
  const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (!end) return fmt(s);
  const e = new Date(end);
  if (isNaN(e.getTime())) return fmt(s);
  return `${fmt(s)} – ${fmt(e)}`;
};

export const CalendarPage = ({ config }: Props) => {
  const tc = mobileTheme.colors;
  const context = useContext(UserContext);
  const jwt = context?.userChurch?.jwt;
  const churchId = config?.church?.id;
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selected, setSelected] = useState<string>(isoDate(new Date()));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: rawLinks } = useChurchLinks(churchId, jwt);

  // Determine calendar scope from the tab's configuration. `linkData` stores
  // "myGroups" to scope the calendar to the signed-in member's groups;
  // anything else (including unset) defaults to the whole church calendar.
  const scope = useMemo<"church" | "myGroups">(() => {
    const links = filterVisibleLinks(rawLinks || [], context?.userChurch || null);
    const tab = links.find((l: LinkInterface) => l.linkType === "calendar");
    return tab?.linkData === "myGroups" ? "myGroups" : "church";
  }, [rawLinks, context?.userChurch]);

  const { data: fetchedEvents, isLoading } = useQuery<EventRow[]>({
    queryKey: ["calendar-events", scope, churchId],
    queryFn: async () => {
      const endpoint = scope === "myGroups" ? "/events/my" : "/events/church";
      const data = await ApiHelper.get(endpoint, "ContentApi");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!churchId && !!jwt,
    placeholderData: []
  });

  const events = useMemo(() => {
    const normalized = EventProcessor.updateTime(fetchedEvents || []);
    const expanded = EventProcessor.expandEventsForMonth(normalized, currentMonth);
    return expanded as unknown as EventRow[];
  }, [fetchedEvents, currentMonth]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    events.forEach((e) => {
      if (e.tags) {
        e.tags.split(",").map((t) => t.trim()).filter(Boolean).forEach((t) => tags.add(t));
      }
    });
    return Array.from(tags).sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (selectedTags.length === 0) return events;
    return events.filter((e) => {
      const tags = (e.tags || "").split(",").map((t) => t.trim());
      return selectedTags.some((st) => tags.includes(st));
    });
  }, [events, selectedTags]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, EventRow[]> = {};
    filteredEvents.forEach((e) => {
      if (!e.start) return;
      const d = new Date(e.start);
      if (isNaN(d.getTime())) return;
      const key = isoDate(d);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [filteredEvents]);

  const selectedEvents = eventsByDate[selected] || [];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const days: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));

  const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  const goPrev = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonth(d);
  };
  const goNext = () => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonth(d);
  };

  const toggleTag = (t: string) => {
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const pageTitle = scope === "myGroups" ? Locale.label("mobile.calendarPage.myEvents") : Locale.label("mobile.calendarPage.church");

  return (
    <Box sx={{ p: `${mobileTheme.spacing.md}px`, bgcolor: tc.background, minHeight: "100%", display: "flex", flexDirection: "column", gap: `${mobileTheme.spacing.md}px` }}>
      <Typography sx={{ fontSize: 20, fontWeight: 700, color: tc.text }}>{pageTitle}</Typography>

      {allTags.length > 0 && (
        <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 0.5 }}>
          {allTags.map((t) => (
            <Chip
              key={t}
              label={t}
              onClick={() => toggleTag(t)}
              variant={selectedTags.includes(t) ? "filled" : "outlined"}
              sx={{
                bgcolor: selectedTags.includes(t) ? tc.primaryLight : undefined,
                color: selectedTags.includes(t) ? tc.primary : tc.text,
                borderColor: tc.primary,
                fontWeight: 500
              }}
              size="small"
            />
          ))}
          {selectedTags.length > 0 && (
            <Chip label={Locale.label("mobile.group.clear")} onDelete={() => setSelectedTags([])} onClick={() => setSelectedTags([])} size="small" />
          )}
        </Box>
      )}

      <Box sx={{ bgcolor: tc.surface, borderRadius: `${mobileTheme.radius.lg}px`, boxShadow: mobileTheme.shadows.sm, p: `${mobileTheme.spacing.md}px` }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <IconButton onClick={goPrev} aria-label={Locale.label("mobile.group.previousMonth")} size="small" sx={{ color: tc.primary }}>
            <Icon>chevron_left</Icon>
          </IconButton>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: tc.text }}>{formatMonth(currentMonth)}</Typography>
          <IconButton onClick={goNext} aria-label={Locale.label("mobile.group.nextMonth")} size="small" sx={{ color: tc.primary }}>
            <Icon>chevron_right</Icon>
          </IconButton>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
          {weekdayLabels.map((w, i) => (
            <Box key={`wd-${i}`} sx={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: tc.primary, py: "4px" }}>
              {w}
            </Box>
          ))}
          {days.map((d, i) => {
            if (!d) return <Box key={`e-${i}`} />;
            const key = isoDate(d);
            const isSelected = key === selected;
            const hasEvents = !!eventsByDate[key]?.length;
            const isToday = key === isoDate(new Date());
            return (
              <Box
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(key);
                  }
                }}
                sx={{
                  position: "relative",
                  width: "100%",
                  maxWidth: 66,
                  aspectRatio: "1 / 1",
                  justifySelf: "center",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  bgcolor: isSelected ? tc.primary : "transparent",
                  color: isSelected ? tc.onPrimary : isToday ? tc.primary : tc.text,
                  fontSize: 14,
                  fontWeight: isToday || isSelected ? 700 : 500,
                  "&:hover": { bgcolor: isSelected ? tc.primary : tc.iconBackground }
                }}
              >
                {d.getDate()}
                {hasEvents && !isSelected && (
                  <Box sx={{ position: "absolute", bottom: 4, width: 4, height: 4, borderRadius: "2px", bgcolor: tc.primary }} />
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box>
        <Typography sx={{ fontSize: 16, fontWeight: 700, color: tc.text, mb: 1 }}>
          {new Date(selected + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </Typography>
        {isLoading && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {[0, 1].map((i) => (
              <Skeleton key={`es-${i}`} variant="rounded" height={60} sx={{ borderRadius: `${mobileTheme.radius.lg}px` }} />
            ))}
          </Box>
        )}
        {!isLoading && selectedEvents.length === 0 && (
          <Box sx={{ bgcolor: tc.surface, borderRadius: `${mobileTheme.radius.lg}px`, boxShadow: mobileTheme.shadows.sm, p: `${mobileTheme.spacing.md}px`, textAlign: "center" }}>
            <Typography sx={{ fontSize: 14, color: tc.textMuted }}>{Locale.label("mobile.group.noEventsToday")}</Typography>
          </Box>
        )}
        {!isLoading && selectedEvents.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: `${mobileTheme.spacing.sm}px` }}>
            {selectedEvents.map((e, i) => (
              <Box
                key={e.id || `ev-${i}`}
                sx={{
                  bgcolor: tc.surface,
                  borderRadius: `${mobileTheme.radius.lg}px`,
                  boxShadow: mobileTheme.shadows.sm,
                  p: `${mobileTheme.spacing.md}px`,
                  borderLeft: `4px solid ${tc.primary}`
                }}
              >
                <Typography sx={{ fontSize: 15, fontWeight: 600, color: tc.text }}>{e.title || Locale.label("mobile.group.event")}</Typography>
                <Typography sx={{ fontSize: 12, color: tc.textSecondary, mt: "2px" }}>{formatTimeRange(e.start, e.end, e.allDay)}</Typography>
                {(e.allDay || e.recurrenceRule) && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: "6px" }}>
                    {e.allDay && (
                      <Chip size="small" label={Locale.label("mobile.group.allDay")} sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: tc.primaryLight, color: tc.primary }} />
                    )}
                    {e.recurrenceRule && (
                      <Chip
                        size="small"
                        icon={<Icon sx={{ fontSize: 14 }}>autorenew</Icon>}
                        label={describeRecurrence(e.recurrenceRule)}
                        sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: tc.iconBackground, color: tc.text, "& .MuiChip-icon": { color: tc.primary, ml: "4px" } }}
                      />
                    )}
                  </Box>
                )}
                {e.description && <MarkdownPreviewLight value={e.description} />}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CalendarPage;
