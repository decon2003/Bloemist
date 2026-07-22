/** Error carrying an HTTP status, recognised by handleRouteError.
 *
 *  Lives in its own module so that both data-store.ts and validation.ts can use
 *  it without an import cycle. */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
