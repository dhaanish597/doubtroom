"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, MessagesSquare, UserRound } from "lucide-react";

import { refreshInboxBadge, useInboxBadge } from "@/lib/answers/client";

const BADGE_REFRESH_MS = 60_000;
const BADGE_MAX = 99;

/** Keeps the Mentor tab count fresh while the app is open. */
function useMentorBadge(enabled: boolean) {
  const count = useInboxBadge((state) => state.count);
  useEffect(() => {
    if (!enabled) return;
    void refreshInboxBadge();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refreshInboxBadge(); }, BADGE_REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void refreshInboxBadge(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
  return enabled ? count : null;
}

export function AppNav({ mentor }: { mentor: boolean }) {
  const pathname = usePathname();
  const pending = useMentorBadge(mentor);
  const links = [
    { href: "/app", label: "Rooms", Icon: MessagesSquare, badge: 0 },
    ...(mentor ? [{ href: "/app/mentor", label: "Mentor", Icon: GraduationCap, badge: pending ?? 0 }] : []),
    { href: "/app/me", label: "Me", Icon: UserRound, badge: 0 },
  ];

  return (
    <nav aria-label="Main navigation" className="sticky bottom-0 z-10 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch px-3">
        {links.map(({ href, label, Icon, badge }) => {
          const active = href === pathname || (href === "/app" && (pathname.startsWith("/app/room/") || pathname.startsWith("/app/dm/")));
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              aria-label={badge ? `${label}, ${badge} ${badge === 1 ? "answer" : "answers"} to check` : undefined}
              className={`flex min-h-15 flex-1 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium focus-visible:outline-2 focus-visible:outline-inset ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <span className="relative">
                <Icon aria-hidden="true" className="size-5" />
                {badge > 0 && (
                  <span aria-hidden="true" className="absolute -top-1.5 left-3 min-w-4.5 rounded-full bg-amber-500 px-1 text-center text-[0.625rem] font-bold leading-4.5 text-white ring-2 ring-background">
                    {badge > BADGE_MAX ? `${BADGE_MAX}+` : badge}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
