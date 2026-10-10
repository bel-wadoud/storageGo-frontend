// The plans storageGo sells, in Algerian dinars a month. The Go API is the source of truth for
// what an account pays; this list is what the public pricing page shows, and the development
// stand-ins use it too, so both always agree. Change prices here and on the server together.

export interface IndividualPlan {
  id: string
  name: string
  /** Bytes. */
  storage: number
  /** DZD a month. */
  price: number
}

export interface OrgPlan {
  name: string
  /** DZD per seat a month. */
  seat_price: number
  /** Bytes per seat, pooled for the whole organization. */
  storage_per_seat: number
  /** Fewest seats an organization can buy. */
  min_seats: number
}

export const INDIVIDUAL_PLANS: IndividualPlan[] = [
  { id: 'p20', name: 'Personnel 20', storage: 20_000_000_000, price: 450 },
  { id: 'p200', name: 'Personnel 200', storage: 200_000_000_000, price: 1_200 },
  { id: 'p1000', name: 'Personnel 1 To', storage: 1_000_000_000_000, price: 3_500 },
]

export const ORG_PLANS: OrgPlan[] = [
  { name: 'Organisation', seat_price: 900, storage_per_seat: 4_000_000_000, min_seats: 5 },
  { name: 'Organisation Plus', seat_price: 1_600, storage_per_seat: 20_000_000_000, min_seats: 5 },
]
