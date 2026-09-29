"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Camera, ImageIcon, KeyRound, Plus, ShieldCheck, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Role } from "@/lib/nav-items";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";
import { updateProfile } from "@/lib/supabase/profile-actions";
import { removeGalleryImage, uploadAvatar, uploadCover, uploadGalleryImage } from "@/lib/supabase/storage-actions";
import type { CategoryOption, CurrentUser, LookupOption } from "@/lib/supabase/types";
import { runAction } from "@/lib/toast-action";
import { cn } from "@/lib/utils";

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

export function ProfileContent({
  role,
  profile,
  categories,
  cities,
  genres,
}: {
  role: Role;
  profile: CurrentUser;
  categories: CategoryOption[];
  cities: LookupOption[];
  genres: LookupOption[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(profile.category_id ?? "");
  const [keywords, setKeywords] = useState<string[]>(profile.keywords ?? []);
  const [keywordInput, setKeywordInput] = useState("");
  const [pending, setPending] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [avatarPending, setAvatarPending] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [coverUrl, setCoverUrl] = useState(profile.cover_url);
  const [coverPending, setCoverPending] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [gallery, setGallery] = useState<string[]>(profile.gallery_urls ?? []);
  const [galleryPending, setGalleryPending] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [socialLinks, setSocialLinks] = useState<{ platform: string; url: string }[]>(
    profile.social_links ?? []
  );
  const [achievements, setAchievements] = useState<{ title: string; subtitle: string }[]>(
    profile.achievements ?? []
  );
  const [services, setServices] = useState<string[]>(profile.services ?? []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPending(true);
    const formData = new FormData();
    formData.set("avatar", file);
    const result = await runAction(uploadAvatar(formData), { success: "Avatar updated." });
    setAvatarPending(false);
    if (!("error" in result)) {
      setAvatarUrl(result.url);
      router.refresh();
    }
    e.target.value = "";
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverPending(true);
    const formData = new FormData();
    formData.set("cover", file);
    const result = await runAction(uploadCover(formData), { success: "Cover updated." });
    setCoverPending(false);
    if (!("error" in result)) {
      setCoverUrl(result.url);
      router.refresh();
    }
    e.target.value = "";
  }

  async function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setGalleryPending(true);
    const formData = new FormData();
    formData.set("image", file);
    const result = await runAction(uploadGalleryImage(formData), { success: "Image uploaded." });
    setGalleryPending(false);
    if (!("error" in result)) {
      setGallery((g) => [...g, result.url]);
      router.refresh();
    }
    e.target.value = "";
  }

  async function handleRemoveGalleryImage(url: string) {
    setGalleryPending(true);
    const formData = new FormData();
    formData.set("url", url);
    const result = await runAction(removeGalleryImage(formData), { success: "Image removed." });
    setGalleryPending(false);
    if (!("error" in result)) {
      setGallery((g) => g.filter((u) => u !== url));
      router.refresh();
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const formData = new FormData(e.currentTarget);
    formData.set("keywords", JSON.stringify(keywords));
    formData.set("socialLinks", JSON.stringify(socialLinks));
    formData.set("achievements", JSON.stringify(achievements));
    formData.set("services", JSON.stringify(services));
    await runAction(updateProfile(formData), { success: "Profile updated." });
    setPending(false);
  }

  function addKeyword() {
    const trimmed = keywordInput.trim();
    if (trimmed && !keywords.includes(trimmed)) setKeywords((k) => [...k, trimmed]);
    setKeywordInput("");
  }

  function addSocialLink() {
    setSocialLinks((rows) => [...rows, { platform: SOCIAL_PLATFORMS[0], url: "" }]);
  }
  function updateSocialLink(index: number, patch: Partial<{ platform: string; url: string }>) {
    setSocialLinks((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function removeSocialLink(index: number) {
    setSocialLinks((rows) => rows.filter((_, i) => i !== index));
  }

  function addAchievement() {
    setAchievements((rows) => [...rows, { title: "", subtitle: "" }]);
  }
  function updateAchievement(index: number, patch: Partial<{ title: string; subtitle: string }>) {
    setAchievements((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function removeAchievement(index: number) {
    setAchievements((rows) => rows.filter((_, i) => i !== index));
  }

  function addService() {
    setServices((rows) => [...rows, ""]);
  }
  function updateService(index: number, value: string) {
    setServices((rows) => rows.map((row, i) => (i === index ? value : row)));
  }
  function removeService(index: number) {
    setServices((rows) => rows.filter((_, i) => i !== index));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-center justify-end gap-3">
        <Button asChild type="button" variant="secondary" className="h-9 rounded-[6px]">
          <Link href={`/${role}/kyc`}>
            <ShieldCheck className="size-4" />
            KYC Verification
          </Link>
        </Button>
        <Button type="button" variant="secondary" className="h-9 rounded-[6px]">
          <KeyRound className="size-4" />
          Change your Password
        </Button>
        <Button type="submit" disabled={pending} className="h-9 rounded-[6px]">
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md bg-muted">
        {role === "talent" && (
          <>
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverPending}
              className="group relative flex h-[120px] w-full items-center justify-center bg-muted text-muted-foreground"
            >
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="" className="size-full object-cover" />
              ) : (
                <ImageIcon className="size-8" />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-5 text-white" />
              </span>
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleCoverChange}
              className="hidden"
            />
          </>
        )}
        <div className={cn("flex items-center gap-4 px-6 pb-6", role === "talent" ? "" : "pt-6")}>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarPending}
            className={cn(
              "group relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-muted text-muted-foreground",
              role === "talent" && "-mt-8"
            )}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <User className="size-6" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="size-5 text-white" />
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <div className="flex flex-col pt-2">
            <span className="text-lg font-bold text-foreground">{profile.full_name || "Your Account"}</span>
            <span className="text-sm text-muted-foreground">
              {avatarPending
                ? "Uploading..."
                : coverPending
                  ? "Uploading cover..."
                  : "Manage your profile information, password and more"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-md bg-muted p-6">
        <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>
        <div className="grid grid-cols-2 gap-5">
          <Field label="Display Name" name="fullName" defaultValue={profile.full_name} required />
          <Field label="Email" type="email" defaultValue={profile.email} disabled />
          <Field label="Phone number" type="tel" defaultValue="+84 90 123 4567" />
          <Field label="District" defaultValue="District 1" />
          <div className="flex flex-col gap-2">
            <Label className="text-sm text-muted-foreground">City/Province</Label>
            <select
              name="cityId"
              defaultValue={profile.city_id ?? ""}
              className="h-11 rounded-[6px] border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="" className="bg-background" />
              {cities.map((city) => (
                <option key={city.id} value={city.id} className="bg-background">
                  {city.name}
                </option>
              ))}
            </select>
          </div>
          {role === "talent" && (
            <>
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">Category</Label>
                <select
                  name="categoryId"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="h-11 rounded-[6px] border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="" className="bg-background" />
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-background">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">Sub-Category</Label>
                <select
                  key={categoryId}
                  name="subcategoryId"
                  defaultValue={profile.subcategory_id ?? ""}
                  className="h-11 rounded-[6px] border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="" className="bg-background" />
                  {(categories.find((c) => c.id === categoryId)?.subcategories ?? []).map((s) => (
                    <option key={s.id} value={s.id} className="bg-background">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                label="Date of Birth"
                name="dateOfBirth"
                type="date"
                defaultValue={profile.date_of_birth ?? ""}
              />
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">Genre</Label>
                <select
                  name="genreId"
                  defaultValue={profile.genre_id ?? ""}
                  className="h-11 rounded-[6px] border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="" className="bg-background" />
                  {genres.map((genre) => (
                    <option key={genre.id} value={genre.id} className="bg-background">
                      {genre.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-md bg-muted p-6">
        <h2 className="text-lg font-semibold text-foreground">Bio</h2>
        <div className="flex flex-col gap-2">
          <Label className="text-sm text-muted-foreground">Description</Label>
          <Textarea rows={3} name="bio" className="rounded-[6px]" defaultValue={profile.bio ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-sm text-muted-foreground">Thumbnail Image</Label>
          <div className="grid grid-cols-5 gap-3">
            {gallery.map((url) => (
              <div key={url} className="group relative aspect-square overflow-hidden rounded-[8px] bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveGalleryImage(url)}
                  className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {gallery.length < 5 && (
              <button
                type="button"
                aria-label="Add thumbnail"
                onClick={() => galleryInputRef.current?.click()}
                disabled={galleryPending}
                className="flex aspect-square items-center justify-center rounded-[8px] bg-muted text-muted-foreground hover:bg-accent"
              >
                <ImageIcon className="size-5" />
              </button>
            )}
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleGalleryChange}
            className="hidden"
          />
        </div>
      </div>

      {role === "talent" && (
        <div className="flex flex-col gap-4 rounded-md bg-muted p-6">
          <h2 className="text-lg font-semibold text-foreground">Keyword</h2>
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm text-foreground"
              >
                {kw}
                <button
                  type="button"
                  onClick={() => setKeywords((k) => k.filter((x) => x !== kw))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex w-fit items-center gap-2">
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKeyword();
                }
              }}
              placeholder="e.g. AcousticSet"
              className="h-9 w-48 rounded-[6px] text-xs"
            />
            <button
              type="button"
              onClick={addKeyword}
              className="flex shrink-0 items-center gap-1 rounded-[6px] bg-muted px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
            >
              <Plus className="size-3.5" /> Add Keyword
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-md bg-muted p-6">
        <h2 className="text-lg font-semibold text-foreground">Social Profile</h2>
        <div className="flex flex-col gap-3">
          {socialLinks.map((row, index) => (
            <div key={index} className="grid grid-cols-[1fr_2fr] gap-3">
              <select
                value={row.platform}
                onChange={(e) => updateSocialLink(index, { platform: e.target.value })}
                className="h-11 rounded-[6px] border border-input bg-transparent px-3 text-sm text-muted-foreground outline-none"
              >
                {SOCIAL_PLATFORMS.map((platform) => (
                  <option key={platform} value={platform} className="bg-background">
                    {platform}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <Input
                  value={row.url}
                  onChange={(e) => updateSocialLink(index, { url: e.target.value })}
                  placeholder="https://..."
                  className="h-11 rounded-[6px]"
                />
                <button
                  type="button"
                  onClick={() => removeSocialLink(index)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addSocialLink}
          className="flex w-fit items-center gap-1 rounded-[6px] bg-muted px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
        >
          <Plus className="size-3.5" /> Add Social Link
        </button>
      </div>

      {role === "talent" && (
        <>
          <div className="flex flex-col gap-4 rounded-md bg-muted p-6">
            <h2 className="text-lg font-semibold text-foreground">Services</h2>
            <div className="flex flex-col gap-3">
              {services.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={value}
                    onChange={(e) => updateService(index, e.target.value)}
                    placeholder="e.g. Rapper performs for music festival, bar, club and pub."
                    className="h-11 rounded-[6px]"
                  />
                  <button
                    type="button"
                    onClick={() => removeService(index)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addService}
              className="flex w-fit items-center gap-1 rounded-[6px] bg-muted px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
            >
              <Plus className="size-3.5" /> Add Services
            </button>
          </div>

          <div className="flex flex-col gap-4 rounded-md bg-muted p-6">
            <h2 className="text-lg font-semibold text-foreground">Achievement</h2>
            <div className="flex flex-col gap-3">
              {achievements.map((row, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr] gap-3">
                  <Input
                    value={row.title}
                    onChange={(e) => updateAchievement(index, { title: e.target.value })}
                    placeholder="e.g. 2023 Nominee - BET Award"
                    className="h-11 rounded-[6px]"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      value={row.subtitle}
                      onChange={(e) => updateAchievement(index, { subtitle: e.target.value })}
                      placeholder="e.g. Video Director of the Year"
                      className="h-11 rounded-[6px]"
                    />
                    <button
                      type="button"
                      onClick={() => removeAchievement(index)}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addAchievement}
              className="flex w-fit items-center gap-1 rounded-[6px] bg-muted px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
            >
              <Plus className="size-3.5" /> Add Achievement
            </button>
          </div>
        </>
      )}
    </form>
  );
}
