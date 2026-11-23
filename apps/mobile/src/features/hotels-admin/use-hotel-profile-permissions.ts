import { useStaffAccess, type StaffAccess } from "@ampm/api-client";

/** What the signed-in staff member may do with a hotel profile's restricted parts (D-171). */
export interface HotelProfilePermissions {
  /**
   * Set the internal rating and notes (`hotels.hotel_internal_rating_notes.update`: SA, HT). Editing a
   * hotel also needs the notes in its detail, which only a reader of them gets.
   */
  readonly canEditNotes: boolean;
}

/**
 * The permissions for a staff member's access, decided by @ampm/policy as the API decides them, a custom
 * role's grants included (D-164). Sales and Project Managers read the notes and change none.
 *
 * @example
 * hotelProfilePermissionsFor(staffAccessFor(me)); // SM: { canEditNotes: false }
 */
export function hotelProfilePermissionsFor(access: StaffAccess): HotelProfilePermissions {
  return { canEditNotes: access.can("hotels.hotel_internal_rating_notes.update") };
}

/**
 * The signed-in staff member's hotel profile permissions; none until `/me` answers. The UI leaves out
 * what a person may not change; the server stays the real gate.
 *
 *   const { canEditNotes } = useHotelProfilePermissions();
 */
export function useHotelProfilePermissions(): HotelProfilePermissions {
  return hotelProfilePermissionsFor(useStaffAccess());
}
