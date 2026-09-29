"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Briefcase, CircleCheck, Speaker, User } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { resendSignUpEmail, signUp } from "@/lib/supabase/actions";
import { runAction } from "@/lib/toast-action";
import type { Role } from "@/lib/nav-items";

type Step = "account-type" | "details" | "success";

const SIGN_IN_FOOTER = (
  <>
    <span className="text-muted-foreground">Have an account? </span>
    <Link href="/sign-in" className="text-primary underline">
      Sign In
    </Link>
  </>
);

export default function SignUpPage() {
  const [step, setStep] = useState<Step>("account-type");
  const [accountType, setAccountType] = useState<Role>("organizer");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [resent, setResent] = useState(false);

  if (step === "account-type") {
    return (
      <AuthCard
        title="Choose Account Type"
        description="We have 3 types of account"
        footer={SIGN_IN_FOOTER}
        className="max-w-[720px]"
      >
        <div className="flex w-full gap-5">
          <AccountTypeOption
            icon={<Briefcase className="size-[22px]" />}
            title="Organizer Account"
            description="Book talent for your event"
            selected={accountType === "organizer"}
            onClick={() => setAccountType("organizer")}
          />
          <AccountTypeOption
            icon={<User className="size-[22px]" />}
            title="Talent Account"
            description="Pick up gigs that fit your schedule, get paid"
            selected={accountType === "talent"}
            onClick={() => setAccountType("talent")}
          />
          <AccountTypeOption
            icon={<Speaker className="size-[22px]" />}
            title="Agency Account"
            description="Manage your roster and book more gigs"
            selected={accountType === "agency"}
            onClick={() => setAccountType("agency")}
          />
        </div>
        <Button
          type="button"
          onClick={() => setStep("details")}
          className="h-[52px] w-full rounded-[6px] text-base font-semibold"
        >
          Next Step
        </Button>
      </AuthCard>
    );
  }

  if (step === "details") {
    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
      setError(undefined);
      setPending(true);
      const formData = new FormData(e.currentTarget);
      formData.set("role", accountType);
      const result = await runAction(signUp(formData), {
        success: "Account created — check your email to confirm.",
      });
      setPending(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStep("success");
    }

    return (
      <AuthCard
        title="Sign up an account"
        description="Sign up to join our universe"
        footer={SIGN_IN_FOOTER}
      >
        <form onSubmit={handleSubmit} className="flex w-full flex-col items-start gap-[22px]">
          <div className="flex w-full flex-col items-start gap-[18px]">
            <FormField label="Name" name="fullName" placeholder="Organizer Test" required />
            <FormField
              label="Email"
              name="email"
              type="email"
              placeholder="test@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <PasswordField
              label="Password"
              name="password"
              placeholder="••••••••••"
              minLength={6}
              required
              error={error}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="agree-terms" defaultChecked required />
            <Label htmlFor="agree-terms" className="text-sm font-medium text-muted-foreground">
              I Agree with{" "}
              <span className="text-primary underline">Term and Condition</span>
            </Label>
          </div>
          <Button type="submit" disabled={pending} className="h-[52px] w-full rounded-[6px] text-base font-semibold">
            {pending ? "Signing up..." : "Sign up"}
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={<CircleCheck className="size-[46px] text-green-500" />}
      title="Verify your Email"
      description={
        <>
          A verification email was sent to
          <br />
          <span className="font-medium text-foreground">{email || "test@gmail.com"}</span>
          <br />
          Please check and verify throught URL
        </>
      }
    >
      <Button asChild className="h-[52px] w-full rounded-[6px] text-base font-semibold">
        <Link href="/sign-in">Already did that</Link>
      </Button>
      <p className="text-center text-sm">
        <span className="text-muted-foreground">Didn&apos;t receive an email? </span>
        <button
          type="button"
          className="text-primary underline disabled:opacity-50"
          disabled={resent}
          onClick={async () => {
            const result = await runAction(resendSignUpEmail(email), {
              success: "Confirmation email resent.",
            });
            if (!("error" in result)) setResent(true);
          }}
        >
          {resent ? "Sent!" : "Resend"}
        </button>
      </p>
    </AuthCard>
  );
}

function AccountTypeOption({
  icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-start gap-3.5 rounded-[6px] border border-transparent bg-muted px-4 py-3.5 text-left transition-colors",
        selected && "border-primary bg-primary/5"
      )}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-[4.5px] bg-muted text-foreground">
        {icon}
      </div>
      <div className="flex flex-col gap-1 text-sm tracking-[-0.03em] text-foreground">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">{description}</span>
      </div>
    </button>
  );
}
