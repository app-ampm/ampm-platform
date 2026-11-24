import { useStaffAccess, type StaffAccess } from "@ampm/api-client";

/** What the signed-in staff member may do with a hotel's documents library (D-187 §6). */
export interface DocumentPermissions {
  /** See the Documents tab, list the documents and open any version (`hotels.hotel_documents.read`). */
  readonly canRead: boolean;
  /** Upload a new document (`…create`: SA, HT). */
  readonly canUpload: boolean;
  /**
   * Upload a new version of one: the upload route checks the create key and a replacement also the
   * update key, so both are needed (SA, HT).
   */
  readonly canReplace: boolean;
  /** Delete a document with every version of it (`…delete`: SA, HT). */
  readonly canDelete: boolean;
  /** Start a draft F&B rate card from a menu (`hotels.rate_cards_rate_items.create`: SA, HT). */
  readonly canStartFbCard: boolean;
}

/**
 * The permissions for a staff member's access, decided by @ampm/policy as the API's guard decides them,
 * a custom role's grants included (D-164). A Sales Manager or a project manager reads and opens the
 * documents but changes none.
 *
 * @example
 * documentPermissionsFor(staffAccessFor(me)); // SM: { canRead: true, canUpload: false, … }
 */
export function documentPermissionsFor(access: StaffAccess): DocumentPermissions {
  const canUpload = access.can("hotels.hotel_documents.create");
  return {
    canRead: access.can("hotels.hotel_documents.read"),
    canUpload,
    canReplace: canUpload && access.can("hotels.hotel_documents.update"),
    canDelete: access.can("hotels.hotel_documents.delete"),
    canStartFbCard: access.can("hotels.rate_cards_rate_items.create"),
  };
}

/**
 * The signed-in staff member's document permissions; none until `/me` answers. The UI hides what a role
 * may not do; the server stays the real gate.
 */
export function useDocumentPermissions(): DocumentPermissions {
  return documentPermissionsFor(useStaffAccess());
}
