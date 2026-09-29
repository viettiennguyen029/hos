import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/supabase/server";

const CATEGORIES = ["Singing", "DJing", "MC / Hosting", "Photography", "Dance", "Live Music"];

export default async function LandingPage() {
  const profile = await getCurrentProfile();
  if (profile) redirect(`/${profile.role}`);

  return (
    <>
      <section className="flex flex-col items-center gap-6 px-4 py-24 text-center">
        <h1 className="max-w-2xl text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">
          Turn your talent into extra income
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Your skills. Your schedule. Extra income. Find gigs that fit around your life.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Get Started</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </section>

      <section className="flex flex-col items-center gap-10 px-4 py-16">
        <h2 className="text-2xl font-medium tracking-[-0.03em] text-foreground">How it works</h2>
        <div className="grid w-full max-w-3xl grid-cols-1 gap-8 sm:grid-cols-3">
          {[
            { step: "1", label: "Create your profile" },
            { step: "2", label: "Get booked" },
            { step: "3", label: "Get paid" },
          ].map(({ step, label }) => (
            <div key={step} className="flex flex-col items-center gap-2 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {step}
              </span>
              <p className="text-sm font-medium text-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-6 px-4 py-16">
        <h2 className="text-2xl font-medium tracking-[-0.03em] text-foreground">
          Every kind of talent welcome
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {CATEGORIES.map((category) => (
            <span
              key={category}
              className="rounded-full bg-muted px-4 py-2 text-sm text-foreground"
            >
              {category}
            </span>
          ))}
        </div>
      </section>

      <footer className="flex flex-col items-center gap-3 border-t border-border px-4 py-10 text-sm text-muted-foreground">
        <p>
          Hosting an event?{" "}
          <Link href="/sign-up" className="text-primary underline">
            Book talent
          </Link>
        </p>
        <p>
          <Link href="/sign-in" className="underline">
            Sign in
          </Link>{" "}
          ·{" "}
          <Link href="/sign-up" className="underline">
            Sign up
          </Link>
        </p>
      </footer>
    </>
  );
}
