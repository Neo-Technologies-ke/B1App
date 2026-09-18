"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { ApiHelper } from "@churchapps/apphelper";
import { mobileTheme } from "../mobileTheme";
import { AppointmentNotificationSettings } from "./AppointmentNotificationSettings";

interface Leader { id: string; displayName: string; title?: string; appointmentDuration?: number; timezone?: string; }
interface Slot { start: string; end: string; }
interface Appointment {
  id: string; leaderId: string; leaderName?: string; reason: string; notes?: string; start: string; end: string; status: string;
  rejectionReason?: string; rescheduleReason?: string;
}

const statusColors: Record<string, "default" | "warning" | "success" | "error" | "info"> = { pending: "warning", confirmed: "success", rejected: "error", awaitingUserConfirmation: "info", rescheduled: "success", cancelled: "default", completed: "success", noShow: "error", rescheduleRequested: "warning" };
const formatDateTime = (value: string) => new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const AppointmentsPanel = () => {
  const tc = mobileTheme.colors;
  const queryClient = useQueryClient();
  const [showBook, setShowBook] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [leaderId, setLeaderId] = useState("");
  const [date, setDate] = useState(localDate(new Date(Date.now() + 86400000)));
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const leaders = useQuery<Leader[]>({ queryKey: ["appointment-leaders"], queryFn: async () => (await ApiHelper.get("/appointments/leaders", "ContentApi")) || [] });
  const appointments = useQuery<Appointment[]>({ queryKey: ["my-appointments"], queryFn: async () => (await ApiHelper.get("/appointments/my", "ContentApi")) || [] });
  const slots = useQuery<Slot[]>({
    queryKey: ["appointment-slots", leaderId, date],
    queryFn: async () => (await ApiHelper.get(`/appointments/leaders/${leaderId}/slots?date=${date}`, "ContentApi")) || [],
    enabled: !!leaderId && !!date
  });
  const details = useQuery<any>({
    queryKey: ["appointment-details", selectedAppointment?.id],
    queryFn: async () => await ApiHelper.get(`/appointments/${selectedAppointment?.id}`, "ContentApi"),
    enabled: !!selectedAppointment?.id
  });
  const appointmentList = useMemo(() => (appointments.data || []).slice().sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime()), [appointments.data]);

  const reset = () => {
    setSlot(""); setReason(""); setNotes(""); setError(""); setShowBook(false);
  };

  const submit = async () => {
    const selected = (slots.data || []).find((item) => item.start === slot);
    if (!leaderId || !selected || !reason.trim()) { setError("Select a leader, available time, and enter a reason."); return; }
    setSaving(true); setError("");
    try {
      await ApiHelper.post("/appointments", { leaderId, start: selected.start, end: selected.end, reason: reason.trim(), notes: notes.trim() }, "ContentApi");
      await queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
      reset();
    } catch (e: any) { setError(e?.message || "Unable to request appointment."); } finally { setSaving(false); }
  };

  const respond = async (accept: boolean) => {
    if (!selectedAppointment) return;
    setSaving(true);
    try {
      await ApiHelper.post(`/appointments/${selectedAppointment.id}/respond`, { accept }, "ContentApi");
      await queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
      if (!accept) {
        setLeaderId(selectedAppointment.leaderId);
        setShowBook(true);
      }
      setSelectedAppointment(null);
    } finally { setSaving(false); }
  };

  const cancel = async () => {
    if (!selectedAppointment) return;
    setSaving(true);
    try {
      await ApiHelper.post(`/appointments/${selectedAppointment.id}/cancel`, {}, "ContentApi");
      await queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
      setSelectedAppointment(null);
    } finally { setSaving(false); }
  };

  return (
    <Box sx={{ bgcolor: tc.surface, borderRadius: `${mobileTheme.radius.lg}px`, boxShadow: mobileTheme.shadows.sm, p: `${mobileTheme.spacing.md}px` }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Box>
          <Typography sx={{ fontSize: 17, fontWeight: 700, color: tc.text }}>Appointments</Typography>
          <Typography sx={{ fontSize: 12, color: tc.textSecondary }}>Meet with a leader or pastor</Typography>
        </Box>
        <Stack direction="row" spacing={0.5}><AppointmentNotificationSettings /><Button variant="contained" size="small" onClick={() => setShowBook(true)}>Book Appointment</Button></Stack>
      </Stack>
      {appointments.isLoading && <Typography sx={{ fontSize: 13 }}>Loading appointments…</Typography>}
      {!appointments.isLoading && appointmentList.length === 0 && <Typography sx={{ fontSize: 13, color: tc.textMuted }}>No appointment requests.</Typography>}
      <Stack spacing={1}>
        {appointmentList.map((item) => (
          <Box key={item.id} role="button" tabIndex={0} onClick={() => setSelectedAppointment(item)} sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 2, cursor: "pointer" }}>
            <Stack direction="row" justifyContent="space-between" gap={1}>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{item.leaderName}</Typography>
              <Chip size="small" color={statusColors[item.status] || "default"} label={item.status.replace(/([A-Z])/g, " $1")} />
            </Stack>
            <Typography sx={{ fontSize: 12, color: tc.textSecondary }}>{formatDateTime(item.start)}</Typography>
            <Typography sx={{ fontSize: 13, mt: 0.5 }}>{item.reason}</Typography>
          </Box>
        ))}
      </Stack>

      <Dialog open={showBook} onClose={reset} fullWidth maxWidth="sm">
        <DialogTitle>Book an Appointment</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select fullWidth label="Leader or Pastor" value={leaderId} onChange={(e) => { setLeaderId(e.target.value); setSlot(""); }}>
            {(leaders.data || []).map((leader) => <MenuItem key={leader.id} value={leader.id}>{leader.title ? `${leader.title} ` : ""}{leader.displayName}</MenuItem>)}
          </TextField>
          <TextField fullWidth type="date" label="Date" value={date} onChange={(e) => { setDate(e.target.value); setSlot(""); }} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: localDate(new Date()) } }} />
          <TextField select fullWidth label="Available Time" value={slot} onChange={(e) => setSlot(e.target.value)} disabled={!leaderId || slots.isLoading}>
            {(slots.data || []).map((item) => <MenuItem key={item.start} value={item.start}>{new Date(item.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</MenuItem>)}
          </TextField>
          {leaderId && !slots.isLoading && (slots.data || []).length === 0 && <Alert severity="info">No available times on this date.</Alert>}
          <TextField fullWidth required label="Reason for appointment" value={reason} onChange={(e) => setReason(e.target.value)} inputProps={{ maxLength: 500 }} />
          <TextField fullWidth multiline minRows={3} label="Additional notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={reset}>Cancel</Button><Button variant="contained" onClick={submit} disabled={saving}>Submit Request</Button></DialogActions>
      </Dialog>

      <Dialog open={!!selectedAppointment} onClose={() => setSelectedAppointment(null)} fullWidth maxWidth="sm">
        <DialogTitle>Appointment Details</DialogTitle>
        <DialogContent>{selectedAppointment && <Stack spacing={1.25} sx={{ mt: 1 }}>
          <Chip sx={{ alignSelf: "flex-start" }} color={statusColors[selectedAppointment.status] || "default"} label={selectedAppointment.status.replace(/([A-Z])/g, " $1")} />
          <Typography><strong>Leader:</strong> {selectedAppointment.leaderName}</Typography>
          <Typography><strong>Date:</strong> {formatDateTime(selectedAppointment.start)}</Typography>
          <Typography><strong>Reason:</strong> {selectedAppointment.reason}</Typography>
          {selectedAppointment.notes && <Typography><strong>Notes:</strong> {selectedAppointment.notes}</Typography>}
          {selectedAppointment.rejectionReason && <Alert severity="error">{selectedAppointment.rejectionReason}</Alert>}
          {selectedAppointment.rescheduleReason && <Alert severity="info">{selectedAppointment.rescheduleReason}</Alert>}
          {(details.data?.history || []).length > 0 && <Box><Typography fontWeight={600} mb={0.5}>History</Typography>{details.data.history.map((item: any) => <Typography key={item.id} sx={{ fontSize: 12, color: tc.textSecondary }}>{new Date(item.createdAt).toLocaleString()} — {item.action}{item.reason ? `: ${item.reason}` : ""}</Typography>)}</Box>}
        </Stack>}</DialogContent>
        <DialogActions>
          {selectedAppointment?.status === "awaitingUserConfirmation" && <><Button onClick={() => respond(false)} disabled={saving}>Not Available</Button><Button variant="contained" onClick={() => respond(true)} disabled={saving}>Accept New Date</Button></>}
          {selectedAppointment && ["pending", "confirmed", "rescheduled", "awaitingUserConfirmation"].includes(selectedAppointment.status) && <Button color="error" onClick={cancel} disabled={saving}>Cancel Appointment</Button>}
          <Button onClick={() => setSelectedAppointment(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
