"use client";

import React, { useEffect, useState } from "react";
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Typography } from "@mui/material";
import { ApiHelper } from "@churchapps/apphelper";

const fields = [
  ["newRequest", "New appointment requests"],
  ["approved", "Appointment approved"],
  ["rejected", "Appointment rejected"],
  ["rescheduled", "Appointment rescheduled"],
  ["rescheduleResponse", "Reschedule responses"],
  ["cancelled", "Cancellations"],
  ["reminder24h", "24-hour reminder"],
  ["reminder1h", "1-hour reminder"],
  ["reminder30m", "30-minute reminder"]
] as const;

export const AppointmentNotificationSettings = () => {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) ApiHelper.get("/appointments/preferences/my", "ContentApi").then((data) => setValues(data || {})); }, [open]);
  const save = async () => { setSaving(true); try { await ApiHelper.post("/appointments/preferences/my", values, "ContentApi"); setOpen(false); } finally { setSaving(false); } };
  return <>
    <Button size="small" onClick={() => setOpen(true)}>Notification Settings</Button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Appointment Notifications</DialogTitle><DialogContent><Stack mt={1}>
      <Typography variant="subtitle2">Channels</Typography>
      <FormControlLabel control={<Checkbox checked={values.inAppEnabled !== false} onChange={(e) => setValues({ ...values, inAppEnabled: e.target.checked })} />} label="In-app notifications" />
      <FormControlLabel control={<Checkbox checked={values.emailEnabled !== false} onChange={(e) => setValues({ ...values, emailEnabled: e.target.checked })} />} label="Email notifications" />
      <Typography variant="subtitle2" mt={1}>Events and reminders</Typography>
      {fields.map(([key, label]) => <FormControlLabel key={key} control={<Checkbox checked={values[key] !== false && (key !== "reminder30m" || values[key] === true)} onChange={(e) => setValues({ ...values, [key]: e.target.checked })} />} label={label} />)}
    </Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save} disabled={saving}>Save</Button></DialogActions></Dialog>
  </>;
};
