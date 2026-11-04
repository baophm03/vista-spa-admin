import { Modal, type ModalProps } from 'antd'
import type { ReactNode } from 'react'

export interface AppointmentModalsProps extends ModalProps {
  content?: ReactNode
}

export default function AppointmentModals({ content, children, ...props }: AppointmentModalsProps) {
  return <Modal {...props}>{content ?? children}</Modal>
}
