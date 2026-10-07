import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PB_FIELDS, profileSchema } from "@/lib/validation";
import { OTHER_GYM, UNAFFILIATED } from "@/lib/gyms";
import { PhotoUploadError, savePhotoUpload } from "@/lib/uploads";
import { parseFormData } from "@/lib/http";
import { geocode } from "@/lib/geocode";
import { ensureGymPage } from "@/lib/gymPages";
import { isProfileSetupComplete } from "@/lib/profileSetup";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await parseFormData(req);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    accountType: formData.get("accountType"),
    bio: formData.get("bio"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    area: formData.get("area"),
    country: formData.get("country"),
    affiliateGym: formData.get("affiliateGym"),
    affiliateGymOther: formData.get("affiliateGymOther"),
    website: formData.get("website"),
    levels: formData.getAll("levels"),
    crossfitSinceYear: formData.get("crossfitSinceYear"),
    crossfitSinceMonth: formData.get("crossfitSinceMonth"),
    lookingFor: formData.getAll("lookingFor"),
    showLookingFor: formData.get("showLookingFor"),
    isSingle: formData.get("isSingle"),
    showRelationshipStatus: formData.get("showRelationshipStatus"),
    showSingleBadge: formData.get("showSingleBadge"),
    showAge: formData.get("showAge"),
    isPrivate: formData.get("isPrivate"),
    verificationRequested: formData.get("verificationRequested"),
    ...Object.fromEntries(PB_FIELDS.map((field) => [field, formData.get(field)])),
    displayedPbs: formData.getAll("displayedPbs"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (parsed.data.affiliateGym !== UNAFFILIATED && parsed.data.affiliateGym !== OTHER_GYM) {
    const gymExists = await prisma.gym.findFirst({
      where: { name: parsed.data.affiliateGym, status: "APPROVED" },
      select: { id: true },
    });
    if (!gymExists) {
      return NextResponse.json({ error: "Select a valid gym" }, { status: 400 });
    }
  }

  let photoPath: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      photoPath = await savePhotoUpload(photo, session.user.id, { square: true });
    } catch (err) {
      if (err instanceof PhotoUploadError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  let bannerPhotoPath: string | undefined;
  const bannerPhoto = formData.get("bannerPhoto");
  if (bannerPhoto instanceof File && bannerPhoto.size > 0) {
    try {
      bannerPhotoPath = await savePhotoUpload(bannerPhoto, session.user.id, { square: false });
    } catch (err) {
      if (err instanceof PhotoUploadError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  const data = parsed.data;

  const pbData = Object.fromEntries(PB_FIELDS.map((field) => [field, data[field] ?? null]));

  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      accountType: true,
      area: true,
      areaLat: true,
      areaLng: true,
      affiliateGym: true,
      levels: true,
      lookingFor: true,
      verificationRequestedAt: true,
      verifiedAt: true,
    },
  });

  // Once setup was already complete, accountType is locked in — an athlete
  // profile or an affiliate profile can't turn into the other kind, however
  // the request tries to relabel it, so this ignores whatever was submitted.
  if (current && isProfileSetupComplete(current)) {
    data.accountType = current.accountType;
  }

  // A verification request only makes sense for an AFFILIATE account, is a
  // one-way flag toward "pending" until an admin acts on it, and is cleared
  // outright if the account switches back to ATHLETE.
  let verificationFields: { verificationRequestedAt: Date | null; verifiedAt: Date | null } | undefined;
  if (data.accountType !== "AFFILIATE") {
    if (current?.verificationRequestedAt || current?.verifiedAt) {
      verificationFields = { verificationRequestedAt: null, verifiedAt: null };
    }
  } else if (data.verificationRequested && !current?.verifiedAt && !current?.verificationRequestedAt) {
    verificationFields = { verificationRequestedAt: new Date(), verifiedAt: current?.verifiedAt ?? null };
    const admins = await prisma.user.findMany({ where: { isAdmin: true }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          actorId: session.user.id,
          type: "AFFILIATE_VERIFICATION_REQUESTED" as const,
        })),
      });
    }
  } else if (!data.verificationRequested && current?.verificationRequestedAt && !current?.verifiedAt) {
    verificationFields = { verificationRequestedAt: null, verifiedAt: null };
  }
  // An affiliate's profile is the gym, so its name is always just the gym's
  // name rather than something typed separately (see EditProfileForm, which
  // doesn't even show a Name field for an AFFILIATE account).
  const name =
    data.accountType === "AFFILIATE"
      ? data.affiliateGym === OTHER_GYM
        ? data.affiliateGymOther!
        : data.affiliateGym
      : data.name!;

  const areaChanged = data.area !== current?.area;
  const missingCoords = current?.areaLat == null || current?.areaLng == null;
  let areaCoords: { areaLat: number | null; areaLng: number | null } | undefined;
  if (areaChanged || missingCoords) {
    const coords = data.area ? await geocode(data.area) : null;
    areaCoords = { areaLat: coords?.lat ?? null, areaLng: coords?.lng ?? null };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      accountType: data.accountType,
      bio: data.bio ?? null,
      dateOfBirth: data.dateOfBirth ?? null,
      gender: data.gender ?? null,
      area: data.area,
      country: data.country ?? null,
      ...areaCoords,
      affiliateGym: data.affiliateGym,
      affiliateGymOther: data.affiliateGym === OTHER_GYM ? data.affiliateGymOther : null,
      website: data.accountType === "AFFILIATE" ? (data.website ?? null) : null,
      levels: JSON.stringify(data.levels ?? []),
      ...verificationFields,
      crossfitSinceYear: data.crossfitSinceYear ?? null,
      crossfitSinceMonth: data.crossfitSinceMonth ?? null,
      lookingFor: JSON.stringify(data.lookingFor ?? []),
      showLookingFor: data.showLookingFor,
      isSingle: data.isSingle ?? null,
      showRelationshipStatus: data.isSingle !== undefined ? data.showRelationshipStatus : false,
      showSingleBadge: data.isSingle === true ? data.showSingleBadge : false,
      showAge: data.showAge,
      isPrivate: data.isPrivate,
      ...pbData,
      displayedPbs: JSON.stringify(data.displayedPbs ?? []),
      ...(photoPath ? { photo: photoPath } : {}),
      ...(bannerPhotoPath ? { bannerPhoto: bannerPhotoPath } : {}),
    },
  });

  await ensureGymPage(data.affiliateGym);

  return NextResponse.json({ ok: true });
}
