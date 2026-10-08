"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Box, Icon, Typography } from "@mui/material";
import { useUpcomingStream } from "@/app/[sdSlug]/mobile/hooks/useUpcomingStream";

interface Props {
  keyName?: string;
}

const formatPrettyDateTime = (date: Date) => {
  try {
    const d = date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    const t = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${d} at ${t}`;
  } catch {
    return date.toString();
  }
};

// Shown on the public live-stream page while no service is broadcasting.
// Displays a live countdown to the next service configured under
// Sermons > Live Stream Times in the admin site.
export const NextServiceCountdown: React.FC<Props> = ({ keyName }) => {
  const stream = useUpcomingStream(keyName);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = useMemo(() => {
    if (!now || !stream) return null;
    const diff = Math.max(0, Math.floor((stream.startDate.getTime() - now.getTime()) / 1000));
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return { days, hours, minutes, seconds };
  }, [now, stream]);

  const card = (children: React.ReactNode) => (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        maxWidth: 720,
        margin: "0 auto",
        aspectRatio: "16/9",
        borderRadius: 2,
        overflow: "hidden",
        background: "linear-gradient(135deg, #1565C0 0%, #0D47A1 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        p: 3
      }}
    >
      {children}
    </Box>
  );

  if (!stream) {
    return card(
      <Box>
        <Icon sx={{ fontSize: 56, color: "#FFFFFF", opacity: 0.8, mb: 1 }}>live_tv</Icon>
        <Typography sx={{ color: "#FFFFFF", fontSize: 20, fontWeight: 600 }}>
          We're not live right now
        </Typography>
        <Typography sx={{ color: "#FFFFFF", opacity: 0.85, fontSize: 15 }}>
          Check back during service times.
        </Typography>
      </Box>
    );
  }

  const unit = (value: number, label: string, hide = false) =>
    hide ? null : (
      <Box key={label} sx={{ textAlign: "center", minWidth: 72 }}>
        <Typography sx={{ color: "#FFFFFF", fontWeight: 800, fontSize: { xs: 34, sm: 52 }, lineHeight: 1 }}>
          {String(value).padStart(2, "0")}
        </Typography>
        <Typography sx={{ color: "#FFFFFF", opacity: 0.85, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
          {label}
        </Typography>
      </Box>
    );

  return card(
    <Box>
      <Typography sx={{ color: "#FFFFFF", fontWeight: 600, letterSpacing: 1.5, fontSize: 13, textTransform: "uppercase", mb: 2 }}>
        Next Live Service In
      </Typography>
      <Box sx={{ display: "flex", justifyContent: "center", gap: { xs: 2, sm: 4 }, mb: 2 }}>
        {remaining && (
          <>
            {unit(remaining.days, "Days", remaining.days === 0)}
            {unit(remaining.hours, "Hours")}
            {unit(remaining.minutes, "Minutes")}
            {unit(remaining.seconds, "Seconds")}
          </>
        )}
      </Box>
      <Typography sx={{ color: "#FFFFFF", fontWeight: 700, fontSize: { xs: 18, sm: 22 }, mb: 0.5 }}>
        {stream.title}
      </Typography>
      {stream.description && (
        <Typography sx={{ color: "#FFFFFF", opacity: 0.9, fontSize: 14, mb: 1 }}>{stream.description}</Typography>
      )}
      <Typography sx={{ color: "#FFFFFF", opacity: 0.85, fontSize: 14 }}>{formatPrettyDateTime(stream.startDate)}</Typography>
    </Box>
  );
};
