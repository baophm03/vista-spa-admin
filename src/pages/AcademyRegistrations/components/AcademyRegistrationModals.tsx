import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

export interface AcademyRegistrationModalsProps extends Omit<ModalProps, 'children'> {
  content: ReactNode
}

export default function AcademyRegistrationModals({ content, ...props }: AcademyRegistrationModalsProps) {
  return <Modal {...props}>{content}</Modal>
}
