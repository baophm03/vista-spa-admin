import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

export interface RoleModalsProps extends Omit<ModalProps, 'children'> {
  content: ReactNode
}

export default function RoleModals({ content, ...props }: RoleModalsProps) {
  return <Modal {...props}>{content}</Modal>
}
