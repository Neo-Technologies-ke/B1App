"use client";

import { useState, useEffect, useContext } from "react";
import { Grid, Container } from "@mui/material";
import { UserHelper } from "@churchapps/apphelper";
import { DisplayBox } from "@churchapps/apphelper";
import type { GroupInterface } from "@churchapps/helpers";
import { Permissions } from "@churchapps/helpers";
import UserContext from "@/context/UserContext";
import { GroupResources } from "@/components/groups/GroupResources";
import { GroupLeaderResources } from "@/components/groups/GroupLeaderResources";
import { ConfigurationInterface } from "@/helpers/ConfigHelper";
import { GroupHero } from "./GroupHero";
import { GroupTabs } from "./GroupTabs";
import { LeaderEdit } from "./LeaderEdit";
import React from "react";
import { MembersTab } from "./MembersTab";
import { AttendanceTab } from "./AttendanceTab";
import { ConversationsTab } from "./ConversationsTab";

interface Props {
  config: ConfigurationInterface;
  group: GroupInterface;
  addedCallback?: () => void;
}

export function AuthenticatedView(props: Props) {
  const [tab, setTab] = useState("details");
  const [group, setGroup] = useState(props.group);
  const context = useContext(UserContext);

  useEffect(() => {
    setGroup(props.group);
  }, [props.group]);

  const [isLeader, setIsLeader] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    let leader = false;
    let member = false;
    const groups = context?.userChurch?.groups || UserHelper.currentUserChurch?.groups;
    groups?.forEach((g) => {
      if (g.id === group?.id) {
        member = true;
        if (g.leader) leader = true;
      }
    });
    setIsLeader(leader);
    setIsMember(member);
  }, [context?.userChurch, group?.id]);

  const canEditGroup = isLeader || UserHelper.checkAccess(Permissions.membershipApi.groups.edit);
  const canEditMembers = isLeader || UserHelper.checkAccess(Permissions.membershipApi.groupMembers.edit);
  const canViewMembers = isMember || canEditMembers;

  const handleChange = (g: GroupInterface) => {
    setGroup(g);
  };

  const getTabContent = () => {
    let result = <></>;
    switch (tab) {
      case "details":
        result = <>
          {canEditGroup && <LeaderEdit group={group} config={props.config} onChange={handleChange} updatedFunction={handleChange} />}
          <h2>Details</h2>
          <div style={{ paddingTop: "1rem", paddingBottom: "3rem" }}>
            <div style={{whiteSpace: "pre-wrap"}}>{group.about}</div>
          </div>
        </>;
        break;
      case "conversations": result = <ConversationsTab context={context} groupId={group.id} isLeader={isLeader} />; break;
      case "resources": result = <><h2>Resources</h2><GroupResources context={context} groupId={group.id} /></>; break;
      case "leaderResources": result = <><h2>Resources (Leaders Only)</h2><GroupLeaderResources context={context} groupId={group.id} /></>; break;
      case "members": result = canViewMembers ? <MembersTab isLeader={isLeader} canEditMembers={canEditMembers} group={group} /> : <p>You must be a member of this group to view its members.</p>; break;
      case "attendance": result = <AttendanceTab group={group} />; break;
    }
    return result;
  };

  return (
    <>
      <GroupHero group={group} />
      <Container>
        <div id="mainContent">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 2 }}>
              <div className="sideNav">
                <GroupTabs config={props.config} onTabChange={(val: string) => { setTab(val); }} group={group} />
              </div>
            </Grid>
            <Grid size={{ xs: 12, md: 10 }}>
              {group
                ? (<>{getTabContent()}</>)
                : (<p>No group data found</p>)}
            </Grid>
          </Grid>
        </div>

      </Container>
    </>
  );
}
