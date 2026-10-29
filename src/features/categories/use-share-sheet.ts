import { useState } from "react";

import { haptic, isNativeApp, shareLink } from "@/lib/native";
import { shareLinkFor } from "@/lib/share";

export type ShareableCategory = {
  name: string;
  words: string[];
  hard: string[];
};

// Sharing a category: a QR code to scan across the table, or a link to send. The category is
// kept after closing so the sheet still has content while it animates away.
export function useShareSheet() {
  const [showShareSheet, setShowShareSheet] = useState<boolean>(false);
  const [shareCategory, setShareCategory] = useState<ShareableCategory | null>(
    null,
  );
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);

  const openShareSheet = (category: ShareableCategory) => {
    haptic.tap();
    setShareCategory(category);
    setShareUrl(null);
    setLinkCopied(false);
    setShowShareSheet(true);
    void shareLinkFor({
      name: category.name,
      easy: category.words,
      hard: category.hard,
    }).then(setShareUrl);
  };

  const canUseShareMenu =
    isNativeApp || (typeof navigator !== "undefined" && "share" in navigator);
  const sendShareLink = async () => {
    if (!shareCategory || !shareUrl) return;
    haptic.tap();
    try {
      const result = await shareLink({
        title: shareCategory.name,
        text: `Add "${shareCategory.name}" to Imposter:`,
        url: shareUrl,
      });
      if (result === "copied") {
        haptic.success();
        setLinkCopied(true);
      }
    } catch {
      // The browser refused the clipboard; the QR code still works.
    }
  };

  return {
    showShareSheet,
    closeShareSheet: () => setShowShareSheet(false),
    shareCategory,
    shareUrl,
    linkCopied,
    canUseShareMenu,
    openShareSheet,
    sendShareLink,
  };
}

export type ShareSheet = ReturnType<typeof useShareSheet>;
