import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

export interface RewardModalsProps extends Omit<ModalProps, 'children'> {
  content: ReactNode
}

export default function RewardModals({ content, ...props }: RewardModalsProps) {
  return <Modal {...props}>{content}</Modal>
}
