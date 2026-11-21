import Link from "next/link";

// On every page (added in the root layout).
export function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-1 px-5 py-8 text-xs text-muted-foreground">
      <span>
        © {new Date().getFullYear()} like<em className="text-[#6e4a35]">wise</em>
      </span>
      <Link href="/privacy" className="hover:text-foreground">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-foreground">
        Terms
      </Link>
      <Link href="/contact" className="hover:text-foreground">
        Contact
      </Link>
      <Link href="/for-stores" className="hover:text-foreground">
        For stores
      </Link>
    </footer>
  );
}
