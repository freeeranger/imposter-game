import licenseText from "../../../LICENSE?raw";

import { Page } from "@/components/ui/page";
import { cn } from "@/lib/utils";

// The GPL text is hard-wrapped at ~72 columns; rejoin each paragraph so it flows on a phone.
const LICENSE_PARAGRAPHS = licenseText
  .split(/\n\s*\n/)
  .map((paragraph) =>
    paragraph
      .split("\n")
      .map((line) => line.trim())
      .join(" ")
      .trim(),
  )
  .filter(Boolean);

// The GPL, readable in the app.
function LicensePage({
  open,
  predictive,
  onClose,
}: {
  open: boolean;
  predictive: boolean;
  onClose: () => void;
}) {
  // License, readable in-app
  return (
    <Page
      open={open}
      predictive={predictive}
      onClose={onClose}
      title="license"
      stacked
    >
      <div className="flex flex-col gap-4 pb-4 text-[14px] leading-relaxed text-muted-foreground">
        {LICENSE_PARAGRAPHS.map((paragraph, index) => {
          // Short lines are the license's own headings ("TERMS AND CONDITIONS", "0. Definitions.").
          const isHeading = paragraph.length < 60 && !paragraph.endsWith(",");
          return isHeading ? (
            <h2
              key={index}
              className={cn(
                "font-semibold text-foreground",
                index === 0 &&
                  "font-display text-lg font-extrabold leading-snug",
              )}
            >
              {paragraph}
            </h2>
          ) : (
            <p key={index}>{paragraph}</p>
          );
        })}
      </div>
    </Page>
  );
}

export { LicensePage };
