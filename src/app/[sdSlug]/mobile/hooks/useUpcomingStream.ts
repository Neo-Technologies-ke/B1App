"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { EnvironmentHelper } from "@/helpers/EnvironmentHelper";

export interface StreamService {
  id?: string;
  serviceTime?: string;
  earlyStart?: string;
  label?: string;
  sermon?: { title?: string; description?: string; duration?: number };
}

export interface StreamConfigPayload {
  services?: StreamService[];
}

export interface UpcomingStream {
  startDate: Date;
  title: string;
  description: string;
  isLive: boolean;
}

const getSecondsFromDisplay = (value?: string) => {
  if (!value) return 0;
  try {
    const parts = value.split(":");
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  } catch {
    return 0;
  }
};

// Polls the church's public stream config (the same "services" data the admin
// configures under Sermons > Live Stream Times) and derives the next upcoming
// or currently-live session, if one is scheduled within the next 24 hours.
export function useUpcomingStream(keyName?: string) {
  const { data: streamConfig } = useQuery<StreamConfigPayload | null>({
    queryKey: ["upcoming-stream-config", keyName],
    queryFn: async () => {
      try {
        const res = await fetch(`${EnvironmentHelper.Common.ContentApi}/preview/data/${keyName}`);
        if (!res.ok) return null;
        return (await res.json()) as StreamConfigPayload;
      } catch {
        return null;
      }
    },
    enabled: !!keyName,
    refetchInterval: 60 * 1000,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000
  });

  const upcomingStream = useMemo<UpcomingStream | null>(() => {
    const services = streamConfig?.services;
    if (!services || services.length === 0) return null;
    const now = new Date();
    let best: { service: StreamService; start: Date; end: Date } | null = null;
    for (const s of services) {
      if (!s.serviceTime) continue;
      const start = new Date(s.serviceTime);
      if (isNaN(start.getTime())) continue;
      const earlySeconds = getSecondsFromDisplay(s.earlyStart);
      const liveStart = new Date(start.getTime() - earlySeconds * 1000);

      const runSeconds = s.sermon?.duration || 5400;
      const end = new Date(start.getTime() + runSeconds * 1000);
      if (end <= now) continue;
      if (!best || liveStart < new Date(best.start.getTime() - getSecondsFromDisplay(best.service.earlyStart) * 1000)) {
        best = { service: s, start: liveStart, end };
      }
    }
    if (!best) return null;
    const ms = best.start.getTime() - now.getTime();
    const isLive = ms <= 0 && now <= best.end;
    const withinWindow = isLive || (ms > 0 && ms <= 24 * 60 * 60 * 1000);
    if (!withinWindow) return null;
    return {
      startDate: best.start,
      title: best.service.label || best.service.sermon?.title || "Live Service",
      description: best.service.sermon?.description || "",
      isLive
    };
  }, [streamConfig]);

  return upcomingStream;
}
