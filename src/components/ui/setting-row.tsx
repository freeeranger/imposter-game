import type { ReactNode } from "react";

// A labelled row with a control on the right, as used in settings lists.
const SettingRow = ({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) => (
  <div className="flex min-h-[60px] items-center justify-between gap-3 py-2.5">
    <label
      htmlFor={id}
      className="flex min-w-0 cursor-pointer flex-col gap-0.5"
    >
      <span className="text-[15px] font-semibold">{title}</span>
      {description && (
        <span className="text-[13px] text-muted-foreground">{description}</span>
      )}
    </label>
    {children}
  </div>
);

export { SettingRow };
