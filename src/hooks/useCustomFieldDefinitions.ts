import { useEffect, useState } from 'react'
import { message } from 'antd'
import { getCustomFieldDefs } from '@/api/endpoints/settings'
import { errorMessage, pickData } from '@/api/helpers'
import type { CustomFieldDef } from '@/api/models/customFieldDef'
import type { CustomFieldDefEntity } from '@/api/models/customFieldDefEntity'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'

export default function useCustomFieldDefinitions(entity: CustomFieldDefEntity) {
  const [definitions, setDefinitions] = useState<CustomFieldDefWithOptions[]>([])

  useEffect(() => {
    let active = true
    getCustomFieldDefs({ entity, is_active: true })
      .then((response) => {
        if (!active) return
        setDefinitions((pickData<CustomFieldDef[]>(response) ?? []) as CustomFieldDefWithOptions[])
      })
      .catch((error) => {
        if (active) message.error(`Không tải được trường tùy chỉnh: ${errorMessage(error)}`)
      })

    return () => { active = false }
  }, [entity])

  return definitions
}
