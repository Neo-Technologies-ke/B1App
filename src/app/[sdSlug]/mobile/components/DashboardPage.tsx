"use client";

import React, { useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Box, Icon, Typography } from "@mui/material";
import { type LinkInterface } from "@churchapps/helpers";
import { Locale } from "@churchapps/apphelper";
import UserContext from "@/context/UserContext";
import { ConfigurationInterface } from "@/helpers/ConfigHelper";
import { mobileTheme, linkTypeToIcon, linkTypeToRoute, linkTypeToTagline } from "./mobileTheme";
import { filterVisibleLinks, useChurchLinks } from "../hooks/useConfig";
import { useEngagementSort } from "../hooks/useEngagementSort";
import { EmptyDashboardPlaceholder } from "./EmptyDashboardPlaceholder";

interface Props {
  config: ConfigurationInterface;
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

export const DashboardPage = ({ config }: Props) => {
  const context = useContext(UserContext);
  const router = useRouter();
  const tc = mobileTheme.colors;
  const churchId = config?.church?.id;
  const jwt = context.userChurch?.jwt;

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

  const featured = filtered.slice(0, 3);
  const hero = featured[0];
  const featuredTwo = featured.slice(1, 3);
  const others = filtered.slice(3);

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

  return (
    <Box sx={{ bgcolor: tc.background, minHeight: "100%", pt: 2, pb: 3 }}>
      {(firstName || todayLabel) && (
        <Box sx={{ px: `${mobileTheme.spacing.md}px`, mb: 2.5 }}>
          <Typography sx={{ fontSize: 24, fontWeight: 700, color: tc.text, lineHeight: 1.2 }}>
            {firstName ? `${greeting}, ${firstName}` : greeting}
          </Typography>
          <Typography sx={{ fontSize: 14, color: tc.textSecondary, mt: 0.25 }}>
            {todayLabel}
          </Typography>
        </Box>
      )}

      {hero && (() => {
        const heroPhoto = resolvePhoto(hero);
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
                height: 200,
                borderRadius: `${mobileTheme.radius.xl}px`,
                overflow: "hidden",
                boxShadow: cardShadow,
                cursor: "pointer",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                "&:hover": { transform: "translateY(-2px)" },
                background: heroPhoto
                  ? `url(${heroPhoto}) center / cover`
                  : style.gradient
              }}
            >
              {!heroPhoto && (
                <>
                  <Icon sx={{
                    position: "absolute",
                    right: -30,
                    top: "50%",
                    transform: "translateY(-50%) rotate(-8deg)",
                    fontSize: 180,
                    color: "rgba(255,255,255,0.28)",
                    pointerEvents: "none"
                  }}>
                    {heroIcon}
                  </Icon>
                  <Icon sx={{
                    position: "absolute",
                    right: 130,
                    top: 24,
                    fontSize: 56,
                    color: "rgba(255,255,255,0.16)",
                    pointerEvents: "none"
                  }}>
                    {heroIcon}
                  </Icon>
                </>
              )}
              <Box sx={{
                position: "absolute",
                inset: 0,
                background: scrim(!heroPhoto),
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                p: "20px"
              }}>
                <Typography sx={{
                  color: "#FFFFFF",
                  fontWeight: 700,
                  fontSize: 30,
                  lineHeight: 1.1,
                  mb: 0.5,
                  textShadow: "0 1px 3px rgba(0,0,0,0.4)"
                }}>
                  {hero.text}
                </Typography>
                {heroTagline && (
                  <Typography sx={{
                    color: "rgba(255,255,255,0.92)",
                    fontSize: 15,
                    textShadow: "0 1px 2px rgba(0,0,0,0.4)"
                  }}>
                    {heroTagline}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        );
      })()}

      {featuredTwo.length > 0 && (
        <Box sx={{ px: `${mobileTheme.spacing.md}px`, mb: 3 }}>
          <Typography sx={{
            fontSize: 18,
            fontWeight: 700,
            color: tc.text,
            mb: 1.5,
            pl: 0.5
          }}>
            {Locale.label("mobile.components.featured")}
          </Typography>
          <Box sx={{ display: "flex", gap: `${mobileTheme.spacing.md - 4}px` }}>
            {featuredTwo.map((item, i) => {
              const photo = resolvePhoto(item);
              const itemIcon = linkTypeToIcon(item.linkType, item.icon);
              const style = cardStyle(item, i + 1);
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
                    height: 120,
                    borderRadius: `${mobileTheme.radius.lg}px`,
                    overflow: "hidden",
                    boxShadow: featuredShadow,
                    cursor: "pointer",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    "&:hover": { transform: "translateY(-2px)" },
                    background: photo
                      ? `url(${photo}) center / cover`
                      : style.gradient
                  }}
                >
                  {!photo && (
                    <Icon sx={{
                      position: "absolute",
                      right: -16,
                      top: "50%",
                      transform: "translateY(-50%) rotate(-8deg)",
                      fontSize: 92,
                      color: "rgba(255,255,255,0.30)",
                      pointerEvents: "none"
                    }}>
                      {itemIcon}
                    </Icon>
                  )}
                  <Box sx={{
                    position: "absolute",
                    inset: 0,
                    background: scrim(!photo),
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
                      {item.text}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {others.length > 0 && (
        <Box sx={{ px: `${mobileTheme.spacing.md}px`, mb: 3 }}>
          <Typography sx={{
            fontSize: 18,
            fontWeight: 700,
            color: tc.text,
            mb: 1.5,
            pl: 0.5
          }}>
            {Locale.label("mobile.components.quickActions")}
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: `${mobileTheme.spacing.md - 4}px` }}>
            {others.map((item, i) => {
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
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    "&:hover": { transform: "translateY(-2px)", boxShadow: featuredShadow }
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
