import type { Page } from "@playwright/test";

/**
 * Seed a ready-to-edit project (with a calibrated 1x1 px transparent plan) into
 * localStorage so canvas gestures are immediately testable without a real file
 * upload. The image is a tiny transparent PNG scaled by metersPerPixel.
 */
export async function seedProject(page: Page, name = "E2E Project"): Promise<string> {
  const id = `proj_e2e_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const floorId = `floor_${id}`;
  const scnId = `scn_${id}`;
  // 1x1 transparent PNG.
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  const project = {
    id,
    organizationId: "org-e2e",
    ownerId: "user-e2e",
    name,
    customer: "",
    location: "",
    regulatoryDomain: "US",
    allowDfs: false,
    unit: "m",
    locale: "en",
    materials: [
      {
        id: "concrete",
        name: "Concrete",
        attenuationDb: { "2.4": 12, "5": 15, "6": 17 },
        isDefault: true,
      },
      {
        id: "drywall",
        name: "Drywall",
        attenuationDb: { "2.4": 3, "5": 4, "6": 5 },
        isDefault: true,
      },
      { id: "glass", name: "Glass", attenuationDb: { "2.4": 3, "5": 6, "6": 8 }, isDefault: true },
    ],
    thresholds: {
      dataRssiDbm: -67,
      voiceRssiDbm: -65,
      highDensityRssiDbm: -62,
      minSnrDb: 25,
      minSecondaryRssiDbm: -72,
      maxClientsPerAp: 30,
      minThroughputMbps: 25,
    },
    scenarios: [
      {
        id: scnId,
        name: "Current design",
        isBaseline: true,
        floors: [
          {
            id: floorId,
            name: "Floor 1",
            index: 0,
            ceilingHeightM: 3,
            plan: {
              id: `plan_${id}`,
              fileName: "e2e.png",
              imageSrc: png,
              widthPx: 1200,
              heightPx: 800,
              metersPerPixel: 0.05,
              locked: false,
              opacity: 1,
            },
            walls: [],
            accessPoints: [],
            requirements: [],
          },
        ],
      },
    ],
    activeScenarioId: scnId,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  await page.addInitScript((proj) => {
    const map: Record<string, unknown> = {};
    map[(proj as { id: string }).id] = proj;
    window.localStorage.setItem("cwp:projects", JSON.stringify(map));
  }, project);

  return id;
}

/** Seed a project that already has one AP and one wall for edit/context tests. */
export async function seedProjectWithObjects(page: Page, name = "E2E Objects"): Promise<string> {
  const id = `proj_e2eo_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const floorId = `floor_${id}`;
  const scnId = `scn_${id}`;
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

  const ap = {
    id: `ap_${id}`,
    productId: "cat9166",
    productRevisionId: "sample-0.1.0",
    name: "AP-Core-1",
    position: { x: 20, y: 15 }, // meters => screen depends on mpp 0.05 & pan
    rotationDeg: 0,
    orientationAzimuthDegrees: 0,
    orientationDowntiltDegrees: 0,
    mountingType: "ceiling",
    mountingHeightM: 3,
    antennaAssignments: [],
    radios: [
      {
        band: "2.4",
        enabled: true,
        txPowerDbm: 15,
        txPowerAuto: true,
        channel: 0,
        channelAuto: true,
        channelWidthMHz: 40,
        spatialStreams: 2,
        antennaGainDbi: 5,
      },
      {
        band: "5",
        enabled: true,
        txPowerDbm: 15,
        txPowerAuto: true,
        channel: 0,
        channelAuto: true,
        channelWidthMHz: 40,
        spatialStreams: 2,
        antennaGainDbi: 5,
      },
      {
        band: "6",
        enabled: true,
        txPowerDbm: 15,
        txPowerAuto: true,
        channel: 0,
        channelAuto: true,
        channelWidthMHz: 80,
        spatialStreams: 2,
        antennaGainDbi: 5,
      },
    ],
    modelOverrideWarnings: [],
    assetTag: "TAG-1",
    installStatus: "planned",
    locked: false,
    createdAt: now,
    updatedAt: now,
  };
  const wall = {
    id: `wall_${id}`,
    polyline: [
      { x: 5, y: 22 },
      { x: 35, y: 22 },
    ],
    materialId: "concrete",
    thicknessM: 0.15,
    heightM: 2.7,
    bottomElevationM: 0,
    openings: [],
  };

  const project = {
    id,
    organizationId: "org-e2e",
    ownerId: "user-e2e",
    name,
    customer: "",
    location: "",
    regulatoryDomain: "US",
    allowDfs: false,
    unit: "m",
    locale: "en",
    materials: [
      {
        id: "concrete",
        name: "Concrete",
        attenuationDb: { "2.4": 12, "5": 15, "6": 17 },
        isDefault: true,
      },
      {
        id: "drywall",
        name: "Drywall",
        attenuationDb: { "2.4": 3, "5": 4, "6": 5 },
        isDefault: true,
      },
    ],
    thresholds: {
      dataRssiDbm: -67,
      voiceRssiDbm: -65,
      highDensityRssiDbm: -62,
      minSnrDb: 25,
      minSecondaryRssiDbm: -72,
      maxClientsPerAp: 30,
      minThroughputMbps: 25,
    },
    scenarios: [
      {
        id: scnId,
        name: "Current design",
        isBaseline: true,
        floors: [
          {
            id: floorId,
            name: "Floor 1",
            index: 0,
            ceilingHeightM: 3,
            plan: {
              id: `plan_${id}`,
              fileName: "e2e.png",
              imageSrc: png,
              widthPx: 1200,
              heightPx: 800,
              metersPerPixel: 0.05,
              locked: false,
              opacity: 1,
            },
            walls: [wall],
            accessPoints: [ap],
            requirements: [],
          },
        ],
      },
    ],
    activeScenarioId: scnId,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };

  await page.addInitScript((proj) => {
    const map: Record<string, unknown> = {};
    map[(proj as { id: string }).id] = proj;
    window.localStorage.setItem("cwp:projects", JSON.stringify(map));
  }, project);

  return id;
}
