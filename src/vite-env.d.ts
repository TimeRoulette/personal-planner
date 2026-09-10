/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'epubjs' {
  interface NavItem {
    id?: string
    label: string
    href: string
    subitems?: NavItem[]
  }
  interface Navigation {
    toc: NavItem[]
  }
  interface Rendition {
    display(target?: string): Promise<void>
    prev(): void
    next(): void
    destroy(): void
    on(event: string, cb: (...args: unknown[]) => void): void
  }
  interface Book {
    ready: Promise<void>
    loaded: {
      navigation: Promise<Navigation>
    }
    navigation: Navigation
    spine: { items?: { href?: string; index?: number }[] }
    renderTo(element: HTMLElement, options?: Record<string, unknown>): Rendition
    locations: {
      generate(chars: number): Promise<void>
    }
  }
  export default function ePub(data: ArrayBuffer | string): Book
}
