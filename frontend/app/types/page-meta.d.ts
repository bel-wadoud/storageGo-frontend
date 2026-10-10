// Page options read by the layouts.
declare module '#app' {
  interface PageMeta {
    /** Auth layout: a wider column, for pages that list files (a shared folder). */
    wide?: boolean
  }
}

export {}
