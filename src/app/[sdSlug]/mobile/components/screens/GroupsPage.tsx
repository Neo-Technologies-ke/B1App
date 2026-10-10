"use client";

import React, { useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Box, Icon, Skeleton, Typography, Button } from "@mui/material";
import { ApiHelper } from "@churchapps/apphelper";
import { MarkdownPreviewLight } from "@churchapps/apphelper/markdown";
import { useQuery } from "@tanstack/react-query";
import type { EventInterface, GroupInterface, GroupJoinRequestInterface } from "@churchapps/helpers";
import UserContext from "@/context/UserContext";
import { ConfigurationInterface } from "@/helpers/ConfigHelper";
import { mobileTheme } from "../mobileTheme";
import { useEngagementSort } from "../../hooks/useEngagementSort";

interface Props {
  config?: ConfigurationInterface;
}

const ENGAGEMENT_STORAGE_KEY = "b1app-group-view-counts";

// Deterministic per-group accent so cards get distinct duotone gradients
// instead of every card sharing the same church-primary blend. Hashing the
// group id keeps colours stable across re-ordering.
const GROUP_PALETTES: Array<{ gradient: string; accent: string }> = [
  { gradient: "linear-gradient(135deg,#6d28d9,#8b5cf6)", accent: "#8b5cf6" },
  { gradient: "linear-gradient(135deg,#0f766e,#14b8a6)", accent: "#14b8a6" },
  { gradient: "linear-gradient(135deg,#b45309,#f59e0b)", accent: "#f59e0b" },
  { gradient: "linear-gradient(135deg,#be123c,#f43f5e)", accent: "#f43f5e" },
  { gradient: "linear-gradient(135deg,#1d4ed8,#3b82f6)", accent: "#3b82f6" },
  { gradient: "linear-gradient(135deg,#9d174d,#ec4899)", accent: "#ec4899" },
  { gradient: "linear-gradient(135deg,#065f46,#10b981)", accent: "#10b981" },
  { gradient: "linear-gradient(135deg,#0369a1,#0ea5e9)", accent: "#0ea5e9" }
];

const paletteFor = (group: GroupInterface) => {
  const id = group.id || group.name || "";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GROUP_PALETTES[h % GROUP_PALETTES.length];
};

// Category-aware icons — villages, people groups, teams etc. read better than
// the same generic "groups" glyph everywhere.
const groupIcon = (group: GroupInterface): string => {
  const cat = (group.categoryName || "").toLowerCase();
  if (cat.includes("village")) return "holiday_village";
  if (cat.includes("people")) return "diversity_3";
  if (cat.includes("team")) return "groups_2";
  if (cat.includes("ministry")) return "church";
  if (cat.includes("responsibility")) return "workspace_premium";
  if (cat.includes("marital")) return "favorite";
  return "groups";
};

export const GroupsPage = ({ config: _config }: Props) => {
  const tc = mobileTheme.colors;
  const router = useRouter();
  const context = useContext(UserContext);
  const loggedIn = !!context?.user?.firstName;

  const { data: groups = null } = useQuery<GroupInterface[]>({
    queryKey: ["my-groups", context?.user?.id],
    queryFn: async () => {
      const data = await ApiHelper.get("/groups/my", "MembershipApi");
      return Array.isArray(data) ? data : [];
    },
    enabled: loggedIn,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000
  });

  const { data: pendingRequests = [], refetch: refetchPending } = useQuery<GroupJoinRequestInterface[]>({
    queryKey: ["my-pending-requests", context?.user?.id],
    queryFn: async () => {
      const data = await ApiHelper.get("/groupjoinrequests/my", "MembershipApi");
      return Array.isArray(data) ? data.filter((r: GroupJoinRequestInterface) => r.status === "pending") : [];
    },
    enabled: loggedIn,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000
  });

  const handleCancelRequest = async (id: string) => {
    await ApiHelper.delete(`/groupjoinrequests/${id}`, "MembershipApi");
    refetchPending();
  };

  const { data: upcomingEvents = [] } = useQuery<EventInterface[]>({
    queryKey: ["events-registerable", context?.user?.id],
    queryFn: async () => {
      const data = await ApiHelper.get("/events/registerable", "ContentApi");
      return Array.isArray(data) ? data : [];
    },
    enabled: loggedIn,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000
  });

  const effectiveGroups = loggedIn ? groups : [];

  const getGroupId = useCallback((g: GroupInterface) => g.id || "", []);
  const { sorted: orderedGroups, increment: incrementViewCount } = useEngagementSort(
    effectiveGroups,
    ENGAGEMENT_STORAGE_KEY,
    getGroupId
  );

  const sortedGroups = useMemo(() => ({
    hero: orderedGroups[0] || (null as GroupInterface | null),
    featured: orderedGroups.slice(1, 3),
    regular: orderedGroups.slice(3)
  }), [orderedGroups]);

  const formatEventTime = (event: EventInterface) => {
    if (!event.start) return "";
    const start = new Date(event.start);
    if (isNaN(start.getTime())) return "";
    if (event.allDay) {
      return start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " (All day)";
    }
    const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (!event.end) return `${fmtDate(start)} ${fmtTime(start)}`;
    const end = new Date(event.end);
    if (isNaN(end.getTime())) return `${fmtDate(start)} ${fmtTime(start)}`;
    if (start.toDateString() === end.toDateString()) {
      return `${fmtDate(start)} · ${fmtTime(start)} – ${fmtTime(end)}`;
    }
    return `${fmtDate(start)} ${fmtTime(start)} – ${fmtDate(end)} ${fmtTime(end)}`;
  };

  const handleClick = (group: GroupInterface) => {
    if (group.id) incrementViewCount(group.id);
    router.push(`/mobile/groups/${group.id}`);
  };

  const groupSubtext = (group: GroupInterface): string | null => {
    const time = group.meetingTime?.trim();
    const loc = group.meetingLocation?.trim();
    if (time && loc) return `${time} · ${loc}`;
    return time || loc || null;
  };

  const renderHero = (group: GroupInterface) => {
    const hasPhoto = !!group.photoUrl;
    const palette = paletteFor(group);
    return (
      <Box
        key={`hero-${group.id}`}
        onClick={() => handleClick(group)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(group);
          }
        }}
        sx={{
          position: "relative",
          width: "100%",
          height: 150,
          borderRadius: `${mobileTheme.radius.xl}px`,
          overflow: "hidden",
          boxShadow: mobileTheme.shadows.md,
          cursor: "pointer",
          background: hasPhoto ? "transparent" : palette.gradient,
          transition: "box-shadow 200ms ease, transform 200ms ease",
          "&:hover": { boxShadow: mobileTheme.shadows.lg, transform: "translateY(-2px)" },
          "&:focus-visible": { outline: `2px solid ${tc.primary}`, outlineOffset: 2 },
          "&:active": { transform: "scale(0.995)" }
        }}
      >
        {hasPhoto && (
          <Box
            component="img"
            src={group.photoUrl}
            alt={group.name || "Group"}
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {!hasPhoto && (
          <Icon sx={{
            position: "absolute",
            right: -24,
            top: "50%",
            transform: "translateY(-50%) rotate(-8deg)",
            fontSize: 150,
            color: "rgba(255,255,255,0.28)",
            pointerEvents: "none"
          }}>
            {groupIcon(group)}
          </Icon>
        )}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "12px",
            p: "16px 20px",
            background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0) 100%)"
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {group.categoryName && (
              <Typography sx={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                textShadow: "0 1px 2px rgba(0,0,0,0.4)"
              }}>
                {group.categoryName}
              </Typography>
            )}
            <Typography sx={{ color: "#FFFFFF", fontSize: 22, fontWeight: 700, lineHeight: 1.1, textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>
              {group.name}
            </Typography>
            <Typography sx={{ color: "#FFFFFF", opacity: 0.9, fontSize: 13, mt: 0.25, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
              {groupSubtext(group) || "Tap to explore"}
            </Typography>
          </Box>
          <Box sx={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: "50%",
            bgcolor: "rgba(255,255,255,0.92)",
            color: "#1f2937",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Icon sx={{ fontSize: 20 }}>arrow_forward</Icon>
          </Box>
        </Box>
      </Box>
    );
  };

  const renderFeatured = (group: GroupInterface) => {
    const hasPhoto = !!group.photoUrl;
    const palette = paletteFor(group);
    return (
      <Box
        key={`featured-${group.id}`}
        onClick={() => handleClick(group)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(group);
          }
        }}
        sx={{
          position: "relative",
          height: 130,
          borderRadius: `${mobileTheme.radius.lg}px`,
          overflow: "hidden",
          boxShadow: mobileTheme.shadows.sm,
          cursor: "pointer",
          background: hasPhoto ? "transparent" : palette.gradient,
          transition: "box-shadow 200ms ease, transform 200ms ease",
          "&:hover": { boxShadow: mobileTheme.shadows.md, transform: "translateY(-2px)" },
          "&:focus-visible": { outline: `2px solid ${tc.primary}`, outlineOffset: 2 },
          "&:active": { transform: "scale(0.995)" }
        }}
      >
        {hasPhoto && (
          <Box
            component="img"
            src={group.photoUrl}
            alt={group.name || "Group"}
            sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {!hasPhoto && (
          <Icon sx={{
            position: "absolute",
            right: -16,
            top: "50%",
            transform: "translateY(-50%) rotate(-8deg)",
            fontSize: 100,
            color: "rgba(255,255,255,0.30)",
            pointerEvents: "none"
          }}>
            {groupIcon(group)}
          </Icon>
        )}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            p: "14px",
            background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0) 100%)"
          }}
        >
          <Typography
            sx={{
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.2,
              textShadow: "0 1px 2px rgba(0,0,0,0.4)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical"
            }}
          >
            {group.name}
          </Typography>
          {groupSubtext(group) && (
            <Typography sx={{ color: "rgba(255,255,255,0.85)", fontSize: 11, mt: 0.25, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
              {groupSubtext(group)}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  const renderCard = (group: GroupInterface) => {
    const hasPhoto = !!group.photoUrl;
    const palette = paletteFor(group);
    return (
      <Box
        key={group.id}
        onClick={() => handleClick(group)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(group);
          }
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: `${mobileTheme.spacing.md}px`,
          bgcolor: tc.surface,
          borderRadius: `${mobileTheme.radius.lg}px`,
          boxShadow: mobileTheme.shadows.sm,
          p: "12px",
          cursor: "pointer",
          transition: "box-shadow 200ms ease, transform 200ms ease",
          overflow: "hidden",
          "&:hover": { boxShadow: mobileTheme.shadows.md, transform: "translateY(-1px)" },
          "&:focus-visible": { outline: `2px solid ${tc.primary}`, outlineOffset: 2 },
          "&:active": { transform: "scale(0.995)" }
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: "16px",
            overflow: "hidden",
            flexShrink: 0,
            background: hasPhoto ? "transparent" : `${palette.accent}1f`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {hasPhoto ? (
            <Box
              component="img"
              src={group.photoUrl}
              alt={group.name || "Group"}
              sx={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Icon sx={{ fontSize: 26, color: palette.accent }}>{groupIcon(group)}</Icon>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: 16,
              fontWeight: 600,
              color: tc.text,
              mb: "2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical"
            }}
          >
            {group.name}
          </Typography>
          <Typography sx={{ fontSize: 12, color: tc.textSecondary }}>
            {groupSubtext(group) || "Tap to explore"}
          </Typography>
          {group.about && (
            <Box
              sx={{
                mt: "4px",
                fontSize: 12,
                color: tc.textMuted,
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
                "& p": { m: 0 }
              }}
            >
              <MarkdownPreviewLight value={group.about} />
            </Box>
          )}
        </Box>
        <Icon sx={{ fontSize: 20, color: tc.textHint, flexShrink: 0 }}>chevron_right</Icon>
      </Box>
    );
  };

  const renderSkeleton = (key: number) => (
    <Box
      key={`skeleton-${key}`}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: `${mobileTheme.spacing.md}px`,
        bgcolor: tc.surface,
        borderRadius: `${mobileTheme.radius.lg}px`,
        boxShadow: mobileTheme.shadows.sm,
        px: `${mobileTheme.spacing.md}px`,
        py: "12px"
      }}
    >
      <Skeleton variant="rounded" width={48} height={48} sx={{ borderRadius: `${mobileTheme.radius.md}px` }} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="60%" height={20} />
        <Skeleton variant="text" width="40%" height={14} />
      </Box>
      <Skeleton variant="circular" width={20} height={20} />
    </Box>
  );

  const renderEmpty = () => (
    <Box
      sx={{
        bgcolor: tc.surface,
        borderRadius: `${mobileTheme.radius.xl}px`,
        boxShadow: mobileTheme.shadows.sm,
        p: `${mobileTheme.spacing.lg}px`,
        textAlign: "center"
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: "32px",
          bgcolor: tc.iconBackground,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          mb: `${mobileTheme.spacing.md}px`
        }}
      >
        <Icon sx={{ fontSize: 32, color: tc.primary }}>groups</Icon>
      </Box>
      <Typography sx={{ fontSize: 18, fontWeight: 600, color: tc.text, mb: `${mobileTheme.spacing.xs}px` }}>
        You&apos;re not in any groups yet
      </Typography>
      <Typography sx={{ fontSize: 14, color: tc.textMuted, mb: `${mobileTheme.spacing.md}px` }}>
        Find a group to connect with others in your church.
      </Typography>
      <Button
        variant="outlined"
        onClick={() => router.push("/mobile/community")}
        sx={{
          borderColor: tc.primary,
          color: tc.primary,
          textTransform: "none",
          fontWeight: 500,
          borderRadius: `${mobileTheme.radius.md}px`
        }}
      >
        Explore Community
      </Button>
    </Box>
  );

  const { hero, featured, regular } = sortedGroups;
  const hasAnyGroups = effectiveGroups !== null && effectiveGroups.length > 0;

  const renderPendingRequests = () => {
    if (!pendingRequests.length) return null;
    return (
      <Box data-testid="my-pending-requests" sx={{ mb: `${mobileTheme.spacing.md}px` }}>
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: tc.text, mb: `${mobileTheme.spacing.sm}px`, pl: "4px" }}>
          Pending Requests
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: `${mobileTheme.spacing.sm}px` }}>
          {pendingRequests.map((req) => (
            <Box
              key={req.id}
              data-testid={`my-pending-${req.id}`}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: `${mobileTheme.spacing.sm}px ${mobileTheme.spacing.md}px`,
                bgcolor: tc.surface,
                borderRadius: `${mobileTheme.radius.md}px`,
                boxShadow: mobileTheme.shadows.sm
              }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: tc.text }}>
                  {(req as any).groupName || req.group?.name || "Group"}
                </Typography>
                {req.requestDate && (
                  <Typography sx={{ fontSize: 12, color: tc.textSecondary }}>
                    Requested {new Date(req.requestDate).toLocaleDateString()}
                  </Typography>
                )}
              </Box>
              <Button
                size="small"
                onClick={() => handleCancelRequest(req.id)}
                data-testid={`cancel-request-${req.id}`}
                sx={{ textTransform: "none" }}>
                Cancel
              </Button>
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ p: `${mobileTheme.spacing.md}px`, bgcolor: tc.background, minHeight: "100%" }}>
      {renderPendingRequests()}
      {effectiveGroups === null && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: `${mobileTheme.spacing.sm}px` }}>
          {[0, 1, 2].map(renderSkeleton)}
        </Box>
      )}

      {effectiveGroups !== null && effectiveGroups.length === 0 && renderEmpty()}

      {hasAnyGroups && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: `${mobileTheme.spacing.lg}px` }}>

          {hero && <Box>{renderHero(hero)}</Box>}

          {featured.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 600, color: tc.text, mb: `${mobileTheme.spacing.sm}px`, pl: "4px" }}>
                Featured
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: `${mobileTheme.spacing.sm}px`
                }}
              >
                {featured.map((g) => renderFeatured(g))}
              </Box>
            </Box>
          )}

          {regular.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 600, color: tc.text, mb: `${mobileTheme.spacing.sm}px`, pl: "4px" }}>
                Other Groups
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: `${mobileTheme.spacing.sm}px` }}>
                {regular.map(renderCard)}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {upcomingEvents.length > 0 && (
        <Box sx={{ mt: `${mobileTheme.spacing.lg}px` }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: tc.text, mb: `${mobileTheme.spacing.md}px` }}>
            Upcoming Events
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: `${mobileTheme.spacing.sm}px` }}>
            {upcomingEvents.map((event) => (
              <Box
                key={event.id}
                sx={{
                  bgcolor: tc.surface,
                  borderRadius: `${mobileTheme.radius.lg}px`,
                  boxShadow: mobileTheme.shadows.sm,
                  p: `${mobileTheme.spacing.md}px`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "20px",
                    bgcolor: tc.primaryLight,
                    color: tc.primary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <Icon sx={{ fontSize: 22 }}>event</Icon>
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: tc.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical"
                    }}>
                      {event.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: tc.textSecondary, mt: 0.25 }}>
                      {formatEventTime(event)}
                    </Typography>
                    {event.description && (
                      <Typography sx={{
                        fontSize: 13,
                        color: tc.textMuted,
                        mt: 0.5,
                        lineHeight: 1.4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical"
                      }}>
                        {event.description}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => router.push(`/mobile/register/${event.id}`)}
                    sx={{
                      bgcolor: tc.success,
                      color: "#000",
                      textTransform: "none",
                      fontWeight: 600,
                      borderRadius: `${mobileTheme.radius.md}px`,
                      px: 2,
                      "&:hover": { bgcolor: tc.success }
                    }}
                  >
                    Register
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
