"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, type Lang } from "../../lib/i18n";

type ControlNavProps = {
  lang: Lang;
};

const items = [
  { href: "/control", zh: "概览", en: "Overview" },
  { href: "/control/subsystems", zh: "子系统", en: "Subsystems" },
  { href: "/control/tasks", zh: "任务", en: "Tasks" },
  { href: "/control/audit", zh: "审计", en: "Audit" },
  { href: "/control/report", zh: "报告", en: "Report" }
];

export default function ControlNav({ lang }: ControlNavProps) {
  const pathname = usePathname();
  return (
    <div className="page-links">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link key={item.href} href={item.href} className={active ? "control-link-active" : ""}>
            {t(lang, item.zh, item.en)}
          </Link>
        );
      })}
    </div>
  );
}
