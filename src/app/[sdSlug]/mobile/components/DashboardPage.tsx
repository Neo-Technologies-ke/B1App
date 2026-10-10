"use client";

import React, { useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Box, Icon, Typography } from "@mui/material";
import { type LinkInterface, type SermonInterface } from "@churchapps/helpers";
import { ApiHelper, Locale } from "@churchapps/apphelper";
import UserContext from "@/context/UserContext";
import { ConfigurationInterface } from "@/helpers/ConfigHelper";
import { mobileTheme, linkTypeToIcon, linkTypeToRoute, linkTypeToTagline, linkTypeToImage } from "./mobileTheme";
import { filterVisibleLinks, useChurchLinks } from "../hooks/useConfig";
import { useEngagementSort } from "../hooks/useEngagementSort";
import { EmptyDashboardPlaceholder } from "./EmptyDashboardPlaceholder";
import { EventProcessor } from "../helpers/eventProcessor";

interface Props {
  config: ConfigurationInterface;
}

interface EventRow {
  id?: string;
  title?: string;
  start?: string | Date;
  end?: string | Date;
  allDay?: boolean;
  recurrenceRule?: string;
}

const ENGAGEMENT_STORAGE_KEY = "b1app-link-view-counts";

const generateLinkId = (item: LinkInterface): string => item.id || `${item.linkType}_${item.text}`;

// Returns the admin-uploaded photo for this link, or null. Falling back to a
// stock B1 dashboard image makes every B1 install look identical at a distance,
// so unphotographed cards now render a themed gradient + icon instead.
const resolvePhoto = (item: LinkInterface): string | null => {
  const photo = (item as unknown as { photo?: string }).photo;
  return photo || null;
};

// Link types whose stock illustration actually matches their purpose. The
// generic fallbacks in linkTypeToImage (dash_url.png etc.) are worse than the
// themed gradient + watermark icon, so only these get the photo treatment.
const STOCK_IMAGE_TYPES = new Set(["bible", "votd", "lessons", "checkin", "donation", "directory", "groups"]);

const stockImage = (item: LinkInterface): string | null => {
  const type = (item.linkType || "").toLowerCase();
  return STOCK_IMAGE_TYPES.has(type) ? linkTypeToImage(type, item.text) : null;
};

// Distinct duotone gradient per link type so cards don't all share one muddy
// primary→secondary blend. `tint` is a soft chip background for quick actions.
const CARD_STYLES: Record<string, { gradient: string; tint: string; icon: string }> = {
  calendar:   { gradient: "linear-gradient(135deg,#5b21b6,#4f46e5)", tint: "rgba(99,102,241,0.12)",  icon: "#4f46e5" },
  bible:      { gradient: "linear-gradient(135deg,#0f766e,#14b8a6)", tint: "rgba(20,184,166,0.12)",  icon: "#0d9488" },
  votd:       { gradient: "linear-gradient(135deg,#b45309,#f59e0b)", tint: "rgba(245,158,11,0.14)",  icon: "#d97706" },
  sermons:    { gradient: "linear-gradient(135deg,#be123c,#f43f5e)", tint: "rgba(244,63,94,0.10)",   icon: "#e11d48" },
  stream:     { gradient: "linear-gradient(135deg,#991b1b,#ef4444)", tint: "rgba(239,68,68,0.10)",   icon: "#dc2626" },
  donation:   { gradient: "linear-gradient(135deg,#065f46,#10b981)", tint: "rgba(16,185,129,0.12)",  icon: "#059669" },
  groups:     { gradient: "linear-gradient(135deg,#1d4ed8,#3b82f6)", tint: "rgba(59,130,246,0.12)",  icon: "#2563eb" },
  directory:  { gradient: "linear-gradient(135deg,#6d28d9,#8b5cf6)", tint: "rgba(139,92,246,0.12)",  icon: "#7c3aed" },
  plans:      { gradient: "linear-gradient(135deg,#0369a1,#0ea5e9)", tint: "rgba(14,165,233,0.12)",  icon: "#0284c7" },
  checkin:    { gradient: "linear-gradient(135deg,#047857,#34d399)", tint: "rgba(52,211,153,0.12)",  icon: "#059669" },
  lessons:    { gradient: "linear-gradient(135deg,#92400e,#d97706)", tint: "rgba(217,119,6,0.12)",   icon: "#b45309" },
  volunteer:  { gradient: "linear-gradient(135deg,#9d174d,#ec4899)", tint: "rgba(236,72,153,0.10)",  icon: "#db2777" },
  vivaengage: { gradient: "linear-gradient(135deg,#334155,#64748b)", tint: "rgba(100,116,139,0.12)", icon: "#475569" }
};

const FALLBACK_STYLES = [
  CARD_STYLES.groups, CARD_STYLES.bible, CARD_STYLES.votd, CARD_STYLES.plans,
  CARD_STYLES.directory, CARD_STYLES.volunteer, CARD_STYLES.sermons, CARD_STYLES.vivaengage
];

const cardStyle = (item: LinkInterface, index: number) =>
  CARD_STYLES[(item.linkType || "").toLowerCase()] || FALLBACK_STYLES[index % FALLBACK_STYLES.length];

const greetingForHour = (hour: number) => {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

// Bottom scrim used over gradients/photos so labels stay readable without a
// solid colour bar chopping the card in half.
const scrim = (strong: boolean) =>
  `linear-gradient(to top, rgba(0,0,0,${strong ? 0.72 : 0.6}) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0) 100%)`;

// Quick-action ordering: the actions members use most first, the rest keep
// their engagement-based order.
const QUICK_PRIORITY = ["donation", "calendar", "sermons", "stream", "groups", "checkin", "directory"];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const fmtTime = (e: EventRow) => {
  if (!e.start) return "";
  if (e.allDay) return "all day";
  const s = new Date(e.start);
  if (isNaN(s.getTime())) return "";
  const f = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const end = e.end ? new Date(e.end) : null;
  return end && !isNaN(end.getTime()) ? `${f(s)} – ${f(end)}` : f(s);
};

export const DashboardPage = ({ config }: Props) => {
  const context = useContext(UserContext);
  const router = useRouter();
  const tc = mobileTheme.colors;
  const churchId = config?.church?.id;
  const jwt = context.userChurch?.jwt;
  const [votdImgFailed, setVotdImgFailed] = useState(false);

  const { data: rawLinks, isLoading } = useChurchLinks(churchId, jwt);

  const links = useMemo<LinkInterface[]>(() => {
    const visible = filterVisibleLinks(rawLinks, context.userChurch);
    return visible.filter((l) => l.linkType !== "separator");
  }, [rawLinks, context.userChurch]);

  const loading = isLoading && links.length === 0;

  const getLinkId = useCallback((link: LinkInterface) => generateLinkId(link), []);
  const { sorted: filtered, increment: incrementViewCount } = useEngagementSort(
    links,
    ENGAGEMENT_STORAGE_KEY,
    getLinkId
  );

  const navigate = (link: LinkInterface) => {
    incrementViewCount(generateLinkId(link));
    const route = linkTypeToRoute(link.linkType, link.linkData, link.text, link.url);
    if (!route) return;
    // Custom "url" links always open externally (new window) so iOS standalone
    // PWAs give the user a close button. Relative paths are resolved against the
    // origin first; otherwise they'd navigate in-place out of the mobile shell.
    if (link.linkType === "url" || route.startsWith("http")) {
      const target = route.startsWith("http") ? route : new URL(route, window.location.origin).toString();
      window.open(target, "_blank", "noopener,noreferrer");
    } else {
      router.push(route);
    }
  };

  const stripOf = (type: string) => filtered.find((l) => (l.linkType || "").toLowerCase() === type);
  const votdLink = stripOf("votd");
  const bibleLink = stripOf("bible");
  const calLink = stripOf("calendar");
  const sermonsLink = stripOf("sermons");

  // Upcoming events — same scope decision as the calendar tab ("myGroups" in
  // linkData scopes to the member's own groups), expanded for this + next month.
  const calScope = calLink?.linkData === "myGroups" ? "myGroups" : "church";
  const { data: fetchedEvents = [] } = useQuery<EventRow[]>({
    queryKey: ["dashboard-events", calScope, churchId],
    queryFn: async () => {
      const data = await ApiHelper.get(calScope === "myGroups" ? "/events/my" : "/events/church", "ContentApi");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!churchId && !!jwt && !!calLink,
    placeholderData: [],
    staleTime: 60000
  });
  const upcoming = useMemo(() => {
    if (!calLink || !jwt) return [];
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const normalized = EventProcessor.updateTime(fetchedEvents);
    const expanded = [
      ...EventProcessor.expandEventsForMonth(normalized, now),
      ...EventProcessor.expandEventsForMonth(normalized, nextMonth)
    ];
    return expanded
      .filter((e) => e.start && new Date(e.start).getTime() >= now.getTime() - 2 * 3600e3)
      .sort((a, b) => new Date(a.start as Date).getTime() - new Date(b.start as Date).getTime())
      .slice(0, 3);
  }, [fetchedEvents, calLink, jwt]);

  // Latest sermon — public feed, works signed out too.
  const { data: latestSermon } = useQuery<SermonInterface | null>({
    queryKey: ["dashboard-latest-sermon", churchId],
    queryFn: async () => {
      const result = await ApiHelper.getAnonymous(`/sermons/public/${churchId}`, "ContentApi");
      const list: SermonInterface[] = Array.isArray(result) ? result : [];
      const dated = list.filter((s) => s.publishDate);
      dated.sort((a, b) => new Date(b.publishDate as Date).getTime() - new Date(a.publishDate as Date).getTime());
      return dated[0] || list[0] || null;
    },
    enabled: !!churchId && !!sermonsLink,
    staleTime: 300000
  });

  // A link covered by a live content strip leaves the card pools so it never
  // appears twice — but only while its strip actually renders. With no
  // upcoming events / sermons, the link falls back into the normal cards.
  const hasEventsStrip = !!calLink && upcoming.length > 0;
  const hasSermonStrip = !!sermonsLink && !!latestSermon;
  const stripIds = new Set(
    [votdLink, bibleLink, hasEventsStrip ? calLink : undefined, hasSermonStrip ? sermonsLink : undefined]
      .filter(Boolean).map((l) => generateLinkId(l as LinkInterface))
  );
  const hero = filtered.find((l) => !stripIds.has(generateLinkId(l))) || filtered[0];
  const heroId = hero ? generateLinkId(hero) : "";
  const rest = filtered.filter((l) => {
    const id = generateLinkId(l);
    return id !== heroId && !stripIds.has(id);
  });
  const featuredTwo = rest.slice(0, 2);
  const others = rest.slice(2);
  const quick = [...others].sort((a, b) => {
    const ai = QUICK_PRIORITY.indexOf((a.linkType || "").toLowerCase());
    const bi = QUICK_PRIORITY.indexOf((b.linkType || "").toLowerCase());
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const votdDay = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const votdImg = `https://votd.org/v1/${votdDay}/16x9.jpg`;

  const cardShadow = mobileTheme.shadows.lg;
  const featuredShadow = mobileTheme.shadows.md;
  const quickShadow = mobileTheme.shadows.sm;

  const firstName = ((context.person?.name as { first?: string } | undefined)?.first || "").trim();
  const greeting = greetingForHour(new Date().getHours());
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  if (loading) {
    return (
      <Box sx={{ p: `${mobileTheme.spacing.md}px` }}>
        <Box sx={{ bgcolor: tc.surfaceVariant, height: 200, borderRadius: `${mobileTheme.radius.xl}px`, mb: 3 }} />
        <Box sx={{ display: "flex", gap: `${mobileTheme.spacing.md - 4}px`, mb: 3 }}>
          <Box sx={{ flex: 1, bgcolor: tc.surfaceVariant, height: 120, borderRadius: `${mobileTheme.radius.lg}px` }} />
          <Box sx={{ flex: 1, bgcolor: tc.surfaceVariant, height: 120, borderRadius: `${mobileTheme.radius.lg}px` }} />
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: `${mobileTheme.spacing.md - 4}px`, px: `${mobileTheme.spacing.md}px` }}>
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} sx={{ width: "calc(25% - 9px)", height: 96, bgcolor: tc.surfaceVariant, borderRadius: `${mobileTheme.radius.lg}px` }} />
          ))}
        </Box>
      </Box>
    );
  }

  if (filtered.length === 0) {
    return <EmptyDashboardPlaceholder config={config} />;
  }

  const handleKey = (e: React.KeyboardEvent, link: LinkInterface) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(link);
    }
  };

  const hoverFx = {
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    "&:hover": { transform: "translateY(-2px)", boxShadow: `0 6px 16px rgba(0,0,0,0.25), 0 0 0 1px ${tc.primary}` },
    "&:focus-visible": { outline: `2px solid ${tc.primary}`, outlineOffset: 2 }
  };

  const sectionTitle = (text: string) => (
    <Typography sx={{ fontSize: 18, fontWeight: 700, color: tc.text, mb: 1.5, pl: 0.5 }}>
      {text}
    </Typography>
  );

  // Full-bleed image card used by daily-walk and featured tiles. Falls back to
  // the themed gradient + watermark icon when neither an admin photo nor a
  // matching stock image exists.
  const imageCard = (item: LinkInterface, index: number, height: number, big = false) => {
    const photo = resolvePhoto(item) || stockImage(item);
    const itemIcon = linkTypeToIcon(item.linkType, item.icon);
    const tagline = linkTypeToTagline(item.linkType);
    const style = cardStyle(item, index);
    return (
      <Box
        key={generateLinkId(item)}
        role="button"
        tabIndex={0}
        onClick={() => navigate(item)}
        onKeyDown={(e) => handleKey(e, item)}
        sx={{
          flex: 1,
          position: "relative",
          height,
          borderRadius: `${mobileTheme.radius.lg}px`,
          overflow: "hidden",
          boxShadow: featuredShadow,
          cursor: "pointer",
          background: photo ? `url(${photo}) center / cover` : style.gradient,
          ...hoverFx
        }}
      >
        {!photo && (
          <Icon sx={{
            position: "absolute",
            right: -16,
            top: "50%",
            transform: "translateY(-50%) rotate(-8deg)",
            fontSize: big ? 120 : 92,
            color: "rgba(255,255,255,0.30)",
            pointerEvents: "none"
          }}>
            {itemIcon}
          </Icon>
        )}
        <Box sx={{
          position: "absolute",
          inset: 0,
          background: scrim(true),
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          p: "14px"
        }}>
          <Typography sx={{
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: 15,
            lineHeight: 1.2,
            textShadow: "0 1px 2px rgba(0,0,0,0.4)"
          }}>
            {item.text}
          </Typography>
          {tagline && (
            <Typography sx={{
              color: "rgba(255,255,255,0.85)",
              fontSize: 12,
              mt: 0.25,
              textShadow: "0 1px 2px rgba(0,0,0,0.4)"
            }}>
              {tagline}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ bgcolor: tc.background, minHeight: "100%", pt: 2, pb: 3 }}>
      {(firstName || todayLabel) && (
        <Box sx={{ px: `${mobileTheme.spacing.md}px`, mb: 2 }}>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: tc.text, lineHeight: 1.2 }}>
            {firstName ? `${greeting}, ${firstName}` : greeting}
          </Typography>
          <Typography sx={{ fontSize: 14, color: tc.textSecondary, mt: 0.25 }}>
            {todayLabel}
          </Typography>
        </Box>
      )}

      {hero && (() => {
        const heroPhoto = resolvePhoto(hero) || stockImage(hero);
        const heroIcon = linkTypeToIcon(hero.linkType, hero.icon);
        const heroTagline = linkTypeToTagline(hero.linkType);
        const style = cardStyle(hero, 0);
        return (
          <Box sx={{ px: `${mobileTheme.spacing.md}px`, mb: 3 }}>
            <Box
              role="button"
              tabIndex={0}
              onClick={() => navigate(hero)}
              onKeyDown={(e) => handleKey(e, hero)}
              sx={{
                position: "relative",
                height: 128,
                borderRadius: `${mobileTheme.radius.xl}px`,
                overflow: "hidden",
                boxShadow: cardShadow,
                cursor: "pointer",
                background: heroPhoto ? `url(${heroPhoto}) center / cover` : style.gradient,
                ...hoverFx
              }}
            >
              {!heroPhoto && (
                <Icon sx={{
                  position: "absolute",
                  right: -24,
                  top: "50%",
                  transform: "translateY(-50%) rotate(-8deg)",
                  fontSize: 140,
                  color: "rgba(255,255,255,0.28)",
                  pointerEvents: "none"
                }}>
                  {heroIcon}
                </Icon>
              )}
              <Box sx={{
                position: "absolute",
                inset: 0,
                background: scrim(!heroPhoto),
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: "12px",
                p: "16px 20px"
              }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{
                    color: "#FFFFFF",
                    fontWeight: 700,
                    fontSize: 22,
                    lineHeight: 1.1,
                    textShadow: "0 1px 3px rgba(0,0,0,0.4)"
                  }}>
                    {hero.text}
                  </Typography>
                  {heroTagline && (
                    <Typography sx={{
                      color: "rgba(255,255,255,0.9)",
                      fontSize: 13,
                      mt: 0.25,
                      textShadow: "0 1px 2px rgba(0,0,0,0.4)"
                    }}>
                      {heroTagline}
                    </Typography>
                  )}
                </Box>
                <Box sx={{
                  flexShrink: 0,
                  px: "14px",
                  py: "7px",
                  borderRadius: "999px",
                  bgcolor: "rgba(255,255,255,0.92)",
                  color: "#1f2937",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  View
                  <Icon sx={{ fontSize: 16 }}>arrow_forward</Icon>
                </Box>
              </Box>
            </Box>
          </Box>
        );
      })()}

      {(votdLink || bibleLink) && (
        <Box sx={{ px: `${mobileTheme.spacing.md}px`, mb: 3 }}>
          {sectionTitle("Your daily walk")}
          <Box sx={{ display: "flex", gap: `${mobileTheme.spacing.md - 4}px` }}>
            {votdLink && (
              <Box
                role="button"
                tabIndex={0}
                onClick={() => navigate(votdLink)}
                onKeyDown={(e) => handleKey(e, votdLink)}
                sx={{
                  flex: 1,
                  position: "relative",
                  height: 150,
                  borderRadius: `${mobileTheme.radius.lg}px`,
                  overflow: "hidden",
                  boxShadow: featuredShadow,
                  cursor: "pointer",
                  background: cardStyle(votdLink, 0).gradient,
                  ...hoverFx
                }}
              >
                {!votdImgFailed && (
                  <Box
                    component="img"
                    src={votdImg}
                    alt=""
                    loading="lazy"
                    onError={() => setVotdImgFailed(true)}
                    sx={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover"
                    }}
                  />
                )}
                {votdImgFailed && (
                  <Icon sx={{
                    position: "absolute",
                    right: -16,
                    top: "50%",
                    transform: "translateY(-50%) rotate(-8deg)",
                    fontSize: 110,
                    color: "rgba(255,255,255,0.30)",
                    pointerEvents: "none"
                  }}>
                    {linkTypeToIcon(votdLink.linkType, votdLink.icon)}
                  </Icon>
                )}
                <Box sx={{
                  position: "absolute",
                  inset: 0,
                  background: scrim(true),
                  display: "flex",
                  alignItems: "flex-end",
                  p: "14px"
                }}>
                  <Typography sx={{
                    color: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: 15,
                    lineHeight: 1.2,
                    textShadow: "0 1px 2px rgba(0,0,0,0.4)"
                  }}>
                    {votdLink.text}
                  </Typography>
                </Box>
              </Box>
            )}
            {bibleLink && imageCard(bibleLink, 1, 150, true)}
          </Box>
        </Box>
      )}

      {featuredTwo.length > 0 && (
        <Box sx={{ px: `${mobileTheme.spacing.md}px`, mb: 3 }}>
          {sectionTitle(Locale.label("mobile.components.featured"))}
          <Box sx={{ display: "flex", gap: `${mobileTheme.spacing.md - 4}px` }}>
            {featuredTwo.map((item, i) => imageCard(item, i + 1, 150, true))}
          </Box>
        </Box>
      )}

      {calLink && upcoming.length > 0 && (
        <Box sx={{ px: `${mobileTheme.spacing.md}px`, mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", mb: 1.5, pr: 0.5 }}>
            {sectionTitle("Upcoming events")}
            <Typography
              role="button"
              tabIndex={0}
              onClick={() => navigate(calLink)}
              onKeyDown={(e) => handleKey(e, calLink)}
              sx={{ fontSize: 13, fontWeight: 600, color: tc.primary, cursor: "pointer", flexShrink: 0 }}
            >
              Open calendar →
            </Typography>
          </Box>
          <Box sx={{
            bgcolor: tc.surface,
            borderRadius: `${mobileTheme.radius.lg}px`,
            boxShadow: quickShadow,
            border: `1px solid ${tc.borderLight || tc.border}`,
            overflow: "hidden"
          }}>
            {upcoming.map((e, i) => {
              const d = e.start ? new Date(e.start) : null;
              const time = fmtTime(e);
              return (
                <Box
                  key={e.id || i}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(calLink)}
                  onKeyDown={(ev) => handleKey(ev, calLink)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    px: "14px",
                    py: "10px",
                    cursor: "pointer",
                    borderTop: i === 0 ? "none" : `1px solid ${tc.borderLight || tc.border}`,
                    "&:hover": { bgcolor: tc.surfaceVariant },
                    "&:focus-visible": { outline: `2px solid ${tc.primary}`, outlineOffset: -2 }
                  }}
                >
                  <Box sx={{
                    flexShrink: 0,
                    width: 44,
                    py: "4px",
                    borderRadius: "10px",
                    bgcolor: CARD_STYLES.calendar.tint,
                    textAlign: "center"
                  }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 700, color: CARD_STYLES.calendar.icon, lineHeight: 1.1 }}>
                      {d ? d.getDate() : ""}
                    </Typography>
                    <Typography sx={{ fontSize: 10, fontWeight: 600, color: CARD_STYLES.calendar.icon, textTransform: "uppercase" }}>
                      {d ? d.toLocaleDateString(undefined, { month: "short" }) : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: tc.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}>
                      {e.title || "Event"}
                    </Typography>
                    {time && (
                      <Typography sx={{ fontSize: 12, color: tc.textSecondary }}>
                        {time}
                      </Typography>
                    )}
                  </Box>
                  <Icon sx={{ fontSize: 18, color: tc.textHint }}>chevron_right</Icon>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {sermonsLink && latestSermon && (() => {
        const hasThumb = !!(latestSermon.thumbnail && latestSermon.thumbnail.trim());
        return (
          <Box sx={{ px: `${mobileTheme.spacing.md}px`, mb: 3 }}>
            {sectionTitle("Latest sermon")}
            <Box
              role="button"
              tabIndex={0}
              onClick={() => navigate(sermonsLink)}
              onKeyDown={(e) => handleKey(e, sermonsLink)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                bgcolor: tc.surface,
                borderRadius: `${mobileTheme.radius.lg}px`,
                boxShadow: quickShadow,
                border: `1px solid ${tc.borderLight || tc.border}`,
                p: "10px 14px 10px 10px",
                cursor: "pointer",
                ...hoverFx
              }}
            >
              <Box sx={{
                flexShrink: 0,
                width: 96,
                height: 54,
                borderRadius: "8px",
                overflow: "hidden",
                background: hasThumb ? `url(${latestSermon.thumbnail}) center / cover` : CARD_STYLES.sermons.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                {!hasThumb && <Icon sx={{ fontSize: 26, color: "rgba(255,255,255,0.85)" }}>play_circle</Icon>}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: tc.text,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden"
                }}>
                  {latestSermon.title || "Sermon"}
                </Typography>
                {latestSermon.publishDate && (
                  <Typography sx={{ fontSize: 12, color: tc.textSecondary, mt: 0.25 }}>
                    {new Date(latestSermon.publishDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </Typography>
                )}
              </Box>
              <Icon sx={{ fontSize: 18, color: tc.textHint }}>chevron_right</Icon>
            </Box>
          </Box>
        );
      })()}

      {quick.length > 0 && (
        <Box sx={{ px: `${mobileTheme.spacing.md}px`, mb: 3 }}>
          {sectionTitle(Locale.label("mobile.components.quickActions"))}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: `${mobileTheme.spacing.md - 4}px` }}>
            {quick.map((item, i) => {
              const style = cardStyle(item, i + 3);
              return (
                <Box
                  key={generateLinkId(item)}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(item)}
                  onKeyDown={(e) => handleKey(e, item)}
                  sx={{
                    width: { xs: "calc(25% - 9px)", sm: "calc(20% - 10px)", md: "calc(16.666% - 10px)" },
                    minWidth: 76,
                    alignItems: "center",
                    display: "flex",
                    flexDirection: "column",
                    py: "16px",
                    px: "8px",
                    bgcolor: tc.surface,
                    borderRadius: `${mobileTheme.radius.lg}px`,
                    boxShadow: quickShadow,
                    border: `1px solid ${tc.borderLight || tc.border}`,
                    cursor: "pointer",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    "&:hover": { transform: "translateY(-2px)", boxShadow: `0 6px 16px rgba(0,0,0,0.2), 0 0 0 1px ${tc.primary}` },
                    "&:focus-visible": { outline: `2px solid ${tc.primary}`, outlineOffset: 2 }
                  }}
                >
                  <Box sx={{
                    width: 48,
                    height: 48,
                    borderRadius: "16px",
                    bgcolor: style.tint,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 1.25
                  }}>
                    <Icon sx={{ fontSize: 26, color: style.icon }}>{linkTypeToIcon(item.linkType, item.icon)}</Icon>
                  </Box>
                  <Typography sx={{
                    color: tc.text,
                    textAlign: "center",
                    fontSize: 12,
                    fontWeight: 500,
                    lineHeight: 1.25,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden"
                  }}>
                    {item.text}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};
