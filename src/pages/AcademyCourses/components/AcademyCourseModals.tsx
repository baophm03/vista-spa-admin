import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

export interface AcademyCourseModalsProps extends Omit<ModalProps, 'children'> {
  content: ReactNode
}

export default function AcademyCourseModals({ content, ...props }: AcademyCourseModalsProps) {
  return <Modal {...props}>{content}</Modal>
}
