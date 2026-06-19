/**
 * Shared gradient classes used across dashboard card thumbnails and placeholders.
 * Every page references this single array instead of defining its own copy.
 */
export const CARD_GRADIENTS = [
  "from-primary/25 via-surface-container to-secondary/10",
  "from-tertiary/25 via-surface-container to-primary/10",
  "from-secondary/20 via-surface-container to-tertiary/10",
  "from-primary/15 via-surface-container-high to-tertiary/15",
  "from-secondary/15 via-surface-container to-primary/15",
  "from-tertiary/15 via-surface-container-high to-secondary/15",
] as const;
