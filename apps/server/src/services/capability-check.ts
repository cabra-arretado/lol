import {
  isCapabilityAllowed,
  isCapabilityOptIn,
  type CapabilityCheck,
  type CapabilityId,
} from "@bb/domain";
import { getMarketplaceAccess, type DbConnection } from "@bb/db";

export function createCapabilityCheck(db: DbConnection): CapabilityCheck {
  const optIns: Partial<Record<CapabilityId, () => boolean>> = {
    remoteMarketplace: () => getMarketplaceAccess(db),
  };
  return (id) => {
    if (isCapabilityAllowed(id)) return true;
    if (!isCapabilityOptIn(id)) return false;
    return optIns[id]?.() ?? false;
  };
}
