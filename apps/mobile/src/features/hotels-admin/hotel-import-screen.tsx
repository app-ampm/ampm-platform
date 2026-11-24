import type { ReactNode } from "react";
import { useRouter } from "expo-router";

import type { HotelImportKind } from "@ampm/core";
import {
  EmptyState,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  SplitPane,
  Stack,
  useLayoutAt,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { ImportActions } from "./hotel-import-actions";
import { ImportColumnsHint } from "./hotel-import-columns-hint";
import { ImportContentInput } from "./hotel-import-content-input";
import { ImportKindPicker } from "./hotel-import-kind-picker";
import { ImportResultPanel } from "./hotel-import-result";
import { useHotelImportForm } from "./use-hotel-import-form";
import { useImportKinds, type ImportKinds } from "./use-import-kinds";

type ImportForm = ReturnType<typeof useHotelImportForm>;

interface ImportMainProps {
  readonly form: ImportForm;
  readonly kinds: readonly HotelImportKind[];
  readonly kind: HotelImportKind;
  readonly isDesktop: boolean;
}

/** The main column: the kind, its help below 1024, the CSV and the actions, each in a fixed place. */
function ImportMain({ form, kinds, kind, isDesktop }: ImportMainProps) {
  return (
    <Stack gap={4} testID="hotel-import-main">
      <ImportKindPicker
        kinds={kinds}
        value={kind}
        onChange={form.changeKind}
        disabled={form.pending}
      />
      {isDesktop ? null : <ImportColumnsHint kind={kind} />}
      <ImportContentInput content={form.content} setContent={form.setContent} tall={isDesktop} />
      <ImportActions
        pending={form.pending}
        canImport={form.canImport}
        lockNote={form.lockNote}
        onValidate={form.validate}
        onImport={form.runImport}
      />
    </Stack>
  );
}

/** Before `/me` answers, when it failed, or for a staff member who may import nothing: no form to show. */
function ImportUnavailable({ access }: { readonly access: ImportKinds }) {
  const goToSignIn = useGoToSignIn();
  if (access.isPending) {
    return (
      <Stack gap={4} testID="hotel-import-loading">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </Stack>
    );
  }
  // A failed /me (an ended session, no network) leaves the role unknown, which is not a denial: offer
  // sign-in or a retry rather than tell a Hotel team member their role lacks the access.
  if (access.isError) {
    return (
      <QueryErrorState
        error={access.error}
        onRetry={access.retry}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to import",
          description: "Your session has ended. Sign in again to continue.",
        }}
        testID="hotel-import-error"
      />
    );
  }
  return (
    <EmptyState
      title="Nothing to import"
      description="Your role does not add hotels, rooms, venues or rates to the catalogue. A Super Admin can give it the access."
      testID="hotel-import-none"
    />
  );
}

export interface HotelImportScreenProps {
  readonly tabBar?: ReactNode;
}

/**
 * Bulk-import the hotel catalogue from a CSV (H1.1, TW-25, D-181; Hotel team and Super Admin): hotels,
 * their room categories, their venues or their rates (into draft rate cards, as hidden items; D-184),
 * whichever kinds the staff member's grants allow. Download the kind's template, then paste the CSV or
 * choose a `.csv` file. **Validate** previews it and reports each row: the records it would add or
 * update with the columns that change, and the rejected rows by line and field, downloadable as a
 * report. **Import** then applies that preview by its job id (it keeps 24 hours); on a record already
 * in the catalogue a blank cell leaves the value unchanged. The server is the gate. From 1024 the CSV
 * and its actions sit beside a column with the help and the result; the help moves between two fixed
 * slots (it holds no state), and the CSV stays in its slot, so a resize never loses what was pasted.
 *
 *   <HotelImportScreen tabBar={<AppTabBar />} />
 */
export function HotelImportScreen({ tabBar }: HotelImportScreenProps) {
  const router = useRouter();
  const access = useImportKinds();
  const { kinds } = access;
  const form = useHotelImportForm(kinds);
  const isDesktop = useLayoutAt("lg");
  const { kind, result } = form;
  const side = (
    <Stack gap={4} testID="hotel-import-side">
      {isDesktop && kind !== null ? <ImportColumnsHint kind={kind} /> : null}
      {result ? <ImportResultPanel result={result} isStale={form.isStale} /> : null}
    </Stack>
  );
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={<ScreenHeader eyebrow="Hotels" title="Import" onBack={() => router.back()} />}
    >
      <SplitPane sideWidth="lg" side={side} testID="hotel-import-split">
        {kind === null ? (
          <ImportUnavailable access={access} />
        ) : (
          <ImportMain form={form} kinds={kinds} kind={kind} isDesktop={isDesktop} />
        )}
      </SplitPane>
    </Screen>
  );
}
