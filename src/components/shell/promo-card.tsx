import Link from "next/link";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PromoCardProps {
  title: string;
  ctaLabel: string;
  ctaHref: string;
  className?: string;
  imageBackground?: boolean;
}

export function PromoCard({ title, ctaLabel, ctaHref, className, imageBackground }: PromoCardProps) {
  if (imageBackground) {
    return (
      <div className={`relative flex h-full flex-col justify-end gap-6 overflow-hidden rounded-md p-10 ${className ?? ""}`}>
        <div className="absolute inset-0 flex items-center justify-center bg-white/10 text-muted-foreground">
          <ImageIcon className="size-10" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <p className="relative max-w-[280px] text-2xl font-bold tracking-[-0.03em] text-white">{title}</p>
        <Button asChild className="relative w-fit rounded-[6px] px-6 text-sm font-semibold">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col justify-center gap-6 rounded-md bg-muted p-10 ${className ?? ""}`}>
      <p className="max-w-[350px] text-2xl font-medium tracking-[-0.03em] text-foreground">
        {title}
      </p>
      <Button asChild className="w-fit rounded-[6px] px-6 text-sm font-semibold">
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </div>
  );
}
