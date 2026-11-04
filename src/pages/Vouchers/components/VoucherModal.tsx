import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

export interface VoucherModalProps extends Omit<ModalProps, 'children'> {
  content: ReactNode
}

export default function VoucherModal({ content, ...props }: VoucherModalProps) {
  return <Modal {...props}>{content}</Modal>
}
