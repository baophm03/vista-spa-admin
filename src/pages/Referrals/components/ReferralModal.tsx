import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

type ReferralModalProps = ModalProps & { children?: ReactNode }

export default function ReferralModal({ children, ...props }: ReferralModalProps) {
  return <Modal {...props}>{children}</Modal>
}
