"use client";

import { LiveStream } from "@/components/video/LiveStream";
import { NextServiceCountdown } from "@/components/video/NextServiceCountdown";
import { ConfigurationInterface } from "@/helpers/ConfigHelper";
import { Locale } from "@churchapps/apphelper";
import { Container } from "@mui/material";


type Props = {
  config?: ConfigurationInterface
};

export function StreamPage(props: Props) {
  const keyName = props.config?.church?.subDomain;

  return (
    <Container>
      <h1 style={{ textAlign: "center" }}>{Locale.label("pageSlug.liveStream")}</h1>
      <LiveStream includeHeader={false} includeInteraction={true} keyName={keyName} appearance={props.config?.appearance} offlineContent={<NextServiceCountdown keyName={keyName} />} />
    </Container>
  );
}
