"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/nav-items";
import { mockRoster, mockRosterByCategory } from "@/lib/mock-roster";
import { createPackage, updatePackage } from "@/lib/supabase/package-actions";
import type { CategoryOption, LookupOption, PackageRow } from "@/lib/supabase/types";
import { runAction } from "@/lib/toast-action";

type Step = "choose-talent" | "form" | "success";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function Field({ label, ...props }: { label: string } & React.ComponentProps<"input">) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <Input id={id} aria-label={label} placeholder={label} className="h-11 rounded-[6px]" {...props} />
  );
}

function SelectField({
  label,
  name,
  options,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  name: string;
  options: string[] | LookupOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  const normalized = options.map((o) => (typeof o === "string" ? { id: o, name: o } : o));
  return (
    <select
      id={id}
      name={name}
      aria-label={label}
      value={value}
      defaultValue={value === undefined ? (defaultValue ?? "") : undefined}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className="h-11 rounded-[6px] border border-input bg-transparent px-3 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <option value="" disabled>
        {label}
      </option>
      {normalized.map((o) => (
        <option key={o.id} value={o.id} className="bg-background text-foreground">
          {o.name}
        </option>
      ))}
    </select>
  );
}

export function CreatePackageDialog({
  role,
  open,
  onOpenChange,
  editingPackage,
  categories,
  cities,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When present, the dialog edits this package instead of creating a new one. */
  editingPackage?: PackageRow;
  categories: CategoryOption[];
  cities: LookupOption[];
}) {
  const isAgency = role === "agency";
  const isEditing = !isAgency && !!editingPackage;
  const [step, setStep] = useState<Step>(isAgency ? "choose-talent" : "form");
  const [selectedTalentId, setSelectedTalentId] = useState(mockRoster[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(editingPackage?.category_id ?? "");
  const [repeatOn, setRepeatOn] = useState(editingPackage?.repeat_on ?? true);
  const [selectedDays, setSelectedDays] = useState<string[]>(editingPackage?.repeat_days ?? ["SAT", "SUN"]);
  const [paymentMethod, setPaymentMethod] = useState<"Prepaid" | "Postpaid">(
    editingPackage?.payment_method ?? "Prepaid"
  );
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const selectedTalent = mockRoster.find((t) => t.id === selectedTalentId);

  function toggleDay(day: string) {
    setSelectedDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Agency package creation isn't wired to real data yet (agency is out of
    // scope for this pass) — keep its existing mock success behavior.
    if (isAgency) {
      setStep("success");
      return;
    }

    setError(undefined);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("repeatOn", String(repeatOn));
    formData.set("repeatDays", selectedDays.join(","));
    formData.set("paymentMethod", paymentMethod);

    const result = isEditing
      ? await runAction(updatePackage(editingPackage.id, formData), { success: "Package updated." })
      : await runAction(createPackage(formData), { success: "Package created." });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStep("success");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        {step === "choose-talent" && (
          <>
            <DialogHeader>
              <DialogTitle>Choose a Talent</DialogTitle>
              <DialogDescription>Choose a Talent to go to the next step</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2.5 rounded-full border border-input px-4 py-2.5">
              <Search className="size-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search for Artist, Band or everything..."
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex max-h-[360px] flex-col gap-5 overflow-y-auto">
              {Object.entries(mockRosterByCategory).map(([category, talents]) => (
                <div key={category} className="flex flex-col gap-3">
                  <span className="text-sm font-medium text-foreground">{category}</span>
                  <div className="grid grid-cols-3 gap-3">
                    {talents.map((talent) => (
                      <button
                        key={talent.id}
                        type="button"
                        onClick={() => setSelectedTalentId(talent.id)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-[8px] border border-transparent bg-muted p-3 text-left transition-colors",
                          selectedTalentId === talent.id && "border-primary bg-primary/5"
                        )}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                          <User className="size-4" />
                        </span>
                        <span className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{talent.name}</span>
                          <span className="text-xs text-muted-foreground">{talent.category}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="h-11 flex-1 rounded-[6px]" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button className="h-11 flex-1 rounded-[6px]" onClick={() => setStep("form")}>
                Next Step
              </Button>
            </div>
          </>
        )}

        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit Package" : "Create new Package"}</DialogTitle>
              <DialogDescription>Your offer request</DialogDescription>
            </DialogHeader>

            {isAgency && selectedTalent && (
              <div className="flex items-center gap-3 rounded-[8px] bg-muted p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
                  <User className="size-4" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{selectedTalent.name}</span>
                  <span className="text-xs text-muted-foreground">{selectedTalent.category}</span>
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Category"
                  name="categoryId"
                  options={categories}
                  value={categoryId}
                  onChange={setCategoryId}
                />
                <SelectField
                  key={categoryId}
                  label="Sub-Category"
                  name="subcategoryId"
                  options={categories.find((c) => c.id === categoryId)?.subcategories ?? []}
                  defaultValue={editingPackage?.subcategory_id ?? undefined}
                />
              </div>

              <Field label="Title" name="title" defaultValue={editingPackage?.title} required />

              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Residency"
                  name="residency"
                  options={["Resident", "Non-resident"]}
                  defaultValue={editingPackage?.residency ?? undefined}
                />
                <SelectField
                  label="Location"
                  name="cityId"
                  options={cities}
                  defaultValue={editingPackage?.city_id}
                />
              </div>

              {isAgency ? (
                <SelectField label="One-time" name="oneTime" options={["One-time", "Repeat"]} />
              ) : (
                <div className="flex flex-col gap-3 rounded-[8px] bg-muted p-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="repeat-on" className="text-sm text-foreground">
                      Repeat On
                    </Label>
                    <Switch id="repeat-on" checked={repeatOn} onCheckedChange={setRepeatOn} />
                  </div>
                  {repeatOn && (
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day) => (
                        <button
                          type="button"
                          key={day}
                          onClick={() => toggleDay(day)}
                          className={cn(
                            "rounded-[6px] px-3 py-2 text-xs font-medium transition-colors",
                            selectedDays.includes(day)
                              ? "bg-foreground text-background"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date" name="startDate" type="date" defaultValue={editingPackage?.start_date} required />
                <Field label="End Date" name="endDate" type="date" defaultValue={editingPackage?.end_date} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Time" name="startTime" type="time" defaultValue={editingPackage?.start_time} required />
                <Field label="End Time" name="endTime" type="time" defaultValue={editingPackage?.end_time} required />
              </div>

              <Textarea
                name="description"
                placeholder="Description"
                rows={3}
                className="rounded-[6px]"
                defaultValue={editingPackage?.description ?? undefined}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Working Method"
                  name="workingMethod"
                  defaultValue={editingPackage?.working_method ?? undefined}
                />
                <Field
                  label="Skill Tags"
                  name="skillTags"
                  placeholder="Skill Tags (comma separated)"
                  defaultValue={editingPackage?.skill_tags.join(", ")}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-col gap-2">
                <Label className="text-sm text-foreground">
                  Price Range<span className="text-primary">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Price Min" name="priceMin" type="number" defaultValue={editingPackage?.price_min_vnd} required />
                  <Field label="Price Max" name="priceMax" type="number" defaultValue={editingPackage?.price_max_vnd} required />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm text-foreground">
                  Payment method<span className="text-primary">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {(["Prepaid", "Postpaid"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={cn(
                        "flex items-center gap-2 rounded-[8px] border border-transparent bg-muted px-4 py-3 text-sm font-medium text-foreground transition-colors",
                        paymentMethod === method && "border-primary bg-primary/5"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border",
                          paymentMethod === method ? "border-primary" : "border-border"
                        )}
                      >
                        {paymentMethod === method && (
                          <span className="size-2 rounded-full bg-primary" />
                        )}
                      </span>
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" disabled={pending} className="h-11 w-full rounded-[6px]">
                {pending ? "Saving..." : isEditing ? "Save changes" : "Create new Package"}
              </Button>
              {isAgency && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 w-full rounded-[6px]"
                  onClick={() => setStep("choose-talent")}
                >
                  Back to Talents List
                </Button>
              )}
            </form>
          </>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="size-12 text-green-500" />
            <div className="flex flex-col gap-1">
              <DialogTitle>{isEditing ? "Package Updated!" : "Package Created!"}</DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Your changes are live."
                  : "Your new package is now live for organizers to book."}
              </DialogDescription>
            </div>
            <Button className="h-11 w-full rounded-[6px]" onClick={() => onOpenChange(false)}>
              Continue
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
