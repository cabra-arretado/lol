import { z } from "zod";

export const capabilityIds = [
  "telemetry",
  "bbAccount",
  "bbConnect",
  "bbCloudAi",
  "remoteMarketplace",
  "thirdPartyPluginInstall",
  "skillsRegistry",
  "inAppUpdate",
  "desktopAutoUpdate",
  "remoteHostEnrollment",
  "serverMove",
  "nonLoopbackBind",
  "pushNotifications",
  "mobileApp",
  "remoteServerConnect",
  "providerUsagePolling",
  "remoteContentInPreviews",
] as const;

export const capabilityIdSchema = z.enum(capabilityIds);
export type CapabilityId = z.infer<typeof capabilityIdSchema>;

export const capabilityStateSchema = z.enum(["allowed", "denied"]);
export type CapabilityState = z.infer<typeof capabilityStateSchema>;

export const capabilityEditionSchema = z.enum(["personal"]);
export type CapabilityEdition = z.infer<typeof capabilityEditionSchema>;

export interface CapabilityDefinition {
  description: string;
  state: CapabilityState;
}

export const capabilityPolicySchema = z.object({
  edition: capabilityEditionSchema,
  capabilities: z.array(
    z.object({
      id: capabilityIdSchema,
      state: capabilityStateSchema,
      description: z.string(),
    }),
  ),
});
export type CapabilityPolicy = z.infer<typeof capabilityPolicySchema>;

export const PERSONAL_EDITION_CAPABILITIES: Readonly<
  Record<CapabilityId, CapabilityDefinition>
> = {
  telemetry: {
    description: "Send usage analytics to a third-party analytics service",
    state: "denied",
  },
  bbAccount: {
    description: "Sign in to a getbb.app account",
    state: "denied",
  },
  bbConnect: {
    description: "Expose this server through the bb connect tunnel",
    state: "denied",
  },
  bbCloudAi: {
    description: "Send prompts, diffs, and audio to bb cloud AI services",
    state: "denied",
  },
  remoteMarketplace: {
    description: "Fetch plugin marketplace catalogs from the network",
    state: "denied",
  },
  thirdPartyPluginInstall: {
    description: "Install plugins from npm or git sources",
    state: "denied",
  },
  skillsRegistry: {
    description: "Browse and install skills from the public skills registry",
    state: "denied",
  },
  inAppUpdate: {
    description: "Check for and apply bb-app updates from npm or git",
    state: "denied",
  },
  desktopAutoUpdate: {
    description: "Check for and install desktop app updates",
    state: "denied",
  },
  remoteHostEnrollment: {
    description: "Enroll remote machines as host daemons",
    state: "denied",
  },
  serverMove: {
    description: "Move, export, or import this server to another machine",
    state: "denied",
  },
  nonLoopbackBind: {
    description: "Listen on network interfaces other than loopback",
    state: "denied",
  },
  pushNotifications: {
    description: "Deliver notifications through a push service",
    state: "denied",
  },
  mobileApp: {
    description: "Pair and download the bb mobile app",
    state: "denied",
  },
  remoteServerConnect: {
    description: "Connect the desktop app to a bb server on another machine",
    state: "denied",
  },
  providerUsagePolling: {
    description: "Poll AI provider usage endpoints in the background",
    state: "denied",
  },
  remoteContentInPreviews: {
    description: "Load remote images and media in rendered previews",
    state: "denied",
  },
};

export const CAPABILITY_EDITION: CapabilityEdition = "personal";

export function isCapabilityAllowed(id: CapabilityId): boolean {
  return PERSONAL_EDITION_CAPABILITIES[id].state === "allowed";
}

export function capabilityPolicyView(): CapabilityPolicy {
  return {
    edition: CAPABILITY_EDITION,
    capabilities: capabilityIds.map((id) => ({
      id,
      state: PERSONAL_EDITION_CAPABILITIES[id].state,
      description: PERSONAL_EDITION_CAPABILITIES[id].description,
    })),
  };
}
