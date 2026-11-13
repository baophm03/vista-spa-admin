import CustomFieldFormItems, {
  normalizeCustomFieldValues,
  type CustomFieldDefWithOptions,
} from '@/components/CustomFieldFormItems'

export type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'

export const normalizeCustomerCustomFields = normalizeCustomFieldValues

export default function CustomerProfileCustomFields({ definitions }: { definitions: CustomFieldDefWithOptions[] }) {
  return <CustomFieldFormItems definitions={definitions} />
}
