import { useState } from "react";

import { Button, Input, Row, Stack, Text, useToast } from "@ampm/ui";

import { oversizeFileNotice } from "./hotel-import.format";
import { pickCsvFile } from "./pick-csv-file";

/** Choose a `.csv` (the web workspace's file picker), with the chosen file's name beside it. */
function ChooseCsv({
  fileName,
  onPress,
}: {
  readonly fileName: string | null;
  readonly onPress: () => void;
}) {
  return (
    <Row gap={2} align="center" wrap>
      <Button
        variant="secondary"
        size="sm"
        icon="upload"
        onPress={onPress}
        testID="hotel-import-choose"
      >
        Choose CSV file
      </Button>
      {fileName ? (
        <Text variant="bodySmall" tone="muted">
          {fileName}
        </Text>
      ) : null}
    </Row>
  );
}

export interface ImportContentInputProps {
  readonly content: string;
  readonly setContent: (value: string) => void;
  /** Beside the side column on a desktop, the box shows a screenful of rows (a prop, not a new box). */
  readonly tall: boolean;
}

/**
 * Choose a `.csv` on the web, or paste the CSV directly (works on every platform). A file over the cap
 * is not read, and the screen says so.
 *
 *   <ImportContentInput content={content} setContent={setContent} tall={isDesktop} />
 */
export function ImportContentInput({ content, setContent, tall }: ImportContentInputProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const toast = useToast();
  const choose = (): void => {
    void pickCsvFile().then((picked) => {
      if (!picked) return;
      if (picked.content === null) {
        toast.show({ title: oversizeFileNotice(picked.name), tone: "danger" });
        return;
      }
      setContent(picked.content);
      setFileName(picked.name);
    });
  };
  return (
    <Stack gap={2}>
      <ChooseCsv fileName={fileName} onPress={choose} />
      <Input
        label="CSV content"
        value={content}
        onChangeText={(value) => {
          setContent(value);
          setFileName(null);
        }}
        placeholder="Paste the CSV here, or choose a file above."
        multiline
        {...(tall ? { numberOfLines: 14 } : {})}
        testID="hotel-import-content"
      />
    </Stack>
  );
}
