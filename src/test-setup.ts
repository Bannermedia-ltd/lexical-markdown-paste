import '@testing-library/react';

// Polyfill Range methods jsdom doesn't implement
if (typeof Range !== 'undefined') {
  Range.prototype.getBoundingClientRect = () => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  Range.prototype.getClientRects = () =>
    ({
      item: () => null,
      length: 0,
      [Symbol.iterator]: function (): Iterator<DOMRect> {
        return [][Symbol.iterator]();
      },
    }) as unknown as DOMRectList;
}

// Polyfill Element.scrollIntoView
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = () => {};
}

// Polyfill ResizeObserver
if (typeof ResizeObserver === 'undefined') {
  (globalThis as Record<string, unknown>).ResizeObserver =
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
}

/**
 * Minimal DataTransfer polyfill for jsdom.
 * jsdom does not implement DataTransfer natively.
 */
class MockDataTransfer {
  private store: Map<string, string> = new Map();

  getData(format: string): string {
    return this.store.get(format) ?? '';
  }

  setData(format: string, data: string): void {
    this.store.set(format, data);
  }

  clearData(format?: string): void {
    if (format) {
      this.store.delete(format);
    } else {
      this.store.clear();
    }
  }
}

if (typeof DataTransfer === 'undefined') {
  (globalThis as Record<string, unknown>).DataTransfer =
    MockDataTransfer;
}

// Polyfill ClipboardEvent if needed
if (typeof ClipboardEvent === 'undefined') {
  (globalThis as Record<string, unknown>).ClipboardEvent =
    class ClipboardEvent extends Event {
      clipboardData: DataTransfer | null;

      constructor(
        type: string,
        init?: ClipboardEventInit,
      ) {
        super(type, init);
        this.clipboardData = init?.clipboardData ?? null;
      }
    };
}
