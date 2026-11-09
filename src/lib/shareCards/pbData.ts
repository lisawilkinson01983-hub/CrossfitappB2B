import { prisma } from "@/lib/prisma";
import { PB_LABELS } from "@/lib/labels";
import type { PbField } from "@/lib/validation";
import { photoToDataUri } from "./photo";
import type { PbCardAProps, PbCardBProps, PbCardCProps } from "./templates";

function formatKg(n: number): string {
  // Whole numbers plain ("140"), halves kept ("142.5") — PBs are entered to
  // the nearest 0.5kg (see PbEditor's step="0.5").
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Builds the props for all three PB card formats for the given session user. `previous`/`delta` come from the PATCH response at the moment the PB was saved — there's no historical PB table to recompute them from later. */
export async function loadPbCardData(
  userId: string,
  field: PbField,
  value: number,
  photoOverride: string | null,
  previous: number | null
): Promise<{ a: PbCardAProps; b: PbCardBProps; c: PbCardCProps } | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, photo: true } });
  if (!user) return null;

  const photo = await photoToDataUri(photoOverride ?? user.photo);
  const fieldLabel = PB_LABELS[field];
  const valueStr = formatKg(value);
  const delta = previous != null && value > previous ? `+${formatKg(value - previous)}kg` : null;
  const previousStr = previous != null ? `${formatKg(previous)}kg` : null;

  return {
    a: { name: user.name, photo, fieldLabel, value: valueStr, unit: "KG" },
    b: { name: user.name, photo, fieldLabel, value: valueStr, unit: "KG", delta, previous: previousStr },
    c: { photo, fieldLabel, value: valueStr, unit: "KG" },
  };
}
