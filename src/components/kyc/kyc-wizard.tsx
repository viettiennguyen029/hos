"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StepIndicator } from "@/components/shared/step-indicator";
import { UploadSlot } from "@/components/shared/upload-slot";
import { submitKyc } from "@/lib/supabase/kyc-actions";
import { uploadKycDocument } from "@/lib/supabase/storage-actions";
import { runAction } from "@/lib/toast-action";
import type { Role } from "@/lib/nav-items";

interface UploadState {
  path: string | null;
  pending: boolean;
  error?: string;
}

const EMPTY_UPLOAD: UploadState = { path: null, pending: false };

function Field({ label, ...props }: { label: string } & React.ComponentProps<"input">) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </Label>
      <Input id={id} className="h-11 rounded-[6px]" {...props} />
    </div>
  );
}

const INDIVIDUAL_STEPS = ["Personal Info", "ID Document", "Selfie Verification", "Review & Submit"];
const BUSINESS_STEPS = ["Business Info", "Business Documents", "Review & Submit"];

interface FormValues {
  fullName: string;
  dob: string;
  nationality: string;
  idNumber: string;
  address: string;
  companyName: string;
  businessRegNo: string;
  taxId: string;
  businessAddress: string;
  representativeName: string;
}

const INITIAL_VALUES: FormValues = {
  fullName: "",
  dob: "",
  nationality: "",
  idNumber: "",
  address: "",
  companyName: "",
  businessRegNo: "",
  taxId: "",
  businessAddress: "",
  representativeName: "",
};

export function KycWizard({ role }: { role: Role }) {
  const isBusiness = role === "agency";
  const steps = isBusiness ? BUSINESS_STEPS : INDIVIDUAL_STEPS;

  const [stepIndex, setStepIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [idFront, setIdFront] = useState<UploadState>(EMPTY_UPLOAD);
  const [idBack, setIdBack] = useState<UploadState>(EMPTY_UPLOAD);
  const [selfie, setSelfie] = useState<UploadState>(EMPTY_UPLOAD);
  const [license, setLicense] = useState<UploadState>(EMPTY_UPLOAD);
  const [taxDoc, setTaxDoc] = useState<UploadState>(EMPTY_UPLOAD);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  function set<K extends keyof FormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));
  }

  function uploadSlotHandler(
    docType: string,
    setSlot: React.Dispatch<React.SetStateAction<UploadState>>
  ) {
    return async (file: File) => {
      setSlot({ path: null, pending: true });
      const formData = new FormData();
      formData.set("file", file);
      formData.set("docType", docType);
      const result = await runAction(uploadKycDocument(formData), { success: "Document uploaded." });
      if ("error" in result) setSlot({ path: null, pending: false, error: result.error });
      else setSlot({ path: result.path, pending: false });
    };
  }

  function next() {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }
  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setPending(true);

    const formData = new FormData();
    if (isBusiness) {
      formData.set("companyName", values.companyName);
      formData.set("businessRegNo", values.businessRegNo);
      formData.set("taxId", values.taxId);
      formData.set("businessAddress", values.businessAddress);
      formData.set("representativeName", values.representativeName);
      formData.set("businessLicensePath", license.path ?? "");
      formData.set("taxRegistrationPath", taxDoc.path ?? "");
    } else {
      formData.set("fullName", values.fullName);
      formData.set("dob", values.dob);
      formData.set("nationality", values.nationality);
      formData.set("idNumber", values.idNumber);
      formData.set("address", values.address);
      formData.set("idFrontPath", idFront.path ?? "");
      formData.set("idBackPath", idBack.path ?? "");
      formData.set("selfiePath", selfie.path ?? "");
    }

    const result = await runAction(submitKyc(formData), { success: "KYC submission received." });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="flex w-full max-w-[460px] flex-col items-center gap-5 rounded-md bg-muted p-10 text-center">
          <Clock className="size-12 text-amber-500" />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
              Verification Submitted
            </h1>
            <p className="text-sm text-muted-foreground">
              We&rsquo;re reviewing your documents. This usually takes 1-2 business days — we&rsquo;ll
              email you once it&rsquo;s approved.
            </p>
          </div>
          <Button asChild className="h-11 w-full rounded-[6px]">
            <Link href={`/${role}`}>Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  const currentStep = steps[stepIndex];

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-[-0.03em] text-foreground">
          <ShieldCheck className="size-7 text-primary" />
          Verify your account
        </h1>
        <p className="text-sm text-muted-foreground">
          {isBusiness
            ? "Verify your agency to start booking talent for your clients"
            : "Complete verification to unlock bookings and payouts"}
        </p>
      </div>

      <StepIndicator steps={steps} activeIndex={stepIndex} />

      <div className="max-w-[640px] rounded-md bg-muted p-8">
        {!isBusiness && currentStep === "Personal Info" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
            className="flex flex-col gap-5"
          >
            <Field
              label="Full Legal Name"
              placeholder="Dang Kim Bao"
              value={values.fullName}
              onChange={set("fullName")}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date of Birth" type="date" value={values.dob} onChange={set("dob")} required />
              <Field
                label="Nationality"
                placeholder="Vietnamese"
                value={values.nationality}
                onChange={set("nationality")}
                required
              />
            </div>
            <Field
              label="ID / Passport Number"
              placeholder="079xxxxxxxxx"
              value={values.idNumber}
              onChange={set("idNumber")}
              required
            />
            <Field
              label="Residential Address"
              placeholder="114 Nam Ky Khoi Nghia Str, HCMC"
              value={values.address}
              onChange={set("address")}
              required
            />
            <Button type="submit" className="h-11 w-full rounded-[6px]">
              Next Step
            </Button>
          </form>
        )}

        {!isBusiness && currentStep === "ID Document" && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Upload ID Document</h2>
              <p className="text-sm text-muted-foreground">
                Upload a clear photo of the front and back of your government ID or passport
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <UploadSlot
                label={idFront.path ? "Front uploaded" : "Upload Front"}
                filled={!!idFront.path}
                pending={idFront.pending}
                error={idFront.error}
                onFileSelected={uploadSlotHandler("id-front", setIdFront)}
                onRemove={() => setIdFront(EMPTY_UPLOAD)}
                className="aspect-[4/3]"
              />
              <UploadSlot
                label={idBack.path ? "Back uploaded" : "Upload Back"}
                filled={!!idBack.path}
                pending={idBack.pending}
                error={idBack.error}
                onFileSelected={uploadSlotHandler("id-back", setIdBack)}
                onRemove={() => setIdBack(EMPTY_UPLOAD)}
                className="aspect-[4/3]"
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={back} className="h-11 flex-1 rounded-[6px]">
                Back
              </Button>
              <Button
                type="button"
                onClick={next}
                disabled={!idFront.path || !idBack.path}
                className="h-11 flex-1 rounded-[6px]"
              >
                Next Step
              </Button>
            </div>
          </div>
        )}

        {!isBusiness && currentStep === "Selfie Verification" && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Selfie Verification</h2>
              <p className="text-sm text-muted-foreground">
                Take a clear selfie in good lighting so we can match it to your ID
              </p>
            </div>
            <UploadSlot
              label={selfie.path ? "Selfie uploaded" : "Upload Selfie"}
              filled={!!selfie.path}
              pending={selfie.pending}
              error={selfie.error}
              onFileSelected={uploadSlotHandler("selfie", setSelfie)}
              onRemove={() => setSelfie(EMPTY_UPLOAD)}
              className="mx-auto aspect-square w-[220px]"
            />
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={back} className="h-11 flex-1 rounded-[6px]">
                Back
              </Button>
              <Button type="button" onClick={next} disabled={!selfie.path} className="h-11 flex-1 rounded-[6px]">
                Next Step
              </Button>
            </div>
          </div>
        )}

        {isBusiness && currentStep === "Business Info" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
            className="flex flex-col gap-5"
          >
            <Field
              label="Company Name"
              placeholder="Hustle of Stars Agency Co., Ltd"
              value={values.companyName}
              onChange={set("companyName")}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Business Registration No."
                placeholder="0312345678"
                value={values.businessRegNo}
                onChange={set("businessRegNo")}
                required
              />
              <Field label="Tax ID" placeholder="0312345678-001" value={values.taxId} onChange={set("taxId")} required />
            </div>
            <Field
              label="Business Address"
              placeholder="98 Hai Ba Trung Str, HCMC"
              value={values.businessAddress}
              onChange={set("businessAddress")}
              required
            />
            <Field
              label="Representative Name"
              placeholder="Dang Kim Bao"
              value={values.representativeName}
              onChange={set("representativeName")}
              required
            />
            <Button type="submit" className="h-11 w-full rounded-[6px]">
              Next Step
            </Button>
          </form>
        )}

        {isBusiness && currentStep === "Business Documents" && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Upload Business Documents</h2>
              <p className="text-sm text-muted-foreground">
                Upload your business license and tax registration certificate
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <UploadSlot
                label={license.path ? "License uploaded" : "Business License"}
                filled={!!license.path}
                pending={license.pending}
                error={license.error}
                onFileSelected={uploadSlotHandler("business-license", setLicense)}
                onRemove={() => setLicense(EMPTY_UPLOAD)}
                className="aspect-[4/3]"
              />
              <UploadSlot
                label={taxDoc.path ? "Tax doc uploaded" : "Tax Registration"}
                filled={!!taxDoc.path}
                pending={taxDoc.pending}
                error={taxDoc.error}
                onFileSelected={uploadSlotHandler("tax-registration", setTaxDoc)}
                onRemove={() => setTaxDoc(EMPTY_UPLOAD)}
                className="aspect-[4/3]"
              />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={back} className="h-11 flex-1 rounded-[6px]">
                Back
              </Button>
              <Button
                type="button"
                onClick={next}
                disabled={!license.path || !taxDoc.path}
                className="h-11 flex-1 rounded-[6px]"
              >
                Next Step
              </Button>
            </div>
          </div>
        )}

        {currentStep === "Review & Submit" && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <h2 className="text-lg font-semibold text-foreground">Review & Submit</h2>
            <div className="flex flex-col gap-2 rounded-[8px] bg-muted p-4 text-sm">
              {isBusiness ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Business License</span>
                    <span className="font-medium text-foreground">{license.path ? "Uploaded" : "Missing"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax Registration</span>
                    <span className="font-medium text-foreground">{taxDoc.path ? "Uploaded" : "Missing"}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID Document</span>
                    <span className="font-medium text-foreground">
                      {idFront.path && idBack.path ? "Uploaded" : "Incomplete"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selfie Verification</span>
                    <span className="font-medium text-foreground">{selfie.path ? "Uploaded" : "Missing"}</span>
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              By submitting, you confirm the information provided is accurate and belongs to you.
            </p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={back} className="h-11 flex-1 rounded-[6px]">
                Back
              </Button>
              <Button type="submit" disabled={pending} className="h-11 flex-1 rounded-[6px]">
                {pending ? "Submitting..." : "Submit for Review"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
