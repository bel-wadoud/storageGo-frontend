// The contact form of the public website (/contact): demo requests, sales, support, press.
// No account needed; the server limits how often an address or network can send.
import { api } from './client'

export type ContactTopic = 'demo' | 'sales' | 'support' | 'press'

export interface ContactMessage {
  name: string
  email: string
  organization: string
  size: '' | '1-10' | '11-50' | '51-250' | '251+'
  sector: '' | 'health' | 'legal' | 'finance' | 'public' | 'education' | 'other'
  topic: ContactTopic
  message: string
  locale: string
  /** Left empty by people; filled by bots (the server drops those). */
  website: string
}

export const contactApi = {
  send: (message: ContactMessage) => api<{ reference: string }>('/contact', { method: 'POST', body: message }),
}
