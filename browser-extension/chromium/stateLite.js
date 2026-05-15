export const state = {
  activeHoverUrl: null,
  activeCoreItem: null,
  // === PHASE_OVERLAY_ON_IMAGE ===
  // For Type D: the element whose rect determines the visual overlay.
  // May differ from activeCoreItem when the overlay should outline the
  // dominantImg or its image-wrapping anchor rather than the full card.
  // Always equals activeCoreItem for non-Type-D evidence types.
  // === END PHASE_OVERLAY_ON_IMAGE ===
  activeOverlayElement: null,
  lastExtractedMetadata: null,
  itemMap: [],
};

