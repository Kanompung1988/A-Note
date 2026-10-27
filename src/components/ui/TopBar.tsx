import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** The app's header: logo on the left, page-specific content on the right. */
export function TopBar({ children, href = "/" }: { children?: ReactNode; href?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href={href} className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
          <Image src="/brand/icon.png" alt="" width={36} height={36} className="rounded-xl" />
          A-Note
        </Link>
        {children}
      </div>
    </header>
  );
}
