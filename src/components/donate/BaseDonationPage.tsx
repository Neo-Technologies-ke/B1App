"use client";

import React from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { RecurringDonations, StripePaymentMethod as AppHelperStripePaymentMethod, MultiGatewayDonationForm, DonationHelper, getPaymentProvider } from "@churchapps/apphelper/donations";
import type { PaymentGateway } from "@churchapps/apphelper/donations";
import "./PaystackProvider";
import { PaymentMethods } from "@churchapps/apphelper/donations";
import { DisplayBox } from "@churchapps/apphelper";
import { ExportLink } from "@churchapps/apphelper";
import { Loading } from "@churchapps/apphelper";
import { ApiHelper } from "@churchapps/apphelper";
import { DateHelper } from "@churchapps/apphelper";
import { UniqueIdHelper } from "@churchapps/apphelper";
import { CurrencyHelper } from "@churchapps/apphelper";
import { Locale } from "@churchapps/apphelper";
import { DonationInterface, PersonInterface, ChurchInterface } from "@churchapps/helpers";
import { Table, TableBody, TableRow, TableCell, TableHead, Alert, Button, Icon, Menu, MenuItem } from "@mui/material";

import Link from "next/link";
import { useMountedState } from "@churchapps/apphelper";

interface Props { personId: string, appName?: string, church?: ChurchInterface, churchLogo?: string }

export const BaseDonationPage: React.FC<Props> = (props) => {
  const [donations, setDonations] = React.useState<DonationInterface[]>([]);
  const [stripePromise, setStripe] = React.useState<Promise<Stripe>>(null);
  const [appHelperPaymentMethods, setAppHelperPaymentMethods] = React.useState<AppHelperStripePaymentMethod[]>(null);
  const [paymentGateways, setPaymentGateways] = React.useState<PaymentGateway[]>([]);
  const [customerId, setCustomerId] = React.useState(null);
  const [person, setPerson] = React.useState<PersonInterface>(null);
  const [message, setMessage] = React.useState<string>(null);
  const [appName, setAppName] = React.useState<string>("");
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const open = Boolean(anchorEl);
  const isMounted = useMountedState();

  const handleClose = () => {
    setAnchorEl(null);
  };

  const loadData = () => {
    if (props?.appName) setAppName(props.appName);
    if (!UniqueIdHelper.isMissing(props.personId)) {
      setIsLoading(true);
      ApiHelper.get("/donations/my", "GivingApi").then((data: DonationInterface[]) => {
        if (isMounted()) {
          setDonations(data);
        }
      });

      const loadGateways = async (): Promise<PaymentGateway[]> => {
        if (props.church?.id) {
          const response = await ApiHelper.getAnonymous("/donate/gateways/" + props.church.id, "GivingApi");
          return Array.isArray(response?.gateways) ? response.gateways : [];
        }
        return await ApiHelper.get("/gateways", "GivingApi");
      };

      void (async () => {
        try {
          const data = await loadGateways();
          if (!isMounted()) return;
          if (!data.length) {
            setAppHelperPaymentMethods([]);
            setIsLoading(false);
            return;
          }

          setPaymentGateways(data);
          const stripeGateway = DonationHelper.findGatewayByProvider(data, "stripe");
          if (stripeGateway?.publicKey) {
            setStripe(loadStripe(stripeGateway.publicKey));
          }

          const supportsSavedMethods = data.some((g) => getPaymentProvider(g.provider).capabilities.savedCard);
          const [results, personData] = await Promise.all([
            supportsSavedMethods
              ? (ApiHelper.get("/paymentmethods/personid/" + props.personId, "GivingApi") as Promise<{ provider?: string; customerId?: string }[]>).catch(() => [])
              : Promise.resolve([]),
            (ApiHelper.get("/people/" + props.personId, "MembershipApi") as Promise<PersonInterface>).catch(() => null)
          ]);
          if (!isMounted()) return;

          const appHelperMethods: AppHelperStripePaymentMethod[] = [];
          let nextCustomerId: string | null = null;
          if (Array.isArray(results)) {
            for (const pm of results) {
              if (getPaymentProvider(pm.provider).capabilities.savedCard) {
                appHelperMethods.push(new AppHelperStripePaymentMethod(pm));
              }
              if (pm.customerId && !nextCustomerId) {
                nextCustomerId = pm.customerId;
              }
            }
          }
          setAppHelperPaymentMethods(appHelperMethods);
          setCustomerId(nextCustomerId);
          setPerson(personData || null);
          setIsLoading(false);
        } catch {
          if (!isMounted()) return;
          setAppHelperPaymentMethods([]);
          setIsLoading(false);
        }
      })();
    } else {
      setAppHelperPaymentMethods([]);
      setDonations([]);
      setIsLoading(false);
    }
  };

  const handleDataUpdate = (message?: string) => {
    setMessage(message);
    // Add a small delay to allow backend to process the donation
    setTimeout(() => {
      loadData();
    }, 2000);
  };

  const getEditContent = () => {
    if (!donations) return [];
    const result: React.ReactElement[] = [];
    const date = new Date();
    const currentY = date.getFullYear();
    const lastY = date.getFullYear() - 1;

    const current_year = donations.filter((d: DonationInterface) => DateHelper.toDate(d.donationDate).getFullYear() === currentY);
    const last_year = donations.filter((d: DonationInterface) => DateHelper.toDate(d.donationDate).getFullYear() === lastY);
    const customHeaders = [
      { label: "amount", key: "amount" },
      { label: "donationDate", key: "donationDate" },
      { label: "fundName", key: "fund.name" },
      { label: "method", key: "method" },
      { label: "methodDetails", key: "methodDetails" }
    ];

    result.push(
      <React.Fragment key="export-menu">
        <Button
          id="download-button"
          aria-controls={open ? "download-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            setAnchorEl(e.currentTarget);
          }}
          data-testid="donation-download-button"
          aria-label={Locale.label("donate.downloadRecords")}
        >
          <Icon>download</Icon>
        </Button>
        <Menu
          id="download-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          MenuListProps={{ "aria-labelledby": "download-button" }}
        >
          <MenuItem onClick={handleClose} dense data-testid="export-current-year-csv" aria-label={Locale.label("donate.exportCurrentYearCsv")}><ExportLink data={current_year} filename="current_year_donations" customHeaders={customHeaders} text={Locale.label("donate.currentYearCsv")} icon="table_chart" data-testid="current-year-export-link" /></MenuItem>
          <MenuItem onClick={handleClose} dense data-testid="print-current-year" aria-label={Locale.label("donate.printCurrentYear")}><Link href="/mobile/donate/print"><Button data-testid="print-current-year-button" aria-label={Locale.label("donate.printCurrentYear")}><Icon>print</Icon> &nbsp; {Locale.label("donate.currentYearPrint")}</Button></Link></MenuItem>
          <MenuItem onClick={handleClose} dense data-testid="export-last-year-csv" aria-label={Locale.label("donate.exportLastYearCsv")}><ExportLink data={last_year} filename="last_year_donations" customHeaders={customHeaders} text={Locale.label("donate.lastYearCsv")} icon="table_chart" data-testid="last-year-export-link" /></MenuItem>
          <MenuItem onClick={handleClose} dense data-testid="print-last-year" aria-label={Locale.label("donate.printLastYear")}><Link href="/mobile/donate/print?prev=1"><Button data-testid="print-last-year-button" aria-label={Locale.label("donate.printLastYear")}><Icon>print</Icon> &nbsp; {Locale.label("donate.lastYearPrint")}</Button></Link></MenuItem>
        </Menu>
      </React.Fragment>
    );

    return result;
  };

  const getRows = () => {
    const rows: React.ReactElement[] = [];

    if (donations.length === 0) {
      rows.push(<TableRow key="0"><TableCell>{Locale.label("donation.page.willAppear")}</TableCell></TableRow>);
      return rows;
    }

    for (let i = 0; i < donations.length; i++) {
      const d = donations[i];
      const isPending = d.status === "pending";
      rows.push(
        <TableRow key={i} sx={{ opacity: isPending ? 0.8 : 1 }}>
          {appName !== "B1App" && <TableCell><Link href={"/donations/" + d.batchId}>{d.batchId}</Link></TableCell>}
          <TableCell>{DateHelper.prettyDate(DateHelper.toDate(d.donationDate))}</TableCell>
          <TableCell>{d.method} - {d.methodDetails}</TableCell>
          <TableCell>{d.fund.name}{isPending && " (" + Locale.label("donate.pending") + ")"}</TableCell>
          <TableCell sx={{ color: isPending ? "warning.main" : undefined }}>{CurrencyHelper.formatCurrencyWithLocale(d.fund.amount, d.currency || "usd")}</TableCell>
        </TableRow>
      );
    }
    return rows;
  };

  const getTableHeader = () => {
    const rows: React.ReactElement[] = [];

    if (donations.length > 0) {
      rows.push(
        <TableRow key="header" sx={{ textAlign: "left" }}>
          {appName !== "B1App" && <th>{Locale.label("donation.page.batch")}</th>}
          <th>{Locale.label("donation.page.date")}</th>
          <th>{Locale.label("donation.page.method")}</th>
          <th>{Locale.label("donation.page.fund")}</th>
          <th>{Locale.label("donation.page.amount")}</th>
        </TableRow>
      );
    }

    return rows;
  };

  React.useEffect(loadData, [props.personId]);

  const getTable = () => (<Table>
    <TableHead>{getTableHeader()}</TableHead>
    <TableBody>{getRows()}</TableBody>
  </Table>);

  if (isLoading) {
    return (
      <>
        {message && <Alert severity="success">{message}</Alert>}
        <Loading data-testid="payment-methods-loading" />
      </>
    );
  }

  return (
    <>
      {message && <Alert severity="success">{message}</Alert>}
      <MultiGatewayDonationForm
        person={person}
        customerId={customerId}
        paymentMethods={appHelperPaymentMethods || []}
        paymentGateways={paymentGateways}
        stripePromise={stripePromise}
        donationSuccess={handleDataUpdate}
        church={props?.church}
        churchLogo={props?.churchLogo}
      />
      <DisplayBox headerIcon="payments" headerText={Locale.label("donate.donations")} editContent={getEditContent()} data-testid="donations-display-box">
        {getTable()}
      </DisplayBox>
      <RecurringDonations customerId={customerId} paymentMethods={appHelperPaymentMethods || []} appName={appName} dataUpdate={handleDataUpdate} data-testid="recurring-donations" />
      <PaymentMethods person={person} customerId={customerId} paymentMethods={appHelperPaymentMethods || []} appName={appName} stripePromise={stripePromise} dataUpdate={handleDataUpdate} data-testid="payment-methods" />
    </>
  );
};
