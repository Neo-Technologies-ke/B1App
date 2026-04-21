import { ApiHelper } from "@churchapps/apphelper";
import { CommonEnvironmentHelper } from "@churchapps/apphelper";
import { Locale } from "@churchapps/apphelper";

export class EnvironmentHelper {
  static Common = CommonEnvironmentHelper;
  public static LessonsApi = "";
  public static LessonsUrl = "";
  static hasInit = false;

  static initServerSide = async () => {
    if (!this.hasInit) {
      this.init();
      await this.initLocale();
    }
  };

  static init = () => {
    if (this.hasInit) return;
    this.hasInit = true;
    const stage = process.env.NEXT_STAGE || process.env.NEXT_PUBLIC_STAGE;

    switch (stage) {
      case "prod": EnvironmentHelper.initProd(); break;
      default: EnvironmentHelper.initStaging(); break;
    }

    // Apply NEXT_PUBLIC_* env vars — must come AFTER any initStaging/initProd
    // and we skip Common.init(stage) to prevent ChurchApps defaults overwriting our URLs.
    EnvironmentHelper.Common.MembershipApi = process.env.NEXT_PUBLIC_MEMBERSHIP_API || EnvironmentHelper.Common.MembershipApi;
    EnvironmentHelper.Common.AttendanceApi = process.env.NEXT_PUBLIC_ATTENDANCE_API || EnvironmentHelper.Common.AttendanceApi;
    EnvironmentHelper.Common.MessagingApi = process.env.NEXT_PUBLIC_MESSAGING_API || EnvironmentHelper.Common.MessagingApi;
    EnvironmentHelper.Common.ContentApi = process.env.NEXT_PUBLIC_CONTENT_API || EnvironmentHelper.Common.ContentApi;
    EnvironmentHelper.Common.GivingApi = process.env.NEXT_PUBLIC_GIVING_API || EnvironmentHelper.Common.GivingApi;
    EnvironmentHelper.Common.DoingApi = process.env.NEXT_PUBLIC_DOING_API || EnvironmentHelper.Common.DoingApi;
    EnvironmentHelper.Common.ContentRoot = process.env.NEXT_PUBLIC_CONTENT_ROOT || EnvironmentHelper.Common.ContentRoot;
    EnvironmentHelper.Common.MessagingApiSocket = process.env.NEXT_PUBLIC_MESSAGING_SOCKET || EnvironmentHelper.Common.MessagingApiSocket;
    EnvironmentHelper.LessonsApi = process.env.NEXT_PUBLIC_LESSONS_API || EnvironmentHelper.LessonsApi;

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
    let baseUrl = "https://portal.lifereformationcentre.org";
    if (typeof window !== "undefined") {
      baseUrl = window.location.origin;
    }
    await Locale.init([baseUrl + `/apphelper/locales/{{lng}}.json`]);
  };

  static initDev = () => {
    this.initStaging();
    EnvironmentHelper.LessonsApi = process.env.REACT_APP_LESSONS_API || process.env.NEXT_PUBLIC_LESSONS_API || EnvironmentHelper.LessonsApi;
  };

  //NOTE: None of these values are secret.
  static initStaging = () => {
    EnvironmentHelper.LessonsApi = "https://api.lifereformationcentre.org/lessons";
    EnvironmentHelper.LessonsUrl = "https://lessons.lifereformationcentre.org";
  };

  //NOTE: None of these values are secret.
  static initProd = () => {
    EnvironmentHelper.Common.GoogleAnalyticsTag = "G-XYCPBKWXB5";
    EnvironmentHelper.LessonsApi = "https://api.lifereformationcentre.org/lessons";
    EnvironmentHelper.LessonsUrl = "https://lessons.lifereformationcentre.org";
  };

}
