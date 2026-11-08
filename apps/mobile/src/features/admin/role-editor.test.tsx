import { fireEvent, screen } from "../../test/render";
import { RolesScreen } from "./roles-screen";
import {
  capabilityViewFixture,
  ok,
  renderWithApi,
  roleViewFixture,
  routedFetch,
  type FetchFn,
} from "./admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

const SYSTEM_ID = "018f0000-0000-7000-8000-0000000006a1";
const CUSTOM_ID = "018f0000-0000-7000-8000-0000000006c2";
const NEW_ID = "018f0000-0000-7000-8000-0000000006d3";

const systemRole = roleViewFixture({
  id: SYSTEM_ID,
  roleKey: "super_admin",
  name: "Super Admin",
  isSystem: true,
  capabilities: [
    capabilityViewFixture({
      id: "admin.roles.update:all",
      module: "admin",
      label: "Update — Roles",
      isEscalationLocked: true,
    }),
  ],
});

const customRole = roleViewFixture({
  id: CUSTOM_ID,
  roleKey: "custom_config",
  name: "Config editor",
  isSystem: false,
  capabilities: [
    capabilityViewFixture({
      id: "admin.configurations.update:all",
      module: "admin",
      label: "Update — Configuration",
    }),
  ],
});

/** The pick-list `GET /admin/capabilities` returns — two modules suffice to exercise the picker. */
const pickList = [
  capabilityViewFixture({ id: "crm.leads.read:all", module: "crm", label: "Read — Leads" }),
  capabilityViewFixture({ id: "crm.leads.update:all", module: "crm", label: "Update — Leads" }),
  capabilityViewFixture({ id: "tasks.tasks.read:all", module: "tasks", label: "Read — Tasks" }),
];

interface Captured {
  post?: unknown;
  patch?: unknown;
  deleted: boolean;
}

function editorFetch(captured: Captured): FetchFn {
  return routedFetch({
    "/admin/roles/assignable": () => ok([systemRole, customRole]),
    "/admin/capabilities": () => ok(pickList),
    "/admin/roles": (init) => {
      captured.post = JSON.parse(String(init?.body));
      return ok(roleViewFixture({ id: NEW_ID, roleKey: "custom_new", name: "Finance viewer" }));
    },
    [`/admin/roles/${CUSTOM_ID}`]: (init) => {
      if (init?.method === "DELETE") {
        captured.deleted = true;
        return ok(undefined);
      }
      captured.patch = JSON.parse(String(init?.body));
      return ok({ ...customRole, ...(captured.patch as object) });
    },
  });
}

async function renderEditor(captured: Captured): Promise<void> {
  await renderWithApi(<RolesScreen />, editorFetch(captured));
}

describe("RolesScreen custom-role editor", () => {
  it("creates a custom role from a name and picked capabilities", async () => {
    const captured: Captured = { deleted: false };
    await renderEditor(captured);
    await fireEvent.press(await screen.findByTestId("role-new"));
    expect(await screen.findByText("New custom role")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("role-name"), "Finance viewer");
    await fireEvent.press(await screen.findByTestId("capability-module-crm"));
    await fireEvent.press(await screen.findByTestId("capability-crm.leads.read:all"));
    await fireEvent.press(screen.getByTestId("role-edit-submit"));
    expect(await screen.findByText("Role created")).toBeOnTheScreen();
    expect(captured.post).toEqual({
      name: "Finance viewer",
      capabilityIds: ["crm.leads.read:all"],
    });
  });

  it("validates that a role needs a name", async () => {
    const captured: Captured = { deleted: false };
    await renderEditor(captured);
    await fireEvent.press(await screen.findByTestId("role-new"));
    await fireEvent.press(await screen.findByTestId("role-edit-submit"));
    expect(screen.getByText("Give the role a name")).toBeOnTheScreen();
    expect(captured.post).toBeUndefined();
  });

  it("keeps a system role read-only (no edit or delete)", async () => {
    const captured: Captured = { deleted: false };
    await renderEditor(captured);
    await fireEvent.press(await screen.findByLabelText(/Super Admin, system role/));
    expect(await screen.findByText("Update — Roles")).toBeOnTheScreen();
    expect(screen.queryByTestId("role-manage-edit")).toBeNull();
    expect(screen.queryByTestId("role-manage-delete")).toBeNull();
  });

  it("edits a custom role, preserving its existing capabilities", async () => {
    const captured: Captured = { deleted: false };
    await renderEditor(captured);
    await fireEvent.press(await screen.findByLabelText(/Config editor, custom role/));
    await fireEvent.press(await screen.findByTestId("role-manage-edit"));
    expect(await screen.findByText("Edit custom role")).toBeOnTheScreen();
    // The name field is pre-filled from the role, so wait for it before changing it.
    await screen.findByDisplayValue("Config editor");
    await fireEvent.changeText(screen.getByTestId("role-name"), "Config manager");
    await fireEvent.press(screen.getByTestId("role-edit-submit"));
    expect(await screen.findByText("Role updated")).toBeOnTheScreen();
    expect(captured.patch).toEqual({
      name: "Config manager",
      capabilityIds: ["admin.configurations.update:all"],
    });
  });

  it("deletes a custom role after confirming", async () => {
    const captured: Captured = { deleted: false };
    await renderEditor(captured);
    await fireEvent.press(await screen.findByLabelText(/Config editor, custom role/));
    await fireEvent.press(await screen.findByTestId("role-manage-delete"));
    expect(await screen.findByText("Delete Config editor?")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("role-delete-confirm"));
    expect(await screen.findByText("Config editor deleted")).toBeOnTheScreen();
    expect(captured.deleted).toBe(true);
  });
});
