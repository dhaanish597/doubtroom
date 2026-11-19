"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, MessagesSquare, UserRound } from "lucide-react";

export function AppNav({ mentor }: { mentor: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/app", label: "Rooms", Icon: MessagesSquare },
    ...(mentor ? [{ href: "/app/mentor", label: "Mentor", Icon: GraduationCap }] : []),
    { href: "/app/me", label: "Me", Icon: UserRound },
  ];

  return (
    <nav aria-label="Main navigation" className="sticky bottom-0 z-10 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch px-3">
        {links.map(({ href, label, Icon }) => {
          const active = href === pathname || (href === "/app" && (pathname.startsWith("/app/room/") || pathname.startsWith("/app/dm/")));
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-15 flex-1 flex-col items-center justify-center gap-1 rounded-md text-xs font-medium focus-visible:outline-2 focus-visible:outline-inset ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon aria-hidden="true" className="size-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
