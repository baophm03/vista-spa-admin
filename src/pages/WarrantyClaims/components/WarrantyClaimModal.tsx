import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

type WarrantyClaimModalProps = ModalProps & { children?: ReactNode }

export default function WarrantyClaimModal({ children, ...props }: WarrantyClaimModalProps) {
  return <Modal {...props}>{children}</Modal>
}
