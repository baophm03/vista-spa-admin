import type { Dayjs } from 'dayjs'
import type { AcademyCourse } from '@/api/models/academyCourse'

export type CourseFormValues = Omit<AcademyCourse, 'id' | 'created_at' | 'updated_at' | 'custom_fields' | 'start_date' | 'end_date'> & {
  start_date?: Dayjs | null
  end_date?: Dayjs | null
  cover_file_id?: string | null
  custom_fields?: Record<string, unknown>
}

export const CATEGORY_OPTIONS = [
  { value: 'SKINCARE', label: 'Chăm sóc da' },
  { value: 'ACNE', label: 'Điều trị mụn' },
  { value: 'MELASMA', label: 'Điều trị nám' },
  { value: 'SCAR', label: 'Điều trị sẹo' },
  { value: 'OTHER', label: 'Khác' },
]

export const LEVEL_OPTIONS = [
  { value: 'BASIC', label: 'Cơ bản' },
  { value: 'ADVANCED', label: 'Nâng cao' },
]
