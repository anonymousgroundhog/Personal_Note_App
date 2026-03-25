import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface MeetingDraft {
  title: string
  attendees: string
  agenda: string
  bodyNotes: string
}

interface MeetingState {
  draft: MeetingDraft
  setTitle: (title: string) => void
  setAttendees: (attendees: string) => void
  setAgenda: (agenda: string) => void
  setBodyNotes: (notes: string) => void
  setDraft: (draft: MeetingDraft) => void
  clearDraft: () => void
}

const getDefaultTitle = () => {
  const now = new Date()
  return `Meeting ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export const useMeetingStore = create<MeetingState>()(
  persist(
    (set) => ({
      draft: {
        title: getDefaultTitle(),
        attendees: '',
        agenda: '',
        bodyNotes: '',
      },

      setTitle: (title) => set((state) => ({
        draft: { ...state.draft, title }
      })),

      setAttendees: (attendees) => set((state) => ({
        draft: { ...state.draft, attendees }
      })),

      setAgenda: (agenda) => set((state) => ({
        draft: { ...state.draft, agenda }
      })),

      setBodyNotes: (bodyNotes) => set((state) => ({
        draft: { ...state.draft, bodyNotes }
      })),

      setDraft: (draft) => set({ draft }),

      clearDraft: () => set({
        draft: {
          title: getDefaultTitle(),
          attendees: '',
          agenda: '',
          bodyNotes: '',
        }
      }),
    }),
    {
      name: 'meeting-draft-store',
      version: 1,
    }
  )
)
