"use client";

import { useContext, useEffect, useState } from "react";
import { UserHelper } from "@churchapps/apphelper";
import type { EventInterface, GroupInterface, GroupMemberInterface } from "@churchapps/helpers";
import { UnauthenticatedView } from "./UnauthenticatedView";
import { AuthenticatedView } from "./AuthenticatedView";
import { ConfigurationInterface } from "@/helpers/ConfigHelper";
import UserContext from "@/context/UserContext";

interface Props {
  config: ConfigurationInterface
  group: GroupInterface | null;
  events: EventInterface[];
  leaders: GroupMemberInterface[];
}

export function GroupClient(props: Props) {
  const context = useContext(UserContext);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Give UserContext time to restore JWT from cookie before deciding which view to show.
    // We watch the context object; once it's been initialised (user is set OR explicitly null),
    // we consider auth resolved.
    if (context !== undefined) {
      setAuthChecked(true);
    }
  }, [context?.user, context?.userChurch]);

  // Handle case where group doesn't exist
  if (!props.group) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Group Not Found</h1>
        <p>The group you're looking for could not be found.</p>
      </div>
    );
  }

  // Wait until auth state is known to avoid flashing the unauthenticated view
  if (!authChecked) return null;

  const isAuthenticated = !!(context?.userChurch?.person?.id || UserHelper.currentUserChurch?.person?.id);

  if (!isAuthenticated) return <UnauthenticatedView config={props.config} group={props.group} events={props.events} leaders={props.leaders} />;
  return <AuthenticatedView config={props.config} group={props.group} />;
}
