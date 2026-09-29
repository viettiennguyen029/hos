import Link from "next/link";
import Image from "next/image";

export function SidebarLogo({ href }: { href: string }) {
  return (
    <Link href={href} className="px-2">
      <Image src="/brand/logo.svg" alt="Hustle of Stars" width={116} height={35} priority />
    </Link>
  );
}
