/**
 * Gallery utility functions extracted from main.js for testability.
 * main.js uses identical logic inline (plain <script>, not a module).
 */

function nextImageIndex(current, total) {
  return (current + 1) % total;
}

function prevImageIndex(current, total) {
  return (current - 1 + total) % total;
}

function computeLoadMoreState(displayedCount, totalCount) {
  if (displayedCount >= totalCount) {
    return { visible: false, text: '' };
  }
  const remaining = totalCount - displayedCount;
  return { visible: true, text: `Load More Photos (${remaining} remaining)` };
}

module.exports = { nextImageIndex, prevImageIndex, computeLoadMoreState };
