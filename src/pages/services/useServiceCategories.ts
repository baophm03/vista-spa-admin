import { useQueryClient } from '@tanstack/react-query'
import { getGetServiceCategoriesAdminQueryKey, useGetServiceCategoriesAdmin } from '@/api/endpoints/services'
import type { ServiceCategorySummary } from '@/api/models/serviceCategorySummary'
import type { ServiceCategoryRow } from './components/serviceTypes'

/** Danh sách danh mục (1 cấp) kèm tóm tắt dịch vụ — dùng chung cho trang Dịch vụ và trang chi tiết danh mục. */
export default function useServiceCategories() {
  const queryClient = useQueryClient()
  const query = useGetServiceCategoriesAdmin({ with_summary: true })
  const payload = query.data as unknown as {
    responseData?: ServiceCategoryRow[]
    meta?: { total?: number; uncategorized?: ServiceCategorySummary }
  } | undefined
  const categories = (payload?.responseData ?? []) as ServiceCategoryRow[]
  const uncategorized = payload?.meta?.uncategorized

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getGetServiceCategoriesAdminQueryKey() })
    void queryClient.invalidateQueries({ queryKey: ['service-stats'] })
  }

  return { query, categories, uncategorized, refresh }
}
