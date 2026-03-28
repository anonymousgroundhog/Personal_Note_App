export type AcademicCategory = 'teaching' | 'research' | 'service'
export type ActivityStatus = 'planned' | 'in-progress' | 'completed'

export type TeachingType = 'course' | 'advising' | 'curriculum' | 'mentoring' | 'other'
export type ResearchType = 'journal-article' | 'conference-paper' | 'grant' | 'presentation' | 'poster' | 'book' | 'other'
export type ServiceType = 'committee' | 'peer-review' | 'outreach' | 'departmental' | 'professional' | 'other'
export type ActivityType = TeachingType | ResearchType | ServiceType

export interface AcademicYear {
  id: string
  label: string      // e.g. "2024-2025"
  startDate: string  // ISO YYYY-MM-DD
  endDate: string
  createdAt: number
}

export interface AcademicActivity {
  id: string
  yearId: string
  category: AcademicCategory
  type: ActivityType | null
  title: string
  description: string
  date: string
  status: ActivityStatus
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface CategorySummary {
  category: AcademicCategory
  total: number
  completed: number
  inProgress: number
  planned: number
}

export interface YearSummary {
  year: AcademicYear
  teaching: CategorySummary
  research: CategorySummary
  service: CategorySummary
  total: number
}

export const TEACHING_TYPES: { value: TeachingType; label: string }[] = [
  { value: 'course', label: 'Course' },
  { value: 'advising', label: 'Student Advising' },
  { value: 'curriculum', label: 'Curriculum Development' },
  { value: 'mentoring', label: 'Mentoring' },
  { value: 'other', label: 'Other' },
]

export const RESEARCH_TYPES: { value: ResearchType; label: string }[] = [
  { value: 'journal-article', label: 'Journal Article' },
  { value: 'conference-paper', label: 'Conference Paper' },
  { value: 'grant', label: 'Grant / Funding' },
  { value: 'presentation', label: 'Presentation / Talk' },
  { value: 'poster', label: 'Poster' },
  { value: 'book', label: 'Book / Book Chapter' },
  { value: 'other', label: 'Other' },
]

export const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: 'committee', label: 'Committee' },
  { value: 'peer-review', label: 'Peer Review' },
  { value: 'outreach', label: 'Community Outreach' },
  { value: 'departmental', label: 'Departmental Service' },
  { value: 'professional', label: 'Professional Organization' },
  { value: 'other', label: 'Other' },
]

export const CATEGORY_META: Record<AcademicCategory, { label: string; color: string; bg: string; border: string }> = {
  teaching: {
    label: 'Teaching',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
  },
  research: {
    label: 'Research',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
  },
  service: {
    label: 'Service',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
}

export const STATUS_META: Record<ActivityStatus, { label: string; color: string; dot: string }> = {
  planned: { label: 'Planned', color: 'text-gray-500', dot: 'bg-gray-400' },
  'in-progress': { label: 'In Progress', color: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-400' },
  completed: { label: 'Completed', color: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
}
