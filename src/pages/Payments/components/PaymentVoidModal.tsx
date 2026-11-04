import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

export interface PaymentVoidModalProps extends Omit<ModalProps, 'children'> {
  content: ReactNode
}

export default function PaymentVoidModal({ content, ...props }: PaymentVoidModalProps) {
  return <Modal {...props}>{content}</Modal>
}
