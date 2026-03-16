"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type Lang } from "../../lib/i18n";

type SidebarProps = {
  lang: Lang;
};

const navItems = [
  { href: "/", zh: "概览", en: "Overview" },
  { href: "/live", zh: "监控", en: "Monitor" },
  { href: "/report", zh: "汇报", en: "Report" },
  { href: "/events", zh: "事件", en: "Events" },
  { href: "/docs", zh: "说明", en: "Docs" },
  { href: "/settings", zh: "设置", en: "Settings" }
];

export default function Sidebar({ lang }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">RC</div>
        <div>
          <div className="sidebar-title">Remote Camera</div>
          <div className="sidebar-subtitle">{t(lang, "后台管理", "Admin Console")}</div>
        </div>
      </div>

      <div className="sidebar-section">{t(lang, "模块", "Modules")}</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${active ? " active" : ""}`}
            >
              {t(lang, item.zh, item.en)}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="mono">{t(lang, "监控与设置在此管理", "Manage monitoring & settings here")}</div>
      </div>
    </aside>
  );
}
