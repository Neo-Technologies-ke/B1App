"use client";

import React from "react";
import { Box, Icon, Typography } from "@mui/material";
import { ConfigurationInterface } from "@/helpers/ConfigHelper";
import { LiveStream } from "@/components/video/LiveStream";
import { mobileTheme } from "../mobileTheme";
import { LiveStreamCard } from "../LiveStreamCard";
import { useUpcomingStream } from "../../hooks/useUpcomingStream";

interface Props {
  config: ConfigurationInterface;
}

export const StreamPage = ({ config }: Props) => {
  const tc = mobileTheme.colors;
  const keyName = config?.church?.subDomain;
  const upcomingStream = useUpcomingStream(keyName);

  // While a service is actually live, the LiveStream video player takes over.
  // Once it's over (or if nothing is currently live), show the admin-configured
  // upcoming session - if one has been scheduled - instead of a plain "offline" message.
  const noUpcomingSession = (
    <Box sx={{
      position: "relative",
      width: "100%",
      paddingTop: "56.25%",
      borderRadius: `${mobileTheme.radius.xl}px`,
      overflow: "hidden",
      boxShadow: mobileTheme.shadows.md,
      bgcolor: "#000000"
    }}>
      <Box sx={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
        textAlign: "center"
      }}>
        <Icon sx={{ fontSize: 48, color: "#FFFFFF", opacity: 0.8, mb: 1 }}>live_tv</Icon>
        <Typography sx={{ color: "#FFFFFF", fontSize: 16, fontWeight: 600, mb: 0.5 }}>
          We're not live right now
        </Typography>
        <Typography sx={{ color: "#FFFFFF", opacity: 0.8, fontSize: 14 }}>
          Check back during service times.
        </Typography>
      </Box>
    </Box>
  );

  const offlineContent = upcomingStream && !upcomingStream.isLive
    ? <LiveStreamCard stream={upcomingStream} onClickLive={() => {}} />
    : noUpcomingSession;

  return (
    <Box sx={{ p: `${mobileTheme.spacing.md}px`, bgcolor: tc.surface, minHeight: "100%" }}>
      {keyName ? (
        <LiveStream
          keyName={keyName}
          appearance={config?.appearance}
          includeHeader={false}
          includeInteraction={true}
          offlineContent={offlineContent}
        />
      ) : offlineContent}
    </Box>
  );
};
