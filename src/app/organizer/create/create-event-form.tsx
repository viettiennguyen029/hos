"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { UploadSlot } from "@/components/shared/upload-slot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createEvent } from "@/lib/supabase/event-actions";
import { MAX_EVENT_PHOTOS } from "@/lib/supabase/event-photo-validation";
import { removeEventPhoto, uploadEventPhoto } from "@/lib/supabase/storage-actions";
import type { CategoryOption } from "@/lib/supabase/types";
import { runAction } from "@/lib/toast-action";

const STEPS = ["Event Details", "Add Photos", "Review & Budget"] as const;
type Step = (typeof STEPS)[number];

interface SlotValues {
  key: string;
  categoryId: string;
  priceUsd: string;
  quantity: string;
}

interface FormValues {
  eventName: string;
  date: string;
  time: string;
  venue: string;
  description: string;
  budgetMin: string;
  budgetMax: string;
  guests: string;
  requirements: string;
}

interface EventPhoto {
  path: string | null;
  url: string | null;
  pending: boolean;
  error?: string;
}

const INITIAL_VALUES: FormValues = {
  eventName: "",
  date: "",
  time: "",
  venue: "",
  description: "",
  budgetMin: "",
  budgetMax: "",
  guests: "",
  requirements: "",
};

const EMPTY_EVENT_PHOTO: EventPhoto = { path: null, url: null, pending: false };

function emptySlot(): SlotValues {
  return { key: crypto.randomUUID(), categoryId: "", priceUsd: "", quantity: "1" };
}

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

export function CreateEventForm({ categories }: { categories: CategoryOption[] }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [slots, setSlots] = useState<SlotValues[]>([emptySlot()]);
  const [photos, setPhotos] = useState<EventPhoto[]>(() =>
    Array.from({ length: MAX_EVENT_PHOTOS }, () => ({ ...EMPTY_EVENT_PHOTO }))
  );
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  const step: Step = STEPS[stepIndex];

  function set<K extends keyof FormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));
  }

  function setSlot<K extends keyof SlotValues>(key: string, field: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setSlots((s) => s.map((slot) => (slot.key === key ? { ...slot, [field]: e.target.value } : slot)));
  }

  function addSlot() {
    setSlots((s) => [...s, emptySlot()]);
  }
  function removeSlot(key: string) {
    setSlots((s) => (s.length > 1 ? s.filter((slot) => slot.key !== key) : s));
  }

  function next() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }
  function back() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setPending(true);

    const formData = new FormData();
    formData.set("eventName", values.eventName);
    formData.set("date", values.date);
    formData.set("time", values.time);
    formData.set("venue", values.venue);
    formData.set("description", values.description);
    formData.set("budgetMin", values.budgetMin);
    formData.set("budgetMax", values.budgetMax);
    formData.set("guests", values.guests);
    formData.set("requirements", values.requirements);
    formData.set(
      "photoPaths",
      JSON.stringify(photos.flatMap((photo) => (photo.path ? [photo.path] : [])))
    );
    formData.set(
      "slots",
      JSON.stringify(
        slots.map((s) => ({ categoryId: s.categoryId, priceUsd: s.priceUsd, quantity: s.quantity }))
      )
    );

    const result = await runAction(createEvent(formData), { success: "Event created." });
    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  function updatePhoto(index: number, photo: EventPhoto) {
    setPhotos((current) => current.map((item, itemIndex) => (itemIndex === index ? photo : item)));
  }

  function uploadPhoto(index: number) {
    return async (file: File) => {
      updatePhoto(index, { path: null, url: null, pending: true });
      const formData = new FormData();
      formData.set("image", file);
      const result = await uploadEventPhoto(formData);
      if ("error" in result) {
        updatePhoto(index, { path: null, url: null, pending: false, error: result.error });
      } else {
        updatePhoto(index, { path: result.path, url: result.url, pending: false });
      }
    };
  }

  async function removePhoto(index: number) {
    const photo = photos[index];
    if (!photo.path) return;

    updatePhoto(index, { ...photo, pending: true, error: undefined });
    const formData = new FormData();
    formData.set("path", photo.path);
    const result = await removeEventPhoto(formData);
    if ("error" in result) {
      updatePhoto(index, { ...photo, pending: false, error: result.error });
    } else {
      updatePhoto(index, { ...EMPTY_EVENT_PHOTO });
    }
  }

  if (done) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <div className="flex w-full max-w-[460px] flex-col items-center gap-5 rounded-md bg-muted p-10 text-center">
          <CheckCircle2 className="size-12 text-green-500" />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
              Event Created!
            </h1>
            <p className="text-sm text-muted-foreground">
              {values.eventName || "Your event"} is now live. You can start browsing talent to book.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3">
            <Button asChild className="h-11 w-full rounded-[6px]">
              <Link href="/organizer/discover">Find Talents</Link>
            </Button>
            <Button asChild variant="secondary" className="h-11 w-full rounded-[6px]">
              <Link href="/organizer/account/events">View My Events</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <h1 className="text-3xl font-bold tracking-[-0.03em] text-foreground">Create new Event</h1>

      <div className="flex items-center gap-3">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                i <= stepIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {i + 1}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                i <= stepIndex ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="h-px w-10 bg-border" />}
          </div>
        ))}
      </div>

      <div className="max-w-[640px] rounded-md bg-muted p-8">
        {step === "Event Details" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
            className="flex flex-col gap-5"
          >
            <Field
              label="Event Name"
              placeholder="Summer Music Festival"
              value={values.eventName}
              onChange={set("eventName")}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date" type="date" value={values.date} onChange={set("date")} required />
              <Field label="Time" type="time" value={values.time} onChange={set("time")} required />
            </div>
            <Field
              label="Venue / Address"
              placeholder="ABC Dance Zone, HCMC"
              value={values.venue}
              onChange={set("venue")}
              required
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="description" className="text-sm text-muted-foreground">
                Description
              </Label>
              <Textarea
                id="description"
                rows={4}
                className="rounded-[6px]"
                placeholder="Tell talents what to expect from your event"
                value={values.description}
                onChange={set("description")}
              />
            </div>
            <Button type="submit" className="h-11 w-full rounded-[6px]">
              Next Step
            </Button>
          </form>
        )}

        {step === "Add Photos" && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Add Photos</h2>
              <p className="text-sm text-muted-foreground">
                Add up to {MAX_EVENT_PHOTOS} photos of your venue or event
              </p>
            </div>
            <div className="grid grid-cols-5 gap-4">
              {photos.map((photo, index) => (
                <UploadSlot
                  key={index}
                  label={photo.path ? `Photo ${index + 1} uploaded` : `Add Photo ${index + 1}`}
                  filled={!!photo.path}
                  pending={photo.pending}
                  error={photo.error}
                  previewUrl={photo.url ?? undefined}
                  onFileSelected={uploadPhoto(index)}
                  onRemove={() => removePhoto(index)}
                  className="aspect-square"
                />
              ))}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={back} className="h-11 flex-1 rounded-[6px]">
                Back
              </Button>
              <Button
                type="button"
                onClick={next}
                disabled={photos.some((photo) => photo.pending)}
                className="h-11 flex-1 rounded-[6px]"
              >
                Next Step
              </Button>
            </div>
          </div>
        )}

        {step === "Review & Budget" && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Budget Min (VND)"
                type="number"
                placeholder="10,000,000"
                value={values.budgetMin}
                onChange={set("budgetMin")}
                required
              />
              <Field
                label="Budget Max (VND)"
                type="number"
                placeholder="50,000,000"
                value={values.budgetMax}
                onChange={set("budgetMax")}
                required
              />
            </div>
            <div className="flex flex-col gap-3">
              <Label className="text-sm text-muted-foreground">Talent Slots</Label>
              {slots.map((slot, i) => (
                <div key={slot.key} className="flex items-end gap-3 rounded-[8px] bg-muted p-3">
                  <div className="flex flex-1 flex-col gap-2">
                    <Label htmlFor={`slot-category-${slot.key}`} className="text-xs text-muted-foreground">
                      Category
                    </Label>
                    <select
                      id={`slot-category-${slot.key}`}
                      required
                      value={slot.categoryId}
                      onChange={setSlot(slot.key, "categoryId")}
                      className="h-11 rounded-[6px] border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <option value="" disabled>
                        Select talent category
                      </option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id} className="bg-background">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field
                    label="Price per Talent (USD)"
                    type="number"
                    placeholder="2000"
                    value={slot.priceUsd}
                    onChange={setSlot(slot.key, "priceUsd")}
                    required
                  />
                  <div className="w-24">
                    <Field
                      label="Needed"
                      type="number"
                      min={1}
                      value={slot.quantity}
                      onChange={setSlot(slot.key, "quantity")}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    disabled={slots.length === 1}
                    onClick={() => removeSlot(slot.key)}
                    aria-label={`Remove slot ${i + 1}`}
                    className="flex h-11 shrink-0 items-center justify-center rounded-[6px] bg-muted px-3 text-muted-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addSlot}
                className="flex w-fit items-center gap-1.5 rounded-[6px] bg-muted px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
              >
                <Plus className="size-3.5" /> Add Talent Slot
              </button>
            </div>
            <Field
              label="Expected Guests"
              type="number"
              placeholder="200"
              value={values.guests}
              onChange={set("guests")}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor="requirements" className="text-sm text-muted-foreground">
                Special Requirements
              </Label>
              <Textarea
                id="requirements"
                rows={3}
                className="rounded-[6px]"
                placeholder="Sound system provided, parking available, etc."
                value={values.requirements}
                onChange={set("requirements")}
              />
            </div>

            <div className="flex flex-col gap-1 rounded-[8px] bg-muted p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Event</span>
                <span className="font-medium text-foreground">{values.eventName || "Untitled Event"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Photos</span>
                <span className="font-medium text-foreground">
                  {photos.filter((photo) => photo.path).length} added
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Talent Slots</span>
                <span className="font-medium text-foreground">{slots.length}</span>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={back} className="h-11 flex-1 rounded-[6px]">
                Back
              </Button>
              <Button type="submit" disabled={pending} className="h-11 flex-1 rounded-[6px]">
                {pending ? "Creating..." : "Create Event"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
