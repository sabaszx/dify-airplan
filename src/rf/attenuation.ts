/**
 * Resolve RF attenuation (dB) for a wall crossing given the material's model and
 * the in-material path length. Physical thickness never silently implies loss:
 * a "fixed" material is counted once per crossing regardless of thickness; a
 * thickness-dependent material uses the actual path length inside the wall.
 * See override §1.5. Original code.
 */
import type { AttenuationModel, AttenuationKey, WallMaterial } from "@/domain/model";

/** Legacy band keys that have a value in `attenuationDb`. */
const LEGACY_KEYS = new Set<AttenuationKey>(["2.4", "5", "6"]);

/**
 * @param inMaterialLengthM length the ray travels inside the wall volume (m).
 *   For a fixed-loss model this is ignored.
 */
export function resolveAttenuationDb(
  material: WallMaterial,
  key: AttenuationKey,
  inMaterialLengthM: number,
): number {
  const model: AttenuationModel | undefined = material.models?.[key];

  if (!model) {
    // Fall back to the legacy fixed per-band value when no explicit model exists.
    if (LEGACY_KEYS.has(key)) return material.attenuationDb[key as "2.4" | "5" | "6"];
    // BLE/UWB with no model: approximate from the nearest Wi-Fi band as a
    // labeled planning default (2.4 GHz for BLE, 6 GHz for UWB high band).
    return key === "ble" ? material.attenuationDb["2.4"] : material.attenuationDb["6"];
  }

  const len = Math.max(0, inMaterialLengthM);
  switch (model.kind) {
    case "fixed":
      return model.fixedDb;
    case "per-thickness":
      return model.lossPerMeterDb * len;
    case "base-plus-thickness":
      return model.baseDb + model.lossPerMeterDb * len;
    default:
      return 0;
  }
}

/** True when the material's model for this key depends on path length. */
export function isThicknessDependent(material: WallMaterial, key: AttenuationKey): boolean {
  const kind = material.models?.[key]?.kind;
  return kind === "per-thickness" || kind === "base-plus-thickness";
}
