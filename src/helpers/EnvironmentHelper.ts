import { ApiHelper } from "@churchapps/apphelper";
import { CommonEnvironmentHelper } from "@churchapps/apphelper";
import { Locale } from "@churchapps/apphelper";

export class EnvironmentHelper {
  static Common = CommonEnvironmentHelper;
  public static LessonsApi = "";
  public static LessonsUrl = "";
  static hasInit = false;
  static hasLocaleInit = false;
  static localeInitPromise: Promise<void> | null = null;

  static initServerSide = async () => {
    this.init();
    if (!this.hasLocaleInit) {
      if (!this.localeInitPromise) {
        this.localeInitPromise = this.initLocale().then(() => { this.hasLocaleInit = true; });
      }
      await this.localeInitPromise;
    }
  };

  static init = () => {
    if (this.hasInit) return;
    this.hasInit = true;
    const stage = process.env.NEXT_STAGE || process.env.NEXT_PUBLIC_STAGE;

    //stage = "prod"
    switch (stage) {
      case "staging": EnvironmentHelper.initStaging(); break;
      case "prod": EnvironmentHelper.initProd(); break;
      default: EnvironmentHelper.initDev(); break;
    }
    EnvironmentHelper.Common.init(stage);

    if (process.env.NEXT_PUBLIC_MEMBERSHIP_API) EnvironmentHelper.Common.MembershipApi = process.env.NEXT_PUBLIC_MEMBERSHIP_API;
    if (process.env.NEXT_PUBLIC_ATTENDANCE_API) EnvironmentHelper.Common.AttendanceApi = process.env.NEXT_PUBLIC_ATTENDANCE_API;
    if (process.env.NEXT_PUBLIC_GIVING_API) EnvironmentHelper.Common.GivingApi = process.env.NEXT_PUBLIC_GIVING_API;
    if (process.env.NEXT_PUBLIC_MESSAGING_API) EnvironmentHelper.Common.MessagingApi = process.env.NEXT_PUBLIC_MESSAGING_API;
    if (process.env.NEXT_PUBLIC_CONTENT_API) EnvironmentHelper.Common.ContentApi = process.env.NEXT_PUBLIC_CONTENT_API;
    if (process.env.NEXT_PUBLIC_DOING_API) EnvironmentHelper.Common.DoingApi = process.env.NEXT_PUBLIC_DOING_API;
    if (process.env.NEXT_PUBLIC_REPORTING_API) EnvironmentHelper.Common.ReportingApi = process.env.NEXT_PUBLIC_REPORTING_API;
    if (process.env.NEXT_PUBLIC_CONTENT_ROOT) EnvironmentHelper.Common.ContentRoot = process.env.NEXT_PUBLIC_CONTENT_ROOT;
    if (process.env.NEXT_PUBLIC_MESSAGING_SOCKET) EnvironmentHelper.Common.MessagingApiSocket = process.env.NEXT_PUBLIC_MESSAGING_SOCKET;
    if (process.env.NEXT_PUBLIC_B1ADMIN_ROOT || process.env.NEXT_PUBLIC_B1_ADMIN_ROOT) EnvironmentHelper.Common.B1AdminRoot = process.env.NEXT_PUBLIC_B1ADMIN_ROOT || process.env.NEXT_PUBLIC_B1_ADMIN_ROOT;

    ApiHelper.apiConfigs = [
      { keyName: "MembershipApi", url: EnvironmentHelper.Common.MembershipApi, jwt: "", permissions: [] },
      { keyName: "AttendanceApi", url: EnvironmentHelper.Common.AttendanceApi, jwt: "", permissions: [] },
      { keyName: "MessagingApi", url: EnvironmentHelper.Common.MessagingApi, jwt: "", permissions: [] },
      { keyName: "ContentApi", url: EnvironmentHelper.Common.ContentApi, jwt: "", permissions: [] },
      { keyName: "GivingApi", url: EnvironmentHelper.Common.GivingApi, jwt: "", permissions: [] },
      { keyName: "DoingApi", url: EnvironmentHelper.Common.DoingApi, jwt: "", permissions: [] },
      { keyName: "LessonsApi", url: EnvironmentHelper.LessonsApi, jwt: "", permissions: [] },
      { keyName: "AskApi", url: EnvironmentHelper.Common.AskApi, jwt: "", permissions: [] }
    ];
  };

  static initLocale = async () => {
    let baseUrl = process.env.NEXT_PUBLIC_CHURCH_APPS_URL || "https://ironwood.staging.b1.church";
    if (typeof window !== "undefined") {
      baseUrl = window.location.origin;
    } else if (process.env.NEXT_PUBLIC_STAGE === "dev" || process.env.NEXT_STAGE === "dev") {
      const port = process.env.PORT || "3301";
      baseUrl = `http://localhost:${port}`;
    }
    await Locale.init([baseUrl + `/locales/{{lng}}.json?v=1`, baseUrl + `/apphelper/locales/{{lng}}.json`]);
  };

  static initDev = () => {
    this.initStaging();
    EnvironmentHelper.LessonsApi = process.env.REACT_APP_LESSONS_API || process.env.NEXT_PUBLIC_LESSONS_API || EnvironmentHelper.LessonsApi;
  };

  //NOTE: None of these values are secret.
  static initStaging = () => {
    EnvironmentHelper.LessonsApi = "https://api.staging.lessons.church";
    EnvironmentHelper.LessonsUrl = "https://staging.lessons.church";
  };

  //NOTE: None of these values are secret.
  static initProd = () => {
    EnvironmentHelper.Common.GoogleAnalyticsTag = "G-XYCPBKWXB5";
    EnvironmentHelper.LessonsApi = "https://api.lessons.church";
    EnvironmentHelper.LessonsUrl = "https://lessons.church";
  };

}
