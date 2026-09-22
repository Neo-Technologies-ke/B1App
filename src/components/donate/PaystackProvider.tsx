"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { Alert, Box, Checkbox, FormControlLabel, FormGroup, Grid, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import ReCAPTCHA from "react-google-recaptcha";
import { ApiHelper, CurrencyHelper, ErrorMessages, InputBox, Locale } from "@churchapps/apphelper";
import { FundDonations, registerPaymentProvider } from "@churchapps/apphelper/donations";
import type {
  ChargeContext,
  GuestFormProps,
  MemberEntryHandle,
  MemberEntryProps,
  PaymentProvider,
  PaymentToken
} from "@churchapps/apphelper/donations";
import type { FundDonationInterface, FundInterface } from "@churchapps/helpers";
import { generatePaystackReference, loadPaystackInlineScript } from "./paystackInline";

const DEFAULT_CHANNELS = ["card", "mobile_money", "bank", "ussd"];
const getDisplayCurrency = (currency?: string) => (currency || "kes").toLowerCase();

interface OpenCheckoutOptions {
  publicKey: string;
  email: string;
  amount: number; // major currency unit (e.g. 500.00 KES)
  currency: string;
  churchId: string;
  channels?: string[];
  metadata: Record<string, unknown>;
}

// Opens Paystack's Inline popup and resolves with the transaction reference once the
// donor completes payment. The popup itself lets the donor pick Card or M-Pesa
// (mobile money) — we never ask them to choose a "processor" up front. The backend
// re-verifies this reference server-to-server before it is ever treated as a real
// donation, so nothing here is trusted for the actual charge outcome.
async function openPaystackCheckout(options: OpenCheckoutOptions): Promise<string> {
  await loadPaystackInlineScript();
  if (typeof window === "undefined" || !window.PaystackPop) {
    throw new Error("Paystack checkout could not be loaded. Please check your connection and try again.");
  }

  return new Promise<string>((resolve, reject) => {
    const reference = generatePaystackReference(options.churchId);
    window.PaystackPop!.setup({
      key: options.publicKey,
      email: options.email,
      amount: Math.round(options.amount * 100),
      currency: (options.currency || "KES").toUpperCase(),
      ref: reference,
      channels: options.channels?.length ? options.channels : DEFAULT_CHANNELS,
      metadata: options.metadata,
      callback: (response) => resolve(response?.reference || reference),
      onClose: () => reject(new Error("Payment window closed before completing."))
    }).openIframe();
  });
}

async function initiateMpesa(ctx: ChargeContext, gateway: MemberEntryProps["gateway"], phone: string): Promise<string> {
  const initiated: any = await ApiHelper.post("/donate/mpesa/initiate", {
    churchId: ctx.churchId,
    gatewayId: gateway.id,
    phone,
    email: ctx.person?.email,
    amount: ctx.amount,
    currency: ctx.currency || gateway.currency || "kes",
    funds: ctx.funds,
    person: ctx.person,
    notes: ctx.notes
  }, "GivingApi");
  const reference = initiated?.reference;
  if (!reference) throw new Error(initiated?.error || "M-PESA payment could not be initiated.");
  for (let attempt = 0; attempt < 40; attempt++) {
    const status: any = await ApiHelper.post("/donate/mpesa/status", { churchId: ctx.churchId, gatewayId: gateway.id, reference }, "GivingApi");
    if (status?.status === "success") return reference;
    if (["failed", "abandoned", "reversed"].includes(status?.status)) throw new Error(status?.gatewayResponse || "M-PESA payment was not completed.");
    await new Promise((resolve) => window.setTimeout(resolve, 3000));
  }
  throw new Error("M-PESA confirmation is taking longer than expected. Check your phone, then try again if necessary.");
}

function buildPaystackChargeBody(ctx: ChargeContext, token: PaymentToken) {
  return {
    provider: "paystack",
    gatewayId: ctx.gatewayId,
    id: token.id,
    churchId: ctx.churchId,
    amount: ctx.amount,
    funds: ctx.funds,
    person: ctx.person,
    notes: ctx.notes || "",
    currency: ctx.currency,
    church: ctx.church
  };
}

// Member entry: the same Inline popup as the guest form, so a logged-in donor never
// leaves the page (no redirect/session-restore workaround needed).
type PaystackMemberEntryProps = MemberEntryProps & { onPaymentMethodNameChange?: (name: string) => void };
const PaystackMemberEntry = forwardRef<MemberEntryHandle, PaystackMemberEntryProps>(({ gateway, getContext, onPaymentMethodNameChange }, ref) => {
  const [paymentType, setPaymentType] = useState<"card" | "mpesa">("mpesa");
  const testMode = ["staging", "test", "sandbox"].includes(String(gateway.environment || "").toLowerCase());
  const [phone, setPhone] = useState(testMode ? "+254710000000" : "");
  const [waiting, setWaiting] = useState(false);
  useEffect(() => { onPaymentMethodNameChange?.(paymentType === "mpesa" ? "M-PESA (Paystack)" : "Card (Paystack)"); }, [paymentType, onPaymentMethodNameChange]);
  useImperativeHandle(ref, () => ({
    tokenize: async (): Promise<PaymentToken> => {
      const ctx = getContext?.();
      if (!ctx) throw new Error("Donation details are not available.");
      if (paymentType === "mpesa") {
        if (!phone.trim()) throw new Error("Enter the Safaricom phone number that should receive the M-PESA prompt.");
        setWaiting(true);
        try { return { id: await initiateMpesa(ctx, gateway, phone), type: "bank" }; } finally { setWaiting(false); }
      }
      const reference = await openPaystackCheckout({
        publicKey: gateway.publicKey || "",
        email: ctx.person?.email || "",
        amount: ctx.amount,
        currency: ctx.currency || gateway.currency || "kes",
        churchId: ctx.churchId,
        channels: ["card"],
        metadata: {
          funds: JSON.stringify(ctx.funds || []),
          notes: ctx.notes || "",
          personId: ctx.person?.id || "",
          churchId: ctx.churchId
        }
      });
      return { id: reference, type: "card" };
    }
  }));
  return <Stack spacing={1.5}>
    <ToggleButtonGroup value={paymentType} exclusive fullWidth size="small" onChange={(_, value) => value && setPaymentType(value)}>
      <ToggleButton value="mpesa">M-PESA</ToggleButton><ToggleButton value="card">Card</ToggleButton>
    </ToggleButtonGroup>
    {paymentType === "mpesa" ? <>
      <TextField fullWidth label="M-PESA phone number" placeholder="0710000000" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={waiting} inputProps={{ inputMode: "tel" }} />
      <Typography variant="body2" color="text.secondary">{waiting ? "Check your phone and enter your M-PESA PIN to approve the payment…" : testMode ? "Paystack test mode uses +254710000000 and does not send a real handset prompt." : "An M-PESA payment prompt will be sent to this phone."}</Typography>
    </> : <Typography variant="body2" color="text.secondary">Click <b>Preview Donation</b>, then enter your card details in the secure Paystack checkout window.</Typography>}
  </Stack>;
});
PaystackMemberEntry.displayName = "PaystackMemberEntry";

// Standalone guest donation form. Mirrors the existing Kingdom Funding / PayPal guest
// forms (name/email/recaptcha/fund selection), swapping the card-tokenization widget
// for the Paystack popup.
const PaystackGuestForm: React.FC<GuestFormProps> = ({ mainContainerCssProps, showHeader = true, ...props }) => {
  const allowSingleGift = props.allowSingleGift !== false;
  const showFundSelector = props.showFundSelector !== false;
  const allowedFundIds = Array.isArray(props.allowedFundIds) ? props.allowedFundIds : [];

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [fundsTotal, setFundsTotal] = useState(0);
  const [transactionFee, setTransactionFee] = useState(0);
  const [total, setTotal] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [fundDonations, setFundDonations] = useState<FundDonationInterface[]>([]);
  const [funds, setFunds] = useState<FundInterface[]>([]);
  const [donationComplete, setDonationComplete] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentType, setPaymentType] = useState<"card" | "mpesa">("mpesa");
  const testMode = ["staging", "test", "sandbox"].includes(String(props.gateway?.environment || "").toLowerCase());
  const [phone, setPhone] = useState(testMode ? "+254710000000" : "");
  const [coverFees, setCoverFees] = useState(false);
  const [captchaResponse, setCaptchaResponse] = useState("");
  const [church, setChurch] = useState<{ name?: string; subDomain?: string } | null>(null);
  const [searchParams, setSearchParams] = useState<{ fundId: string | null; amount: string | null } | null>(null);
  const displayCurrency = getDisplayCurrency(props.gateway?.currency);

  useEffect(() => {
    const getUrlParam = (param: string) => {
      if (typeof window === "undefined") return null;
      return new URLSearchParams(window.location.search).get(param);
    };
    const fundId = getUrlParam("fundId");
    const amount = getUrlParam("amount");
    setSearchParams({ fundId, amount });

    ApiHelper.get("/funds/churchId/" + props.churchId, "GivingApi").then((data: FundInterface[]) => {
      const filtered = allowedFundIds.length > 0 ? (data || []).filter((f) => allowedFundIds.includes(f.id as string)) : (data || []);
      setFunds(filtered);
      const preferredId = props.defaultFundId || (fundId && fundId !== "" ? fundId : "") || (filtered.length > 0 ? filtered[0].id : "");
      const initialFund = filtered.find((f) => f.id === preferredId);
      if (initialFund) setFundDonations([{ fundId: initialFund.id, amount: amount && amount !== "" ? parseFloat(amount) : 0 } as FundDonationInterface]);
    });
    ApiHelper.get("/churches/" + props.churchId, "MembershipApi").then((data: any) => setChurch(data));
  }, [props.churchId]);

  const handleCaptchaChange = (value: string | null) => {
    if (!value) { setCaptchaResponse(""); return; }
    ApiHelper.postAnonymous("/donate/captcha-verify", { token: value }, "GivingApi")
      .then((data: any) => {
        if (data.response === "success" || data.response === "human" || data.success === true || data.score >= 0.5) setCaptchaResponse("success");
        else setCaptchaResponse(data.response || "robot");
      })
      .catch(() => setCaptchaResponse("error"));
  };

  const getTransactionFee = async (amount: number) => {
    if (amount <= 0) return 0;
    try {
      const response: any = await ApiHelper.post("/donate/fee?churchId=" + props.churchId, { amount, provider: "paystack", gatewayId: props.gateway?.id }, "GivingApi");
      return response.calculatedFee;
    } catch {
      return 0;
    }
  };

  const handleFundDonationsChange = async (fd: FundDonationInterface[]) => {
    setFundDonations(fd);
    let totalAmount = 0;
    fd.forEach((row) => { totalAmount += row.amount || 0; });
    setFundsTotal(totalAmount);
    const fee = await getTransactionFee(totalAmount);
    setTransactionFee(fee);
    if (props.gateway?.payFees === true) setTotal(totalAmount + fee);
    else setTotal(coverFees ? totalAmount + fee : totalAmount);
  };

  const handleCheckChange = (_e: React.SyntheticEvent, checked: boolean) => {
    setCoverFees(checked);
    setTotal(checked ? fundsTotal + transactionFee : fundsTotal);
  };

  const validate = () => {
    const result: string[] = [];
    if (!firstName) result.push(Locale.label("donation.donationForm.validate.firstName"));
    if (!lastName) result.push(Locale.label("donation.donationForm.validate.lastName"));
    if (!email) result.push(Locale.label("donation.donationForm.validate.email"));
    if (paymentType === "mpesa" && !phone.trim()) result.push("Enter the Safaricom phone number that should receive the M-PESA prompt.");
    if (fundsTotal === 0) result.push(Locale.label("donation.donationForm.validate.amount"));
    if (result.length === 0 && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) result.push(Locale.label("donation.donationForm.validate.validEmail"));
    setErrors(result);
    return result.length === 0;
  };

  const processDonation = async (person: any) => {
    const compactFunds = fundDonations.filter((fd) => (fd.amount || 0) > 0 && fd.fundId).map((fd) => ({ id: fd.fundId, amount: fd.amount || 0 }));
    const churchObj = {
      name: church?.name || "",
      subDomain: church?.subDomain || "",
      churchURL: typeof window !== "undefined" ? window.location.origin : "",
      logo: props?.churchLogo || ""
    };

    try {
      const personData = { id: person?.id || "", email, name: `${firstName} ${lastName}` };
      const reference = paymentType === "mpesa"
        ? await initiateMpesa({ provider: "paystack", gatewayId: props.gateway?.id, churchId: props.churchId, amount: total, funds: compactFunds, person: personData, notes, church: churchObj, recurring: false, saveCard: false, currency: props.gateway?.currency || "kes" } as ChargeContext, props.gateway, phone)
        : await openPaystackCheckout({
          publicKey: props.gateway?.publicKey || "",
          email,
          amount: total,
          currency: props.gateway?.currency || "kes",
          churchId: props.churchId,
          channels: ["card"],
          metadata: { funds: JSON.stringify(compactFunds), notes, personId: person?.id || "", churchId: props.churchId }
        });

      const results: any = await ApiHelper.post("/donate/charge", {
        provider: "paystack",
        gatewayId: props.gateway?.id,
        id: reference,
        churchId: props.churchId,
        amount: total,
        funds: compactFunds,
        person: personData,
        notes,
        church: churchObj
      }, "GivingApi");

      if (results?.status === "succeeded") setDonationComplete(true);
      else setErrors([results?.error || results?.message || Locale.label("donation.common.error")]);
    } catch (err: any) {
      // A closed popup or failed script load lands here — not a declined payment.
      setErrors([err?.message || Locale.label("donation.common.error")]);
    }
    setProcessing(false);
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (captchaResponse !== "success") {
      setErrors([Locale.label("donation.kingdomFunding.validate.captchaRequired")]);
      return;
    }
    setProcessing(true);
    try {
      await ApiHelper.post("/users/loadOrCreate", { userEmail: email, firstName, lastName }, "MembershipApi");
      const person = await ApiHelper.post("/people/loadOrCreate", { churchId: props.churchId, firstName, lastName, email }, "MembershipApi");
      await processDonation(person);
    } catch (ex: any) {
      setErrors([ex.toString()]);
      setProcessing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.currentTarget.value;
    switch (e.currentTarget.name) {
      case "firstName": setFirstName(val); break;
      case "lastName": setLastName(val); break;
      case "email": setEmail(val); break;
      case "notes": setNotes(val); break;
    }
  };

  if (donationComplete) return <Alert severity="success">{Locale.label("donation.donationForm.thankYou")}</Alert>;

  return (
    <InputBox
      headerIcon={showHeader ? "volunteer_activism" : ""}
      headerText={showHeader ? Locale.label("donation.donationForm.donate") : ""}
      saveFunction={handleSave}
      saveText={Locale.label("donation.donationForm.donate")}
      isSubmitting={processing}
      mainContainerCssProps={mainContainerCssProps}
    >
      <ErrorMessages errors={errors} />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField fullWidth label={Locale.label("person.firstName")} name="firstName" value={firstName} onChange={handleChange} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField fullWidth label={Locale.label("person.lastName")} name="lastName" value={lastName} onChange={handleChange} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField fullWidth label={Locale.label("person.email")} name="email" value={email} onChange={handleChange} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ReCAPTCHA sitekey={props.recaptchaSiteKey} onChange={handleCaptchaChange} onExpired={() => setCaptchaResponse("")} onErrored={() => setCaptchaResponse("error")} />
        </Grid>
      </Grid>
      <Box sx={{ mt: 2, mb: 2 }}>
        <ToggleButtonGroup value={paymentType} exclusive fullWidth size="small" onChange={(_, value) => value && setPaymentType(value)}>
          <ToggleButton value="mpesa">M-PESA</ToggleButton><ToggleButton value="card">Card</ToggleButton>
        </ToggleButtonGroup>
        {paymentType === "mpesa" ? <TextField fullWidth sx={{ mt: 2 }} label="M-PESA phone number" placeholder="0710000000" value={phone} onChange={(e) => setPhone(e.target.value)} inputProps={{ inputMode: "tel" }} helperText={testMode ? "Official Paystack test number; no real handset prompt is sent." : "An M-PESA prompt will be sent to this phone."} /> : <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Click <b>Preview Donation</b>, then enter your card details in the secure Paystack checkout window.</Typography>}
      </Box>
      {allowSingleGift && funds.length > 0 && showFundSelector && (
        <>
          <hr />
          <h4>{Locale.label("donation.donationForm.funds")}</h4>
          <FundDonations fundDonations={fundDonations} funds={funds} params={searchParams} updatedFunction={handleFundDonationsChange} />
        </>
      )}
      <TextField fullWidth label={Locale.label("donation.kingdomFunding.memo")} multiline aria-label="note" name="notes" value={notes} onChange={handleChange} style={{ marginTop: 10, marginBottom: 10 }} />
      {fundsTotal > 0 && (
        <div>
          {props.gateway?.payFees === true ? (
            <Typography fontSize={14} fontStyle="italic">*{Locale.label("donation.donationForm.fees").replace("{}", CurrencyHelper.formatCurrencyWithLocale(transactionFee, displayCurrency))}</Typography>
          ) : (
            <FormGroup>
              <FormControlLabel
                control={<Checkbox checked={coverFees} onChange={handleCheckChange} />}
                name="transaction-fee"
                label={Locale.label("donation.donationForm.cover").replace("{}", CurrencyHelper.formatCurrencyWithLocale(transactionFee, displayCurrency))}
              />
            </FormGroup>
          )}
          <p>{Locale.label("donation.donationForm.total")}: {CurrencyHelper.formatCurrencyWithLocale(total, displayCurrency)}</p>
        </div>
      )}
    </InputBox>
  );
};

export const PaystackProvider: PaymentProvider = {
  key: "paystack",
  descriptor: {
    adminValue: "Paystack",
    label: "Paystack (Card & M-Pesa)",
    keyLabels: {
      public: "settings.givingSettingsEdit.paystackPublicKey",
      private: "settings.givingSettingsEdit.paystackSecretKey"
    },
    feeFields: ["paystack"],
    currencies: ["kes", "ngn", "ghs", "zar", "usd"],
    selectableInAdmin: true,
    setupInstructionsKey: "settings.givingSettingsEdit.paystackSetup",
    signupUrl: () => "https://dashboard.paystack.com/#/settings/developer"
  },
  // No saved-card vault or recurring billing in this integration — every donation
  // goes through the Inline popup, which is also the only supported member-entry flow.
  capabilities: { savedCard: false, savedBank: false, guestAch: false, memberNewCard: false, recurring: false, editRecurring: false },
  MemberWrapper: ({ stripePromise, children }) => <Elements stripe={stripePromise ?? null}>{children}</Elements>,
  MemberEntry: PaystackMemberEntry,
  buildChargeRequest: (ctx, token) => ({ endpoint: "/donate/charge", body: buildPaystackChargeBody(ctx, token) }),
  GuestForm: PaystackGuestForm
};

registerPaymentProvider(PaystackProvider);
