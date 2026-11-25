import { type CanActivate, Injectable } from "@nestjs/common";

import { HotelFormGate } from "./hotel-form-gate.js";

/**
 * The hotel form's mode on every public route (D-189 §4): set on the controller, it runs after the global
 * guards (so the route's rate limit has counted the call) and before the route's own guard and every pipe.
 * While the mode is off the route answers 404 whatever the body and the headers hold, so a malformed body
 * learns nothing of the form's fields. The mode is read past the configuration cache (HotelFormGate), so
 * switching it off closes every route at once; the services read it again for their own decisions.
 *
 * @example
 * \@Controller("hotel-form") \@Public() \@UseGuards(HotelFormModeGuard)
 * export class HotelFormController {}
 */
@Injectable()
export class HotelFormModeGuard implements CanActivate {
  constructor(private readonly gate: HotelFormGate) {}

  async canActivate(): Promise<boolean> {
    await this.gate.policy();
    return true;
  }
}
