"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, updatePassword } from "@/lib/supabase/actions";
import { runAction } from "@/lib/toast-action";

type Step = "request" | "check-email" | "reset" | "success";

const BACK_TO_SIGN_IN = (
  <>
    <span className="text-muted-foreground">Remember your password? Back to </span>
    <Link href="/sign-in" className="text-primary underline">
      Sign In
    </Link>
  </>
);

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const initialStep: Step = searchParams.get("step") === "reset" ? "reset" : "request";
  const [step, setStep] = useState<Step>(initialStep);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  if (step === "request") {
    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
      setError(undefined);
      setPending(true);
      const result = await runAction(requestPasswordReset(new FormData(e.currentTarget)), {
        success: "Reset link sent.",
      });
      setPending(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setStep("check-email");
    }

    return (
      <AuthCard
        title="Forgot Password"
        description="Welcome back! Please enter your details."
        footer={BACK_TO_SIGN_IN}
      >
        <form onSubmit={handleSubmit} className="flex w-full flex-col items-start gap-[22px]">
          <FormField
            label="Enter your Email"
            name="email"
            type="email"
            placeholder="test@gmail.com"
            error={error}
            required
          />
          <Button type="submit" disabled={pending} className="h-[52px] w-full rounded-[6px] text-base font-semibold">
            {pending ? "Sending..." : "Reset Password"}
          </Button>
        </form>
      </AuthCard>
    );
  }

  if (step === "check-email") {
    return (
      <AuthCard
        icon={<CircleCheck className="size-[46px] text-green-500" />}
        title="Check your Email"
        description="We sent a password reset link to your email. Follow it to set a new password."
        footer={BACK_TO_SIGN_IN}
      />
    );
  }

  if (step === "reset") {
    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
      e.preventDefault();
      setError(undefined);
      setPending(true);
      const result = await runAction(updatePassword(new FormData(e.currentTarget)), {
        success: "Password updated.",
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
        title="Set new Password"
        description="Welcome back! Please enter your details."
        footer={BACK_TO_SIGN_IN}
      >
        <form onSubmit={handleSubmit} className="flex w-full flex-col items-start gap-[22px]">
          <PasswordField label="Password" name="password" placeholder="••••••••••" minLength={6} required />
          <PasswordField
            label="Confirm Password"
            name="confirmPassword"
            placeholder="••••••••••"
            minLength={6}
            required
            error={error}
          />
          <Button type="submit" disabled={pending} className="h-[52px] w-full rounded-[6px] text-base font-semibold">
            {pending ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      icon={<CircleCheck className="size-[46px] text-green-500" />}
      title="Password Reset Succesfully"
      description="Now you can sign in to Hustle of Stars with new password"
    >
      <Button asChild className="h-[52px] w-full rounded-[6px] text-base font-semibold">
        <Link href="/sign-in">Back to Sign in</Link>
      </Button>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
