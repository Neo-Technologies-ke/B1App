"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Box, Icon, Typography } from "@mui/material";
import { Locale } from "@churchapps/apphelper";
import { mobileTheme } from "./mobileTheme";
import type { UpcomingStream } from "../hooks/useUpcomingStream";

const formatPrettyDateTime = (date: Date) => {
  try {
    const d = date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    const t = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${d} at ${t}`;
  } catch {
    return date.toString();
  }
};

interface Props {
  stream: UpcomingStream;
  onClickLive?: () => void;
}

export const LiveStreamCard = ({ stream, onClickLive }: Props) => {
  const tc = mobileTheme.colors;
  const router = useRouter();
  const now = new Date();
  const diffMs = stream.startDate.getTime() - now.getTime();
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
  const minutes = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)));
  const goLive = onClickLive || (() => router.push("/mobile/stream"));

  if (stream.isLive) {
    return (
      <Box
        role="button"
        tabIndex={0}
        onClick={goLive}
        onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") goLive(); }}
        sx={{
          background: "linear-gradient(135deg, #D32F2F 0%, #F44336 100%)",
          borderRadius: `${mobileTheme.radius.xl}px`,
          p: `${mobileTheme.spacing.lg}px`,
          mb: `${mobileTheme.spacing.lg}px`,
          boxShadow: mobileTheme.shadows.lg,
          textAlign: "center",
          cursor: "pointer"
        }}
      >
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <Box sx={{
            width: 12,
            height: 12,
            borderRadius: "6px",
            bgcolor: "#FFFFFF",
            animation: "pulse 1.4s ease-in-out infinite",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.4 }
            }
          }} />
          <Typography sx={{ color: "#FFFFFF", fontWeight: 800, letterSpacing: 1.5, fontSize: 14 }}>
            LIVE NOW
          </Typography>
        </Box>
        <Typography sx={{ color: "#FFFFFF", fontWeight: 700, fontSize: 20, mb: 1 }}>
          {stream.title}
        </Typography>
        {stream.description && (
          <Typography sx={{ color: "#FFFFFF", opacity: 0.9, fontSize: 14, mb: 2 }}>
            {stream.description}
          </Typography>
        )}
        <Box sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          bgcolor: "#FFFFFF",
          color: "#D32F2F",
          px: 2.5,
          py: 1,
          borderRadius: "24px",
          fontWeight: 700
        }}>
          <Icon sx={{ fontSize: 20 }}>play_circle</Icon>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{Locale.label("mobile.screens.watchLive")}</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      background: `linear-gradient(135deg, ${tc.primary} 0%, ${tc.secondary} 100%)`,
      borderRadius: `${mobileTheme.radius.xl}px`,
      p: `${mobileTheme.spacing.lg}px`,
      mb: `${mobileTheme.spacing.lg}px`,
      boxShadow: mobileTheme.shadows.lg,
      textAlign: "center"
    }}>
      <Typography sx={{
        color: "#FFFFFF",
        fontWeight: 600,
        letterSpacing: 1,
        fontSize: 12,
        textTransform: "uppercase",
        mb: 2
      }}>
        Next Service In
      </Typography>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 3, mb: 2 }}>
        {days > 0 && (
          <Box sx={{ textAlign: "center" }}>
            <Typography sx={{ color: "#FFFFFF", fontWeight: 800, fontSize: 36, lineHeight: 1 }}>{days}</Typography>
            <Typography sx={{ color: "#FFFFFF", opacity: 0.85, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
              {days === 1 ? "Day" : "Days"}
            </Typography>
          </Box>
        )}
        <Box sx={{ textAlign: "center" }}>
          <Typography sx={{ color: "#FFFFFF", fontWeight: 800, fontSize: 36, lineHeight: 1 }}>{hours}</Typography>
          <Typography sx={{ color: "#FFFFFF", opacity: 0.85, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            {hours === 1 ? "Hour" : "Hours"}
          </Typography>
        </Box>
        <Box sx={{ textAlign: "center" }}>
          <Typography sx={{ color: "#FFFFFF", fontWeight: 800, fontSize: 36, lineHeight: 1 }}>{minutes}</Typography>
          <Typography sx={{ color: "#FFFFFF", opacity: 0.85, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>
            {minutes === 1 ? "Minute" : "Minutes"}
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ color: "#FFFFFF", fontWeight: 700, fontSize: 18, mb: 0.5 }}>
        {stream.title}
      </Typography>
      {stream.description && (
        <Typography sx={{ color: "#FFFFFF", opacity: 0.9, fontSize: 14, mb: 1 }}>
          {stream.description}
        </Typography>
      )}
      <Typography sx={{ color: "#FFFFFF", opacity: 0.85, fontSize: 13 }}>
        {formatPrettyDateTime(stream.startDate)}
      </Typography>
    </Box>
  );
};
