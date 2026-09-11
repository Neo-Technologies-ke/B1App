import { CurrencyHelper as AppCurrencyHelper } from "@churchapps/apphelper";
import { CurrencyHelper as SharedCurrencyHelper } from "@churchapps/helpers";

type CurrencyHelperLike = {
  formatCurrency?: (amount: number) => string;
  formatCurrencyWithLocale?: (amount: number, currency?: string, fractionDigits?: number) => string;
  getCurrencySymbol?: (currency?: string) => string;
  getLocaleForCurrency?: (currency: string) => string;
  loadCurrency?: () => Promise<string>;
  __lrcKesPatched?: boolean;
};

const applyKesPatch = (helper: CurrencyHelperLike) => {
  if (!helper || helper.__lrcKesPatched) return;
  helper.__lrcKesPatched = true;

  const originalFormatCurrencyWithLocale = helper.formatCurrencyWithLocale?.bind(helper);
  const originalGetCurrencySymbol = helper.getCurrencySymbol?.bind(helper);
  const originalGetLocaleForCurrency = helper.getLocaleForCurrency?.bind(helper);
  const originalLoadCurrency = helper.loadCurrency?.bind(helper);

  helper.getCurrencySymbol = (currency?: string) => {
    if ((currency || "").toLowerCase() === "kes") return "Kshs";
    return originalGetCurrencySymbol ? originalGetCurrencySymbol(currency) : "$";
  };

  helper.getLocaleForCurrency = (currency: string) => {
    if ((currency || "").toUpperCase() === "KES") return "en-KE";
    return originalGetLocaleForCurrency ? originalGetLocaleForCurrency(currency) : "en-US";
  };

  helper.formatCurrency = (amount: number) => {
    if (!helper.formatCurrencyWithLocale) return `${amount}`;
    return helper.formatCurrencyWithLocale(amount, "kes");
  };

  helper.loadCurrency = async () => {
    try {
      const loaded = (await originalLoadCurrency?.()) || "kes";
      return loaded.toLowerCase() === "usd" ? "kes" : loaded.toLowerCase();
    } catch {
      return "kes";
    }
  };

  if (originalFormatCurrencyWithLocale) {
    helper.formatCurrencyWithLocale = (amount: number, currency: string = "kes", fractionDigits = 2) => {
      const normalized = (currency || "kes").toLowerCase() === "usd" ? "kes" : currency;
      return originalFormatCurrencyWithLocale(amount, normalized, fractionDigits);
    };
  }
};

applyKesPatch(AppCurrencyHelper as CurrencyHelperLike);
applyKesPatch(SharedCurrencyHelper as CurrencyHelperLike);
