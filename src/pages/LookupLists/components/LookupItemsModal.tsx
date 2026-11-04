import { Modal, Typography } from 'antd'
import LookupItemsManager from '@/components/LookupItemsManager'
import type { LookupList } from '@/api/models/lookupList'

interface LookupItemsModalProps {
  viewingList: LookupList | null
  onCancel: () => void
}

export default function LookupItemsModal({ viewingList, onCancel }: LookupItemsModalProps) {
  return (
    <Modal
      title={`Các mục — ${viewingList?.name ?? ''}`}
      open={!!viewingList}
      onCancel={onCancel}
      footer={null}
      width="min(1200px, calc(100vw - 24px))"
      destroyOnHidden
    >
      {viewingList && (
        <>
          <Typography.Text type="secondary" code style={{ display: 'block', marginBottom: 12 }}>{viewingList.key}</Typography.Text>
          <LookupItemsManager listId={viewingList.id} />
        </>
      )}
    </Modal>
  )
}
