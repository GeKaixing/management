"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import Sidebar from "./Sidebar";
import { t, type Lang } from "../../lib/i18n";

type DashboardShellProps = {
  lang: Lang;
  setLang: Dispatch<SetStateAction<Lang>>;
  title: string;
  children: ReactNode;
};

export default function DashboardShell({ lang, setLang, title, children }: DashboardShellProps) {
  return (
    <div className="app-shell">
      <Sidebar lang={lang} />
      <div className="content">
        <header className="page-header">
          <div>
            <p className="page-kicker">{t(lang, "后台管理", "Admin Console")}</p>
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="page-actions">
            <button className="lang-toggle" type="button" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
              {lang === "zh" ? "EN" : "中文"}
            </button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
