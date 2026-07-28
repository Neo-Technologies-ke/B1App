"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Icon, Tab, Tabs, Typography } from "@mui/material";
import { ApiHelper, Locale } from "@churchapps/apphelper";
import { useQuery } from "@tanstack/react-query";
import type { PlaylistInterface, SermonInterface } from "@churchapps/helpers";
import { ConfigurationInterface } from "@/helpers/ConfigHelper";
import { mobileTheme } from "../mobileTheme";
import { formatDate as formatDateShared, formatDuration } from "../util";
import { SermonCard } from "../SermonCard";
import { LiveStreamCard } from "../LiveStreamCard";
import { useUpcomingStream } from "../../hooks/useUpcomingStream";

const formatDate = (date?: Date | string) => formatDateShared(date, "short");

interface Props {
  config: ConfigurationInterface;
}

const FeaturedSermonHero = ({ sermon, onClick }: { sermon: SermonInterface; onClick: () => void }) => {
  const tc = mobileTheme.colors;
  const hasImage = !!(sermon.thumbnail && sermon.thumbnail.trim() !== "");

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      sx={{
        position: "relative",
        width: "100%",
        paddingTop: "56.25%",
        mb: `${mobileTheme.spacing.lg}px`,
        borderRadius: `${mobileTheme.radius.xl}px`,
        overflow: "hidden",
        boxShadow: mobileTheme.shadows.lg,
        cursor: "pointer",
        backgroundImage: hasImage
          ? `url(${sermon.thumbnail})`
          : `linear-gradient(135deg, ${tc.primary} 0%, ${tc.secondary} 100%)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        transition: "box-shadow 200ms ease",
        "&:hover": { boxShadow: mobileTheme.shadows.lg }
      }}
    >
      {!hasImage && (
        <Box sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.9
        }}>
          <Icon sx={{ fontSize: 72, color: "#FFFFFF" }}>video_library</Icon>
        </Box>
      )}

      <Box sx={{
        position: "absolute",
        inset: 0,
        bgcolor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: `${mobileTheme.spacing.md}px`,
        p: `${mobileTheme.spacing.lg}px`
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            color: "#FFFFFF",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
            opacity: 0.9,
            mb: 1
          }}>
            Latest Sermon
          </Typography>
          <Typography sx={{
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: 22,
            lineHeight: 1.2,
            mb: 1,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)"
          }}>
            {sermon.title || "Untitled Sermon"}
          </Typography>
          {sermon.publishDate && (
            <Typography sx={{ color: "#FFFFFF", opacity: 0.9, fontSize: 14, mb: 0.5 }}>
              {formatDate(sermon.publishDate)}
            </Typography>
          )}
          {sermon.duration ? (
            <Typography sx={{ color: "#FFFFFF", opacity: 0.8, fontSize: 12 }}>
              {formatDuration(sermon.duration)}
            </Typography>
          ) : null}
        </Box>
        <Box sx={{
          flexShrink: 0,
          bgcolor: `color-mix(in srgb, ${tc.primary} 90%, transparent)`,
          borderRadius: "28px",
          width: 56,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: mobileTheme.shadows.md
        }}>
          <Icon sx={{ fontSize: 32, color: tc.onPrimary }}>play_arrow</Icon>
        </Box>
      </Box>
    </Box>
  );
};

const PlaylistCard = ({ playlist, onClick }: { playlist: PlaylistInterface; onClick: () => void }) => {
  const tc = mobileTheme.colors;
  const hasImage = !!(playlist.thumbnail && playlist.thumbnail.trim() !== "");

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      sx={{
        position: "relative",
        width: "100%",
        paddingTop: "56.25%",
        mb: `${mobileTheme.spacing.md - 4}px`,
        borderRadius: `${mobileTheme.radius.xl}px`,
        overflow: "hidden",
        boxShadow: mobileTheme.shadows.md,
        cursor: "pointer",
        backgroundImage: hasImage
          ? `url(${playlist.thumbnail})`
          : `linear-gradient(135deg, ${tc.primary} 0%, ${tc.secondary} 100%)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        transition: "box-shadow 200ms ease",
        "&:hover": { boxShadow: mobileTheme.shadows.lg }
      }}
    >
      {!hasImage && (
        <Box sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.9
        }}>
          <Icon sx={{ fontSize: 56, color: "#FFFFFF" }}>playlist_play</Icon>
        </Box>
      )}

      <Box sx={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.0) 100%)",
        p: "16px",
        pt: "32px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 1
      }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{
            color: "#FFFFFF",
            fontWeight: 600,
            fontSize: 16,
            mb: 0.5,
            lineHeight: 1.2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textShadow: "0 1px 2px rgba(0,0,0,0.4)"
          }}>
            {playlist.title || "Untitled Series"}
          </Typography>
          {playlist.description ? (
            <Typography sx={{
              color: "#FFFFFF",
              opacity: 0.9,
              fontSize: 14,
              mb: 0.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 1px 2px rgba(0,0,0,0.4)"
            }}>
              {playlist.description}
            </Typography>
          ) : null}
          {playlist.publishDate && (
            <Typography sx={{ color: "#FFFFFF", opacity: 0.85, fontSize: 12, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
              {formatDate(playlist.publishDate)}
            </Typography>
          )}
        </Box>
        <Icon sx={{ fontSize: 24, color: "#FFFFFF" }}>chevron_right</Icon>
      </Box>
    </Box>
  );
};

const SkeletonCard = () => {
  const tc = mobileTheme.colors;
  return (
    <Box sx={{
      position: "relative",
      width: "100%",
      paddingTop: "56.25%",
      mb: `${mobileTheme.spacing.md - 4}px`,
      borderRadius: `${mobileTheme.radius.xl}px`,
      overflow: "hidden",
      bgcolor: tc.surfaceVariant,
      boxShadow: mobileTheme.shadows.sm
    }} />
  );
};

const EmptyState = ({ type }: { type: "sermons" | "playlists" }) => {
  const tc = mobileTheme.colors;
  const isPlaylists = type === "playlists";
  return (
    <Box sx={{
      bgcolor: tc.surface,
      borderRadius: `${mobileTheme.radius.xl}px`,
      p: 4,
      textAlign: "center",
      boxShadow: mobileTheme.shadows.md,
      mt: 2
    }}>
      <Box sx={{
        width: 72,
        height: 72,
        borderRadius: "36px",
        bgcolor: tc.iconBackground,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        mb: 2
      }}>
        <Icon sx={{ fontSize: 36, color: tc.primary }}>
          {isPlaylists ? "playlist_add" : "video_library"}
        </Icon>
      </Box>
      <Typography sx={{ fontSize: 18, fontWeight: 600, color: tc.text, mb: 1 }}>
        {isPlaylists ? "No Sermon Series Available" : "No Recent Sermons"}
      </Typography>
      <Typography sx={{ fontSize: 14, color: tc.textMuted }}>
        {isPlaylists
          ? "Check back later for new sermon series from your church."
          : "Check back later for new sermons from your church."}
      </Typography>
    </Box>
  );
};

const ErrorState = ({ onGoBack }: { onGoBack: () => void }) => {
  const tc = mobileTheme.colors;
  return (
    <Box sx={{
      bgcolor: tc.surface,
      borderRadius: `${mobileTheme.radius.xl}px`,
      p: 4,
      textAlign: "center",
      boxShadow: mobileTheme.shadows.md,
      mt: 2
    }}>
      <Box sx={{
        width: 72,
        height: 72,
        borderRadius: "36px",
        bgcolor: tc.iconBackground,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        mb: 2
      }}>
        <Icon sx={{ fontSize: 36, color: tc.textSecondary }}>sentiment_dissatisfied</Icon>
      </Box>
      <Typography sx={{ fontSize: 18, fontWeight: 600, color: tc.text, mb: 1 }}>
        {Locale.label("mobile.screens.sermonsLoadError")}
      </Typography>
      <Typography sx={{ fontSize: 14, color: tc.textMuted, mb: 2 }}>
        {Locale.label("mobile.screens.sermonsLoadErrorBody")}
      </Typography>
      <Box
        component="button"
        onClick={onGoBack}
        sx={{
          border: "none",
          cursor: "pointer",
          background: "none",
          color: tc.primary,
          fontWeight: 600,
          fontSize: 14
        }}
      >
        {Locale.label("mobile.screens.sermonsGoBack")}
      </Box>
    </Box>
  );
};

export const SermonsPage = ({ config }: Props) => {
  const router = useRouter();
  const tc = mobileTheme.colors;
  const churchId = config?.church?.id;
  const keyName = config?.church?.subDomain;
  const [activeTab, setActiveTab] = useState<"series" | "recent">("series");

  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: sermons = [], isLoading: sermonsLoading, isError: sermonsError } = useQuery<SermonInterface[]>({
    queryKey: ["sermons", churchId],
    queryFn: async () => {
      const result = await ApiHelper.getAnonymous(`/sermons/public/${churchId}`, "ContentApi");
      const list: SermonInterface[] = Array.isArray(result)
        ? result.filter((s: any) => s && s.id && s.title)
        : [];
      list.sort((a, b) => new Date(b.publishDate || 0).getTime() - new Date(a.publishDate || 0).getTime());
      return list;
    },
    enabled: !!churchId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000
  });

  const { data: playlists = [], isLoading: playlistsLoading, isError: playlistsError } = useQuery<PlaylistInterface[]>({
    queryKey: ["playlists", churchId],
    queryFn: async () => {
      const result = await ApiHelper.getAnonymous(`/playlists/public/${churchId}`, "ContentApi");
      const list: PlaylistInterface[] = Array.isArray(result)
        ? result.filter((p: any) => p && p.id && p.title)
        : [];
      list.sort((a, b) => new Date(b.publishDate || 0).getTime() - new Date(a.publishDate || 0).getTime());
      return list;
    },
    enabled: !!churchId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000
  });

  const upcomingStream = useUpcomingStream(keyName);

  const featuredSermon = useMemo<SermonInterface | null>(() => {
    if (!sermons || sermons.length === 0) return null;
    return sermons[0];
  }, [sermons]);

  const handleSermonClick = (sermon: SermonInterface) => {
    if (!sermon.id) return;
    const qs = sermon.title ? `?title=${encodeURIComponent(sermon.title)}` : "";
    router.push(`/mobile/sermons/${sermon.id}${qs}`);
  };

  const handlePlaylistClick = (playlist: PlaylistInterface) => {
    if (!playlist.id) return;
    const qs = playlist.title ? `?title=${encodeURIComponent(playlist.title)}` : "";
    router.push(`/mobile/playlist/${playlist.id}${qs}`);
  };

  const renderSkeletons = () => (
    <>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </>
  );

  const renderSeriesTab = () => {
    if (playlistsLoading || sermonsLoading) return renderSkeletons();
    if (playlistsError || sermonsError) return <ErrorState onGoBack={() => router.back()} />;
    return (
      <>
        {upcomingStream ? (
          <LiveStreamCard stream={upcomingStream} />
        ) : featuredSermon ? (
          <FeaturedSermonHero sermon={featuredSermon} onClick={() => handleSermonClick(featuredSermon)} />
        ) : null}

        <Typography sx={{ fontSize: 20, fontWeight: 700, color: tc.text, mb: 2 }}>
          Sermon Series
        </Typography>

        {playlists.length === 0
          ? <EmptyState type="playlists" />
          : playlists.map((p) => (
            <PlaylistCard key={p.id} playlist={p} onClick={() => handlePlaylistClick(p)} />
          ))}
      </>
    );
  };

  const renderRecentTab = () => {
    if (sermonsLoading) return renderSkeletons();
    if (sermonsError) return <ErrorState onGoBack={() => router.back()} />;
    return (
      <>
        {upcomingStream ? <LiveStreamCard stream={upcomingStream} /> : null}

        <Typography sx={{ fontSize: 20, fontWeight: 700, color: tc.text, mb: 2 }}>
          Recent Sermons
        </Typography>

        {sermons.length === 0
          ? <EmptyState type="sermons" />
          : sermons.map((s) => (
            <SermonCard key={s.id} sermon={s} onClick={() => handleSermonClick(s)} />
          ))}
      </>
    );
  };

  return (
    <Box sx={{ bgcolor: tc.background, minHeight: "100%" }}>
      <Box sx={{
        borderBottom: `1px solid ${tc.border}`,
        bgcolor: tc.surface
      }}>
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          variant="fullWidth"
          textColor="primary"
          indicatorColor="primary"
          sx={{
            minHeight: 52,
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 500,
              fontSize: 14,
              minHeight: 52,
              color: tc.textSecondary
            },
            "& .Mui-selected": { color: `${tc.primary} !important`, fontWeight: 700 },
            "& .MuiTabs-indicator": { backgroundColor: tc.primary, height: 2 }
          }}
        >
          <Tab value="series" label={Locale.label("mobile.screens.tabSeries")} />
          <Tab value="recent" label={Locale.label("mobile.screens.tabRecent")} />
        </Tabs>
      </Box>
      <Box sx={{ p: `${mobileTheme.spacing.md}px` }}>
        {activeTab === "series" ? renderSeriesTab() : renderRecentTab()}
      </Box>
    </Box>
  );
};
